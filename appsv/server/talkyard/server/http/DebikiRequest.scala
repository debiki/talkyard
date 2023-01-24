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

package talkyard.server.http

import com.debiki.core._
import com.debiki.core.PageOrderOffset
import com.debiki.core.Prelude._
import controllers.Utils.ValidationImplicits._
import debiki._
import debiki.dao.{SiteDao, SystemDao}
import debiki.EdHttp._
import talkyard.server.TyContext
import talkyard.server.authz.{AuthzCtxWithReqer, ForumAuthzContext, AuthzCtxOnAllWithReqer}
import talkyard.server.security.{BrowserId, SidOk, SidStatus, XsrfOk}
import java.{util => ju}
import play.api.mvc._


// Split into  TyReq and AuthnTyReq? Where AuthnTyReq always has a Member as the requester.
abstract class DebikiRequest[A] extends AuthnReqHeader {
  def request: Request[A]
  override def underlying: Request[A] = request
  def body: A = request.body
}


/**
 */
// Split into  TyReqHeader<U = Option[User]> and AuthnTyReqHeader = TyReqHeader<U = User>?
// Rename RequestHeader to p_RequestHeader and Result to p_Result?
abstract class AuthnReqHeader extends SomethingToRateLimit {

  def context: TyContext = dao.context
  private def security = dao.context.security
  private def globals = dao.context.globals

  def site: SiteBrief

  // Same as 'site' but with fewer fields exposed.
  def siteLimits: SiteLimitsMultipliers = site

  def anyTySession: Opt[TySession]
  def tySession: TySession = anyTySession getOrElse throwForbidden("TyE0SESS", "Not logged in")

  def sid: SidStatus
  def xsrfToken: XsrfOk
  def browserId: Option[BrowserId]
  def user: Option[Participant] // REFACTOR RENAME to 'requester' (and remove 'def requester' below)
                        // COULD? add a 'Stranger extends User' and use instead of None ?
  def dao: SiteDao
  def systemDao: SystemDao = globals.systemDao

  def theSiteUserId: SiteUserId = SiteUserId(site.id, theUser.id)

  def request: RequestHeader

  def hasOkE2eTestPassword: Boolean = security.hasOkE2eTestPassword(underlying)

  def underlying: RequestHeader = request

  def tracerSpan: io.opentracing.Span =
    request.attrs(SafeActions.TracerSpanKey)

  def tracerSpanLogEvent(eventName: String): Unit = {   // [TRACING]
    tracerSpan.log(com.google.common.collect.ImmutableMap.of("event", eventName))
  }

  def tracerSpanLogEventValue(eventName: String, value: String): Unit = {
    tracerSpan.log(com.google.common.collect.ImmutableMap.of("event", eventName, "value", value))
  }

  def isViaApiSecret: Boolean = sid match { // should be case obj AuthnMethod.ApiSecret instead? [5BKRH02]
    case SidOk(TySession.ApiSecretPart12, 0, _) => true
    case _ => false
  }

  require(site.id == dao.siteId, "EsE76YW2")
  require(user.forall(_.id == sid.userId.getOrDie("TyE2KWQP4")), "TyE7PUUY2")

  // Use instead of 'user', because 'user' is confusing when the requester asks for info
  // about another user — then, does 'user' refer to the requester or that other user?
  // Instead, use 'requester' always, to refer to the requester.
  def requester: Option[Participant] = user
  def reqer: Opt[Pat] = user  // shorter, nicer. "Req" = request, + "er" = "requester"
                        RENAME // to  anyReqer?
  def requesterOrUnknown: Participant = user getOrElse UnknownParticipant
  //f requesterIdOrUnknown: TrueId = user.map(_.trueId2) getOrElse TrueId(UnknownUserId)
  def theRequester: Participant = theUser
  def theReqer: Pat = theUser  // shorter, better

  def tenantId: SiteId = dao.siteId
  def siteId: SiteId = dao.siteId
  def isDefaultSite: Boolean = siteId == globals.defaultSiteId
  def canonicalHostname: Option[String] = site.hostname
  def domain: String = request.domain

  lazy val siteSettings: EffectiveSettings = dao.getWholeSiteSettings()

  def reqrId: ReqrId = who
  @deprecated("use reqrId: ReqrId instead", "now")
  def who = Who(theUser.trueId2, theBrowserIdData)

  def whoOrUnknown: Who = Who(requesterOrUnknown.trueId2, theBrowserIdData)

  def authzCtxWithReqer: AuthzCtxWithReqer = dao.getAuthzCtxWithReqer(theRequester)
  lazy val authzContext: ForumAuthzContext = dao.getForumAuthzContext(requester)
  lazy val authzCtxOnAllWithReqer: Opt[AuthzCtxOnAllWithReqer] =
    dao.anyAuthCtxOnPagesForPat(reqer)

  def theBrowserIdData = BrowserIdData(ip = ip, idCookie = browserId.map(_.cookieValue),
    fingerprint = 0) // skip for now

  // Hmm will need this also for WebSocket? [WSSPAM] Remember this, from
  // the initial HTTP upgrade request?
  def spamRelatedStuff = SpamRelReqStuff(
    userAgent = headers.get("User-Agent"),
    referer = request.headers.get("referer"),
    uri = uri,
    userName = user.map(_.usernameSpaceOtherName).trimNoneIfBlank,
    userEmail = user.map(_.email).trimNoneIfBlank,
    userUrl = None,
    userTrustLevel = user.map(_.effectiveTrustLevel))

  @deprecated("now", "use theRequester instead") // and rename theMember to theReqUser?
  def theUser: Participant = user_!
  @deprecated("now", "use theRequesterId instead")
  def theUserId: UserId = theUser.id
  def theRequesterId: UserId = theUser.id
  def theReqerId: PatId = theRequesterId // shorter, nice

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

  def user_! : Participant =
    user getOrElse throwForbidden("TyE0LGDIN_", "Not logged in")

  def theMember: User = theUser match {
    case m: User => m
    case _: Anonym => throwForbidden("TyE5YKJ36", "Not a user, but an anonym")
    case _: Guest => throwForbidden("EsE5YKJ37", "Not authenticated")
    case _: Group => throwForbidden("TyE5YKJ38", "Not a user, but a group")
    case UnknownParticipant => throwForbidden("TyE5YKJ39", "Unknown participant")
  }

  def anyRoleId: Option[UserId] = user.flatMap(_.anyMemberId)
  def theRoleId: UserId = anyRoleId getOrElse throwForbidden("DwE86Wb7", "Not authenticated")
  def isGuest: Boolean = user.exists(_.isGuest)
  def isStaff: Boolean = user.exists(_.isStaff)


  def ip: IpAddress = security.realOrFakeIpOf(request)

  /**
   * Approximately when the server started serving this request.
   */
  lazy val ctime: ju.Date = globals.now().toJavaDate

  /** The scheme, host and port specified in the request. */
  def origin: String = s"$scheme://$host"

  def isDevTestToLocalhost: Bo = Globals.isDevOrTest && (
    host == "localhost" || host.startsWith("localhost:") ||
      host.contains(".localhost:") || host.endsWith(".localhost"))

  def cdnOrSiteOrigin: String =
    globals.anyCdnOrigin.getOrElse(globals.schemeColonSlashSlash + host)

  def scheme: String = if (globals.secure) "https" else "http"

  def host: String = request.host
  def hostname: String = request.host.span(_ != ':')._1

  def colonPort: String = request.host.dropWhile(_ != ':')

  def method: String = request.method
  def uri: String = request.uri

  def queryString: Map[String, Seq[String]] = request.queryString

  def rawQueryString: String = request.rawQueryString

  def headers: Headers = request.headers

  def cookies: Cookies = request.cookies

  /** This might classify a bit too many devices as mobile. That's pretty harmless — the mobile
    * layout looks okay also on tablets I think. However, accidentally using the wide screen layout,
    * on tiny phones — that looks bad and text columns might become really narrow, hard to read.
    * The iPad is simple & safe to identify though so let's take it into account.
    *
    * Do not use any crazy regexs like https://stackoverflow.com/a/11381730/694469
    * — that wouldn't be future compatible? New devices might be default broken, would need
    * to constantly update the regex?
    */
  def isMobile: Bo = {
    val qs = request.rawQueryString
    if (qs.contains("&laptop&")) return false
    if (qs.contains("&mobile&")) return true
    val ua = request.headers.get("User-Agent") getOrElse {
      // Only hackers at their laptops do weird things like removing this header?
      return false
    }
    ua.contains("Mobile") && !ua.contains("iPad")
  }

  def isAjax: Boolean = EdHttp.isAjax(request)

  def isHttpPostRequest: Boolean = request.method == "POST"

  def httpVersion: String = request.version

  def shallSkipRateLimitsBecauseIsTest: Boolean =
    dao.shallSkipRateLimitsBecauseIsTest

  def parseThePageQuery(): PageQuery =
    parsePageQuery() getOrElse throwBadRequest(
      "DwE2KTES7", "No sort-order-offset specified")


  /** If listing topics, the page query tells which topics to find.  [pg_sort_ord]
    * (E.g. for the forum topic list.)
    */
  def parsePageQuery(): Option[PageQuery] = {
    val orderOffset = ListPagesQueryParser.parseOrderOffset(queryString) getOrElse {
      return None
    }
    val pageFilter = parsePageFilter()

    Some(PageQuery(orderOffset, pageFilter,
      // Later: Let user preferences override, if is staff. [8WK4SD7]
      includeAboutCategoryPages = siteSettings.showCategories))
  }


  def parsePageFilter(): PageFilter = {
    val filterParamSt = queryString.getFirst("filter")
    ListPagesQueryParser.parsePageFilter(filterParamSt, includeDeleted = isStaff)
  }

}



object ListPagesQueryParser {

  def parseOrderOffset(params: FormInpReader): Opt[PageOrderOffset] = {
    val sortOrderStr = params.getFirst("sortOrder") getOrElse { return None }
    def anyDateOffset: Opt[ju.Date] = params.getLong("olderThan") map (new ju.Date(_))
    val orderOffset: PageOrderOffset = sortOrderStr match {
      case "ByBumpTime" =>
        PageOrderOffset.ByBumpTime(anyDateOffset)
      case "ByCreatedAt" =>
        PageOrderOffset.ByCreatedAt(anyDateOffset)
      case "ByScore" =>
        val scoreStr = params.getFirst("maxScore")
        val periodStr = params.getFirst("period")
        val period = periodStr.flatMap(TopTopicsPeriod.fromIntString) getOrElse TopTopicsPeriod.Month
        val score = scoreStr.map(_.toFloatOrThrow("EdE28FKSD3", "Score is not a number"))
        PageOrderOffset.ByScoreAndBumpTime(offset = score, period)
      case "ByLikes" =>
        def anyNumOffset = params.getInt("num") // CLEAN_UP rename 'num' to 'maxLikes'
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
    Some(orderOffset)
  }


  def parsePageFilter(filterParamSt: Opt[St], includeDeleted: Bo): PageFilter =
    filterParamSt match {
      case None | Some("ShowAll") =>
        PageFilter(PageFilterType.AllTopics, includeDeleted = false)
      case Some("ShowWaiting") =>
        PageFilter(PageFilterType.WaitingTopics, includeDeleted = false)
      case Some("ShowDeleted") =>
        // Non staff members may not list deleted topics. Could throw an error if !isStaff,
        // but that'd break the end-to-end-tests [4UKDWT20]. The list-deleted-topics option is
        // hidden for non-staff people anyway, in the UI. [2UFKBJ73]
        // Or maybe set incl-deleted = true anyway, and let people list their own deleted topics?
        PageFilter(PageFilterType.AllTopics, includeDeleted = includeDeleted)
      case Some(x) =>
        throwBadRequest("DwE5KGP8", s"Bad topic filter: $x")
    }


}

