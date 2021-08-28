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

import org.scalatest.freespec.AnyFreeSpec
import org.scalatest.matchers.must



class ValidationTest extends AnyFreeSpec with must.Matchers {    // TyT2AKB503


  "Validation can check usernames" - {
    "allow normal usernames" in {
      Validation.checkUsername("killy_kat").isGood mustBe true
      Validation.checkUsername("mousemonster").isGood mustBe true
      Validation.checkUsername("ted").isGood mustBe true
      Validation.checkUsername("majbritt").isGood mustBe true
    }

    "allow StackExchange names (for Talkyard demo sites only, CC-By link hack)" in {
      Validation.checkUsername("__sx_writing_12345__").isGood mustBe true
    }

    "reject numeric usernames" in {
      Validation.checkUsername("1234").isBad mustBe true
      Validation.checkUsername("0").isBad mustBe true
      Validation.checkUsername("00").isBad mustBe true
      Validation.checkUsername("000").isBad mustBe true
      Validation.checkUsername("007").isBad mustBe true
      Validation.checkUsername("700").isBad mustBe true
      Validation.checkUsername("-700").isBad mustBe true
      Validation.checkUsername("700-").isBad mustBe true
      Validation.checkUsername("700+").isBad mustBe true
      Validation.checkUsername("007_so_dangerous").isGood mustBe true
      Validation.checkUsername("so_dangerous_007").isGood mustBe true
      Validation.checkUsername("-000").isBad mustBe true
      Validation.checkUsername("000-").isBad mustBe true
      Validation.checkUsername("000+").isBad mustBe true
      Validation.checkUsername("-0").isBad mustBe true
      Validation.checkUsername("+-0").isBad mustBe true
      Validation.checkUsername("+0-").isBad mustBe true
      Validation.checkUsername("+0-3").isBad mustBe true
      Validation.checkUsername("0.5").isBad mustBe true
      Validation.checkUsername("5e7").isGood mustBe true   // ok
      Validation.checkUsername("5.5e7").isGood mustBe true // ok
    }

    "rejects digits dots dashes only" in {
      Validation.checkUsername("1.2").isBad mustBe true
      Validation.checkUsername("1-2").isBad mustBe true
      Validation.checkUsername("1-2x").isGood mustBe true
      Validation.checkUsername("1.2x").isGood mustBe true
      Validation.checkUsername("x1-2").isGood mustBe true
      Validation.checkUsername("x1.2").isGood mustBe true
      Validation.checkUsername("1x2").isGood mustBe true
      Validation.checkUsername("1.x-2").isGood mustBe true
      Validation.checkUsername("1+2").isBad mustBe true

      Validation.checkUsername("1.2.3.4").isBad mustBe true
      Validation.checkUsername("1-2-3-4").isBad mustBe true
      Validation.checkUsername("1-2.3-4").isBad mustBe true

      Validation.checkUsername("1-2.3-4x").isGood mustBe true
      Validation.checkUsername("x1-2.3-4").isGood mustBe true
      Validation.checkUsername("1-2x3-4").isGood mustBe true
    }

    "reject too short usernames" in {
      Participant.MinUsernameLength mustBe 3
      Validation.checkUsername("a").isBad mustBe true
      Validation.checkUsername("ab").isBad mustBe true
      Validation.checkUsername("ab").swap.get mustBe Validation.TooShortErrorMessage
      Validation.checkUsername("abc").isGood mustBe true
    }

    "reject too long usernames" in {
      Participant.MaxUsernameLength mustBe 20
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
      Validation.checkUsername("dotty.kitten").isGood mustBe true
      Validation.checkUsername("flashy-dash").isGood mustBe true
      Validation.checkUsername("so.do.ty-flash-fa-st").isGood mustBe true
    }

    "unless end with file suffix, like 'something.png'" in {
      // More exhaustive test in [5WKAJH20].
      Validation.checkUsername("dotty.png").isGood mustBe false
      Validation.checkUsername("dotty.jpg").isGood mustBe false
      Validation.checkUsername("dotty.gif").isGood mustBe false
      Validation.checkUsername("flashy.tar").isGood mustBe false
      Validation.checkUsername("so.do.ty-flash.html").isGood mustBe false
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
      Validation.checkUsername("creepybird-").swap.get mustBe Validation.BadLastCharErrorMessage
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
      Validation.checkUsername("z" * Participant.MaxUsernameLength + "x").isBad mustBe true
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


  "Validation can check emails" - {
    "allow normal email addresses" in {
      Check.isObviouslyBadEmail("sample@examle.com") mustBe false
      Check.isObviouslyBadEmail("dots.and-dash+plus~tilde@ex.co") mustBe false
      Check.isObviouslyBadEmail("MixedCase@ex.co") mustBe false
      Check.isObviouslyBadEmail("und_er_score@x.co") mustBe false
    }

    "disallow obviously bad addresses" in {
      Check.isObviouslyBadEmail("") mustBe true
      Check.isObviouslyBadEmail("  ") mustBe true
      Check.isObviouslyBadEmail("not@trimmed.com  ") mustBe true
      Check.isObviouslyBadEmail("  not@trimmed.com") mustBe true
      Check.isObviouslyBadEmail("space  mail@x.co") mustBe true
      Check.isObviouslyBadEmail("tabs\there@x.co") mustBe true
      Check.isObviouslyBadEmail("newline\nhere@x.co") mustBe true
      Check.isObviouslyBadEmail("return\rhere@x.co") mustBe true
      Check.isObviouslyBadEmail("no-at") mustBe true
      Check.isObviouslyBadEmail("@starts.with.at.com") mustBe true
      Check.isObviouslyBadEmail("ends-with-at@") mustBe true
      Check.isObviouslyBadEmail("two@at@x.co") mustBe true
    }
  }


  "Validation can check slugs" - {
    import Validation.findCategorySlugProblem

    "allow normal slugs" in {
      findCategorySlugProblem("slug") mustBe None
    }

    "but not uppercase" in {
      findCategorySlugProblem("sLUg") mustBe 'defined
    }

    "allow dashes" in {
      findCategorySlugProblem("slug-dash") mustBe None
      findCategorySlugProblem("slug-so-many-dashes-very") mustBe None
    }

    "but not double dashes in a row" in {
      findCategorySlugProblem("slug--doubledash").get must include("TyECATSLGDD")
    }

    "allow short slugs but not empty" in {
      findCategorySlugProblem("x") mustBe None
      findCategorySlugProblem("").get must include("TyECATSLGEMP")
    }

    "allow long slugs but not too long" in {
      findCategorySlugProblem(("a234567890" * 100).take(Category.MaxSlugLength)) mustBe None
      findCategorySlugProblem(("a234567890" * 100).take(Category.MaxSlugLength + 1)
        ).get must include("TyECATSLGLNG")
    }

    "disallow blanks" in {
      findCategorySlugProblem(" slug").get must include("TyECATSLGCHR")
      findCategorySlugProblem("slug ").get must include("TyECATSLGCHR")
      findCategorySlugProblem("sl ug").get must include("TyECATSLGCHR")
      findCategorySlugProblem("sl\nug").get must include("TyECATSLGCHR")
      findCategorySlugProblem("sl\tug").get must include("TyECATSLGCHR")
    }

    "disallow non [a-z0-9-]" in {
      findCategorySlugProblem("a-z0-9-is-fine") mustBe None
      findCategorySlugProblem("汉字chinese").get must include("TyECATSLGCHR")
      findCategorySlugProblem("slugåäö").get must include("TyECATSLGCHR")
      findCategorySlugProblem("slug{zz").get must include("TyECATSLGCHR")
      findCategorySlugProblem("slug.zz").get must include("TyECATSLGCHR")
      findCategorySlugProblem("slug#zz").get must include("TyECATSLGCHR")
      findCategorySlugProblem("slug?zz").get must include("TyECATSLGCHR")
      findCategorySlugProblem("slug/zz").get must include("TyECATSLGCHR")
      findCategorySlugProblem("slug:zz").get must include("TyECATSLGCHR")
    }

    "allow underscore" in {
      findCategorySlugProblem("slug_zz") mustBe None
      // Otherwise this wouldn't work:
      findCategorySlugProblem("__root_cat_1") mustBe None
    }

    "not start or end with dashes" in {
      findCategorySlugProblem("-slug").get must include("TyECATSLGFST")
      findCategorySlugProblem("slug-").get must include("TyECATSLGLST")
    }

    "there must be a letter, not only numbers and dashes" in {
      findCategorySlugProblem("12345").get must include("TyECATSLGLTR")
      findCategorySlugProblem("12345x") mustBe None
      findCategorySlugProblem("12-45").get must include("TyECATSLGLTR")
      findCategorySlugProblem("12-45x") mustBe None
      // Underscore counts as a letter.
      findCategorySlugProblem("12_45") mustBe None
      findCategorySlugProblem("_123") mustBe None
    }
  }


  "Validation can check external ids" - {
    import Validation.findExtIdProblem

    "disallow blank ext ids" in {
      findExtIdProblem("") mustBe 'defined
      // later:
      //findExtIdProblem(" ") mustBe 'defined
      //findExtIdProblem("   ") mustBe 'defined
      //findExtIdProblem("\t") mustBe 'defined
      //findExtIdProblem("\r") mustBe 'defined
      //findExtIdProblem("\n") mustBe 'defined
    }

    "allow normal ext ids" in {
      findExtIdProblem("extid") mustBe None
      findExtIdProblem("1234567890") mustBe None
    }

    "allow 100 chars" in {
      findExtIdProblem("1234567890" * 10) mustBe None
    }

    "but not 129 chars" in {
      findExtIdProblem(("1234567890" * 13) dropRight 1) mustBe 'defined
    }
  }

}

