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


class UserSpec extends FreeSpec with MustMatchers {   // TyT05RDPS24

  "User can" - {

    /* [CANONUN]
    "make usernames canonical" - {
      val canonify = User.makeUsernameCanonical _

      "simple cases" in {
        canonify("abcd") mustBe "abcd"
        canonify("abc") mustBe "abc"
      }

      "changes to lowercase" in {
        canonify("ABcdEF") mustBe "abcdef"
      }

      "collapses dupl _ underscores" in {
        canonify("UNDe__rscore") mustBe "unde_rscore"
        canonify("ma____ny_unde__rscores") mustBe "ma_ny_unde_rscores"
      }

      "trims underscore" in {
        canonify("__rabid_rat__") mustBe "rabid_rat"
      }

      "changes . dots and - dash to underscore" in {
        canonify("do.tty") mustBe "do_tty"
        canonify("ve.ry..do....tty") mustBe "ve_ry_do_tty"
        canonify("mini-dash") mustBe "mini_dash"
        canonify("su-per---da--shy") mustBe "su_per_da_shy"
      }

      "removes all at once" in {
        canonify("da--..shy__.._--d.-o..--__tt._y") mustBe "da_shy_d_o_tt_y"
      }

      "all at once" in {
        canonify("A.-B_cd_1.2-3") mustBe "a_b_cd_1_2_3"
        canonify("-_A_.-2.-__--") mustBe "a_2"
      }
    }*/

    "derive usernames from email addresses" - {
      def derive(text: String, allowDotDash: Boolean = false) =
        Participant.makeOkayUsername(text, allowDotDash = allowDotDash, _ => false)

      "simple cases" in {
        derive("abcd").get mustBe "abcd"
        derive("abc").get mustBe "abc"
      }

      "pad with digits if too short" in {
        Participant.MinUsernameLength mustBe 3
        derive("ab").get mustBe "ab2"
        derive("a").get mustBe "a23"
        derive("") mustBe None
      }

      "prefixes with 'n' if is digits-only" in {
        derive("1234").get mustBe "n1234"
        derive("9").get mustBe "n92"   // also right pads with digits 23456... up to min len
        derive("89").get mustBe "n89"
        derive("22x33").get mustBe "22x33"
        derive("x2233").get mustBe "x2233"
        derive("2233x").get mustBe "2233x"
        derive("2233").get mustBe "n2233"
      }

      "drop chars if too long" in {
        val result = derive("a234567890a234567890a23").get
        result mustBe "a234567890a234567890"
        result.length mustBe Participant.MaxUsernameLength
      }

      "prefixes with 'n' before trims to length, if numeric 'name'" in {
        val result = derive("12345678901234567890123").get
        result mustBe "n1234567890123456789"
        result.length mustBe Participant.MaxUsernameLength
      }

      "UPPERcase is okay" in {
        derive("ABC").get mustBe "ABC"
        derive("AAbbCC").get mustBe "AAbbCC"
        derive("A_b_C").get mustBe "A_b_C"
      }

      "remove diacritics: e.g. éåäö —> eaao" in {
        derive("éåäö").get mustBe "eaao"
        derive("fůňķŷ_Šťŕĭńġ").get mustBe "funky_String"
      }

      "replace Unicode chars with z, e.g. Arabic and Chinese" in {
        derive("arabicالعربية done").get mustBe "arabiczzzzzzz_done"
        derive("chinese汉语done").get mustBe "chinesezzdone"
        derive("العربية 汉语").get mustBe "zzzzzzz_zz"
      }

      "replace dots and dashes etc with _ underscore" in {
        derive("dot.dash-done").get mustBe "dot_dash_done"
        derive("space plus+done").get mustBe "space_plus_done"
      }

      "allows dots and dashes, if told" in {
        Participant.makeOkayUsername("dot.ty", allowDotDash = true, _ => false).get mustBe "dot.ty"
        Participant.makeOkayUsername("das-hy", allowDotDash = true, _ => false).get mustBe "das-hy"
        Participant.makeOkayUsername("d.o.t-d-a-sh", allowDotDash = true, _ => false
            ).get mustBe "d.o.t-d-a-sh"
      }

      "but not two adjacent dots or two dashes" in {
        Participant.makeOkayUsername("too..dotty", allowDotDash = true, _ => false).get mustBe "too_dotty"
        Participant.makeOkayUsername("too--dashy", allowDotDash = true, _ => false).get mustBe "too_dashy"
        Participant.makeOkayUsername("s-.o.-das-.-.hy", allowDotDash = true, _ => false).get mustBe "s_o_das_hy"
      }

      "and not starting or ending with dot or dash" in {
        Participant.makeOkayUsername(".hippo.", allowDotDash = true, _ => false).get mustBe "hippo"
        Participant.makeOkayUsername("-happy-", allowDotDash = true, _ => false).get mustBe "happy"
        Participant.makeOkayUsername("..donky..", allowDotDash = true, _ => false).get mustBe "donky"
        Participant.makeOkayUsername("--monkey--", allowDotDash = true, _ => false).get mustBe "monkey"
        Participant.makeOkayUsername("-.-mu..--_.-_.cho.al-l.-.", allowDotDash = true, _ => false)
            .get mustBe "mu_cho.al-l"
      }

      "and prefixes *only* digits, dots, dashes with an 'n' (for 'numeric name')" in {
        Participant.makeOkayUsername("1.2", allowDotDash = true, _ => false).get mustBe "n1.2"
        Participant.makeOkayUsername("1-2", allowDotDash = true, _ => false).get mustBe "n1-2"
        Participant.makeOkayUsername("1-2.3.4-5", allowDotDash = true, _ => false).get mustBe "n1-2.3.4-5"
        Participant.makeOkayUsername(".12", allowDotDash = true, _ => false).get mustBe "n12"
        Participant.makeOkayUsername("-34", allowDotDash = true, _ => false).get mustBe "n34"
        Participant.makeOkayUsername(".-3456", allowDotDash = true, _ => false).get mustBe "n3456"
        Participant.makeOkayUsername(".-34.5-6-.", allowDotDash = true, _ => false).get mustBe "n34.5-6"
        Participant.makeOkayUsername(".-34.x-6-.", allowDotDash = true, _ => false).get mustBe "34.x-6"
      }

      "and not .suffix that looks like file names, like '.jpg'" in {  // [5WKAJH20]
        for (suffix <- Seq("bmp", "css", "csv", "exe", "gif", "htm", "html", "ico",
            "js", "json", "jpg", "jpeg", "pdf", "png", "pgp", "rtf", "tar", "txt",
            "mpeg", "mpg", "mp4", "mp4", "m4u", "ogg", "ogx", "svg", "tif", "tiff",
            "webp", "wma", "woff", "xml", "zip")) {

          Participant.makeOkayUsername(s"fil-en.ame.$suffix", allowDotDash = true, _ => false)
            .get mustBe s"fil_en_ame_$suffix"

          Participant.makeOkayUsername(s"fil-en.ame-$suffix", allowDotDash = true, _ => false)
            .get mustBe s"fil-en.ame-$suffix"

          Participant.makeOkayUsername(s"fil-en.ame-$suffix", allowDotDash = false, _ => false)
            .get mustBe s"fil_en_ame_$suffix"
        }
      }

      "trim underscores and other specials" in {
        derive("aa_bb___").get mustBe "aa_bb"
        derive("__aa_bb").get mustBe "aa_bb"
        derive("__aa_bb___").get mustBe "aa_bb"
        derive("+aa+bb+").get mustBe "aa_bb"
        derive("..--aa+bb--..").get mustBe "aa_bb"
      }

      "trims totally, if only specials" in {
        // This gets trimmed to "", and then, since forall(charIsNumOrDotDash)) [3935RKDD03],
        // gets prefixed with 'n', and then, since too short, '23' is appended.
        derive("..--++--..").get mustBe "n23"  // hmm maybe None wold be an ok answer too.
        derive("") mustBe None
      }

      "both trims specials, and prefixes numbers with 'n'" in {
        derive("1").get mustBe "n12"
        derive("..1__").get mustBe "n12"
        derive("+-2_-+").get mustBe "n22"
        derive("__3").get mustBe "n32"
        derive("3__").get mustBe "n32"
        derive("A").get mustBe "A23"
      }

      "combine adjacent underscores" in {
        derive("aa___b___c").get mustBe "aa_b_c"
        derive("++aa  + b - + . c_+--").get mustBe "aa_b_c"
      }

      "not cut at max length so ends with '_'" in {
        Participant.MaxUsernameLength mustBe 20
        // Cut at 20 chars —> ends at [a-zA-Z0-9], fine.
        derive("name1.name2_name33_name4").get  mustBe "name1_name2_name33_n"
        // Cut at 20 chars —> ends at '_', not allowed, so the last '_' should get trimmed:
        derive("name1.name2_name334_name4").get mustBe "name1_name2_name334"
        // Try also when allowing '.':
        derive("name1.name2_name33_name4", allowDotDash = true).get  mustBe "name1.name2_name33_n"
        derive("name1.name2_name334_name4", allowDotDash = true).get mustBe "name1.name2_name334"
      }

      "not cut at max length so ends with '_', test two" in {
        Participant.MaxUsernameLength mustBe 20
        derive("a23456789012345_7_9_longerThanMax___").get mustBe "a23456789012345_7_9"
      }

      "all at once" in {
        derive(
          "Tĥïŝ ĩš â fůňķŷ Šťŕĭńġ 2dot..2dash--2underscore__ arabic:العربية chinese:汉语 漢語 !?#+,*"
          ).get mustBe (
            "This_is_a_funky_String_2dot_2dash_2underscore_arabiczzzzzzz_chinesezz_zz"
                take Participant.MaxUsernameLength)
      }

      def deriveFailN(username: String, failNumTimes: Int): Option[String] = {
        var i = 0
        def isInUse = (dummy: String) => { i += 1 ; i <= failNumTimes }
        Participant.makeOkayUsername(username, allowDotDash = false, isInUse)
      }

      "tries again if username taken" in {
        deriveFailN("abc", 1).get.length mustBe 4     // "abc" + 1 random number
        deriveFailN("abc", 2).get.length mustBe 5     // "abc" + 2 random numbers
        deriveFailN("abcdef", 3).get.length mustBe 9  // "abcdef" + 3 random
      }

      "works also if 20 long from the start, and username taken" - {
        val start = "a234567890a234abcxyz"

        "1 collision" in {
          Participant.MaxUsernameLength mustBe 20

          val result = deriveFailN(start, 1).get
          result.length mustBe Participant.MaxUsernameLength
          (start.dropRight(1) + "[0-9]").r.findFirstIn(result) mustBe Some(result)
        }

        "2 collisions" in {
          val result = deriveFailN(start, 2).get
          result.length mustBe Participant.MaxUsernameLength
          result.matches(start.dropRight(2) + "[0-9]{2}") mustBe true
        }

        "5 collisions" in {
          val result = deriveFailN(start, 5).get
          result.length mustBe Participant.MaxUsernameLength
          result.matches(start.dropRight(5) + "[0-9]{5}") mustBe true
        }
      }

      "works also if 18 = 20 - 2 long from the start, and username taken" - {
        val start = "a234567890a234abcd"

        "1 collision" in {
          Participant.MaxUsernameLength mustBe 20

          val result = deriveFailN(start, 1).get
          result.length mustBe (18 + 1)
          result.matches(start + "[0-9]") mustBe true
        }

        "2 collisions" in {
          val result = deriveFailN(start, 2).get
          result.length mustBe (18 + 2)
          result.matches(start + "[0-9]{2}") mustBe true
        }

        "3 collisions" in {
          val result = deriveFailN(start, 3).get
          result.length mustBe Participant.MaxUsernameLength
          result.matches(start.dropRight(1) + "[0-9]{3}") mustBe true
        }

        "5 collisions" in {
          val result = deriveFailN(start, 5).get
          result.length mustBe Participant.MaxUsernameLength
          result.matches(start.dropRight(3) + "[0-9]{5}") mustBe true
        }
      }
    }

  }

}
