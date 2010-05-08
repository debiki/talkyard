// vim: ts=2 sw=2 et
/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */

package com.debiki.v0

object Prelude {

  /** Converts from a perhaps-{@code null} reference to an {@code Option}.
   */
  def ?[A <: AnyRef](x: A): Option[A] = if (x eq null) None else Some(x)

  import java.lang.{UnsupportedOperationException => UOE}

  def unsupported = throw new UOE
  def unsupported(what: String) = throw new UOE(what)
  def unimplemented = throw new UOE("Not implemented")
  def unimplemented(what: String) = throw new UOE("Not implemented: "+ what)

  def illegalArgIf(condition: Boolean, problem: String) =
    if (condition) throw new IllegalArgumentException(problem)

  /** Converts {@code text} to a single line printable ASCII, not very long,
   *  so it can be included in an error message even if it is end user defined
   *  (i.e. possible destructive were it not made safe).
   */
  def safe(text: String): String = text // for now.

}
