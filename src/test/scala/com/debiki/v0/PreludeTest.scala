// vim: ts=2 sw=2 et
/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */

package com.debiki.v0

import org.specs._
import Prelude._


class PreludeTest extends SpecificationWithJUnit {

  "stripStartEndBlanks" should {
    "convert '' to ''" in { stripStartEndBlanks("") must_== "" }
    "convert ' ' to ''" in { stripStartEndBlanks(" ") must_== "" }
    "convert '\\r\\n' to ''" in { stripStartEndBlanks("\r\n") must_== "" }
    "convert 'x' to 'x'" in { stripStartEndBlanks("x") must_== "x" }
    "convert 'xyz' to 'xyz'" in { stripStartEndBlanks("xyz") must_== "xyz" }
    "convert '  xyz' to 'xyz'" in { stripStartEndBlanks("  xyz") must_== "xyz" }
    "convert 'xyz  ' to 'xyz'" in { stripStartEndBlanks("xyz  ") must_== "xyz" }
    "convert '  xyz  ' to 'xyz'" in {
       stripStartEndBlanks("  xyz  ") must_== "xyz" }
  }

}
