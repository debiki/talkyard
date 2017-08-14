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
import debiki.DebikiHttp._
import debiki.dao.SiteDao
import ed.server.RenderedPage
import ed.server.http._
import java.{util => ju}
import play.api._
import play.api.mvc.{Action => _, _}


/** Shows embedded comments.
  */
object EmbeddedTopicsController extends mvc.Controller {


  /** Derives the discussion id based on the url of the embedding site.
    * This is done by taking the 16 first characters of a base 64 encoded SHA1 sum,
    * but with - and _ removed.
    *
    * How these ids are derived must never be changed, because then all old ids
    * will become invalid. There's a test case for this function in
    * test/controllers/EmbeddedTopicsControllerSpec.scala.
    *
    * Why the first 16? (1 - (10^10/(36^16))) ^ (10^10) = 0.9999878, see https://web2.0calc.com/,
    * that is, if a website with 1 page per human (10e9 humans) adds Debiki's
    * comment system, the probability of an id clash is roughly 1 / 100 000.
    * ((Also, 16 is a good size, from an in-memory point of view? The underlying
    * char array is padded to a multiple of 16 anyway, and (16*2 + 38) = 70,
    * round up to 8 boundary -> 72, see:
    *   http://www.javamex.com/tutorials/memory/string_memory_usage.shtml  ))
    * **Edit** Now I use 62 digits (= 64 - 2 chars) instead of 36 so the probability of an id
    * collision is even lower.
    */
  def deriveTopicIdFromUrl(url: String): String = {

    val urlNoScheme =
      if (url startsWith "http://") url drop "http://".length
      else if (url startsWith "https://") url drop "https://".length
      else if (url startsWith "//") url drop 2
      else url

    // On my computer:
    // SHA1 + Base 64 encoding takes 4 microseconds.
    // SHA1 + Base 62 encoding takes 3 times longer than SHA1 + Base64 (i.e 12 us).
    // SHA1 + Base 64 + remove - and _ takes 1.5 times longer than SHA1 + Base64, but
    // can be optimized to be as fast.
    // So lets use SHA1 + Base 64 but remove - and _, because _ looks ugly and - is a
    // magic character in Debiki's URLs (it terminates any id part of the url).
    // Using mixed case should be fine (i.e. not base 36) because people cannot remember
    // 16 chars anyway so they need to copy paste anyway.
    die("DwE2MFW8", "Use SHA-256 instead, SHA-1 is a little bit deprecated.")
    val base64 = hashSha1Base64UrlSafe(urlNoScheme)
    val withoutDashAndUnderscore =
      if (base64.exists(ch => ch == '-' || ch == '_'))
        base64.filterNot(ch => ch == '-' || ch == '_' || ch == '=')
      else
        base64
    die("DwE6MFW2", "Might as well take 20 chars instead of 16?")
    val id = withoutDashAndUnderscore take 16
    id
  }


  def showTopic(embeddingUrl: String, discussionId: Option[AltPageId], edPageId: Option[PageId]) =
        AsyncGetAction { request =>
    import request.dao

    val anyRealPageId = getAnyRealPageId(edPageId, discussionId, embeddingUrl, dao)
    val (renderedPage, pageRequest) = anyRealPageId match {
      case None =>
        // Embedded comments page not yet created. Return a dummy page; we'll create a real one,
        // later when the first reply gets posted.
        val pageRequest = ViewPageController.makeEmptyPageRequest(request, EmptyPageId, showId = true,
            PageRole.EmbeddedComments)
        val jsonStuff = ReactJson.pageThatDoesNotExistsToJson(
          dao, PageRole.EmbeddedComments, Some(DefaultCategoryId))
        // Don't render server side, render client side only. Search engines shouldn't see it anyway,
        // because it doesn't exist.
        // So skip: ReactRenderer.renderPage(jsonStuff.jsonString)
        val tpi = new PageTpi(pageRequest, jsonStuff.jsonString, jsonStuff.version,
          "Dummy cached html [EdM2GRVUF05]", WrongCachedPageVersion,
          jsonStuff.pageTitle, jsonStuff.customHeadTags)
        val htmlString = views.html.templates.embeddedComments(tpi).body
        (RenderedPage(htmlString, unapprovedPostAuthorIds = Set.empty), pageRequest)
      case Some(realId) =>
        val pageMeta = dao.getThePageMeta(realId)
        val pagePath = PagePath(siteId = request.siteId, folder = "/", pageId = Some(realId),
          showId = true, pageSlug = "")
        SECURITY; COULD // do the standard auth stuff here, but not needed right now since we
        // proceed only if is embedded comments page. So, right now all such pages are public.
        if (pageMeta.pageRole != PageRole.EmbeddedComments)
          throwForbidden2("EdE2F6UHY3", "Not an embedded comments page")
        val pageRequest = new PageRequest[Unit](
          request.siteIdAndCanonicalHostname,
          sid = request.sid,
          xsrfToken = request.xsrfToken,
          browserId = request.browserId,
          user = request.user,
          pageExists = true,
          pagePath = pagePath,
          pageMeta = Some(pageMeta),
          dao = dao,
          request = request.request)
        (request.dao.renderPageMaybeUseCache(pageRequest), pageRequest)
    }

    ViewPageController.addVolatileJson(renderedPage, pageRequest)
  }


  def showEmbeddedEditor(embeddingUrl: String, discussionId: Option[AltPageId],
        edPageId: Option[PageId]) = GetAction { request =>
    val anyRealPageId = getAnyRealPageId(edPageId, discussionId, embeddingUrl, request.dao)
    val tpi = new EditPageTpi(request, PageRole.EmbeddedComments, anyCurrentPageId = anyRealPageId,
      anyAltPageId = discussionId, anyEmbeddingUrl = Some(embeddingUrl))
    Ok(views.html.embeddedEditor(tpi).body) as HTML
  }


  private def getAnyRealPageId(edPageId: Option[PageId], discussionId: Option[String],
        embeddingUrl: String, dao: SiteDao): Option[PageId] = {
    // Lookup the page by real id, if specified, otherwise alt id, or embedding url.
    edPageId orElse {
      val altId = discussionId.getOrElse(embeddingUrl)
      dao.getRealPageId(altId)
    }
  }


  private def makePageRequest(request: GetRequest): PageGetRequest = {  // xx rm
    ??? /*
    import controllers.Utils.ValidationImplicits._
    val topicId = request.queryString.getNoneAsEmpty("topicId")
    val topicUrl = request.queryString.getNoneAsEmpty("topicUrl")

    val theId: PageId =
      if (topicId.length > 16) {
        // Why would anyone manually specify such a long id? The id is a primary
        // key and I don't want to waste too much storage space storing ids.
        throwBadReq("DwE9053fHE3", s"Too long topic id: `$topicId'")
      }
      else if (topicId.nonEmpty) {
        topicId
      }
      else if (topicUrl.nonEmpty) {
        deriveTopicIdFromUrl(topicUrl)
      }
      else {
        throwBadReq("DwE2594Fk9", "Neither topic id nor url specified")
      }

    if (!Page.isOkayId(theId))
      throwBadReq("DwE77GJ12", s"Bad topic id: `$theId'")

    // Before the first reply has been saved, the embedded discussion page won't
    // yet have been created. Then construct and use an empty page.
    PageRequest.forPageThatExists(request, pageId = theId) getOrElse {
      ViewPageController.makeEmptyPageRequest(request, pageId = theId, showId = true,
        pageRole = PageRole.EmbeddedComments)
    }
    */
  }


  def showSetupInstructions = AdminGetAction { request =>
    ??? /*
    if (request.dao.loadSiteStatus() != SiteStatus.IsEmbeddedSite)
      throwForbidden("DwE21FG4", "This is currently not an embedded comments site")

    Ok(views.html.createsite.embeddingSiteInstructionsPage(
      SiteTpi(request), request.dao.loadSite()).body) as HTML
      */
  }

}
