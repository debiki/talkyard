/**
 * Copyright (C) 2012 Kaj Magnus Lindberg (born 1979)
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

package actions

import actions.SafeActions._
import com.debiki.core._
import com.debiki.core.Prelude._
import debiki._
import debiki.DebikiHttp._
import debiki.dao.SiteDao
import debiki.RateLimits.NoRateLimits
import java.{util => ju}
import play.api._
import play.api.mvc.{Action => _, _}
import requests._
import controllers.Utils


/**
 * Actions for requests that concern a single page.
 *
 * These actions attempt to redirect any incorrect, but almost correct,
 * request to the correct page path. And load per page permissions, and
 * construct and hand over a PageRequest to the action implementation.
 */
object PageActions {


  /**
   * Set `maySetCookies` to false if the response might be cached by
   * proxy servers, e.g. static JS and CSS. (Otherwise silly serveres
   * might serve the same cached XSRF cookie to everyone.)
   */
  @deprecated("Stop using /path/to/page?action paths", "now")
  def PageGetAction
        (pathIn: PagePath, pageMustExist: Boolean = true, fixPath: Boolean = true,
         maySetCookies: Boolean = true)
        (f: PageGetRequest => Result) =
    PageReqAction(NoRateLimits, BodyParsers.parse.empty)(
      pathIn, pageMustExist, fixPath = fixPath, maySetCookies = maySetCookies)(f)


  /**
   * Supports form data only.
   * @deprecated
   */
  @deprecated("Stop using /path/to/page?action paths", "now")
  def PagePostAction
        (rateLimitsType: RateLimits, maxUrlEncFormBytes: Int)
        (pathIn: PagePath, pageMustExist: Boolean = true, fixPath: Boolean = true)
        (f: PagePostRequest => Result) =
    PageReqAction(
      rateLimitsType, BodyParsers.parse.urlFormEncoded(maxLength = maxUrlEncFormBytes))(
      pathIn, pageMustExist, fixPath = fixPath)(f)


  def PageReqAction[A]
        (rateLimitsType: RateLimits, parser: BodyParser[A])
        (pathIn: PagePath, pageMustExist: Boolean, fixPath: Boolean,
         maySetCookies: Boolean = true)
        (f: PageRequest[A] => Result)
        = CheckPathAction[A](parser)(
            pathIn, maySetCookies = maySetCookies, fixPath = fixPath) {
      (sidStatus, xsrfOk, browserId, pathOkOpt, dao, request) =>

    if (pathOkOpt.isEmpty && pageMustExist)
      throwNotFound("DwE0404", "Page not found")

    val tenantId = pathIn.tenantId
    val pagePath = pathOkOpt.getOrElse(pathIn)
    val user = Utils.loadUserOrThrow(sidStatus, dao)
    val pageExists = pathOkOpt.isDefined

    val anyPageMeta = pagePath.pageId.flatMap(dao.loadPageMeta(_))
    if (pageExists && anyPageMeta.isEmpty)
      throwNotFound("DwE2WEb8", s"No page meta found, page id: ${pagePath.pageId.get}")

    // Load permissions.
    val permsReq = PermsOnPageQuery(
      tenantId = tenantId,
      ip = realOrFakeIpOf(request),
      user = user,
      pagePath = pagePath,
      pageMeta = anyPageMeta)

    val permsOnPage = dao.loadPermsOnPage(permsReq)
    if (!permsOnPage.accessPage)
      throwForbidden("DwE403DNI0", "You are not allowed to access that page.")

    // Construct the actual request.
    val pageReq = new PageRequest[A](
      sid = sidStatus,
      xsrfToken = xsrfOk,
      browserId = browserId,
      user = user,
      pageExists = pageExists,
      pagePath = pagePath,
      pageMeta = anyPageMeta,
      permsOnPage = permsOnPage,
      dao = dao,
      request = request)

    RateLimiter.rateLimit(rateLimitsType, pageReq)

    val result = f(pageReq)
    result
  }


  /**
   * Attempts to redirect almost correct requests to the correct path,
   * e.g. adds/removes an absent or superfluous trailing slash
   * or looks up a page id and finds out that the page
   * has been moved.
   */
  @deprecated("Stop using /path/to/page?action paths", "now")
  def CheckPathActionNoBody
        (pathIn: PagePath)
        (f: (SidStatus, XsrfOk, Option[BrowserId], Option[PagePath], SiteDao,
           Request[Unit]) => Result) =
    CheckPathAction(BodyParsers.parse.empty)(pathIn)(f)


  @deprecated("Stop using /path/to/page?action paths", "now")
  def CheckPathAction[A]
        (parser: BodyParser[A])
        (pathIn: PagePath, maySetCookies: Boolean = true, fixPath: Boolean = true)
        (f: (SidStatus, XsrfOk, Option[BrowserId], Option[PagePath], SiteDao, Request[A]) =>
           Result) =
    SessionActionMaybeCookies(maySetCookies)(parser) { request: SessionRequest[A] =>
      val dao = Globals.siteDao(siteId = pathIn.tenantId,
         ip = realOrFakeIpOf(request.underlying), request.sidStatus.roleId)
      dao.checkPagePath(pathIn) match {
        case Some(correct: PagePath) =>
          if (correct.value == pathIn.value) {
            f(request.sidStatus, request.xsrfOk, request.browserId, Some(correct), dao,
              request.underlying)
          } else if (!fixPath) {
            f(request.sidStatus, request.xsrfOk, request.browserId, None, dao, request.underlying)
          } else {
            Results.MovedPermanently(correct.value)
          }
        case None => f(request.sidStatus, request.xsrfOk, request.browserId, None, dao, request.underlying)
      }
    }

}

