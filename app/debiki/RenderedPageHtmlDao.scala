/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package debiki

import com.debiki.v0._
import controllers._
import java.{util => ju}
import scala.xml.NodeSeq
import Prelude._


trait RenderedPageHtmlDao {
  self: TenantDao =>


  def renderTemplate(pageReq: PageRequest[_], appendToBody: NodeSeq = Nil)
        : String =
    TemplateRenderer(pageReq, appendToBody).renderTemplate()


  def renderPageMeta(pageReq: PageRequest[_]): NodeSeq = {
    HtmlPageSerializer.wrapInPageTag(pageReq.pageMeta, pageReq.pagePath)(Nil)
      .map(html => xml.Unparsed(liftweb.Html5.toString(html)))
  }


  def renderPageTitle(pageReq: PageRequest[_]): NodeSeq = {
    val page = pageReq.pageDesiredVersion_!
    page.titlePost.map(HtmlPostRenderer.renderPageTitle(_)) getOrElse Nil
  }


  def renderAuthorAndDate(pageReq: PageRequest[_]): NodeSeq = {
    val page = pageReq.pageDesiredVersion_!
    page.titlePost map { titlePost =>
      HtmlPostRenderer.renderPostHeader(titlePost, anyPageStats = None)
    } map (_.html) getOrElse Nil
  }


  def renderPage(pageReq: PageRequest[_], showComments: Boolean): xml.NodeSeq = {
    val config = DebikiHttp.newUrlConfig(pageReq.host)
    val page = pageReq.pageDesiredVersion_!
    val pageStuff = PageStuff(pageReq.pageMeta, pageReq.pagePath, page)
    val pageTrust = PageTrust(page)

    val renderer = HtmlPageSerializer(pageStuff, pageTrust, pageReq.pageRoot,
      config, showComments = showComments)

    val htmlNode = renderer.layoutPage() map { html =>
      xml.Unparsed(liftweb.Html5.toString(html))
    }

    htmlNode
  }


  def renderComments(pageReq: PageRequest[_]): xml.NodeSeq = {
    <b>Comments_comments_comments</b>
  }
}



trait CachingRenderedPageHtmlDao extends RenderedPageHtmlDao {
  self: CachingTenantDao =>


  override def renderPage(pageReq: PageRequest[_], showComments: Boolean): xml.NodeSeq = {
    // Bypass the cache if the page doesn't yet exist (it's being created),
    // because in the past there was some error because non-existing pages
    // had no ids (so feels safer to bypass).
    if (pageReq.pageExists && pageReq.pageRoot == PageRoot.Real(Page.BodyId) &&
        pageReq.pageVersion == PageVersion.LatestApproved) {
      val key = _pageHtmlKey(
        pageReq.pageId_!, origin = pageReq.host, showComments)
      lookupInCache(key, orCacheAndReturn = {
        rememberOrigin(pageReq.host)
        Some(super.renderPage(pageReq, showComments))
      }) getOrDie "DwE93IB7"
    }
    else {
      // Bypass cache.
      super.renderPage(pageReq, showComments)
    }
  }


  /**
   * Remembers (caches) origins via which this server has been accessed.
   * Sometimes a server is accessed via many addresses/origins,
   * e.g. www.debiki.com and localhost:9003 (SSH tunnel),
   * or https://www.debiki.com and http://www.debiki.com.
   */
  private def rememberOrigin(origin: String) {
    var done = false
    do {
      lookupInCache[List[String]](originsKey) match {
        case None =>
          done = putInCacheIfAbsent(originsKey, List(origin))
        case Some(knownOrigins) =>
          if (knownOrigins contains origin)
            return
          val newOrigins = origin :: knownOrigins
          done = replaceInCache(originsKey, knownOrigins, newValue = newOrigins)
      }
    }
    while (!done)
  }


  private def knownOrigins: List[String] =
    lookupInCache[List[String]](originsKey) getOrElse Nil


  def uncacheRenderedPage(pageId: String) {
    // Since the server address might be included in the generated html,
    // we need to uncache pageId for each server address that maps
    // to the current website (this.tenantId).
    for (origin <- knownOrigins) {
      removeFromCache(_pageHtmlKey(pageId, origin, showComments = false))
      removeFromCache(_pageHtmlKey(pageId, origin, showComments = true))
    }

    // BUG race condition: What if anotoher thread started rendering a page
    // just before the invokation of this function, and is finished
    // just after we've cleared the cache? Then that other thread will insert
    // a stale cache item. Could fix, by verifying that when you cache
    // something, the current version of the page is the same as the page
    // version when you started generating the cache value (e.g. started
    // rendering a page).
  }


  private def _pageHtmlKey(pageId: String, origin: String, showComments: Boolean) =
    s"$pageId|$tenantId|$origin|$showComments|PageHtml"


  private def originsKey: String = s"$tenantId|PossibleOrigins"

}

