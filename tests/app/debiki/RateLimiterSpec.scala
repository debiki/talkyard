/**
 * Copyright (C) 2015 Kaj Magnus Lindberg (born 1979)
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

package debiki

import com.debiki.core._
import com.debiki.core.Prelude._
import debiki.dao.DaoAppSuite
import talkyard.server.http.DebikiRequest
import org.mockito.Mockito._
import org.mockito.Mockito
import play.api.http.Status.TOO_MANY_REQUESTS
import play.{api => p}
import java.{util => ju}
import play.api.mvc.AnyContentAsEmpty
import play.api.test.FakeHeaders



class RateLimiterSpec
  extends DaoAppSuite(
    extraConfig = Map("talkyard.isTestDisableRateLimits" -> "false")) {

  import RateLimits.Unlimited

  lazy val RateLimiter = new _root_.debiki.RateLimiter(globals, context.security)

  var nextIp = 0

  def mockRequest(now: UnixTime, ip: String = null, roleId: UserId = 0,
        siteId: SiteId = NoSiteId,
        siteReadLimitsMultiplier: Opt[f32] = None,
        siteLogLimitsMultiplier: Opt[f32] = None,
        siteCreateLimitsMultiplier: Opt[f32] = None,
        )
        : DebikiRequest[AnyContentAsEmpty.type] = {

    val requestMock = Mockito.mock(classOf[DebikiRequest[AnyContentAsEmpty.type]])
    // `now` might be small, close to 0, so add a few months.
    val fourMonthsSeconds = 10*1000*1000 // roughly four months
    val theIp = if (ip ne null) ip else {
        nextIp += 1
        s"0.0.0.$nextIp"
      }
    val anyUser =
      if (roleId == 0) None
      else Some(mockUser(roleId = roleId))
    val theSiteId = if (siteId != NoSiteId) siteId else 1234567

    val siteLimits = new SiteLimitsMultipliers {
      def id: SiteId = siteId
      def readLimitsMultiplier: Opt[f32] = siteReadLimitsMultiplier
      def logLimitsMultiplier: Opt[f32] = siteLogLimitsMultiplier
      def createLimitsMultiplier: Opt[f32] = siteCreateLimitsMultiplier
    }

    when(requestMock.siteLimits).thenReturn(siteLimits)
    when(requestMock.ctime).thenReturn(new ju.Date(now * 1000 + fourMonthsSeconds*1000))
    when(requestMock.ip).thenReturn(theIp)
    when(requestMock.user).thenReturn(anyUser)
    when(requestMock.siteId).thenReturn(theSiteId)
    when(requestMock.shallSkipRateLimitsBecauseIsTest).thenReturn(false)
    when(requestMock.underlying).thenReturn(p.test.FakeRequest(method = "GET", uri = "/dummy",
      headers = FakeHeaders(), body = AnyContentAsEmpty, remoteAddress = theIp))
    requestMock
  }


  def mockUser(roleId: RoleId): Participant = {
    val userMock = Mockito.mock(classOf[Participant])
    when(userMock.anyMemberId).thenReturn(Some(roleId))
    userMock
  }


  def makeLimits(maxPerFifteenSeconds: Int = Unlimited, maxPerFifteenMinutes: Int = Unlimited,
        maxPerDay: Int = Unlimited, maxPerDayNewUser: Int = Unlimited,
        isReadLimits: Opt[Bo] = None,
        isLogLimits: Opt[Bo] = None,
        isCreateLimits: Opt[Bo] = None,
        ): RateLimits = {

    val maxPerFifteenSeconds_ = maxPerFifteenSeconds
    val maxPerFifteenMinutes_ = maxPerFifteenMinutes
    val maxPerDay_ = maxPerDay
    val maxPerDayNewUser_ = if (maxPerDayNewUser == Unlimited) maxPerDay else maxPerDayNewUser
    val isReadLimits_ = isReadLimits
    val isLogLimits_ = isLogLimits
    val isCreateLimits_ = isCreateLimits
    new RateLimits {
      val key = "key"
      val what = "dummy"
      def maxPerFifteenSeconds: i32 = maxPerFifteenSeconds_
      def maxPerFifteenMinutes: i32 = maxPerFifteenMinutes_
      def maxPerDay: i32 = maxPerDay_
      def maxPerDayNewUser: i32 = maxPerDayNewUser_
      override def isReadLimits: Opt[Bo] = isReadLimits_
      //erride def isLogLimits: Opt[Bo] = isLogLimits_
      //erride def isCreateLimits: Opt[Bo] = isCreateLimits_
    }
  }


  def assertThrowsTooManyRequests(block: =>Unit): Unit = {
    try {
      block
      fail("Was not rate limited")
    }
    catch {
      case exception: EdHttp.ResultException =>
        exception.result.header.status mustBe TOO_MANY_REQUESTS
    }
  }


  "RateLimiter can limit request rates" - {

    "allow unlimited request" in {
      val limits = makeLimits() // no limits specified
      val request = mockRequest(now = 1)
      for (i <- 1 to 999) {
        RateLimiter.rateLimit(limits, request)
      }
    }

    "allow request below the limits" in {
      val limits = makeLimits(maxPerFifteenSeconds = 10, maxPerFifteenMinutes = 10, maxPerDay = 10)
      val request = mockRequest(now = 1)
      for (i <- 1 to 10) {
        RateLimiter.rateLimit(limits, request)
      }
    }

    "throw if above the limits" - {

      "a 15 seconds limit" in {
        val limits0 = makeLimits(maxPerFifteenSeconds = 0)
        val limits1 = makeLimits(maxPerFifteenSeconds = 1)
        val limits5 = makeLimits(maxPerFifteenSeconds = 5)
        val request = mockRequest(now = 1)

        assertThrowsTooManyRequests {
          RateLimiter.rateLimit(limits0, request)
        }

        RateLimiter.rateLimit(limits1, request)
        assertThrowsTooManyRequests {
          RateLimiter.rateLimit(limits1, request)
        }

        for (i <- 1 to 5) {
          RateLimiter.rateLimit(limits5, request)
        }
        assertThrowsTooManyRequests {
          RateLimiter.rateLimit(limits5, request)
        }
      }

      "a 15 minutes limit" in {
        val limits0 = makeLimits(maxPerFifteenMinutes = 0)
        val limits1 = makeLimits(maxPerFifteenMinutes = 1)
        val limits5 = makeLimits(maxPerFifteenMinutes = 5)
        val request = mockRequest(now = 1)

        assertThrowsTooManyRequests {
          RateLimiter.rateLimit(limits0, request)
        }

        RateLimiter.rateLimit(limits1, request)
        assertThrowsTooManyRequests {
          RateLimiter.rateLimit(limits1, request)
        }

        for (i <- 1 to 5) {
          RateLimiter.rateLimit(limits5, request)
        }
        assertThrowsTooManyRequests {
          RateLimiter.rateLimit(limits5, request)
        }
      }

      "a one day limit" in {
        val limits0 = makeLimits(maxPerDay = 0)
        val limits1 = makeLimits(maxPerDay = 1)
        val limits5 = makeLimits(maxPerDay = 5)
        val request = mockRequest(now = 1)

        assertThrowsTooManyRequests {
          RateLimiter.rateLimit(limits0, request)
        }

        RateLimiter.rateLimit(limits1, request)
        assertThrowsTooManyRequests {
          RateLimiter.rateLimit(limits1, request)
        }

        for (i <- 1 to 5) {
          RateLimiter.rateLimit(limits5, request)
        }
        assertThrowsTooManyRequests {
          RateLimiter.rateLimit(limits5, request)
        }
      }
    }

    "forget old requests, remember new" - {

      "for the 15 seconds limit" in {
        val ip = "1.1.1.1"
        val limits = makeLimits(maxPerFifteenSeconds = 5)

        RateLimiter.rateLimit(limits, mockRequest(now = 0, ip = ip))
        RateLimiter.rateLimit(limits, mockRequest(now = 1, ip = ip))
        RateLimiter.rateLimit(limits, mockRequest(now = 2, ip = ip))
        RateLimiter.rateLimit(limits, mockRequest(now = 3, ip = ip))
        RateLimiter.rateLimit(limits, mockRequest(now = 4, ip = ip))

        for (second <- 5 to 14) {
          assertThrowsTooManyRequests {
            RateLimiter.rateLimit(limits, mockRequest(now = second, ip = ip))
          }
        }

        // After 15 seconds, the oldest request should have been forgotten.
        RateLimiter.rateLimit(limits, mockRequest(now = 15, ip = ip))
        RateLimiter.rateLimit(limits, mockRequest(now = 16, ip = ip))
        RateLimiter.rateLimit(limits, mockRequest(now = 17, ip = ip))

        // But two requests at the same second won't work here.
        assertThrowsTooManyRequests {
          RateLimiter.rateLimit(limits, mockRequest(now = 17, ip = ip))
        }

        // After one second, we're okay again.
        RateLimiter.rateLimit(limits, mockRequest(now = 18, ip = ip))
      }

      "for the 15 minutes limit" in {
        val ip = "2.2.2.2"
        val limits = makeLimits(maxPerFifteenMinutes = 5)

        RateLimiter.rateLimit(limits, mockRequest(now = 0, ip = ip))
        RateLimiter.rateLimit(limits, mockRequest(now = 1*60, ip = ip))
        RateLimiter.rateLimit(limits, mockRequest(now = 2*60, ip = ip))
        RateLimiter.rateLimit(limits, mockRequest(now = 3*60, ip = ip))
        RateLimiter.rateLimit(limits, mockRequest(now = 4*60, ip = ip))

        for (minute <- 5 to 14) {
          assertThrowsTooManyRequests {
            RateLimiter.rateLimit(limits, mockRequest(now = minute*60, ip = ip))
          }
        }

        // After 15 minutes, the oldest request should have been forgotten.
        RateLimiter.rateLimit(limits, mockRequest(now = 15*60, ip = ip))
        RateLimiter.rateLimit(limits, mockRequest(now = 16*60, ip = ip))
        RateLimiter.rateLimit(limits, mockRequest(now = 17*60, ip = ip))

        // But two requests at the same minutes won't work here.
        assertThrowsTooManyRequests {
          RateLimiter.rateLimit(limits, mockRequest(now = 17*60, ip = ip))
        }

        // After one minute, we're okay again.
        RateLimiter.rateLimit(limits, mockRequest(now = 18*60, ip = ip))
      }

      "for the one day limit" in {
        val ip = "3.3.3.3"
        val limits = makeLimits(maxPerDay = 5)

        RateLimiter.rateLimit(limits, mockRequest(now = 0, ip = ip))
        RateLimiter.rateLimit(limits, mockRequest(now = 1*3600, ip = ip))
        RateLimiter.rateLimit(limits, mockRequest(now = 2*3600, ip = ip))
        RateLimiter.rateLimit(limits, mockRequest(now = 3*3600, ip = ip))
        RateLimiter.rateLimit(limits, mockRequest(now = 4*3600, ip = ip))

        for (hour <- 5 to 23) {
          assertThrowsTooManyRequests {
            RateLimiter.rateLimit(limits, mockRequest(now = hour*3600, ip = ip))
          }
        }

        // After one day, the oldest request should have been forgotten.
        RateLimiter.rateLimit(limits, mockRequest(now = 24*3600, ip = ip))
        RateLimiter.rateLimit(limits, mockRequest(now = 25*3600, ip = ip))
        RateLimiter.rateLimit(limits, mockRequest(now = 26*3600, ip = ip))

        // But two requests at the same hour won't work here.
        assertThrowsTooManyRequests {
          RateLimiter.rateLimit(limits, mockRequest(now = 26*3600, ip = ip))
        }

        // After one hour, we're okay again.
        RateLimiter.rateLimit(limits, mockRequest(now = 27*3600, ip = ip))
      }
    }

    "authenticated users get their own quota" - {

      "many users can use the same IP a lot" in {
        val ip = "9.8.7.6"
        val roleIdA = 11
        val roleIdB = 22
        val limits = makeLimits(maxPerFifteenSeconds = 3)

        RateLimiter.rateLimit(limits, mockRequest(now = 0, ip = ip))
        RateLimiter.rateLimit(limits, mockRequest(now = 0, ip = ip, roleId = roleIdA))
        RateLimiter.rateLimit(limits, mockRequest(now = 0, ip = ip, roleId = roleIdB))
        // Here we would be over quota, if the IP and the roles shared the same cache entry.
        RateLimiter.rateLimit(limits, mockRequest(now = 1, ip = ip))
        RateLimiter.rateLimit(limits, mockRequest(now = 1, ip = ip, roleId = roleIdA))
        RateLimiter.rateLimit(limits, mockRequest(now = 1, ip = ip, roleId = roleIdB))
        RateLimiter.rateLimit(limits, mockRequest(now = 2, ip = ip))
        RateLimiter.rateLimit(limits, mockRequest(now = 2, ip = ip, roleId = roleIdA))
        RateLimiter.rateLimit(limits, mockRequest(now = 2, ip = ip, roleId = roleIdB))

        assertThrowsTooManyRequests {
          RateLimiter.rateLimit(limits, mockRequest(now = 3, ip = ip))
        }
        assertThrowsTooManyRequests {
          RateLimiter.rateLimit(limits, mockRequest(now = 3, ip = ip, roleId = roleIdA))
        }
        assertThrowsTooManyRequests {
          RateLimiter.rateLimit(limits, mockRequest(now = 3, ip = ip, roleId = roleIdB))
        }
      }

      "a user can run out of quota from different IPs" in {
        val roleId = 69462
        val limits = makeLimits(maxPerFifteenSeconds = 3)

        RateLimiter.rateLimit(limits, mockRequest(now = 1, ip = "193.0.0.1", roleId = roleId))
        RateLimiter.rateLimit(limits, mockRequest(now = 2, ip = "193.0.0.2", roleId = roleId))
        RateLimiter.rateLimit(limits, mockRequest(now = 3, ip = "193.0.0.3", roleId = roleId))

        assertThrowsTooManyRequests {
          RateLimiter.rateLimit(limits, mockRequest(now = 4, ip = "193.0.0.4", roleId = roleId))
        }
      }

      "users with the same id but different sites don't share quota" in {
        val roleId = 11
        val siteIdA = 2222
        val siteIdB = 3333
        val limits = makeLimits(maxPerFifteenSeconds = 1)

        RateLimiter.rateLimit(limits, mockRequest(now = 1, roleId = roleId, siteId = siteIdA))
        // Now we would be over quota, if same site.
        RateLimiter.rateLimit(limits, mockRequest(now = 1, roleId = roleId, siteId = siteIdB))

        assertThrowsTooManyRequests {
          RateLimiter.rateLimit(limits, mockRequest(now = 2, roleId = roleId, siteId = siteIdA))
        }
        assertThrowsTooManyRequests {
          RateLimiter.rateLimit(limits, mockRequest(now = 2, roleId = roleId, siteId = siteIdB))
        }
      }
    }


    "limits are dynamic: read, create, log, per site" - {
      "a per 15 seconds read limit gets multiplied by the read limits multiplier" -  {
        val limits0 = makeLimits(maxPerFifteenSeconds = 0, isReadLimits = Some(true))
        val limits1 = makeLimits(maxPerFifteenSeconds = 1, isReadLimits = Some(true))
        val limits6 = makeLimits(maxPerFifteenSeconds = 6, isReadLimits = Some(true))
        val limits19 = makeLimits(maxPerFifteenSeconds = 19, isReadLimits = Some(true))
        val limits21 = makeLimits(maxPerFifteenSeconds = 21, isReadLimits = Some(true))

        val theMultiplier = Some(0.2f)

        def mkReq(now: i32, ip: St = null) =
          mockRequest(now = now, siteReadLimitsMultiplier = theMultiplier,
                siteId = 44, ip = ip)

        "Limit 0 * 0.2 -> 0 reqs allowed" in {
          // The limit is 0 * 0.2 = 0, so this should get rejected immediately:
          val req = mkReq(now = 1)
          assertThrowsTooManyRequests {
            RateLimiter.rateLimit(limits0, req)
          }
        }

        "Limit 1 * 0.2 -> ceil -> 1 req allowed" in {
          // 1 * 0.2 gets ceiled() up to 1, so one request should be allowed:
          val req = mkReq(now = 1)
          RateLimiter.rateLimit(limits1, req)
          // But the 2nd req gets rejected.
          assertThrowsTooManyRequests {
            RateLimiter.rateLimit(limits1, req)
          }
        }

        "Limit 6 * 0.2  = 1.2 -> ceil -> 2 reqs allowed, 3rd rejected" in {
          val req = mkReq(now = 1)
          RateLimiter.rateLimit(limits6, req)
          RateLimiter.rateLimit(limits6, req)
          assertThrowsTooManyRequests {
            RateLimiter.rateLimit(limits6, req)
          }
        }

        "Limit 19 * 0.2  = 3.8 -> ceil -> 4" in {
          val req = mkReq(now = 1)
          for (i <- 1 to 4) {
            RateLimiter.rateLimit(limits19, req)
          }
          assertThrowsTooManyRequests {
            RateLimiter.rateLimit(limits19, req)
          }
        }


        val ipForLim21 = "193.0.0.21"

        "Limit 21 * 0.2  = 4.2 -> ceil -> 5" in {
          val req = mkReq(now = 1, ip = ipForLim21)
          for (i <- 1 to 5) {
            RateLimiter.rateLimit(limits21, req)
          }
          assertThrowsTooManyRequests {
            RateLimiter.rateLimit(limits21, req)
          }
        }

        "After 15 sec, 5 more reqs are allowed" in {
          // 14 seconds is too soon. (The 1st req was at 1 sec, see above)
          val reqTooSoon = mkReq(now = 1 + 14, ip = ipForLim21)  // same IP
          assertThrowsTooManyRequests {
            RateLimiter.rateLimit(limits21, reqTooSoon)
          }

          // 16 seconds is > 15 seconds later, fine.
          val reqLater = mkReq(now = 1 + 16, ip = ipForLim21)
          for (i <- 1 to 5) {
            RateLimiter.rateLimit(limits21, reqLater)
          }

          // Too many again
          assertThrowsTooManyRequests {
            RateLimiter.rateLimit(limits21, reqLater)
          }
        }
      }


      "The per 15 mins and 1 day read limits get multiplied too" - {

        def mkReq(now: i32, readMultiplier: f32, ip: St = null) =
          mockRequest(now = now, siteReadLimitsMultiplier = Some(readMultiplier),
                siteId = 45, ip = ip)

        "The per 15 min limits work:   Limit ceil 7 * 0.3  = 3" in {
          val req = mkReq(now = 1, readMultiplier = 0.3f)
          val limits7 = makeLimits(maxPerFifteenMinutes = 7, isReadLimits = Some(true))
          for (i <- 1 to 3) {
            RateLimiter.rateLimit(limits7, req)
          }
          assertThrowsTooManyRequests {
            RateLimiter.rateLimit(limits7, req)
          }
        }


        "Limits scale up, not just down:   Limit ceil 7 * 3f  = 21" in {
          val req = mkReq(now = 1, readMultiplier = 3f)
          val limits7 = makeLimits(maxPerFifteenMinutes = 7, isReadLimits = Some(true))
          for (i <- 1 to 21) {
            RateLimiter.rateLimit(limits7, req)
          }
          assertThrowsTooManyRequests {
            RateLimiter.rateLimit(limits7, req)
          }
        }


        val ipForDayLim20 = "193.0.0.20"
        val limits20PerDay = makeLimits(maxPerDay = 20, isReadLimits = Some(true))

        "The per day limits work too:   Limit ceil 20 * 2f  = 40" in {
          val reqM2 = mkReq(now = 1, readMultiplier = 2f, ip = ipForDayLim20)

          for (i <- 1 to 40) {
            RateLimiter.rateLimit(limits20PerDay, reqM2)
          }
          assertThrowsTooManyRequests {
            RateLimiter.rateLimit(limits20PerDay, reqM2)
          }
        }

        "If too many reqs per day, ok again after 1 day — and limits still scaled up 2f" in {
          // Less than a day is too soon. (The first req was at second 1)
          val aSecondTooSoon = 1 + 3600 * 24 - 1
          val reqTooSoon = mkReq(now = aSecondTooSoon, readMultiplier = 2f, ip = ipForDayLim20)

          assertThrowsTooManyRequests {
            RateLimiter.rateLimit(limits20PerDay, reqTooSoon)
          }

          // But two seconds later is fine.
          val aSecondAfter = aSecondTooSoon + 2
          val reqLater = mkReq(now = aSecondAfter, readMultiplier = 2f, ip = ipForDayLim20)
          for (i <- 1 to 40) {
            RateLimiter.rateLimit(limits20PerDay, reqLater)
          }
          assertThrowsTooManyRequests {
            RateLimiter.rateLimit(limits20PerDay, reqLater)
          }
        }

        o"""Increasing the multiplier works too
              — hmm but currently clears the req timestamp arrays""" in {
          // Same multiplier: 2f, won't work, already done 40 + 40 reqs.
          // Yes, works! Because we've resized the request timestamp cache [rez_req_ts_cache]
          // and forgotten the old timestamps.
          val now = 1 + 3600 * 24 + 60
          /* not too many:
          val reqTooMany = mkReq(now = now, readMultiplier = 2f, ip = ipForDayLim20)
          assertThrowsTooManyRequests {
            RateLimiter.rateLimit(limits20PerDay, reqTooMany)
          } */

          // New multiplier: 3f, 20 more reqs allowed:
          val req20MoreOk = mkReq(now = now, readMultiplier = 3f, ip = ipForDayLim20)
          //r (i <- 1 to 20) {
          for (i <- 1 to 60) {  // 60 works, see above — old reqs forgotten.
            RateLimiter.rateLimit(limits20PerDay, req20MoreOk)
          }
          // And that's it.
          assertThrowsTooManyRequests {
            RateLimiter.rateLimit(limits20PerDay, req20MoreOk) // 21 no 61 more not ok
          }
        }
      }


      TESTS_MISSING // also try the create & log limits too  (not only the read limit).
      // but currently (2022-04) there are no such rate limits (becasue haven't updated them)
    }
  }

}