/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package controllers

import com.debiki.v0._
import debiki._
import debiki.DebikiHttp._
import java.{util => ju}
import play.api._
import play.api.mvc.{Action => _, _}
import Prelude._


/**
 * Actions for requests that concern a single page.
 *
 * These actions attempt to redirect any incorrect, but almost correct,
 * request to the correct page path. And load per page permissions, and
 * construct and hand over a PageRequest to the action implementation.
 */
object PageActions {

  // ((Old non-obsolete comment from PageRequest.scala:
  // COULD rename RequestInfo to PermsOnPageRequest,
  // and use PageRequest instead. ))

  /**
   * A PageRequest with no post data.
   */
  type PageGetRequest = PageRequest[Option[Any]]


  /**
   * A PageRequest with post data.
   */
  type PagePostRequest = PageRequest[Map[String, Seq[String]]]

  type PagePostRequest2 = PageRequest[JsonOrFormDataBody]


  def PageGetAction
        (pathIn: PagePath, pageMustExist: Boolean = true)
        (f: PageGetRequest => PlainResult) =
    PageReqAction(BodyParsers.parse.empty)(pathIn, pageMustExist)(f)


  /**
   * Supports form data only.
   * @deprecated
   */
  def PagePostAction
        (maxUrlEncFormBytes: Int)
        (pathIn: PagePath, pageMustExist: Boolean = true)
        (f: PagePostRequest => PlainResult) =
    PageReqAction(
      BodyParsers.parse.urlFormEncoded(maxLength = maxUrlEncFormBytes))(
      pathIn, pageMustExist)(f)


  /**
   * Works with both form data, and JSON (if the JSON is a map,
   * optionally with array values).
   * COULD replace all PagePostAction with PagePostAction2 and then rename
   * PagePostAction2 to PagePostAction.
   */
  def PagePostAction2
        (maxBytes: Int)
        (pathIn: PagePath, pageMustExist: Boolean = true)
        (f: PagePostRequest2 => PlainResult) =
    PageReqAction(
      JsonOrFormDataBody.parser(maxBytes = maxBytes))(
      pathIn, pageMustExist)(f)


  def PageReqAction[A]
        (parser: BodyParser[A])
        (pathIn: PagePath, pageMustExist: Boolean)
        (f: PageRequest[A] => PlainResult)
        = CheckPathAction[A](parser)(pathIn) {
      (sidStatus, xsrfOk, pathOkOpt, dao, request) =>

    if (pathOkOpt.isEmpty && pageMustExist)
      throwNotFound("DwE0404", "Page not found")

    val tenantId = pathIn.tenantId
    val pagePath = pathOkOpt.getOrElse(pathIn)
    val (identity, user) = Utils.loadIdentityAndUserOrThrow(sidStatus, dao)

    // Load permissions.
    val permsReq = RequestInfo(  // COULD RENAME! to PermsOnPageRequest
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
      request = request)

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
        (f: (SidStatus, XsrfOk, Option[PagePath], TenantDao,
           Request[Option[Any]]) => PlainResult) =
    CheckPathAction(BodyParsers.parse.empty)(pathIn)(f)


  def CheckPathAction[A]
        (parser: BodyParser[A])
        (pathIn: PagePath)
        (f: (SidStatus, XsrfOk, Option[PagePath], TenantDao, Request[A]) =>
           PlainResult) =
    SafeActions.CheckSidAction[A](parser) { (sidStatus, xsrfOk, request) =>
      val dao = Debiki.tenantDao(tenantId = pathIn.tenantId,
         ip = request.remoteAddress, sidStatus.roleId)
      dao.checkPagePath(pathIn) match {
        case Some(correct: PagePath) =>
          if (correct.path == pathIn.path) {
            f(sidStatus, xsrfOk, Some(correct), dao, request)
          } else {
            Results.MovedPermanently(correct.path)
          }
        case None => f(sidStatus, xsrfOk, None, dao, request)
      }
    }

}

