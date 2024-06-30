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
import scala.collection.{immutable => imm, mutable => mut}
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

  def dashErr(errCode: ErrCode): St = {
    if (errCode.isEmpty) ""
    else "-" + errCode
  }

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

  type ColSet[A] = collection.Set[A]

  type MutSet[A] = mutable.Set[A]
  type MutHashSet[A] = mutable.HashSet[A]
  val MutHashSet: mutable.HashSet.type = mutable.HashSet

  type MutMap[K, V] = mutable.Map[K, V]
  type MutHashMap[K, V] = mutable.HashMap[K, V]
  val MutHashMap: mutable.HashMap.type = mutable.HashMap


  def isDevOrTest: Bo = Prelude.isDevOrTest
  def isProd: Bo = Prelude.isProd

  type SidSt = St   // [Scala_3] opaque type
  type SignOnId = St   // [Scala_3] opaque type   change to SsoId?
  type SsoId = SignOnId   // [Scala_3] opaque type   change to SsoId?

  type ParsedEmail = St   // [Scala_3] opaque type

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
  val BodyNrSt: St = PageParts.BodyNr.toString
  val FirstReplyNr: PostNr = PageParts.FirstReplyNr

  val PostHashPrefixNoHash   = "post-"
  val PostHashPrefixWithHash = "#post-"
  val CommentHashPrefixNoHash   = "comment-"
  val CommentHashPrefixWithHash = "#comment-"

  type PostRevNr = Int

  /**
    * De-prioritizes this page (or sub thread) among the search results.
    * Say, a question or idea about something, before there were any docs
    * — and later on, docs are written, and the original question is no longer
    * that interesting (because the docs are shorter and better).
    *
    * null = 0 = default.
    *
    * 0b0000 0000  Inherit or the default (normal)
    * 0b0000 0001  Normal (don't inherit)
    *
    * 0b0000 0010  Boost a bit
    * 0b0000 0011  Boost medium much
    * 0b0000 0100  Boost much
    *
    * 0b0000 0101  De-prio a bit
    * 0b0000 0110  De-prio medium much
    * 0b0000 0111  De-prio much
    * 0b0000 1111  Don't index at all
    *
    * 0b0110 0110  De-prio page and comments medium much
    *          = 102
    *
    * So for now:
    */
  type IndexPrio = i16   // [Scala_3] Opaque type
  val IndexDePrioPage: IndexPrio = 102.toShort

  /** At what depth the replies won't be threaded any more, but flat.
    * 1 means no nesting, like in phpBB and Discourse.
    * If unspecified, then, unlimited nesting depth.
    */
  type ComtNesting_later = NestingDepth  // for now // oops RENAME, use  NestingDepth  instead?
  val ComtNestingDefaultInherit_later: ComtNesting_later = -1 // later?: 0.toShort

  REFACTOR // change page id to Int (not String) — is always an Int anyway,
  // except for the forum main page at Ty .io.
  type PageId = String  // Int better
  type DiscId = String  // End user (admin) defined, could be anything, so String is good.

  // ... But this should be a string.
  type AltPageId = String

  type PageVersion = Int  // [Scala_3] opaque type ... And so many more here!
  val NoVersion: PageVersion = 0

  type PageScoreAlg = i32  // for now  [Scala_3] opaque type

  type CategoryId = Int   // too long!
  type CatStuff = CategoryStuff
  type CatId = CategoryId // better
  type Cat = Category     // better
  val Cat = Category
  val NoCategoryId = 0

  // Only [a-z0-9] so works in domain names, and so won't be any surprising chars
  // if splitting on a (site pub id) and (some other id) separator. [em_in_hash]
  type PubSiteId = String  // [Scala_3] opaque type  parse check here [503MSIEJ36]

  type SiteId = Int
  val NoSiteId = 0

  type SiteVersion = i32

  type LangCode = St  // [Scala_3] opaque type

  type LoginId = String

  type Participant = com.debiki.core.Pat
  val Pat: Participant.type = Participant
  type User = UserBr  // backw compat, renaming [trait_user]
  type UserVb = UserInclDetails

  type PatVb = ParticipantInclDetails
  type MembVb = MemberInclDetails
  type MemberVb = MemberInclDetails

  // Later, these will be different?
  type GroupBr = Group
  type GroupVb = Group
  case class ValidGroup(get: Group)  // Scala_3 opaque type

  type PatIds = TrueId
  type PatId = Int
  type ParticipantId = Int  ; RENAME // to PatId
  type GuestId = PatId
  type AnonId = PatId     // Scala_3 opaque type, must be <= max-anon-id
  type MemberId = PatId   ; RENAME // to MembId
  type MembId = PatId     // but hard to read: '...bI..', two lines next to each other. Instead:
  type MemId = PatId      // ... is this better?  NO, REMOVE.
  type UserId = PatId
  type GroupId = PatId

  type Un = St  // is this nice?
  type Username = St   // a bit long?
  type FullName = St

  // Use MemberId instead.
  type RoleId = UserId   ; CLEAN_UP ; REMOVE

  type Notf = Notification  // renaming
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

  type NoticeId = i32

  trait HasInt32Id {
    def id: i32
  }

  sealed abstract class MarkupLang
  object MarkupLang {
    case object Html extends MarkupLang
    case object CommonMark extends MarkupLang

    def fromString_apiV0(value: St): Opt[MarkupLang] = Some(value match {
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
  RENAME // to RefId? [refid_0_extid]
  type RefId = ExtId

  type Ref = String  ; RENAME // to RawRef, and ... or not: rename ParsedRef to just Ref
  type RawRef = Ref  //  ... started

  sealed trait PatRef {
    def isSsoOrExtId: Bo  // break out to base trait 'Ref'? Also see comment above

    def findMatchingPat(pats: Iterable[PatVb]): Opt[PatVb] = {
      pats find { pat =>
        this match {
          case ParsedRef.UserId(userId) => pat.id == userId
          case ParsedRef.TalkyardId(_) => die("TyE5MAT20M", "tyid:__ refs shouldn't be here")
          case ParsedRef.SingleSignOnId(ssoId) =>
            pat match {
              case u: UserBase => u.ssoId is ssoId
              case _ => false
            }
          case ParsedRef.ExternalId(extId) => pat.extId is extId
          case ParsedRef.Username(username) => pat.anyUsername.is(username) && pat.isUserNotGuest
          case ParsedRef.Groupname(username) => pat.anyUsername.is(username) && pat.isGroup
        }
      }
    }
  }

  sealed trait PageRef { self: ParsedRef =>
    // Why this needed, I thought the compiler would deduce this itself?
    // (when [the exact type is known to the compiler], and it extends PageRef).
    def asParsedRef: ParsedRef = self
  }

  // Hmm, PostIdRef and PostNrRef extends PostRef?  [post_id_nr_ref]
  sealed trait PostRef

  sealed trait TypeRef

  sealed abstract class ParsedRef(
    val canBeToPat: Bo = true,
    val canOnlyBeToPat: Bo = false,
    val canBeToPage: Bo = true,
    val isSsoOrExtId: Bo = false)

  object ParsedRef {
    REFACTOR // _refactor_ref_matches:  Break out the if(){...} to blocks and
    // place in lists of things to try, the find-first-match.

    RENAME // to RefId [refid_0_extid]
    case class ExternalId(value: ExtId)
      extends ParsedRef(isSsoOrExtId = true)
      with PatRef with PageRef with PostRef with TypeRef

    case class SingleSignOnId(value: St)
      extends ParsedRef(canOnlyBeToPat = true, canBeToPage = false, isSsoOrExtId = true)
      with PatRef

    case class InternalIntId(value: i32)
      extends ParsedRef with PatRef with PostRef

    RENAME // to InternalStrId?
    case class TalkyardId(value: St)  // hmm or only PageRef
      extends ParsedRef with PatRef with PageRef

    case class PageId(value: core.PageId)
      extends ParsedRef(canBeToPat = false) with PageRef

    case class PagePath(value: St)
      extends ParsedRef(canBeToPat = false) with PageRef

    case class Slug(value: St) extends TypeRef
        // Not needed: extends ParsedRef(..)

    // case class PatId(value: core.PatId)  — also for guests and anons, pat id <= -10.

    RENAME // to MemberId?  So works for groups too?
    case class UserId(value: core.UserId)
      extends ParsedRef(canOnlyBeToPat = true, canBeToPage = false) with PatRef {
      dieIf(value <= 0, "TyE60MSPL2", s"User id ref <= 0: $value")
    }

    case class Username(value: St)
      extends ParsedRef(canOnlyBeToPat = true, canBeToPage = false) with PatRef

    case class Groupname(value: St)
      extends ParsedRef(canOnlyBeToPat = true, canBeToPage = false) with PatRef

    // Either a user or a group, but not a guest.
    //case class Membername(value: St)
    //  extends ParsedRef(canOnlyBeToPat = true, canBeToPage = false) with PatRef

    // Maybe trait PageLookupId { def lookupId: St }  —>  "diid:..." or "https://..." ?
    case class DiscussionId(diid: St)
      extends ParsedRef(canBeToPat = false) with PageRef

    /// EmbeddingUrl(.., lax = true)  tries to match by exact URL (or no?),
    /// or //hostname:port/path, or just /url/path, in that order.  [emburl_emgurl]
    /// Whilst:  EmbeddingUrl("/url/path", lax=true)   matches the url path only
    /// (there's no hostname).
    ///  EmbeddingUrl("//hostname/url/path", lax = false) requires an exact host & path match,
    /// and:  https://hostname/url/part  !lax  would require the scheme to match too?
    ///
    /// emgurllax:https://hostname/blog/post
    ///   first tries: https://hostname/blog/post
    ///          then: http://hostname/blog/post (i.e. http:)
    ///          or does it try just:  //hostname/blog/post ?
    ///          then: /blog/post            (i.e. only the url path)
    ///
    /// emgurlexact:https://hostname/blog/post
    ///   tries only: https://hostname/blog/post
    ///
    /// emgurlexact://hostname/blog/post
    ///  first tries: https://hostname/blog/post
    ///         then: http://hostname/blog/post
    /// (nothing more)
    ///
    /// emgurllax:/blog/post  and
    /// emgurlexact:/blog/post
    ///   both tries only: /blog/post
    ///
    case class EmbeddingUrl(url: St, lax: Bo)
      extends ParsedRef(canBeToPat = false, canBeToPage = false) {

      def exact: Bo = !lax
    }
  }

  def parsePatRef(ref: Ref): PatRef Or ErrMsg = {
    parseRef(ref, allowPatRef = true, allowTyId = false) map {
          parsedRef =>
      if (!parsedRef.canBeToPat) return Bad(s"Not a participant ref: $ref")
      parsedRef.asInstanceOf[PatRef]
    }
  }

  def parsePageRef(ref: Ref): PageRef Or ErrMsg = {
    parseRef(ref, allowPatRef = false) map { parsedRef =>
      if (!parsedRef.canBeToPage) return Bad(s"Not a page ref: $ref")
      parsedRef.asInstanceOf[PageRef]
    }
  }

  def parsePostRef(ref: Ref): PostRef Or ErrMsg = Good {
    if (ref startsWith "rid:") {
      val refId = ref drop "rid:".length
      ParsedRef.ExternalId(refId)
    }
    else if (ref startsWith "iid:") {
      // See _refactor_ref_matches
      val internalIdSt = ref drop "iid:".length
      val intId = internalIdSt.toIntOption getOrElse {
        return Bad(s"""Ref value is not an integer: "$ref"""")
      }
      ParsedRef.InternalIntId(intId)
    }
    else {
      return _badRef(ref, "rid:....")
    }
  }

  def parseTypeRef(ref: Ref): TypeRef Or ErrMsg = Good {
    if (ref startsWith "rid:") {
      val refId = ref drop "rid:".length
      ParsedRef.ExternalId(refId)
    }
    else if (ref startsWith "slug:") {
      val slug = ref drop "slug:".length
      ParsedRef.Slug(slug)
    }
    else {
      return _badRef(ref, "rid:.... or slug:...")
    }
  }

  def parseRef(ref: Ref, allowPatRef: Bo, allowTyId: Bo = true): ParsedRef Or ErrMsg = {
    if (ref.isEmpty)
      return Bad("Empty ref: Neither prefix, nor value [TyEEMPTREF]")

    /* After prefixed all discussion ids with 'diid:'  [prefix_diid], then,
    // here, we can:
    if (ref.count(_ == ':') == 1 && ref.last == ':')
      return Bad("Empty ref: No value after the  ':'")
    // Maybe reject the ref, if any non-[a-z0-9] before the ':'?
    */

    val returnBadIfDisallowParticipant = () =>
      if (!allowPatRef)
        return Bad(s"Refs to participants not allowed here, got: '$ref' [TyEISPATERF]")

    // Usernames and Talkyard internal ids don't contain '@'.
    val returnBadIfContainsAt = (value: String) =>
      if (value contains '@')
        return Bad("Ref contains '@': " + ref)

    if (ref startsWith "rid:") {
      val refId = ref drop "rid:".length
      Good(ParsedRef.ExternalId(refId))
    }
    else // "extid" is an old name, renaming to "rid" for "reference id" [refid_0_extid]
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
      if (!allowTyId) Bad("These refs not allowed here: 'tyid:...' [TyEREFTYIDREF]")
      else {
        val tyId = ref drop "tyid:".length
        returnBadIfContainsAt(tyId)
        Good(ParsedRef.TalkyardId(tyId))
      }
    }
    // Later:  membid:__  also for groups,  and patid:__ also for guests & anons
    else if (ref startsWith "userid:") {
      returnBadIfDisallowParticipant()
      val idSt = ref drop "userid:".length
      val id = idSt.toIntOption getOrElse {
        return Bad("After 'userid:' must follow an integer: " + ref)
      }
      if (Pat.isGuestId(id))
        return Bad("Not a user ref, but a guest ref: " + ref)
      if (Pat.isBuiltInGroup(id))
        return Bad("Not a user ref, but a built-in group ref: " + ref)
      Good(ParsedRef.UserId(id))
    }
    else if (ref startsWith "username:") {
      returnBadIfDisallowParticipant()
      val username = ref drop "username:".length
      returnBadIfContainsAt(username)
      Good(ParsedRef.Username(username))
    }
    else if (ref startsWith "groupname:") {
      returnBadIfDisallowParticipant()
      val groupname = ref drop "groupname:".length
      returnBadIfContainsAt(groupname)
      Good(ParsedRef.Groupname(groupname))
    }
    else if (ref startsWith "diid:") {
      val discId = ref drop "diid:".length
      Good(ParsedRef.DiscussionId(discId))
    }
    else if (ref startsWith "pageid:") {
      val id = ref drop "pageid:".length
      Good(ParsedRef.PageId(id))
    }
    else if (ref startsWith "pagepath:") {
      val path = ref drop "pagepath:".length
      Good(ParsedRef.PagePath(path))
    }
    else if (ref startsWith "emgurllax:") {
      val url = ref drop "emgurllax:".length
      Good(ParsedRef.EmbeddingUrl(url, lax = true))
    }
    else if (ref startsWith "emburl:") {
      DO_AFTER // 0.2021.30: Remove 'emburl:', only support 'emgurllax' (just above) [emburl_emgurl]
      val url = ref drop "emburl:".length
      Good(ParsedRef.EmbeddingUrl(url, lax = true))
    }
    /* Not impl (elsewhere)
    else if (ref startsWith "emgurlexact:") {
      val url = ref drop "emgurlexact:".length
      Good(ParsedRef.EmbeddingUrl(url, lax = false))
    } */
    else {
      _badRef(ref, "rid:...")
    }
  }

  private def _badRef(ref: St, wantsWhat: St): Bad[ErrMsg] = {
      var refDots = ref.takeWhile(_ != ':') take 14
      if (refDots.length >= 14) refDots = refDots.dropRight(1) + "..."
      Bad(s"Unknown ref type: '$refDots', should be e.g. '$wantsWhat' [TyEREFTYPE]")
  }


  val LowestTempImpId: Int = 2*1000*1000*1000
  val FirstTempImpId: Int = LowestTempImpId + 1
  def isPageTempId(pageId: PageId): Boolean =
    pageId.length == 10 && pageId.startsWith("2000") // good enough for now

  type TagTypeId = i32
  type TagId = i32

  // Old ------------
  type Tag_old = String
  type TagDefId = Int
  type TagLabelId = Int
  type TagLabel = String
  // ----------------
  val NoTagId: TagId = 0
  val NoTagTypeId: TagTypeId = 0

  /** Email identities are strings, all others are numbers but converted to strings. */
  type IdentityId = String

  type IpAddress = String  // Too long
  type IpAdr = IpAddress  // [Scala_3] opaque type

  type EmailAdr = String  // [Scala_3] opaque type
  type EmailId = String   // [Scala_3] opaque type   RENAME to EmailOutId instead?
  type EmailOutId = EmailId

  type EmailOut = Email  // renaming from Email to EmailOut

  type SmtpMsgId = St       // [Scala_3] opaque type
  type SmtpMsgIdPrefix = St // [Scala_3] opaque type

  RENAME // to EventId. And, later: [Scala_3] opaque type
  type AuditLogEntryId = Int
  type EventId = AuditLogEntryId

  type WebhookId = i32

  type ApiSecretNr = Int

  type LinkMaybeBad = St
  sealed trait MayLink_unused
  object MayLink_unused {
    case object YesRelFollow extends MayLink_unused
    case object YesNoFollow extends MayLink_unused
    case object No extends MayLink_unused
  }


  /** Sync w Typescript [NeverAlways].
    * Sync w db, the  never_always_d  PostgreSQL custom domain.
    */
  sealed abstract class NeverAlways(val IntVal: i32) {
    def toInt: i32 = IntVal
    def isNeverMaybeCanContinue: Bo =
      IntVal <= 2 // that's <= NeverButCanContinue
  }

  object NeverAlways {
    //se object Never extends NeverAlways(1)
    case object NeverButCanContinue extends NeverAlways(2)
    case object Allowed extends NeverAlways(3)
    /** The setting is shown, and if one leaves it as is, it'll be disabled / off. */
    //se object AllowedMustChoose extends NeverAlways(4)
    /** The setting is shown, and one needs to click & choose: disabled, or enabled. */
    //se object MustChoose extends NeverAlways(5)
    /** The setting is shown, and if one leaves it as is, it'll be enabled / on. */
    //se object RecommendedMustChoose extends NeverAlways(6)
    case object Recommended extends NeverAlways(7)
    case object AlwaysButCanContinue extends NeverAlways(8)
    //se object Always extends NeverAlways(9)

    def fromOptInt(value: Opt[i32]): Opt[NeverAlways] =
      value flatMap fromInt32

    def fromInt32(value: i32): Opt[NeverAlways] = Some(value match {
      case NeverButCanContinue.IntVal => NeverButCanContinue
      case Allowed.IntVal => Allowed
      case Recommended.IntVal => Recommended
      case AlwaysButCanContinue.IntVal => AlwaysButCanContinue
      case _ => return None
    })
  }


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
  // Split into Problem & SiteProblem? The latter w site id, the former without?
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
  case class ErrorMessageCode(message: ErrorMessage, code: String) {
    def toMsgCodeStr: St = s"$message [$code]"
  }
  type ErrMsgCode = ErrorMessageCode
  object ErrMsgCode {
    def apply(message: ErrMsg, code: St): ErrMsgCode = ErrorMessageCode(message, code = code)
  }


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
  type UnixSecs = i64
  type UnixMinutes = Int
  type UnixDays = Int


  case class TimeRange(from: When, fromOfs: i32, to: When, toOfs: i32) {
    def fromIsIncl: Bo = false // for now
    def toIsIncl: Bo = true    // for now
  }


  /** I'll use this instead of whatever-date-time-stuff-there-is.
    */
  class When(val unixMillis: UnixMillis) extends AnyVal {
    def toJavaDate = new ju.Date(unixMillis)
    def toDays: WhenDay = WhenDay.fromMillis(unixMillis)
    def millis: UnixMillis = unixMillis
    def unixMinutes: Int = (unixMillis / 1000 / 60).toInt
    def toUnixMillis: UnixMillis = unixMillis
    def daysSince(other: When): Long = (unixMillis - other.unixMillis) / OneMinuteInMillis / 60 / 24
    def daysSince(other: ju.Date): i64 = (unixMillis - other.getTime) / OneMinuteInMillis / 60 / 24
    def daysBetween(other: When): Long = math.abs(daysSince(other))
    def hoursSince(other: When): Long = (unixMillis - other.unixMillis) / OneMinuteInMillis / 60
    def hoursSince(other: ju.Date): i64 = (unixMillis - other.getTime) / OneMinuteInMillis / 60
    def minutesSince(other: When): Long = (unixMillis - other.unixMillis) / OneMinuteInMillis
    def secondsSince(other: When): Long = (unixMillis - other.unixMillis) / 1000
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

    /** For PostgreSQL, which wants fractional Unix seconds passed to to_timestamp(). */
    def secondsFlt64 = unixMillis.toDouble / 1000

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

    def toWhenMins: WhenMins = WhenMins.fromMillis(millis)
  }

  object When {
    /** The world came into existence, on Jan 1, 1970, midnight (just after midnight right?) */
    val Genesis = new When(0)

    /** Long.MaxValue is too large for PostgreSQL timestamps.
      * This is Saturday, May 15, 2258 04:33:21. */
    val Never = new When(9100010001000L)
    val EndOfTime = Never

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

    def earliestNot0(whenA: When, whenB: Opt[When]): When =
      if (whenB.isEmpty) whenA
      else earliestNot0(whenA, whenB.get)

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


  // Just an i32.
  class WhenMins(val mins: i32) extends AnyVal {
    def millis: i64 = mins * MillisPerMinute
    def toJavaDate = new ju.Date(millis)
    override def toString: St = mins.toString + "mins"
  }


  object WhenMins {
    def fromMins(unixMins: i64): WhenMins = {
      // If this is not between 2010 and 2100, something is amiss.
      // Unix seconds 1263000000 is 2010-01-09 01:20,
      // and that's Unix minutes 21050000.
      // Unix seconds 4104000000 is 2100-01-19, 00:00,
      // and that's Unix minutes 68400000.
      require(unixMins <= 68400000,
            s"Unix mins must be < year 2100 but is: $unixMins [TyE4M0WEP35]")
      require(unixMins >= 21050000,
            s"Unix mins must be > year 2010 but is: $unixMins [TyE4M0WEP37]")
      new WhenMins(unixMins.toInt)
    }
    def fromMillis(unixMillis: i64): WhenMins = fromMins(unixMillis / MillisPerMinute)
    def fromDate(date: ju.Date): WhenMins = fromMillis(date.getTime)
    def fromDays(unixDays: i32): WhenMins = fromMins(unixDays.toLong * 24 * 60)
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


  type StorePatch = JsObject  // [Scala_3] opaque type. Or maybe a struct of its own?

  type ReqrId = Who // RENAME to ReqrIds? (with an ...s),  [edit] NO, instead, to ReqrInf. [/edit]
                    // ... because is more than one id (user id, ip, bowser id cookie, etc)

  case class ReqrInf( // better, no, ... best:  talkyard.server.authz.ReqrAndTgt, use instead
    reqr: Pat,
    browserIdData: BrowserIdData,
  ) {
    def id: PatId = reqr.id
    def isAdmin: Bo = reqr.isAdmin
    def isStaff: Bo = reqr.isStaff
    def toWho: Who = Who(reqr.trueId2, browserIdData, reqr.isAnon)
  }


  type BrowserIdSt = St  // [Scala_3] opaque type

  RENAME // to ReqrId? = "Requester id" and that's what it is: the user id plus hens browser id data.
  // I find "who" being confusing as to whom it refers to.
  // [edit] No, rename to ReqrInf instead?!  (Requester information)
  // But not to ReqInf, because it's not info about the *request*, but about
  // the *requester* (the person). E.g. url path and query param names, should *not*
  // be exposed to internal parts of Ty (would increase the coupling, in a bad way).
  // So, not ReqInf, but ReqrInf.  [/edit]
  // Is isAnon always false, hmmm?
  @deprecated("Use ReqrAndTgt instead")
  case class Who(trueId: TrueId, browserIdData: BrowserIdData, isAnon: Bo = false) {
    def id: PatId = trueId.curId
    def ip: String = browserIdData.ip
    def idCookie: Option[String] = browserIdData.idCookie
    def browserFingerprint: Int = browserIdData.fingerprint
    REFACTOR; CLEAN_UP; DO_AFTER // 2023-04-20
    // His can now be a TrueId memb fn? Just verify this is ok:
    dieIf(isAnon != trueId.isAnon, "TyE603MSKJ46")
    def isGuest: Bo = !isAnon && Participant.isGuestId(id)
    def isSystem: Boolean = id == SystemUserId
    def isGuestOrAnon: Bo = trueId.isGuestOrAnon

    dieIf(isAnon != trueId.anyTrueId.isDefined, "TyE40MADEW35",
          s"isAnon: $isAnon but trueId: ${trueId.trueId}")
  }

  object Who {
    def apply(patId: PatId, browserIdData: BrowserIdData): Who =
      Who(TrueId(patId), browserIdData)

    val System = Who(TrueId(SystemUserId), BrowserIdData.System)
  }


  /*
  sealed abstract class AnonLevel(val IntVal: i32) { def toInt: i32 = IntVal }
  object AnonLevel {
    case object NotAnon extends AnonLevel(10)
    case object AnonymPerPage extends AnonLevel(50)

    def fromInt(value: i32): Opt[AnonLevel] = Some(value match {
      case NotAnon.IntVal => NotAnon
      case AnonymPerPage.IntVal => AnonymPerPage
      case _ => return None
    })
  }*/



  /** A bitfield. Currently only None, 65535 = IsAnonOnlySelfCanDeanon
    * and 2097151 = IsAnonCanAutoDeanon are supported.
    * Maybe 90% of all this will never get implemented? Nice to have thought
    * a bit about already, though.
    *
    * None, SQL null, 0 means:  is *not* anon.
    *
    * Default value, if *is* anon,  is an i32 with 21 lowest bits set:
    *    2^21 - 1 = 2097151,  upper 11 bits zero (0).   But why?  Because with some
    * unused bits (see below) being 0, others 1, one can choose if a future new flag bit
    * is going to be by default 0 (off) or 1 (on), by picking a reseved bit that's
    * already 0 (bits 22-32, see below) or 1 (bits 8-16, see below). Without having to
    * update any database rows.
    *
    * Why is this a bitfield? — Because creating 32 db columns is boring (not that many,
    * but still), and wastes bandwidth if sending as a json obj (instead of an i32)
    * over the network.
    *   Hmm! But now there're so many parts — maybe it'd be better with
    *  many [anon_status_fields] after all. No hurry, can wait and see.
    *
    * Bit 1:
    *   -------1  =   1: is anonymous
    *
    * Bits 2-4: *Store* true id?  [forgetting_true_ids]
    *   ----000-  =  0: don't remember true id info at all
    *   ----001-  =  2: can store in mem, spam etc check using AI (but no human), then delete
    *   ----010-  =  4: can store on disk,            - '' -
    *   ----011-  =  6: can store on disk, human(s) review, then delete directly
    *   ----100-  =  8: can wait some hours or days for flags, then delete (a conf val)
    *   ----101-  = 10: can keep in db for a while (week maybe month), then delete (conf val)
    *   ----110-  =     ?
    *   ----111-  = 14: can keep in db permanently (the default)
    *
    *        ?    =  ?: exclude true id from backups
    *
    * Bits 5-7: Who may *see* the true id?
    *   -000----  =  A DBA cannot and could not see the true id of this anon (wasn't stored)
    *   -001----  =  A DBA can (could) see the true id, by running SQL queries
    *   -010----  =  you cay (could) see your own anons
    *   -011----  =  admins can see the true ids of anons (and you can see your own)
    *   -100----  =  ?
    *   -101----  =  ?
    *   -110----  =  ?
    *   -111----  =  others with see-anon permissions in the category,
    *           can see true ids (typically mods, so they can know who
    *           a problematic anon is, without having to de-anonymize the account).
    *
    * Bits 8-9: *Notify* the author, if sbd has a look at the true id?
    *         00  =  Notify each time, all communication methods  (not yet implemented)
    *         01  =  Notify, but debounced & rate limited  (not yet impl)
    *         10  =  Notify only the first time  (not yet impl)
    *         11  =  Don't notify
    *
    * Bits 10-12: Notify other admins & those with see-anon permission  ?
    *   Let the one who is about to check and see who an anon is, know that
    *   the others with see-anon permission will be notified afterwards.
    *   Maybe even a publicly visible audit log for all forum members?
    *   And include in the audit log info about adding/removing people with
    *   the see-anon permission?
    *   And exclude true ids from backup dumps? (Can make sense for managed hosting)
    *   But this is much more than 3 bits!  [anon_status_fields]
    *
    * Bits 13-15: Min votes to see anon  ?
    *   To check who an anon is, at least 2, 3, 4 or ... people with the see-anon
    *   permission need to agree.
    *
    *    (only bits 1-15 & 16 set = 65535)
    *
    * Bits 16-18:  Who may *deanonymize*?
    *   000  =  cannot be deanonymized (except maybe by DBAs, if info stored; see bits 2-7)
    *   001  =  may deanonymize oneself (and DBAs can too), but not admins
    *   010  =  may be deanonymized by admins (and DBAs), but not oneself
    *   011  =  may be deanonymized by admins and oneself
    *   100  =  may be deanonymized by those with deanon permission in the category? & admins
    *   101  =  may be deanonymized by those with deanon permission, and oneself? & admins
    *   110  =  may be deanonymized by those with deanon permission, or automatically & admins
    *   111  =  may get deanonymized automatically (by trigger, e.g. date),
    *                                           and those with perms, and oneself  & admins
    *
    * Bits 19-21: Reserved, and 111 (set) if IsAnonCanAutoDeanon,
    *                           000 (unset) if IsAnonOnlySelfCanDeanon. Hmm.
    *
    * Bits  22-32:
    *   00000000000  reserved   (and only bits 1-21 set, 22-23 zero = 2^21-1 = 2097151)
    *
    * Reserved bits could later say if e.g.:
    *       - May any of the anon's posts be moved to other pages? By default, no.
    *       - May the anon comment on other pages or anywhere in a category? (But then,
    *         couldn't anon_on_page_id_st_c just be set to null instead, meaning anywhere.
    *         Or after [add_nodes_t] to a cateory, meaning, anywhere therein?)
    *       - May one switch to another anonym, in the same sub thread?
    *         Let's say, reply as anon MyAnA to the orig post, then, sbd repiles to
    *         MyAnA, and then one relpies as MyAn*B* to that other person?
    *         Or, one then needs to reply as MyAnA? Or needs to use the same anon
    *         on the whole page?
    */
  sealed abstract class AnonStatus(val IntVal: i32, val isAnon: Bo = true) {
    def toInt: i32 = IntVal
  }

  object AnonStatus {
    /** Cannot save in the database (that'd mean an anonymous user that wasn't anonymous)
      * — just means that pat intentionally wants to use hens real account.
      * (And then that real user would get saved as post author, instead — but IntVal 0 doesn't
      * get saved in the db, instead, is null (in the db).)
      */
    case object NotAnon extends AnonStatus(0, isAnon = false)

    case object IsAnonOnlySelfCanDeanon extends AnonStatus(65535)

    /** For now, all 21 lower bits set. See the AnonStatus descr above. Sync w Typescript. */
    case object IsAnonCanAutoDeanon extends AnonStatus(2097151)

    def fromOptInt(value: Opt[i32]): Opt[AnonStatus] = value flatMap fromInt

    def fromInt(value: i32): Opt[AnonStatus] = Some(value match {
      case NotAnon.IntVal => return None
      case IsAnonOnlySelfCanDeanon.IntVal => IsAnonOnlySelfCanDeanon
      case IsAnonCanAutoDeanon.IntVal => IsAnonCanAutoDeanon
      case _ =>
        // warnDevDie() — later?
        return None
    })
  }


  sealed abstract class WhichAnon() {
    require(anySameAnonId.isDefined != anyNewAnonStatus.isDefined, "TyE6G0FM2TF3")

    // Either ...
    def anyNewAnonStatus: Opt[AnonStatus] = None
    // ... or.
    def anySameAnonId: Opt[AnonId] = None
  }

  object WhichAnon {
    case class NewAnon(anonStatus: AnonStatus) extends WhichAnon {
      require(anonStatus != AnonStatus.NotAnon, "WhichAnon is NotAnon [TyE2MC06Y8G]")
      override def anyNewAnonStatus: Opt[AnonStatus] = Some(anonStatus)
    }

    case class SameAsBefore(sameAnonId: PatId) extends WhichAnon {
      override def anySameAnonId: Opt[AnonId] = Some(sameAnonId)
    }
  }


  sealed abstract class AnyUserAndLevels {
    def anyUser: Opt[Pat]
    def trustLevel: TrustLevel
    def threatLevel: ThreatLevel
  }

  /**
    * @param user, (RENAME to patOrPseudonym?) — the id of the requester, can be a pseudonym. But not an anonym.
    * @param trustLevel — if patOrPseudonym is a pseudonym, then this is the pseudonym's
    *   trust level, which can be different from the true member's trust level?
    *   (See tyworld.adoc, [pseudonyms_trust].)
    */
  case class UserAndLevels(
    user: Pat,
    trustLevel: TrustLevel,
    threatLevel: ThreatLevel,
  ) extends AnyUserAndLevels {
    def anyUser = Some(user)
    def id: UserId = user.id
    def isStaff: Boolean = user.isStaff
    def nameHashId: String = user.nameHashId
  }

  case class StrangerAndThreatLevel(threatLevel: ThreatLevel) extends AnyUserAndLevels {
    def anyUser: Opt[Pat] = None
    def trustLevel: TrustLevel = TrustLevel.Stranger
  }


  sealed trait OrderBy { def isDescending: Boolean = false }

  object OrderBy {
    object OldestFirst extends OrderBy
    object MostRecentFirst extends OrderBy { override def isDescending = true }
  }

  /* Maybe later?:  [sort_tag_vals_in_pg]
  sealed trait PostsWithTagOrder { def desc: Bo }
  object PostsWithTagOrder {
    case class ByPublishedAt(desc: Bo = false) extends PostsWithTagOrder
    case class ByTagValue(desc: Bo = false, valType: St) extends PostsWithTagOrder {
      require(valType == "i32" || valType == "f64" || valType == "str",
            s"Bad val type: $valType [TyE703MRADLU5]")
    }
  } */

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
  val OneDayInSecondsFlt64: f64 = (3600 * 24).toDouble
  val OneWeekInMillis: Long = 7 * MillisPerDay
  val OneMonthInMillis: Long = 365 * MillisPerDay / 12  // divides evenly
  val OneYearInMillis: Long = 365 * MillisPerDay

  val Kibibyte: Int = 1024   // REMOVE
  val Kibibyte32: i32 = 1024
  val Kibibyte64: i64 = 1024L
  val Mebibyte: Int = 1024 * 1024   // REMOVE
  val Mebibyte32: i32 = 1024 * 1024
  val Mebibyte64: i64 = 1024L * 1024L
  val Megabyte: Int = 1000 * 1000    // REMOVE, need 32 or 64 suffix
  val Megabytes: Int = Megabyte      // REMOVE

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
  def SystemSpamStuff = SpamRelReqStuff(
        BrowserIdData.System, userAgent = None, referer = None, uri = "/dummy",
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
  def MaxGuestOrAnonId: PatId = Participant.MaxGuestOrAnonId
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
    storeJsonHash: String) {

    /** Interpreted by the computer (startup.js looks for the '|'). */
    def computerString =
      s"site: $siteVersion, page: $pageVersion | app: $appVersion, hash: $storeJsonHash"
  }


  /** Params that influence how a page gets rendered.
    *
    * COULD incl forum topic list sort order too, and discussion topic comments sort order.  [7TMW4ZJ5]
    *
    * @param comtOrder — how the comments are sorted (best first? oldest first? etc).
    * @param widthLayout — the HTML structure, and maybe avatar and image urls, are different,
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
    * @param anyCdnOrigin — Talkyard's scripts and styles can use a separate CDN origin.
    * @param anyUgcOrigin — Uploads and images should use a UGC origin. Should rerender cached
    * html if the UGC origin changes.
    * @param anyPageRoot — if rendering only parts of a page
    * @param anyPageQuery — if rendering a topic list page, which topics to include (useful if
    * Javascript diabled, and one wants to list topics on topic list page 2, 3, 4 ...)
    */
  case class PageRenderParams(
    comtOrder: PostSortOrder,
    //comtNesting: NestingDepth, — later, for now, `def comtNesting` below instead
    widthLayout: WidthLayout,
    isEmbedded: Bo,
    origin: St,
    anyCdnOrigin: Opt[St],
    anyUgcOrigin: Opt[St],
    anyPageRoot: Opt[PostNr],
    anyPageQuery: Opt[PageQuery]) {

    def comtNesting: NestingDepth = -1  // means unlimited
    def thePageRoot: PostNr = anyPageRoot getOrElse BodyNr
    def embeddedOriginOrEmpty: St = if (isEmbedded) origin else ""  // [REMOTEORIGIN]
    def cdnOriginOrEmpty: St = anyCdnOrigin getOrElse ""
    def ugcOriginOrEmpty: St = anyUgcOrigin getOrElse ""
  }

  case class RenderParamsAndFreshHash(
    renderParams: PageRenderParams,
    freshStoreJsonHash: St)

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


  object JobType {
    val Index = 1
  }


  case class PostsToIndex(
    postsToIndexBySite: Map[SiteId, immutable.Seq[Post]],
    pagesBySitePageId: Map[SitePageId, PageMeta],
    tagsBySitePostId: Map[SitePostId, imm.Seq[Tag]],
    tagsBySitePostId_old: Map[SitePostId, immutable.Set[TagLabel]]) {

    def page(siteId: SiteId, pageId: PageId): Option[PageMeta] =
      pagesBySitePageId.get(SitePageId(siteId, pageId))

    def tags(siteId: SiteId, postId: PostId): imm.Seq[Tag] =
      tagsBySitePostId.getOrElse(SitePostId(siteId, postId), Nil)

    def tags_old(siteId: SiteId, postId: PostId): Set[TagLabel] =
      tagsBySitePostId_old.getOrElse(SitePostId(siteId, postId), Set.empty)

    def isPageDeleted(siteId: SiteId, pageId: PageId): Boolean = {
      val p = page(siteId, pageId)
      p.isEmpty || p.exists(_.isDeleted)
    }
  }


  val WrongCachedPageVersion: CachedPageVersion =
    CachedPageVersion(
          siteVersion = -1,
          pageVersion = -1,
          appVersion = "wrong",
          renderParams = PageRenderParams(
                PostSortOrder.OldestFirst, WidthLayout.Tiny,
                isEmbedded = false, "https://example.com", None, None, None, None),
          storeJsonHash = "wrong")


  case class TagTypeStats(
    tagTypeId: TagTypeId,
    numTotal: Int,
    numPostTags: Int,
    numPatBadges: Int)


  @deprecated
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

    // Move these to appsv/server/debiki/settings.scala?  [appsv_layout_defs]
    val Default: PostsOrderNesting =
      PostsOrderNesting(PostSortOrder.OldestFirst, InfiniteNesting)

    val DefaultForEmbComs: PostsOrderNesting =
      PostsOrderNesting(PostSortOrder.BestFirst, InfiniteNesting)

  }

  // ----- PostsSortOrder

  sealed trait ComtOrderAtDepth

  RENAME // to ComtOrder?
  sealed abstract class PostSortOrder(val IntVal: Int, val isByTime__remove: Bo) {
    def toInt: Int = IntVal
    // Overridden by subclasses.
    def atDepth(_depth: i32): ComtOrderAtDepth = this.asInstanceOf[ComtOrderAtDepth]
  }

  /// Sync with Typescript [PostSortOrder].
  ///
  object PostSortOrder {
    // (A nibble is 4 bits: 0x00 – 0xff.)
    // Stored as Null, means inherit ancestor categories or whole site setting.
    private val InheritNibble = 0x00
    private val BestFirstNibble = 0x01
    private val NewestFirstNibble = 0x02
    private val OldestFirstNibble = 0x03

    // Trending — but what time period? That could be a separate field, see [TrendingPeriod].
    // private val TrendingFirstNibble = 0x04

    // Comments with both many Likes and Disagrees.
    //private val ControversialFirst

    // For mods, to see flagged and unwanted things sorted first, and so be able to handle most
    // problems on a big page at once, without jumping back and forth to the mod task list.
    //private val ProblematicFirst

    // If one is following some people, then, boost their comments so they get shown first.
    // Each person then might see a slightly different page, depending of whom hen follows.
    // private val FriendsAndBestFirst

    // Like FriendsAndBestFirst but sort by Trending not by Best.
    // private val FriendsAndTrendingFirst

    case object BestFirst extends PostSortOrder(BestFirstNibble, false) with ComtOrderAtDepth
    case object NewestFirst extends PostSortOrder(NewestFirstNibble, true) with ComtOrderAtDepth
    case object OldestFirst extends PostSortOrder(OldestFirstNibble, true) with ComtOrderAtDepth

    case object NewestThenBest extends PostSortOrder(
      NewestFirstNibble + (BestFirstNibble << 4), true) {
      assert(IntVal == 18)  // 2 + 1 * 16
      override def atDepth(depth: i32): ComtOrderAtDepth =
        if (depth <= 1) NewestFirst
        else BestFirst
    }

    case object NewestThenOldest extends PostSortOrder(
      NewestFirstNibble + (OldestFirstNibble << 4), true) {
      assert(IntVal == 50)  // 2 + 3 * 16
      override def atDepth(depth: i32): ComtOrderAtDepth =
        if (depth <= 1) NewestFirst
        else OldestFirst
    }

    // Move to the default settings file insetad. [appsv_layout_defs]
    def DefaultForEmbComs: PostSortOrder = PostsOrderNesting.DefaultForEmbComs.sortOrder

    // Maybe: Random?
    // How would Random work, combined with performance and caching? Pick
    // a random post, keep at top for 1 minute, then a new, for the next
    // minute? and so on. So the page can be cached for a minute at least.
    // Or maybe max(1, 60 min / num-orig-post-replies)?
    // Or 100 different "cache slots" for 100 different random seeds?
    // Wait with this ... for quite a while (!).
    // — No, that's not good enough. Imagine a discussion with 60 top-level replies, which gets
    // submitted to say Reddit during busy hours. Then, 20 000 from Reddit go there, most of them
    // within 10 minutes, and most of them upvote the topmost comments. This means the comments
    // who happened to be at the top in the beginning, get many more upvotes, than the bad luck
    // comments who didn't by chance appear at the top until an hour later. Not good.
    // Instead, maybe this'll need to be ... Round robin "random"? Looks random to everyone,
    // whilst being fair, vote wise? But then, is another page_html_t column needed:
    // comt_order_c: post_nr[] specifying the top-level comment sort order?
    // Wait with Random.
    //
    // object Random extends PostsSortOrder(4)

    // These give new posts (and old posts further down) a chance to be seen,
    // rather than old upvoted post at the top getting most attention:
    // Also see [LIKESCORE].

    // No idea why, but this has to be a fn, because OldestFirst is otherwise null
    // — although it's a val defined *above*. The others (BestFirst etc) aren't null.
    def All: ImmSeq[PostSortOrder] = Vec(
          BestFirst, NewestFirst, OldestFirst, NewestThenBest, NewestThenOldest)

    def fromInt(value: Int): Option[PostSortOrder] = Some(value match {
      case BestFirst.IntVal => BestFirst
      case NewestFirst.IntVal => NewestFirst
      case OldestFirst.IntVal => OldestFirst
      case NewestThenBest.IntVal => NewestThenBest
      case NewestThenOldest.IntVal => NewestThenOldest
      case _ => return None
    })

    def fromOptVal(anyValue: Opt[i32]): Opt[PostSortOrder] = {
      if (anyValue is InheritNibble) None
      else anyValue flatMap fromInt
    }
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


  // ----- Vote types

  //type VoteTypesEnabled = hmm


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
    browserIdData: BrowserIdData,
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

  /**
    *
    * @param postId
    * @param postNr
    * @param postRevNr
    * @param pageId — the page where the post was posted, even if the post is moved
    *   elsewhere later.
    * @param pageType
    * @param pageAvailableAt
    * @param htmlToSpamCheck
    * @param language
    */
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
    * @param postToSpamCheck
    * @param reqrId — the pat who posted or edited the post to check. If posting anonymously,
    *   then this is the anonym, not the real user. See: [anons_and_mods].
    * @param pagePublishedAt — if the page got unpublished and re published, good to remember
    *   the publication date, as it was, when the maybe-spam-post was posted.
    * @param resultsAt — when all spam check services have replied, and we're saving their results.
    * @param resultsJson — there's a field and a results object, for each spam check service we queried.
    *   The field name is the domain name for the spam check service (e.g. akismet.com).
    *   Alternatively, could construct new database tables for this, but json = simpler,
    *   and seems rather uninteresting to reference the results via foreign keys or anything.
    * @param resultsText — human readable spam check results description.
    * @param humanSaysIsSpam — updated once staff has reviewed.
    * @param misclassificationsReportedAt — if the spam check service thought something was spam
    *   when it wasn't, or vice versa, this is the time when this misclassification was
    *   reported to the spam check service, so it can learn and improve.
    */
  case class SpamCheckTask(
    createdAt: When,
    siteId: SiteId,
    postToSpamCheck: Option[PostToSpamCheck],
    reqrId: PatId,
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

    def taskKey: SpamCheckTask.Key =
      postToSpamCheck match {
        case None => Right(siteUserId)
        case Some(p) => Left((siteId, p.postId, p.postRevNr))
      }

    def postToSpamCheckShort: Option[PostToSpamCheck] =
      postToSpamCheck map { p =>
        p.copy(htmlToSpamCheck = p.htmlToSpamCheck.take(600))
      }

    def siteUserId: SiteUserId = SiteUserId(siteId, reqrId)

    def sitePostIdRevOrUser: String = s"s$siteId, " + (postToSpamCheck match {
      case Some(thePostToSpamCheck) =>
        s"post ${thePostToSpamCheck.postId} rev nr ${thePostToSpamCheck.postRevNr}"
      case None =>
        s"user ${reqrId} request stuff $requestStuff"
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


  type TourTipsId = String   // [Scala_3] opaque type
  type TourTipsSeen = immutable.Seq[TourTipsId]

  def anyTourTipsIdError(id: TourTipsId): Option[ErrorMessageCode] = {
    // Better require ids to be variable names, to avoid any surprises later.
    // The ids are incl in each user info response, so should be short, like 2 or 3 chars.
    // Maybe later there'll be plugins with their own tours? It'd be good if they can have
    // longer names, so there won't be name clashes.
    // Update: Let's allow alnum (but not only num), because the admin tips,
    // .s_AdmTps, are alnum.
    val MaxLength = 30
    def EMC = ErrorMessageCode
    Some(
      if (id.isEmpty) EMC("TyE4ABKR0", "Bad tour or tips id: Empty string")
      //else if (!id.isOkVariableName) EMC("TyE4ABKR2", s"Bad tour or tips id: `$id'")
      else if (!id.isAlNumWithAl) EMC("TyE4ABKR2", s"Bad tour or tips id: `$id'")
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
    userId: Opt[UserId],
    createdAt: When,
    deletedAt: Opt[When],
    isDeleted: Bo,
    secretKey: St,
    // Later:
    // capabilities: Seq[ApiSecretCapability]  ?
    ) {

    require(!isDeleted || deletedAt.isDefined, "TyE4ABKR01")
    require(deletedAt.isEmpty || createdAt.millis <= deletedAt.get.millis, "TyE4ABKR02")
    require(userId.forall(id => id == SysbotUserId || id >= LowestTalkToMemberId), "TyE5ABKR02")
  }

  // Later:  enum ApiSecretCapability {    [api_secr_type]
  //   PostPages, PostComments, PlanMaintenance, ...
  // }


  def ifThenSome[A](condition: Boolean, value: A): Option[A] =
    if (condition) Some(value) else None


  def isBlank(char: Char): Boolean = char <= ' '


  /** Tests if is valid non local address, and that Apache Commons Email accepts it.
    *
    * The returned error message does *not* need to be prefixed with "Invalid email address: ".
    *
    * Dupl code. [email_adrs_checks]
    */
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
        val exNameAndMsg = ex.getMessage
        // This drops "java.package.ExceptionName: ". (If using `getRootCause(ex).getMessage`,
        // the message is less detailed.)
        val message =
              if (!exNameAndMsg.contains(':')) exNameAndMsg
              else exNameAndMsg.dropWhile(_ != ':').drop(2)
        return Some(s"Invalid email address: $message")
    }

    // (Move deprecated [email_adrs_checks] to here, to get a better err msg?)
    val seemsValid = EmailValidator.getInstance(/* allowLocal = */ false).isValid(address)
    if (!seemsValid)
      return Some("Invalid email address")

    // The database doesn't allow uppercase (e.g.: `select email_seems_ok('A@ex.co');`).
    if (address.toLowerCase != address)
      return Some("Invalid (unsupported) email address — it contains uppercase characters")

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
    def getOrIfFailure(fn: Exception => Nothing): T = underlying match {
      case Failure(ex: Exception) if ex.isInstanceOf[Exception] => fn(ex)
      case Failure(t: Throwable) => throw t
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
    def toZeroOne: i32 = if (underlying) 1 else 0
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
  def STALE_DOCS = ()
  def SHOULD_CODE_REVIEW = ()
  def CR_DONE = ()
  def FASTER_E2E_TESTS = () // An opportunity to speed up the e2e tests (maybe just marginally)
  def FLAKY = ()          // If an e2e test has races, can fail (ought to fix ... well ... later)

  def UNIMPL = ()
  def ANON_UNIMPL = ()

  // Maybe split into [defense] and [weakness]?
  // [defense] code tags are good — means security issues that have been dealt with.
  // [weakness] means an issues not yet handled, might lead to a 'vulnerability'
  // that an attacker / 'threat actor' can 'exploit'.
  def SECURITY = ()       // Some security issue, not necessarily so very important
  def CSP_MISSING = ()    // Content-Security-Policy missing on this page / route
  def SLEEPING = ()       // Not urgent, doesn't matter currently (or barely matters).
                          // But if there're changes, so this start mattering, then
                          // it might be minor, might be major.

  def SELF_DOS = ()
  def ASTROTURFING = ()   // Someone creates many accounts and pretends to be many people
  def PRIVACY = ()        // Could make things a bit more private
  def SITE_PRIVACY = ()   // Not related to any single person, but the Ty site as a whole, e.g.
                          // sequential numbers that make it possible to estimate frequency.
  def BUG = ()            // Need not be a terribly important bug.
  def RACE = ()           // A race condition bug / situation.
  def STARVATION = ()
  def MUST = ()           // Fix before next release.
  def SHOULD = ()         // Fix before release, unless short of time, or it's too boring.
  def COULD = ()          // Could do this, but not important right now, can wait a year or two.
  def ANNOYING = ()       // Something annoying that would be good to fix, not important though
  def INFO_LOG = ()       // Somehow change log message severity to Info only.
  def ADMIN_LOG = ()      // Info log for site admins — e.g. custom OIDC conf problems.
  def NOTIFY_ADMINS = ()
  @deprecated
  def SHOULD_LOG_STH = ()
  def SHOULD_LOG = ()     // If an info/debug message ought to be logged here.
  @deprecated
  def COULD_LOG_STH = ()
  def COULD_LOG = ()      // Could log sth, but less important.
  def AUDIT_LOG = ()      // Should add audit log entry
  def REFACTOR = ()       // The code can be refactored. Also search for "[refactor]".
  def RENAME = ()         // Something ought to be renamed.
  def MOVE = ()           // Move something elsewhere
  def QUICK = ()          // Let's do now soon — won't take long.
  def OPTIMIZE = ()
  def SLOW_QUERY = ()
  def SHOULD_OPTIMIZE = ()
  def COULD_OPTIMIZE = () // Also see [On2] or [OnLogn] but typically that's intentional (because simpler).
  def COULD_OPTIMIZE_TESTS = () // Less important
  def WOULD_OPTIMIZE = () // Unimportant thing that could be optimized.
  def BLOCKING_REQ = ()
  def EDIT_INDEX = ()     // Database index could be simplified. Or investigate if it's getting used?
  def AVOID_RERENDER = ()
  def SMALLER_BUNDLE = ()
  def SAVE_BANDWIDTH = ()
  def ANTI_REACT = ()     // Things done in weird ways from React.js point of view
  def FORCED_REFLOW = ()  // Browser side only. Makes it slow.
  def COULD_FREE_MEM = () // Browser side, can set null sth to free mem, but then maybe harder to debug.
  def UX = ()             // Usability can be improved.
  def RESPONSIVE = ()     // Would look better with responsive layout. Browser side only.
  def DB_CONFICT = ()     // When the same db rows might be updated by different transaction,
                          // causing deadlocks / rollbacks / delays.
  def HACK = ()           // Quick crazy fix, probably should be redone later in a better way.
  def DELETE_LATER = ()   // ... hmm. Rename to CLEANUP.
  def DO_AFTER = ()       // Sth that should be done after (not before) a certain date.
  def REMINDER = ()       // Sth to get reminded about at (or after) a certain date.
  def FIX_AFTER = ()      // Bug to fix after a certain date.
  def REMOVE = ()
  def REMOVE_AFTER = ()
  def CLEAN_UP = ()       // Unused stuff that should be deleted after a grace period, or when
                          // the developers are less short of time.
  def USE_StaleStuff_INSTEAD = ()
  def DEPRECATED = ()     // Consider removing some time later
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
  def CHECK_AUTHN_STRENGTH = ()
}

