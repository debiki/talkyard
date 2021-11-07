/**
 * Copyright (c) 2016 Kaj Magnus Lindberg
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

package ed.server.security

import org.scalatest.freespec.AnyFreeSpec
import org.scalatest.matchers.must


class ReservedNamesTest extends AnyFreeSpec with must.Matchers {


  "ReservedNames can" - {

    "allow nice names" in {
      ReservedNames.isUsernameReserved("okayname") mustBe false
      ReservedNames.isUsernameReserved("nice_name") mustBe false
    }

    "finds longest reserved word in string" in {
      ReservedNames.includesReservedWord("The admin is not a kitten") mustBe Some("admin")
      ReservedNames.includesReservedWord("HmmWhateverHmm") mustBe Some("whatever")
      ReservedNames.includesReservedWord("123 cgi-bin") mustBe Some("cgi-bin") // not "cgi"
      ReservedNames.includesReservedWord("123 cgi-b") mustBe Some("cgi")
      ReservedNames.includesReservedWord("123 comments") mustBe Some("comments")
      ReservedNames.includesReservedWord("123 comment") mustBe Some("comment")
      ReservedNames.includesReservedWord("123 comment configuration") mustBe Some("configuration")
      ReservedNames.includesReservedWord("123") mustBe None
    }

    "disallow reserved names" in {
      // One per line:
      ReservedNames.isUsernameReserved("admin") mustBe true
      ReservedNames.isUsernameReserved("thread") mustBe true
      ReservedNames.isUsernameReserved("discussion") mustBe true
      // Two on the same line:
      ReservedNames.isUsernameReserved("anyone") mustBe true
      ReservedNames.isUsernameReserved("anybody") mustBe true
      ReservedNames.isUsernameReserved("someone") mustBe true
      ReservedNames.isUsernameReserved("somebody") mustBe true
      ReservedNames.isUsernameReserved("whatever") mustBe true
      // Two on the same line:
      ReservedNames.isUsernameReserved("he") mustBe true
      ReservedNames.isUsernameReserved("she") mustBe true
      ReservedNames.isUsernameReserved("it") mustBe true
      ReservedNames.isUsernameReserved("hen") mustBe true
    }

    "allow names that start with numers" in {
      ReservedNames.isUsernameReserved("123whatever") mustBe false
      ReservedNames.isUsernameReserved("4whatever") mustBe false
      ReservedNames.isUsernameReserved("not_a_number") mustBe false
    }

    "allow whatever_123 names" in {
      ReservedNames.isUsernameReserved("fine123") mustBe false
      ReservedNames.isUsernameReserved("whatever_xzy") mustBe false
      ReservedNames.isUsernameReserved("whatever_123_xzy") mustBe false
      ReservedNames.isUsernameReserved("whatever_") mustBe false
      ReservedNames.isUsernameReserved("whatever_1") mustBe false
      ReservedNames.isUsernameReserved("whatever_123") mustBe false
      ReservedNames.isUsernameReserved("whatever_xyz_123") mustBe false
    }

  }

}

