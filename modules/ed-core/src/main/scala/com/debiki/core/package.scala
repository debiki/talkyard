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

import org.apache.commons.validator.routines.EmailValidator
import org.scalactic.{Good, Bad, Or}
import scala.collection.immutable


package object core {

  // "Vector" is so very long, for such a good & please-use-frequently collection.
  type Vec[+A] = scala.collection.immutable.Vector[A]

  type ActionId = Int

  // TODO rename to PostId.
  type PostId = Int
  val NoPostId = 0

  type PostNr = Int
  val NoPostNr = -1

  type PageId = String

  type PageVersion = Int

  type CategoryId = Int
  val NoCategoryId = 0

  type SiteId = String

  type SiteVersion = Int

  type LoginId = String

  type UserId = Int // when removing/renaming-to-UserId, search for UserId2 everywhere

  type RoleId = UserId

  type NotificationId = Int

  type ReviewTaskId = Int

  type Tag = String
  type TagLabelId = Int
  type TagLabel = String

  /** Email identities are strings, all others are numbers but converted to strings. */
  type IdentityId = String

  type IpAddress = String

  type EmailId = String

  type AuditLogEntryId = Int

  type PricePlan = String  // for now

  /** Where to start rendering a page. The specified post and all its successors
    * will be included in the resulting page. If None, then all top level posts are
    * included (and their successors), that is, all posts with no parent posts.
    */
  type AnyPageRoot = Option[PostNr]

  val DefaultPageRoot = Some(PageParts.BodyNr)

  type SettingNameValue[A] = (String, Option[A])

  /** Change this to a Long before year 2038. /KajMagnus, Jan 2015 */
  type UnixTime = Int    // don't use, I always forget if it's seconds or millis
  type UnixMillis = Long // this is millis :-)

  /** I'll use this instead of whatever-date-time-stuff-there-is. */
  class When(val unixMillis: UnixMillis) extends AnyVal {
    def toJavaDate = new java.util.Date(unixMillis)
    def toUnixMillis = unixMillis
    def daysSince(other: When) = (unixMillis - other.unixMillis) / OneMinuteInMillis / 60 / 24
    def daysBetween(other: When) = math.abs(daysSince(other))
    def hoursSince(other: When) = (unixMillis - other.unixMillis) / OneMinuteInMillis / 60
    def minutesSince(other: When) = (unixMillis - other.unixMillis) / OneMinuteInMillis
    def millisSince(other: When) = unixMillis - other.unixMillis
    def minusMinutes(minutes: Int) = new When(unixMillis - minutes * OneMinuteInMillis)
    def minusSeconds(seconds: Int) = new When(unixMillis - seconds * 1000)
    def minusMillis(millis: UnixMillis) = new When(unixMillis - millis)

    /** Unix millis can safely be cast to a Double: (but perhaps not back again?)
      * 100 years * 365 * 24 * 3600 * 1000 = 3153600000000 = 13 digits, and doubles in Java
      * have more precision than that.
      */
    def toDouble = unixMillis.toDouble
    def numSeconds = unixMillis / 1000
  }

  object When {
    def now() = new When(System.currentTimeMillis())
    def fromDate(date: java.util.Date) = new When(date.getTime)
    def fromMillis(millis: UnixMillis) = new When(millis)
  }


  case class Who(id: UserId, browserIdData: BrowserIdData) {
    def ip: String = browserIdData.ip
    def idCookie: String = browserIdData.idCookie
    def browserFingerprint = browserIdData.fingerprint
    def isGuest = User.isGuestId(id)
  }

  case class UserAndLevels(user: User, trustLevel: TrustLevel, threatLevel: ThreatLevel) {
    def id = user.id
    def isStaff = user.isStaff
  }


  sealed trait OrderBy { def isDescending: Boolean = false }

  object OrderBy {
    object OldestFirst extends OrderBy
    object MostRecentFirst extends OrderBy { override def isDescending = true }
  }

  val HomepageUrlPath = "/"
  val EmptyPageId = "0"

  val OneMinuteInMillis: Long = 60 * 1000
  val OneHourInMillis: Long = 3600 * 1000
  val MillisPerDay: Long = 24 * OneHourInMillis
  val OneDayInMillis: Long = MillisPerDay
  val OneWeekInMillis: Long = 7 * MillisPerDay

  val Megabyte = 1000 * 1000
  val Megabytes = Megabyte

  def FirstSiteId = Site.FirstSiteId
  val NoUserId = 0
  def SystemUserId = User.SystemUserId
  def SystemUserFullName = User.SystemUserFullName
  def SystemUserUsername = User.SystemUserUsername
  def UnknownUserId = User.UnknownUserId
  def UnknownUserName = User.UnknownUserName
  def UnknownUserGuestCookie = User.UnknownUserGuestCookie
  def MaxGuestId = User.MaxGuestId
  def LowestNonGuestId = User.LowestNonGuestId
  def LowestHumanMemberId = User.LowestHumanMemberId

  val FirstRevisionNr = PostRevision.FirstRevisionNr

  case class SiteUserId(siteId: SiteId, userId: UserId)
  case class SitePageVersion(siteVersion: SiteVersion, pageVersion: PageVersion)

  trait PageTitleRole {
    def title: String
    def role: PageRole
  }

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


  case class StuffToIndex(
    postsBySite: Map[SiteId, immutable.Seq[Post]],
    pagesBySitePageId: Map[SitePageId, PageMeta],
    tagsBySitePostId: Map[SitePostId, immutable.Set[TagLabel]]) {

    def page(siteId: SiteId, pageId: PageId): Option[PageMeta] =
      pagesBySitePageId.get(SitePageId(siteId, pageId))

    def tags(siteId: SiteId, postId: PostId): Set[TagLabel] =
      tagsBySitePostId.getOrElse(SitePostId(siteId, postId), Set.empty)

    def isPageDeleted(siteId: SiteId, pageId: PageId) = {
      val p = page(siteId, pageId)
      p.isEmpty || p.exists(_.isDeleted)
    }
  }


  case class TagAndStats(
    label: TagLabel,
    numTotal: Int,
    numPages: Int,
    numSubscribers: Int,
    numMuted: Int)


  case class StuffToSpamCheck(
    postsBySite: Map[SiteId, immutable.Seq[Post]],
    usersBySite: Map[SiteId, Map[UserId, User]],
    spamCheckTasks: Seq[SpamCheckTask]) {

    def getPost(sitePostId: SitePostId): Option[Post] =
      postsBySite.get(sitePostId.siteId).flatMap(_.find(_.id == sitePostId.postId))

    def getUser(siteUserId: SiteUserId): Option[User] =
      usersBySite.get(siteUserId.siteId).flatMap(_.get(siteUserId.userId))
  }


  /** Spam related request stuff, e.g. referer and user agent.
    */
  case class SpamRelReqStuff(
    userAgent: Option[String],
    referer: Option[String],
    uri: String)


  case class SpamCheckTask(
    siteId: SiteId,
    postId: PostId,
    postRevNr: Int,
    who: Who,
    requestStuff: SpamRelReqStuff) {

    def sitePostId = SitePostId(siteId, postId)
    def siteUserId = SiteUserId(siteId, who.id)
  }



  def ifThenSome[A](condition: Boolean, value: A) =
    if (condition) Some(value) else None


  def isBlank(char: Char): Boolean = char <= ' '


  def isValidNonLocalEmailAddress(address: String): Boolean =
    EmailValidator.getInstance(/* allowLocal = */ false).isValid(address)


  implicit class GetOrBadMap[G, B](val underlying: Or[G, B]) {
    def getOrIfBad(fn: B => Nothing): G = underlying.badMap(fn).get
    def getMakeGood(errorFixFn: B => G): G = underlying match {
      case Good(value) => value
      case Bad(bad) => errorFixFn(bad)
    }
  }


  implicit class RichBoolean(underlying: Boolean) {
    def toZeroOne = if (underlying) 1 else 0
  }


  implicit class RichString3(underlying: String) {
    def isTrimmedNonEmpty = underlying.trim == underlying && underlying.nonEmpty
  }


  /** If you're short of time, add e.g. an UNTESTED statement. The compiler
    * ensures you don't do a typo. Then, before a release:
    *   egrep -Ir 'UNTESTED|SECURITY|MUST|TODO' app/ test/ client/ modules/ *
    * (remove spaces around *) and add test cases and fix security issues.
    */
  def UNTESTED = ()       // If the code might not work, e.g. has never been run.
  def TESTS_MISSING = ()  // It'd be nice with unit/integration/whatever tests.
  def SECURITY = ()       // Some security issue, not necessarily so very important
  def BUG = ()            // Need not be a terribly important bug.
  def RACE = ()           // A race condition bug / situation.
  def MUST = ()           // Fix before next release.
  def SHOULD = ()         // Fix before release, unless short of time, or it's too boring.
  def COULD = ()          // Could do this, but not important right now, can wait a year or two.
  def ANNOYING = ()       // Something annoying that would be good to fix, not important though
  def REFACTOR = ()       // The code can be refactored. Also search for "[refactor]".
  def RENAME = ()         // Something ought to be renamed.
  def OPTIMIZE = ()
  def COULD_OPTIMIZE = ()
  def FORCED_REFLOW = ()  // Browser side only. Makes it slow.
  def UX = ()             // Usability can be improved.
  def RESPONSIVE = ()     // Would look better with responsive layout. Browser side only.
  def HACK = ()           // Quick crazy fix, probably should be redone later in a better way.
  def DELETE_LATER = ()   // ... hmm. Rename to CLEANUP.
  def CLEAN_UP = ()       // Unused stuff that should be deleted after a grace period, or when
                          // the developers are less short of time.

}

