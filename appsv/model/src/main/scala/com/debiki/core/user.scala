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
import org.scalactic.{Bad, ErrorMessage, Or}
import scala.collection.{immutable, mutable}
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
  startAtUrl: Option[String],
  addToGroupIds: Set[UserId],
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

  SECURITY; COULD // find a more 100% safe approach to verifying this is a local url path, [40KRJTX35]
  // and cannot make the browser jump to a different server?
  // Add a fn  isUrlPath maybe? that does some regex thing that disallows any unexpected chars?
  // Later: Allow urls to different origins, as long as they're one of the allowEmbeddingFrom origins
  // (in case the Talkyard forum is embedded in an iframe in another site).
  startAtUrl foreach { url =>
    val uri = new java.net.URI(url)
    require(uri.getPath == url, "TyU30TKSRGP01")
    require(uri.getScheme eq null, "TyU30TKSRGP03")
    require(uri.getAuthority eq null, "TyU30TKSRGP02")
    require(uri.getQuery eq null, "TyU30TKSRGP04")
    require(uri.getFragment eq null, "TyU30TKSRGP05")
  }
  // Paranoia:
  require(startAtUrl.forall(_ startsWith "/"), "TyE40RKTG01")
  require(startAtUrl.forall(p => !(p contains "//")), "TyE40RKTG02")
  require(startAtUrl.forall(p => !(p contains ":")), "TyE40RKTG03")
  require(startAtUrl.forall(p => extractUrlPath(p) == p), "TyE5KGW2XTJ")

  // Group ids are > 0, and don't allow adding to built-in groups 10..19.
  // Only custom groups, >= 100.  [305FDF4R]
  require(addToGroupIds.forall(groupId => groupId >= LowestAuthenticatedUserId), "TyE6WKDJ025P01")
  // For now:
  require(addToGroupIds.size <= 1, "Adding to > 1 group not yet implemented [TyE6WKDJ025P02]")


  def canBeOrHasBeenAccepted: Boolean = invalidatedAt.isEmpty && deletedAt.isEmpty

  COULD; REFACTOR // createdAt to ... what? and createdWhen to createdAt. Or change datatype.
  def createdWhen: When = When.fromDate(createdAt)

  def makeUser(userId: UserId, username: String, currentTime: ju.Date) = UserInclDetails(
    id = userId,
    ssoId = None,
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
  def apply(emailAddress: String, addToGroupIds: Set[UserId], secretKey: String,
        createdById: UserId, createdAt: ju.Date): Invite = Invite(
    emailAddress = emailAddress,
    secretKey = secretKey,
    createdById = createdById,
    createdAt = createdAt,
    userId = None,
    acceptedAt = None,
    deletedAt = None,
    deletedById = None,
    invalidatedAt = None,
    startAtUrl = None,
    addToGroupIds = addToGroupIds)
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
    ssoId = None,
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
  ssoId: Option[String],
  createdAt: When,
  firstSeenAt: Option[When],
  isAdmin: Boolean,
  isOwner: Boolean,
  isModerator: Boolean = false,
  emailVerifiedAt: Option[When] = None,
  extId: Option[ExtId] = None,
  trustLevel: TrustLevel = TrustLevel.NewMember,
  threatLevel: ThreatLevel = ThreatLevel.HopefullySafe) {

  val passwordHash: Option[String] =
    password.map(DbDao.saltAndHashPassword)

  def makeUser(userId: UserId) = UserInclDetails(
    id = userId,
    extId = extId,
    ssoId = ssoId,
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

  // If SSO is enabled, then, cannot also have password login.
  require(ssoId.isEmpty || password.isEmpty, "TyE5VAKBR02")

  // If no SSO login and no password, then, an email addr is needed, so pat can get
  // a password reset link, via that email addr.
  require(ssoId.isDefined || password.isDefined || email.nonEmpty, "TyE5VAKBR04")

  require(!firstSeenAt.exists(_.isBefore(createdAt)), "TyE2WVKF063")
}


object NewPasswordUserData {
  def create(
        name: Option[String], username: String, email: String,
        password: Option[String] = None,
        extId: Option[ExtId] = None,
        ssoId: Option[String] = None,
        createdAt: When,
        isAdmin: Boolean, isOwner: Boolean, isModerator: Boolean = false,
        emailVerifiedAt: Option[When] = None,
        trustLevel: TrustLevel = TrustLevel.NewMember,
        threatLevel: ThreatLevel = ThreatLevel.HopefullySafe): NewPasswordUserData Or ErrorMessage = {
    extId.flatMap(Validation.findExtIdProblem) foreach { problem =>
      return Bad(problem)
    }
    ssoId.flatMap(Validation.findSsoIdProblem) foreach { problem =>
      return Bad(problem)
    }
    for {
      okName <- Validation.checkName(name)
      okUsername <- Validation.checkUsername(username)
      okEmail <- Validation.checkEmail(email)
      // Password: See security.throwErrorIfPasswordTooWeak, instead.
    }
    yield {
      NewPasswordUserData(name = okName, username = okUsername, email = okEmail,
        password = password, ssoId = ssoId, createdAt = createdAt,
        firstSeenAt = Some(createdAt),  // for now
        isAdmin = isAdmin, isOwner = isOwner, isModerator = isModerator,
        emailVerifiedAt = emailVerifiedAt, extId = extId,
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



case class NameAndUsername(
  id: UserId,
  fullName: St,
  username: St,
  mayMentionMeTrLv: Opt[TrustLevel])



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
  // val SuperStaffId = 4  ?
  // val SuperBotId = 5  ?

  // ? rename SuperX to Global Read/Action X,
  // Hmm these would be useful, for site staff to View As ...
  // and assign ids 20...29 to GlobalReadStranger, GlobalReadNewMember,  (can only read)
  // GlobalReadBasicMember, ..., GlobalReadCoreMember, GlobalReadModerator,
  // and assign ids 30...39 to GlobalHideStranger, ... GlobalHideAdmin?  (can delete/hide things)
  // and assign ids 40...49 to ... GlobalActionAdmin?  (can do anything, incl edit site settings)
  // and reassign group ids 10...19  to maybe 50..59?  Then LowestNormalMemberId below would be 50.
  // 60...68 could be ViewAsStranger, ViewAsNewMember, ... ViewAsCoreMember, ViewAsModerator?
  // Or  ViewAsStranger/NewMember/... = 20,21 ... 29, + caps=ViewOnly/Delete/Purge/Edit/EditSettings?

  // val SuperMod = 5 ?
  // val SuperPupbMod = 6 ?

  // ?? If a member chooses to post anonymously:
  //     — no, using anonym_id_c  and anonym_ids_t instead?  And optional pen names
  // val AnonymousUserId = 7

  // UnknownUserId = 6
  // UnknownStaffId = 7

  // The real ids of deactivated and deleted users, could be replaced with these ids, when rendering
  // pages, so others won't find the real ids of the deactivated/deleted accounts.
  // val DeactivatedUserId = 8
  // val DeletedUserId = 9
  // or just: DeactivatedOrDeletedUserId = 9 ?  or just: DeactivatedUserId incl deleted users?


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
  val MaxAnonId: PatId = MaxCustomGuestId

  val MaxGuestId: UserId = -1
  //assert(MaxGuestId == AnonymousUserId)
  assert(UnknownUserId.toInt <= MaxGuestId)

  val MaxGuestOrAnonId: PatId = MaxGuestId

  /** Ids 1 .. 99 are reserved in case in the future I want to combine users and groups,
    * and then there'll be a few groups with hardcoded ids in the range 1..99.
    */
  val LowestAuthenticatedUserId = 100   // also in js  [8PWK1Q2W]   Change to 1001?  [UID1001]

  val LowestMemberId: UserId = SystemUserId
  val LowestNonGuestId = 1  // CLEAN_UP RENAME to LowestMemberId?
  assert(LowestNonGuestId == SystemUserId)

  RENAME // to isGuestOrAnonId
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
    Group.EveryoneId <= id && id <= Group.AdminsId

  def isBuiltInParticipant(id: UserId): Boolean = MaxCustomGuestId < id && id < LowestAuthenticatedUserId

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
    case None => true
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

  private val TwoOrMoreUnderscoresRegex =
    "_{2,}".r

  SHOULD // move to server module, so won't need Apache Tika here.
  // (I.e. so won't need Dependencies.Libs.apacheTika.)
  /** Comes up with a username that contains only valid characters, and is not already in use.
    * Does things like pads with numbers if too short, and, if already taken, appends
    * numbers to make it unique. And changes åäö to aao and replaces Unicode
    * like Chinese and Arabic characters with 'zzz' — allowing Unicode usernames = dangerous,
    * would make homoglyph/homograph attacks possible (pretending to be someone else, like,
    * user 'tové' pretends to be 'tove').
    */
  def makeOkayUsername(somethingMaybeWeird: String, allowDotDash: Boolean,
        isUsernameInUse: String => Boolean, noneIfIsAlready: Opt[St] = None)
        : Option[String] = {
    // Tested in UserSpec:  TyT05RDPS24
    // And this e2e test: TyT306FKRDJ5.TyT05MSH47R

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
    else {
      // Then maybe many underscores '__' in a row — but Ty allows at most one.
      // Hmm, could avoid this, by doing  replWithUnderscoreRegex  *after*
      // UsernameBadCharsRegex, above, right.
      usernameOkCharsNotTrimmed =
            TwoOrMoreUnderscoresRegex.replaceAllIn(usernameOkCharsNotTrimmed, "_")
    }

    // Later, allow starting with '_', and change here too: [ALWUNDS1]
    val usernameOkChars = usernameOkCharsNotTrimmed
      // In case a name is like:  'n234567890123456789_longerThanMax___'
      // we need to first cut away 'longerthanmax__' so this: '...789_' gets
      // trimmed to '...789', instead of 'longerThanMax__' to 'longerThanMax'.
      // So, take max length here:
      .take(Participant.MaxUsernameLength)
      .dropWhile(!charIsAzOrNum(_))      // drops anything but  a-z  A-Z  0-9, for now. [UNPUNCT]
      .dropRightWhile(!charIsAzOrNum(_)) //

    // For now, don't allow numeric usernames or digits and '.' '-' only.
    // That wouldn't be a name would it?
    // Maybe if someone chooses hens name to be '2010' or '1945', people will believe it's
    // a date instead? Not good for usability? And '12.34' is a weird name.
    // Let's prefix 'n', could mean "numeric name".
    val usernameNotOnlyDigits =
      if (usernameOkChars.forall(charIsNumOrDotDash))  // [3935RKDD03]
        ('n' + usernameOkChars).take(Participant.MaxUsernameLength)
      else
        usernameOkChars

    var usernameOkCharsLen =
      if (usernameNotOnlyDigits.length >= Participant.MinUsernameLength)
        usernameNotOnlyDigits
      else
        // Avoid '1', looks like 'l'.
        (usernameNotOnlyDigits + "23456789") take Participant.MinUsernameLength

    // Not a file extension suffix? like .png or .jpg or .js?  Tested here: [5WKAJH20]
    if (allowDotDash) {
      val tika = new org.apache.tika.Tika()
      val mimeType: String = tika.detect(usernameOkCharsLen)
      // Tika doesn't detect ".woff", weird? Maybe remove in Tika 1.9? [5AKR20]
      if (mimeType != "application/octet-stream"
          || usernameOkCharsLen.endsWith(".woff")
          || usernameOkCharsLen.endsWith(".woff2")) {
        // Then replace all dots with underscore.
        // (They cannot be at the start or end, because of dropWhile and dropRightWhile above.)
        usernameOkCharsLen =
              ReplSpecialsWithUnderscoreRegex.replaceAllIn(usernameOkCharsLen, "_")
      }
    }

    var nextToTry = usernameOkCharsLen
    val numCharsFree = Participant.MaxUsernameLength - usernameOkCharsLen.length

    // Avoid hitting the db (both to see if exists, or to write), if the new
    // username is already the same as the person's current username.
    noneIfIsAlready foreach { currentUsername =>
      if (nextToTry == currentUsername)
        return None
    }

    // `until` means up to length - 1 — so won't drop all chars here: (5WKBA2)
    for (i <- 1 until Participant.MaxUsernameLength) {
      val isInUse = isUsernameInUse(nextToTry)
      if (!isInUse)
        return Some(nextToTry)

      // Append i random numbers [mk_un_unq] to make the username unique.
      // Repeat with i, i+1, i+2 chars,
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


/** A participant, which is a Guest, a User or a Group, or (soon) an Anonym.
  * Or (later) a Pseudonym or (much later) a Circle (a bottom-up created group,
  * i.e. not created by the mods, but by ordinary members).
  *
  * Member = User or Group (but not Guest).
  *
  * Someone = Guest or User, that is, just 1 person or bot (called "Someone" not
  * "Person" since could be a bot).
  */
sealed trait Pat {

  def id: PatId
  def extId: Opt[ExtId]
  def email: EmailAdr  // COULD rename to emailAddr and change to Opt[EmailAdr] (instead of "")
  def emailNotfPrefs: EmailNotfPrefs
  def tinyAvatar: Opt[UploadRef]
  def smallAvatar: Opt[UploadRef]
  def suspendedTill: Opt[ju.Date]
  def isAdmin: Bo
  def isOwner: Bo
  def isModerator: Bo

  // Later: Impl for Guest users too?
  def isDeactivated: Bo = false
  def isDeleted: Bo = false
  def isAnon: Bo = false

  final def isAuthenticated: Bo = isRoleId(id)
  def isApprovedOrStaff: Bo
  final def isSystemUser: Bo = id == SystemUserId
  final def isSystemOrSysbot: Bo = id == SystemUserId || id == SysbotUserId
  final def isStaff: Bo = isAdmin || isModerator || isSystemUser
  final def isHuman: Bo = id >= LowestTalkToMemberId || id <= MaxGuestId
  final def isBuiltIn: Bo = Participant.isBuiltInPerson(id) || Participant.isBuiltInGroup(id)
  final def isGone: Bo = isDeactivated || isDeleted

  final def isStaffOrCoreMember: Bo =  // but what about threat level?
    isStaff || effectiveTrustLevel.toInt >= TrustLevel.CoreMember.toInt

  final def isStaffOrTrustedNotThreat: Bo =
    isStaffOrMinTrustNotThreat(TrustLevel.TrustedMember)

  final def isStaffOrFullMember: Bo =
    isStaff || effectiveTrustLevel.toInt >= TrustLevel.FullMember.toInt

  def isStaffOrMinTrustNotThreat(trustLevel: TrustLevel): Bo

  final def isMember: Bo = Participant.isMember(id)
  final def isGuest: Bo = Participant.isGuestId(id) && !isAnon
  final def isGuestOrAnon: Bo = Participant.isGuestId(id)
  final def canAddToGroup: Bo = !isGuestOrAnon && !isSystemOrSysbot
  // Rename to jus isUser later when "user" means "user not guest" everywhere anyway.
  final def isUserNotGuest: Bo = isMember && !isGroup && !isBuiltIn

  def isGroup: Bo
  final def anyMemberId: Opt[MembId] = if (isRoleId(id)) Some(id) else None

  final def accountType: St =
    if (isGuest) "guest" else if (isAnon) "anonym" else if (isGroup) "group" else "user"

  final def isSuspendedAt(when: When): Bo = isSuspendedAt(when.toJavaDate)
  final def isSuspendedAt(when: ju.Date): Bo =
    Participant.isSuspendedAt(when, suspendedTill = suspendedTill)

  def effectiveTrustLevel: TrustLevel

  def canPromoteToBasicMember: Bo = false
  def canPromoteToFullMember: Bo = false

  /** Sync w Typescript: store_maySendDirectMessageTo().  */
  def mayMessage(pat: Pat): Bo = {
    // It's ok to message oneself? Maybe for some kind of personal journal
    if (pat.isSystemOrSysbot || pat.isGuest || pat.isGone) return false
    if (isStaffOrCoreMember) return true
    SHOULD // prevent problematic users from messaging anyone but the mods? [bad_pat_dms]
    // if (threatLevel > ... && !pat.isStaff ) return false  // currently only client side
    pat match {
      case m: Member =>
        m.privPrefs.maySendMeDmsTrLv.forall(othersMinLevel =>
              this.effectiveTrustLevel isAtLeast othersMinLevel)
      case _ => false
    }
  }

  def mayMention(pat: Pat): Bo = {
    if (pat.id == this.id || pat.isSystemOrSysbot || pat.isGuest || pat.isGone) return false
    if (isStaffOrCoreMember) return true
    pat match {
      case m: Member =>
        m.privPrefs.mayMentionMeTrLv.forall(othersMinLevel =>
              this.effectiveTrustLevel isAtLeast othersMinLevel)
      case _ => false
    }
  }


  /** A member's full name, or guest's guest name. */
  def anyName: Opt[St]

  /** Only for members, not guests. */
  def anyUsername: Opt[St]

  def usernameOrGuestName: St

  def atUsernameOrFullName: St =
    anyUsername.map('@' + _) orElse anyName getOrElse UnknownUserName

  final def usernameSpaceOtherName: St =
    (anyUsername.getOrElse("") + " " + anyName.getOrElse("")).trim

  def nameOrUsername: St

  final def idSpaceName: St =
    anyUsername.map(un => s"$id @$un") getOrElse s"$id '$usernameOrGuestName'"

  final def nameParaId: St =
    anyUsername.map(un => s"@$un (id $id)") getOrElse s"'$usernameOrGuestName' (id $id)"

  final def nameHashId: St =
    anyUsername.map(un => s"@$un #$id") getOrElse s"'$usernameOrGuestName' #$id"

  final def toMemberOrThrow: Member = toMemberOrThrowCode("")

  final def toMemberOrThrowCode(errCode: ErrCode): Member = {
    this match {
      case m: UserBase => m
      case g: Guest => throw GotAGuestException(g.id, errCode)
      case g: Group => g
      case _ => throwWrongPatType(wantedWhat = "a user or group")
    }
  }

  def asAnonOrThrow: Anonym = {
    this match {
      case anon: Anonym => anon
      case _ => throwWrongPatType(wantedWhat = "an anonym")
    }
  }

  def asGuestOrThrow: Guest = {
    this match {
      case guest: Guest => guest
      case _ => throwWrongPatType(wantedWhat = "a guest")
    }
  }

  final def toMemberVbOrDie: MemberVb = {
    this match {
      case u: UserVb => u
      case g: Group => g
      case x => die("TyENOTVB3963", s"Not a MemberVb: ${classNameOf(x)}")
    }
  }

  COULD_OPTIMIZE // return UserBase instead?
  final def toUserOrThrow: User = {
    this match {
      case u: User => u
      case u: UserVb => u.briefUser // or just return UserBase instead of converting
      case _: UserBase => die("TyE59RKTJ1", "Should see UserBr or UserVb before UserBase")
      case _ => throwWrongPatType(wantedWhat = "a user")
    }
  }

  final def toUserVbOrThrow: UserVb = {
    this match {
      case _: UserBr => die("TyE59RKTJ2", "Got a UserBr not a UserVb")
      case u: UserVb => u
      case _: UserBase => die("TyE59RKTJ3", "Should see UserBr or UserVb before UserBase")
      case _ => throwWrongPatType(wantedWhat = "a user")
    }
  }

  private def throwWrongPatType(wantedWhat: St): Nothing = {
    this match {
      case _: User => throw GotAUserEx(this.id, wantedWhat)
      case _: Anonym => throw GotAnAnonEx(this.id, wantedWhat)
      case _: Guest => throw GotAGuestException(this.id, wantedWhat)
      case _: Group => throw GotAGroupException(this.id, wantedWhat)
      case UnknownParticipant => throw GotUnknownUserException
    }
  }
}



sealed trait Member extends Pat {
  def theUsername: St
  final def anyUsername: Opt[St] = Some(theUsername)
  final def usernameOrGuestName: St = theUsername
  final def nameOrUsername: St = anyName getOrElse theUsername

  final def usernameParensFullName: St = anyName match {    // dupl fn?
    case Some(name) => s"$theUsername ($name)"
    case None => theUsername
  }

  def isApproved: Opt[Bo]
  final def isApprovedOrStaff: Bo = isApproved.is(true) || isStaff

  def privPrefs: MemberPrivacyPrefs
}


object Member {
  val DeletedUsernameSuffix = "_deleted"
}


sealed trait Someone extends Pat {
  assert(!isGroup, "TyE05MKFS56")
}


trait UserBase extends Member with Someone {  RENAME // to User, and remove type User = UserBr  [trait_user]
  // Later: Move more fns from User and UserVb, to here.

  final def usernameHashId: String = s"@$theUsername#$id"
  def primaryEmailAddress: St

  final def isGroup = false

  def ssoId: Opt[SsoId]
  def trustLevel: TrustLevel
  def effectiveThreatLevel: ThreatLevel

  final def isStaffOrMinTrustNotThreat(trustLevel: TrustLevel): Bo =
    isStaff || (
      effectiveTrustLevel.toInt >= trustLevel.toInt && !effectiveThreatLevel.isThreat)

  final override def canPromoteToBasicMember: Bo =
    // If trust level locked, promoting the this.trustLevel has no effect — but we'll still
    // do it, so we know what it would have been, had it not been locked.
    !isBuiltIn && trustLevel == TrustLevel.NewMember

  final override def canPromoteToFullMember: Bo =
    !isBuiltIn && trustLevel == TrustLevel.BasicMember

}



/** Maybe later. Could be more readable than Opt[Pat]? Because None
  * sounds as if there's no user — but there is: a stranger.
  *  /
sealed abstract class PatOrStranger
object PatOrStranger {
  case class Pat(pat: com.debiki.core.Pat) extends PatOrStranger
  case object Stranger extends PatOrStranger
} */


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
  * @param blocked — if got flagged or too many posts rejected and deleted,
  *  then, gets automatically suspended, cannot post more, until staff has had a look.
  *  Not implemented though! [auto_block]
  * @param trustLevel
  * @param lockedTrustLevel
  * @param threatLevel
  * @param lockedThreatLevel
  * @param isAdmin
  * @param isOwner
  * @param isModerator
  * @param isDeactivated
  * @param isDeleted
  */
case class UserBr(
  id: UserId,
  ssoId: Opt[SsoId],
  extId: Opt[ExtId],
  fullName: Option[String],
  theUsername: String,
  email: String,  // COULD RENAME to primaryEmailAddress
  emailNotfPrefs: EmailNotfPrefs,
  emailVerifiedAt: Option[ju.Date] = None,
  passwordHash: Option[String] = None,  // OPTIMIZE no need to always load? Move to MemberInclDetails?
  privPrefs: MemberPrivacyPrefs,
  tinyAvatar: Option[UploadRef] = None,
  smallAvatar: Option[UploadRef] = None,
  isApproved: Option[Boolean],
  suspendedTill: Option[ju.Date],
  blocked: Int = 0,  // [auto_block] change to Option[BlockedReason] ?
  trustLevel: TrustLevel = TrustLevel.NewMember,  // RENAME to autoTrustLevel
  lockedTrustLevel: Option[TrustLevel] = None,
  threatLevel: ThreatLevel = ThreatLevel.HopefullySafe,  // RENAME to autoRiskLevel
  lockedThreatLevel: Option[ThreatLevel] = None,
  isAdmin: Boolean = false,
  isOwner: Boolean = false,
  isModerator: Boolean = false,
  override val isDeactivated: Boolean = false,
  override val isDeleted: Boolean = false,
  )
  extends UserBase {

  def primaryEmailAddress: String = email

  def emailVerified: Bo = emailVerifiedAt.isDefined

  def canReceiveEmail: Boolean =  // dupl (603RU430)
    primaryEmailAddress.nonEmpty && emailVerifiedAt.isDefined

  def anyName: Option[String] = fullName
  def username: Option[String] = Some(theUsername)

  def nameAndUsername: NameAndUsername =
    NameAndUsername(id = id, fullName = fullName.getOrElse(""), username = theUsername,
          mayMentionMeTrLv = privPrefs.mayMentionMeTrLv)

  def effectiveTrustLevel: TrustLevel = lockedTrustLevel getOrElse trustLevel
  def effectiveThreatLevel: ThreatLevel = lockedThreatLevel getOrElse threatLevel

  require(!fullName.map(_.trim).contains(""), "DwE4GUK28")
  require(Participant.isOkayUserId(id), "DwE02k12R5")
  require(theUsername.length >= 2, "EsE7YKW3")
  require(!isEmailLocalPartHidden(email), "DwE6kJ23")
  require(tinyAvatar.isDefined == smallAvatar.isDefined, "EdE5YPU2")
}



trait MemberMaybeDetails {
  def theUsername: String
  def fullName: Option[String]
  def usernameHashId: String
  def primaryEmailAddress: String
  def emailVerified: Bo
  def nameOrUsername: String = fullName getOrElse theUsername

  def usernameParensFullName: String = fullName match {
    case Some(name) => s"$theUsername ($name)"
    case None => theUsername
  }
}



case class Anonym(
  id: PatId,
  createdAt: When,
  anonStatus: AnonStatus,
  anonForPatId: PatId,   // rename to trueId
  anonOnPageId: PageId,
  ) extends Pat with GuestOrAnon {

  def nameOrUsername: St = "Anonym"
  override def anyName: Opt[St] = Some(nameOrUsername)
  override def usernameOrGuestName: St =  nameOrUsername

  def extId: Opt[ExtId] = None
  def noDetails: Pat = this

  def email: EmailAdr = ""
  def emailNotfPrefs: EmailNotfPrefs = EmailNotfPrefs.Unspecified
  def tinyAvatar: Opt[UploadRef] = None
  def smallAvatar: Opt[UploadRef] = None
  def suspendedTill: Opt[ju.Date] = None // for now

  def isAdmin: Bo = false
  def isOwner: Bo = false
  def isModerator: Bo = false
  def isSuperAdmin: Bo = false
  override def isBuiltIn: Bo = false
  override def isAnon: Bo = true

  // Never deactivate or delete. If the underlying real user deactivates hens account,
  // don't deactivate the anonym — that'd make it simpler to know who the anonym is
  // (if gets deactivated at the same time).
  override def isDeactivated: Bo = false
  override def isDeleted: Bo = false

  // Currently only approved users may use anonyms, so, for now:
  def effectiveTrustLevel: TrustLevel = TrustLevel.NewMember
  override def isAuthenticated: Bo = true

  // But the accounts haven't been approved?
  override def isApprovedOrStaff: Bo = false
}



case class ExternalUser(   // sync with test code [7KBA24Y]
  ssoId: St,
  extId: Opt[St],
  primaryEmailAddress: St,
  isEmailAddressVerified: Bo,
  username: Opt[St],
  fullName: Opt[St],
  avatarUrl: Opt[St],
  aboutUser: Opt[St],
  isAdmin: Bo,
  isModerator: Bo)(mab: MessAborter) {

  // COULD somehow return Bad instead? Or throw Forbidden — then need to move to the server module
  extId.flatMap(Validation.findExtIdProblem) foreach { problem =>
    mab.abort(s"Bad extId: $problem [TyE402TKUHR24]")
  }
  Validation.findSsoIdProblem(ssoId) foreach { problem =>
    mab.abort(s"Bad ssoId: $problem [TyE502WKDTTSR2]")
  }

  Validation.checkEmail(primaryEmailAddress).badMap(problem =>
    mab.abort("TyE5KBW02", o"""Bad email: '$primaryEmailAddress', for external user
          'ssoid:$ssoId', problem: $problem"""))
  mab.check(username.forall(_.isTrimmedNonEmpty), "TyE5KBW05")
  mab.check(fullName.forall(_.isTrimmedNonEmpty), "TyE5KBW06")
  mab.check(avatarUrl.forall(_.isTrimmedNonEmpty), "TyE5KBW07")
}


/** (Could split into Guest and GuestInclDetails, where emailAddress, createdAt and extId
  * are details. But no particular reason to do this — would maybe just add more code,
  * for no good reason.)
  *
  * Guests don't have any trust level, cannot get more than completely-new-user access.
  * However if a guest behaves well, hens *threat level* decreases (not yet implemented).
  */
case class Guest( // [exp] ok   REFACTOR split into GuestBr and GuestVb [guest_br_vb]
  id: UserId,
  extId: Option[ExtId],
  createdAt: When,  // only in GuestVb?
  guestName: String,
  guestBrowserId: Option[String],
  email: String, // COULD rename to emailAdr
  // Only in GuestVb: ------
  emailNotfPrefs: EmailNotfPrefs,
  override val about: Option[String] = None,
  override val website: Option[String] = None,
  override val country: Option[String] = None,
  // -----------------------
  lockedThreatLevel: Option[ThreatLevel] = None,
  )
  extends Participant with ParticipantInclDetails with GuestOrAnon with Someone {

  def isApprovedOrStaff = false
  def emailVerifiedAt: Option[ju.Date] = None
  def passwordHash: Option[String] = None
  def tinyAvatar: Option[UploadRef] = None
  def smallAvatar: Option[UploadRef] = None
  def isApproved: Option[Boolean] = None
  def isGroup = false
  def isAdmin: Boolean = false
  def isOwner: Boolean = false
  def isModerator: Boolean = false
  def isStaffOrMinTrustNotThreat(trustLevel: TrustLevel): Bo = false
  def suspendedTill: Option[ju.Date] = None
  def effectiveTrustLevel: TrustLevel = TrustLevel.NewMember  // or sometimes [StrangerWithSecret] or should that be another class?

  def anyName: Opt[St] = Some(guestName)
  def anyUsername: Opt[St] = None
  def usernameOrGuestName: String = guestName
  def nameOrUsername: String = guestName

  def noDetails: Participant = this

  require(isOkayGuestId(id), s"Bad guest id: $id, should be <= $MaxCustomGuestId [TyE4GYUK21]")
  require(guestName == guestName.trim, "Name starts or ends with whitespace [TyE5YGUK3]")
  require(guestName.nonEmpty, "Name is empty [TyEJ4KEPF8]")
  require(Participant.isOkayGuestBrowserdId(guestBrowserId),
    s"Bad guest browserd id: '$guestBrowserId' [TyE5W5QF7]")
  require(!isEmailLocalPartHidden(email), "TyE826kJ23")
}


sealed trait GuestOrAnon extends ParticipantInclDetails


/** Includes info about the pat that's usually not needed.
  */
sealed trait ParticipantInclDetails extends Pat {    RENAME   // to PatVb
  //f id: UserId
  //f extId: Option[ExtId]
  def createdAt: When
  def noDetails: Participant
  def about: Option[String] = None    ; RENAME // to bio
  def website: Option[String] = None  ; RENAME // to websiteUrl
  def country: Option[String] = None  ; SHOULD // CHANGE to  location somehow, opt incl city

  def asGroupOr(mab: MessAborter): Group = this match {
    case g: Group => g
    case _ => mab.abort("Not a group [TyE6502MRA6]")
  }
}



sealed trait MemberInclDetails extends ParticipantInclDetails {  RENAME // to MemberVb
  def summaryEmailIntervalMins: Option[Int]
  def summaryEmailIfActive: Option[Boolean]
  def privPrefs: MemberPrivacyPrefs

  def usernameLowercase: String

  /** UI features to enable or disable, or which UI variant to use. For A/B testing and
    * also in some cases for letting admins or users override the default settings
    * and make things look like they look for their community, or themselves.
    */
  def uiPrefs: Option[JsObject]

  def copyPrefs(uiPrefs: Opt[JsObject] = null, privPrefs: MemberPrivacyPrefs = null): MemberVb = {
    this match {
      case thiz: GroupVb =>
        thiz.copy(
              uiPrefs = if (uiPrefs ne null) uiPrefs else thiz.uiPrefs,
              privPrefs = if (privPrefs ne null) privPrefs else thiz.privPrefs,
              )
      case thiz: UserVb =>
        thiz.copy(
              uiPrefs = if (uiPrefs ne null) uiPrefs else thiz.uiPrefs,
              privPrefs = if (privPrefs ne null) privPrefs else thiz.privPrefs)
    }
  }
}


case class UserInclDetails( // ok for export
  id: UserId,
  extId: Option[ExtId] = None,
  ssoId: Option[String],
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
  override val about: Option[String] = None,
  override val website: Option[String] = None,
  override val country: Option[String] = None,
  tinyAvatar: Option[UploadRef] = None,
  smallAvatar: Option[UploadRef] = None,
  mediumAvatar: Option[UploadRef] = None,
  uiPrefs: Option[JsObject] = None,
  privPrefs: MemberPrivacyPrefs = MemberPrivacyPrefs.empty,
  isOwner: Boolean = false,
  isAdmin: Boolean = false,
  isModerator: Boolean = false,
  suspendedAt: Option[ju.Date] = None,
  suspendedTill: Option[ju.Date] = None,
  suspendedById: Option[UserId] = None,
  suspendedReason: Option[String] = None,
  trustLevel: TrustLevel = TrustLevel.NewMember, // RENAME to autoTrustLevel?
  lockedTrustLevel: Option[TrustLevel] = None,
  threatLevel: ThreatLevel = ThreatLevel.HopefullySafe, // RENAME to autoThreatLevel?
  lockedThreatLevel: Option[ThreatLevel] = None,
  deactivatedAt: Option[When] = None,
  deletedAt: Option[When] = None,
  )
  extends MemberInclDetails with UserBase {

  COULD; REFACTOR; QUICK // break out some of these tests to a fn shared with Group?

  extId.flatMap(Validation.findExtIdProblem) foreach { problem =>
    throwIllegalArgument("TyE2AKT057TM", s"Bad user extId: $problem")
  }

  ssoId.flatMap(Validation.findSsoIdProblem) foreach { problem =>
    throwIllegalArgument("TyE603WKVNF5", s"Bad user ssoId: $problem")
  }

  require(Participant.isOkayUserId(id), "DwE077KF2")
  require(username.length >= 2, "DwE6KYU9")
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


  override def isDeactivated: Boolean = deactivatedAt.isDefined
  override def isDeleted: Boolean = deletedAt.isDefined

  def effectiveTrustLevel: TrustLevel = lockedTrustLevel getOrElse trustLevel
  def effectiveThreatLevel: ThreatLevel = lockedThreatLevel getOrElse threatLevel

  def anyName: Opt[St] = fullName
  def theUsername: String = username
  def usernameLowercase: String = username.toLowerCase
  //def canonicalUsername: String = User.makeUsernameCanonical(username)  // [CANONUN]

  def extIdAsRef: Option[ParsedRef.ExternalId] = extId.map(ParsedRef.ExternalId)
  def ssoIdAsRef: Option[ParsedRef.SingleSignOnId] = ssoId.map(ParsedRef.SingleSignOnId)

  RENAME // to primaryEmailAddress?
  def email: St = primaryEmailAddress

  def emailVerified: Bo = emailVerifiedAt.isDefined

  def canReceiveEmail: Boolean =  // dupl (603RU430)
    primaryEmailAddress.nonEmpty && emailVerifiedAt.isDefined

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
    emailPref = emailNotfPrefs,
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
      emailNotfPrefs = preferences.emailPref,
      summaryEmailIntervalMins = preferences.summaryEmailIntervalMins,
      summaryEmailIfActive = preferences.summaryEmailIfActive,
      about = preferences.about,
      website = preferences.url)
  }


  def copyWithMaxThreatLevel(newThreatLevel: ThreatLevel): UserInclDetails =
    if (this.threatLevel.toInt >= newThreatLevel.toInt) this
    else copy(threatLevel = newThreatLevel)


  def copyWithUpdatedExternalData(extUser: ExternalUser, now: => When,
          tryFixBadValues: Bo): UserInclDetails = {

    // For now, require this, maybe not later:
    require(tryFixBadValues, "TyE406MRSET24")
    require(ssoId is extUser.ssoId,
          o"""Different ssoId:s: in the Ty database: $ssoId,
          but the external user "${extUser.ssoId}" TyE503RMG""")
    require(extUser.isEmailAddressVerified,
          o"""Ext user email not verified, ssoId: "${extUser.ssoId}" TyE503RMG""")

    val gotNewEmail = primaryEmailAddress != extUser.primaryEmailAddress
    val newEmailVerifiedAt = if (!gotNewEmail) emailVerifiedAt else {
      if (extUser.isEmailAddressVerified) Some(now.toJavaDate)
      else None
    }

    this.copy(
          ssoId = Some(extUser.ssoId),
          primaryEmailAddress = extUser.primaryEmailAddress,
          emailVerifiedAt = newEmailVerifiedAt,
          username = extUser.username getOrElse username,
          fullName = Validation.fixMaybeBadName(extUser.fullName) orElse fullName,
          // avatarUrl: Option[String],
          // aboutUser: Option[String],
          // Better wait with granting admin role via API
          // — e.g. may not promote a suspended user! [2BRUI8]
          // isAdmin: Boolean,
          // isModerator: Boolean
          )
  }


  def noDetails: Participant = briefUser


  def briefUser: UserBr = UserBr(   // RENAME? to just noDetails? see above ... No, to toBrief?
    id = id,
    ssoId = ssoId,
    extId = extId,
    fullName = fullName,
    theUsername = username,
    email = primaryEmailAddress,
    emailNotfPrefs = emailNotfPrefs,
    emailVerifiedAt = emailVerifiedAt,
    privPrefs = privPrefs,
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
  emailPref: EmailNotfPrefs,               //
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
  summaryEmailIntervalMins: Option[Int],    // REFACTOR break out to EmailPrefs [REFACTORNOTFS]
  summaryEmailIfActive: Option[Boolean]) {  //

  require(!fullName.exists(_.trim.isEmpty), "EdE05KFB521")
  require(groupId >= Participant.LowestNonGuestId, "DwE56KX2")

}



/** Currently ignore if configured for a Group. Later, will get inherited to group
  * members — then, among custom groups, most private settings wins (since privacy
  * is important).
  */
case class MemberPrivacyPrefs(
  seeActivityMinTrustLevel: Opt[TrustLevel],
  maySendMeDmsTrLv: Opt[TrustLevel],
  mayMentionMeTrLv: Opt[TrustLevel],
)


object MemberPrivacyPrefs {
  val empty: MemberPrivacyPrefs = MemberPrivacyPrefs(None, None, None)
}


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



object UnknownParticipant extends Participant {  // RENAME to Stranger?, and break out GuestAnonOrStranger?
  override def id: UserId = UnknownUserId
  override def extId: Opt[ExtId] = None
  override def email: String = ""
  override def emailNotfPrefs: EmailNotfPrefs = EmailNotfPrefs.DontReceive
  override def tinyAvatar: Option[UploadRef] = None
  override def smallAvatar: Option[UploadRef] = None
  override def suspendedTill: Option[Date] = None
  def isApprovedOrStaff = false
  def isAdmin = false
  def isOwner = false
  def isModerator = false
  def isGroup = false
  def isStaffOrMinTrustNotThreat(trustLevel: TrustLevel): Bo = false
  override def effectiveTrustLevel: TrustLevel = TrustLevel.NewMember ; SHOULD // CHANGE to TrustLevel.Stranger
  def usernameOrGuestName: String = UnknownUserName
  def nameOrUsername: String = UnknownUserName
  def anyName: Opt[St] = Some(UnknownUserName)
  def anyUsername: Opt[St] = None
}


case class GroupAndStats(group: Group, stats: Option[GroupStats])


/** Groups have a username but no trust level. Members have username and trust level.
  * A group can, however, auto-grant trust level 'grantsTrustLevel' to all its members.
  *
  * Groups can have permissions, e.g. max file upload size.
  */
case class Group( // [exp] missing: createdAt, add to MemberInclDetails & ParticipantInclDetails?
  id: UserId,
  theUsername: Username,
  name: Opt[St],
  extId: Opt[ExtId] = None,
  createdAt: When = When.Genesis, // for now
  // emailAddr: String  <— if adding later, don't forget to update this: [306KWUSSJ24]
  tinyAvatar: Opt[UploadRef] = None,
  smallAvatar: Opt[UploadRef] = None,
  summaryEmailIntervalMins: Opt[i32] = None,  // REFACTOR break out to EmailPrefs [REFACTORNOTFS] -----
  summaryEmailIfActive: Opt[Bo] = None,  //
  grantsTrustLevel: Opt[TrustLevel] = None,
  uiPrefs: Opt[JsObject] = None,
  privPrefs: MemberPrivacyPrefs = MemberPrivacyPrefs.empty,
  perms: PatPerms = PatPerms.empty,
)
  extends Member with MemberInclDetails {  // COULD split into two? One without, one with details

  require(id >= Group.EveryoneId, "TyE4J5RKH24")

  extId.flatMap(Validation.findExtIdProblem) foreach { problem =>
    throwIllegalArgument("TyE5KSH2R7H", s"Bad group extId: $problem")
  }

  require(!name.exists(_.trim.isEmpty), "TyE305MDW73")
  uiPrefs.flatMap(anyWeirdJsObjField) foreach { problemMessage =>
    die("TyE2AKBS05", s"Group with weird uiPrefs JSON field: $problemMessage")
  }

  def fullName: Option[String] = name

  def email: String = ""
  def passwordHash: Option[String] = None
  def emailVerifiedAt: Option[ju.Date] = None
  def emailNotfPrefs: EmailNotfPrefs = EmailNotfPrefs.DontReceive

  def isModerator: Boolean = id == Group.ModeratorsId
  def isAdmin: Boolean = id == Group.AdminsId
  def isOwner: Boolean = false
  def isApproved: Option[Boolean] = Some(true)
  def suspendedTill: Option[ju.Date] = None

  def noDetails: Participant = this

  def isGroup = true

  // Or maybe true for mod & admin groups? Currently doesn't matter.
  def isStaffOrMinTrustNotThreat(trustLevel: TrustLevel): Bo = false

  override def effectiveTrustLevel: TrustLevel = grantsTrustLevel getOrElse TrustLevel.NewMember

  def usernameLowercase: String = theUsername.toLowerCase

  //def canonicalUsername: String = User.makeUsernameCanonical(theUsername)   [CANONUN]

  def anyName: Option[String] = name

  def preferences: AboutGroupPrefs =
    AboutGroupPrefs(
      groupId = id,
      fullName = anyName,
      username = theUsername,
      summaryEmailIntervalMins = summaryEmailIntervalMins,
      summaryEmailIfActive = summaryEmailIfActive)

  def copyWithNewAboutPrefs(preferences: AboutGroupPrefs): Group =
    copy(
      name = preferences.fullName,
      theUsername = preferences.username,
      summaryEmailIntervalMins = preferences.summaryEmailIntervalMins,
      summaryEmailIfActive = preferences.summaryEmailIfActive)

}


object Group {
  REFACTOR // move to object User, rename User to Participant? [pps]

  /** Includes not-logged-in people (a.k.a. strangers) and guests, and all members. */
  val EveryoneId = 10
  // Everyone   (incl people w/o any account)
  // EveryoneWithAccount

  /** All higher trust level members are members of this group too. And so on:
    * members >= Basic are all members of Basic, too. So this group includes all
    * people who have created an account at the website.
    *
    * RENAME the NewMembers group to AllMembers, because totally sounds as if "new members"
    *     does *not* include full members and core members — but it does.
    *     "All members" obviously includes those other trust levels too.
    */
  val AllMembersId = 11

  val BasicMembersId = 12
  val FullMembersId = 13
  //  GoodMembersId = ?
  val TrustedMembersId = 14
  val RegularMembersId = 15  ; RENAME // to TrustedVeterans? In typescript  model.ts  too
  val CoreMembersId = 16
  /** Includes all admins and all moderators. */
  val StaffId = 17

  COULD // add db constraint that verifies not both admin & mod.
  /** A person is either an admin or a moderator, won't be in both groups. */
  val ModeratorsId = 18
  //  ModManagers = ?  // mods who may add/remove mods
  val AdminsId = 19

  val NumBuiltInGroups: Int = AdminsId - EveryoneId + 1

  def isBuiltInGroupId(groupId: UserId): Boolean = EveryoneId <= groupId && groupId <= AdminsId
  def isStaffGroupId(groupId: UserId): Boolean = StaffId <= groupId && groupId <= AdminsId

  dieUnless(EveryoneId == TrustLevel.Stranger.toInt + 10, "TyE305KTS3")
  dieUnless(AllMembersId == TrustLevel.NewMember.toInt + 10, "EdE7LPKW20")
  dieUnless(CoreMembersId == TrustLevel.CoreMember.toInt + 10, "EdE7LPKW21")
}


case class GroupParticipant(
  groupId: GroupId,
  ppId: UserId,
  isMember: Boolean,
  isManager: Boolean,
  isAdder: Boolean,
  isBouncer: Boolean) {

  require(groupId != ppId, "TyE05WTKJR4")
  require(groupId >= Group.AllMembersId, "TyE3062SKJL7")
  require(ppId >= LowestMemberId, "TyE3062SKJL4")
  // For now:
  require(isMember, "TyE406KTDR2")
  require(!isManager && !isAdder && !isBouncer, "TyE406KTDR3")
}


case class GroupStats(numMembers: Int)


sealed abstract class EmailNotfPrefs(val IntVal: Int) {
  def toInt: Int = IntVal
}

object EmailNotfPrefs {
  case object ReceiveAlways extends EmailNotfPrefs(5) // change to 1, bump others += 1
  case object Receive extends EmailNotfPrefs(1)       // RENAME to ReceiveIfAway
  case object DontReceive extends EmailNotfPrefs(2)
  case object ForbiddenForever extends EmailNotfPrefs(3)
  case object Unspecified extends EmailNotfPrefs(4)

  def fromInt(value: Int): Option[EmailNotfPrefs] = Some(value match {
    case ReceiveAlways.IntVal => ReceiveAlways
    case Receive.IntVal => Receive
    case DontReceive.IntVal =>  DontReceive
    case ForbiddenForever.IntVal =>  ForbiddenForever
    case Unspecified.IntVal =>  Unspecified
    case _ => return None
  })
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
  // May only be absent if importing comment authors from e.g. WordPress or Disqus
  // — but not when attempting to login.
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


@deprecated("Load email from Dao changePasswordCheckStrongEnough() instead, do everything from there")
case class EmailLoginAttempt(  // [306AS13]
  ip: String,
  date: ju.Date,
  emailId: String,
  mayLoginAgain: Boolean) extends MemberLoginAttempt {
}


case class OpenAuthLoginAttempt(
  ip: String,
  date: ju.Date,
  openAuthDetails: OpenAuthDetails) extends MemberLoginAttempt {

  def profileProviderAndKey: OpenAuthProviderIdKey = openAuthDetails.providerIdAndKey
}


/** A user might have many identities, e.g. an OpenAuth Google identity and
  * a Twitter identity.
  *
  * Try to remove?  UserIdentity (currently "OpenAuthIdentity" below) should be enough.
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

@deprecated("now")
case class IdentityOpenId(   // QUICK RENAME to OldOpenIdIdentity?
  id: IdentityId,
  override val userId: UserId,
  openIdDetails: OpenIdDetails) extends Identity {

  def displayName: String = openIdDetails.firstName
  def usesEmailAddress(emailAddress: String): Boolean =
    openIdDetails.email is emailAddress

  /** Needn't look nice, no one uses OpenID nowadays anyway? It's dead? */
  def loginMethodName = s"OpenID ${openIdDetails.oidEndpoint}"

}


case class OpenIdDetails(   // RENAME  to OldOpenId10Details? Or inline in
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


/**
 *
 * @param id identities_t primary key, not the same as OpenAuthDetails.idpUserId.
 * @param userId pats_t foreign key.
 * @param openAuthDetails
 */
case class OpenAuthIdentity(   // RENAME to  UserIdentity?
  id: IdentityId,  // CLEAN_UP change from String to Int
  override val userId: UserId,
  openAuthDetails: OpenAuthDetails) extends Identity {

  def usesEmailAddress(emailAddress: String): Boolean =
    openAuthDetails.email is emailAddress

  def loginMethodName: St =
    openAuthDetails.confFileIdpId getOrElse
        openAuthDetails.prettyIdpId

  require(userId >= LowestAuthenticatedUserId, "EdE4KFJ7C")
}


class OidcIdToken(val idTokenStr: St) {
  // Later OIDC id_token field values here.
}


// Merge with ExternalSocialProfile into ... ExtIdpUser? IdentityFromIdp? IdpIdentity?  Or just ExtIdentity or ExtIdpIdentity or Identity?
/**
  * OIDC standard claims:
  *   https://openid.net/specs/openid-connect-basic-1_0.html#StandardClaims
  *
  * @param confFileIdpId — from old Silhouette config. Will migrate to authn site IDPs?
  * @param idpId — for new db table & ScribeJava based config.
  * @param idpUserId — for OIDC, this is the 'sub' claim. For OAuth2-not-OIDC,
  *   it's something IDP specific.
  * @param idpRealmId — some providers, namely Azure AD, exposes a static tenant
  *   id — the Azure tenant id — which we here call Realm, since OIDC calls these
  *   things Realms. Useful when combined with idpRealmUserId.
  *   In Azure, this is the 'tid' claim (tenant id), and for personal
  *   accounts, it is: Oidc.AzurePersonalAccountTenantId.
  * @param idpRealmUserId — a per realm (e.g. Azure tenant) and user stable
  *   identifier — stays the same also if the OIDC client (Talkyard) gets a new
  *   client id and secret. Can be useful if integrating with other apps that connect
  *   to the same realm (the same Azure AD tenant), since then Talkyard and that
  *   other app know they're talking about the same user.  (However, Talkyard and
  *   the other app would see different OIDC 'sub' (subject) user identifiers.)
  *   If the same real life human connects to the same Talkyard server
  *   but via *a different realm* (logs in to Talkyard via a different Azure AD
  *   tenant), then idpRealmUserId would be different.
  *   In Azure AD, this is the 'oid' claim.
  * @param issuer — The OIDC 'iss' claim, i.e. the organization that sent us
  *   the user info / id_token.
  *   For Azure AD: Is based on the security token service and the Azure AD tenant
  *   the user authenticated against, and, Ty can use use the GUID portion
  *   of the claim to restrict the set of tenants that can sign in
  *   (not yet implemented or requested by anyone though).
  *   Azure AD consumer user accounts have id  Oidc.AzurePersonalAccountTenantId.
  *   The whole Azure AD 2.0 issuer format is:
  *   https://login.microsoftonline.com/1234abcd-1234-1234-1234-123456abcdef/v2.0 .
  * @param username — the preferred username. Can be whatever, e.g. an email
  *   address (in Azure AD) or a seemingly unique username *but* that in fact
  *   might not be unique. And can be something else, the next login.
  * @param nickname
  * @param firstName
  * @param lastName
  * @param fullName
  * @param email
  * @param isEmailVerifiedByIdp — the 'email_verified' claim. Azure AD doesn't
  *   include it, instead Azure has a 'verified_primary_email' claim but who
  *   knows if it's been verified or if it's just the name? The Azure docs is
  *   a bit unclear? [azure_claims_docs]
  *   https://docs.microsoft.com/en-us/azure/active-directory/develop/id-tokens
  * @param avatarUrl
  * @param isRealmGuest — in Azure, true iff the person is a realm (tenant) guest,
  *   but not an actual organization member.
  * @param idToken
  * @param userInfoJson
  */
case class OpenAuthDetails(   // [exp] ok use, country, createdAt missing, fine    RENAME to IdpUserInfo — typically is data from an IDP's OIDC userinfo endpoint (or id_token).  Started already, defined: type IdpUserInfo.
  confFileIdpId: Opt[ConfFileIdpId] = None,  // RENAME QUICK to serverGlobalIdpId
  idpId: Opt[IdpId] = None,
  idpUserId: St,
  idpRealmId: Opt[St] = None,
  idpRealmUserId: Opt[St] = None,
  issuer: Opt[St] = None,
  username: Opt[St] = None,  // RENAME to preferredUsername?
  nickname: Opt[St] = None,
  firstName: Opt[St] = None,
  middleName: Opt[St] = None,
  lastName: Opt[St] = None,
  fullName: Opt[St] = None,
  email: Opt[St] = None,
  isEmailVerifiedByIdp: Opt[Bo] = None,
  phoneNumber: Opt[St] = None,
  isPhoneNumberVerifiedByIdp: Opt[Bo] = None,
  profileUrl: Opt[St] = None,
  websiteUrl: Opt[St] = None,
  // Rename to pictureUrl? OIDC calls it 'picture_url'.
  avatarUrl: Opt[St] = None,
  gender: Opt[St] = None,
  birthdate: Opt[St] = None,
  timeZoneInfo: Opt[St] = None,
  country: Opt[St] = None,
  locale: Opt[St] = None,
  //roles: Seq[St] = Nil, — later. Azure.
  isRealmGuest: Opt[Bo] = None,
  lastUpdatedAtIdpAtSec: Opt[i64] = None,
  idToken: Opt[St] = None,
  userInfoJson: Opt[JsObject] = None) {

  require(confFileIdpId.forall(_.trim.nonEmpty), "TyE395RKTE2")
  require(confFileIdpId.isDefined != idpId.isDefined, "TyE205KRDJ2M")
  require(idpId.forall(_ >= 1), "TyE395RKTE3")
  require(idpUserId.nonEmpty, "TyE507Q5K42")
  require(email.isDefined || isEmailVerifiedByIdp.isNot(true), "TyE6JKRGL24")
  require(phoneNumber.isDefined || isPhoneNumberVerifiedByIdp.isNot(true), "TyE6JKRGL25")

  def providerIdAndKey: OpenAuthProviderIdKey =
    OpenAuthProviderIdKey(
          confFileIdpId = confFileIdpId,
          idpId = idpId,
          idpUserId = idpUserId)

  def isSiteCustomIdp: Bo = idpId.isDefined
  def isServerGlobalIdp: Bo = confFileIdpId.isDefined

  def prettyIdpId: St = IdentityProvider.prettyId(confFileIdpId, idpId = idpId)

  def displayNameOrEmpty: String = {
    fullName.orElse({
      if (firstName.isDefined && lastName.isDefined) Some(firstName.get + " " + lastName.get)
      else None
    }).orElse(firstName).orElse(lastName) getOrElse ""
  }

  def anyUsernameNameEmail: Opt[St] = {
    val sb = StringBuilder.newBuilder
    val dispName = displayNameOrEmpty
    if (username.isDefined) {
      sb.append("@").append(username.get)
      if (dispName.nonEmpty || email.nonEmpty) sb.append(" ")
    }
    if (dispName.nonEmpty) {
      sb.append(dispName)
      if (email.nonEmpty) sb.append(" ")
    }
    if (email.nonEmpty) {
      sb.append(email)
      if (isEmailVerifiedByIdp isNot true) sb.append(" (unverified)")
    }
    sb.toString.trimNoneIfEmpty
  }


  def nameOrUsername: Opt[St] = {
    val n = displayNameOrEmpty
    if (n.nonEmpty) Some(n)
    else username
  }

  // Mixed case email addresses not allowed, for security reasons. See db fn email_seems_ok.
  def emailLowercasedOrEmpty: String = email.map(_.toLowerCase) getOrElse ""

}



object Oidc {
  val AzurePersonalAccountTenantId = "9188040d-6c67-4c5b-b112-36a304b66dad"
  val AzureIssuerPrefix = "https://login.microsoftonline.com/"
  val AzureTenantGuestAccountType = 1
}



case class OpenAuthProviderIdKey(
  confFileIdpId: Opt[ConfFileIdpId],
  idpId: Opt[IdpId],
  idpUserId: St) {

  require(confFileIdpId.isDefined != idpId.isDefined, "TyE305MKTFJ4")
  require(idpUserId.nonEmpty, "TyE39M5RK4TK2")
}


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
  val Missing = BrowserIdData("0.0.0.0", None, NoFingerprint)
  val System = BrowserIdData("127.0.0.1", None, NoFingerprint)
  val Forgotten = BrowserIdData("127.0.0.2", None, NoFingerprint)
}


/**
  *
  * @param emailBounceSum Somewhat taking into account bounce rates of earlier addresses?
  * @param numSolutionsProvided How many accepted answers/solutions this user has posted.
  *
  * Not 100% accurate. [BADSTATS]
  */
case class UserStats(   // RENAME  to PatDynData
  userId: UserId,
  snoozeUntil: Option[When] = None,
  // SHOULD update based on browser activity
  // Change to Option? If user upserted via API but has never actually visited the forum?
  // And change firstSeenAtOr0 to Option[When] too? (5032957635)
  lastSeenAt: When = When.fromMillis(0),
  // Later: lastSeenAtIp, lastBrowserIdCookie, lastBrowserFingerprint?
  // Then also include that lastX stuff in the download-my-personal-data response [6LKKEZW2].
  lastPostedAt: Option[When] = None,
  lastEmailedAt: Option[When] = None,
  lastSummaryEmailAt: Option[When] = None, // RENAME to lastSummaryAt, & db field too
  nextSummaryEmailAt: Option[When] = None, // RENAME to nextSummaryMaybeAt,   & db field too
  emailBounceSum: Float = 0f,
  // Change to Option[When] instead? and lastSeenAt too; see comment above. (5032957635)
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
    require(numLikesReceived >= 0, "TyE4GKWL016")  // [numLikesReceived]
    require(numSolutionsProvided >= 0, "TyE4GKWL017")
  }


  def isSnoozing(now: When): Boolean = {
    snoozeUntil.exists(_.millis > now.millis)
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

  def filterTipsSeen(tipsPrefix: St, keep: Bo): UserStats = {
    // To show a tips again, we remove it from the tips-seen list — that is,
    // we say False to filter().
    copy(tourTipsSeen = tourTipsSeen.map(_.filter { tipsId =>
      tipsId.startsWith(tipsPrefix) == keep
    }))
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
  val UnknownMember = VisitTrust(0, TrustLevel.NewMember.toInt)  ; SHOULD // CHANGE to TrustLevel.Stranger
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
