// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list

package com.debiki.v0

//import java.{util => ju}
//import collection.{immutable => imm, mutable => mut}
import _root_.net.liftweb.common.{Box, Full, Empty, EmptyBox, Failure}
import _root_.net.liftweb.util.ControlHelpers.tryo
import _root_.java.security.MessageDigest
import _root_.java.{util => ju}
import Prelude._

abstract trait People {

  def logins: List[Login]
  def identities: List[Identity]
  def users: List[User]

  /** Returns a NiLo with info on the author of the post.
   */
  def authorOf_!(action: Action): NiLo = {  // COULD rename to loginFor?
                                         // or return a User?
    new NiLo(null, null)  // for now
  }

  def nilo(loginId: String): Option[NiLo] =
    login(loginId).map(new NiLo(this, _))

  def nilo_!(loginId: String): NiLo = new NiLo(this, login_!(loginId))

  // -------- Logins

  // COULD optimize.
  def login(id: String): Option[Login] = logins.find(_.id == id)
  def login_!(id: String): Login = login(id).get

  def identity(id: String): Option[Identity] = identities.find(_.id == id)
  def identity_!(id: String): Identity = identity(id).get

  // -------- Users

  // COULD optimize.
  def user(id: String): Option[User] = users.find(_.id == id)
  def user_!(id: String): User = user(id).get

  // COULD create Action parent class, use instead of Edit.
  //def authorOf(e: Edit): Option[User] =
  //login(e.loginId).flatMap((l: Login) => user(l.userId))

  //def authorOf_!(e: Edit): User = user_!(login_!(e.loginId).userId)
}

/** A Nice Login: a Login, Identity an User tuple, and utility methods.
 */
class NiLo(people: People, val login: Login) {
  def user_! : Option[User] = None  // for now
  def identity_! : Identity = IdentityUnknown  // for now
  def displayName: String =
    user_!.map(_.displayName).getOrElse(identity_!.displayName)
}

case class User (
  id: String,
  displayName: String,
  email: String,
  country: String,
  website: String,
  isSuperAdmin: Boolean
)

case class Login(
  id: String,
  prevLoginId: Option[String],
  ip: String,
  date: ju.Date,
  identityId: String)

object Login {

  abstract class Comparison { def isSameForSure = false }
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
  def displayName: String
  def email: String
  //def compareWith(user: User): UserComparison
}

/*case object IdentitySystem extends Identity {
  val id = "1"
  val displayName = "System"  // i18n?
  val email = ""
  /*
  def compareWith(user: User) =
    if (user eq UserSystem) SameIdentity
    else AnotherIdentity
  } */
} */

case object IdentityUnknown extends Identity {
  val id = "2"
  val displayName = "?"
  val email = ""
  /*
  def compareWith(user: User) =
    if (user eq UserSystem) AnotherIdentity  // system user is never unknown
    else PerhapsSameIdentity
  } */
}

case class IdentitySimple(
  id: String,
  name: String,  // TODO don't allow weird chars, e.g. '?' or '|'
  email: String,
  location: String,
  website: String
  // COULD include signed cookie random value, so we knows if is same browser.
) extends Identity {
  // Indicate that the user was not logged in, that we're not sure
  // about his/her identity, by appending "??". If however s/he provided
  // an email address, it's harder for other people to impersonate her.
  // (Well, at least if I some day include a salted hash of the name+email
  // in the HTML, so as to make it possible to distinguish between
  // two UserSimple with the same claimedName but different emails.
  // Hmm, should the salt should be changed from time to time, or vary
  // from page to page / tenant to tenant, so other people cannot scrape
  // the website and "stalk hashes"?) So then only append one "?".
  def displayName = name +
      (if (email isEmpty) "??" else "?") // for now. The '?' could be a
                                     // separate html elem, so can be styled.

  //val id = displayName +"|"+ email +"|"+ location +"|"+ website
  //errorIf(id.count(_ == '|') != 3,
  //  "Bad user, too many `|' in id: "+ safed(id) +" [debiki_error_942h121r8]")
  /*
  def compareWith(user: User) = user match {
    case UserSimple(`this.displayName`, `this.email`, _, _) =>
      // User unverified (not really logged in) so we don't know if is same.
      PerhapsSameIdentity
    case _ => AnotherIdentity
  } */
}

case class IdentityOpenId(
  id: String,
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

  /* def compareWith(user: User) = user match {
    case UserOpenID(`this.provider`, `this.realm`, `this.oid`, _, _, _) =>
      SameIdentity
    /* could implement comparisons between different realms:
    case UserOpenID(`this.provider`, anyRealm, `this.oid`, _, _, _) =>
      SameIdentity
    But Gmail lets the oid depend on the realm, so, for Gmail, cmp email addrs:
    case UserOpenID("Gmail", _, _, _, _, _) =>
      If same email, and a Gmail email, then SameIdentity
      else AnotherIdentity? Or PerhapsSameIdentity?
    */
    case _ => AnotherIdentity
  } */
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
