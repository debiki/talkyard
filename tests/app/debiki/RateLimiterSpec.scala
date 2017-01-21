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
import io.efdi.server.http.DebikiRequest
import org.scalatest._
import org.scalatest.mock.MockitoSugar
import org.scalatestplus.play.OneAppPerSuite
import org.mockito.Mockito._
import play.api.http.Status.TOO_MANY_REQUEST
import play.{api => p}
import java.{util => ju}



class RateLimiterSpec extends FreeSpec with MustMatchers with MockitoSugar
    with OneAppPerSuite {

  import RateLimits.Unlimited


  var nextIp = 0

  def mockRequest(now: UnixTime, ip: String = null, roleId: UserId = 0, siteId: SiteId = null)
        : DebikiRequest[Unit] = {
    val requestMock = mock[DebikiRequest[Unit]]
    // `now` might be small, close to 0, so add a few months.
    val fourMonthsSeconds = 10*1000*1000 // roughly four months
    val theIp = if (ip ne null) ip else {
        nextIp += 1
        s"0.0.0.$nextIp"
      }
    val anyUser =
      if (roleId == 0) None
      else Some(mockUser(roleId = roleId))
    val theSiteId = if (siteId ne null) siteId else "site_id"
    when(requestMock.ctime).thenReturn(new ju.Date(now * 1000 + fourMonthsSeconds*1000))
    when(requestMock.ip).thenReturn(theIp)
    when(requestMock.user).thenReturn(anyUser)
    when(requestMock.siteId).thenReturn(theSiteId)
    when(requestMock.underlying).thenReturn(new p.test.FakeRequest[Unit](
        method = "GET", uri = "/dummy", headers = p.mvc.Headers(), (), remoteAddress = theIp))
    requestMock
  }


  def mockUser(roleId: RoleId): User = {
    val userMock = mock[User]
    when(userMock.anyRoleId).thenReturn(Some(roleId))
    userMock
  }


  def makeLimits(maxPerFifteenSeconds: Int = Unlimited, maxPerFifteenMinutes: Int = Unlimited,
        maxPerDay: Int = Unlimited, maxPerDayNewUser: Int = Unlimited) = {
    val maxPerFifteenSeconds_ = maxPerFifteenSeconds
    val maxPerFifteenMinutes_ = maxPerFifteenMinutes
    val maxPerDay_ = maxPerDay
    val maxPerDayNewUser_ = if (maxPerDayNewUser == Unlimited) maxPerDay else maxPerDayNewUser
    new RateLimits {
      val key = "key"
      val what = "dummy"
      def maxPerFifteenSeconds = maxPerFifteenSeconds_
      def maxPerFifteenMinutes = maxPerFifteenMinutes_
      def maxPerDay = maxPerDay_
      def maxPerDayNewUser = maxPerDayNewUser_
    }
  }


  def assertThrowsTooManyRequests(block: =>Unit) {
    try {
      block
      fail("Was not rate limited")
    }
    catch {
      case exception: DebikiHttp.ResultException =>
        exception.result.header.status mustBe TOO_MANY_REQUEST
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
        val siteIdA = "siteA"
        val siteIdB = "siteB"
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
  }

}