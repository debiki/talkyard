/**
 * Copyright (c) 2018 Kaj Magnus Lindberg
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

import org.scalatest._


class ValidationTest extends FreeSpec with MustMatchers {


  "Validation can" - {
    "allow normal names" in {
      Validation.checkUsername("killy_kat").isGood mustBe true
      Validation.checkUsername("mousemonster").isGood mustBe true
      Validation.checkUsername("ted").isGood mustBe true
      Validation.checkUsername("majbritt").isGood mustBe true
    }

    "reject too short names" in {
      Validation.checkUsername("a").isBad mustBe true
      Validation.checkUsername("ab").isBad mustBe true
      Validation.checkUsername("ab").swap.get mustBe Validation.TooShortErrorMessage
      Validation.checkUsername("abc").isGood mustBe true
    }

    "reject too long names" in {
      Validation.checkUsername("a234567890_234567890").isGood mustBe true  // 20 chars = ok
      Validation.checkUsername("a234567890_2345678901").isBad mustBe true  // 21 chars = too long
      Validation.checkUsername("a234567890_2345678901").swap.get mustBe Validation.TooLongErrorMessage
      Validation.checkUsername("a234567890_234567890_234567890").isBad mustBe true
    }

    "reject names with weird chars" in {
      Validation.checkUsername("!?!").isBad mustBe true
      Validation.checkUsername("bryan!").isBad mustBe true
      Validation.checkUsername("bryan!").swap.get mustBe Validation.BadCharsErrorMessage
      Validation.checkUsername("space man").swap.get mustBe Validation.BadCharsErrorMessage
      Validation.checkUsername("dotty.cat").swap.get mustBe Validation.BadCharsErrorMessage
      Validation.checkUsername("flashy-dash").swap.get mustBe Validation.BadCharsErrorMessage
    }

    "reject names that start with underscore" in {
      Validation.checkUsername("_lodashyman").swap.get mustBe Validation.BadFirstCharErrorMessage
    }

    "reject names with two special chars in a row, but allow when not next to each other" in {
      Validation.checkUsername("dashy_flash").isGood mustBe true
      Validation.checkUsername("dashy__flash").isBad mustBe true
      Validation.checkUsername("dashy__flash").swap.get mustBe Validation.TwoSpecialCharsErrorMessage
      Validation.checkUsername("dashy___flash").isBad mustBe true
      Validation.checkUsername("dashy_____flash").isBad mustBe true
      // But two specials, not next to each other, is fine
      Validation.checkUsername("dashy_flash_man").isGood mustBe true
      Validation.checkUsername("dotty..doris").isBad mustBe true
      Validation.checkUsername("dashy--diana").isBad mustBe true
    }
  }

}

