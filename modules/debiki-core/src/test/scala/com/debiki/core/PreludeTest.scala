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
    "strip '' to None" in { stripOrigin("") must_== None }
    "strip '/dir/' to None" in { stripOrigin("/dir/") must_== None }
    "strip '/dir/page' to None" in { stripOrigin("/dir/page/") must_== None }

    val HttpServer = "http://server"
    val HttpsServer = "https://server"
    val HttpServerPort = "http://server:443"
    val HttpsServerPort = "https://server:443"
    val SomePath = "/some/path"

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


