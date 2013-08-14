/**
 * Copyright (C) 2012 Kaj Magnus Lindberg (born 1979)
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
