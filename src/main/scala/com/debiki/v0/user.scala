// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list

package com.debiki.v0

//import java.{util => ju}
//import collection.{immutable => imm, mutable => mut}
import com.debiki.v0.EmailNotfPrefs.EmailNotfPrefs
import _root_.net.liftweb.common.{Box, Full, Empty, EmptyBox, Failure}
import _root_.net.liftweb.util.ControlHelpers.tryo
import _root_.java.security.MessageDigest
import _root_.java.{util => ju}
import Prelude._
import User.checkId

abstract trait People {

  def logins: List[Login]
  def identities: List[Identity]
  def users: List[User]

  /** Returns a NiLo with info on the author of the post.
   */
  def authorOf_!(action: Action): NiLo = {  // COULD rename to loginFor?
                                         // or return a User?
    new NiLo(this, login_!(action.loginId))
  }

  def nilo(loginId: String): Option[NiLo] =
    login(loginId).map(new NiLo(this, _))

  def nilo_!(loginId: String): NiLo = new NiLo(this, login_!(loginId))

  // -------- Logins

  // COULD optimize.
  def login(id: String): Option[Login] = logins.find(_.id == id)
  def login_!(id: String): Login = login(id) getOrElse error(
    "Login not found: "+ safed(id) +" [debiki_error_8K3520z23]")

  def identity(id: String): Option[Identity] = identities.find(_.id == id)
  def identity_!(id: String): Identity = identity(id) getOrElse error(
    "Identity not found: "+ safed(id) +" [debiki_error_021kr3k09]")

  // -------- Users

  // COULD optimize.
  def user(id: String): Option[User] = users.find(_.id == id)
  def user_!(id: String): User = user(id) getOrElse error(
    "User not found: "+ safed(id) +" [debiki_error_730krq849]")

  // COULD create Action parent class, use instead of Edit.
  //def authorOf(e: Edit): Option[User] =
  //login(e.loginId).flatMap((l: Login) => user(l.userId))

  //def authorOf_!(e: Edit): User = user_!(login_!(e.loginId).userId)
}

/** A Nice Login: a Login, Identity an User tuple, and utility methods.
 */
class NiLo(people: People, val login: Login) {
  def user: Option[User] = people.user(identity_!.userId)
  def user_! : User = people.user_!(identity_!.userId)
  def identity_! : Identity = people.identity_!(login.identityId)
  def displayName: String = {
    // Duplicated code! This also done in LogInOut.loginSimple,
    // when setting the nanme part of the SID cookie, in debiki-app-lift.
    var n = user_!.displayName
    if (n nonEmpty) n else identity_!.displayName
  }
  def email: String = {
    var e = user_!.email
    if (e nonEmpty) e else identity_!.email
  }
}

case object User {

  /** Checks for weird ASCII chars in an user name.
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

  /** Checks for weird ASCII chars in an email,
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

  /** Allows all chars but control chars, space and < > */
  def urlIsWeird(url: String): Boolean = {
    for (c <- url if c < 0x80) {
      if (c <= ' ') return true  // forbid control chars and space
      if ("<>" contains c) return true
      if (c == 127) return true  // control char?
    }
    false
  }

  def checkId(id: String, errcode: String) {
    if (id == "") assErr("Empty ID "+ errcode)
    if (id == "0") assErr("ID is `0' "+ errcode)
    // "?" is okay, means unknown.
  }
}

case class User (
  /** The user's id. Starts with "-" if not authenticated
   *  (i.e. for IdentitySimple). */
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
  isSuperAdmin: Boolean
){
  checkId(id, "[debiki_error_02k125r]")
  def isAuthenticated = !id.startsWith("-") && !id.startsWith("?")
}

object EmailNotfPrefs extends Enumeration {
  type EmailNotfPrefs = Value
  val Receive, DontReceive, ForbiddenForever = Value
}

case class Login(
  id: String,
  prevLoginId: Option[String],
  ip: String,
  date: ju.Date,
  identityId: String
){
  checkId(id, "[debiki_error_093jxh12]")
}

object Login {

  abstract class Comparison { def isSameForSure = false }  // COULD Remove!??
  case object IsSame extends Comparison { override def isSameForSure = true }
  case object SeemsSame extends Comparison
  case object NotSame extends Comparison

  def compare(loginA: Login, nA: Login, userB: User, loginB: Login
                 ): Comparison = {
    NotSame // for now
    // For UserSimple, consider IP and login date, name and email.
  }
}

/** Login identity, e.g. an OpenID identity or a Twitter identity.
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
  /** A user can have many identities, e.g. Twitter, Gmail and Facebook. */
  def userId: String
  def displayName: String
  // COULD be an Option -- Twitter identities have no email?
  // And remembering to check for "" everywhere is error prone.
  def email: String

  checkId(id, "[debiki_error_02krc3g]")
  checkId(userId, "[debiki_error_864rsk215]")
}

case object IdentityUnknown extends Identity {  // Try to get rid of?
  val id = "2"
  val displayName = "?"
  val email = ""
  def userId = assErr("Identity unknown [debiki_error_3902kS1]")
    // alternatively, return "?" -- then People.user("?") returns None, fine.
    // But a.userId == b.userId, if == "?" which might be bad!
}

case class IdentitySimple(
  id: String,
  override val userId: String,
  name: String,  // TODO don't allow weird chars, e.g. '?' or '|'
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
}

/** E,g, a notification of a reply to a comment the user has made.
 *
 *  Sent by email and/or shown on the Web site.
 */
case class InboxItem(
  tyype: Do,
  title: String,
  summary: String,
  pageId: String,
  pageActionId: String,
  sourceActionId: String,
  ctime: ju.Date)

/** Used when saving an inbox item to database.
 *
 *  All InboxItem fields are not present, because they're stored
 *  elsewhere in the database and available later when an
 *  InboxItem is to be constructed anyway.
 */
case class InboxSeed(
  // Either a role id or an unauthenticated user id (i.e. IdentitySimple).
  // Starts with '-' for unauthenticated users.
  userId: String,
  pageId: String,
  pageActionId: String,
  sourceActionId: String,
  ctime: ju.Date
){
  def roleId: Option[String] =
    if (userId startsWith "-") None else Some(userId)

  def idtySmplId: Option[String] =
    if (userId startsWith "-") Some(userId drop 1) else None
}

object Inbox {

  def calcSeedsFrom(user: Option[User], adding: Seq[Action],
                    to: Debate): Seq[InboxSeed] = {
    val actions = adding
    val page = to
    val seeds: Seq[InboxSeed] = actions flatMap (_ match {
      case post: Post =>
        val postRepliedTo = page.vipo_!(post.parent)
        val userRepliedTo = postRepliedTo.user_!
        if (user.map(_.id) == Some(userRepliedTo.id)) {
          // Don't notify the user of his/her own replies.
          Nil
        } else {
          InboxSeed(userId = userRepliedTo.id, pageId = page.guid,
                pageActionId = post.id, sourceActionId = post.id,
                ctime = post.date) :: Nil
        }
      case e: Edit =>
        Nil  // fix later
      case app: EditApp =>
        Nil  // fix later
      case flag: Flag =>
        Nil  // fix later
      case _ =>
        Nil  // skip for now
    })

    // val pageAuthorInboxSeed = ...
    // val moderatorInboxSeed = ...
    seeds  // ++ pageAuthorInboxSeed ++ moderatorInboxSeed
  }
}

/* Could: ???
NiUs (   // nice user
  id: String,
  actions: List[Action]
){
  lazy val name: String = actions.filter(<find the most recent DeedRename>)
  lazy val website: String
  lazy val email: String
  ...
}

UserLoggedIn extends User (
  val openId: String  ??
)

class Deed

case class DeedRename
case class DeedChangeWebsite
case class DeedChangeEmail

*/
