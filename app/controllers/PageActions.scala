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


  def PageGetAction
        (pathIn: PagePath, pageMustExist: Boolean = true)
        (f: PageGetRequest => PlainResult) =
    PageReqAction(BodyParsers.parse.empty)(pathIn, pageMustExist)(f)


  def PagePostAction
        (maxUrlEncFormBytes: Int)
        (pathIn: PagePath, pageMustExist: Boolean = true)
        (f: PagePostRequest => PlainResult) =
    PageReqAction(
      BodyParsers.parse.urlFormEncoded(maxLength = maxUrlEncFormBytes))(
      pathIn, pageMustExist)(f)


  def PageReqAction[A]
        (parser: BodyParser[A])
        (pathIn: PagePath, pageMustExist: Boolean)
        (f: PageRequest[A] => PlainResult)
        = CheckPathAction[A](parser)(pathIn) {
      (sidOk, xsrfOk, pathOkOpt, dao, request) =>

    if (pathOkOpt.isEmpty && pageMustExist)
      throwNotFound("DwE0404", "Page not found")

    val tenantId = pathIn.tenantId
    val pagePath = pathOkOpt.getOrElse(pathIn)
    val (identity, user) = Utils.loadIdentityAndUserOrThrow(sidOk, dao)

    // Load permissions.
    val permsReq = RequestInfo(  // COULD RENAME! to PermsOnPageRequest
      tenantId = tenantId,
      ip = request.remoteAddress,
      loginId = sidOk.loginId,
      identity = identity,
      user = user,
      pagePath = pagePath)

    val permsOnPage = dao.loadPermsOnPage(permsReq)
    if (!permsOnPage.accessPage)
      throwForbidden("DwE403DNI0", "You are not allowed to access that page.")

    // Construct the actual request.
    val pageReq = PageRequest[A](
      sid = sidOk,
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
        (f: (SidOk, XsrfOk, Option[PagePath], TenantDao, Request[Option[Any]]
           ) => PlainResult) =
    CheckPathAction(BodyParsers.parse.empty)(pathIn)(f)


  def CheckPathAction[A]
        (parser: BodyParser[A])
        (pathIn: PagePath)
        (f: (SidOk, XsrfOk, Option[PagePath], TenantDao, Request[A]) =>
           PlainResult) =
    SafeActions.CheckSidAction[A](parser) { (sidOk, xsrfOk, request) =>
      val dao = Debiki.tenantDao(tenantId = pathIn.tenantId,
         ip = request.remoteAddress, sidOk.roleId)
      dao.checkPagePath(pathIn) match {
        case Some(correct: PagePath) =>
          if (correct.path == pathIn.path) {
            f(sidOk, xsrfOk, Some(correct), dao, request)
          } else {
            Results.MovedPermanently(correct.path)
          }
        case None => f(sidOk, xsrfOk, None, dao, request)
      }
    }

}

