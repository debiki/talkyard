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

import com.debiki.core._
import com.debiki.core.Prelude._
import debiki._
import debiki.DebikiHttp._
import debiki.dao.SiteDao
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
   * A PageRequest with no post data.
   */
  type PageGetRequest = PageRequest[Option[Any]]


  /**
   * A PageRequest with post data.
   */
  type PagePostRequest = PageRequest[Map[String, Seq[String]]]

  type PagePostRequest2 = PageRequest[JsonOrFormDataBody]


  /**
   * Set `maySetCookies` to false if the response might be cached by
   * proxy servers, e.g. static JS and CSS. (Otherwise silly serveres
   * might serve the same cached XSRF cookie to everyone.)
   */
  def PageGetAction
        (pathIn: PagePath, pageMustExist: Boolean = true, fixPath: Boolean = true,
         maySetCookies: Boolean = true)
        (f: PageGetRequest => PlainResult) =
    PageReqAction(BodyParsers.parse.empty)(
      pathIn, pageMustExist, fixPath = fixPath, maySetCookies = maySetCookies)(f)


  def FolderGetAction
        (pathIn: PagePath)
        (f: PageGetRequest => PlainResult) =
    FolderReqAction(BodyParsers.parse.empty)(pathIn)(f)


  /**
   * Supports form data only.
   * @deprecated
   */
  def PagePostAction
        (maxUrlEncFormBytes: Int)
        (pathIn: PagePath, pageMustExist: Boolean = true, fixPath: Boolean = true)
        (f: PagePostRequest => PlainResult) =
    PageReqAction(
      BodyParsers.parse.urlFormEncoded(maxLength = maxUrlEncFormBytes))(
      pathIn, pageMustExist, fixPath = fixPath)(f)


  /**
   * Works with both form data, and JSON (if the JSON is a map,
   * optionally with array values).
   * COULD replace all PagePostAction with PagePostAction2 and then rename
   * PagePostAction2 to PagePostAction.
   */
  def PagePostAction2
        (maxBytes: Int)
        (pathIn: PagePath, pageMustExist: Boolean = true, fixPath: Boolean = true)
        (f: PagePostRequest2 => PlainResult) =
    PageReqAction(
      JsonOrFormDataBody.parser(maxBytes = maxBytes))(
      pathIn, pageMustExist, fixPath = fixPath)(f)


  def PageReqAction[A]
        (parser: BodyParser[A])
        (pathIn: PagePath, pageMustExist: Boolean, fixPath: Boolean,
         maySetCookies: Boolean = true)
        (f: PageRequest[A] => PlainResult)
        = CheckPathAction[A](parser)(
            pathIn, maySetCookies = maySetCookies, fixPath = fixPath) {
      (sidStatus, xsrfOk, pathOkOpt, dao, request) =>

    if (pathOkOpt.isEmpty && pageMustExist)
      throwNotFound("DwE0404", "Page not found")

    val tenantId = pathIn.tenantId
    val pagePath = pathOkOpt.getOrElse(pathIn)
    val (identity, user) = Utils.loadIdentityAndUserOrThrow(sidStatus, dao)

    // Load permissions.
    val permsReq = PermsOnPageQuery(
      tenantId = tenantId,
      ip = request.remoteAddress,
      loginId = sidStatus.loginId,
      identity = identity,
      user = user,
      pagePath = pagePath)

    val permsOnPage = dao.loadPermsOnPage(permsReq)
    if (!permsOnPage.accessPage)
      throwForbidden("DwE403DNI0", "You are not allowed to access that page.")

    // Construct the actual request.
    val pageReq = PageRequest[A](
      sid = sidStatus,
      xsrfToken = xsrfOk,
      identity = identity,
      user = user,
      pageExists = pathOkOpt.isDefined,
      pagePath = pagePath,
      permsOnPage = permsOnPage,
      dao = dao,
      request = request)()

    val result = f(pageReq)
    result
  }


  // For now. (COULD create a FolderRequest, later.)
  def FolderReqAction[A]
        (parser: BodyParser[A])
        (pathIn: PagePath)
        (f: PageRequest[A] => PlainResult)
    = SafeActions.CheckSidAction[A](parser, maySetCookies = true) {
        (sidStatus, xsrfOk, request) =>

    if (!pathIn.isFolderOrIndexPage)
      throwBadReq("DwE903XH3", s"Call on folders only, not pages: ${request.uri}")

    val dao = Globals.siteDao(siteId = pathIn.tenantId,
      ip = request.remoteAddress, sidStatus.roleId)

    val (identity, user) = Utils.loadIdentityAndUserOrThrow(sidStatus, dao)

    // Load permissions.
    val permsReq = PermsOnPageQuery(
      tenantId = pathIn.tenantId,
      ip = request.remoteAddress,
      loginId = sidStatus.loginId,
      identity = identity,
      user = user,
      pagePath = pathIn)

    val permsOnPage = dao.loadPermsOnPage(permsReq)
    if (!permsOnPage.accessPage)
      throwForbidden("DwE67BY2", "You are not allowed to access that page.")

    // Construct the actual request. COULD create and use a FolderRequest instead.
    val pageReq = PageRequest[A](
      sid = sidStatus,
      xsrfToken = xsrfOk,
      identity = identity,
      user = user,
      pageExists = false,
      pagePath = pathIn,
      permsOnPage = permsOnPage,
      dao = dao,
      request = request)()

    val result = f(pageReq)
    result
  }


  /**
   * Attempts to redirect almost correct requests to the correct path,
   * e.g. adds/removes an absent or superfluous trailing slash
   * or looks up a page id and finds out that the page
   * has been moved.
   */
  def CheckPathActionNoBody
        (pathIn: PagePath)
        (f: (SidStatus, XsrfOk, Option[PagePath], SiteDao,
           Request[Option[Any]]) => PlainResult) =
    CheckPathAction(BodyParsers.parse.empty)(pathIn)(f)


  def CheckPathAction[A]
        (parser: BodyParser[A])
        (pathIn: PagePath, maySetCookies: Boolean = true, fixPath: Boolean = true)
        (f: (SidStatus, XsrfOk, Option[PagePath], SiteDao, Request[A]) =>
           PlainResult) =
    SafeActions.CheckSidAction[A](parser, maySetCookies = maySetCookies) {
        (sidStatus, xsrfOk, request) =>
      val dao = Globals.siteDao(siteId = pathIn.tenantId,
         ip = request.remoteAddress, sidStatus.roleId)
      dao.checkPagePath(pathIn) match {
        case Some(correct: PagePath) =>
          if (correct.path == pathIn.path) {
            f(sidStatus, xsrfOk, Some(correct), dao, request)
          } else if (!fixPath) {
            f(sidStatus, xsrfOk, None, dao, request)
          } else {
            Results.MovedPermanently(correct.path)
          }
        case None => f(sidStatus, xsrfOk, None, dao, request)
      }
    }

}

