/**
 * Copyright (c) 2011-2012 Kaj Magnus Lindberg (born 1979)
 */

package com.debiki.v0


import org.specs2.mutable._
import Prelude._


class StripIndentStringInterpolatorTest extends Specification {

  "StripIndentStringInterpolator" should {

    "interpolate strings" in {
      val arg = "CD"
      ind"ab${arg}ef" must_== "abCDef"
    }

    "indent arguments" in {
      pending /*  since  "..." match { case regex(x) => ...} doesn't work.
      val arg =
        """
          |CD
          |  EF
          |GH
        """.stripMargin

      ind"""
        ab
          ${arg}
          ij""" must_== """
        ab
          CD
            EF
          GH
          ij"""
      */
    }

    "strip margin" in {
      ind"""
          |CD
          |  EF
          |GH
        """ must_==
      s"""
          |CD
          |  EF
          |GH
        """.stripMargin
    }
  }

}


class OneLineStringInterpolatorTest extends Specification {

  "OneLineStringInterpolator" should {

    "interpolate strings" in {
      val arg = "CD"
      val arg2 = "GH"
      o"ab${arg}ef$arg2" must_== "abCDefGH"
    }

    "remove one newline" in {
      o"""line one
       line two""" must_== "line one line two"
    }

    "remove leading blank line" in {
      o"""
       this'll be line one""" must_== "this'll be line one"
    }

    "remove all newlines and indentation" in {
      o"""line one
       line two
           line three""" must_== "line one line two line three"
    }

    "remove all newlines and indentation, and do interpolation" in {
      val one = "one"
      val two = "two"
      val line = "line"
      val three = "three"
      o"""
        line $one
          line $two
            $line $three""" must_== "line one line two line three"
    }
  }

}
