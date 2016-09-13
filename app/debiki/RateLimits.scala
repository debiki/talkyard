/**
 * Copyright (C) 2015 Kaj Magnus Lindberg
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
import debiki.DebikiHttp.throwTooManyRequests
import io.efdi.server.http.DebikiRequest
import net.sf.ehcache.{Element => EhcacheElement}
import java.util.concurrent.atomic.AtomicReference
import RateLimits._



abstract class RateLimits {
  def key: String
  def what: String
  def maxPerFifteenSeconds: Int
  def maxPerFifteenMinutes: Int
  def maxPerDay: Int
  def maxPerDayNewUser: Int

  assert(maxPerDay >= maxPerDayNewUser || maxPerDayNewUser == Unlimited)
  assert(maxPerDay >= maxPerFifteenMinutes || maxPerFifteenMinutes == Unlimited)
  assert(maxPerDay >= maxPerFifteenSeconds || maxPerFifteenSeconds == Unlimited)
  assert(maxPerFifteenMinutes >= maxPerFifteenSeconds || maxPerFifteenSeconds == Unlimited)


  def isUnlimited(isNewUser: Boolean) =
    maxPerFifteenSeconds == Unlimited &&
      maxPerFifteenMinutes == Unlimited &&
      (if (isNewUser) maxPerDayNewUser == Unlimited else maxPerDay == Unlimited)


  def noRequestsAllowed(isNewUser: Boolean) =
    maxPerFifteenSeconds == 0 || maxPerFifteenMinutes == 0 ||
      (if (isNewUser) maxPerDayNewUser == 0 else maxPerDay == 0)


  def numRequestsToRemember(isNewUser: Boolean) = {
    if (isNewUser && maxPerDayNewUser != Unlimited) {
      maxPerDayNewUser
    }
    else if (maxPerDay != Unlimited) {
      maxPerDay
    }
    else if (maxPerFifteenMinutes != Unlimited) {
      maxPerFifteenMinutes
    }
    else  if (maxPerFifteenSeconds != Unlimited) {
      maxPerFifteenSeconds
    }
    else {
      0
    }
  }


  def numSecondsToRemember: Int = {
    if (maxPerDay != Unlimited || maxPerDayNewUser != Unlimited) {
      24 * 3600
    }
    else  if (maxPerFifteenMinutes != Unlimited) {
      15 * 60
    }
    else if (maxPerFifteenSeconds != Unlimited) {
      15
    }
    else {
      1 // not 0 because that means unlimited
    }
  }
}



object RateLimits {
  val Unlimited = Int.MaxValue

  // COULD add more types of limits, these: (supported by Discourse as of Feb 2015)
  // - unique posts mins 5
  //   How many minutes before a user can make a post with the same content again
  // - max private messages per day 20
  //   Maximum number of private messages users can create per day.
  // - max bookmarks per day 20
  //   Maximum number of bookmarks per user per day.
  // - max invites per day 10
  //  Maximum number of invites a user can send per day.
  // Also see:
  //    http://meta.stackexchange.com/questions/164899/the-complete-rate-limiting-guide


  object NoRateLimits extends RateLimits {
    val key = "dummy"
    val what = "dummy"
    def maxPerFifteenSeconds = Unlimited
    def maxPerFifteenMinutes = Unlimited
    def maxPerDay = Unlimited
    def maxPerDayNewUser = Unlimited
  }


  object BrowserError extends RateLimits {
    val key = "BrEr"
    val what = "uploaded too many errors"
    // Shouldn't need more than this, because browsers throttle log-error http requests.
    def maxPerFifteenSeconds = 5
    def maxPerFifteenMinutes = 50
    def maxPerDay = 100
    def maxPerDayNewUser = 100
  }


  object ExpensiveGetRequest extends RateLimits {
    val key = "ExRq"
    val what = "sent too many complicated HTTP GET requests"
    def maxPerFifteenSeconds = 30
    def maxPerFifteenMinutes = 60 * 10
    def maxPerDay = Unlimited
    def maxPerDayNewUser = Unlimited
  }


  object CreateSite extends RateLimits {
    val key = "CrSt"
    val what = "created too many sites"
    def maxPerFifteenSeconds = 2
    def maxPerFifteenMinutes = 5
    def maxPerDay = 10
    def maxPerDayNewUser = 10
  }


  /** This is per IP, always, so set fairly high limits. Or ... no, computing scrypt takes long. */
  object Login extends RateLimits {
    val key = "Lgi"
    val what = "logged in too many times"
    def maxPerFifteenSeconds = 5
    def maxPerFifteenMinutes = Unlimited
    def maxPerDay = Unlimited
    def maxPerDayNewUser = Unlimited
  }


  object CreateUser extends RateLimits {
    val key = "CrUs"
    val what = "signed up too many times"
    def maxPerFifteenSeconds = 3
    def maxPerFifteenMinutes = 10
    def maxPerDay = 50
    def maxPerDayNewUser = Unlimited
  }


  /** Not sure what limits to use. */
  object ConfirmEmailAddress extends RateLimits {
    val key = "CfEA"
    val what = "confirmed email addresses too many times"
    def maxPerFifteenSeconds = 5
    def maxPerFifteenMinutes = 10
    def maxPerDay = 50
    def maxPerDayNewUser = Unlimited
  }


  /** Discourse defaults to max 10 invites per day, let's just copy that. */
  object SendInvite extends RateLimits {
    val key = "SeIn"
    val what = "sent too many invites"
    def maxPerFifteenSeconds = Unlimited
    def maxPerFifteenMinutes = Unlimited
    def maxPerDay = 10
    def maxPerDayNewUser = Unlimited
  }


  object ResetPassword extends RateLimits {
    val key = "RsPw"
    val what = "resetted your password"
    def maxPerFifteenSeconds = 2
    def maxPerFifteenMinutes = 7
    def maxPerDay = 12
    def maxPerDayNewUser = Unlimited
  }


  object ChangePassword extends RateLimits {
    val key = "ChPw"
    val what = "changed your password"
    def maxPerFifteenSeconds = 3
    def maxPerFifteenMinutes = 10
    def maxPerDay = 30
    def maxPerDayNewUser = Unlimited
  }


  object ConfigUser extends RateLimits {
    val key = "CoUs"
    val what = "configured your settings"
    def maxPerFifteenSeconds = 5
    def maxPerFifteenMinutes = 50
    def maxPerDay = Unlimited
    def maxPerDayNewUser = Unlimited
  }


  object JoinSomething extends RateLimits {
    val key = "JoSt"
    val what = "joined"
    def maxPerFifteenSeconds = 5
    def maxPerFifteenMinutes = 15 * 3
    def maxPerDay = 24 * 10
    def maxPerDayNewUser = Unlimited
  }


  /** Discourse does this, as of February 2015:
    *
    * rate limit create topic: 15
    * After creating a topic, users must wait (n) seconds before creating another topic.
    *
    * rate limit new user create topic: 60
    * After creating a topic, new users must wait (n) seconds before creating another topic.
    *
    * max topics per day: 20
    * Maximum number of topics a user can create per day.
    *
    * max topics in first day: 5
    * The maximum number of topics a user is allowed to create in their first day on the site
    */
  object CreateTopic extends RateLimits {
    val key = "CrTp"
    val what = "created too many topics"
    val maxPerFifteenSeconds = 1
    val maxPerFifteenMinutes = 8
    val maxPerDay = 20
    val maxPerDayNewUser = 5
  }


  // COULD rate limit this more, per page, though. And lower the limits, if we start
  // generating status-changed-posts.
  object TogglePage extends RateLimits {
    val key = "TgPg"
    val what = "changed the page state too many times"
    val maxPerFifteenSeconds = 10
    val maxPerFifteenMinutes = 100
    val maxPerDay = 500
    val maxPerDayNewUser = 150
  }


  /** Somewhat likely that one moves many pages at roughly the same time? */
  object MoveRenamePage extends RateLimits {
    val key = "MvPg"
    val what = "moved/renamed too many pages"
    def maxPerFifteenSeconds = 6
    def maxPerFifteenMinutes = Unlimited
    def maxPerDay = Unlimited
    def maxPerDayNewUser = Unlimited
  }


  /** Discourse does this, as of February 2015:
    *
    * rate limit create post 5
    * After posting, users must wait (n) seconds before creating another post.
    *
    * rate limit new user create post 30
    * After posting, new users must wait (n) seconds before creating another post.
    *
    * max replies in first day 10
    * The maximum number of replies a user is allowed to create in their first day on the site
    */
  object PostReply extends RateLimits {
    val key = "PoRe"
    val what = "posted too many replies"
    def maxPerFifteenSeconds = 3
    def maxPerFifteenMinutes = Unlimited
    def maxPerDay = Unlimited
    def maxPerDayNewUser = 10
  }


  object MarkNotfAsSeen extends RateLimits {
    val key = "NnSn"
    val what = "marked too many notifications as seen"
    def maxPerFifteenSeconds = 30
    def maxPerFifteenMinutes = 60 * 5
    def maxPerDay = Unlimited
    def maxPerDayNewUser = Unlimited
  }


  /** Discourse:
    * max likes per day 50
    * Maximum number of likes per user per day.
    */
  object RatePost extends RateLimits {
    val key = "RtPs"
    val what = "voted on too many posts"
    def maxPerFifteenSeconds = 8
    def maxPerFifteenMinutes = Unlimited
    def maxPerDay = 50
    def maxPerDayNewUser = Unlimited
  }


  /** Discourse:
    * max edits per day 30
    * Maximum number of edits per user per day.
    */
  object EditPost extends RateLimits {
    val key = "EdPo"
    val what = "edited too many posts"
    def maxPerFifteenSeconds = 5
    def maxPerFifteenMinutes = Unlimited
    def maxPerDay = 30
    def maxPerDayNewUser = Unlimited
  }


  object LoadOnebox extends RateLimits {
    val key = "LdOb"
    val what = "loaded too many oneboxes"
    def maxPerFifteenSeconds = 10
    def maxPerFifteenMinutes = Unlimited
    def maxPerDay = Unlimited
    def maxPerDayNewUser = Unlimited
  }


  object PinPost extends RateLimits {
    val key = "PiPo"
    val what = "pinned too many posts"
    def maxPerFifteenSeconds = 5
    def maxPerFifteenMinutes = Unlimited
    def maxPerDay = Unlimited
    def maxPerDayNewUser = Unlimited
  }


  object CloseCollapsePost extends RateLimits {
    val key = "ClPo"
    val what = "closed or collapsed too many posts"
    def maxPerFifteenSeconds = 5
    def maxPerFifteenMinutes = Unlimited
    def maxPerDay = Unlimited
    def maxPerDayNewUser = Unlimited
  }


  /** Discourse:
    * max flags per day 20
    * Maximum number of flags per user per day.
    */
  object FlagPost extends RateLimits {
    val key = "FlPo"
    val what = "flagged too many posts"
    def maxPerFifteenSeconds = Unlimited
    def maxPerFifteenMinutes = Unlimited
    def maxPerDay = 20
    def maxPerDayNewUser = Unlimited
  }


  object DeletePost extends RateLimits {
    val key = "DlPo"
    val what = "deleted too many posts"
    def maxPerFifteenSeconds = Unlimited
    def maxPerFifteenMinutes = Unlimited
    def maxPerDay = 20
    def maxPerDayNewUser = Unlimited
  }


  object UploadFile extends RateLimits {
    val key = "UpFs"
    val what = "uploaded too many files"
    def maxPerFifteenSeconds = 4
    def maxPerFifteenMinutes = 24
    def maxPerDay = 34
    def maxPerDayNewUser = Unlimited
  }


  object FullTextSearch extends RateLimits {
    val key = "FTS"
    val what = "searched too much"
    def maxPerFifteenSeconds = 10
    def maxPerFifteenMinutes = Unlimited
    def maxPerDay = Unlimited
    def maxPerDayNewUser = Unlimited
  }
}


