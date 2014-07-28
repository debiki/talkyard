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
import EmailNotfPrefs.EmailNotfPrefs
import Prelude._
import User.{isRoleId, isGuestId, checkId}


object People {
  val None = People(Nil, Nil, Nil)
}


case class People(
  logins: List[Login] = Nil,
  identities: List[Identity] = Nil,
  users: List[User] = Nil) {

  def + (login: Login) = copy(logins = login :: logins)
  def + (identity: Identity) = copy(identities = identity :: identities)
  def + (user: User) = copy(users = user :: users)

  def ++ (people: People) = People(
    logins = people.logins ::: logins,
    identities = people.identities ::: identities,
    users = people.users ::: users)


  def nilo(loginId: String): Option[NiLo] =
    login(loginId).map(new NiLo(this, _))

  def nilo_!(loginId: String): NiLo = new NiLo(this, login_!(loginId))


  // -------- Logins

  def login(id: String): Option[Login] =
    logins.find(_.id == id)  // COULD optimize

  def login_!(id: String): Login =
    login(id) getOrElse runErr("DwE8K3520z23", s"Login not found: $id")


  // -------- Identities

  def identity(id: String): Option[Identity] =
    identities.find(_.id == id)  // COULD optimize

  def identity_!(id: String): Identity = identity(id) getOrElse runErr(
    "DwE021kr3k09", "Identity not found: "+ safed(id))


  // -------- Users

  def user(id: String): Option[User] =
    if (id == SystemUser.User.id) Some(SystemUser.User)
    else users.find(_.id == id)  // COULD optimize

  def user_!(id: String): User = user(id) getOrElse runErr(
    "DwE730krq849", "User not found: "+ safed(id))

}


/**
 * A Nice Login: a Login, Identity an User tuple, and utility methods.
 */
class NiLo(people: People, val login: Login) {

  def user: Option[User] = people.user(identity_!.userId)
  def user_! : User = people.user_!(identity_!.userId)
  def identity_! : Identity = people.identity_!(login.identityRef.identityId)

  def displayName = user_!.displayName
  def email = user_!.email

}



case object UserIdData {

  /** For test suites. */
  def newTest(loginId: LoginId, userId: UserId, ip: String = "111.112.113.114") =
    UserIdData(Some(loginId), userId, ip, browserIdCookie = None, browserFingerprint = 0)

}


case class UserIdData(
  loginId: Option[LoginId],
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


case class User (
  /** The user's id. Starts with "-" if not authenticated
   *  (i.e. for IdentitySimple).
   *  COULD replace with UserId (see above) */
  id: String,
  displayName: String,
  // COULD be an Option -- Twitter identities have no email?
  // Or introduce a Address class, with subclasses AddrEmail, AddrTwitter, etc?
  // Or let it be an Option[String], and the format determine the address type?
  // And rename emailNotfPrefs to notfPrefs?
  email: String,  // COULD rename to emailAddr
  emailNotfPrefs: EmailNotfPrefs,
  country: String = "",
  website: String = "",
  isAdmin: Boolean = false,
  isOwner: Boolean = false
){
  checkId(id, "DwE02k125r")
  def isAuthenticated = isRoleId(id) && !id.startsWith("?")

  /* COULD add:
    def roleId: Option[String] =
    if (isRoleId(userId)) Some(userId) else None

  def idtySmplId: Option[String] =
    if (isGuestId(userId)) Some(userId drop 1) else None
   */
}


/**
 * Used when searching for users.
 */
case class UserQuery()


object EmailNotfPrefs extends Enumeration {
  type EmailNotfPrefs = Value
  val Receive, DontReceive, ForbiddenForever, Unspecified = Value
}


sealed abstract class LoginAttempt {
  def ip: String
  def date: ju.Date
  def prevLoginId: Option[LoginId]
}


case class GuestLoginAttempt(
  ip: String,
  date: ju.Date,
  prevLoginId: Option[LoginId],
  name: String,
  email: String = "",
  location: String = "",
  website: String = "") extends LoginAttempt


case class PasswordLoginAttempt(
  ip: String,
  date: ju.Date,
  prevLoginId: Option[LoginId],
  email: String,
  password: String) extends LoginAttempt {
}


case class EmailLoginAttempt(
  ip: String,
  date: ju.Date,
  emailId: String) extends LoginAttempt {
  def prevLoginId = None
}


case class OpenIdLoginAttempt(
  ip: String,
  date: ju.Date,
  prevLoginId: Option[LoginId],
  openIdDetails: OpenIdDetails) extends LoginAttempt {
}


case class OpenAuthLoginAttempt(
  ip: String,
  date: ju.Date,
  prevLoginId: Option[LoginId],
  openAuthDetails: OpenAuthDetails) extends LoginAttempt {

  def profileProviderAndKey = openAuthDetails.providerIdAndKey
}


case class Login(
  id: String,
  prevLoginId: Option[String],
  ip: String,
  date: ju.Date,
  identityRef: IdentityRef) {
  checkId(id, "DwE093jxh12")
}


object Login {

  def fromLoginAttempt(loginAttempt: LoginAttempt, loginId: LoginId, identityRef: IdentityRef) =
    Login(
      loginId,
      loginAttempt.prevLoginId,
      ip = loginAttempt.ip,
      date = loginAttempt.date,
      identityRef = identityRef)
}


sealed abstract class IdentityRef {
  def identityId: IdentityId
  checkId(identityId, "DwE56CWf8")
}

object IdentityRef {
  case class Email(identityId: IdentityId) extends IdentityRef
  case class Guest(identityId: IdentityId) extends IdentityRef
  case class Role(identityId: IdentityId) extends IdentityRef
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
  def reference: IdentityRef = IdentityRef.Role(id)

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

  override def reference: IdentityRef = IdentityRef.Email(id)
}


case class IdentitySimple(
  id: String,
  override val userId: String,
  name: String,  // COULD reject weird chars, e.g. '?' or '|'
                 // Or fix later (and replace any weird chars already in db)
  email: String = "",
  location: String = "",
  website: String = ""
  // COULD include signed cookie random value, so we knows if is same browser.
) extends Identity {
  def displayName = name
  // Cannot check for e.g. weird name or email. That could prevent
  // loading of data from database, after changing the weirdness rules.
  // Don't:  require(! (User nameIsWeird name))

  override def reference: IdentityRef = IdentityRef.Guest(id)
}


case class PasswordIdentity(
  id: IdentityId,
  override val userId: UserId,
  email: String = "",
  passwordSaltHash: String) extends Identity {

  override def reference = IdentityRef.Role(id)
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

  def isGoogleLogin = oidEndpoint == IdentityOpenId.GoogleEndpoint

}


object IdentityOpenId {

  val GoogleEndpoint = "https://www.google.com/accounts/o8/ud"

  object ProviderIdentifier {
    val Google = "https://www.google.com/accounts/o8/id"
    val Yahoo = "http://me.yahoo.com/"
  }

}


case class OpenAuthIdentity(
  id: IdentityId,
  override val userId: UserId,
  openAuthDetails: OpenAuthDetails) extends Identity {

  override def reference = IdentityRef.Role(id)
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
   login: Login,
   identity: Identity,
   user: User,
   isNewIdentity: Boolean,
   isNewRole: Boolean) {

  require(!login.id.contains('?'))
  require(!identity.id.contains('?'))
  require(!user.id.contains('?'))
  require(login.identityRef.identityId == identity.id)
  require(identity.userId == user.id)
  require(!isNewRole || isNewIdentity)

  def displayName: String = user.displayName
  def email: String = user.email

  /** For test suites. */
  def testUserIdData =
    UserIdData.newTest(login.id, userId = user.id, ip = login.ip)
}


/** A user that voted on a comment but was not logged in.
  */
object UnknownUser {

  /** "-" means it's not a role, it's a guest. "3" is the next number after the
    * first two magic id, which are "1" for the system user and "2" for the dummy
    * author user (see DummyPage.scala).
    */
  val Id = "-3"

}



/**
 * Used when things are inserted automatically into the database,
 * e.g. an automatically generated default homepage, for a new website.
 */
object SystemUser {

  import com.debiki.core

  val Ip = "SystemUserIp"

  val User = core.User(id = "1", displayName = "System", email = "",
    emailNotfPrefs = EmailNotfPrefs.DontReceive, isAdmin = true)

  val Person = People(Nil, Nil, List(User))

  val UserIdData = core.UserIdData(
    loginId = None,
    userId = SystemUser.User.id,
    ip = Ip,
    browserIdCookie = None,
    browserFingerprint = 0)

}


// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list

