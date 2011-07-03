// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */

package com.debiki.v0

import java.{util => ju}

object Prelude {

  /** Converts from a perhaps-{@code null} reference to an {@code Option}.
   */
  def ?[A <: AnyRef](x: A): Option[A] = if (x eq null) None else Some(x)

  import java.lang.{UnsupportedOperationException => UOE}

  def unsupported = throw new UOE
  def unsupported(what: String) = throw new UOE(what)
  def unimplemented = throw new UOE("Not implemented")
  def unimplemented(what: String) = throw new UOE("Not implemented: "+ what)
  def unimplementedIf(condition: Boolean, what: String) =
    if (condition) unimplemented(what)

  /** Write UNTESTED anywhere, not in a comment, and the compiler
   *  ensures you don't do a typo, so you'll find all UNTESTED should
   *  you search for UNTESTED before a release (intending to write unit tests).
   */
  def UNTESTED = ()  // If the code might not work, e.g. has never been run.
  def SECURITY = ()  // General security issue, should be fixed before release.
  def XSRF = ()  // Cross site request forgery.
  def XSS = ()  // Cross site scripting.
  def BUG = ()  // Need not be a terribly important bug.
  def TODO = ()  // Do this, or people might notice and complain.
  def COULD = ()  // Could do this, but it's not that important.

  def errorIf(condition: Boolean, problem: String) =
    if (condition) throw new RuntimeException(problem)

  def assertionError(problem: String) =
    throw new AssertionError(problem)

  def assErr(problem: String) =
    throw new AssertionError(problem)

  def illegalArg(problem: String) =
    throw new IllegalArgumentException(problem)

  def illegalArgIf(condition: Boolean, problem: String) =
    if (condition) throw new IllegalArgumentException(problem)

  /** Converts {@code text} to a single line printable ASCII, not very long,
   *  so it can be included in an error message even if it is end user defined
   *  (i.e. possible destructive were it not made safe).
   */
  def safe(text: String): String = text // for now.

  /** Like {@code safe}, but wraps the string between start and end
   * *d*elimiters "`" and "'", like so: <i>`the-dangerous-string'</i>
   */
  def safed(text: String): String = "`"+ text +"'"

  def classNameOf(x: Any): String = x match {
    case x: AnyRef => x.getClass.getSimpleName
    case _: Int => "Int"
    case _: Long => "Long"
    case _: Char => "Char"
    case _: Byte => "Byte"
    case _: Any => "Any"
    case null => "null"
  }

  def stripStartEndBlanks(text: String): String = {
    val start = text.indexWhere(_ > ' ')
    if (start == -1) return ""
    var end = text.lastIndexWhere(_ > ' ')
    text.slice(start, end + 1)
  }

  /** Returns the date formatted according to ISO 8601,
   *  e.g. "2010-06-23 11:37:15Z".
   */
  def toIso8601(date: ju.Date): String = {
    val sdf = new java.text.SimpleDateFormat("yyyy-MM-dd HH:mm:ss'Z'")
    sdf.format(date).toString
  }

  // Is thread safe.
  private val _random = new java.security.SecureRandom();

  // COULD split this in a random string function, and other id generation
  // functions, with string length adjusted, depending on how the random
  // string will be used.
  def nextRandomString(): String = {  // TODO exclude vowels, so no bad words
    var s = new java.math.BigInteger(130, _random).toString(36); // 0..9, a..z
    // Remove vowels to reduce the possibility of ugly bad words.
    // Keep vowels "uy" though, so there are 32 chars in total.
    // "uy" are the least common vowels.
    s = s filterNot ("aoei" contains _)
    s = s take 10 // this'll do for now, the database will ensure
                  // uniqueness? If I use a nosql database, then perhaps
                  // use 15 instead?  (32^10 is huge: 1 million billions!)
    s
    /*
    // Or use Apache Commons, org.apache.commons.lang.RandomStringUtils:
    RandomStringUtils.random(10 /*count*/, 0 /*start*/, 32 /*end*/,
      false /*letters only*/, false /*numbers only*/,
      // Characters to pick from. Alphanumeric, but all vowels except for "uy"
      // removed. This results in 32 characters, and (since most vowels are
      // removed) virtually no possibility of ugly words, like "yourfatrat".
      "bcdfghjklmnpqrstuvwxyz0123456789", _random)
    */
  }

  // This isn't really a secret salt. A secret salt should be kept secret
  // in the database, fetched via Dao.secretSalt and specified via useSalt().
  private var _hashSalt = "9k2xIao_"

  /** Sets the salt used when hashing (no related to the random numbers). */
  def setHashSalt(salt: String) { _hashSalt = salt }

  def saltAndHash(hashLength: Int)(text: String): String = {
    val saltAndText = _hashSalt + text
    // hash(saltAndText)
    saltAndText take hashLength  // SECURITY for now, don't hash
                                            // (easier to debug unhashed)
  }

  val hashLengthEmail = 20
  val hashLengthIp = 20

  def saltAndHashEmail = saltAndHash(hashLengthEmail) _
  def saltAndHashIp = saltAndHash(hashLengthIp) _

}
