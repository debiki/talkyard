/**
 * Copyright (C) 2013 Kaj Magnus Lindberg (born 1979)
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

package com.debiki


package object core {

  type ActionId = Int

  // TODO rename to PostId.
  type UniquePostId = Int

  type PostNr = Int

  type PageId = String

  type PageVersion = Int

  type CategoryId = Int

  type SiteId = String

  type SiteVersion = Int

  type LoginId = String

  type UserId = Int // when removing/renaming-to-UserId, search for UserId2 everywhere

  type RoleId = UserId

  type NotificationId = Int

  type ReviewTaskId = Int

  /** Email identities are strings, all others are numbers but converted to strings. */
  type IdentityId = String

  type IpAddress = String

  type EmailId = String

  type AuditLogEntryId = Int

  /** Where to start rendering a page. The specified post and all its successors
    * will be included in the resulting page. If None, then all top level posts are
    * included (and their successors), that is, all posts with no parent posts.
    */
  type AnyPageRoot = Option[PostNr]

  val DefaultPageRoot = Some(PageParts.BodyNr)

  type SettingNameValue[A] = (String, A)

  /** Change this to a Long before year 2038. /KajMagnus, Jan 2015 */
  type UnixTime = Int    // don't use, I always forget if it's seconds or millis
  type UnixMillis = Long // this is millis :-)

  /** I'll use this instead of whatever-date-time-stuff-there-is. */
  class When(val unixMillis: UnixMillis) extends AnyVal {
    def toJavaData = new java.util.Date(unixMillis)
    def toUnixMillis = unixMillis
  }

  def now = new When(System.currentTimeMillis())

  val HomepageUrlPath = "/"

  val MillisPerDay: Long = 24 * 3600 * 1000
  val OneDayInMillis: Long = MillisPerDay
  val OneWeekInMillis: Long = 7 * MillisPerDay

  val Megabyte = 1000 * 1000
  val Megabytes = Megabyte

  def FirstSiteId = Site.FirstSiteId
  def SystemUserId = User.SystemUserId
  def SystemUserFullName = User.SystemUserFullName
  def SystemUserUsername = User.SystemUserUsername
  def UnknownUserId = User.UnknownUserId
  def UnknownUserName = User.UnknownUserName
  def UnknownUserGuestCookie = User.UnknownUserGuestCookie

  val KajMagnusSiteId = "3" // for now

  val FirstRevisionNr = PostRevision.FirstRevisionNr

  case class SiteUserId(siteId: SiteId, userId: UserId)
  case class SitePageVersion(siteVersion: SiteVersion, pageVersion: PageVersion)

  /** If the up-to-date data hash and the cached hash, or the app version, are different,
    * the page should be re-rendered. Sometimes however, the hash is not available,
    * and then we'll compare siteVersion, pageVersion, appVersion instead. This might
    * result in the page being re-rendered a little bit too often.
    *
    * An example of when the site and page versions are different, but this doesn't affect
    * the resulting html: The site version is changed because a category is renamed,
    * but the category name isn't included anywhere on this page.
    */
  case class CachedPageVersion(
    siteVersion: SiteVersion,
    pageVersion: PageVersion,
    appVersion: String,
    dataHash: String) {

    /** Interpreted by the computer (startup.js looks for the '|'). */
    def computerString =
      s"site: $siteVersion, page: $pageVersion | app: $appVersion, hash: $dataHash"
  }

  def ifThenSome[A](condition: Boolean, value: A) =
    if (condition) Some(value) else None

}

