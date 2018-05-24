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
import com.debiki.core.Prelude._
import controllers.Utils.ValidationImplicits._
import debiki._
import debiki.EdHttp._
import debiki.dao.SiteDao
import ed.server.security.{SidStatus, XsrfOk, BrowserId}
import play.api.mvc.Request



/** A page related request.
  *
  * Naming convention: Functions that assume that the page exists, and throws
  * a 404 Not Found error otherwise, are named like "thePage" or "thePageParts",
  * whilst functions that instead require an Option are named simply "page" or
  * "pageParts".
  */
class PageRequest[A](
  val site: SiteBrief,
  val sid: SidStatus,
  val xsrfToken: XsrfOk,
  val browserId: Option[BrowserId],
  val user: Option[User],
  val pageExists: Boolean,
  /** Ids of groups to which the requester belongs. */
  // userMemships: List[String],
  /** If the requested page does not exist, pagePath.pageId is empty. */
  val pagePath: PagePath,
  val pageMeta: Option[PageMeta],
  val embeddingUrl: Option[String],
  val altPageId: Option[String],
  val dao: SiteDao,
  val request: Request[A]) extends DebikiRequest[A] {

  require(pagePath.siteId == tenantId) //COULD remove tenantId from pagePath
  require(!pageExists || pagePath.pageId.isDefined)
  require(!pageExists || pageMeta.isDefined)

  pageMeta foreach { meta =>
    require(pagePath.pageId contains meta.pageId)
  }


  def pageId: Option[PageId] = pagePath.pageId
  def theSitePageId = SitePageId(siteId, thePageId)

  /**
   * Throws 404 Not Found if id unknown. The page id is known if it
   * was specified in the request, *or* if the page exists.
   */
  def thePageId : PageId = pagePath.pageId getOrElse
    throwNotFound("DwE93kD4", "Page does not exist: "+ pagePath.value)


  /**
   * The page root tells which post to start with when rendering a page.
   * By default, the page body is used. The root is specified in the
   * query string, like so: ?view=rootPostId  or ?edit=....&view=rootPostId
   */
  lazy val pageRoot: AnyPageRoot =
    request.queryString.get("view").map(rootPosts => rootPosts.size match {
      case 1 => Some(parseIntOrThrowBadReq(rootPosts.head))
      // It seems this cannot hapen with Play Framework:
      case 0 => assErr("DwE03kI8", "Query string param with no value")
      case _ => throwBadReq("DwE0k35", "Too many `view' query params")
    }) getOrElse {
      pageRole match {
        case Some(PageRole.EmbeddedComments) =>
          // There's no page body that can be used as page root, because embedded
          // pages contain comments only.
          None
        case _ =>
          DefaultPageRoot
      }
    }


  def pageRole: Option[PageRole] = pageMeta.map(_.pageRole)

  def thePageRole : PageRole = thePageMeta.pageRole

  def thePageMeta: PageMeta = pageMeta getOrElse throwNotFound(
    "DwE3ES58", s"No page meta found, page id: $pageId")


  lazy val thePageSettings: EffectiveSettings = {
    if (false) { // pageExists) {
      ??? // dao.loadSinglePageSettings(thePageId)
    }
    /* Now when using categories instead of category pages, should I load settings
       for the categories somehow? Currently there are none though, so just skip this.
    else if (theParentPageId.isDefined) {
      dao.loadPageTreeSettings(theParentPageId.get)
    } */
    else {
      dao.getWholeSiteSettings()
    }
  }


  /** If we should include comment vote and read count statistics in the html.
    */
  def debugStats: Boolean =
    request.queryString.getEmptyAsNone("debugStats").contains("true")


  /** In Prod mode only staff can bypass the cache, otherwise it'd be a bit too easy
    * to DoS attack the server. SECURITY COULD use a magic config file password instead.
    */
  def bypassCache: Boolean =
    (!Globals.isProd || user.exists(_.isStaff)) &&
      request.queryString.getEmptyAsNone("bypassCache").contains("true")

}


/** A request from a page that you provide manually (the page won't be loaded
  * from the database). EmbeddedTopicsController constructs an empty dummy page
  * when showing comments for an URL for which no page has yet been created.
  */
class DummyPageRequest[A](
  siteIdAndCanonicalHostname: SiteBrief,
  sid: SidStatus,
  xsrfToken: XsrfOk,
  browserId: Option[BrowserId],
  user: Option[User],
  pageExists: Boolean,
  pagePath: PagePath,
  pageMeta: PageMeta,
  dao: SiteDao,
  request: Request[A]) extends PageRequest[A](
    siteIdAndCanonicalHostname, sid, xsrfToken, browserId, user, pageExists,
    pagePath, Some(pageMeta), altPageId = None, embeddingUrl = None,
    dao = dao, request = request) {

}
