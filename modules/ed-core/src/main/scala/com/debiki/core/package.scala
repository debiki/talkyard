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

import com.debiki.core.Prelude.dieIf
import java.{util => ju}
import org.apache.commons.validator.routines.EmailValidator
import org.scalactic.{Bad, Good, Or}
import scala.collection.immutable
import scala.collection.mutable.ArrayBuffer


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
  type UnixMinutes = Int
  type UnixDays = Int


  /** I'll use this instead of whatever-date-time-stuff-there-is.
    */
  class When(val unixMillis: UnixMillis) extends AnyVal {
    def toJavaDate = new ju.Date(unixMillis)
    def toDays: WhenDay = WhenDay.fromMillis(unixMillis)
    def millis: UnixMillis = unixMillis
    def unixMinutes: Int = (unixMillis / 1000 / 60).toInt
    def toUnixMillis: UnixMillis = unixMillis
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
    def toDouble: Double = unixMillis.toDouble
    def numSeconds: Long = unixMillis / 1000

    def isAfter(other: When): Boolean = unixMillis > other.unixMillis
    def isBefore(other: When): Boolean = unixMillis < other.unixMillis
    def isNotBefore(other: When): Boolean = unixMillis >= other.unixMillis

    override def toString: String = unixMillis.toString + "ms"
  }

  object When {
    def now() = new When(System.currentTimeMillis())
    def fromDate(date: ju.Date) = new When(date.getTime)
    def fromOptDate(anyDate: Option[ju.Date]): Option[When] = anyDate.map(When.fromDate)
    def fromMillis(millis: UnixMillis) = new When(millis)
    def fromMinutes(minutes: UnixMinutes) = new When(minutes * OneMinuteInMillis)
    def fromOptMillis(millis: Option[UnixMillis]): Option[When] = millis.map(new When(_))

    def latestOf(whenA: When, whenB: When): When =
      if (whenA.millis > whenB.millis) whenA else whenB

    def anyLatestOf(whenA: Option[When], whenB: Option[When]): Option[When] = {
      if (whenA.isDefined && whenB.isDefined) {
        if (whenA.get.millis > whenB.get.millis) whenA
        else whenB
      }
      else whenA orElse whenB
    }

    def earliestOf(whenA: When, whenB: When): When =
      if (whenA.millis < whenB.millis) whenA else whenB

    def earliestNot0(whenA: When, whenB: When): When =
      if (whenA.millis < whenB.millis && whenA.millis != 0) whenA else whenB

    def anyEarliestOf(whenA: Option[When], whenB: Option[When]): Option[When] = {
      if (whenA.isDefined && whenB.isDefined)
        Some(earliestOf(whenA.get, whenB.get))
      else
        whenA orElse whenB
    }

    def anyEarliestNot0(whenA: Option[When], whenB: Option[When]): Option[When] = {
      if (whenA.isDefined && whenB.isDefined)
        Some(earliestNot0(whenA.get, whenB.get))
      else
        whenA orElse whenB
    }
  }


  class WhenDay(val unixDays: UnixDays) extends AnyVal {
    def toJavaDate = new ju.Date(OneDayInMillis * unixDays)
    override def toString: String = unixDays.toString + "days"
  }

  object WhenDay {
    def now(): WhenDay = fromMillis(System.currentTimeMillis())
    def fromDate(date: ju.Date): WhenDay = fromMillis(date.getTime)
    def fromDays(unixDays: Int) = new WhenDay(unixDays)
    def fromMillis(unixMillis: Long) = new WhenDay((unixMillis / OneDayInMillis).toInt)
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


  /**
    * @param firstVisitedAt The first time the user visited the page, perhaps without reading.
    * @param lastVisitedAt The last time the user visited the page, perhaps without reading.
    * @param lastViewedPostNr Should be focused after page reload (regardless of if is read/unread).
    * @param lastReadAt The last time the user apparently read something on the page.
    * @param lastPostNrsReadRecentFirst Which posts were the last ones the user read. The most
    *   recently read post nr is stored first, so .distinct keeps the most recently read occurrences
    *   of each post nr (rather than some old duplicate).
    *   Useful for remembering the most recently read comments in an endless stream of
    *   comments — that is, in a chat topic.
    *   Only post nrs > MaxLowPost nrs should be included (the ones <= MaxLowPost should instead
    *   be inserted into lowPostNrsRead).
    * @param lowPostNrsRead Suitable for storing as a bit set in the database, e.g. 8*8 bytes
    *   would remember which ones of post nrs 1 - 512 the user has read.
    *   If any post nr is > MaxLowPostNr, an error is thrown.
    *   Useful for remembering which posts have been read in a discussion that ends after a while,
    *   i.e. all kinds of topics (questions, ideas, discussions, ...) except for never-ending-chats.
    *   ("low" = post nrs 1 ... something, but not high post nrs like 3456 or 9999 — they
    *   would be stored in lastPostNrsRead instead, and only like the 100 most recent.)
    * @param secondsReading Also includes time the user spends re-reading old posts hen has
    *   read already.
    */
  case class ReadingProgress(
    firstVisitedAt: When,
    lastVisitedAt: When,
    lastViewedPostNr: PostNr,
    lastReadAt: Option[When],
    lastPostNrsReadRecentFirst: Vector[PostNr],
    lowPostNrsRead: immutable.Set[PostNr],
    secondsReading: Int) {

    import ReadingProgress._

    require(secondsReading >= 0, "EdE26SRY8")
    require(lastViewedPostNr >= PageParts.BodyNr, "EdE38JHF9")
    require(firstVisitedAt.millis <= lastVisitedAt.millis, "EdE3WKB4U0")
    lastReadAt foreach { lastReadAt =>
      require(firstVisitedAt.millis <= lastReadAt.millis, "EdE5JTK28")
      require(lastReadAt.millis <= lastVisitedAt.millis, "EdE20UP6A")
    }
    require(lowPostNrsRead.isEmpty || lowPostNrsRead.max <= MaxLowPostNr,
      s"Got max = ${lowPostNrsRead.max} [EdE2W4KA8]")
    require(lowPostNrsRead.isEmpty || lowPostNrsRead.min >= 1, // title (nr 0) shouldn't be included
      s"Got min = ${lowPostNrsRead.min} [EdE4GHSU2]")

    require(lastPostNrsReadRecentFirst.size <= MaxLastPostsToRemember, "EdE24GKF0")
    require(lastPostNrsReadRecentFirst.isEmpty || lastPostNrsReadRecentFirst.min > MaxLowPostNr,
      s"Got min = ${lastPostNrsReadRecentFirst.min} [EdE4GSWA1]")

    require((secondsReading > 0) || lastReadAt.isEmpty, "EdE42HUP4X")
    require((secondsReading > 0) || lastPostNrsReadRecentFirst.isEmpty, "EdE5KWP02")
    require((secondsReading > 0) || lowPostNrsRead.isEmpty, "EdE8JSBWR42")


    def numLowNrRepliesRead: Int =
      lowPostNrsRead.size - (if (lowPostNrsRead.contains(PageParts.BodyNr)) 1 else 0)

    def numPostsRead: Int =
      lowPostNrsRead.size + lastPostNrsReadRecentFirst.size


    def addMore(moreProgress: ReadingProgress): ReadingProgress = {
      copy(
        secondsReading = secondsReading + moreProgress.secondsReading,
        firstVisitedAt = When.earliestOf(firstVisitedAt, moreProgress.firstVisitedAt),
        lastVisitedAt = When.latestOf(lastVisitedAt, moreProgress.lastVisitedAt),
        lastViewedPostNr =
          if (lastVisitedAt.isAfter(moreProgress.lastVisitedAt)) lastViewedPostNr
          else moreProgress.lastViewedPostNr,
        lastReadAt = When.anyLatestOf(lastReadAt, moreProgress.lastReadAt),
        lastPostNrsReadRecentFirst = (
          // Note: most recently read is stored first, so .distinct keeps those.
          if (moreProgress.lastReadAt.isEmpty) lastPostNrsReadRecentFirst
          else if (lastReadAt.isEmpty) moreProgress.lastPostNrsReadRecentFirst
          else if (moreProgress.lastReadAt.get isAfter lastReadAt.get)
            moreProgress.lastPostNrsReadRecentFirst ++ lastPostNrsReadRecentFirst
          else
            lastPostNrsReadRecentFirst ++ moreProgress.lastPostNrsReadRecentFirst).distinct take MaxLastPostsToRemember)
    }


    /** Can be stored in a Postgres bytea, or sent as base64 to the browser.
      * There's a unit test.
      */
    def lowPostNrsReadAsBitsetBytes: Array[Byte] = {
      var bytes = Array[Byte]()
      if (lowPostNrsRead.isEmpty)
        return bytes

      // Perhaps could be done in a more efficient way by accessing the underlying Long:s in
      // the BitSet, but then need to cast to $BitSet1 or $BitSet2 or $BitSetN = complicated.
      var byteIndex = 0

      // -1 because the first bit is post nr 1, not 0, that is, bits 0..7 store is-read flags
      // for posts 1..8 (not posts 0..7).
      // The maxIndex becomes = 0 if only posts 1..8 included, and 63 if posts 504..512 included.
      val maxIndex = (lowPostNrsRead.max - 1) / 8

      while (byteIndex <= maxIndex) {
        var currentByte: Int = 0 // "byte" because only using the lowest 8 bits
        var bitIndex = 0
        while (bitIndex < 8) {
          // +1 because first post nr is 1 (orig post) not 0 (the title).
          val postNr = byteIndex * 8 + bitIndex + 1
          // (Could use lowPostNrsRead.iterator instead to skip all zero bits, but barely matters.)
          if (lowPostNrsRead.contains(postNr)) {
            val more: Int = 1 << bitIndex
            dieIf(more > 255, "EdE4FKG82")
            currentByte += more
          }
          bitIndex += 1
        }
        bytes :+= currentByte.toByte  // casts from 0..255 to -128..127
        byteIndex += 1
      }
      bytes
    }
  }


  object ReadingProgress {
    val MaxLastPostsToRemember = 100
    val MaxLowPostNr = 512  // 8 Longs = 8 * 8 bytes * 8 bits/byte = 512 bits = post nrs 1...512


    /** There's a unit test.
      */
    def parseLowPostNrsReadBitsetBytes(bytes: Array[Byte]): Set[PostNr] = {
      val postNrs = ArrayBuffer[PostNr]()
      var byteIx = 0
      while (byteIx < bytes.length) {
        val byte = bytes(byteIx)
        val base = byteIx * 8
        var bitIx = 0
        while (bitIx < 8) {
          val bitmask = 1 << bitIx
          val postNr = base + bitIx + 1  // + 1 because first bit, at index 0, = post nr 1 (not 0)
          val isIncluded = (byte & bitmask) != 0
          if (isIncluded) {
            postNrs append postNr
          }
          bitIx += 1
        }
        byteIx += 1
      }
      immutable.Set[PostNr](postNrs: _*)
    }
  }


  def ifThenSome[A](condition: Boolean, value: A): Option[A] =
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


  def minOfMany(first: Long, more: Long*): Long = {
    var min = first
    for (value <- more) {
      if (value < min) min = value
    }
    min
  }


  def minOfMany(first: Int, more: Int*): Int = {
    var min = first
    for (value <- more) {
      if (value < min) min = value
    }
    min
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

