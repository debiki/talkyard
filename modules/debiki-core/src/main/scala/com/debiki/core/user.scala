/**
 * Copyright (C) 2011-2012 Kaj Magnus Lindberg (born 1979)
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

import java.{util => ju}
import org.scalactic.{Or, Every, ErrorMessage}
import EmailNotfPrefs.EmailNotfPrefs
import Prelude._
import User.{isRoleId, isGuestId, checkId}


object People {
  val None = People(Nil)
}


// COULD remove, use a Map[UserId, User] instead?
//
case class People(users: List[User] = Nil) {

  def + (user: User) = copy(users = user :: users)

  def ++ (people: People) = People(users = people.users ::: users)

  def user(id: String): Option[User] =
    if (id == SystemUser.User.id)
      Some(SystemUser.User)
    else if (id == UnknownUser.Id)
      Some(UnknownUser.User)
    else
      users.find(_.id == id)  // COULD optimize

  def user_!(id: String): User = user(id) getOrElse runErr(
    "DwE730krq849", "User not found: "+ safed(id))

}


sealed abstract class NewUserData {
  def name: String
  def username: String
  def email: String
  def emailVerifiedAt: Option[ju.Date]

  def userNoId = User(
    id = "?",
    displayName = name,
    username = Some(username),
    createdAt = None,
    email = email,
    emailNotfPrefs = EmailNotfPrefs.Unspecified,
    emailVerifiedAt = emailVerifiedAt,
    country = "",
    website = "",
    isAdmin = false,
    isOwner = false)

  def identityNoId: Identity

  Validation.checkName(name)
  Validation.checkUsername(username)
  Validation.checkEmail(email)

}



case class NewPasswordUserData(
  name: String,
  username: String,
  email: String,
  password: String,
  isAdmin: Boolean) {

  val passwordHash: String =
    DbDao.saltAndHashPassword(password)

  def userNoId = User(
    id = "?",
    displayName = name,
    username = Some(username),
    createdAt = None,
    email = email,
    emailNotfPrefs = EmailNotfPrefs.Unspecified,
    emailVerifiedAt = None,
    passwordHash = Some(passwordHash),
    country = "",
    website = "",
    isAdmin = isAdmin,
    isOwner = false)

  Validation.checkName(name)
  Validation.checkUsername(username)
  Validation.checkEmail(email)
  Validation.checkPassword(password)
}


object NewPasswordUserData {
  def create(name: String, username: String, email: String, password: String, isAdmin: Boolean)
        : NewPasswordUserData Or ErrorMessage = {
    for {
      okName <- Validation.checkName(name)
      okUsername <- Validation.checkUsername(username)
      okEmail <- Validation.checkEmail(email)
      okPassword <- Validation.checkPassword(password)
    }
    yield {
      NewPasswordUserData(name = okName, username = okUsername, email = okEmail,
        password = okPassword, isAdmin = isAdmin)
    }
  }
}



case class NewOauthUserData(
  name: String,
  username: String,
  email: String,
  emailVerifiedAt: Option[ju.Date],
  identityData: OpenAuthDetails) extends NewUserData {

  def identityNoId =
    OpenAuthIdentity(id = "?", userId = "?", openAuthDetails = identityData)
}


object NewOauthUserData {
  def create(name: String, email: String, emailVerifiedAt: Option[ju.Date], username: String,
        identityData: OpenAuthDetails): NewOauthUserData Or ErrorMessage = {
    for {
      okName <- Validation.checkName(name)
      okUsername <- Validation.checkUsername(username)
      okEmail <- Validation.checkEmail(email)
    }
    yield {
      NewOauthUserData(name = okName, username = okUsername, email = okEmail,
        emailVerifiedAt = emailVerifiedAt, identityData = identityData)
    }
  }
}



case class NameAndUsername(fullName: String, username: String)



case object UserIdData {

  /** For test suites. */
  def newTest(userId: UserId, ip: String = "111.112.113.114") =
    UserIdData(userId, ip, browserIdCookie = None, browserFingerprint = 0)

}


case class UserIdData(
  userId: UserId,
  ip: String,
  browserIdCookie: Option[String],
  browserFingerprint: Int) {

  require(userId.nonEmpty, "DwE182WH9")
  require(ip.nonEmpty, "DwE6G9F0")
  require(browserIdCookie.map(_.isEmpty) != Some(true), "DwE3GJ79")

  def anyGuestId: Option[String] =
    if (isGuestId(userId)) Some(userId drop 1) else None

  def anyRoleId: Option[String] =
    if (isRoleId(userId)) Some(userId) else None

  def isAnonymousUser = ip == "0.0.0.0"
  def isUnknownUser = userId == UnknownUser.Id
  def isSystemUser = userId == SystemUser.User.id

}



case object User {

  def isGuestId(userId: UserId) = userId.startsWith("-") && userId.length > 1
  def isRoleId(userId: UserId) = !isGuestId(userId) && userId.nonEmpty

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
    if (email matches """.+@.+\..+""") return false
    true
  }


  /**
   * Allows all chars but control chars, space and < >
   */
  def urlIsWeird(url: String): Boolean = {
    for (c <- url if c < 0x80) {
      if (c <= ' ') return true  // forbid control chars and space
      if ("<>" contains c) return true
      if (c == 127) return true  // control char?
    }
    false
  }


  def checkId(id: String, errcode: String) {
    if (id == "") assErr(errcode, "Empty ID ")
    if (id == "0") assErr(errcode, "ID is `0' ")
    // "?" is okay, means unknown.
  }

}


/* Could use:
sealed abstract class UserId
case class GuestId(String) extends UserId
case class RoleId(String) extends UserId
-- instead of setting User.id to "-<some-id>" for IdentitySimple,
  and "<some-id>" for Role:s.
*/


/**
 *
 * @param id Starts with "-" for guest users. COULD replace with UserId (see above).
 * @param displayName
 * @param username Is None for guests, and some old users created before usernames had
 *    been implemented.
 * @param createdAt None for guests.
 * @param email
 * @param emailNotfPrefs
 * @param emailVerifiedAt
 * @param country
 * @param website COULD rename to url, that's more generic.
 * @param isAdmin
 * @param isOwner
 */
case class User (
  id: String,
  displayName: String,
  username: Option[String],
  createdAt: Option[ju.Date],
  email: String,  // COULD rename to emailAddr
  emailNotfPrefs: EmailNotfPrefs,
  emailVerifiedAt: Option[ju.Date] = None,
  passwordHash: Option[String] = None,
  country: String = "",
  website: String = "",
  isAdmin: Boolean = false,
  isOwner: Boolean = false
){
  checkId(id, "DwE02k125r")
  def isAuthenticated = isRoleId(id) && !id.startsWith("?")

  def isGuest = User.isGuestId(id)
  def anyRoleId: Option[String] = if (isRoleId(id)) Some(id) else None
  def anyGuestId: Option[String] = if (isGuestId(id)) Some(id drop 1) else None
  def theRoleId: String = anyRoleId getOrDie "DwE035SKF7"
  def theGuestId: String = anyGuestId getOrDie "DwE5GK904"

}


/**
 * Used when searching for users.
 */
case class UserQuery()


object EmailNotfPrefs extends Enumeration {
  type EmailNotfPrefs = Value
  val Receive, DontReceive, ForbiddenForever, Unspecified = Value
}


case class RolePageSettings(
  notfLevel: PageNotfLevel)

object RolePageSettings {
  val Default = RolePageSettings(PageNotfLevel.Regular)
}


sealed abstract class LoginAttempt {
  def ip: String
  def date: ju.Date
}


case class GuestLoginAttempt(
  ip: String,
  date: ju.Date,
  name: String,
  email: String = "",
  location: String = "",
  website: String = "")

case class GuestLoginResult(user: User, isNewUser: Boolean)


case class PasswordLoginAttempt(
  ip: String,
  date: ju.Date,
  email: String,
  password: String) extends LoginAttempt {
}


case class EmailLoginAttempt(
  ip: String,
  date: ju.Date,
  emailId: String) extends LoginAttempt {
}


case class OpenIdLoginAttempt(
  ip: String,
  date: ju.Date,
  openIdDetails: OpenIdDetails) extends LoginAttempt {
}


case class OpenAuthLoginAttempt(
  ip: String,
  date: ju.Date,
  openAuthDetails: OpenAuthDetails) extends LoginAttempt {

  def profileProviderAndKey = openAuthDetails.providerIdAndKey
}


/**
 * A user might have many identities, e.g. an OpenID Gmail identity and
 * a Twitter identity.
 * COULD tease apart inheritance:
 *  Split into three unrelated classes 1) EmailLinkLogin, 2) Guest and
 *  3) Identity, with:
 *      authn: AuthnOpenId(...), AuthnOAuth1(...) & 2, AuthnPassword(...)
 *      identityProvider: Gmail, Facebook, Twitter, Local, ...)
 */
sealed abstract class Identity {

  /** A local id, not a guid. -- hmm, no, it'll be a database *unique* id?!
   *
   *  For example, if a user is loaded for inclusion on page X,
   *  its id might be another from when loaded for display on
   *  another page Y.
   *
   *  At least for NoSQL databses (e.g. Cassandra) the id will probably
   *  vary from page to page. Because the user data is probably denormalized:
   *  it's included on each page where the user leaves a reply!
   *  For relational databases, however, the id might be the same always,
   *  on all pages. Instead of denormalizing data, indexes and table joins
   *  are used.
   */
  def id: String
  def userId: String

  checkId(id, "DwE02krc3g")
  checkId(userId, "DwE864rsk215")
}


/**
 * By specifying an id of an email that has been sent to you,
 * you can login. This login type is insecure (email transmission is
 * not secure) and only used for unsubscriptions.
 * @param id The email id. Should refer to an email that has already
 *  been saved in the database.
 * @param userId The user that received the email. Not known before
 *  login (is "?").
 * @param emailSent Not known before login (is `None`)
 */
case class IdentityEmailId(
  id: String,
  userId: String = "?",
  emailSent: Option[Email] = None
) extends Identity {
  // Either only email id known, or all info known.
  require((userId startsWith "?") == emailSent.isEmpty)
}


case class IdentityOpenId(
  id: String,
  override val userId: String,
  openIdDetails: OpenIdDetails) extends Identity {

  def displayName = openIdDetails.firstName
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

  def displayName = openAuthDetails.displayName
}


case class OpenAuthDetails(
  providerId: String,
  providerKey: String,
  firstName: Option[String] = None,
  lastName: Option[String] = None,
  fullName: Option[String] = None,
  email: Option[String] = None,
  avatarUrl: Option[String] = None) {

  def providerIdAndKey = OpenAuthProviderIdKey(providerId, providerKey)
  def displayName = firstName.orElse(fullName).getOrElse("(unknown name)")
}


case class OpenAuthProviderIdKey(providerId: String, providerKey: String)


case class LoginGrant(
   identity: Option[Identity],
   user: User,
   isNewIdentity: Boolean,
   isNewRole: Boolean) {

  require(identity.map(_.id.contains('?')) != Some(true))
  require(!user.id.contains('?'))
  require(identity.map(_.userId == user.id) != Some(false))
  require(!isNewRole || isNewIdentity)

  def displayName: String = user.displayName
  def email: String = user.email

  /** For test suites. */
  def testUserIdData =
    UserIdData.newTest(userId = user.id)
}


/** A user that voted on a comment but was not logged in.
  */
object UnknownUser {

  /** "-" means it's not a role, it's a guest. "3" is the next number after the
    * first two magic id, which are "1" for the system user and "2" for the dummy
    * author user (see DummyPage.scala).
    */
  val Id = "-3"

  val User = com.debiki.core.User(id = Id, displayName = "(unknown user)", username = None,
    createdAt = None, email = "", emailNotfPrefs = EmailNotfPrefs.DontReceive,
    emailVerifiedAt = None, isAdmin = false)

}



/**
 * Used when things are inserted automatically into the database,
 * e.g. an automatically generated default homepage, for a new website.
 */
object SystemUser {

  import com.debiki.core

  val Ip = "SystemUserIp"

  val User = core.User(id = "1", displayName = "System", username = None,
    createdAt = None, email = "", emailNotfPrefs = EmailNotfPrefs.DontReceive,
    emailVerifiedAt = None, isAdmin = true)

  val Person = People(List(User))

  val UserIdData = core.UserIdData(
    userId = SystemUser.User.id,
    ip = Ip,
    browserIdCookie = None,
    browserFingerprint = 0)

}


// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list

