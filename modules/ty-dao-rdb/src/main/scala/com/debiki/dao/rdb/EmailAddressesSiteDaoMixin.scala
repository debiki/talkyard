/**
 * Copyright (C) 2017 Kaj Magnus Lindberg
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

package com.debiki.dao.rdb

import com.debiki.core._
import com.debiki.core.EmailNotfPrefs.EmailNotfPrefs
import com.debiki.core.Prelude._
import com.debiki.core.User.{LowestNonGuestId, LowestAuthenticatedUserId}
import _root_.java.{util => ju, io => jio}
import java.{sql => js}
import scala.collection.{immutable, mutable}
import scala.collection.{mutable => mut}
import scala.collection.mutable.{ArrayBuffer, StringBuilder}
import Rdb._
import RdbUtil._


/** Keeps track of which email addresses a member uses. They can for example have
  * a private primary email, for login and notifciations. And a public email,
  * shown on the website, that other people can contact, and that they don't care
  * super much about (it might get spammed, publicly visible).
  */
trait EmailAddressesSiteDaoMixin extends SiteTransaction {
  self: RdbSiteTransaction =>


  def insertUserEmailAddress(addrInfo: UserEmailAddress) {
    val statement = s"""
      insert into user_emails3 (
        site_id, user_id, email_address, added_at, verified_at)
      values (?, ?, ?, ?, ?)
      """
    val values = List(siteId.asAnyRef, addrInfo.userId.asAnyRef, addrInfo.emailAddress,
      addrInfo.addedAt.asTimestamp, addrInfo.verifiedAt.orNullTimestamp)
    runUpdateSingleRow(statement, values)
  }


  def updateUserEmailAddress(addrInfo: UserEmailAddress) {
    val statement = s"""
      update user_emails3 set verified_at = ?
      where site_id = ?
        and user_id = ?
        and email_address = ?
      """
    val values = List(addrInfo.verifiedAt.orNullTimestamp,
      siteId.asAnyRef, addrInfo.userId.asAnyRef, addrInfo.emailAddress)
    runUpdateExactlyOneRow(statement, values)
  }


  def deleteUserEmailAddress(userId: UserId, emailAddress: String) {
    val statement = s"""
      delete from user_emails3
      where site_id = ?
        and user_id = ?
        and email_address = ?
      """
    val values = List(siteId.asAnyRef, userId.asAnyRef, emailAddress)
    runUpdateExactlyOneRow(statement, values)
  }


  def deleteAllUsersEmailAddresses(userId: UserId) {
    TESTS_MISSING
    val statement = s"""
      delete from user_emails3
      where site_id = ?
        and user_id = ?
      """
    val values = List(siteId.asAnyRef, userId.asAnyRef)
    runUpdate(statement, values)
  }


  def loadUserEmailAddresses(userId: UserId): Seq[UserEmailAddress] = {
    val query = s"""
      select email_address, added_at, verified_at
      from user_emails3
       where site_id = ? and user_id = ?
      """
    runQueryFindMany(query, List(siteId.asAnyRef, userId.asAnyRef), rs => {
      UserEmailAddress(
        userId,
        rs.getString("email_address"),
        getWhen(rs, "added_at"),
        getOptWhen(rs, "verified_at"))
    })
  }
}



