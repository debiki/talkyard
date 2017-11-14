/**
 * Copyright (c) 2012-2015 Kaj Magnus Lindberg
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

package ed.server.http

import com.debiki.core._
import com.debiki.core.PageOrderOffset
import com.debiki.core.Prelude._
import controllers.Utils.ValidationImplicits._
import debiki._
import debiki.dao.SiteDao
import debiki.EdHttp._
import ed.server.EdContext
import ed.server.auth.ForumAuthzContext
import ed.server.security.{BrowserId, SidStatus, XsrfOk}
import java.{util => ju}
import play.api.mvc
import play.api.mvc._


/**
 */
abstract class DebikiRequest[A] {

  def context: EdContext = dao.context
  private def security = dao.context.security
  private def globals = dao.context.globals

  def siteIdAndCanonicalHostname: SiteBrief
  def sid: SidStatus
  def xsrfToken: XsrfOk
  def browserId: BrowserId
  def user: Option[User] // REFACTOR RENAME to 'requester' (and remove 'def requester' below)
                        // COULD? add a 'Stranger extends User' and use instead of None ?
  def dao: SiteDao
  def request: Request[A]

  def underlying: Request[A] = request

  require(siteIdAndCanonicalHostname.id == dao.siteId, "EsE76YW2")
  require(user.map(_.id) == sid.userId, "EsE7PUUY2")

  // Use instead of 'user', because 'user' is confusing when the requester asks for info
  // about another user — then, does 'user' refer to the requester or that other user?
  // Instead, use 'requester' always, to refer to the requester.
  def requester: Option[User] = user
  def theRequester: User = theUser

  def tenantId: SiteId = dao.siteId
  def siteId: SiteId = dao.siteId
  def canonicalHostname: String = siteIdAndCanonicalHostname.hostname
  def domain: String = request.domain

  lazy val siteSettings: EffectiveSettings = dao.getWholeSiteSettings()

  def who = Who(theUserId, theBrowserIdData)

  def whoOrUnknown: Who = {
    val id = user.map(_.id) getOrElse UnknownUserId
    Who(id, theBrowserIdData)
  }

  lazy val authzContext: ForumAuthzContext = dao.getForumAuthzContext(requester)

  def theBrowserIdData = BrowserIdData(ip = ip, idCookie = browserId.cookieValue,
    fingerprint = 0) // skip for now

  def browserIdIsNew: Boolean = browserId.isNew

  def spamRelatedStuff = SpamRelReqStuff(
    userAgent = headers.get("User-Agent"),
    referer = request.headers.get("referer"),
    uri = uri)

  def theUser: User = user_!
  def theUserId: UserId = theUser.id

  def userAndLevels: AnyUserAndThreatLevel = {
    val threatLevel = user match {
      case Some(user) =>
        COULD_OPTIMIZE // this loads the user again (2WKG06SU)
        val userAndLevels = theUserAndLevels
        userAndLevels.threatLevel
      case None =>
        dao.readOnlyTransaction(dao.loadThreatLevelNoUser(theBrowserIdData, _))
    }
    AnyUserAndThreatLevel(user, threatLevel)
  }

  def theUserAndLevels: UserAndLevels = {
    COULD_OPTIMIZE // cache levels + user in dao (2WKG06SU), + don't load user again
    dao.readOnlyTransaction(dao.loadUserAndLevels(who, _))
  }

  def user_! : User =
    user getOrElse throwForbidden("DwE5PK2W0", "Not logged in")

  def theMember: Member = theUser match {
    case m: Member => m
    case g: Guest => throwForbidden("EsE5YKJ37", "Not authenticated")
  }

  def anyRoleId: Option[UserId] = user.flatMap(_.anyMemberId)
  def theRoleId: UserId = anyRoleId getOrElse throwForbidden("DwE86Wb7", "Not authenticated")

  def isGuest: Boolean = user.exists(_.isGuest)
  def isStaff: Boolean = user.exists(_.isStaff)

  def session: mvc.Session = request.session

  def ip: IpAddress = security.realOrFakeIpOf(request)

  /**
   * Approximately when the server started serving this request.
   */
  lazy val ctime: ju.Date = globals.now().toJavaDate

  /** The scheme, host and port specified in the request. */
  def origin: String = s"$scheme://$host"

  def scheme = if (request.secure) "https" else "http"

  def host = request.host
  def hostname = request.host.span(_ != ':')._1

  def colonPort = request.host.dropWhile(_ != ':')

  def uri = request.uri

  def queryString = request.queryString

  def rawQueryString = request.rawQueryString

  def body = request.body

  def headers = request.headers

  def cookies = request.cookies

  def isAjax = EdHttp.isAjax(request)

  def isHttpPostRequest = request.method == "POST"

  def httpVersion = request.version


  def parseThePageQuery(): PageQuery =
    parsePageQuery() getOrElse throwBadRequest(
      "DwE2KTES7", "No sort-order-offset specified")


  def parsePageQuery(): Option[PageQuery] = {
    val sortOrderStr = queryString.getFirst("sortOrder") getOrElse { return None }
    def anyDateOffset = queryString.getLong("olderThan") map (new ju.Date(_))

    val orderOffset: PageOrderOffset = sortOrderStr match {
      case "ByBumpTime" =>
        PageOrderOffset.ByBumpTime(anyDateOffset)
      case "ByCreatedAt" =>
        PageOrderOffset.ByCreatedAt(anyDateOffset)
      case "ByScore" =>
        val scoreStr = queryString.getFirst("maxScore")
        val periodStr = queryString.getFirst("period")
        val period = periodStr.flatMap(TopTopicsPeriod.fromIntString) getOrElse TopTopicsPeriod.Month
        val score = scoreStr.map(_.toFloatOrThrow("EdE28FKSD3", "Score is not a number"))
        PageOrderOffset.ByScoreAndBumpTime(offset = score, period)
      case "ByLikes" =>
        def anyNumOffset = queryString.getInt("num") // CLEAN_UP rename 'num' to 'maxLikes'
        (anyNumOffset, anyDateOffset) match {
          case (Some(num), Some(date)) =>
            PageOrderOffset.ByLikesAndBumpTime(Some(num, date))
          case (None, None) =>
            PageOrderOffset.ByLikesAndBumpTime(None)
          case _ =>
            throwBadReq("DwE4KEW21", "Please specify both 'num' and 'olderThan' or none at all")
        }
      case x => throwBadReq("DwE05YE2", s"Bad sort order: `$x'")
    }

    val filter = parsePageFilter()
    Some(PageQuery(orderOffset, filter,
      // Later: Let user preferences override, if is staff. [8WK4SD7]
      includeAboutCategoryPages = siteSettings.showCategories))
  }


  def parsePageFilter(): PageFilter =
    queryString.getFirst("filter") match {
      case None => PageFilter.ShowAll
      case Some("ShowAll") => PageFilter.ShowAll
      case Some("ShowWaiting") => PageFilter.ShowWaiting
      case Some("ShowDeleted") =>
        if (!isStaff)
          throwForbidden("EsE5YKP3", "Only staff may list deleted topics")
        PageFilter.ShowDeleted
      case Some(x) => throwBadRequest("DwE5KGP8", s"Bad topic filter: $x")
    }


}

