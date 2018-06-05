/**
 * Copyright (c) 2013 Kaj Magnus Lindberg
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

import com.debiki.core._
import com.debiki.core.Prelude._
import debiki._
import debiki.EdHttp._
import debiki.dao.{NonExistingPage, SiteDao}
import ed.server.{EdContext, EdController, RenderedPage}
import ed.server.http._
import javax.inject.Inject
import play.api.libs.json.JsValue
import play.api.mvc.{Action, ControllerComponents}


/** Shows embedded comments.
  */
class EmbeddedTopicsController @Inject()(cc: ControllerComponents, edContext: EdContext)
  extends EdController(cc, edContext) {

  import context.globals
  import context.security


  def createEmbeddedCommentsForum: Action[JsValue] = AdminPostJsonAction(maxBytes = 200) { request =>
    val settings = request.siteSettings
    val title = "Comments for " + settings.allowEmbeddingFrom.replaceFirst("https?://", "")
    request.dao.createForum(title, folder = "/", isForEmbCmts = true, request.who)
    Ok
  }


  def showTopic(embeddingUrl: String, discussionId: Option[AltPageId], edPageId: Option[PageId])
        : Action[Unit] = AsyncGetAction { request =>
    import request.dao

    val anyRealPageId = getAnyRealPageId(edPageId, discussionId, embeddingUrl, dao)
    val (renderedPage, pageRequest) = anyRealPageId match {
      case None =>
        // Embedded comments page not yet created. Return a dummy page; we'll create a real one,
        // later when the first reply gets posted.
        val pageRequest = ViewPageController.makeEmptyPageRequest(request, EmptyPageId, showId = true,
            PageRole.EmbeddedComments, globals.now())
        val categoryId = dao.getDefaultCategoryId()

        val dummyPage = NonExistingPage(
          dao.siteId, PageRole.EmbeddedComments, Some(categoryId), embeddingUrl, globals.now())

        val (maySee, debugCode) = dao.maySeePageUseCache(dummyPage.meta, request.requester)
        if (!maySee)
          security.throwIndistinguishableNotFound(debugCode)

        val pageRenderParams = PageRenderParams(
          widthLayout = if (request.isMobile) WidthLayout.Tiny else WidthLayout.Medium,
          isEmbedded = true,
          origin = request.origin,
          anyCdnOrigin = globals.anyCdnOrigin,
          anyPageRoot = None,
          anyPageQuery = None)

        val jsonStuff = dao.jsonMaker.pageThatDoesNotExistsToJson(dummyPage, pageRenderParams)

        // Don't render server side, render client side only. Search engines shouldn't see it anyway,
        // because it doesn't exist.
        // So skip: Nashorn.renderPage(jsonStuff.jsonString)
        val tpi = new PageTpi(pageRequest, jsonStuff.jsonString, jsonStuff.version,
          "Dummy cached html [EdM2GRVUF05]", WrongCachedPageVersion,
          jsonStuff.pageTitle, jsonStuff.customHeadTags, anyAltPageId = discussionId,
          anyEmbeddingUrl = Some(embeddingUrl))
        val htmlString = views.html.templates.page(tpi).body

        (RenderedPage(htmlString, "NoJson-1WB4Z6", unapprovedPostAuthorIds = Set.empty), pageRequest)

      case Some(realId) =>
        val pageMeta = dao.getThePageMeta(realId)
        if (pageMeta.pageRole != PageRole.EmbeddedComments)
          throwForbidden("EdE2F6UHY3", "Not an embedded comments page")

        val (maySee, debugCode) = dao.maySeePageUseCache(pageMeta, request.requester)
        if (!maySee)
          security.throwIndistinguishableNotFound(debugCode)

        val pagePath = PagePath(siteId = request.siteId, folder = "/", pageId = Some(realId),
          showId = true, pageSlug = "")

        val pageRequest = new PageRequest[Unit](
          request.site,
          sid = request.sid,
          xsrfToken = request.xsrfToken,
          browserId = request.browserId,
          user = request.user,
          pageExists = true,
          pagePath = pagePath,
          pageMeta = Some(pageMeta),
          embeddingUrl = Some(embeddingUrl),
          altPageId = discussionId,
          dao = dao,
          request = request.request)

        (request.dao.renderPageMaybeUseCache(pageRequest), pageRequest)
    }

    ViewPageController.addVolatileJsonAndPreventClickjacking(renderedPage, pageRequest)
  }


  def showEmbeddedEditor(embeddingUrl: String, discussionId: Option[AltPageId],
        edPageId: Option[PageId]): Action[Unit] = AsyncGetAction { request =>
    val anyRealPageId = getAnyRealPageId(edPageId, discussionId, embeddingUrl, request.dao)
    val tpi = new EditPageTpi(request, PageRole.EmbeddedComments, anyEmbeddedPageId = anyRealPageId,
      anyAltPageId = discussionId, anyEmbeddingUrl = Some(embeddingUrl))
    val htmlStr = views.html.embeddedEditor(tpi).body
    ViewPageController.addVolatileJsonAndPreventClickjacking2(htmlStr,
      unapprovedPostAuthorIds = Set.empty, request)
  }


  private def getAnyRealPageId(edPageId: Option[PageId], discussionId: Option[String],
        embeddingUrl: String, dao: SiteDao): Option[PageId] = {
    // Lookup the page by real id, if specified, otherwise alt id, or embedding url.
    edPageId orElse {
      val altId =
        if (discussionId is "") embeddingUrl
        else discussionId.getOrElse(embeddingUrl)
      dao.getRealPageId(altId)
    }
  }

}
