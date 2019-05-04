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

import com.google.{common => guava}
import java.net.InetAddress
import java.{net => jn, util => ju}
import org.scalactic.{ErrorMessage, Or}
import scala.collection.{immutable, mutable}
import EmailNotfPrefs.EmailNotfPrefs
import Prelude._
import Participant._
import java.text.Normalizer
import java.util.Date
import play.api.libs.json.JsObject



sealed abstract class Presence(val IntVal: Int) { def toInt: Int = IntVal }
object Presence {
  case object Active extends Presence(1)
  case object Away extends Presence(2)
}


/** An invite to the user with the specified emailAddress to join the site.
  * S/he gets an email and clicks a link to join.
  */
case class Invite(   // [exp] ok use
  emailAddress: String,
  secretKey: String,
  createdById: UserId,
  createdAt: ju.Date,
  acceptedAt: Option[ju.Date],
  userId: Option[UserId],
  deletedAt: Option[ju.Date],
  deletedById: Option[UserId],
  invalidatedAt: Option[ju.Date]) {

  require(secretKey.length > 15, "Unsafe key? [DwE7KFPE2]")
  require(emailAddress contains "@", "DwE64KSU8")
  require(emailAddress.split("@").head.nonEmpty, "DwE09FKI2")
  require(acceptedAt.isEmpty == userId.isEmpty, "DwE8KE94")
  require(deletedAt.isEmpty == deletedById.isEmpty, "DwE4KSP3")
  require(invalidatedAt.oneIfDefined + deletedAt.oneIfDefined + acceptedAt.oneIfDefined <= 1, "DwE5WKJ2")
  require(deletedAt.isEmpty || deletedAt.get.getTime >= createdAt.getTime, "DwE6PK2")
  require(invalidatedAt.isEmpty || invalidatedAt.get.getTime >= createdAt.getTime, "DwE8UY0")

  def canBeOrHasBeenAccepted: Boolean = invalidatedAt.isEmpty && deletedAt.isEmpty

  COULD; REFACTOR // createdAt to ... what? and createdWhen to createdAt. Or change datatype.
  def createdWhen: When = When.fromDate(createdAt)

  def makeUser(userId: UserId, username: String, currentTime: ju.Date) = UserInclDetails(
    id = userId,
    externalId = None,
    fullName = None,
    username = username,
    createdAt = When.fromDate(currentTime),
    isApproved = None,
    reviewedAt = None,
    reviewedById = None,
    primaryEmailAddress = emailAddress,
    emailNotfPrefs = EmailNotfPrefs.Receive,
    emailVerifiedAt = Some(currentTime))
}


object Invite {
  def apply(emailAddress: String, secretKey: String,
        createdById: UserId, createdAt: ju.Date): Invite = Invite(
    emailAddress = emailAddress,
    secretKey = secretKey,
    createdById = createdById,
    createdAt = createdAt,
    userId = None,
    acceptedAt = None,
    deletedAt = None,
    deletedById = None,
    invalidatedAt = None)
}


// Rename to NewMemberDataWithSocialIdentity?
sealed abstract class NewUserData {
  def name: Option[String]
  def username: String
  def email: String
  def emailVerifiedAt: Option[ju.Date]
  def isAdmin: Boolean
  def isOwner: Boolean

  def makeUser(userId: UserId, createdAt: ju.Date) = UserInclDetails(
    id = userId,
    externalId = None,
    fullName = name,
    username = username,
    createdAt = When.fromDate(createdAt),
    isApproved = None,
    reviewedAt = None,
    reviewedById = None,
    primaryEmailAddress = email,
    emailNotfPrefs = EmailNotfPrefs.Receive,
    emailVerifiedAt = emailVerifiedAt,
    isAdmin = isAdmin,
    isOwner = isOwner)

  def makeIdentity(userId: UserId, identityId: IdentityId): Identity

  dieIfBad(Validation.checkName(name), "TyE5WKBA7EW", identity)
  dieIfBad(Validation.checkUsername(username), "TyE2AKB6W", identity)
  dieIfBad(Validation.checkEmail(email), "TyE2WKBPE7", identity)

}


// RENAME to NewMemberDataWithPasswordOrExtId
case class NewPasswordUserData(
  name: Option[String],
  username: String,
  email: String,
  password: Option[String],
  externalId: Option[String],
  createdAt: When,
  firstSeenAt: Option[When],
  isAdmin: Boolean,
  isOwner: Boolean,
  isModerator: Boolean = false,
  emailVerifiedAt: Option[When] = None,
  trustLevel: TrustLevel = TrustLevel.NewMember,
  threatLevel: ThreatLevel = ThreatLevel.HopefullySafe) {

  val passwordHash: Option[String] =
    password.map(DbDao.saltAndHashPassword)

  def makeUser(userId: UserId) = UserInclDetails(
    id = userId,
    externalId = externalId,
    fullName = name,
    username = username,
    createdAt = createdAt,
    isApproved = None,
    reviewedAt = None,
    reviewedById = None,
    primaryEmailAddress = email,
    emailNotfPrefs = EmailNotfPrefs.Receive,
    emailVerifiedAt = emailVerifiedAt.map(_.toJavaDate),
    passwordHash = passwordHash,
    isOwner = isOwner,
    isAdmin = isAdmin,
    isModerator = isModerator,
    trustLevel = trustLevel,
    threatLevel = threatLevel)

  dieIfBad(Validation.checkName(name), "TyE6KWB2A1", identity)
  dieIfBad(Validation.checkUsername(username), "TyE5FKA2K0", identity)
  dieIfBad(Validation.checkEmail(email), "TyE4WKBJ7Z", identity)
  // Password: See security.throwErrorIfPasswordTooWeak, instead.

  require(externalId.isDefined != password.isDefined, "TyE5VAKBR02")
  require(!firstSeenAt.exists(_.isBefore(createdAt)), "TyE2WVKF063")
}


object NewPasswordUserData {
  def create(
        name: Option[String], username: String, email: String,
        password: Option[String] = None,
        externalId: Option[String] = None,
        createdAt: When,
        isAdmin: Boolean, isOwner: Boolean, isModerator: Boolean = false,
        emailVerifiedAt: Option[When] = None,
        trustLevel: TrustLevel = TrustLevel.NewMember,
        threatLevel: ThreatLevel = ThreatLevel.HopefullySafe): NewPasswordUserData Or ErrorMessage = {
    for {
      okName <- Validation.checkName(name)
      okUsername <- Validation.checkUsername(username)
      okEmail <- Validation.checkEmail(email)
      // Password: See security.throwErrorIfPasswordTooWeak, instead.
    }
    yield {
      NewPasswordUserData(name = okName, username = okUsername, email = okEmail,
        password = password, externalId = externalId, createdAt = createdAt,
        firstSeenAt = Some(createdAt),  // for now
        isAdmin = isAdmin, isOwner = isOwner, isModerator = isModerator,
        emailVerifiedAt = emailVerifiedAt,
        trustLevel, threatLevel)
    }
  }
}



case class NewOauthUserData(
  name: Option[String],
  username: String,
  email: String,
  emailVerifiedAt: Option[ju.Date],
  identityData: OpenAuthDetails,
  isAdmin: Boolean,
  isOwner: Boolean,
  trustLevel: TrustLevel = TrustLevel.NewMember,
  threatLevel: ThreatLevel = ThreatLevel.HopefullySafe) extends NewUserData {

  def makeIdentity(userId: UserId, identityId: IdentityId): Identity =
    OpenAuthIdentity(id = identityId, userId = userId, openAuthDetails = identityData)
}


object NewOauthUserData {
  def create(name: Option[String], email: String, emailVerifiedAt: Option[ju.Date], username: String,
        identityData: OpenAuthDetails, isAdmin: Boolean, isOwner: Boolean,
        trustLevel: TrustLevel = TrustLevel.NewMember,
        threatLevel: ThreatLevel = ThreatLevel.HopefullySafe)
        : NewOauthUserData Or ErrorMessage = {
    for {
      okName <- Validation.checkName(name)
      okUsername <- Validation.checkUsername(username)
      okEmail <- Validation.checkEmail(email)
    }
    yield {
      NewOauthUserData(name = okName, username = okUsername, email = okEmail,
        emailVerifiedAt = emailVerifiedAt, identityData = identityData,
        isAdmin = isAdmin, isOwner = isOwner, trustLevel = trustLevel,
        threatLevel = threatLevel)
    }
  }
}



case class NameAndUsername(id: UserId, fullName: String, username: String)



case object Participant {

  /** Used when things are inserted or updated automatically in the database. */
  val SystemUserId = 1
  val SystemUserUsername = "system"
  val SystemUserFullName = "System"

  /** Like system, but does things via API requests, which the System user never does.
    * Nice to know if something was done because of an API request (the Sysbot user),
    * or because of Talkyard's own source code (the System user) — also if the audit log
    * has been emptied.
    */
  val SysbotUserId = 2
  val SysbotUserUsername = "sysbot"
  val SysbotUserFullName = "Sysbot"

  /** If a superadmin logs in and does something.  COULD start using, instead of System? [SYS0LGI] */
  val SuperAdminId = 3  // no, 4? or 49?  see below

  /** Maintenance tasks by bot(s) that supervise all sites. */
  // val SuperbotId = 4  ?

  // ? rename SuperX to Global Read/Action X,
  // Hmm these would be useful, for site staff to View As ...
  // and assign ids 20...29 to GlobalReadStranger, GlobalReadNewMember,  (can only read)
  // GlobalReadBasicMember, ..., GlobalReadCoreMember, GlobalReadModerator,
  // and assign ids 30...39 to GlobalHideStranger, ... GlobalHideAdmin?  (can delete/hide things)
  // and assign ids 40...49 to ... GlobalActionAdmin?  (can do anything, incl edit site settings)
  // and reassign group ids 10...19  to maybe 50..59?  Then LowestNormalMemberId below would be 50.
  // 60...68 could be ViewAsStranger, ViewAsNewMember, ... ViewAsCoreMember, ViewAsModerator?
  // Or  ViewAsStranger/NewMember/... = 20,21 ... 29, + caps=ViewOnly/Delete/Purge/Edit/EditSettings?

  // val SuperPrivMod = 5 ?
  // val SuperPupbMod = 6 ?

  // ?? If a member chooses to post anonymously:
  // val AnonymousUserId = 7

  // The real ids of deactivated and deleted users, could be replaced with these ids, when rendering
  // pages, so others won't find the real ids of the deactivated/deleted accounts.
  // val DeactivatedUserId = 8
  // val DeletedUserId = 9
  // or just: DeactivatedOrDeletedUserId = 9 ?

  // Can talk with, and can listen to notifications. But 1..9 = special. And -X = guests.
  val LowestNormalMemberId: Int = Group.EveryoneId  // [S7KPWG42]

  /** Cannot talk with members with lower ids (System, SuperAdmin, Deactivated, Deleted users). */
  val LowestTalkToMemberId: Int = Group.EveryoneId  // or 9, same as anonymous users?
  assert(LowestTalkToMemberId == 10)

  // ?? val UnknownBotId = -2  // bots that accesses any public api endpoints, no api secret


  /** A user that did something, e.g. voted on a comment, but was not logged in. */
  val UnknownUserId: UserId = -3
  val UnknownUserName = "Unknown"
  val UnknownUserBrowserId = "UU"

  /** Guests with custom name and email, but not guests with magic ids like the Unknown user. */
  // Change to <= -1001?  [UID1001]
  val MaxCustomGuestId: UserId = -10

  val MaxGuestId: UserId = -1
  //assert(MaxGuestId == AnonymousUserId)
  assert(UnknownUserId.toInt <= MaxGuestId)

  /** Ids 1 .. 99 are reserved in case in the future I want to combine users and groups,
    * and then there'll be a few groups with hardcoded ids in the range 1..99.
    */
  val LowestAuthenticatedUserId = 100   // also in js  [8PWK1Q2W]   Change to 1001?  [UID1001]

  val LowestMemberId: UserId = SystemUserId
  val LowestNonGuestId = 1  // CLEAN_UP RENAME to LowestMemberId?
  assert(LowestNonGuestId == SystemUserId)

  def isGuestId(userId: UserId): Boolean =
    userId <= MaxGuestId

  def isRoleId(userId: UserId): Boolean =
    !isGuestId(userId)

  def isMember(userId: UserId): Boolean = userId >= LowestMemberId

  def isOkayUserId(id: UserId): Boolean =
    id >= LowestAuthenticatedUserId ||
      id <= MaxCustomGuestId ||
      isBuiltInPerson(id)

  def isBuiltInPerson(id: UserId): Boolean =
      id == SystemUserId ||
      id == SysbotUserId ||
      //id == SuperAdminId ||     later
      //id == SuperbotId ||       later
      //id == AnonymousUserId ||  later
      id == UnknownUserId

  def isBuiltInGroup(id: UserId): Boolean =
    Group.NewMembersId <= id && id <= Group.AdminsId

  def isOkayGuestId(id: UserId): Boolean =
    id == UnknownUserId || id <= MaxCustomGuestId

  val MinUsernameLength = 3  // must be < 9, search for usages to see why
  val MaxUsernameLength = 20 // sync with tests [6AKBR20Q]


  /**
   * Checks for weird ASCII chars in an user name.
   *
   * Cannot be used with names from identity providers, e.g. OpenID
   * or Twitter: the providers do their own user name sanity checks,
   * and we should handle anything they accept?
   */
  def nameIsWeird(name: String): Boolean = {
    // Could check for weird Unicode whitespace too, but that will
    // probably be implicitly solved, when handling spam? ASCII,
    // however, could mess up the internals of something, because
    // sometimes the system assigns magic meanings to ASCII chars
    // that only an attacker would use?
    for (c <- name if c < 0x80) {
      if (c < ' ') return true  // control chars
      if (c < '0' && !(" '-." contains c)) return true  // punctuation
      if (c > '9' && c < 'A') return true  // more punctuation
      if (c > 'Z' && c < 'a') return true  // even more punctuation
      if (c > 'z' && c <= 127) return true  // punctuation
    }
    false
  }


  /**
   * Checks for weird ASCII chars in an email,
   * and that it matches """.+@.+\..+""".
   */
  def emailIsWeird(email: String): Boolean = {
    // Differences from nameIsOk(): allow "@_", disallows "'".
    for (c <- email if c < 0x80) {
      if (c <= ' ') return true  // forbid control chars and space
      if (c < '0' && !(" -." contains c)) return true  // punctuation
      if (c > '9' && c < '@') return true  // email, so '@' ok
      if (c > 'Z' && c < 'a' && !"_".contains(c)) return true  // punctuation
      if (c > 'z' && c <= 127) return true  // punctuation
    }
    if (isEmailLocalPartHidden(email)) {
      return true
    }
    if (email matches """.+@.+\..+""") return false
    true
  }


  def isOkayGuestBrowserdId(anyValue: Option[String]): Boolean = anyValue match {
    case None => false
    case Some(value) => value.nonEmpty && value.trim == value
  }


  def isSuspendedAt(now: ju.Date, suspendedTill: Option[ju.Date]): Boolean =
    suspendedTill.exists(now.getTime <= _.getTime)


  //def makeUsernameCanonical(username: String): String =  // [CANONUN]
  //  username.toLowerCase.replaceAll("[_.+-]+", "_").replaceAll("[^a-z0-9_]", "")

  // The two first – and — are: en and em dashes.
  // Incl '_' so '____' gets replaced with '_'.
  private val ReplSpecialsWithUnderscoreRegex =
    "[\t\n\r_~/–,—\\\\ +.-]+".r

  private val ReplSpecialsWithUnderscoreKeepDotDashRegex =
    "[\t\n\r_~/–,—\\\\ +]+".r

  private val TwoOrMoreSymbolsRegex =
    "[^a-zA-Z0-9]{2,}".r

  /** Comes up with a username that contains only valid characters, and is not already in use.
    * Does things like pads with numbers if too short, and, if already taken, appends
    * numbers to make it unique. And changes åäö to aao and replaces Unicode
    * like Chinese and Arabic characters with 'zzz' — allowing Unicode usernames = dangerous,
    * would make homoglyph/homograph attacks possible (pretending to be someone else, like,
    * user 'tové' pretends to be 'tove').
    */
  def makeOkayUsername(somethingMaybeWeird: String, allowDotDash: Boolean,
        isUsernameInUse: String => Boolean): Option[String] = {

    if (somethingMaybeWeird.isEmpty)
      return None

    // 1. Remove diacritics.
    // Changes e.g. éåä to eaa. Example:
    // From: "Tĥïŝ ĩš â fůňķŷ Šťŕĭńġ 2dot..2dash--2underscore__ arabic:العربية chinese:汉语 漢語 !?#+,*"
    // To: "This is a funky String 2dot..2dash--2underscore__ arabic:العربية chinese:汉语 漢語 !?#+,*"
    val usernameNoDiacritics =
      Normalizer.normalize(somethingMaybeWeird, Normalizer.Form.NFD)
        .replaceAll("\\p{InCombiningDiacriticalMarks}+", "")

    // 2. Replace Unicode (non-ASCII) chars with 'z'.
    // People will better notice that some chars couldn't be represented in ASCII, if they're
    // replaced with something instead of just removed? Let's pick 'z' ('zz...' is better than 'xx..').
    // Then the above example string becomes:
    //  "This is a funky String 2dot..2dash--2underscore__ arabic:zzzzzzz chinese:zz zz !?#+,*"
    val usernameAscii = usernameNoDiacritics.replaceAll("[^\\p{ASCII}]", "z")

    val replWithUnderscoreRegex = allowDotDash ?
      ReplSpecialsWithUnderscoreKeepDotDashRegex | ReplSpecialsWithUnderscoreRegex

    import com.debiki.core.Validation.UsernameBadCharsRegex

    // Replace punctuation with '_'. [UNPUNCT]
    // The example string becomes: (note: drops trailing '_')
    //  "This_is_a_funky_String_2dot_2dash_2underscore_arabiczzzzzzz_chinesezz_zz"
    var usernameOkCharsNotTrimmed =
      UsernameBadCharsRegex.replaceAllIn(
        replWithUnderscoreRegex.replaceAllIn(
          usernameAscii, "_"), "")

    if (allowDotDash) {
      // Then maybe many in a row. Replace w underscore.
      usernameOkCharsNotTrimmed =
        TwoOrMoreSymbolsRegex.replaceAllIn(usernameOkCharsNotTrimmed, "_")
    }

    // Later, allow starting with '_', and change here too: [ALWUNDS1]
    val usernameOkChars = usernameOkCharsNotTrimmed
      .dropWhile(!charIsAzOrNum(_))      // drops anything but  a-z  A-Z  0-9, for now. [UNPUNCT]
      .dropRightWhile(!charIsAzOrNum(_)) //

    // For now, don't allow numeric usernames. That wouldn't be a name would it?
    // Maybe if someone chooses hens name to be '2010' or '1945', people will believe it's
    // a date instead? Not good for usability? Let's prefix 'n', could mean "numeric name".
    val usernameNotOnlyDigits =
      if (usernameOkChars.forall(charIsNum)) 'n' + usernameOkChars
      else usernameOkChars

    var usernameOkCharsLen =
      (if (usernameNotOnlyDigits.length >= Participant.MinUsernameLength) usernameNotOnlyDigits
      else (usernameNotOnlyDigits + "23456789") take Participant.MinUsernameLength) take Participant.MaxUsernameLength


    // Not a file extension suffix? like .png or .jpg or .js?  Tested here: [5WKAJH20]
    if (allowDotDash) {
      val tika = new org.apache.tika.Tika()
      val mimeType: String = tika.detect(usernameOkCharsLen)
      // Tika doesn't detect ".woff", weird? Maybe remove in Tika 1.9? [5AKR20]
      if (mimeType != "application/octet-stream" || usernameOkCharsLen.endsWith(".woff")) {
        // Then replace all dots with underscore.
        usernameOkCharsLen = ReplSpecialsWithUnderscoreRegex.replaceAllIn(usernameOkCharsLen, "_")
      }
    }

    var nextToTry = usernameOkCharsLen
    val numCharsFree = Participant.MaxUsernameLength - usernameOkCharsLen.length

    // `until` means up to length - 1 — so won't drop all chars here: (5WKBA2)
    for (i <- 1 until Participant.MaxUsernameLength) {
      val isInUse = isUsernameInUse(nextToTry)
      if (!isInUse)
        return Some(nextToTry)

      // Append i random numbers to make the username unique. Repeat with i, i+1, i+2 chars,
      // until we find one. However, what if usernameOkCharsLen is already almost max-chars long?
      // Then remove chars at the end, repl with random numbers, until we find something unique.
      val wantsNumRandom = i
      val baseName =
        if (wantsNumRandom <= numCharsFree) usernameOkCharsLen
        else {
          val numMissing = wantsNumRandom - numCharsFree
          val usernameShorter = usernameOkCharsLen dropRight numMissing  // (5WKBA2)
          dieIf(usernameShorter.isEmpty, "TyE5KAW20")
          usernameShorter
        }
      nextToTry = baseName + nextRandomLong().toString.take(wantsNumRandom)
    }

    None
  }
}


// Try to remove all fields unique for only Member and only Guest.
// Participant = Guest or Member
// Member = User Or Group
// trait Someone = Guest or User  = just 1 person (or bot), not a group.
// Abbreviate 'ppts' and 'ppt' in db constr names.
sealed trait Participant {

  def id: UserId
  def email: String  // COULD rename to emailAddr
  def emailNotfPrefs: EmailNotfPrefs
  def tinyAvatar: Option[UploadRef]
  def smallAvatar: Option[UploadRef]
  def suspendedTill: Option[ju.Date]
  def isAdmin: Boolean
  def isOwner: Boolean
  def isModerator: Boolean
  def isSuperAdmin: Boolean
  def isDeactivated: Boolean = false
  def isDeleted: Boolean = false

  def isAuthenticated: Boolean = isRoleId(id)
  def isApprovedOrStaff: Boolean = false
  def isSystemUser: Boolean = id == SystemUserId
  def isStaff: Boolean = isAdmin || isModerator || isSystemUser
  def isHuman: Boolean = id >= LowestTalkToMemberId || id <= MaxGuestId
  def isBuiltIn: Boolean = Participant.isBuiltInPerson(id) || Participant.isBuiltInGroup(id)
  def isGone: Boolean = isDeactivated || isDeleted

  def isStaffOrCoreMember: Boolean =
    isStaff || effectiveTrustLevel.toInt >= TrustLevel.CoreMember.toInt

  def isStaffOrTrusted: Boolean =
    isStaff || effectiveTrustLevel.toInt >= TrustLevel.TrustedMember.toInt

  def isStaffOrFullMember: Boolean =
    isStaff || effectiveTrustLevel.toInt >= TrustLevel.FullMember.toInt

  /** Guests have no trust level, so default = false */
  def isStaffOrMinTrustNotThreat(trustLevel: TrustLevel) = false

  def isMember: Boolean = Participant.isMember(id)
  def isGuest: Boolean = Participant.isGuestId(id)
  def isGroup: Boolean = false
  def anyMemberId: Option[RoleId] = if (isRoleId(id)) Some(id) else None

  def isSuspendedAt(when: ju.Date): Boolean =
    Participant.isSuspendedAt(when, suspendedTill = suspendedTill)

  def effectiveTrustLevel: TrustLevel
  def canPromoteToBasicMember: Boolean = false
  def canPromoteToFullMember: Boolean = false

  /** A member's full name, or guest's guest name. */
  def anyName: Option[String] = None

  /** Only for members, not guests. */
  def anyUsername: Option[String] = None

  def usernameOrGuestName: String
  def usernameSpaceOtherName: String = (anyUsername.getOrElse("") + " " + anyName.getOrElse("")).trim
  def nameOrUsername: String

  def idSpaceName: String =
    anyUsername.map(un => s"$id @$un") getOrElse s"$id '$usernameOrGuestName'"

  def toUserOrThrow: User = {
    this match {
      case m: User => m
      case g: Guest => throw GotAGuestException(g.id)
      case g: Group => throw GotAGroupException(g.id)
      case UnknownParticipant => throw GotUnknownUserException
    }
  }
}


trait Member extends Participant {
  def theUsername: String
  //def fullName: String
}


/**
  *
  * @param id
  * @param fullName
  * @param theUsername
  * @param email
  * @param emailNotfPrefs
  * @param emailVerifiedAt when the user's first primary email address was verified.
  *   If hen changes hens primary address, this field won't change, and,
  *   one may not change to a not-verified address. [7GUKRWJ]
  * @param passwordHash
  * @param tinyAvatar
  * @param smallAvatar
  * @param isApproved
  * @param suspendedTill
  * @param trustLevel
  * @param lockedTrustLevel
  * @param threatLevel
  * @param lockedThreatLevel
  * @param isAdmin
  * @param isOwner
  * @param isModerator
  * @param isSuperAdmin
  * @param isDeactivated
  * @param isDeleted
  */
case class User(
  id: UserId,
  fullName: Option[String],
  theUsername: String,
  email: String,  // COULD RENAME to primaryEmailAddress
  emailNotfPrefs: EmailNotfPrefs,
  emailVerifiedAt: Option[ju.Date] = None,
  passwordHash: Option[String] = None,  // OPTIMIZE no need to always load? Move to MemberInclDetails?
  tinyAvatar: Option[UploadRef] = None,
  smallAvatar: Option[UploadRef] = None,
  isApproved: Option[Boolean],
  suspendedTill: Option[ju.Date],
  trustLevel: TrustLevel = TrustLevel.NewMember,
  lockedTrustLevel: Option[TrustLevel] = None,
  threatLevel: ThreatLevel = ThreatLevel.HopefullySafe,
  lockedThreatLevel: Option[ThreatLevel] = None,
  isAdmin: Boolean = false,
  isOwner: Boolean = false,
  isModerator: Boolean = false,
  isSuperAdmin: Boolean = false,
  override val isDeactivated: Boolean = false,
  override val isDeleted: Boolean = false) extends Member with MemberMaybeDetails {

  def primaryEmailAddress: String = email

  override def anyName: Option[String] = fullName
  override def anyUsername: Option[String] = username
  def username: Option[String] = Some(theUsername)
  def usernameOrGuestName: String = theUsername
  def usernameHashId: String = s"@$username#$id"
  def nameOrUsername: String = fullName getOrElse theUsername

  def usernameParensFullName: String = fullName match {
    case Some(name) => s"$theUsername ($name)"
    case None => theUsername
  }

  def effectiveTrustLevel: TrustLevel = lockedTrustLevel getOrElse trustLevel
  def effectiveThreatLevel: ThreatLevel = lockedThreatLevel getOrElse threatLevel

  override def isApprovedOrStaff: Boolean = isApproved.contains(true) || isStaff

  override def isStaffOrMinTrustNotThreat(trustLevel: TrustLevel): Boolean =  // dupl code [5WKABY0]
    isStaff || (
      effectiveTrustLevel.toInt >= trustLevel.toInt && !effectiveThreatLevel.isThreat)

  override def canPromoteToBasicMember: Boolean =
    // If trust level locked, promoting the this.trustLevel has no effect — but we'll still
    // do it, so we know what it would have been, had it not been locked.
    trustLevel == TrustLevel.NewMember

  override def canPromoteToFullMember: Boolean =
    trustLevel == TrustLevel.BasicMember

  require(!fullName.map(_.trim).contains(""), "DwE4GUK28")
  require(Participant.isOkayUserId(id), "DwE02k12R5")
  require(theUsername.length >= 2, "EsE7YKW3")
  require(!isEmailLocalPartHidden(email), "DwE6kJ23")
  require(tinyAvatar.isDefined == smallAvatar.isDefined, "EdE5YPU2")
}


trait MemberMaybeDetails {
  def usernameHashId: String
  def primaryEmailAddress: String
}


case class ExternalUser(   // sync with test code [7KBA24Y]
  externalId: String,
  primaryEmailAddress: String,
  isEmailAddressVerified: Boolean,
  username: Option[String],
  fullName: Option[String],
  avatarUrl: Option[String],
  aboutUser: Option[String],
  isAdmin: Boolean,
  isModerator: Boolean) {

  require(externalId.isTrimmedNonEmpty, "TyE5KBW01")
  Validation.checkEmail(primaryEmailAddress).badMap(errorMessage =>
    die("TyE5KBW02", s"Bad email: $primaryEmailAddress, for external user id: '$externalId'"))
  require(username.forall(_.isTrimmedNonEmpty), "TyE5KBW05")
  require(fullName.forall(_.isTrimmedNonEmpty), "TyE5KBW06")
  require(avatarUrl.forall(_.isTrimmedNonEmpty), "TyE5KBW07")
}


/** (Could split into Guest and GuestInclDetails, where emailAddress and createdAt are
  * the details. But no particular reason to do this — would maybe just add more code,
  * for no good reason.)
  */
case class Guest(   // [exp] ok
  id: UserId,
  createdAt: When,
  guestName: String,
  guestBrowserId: Option[String],
  email: String,  // COULD rename to emailAddr
  emailNotfPrefs: EmailNotfPrefs,
  country: Option[String] = None,  // COULD rename to Location
  lockedThreatLevel: Option[ThreatLevel] = None) extends Participant with ParticipantInclDetails {

  def emailVerifiedAt: Option[ju.Date] = None
  def passwordHash: Option[String] = None
  def tinyAvatar: Option[UploadRef] = None
  def smallAvatar: Option[UploadRef] = None
  def isApproved: Option[Boolean] = None
  def isAdmin: Boolean = false
  def isOwner: Boolean = false
  def isModerator: Boolean = false
  def isSuperAdmin: Boolean = false
  override def isBuiltIn: Boolean = super.isBuiltIn
  def suspendedTill: Option[ju.Date] = None
  def effectiveTrustLevel: TrustLevel = TrustLevel.NewMember

  override def anyName = Some(guestName)
  def usernameOrGuestName: String = guestName
  def nameOrUsername: String = guestName

  require(isOkayGuestId(id), "TyE4GYUK21")
  require(guestName == guestName.trim, "TyE5YGUK3")
  require(guestName.nonEmpty, "TyEJ4KEPF8")
  require(Participant.isOkayGuestBrowserdId(guestBrowserId), "TyE5W5QF7")
  require(!isEmailLocalPartHidden(email), "TyE826kJ23")
}


sealed trait ParticipantInclDetails {
  def id: UserId
  def createdAt: When
  def isBuiltIn: Boolean = Participant.isBuiltInPerson(id) || Participant.isBuiltInGroup(id)
}


sealed trait MemberInclDetails extends ParticipantInclDetails {
  def isAdmin: Boolean
  def isModerator: Boolean
  def isStaff: Boolean

  def summaryEmailIntervalMins: Option[Int]
  def summaryEmailIfActive: Option[Boolean]
  def seeActivityMinTrustLevel: Option[TrustLevel]

  /** UI features to enable or disable, or which UI variant to use. For A/B testing and
    * also in some cases for letting admins or users override the default settings
    * and make things look like they look for their community, or themselves.
    */
  def uiPrefs: Option[JsObject]

  def copyTrait(uiPrefs: Option[JsObject] = null): MemberInclDetails = {
    this match {
      case g: Group =>
        g.copy(
          uiPrefs = if (uiPrefs ne null) uiPrefs else g.uiPrefs)
      case u: UserInclDetails =>
        u.copy(
          uiPrefs = if (uiPrefs ne null) uiPrefs else u.uiPrefs)
    }
  }
}


case class UserInclDetails(  // ok for export
  id: UserId,
  externalId: Option[String],
  fullName: Option[String],
  username: String,
  createdAt: When,
  isApproved: Option[Boolean],
  reviewedAt: Option[ju.Date],
  reviewedById: Option[UserId],
  primaryEmailAddress: String,
  emailNotfPrefs: EmailNotfPrefs,
  emailVerifiedAt: Option[ju.Date] = None,
  mailingListMode: Boolean = false,
  summaryEmailIntervalMins: Option[Int] = None,
  summaryEmailIfActive: Option[Boolean] = None,
  passwordHash: Option[String] = None,
  country: Option[String] = None,
  website: Option[String] = None,
  about: Option[String] = None,
  seeActivityMinTrustLevel: Option[TrustLevel] = None,
  tinyAvatar: Option[UploadRef] = None,
  smallAvatar: Option[UploadRef] = None,
  mediumAvatar: Option[UploadRef] = None,
  uiPrefs: Option[JsObject] = None,
  isOwner: Boolean = false,
  isAdmin: Boolean = false,
  isModerator: Boolean = false,
  suspendedAt: Option[ju.Date] = None,
  suspendedTill: Option[ju.Date] = None,
  suspendedById: Option[UserId] = None,
  suspendedReason: Option[String] = None,
  trustLevel: TrustLevel = TrustLevel.NewMember,  // RENAME to autoTrustLevel?
  lockedTrustLevel: Option[TrustLevel] = None,
  threatLevel: ThreatLevel = ThreatLevel.HopefullySafe,  // RENAME to autoThreatLevel?
  lockedThreatLevel: Option[ThreatLevel] = None,
  deactivatedAt: Option[When] = None,
  deletedAt: Option[When] = None) extends MemberInclDetails with MemberMaybeDetails {

  require(Participant.isOkayUserId(id), "DwE077KF2")
  require(username.length >= 2, "DwE6KYU9")
  require(externalId.forall(_.isTrimmedNonEmpty), "TyE5KBW0Z")
  require(externalId.forall(extId => 1 <= extId.length), "TyE5AKBR20")
  require(externalId.forall(extId => extId.length <= 200), "TyE5AKBR21")
  require(!username.contains(isBlank _), "EdE8FKY07")
  require(!primaryEmailAddress.contains(isBlank _), "EdE6FKU02")
  require(fullName == fullName.map(_.trim), "EdE3WKD5F")
  require(country == country.map(_.trim), "EdEZ8KP02")
  require(!website.exists(_.contains(isBlank _)), "EdE4AB6GD")
  require(reviewedAt.isDefined == reviewedById.isDefined, "DwE0KEI4")
  require(!reviewedById.exists(_ < LowestNonGuestId), "DwE55UKH4")
  require(isApproved.isEmpty || (reviewedById.isDefined && reviewedAt.isDefined), "DwE4DKQ1")
  require(suspendedAt.isDefined == suspendedById.isDefined, "DwE64kfe2")
  require(suspendedTill.isEmpty || suspendedAt.isDefined, "DwEJKP75")
  require(suspendedReason.isDefined == suspendedAt.isDefined, "DwE5JK26")
  require(!suspendedReason.exists(_.trim.length == 0), "DwE2KFER0")
  require(!suspendedReason.exists(r => r.trim.length < r.length), "DwE4KPF8")
  require(!suspendedById.exists(_ < LowestNonGuestId), "DwE7K2WF5")
  require(!isAdmin || !isModerator, s"User $id is both admin and moderator [EdE7JLRV2]")
  require(!Participant.isGuestId(id), "DwE0GUEST223")
  require(!isEmailLocalPartHidden(primaryEmailAddress), "DwE2WFE1")
  require(tinyAvatar.isDefined == smallAvatar.isDefined &&
    smallAvatar.isDefined == mediumAvatar.isDefined, "EdE8UMW2")
  uiPrefs.flatMap(anyWeirdJsObjField) foreach { problemMessage =>
    die("TyE2AKBS04", s"User with weird uiPrefs JSON field: $problemMessage")
  }
  require(!deactivatedAt.exists(_.isBefore(createdAt)), "TyE2GKDU0")
  require(!deletedAt.exists(_.isBefore(createdAt)), "TyE1PUF054")

  def isStaff: Boolean = isAdmin || isModerator
  def isApprovedOrStaff: Boolean = isApproved.contains(true) || isStaff

  def isGuest: Boolean = false

  def isSuspendedAt(when: ju.Date): Boolean =
    Participant.isSuspendedAt(when, suspendedTill = suspendedTill)

  def isDeactivated: Boolean = deactivatedAt.isDefined
  def isDeleted: Boolean = deletedAt.isDefined
  def isGone: Boolean = isDeactivated || isDeleted

  def effectiveTrustLevel: TrustLevel = lockedTrustLevel getOrElse trustLevel
  def effectiveThreatLevel: ThreatLevel = lockedThreatLevel getOrElse threatLevel

  def isStaffOrMinTrustNotThreat(trustLevel: TrustLevel): Boolean =  // dupl code [5WKABY0]
    isStaff || (
      effectiveTrustLevel.toInt >= trustLevel.toInt && !effectiveThreatLevel.isThreat)

  def usernameLowercase: String = username.toLowerCase
  //def canonicalUsername: String = User.makeUsernameCanonical(username)  // [CANONUN]

  def idSpaceName: String = s"$id @$username"
  def usernameHashId: String = s"@$username#$id"

  def primaryEmailInfo: Option[UserEmailAddress] =
    if (primaryEmailAddress.isEmpty) None
    else Some(UserEmailAddress(
      userId = id,
      emailAddress = primaryEmailAddress,
      addedAt = createdAt,
      verifiedAt = When.fromOptDate(emailVerifiedAt)))


  def whenTimeForNexSummaryEmail(stats: UserStats, myGroups: immutable.Seq[Group])
        : Option[When] = {
    require(stats.userId == id, "EdE2GPKW01")
    if (primaryEmailAddress.isEmpty || emailVerifiedAt.isEmpty)
      return None
    val anyIntervalMins = effectiveSummaryEmailIntervalMins(myGroups)
    val intervalMins = anyIntervalMins getOrElse {
      return None
    }
    if (intervalMins == SummaryEmails.DoNotSend)
      return None
    val baseTime =
      if (effectiveSummaryEmailIfActive(myGroups) is true) {
        // Email summaries regularly, regardless of other activity.
        stats.lastSummaryEmailAt.getOrElse(createdAt)
      }
      else {
        // Don't send summaries, until user has been inactive for a while + gotten no other emails.
        stats.lastSeenOrEmailedOrSummaryAt
      }
    Some(baseTime plusMinutes intervalMins)
  }


  def effectiveSummaryEmailIntervalMins(groups: immutable.Seq[Group]): Option[Int] = {
    summaryEmailIntervalMins orElse {
      groups.find(_.summaryEmailIntervalMins.isDefined).flatMap(_.summaryEmailIntervalMins)
    }
  }


  def effectiveSummaryEmailIfActive(groups: immutable.Seq[Group]): Option[Boolean] = {
    summaryEmailIfActive orElse {
      groups.find(_.summaryEmailIfActive.isDefined).flatMap(_.summaryEmailIfActive)
    }
  }


  def preferences_debugTest = AboutUserPrefs(
    userId = id,
    fullName = fullName,
    username = username,
    emailAddress = primaryEmailAddress,
    summaryEmailIntervalMins = summaryEmailIntervalMins,
    summaryEmailIfActive = summaryEmailIfActive,
    about = about,
    location = country,
    url = website)


  def copyWithNewAboutPrefs(preferences: AboutUserPrefs): UserInclDetails = {
    val newEmailAddress =
      if (isEmailLocalPartHidden(preferences.emailAddress)) this.primaryEmailAddress
      else preferences.emailAddress
    copy(
      fullName = preferences.fullName,
      username = preferences.username,
      primaryEmailAddress = newEmailAddress,
      summaryEmailIntervalMins = preferences.summaryEmailIntervalMins,
      summaryEmailIfActive = preferences.summaryEmailIfActive,
      about = preferences.about,
      website = preferences.url)
  }


  def copyWithNewPrivacyPrefs(preferences: MemberPrivacyPrefs): UserInclDetails = {
    copy(
      seeActivityMinTrustLevel = preferences.seeActivityMinTrustLevel)
  }


  def copyWithMaxThreatLevel(newThreatLevel: ThreatLevel): UserInclDetails =
    if (this.threatLevel.toInt >= newThreatLevel.toInt) this
    else copy(threatLevel = newThreatLevel)


  def copyWithExternalData(externalUser: ExternalUser): UserInclDetails = {
    unimplementedIf(primaryEmailAddress != externalUser.primaryEmailAddress,
      "Diffferent primaryEmailAddress not yet impl [TyE2BKRP0]")
    unimplementedIf(emailVerifiedAt.isDefined != externalUser.isEmailAddressVerified,
      "Diffferent email verified status, then do what? [TyE5KBRH8]")
    copy(
      externalId = Some(externalUser.externalId),
      primaryEmailAddress = externalUser.primaryEmailAddress,
      //emailVerifiedAt = externalUser.isEmailAddressVerified,
      // username: Option[String] — keep old?
      // fullName: Option[String] — keep old? or change?
      // avatarUrl: Option[String],
      // aboutUser: Option[String],
      // isAdmin: Boolean,
      // isModerator: Boolean
      )
  }

  def briefUser = User(
    id = id,
    fullName = fullName,
    theUsername = username,
    email = primaryEmailAddress,
    emailNotfPrefs = emailNotfPrefs,
    emailVerifiedAt = emailVerifiedAt,
    passwordHash = passwordHash,
    isApproved = isApproved,
    suspendedTill = suspendedTill,
    trustLevel = trustLevel,
    lockedTrustLevel = lockedTrustLevel,
    threatLevel = threatLevel,
    lockedThreatLevel = lockedThreatLevel,
    isAdmin = isAdmin,
    isModerator = isModerator,
    isOwner = isOwner,
    isDeactivated = deactivatedAt.isDefined,
    isDeleted = deletedAt.isDefined)

}



sealed abstract class EditUserAction(val IntVal: Int) { def toInt: Int = IntVal }

object EditUserAction {
  case object SetEmailVerified extends EditUserAction(1)
  case object SetEmailUnverified extends EditUserAction(2)

  case object SetApproved extends EditUserAction(3)
  case object SetUnapproved extends EditUserAction(4)
  case object ClearApproved extends EditUserAction(5)

  case object SetIsAdmin extends EditUserAction(6)
  case object SetNotAdmin extends EditUserAction(7)

  case object SetIsModerator extends EditUserAction(8)
  case object SetNotModerator extends EditUserAction(9)

  def fromInt(value: Int): Option[EditUserAction] = Some(value match {
    case SetEmailVerified.IntVal => SetEmailVerified
    case SetEmailUnverified.IntVal => SetEmailUnverified

    case SetApproved.IntVal => SetApproved
    case SetUnapproved.IntVal => SetUnapproved
    case ClearApproved.IntVal => ClearApproved

    case SetIsAdmin.IntVal => SetIsAdmin
    case SetNotAdmin.IntVal => SetNotAdmin

    case SetIsModerator.IntVal => SetIsModerator
    case SetNotModerator.IntVal => SetNotModerator

    case _ => return None
  })
}



case class AboutUserPrefs(
  userId: UserId,
  fullName: Option[String],
  username: String,
  emailAddress: String,
  summaryEmailIntervalMins: Option[Int],   // REFACTOR break out to EmailPrefs [REFACTORNOTFS]
  summaryEmailIfActive: Option[Boolean],   //
  about: Option[String],
  location: Option[String],
  url: Option[String]) {

  require(!fullName.exists(_.trim.isEmpty), "DwE4FUKW049")
  require(!about.exists(_.trim.isEmpty), "EdE2WU4YG0")
  require(userId >= Participant.LowestNonGuestId, "DwE56KX2")

  /** Tells if these new member preferences might force us to rerender all HTML,
    * because the changes affect just about any page.
    */
  def changesStuffIncludedEverywhere(member: UserInclDetails): Boolean = {
    // Email is shown to admins only, not cached anywhere. Url shown on profile page only.
    username != member.username || fullName != member.fullName
  }

}



case class AboutGroupPrefs(
  groupId: UserId,
  fullName: Option[String],
  username: String,
  summaryEmailIntervalMins: Option[Int],
  summaryEmailIfActive: Option[Boolean]) {

  require(!fullName.exists(_.trim.isEmpty), "EdE05KFB521")
  require(groupId >= Participant.LowestNonGuestId, "DwE56KX2")

}



case class MemberPrivacyPrefs(
  userId: UserId,
  seeActivityMinTrustLevel: Option[TrustLevel])



case class UserEmailAddress(  // RENAME to MemberEmailAAddres (also groups can have email addrs)
  userId: UserId,
  emailAddress: String,
  addedAt: When,
  verifiedAt: Option[When]) {

  anyEmailAddressError(emailAddress) foreach { die("EdE4JUKS0", _) }

  // Cannot add this test, because OpenAuth emails are verified maybe 100 ms before the user gets
  // created. Could fix that, update timestamps in db, then add constraint? [5GKRWZI]
  // require(!verifiedAt.exists(_.isBefore(addedAt)), "EdE6JUKW1A")

  def isVerified: Boolean = verifiedAt.isDefined
}


case class UsernameUsage(
  usernameLowercase: String,
  inUseFrom: When,
  inUseTo: Option[When] = None,
  userId: UserId,
  firstMentionAt: Option[When] = None) {

  require(usernameLowercase == usernameLowercase.toLowerCase, "TyE6LKW28")
  require(inUseTo.forall(inUseFrom.unixMillis < _.unixMillis), "TyE7WKL42")
  require(firstMentionAt.forall(inUseFrom.unixMillis <= _.unixMillis), "TyE2WKZ0A")
  inUseTo foreach { toWhen =>
    require(firstMentionAt.forall(_.unixMillis <= toWhen.unixMillis), "TyE7KG0S3")
  }
}



object UnknownParticipant extends Participant {
  override def id: UserId = UnknownUserId
  override def email: String = ""
  override def emailNotfPrefs: EmailNotfPrefs = EmailNotfPrefs.DontReceive
  override def tinyAvatar: Option[UploadRef] = None
  override def smallAvatar: Option[UploadRef] = None
  override def suspendedTill: Option[Date] = None
  override def isAdmin: Boolean = false
  override def isOwner: Boolean = false
  override def isModerator: Boolean = false
  override def isSuperAdmin: Boolean = false
  override def effectiveTrustLevel: TrustLevel = TrustLevel.NewMember
  override def usernameOrGuestName: String = UnknownUserName
  override def nameOrUsername: String = UnknownUserName
}


/** Groups have a username but no trust level. Members have username and trust level. [8KPG2W5]
  * A group can, however, auto-grant trust level 'grantsTrustLevel' to all its members.
  */
case class Group(  // [exp] missing: createdAt, add to MemberInclDetails & ParticipantInclDetails?
  id: UserId,
  theUsername: String,
  name: String,
  createdAt: When = When.Genesis,  // for now
  tinyAvatar: Option[UploadRef] = None,
  smallAvatar: Option[UploadRef] = None,
  summaryEmailIntervalMins: Option[Int] = None,
  summaryEmailIfActive: Option[Boolean] = None,
  grantsTrustLevel: Option[TrustLevel] = None,
  uiPrefs: Option[JsObject] = None)
  extends Member with MemberInclDetails {  // COULD split into two? One without, one with details

  uiPrefs.flatMap(anyWeirdJsObjField) foreach { problemMessage =>
    die("TyE2AKBS05", s"Group with weird uiPrefs JSON field: $problemMessage")
  }

  def email: String = ""
  def passwordHash: Option[String] = None
  def emailVerifiedAt: Option[ju.Date] = None
  def emailNotfPrefs: EmailNotfPrefs = EmailNotfPrefs.DontReceive

  def isModerator: Boolean = id == Group.ModeratorsId
  def isAdmin: Boolean = id == Group.AdminsId
  def isOwner: Boolean = false
  def isSuperAdmin: Boolean = false
  override def isBuiltIn: Boolean = super.isBuiltIn
  def isApproved: Option[Boolean] = Some(true)
  def suspendedTill: Option[ju.Date] = None

  override def isGroup = true
  override def effectiveTrustLevel: TrustLevel = grantsTrustLevel getOrElse TrustLevel.NewMember

  override def usernameOrGuestName: String = theUsername
  override def nameOrUsername: String = if (name.isEmpty) theUsername else name

  //def canonicalUsername: String = User.makeUsernameCanonical(theUsername)   [CANONUN]

  // Not yet incl in Group, but could be. For now, let be core members & staff only.
  def seeActivityMinTrustLevel: Option[TrustLevel] = Some(TrustLevel.CoreMember)

  override def anyName: Option[String] = Some(name)  // [50UKQV1]
  override def anyUsername: Option[String] = Some(theUsername)

  def preferences: AboutGroupPrefs =
    AboutGroupPrefs(
      groupId = id,
      fullName = anyName,
      username = theUsername,
      summaryEmailIntervalMins = summaryEmailIntervalMins,
      summaryEmailIfActive = summaryEmailIfActive)

  def copyWithNewAboutPrefs(preferences: AboutGroupPrefs): Group =
    copy(
      name = preferences.fullName getOrDie "EdE46KWFTAR1", // currently always Some, see [50UKQV1]
      theUsername = preferences.username,
      summaryEmailIntervalMins = preferences.summaryEmailIntervalMins,
      summaryEmailIfActive = preferences.summaryEmailIfActive)

}


object Group {
  REFACTOR // move to object User, rename User to Participant? [pps]

  /** Includes not-logged-in people (a.k.a. strangers) and guests, and all members. */
  val EveryoneId = 10


  /** All higher trust level members are members of this group too. And so on:
    * members >= Basic are all members of Basic, too. So this group includes all
    * people who have created an account at the website.
    *
    * RENAME the NewMembers group to AllMembers, because totally sounds as if "new members"
    *     does *not* include full members and core members — but it does.
    *     "All members" obviously includes those other trust levels too.
    */
  val NewMembersId = 11  ; RENAME // to AllMembersId [ALLMEMBS]

  val BasicMembersId = 12
  val FullMembersId = 13
  val TrustedMembersId = 14
  val RegularMembersId = 15
  val CoreMembersId = 16

  /** Includes all admins and all moderators. */
  val StaffId = 17

  COULD // add db constraint that verifies not both admin & mod.
  /** A person is either an admin or a moderator, won't be in both groups. */
  val ModeratorsId = 18

  val AdminsId = 19


  dieUnless(NewMembersId == TrustLevel.NewMember.toInt + 10, "EdE7LPKW20")
  dieUnless(CoreMembersId == TrustLevel.CoreMember.toInt + 10, "EdE7LPKW21")
}



object EmailNotfPrefs extends Enumeration {
  type EmailNotfPrefs = Value
  val Receive, DontReceive, ForbiddenForever, Unspecified = Value   // add toInt [7KABKF2]
}

object SummaryEmails {
  val DoNotSend: Int = -1  // Also in Javascript [5WKIQU2]
}


sealed abstract class MemberLoginAttempt {
  def ip: String
  def date: ju.Date
}


case class GuestLoginAttempt(
  ip: String,
  date: ju.Date,
  name: String,
  email: String = "",
  guestBrowserId: String) {

  require(ip == ip.trim, "TyEBDGSTIP")
  require(name == name.trim, "TyEBDGSTN1")
  require(name.trim.nonEmpty, "TyEBDGSTN2")
  require(email == email.trim, "TyEBDGSTEM1")
  require(email.isEmpty || email.count(_ == '@') == 1, s"Bad email: $email [TyEBDGSTEM2]")
  require(guestBrowserId == guestBrowserId.trim, "TyEBDGSTCO1")
  require(guestBrowserId.nonEmpty, "TyEBDGSTCO2")
  require(guestBrowserId != "-", "TyEBDGSTCO3")
}

case class GuestLoginResult(guest: Guest, isNewUser: Boolean)


case class PasswordLoginAttempt(
  ip: String,
  date: ju.Date,
  emailOrUsername: String,
  password: String) extends MemberLoginAttempt {

  def isByEmail: Boolean = emailOrUsername contains '@'
  def isByUsername: Boolean = !isByEmail
}


case class EmailLoginAttempt(
  ip: String,
  date: ju.Date,
  emailId: String) extends MemberLoginAttempt {
}


case class OpenIdLoginAttempt(
  ip: String,
  date: ju.Date,
  openIdDetails: OpenIdDetails) extends MemberLoginAttempt {
}


case class OpenAuthLoginAttempt(
  ip: String,
  date: ju.Date,
  openAuthDetails: OpenAuthDetails) extends MemberLoginAttempt {

  def profileProviderAndKey: OpenAuthProviderIdKey = openAuthDetails.providerIdAndKey
}


/** A user might have many identities, e.g. an OpenAuth Google identity and
  * a Twitter identity.
  */
sealed abstract class Identity {

  def id: IdentityId
  def userId: UserId
  def usesEmailAddress(emailAddress: String): Boolean
  def loginMethodName: String

  //checkId(id, "DwE02krc3g")  TODO check how?
  require(isOkayUserId(userId), "DwE864rsk215")
}


/**
 * By specifying an id of an email that has been sent to you,
 * you can login. This login type is insecure (email transmission is
 * not secure) and only used for unsubscriptions.
 *
 * @param id The email id. Should refer to an email that has already
 *  been saved in the database.
 * @param userId The user that received the email. Not known before
 *  login (is "?").
 * @param emailSent Not known before login (is `None`)
 */
case class IdentityEmailId(
  id: IdentityId,
  userId: UserId,
  emailSent: Option[Email] = None
) extends Identity {
  // Either only email id known, or all info known.
  // require((userId startsWith "?") == emailSent.isEmpty)    TODO what?

  /* After the email has been sent, the email address isn't used any more, and can be removed;
   * this is one-time login only.
   */
  def usesEmailAddress(emailAddress: String) = false
  def loginMethodName: String = "Email link"

}


case class IdentityOpenId(
  id: IdentityId,
  override val userId: UserId,
  openIdDetails: OpenIdDetails) extends Identity {

  def displayName: String = openIdDetails.firstName
  def usesEmailAddress(emailAddress: String): Boolean =
    openIdDetails.email is emailAddress

  /** Needn't look nice, no one uses OpenID nowadays anyway? It's dead? */
  def loginMethodName = s"OpenID ${openIdDetails.oidEndpoint}"

}


case class OpenIdDetails(
  oidEndpoint: String,
  oidVersion: String,
  oidRealm: String,  // perhaps need not load from db?
  // The OpenID depends on the realm, for Gmail. So for tenants
  // with different realms (e.g. realms *.debiki.net and another-domain.com)
  // the same user will be found in two different UserOpenID instances.
  // However their Gmail addresses will be identical, so for Gmail,
  // checking email could be helpful. But must ensure the OpenID provider
  // is Gmail! otherwise an evil provider could provide false email addresses.
  oidClaimedId: String,
  oidOpLocalId: String,
  firstName: String,
  email: Option[String],
  country: String) {

}


case class OpenAuthIdentity(
  id: IdentityId,
  override val userId: UserId,
  openAuthDetails: OpenAuthDetails) extends Identity {

  def usesEmailAddress(emailAddress: String): Boolean =
    openAuthDetails.email is emailAddress

  def loginMethodName: String = openAuthDetails.providerId

  require(userId >= LowestAuthenticatedUserId, "EdE4KFJ7C")
}


@deprecated("now", "Use ExternalSocialProfile instead")
case class OpenAuthDetails(   // [exp] ok use, country, createdAt missing, fine
  providerId: String,
  providerKey: String,
  username: Option[String] = None,
  firstName: Option[String] = None,
  lastName: Option[String] = None,
  fullName: Option[String] = None,
  email: Option[String] = None,
  avatarUrl: Option[String] = None) {

  def providerIdAndKey = OpenAuthProviderIdKey(providerId, providerKey)

  def displayNameOrEmpty: String = {
    fullName.orElse({
      if (firstName.isDefined && lastName.isDefined) Some(firstName.get + " " + lastName.get)
      else None
    }).orElse(firstName).orElse(lastName) getOrElse ""
  }

  // Mixed case email addresses not allowed, for security reasons. See db fn email_seems_ok.
  def emailLowercasedOrEmpty: String = email.map(_.toLowerCase) getOrElse ""
}


case class OpenAuthProviderIdKey(providerId: String, providerKey: String)


case class MemberLoginGrant(
  identity: Option[Identity],
  user: User,
  isNewIdentity: Boolean,
  isNewMember: Boolean) {

  require(!identity.exists(_.id.contains('?')), "EdE7KP4Y1")
  require(identity.forall(_.userId == user.id), "EdE2KVB04")
  require(!isNewMember || isNewIdentity, "EdE6FK4R2")
}


/** An IP number or a browser id cookie that has been blocked and may not
  * post comments or vote.
  */
case class Block(
  threatLevel: ThreatLevel,
  ip: Option[jn.InetAddress],
  browserIdCookie: Option[String],
  blockedById: UserId,
  blockedAt: ju.Date,
  blockedTill: Option[ju.Date]) {

  require(browserIdCookie.isDefined || ip.isDefined, "TyE5KGU83")
  require(blockedTill.isEmpty || blockedTill.get.getTime >= blockedAt.getTime, "EdE2KWC8")
  require(!browserIdCookie.exists(_.trim.isEmpty), "EdE4FUK7")

  def isActiveAt(when: When): Boolean = blockedTill match {
    case None => true
    case Some(date) => when.millis <= date.getTime
  }

}


class BlockedTillMap(
  datesByIp: Map[InetAddress, ju.Date],
  datesByBrowserIdCookie: Map[String, ju.Date]) {

  private val blockedTillMap = mutable.HashMap[String, ju.Date]()

  for ((ip, date) <- datesByIp) {
    blockedTillMap.put(ip.toString, date)
  }

  for ((id, date) <- datesByBrowserIdCookie) {
    blockedTillMap.put(id, date)
  }

  def blockedTill(ip: InetAddress): Option[ju.Date] =
    blockedTillMap.get(ip.toString)

  def blockedTill(browserIdCookie: String): Option[ju.Date] =
    blockedTillMap.get(browserIdCookie)

}



case class BrowserIdData(ip: String, idCookie: Option[String], fingerprint: Int) {
  require(ip.nonEmpty, "TyE6G9F0")
  require(!idCookie.exists(_.isEmpty), "TyE3GJ79")

  def inetAddress: InetAddress = guava.net.InetAddresses.forString(ip)

}

object BrowserIdData {
  val NoFingerprint = 0
  val System = BrowserIdData("127.0.0.1", None, NoFingerprint)
  val Forgotten = BrowserIdData("127.0.0.2", None, NoFingerprint)
}


/**
  *
  * @param emailBounceSum Somewhat taking into account bounce rates of earlier addresses?
  * @param numSolutionsProvided How many accepted answers/solutions this user has posted.
  */
case class UserStats(
  userId: UserId,
  // SHOULD update based on browser activity
  lastSeenAt: When = When.fromMillis(0),
  // Later: lastSeenAtIp, lastBrowserIdCookie, lastBrowserFingerprint?
  // Then also include that lastX stuff in the download-my-personal-data response [6LKKEZW2].
  lastPostedAt: Option[When] = None,
  lastEmailedAt: Option[When] = None,
  lastSummaryEmailAt: Option[When] = None, // RENAME to lastSummaryAt, & db field too
  nextSummaryEmailAt: Option[When] = None, // RENAME to nextSummaryMaybeAt,   & db field too
  emailBounceSum: Float = 0f,
  firstSeenAtOr0: When = When.fromMillis(0),
  firstNewTopicAt: Option[When] = None,
  firstDiscourseReplyAt: Option[When] = None,
  firstChatMessageAt: Option[When] = None,
  topicsNewSince: When = When.fromMillis(0),
  notfsNewSinceId: NotificationId = 0,
  numDaysVisited: Int = 0,
  numSecondsReading: Int = 0,
  numDiscourseRepliesRead: Int = 0,
  numDiscourseRepliesPosted: Int = 0,
  numDiscourseTopicsEntered: Int = 0,
  numDiscourseTopicsRepliedIn: Int = 0,
  numDiscourseTopicsCreated: Int = 0,
  numChatMessagesRead: Int = 0,
  numChatMessagesPosted: Int = 0,
  numChatTopicsEntered: Int = 0,
  numChatTopicsRepliedIn: Int = 0,
  numChatTopicsCreated: Int = 0,
  numLikesGiven: Int = 0,
  numLikesReceived: Int = 0,
  numSolutionsProvided: Int = 0,
  tourTipsSeen: Option[TourTipsSeen] = None,
  mayBeNegative: Boolean = false) {

  require(lastSeenAt.millis >= firstSeenAtOr0.millis, "EdE6BMLA09")
  lastPostedAt foreach { when => require(lastSeenAt.millis >= when.millis, "EdE6BMLA01") }
  // Skip `lastEmailedAt` — it can be later than lastSeenAt.
  firstNewTopicAt foreach { when => require(lastSeenAt.millis >= when.millis, "EdE6BMLA11") }
  firstDiscourseReplyAt foreach { when => require(lastSeenAt.millis >= when.millis, "EdE6BMA13") }
  firstChatMessageAt foreach { when => require(lastSeenAt.millis >= when.millis, "EdE6BMLA15") }
  require(lastSeenAt.millis >= topicsNewSince.millis, "EdE6BMLA17")

  lastPostedAt foreach { when => require(firstSeenAtOr0.millis <= when.millis, "EdE6BMLA20") }
  // Skip `lastEmailedAt` — it can be before firstSeenAt (if invite email sent before user created).
  firstNewTopicAt foreach { when => require(firstSeenAtOr0.millis <= when.millis, "EdE6BMLA24") }
  firstDiscourseReplyAt foreach { when => require(firstSeenAtOr0.millis <= when.millis, "EdE6LA26") }
  firstChatMessageAt foreach { when => require(firstSeenAtOr0.millis <= when.millis, "EdE6BMLA28") }

  if (!mayBeNegative) {
    require(emailBounceSum >= 0, "EdE4GKWL01")
    require(notfsNewSinceId >= 0, "EdE4GKWL02")
    require(numDaysVisited >= 0, "EdE4GKWL03")
    require(numSecondsReading >= 0, "EdE4GKWL04")
    require(numDiscourseRepliesRead >= 0, "EdE4GKWL05")
    require(numDiscourseRepliesPosted >= 0, "EdE4GKWL06")
    require(numDiscourseTopicsEntered >= 0, "EdE4GKWL07")
    require(numDiscourseTopicsRepliedIn >= 0, "EdE4GKWL08")
    require(numDiscourseTopicsCreated >= 0, "EdE4GKWL09")
    require(numChatMessagesRead >= 0, "EdE4GKWL010")
    require(numChatMessagesPosted >= 0, "EdE4GKWL011")
    require(numChatTopicsEntered >= 0, "EdE4GKWL012")
    require(numChatTopicsRepliedIn >= 0, "EdE4GKWL013")
    require(numChatTopicsCreated >= 0, "EdE4GKWL014")
    require(numLikesGiven >= 0, "EdE4GKWL015")
  }


  def firstSeenAtNot0: When =
    if (firstSeenAtOr0.millis > 0) firstSeenAtOr0
    else When.fromMillis(minOfMany(
        lastSeenAt.millis,
        firstNewTopicAt.map(_.millis).getOrElse(Long.MaxValue),
        firstDiscourseReplyAt.map(_.millis).getOrElse(Long.MaxValue),
        firstChatMessageAt.map(_.millis).getOrElse(Long.MaxValue)))

  def lastSeenOrEmailedOrSummaryAt: When = {
    // The summary might have been created and an email scheduled, but not yet sent
    // — so checking only lastEmailedAt isn't enough.
    When.latestOf(When.latestOf(lastSeenAt, lastEmailedAt), lastSummaryEmailAt)
  }


  /** Ignores dates with 0 millis (= year 1970), considers that = no date.
    */
  def addMoreStats(moreStats: UserStats): UserStats = {
    require(userId == moreStats.userId, "EdE4WKB1W9")

    import When.{latestOf, anyLatestOf, earliestNot0, anyEarliestNot0}

    // Don't let the newer tourTipsSeen overwrite the old one; instead, merge them together.
    val allTourTipsSeenVec =
      moreStats.tourTipsSeen.getOrElse(Vector.empty) ++ this.tourTipsSeen.getOrElse(Vector.empty)
    val allTourTipsSeenVecOpt =
      if (allTourTipsSeenVec.isEmpty) None
      else Some(allTourTipsSeenVec.sorted.distinct)

    // Dupl code, also in SQL [7FKTU02], perhaps add param `addToOldstat: Boolean` to SQL fn?
    copy(
      lastSeenAt = latestOf(lastSeenAt, moreStats.lastSeenAt),
      lastPostedAt = anyLatestOf(lastPostedAt, moreStats.lastPostedAt),
      lastEmailedAt = anyLatestOf(lastEmailedAt, moreStats.lastEmailedAt),
      lastSummaryEmailAt = anyLatestOf(lastSummaryEmailAt, moreStats.lastSummaryEmailAt),
      nextSummaryEmailAt = anyEarliestNot0(nextSummaryEmailAt, moreStats.nextSummaryEmailAt),
      // Hmm, how should the bounce sum be updated? For now:
      emailBounceSum = (moreStats.emailBounceSum >= 0) ? moreStats.emailBounceSum | emailBounceSum,
      firstSeenAtOr0 = earliestNot0(firstSeenAtOr0, moreStats.firstSeenAtOr0),
      firstNewTopicAt = anyEarliestNot0(firstNewTopicAt, moreStats.firstNewTopicAt),
      firstDiscourseReplyAt = anyEarliestNot0(firstDiscourseReplyAt, moreStats.firstDiscourseReplyAt),
      firstChatMessageAt = anyEarliestNot0(firstChatMessageAt, moreStats.firstChatMessageAt),
      topicsNewSince = latestOf(moreStats.topicsNewSince, topicsNewSince),
      notfsNewSinceId = (moreStats.notfsNewSinceId > notfsNewSinceId) ?
        moreStats.notfsNewSinceId | notfsNewSinceId,
      numDaysVisited = numDaysVisited + moreStats.numDaysVisited,
      numSecondsReading = numSecondsReading + moreStats.numSecondsReading,
      numDiscourseRepliesRead = numDiscourseRepliesRead + moreStats.numDiscourseRepliesRead,
      numDiscourseRepliesPosted = numDiscourseRepliesPosted + moreStats.numDiscourseRepliesPosted,
      numDiscourseTopicsEntered = numDiscourseTopicsEntered + moreStats.numDiscourseTopicsEntered,
      numDiscourseTopicsRepliedIn =
        numDiscourseTopicsRepliedIn + moreStats.numDiscourseTopicsRepliedIn,
      numDiscourseTopicsCreated = numDiscourseTopicsCreated + moreStats.numDiscourseTopicsCreated,
      numChatMessagesRead = numChatMessagesRead + moreStats.numChatMessagesRead,
      numChatMessagesPosted = numChatMessagesPosted + moreStats.numChatMessagesPosted,
      numChatTopicsEntered = numChatTopicsEntered + moreStats.numChatTopicsEntered,
      numChatTopicsRepliedIn = numChatTopicsRepliedIn + moreStats.numChatTopicsRepliedIn,
      numChatTopicsCreated = numChatTopicsCreated + moreStats.numChatTopicsCreated,
      numLikesGiven = numLikesGiven + moreStats.numLikesGiven,
      numLikesReceived = numLikesReceived + moreStats.numLikesReceived,
      numSolutionsProvided = numSolutionsProvided + moreStats.numSolutionsProvided,
      tourTipsSeen = allTourTipsSeenVecOpt)
    }


  def meetsBasicMemberRequirements: Boolean = {   // [TLVLBSC]
    // For now. Later, add a site-settings param, and compare with its config values.
    COULD // break out constants
    numDiscourseTopicsEntered >= 4 &&
      numDiscourseRepliesRead >= 25 &&
      numSecondsReading >= 8 * 60
  }


  def meetsFullMemberRequirements: Boolean = {
    // Based on Discourse, https://meta.discourse.org/t/what-do-user-trust-levels-do/4924/5.
    COULD // break out constants
    ASTROTURFING // only count Likes from full members. Not from other New or Basic members.
    // But how do that, in a code wise simple, and performance effective way? Because might
    // need to review and update the like counts, when another member advances to Full Member.
    // Or would need to lookup and investigate all likes this member has gotten, every now and when.
    // A GRAPH_DATABASE would do that easily, right.
    numDiscourseTopicsEntered >= 20 &&
      numDiscourseRepliesRead >= 100 &&
      numSecondsReading >= 3600 &&
      numDiscourseTopicsRepliedIn >= 3 &&
      numLikesReceived >= 1 &&
      numLikesGiven >= 1 &&
      numDaysVisited >= 15
  }
}



case object UserStats {

  def forNewUser(userId: UserId, firstSeenAt: When, emailedAt: Option[When]) = UserStats(
    userId = userId,
    firstSeenAtOr0 = firstSeenAt,
    lastSeenAt = firstSeenAt,
    topicsNewSince = firstSeenAt,
    lastEmailedAt = emailedAt)

}



case class UserVisitStats(
  userId: UserId,
  visitDate: WhenDay,
  numSecondsReading: Int,
  numDiscourseRepliesRead: Int,
  numDiscourseTopicsEntered: Int,
  numChatMessagesRead: Int,
  numChatTopicsEntered: Int) {

  require(
    numSecondsReading >= 0 &&
    numDiscourseRepliesRead >= 0 &&
    numDiscourseTopicsEntered >= 0 &&
    numChatMessagesRead >= 0 &&
    numChatTopicsEntered >= 0, "EdE5FKGA2R")
}


case class VisitTrust(
  visitMinute: Int,
  trustLevelInt: Int)

object VisitTrust {
  val UnknownMember = VisitTrust(0, TrustLevel.NewMember.toInt)
}



case class PeopleQuery(  // also see PageQuery
  orderOffset: PeopleOrderOffset,
  peopleFilter: PeopleFilter)

/** How to sort users and groups, when loading from the database, and any pagination offset.
  */
sealed abstract class PeopleOrderOffset
object PeopleOrderOffset {
  case object BySignedUpAtDesc extends PeopleOrderOffset
  case object ByUsername extends PeopleOrderOffset
}

case class PeopleFilter(
  onlyWithVerifiedEmail: Boolean = false,
  onlyApproved: Boolean = false,
  onlyPendingApproval: Boolean = false,
  onlyStaff: Boolean = false,
  onlySuspended: Boolean = false,
  //onlySilenced: Boolean = false,
  onlyThreats: Boolean = false) {
  forbid(onlyApproved && onlyPendingApproval, "TyEZKJ3BG59")
}
