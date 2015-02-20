/**
 * Copyright (C) 2011-2012 Kaj Magnus Lindberg (born 1979)
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
import org.specs2.mutable._

/* I've removed the ResourceUsage.+ function. Perhaps I'll add it back later so keep this for a while.
class QuotaTest extends Specification {

  val now = new ju.Date

  val res100And200And300Etc = ResourceUse(
    numIdsUnau = 200,
    numIdentities = 300,
    numRoles = 400,
    numPages = 500,
    numActions = 600,
    numActionTextBytes = 700,
    numNotfs = 800,
    numEmailsOut = 900,
    numDbReqsRead = 1000,
    numDbReqsWrite = 1100)

  val res123Etc = ResourceUse(
    numIdsUnau = 2,
    numIdentities = 3,
    numRoles = 4,
    numPages = 5,
    numActions = 6,
    numActionTextBytes = 7,
    numNotfs = 8,
    numEmailsOut = 9,
    numDbReqsRead = 10,
    numDbReqsWrite = 11)

  val res101And202And303Etc = ResourceUse(
    numIdsUnau = 202,
    numIdentities = 303,
    numRoles = 404,
    numPages = 505,
    numActions = 606,
    numActionTextBytes = 707,
    numNotfs = 808,
    numEmailsOut = 909,
    numDbReqsRead = 1010,
    numDbReqsWrite = 1111)

  "A ResourceUse" can {
    "do addition" >> {
      res100And200And300Etc + res123Etc must_== res101And202And303Etc
    }
  }

} */

// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
