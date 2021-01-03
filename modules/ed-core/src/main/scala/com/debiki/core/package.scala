/**
 * Copyright (C) 2013-2017 Kaj Magnus Lindberg
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

import com.debiki.core.Prelude._
import java.{util => ju}
import org.apache.commons.validator.routines.EmailValidator
import org.scalactic.{Bad, ErrorMessage, Good, Or}
import scala.collection.immutable
import scala.collection.mutable
import play.api.libs.json.JsObject
import scala.concurrent.{ExecutionContext, Future}
import scala.util.{Failure, Success, Try}


package object core {

  type j_Date = java.util.Date
  type j_URISyntaxException = java.net.URISyntaxException
  type j_URI = java.net.URI


  // Concise is nice.
  //
  // (Details: Frequently used names should be short — it's annoying with
  // unnecessary line breaks because someone thought typing the whole
  // word "Boolean" was necessary, is it not?
  // *And* it's nice when the IDE stops highlighting the types (IntelliJ does,
  // with 'Int' 'Boolean' etc) as if they were extra important — when instead
  // they're more like background noise, only interesting when taking
  // a detailed look at the code. (And it's boring to reconfigure the
  // color scheme, is it not?))

  type U = Unit
  type St = String
  type Bo = Boolean
  type i8 = Byte // 'i8' is better than 'Byte', so remembers it is signed
  type i16 = Short
  type u16 = Char
  type i32 = Int
  type i64 = Long
  type f32 = Float
  type f64 = Double
  type Ex = Exception

  /* Wait, causes too many "it is imported twice" errors:
  type Good[+G] = org.scalactic.Good[G]
  val Good = org.scalactic.Good
  type Or[+G,+B] = org.scalactic.Or[G, B]
  type Bad[+B] = org.scalactic.Bad[B]
  val Bad = org.scalactic.Bad
   */
  type ErrCode = String
  type ErrMsg = ErrorMessage // = String

  type Opt[+A] = Option[A]
  val Opt: Option.type = Option

  type Vec[+A] = Vector[A]
  val Vec: Vector.type = Vector

  // Mutable or immutable — use instead of Seq, so simpler to upgrade to Scala 3
  // (then, just `Seq` changes from scala.collection.Seq to immutable.Seq).
  type ColSeq[+A] = collection.Seq[A]
  // val ColSeq = collection.Seq — the same as immutable.Seq.
  type ImmSeq[+A] = immutable.Seq[A]
  val ImmSeq: immutable.Seq.type = immutable.Seq

  type MutBuf[A] = mutable.Buffer[A]
  type MutArrBuf[A] = mutable.ArrayBuffer[A]
  val MutArrBuf: mutable.ArrayBuffer.type = mutable.ArrayBuffer

  type MutHashSet[A] = mutable.HashSet[A]
  val MutHashSet: mutable.HashSet.type = mutable.HashSet

  type MutHashMap[K, V] = mutable.HashMap[K, V]
  val MutHashMap: mutable.HashMap.type = mutable.HashMap


  def isDevOrTest: Bo = Prelude.isDevOrTest
  def isProd: Bo = Prelude.isProd


  type ActionId = Int

  type DraftNr = Int
  val NoDraftNr: DraftNr = 0

  // TODO rename to PostId.
  type PostId = Int
  val NoPostId = 0

  type PostNr = Int
  val NoPostNr: PostNr = -1  // COULD change to 0, and set TitleNr = -1  [4WKBA20]
  val TitleNr: PostNr = PageParts.TitleNr
  val BodyNr: PostNr = PageParts.BodyNr
  val FirstReplyNr: PostNr = PageParts.FirstReplyNr

  val PostHashPrefixNoHash   = "post-"
  val PostHashPrefixWithHash = "#post-"
  val CommentHashPrefixNoHash   = "comment-"
  val CommentHashPrefixWithHash = "#comment-"

  type PostRevNr = Int

  REFACTOR // change page id to Int (not String) — is always an Int anyway,
  // except for the forum main page at Ty .io.
  type PageId = String  // Int better

  // ... But this should be a string.
  type AltPageId = String

  type PageVersion = Int

  type CategoryId = Int
  val NoCategoryId = 0

  // The Discourse help forum currently has 28 categories so 100 is a lot.
  SHOULD // make this configurable, per site.  Now needs > 100
  val MaxCategories = 300

  type PubSiteId = String

  type SiteId = Int
  val NoSiteId = 0

  type SiteVersion = Int

  type LoginId = String

  type Pat = Participant
  val Pat: Participant.type = Participant

  type PatId = Int
  type ParticipantId = Int  ; RENAME // to PatId
  type GuestId = PatId
  type MemberId = PatId   ; RENAME // to MembId
  type MembId = PatId
  type UserId = PatId
  type GroupId = PatId

  type Username = St
  type FullName = St

  // Use MemberId instead.
  type RoleId = UserId   ; CLEAN_UP ; REMOVE

  type NotfType = NotificationType
  val NotfType: NotificationType.type = NotificationType
  type NotificationId = Int  ; RENAME // to NotfId
  type NotfId = Int

  type ModDecision = ReviewDecision
  type ModTask = ReviewTask // renaming
  type ReviewTaskId = Int

  type PermissionId = Int
  val NoPermissionId = 0
  val PermissionAlreadyExistsMinId = 1

  type SysTx = SystemTransaction
  type SiteTx = SiteTransaction  // renaming it, wip

  type ConfFileIdpId = St
  type IdpId = i32

  type IdpUserInfo = OpenAuthDetails  // renaming

  sealed abstract class MarkupLang
  object MarkupLang {
    case object Html extends MarkupLang
    case object CommonMark extends MarkupLang

    def fromString(value: String): Option[MarkupLang] = Some(value match {
      case "HTML" => Html
      case "CommonMark" => CommonMark
      case _ => return None
    })
  }

  // Avoid exposing ExtIds. It's best if strangers and non-staff members cannot see
  // them anywhere. Because ext ids might include numbers that makes it possible
  // for strangers to draw conclusions about an organization that has integrated
  // with Talkyard. (E.g. an organization might assign ids 1,2,3,4,... to their
  // own users, and use as ext ids in Talkyard — and a stranger who can see any such
  // ext ids, could estimate the number of people in the organization.)
  type ExtId = String

  type Ref = String  ; RENAME // to RefStr(ing) or RawRef? maybe rename ParsedRef to just Ref?

  sealed abstract class ParsedRef(val canOnlyBeToParticipant: Boolean = false)
  object ParsedRef {
    case class ExternalId(value: ExtId) extends ParsedRef
    case class SingleSignOnId(value: String) extends ParsedRef(true)
    case class TalkyardId(value: String) extends ParsedRef
    case class Username(value: String) extends ParsedRef(true)
  }

  def parseRef(ref: Ref, allowParticipantRef: Boolean): ParsedRef Or ErrorMessage = {
    val returnBadIfDisallowParticipant = () =>
      if (!allowParticipantRef)
        return Bad("Refs to participants not allowed here, got: " + ref)
    // Usernames and Talkyard internal ids don't contain '@'.
    val returnBadIfContainsAt = (value: String) =>
      if (value contains '@')
        return Bad("Ref contains '@': " + ref)

    if (ref startsWith "extid:") {
      val extId = ref drop "extid:".length
      Good(ParsedRef.ExternalId(extId))
    }
    else if (ref startsWith "ssoid:") {
      returnBadIfDisallowParticipant()
      val ssoId = ref drop "ssoid:".length
      Good(ParsedRef.SingleSignOnId(ssoId))
    }
    else if (ref startsWith "tyid:") {
      val tyId = ref drop "tyid:".length
      returnBadIfContainsAt(tyId)
      Good(ParsedRef.TalkyardId(tyId))
    }
    else if (ref startsWith "username:") {
      returnBadIfDisallowParticipant()
      val username = ref drop "username:".length
      returnBadIfContainsAt(username)
      Good(ParsedRef.Username(username))
    }
    else {
      var refDots = ref.takeWhile(_ != ':') take 14
      if (refDots.length >= 14) refDots = refDots.dropRight(1) + "..."
      Bad(s"Unknown ref type: '$refDots', should be e.g. 'extid:...' [TyEREFTYPE]")
    }
  }


  val LowestTempImpId: Int = 2*1000*1000*1000
  val FirstTempImpId: Int = LowestTempImpId + 1
  def isPageTempId(pageId: PageId): Boolean =
    pageId.length == 10 && pageId.startsWith("2000") // good enough for now

  type Tag = String
  type TagDefId = Int
  type TagLabelId = Int
  type TagLabel = String
  val NoTagId: TagLabelId = 0

  /** Email identities are strings, all others are numbers but converted to strings. */
  type IdentityId = String

  type IpAddress = String

  type EmailAdr = String
  type EmailId = String

  type AuditLogEntryId = Int

  type ApiSecretNr = Int


  type Hopefully[R] = R Or Problem

  sealed abstract class AnyProblem {
    def isFine: Bo = false
    def isProblem: Bo = !isFine
    def ifProblem(fn: Problem => U): U = {
      this match {
        case p: Problem => fn(p)
        case fine =>
          dieIf(fine.isProblem, "TyE305MRKT24")
      }
    }
  }

  case object Fine extends AnyProblem {
    override def isFine: Bo = true
  }

  /**
    * @param message — for end users
    * @param siteId
    * @param adminInfo — more details, for site admins
    * @param debugInfo — more details, for Talkyard developers
    * @param anyException — remove later
    */
  case class Problem(
    message: ErrorMessage,
    siteId: SiteId,
    adminInfo: String = "",
    debugInfo: String = "",
    @deprecated
    anyException: Option[Exception] = None
  ) extends AnyProblem {

    // For tests only.
    def theException_forTests: Exception = anyException.getOrDie("TyENOPROBLEXC")
  }

  object Problem {
    def apply(exception: Exception, siteId: SiteId): Problem = {
      Problem(message = exception.getMessage, siteId = siteId,
            anyException = Some(exception))
    }
  }

  RENAME // to ErrMsgCode
  case class ErrorMessageCode(message: ErrorMessage, code: String)


  // Renaming to Check.
  val Check: Validation.type = Validation


  /** Where to start rendering a page. The specified post and all its successors
    * will be included in the resulting page. If None, then all top level posts are
    * included (and their successors), that is, all posts with no parent posts.
    */
  type AnyPageRoot = Option[PostNr]

  val DefaultPageRoot = Some(BodyNr)

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
    def daysSince(other: When): Long = (unixMillis - other.unixMillis) / OneMinuteInMillis / 60 / 24
    def daysBetween(other: When): Long = math.abs(daysSince(other))
    def hoursSince(other: When): Long = (unixMillis - other.unixMillis) / OneMinuteInMillis / 60
    def minutesSince(other: When): Long = (unixMillis - other.unixMillis) / OneMinuteInMillis
    def millisSince(other: When): Long = unixMillis - other.unixMillis
    def minusMinutes(minutes: Int) = new When(unixMillis - minutes * OneMinuteInMillis)
    def minusSeconds(seconds: Int) = new When(unixMillis - seconds * 1000)
    def minusMillis(millis: UnixMillis) = new When(unixMillis - millis)
    def minusHours(hours: Int) = new When(unixMillis - hours * OneHourInMillis)
    def plusHours(hours: Int) = new When(unixMillis + hours * OneHourInMillis)
    def minusDays(days: Int) = new When(unixMillis - days * OneDayInMillis)
    def plusDays(days: Int) = new When(unixMillis + days * OneDayInMillis)
    def minusMonths(months: Int) = new When(unixMillis - months * OneDayInMillis * 365 / 12)
    def minusYears(years: Int) = new When(unixMillis - years * OneDayInMillis * 365)

    /** Unix millis can safely be cast to a Double: (but perhaps not back again?)
      * 100 years * 365 * 24 * 3600 * 1000 = 3153600000000 = 13 digits, and doubles in Java
      * have more precision than that.
      */
    def toDouble: Double = unixMillis.toDouble
    def numSeconds: Long = unixMillis / 1000
    def seconds: Long = unixMillis / 1000

    def isAfter(other: When): Boolean = unixMillis > other.unixMillis
    def isBefore(other: When): Boolean = unixMillis < other.unixMillis
    def isNotBefore(other: When): Boolean = unixMillis >= other.unixMillis
    def isBetween(start: When, end: When): Boolean = millis >= start.millis && millis <= end.millis

    def plusMillis(moreMillis: Long) = new When(this.millis + moreMillis)
    def plusSeconds(moreSeconds: Long) = new When(this.millis + moreSeconds * 1000)
    def plusMinutes(moreMinutes: Long) = new When(this.millis + moreMinutes * 60 * 1000)

    override def toString: String = unixMillis.toString + "ms"
    def toIso8601Day: St = Prelude.toIso8601Day(millis)
    def toIso8601T: St = Prelude.toIso8601T(millis)
    def toIso8601NoT: St = Prelude.toIso8601NoT(millis)
  }

  object When {
    /** The world came into existence, on Jan 1, 1970, midnight (just after midnight right?) */
    val Genesis = new When(0)

    /** Long.MaxValue is too large for PostgreSQL timestamps.
      * This is Saturday, May 15, 2258 04:33:21. */
    val Never = new When(9100010001000L)

    def fromDate(date: ju.Date) = new When(date.getTime)
    def fromOptDate(anyDate: Option[ju.Date]): Option[When] = anyDate.map(When.fromDate)
    def fromMillis(millis: UnixMillis) = new When(millis)
    def fromMinutes(minutes: UnixMinutes) = new When(minutes * OneMinuteInMillis)
    def fromOptMillis(millis: Option[UnixMillis]): Option[When] = millis.map(new When(_))

    def latestOf(whenA: When, whenB: When): When =
      if (whenA.millis >= whenB.millis) whenA else whenB

    def latestOf(whenA: When, whenB: Option[When]): When =
      if (whenB.isEmpty) whenA
      else if (whenA.millis >= whenB.get.millis) whenA else whenB.get

    def anyLatestOf(whenA: Option[When], whenB: Option[When]): Option[When] = {
      if (whenA.isDefined && whenB.isDefined) {
        if (whenA.get.millis > whenB.get.millis) whenA
        else whenB
      }
      else whenA orElse whenB
    }

    def anyJavaDateLatestOf(whenA: Option[ju.Date], whenB: Option[ju.Date]): Option[ju.Date] = {
      if (whenA.isDefined && whenB.isDefined) {
        if (whenA.get.getTime > whenB.get.getTime) whenA
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
    def fromDate(date: ju.Date): WhenDay = fromMillis(date.getTime)
    def fromDays(unixDays: Int) = new WhenDay(unixDays)
    def fromMillis(unixMillis: Long) = new WhenDay((unixMillis / OneDayInMillis).toInt)
  }


  type ReqrId = Who // RENAME to ReqrIds? (with an ...s)
                    // ... because is more than one id (user id, ip, bowser id cookie, etc)

  RENAME // to ReqrId? = "Requester id" and that's what it is: the user id plus hens browser id data.
  // I find "who" being confusing as to whom it refers to.
  case class Who(id: UserId, browserIdData: BrowserIdData) {
    def ip: String = browserIdData.ip
    def idCookie: Option[String] = browserIdData.idCookie
    def browserFingerprint: Int = browserIdData.fingerprint
    def isGuest: Boolean = Participant.isGuestId(id)
    def isSystem: Boolean = id == SystemUserId
  }

  object Who {
    val System = Who(SystemUserId, BrowserIdData.System)
  }

  case class UserAndLevels(user: Participant, trustLevel: TrustLevel, threatLevel: ThreatLevel) {
    def id: UserId = user.id
    def isStaff: Boolean = user.isStaff
    def nameHashId: String = user.nameHashId
  }

  case class AnyUserAndThreatLevel(user: Option[Participant], threatLevel: ThreatLevel)


  sealed trait OrderBy { def isDescending: Boolean = false }

  object OrderBy {
    object OldestFirst extends OrderBy
    object MostRecentFirst extends OrderBy { override def isDescending = true }
  }


  // Feature flags

  sealed abstract class FeatureOnOff

  object FeatureOnOff {

    /** Can be used as default settings, in config file, for all sites. And overridden, per site,
      * in the admin settings area. */
    case object On extends FeatureOnOff
    case object Off extends FeatureOnOff

    /** For the Play Framework config file only. Forcibly enables the feature for all sites. */
    case object Forced extends FeatureOnOff

    /** For the config file only. Forcibly disables the feature for all sites. */
    case object Forbidden extends FeatureOnOff

    /** For per site configs. Fallbacks to the server side default setting.
      * (Or to off = disabled, if absent, server side.) */
    case object Default extends FeatureOnOff

    def fromString(value: String): FeatureOnOff = value match {
      case "on" => On
      case "forced" => Forced
      case "forbidden" => Forbidden
      case "default" => Default
      case _ => Off
    }
  }



  val HomepageUrlPath = "/"
  val EmptyPageId = "0"  // a.k.a. NoPageId
  val NoPageId: PageId = EmptyPageId

  val MillisPerSecond: Int = 1000
  val MillisPerMinute: Long = 60 * 1000
  val OneMinuteInMillis: Long = 60 * 1000  // REMOVE use above instead
  val OneHourInMillis: Long = 3600 * 1000
  val MillisPerDay: Long = 24 * OneHourInMillis
  val OneDayInMillis: Long = MillisPerDay
  val OneWeekInMillis: Long = 7 * MillisPerDay
  val OneMonthInMillis: Long = 365 * MillisPerDay / 12  // divides evenly
  val OneYearInMillis: Long = 365 * MillisPerDay

  val Kibibyte: Int = 1024
  val KibibyteI64: i64 = 1024L
  val Mebibyte: Int = 1024 * 1024
  val MebibyteI64: i64 = 1024L * 1024L
  val Megabyte: Int = 1000 * 1000
  val Megabytes: Int = Megabyte

  def i64ToMinMaxI32(num: i64): i32 = {
    if (num > Int.MaxValue) Int.MaxValue
    else if (num < Int.MinValue) Int.MinValue
    else num.toInt
  }

  def f64ToMinMaxI32(f: f64): i32 = {
    if (f > Int.MaxValue) Int.MaxValue
    else if (f < Int.MinValue) Int.MinValue
    else f.toInt
  }

  def MaxTestSiteId: SiteId = Site.MaxTestSiteId
  def FirstSiteId: SiteId = Site.FirstSiteId
  val NoUserId = 0
  def SystemUserId: UserId = Participant.SystemUserId
  def SystemSpamStuff = SpamRelReqStuff(userAgent = None, referer = None, uri = "/dummy",
    userName = None, userEmail = None, userUrl = None, userTrustLevel = None)
  def SystemUserFullName: String = Participant.SystemUserFullName
  def SystemUserUsername: String = Participant.SystemUserUsername
  def SysbotUserId: UserId = Participant.SysbotUserId
  def SysbotUserFullName: String = Participant.SysbotUserFullName
  def SysbotUserUsername: String = Participant.SysbotUserUsername
  def UnknownUserId: UserId = Participant.UnknownUserId
  def UnknownUserName: String = Participant.UnknownUserName
  def UnknownUserBrowserId: String = Participant.UnknownUserBrowserId
  def MaxGuestId: UserId = Participant.MaxGuestId
  def MaxCustomGuestId: UserId = Participant.MaxCustomGuestId
  def LowestNonGuestId: UserId = Participant.LowestNonGuestId
  def LowestTalkToMemberId: UserId = Participant.LowestTalkToMemberId
  def LowestAuthenticatedUserId: UserId = Participant.LowestAuthenticatedUserId

  val FirstRevisionNr: Int = PostRevision.FirstRevisionNr

  case class SiteUserId(siteId: SiteId, userId: UserId)
  case class SitePageVersion(siteVersion: SiteVersion, pageVersion: PageVersion)

  trait PageTitleRole {  RENAME // to PageTitleType
    def title: String
    def role: PageType  ; RENAME // to pageType
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
    renderParams: PageRenderParams,
    reactStoreJsonHash: String) {

    /** Interpreted by the computer (startup.js looks for the '|'). */
    def computerString =
      s"site: $siteVersion, page: $pageVersion | app: $appVersion, hash: $reactStoreJsonHash"
  }


  /** Params that influence how a page gets rendered.
    *
    * COULD incl forum topic list sort order too, and discussion topic comments sort order.  [7TMW4ZJ5]
    *
    * @param widthLayout — the HTML strucure, and maybe avatar and image urls, are different,
    * for tiny mobile screens, and laptop screens. So, need to render separately, for mobile and laptop.
    * @param isEmbedded — in embedded discussions, links need to include the server origin, otherwise
    * they'll resolve relative the embedd*ing* page. However, non-embedded pages, then
    * nice with relative links? Saves a bit bandwidth.
    * Also, in embedded discussions, no page title shown. But when viewing the comments at
    * the embedded Talkyard site, then page title & body should be shown: a link to
    * the embedding page (= the blog post). [5UKWSP4]
    * @param origin — 1) the server origin is included in the inline javascript tags  [INLTAGORIG]
    * so needs to be incl in the cache key — for the in-memory cached html pages,
    * but *not* for the page content html in the database (no inline tags there).
    * 2) In rare cases, the Talkyard server is accessible via different addresses. Could be
    * when developing on localhost: localhost:8080, say. Or temporarily when moving from one hostname,
    * to another (e.g. custom domain). Then, in embedded comment page links, the origin is included,
    * so good to cache those per origin.
    * Also if accessing via https://site-NNNN.basedomain.com (what? which links?)
    *
    * @param anyCdnOrigin — Uploads and images should use the cdn origin. Should rerender cached
    * html if the cdn origin changes.
    * @param anyPageRoot — if rendering only parts of a page
    * @param anyPageQuery — if rendering a topic list page, which topics to include (useful if
    * Javascript diabled, and one wants to list topics on topic list page 2, 3, 4 ...)
    */
  case class PageRenderParams(
    widthLayout: WidthLayout,
    isEmbedded: Boolean,
    origin: String,
    anyCdnOrigin: Option[String],
    anyPageRoot: Option[PostNr],
    anyPageQuery: Option[PageQuery]) {

    def thePageRoot: PostNr = anyPageRoot getOrElse BodyNr
    def embeddedOriginOrEmpty: String = if (isEmbedded) origin else ""  // [REMOTEORIGIN]
    def cdnOriginOrEmpty: String = anyCdnOrigin getOrElse ""
  }

  case class PageRenderParamsAndHash(
    pageRenderParams: PageRenderParams,
    reactStoreJsonHash: String)

  sealed abstract class WidthLayout(val IntVal: Int) { def toInt: Int = IntVal }

  object WidthLayout {
    case object Tiny extends WidthLayout(1)   // typically, mobile phones, or tablets with sidebars open
    // Could: Small = 2                       // tablets, or small laptops with sidebar open
    case object Medium extends WidthLayout(3) // laptops
    // Could: Wide = 4                        // maybe 27'' and wider

    def fromInt(int: Int): WidthLayout = {
      if (int >= 3) WidthLayout.Medium
      else WidthLayout.Tiny
    }
  }


  case class StuffToIndex(
    postsBySite: Map[SiteId, immutable.Seq[Post]],
    pagesBySitePageId: Map[SitePageId, PageMeta],
    tagsBySitePostId: Map[SitePostId, immutable.Set[TagLabel]]) {

    def page(siteId: SiteId, pageId: PageId): Option[PageMeta] =
      pagesBySitePageId.get(SitePageId(siteId, pageId))

    def tags(siteId: SiteId, postId: PostId): Set[TagLabel] =
      tagsBySitePostId.getOrElse(SitePostId(siteId, postId), Set.empty)

    def isPageDeleted(siteId: SiteId, pageId: PageId): Boolean = {
      val p = page(siteId, pageId)
      p.isEmpty || p.exists(_.isDeleted)
    }
  }


  val WrongCachedPageVersion = CachedPageVersion(siteVersion = -1, pageVersion = -1, appVersion = "wrong",
    PageRenderParams(WidthLayout.Tiny, isEmbedded = false, "https://example.com", None, None, None),
    reactStoreJsonHash = "wrong")


  case class TagAndStats(
    label: TagLabel,
    numTotal: Int,
    numPages: Int,
    numSubscribers: Int,
    numMuted: Int)


  case class StuffToSpamCheck(
    postsBySite: Map[SiteId, immutable.Seq[Post]],
    usersBySite: Map[SiteId, Map[UserId, Participant]],
    spamCheckTasks: Seq[SpamCheckTask]) {

    def getPost(sitePostId: SitePostId): Option[Post] =
      postsBySite.get(sitePostId.siteId).flatMap(_.find(_.id == sitePostId.postId))

    def getUser(siteUserId: SiteUserId): Option[Participant] =
      usersBySite.get(siteUserId.siteId).flatMap(_.get(siteUserId.userId))
  }


  // ----- PostsOrderNesting

  case class PostsOrderNesting(
    sortOrder: PostSortOrder,
    nestingDepth: NestingDepth)

  /** -1 = InfiniteNesting: Never stops nesting. Reddit and HackerNews use this.
    *  0 = flat, like "all" forum software, e.g. phpBB and Discourse.
    *  1 = one flat sub thread per top level reply. Facebook uses this.
    *      And StackOverflow: flat comments below each answer.
    *
    * As of Feb 2020, Talkyard supports only InfiniteNesting.
    */
  type NestingDepth = Int

  object PostsOrderNesting {
    val InfiniteNesting: NestingDepth = -1  // sync with Typescript

    val Default: PostsOrderNesting =
      PostsOrderNesting(PostSortOrder.Default, InfiniteNesting)

    val DefaultForEmbComs: PostsOrderNesting =
      PostsOrderNesting(PostSortOrder.DefaultForEmbComs, InfiniteNesting)

  }

  // ----- PostsSortOrder

  sealed abstract class PostSortOrder(val IntVal: Int, val isByTime: Bo) {
    def toInt: Int = IntVal
  }

  object PostSortOrder {
    case object Default extends PostSortOrder(0, false)
    case object BestFirst extends PostSortOrder(1, false)
    case object NewestFirst extends PostSortOrder(2, true)
    case object OldestFirst extends PostSortOrder(3, true)

    val DefaultForEmbComs: PostSortOrder = BestFirst

    // Maybe: Random?
    // How would Random work, combined with performance and caching? Pick
    // a random post, keep at top for 1 minute, then a new, for the next
    // minute? and so on. So the page can be cached for a minute at least.
    // Or maybe max(1, 60 min / num-orig-post-replies)?
    // Or 100 different "cache slots" for 100 different random seeds?
    // Wait with this ... for quite a while (!).
    //
    // object Random extends PostsSortOrder(4)

    // These give new posts (and old posts further down) a chance to be seen,
    // rather than old upvoted post at the top getting most attention:
    // Also see [LIKESCORE].
    //
    // /* Shows a few new posts first, then, below, post sorted by popularity. */
    // object NewAndBestFirst extends PostsSortOrder(5)
    // object RandomAndBestFirst extends PostsSortOrder(6)
    // object NewRandomAndBestFirst extends PostsSortOrder(7)

    def fromInt(value: Int): Option[PostSortOrder] = Some(value match {
      case Default.IntVal => Default
      case BestFirst.IntVal => BestFirst
      case NewestFirst.IntVal => NewestFirst
      case OldestFirst.IntVal => OldestFirst
      case _ => return None
    })
  }


  // ----- OrigPostVotes

  sealed abstract class OrigPostVotes(val IntVal: Int) {
    def toInt: Int = IntVal
  }

  object OrigPostVotes {
    case object Default extends OrigPostVotes(0)
    case object NoVotes extends OrigPostVotes(1)
    case object LikeVotesOnly extends OrigPostVotes(2)
    case object AllVotes extends OrigPostVotes(3)

    def fromInt(value: Int): Option[OrigPostVotes] = Some(value match {
      case Default.IntVal => Default
      case NoVotes.IntVal => NoVotes
      case LikeVotesOnly.IntVal => LikeVotesOnly
      case AllVotes.IntVal => AllVotes
      case _ => return None
    })
  }


  // ----- ShowAuthorHow

  sealed abstract class ShowAuthorHow(val IntVal: Int) {
    def toInt: Int = IntVal
  }

  object ShowAuthorHow {
    case object UsernameOnly extends ShowAuthorHow(1)
    case object UsernameThenFullName extends ShowAuthorHow(2)
    case object FullNameThenUsername extends ShowAuthorHow(3)

    def fromInt(value: Int): Option[ShowAuthorHow] = Some(value match {
      case UsernameOnly.IntVal => UsernameOnly
      case UsernameThenFullName.IntVal => UsernameThenFullName
      case FullNameThenUsername.IntVal => FullNameThenUsername
      case _ => return None
    })
  }


  /** Spam related request stuff, e.g. referer and user agent.
    * Also includes the user name and email, at the time when the maybe-spam post
    * was posted — so isn't forgotten, in case the user changes hens name and
    * email, before staff has had time to review — Akismet wants misclassification
    * reports to include all original data. [AKISMET].
    */
  case class SpamRelReqStuff(
    userAgent: Option[String],
    referer: Option[String],
    uri: String,
    userName: Option[String],
    userEmail: Option[String],
    userUrl: Option[String],
    userTrustLevel: Option[TrustLevel]) {

    require(!userName.exists(_.trim.isEmpty), "TyE430MKQ24")
    require(!userEmail.exists(_.trim.isEmpty), "TyE430MKQ25")
    require(!userUrl.exists(_.trim.isEmpty), "TyE430MKQ26")
  }

  case class PostToSpamCheck(
    postId: PostId,
    postNr: PostNr,
    postRevNr: Int,
    pageId: PageId,
    pageType: PageType,
    pageAvailableAt: When,  // publication date, or if not published, the creation date
    htmlToSpamCheck: String,
    language: String) {

    require(language.trim.nonEmpty, "TyE402MR4Q")
    require(htmlToSpamCheck.trim.nonEmpty, "TyE402MR45")
  }


  /** Primary key = site id, post id and also pots revision nr, so that if
    * a spammer edits a wiki page, and insert spam links and spam is
    * detected and a review task generated, but then a friendly person
    * edits and removes the links — then the spam link revision will
    * still be remembered, so the staff who later on handle the review task
    * can see what triggered it.
    *
    * Also includes some data that might change, after the post was made,
    * and before it gets reviewed — Akismet wants misclassification
    * reports to include all original data. [AKISMET]
    *
    * @postedToPageId — good to remember, if the post gets moved to a different page, later.
    * @pagePublishedAt — if the page got unpublished and re published, good to remember
    *   the publication date, as it was, when the maybe-spam-post was posted.
    * @resultsAt — when all spam check services have replied, and we're saving their results.
    * @resultsJson — there's a field and a results object, for each spam check service we queried.
    *   The field name is the domain name for the spam check service (e.g. akismet.com).
    *   Alternatively, could construct new database tables for this, but json = simpler,
    *   and seems rather uninteresting to reference the results via foreign keys or anything.
    * @resultsText — human readable spam check results description.
    * @humanSaysIsSpam — updated once staff has reviewed.
    * @misclassificationsReportedAt — if the spam check service thought something was spam
    *   when it wasn't, or vice versa, this is the time when this misclassification was
    *   reported to the spam check service, so it can learn and improve.
    */
  case class SpamCheckTask(
    createdAt: When,
    siteId: SiteId,
    postToSpamCheck: Option[PostToSpamCheck],
    who: Who,
    requestStuff: SpamRelReqStuff,
    resultsAt: Option[When] = None,
    resultsJson: Option[JsObject] = None,
    resultsText: Option[String] = None,
    numIsSpamResults: Option[Int] = None,
    numNotSpamResults: Option[Int] = None,
    humanSaysIsSpam: Option[Boolean] = None,
    misclassificationsReportedAt: Option[When] = None) {

    require(resultsAt.isDefined == resultsJson.isDefined, "TyE4RBK6RS11")
    require(resultsAt.isDefined || resultsText.isEmpty, "TyE4RBK6RS22")
    require(resultsAt.isDefined == numIsSpamResults.isDefined, "TyE4RBK6RS33")
    require(resultsAt.isDefined == numNotSpamResults.isDefined, "TyE4RBK6RS44")
    // We need both spam check results, and a human's opinion, before
    // we can report this spam check as a misclassification.
    require((resultsAt.isDefined && humanSaysIsSpam.isDefined) ||
      misclassificationsReportedAt.isEmpty, "TyE4RBK6RS55")

    def key: SpamCheckTask.Key =
      postToSpamCheck match {
        case None => Right(siteUserId)
        case Some(p) => Left((siteId, p.postId, p.postRevNr))
      }

    def postToSpamCheckShort: Option[PostToSpamCheck] =
      postToSpamCheck map { p =>
        p.copy(htmlToSpamCheck = p.htmlToSpamCheck.take(600))
      }

    def siteUserId = SiteUserId(siteId, who.id)

    def sitePostIdRevOrUser: String = s"s$siteId, " + (postToSpamCheck match {
      case Some(thePostToSpamCheck) =>
        s"post ${thePostToSpamCheck.postId} rev nr ${thePostToSpamCheck.postRevNr}"
      case None =>
        s"user ${who.id} request stuff $requestStuff"
    })

    def isMisclassified: Option[Boolean] =
      if (resultsAt.isEmpty || humanSaysIsSpam.isEmpty) None
      else Some(
        if ((numIsSpamResults.get > 0 && !humanSaysIsSpam.get) ||
            (numNotSpamResults.get > 0 && humanSaysIsSpam.get))
          true
        else
          false)
  }

  object SpamCheckTask {
    /** We spam check either a post, or a user, e.g. hens name, email addr, profile. */
    type Key = Either[(SiteId, PostId, PostRevNr), SiteUserId]
  }


  /** Spam check results from different external services, for a single post or user profile. */
  type SpamCheckResults = immutable.Seq[SpamCheckResult]

  sealed abstract class SpamCheckResult(val isSpam: Boolean) {
    def spamCheckerDomain: String
    def humanReadableMessage: String
  }

  object SpamCheckResult {
    case class NoSpam(spamCheckerDomain: String) extends SpamCheckResult(false) {
      override def humanReadableMessage: String = "No spam found"
    }

    case class Error(spamCheckerDomain: String) extends SpamCheckResult(false) {
      override def humanReadableMessage: String = "Error talking with " + spamCheckerDomain
    }

    /**
      * @param staffMayUnhide — if moderators are allowed to override the spam check result
      *  and show the post, although detected as spam.  Not allowed (i.e. is false)
      *  if Google Safe Browsing API says a link is malware (not impl).
      * @param isCertain — if the spam checker claims it knows for 100% this is spam.
      * @param spamCheckerDomain — e.g. "akismet.com", "safebrowsing.googleapis.com", "dbl.spamhaus.org".
      * @param humanReadableMessage — a message that can be shown to the staff, so they'll know why
      *  the post was considered spam.
      */
    case class SpamFound(
      spamCheckerDomain: String,
      isCertain: Boolean = false,
      staffMayUnhide: Boolean = true,
      humanReadableMessage: String) extends  SpamCheckResult(true)
  }


  /** All columns in table page_users3.
    * Except for these, will be removed: (instead, there's the page_notf_prefs3 table) [036KRMP4]
    * notf_level = null,
    * notf_reason = null
    *
    * @param inclInSummaryEmailAtMins — was this the last time this page was
    *   included in a summary email sent to the user? So won't include the same
    *   page in many summary emails to the same person.
    *
    * @param readingProgress — can be None, e.g. if the user got added to a new chat
    *   page (addedById = Some(..)), but didn't visit it yet.
    */
  case class PageParticipant(
    pageId: PageId,
    userId: UserId,
    // Change to isPageMember: Boolean, and use the audit log to remember who did what?
    addedById: Option[UserId],
    removedById: Option[UserId],
    inclInSummaryEmailAtMins: Int,
    readingProgress: Option[PageReadingProgress])


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
  case class PageReadingProgress(
    firstVisitedAt: When,
    lastVisitedAt: When,
    lastViewedPostNr: PostNr,
    lastReadAt: Option[When],
    lastPostNrsReadRecentFirst: Vector[PostNr],
    lowPostNrsRead: immutable.Set[PostNr],
    secondsReading: Int) {

    import PageReadingProgress._

    require(secondsReading >= 0, "EdE26SRY8")
    require(firstVisitedAt.millis <= lastVisitedAt.millis, "EdE3WKB4U0")
    lastReadAt foreach { lastReadAt =>
      require(firstVisitedAt.millis <= lastReadAt.millis, "EdE5JTK28")
      require(lastReadAt.millis <= lastVisitedAt.millis, "EdE20UP6A")
    }
    require(lowPostNrsRead.isEmpty || lowPostNrsRead.max <= MaxLowPostNr,
      s"Got max = ${lowPostNrsRead.max} [EdE2W4KA8]")
    require(lowPostNrsRead.isEmpty || lowPostNrsRead.min >= BodyNr,// shouldn't be title
      s"Got min = ${lowPostNrsRead.min} [EdE4GHSU2]")

    require(lastPostNrsReadRecentFirst.size <= MaxLastPostsToRemember, "EdE24GKF0")
    require(lastPostNrsReadRecentFirst.isEmpty || lastPostNrsReadRecentFirst.min > MaxLowPostNr,
      s"Got min = ${lastPostNrsReadRecentFirst.min} [EdE4GSWA1]")

    require((secondsReading > 0) || lastReadAt.isEmpty, "EdE42HUP4X")
    require((secondsReading > 0) || lastPostNrsReadRecentFirst.isEmpty, "EdE5KWP02")
    require((secondsReading > 0) || lowPostNrsRead.isEmpty, "EdE8JSBWR42")


    def maxPostNr: PostNr =
      math.max(lowPostNrsRead.isEmpty ? 0 | lowPostNrsRead.max,
        lastPostNrsReadRecentFirst.isEmpty? 0 | lastPostNrsReadRecentFirst.max)

    def numNonOrigPostsRead: Int =
      lowPostNrsRead.size + lastPostNrsReadRecentFirst.size -
         (if (lowPostNrsRead.contains(BodyNr)) 1 else 0)


    def addMore(moreProgress: PageReadingProgress): PageReadingProgress = {
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
      assert(BodyNr == 1)
      val maxIndex = (lowPostNrsRead.max - BodyNr) / 8

      while (byteIndex <= maxIndex) {
        var currentByte: Int = 0 // "byte" because only using the lowest 8 bits
        var bitIndex = 0
        while (bitIndex < 8) {
          // +1 because first post nr is 1 (orig post = BodyNr)  (skip the title).
          val postNr = byteIndex * 8 + bitIndex + BodyNr
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


  object PageReadingProgress {
    val MaxLastPostsToRemember = 100
    val MaxLowPostNr = 512  // 8 Longs = 8 * 8 bytes * 8 bits/byte = 512 bits = post nrs 1...512


    /** There's a unit test.
      */
    def parseLowPostNrsReadBitsetBytes(bytes: Array[Byte]): Set[PostNr] = {
      val postNrs = MutArrBuf[PostNr]()
      var byteIx = 0
      while (byteIx < bytes.length) {
        val byte = bytes(byteIx)
        val base = byteIx * 8
        var bitIx = 0
        while (bitIx < 8) {
          val bitmask = 1 << bitIx
          val postNr = base + bitIx + BodyNr  // + 1 because first bit, at index 0, = post nr 1 (not 0)
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


  type TourTipsId = String
  type TourTipsSeen = immutable.Seq[TourTipsId]

  def anyTourTipsIdError(id: TourTipsId): Option[ErrorMessageCode] = {
    // Better require ids to be variable names, to avoid any surprises later.
    // The ids are incl in each user info response, so should be short, like 2 or 3 chars.
    // Maybe later there'll be plugins with their own tours? It'd be good if they can have
    // longer names, so there won't be name clashes.
    val MaxLength = 30
    def EMC = ErrorMessageCode
    Some(
      if (id.isEmpty) EMC("TyE4ABKR0", "Bad tour or tips id: Empty string")
      else if (!id.isOkVariableName) EMC("TyE4ABKR2", s"Bad tour or tips id: `$id'")
      else if (id.length > MaxLength) EMC("TyE3ABKS52", s"Tour/tips id longer than $MaxLength: `$id'")
      else return None)
  }

  /** Lets one do requests via the API.
    *
    * @param nr
    * @param userId — which user this API secret is for. If None, then may specify any user id.
    * @param createdAt
    * @param deletedAt
    * @param isDeleted — once set to true, never changed back to false. `deletedAt` might not`
    *   always be accurate in case the server's clock is off.
    * @param secretKey — don't show
    */
  case class ApiSecret(
    nr: ApiSecretNr,
    userId: Option[UserId],
    createdAt: When,
    deletedAt: Option[When],
    isDeleted: Boolean,
    secretKey: String) {

    require(!isDeleted || deletedAt.isDefined, "TyE4ABKR01")
    require(deletedAt.isEmpty || createdAt.millis <= deletedAt.get.millis, "TyE4ABKR02")
    require(userId.forall(id => id == SysbotUserId || id >= LowestTalkToMemberId), "TyE5ABKR02")
  }



  def ifThenSome[A](condition: Boolean, value: A): Option[A] =
    if (condition) Some(value) else None


  def isBlank(char: Char): Boolean = char <= ' '


  /** Tests if is valid non local address, and that Apache Commons Email accepts it. */
  def anyEmailAddressError(address: String): Option[ErrorMessage] = {
    // Try to construct an email first, because results in a somewhat friendly error message,
    // rather than just a true/false from EmailValidator.isValid().
    try {
      val apacheCommonsEmail = new org.apache.commons.mail.HtmlEmail()
      apacheCommonsEmail.setCharset("utf8")
      apacheCommonsEmail.addTo(address)
    }
    catch {
      case ex: Exception =>
        return Some(ex.getMessage)
    }

    val seemsValid = EmailValidator.getInstance(/* allowLocal = */ false).isValid(address)
    if (!seemsValid)
      return Some("EmailValidator says the email address is not valid")

    // The database doesn't allow uppercase (e.g.: `select email_seems_ok('A@ex.co');`).
    if (address.toLowerCase != address)
      return Some("Email address contains uppercase characters")

    None
  }


  implicit class GetOrBadMap[G, B](val underlying: Or[G, B]) {
    def ifBad(fn: B => Nothing): U = underlying.badMap(fn)
    def getOrIfBad(fn: B => Nothing): G = underlying.badMap(fn).get
    def getOrDie(errorCode: String): G =
      underlying.badMap(problem => die(errorCode, s"Bad.getOrDie: $problem")).get

    def getMakeGood(errorFixFn: B => G): G = underlying match {
      case Good(value) => value
      case Bad(bad) => errorFixFn(bad)
    }
  }

  implicit class RichTry[T](val underlying: Try[T]) {
    def getOrIfFailure(fn: Throwable => Nothing): T = underlying match {
      case Failure(ex) => fn(ex)
      case Success(value) => value
    }
  }

  implicit class RichSeq[K, V](val underlying: Seq[V]) {
    def groupByKeepOne(fn: V => K): immutable.Map[K, V] = {
      val multiMap = underlying.groupBy(fn)
      multiMap.mapValues(many => many.head)
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
    def toZeroOne: RoleId = if (underlying) 1 else 0
  }


  implicit class RichString3(underlying: String) {
    def isTrimmedNonEmpty: Boolean = underlying.trim == underlying && underlying.nonEmpty
  }


  def fileExists(path: String): Boolean =
    java.nio.file.Files.exists(java.nio.file.Paths.get(path))


  /** Runs a bunch of futures, one at a time, and returns the results in a `Future[List[R]]`.
    * If any computation fails, everything fails — so the caller might want to recover
    * failures.
    *
    * See: https://stackoverflow.com/a/20415056/694469
    * and: https://www.michaelpollmeier.com/
    *                        execute-scala-futures-in-serial-one-after-the-other-non-blocking
    */
  def runFuturesSequentially[I, R](items: TraversableOnce[I])(
        fn: I => Future[R])(execCtx: ExecutionContext): Future[immutable.Seq[R]] = {
    val futureResults = items.foldLeft(Future.successful[List[R]](Nil)) {
      (futureResultsThisFar: Future[List[R]], nextItem: I) =>
        // Wait for futureResultsThisFar to complete:
        futureResultsThisFar.flatMap { resultsThisFar =>
          val futureNextResult: Future[R] = fn(nextItem)
          // Compute the next item:
          futureNextResult.map { nextResult =>
            nextResult :: resultsThisFar
          } (execCtx)  // it's the caller's responsibility to recover if fails?
        } (execCtx)
    }

    futureResults.map(_.reverse)(execCtx)  // because of  ::  above
  }

  def FutGood[T](t: T): Future[Good[T]] = Future.successful(Good(t))
  def FutBad[T](t: T): Future[Bad[T]] = Future.successful(Bad(t))


  /** If you're short of time, add e.g. an UNTESTED statement. The compiler
    * ensures you don't do a typo. Then, before a release:
    *   egrep -Ir 'UNTESTED|SECURITY|MUST|TODO' app/ test/ client/ modules/ *
    * (remove spaces around *) and add test cases and fix security issues.
    */
  def NEXT = ()           // Would be quick / fun to do next
  def UNTESTED = ()       // If the code might not work, e.g. has never been run.
  def TESTS_MISSING = ()  // It'd be nice with unit/integration/whatever tests.
  def SEC_TESTS_MISSING = ()
  def ADD_TO_DOCS = ()
  def SHOULD_CODE_REVIEW = ()
  def CR_DONE = ()
  def FASTER_E2E_TESTS = () // An opportunity to speed up the e2e tests (maybe just marginally)
  def FLAKY = ()          // If an e2e test has races, can fail (ought to fix ... well ... later)

  // Maybe split into [defense] and [weakness]?
  // [defense] code tags are good — means security issues that have been dealt with.
  // [weakness] means an issues not yet handled, might lead to a 'vulnerability'
  // that an attacker / 'threat actor' can 'exploit'.
  def SECURITY = ()       // Some security issue, not necessarily so very important

  def SELF_DOS = ()
  def ASTROTURFING = ()   // Someone creates many accounts and pretends to be many people
  def PRIVACY = ()        // Could make things a bit more private
  def BUG = ()            // Need not be a terribly important bug.
  def RACE = ()           // A race condition bug / situation.
  def MUST = ()           // Fix before next release.
  def SHOULD = ()         // Fix before release, unless short of time, or it's too boring.
  def COULD = ()          // Could do this, but not important right now, can wait a year or two.
  def ANNOYING = ()       // Something annoying that would be good to fix, not important though
  def INFO_LOG = ()       // Somehow change log message severity to Info only.
  def ADMIN_LOG = ()      // Info log for site admins — e.g. custom OIDC conf problems.
  def SHOULD_LOG_STH = () // If an info/debug message ought to be logged here.
  def AUDIT_LOG = ()      // Should add audit log entry
  def REFACTOR = ()       // The code can be refactored. Also search for "[refactor]".
  def RENAME = ()         // Something ought to be renamed.
  def MOVE = ()           // Move something elsewhere
  def QUICK = ()          // Let's do now soon — won't take long.
  def OPTIMIZE = ()
  def SLOW_QUERY = ()
  def SHOULD_OPTIMIZE = ()
  def COULD_OPTIMIZE = () // Also see [On2] but typically O(n^2) is intentional (because simpler).
  def WOULD_OPTIMIZE = () // Unimportant thing that could be optimized.
  def BLOCKING_REQ = ()
  def EDIT_INDEX = ()     // Database index could be simplified. Or investigate if it's getting used?
  def AVOID_RERENDER = ()
  def SMALLER_BUNDLE = ()
  def ANTI_REACT = ()     // Things done in weird ways from React.js point of view
  def FORCED_REFLOW = ()  // Browser side only. Makes it slow.
  def COULD_FREE_MEM = () // Browser side, can set null sth to free mem, but then maybe harder to debug.
  def UX = ()             // Usability can be improved.
  def RESPONSIVE = ()     // Would look better with responsive layout. Browser side only.
  def DB_CONFICT = ()     // When the same db rows might be updated by different transaction,
                          // causing deadlocks / rollbacks / delays.
  def HACK = ()           // Quick crazy fix, probably should be redone later in a better way.
  def DELETE_LATER = ()   // ... hmm. Rename to CLEANUP.
  def DO_AFTER = ()       // Something that should be done after a certain date.
  def FIX_AFTER = ()      // Bug to fix after a certain date.
  def REMOVE = ()
  def CLEAN_UP = ()       // Unused stuff that should be deleted after a grace period, or when
                          // the developers are less short of time.
  def DISCUSSION_QUALITY = () // Stuff to do to improve the quality of the discussions
  def UNPOLITE = ()       // Vuln that lets a user be unpolite to someone else
  def FAIR = ()           // Something to fix, to make all sites share resources in a fair way.
  def QUOTA = ()          // Should keep track of resource usage

  def MAKE_CONFIGURABLE = () // Should be a play.conf config value, maybe per site config value.
  def I18N = ()           // Translation missing
  def READ = ()           // Something that could be good to read, before continuing coding.

  def VENDOR_THIS = ()
  def DELETE_DEPENDENCY = ()

  def GRAPH_DATABASE = () // Some queries are inefficient and require lots of code, when using a
                          // relational database — but are simple and fast, with a graph database.
}

