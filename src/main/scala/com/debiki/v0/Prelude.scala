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

  def nextRandomString(): String = {  // TODO exclude vowels, so no bad words
    new java.math.BigInteger(130, _random).toString(36); // 0...9, a...z
  }

}
