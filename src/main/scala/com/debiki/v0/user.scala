/**
 * Copyright (c) 2011-2012 Kaj Magnus Lindberg (born 1979)
 */

package com.debiki.v0

import java.{util => ju}
import EmailNotfPrefs.EmailNotfPrefs
import Prelude._
import User.checkId


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

  /**
   * Returns a NiLo with info on the author of the post.
   */
  def authorOf_!(action: Action): NiLo = {  // COULD rename to loginFor?
                                         // or return a User?
    new NiLo(this, login_!(action.loginId))
  }

  def loginFor_!(action: ViAc): NiLo =
    new NiLo(this, login_!(action.loginId))

  def nilo(loginId: String): Option[NiLo] =
    login(loginId).map(new NiLo(this, _))

  def nilo_!(loginId: String): NiLo = new NiLo(this, login_!(loginId))

  // -------- Logins

  // COULD optimize.
  def login(id: String): Option[Login] = logins.find(_.id == id)
  def login_!(id: String): Login = login(id) getOrElse runErr(
    "DwE8K3520z23", "Login not found: "+ safed(id))

  def identity(id: String): Option[Identity] = identities.find(_.id == id)
  def identity_!(id: String): Identity = identity(id) getOrElse runErr(
    "DwE021kr3k09", "Identity not found: "+ safed(id))


  // -------- Users

  // COULD optimize.
  def user(id: String): Option[User] = users.find(_.id == id)
  def user_!(id: String): User = user(id) getOrElse runErr(
    "DwE730krq849", "User not found: "+ safed(id))

  // COULD create Action parent class, use instead of Edit.
  //def authorOf(e: Edit): Option[User] =
  //login(e.loginId).flatMap((l: Login) => user(l.userId))

  //def authorOf_!(e: Edit): User = user_!(login_!(e.loginId).userId)
}


/**
 * A Nice Login: a Login, Identity an User tuple, and utility methods.
 */
class NiLo(people: People, val login: Login) {

  def user: Option[User] = people.user(identity_!.userId)
  def user_! : User = people.user_!(identity_!.userId)
  def identity_! : Identity = people.identity_!(login.identityId)

  def displayName: String = {
    // (Somewhat dupl code: this also done in LoginGrant.displayName.)
    var n = user_!.displayName
    if (n nonEmpty) n else identity_!.displayName
  }

  def email: String = {
    var e = user_!.email
    if (e nonEmpty) e else identity_!.email
  }
}


case object User {

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
case class UserUnauId(String) extends UserId
case class UserRoleId(String) extends UserId
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
  country: String,
  website: String,
  isAdmin: Boolean,
  isOwner: Boolean
){
  checkId(id, "DwE02k125r")
  def isAuthenticated = !id.startsWith("-") && !id.startsWith("?")

  /* COULD add:
    def roleId: Option[String] =
    if (userId startsWith "-") None else Some(userId)

  def idtySmplId: Option[String] =
    if (userId startsWith "-") Some(userId drop 1) else None
   */
}


object EmailNotfPrefs extends Enumeration {
  type EmailNotfPrefs = Value
  val Receive, DontReceive, ForbiddenForever, Unspecified = Value
}


case class Login(
  id: String,
  prevLoginId: Option[String],
  ip: String,
  date: ju.Date,
  identityId: String // COULD rename to `identity`, which would be an instance
                     // of one of IdentityId, GuestId, EmailId.
){
  checkId(id, "DwE093jxh12")
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
  def displayName: String
  /** E.g. Twitter identities have no email? */
  def email: String  // COULD change to Option[String]!

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
 * @param notf Not known before login (is `None`)
 */
case class IdentityEmailId(
  id: String,
  userId: String = "?",
  emailSent: Option[EmailSent] = None,
  notf: Option[NotfOfPageAction] = None
) extends Identity {
  // Either only email id known, or all info known.
  require((userId startsWith "?") == emailSent.isEmpty)
  require(emailSent.isDefined == notf.isDefined)

  def displayName = notf.map(_.recipientUserDispName) getOrElse "?"
  def email = emailSent.map(_.sentTo) getOrElse "?"
}


case class IdentitySimple(
  id: String,
  override val userId: String,
  name: String,  // COULD reject weird chars, e.g. '?' or '|'
                 // Or fix later (and replace any weird chars already in db)
  email: String,
  location: String,
  website: String
  // COULD include signed cookie random value, so we knows if is same browser.
) extends Identity {
  def displayName = name
  // Cannot check for e.g. weird name or email. That could prevent
  // loading of data from database, after changing the weirdness rules.
  // Don't:  require(! (User nameIsWeird name))
}


case class IdentityOpenId(
  id: String,
  override val userId: String,
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
  email: String,
  country: String
) extends Identity {
  def displayName = firstName
  def isGoogleLogin = oidEndpoint == IdentityOpenId.GoogleEndpoint
}


object IdentityOpenId {

  val GoogleEndpoint = "https://www.google.com/accounts/o8/ud"

  object ProviderIdentifier {
    val Google = "https://www.google.com/accounts/o8/id"
    val Yahoo = "http://me.yahoo.com/"
  }

}


case class LoginRequest(login: Login, identity: Identity) {
  require(login.id startsWith "?")
  require(login.identityId == identity.id)

  // Only when you login via email, the identity id is already known
  // (and is the email id).
  if (identity.isInstanceOf[IdentityEmailId])
    require(!identity.id.startsWith("?"))
  else require(identity.id startsWith "?")

  // The user id is not known before you have logged in.
  require(identity.userId startsWith "?")
}


case class LoginGrant(
   login: Login,
   identity: Identity,
   user: User,
   isNewIdentity: Boolean,
   isNewRole: Boolean) {

  require(!login.id.contains('?'))
  require(!identity.id.contains('?'))
  require(!user.id.contains('?'))
  require(login.identityId == identity.id)
  require(identity.userId == user.id)
  require(!isNewRole || isNewIdentity)

  def displayName: String = {
    // (Somewhat dupl code: this also done in NiLo.displayName.)
    if (user.displayName nonEmpty) user.displayName
    else identity.displayName
  }

  def email: String = {
    if (user.email nonEmpty) user.email
    else identity.email
  }
}


// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list

