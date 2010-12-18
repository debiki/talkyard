// vim: ts=2 sw=2 et
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

  /** Write UNTESTED anywhere, not in a comment, and the compiler
   *  ensures you don't do a typo, so you'll find all UNTESTED should
   *  you search for UNTESTED before a release (intending to write unit tests).
   */
  def UNTESTED = ()

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

  def classNameOf(x: Any): String = x match {
    case x: AnyRef => x.getClass.getSimpleName
    case _: Int => "Int"
    case _: Long => "Long"
    case _: Char => "Char"
    case _: Byte => "Byte"
    case _: Any => "Any"
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

}
