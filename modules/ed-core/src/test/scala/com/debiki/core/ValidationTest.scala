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
    "allow normal usernames" in {
      Validation.checkUsername("killy_kat").isGood mustBe true
      Validation.checkUsername("mousemonster").isGood mustBe true
      Validation.checkUsername("ted").isGood mustBe true
      Validation.checkUsername("majbritt").isGood mustBe true
    }

    "allow StackExchange names (for Talkyard demo sites only, CC-By link hack)" in {
      Validation.checkUsername("__sx_writing_12345__").isGood mustBe true
    }

    "reject too short usernames" in {
      User.MinUsernameLength mustBe 3
      Validation.checkUsername("a").isBad mustBe true
      Validation.checkUsername("ab").isBad mustBe true
      Validation.checkUsername("ab").swap.get mustBe Validation.TooShortErrorMessage
      Validation.checkUsername("abc").isGood mustBe true
    }

    "reject too long usernames" in {
      User.MaxUsernameLength mustBe 20
      Validation.checkUsername("a234567890_234567890").isGood mustBe true  // 20 chars = ok
      Validation.checkUsername("a234567890_2345678901").isBad mustBe true  // 21 chars = too long
      Validation.checkUsername("a234567890_2345678901").swap.get mustBe Validation.TooLongErrorMessage
      Validation.checkUsername("a234567890_234567890_234567890").isBad mustBe true
    }

    "reject non-ASCII characters" in {
      Validation.checkUsername("månsson").swap.get mustBe Validation.badCharsErrorMessage("å")
      Validation.checkUsername("arabicالعربيةtext").swap.get must include(Validation.badCharsErrorMessage(""))
      Validation.checkUsername("chinese汉语chars").swap.get must include(Validation.badCharsErrorMessage(""))
    }

    "reject usernames with weird chars" in {
      Validation.checkUsername("!?!").isBad mustBe true
      Validation.checkUsername("bryan!hi").isBad mustBe true
      Validation.checkUsername("bryan!hi").swap.get mustBe Validation.badCharsErrorMessage("!")
      Validation.checkUsername("space cat").swap.get mustBe Validation.badCharsErrorMessage(" ")
      Validation.checkUsername("tilde~cat").swap.get mustBe Validation.badCharsErrorMessage("~")
      Validation.checkUsername("plussy+pushy").swap.get mustBe Validation.badCharsErrorMessage("+")
    }

    "but dots and dashes are okay" in {
      Validation.checkUsername("dotty.cat").isGood mustBe true
      Validation.checkUsername("flashy-dash").isGood mustBe true
      Validation.checkUsername("so.do.ty-flash-fa-st").isGood mustBe true
    }

    "reject usernames that start with bad first char" in {
      Validation.checkUsername("!badstart").swap.get mustBe Validation.BadFirstCharErrorMessage
      Validation.checkUsername("-badstart").swap.get mustBe Validation.BadFirstCharErrorMessage
      Validation.checkUsername(".badstart").swap.get mustBe Validation.BadFirstCharErrorMessage
      Validation.checkUsername("汉语chinese").swap.get mustBe Validation.BadFirstCharErrorMessage
      // However starting with '_' or a digit or Uppercase letter is fine.
      //Validation.checkUsername("_lodashyowl").swap mustBe None  // add back later? [UNPUNCT]
      Validation.checkUsername("0mistakes").isGood mustBe true
      Validation.checkUsername("Soveryokay").isGood mustBe true
    }

    "reject usernames that end with bad char" in {
      Validation.checkUsername("beepybird!").swap.get mustBe Validation.BadLastCharErrorMessage
      Validation.checkUsername("beepybird_").swap.get mustBe Validation.BadLastCharErrorMessage
      Validation.checkUsername("beepybird-").swap.get mustBe Validation.BadLastCharErrorMessage
      Validation.checkUsername("beepybird.").swap.get mustBe Validation.BadLastCharErrorMessage
      Validation.checkUsername("arabicالعربية").swap.get mustBe Validation.BadLastCharErrorMessage
      // Ending with a number or letter is okay.
      Validation.checkUsername("nomistake3").isGood mustBe true
      Validation.checkUsername("nomistakeZ").isGood mustBe true
    }

    "reject usernames with two special chars in a row, but allow when not next to each other" in {
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

    "reject misc bad usernames" in {
      Validation.checkUsername("spa ce").isBad mustBe true
      Validation.checkUsername("fůňķŷdiacritics").isBad mustBe true
      Validation.checkUsername("z" * User.MaxUsernameLength + "x").isBad mustBe true
      Validation.checkUsername("x").isBad mustBe true  // too short
      Validation.checkUsername("unicode漢語").isBad mustBe true
      Validation.checkUsername("_badstart").isBad mustBe true  // starts with _
      Validation.checkUsername("555677").isBad mustBe true   // not digits only
      Validation.checkUsername("x55677").isBad mustBe false  // ... but this is ok
      Validation.checkUsername("__").isBad mustBe true  // dupl non-alnum
      Validation.checkUsername("_.").isBad mustBe true  // dupl non-alnum
      Validation.checkUsername("..").isBad mustBe true  // dupl non-alnum
    }
  }

}

