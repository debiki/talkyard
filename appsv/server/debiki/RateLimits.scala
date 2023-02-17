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

import RateLimits._
import com.debiki.core._
import com.debiki.core.Prelude._


/** There should be a Max-X-per-site restriction for each X that can be saved in
  * the database — or X should count against the allowed disc quota.
  * Otherwise it'd be possible to out-of-disk DoS attack the database,
  * or DoS attack the CPUs by giving O(n2) algorithms too many items.
  *
  * Maybe should be two default limits? One for blog comments sites —
  * they shouldn't need many categories or permissions. And another for
  * discussion forums.
  *
  * [dynamic_max_limits]
  */
object MaxLimits {

  val Default: MaxLimits = MaxLimits(
    maxCategories = 500,    // later, change to 50 — barely any forum has more than 30
    maxTagTypes = 250,
    maxPermsPerSite = 1000, // was: 200
    maxCustomGroups = 21,
    maxGroupsMemberCanJoin = 25,
    maxMembersPerCustomGroup = 1000,
    )

  // There are many other limits but they're hardcoded here and there ...
  // COULD move them all to here. A nice first step, to later on making it
  // possible to bump the restrictions, per site.

  // These don't make much sense to scale with site size.
  val MaxAssignedPerPost: i32 = 10
}


case class MaxLimits(
  maxCategories: i32,
  maxTagTypes: i32,
  maxPermsPerSite: i32,
  maxCustomGroups: i32,
  maxGroupsMemberCanJoin: i32,
  maxMembersPerCustomGroup: i32,
) {

  /** Usage:  MaxLimits.Default.multByMultipliers(site)
    */
  def multByMultipliers(limitsMultipliers: SiteLimitsMultipliers): MaxLimits = {
    val m = limitsMultipliers
    this.copy(
          maxCategories = multInt32(maxCategories, m.createLimitsMultiplier),
          maxTagTypes = multInt32(maxTagTypes, m.createLimitsMultiplier),
          maxPermsPerSite = multInt32(maxPermsPerSite, m.createLimitsMultiplier),
          maxCustomGroups = multInt32(maxCustomGroups, m.createLimitsMultiplier),
          maxGroupsMemberCanJoin =
                multInt32(maxGroupsMemberCanJoin, m.createLimitsMultiplier),
          maxMembersPerCustomGroup =
                multInt32(maxMembersPerCustomGroup, m.createLimitsMultiplier))
  }

  private def multInt32(value: i32, anyMultiplier: Opt[f32]): i32 = {
    val multiplier = anyMultiplier getOrElse { return value }
    clampToInt(value.toLong * multiplier.toDouble)
  }
}



// CLEAN
abstract class RateLimits {  CLEAN_UP // change to case class, and all concrete limits to vals instead of objects [rate_lims_case_cl]
  def key: St
  def what: St
  def maxPerFifteenSeconds: i32
  def maxPerFifteenMinutes: i32
  def maxPerDay: i32
  def maxPerDayNewUser: i32
  def isReadLimits: Opt[Bo] = None  // only partly impl

  override def toString(): St =
    (s"RateLimits($key, $what, maxPerFifteenSeconds: $maxPerFifteenSeconds, " +
        s"maxPerFifteenMinutes: $maxPerFifteenMinutes, " +
        s"maxPerDay: $maxPerDay, " +
        s"maxPerDayNewUser: $maxPerDayNewUser, " +
        s"isReadLimits: $isReadLimits")

  assert(maxPerDay >= maxPerDayNewUser || maxPerDayNewUser == Unlimited)
  assert(maxPerDay >= maxPerFifteenMinutes || maxPerFifteenMinutes == Unlimited)
  assert(maxPerDay >= maxPerFifteenSeconds || maxPerFifteenSeconds == Unlimited)
  assert(maxPerFifteenMinutes >= maxPerFifteenSeconds || maxPerFifteenSeconds == Unlimited)


  def multBy(siteLimits: SiteLimitsMultipliers): RateLimits = {
    val anyMultiplier: Opt[f32] =
          if (isReadLimits is true) {
            siteLimits.readLimitsMultiplier
          }
          else {
            // Later, would mult by write limits or log limits?
            None
          }

    val m = anyMultiplier getOrElse {
      return this // unchanged
    }

    def multByM(lim: i32): i32 = {
      if (lim == Unlimited) Unlimited
      else {
        // Better round up, so won't accidentally get zero, if a multiplier is 0 < _ < 1.
        val next64: f64 = math.ceil(lim.toLong * m.toDouble)
        if (next64 > MaxReqsToRemember) Unlimited
        else if (next64 <= 0.0) 0
        else next64.toInt
      }
    }

    // Later, when is case class:   [rate_lims_case_cl]
    // copy(maxPerFifteenSeconds = math.floor(maxPerFifteenSeconds * m),
    //       maxPerFifteenMinutes = math.floor(maxPerFifteenMinutes * m),
    //       maxPerDay = math.floor(maxPerDay * m),
    //       maxPerDayNewUser = math.floor(maxPerDayNewUser * m))
    //
    // But for now:
    val _this = this
    new RateLimits {
      val key: St = _this.key
      val what: St = _this.what
      val maxPerFifteenSeconds: i32 = multByM(_this.maxPerFifteenSeconds)
      val maxPerFifteenMinutes: i32 = multByM(_this.maxPerFifteenMinutes)
      val maxPerDay: i32 = multByM(_this.maxPerDay)
      val maxPerDayNewUser: i32 = multByM(_this.maxPerDayNewUser)
    }
  }

  def isUnlimited(isNewUser: Bo): Bo =
    maxPerFifteenSeconds == Unlimited &&
      maxPerFifteenMinutes == Unlimited &&
      (if (isNewUser) maxPerDayNewUser == Unlimited else maxPerDay == Unlimited)


  def noRequestsAllowed(isNewUser: Bo): Bo =
    maxPerFifteenSeconds == 0 || maxPerFifteenMinutes == 0 ||
      (if (isNewUser) maxPerDayNewUser == 0 else maxPerDay == 0)


  def numRequestsToRemember(isNewUser: Bo): i32 = {
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
}



object RateLimits {

  // If a rate limit is higher than this, it'll behave like Unlimited.
  // (So as not to allocate an a too big array.)
  val MaxReqsToRemember: i32 = 1000

  val Unlimited: Int = Int.MaxValue

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


  // There're rate limits in Nginx, see docker/web/server-limits.conf.
  object NoRateLimits extends RateLimits {
    val key = "dummy"
    val what = "dummy"
    def maxPerFifteenSeconds: Int = Unlimited
    def maxPerFifteenMinutes: Int = Unlimited
    def maxPerDay: Int = Unlimited
    def maxPerDayNewUser: Int = Unlimited
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


  object ViewPage extends RateLimits {
    val key = "VP"
    val what = "viewed pages too quickly"
    // 4*  because: [UNIDEADL]
    def maxPerFifteenSeconds = 4* 40             // 160/min
    def maxPerFifteenMinutes: Int = 4* 60 * 15   //  60/min
    def maxPerDay: Int = Unlimited
    def maxPerDayNewUser: Int = Unlimited
  }


  // This can be rather expensive? Needs to load page content from the db, maybe run React.js.
  object ViewPageNoCache extends RateLimits {
    val key = "VPNC"
    val what = "viewed uncacheable pages too quickly"
    // 2*  because: [UNIDEADL]
    def maxPerFifteenSeconds = 6              // 24/min
    def maxPerFifteenMinutes: Int = 2* 8 * 15    //  8/min
    def maxPerDay: Int = Unlimited
    def maxPerDayNewUser: Int = Unlimited
  }


  object ConnectWebSocket extends RateLimits {
    val key = "WSC"
    val what = "Connected WebSocket too quickly"
    def maxPerFifteenSeconds = 25              // 100/min
    def maxPerFifteenMinutes: Int =  30 * 15   //  30/min
    def maxPerDay: Int = Unlimited
    def maxPerDayNewUser: Int = Unlimited
  }


  // This is per user, since needs to be authenticated to send ws messages.
  object SendWebSocketMessage extends RateLimits {
    val key = "WSM"
    val what = "Sent too many WebSocket messages"
    def maxPerFifteenSeconds = 25              // 100/min
    def maxPerFifteenMinutes: Int =  30 * 15   //  30/min
    def maxPerDay: Int = Unlimited
    def maxPerDayNewUser: Int = Unlimited
  }


  object ExpensiveGetRequest extends RateLimits {
    val key = "ExRq"
    val what = "sent too many complicated HTTP GET requests"
    def maxPerFifteenSeconds = 15             //  60/min
    def maxPerFifteenMinutes: Int = 20 * 15   //  20/min
    def maxPerDay: Int = Unlimited
    def maxPerDayNewUser: Int = Unlimited
  }


  object ReadsFromDb extends RateLimits {
    val key = "DbRq"
    val what = "sent too many a bit complicated HTTP GET requests"
    // 3*  because: [UNIDEADL]
    def maxPerFifteenSeconds = 3* 25             //  100/min
    def maxPerFifteenMinutes: Int = 3* 30 * 15   //   30/min
    def maxPerDay: Int = Unlimited
    def maxPerDayNewUser: Int = Unlimited
  }


  val ReadsFromCache = ReadsFromDb  // for now


  object AdminWritesToDb extends RateLimits {
    val key = "AdWr"
    val what = "sent too many resource consuming HTTP requests"
    def maxPerFifteenSeconds = 10            //  40/min
    def maxPerFifteenMinutes: i32 = 12 * 15  //  12/min
    def maxPerDay: i32 = Unlimited
    def maxPerDayNewUser: i32 = Unlimited
  }


  object TrackReadingActivity extends RateLimits {
    val IntervalSeconds = 30 // dupl constant, in js too [6AK2WX0G]
    // 4*  because: [UNIDEADL]
    private val MaxReadersPerIp = 4* 100
    private val BurstFactor = 1.5
    val key = "TRA"
    val what = "sent too many I've-read-this-and-that messages"
    def maxPerFifteenSeconds: Int = (15f / IntervalSeconds * MaxReadersPerIp * BurstFactor).toInt
    def maxPerFifteenMinutes: Int = Unlimited
    def maxPerDay: Int = Unlimited
    def maxPerDayNewUser: Int = Unlimited
  }


  object CreateSite extends RateLimits {
    val key = "CrSt"
    val what = "created too many sites"
    def maxPerFifteenSeconds = 2
    def maxPerFifteenMinutes = 5
    def maxPerDay = 10
    def maxPerDayNewUser = 10
  }


  object ExportSite extends RateLimits {
    val key = "ExSt"
    val what = "Exported the site too many times"
    def maxPerFifteenSeconds = 1
    def maxPerFifteenMinutes = 7
    def maxPerDay = 12
    def maxPerDayNewUser = 0
  }


  /** For upserting just one or two things, e.g. two categories.
    *
    * Sometimes an organization needs to quickly upsert many things, e.g. if they
    * have 100 categories and want to do an initial import of all categories, one
    * category per request. — So allow somewhat high bursts (rather than
    * forcing them to write custom bulk insert code).
    *
    * Also, one needs to ask for permission to use this endpoint. [UPSRTPERM]
    */
  object UpsertFew extends RateLimits {
    val key = "UpFw"
    val what = "Upserted a few things too many times"
    def maxPerFifteenSeconds = 150  // fairly high burst
    def maxPerFifteenMinutes = 600
    def maxPerDay = 2400  // but not super many, per day
    def maxPerDayNewUser = 0
  }


  object UpsertMany extends RateLimits {
    val key = "UpMn"
    val what = "Upserted many things too many times"
    def maxPerFifteenSeconds = 10
    def maxPerFifteenMinutes = 30
    def maxPerDay = 90
    def maxPerDayNewUser = 0
  }


  object UpsertDump extends RateLimits {
    val key = "UpDp"
    val what = "Upserted dumps too many times"
    def maxPerFifteenSeconds = 1
    def maxPerFifteenMinutes = 5
    def maxPerDay = 9
    def maxPerDayNewUser = 0
  }


  /** This is per IP, always, so set fairly high limits. Or ... no, computing scrypt takes long. */
  object Login extends RateLimits {
    val key = "Lgi"
    val what = "logged in too many times"
    // 2*  because: [UNIDEADL]
    def maxPerFifteenSeconds = 2*  20
    def maxPerFifteenMinutes: Int = 150
    def maxPerDay: Int = Unlimited
    def maxPerDayNewUser: Int = Unlimited
  }


  object CreateUser extends RateLimits {
    val key = "CrUs"
    val what = "signed up too many times"
    // Many students from a school signed up the same day, just before a deadline. [UNIDEADL]
    // For now, bump the limits so that scenario works fine.
    // SHOULD make per site configurable. And maybe a maxPerWeek too?
    def maxPerFifteenSeconds = 15  // 3
    def maxPerFifteenMinutes = 50  // 10
    def maxPerDay = 200            // 25
    def maxPerDayNewUser: Int = Unlimited
  }


  /** No reason to do this more than once ... per month? Year? Lifetime? And can be resource heavy,
    * so set low limits.
    */
  object DownloadOwnContentArchive extends RateLimits {
    val key = "DCA"
    val what = "downloaded your content too many times"
    def maxPerFifteenSeconds = 2
    def maxPerFifteenMinutes = 4
    def maxPerDay = 6
    def maxPerDayNewUser = 6
  }


  object DownloaPersonalData extends RateLimits {
    val key = "DPD"
    val what = "downloaded your personal data many times"
    def maxPerFifteenSeconds = 3
    def maxPerFifteenMinutes = 10
    def maxPerDay = 20
    def maxPerDayNewUser = 10
  }


  /** Not sure what limits to use. */
  object ConfirmEmailAddress extends RateLimits {
    val key = "CfEA"
    val what = "confirmed email addresses too many times"
    // Higher, because: [UNIDEADL]
    def maxPerFifteenSeconds = 15   // 5
    def maxPerFifteenMinutes = 50   // 10
    def maxPerDay = 200             // 50
    def maxPerDayNewUser: Int = Unlimited
  }


  /** Not sure what limits to use. */
  object NewPasswordPage extends RateLimits {
    val key = "NPwP"
    val what = "specified new password too frequently"
    def maxPerFifteenSeconds = 5
    def maxPerFifteenMinutes = 25
    def maxPerDay = 75
    def maxPerDayNewUser: Int = Unlimited
  }


  /** Discourse defaults to max 10 invites per day. */
  object SendInvite extends RateLimits {
    val key = "SeIn"
    val what = "sent too many invites"
    def maxPerFifteenSeconds: Int = 4
    def maxPerFifteenMinutes: Int = Unlimited
    def maxPerDay = 10
    def maxPerDayNewUser: Int = Unlimited
  }


  object ResetPassword extends RateLimits {
    val key = "RsPw"
    val what = "reset your password too many times"
    // This is per ip address, not per account, right, so not too low.
    def maxPerFifteenSeconds = 5
    def maxPerFifteenMinutes = 25
    def maxPerDay = 75
    def maxPerDayNewUser: Int = Unlimited
  }


  abstract class ChangeAccountRateLimits extends RateLimits {
    def maxPerFifteenSeconds: Int = 5
    def maxPerFifteenMinutes: Int = 15
    def maxPerDay: Int = 45
    def maxPerDayNewUser: Int = Unlimited
  }


  object ChangePassword extends ChangeAccountRateLimits {
    val key = "ChPw"
    val what = "changed your password too many times"
  }


  object AddEmailLogin extends ChangeAccountRateLimits {
    val key = "EmLg"
    val what = "added an email address or login method too many times"
  }


  object LinkExtIdentity extends ChangeAccountRateLimits {
    val key = "LnId"
    val what = "linked an external identity to an account"
  }


  object ConfigUser extends RateLimits {
    val key = "CoUs"
    val what = "configured your settings too many times"
    def maxPerFifteenSeconds = 5
    def maxPerFifteenMinutes = 50
    def maxPerDay: Int = Unlimited
    def maxPerDayNewUser: Int = Unlimited
  }


  object JoinSomething extends RateLimits {
    val key = "JoSt"
    val what = "joined too many times"
    def maxPerFifteenSeconds = 5
    def maxPerFifteenMinutes: Int = 15 * 3
    def maxPerDay: Int = 24 * 10
    def maxPerDayNewUser: Int = Unlimited
  }


  // Maybe not until after > 50 cats?
  // Or maybe proportionally to num topics?
  // Example:  10 000 topics —>  <= 5% * 10 000 = 500 cats?
  // CreateCategory, no, us this for "all":?
  object CreateTagCatPermGroup extends RateLimits {
    val key = "CrTgCtPeGp"
    val what = "created too many tags or categories etc"
    def maxPerFifteenSeconds = 7
    def maxPerFifteenMinutes = 50
    def maxPerDay: Int = Unlimited
    def maxPerDayNewUser: Int = Unlimited
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
    val maxPerFifteenSeconds = 2
    val maxPerFifteenMinutes = 8
    val maxPerDay = 20
    val maxPerDayNewUser = 7
  }


  // COULD rate limit this more, per page, though. And lower the limits, if we start
  // generating status-changed-posts.
  object TogglePage extends RateLimits {
    val key = "TgPg"
    val what = "changed the page state too many times"
    val maxPerFifteenSeconds = 7
    val maxPerFifteenMinutes = 70
    val maxPerDay = 300
    val maxPerDayNewUser = 30
  }


  /** Somewhat likely that one moves many pages at roughly the same time? */
  object MoveRenamePage extends RateLimits {
    val key = "MvPg"
    val what = "moved/renamed too many pages"
    def maxPerFifteenSeconds = 6
    def maxPerFifteenMinutes: Int = Unlimited
    def maxPerDay: Int = Unlimited
    def maxPerDayNewUser: Int = Unlimited
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
    def maxPerFifteenMinutes: Int = Unlimited
    def maxPerDay: Int = Unlimited
    def maxPerDayNewUser = 20
  }


  object DraftSomething extends RateLimits {
    val key = "Drft"
    val what = "edited or deleted your drafts too quickly"
    def maxPerFifteenSeconds = 15  // 60/min = one per second, auto-saving every 2nd second [7AKBJ42]
    def maxPerFifteenMinutes: Int = Unlimited
    // 3 people at the same ip, edits constantly for 2.5 hours = 150 min, auto-saving 30 times / minute.
    // But this is per logged in user though, not per ip.
    def maxPerDay: Int = 3 * 150 * 30
    def maxPerDayNewUser: Int = Unlimited
  }


  object MarkNotfAsSeen extends RateLimits {
    val key = "NnSn"
    val what = "marked too many notifications as seen"
    def maxPerFifteenSeconds = 30
    def maxPerFifteenMinutes: Int = 60 * 5
    def maxPerDay: Int = Unlimited
    def maxPerDayNewUser: Int = Unlimited
  }


  /** Discourse:
    * max likes per day 50
    * Maximum number of likes per user per day.
    */
  object RatePost extends RateLimits {
    val key = "RtPs"
    val what = "voted on too many posts"
    def maxPerFifteenSeconds = 8
    def maxPerFifteenMinutes: Int = Unlimited
    def maxPerDay = 50
    def maxPerDayNewUser: Int = Unlimited
  }


  /** Discourse:
    * max edits per day 30
    * Maximum number of edits per user per day.
    */
  object EditPost extends RateLimits {
    val key = "EdPo"
    val what = "edited too many posts"
    def maxPerFifteenSeconds = 5
    def maxPerFifteenMinutes: Int = Unlimited
    def maxPerDay = 40
    def maxPerDayNewUser: Int = Unlimited
  }


  object FetchLinkPreview extends RateLimits {
    val key = "LnPv"
    val what = "fetched too many link previews"
    def maxPerFifteenSeconds = 10
    def maxPerFifteenMinutes: Int = 75  // 5 per minute is a lot?
    def maxPerDay: Int = Unlimited
    def maxPerDayNewUser: Int = Unlimited
  }


  object PinPost extends RateLimits {
    val key = "PiPo"
    val what = "pinned too many posts"
    def maxPerFifteenSeconds = 5
    def maxPerFifteenMinutes: Int = Unlimited
    def maxPerDay: Int = Unlimited
    def maxPerDayNewUser: Int = Unlimited
  }


  object CloseCollapsePost extends RateLimits {
    val key = "ClPo"
    val what = "closed or collapsed too many posts"
    def maxPerFifteenSeconds = 5
    def maxPerFifteenMinutes: Int = Unlimited
    def maxPerDay: Int = Unlimited
    def maxPerDayNewUser: Int = Unlimited
  }


  /** Discourse:
    * max flags per day 20
    * Maximum number of flags per user per day.
    */
  object FlagPost extends RateLimits {
    val key = "FlPo"
    val what = "flagged too many posts"
    def maxPerFifteenSeconds: Int = 10
    def maxPerFifteenMinutes: Int = Unlimited
    def maxPerDay = 20
    def maxPerDayNewUser: Int = Unlimited
  }


  object DeletePost extends RateLimits {
    val key = "DlPo"
    val what = "deleted too many posts"
    def maxPerFifteenSeconds: Int = 10
    def maxPerFifteenMinutes: Int = Unlimited
    def maxPerDay = 20
    def maxPerDayNewUser: Int = Unlimited
  }


  object UploadFile extends RateLimits {
    val key = "UpFs"
    val what = "uploaded too many files"
    def maxPerFifteenSeconds = 4
    def maxPerFifteenMinutes = 24
    def maxPerDay = 34
    def maxPerDayNewUser: Int = Unlimited
  }


  object FullTextSearch extends RateLimits {
    val key = "FTS"
    val what = "searched too much"
    def maxPerFifteenSeconds = 10
    def maxPerFifteenMinutes: Int = Unlimited
    def maxPerDay: Int = Unlimited
    def maxPerDayNewUser: Int = Unlimited
    override def isReadLimits: Opt[Bo] = Some(true)
  }
}


