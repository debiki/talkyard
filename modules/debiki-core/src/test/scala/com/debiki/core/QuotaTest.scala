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


class QuotaTest extends Specification {

  val now = new ju.Date

  val res100And200And300Etc = ResourceUse(
    numIdsUnau = 200,
    numIdsAu = 300,
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
    numIdsAu = 3,
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
    numIdsAu = 303,
    numRoles = 404,
    numPages = 505,
    numActions = 606,
    numActionTextBytes = 707,
    numNotfs = 808,
    numEmailsOut = 909,
    numDbReqsRead = 1010,
    numDbReqsWrite = 1111)

  "A QuotaUse" can {
    "do addition and subtraction" >> {
      (QuotaUse(100, 200, 300) - QuotaUse(10, 20, 30)) must_==
         QuotaUse(90, 180, 270)
      (QuotaUse(100, 200, 300) + QuotaUse(10, 20, 30)) must_==
         QuotaUse(110, 220, 330)
    }
  }

  "A ResourceUse" can {
    "do addition" >> {
      res100And200And300Etc + res123Etc must_== res101And202And303Etc
    }
  }

  "A QuotaState" can {
    "use more quota and resources, push limits" >> {
      val st000 = QuotaState(now, now, QuotaUse(),
        quotaLimits = QuotaUse(0, 0, 0), quotaDailyFree = 0,
        quotaDailyFreeload = 0, resourceUse = ResourceUse())

      val later = st000.useMoreQuota(QuotaUse(10, 20, 30))
         .pushLimits(QuotaUse(50, 60, 70))
         .useMoreResources(res100And200And300Etc)

      later must_== QuotaState(now, now, QuotaUse(10, 20, 30),
         quotaLimits = QuotaUse(50, 60, 70), quotaDailyFree = 0,
         quotaDailyFreeload = 0, resourceUse = res100And200And300Etc)

      val last = later.useMoreQuota(QuotaUse(1, 2, 3))
         .pushLimits(QuotaUse(5, 6, 7))
         .useMoreResources(res123Etc)

      last must_== QuotaState(now, now, QuotaUse(11, 22, 33),
         quotaLimits = QuotaUse(55, 66, 77), quotaDailyFree = 0,
         quotaDailyFreeload = 0, resourceUse = res101And202And303Etc)
    }
  }

  "A paying QuotaState" can {

    val st120 = QuotaState(now, now, QuotaUse(),
       quotaLimits = QuotaUse(100, 200, 0), quotaDailyFree = 20,
       quotaDailyFreeload = 30, resourceUse = ResourceUse())

    "not freeload" >> {
      st120.freeload(10, pilferLimit = 0) must_== (st120, 10)
    }

    "pay and freeload 0 quota" >> {
      st120.charge(0, pilferLimit = 0) must_== (st120, 0)
      st120.freeload(0, pilferLimit = 0) must_== (st120, 0)
      st120.charge(0, pilferLimit = 100) must_== (st120, 0)
      st120.freeload(0, pilferLimit = 100) must_== (st120, 0)
    }

    "use up one quota" >> {
      st120.charge(1, 0) must_== (st120.useMoreQuota(QuotaUse(0, 1, 0)), 0)
    }

    "use up all remaining free quota" >> {
      st120.charge(200, 0) must_== (st120.useMoreQuota(QuotaUse(0, 200, 0)), 0)
    }

    "use up all remaining free quota, and one paid quta" >> {
      st120.charge(201, 0) must_== (st120.useMoreQuota(QuotaUse(1, 200, 0)), 0)
    }

    "use up all remaining free and paid quota" >> {
      st120.charge(100 + 200, 0) must_==
         (st120.useMoreQuota(QuotaUse(100, 200, 0)), 0)
    }

    "fail to pay one quota" >> {
      st120.charge(100 + 200 + 1, 0) must_==
         (st120.useMoreQuota(QuotaUse(100, 200, 0)), 1)
    }

    "fail to pay 9000 quota" >> {
      st120.charge(100 + 200 + 9000, 0) must_==
         (st120.useMoreQuota(QuotaUse(100, 200, 0)), 9000)
    }

    "pilfer 1 quota" >> {
      st120.charge(100 + 200 + 1, 1) must_==
         (st120.useMoreQuota(QuotaUse(100, 201, 0)), 0)
    }

    "not pilfer more than 10 needed quota, even if possible" >> {
      st120.charge(100 + 200 + 10, 99999) must_==
         (st120.useMoreQuota(QuotaUse(100, 210, 0)), 0)
    }

    "pilfer 90 000 000 quota" >> {
      st120.charge(100 + 200 + 90*1000*1000, 90*1000*1000) must_==
         (st120.useMoreQuota(QuotaUse(100, 90*1000*1000 + 200, 0)), 0)
    }

    "pilfer 30 quota, fail to pay 30 quota" >> {
      st120.charge(100 + 200 + 60, 30) must_==
         (st120.useMoreQuota(QuotaUse(100, 230, 0)), 30)
    }
  }

  "A freeloading QuotaState" can {

    val now = new ju.Date

    // This state freeloads on others.
    val st007 = QuotaState(now, now, QuotaUse(),
      quotaLimits = QuotaUse(0, 0, 700), quotaDailyFree = 0,
      quotaDailyFreeload = 70, resourceUse = ResourceUse())

    "not pay" >> {
      st007.charge(10, pilferLimit = 0) must_== (st007, 10)
    }

    "freeload and pay 0 quota" >> {
      st007.charge(0, pilferLimit = 0) must_== (st007, 0)
      st007.freeload(0, pilferLimit = 0) must_== (st007, 0)
      st007.charge(0, pilferLimit = 100) must_== (st007, 0)
      st007.freeload(0, pilferLimit = 100) must_== (st007, 0)
    }

    "freeload one quota" >> {
      st007.freeload(1, 0) must_== (st007.useMoreQuota(QuotaUse(0, 0, 1)), 0)
    }

    "use up all remaining free quota" >> {
      st007.freeload(700, 0) must_==
         (st007.useMoreQuota(QuotaUse(0, 0, 700)), 0)
    }

    "fail to freeload one quota" >> {
      st007.freeload(701, 0) must_==
         (st007.useMoreQuota(QuotaUse(0, 0, 700)), 1)
    }

    "fail to freeload 9000 quota" >> {
      st007.freeload(700 + 9000, 0) must_==
         (st007.useMoreQuota(QuotaUse(0, 0, 700)), 9000)
    }

    "pilfer 1 quota" >> {
      st007.freeload(701, 1) must_==
         (st007.useMoreQuota(QuotaUse(0, 0, 701)), 0)
    }

    "not pilfer more than 10 needed quota, even if possible" >> {
      st007.freeload(710, 99999) must_==
         (st007.useMoreQuota(QuotaUse(0, 0, 710)), 0)
    }

    "freeload 90 000 000 quota" >> {
      st007.freeload(700 + 90*1000*1000, 90*1000*1000) must_==
         (st007.useMoreQuota(QuotaUse(0, 0, 700 + 90*1000*1000)), 0)
    }

    "pilfer 30 quota, fail to freeload 30 quota" >> {
      st007.freeload(700 + 60, 30) must_==
         (st007.useMoreQuota(QuotaUse(0, 0, 730)), 30)
    }
  }

  "A paying and freeloading QuotaState" should {

    val st124 = QuotaState(now, now, QuotaUse(),
      quotaLimits = QuotaUse(100, 200, 400), quotaDailyFree = 20,
      quotaDailyFreeload = 30, resourceUse = ResourceUse())

    "not pay, when asked to freeload" >> {
      st124.freeload(10, 0) must_== (st124.useMoreQuota(QuotaUse(0, 0, 10)), 0)
    }

    "not pay, when asked to freeload, even if over quota" >> {
      st124.freeload(410, 0) must_==
         (st124.useMoreQuota(QuotaUse(0, 0, 400)), 10)
    }

    "not freeload, when asked to pay, even if over quota" >> {
      st124.charge(310, 0) must_==
         (st124.useMoreQuota(QuotaUse(100, 200, 0)), 10)
    }
  }

}

// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
