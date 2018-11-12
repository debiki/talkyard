/**
 * Copyright (C) 2012-2013 Kaj Magnus Lindberg (born 1979)
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

package com.debiki.core

import java.{util => ju}
import org.specs2.mutable._
import Prelude._


class PreludeTest extends Specification {

  "isAToZUnderscoreOnly" should {
    "'': yes" in { "".isAToZUnderscoreOnly must_== true }
    "'a': yes" in { "a".isAToZUnderscoreOnly must_== true }
    "'_': yes" in { "_".isAToZUnderscoreOnly must_== true }
    "'A': yes" in { "A".isAToZUnderscoreOnly must_== true }
    "'a_A': yes" in { "a_A".isAToZUnderscoreOnly must_== true }
    "' ': no" in {  " ".isAToZUnderscoreOnly must_== false }
    "'\\n': no" in {  "\n".isAToZUnderscoreOnly must_== false }
    "'\\t': no" in {  "\t".isAToZUnderscoreOnly must_== false }
    "'5': no" in { "5".isAToZUnderscoreOnly must_== false }
    "'å': no" in { "å".isAToZUnderscoreOnly must_== false }
    "'a_A2': no" in { "a_A2".isAToZUnderscoreOnly must_== false }
    "''': no" in { "'".isAToZUnderscoreOnly must_== false }
  }

  "charIsAzOrNum" should {
    "a: yes" in { charIsAzOrNum('a') must_=== true }
    "b: yes" in { charIsAzOrNum('b') must_=== true }
    "z: yes" in { charIsAzOrNum('z') must_=== true }
    "A: yes" in { charIsAzOrNum('A') must_=== true }
    "Y: yes" in { charIsAzOrNum('Y') must_=== true }
    "Z: yes" in { charIsAzOrNum('Z') must_=== true }
    "0: yes" in { charIsAzOrNum('0') must_=== true }
    "1: yes" in { charIsAzOrNum('1') must_=== true }
    "8: yes" in { charIsAzOrNum('8') must_=== true }
    "9: yes" in { charIsAzOrNum('9') must_=== true }
    "-: no" in { charIsAzOrNum('-') must_=== false }
    "#: no" in { charIsAzOrNum('#') must_=== false }
    val weird = "^! -—/\\+.-?!.åäöé,?&#:العربية :汉语 漢語"
    (weird + ": no") in { weird.exists(charIsAzOrNum) must_=== false }
  }

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

  "stripOrigin" should {
    "becomes None: ''" in { stripOrigin("") must_== None }
    "keep unchanged: '/'" in { stripOrigin("/") must_== Some("/") }
    "keep unchanged: '/dir/'" in { stripOrigin("/dir/") must_== Some("/dir/") }
    "keep unchanged: '/dir/page'" in { stripOrigin("/dir/page") must_== Some("/dir/page") }

    val WithQueryHash = "/with?query=yes#hash"

    s"keep unchanged: '$WithQueryHash'" in {
      stripOrigin(WithQueryHash) must_== Some(WithQueryHash)
    }

    val HttpServer = "http://server"
    val HttpsServer = "https://server"
    val HttpServerPort = "http://server:443"
    val HttpsServerPort = "https://server:443"
    val SomePath = "/some/path?query=value#hash-frag"

    s"strip 'http(s)://server(:port)' to None" in {
      stripOrigin(s"$HttpServer") must_== None
      stripOrigin(s"$HttpsServer") must_== None
      stripOrigin(s"$HttpServerPort") must_== None
      stripOrigin(s"$HttpsServerPort") must_== None
    }

    s"strip 'http(s)://server(:port)/' to Some('/')" in {
      stripOrigin(s"$HttpServer/") must_== Some("/")
      stripOrigin(s"$HttpsServer/") must_== Some("/")
      stripOrigin(s"$HttpServerPort/") must_== Some("/")
      stripOrigin(s"$HttpsServerPort/") must_== Some("/")
    }

    s"strip 'http(s)://server(:port)$SomePath' to Some('$SomePath')" in {
      stripOrigin(s"$HttpServer$SomePath") must_== Some(SomePath)
      stripOrigin(s"$HttpsServer$SomePath") must_== Some(SomePath)
      stripOrigin(s"$HttpServerPort$SomePath") must_== Some(SomePath)
      stripOrigin(s"$HttpsServerPort$SomePath") must_== Some(SomePath)
    }

    s"strip '//server(:port)$SomePath' to Some('$SomePath')" in {
      stripOrigin(s"//server$SomePath") must_== Some(SomePath)
      stripOrigin(s"//server:8080$SomePath") must_== Some(SomePath)
    }

    s"undersdand das-and-dot host names" in {
      stripOrigin(s"http://dash-and-dot.example.com:80/a/b") must_== Some("/a/b")
    }

    s"reject bad prodocol" in {
      stripOrigin(s"nothttp://server/path") must_== None
    }
  }

  "nextRandomAzLetter" should {
    "be between 'a' and 'z'" >> {
      for (i <- 1 to 50) {
        val letter = nextRandomAzLetter()
        (letter - 'a') must be_>=(0)
        ('z' - letter) must be_>=(0)
      }
      ok
    }
  }

  "nextRandomPageId" should {
    "be at least 5 chars and contain no vowels but `uy'" >> {
      for (i <- 1 to 50) {
        val s = nextRandomPageId
        // Vowels aoei forbidden, and only lowercase chars (+ numbers) allowed.
        ("aoeiABCDEFGHIJKLMNOPQRSTUVWXYZ" intersect s) must_== ""
        s.length must be_>=(5)
      }
      ok
    }
  }

  "drowRightWhile" should {
    "work" >> {
      "".dropRightWhile((_) => true) must_== ""
      "".dropRightWhile((_) => false) must_== ""
      "a".dropRightWhile((_) => true) must_== ""
      "a".dropRightWhile((_) => false) must_== "a"
      "abc".dropRightWhile((_) => true) must_== ""
      "abc".dropRightWhile((_) => false) must_== "abc"
      "abcde".dropRightWhile(_ != 'x') must_== ""
      "abcde".dropRightWhile(_ != 'a') must_== "a"
      "abcde".dropRightWhile(_ != 'b') must_== "ab"
      "abcde".dropRightWhile(_ != 'c') must_== "abc"
      "abcde".dropRightWhile(_ != 'd') must_== "abcd"
      "abcde".dropRightWhile(_ != 'e') must_== "abcde"
      // Many matching characters: (two '.')
      "some.package.ClassName".dropRightWhile(_ != '.') must_== "some.package."
    }
  }

  "takeRightWhile" should {
    "work even better" >> {
      "".takeRightWhile((_) => true) must_== ""
      "".takeRightWhile((_) => false) must_== ""
      "a".takeRightWhile((_) => true) must_== "a"
      "a".takeRightWhile((_) => false) must_== ""
      "abc".takeRightWhile((_) => true) must_== "abc"
      "abc".takeRightWhile((_) => false) must_== ""
      "abcde".takeRightWhile(_ != 'x') must_== "abcde"
      "abcde".takeRightWhile(_ != 'a') must_== "bcde"
      "abcde".takeRightWhile(_ != 'b') must_== "cde"
      "abcde".takeRightWhile(_ != 'c') must_== "de"
      "abcde".takeRightWhile(_ != 'd') must_== "e"
      "abcde".takeRightWhile(_ != 'e') must_== ""
      // Many matching characters: (two '.')
      "some.package.ClassName".takeRightWhile(_ != '.') must_== "ClassName"
    }
  }

  "ISO time functions" can {

    "write a date" >> {
      val datiStr: String = toIso8601T(new ju.Date(0))
      val datiStrNoT: String = toIso8601(new ju.Date(0))
      datiStr must_== "1970-01-01T00:00:00Z"
      datiStrNoT must_== "1970-01-01 00:00:00Z"
    }

    "parse a date" >> {
      val dati: ju.Date = parseIso8601DateTime("1970-01-01T00:00:00Z")
      dati must_== new ju.Date(0)
    }

    "parse a date string and write it back again" >> {
      val datiStr = "2012-01-02T10:20:30Z"
      val datiParsed = parseIso8601DateTime(datiStr)
      val datiStrAfter = toIso8601T(datiParsed)
      datiStr must_== datiStrAfter
    }
  }

}


