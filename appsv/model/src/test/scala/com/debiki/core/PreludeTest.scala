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
import org.scalatest._
import Prelude._


class PreludeTest extends FreeSpec with MustMatchers {

  "isAToZUnderscoreOnly" - {
    "'': yes" in { "".isAToZUnderscoreOnly mustBe true }
    "'a': yes" in { "a".isAToZUnderscoreOnly mustBe true }
    "'_': yes" in { "_".isAToZUnderscoreOnly mustBe true }
    "'A': yes" in { "A".isAToZUnderscoreOnly mustBe true }
    "'a_A': yes" in { "a_A".isAToZUnderscoreOnly mustBe true }
    "' ': no" in {  " ".isAToZUnderscoreOnly mustBe false }
    "'\\n': no" in {  "\n".isAToZUnderscoreOnly mustBe false }
    "'\\t': no" in {  "\t".isAToZUnderscoreOnly mustBe false }
    "'5': no" in { "5".isAToZUnderscoreOnly mustBe false }
    "'å': no" in { "å".isAToZUnderscoreOnly mustBe false }
    "'a_A2': no" in { "a_A2".isAToZUnderscoreOnly mustBe false }
    "''': no" in { "'".isAToZUnderscoreOnly mustBe false }
  }

  "charIsAzOrNum" - {
    "a: yes" in { charIsAzOrNum('a') mustBe true }
    "b: yes" in { charIsAzOrNum('b') mustBe true }
    "z: yes" in { charIsAzOrNum('z') mustBe true }
    "A: yes" in { charIsAzOrNum('A') mustBe true }
    "Y: yes" in { charIsAzOrNum('Y') mustBe true }
    "Z: yes" in { charIsAzOrNum('Z') mustBe true }
    "0: yes" in { charIsAzOrNum('0') mustBe true }
    "1: yes" in { charIsAzOrNum('1') mustBe true }
    "8: yes" in { charIsAzOrNum('8') mustBe true }
    "9: yes" in { charIsAzOrNum('9') mustBe true }
    "-: no" in { charIsAzOrNum('-') mustBe false }
    "#: no" in { charIsAzOrNum('#') mustBe false }
    val weird = "^! -—/\\+.-?!.åäöé,?&#:العربية :汉语 漢語"
    (weird + ": no") in { weird.exists(charIsAzOrNum) mustBe false }
  }

  "stripStartEndBlanks" - {
    "convert '' to ''" in { stripStartEndBlanks("") mustBe "" }
    "convert ' ' to ''" in { stripStartEndBlanks(" ") mustBe "" }
    "convert '\\r\\n' to ''" in { stripStartEndBlanks("\r\n") mustBe "" }
    "convert 'x' to 'x'" in { stripStartEndBlanks("x") mustBe "x" }
    "convert 'xyz' to 'xyz'" in { stripStartEndBlanks("xyz") mustBe "xyz" }
    "convert '  xyz' to 'xyz'" in { stripStartEndBlanks("  xyz") mustBe "xyz" }
    "convert 'xyz  ' to 'xyz'" in { stripStartEndBlanks("xyz  ") mustBe "xyz" }
    "convert '  xyz  ' to 'xyz'" in {
       stripStartEndBlanks("  xyz  ") mustBe "xyz" }
  }


  "stripOrigin" - {
    "becomes None: ''" in { stripOrigin("") mustBe None }
    "keep unchanged: '/'" in { stripOrigin("/") mustBe Some("/") }
    "keep unchanged: '/dir/'" in { stripOrigin("/dir/") mustBe Some("/dir/") }
    "keep unchanged: '/dir/page'" in { stripOrigin("/dir/page") mustBe Some("/dir/page") }

    val WithQueryHash = "/with?query=yes#hash"

    s"keep unchanged: '$WithQueryHash'" in {
      stripOrigin(WithQueryHash) mustBe Some(WithQueryHash)
    }

    val HttpServer = "http://server"
    val HttpsServer = "https://server"
    val HttpServerPort = "http://server:443"
    val HttpsServerPort = "https://server:443"
    val SomePath = "/some/path?query=value#hash-frag"

    s"strip 'http(s)://server(:port)' to None" in {
      stripOrigin(s"$HttpServer") mustBe None
      stripOrigin(s"$HttpsServer") mustBe None
      stripOrigin(s"$HttpServerPort") mustBe None
      stripOrigin(s"$HttpsServerPort") mustBe None
    }

    s"strip 'http(s)://server(:port)/' to Some('/')" in {
      stripOrigin(s"$HttpServer/") mustBe Some("/")
      stripOrigin(s"$HttpsServer/") mustBe Some("/")
      stripOrigin(s"$HttpServerPort/") mustBe Some("/")
      stripOrigin(s"$HttpsServerPort/") mustBe Some("/")
    }

    s"strip 'http(s)://server(:port)$SomePath' to Some('$SomePath')" in {
      stripOrigin(s"$HttpServer$SomePath") mustBe Some(SomePath)
      stripOrigin(s"$HttpsServer$SomePath") mustBe Some(SomePath)
      stripOrigin(s"$HttpServerPort$SomePath") mustBe Some(SomePath)
      stripOrigin(s"$HttpsServerPort$SomePath") mustBe Some(SomePath)
    }

    s"strip '//server(:port)$SomePath' to Some('$SomePath')" in {
      stripOrigin(s"//server$SomePath") mustBe Some(SomePath)
      stripOrigin(s"//server:8080$SomePath") mustBe Some(SomePath)
    }

    s"undersdand das-and-dot host names" in {
      stripOrigin(s"http://dash-and-dot.example.com:80/a/b") mustBe Some("/a/b")
    }

    s"reject bad prodocol" in {
      stripOrigin(s"nothttp://server/path") mustBe None
    }
  }


  "urlIsToDifferentOrigin" - {
    "/(something) is same as whatever" in {
      urlIsToDifferentOrigin("", "http://ex.co") mustBe false
      urlIsToDifferentOrigin("/", "http://ex.co") mustBe false
      urlIsToDifferentOrigin("/", "https://ex.co") mustBe false
      urlIsToDifferentOrigin("/", "//ex.co") mustBe false
      urlIsToDifferentOrigin("/", "//ex.co/xyz") mustBe false
      urlIsToDifferentOrigin("/", "//ex.co/xyz?q=v#hash") mustBe false

      urlIsToDifferentOrigin("/abc", "https://ex.co") mustBe false
      urlIsToDifferentOrigin("/abc", "http://ex.co") mustBe false
      urlIsToDifferentOrigin("/abc", "//ex.co") mustBe false

      urlIsToDifferentOrigin("/abc", "https://ex.co/") mustBe false
      urlIsToDifferentOrigin("/abc", "https://ex.co/xyz") mustBe false

      urlIsToDifferentOrigin("/abc/def?q=123", "https://ex.co/xyz/mno/p=789") mustBe false
    }

    "//server same as https://server" in {
      urlIsToDifferentOrigin("//example.com", "https://example.com") mustBe false
      urlIsToDifferentOrigin("//example.com", "http://example.com") mustBe false
      urlIsToDifferentOrigin("//example.com/abcd", "https://example.com") mustBe false
      urlIsToDifferentOrigin("//example.com/abcd", "https://example.com/xyz") mustBe false
      urlIsToDifferentOrigin("//example.com/", "https://example.com/xyz") mustBe false
      urlIsToDifferentOrigin("//example.com", "https://example.com/xyz") mustBe false
    }

    "(https:)//other-server different than https://server" in {
      for (scheme <- Seq("", "https:", "http:")) {
        info(s"Trying scheme: '$scheme'")
        urlIsToDifferentOrigin(s"$scheme//other-server", "https://server") mustBe true
        urlIsToDifferentOrigin(s"$scheme//other-server", "http://server") mustBe true
        urlIsToDifferentOrigin(s"$scheme//other-server/server", "https://server/server") mustBe true
        urlIsToDifferentOrigin(s"$scheme//other-server/server", "https://server") mustBe true
        urlIsToDifferentOrigin(s"$scheme//other-server/url/path", "https://server/xyzw") mustBe true
        urlIsToDifferentOrigin(s"$scheme//other-server", "http://server") mustBe true
        urlIsToDifferentOrigin(s"$scheme//other-server", "//server") mustBe true

        urlIsToDifferentOrigin(s"$scheme//x", "//y") mustBe true
        urlIsToDifferentOrigin(s"$scheme//x", "http://y") mustBe true
        urlIsToDifferentOrigin(s"$scheme//x", "https://y") mustBe true

        urlIsToDifferentOrigin(s"$scheme//x", "//x") mustBe (scheme != "")
        // If $sheme is empty, it defaults to the right scheme (i.e. to the 2nd param's scheme).
        urlIsToDifferentOrigin(s"$scheme//x", "http://x") mustBe (scheme == "https:")
        urlIsToDifferentOrigin(s"$scheme//x", "https://x") mustBe (scheme == "http:")
      }
    }

    "same and different ports" in {
      urlIsToDifferentOrigin("https://other:123", "https://server:123") mustBe true
      urlIsToDifferentOrigin("https://server:123", "https://server:123") mustBe false
      urlIsToDifferentOrigin("https://server:456", "https://server:123") mustBe true
      urlIsToDifferentOrigin("https://server", "https://server:123") mustBe true
      urlIsToDifferentOrigin("https://server:123", "https://server") mustBe true
      urlIsToDifferentOrigin("/abcd", "https://server:123") mustBe false
      urlIsToDifferentOrigin("/", "https://server:123") mustBe false
      urlIsToDifferentOrigin("", "https://server:123") mustBe false
      urlIsToDifferentOrigin("//server:123", "https://server:123") mustBe false
      urlIsToDifferentOrigin("//server:567", "https://server:123") mustBe true

      urlIsToDifferentOrigin("https://server", "https://server:123") mustBe true
      urlIsToDifferentOrigin("http://server", "http://server:123") mustBe true
      urlIsToDifferentOrigin("https://server:123", "https://server") mustBe true
      urlIsToDifferentOrigin("http://server:123", "http://server") mustBe true
    }

    "ports 80 and 443 sometimes included" in {
      urlIsToDifferentOrigin("https://server:443", "https://server") mustBe false
      urlIsToDifferentOrigin("https://server", "https://server:443") mustBe false
      urlIsToDifferentOrigin("https://server:443", "http://server") mustBe true // other scheme
      urlIsToDifferentOrigin("https://server:80", "http://server") mustBe true  // other scheme
      urlIsToDifferentOrigin("http://server:80", "http://server") mustBe false
      urlIsToDifferentOrigin("http://server", "http://server:80") mustBe false
      urlIsToDifferentOrigin("http://server", "https://server:80") mustBe true  // other scheme
    }
  }


  "nextRandomAzLetter" - {
    "be between 'a' and 'z'" in {
      for (i <- 1 to 50) {
        val letter = nextRandomAzLetter()
        (letter - 'a') must be >= 0
        ('z' - letter) must be >= 0
      }
    }
  }

  "nextRandomPageId" - {
    "be at least 5 chars and contain no vowels but `uy'" in {
      for (i <- 1 to 50) {
        val s = nextRandomPageId
        // Vowels aoei forbidden, and only lowercase chars (+ numbers) allowed.
        ("aoeiABCDEFGHIJKLMNOPQRSTUVWXYZ" intersect s) mustBe ""
        s.length must be >= 5
      }
    }
  }

  "drowRightWhile" - {
    "work" in {
      "".dropRightWhile((_) => true) mustBe ""
      "".dropRightWhile((_) => false) mustBe ""
      "a".dropRightWhile((_) => true) mustBe ""
      "a".dropRightWhile((_) => false) mustBe "a"
      "abc".dropRightWhile((_) => true) mustBe ""
      "abc".dropRightWhile((_) => false) mustBe "abc"
      "abcde".dropRightWhile(_ != 'x') mustBe ""
      "abcde".dropRightWhile(_ != 'a') mustBe "a"
      "abcde".dropRightWhile(_ != 'b') mustBe "ab"
      "abcde".dropRightWhile(_ != 'c') mustBe "abc"
      "abcde".dropRightWhile(_ != 'd') mustBe "abcd"
      "abcde".dropRightWhile(_ != 'e') mustBe "abcde"
      // Many matching characters: (two '.')
      "some.package.ClassName".dropRightWhile(_ != '.') mustBe "some.package."
    }
  }

  "takeRightWhile" - {
    "work even better" in {
      "".takeRightWhile((_) => true) mustBe ""
      "".takeRightWhile((_) => false) mustBe ""
      "a".takeRightWhile((_) => true) mustBe "a"
      "a".takeRightWhile((_) => false) mustBe ""
      "abc".takeRightWhile((_) => true) mustBe "abc"
      "abc".takeRightWhile((_) => false) mustBe ""
      "abcde".takeRightWhile(_ != 'x') mustBe "abcde"
      "abcde".takeRightWhile(_ != 'a') mustBe "bcde"
      "abcde".takeRightWhile(_ != 'b') mustBe "cde"
      "abcde".takeRightWhile(_ != 'c') mustBe "de"
      "abcde".takeRightWhile(_ != 'd') mustBe "e"
      "abcde".takeRightWhile(_ != 'e') mustBe ""
      // Many matching characters: (two '.')
      "some.package.ClassName".takeRightWhile(_ != '.') mustBe "ClassName"
    }
  }

  "ISO time functions can" - {

    "write a date time" in {
      val datiStr: String = toIso8601T(new ju.Date(0))
      val datiStrNoT: String = toIso8601NoT(new ju.Date(0))
      datiStr mustBe "1970-01-01T00:00:00Z"
      datiStrNoT mustBe "1970-01-01 00:00:00Z"
    }

    "write a date, days" in {
      val datiStr1: String = toIso8601Day(new ju.Date(0))
      val datiStr2: String = toIso8601Day(0)
      datiStr1 mustBe "1970-01-01"
      datiStr2 mustBe "1970-01-01"
    }

    "parse a date" in {
      val dati: ju.Date = parseIso8601DateTime("1970-01-01T00:00:00Z")
      dati mustBe new ju.Date(0)
    }

    "parse a date string and write it back again" in {
      val datiStr = "2012-01-02T10:20:30Z"
      val datiParsed = parseIso8601DateTime(datiStr)
      val datiStrAfter = toIso8601T(datiParsed)
      datiStr mustBe datiStrAfter
    }
  }

}


