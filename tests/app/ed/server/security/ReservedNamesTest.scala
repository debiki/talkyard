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


import org.scalatest._
import java.{util => ju}


class ReservedNamesTest extends FreeSpec with MustMatchers {


  "ReservedNames can" - {

    "allow nice names" in {
      ReservedNames.isUsernameReserved("okayname") mustBe false
      ReservedNames.isUsernameReserved("nice_name") mustBe false
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
      // Two on the same line:
      ReservedNames.isUsernameReserved("he") mustBe true
      ReservedNames.isUsernameReserved("she") mustBe true
      ReservedNames.isUsernameReserved("it") mustBe true
      ReservedNames.isUsernameReserved("hen") mustBe true
    }

    "disallow names that start with numers" in {
      ReservedNames.isUsernameReserved("123whatever") mustBe true
      ReservedNames.isUsernameReserved("4whatever") mustBe true
      ReservedNames.isUsernameReserved("not_a_number") mustBe false
    }

    "disallow whatever_123 names" in {
      ReservedNames.isUsernameReserved("whatever") mustBe false
      ReservedNames.isUsernameReserved("whatever_xzy") mustBe false
      ReservedNames.isUsernameReserved("whatever_123_xzy") mustBe false
      ReservedNames.isUsernameReserved("whatever_") mustBe true
      ReservedNames.isUsernameReserved("whatever_1") mustBe true
      ReservedNames.isUsernameReserved("whatever_123") mustBe true
      ReservedNames.isUsernameReserved("whatever_xyz_123") mustBe true
    }

  }

}

