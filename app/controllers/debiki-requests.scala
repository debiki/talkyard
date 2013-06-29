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

package controllers

import com.debiki.v0._
import debiki._
import debiki.DebikiHttp._
import debiki.dao.TenantDao
import java.{util => ju}
import play.api._
import play.api.mvc.{Action => _, _}
import Prelude._
import Utils.ValidationImplicits._
import Utils.parseIntOrThrowBadReq
import DbDao.PathClashException


/**
 */
abstract class DebikiRequest[A] {

  def sid: SidStatus
  def xsrfToken: XsrfOk
  def identity: Option[Identity]
  def user: Option[User]
  def dao: TenantDao
  def request: Request[A]

  illArgIf(dao.quotaConsumers.tenantId != tenantId,
    "DwE6IW1B3", s"Quota consumer tenant id differs from request tenant id; $debugDiff")

  illArgIf(dao.quotaConsumers.ip != Some(ip),
    "DwE94BK21", s"Quota consumer IP differs from request IP; $debugDiff")

  illArgIf(dao.quotaConsumers.roleId != user.filter(_.isAuthenticated).map(_.id),
    "DwE03BK44", s"Quota consumer role id differs from request role id; $debugDiff")

  private def debugDiff =
    s"quota consumers: ${dao.quotaConsumers}, tenant/ip/role: $tenantId/$ip/$user"

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

  def anyMeAsPeople: People =
    if (loginId isEmpty) People()
    else People() + _fakeLogin + identity_! + user_!

  def meAsPeople_! : People = People() + _fakeLogin + identity_! + user_!

  protected def _fakeLogin = Login(
    id = loginId_!, prevLoginId = None, ip = request.remoteAddress,
    date = ctime, identityId = identity_!.id)

  /**
   * The display name of the user making the request. Throws 403 Forbidden
   * if not available, i.e. if not logged in (shouldn't happen normally).
   */
  def displayName_! : String =
    sid.displayName getOrElse throwForbidden("DwE97Ik3", "Not logged in")

  def session: mvc.Session = request.session

  def ip = request.remoteAddress

  /**
   * The end user's IP address, *iff* it differs from the login address.
   */
  def newIp: Option[String] = None  // None always, for now

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

  def host = request.host

  def uri = request.uri

  def queryString = request.queryString

  def rawQueryString = request.rawQueryString

  def body = request.body

  def headers = request.headers

  def isAjax = DebikiHttp.isAjax(request)

  def isHttpPostRequest = request.method == "POST"

  def httpVersion = request.version

  def quotaConsumers = dao.quotaConsumers

}


/**
 * A request that's not related to any particular page.
 */
case class ApiRequest[A](
  sid: SidStatus,
  xsrfToken: XsrfOk,
  identity: Option[Identity],
  user: Option[User],
  dao: TenantDao,
  request: Request[A]) extends DebikiRequest[A] {
}



object PageRequest {

  /**
   * Builds a PageRequest based on another DebikiRequest and a page path.
   *
   * If `fixIncorrectPath`, changes `pagePath` to the real path to the page,
   * if needed (and if the page exists). Otherwise, if  `pagePath` is
   * incorrect, throws an error 404 Not Found exception.
   * (PageActions.CheckPathAction however redirects the browser to the correct
   * path, if you specify an almost correct path (e.g. superfluous
   * trailing '/').
   */
  def apply[A](
    apiRequest: DebikiRequest[A],
    pagePath: PagePath,
    pageMightExist: Boolean = true,
    pageMustExist: Boolean = false,
    fixBadPath: Boolean = false): PageRequest[A] = {

    // Require page id (so we know for sure which page to e.g. edit).
    assErrIf(pagePath.pageId.isEmpty,
      "DwE8ISD2", s"Page id missing, pagePath: $pagePath")

    val (pageExists, okPath) = apiRequest.dao.checkPagePath(pagePath) match {
      case Some(correctPath: PagePath) =>
        // Check if another page already exist at `pagePath`? (It'd have the
        // same path, but another id.)
         if (correctPath.pageId.get != pagePath.pageId.get)
           throw PathClashException(
             existingPagePath = correctPath, newPagePath = pagePath)

        if (!pageMightExist)
          throw PageExistsException("DwE21VH8", o"""Page already exists,
            id: ${pagePath.pageId.get} path: ${pagePath.path}""")

        // Check for bad paths.
        if (correctPath.path != pagePath.path && !fixBadPath)
          throwNotFound("DwE305RI2", s"Mismatching page path: `$pagePath', " +
             s"should be `$correctPath'")
        // Fix any bad path:
        (true, correctPath)
      case None =>
        (false, pagePath)
    }

    if (!pageExists && pageMustExist)
      throwNotFound("DwE42Im0", s"Page not found, id: ${pagePath.pageId.get}")

    // Dupl code, see PageActions.CheckPathAction
    val permsReq = RequestInfo(  // COULD RENAME! to PermsOnPageRequest
      tenantId = apiRequest.tenantId,
      ip = apiRequest.ip,
      loginId = apiRequest.sid.loginId,
      identity = apiRequest.identity,
      user = apiRequest.user,
      pagePath = okPath)

    val permsOnPage = apiRequest.dao.loadPermsOnPage(permsReq)
    if (!permsOnPage.accessPage)
      throwForbidden("DwE72XIKW2", "You are not allowed to access that page.")

    PageRequest[A](
      sid = apiRequest.sid,
      xsrfToken = apiRequest.xsrfToken,
      identity = apiRequest.identity,
      user = apiRequest.user,
      pageExists = pageExists,
      pagePath = okPath,
      permsOnPage = permsOnPage,
      dao = apiRequest.dao,
      request = apiRequest.request)()
  }


  def forPageThatMightExist[A](apiRequest: DebikiRequest[A], pagePathStr: String,
        pageId: String): PageRequest[A] =
    forPageToCreateOrThatExists(
      apiRequest, pagePathStr, pageId = pageId, pageMightExist = true)


  /**
   * Throws a PageExistsException if the page already exists.
   */
  def forPageToCreate[A](apiRequest: DebikiRequest[A], pagePathStr: String,
        pageId: String): PageRequest[A] =
    forPageToCreateOrThatExists(
      apiRequest, pagePathStr, pageId = pageId, pageMightExist = false)


  private def forPageToCreateOrThatExists[A](apiRequest: DebikiRequest[A],
        pagePathStr: String, pageId: String, pageMightExist: Boolean): PageRequest[A] = {
    val pagePathPerhapsId =
      PagePath.fromUrlPath(apiRequest.tenantId, pagePathStr) match {
        case PagePath.Parsed.Good(path) =>
          assErrIf(path.pageId.isDefined && path.pageId != Some(pageId),
            "DwE309RK9", o"""pagePathStr page id `${path.pageId}'
                 differs from pageId `$pageId'""")
          path
        case x =>
          throwBadReq("DwE390SD3", "Bad path for page id "+ pageId +": "+ x)
      }
    val pagePathWithId = pagePathPerhapsId.copy(pageId = Some(pageId))
    PageRequest(apiRequest, pagePathWithId, pageMightExist = pageMightExist)
  }


  def forPageThatExists[A](apiRequest: DebikiRequest[A], pageId: String) : PageRequest[A] = {
    // COULD try to remove either `lookupPagePath` on the next line, or
    // remove `checkPagePath` in PageRequest.apply(..) above.
    val pagePath = apiRequest.dao.lookupPagePath(pageId) match {
      case Some(path) => path
      case None =>
        throwBadReq("DwE47ZI2", s"Page `$pageId' does not exist")
    }
    PageRequest(apiRequest, pagePath, pageMustExist = true, fixBadPath = true)
  }


  class PageExistsException(errorCode: String, details: String)
    extends DebikiException(errorCode, details)

  object PageExistsException {
    def apply(errorCode: String, details: String) =
      new PageExistsException(errorCode, details)
  }

}



/**
 * A page related request.
 *
 * Sometimes only the browser ip is known (then there'd be no
 * Login/Identity/User).
 */
case class PageRequest[A](
  sid: SidStatus,
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
  request: Request[A])
  (private val _preloadedPageMeta: Option[PageMeta] = None,
  private val _preloadedActions: Option[PageParts] = None,
  private val addMeToPage: Boolean = false)
  extends DebikiRequest[A] {

  require(pagePath.tenantId == tenantId) //COULD remove tenantId from pagePath
  require(!pageExists || pagePath.pageId.isDefined)


  def copyWithPreloadedPage(page: Page, pageExists: Boolean)
        : PageRequest[A] = {
    copy(pageExists = pageExists, pagePath = page.path)(
      Some(page.meta), Some(page.parts), addMeToPage = false)
  }


  /**
   * Adds meta info for a request for a non-existing page, that is, a page
   * that is to be created, presumably.
   */
  def copyWithPreloadedMeta(pageMeta: PageMeta): PageRequest[A] = {
    require(pageExists == false)
    require(pageMeta.pageExists == false)
    require(Some(pageMeta.pageId) == pagePath.pageId)
    assert(addMeToPage == false) // see copyWithPreloadedPage() below
    copy()(Some(pageMeta), _preloadedActions, addMeToPage = false)
  }


  def copyWithPreloadedActions(pageActions: PageParts): PageRequest[A] = {
    require(pageExists == false)
    _preloadedPageMeta.foreach { meta =>
      require(meta.pageId == pageActions.pageId)
    }
    require(Some(pageActions.pageId) == pagePath.pageId)
    assert(addMeToPage == false) // or user should be added to `pageActions`
    copy(pageExists = pageExists)(_preloadedPageMeta, Some(pageActions),
        addMeToPage = false)
  }


  /**
   * A copy with the current user (login, identity and user instances)
   * included on the page that the request concerns.
   *
   * This is useful, if the current user does his/her very first
   * interaction with the page. Then this.page.people has no info
   * on that user, and an error would happen if you did something
   * with the page that required info on the current user.
   * (For example, adding [a reply written by the user] to the page,
   * and then rendering the page.)
   */
  def copyWithAnyMeOnPage: PageRequest[A] =
    if (loginId.isEmpty || !pageExists) this
    else {
      if (_preloadedActions isDefined)
        copy()(_preloadedPageMeta, _preloadedActions.map(_ ++ anyMeAsPeople),
          false)
      else
        copy()(_preloadedPageMeta, None, addMeToPage = true)
    }


  def copyWithMeOnPage_! : PageRequest[A] =
    if (loginId.isEmpty) throwForbidden("DwE403BZ39", "Not logged in")
    else copyWithAnyMeOnPage


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
  lazy val page_? : Option[PageParts] =
    _preloadedActions orElse {
      if (pageExists) {
        val pageOpt = pageId.flatMap(id => dao.loadPage(id))
        if (!addMeToPage) pageOpt
        else pageOpt.map(_ ++ anyMeAsPeople)
      } else {
        // Don't load the page even if it was *created* moments ago.
        // having !pageExists and page_? = Some(..) feels risky.
        None
      }
    }

  /**
   * The page this PageRequest concerns. Throws 404 Not Found if not found.
   *
   * (The page might have been deleted, just after the access control step.)
   */
  // COULD rename to actions_!.
  lazy val page_! : PageParts =
    page_? getOrElse throwNotFound("DwE43XWY", "Page not found, id: "+ pageId)


  lazy val pageDesiredVersionWithDummies_! : PageParts = {
    DummyPage.addMissingTitleBodyConfigTo(
      oldPageVersion.map(page_!.asOf(_)) getOrElse page_!, pageMeta_!.pageRole)
  }


  /** Any page version specified in the query string, e.g.:
    * ?view&version=2012-08-20T23:59:59Z
    */
  lazy val oldPageVersion: Option[ju.Date] = {
    request.queryString.getEmptyAsNone("version") map { datiString =>
      try {
        parseIso8601DateTime(datiString)
      } catch {
        case ex: IllegalArgumentException =>
          throwBadReq("DwE3DW27", "Bad version query param")
      }
    }
  }


  /**
   * The page root tells which post to start with when rendering a page.
   * By default, the page body is used. The root is specified in the
   * query string, like so: ?view=rootPostId  or ?edit=....&view=rootPostId
   */
  lazy val pageRoot: PageRoot =
    request.queryString.get("view").map(rootPosts => rootPosts.size match {
      case 1 => PageRoot(parseIntOrThrowBadReq(rootPosts.head))
      // It seems this cannot hapen with Play Framework:
      case 0 => assErr("DwE03kI8", "Query string param with no value")
      case _ => throwBadReq("DwE0k35", "Too many `view' query params")
    }) getOrElse PageRoot.TheBody


  def pageRole_! : PageRole = pageMeta_!.pageRole

  def parentPageId_! : Option[String] = pageMeta_!.parentPageId


  /**
   * Gets/loads page meta data from cache/database, or throws 404 Not Found.
   */
  lazy val pageMeta_! : PageMeta = {
    _preloadedPageMeta getOrElse {
      if (pageExists) {
        pageId.flatMap(dao.loadPageMeta _) getOrElse throwNotFound(
          "DwE0FET3", s"No meta data found in database for page id: `$pageId'")
      }
      else {
        throwNotFound("DwE7Rd32", s"No page meta found for page id: `$pageId'")
      }
    }
  }

}


