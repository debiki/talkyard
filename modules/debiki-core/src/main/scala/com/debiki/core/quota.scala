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


case class OverQuotaException(
  siteId: SiteId,
  resourceUseNow: ResourceUse,
  resourceUseAfter: ResourceUse,
  outstandingBytes: Long) extends QuickException {

  override def getMessage = s"Over quota: $outstandingBytes bytes missing"
}


case class ResourceUse(
   numGuests: Int = 0,
   numIdentities: Int = 0,
   numRoles: Int = 0,
   numRoleSettings: Int = 0,
   numPages: Int = 0,
   numPosts: Int = 0,
   numPostTextBytes: Long = 0,
   numPostsRead: Long = 0,
   numActions: Int = 0,
   numActionTextBytes: Long = 0,
   numNotfs: Int = 0,
   numEmailsSent: Int = 0) {

  def +(that: ResourceUse) = ResourceUse(
     numGuests = numGuests + that.numGuests,
     numIdentities = numIdentities + that.numIdentities,
     numRoles = numRoles + that.numRoles,
     numRoleSettings = numRoleSettings + that.numRoleSettings,
     numPages = numPages + that.numPages,
     numPosts = numPosts + that.numPosts,
     numPostTextBytes = numPostTextBytes + that.numPostTextBytes,
     numPostsRead = numPostsRead + that.numPostsRead,
     numActions = numActions + that.numActions,
     numActionTextBytes = numActionTextBytes + that.numActionTextBytes,
     numNotfs = numNotfs + that.numNotfs,
     numEmailsSent = numEmailsSent + that.numEmailsSent)

  override def toString = o"""
    ResourceUse(numGuests: $numGuests,
     numIdentities: $numIdentities,
     numRoles: $numRoles,
     numRoleSettings: $numRoleSettings,
     numPages: $numPages,
     numPosts: $numPosts,
     numPostTextBytes: $numPostTextBytes,
     numPostsRead: $numPostsRead,
     numActions: $numActions,
     numActionTextBytes: $numActionTextBytes,
     numNotfs: $numNotfs,
     numEmailsSent: $numEmailsSent)"""
}


object ResourceUse {

  def forStoring(loginAttempt: LoginAttempt): ResourceUse = {
    // Could check login type, but for now simply overestimate:
    ResourceUse(
      numGuests = 1,
      numIdentities = 1,
      numRoles = 1)
  }

  def forStoring(guestLoginAttempt: GuestLoginAttempt): ResourceUse = {
    ResourceUse(numGuests = 1)
  }

  def forStoring(
     identity: Identity = null,
     user: User = null,
     actions: Seq[RawPostAction[_]] = Nil,
     page: PageParts = null,
     notfs: Seq[Notification] = Nil,
     email: Email = null)
      : ResourceUse = {

    val idty = identity
    val isGuest = (user ne null) && user.isGuest
    val isEmailIdty = (idty ne null) && idty.isInstanceOf[IdentityEmailId]
    val allActions = (page eq null) ? actions | actions ++ page.rawActions
    val numPosts = ???
    val numPostsTextBytes = ??? // could be < 0 if a long post was shortened

    ResourceUse(
       numGuests = isGuest ? 1 | 0,
       // Don't count email id identities; they occupy no storage space.
       numIdentities = ((idty ne null) && !isGuest && !isEmailIdty) ? 1 | 0,
       numRoles = ((user ne null) && user.isAuthenticated) ? 1 | 0,
       numPages = (page ne null) ? 1 | 0,
       numPosts = numPosts,
       numPostTextBytes = numPostsTextBytes,
       numActions = allActions.length,
       numActionTextBytes = allActions.foldLeft(0)(_ + _.textLengthUtf8),
       numNotfs = notfs.size,
       numEmailsSent = (email ne null) ? 1 | 0)
  }
}



