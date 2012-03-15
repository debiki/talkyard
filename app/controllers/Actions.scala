/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package controllers

import com.debiki.v0._
import debiki._
import debiki.DebikiHttp._
import java.{util => ju}
import net.liftweb.common.{Box, Full, Empty, Failure}
import play.api._
import play.api.mvc.{Action => _, _}
import Prelude._

object Actions {

  /**
   * A page related request.
   *
   * Sometimes only the browser ip is known (then there'd be no
   * Login/Identity/User).
   */
  // COULD rename RequestInfo to PermsOnPageRequest,
  // and use PageRequest instead.
  case class PageRequest[A](
    tenantId: String,
    ip: String,
    sid: SidOk,
    xsrfToken: XsrfOk,
    loginId: Option[String],
    identity: Option[Identity],
    user: Option[User],
    /** Ids of groups to which the requester belongs. */
    // userMemships: List[String],
    pagePath: PagePath,
    permsOnPage: PermsOnPage,
    request: Request[A]
  ){
    require(pagePath.tenantId == tenantId) //COULD remove tenantId from pagePath

    /**
     * The login id of the user making the request. Throws 403 Forbidden
     * if not logged in (shouldn't happen normally).
     */
    def loginId_! : String =
      loginId getOrElse throwForbidden("DwE03kRG4", "Not logged in")

    def user_! : User =
      user getOrElse throwForbidden("DwE86Wb7", "Not logged in")

    /**
     * The display name of the user making the request. Throws 403 Forbidden
     * if not available, i.e. if not logged in (shouldn't happen normally).
     */
    def displayName_! : String =
      sid.displayName getOrElse throwForbidden("DwE97Ik3", "Not logged in")

    /**
     * The end user's IP address, *iff* it differs from the login address.
     */
    def newIp: Option[String] = None  // None always, for now

    def pageId: String = pagePath.pageId getOrElse
      assErr("DwE93kD4", "Page id unknown")

    /**
     * The page this PageRequest concerns, or None if not found.
     */
    lazy val page_? : Option[Debate] =
      Debiki.Dao.loadPage(tenantId, pageId).toOption

    /**
     * The page this PageRequest concerns. Throws 404 Not Found if not found.
     *
     * (The page might have been deleted, just after the access control step.)
     */
    lazy val page_! : Debate =
      Debiki.Dao.loadPage(tenantId, pageId) openOr throwNotFound(
        "DwE43XWY", "Page not found")

    /**
     * Approximately when the server started serving this request.
     */
    lazy val ctime: ju.Date = new ju.Date

    /**
     * The scheme, host and port specified in the request.
     *
     * For now, the scheme is hardcoded to http.
     */
    def origin: String = "http://"+ request.host
  }


  /**
   * A PageRequest with no post data.
   */
  type PageGetRequest = PageRequest[Option[Any]]


  /**
   * A PageRequest with post data.
   */
  type PagePostRequest = PageRequest[Map[String, Seq[String]]]


  def PageGetAction(pathIn: PagePath)(
        f: PageGetRequest => PlainResult)
        : mvc.Action[Option[Any]] =
      PageReqAction(BodyParsers.parse.empty)(pathIn)(f)


  def PagePostAction(maxUrlEncFormBytes: Int)(pathIn: PagePath)(
        f: PagePostRequest => PlainResult)
        : mvc.Action[Map[String, Seq[String]]] =
    PageReqAction(
      BodyParsers.parse.urlFormEncoded(maxLength = maxUrlEncFormBytes))(
      pathIn)(f)


  def PageReqAction[A](parser: BodyParser[A])(pathIn: PagePath)(
        f: PageRequest[A] => PlainResult)
        = CheckSidAndPathAction[A](parser)(pathIn) {
      (sidOk, xsrfOk, pathOk, request) =>

    val tenantId = pathOk.tenantId
    val ip = "?.?.?.?"

    // Load identity and user.
    val (identity, user) = sidOk.loginId match {
      case None => (None, None)
      case Some(lid) =>
        Debiki.Dao.loadUser(withLoginId = lid, tenantId = tenantId) match {
          case Some((identity, user)) => (Some(identity), Some(user))
          case None =>
            // Currently, RelDbDao throws an exception rather than
            // returning None.
            warnDbgDie("RelDbDao did not load user [error DwE01521ku35]")
            (None, None)
        }
    }

    // Load permissions.
    val permsReq = RequestInfo(  // COULD RENAME! to PermsOnPageRequest
      tenantId = tenantId,
      ip = ip,
      loginId = sidOk.loginId,
      identity = identity,
      user = user,
      pagePath = pathOk,
      doo = null) // should be removed

    val permsOnPage = Debiki.Dao.loadPermsOnPage(permsReq)
    if (!permsOnPage.accessPage)
      throwForbidden("DwE403DNI0", "You are not allowed to access that page.")

    // Construct the actual request.
    val pageReq = PageRequest[A](
      tenantId = tenantId,
      ip = ip,
      sid = sidOk,
      xsrfToken = xsrfOk,
      loginId = sidOk.loginId,
      identity = identity,
      user = user,
      pagePath = pathOk,
      permsOnPage = permsOnPage,
      request = request)

    val result = f(pageReq)
    result
  }


  /**
   * Checks the session id and, for POST request, the xsrf token.
   */
  def CheckSidAndPathAction[A](parser: BodyParser[A])(pathIn: PagePath)(
        f: (SidOk, XsrfOk, PagePath, Request[A]) => PlainResult) =
        RedirBadPathAction[A](parser)(pathIn) { (pathOk, request) =>
    val (sidOk, xsrfOk, newCookies) = AppAuth.checkSidAndXsrfToken(request)
    val resultOldCookies = f(sidOk, xsrfOk, pathOk, request)
    val resultOkSid =
      if (newCookies isEmpty) resultOldCookies
      else resultOldCookies.withCookies(newCookies: _*)
    resultOkSid
  }

  def CheckSidAndPathAction(pathIn: PagePath)(
        f: (SidOk, XsrfOk, PagePath, Request[Option[Any]]) => PlainResult)
        : mvc.Action[Option[Any]] =
    CheckSidAndPathAction(BodyParsers.parse.empty)(pathIn)(f)

  /**
   * Redirects requests to the correct path,
   * e.g. adds/removes an absent or superflous trailing slash
   * or looks up a page id and finds out that the page has been moved.
   */
  def RedirBadPathAction[A](parser: BodyParser[A])(pathIn: PagePath)(
        f: (PagePath, Request[A]) => PlainResult)
        : mvc.Action[A] = ExceptionAction[A](parser) { request =>
    Debiki.Dao.checkPagePath(pathIn) match {
      case Full(correct: PagePath) =>
        if (correct.path == pathIn.path) f(correct, request)
        else Results.MovedPermanently(correct.path)
      case Empty => NotFoundResult("DwE03681", "")
      case f: Failure => runErr("DwE03ki2", "Internal error"+ f.toString)
    }
  }

  def RedirBadPathAction(pathIn: PagePath)(
       f: (PagePath, Request[Option[Any]]) => PlainResult)
       : mvc.Action[Option[Any]] =
    RedirBadPathAction(BodyParsers.parse.empty)(pathIn)(f)


  /**
   * Converts DebikiHttp.ResultException to nice replies.
   */
  def ExceptionAction[A](parser: BodyParser[A])(f: Request[A] => PlainResult) =
        mvc.Action[A](parser) { request =>
    try {
      f(request)
    } catch {
      case DebikiHttp.ResultException(result) => result
    }
  }

}
