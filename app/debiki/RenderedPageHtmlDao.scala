/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package debiki

import com.debiki.v0._
import controllers._
import java.{util => ju}
import scala.xml.NodeSeq
import Prelude._



case class RenderPageSettings(
  showTitle: Boolean,
  showAuthorAndDate: Boolean,
  showBody: Boolean,
  showComments: Boolean)


case class RenderedPage(
  title: NodeSeq,
  titleText: String,
  authorAndDate: NodeSeq,
  bodyAndComments: NodeSeq)



trait RenderedPageHtmlDao {
  self: TenantDao =>


  def renderTemplate(pageReq: PageRequest[_], appendToBody: NodeSeq = Nil)
        : String =
    TemplateRenderer.renderTemplate(pageReq, appendToBody)


  final def renderPageMeta(pageReq: PageRequest[_]): NodeSeq = {
    HtmlPageSerializer.wrapInPageTag(pageReq.pageMeta_!, pageReq.pagePath)(Nil)
      .map(html => xml.Unparsed(liftweb.Html5.toString(html)))
  }


  def renderPage(pageReq: PageRequest[_], renderSettings: RenderPageSettings)
        : RenderedPage = {

    val config = DebikiHttp.newUrlConfig(pageReq.host)
    val page = pageReq.pageDesiredVersionWithDummies_!
    val pageStuff = PageStuff(pageReq.pageMeta_!, pageReq.pagePath, page)
    val pageTrust = PageTrust(page)

    val renderer = HtmlPageSerializer(pageStuff, pageTrust, pageReq.pageRoot, config)

    val pageTitle =
      if (!renderSettings.showTitle) Nil
      else {
        renderer.renderSingleThread(Page.TitleId) map { renderedThread =>
          xml.Unparsed(liftweb.Html5.toString(renderedThread.htmlNodes))
        } getOrElse Nil
      }

    val pageAuthorAndDate =
      if (!renderSettings.showAuthorAndDate) Nil
      else {
        page.body map { bodyPost =>
          HtmlPostRenderer.renderPostHeader(bodyPost, anyPageStats = None)
        } map (_.html) getOrElse Nil
      }

    val pageBodyAndComments =
      if (!renderSettings.showBody && !renderSettings.showComments) Nil
      else {
        renderer.renderBodyAndComments(showComments = renderSettings.showComments) map {
          html =>
            xml.Unparsed(liftweb.Html5.toString(html))
          }
      }

    RenderedPage(
      title = pageTitle,
      titleText = page.titleText getOrElse "",
      authorAndDate = pageAuthorAndDate,
      bodyAndComments = pageBodyAndComments)
  }

}



trait CachingRenderedPageHtmlDao extends RenderedPageHtmlDao {
  self: CachingTenantDao =>


  override def renderPage(pageReq: PageRequest[_], renderSettings: RenderPageSettings)
        : RenderedPage = {
    // Bypass the cache if the page doesn't yet exist (it's being created),
    // because in the past there was some error because non-existing pages
    // had no ids (so feels safer to bypass).
    if (pageReq.pageExists && pageReq.pageRoot == PageRoot.Real(Page.BodyId) &&
        pageReq.pageVersion == PageVersion.LatestApproved) {
      val key = _pageHtmlKey(pageReq.pageId_!, origin = pageReq.host)
      lookupInCache(key, orCacheAndReturn = {
        rememberOrigin(pageReq.host)
        Some(super.renderPage(pageReq, renderSettings))
      }) getOrDie "DwE93IB7"
    }
    else {
      // Bypass cache.
      super.renderPage(pageReq, renderSettings)
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
      removeFromCache(_pageHtmlKey(pageId, origin))
    }

    // BUG race condition: What if anotoher thread started rendering a page
    // just before the invokation of this function, and is finished
    // just after we've cleared the cache? Then that other thread will insert
    // a stale cache item. Could fix, by verifying that when you cache
    // something, the current version of the page is the same as the page
    // version when you started generating the cache value (e.g. started
    // rendering a page).
  }


  private def _pageHtmlKey(pageId: String, origin: String) =
    s"$pageId|$tenantId|$origin|PageHtml"


  private def originsKey: String = s"$tenantId|PossibleOrigins"

}

