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

package requests

import com.debiki.core._
import com.debiki.core.Prelude._
import controllers.Utils.parseIntOrThrowBadReq
import controllers.Utils.ValidationImplicits._
import debiki._
import debiki.DebikiHttp._
import debiki.dao.SiteDao
import java.{util => ju}
import play.api.mvc.{Action => _, _}
import DbDao.PathClashException



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

    val anyPageMeta = okPath.pageId.flatMap(apiRequest.dao.loadPageMeta(_))
    if (pageExists && anyPageMeta.isEmpty)
      throwNotFound("DwE56Jb0", s"No page meta found, page id: ${pagePath.pageId.get}")

    // Dupl code, see PageActions.CheckPathAction
    val permsReq = PermsOnPageQuery(
      tenantId = apiRequest.tenantId,
      ip = apiRequest.ip,
      loginId = apiRequest.sid.loginId,
      identity = apiRequest.identity,
      user = apiRequest.user,
      pagePath = okPath,
      pageMeta = anyPageMeta)

    val permsOnPage = apiRequest.dao.loadPermsOnPage(permsReq)
    if (!permsOnPage.accessPage)
      throwForbidden("DwE72XIKW2", "You are not allowed to access that page.")

    PageRequest[A](
      sid = apiRequest.sid,
      xsrfToken = apiRequest.xsrfToken,
      browserId = apiRequest.browserId,
      identity = apiRequest.identity,
      user = apiRequest.user,
      pageExists = pageExists,
      pagePath = okPath,
      pageMeta = anyPageMeta,
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


  /** Returns None if the page doesn't exist.
    */
  def forPageThatExists[A](apiRequest: DebikiRequest[A], pageId: String): Option[PageRequest[A]] = {
    // COULD try to remove either `lookupPagePath` on the next line, or
    // remove `checkPagePath` in PageRequest.apply(..) above.
    apiRequest.dao.lookupPagePath(pageId) match {
      case Some(pagePath) =>
        Some(PageRequest(apiRequest, pagePath, pageMustExist = true, fixBadPath = true))
      case None =>
        None
    }
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
  *
  * Naming convention: Functions that assume that the page exists, and throws
  * a 404 Not Found error otherwise, are named like "thePage" or "thePageParts",
  * whilst functions that instead require an Option are named simply "page" or
  * "pageParts".
  */
case class PageRequest[A](
  sid: SidStatus,
  xsrfToken: XsrfOk,
  browserId: Option[BrowserId],
  identity: Option[Identity],
  user: Option[User],
  pageExists: Boolean,
  /** Ids of groups to which the requester belongs. */
  // userMemships: List[String],
  /** If the requested page does not exist, pagePath.pageId is empty. */
  pagePath: PagePath,
  pageMeta: Option[PageMeta],
  permsOnPage: PermsOnPage,
  dao: SiteDao,
  request: Request[A])
  (private val _preloadedActions: Option[PageParts] = None,
  private val _preloadedAncestorIds: Option[List[PageId]] = None,
  private val addMeToPage: Boolean = false,
  private val pageRootOverride: Option[AnyPageRoot] = None)
  extends DebikiRequest[A] {

  require(pagePath.tenantId == tenantId) //COULD remove tenantId from pagePath
  require(!pageExists || pagePath.pageId.isDefined)
  require(!pageExists || pageMeta.isDefined)

  pageMeta foreach { meta =>
    require(meta.pageExists == pageExists)
    require(Some(meta.pageId) == pagePath.pageId)
    _preloadedAncestorIds foreach { ids =>
      illArgIf(ids.headOption != meta.parentPageId, "DwE7GWh1")
    }
  }


  def copyWithPreloadedPage(page: Page, pageExists: Boolean)
        : PageRequest[A] = {
    val copyWithOldPerms = copy(
      pageExists = pageExists, pagePath = page.path, pageMeta = Some(page.meta))(
      Some(page.parts), Some(page.ancestorIdsParentFirst), addMeToPage = false, pageRootOverride)
    copyWithOldPerms.copyWithUpdatedPermissions()
  }


  /**
   * Adds meta info for a request for a non-existing page, that is, a page
   * that is to be created, presumably.
   */
  def copyWithPreloadedMeta(newMeta: PageMeta): PageRequest[A] = {
    require(pageExists == false)
    require(newMeta.pageExists == false)
    require(Some(newMeta.pageId) == pagePath.pageId)
    require(_preloadedAncestorIds.map(_.headOption == newMeta.parentPageId) != Some(false))
    assert(addMeToPage == false) // see copyWithPreloadedPage() below
    val copyWithOldPerms = copy(pageMeta = Some(newMeta))(
      _preloadedActions, _preloadedAncestorIds, addMeToPage = false, pageRootOverride)
    copyWithOldPerms.copyWithUpdatedPermissions()
  }


  private def copyWithUpdatedPermissions(): PageRequest[A] = {
    val newPerms = dao.loadPermsOnPage(PermsOnPageQuery(
      tenantId = tenantId,
      ip = request.remoteAddress,
      loginId = sid.loginId,
      identity = identity,
      user = user,
      pagePath = pagePath,
      pageMeta = pageMeta))
    copy(permsOnPage = newPerms)(
      _preloadedActions, _preloadedAncestorIds, addMeToPage, pageRootOverride)
  }


  def copyWithPreloadedActions(pageActions: PageParts): PageRequest[A] = {
    require(pageExists == false)
    pageMeta foreach { meta =>
      require(meta.pageId == pageActions.pageId)
    }
    require(Some(pageActions.pageId) == pagePath.pageId)
    assert(addMeToPage == false) // or user should be added to `pageActions`
    copy()(Some(pageActions), _preloadedAncestorIds, addMeToPage = false, pageRootOverride)
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
        copy()(_preloadedActions.map(_ ++ anyMeAsPeople),
          _preloadedAncestorIds, addMeToPage = false, pageRootOverride)
      else
        copy()(None, _preloadedAncestorIds, addMeToPage = true, pageRootOverride)
    }


  def copyWithMeOnPage_! : PageRequest[A] =
    if (loginId.isEmpty) throwForbidden("DwE403BZ39", "Not logged in")
    else copyWithAnyMeOnPage


  def copyWithNewPageRoot(newRoot: AnyPageRoot): PageRequest[A] =
    copy()(_preloadedActions, _preloadedAncestorIds, addMeToPage, pageRootOverride = Some(newRoot))


  def pageId: Option[String] = pagePath.pageId

  /**
   * Throws 404 Not Found if id unknown. The page id is known if it
   * was specified in the request, *or* if the page exists.
   */
  def pageId_! : String = pagePath.pageId getOrElse
    throwNotFound("DwE93kD4", "Page does not exist: "+ pagePath.path)

  def thePageId = pageId_!

  /**
   * The page this PageRequest concerns, or None if not found
   * (e.g. if !pageExists, or if it was deleted just moments ago).
   */
  lazy val page_? : Option[PageParts] =
    _preloadedActions orElse {
      if (pageExists) {
        val anyPage = pageId.flatMap(id => dao.loadPageParts(id))
        if (!addMeToPage) anyPage
        else anyPage.map(_ ++ anyMeAsPeople)
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

  def pageNoPath_! = PageNoPath(page_!, ancestorIdsParentFirst_!, pageMeta_!)

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
  lazy val pageRoot: AnyPageRoot =
    pageRootOverride.getOrElse(
    request.queryString.get("view").map(rootPosts => rootPosts.size match {
      case 1 => Some(parseIntOrThrowBadReq(rootPosts.head))
      // It seems this cannot hapen with Play Framework:
      case 0 => assErr("DwE03kI8", "Query string param with no value")
      case _ => throwBadReq("DwE0k35", "Too many `view' query params")
    }) getOrElse DefaultPageRoot)


  def pageRole: Option[PageRole] = pageMeta.map(_.pageRole)

  def pageRole_! : PageRole = pageMeta_!.pageRole

  def parentPageId_! : Option[String] = pageMeta_!.parentPageId

  def pageMeta_! = pageMeta getOrElse throwNotFound(
    "DwE3ES58", s"No page meta found, page id: $pageId")

  lazy val ancestorIdsParentFirst_! : List[PageId] =
    _preloadedAncestorIds getOrElse dao.loadAncestorIdsParentFirst(pageId_!)


  def pathAndMeta_! = PagePathAndMeta(pagePath, ancestorIdsParentFirst_!, pageMeta_!)


  lazy val thePageSettings: Settings = {
    if (pageExists) {
      dao.loadSinglePageSettings(thePageId)
    }
    else if (parentPageId_!.isDefined) {
      dao.loadPageTreeSettings(parentPageId_!.get)
    }
    else {
      dao.loadWholeSiteSettings()
    }
  }

}


