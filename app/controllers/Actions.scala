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
    sid: SidOk,
    xsrfToken: XsrfOk,
    identity: Option[Identity],
    user: Option[User],
    pageExists: Boolean,
    /** Ids of groups to which the requester belongs. */
    // userMemships: List[String],
    /** If the requested page does not exist, pagePath.pageId is empty. */
    pagePath: PagePath,
    permsOnPage: PermsOnPage,
    dao: TenantDao,
    request: Request[A]
  ){
    require(pagePath.tenantId == tenantId) //COULD remove tenantId from pagePath
    require(!pageExists || pagePath.pageId.isDefined)
    require(dao.quotaConsumers.tenantId == tenantId)
    require(dao.quotaConsumers.ip == Some(ip))
    require(dao.quotaConsumers.roleId ==
       user.filter(_.isAuthenticated).map(_.id))

    def tenantId = dao.tenantId

    def loginId: Option[String] = sid.loginId

    /**
     * The login id of the user making the request. Throws 403 Forbidden
     * if not logged in (shouldn't happen normally).
     */
    def loginId_! : String =
      loginId getOrElse throwForbidden("DwE03kRG4", "Not logged in")

    def user_! : User =
      user getOrElse throwForbidden("DwE86Wb7", "Not logged in")

    def identity_! : Identity =
      identity getOrElse throwForbidden("DwE7PGJ2", "Not logged in")

    /**
     * The display name of the user making the request. Throws 403 Forbidden
     * if not available, i.e. if not logged in (shouldn't happen normally).
     */
    def displayName_! : String =
      sid.displayName getOrElse throwForbidden("DwE97Ik3", "Not logged in")

    def ip = request.remoteAddress

    /**
     * The end user's IP address, *iff* it differs from the login address.
     */
    def newIp: Option[String] = None  // None always, for now

    def pageId: Option[String] = pagePath.pageId

    /**
     * Throws 404 Not Found if id unknown. The page id is known if it
     * was specified in the request, *or* if the page exists.
     */
    def pageId_! : String = pagePath.pageId getOrElse
      throwNotFound("DwE93kD4", "Page does not exist: "+ pagePath.path)

    /**
     * The page this PageRequest concerns, or None if not found
     * (e.g. if !pageExists, or if it was deleted just moments ago).
     */
    lazy val page_? : Option[Debate] =
      if (pageExists)
        pageId.flatMap(id => dao.loadPage(id))
      // Don't load the page even if it was *created* moments ago.
      // having !pageExists and page_? = Some(..) feels risky.
      else None

    /**
     * The page this PageRequest concerns. Throws 404 Not Found if not found.
     *
     * (The page might have been deleted, just after the access control step.)
     */
    lazy val page_! : Debate =
      page_? getOrElse throwNotFound("DwE43XWY", "Page not found")

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

    def queryString = request.queryString

    def body = request.body

    def quotaConsumers = dao.quotaConsumers

  }


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

    // Load identity and user.
    val (identity, user) = sidOk.loginId match {
      case None => (None, None)
      case Some(lid) =>
        dao.loadIdtyAndUser(forLoginId = lid)
          match {
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
    CheckSidAction[A](parser) { (sidOk, xsrfOk, request) =>
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


  /**
   * Throws 403 Forbidden if the xsrf token (for POST requests)
   * or the session id is invalid.
   */
  def CheckSidActionNoBody
        (f: (SidOk, XsrfOk, Request[Option[Any]]) => PlainResult) =
    CheckSidAction(BodyParsers.parse.empty)(f)


  def CheckSidAction[A]
        (parser: BodyParser[A])
        (f: (SidOk, XsrfOk, Request[A]) => PlainResult) =
    ExceptionAction[A](parser) { request =>
      val (sidOk, xsrfOk, newCookies) = AppAuth.checkSidAndXsrfToken(request)
      val resultOldCookies = f(sidOk, xsrfOk, request)
      val resultOkSid =
        if (newCookies isEmpty) resultOldCookies
        else resultOldCookies.withCookies(newCookies: _*)
      resultOkSid
    }


  /**
   * Converts DebikiHttp.ResultException to nice replies,
   * e.g. 403 Forbidden and a user friendly message,
   * instead of 500 Internal Server Error and a stack trace or Ooops message.
   */
  def ExceptionAction[A](parser: BodyParser[A])(f: Request[A] => Result) =
        mvc.Action[A](parser) { request =>
    try {
      f(request)
    } catch {
      case DebikiHttp.ResultException(result) => result
    }
  }


  def ExceptionActionNoBody(f: Request[Option[Any]] => PlainResult) =
    ExceptionAction(BodyParsers.parse.empty)(f)

}

