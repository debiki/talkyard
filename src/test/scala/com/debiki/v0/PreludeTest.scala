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

  "nextRandomString" should {
    "be at least 5 chars and contain no vowels but `uy'" >> {
      for (i <- 1 to 50) {
        val s = nextRandomString
        // Vowels aoei forbidden, and only lowercase chars (+ numbers) allowed.
        ("aoeiABCDEFGHIJKLMNOPQRSTUVWXYZ" intersect s) must_== ""
        s.length must be_>=(5)
      }
    }
  }

  "drowRightWhile" should {
    "work" >> {
      "".dropRightWhile((_) => true) must_== ""
      "ab".dropRightWhile((_) => true) must_== ""
      "abc".dropRightWhile((_) => false) must_== "abc"
      "abcde".dropRightWhile(_ != 'x') must_== ""
      "abcde".dropRightWhile(_ != 'a') must_== "a"
      "abcde".dropRightWhile(_ != 'b') must_== "ab"
      "abcde".dropRightWhile(_ != 'c') must_== "abc"
      "abcde".dropRightWhile(_ != 'd') must_== "abcd"
      "abcde".dropRightWhile(_ != 'e') must_== "abcde"
    }
  }
}
