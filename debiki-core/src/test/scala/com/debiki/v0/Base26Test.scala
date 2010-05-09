// vim: ts=2 sw=2 et
/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */

package com.debiki.v0

import org.specs._


class Base26Test extends SpecificationWithJUnit {

  "Base26" should {
    "convert 'a' to 0" in { Base26.toInt('a') must be equalTo(0) }
    "convert 'z' to 25" in { Base26.toInt('z') must be equalTo(25) }
    "convert 'a', 'b', ... 'y', 'z' to 0, 1, ... 25" in {
      for (i <- 0 to 25)
        Base26.toInt(('a' + i).asInstanceOf[Char]) must be equalTo(i)
    }
    "consider '0' illegal" in {
      Base26.toInt('0') must throwAn[IllegalArgumentException]
    }
    "consider 'A' illegal" in {
      Base26.toInt('A') must throwAn[IllegalArgumentException]
    }
    "consider 'a'-1 illegal" in {
      Base26.toInt(('a'-1).asInstanceOf[Char]) must
                                        throwAn[IllegalArgumentException]
    }
    "consider 'z'+1 illegal" in {
      Base26.toInt(('z'+1).asInstanceOf[Char]) must
                                        throwAn[IllegalArgumentException]
    }

    "convert \"a\" to 0" in { Base26.toInt("a") must be equalTo(0) }
    "convert \"z\" to 25" in { Base26.toInt("z") must be equalTo(25) }
    "convert \"a\", \"b\", ... \"z\" to 0, 1, ... 25" in {
      for (i <- 0 to 25)
        Base26.toInt(('a' + i).asInstanceOf[Char].toString) must
                                                                be equalTo(i)
    }

    "convert \"aa\", \"ab\", \"ac\"... to 0, 1, 2..." in {
      for (i <- 0 to 25)
        Base26.toInt("a" + ('a' + i).asInstanceOf[Char]) must_== i
    }
    "convert \"ba\", \"bb\", \"bc\"... to 26, 27, 18..." in {
      for (i <- 0 to 25)
        Base26.toInt("b" + ('a' + i).asInstanceOf[Char]) must_== 26 + i
    }
    "convert \"za\", \"zb\", \"zc\"... to 26*25, 26*25+1, ..." in {
      for (i <- 0 to 25)
        Base26.toInt("z" + ('a' + i).asInstanceOf[Char]) must_== 26*25 + i
    }

    "convert \"abcdef\" to 494265" in {
      Base26.toInt("abcdef") must_== 494265
      // 5 + 4*26 + 3*26*26 + 2*26*26*26 + 1*26*26*26*26 + 0
      // = 494265
    }

    "consider \"\" illegal" in {
      Base26.toInt("") must throwAn[IllegalArgumentException]
    }

    "consider \"0\" illegal" in {
      Base26.toInt("0") must throwAn[IllegalArgumentException]
    }
    "consider \"A\" illegal" in {
      Base26.toInt("A") must throwAn[IllegalArgumentException]
    }

    "consider \"abXde\" illegal" in {
      Base26.toInt("abXde") must throwAn[IllegalArgumentException]
    }

    "consider \"aaaaaaa\" being too long" in {
      Base26.toInt("aaaaaaa") must throwAn[IllegalArgumentException]
      // although it could be rewritten to ignore tose 'a':s since they
      // mean 0.
    }
    "convert \"zzzzzz\" = to 308915775" in {
      Base26.toInt("zzzzzz") must_== 308915775
      // 25 + 25*26 + 25*26*26 + 25*26*26*26 + 25*26*26*26*26 +
      // 25*26*26*26*26*26
    }
    "consider \"baaaaaa\" being too long" in {
      Base26.toInt("baaaaaa") must throwAn[IllegalArgumentException]
    }
    "consider \"gytisyx\", i.e. 0x7fffffff, too long" in {
      Base26.toInt("gytisyx") must throwAn[IllegalArgumentException]
    }

    "convert 0 to \"a\"" in { Base26.fromInt(0) must_== "a" }
    "convert 25 to \"z\"" in { Base26.fromInt(25) must_== "z" }
    "convert 26 to \"ba\"" in { Base26.fromInt(26) must_== "ba" }
    "convert 12850896 to \"bcdefg\"" in {
      Base26.fromInt(12850896) must_== "bcdefg"
    }

    "refuse to convert negative numbers" in {
      Base26.fromInt(-1) must throwAn[IllegalArgumentException]
      Base26.fromInt(-'x') must throwAn[IllegalArgumentException]
    }

    "consider \"b\" being after \"a\"" in {
      Base26.after("a") must_== "b"
    }
    "consider \"oop\" being after \"ooo\"" in {
      Base26.after("ooo") must_== "oop"
    }
    "consider \"ba\" being after \"z\"" in {
      Base26.after("z") must_== "ba"
    }
    "consider \"oopaaa\" being after \"ooozzz\"" in {
      Base26.after("ooozzz") must_== "oopaaa"
    }
    "consider \"baaaaa\" being after \"zzzzz\"" in {
      Base26.after("zzzzz") must_== "baaaaa"
    }
	}
}
