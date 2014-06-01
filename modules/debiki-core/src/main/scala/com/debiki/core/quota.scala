/**
 * Copyright (C) 2012 Kaj Magnus Lindberg (born 1979)
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

package com.debiki.core

import Prelude._
import java.{util => ju}


trait QuotaCharger {

  def chargeOrThrow(quotaConsumers: QuotaConsumers,
        resourceUsage: ResourceUse, mayPilfer: Boolean)

  def throwUnlessEnoughQuota(quotaConsumers: QuotaConsumers,
        resourceUsage: ResourceUse, mayPilfer: Boolean)
}


case class OverQuotaException(
  consumer: QuotaConsumer,
  stateNow: QuotaState,
  stateAfter: QuotaState,
  outstanding: Long,
  message: String) extends QuickException {

  override def getMessage = message
}


/**
 * There are four consumer types. They are, and are identified by:
 *  - IP numbers, global: ip
 *  - IP numbers, per tenant: ip + tenantId
 *  - Tenants: tenantId
 *  - Roles: tenantId + roleId
 */
case class QuotaConsumers(
  tenantId: String,
  ip: Option[String] = None,
  roleId: Option[String] = None) {

  // Forbid unauthenticated users.
  require(roleId.filter(_.startsWith("-")).isEmpty)

  lazy val tenant = QuotaConsumer.Tenant(tenantId)
  lazy val globalIp = ip.map(QuotaConsumer.GlobalIp(_))
  lazy val perTenantIp =
     ip.map(value => QuotaConsumer.PerTenantIp(tenantId, ip = value))
  lazy val role = roleId.map(QuotaConsumer.Role(tenantId, _))

}


sealed abstract class QuotaConsumer

object QuotaConsumer {
  case class Tenant(tenantId: String) extends QuotaConsumer
  case class PerTenantIp(tenantId: String, ip: String) extends QuotaConsumer
  case class GlobalIp(ip: String) extends QuotaConsumer
  case class Role(tenantId: String, roleId: String) extends QuotaConsumer
}


case class QuotaUse(paid: Long, free: Long, freeload: Long) {
  require(0 <= paid)
  require(0 <= free)
  require(0 <= freeload)

  def +(that: QuotaUse) = QuotaUse(
    paid = paid + that.paid,
    free = free + that.free,
    freeload = freeload + that.freeload)

  def -(that: QuotaUse) = QuotaUse(
    paid = paid - that.paid,
    free = free - that.free,
    freeload = freeload - that.freeload)

  override def toString = s"QuotaUse(paid: $paid, free: $free, freeload: $freeload)"
}


object QuotaUse {
  def apply(): QuotaUse = QuotaUse(0, 0, 0)
}


case class ResourceUse(
   numLogins: Int = 0,
   numIdsUnau: Int = 0,
   numIdsAu: Int = 0,
   numRoles: Int = 0,
   numPages: Int = 0,
   numActions: Int = 0,
   numActionTextBytes: Long = 0,
   numNotfs: Int = 0,
   numEmailsOut: Int = 0,
   numDbReqsRead: Long = 0,
   numDbReqsWrite: Long = 0) {

  def +(that: ResourceUse) = ResourceUse(
     numLogins = numLogins + that.numLogins,
     numIdsUnau = numIdsUnau + that.numIdsUnau,
     numIdsAu = numIdsAu + that.numIdsAu,
     numRoles = numRoles + that.numRoles,
     numPages = numPages + that.numPages,
     numActions = numActions + that.numActions,
     numActionTextBytes = numActionTextBytes + that.numActionTextBytes,
     numNotfs = numNotfs + that.numNotfs,
     numEmailsOut = numEmailsOut + that.numEmailsOut,
     numDbReqsRead = numDbReqsRead + that.numDbReqsRead,
     numDbReqsWrite = numDbReqsWrite + that.numDbReqsWrite)

  override def toString = o"""
    ResourceUse(numLogins: $numLogins,
     numIdsUnau: $numIdsUnau,
     numIdsAu: $numIdsAu,
     numRoles: $numRoles,
     numPages: $numPages,
     numActions: $numActions,
     numActionTextBytes: $numActionTextBytes,
     numNotfs: $numNotfs,
     numEmailsOut: $numEmailsOut,
     numDbReqsRead: $numDbReqsRead,
     numDbReqsWrite: $numDbReqsWrite)"""
}


object ResourceUse {

  def forStoring(loginAttempt: LoginAttempt): ResourceUse = {
    // Could check login type, but for now simply overestimate:
    ResourceUse(
      numLogins = 1,
      numIdsUnau = 1,
      numIdsAu = 1,
      numRoles = 1)
  }


  def forStoring(
     login: Login = null,
     identity: Identity = null,
     user: User = null,
     actions: Seq[RawPostAction[_]] = Nil,
     page: PageParts = null,
     notfs: Seq[NotfOfPageAction] = Nil,
     email: Email = null)
      : ResourceUse = {

    val idty = identity
    val isUnauIdty = (idty ne null) && idty.isInstanceOf[IdentitySimple]
    val isEmailIdty = (idty ne null) && idty.isInstanceOf[IdentityEmailId]
    val allActions = (page eq null) ? actions | actions ++ page.allActions

    ResourceUse(
       numLogins = (login ne null) ? 1 | 0,
       numIdsUnau = isUnauIdty ? 1 | 0,
       // Don't count email id identities; they occupy no storage space.
       numIdsAu = ((idty ne null) && !isUnauIdty && !isEmailIdty) ? 1 | 0,
       numRoles = ((user ne null) && user.isAuthenticated) ? 1 | 0,
       numPages = (page ne null) ? 1 | 0,
       numActions = allActions.length,
       numActionTextBytes = allActions.foldLeft(0)(_ + _.textLengthUtf8),
       numNotfs = notfs.size,
       numEmailsOut = (email ne null) ? 1 | 0,
       numDbReqsRead = 0,
       numDbReqsWrite = 1)
  }
}


/**
 * Specifies how much quota and resource usage to add to a quota consumer.
 * If there's no existing info on that consumer, a new entry is created,
 * with `newLimits` and daily quota `initialDailyFree` and
 * `initialDailyFreeload`,
 */
case class QuotaDelta(
   mtime: ju.Date,
   deltaQuota: QuotaUse,
   deltaResources: ResourceUse,
   newFreeLimit: Long,
   newFreeloadLimit: Long,
   initialDailyFree: Long,
   initialDailyFreeload: Long,
   foundInDb: Boolean)


case class QuotaState(
   ctime: ju.Date,
   mtime: ju.Date,
   quotaUse: QuotaUse,
   quotaLimits: QuotaUse,
   quotaDailyFree: Long,
   quotaDailyFreeload: Long,
   resourceUse: ResourceUse) {

  require(quotaDailyFree >= 0)
  require(quotaDailyFreeload >= 0)

  // Don't do e.g.:  require(quotaLeftPaid >= 0)
  // Because: quotaLeftFree and/or quotaLeftFreeload are < 0, if over quota.
  // And: quotaLeftPaid could be somewhat < 0, if many threads and servers
  // charge the same consumer at once.

  def quotaLeftPaid = quotaLimits.paid - quotaUse.paid
  def quotaLeftFree = quotaLimits.free - quotaUse.free
  def quotaLeftFreeload = quotaLimits.freeload - quotaUse.freeload

  def useMoreQuota(amount: QuotaUse): QuotaState =
    copy(quotaUse = quotaUse + amount)

  def pushLimits(amount: QuotaUse): QuotaState =
    copy(quotaLimits = quotaLimits + amount)

  def useMoreResources(amount: ResourceUse): QuotaState =
    copy(resourceUse = resourceUse + amount)

  /**
   * Returns a QuotaUsage that has consumed `quotaAmount` more quota.
   * First uses up all free quota. Then all paid quota. Then, if
   * there is still quota outstanding, uses more free quota, ignoring
   * `quotaLimitFree`, but no more than `pilferLimit`.
   * Returns the amount of quota that could not be paid, not even after
   * having pilfered.
   */
  def charge(quotaAmount: Long, pilferLimit: Long): (QuotaState, Long) = {
    val freeQuotaToUse = math.min(quotaAmount, quotaLeftFree)
    val outstandingAfterFree = quotaAmount - freeQuotaToUse
    val paidQuotaToUse = math.min(outstandingAfterFree, quotaLeftPaid)
    val outstandingAfterPaid = outstandingAfterFree - paidQuotaToUse
    val toPilfer = math.min(outstandingAfterPaid, pilferLimit)
    val freeQuotaToUseAndPilfer = freeQuotaToUse + toPilfer
    val outstandingAfterPilfer = outstandingAfterPaid - toPilfer

    val newUse = quotaUse.copy(
       paid = quotaUse.paid + paidQuotaToUse,
       free = quotaUse.free + freeQuotaToUseAndPilfer)

    (copy(quotaUse = newUse), outstandingAfterPilfer)
  }

  /**
   * Returns a QuotaUsage that has freeloaded `quotaAmount` more quota.
   * If needed, pilfers, but at most `pilferLimit` freeload quota.
   * Also returns any amount of quota that could not be freeloaded or
   * pilfered.
   */
  def freeload(quotaAmount: Long, pilferLimit: Long): (QuotaState, Long) = {
    val freeloadAmount = math.min(quotaAmount, quotaLeftFreeload)
    val outstandingAfterFreeload = quotaAmount - freeloadAmount
    val pilferAmount = math.min(outstandingAfterFreeload, pilferLimit)
    val outstandingAfterPilfer = outstandingAfterFreeload - pilferAmount
    val newUse = quotaUse.copy(
       freeload = quotaUse.freeload + freeloadAmount + pilferAmount)

    (copy(quotaUse = newUse), outstandingAfterPilfer)
  }

}


