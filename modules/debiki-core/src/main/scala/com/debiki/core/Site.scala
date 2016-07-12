/**
 * Copyright (c) 2011-2016 Kaj Magnus Lindberg
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


object Site {

  /** This site id is returned for any IPv4 address that doesn't match anything,
    * so it'll be possible to access the first site before a domain name has been
    * connected.
    */
  val FirstSiteId = "1"

  val Ipv4AnyPortRegex = """(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})(:\d+)?""".r

}


/**
  * @param hostname — doesn't include any port number.
  */
case class SiteIdHostname(id: SiteId, hostname: String)



sealed abstract class SiteStatus(val IntValue: Int) {
  def toInt = IntValue
  def mayAddAdmins: Boolean
  def mayAddModerators: Boolean
  def mayAddUsers: Boolean
  def isDeleted: Boolean = false
}


object SiteStatus {

  /** No site admin has been created.
    */
  case object NoAdmin extends SiteStatus(1) {
    def mayAddAdmins = true
    def mayAddModerators = false
    def mayAddUsers = false
  }

  /** "Normal" status. The site is in active use.
    */
  case object Active extends SiteStatus(2) {
    def mayAddAdmins = true
    def mayAddModerators = true
    def mayAddUsers = true
  }

  /** No content can be added, but content can be deleted, by staff, if it's reported as
    * offensive, for example. And more staff can be added, to help deleting any bad content.
    */
  case object ReadAndCleanOnly extends SiteStatus(3) {
    def mayAddAdmins = true
    def mayAddModerators = true
    def mayAddUsers = false
  }

  case object HiddenUnlessStaff extends SiteStatus(4) {
    def mayAddAdmins = true
    def mayAddModerators = true
    def mayAddUsers = false
  }

  case object HiddenUnlessAdmin extends SiteStatus(5) {
    def mayAddAdmins = true
    def mayAddModerators = false
    def mayAddUsers = false
  }

  /** Can be undeleted. Only visible to superadmins.
    */
  case object Deleted extends SiteStatus(6) {
    def mayAddAdmins = false
    def mayAddModerators = false
    def mayAddUsers = false
    override def isDeleted = true
  }

  /** Will be erased from disk, after a grace period.
    */
  case object WillBePurged extends SiteStatus(7) {
    def mayAddAdmins = false
    def mayAddModerators = false
    def mayAddUsers = false
    override def isDeleted = true
  }

  /** All contents has been erased from disk, except for a sites table entry.
    * Cannot be undeleted.
    */
  case object Purged extends SiteStatus(8) {
    def mayAddAdmins = false
    def mayAddModerators = false
    def mayAddUsers = false
    override def isDeleted = true
  }

  def fromInt(value: Int): Option[SiteStatus] = Some(value match {
    case SiteStatus.NoAdmin.IntValue => SiteStatus.NoAdmin
    case SiteStatus.Active.IntValue => SiteStatus.Active
    case SiteStatus.ReadAndCleanOnly.IntValue => SiteStatus.ReadAndCleanOnly
    case SiteStatus.HiddenUnlessAdmin.IntValue => SiteStatus.HiddenUnlessAdmin
    case SiteStatus.Deleted.IntValue => SiteStatus.Deleted
    case SiteStatus.Purged.IntValue => SiteStatus.Purged
    case _ => return None
  })
}


/** A website.
  */
case class Site(
  id: SiteId,
  status: SiteStatus,
  name: String,
  createdAt: When,
  creatorIp: String,
  creatorEmailAddress: String,
  embeddingSiteUrl: Option[String],
  hosts: List[SiteHost]) {

  // Reqiure at most 1 canonical host.
  //require((0 /: hosts)(_ + (if (_.isCanonical) 1 else 0)) <= 1)

  def canonicalHost: Option[SiteHost] = hosts.find(_.role == SiteHost.RoleCanonical)
  def theCanonicalHost = canonicalHost getOrDie "EsE7YKF2"

  def idAndCanonicalHostname =
    SiteIdHostname(id, canonicalHost.getOrDie("EsE2GUY5").hostname)
}



/** A server name that replies to requests to a certain website.
  * (Should be renamed to SiteHost.)
  */
object SiteHost {
  sealed abstract class Role
  case object RoleCanonical extends Role
  case object RoleRedirect extends Role
  case object RoleLink extends Role
  case object RoleDuplicate extends Role
}


case class SiteHost(
  hostname: String,
  role: SiteHost.Role)


/** The result of looking up a site by hostname.
  */
case class CanonicalHostLookup(
  siteId: SiteId,
  thisHost: SiteHost,
  canonicalHost: SiteHost) {

  def siteIdAndCanonicalHostname =
    SiteIdHostname(siteId, canonicalHost.hostname)
}


abstract class NewSiteData {
  def name: String
  def address: String

  /** Some E2E tests rely on the first site allowing the creation of embedded
    * discussions, so we need to be able to specify an embedding site URL.
    */
  def embeddingSiteUrl: Option[String] = None

  def newSiteOwnerData: NewSiteOwnerData
}


case class NewSiteOwnerData(
  ownerIp: String,
  ownerLoginId: String,
  ownerIdentity: IdentityOpenId,
  ownerRole: User)
