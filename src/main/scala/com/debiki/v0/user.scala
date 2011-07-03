// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list

package com.debiki.v0

//import java.{util => ju}
//import collection.{immutable => imm, mutable => mut}
import _root_.net.liftweb.common.{Box, EmptyBox, Failure}
import _root_.net.liftweb.util.ControlHelpers.tryo
import _root_.java.security.MessageDigest
import Prelude._

class People {

  /** Returns the author of the post.
   *
   *  COULD construct a User when reading from Yaml?
   *  And construct a User.unknown or .broken, if the Yaml is bad.
   *  And if you don't have no user when you construct a Post, you'd use
   *  User.unknown. -- Then the caller would use `post.user' instead of
   *  People.authorOf(post).
   */
  // WARNING: duplicated code, see authorOf below.
  def authorOf(post: Post): Box[User] = {
    if (post.by startsWith "0|") {
      return tryo { new UserNoLogin(post.by) }
    } else {
      unimplemented
    }
  }

  // COULD create a common base class for Post and Edit,
  // or use structural typing, to get rid of this dupl code.
  // WARNING: duplicated code, see authorOf above.
  def authorOf(edit: Edit): Box[User] = {
    if (edit.by startsWith "0|") {
      return tryo { new UserNoLogin(edit.by) }
    } else {
      unimplemented
    }
  }

}

object User {

  def id(name: String, website: String, email: String): Box[String] = {
    // TODO check for `~' in variables, return Failure
    val hash = ""  // TODO base30 encode SHA1sum
    return Box !! "0|"+ hash +"|"+ name +"|"+ website +"|"+ email

    // sha1:
    // http://download.oracle.com/javase/6/docs/api/java/security/
    //    MessageDigest.html
    // and: net.liftweb.util.SecurityHelpers
    // alg names:
    // http://download.oracle.com/javase/6/docs/technotes/guides/security/
    //    StandardNames.html
  }

  /** The unknown user has a zero length hash and empty name, website
   *  and email.
   */
  val unknown = new UserNoLogin("0||||")
}

/** Should be immutable.
 */
abstract class User(

  /** A user ID, or a user's name, email and website.
   *
   *  An alphanumeric string which identifies a User, or, for non logged in
   *  users, a string in this format:
   *      [version]|[emailHash]|[name]|[website]|[email]
   *  where [version] is a version number (for the id format)
   *  and [name], [email], [website] is whatever information the user provided,
   *  and [emailHash] is the first 11 characters in a Base30 encoded SHA1
   *  of the email. Example:
   *      0|w3rk7z2vm9p|Kalle Anka|www.ankeborg.se|k.anka@ankeborg.se
   *  The first 4 parts of this ID fairly well identifes the
   *  user, without revealing the email: 
   *      [version]|[emailHash]|[name]|[website]
   *  These 4 parts can safely be written to HTML, so people can ask for
   *  more information for a distinct not-logged-in-user.
   */
  // COULD rename to `guid', and let id = "-"+ guid,
  // since guid ids start with '-', but paths with '/'.
  val id: String
){
  def name: String
  def website: String
  def email: String
  def emailSaltHash: String = saltAndHashEmail(email)
}

class UserNoLogin(id: String) extends User(id) {
  errorIf(id.count(_ == '|') != 4 || !id.startsWith("0|"),
      "Bad UserNoLogin id: "+ safed(id) +" [debiki_error_53802hrxrrs]")
  private lazy val parts = id.split('|')
  private def part(n: Int) = {
    // Need to check parts.length: "0||Name||" splits to:
    // Array(0, , Name) -- the last || are ignored.
    if (parts.length > n) parts(n) else ""
  }
  def emailHash = part(1)
  override def name = part(2)
  override def website = part(4)
  override def email = part(3)
}


/* Could: ???
User (
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
