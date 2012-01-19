// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */

package com.debiki.v0

import java.{util => ju}
import java.{security => js}
import org.apache.commons.codec.{binary => acb}

object Prelude {

  // Logs an error in release mode, but throws an AssertionError in debug
  // mode -- this makes errors obvious during development and recoverable
  // in production mode. [Code Complete p. 206: Use Offensive Programming]
  // The caller should fail gracefully (e.g. use a reasonable fallback
  // instead of the corrupted database data).
  // SHOULD move to some DebikiLogger class and check if we're in debug
  // or release mode.
  def warnDbgDie(warningMsg: String) {
    if (true) {
      // Fail hard in debug mode so this error will be fixed.
      throw new AssertionError(warningMsg)
    }
    else {
      // Only log a warning in release mode.
    }
  }

  def errDbgDie(errorMsg: String) {
    if (true) {
      throw new AssertionError(errorMsg)
    }
    else {
      // Log error
    }
  }

  /** Converts from a perhaps-{@code null} reference to an {@code Option}.
   */
  def ?[A <: AnyRef](x: A): Option[A] = if (x eq null) None else Some(x)

  import java.lang.{UnsupportedOperationException => UOE}

  // Error codes should be formatted like so:
  // "DwE<number><alnum x 3><number>", e.g. "DwE8kR32".
  // But "debiki_error_<guid>" is deprecated (too verbose).

  def unsupported = throw new UOE
  def unsupported(what: String) = throw new UOE(what)
  def unsupported(what: String, errorCode: String) =
    throw new UOE(what +" [error code "+ errorCode +"]")
  def unimplemented = throw new UOE("Not implemented")
  def unimplemented(what: String) = throw new UOE("Not implemented: "+ what)
  def unimplemented(what: String, errorCode: String) =
    throw new UOE("Not implemented: "+ what +" [error code "+ errorCode +"]")
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

  def runtimeErr(problem: => String, errorCode: String) =
    throw new RuntimeException(problem +" [error code "+ errorCode +"]")

  def errorIf(condition: Boolean, problem: String) =
    if (condition) throw new RuntimeException(problem)

  def runtimeErrIf(condition: Boolean, problem: => String, errorCode: String) =
    if (condition) runtimeErr(problem, errorCode)

  def assertionError(problem: String) =
    throw new AssertionError(problem)

  def assErr(problem: String) =
    throw new AssertionError(problem)

  def assrtErr(errorCode: String) =
    throw new AssertionError("[error code "+ errorCode +"]")

  // Deprecated -- remove
  def assErrIf(condition: Boolean, problem: String) =
    if (condition) throw new AssertionError(problem)

  def assrtErrIf(condition: Boolean, errorCode: String) =
    if (condition) assrtErr(errorCode)

  def illegalArg(problem: String) =
    throw new IllegalArgumentException(problem)

  def illArgErr(problem: => String, errorCode: String) =
    throw new IllegalArgumentException(problem +
        " [error code "+ errorCode +"]")

  def illegalArgIf(condition: Boolean, problem: String) =
    if (condition) throw new IllegalArgumentException(problem)

  def illArgErrIf(condition: Boolean, problem: => String, errorCode: String) =
    if (condition) illArgErr(problem, errorCode)

  /** Converts {@code text} to a single line printable ASCII, not very long,
   *  so it can be included in an error message even if it is end user defined
   *  (i.e. possible destructive were it not made safe).
   */
  def safe(obj: AnyRef): String = {
    val str =
      if (obj eq null) "(null)"
      else if (obj.isInstanceOf[String]) obj.asInstanceOf[String]
      else obj.toString
    str // for now
  }

  /** Like {@code safe}, but wraps the string between start and end
   * *d*elimiters "`" and "'", like so: <i>`the-dangerous-string'</i>
   *  -- unless it's null, then returns "(null)".
   */
  def safed(obj: AnyRef): String =
    if (obj eq null) "(null)" else "`"+ safe(obj) +"'"

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
   *  e.g. "2010-06-23 11:37:15Z" (with a space not a 'T' between the
   *  date and time).
   */
  def toIso8601(date: ju.Date): String = {
    // SimpleDateFormat is not thread safe.
    val sdf = new java.text.SimpleDateFormat("yyyy-MM-dd HH:mm:ss'Z'")
    sdf.format(date).toString
  }

  def toIso8601T(date: ju.Date): String = {
    // SimpleDateFormat is not thread safe.
    val sdf = new java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'")
    sdf.format(date).toString
  }

  /** Changes any ' ' in a ISO 8601 date string to a 'T' (changes all spaces).
   *
   *  It seems javascript's Date.parse requires a 'T' between date and time.
   */
  def toIso8601T(iso8601Date: String) = iso8601Date.replace(' ', 'T')

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
  // I think the salt better be fairly long, otherwise it'd be possible to
  // find out what is the salt, since you might guess that a salt + email
  // is hashed to the dwCoUserEmailSH cookie, and you have your hash and
  // your email and can thus do a brute force attack.
  private var _hashSalt = "94k2xIf1AoVkbx928_"

  /** Sets the salt used when hashing (no related to the random numbers). */
  def setHashSalt(salt: String) { _hashSalt = salt }

  def saltAndHash(hashLength: Int)(text: String): String = {
    val saltAndText = _hashSalt + text
    hashSha1Base64UrlSafe(saltAndText) take hashLength
  }

  val hashLengthEmail = 20
  val hashLengthIp = 20

  def saltAndHashEmail = saltAndHash(hashLengthEmail) _
  def saltAndHashIp = saltAndHash(hashLengthIp) _

  private def mdSha1 = js.MessageDigest.getInstance("SHA-1") // not thread safe

  def hashSha1Base64UrlSafe(text: String): String =
    acb.Base64.encodeBase64URLSafeString(mdSha1.digest(text.getBytes("UTF-8")))

  // ------ Diff, match, patch

  def makePatch(from: String, to: String): String = {
    val dmp = new name.fraser.neil.plaintext.diff_match_patch
    var diffs = dmp.diff_main(from, to)
    dmp.diff_cleanupSemantic(diffs)
    val patches = dmp.patch_make(from, diffs)
    val patchText = dmp.patch_toText(patches)
    patchText
  }

}
