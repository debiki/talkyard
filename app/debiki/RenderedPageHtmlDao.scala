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


  def renderPage(pageReq: PageRequest[_], showComments: Boolean)
        : xml.NodeSeq = {
    val page = PageStuff(pageReq.pageMeta, pageReq.pagePath, pageReq.page_!)
    PageRenderer.renderArticle(page, pageReq.pageVersion,
        pageReq.pageRoot, hostAndPort = pageReq.host,
        showComments = showComments)
  }

}



trait CachingRenderedPageHtmlDao extends RenderedPageHtmlDao {
  self: CachingTenantDao =>


  override def renderPage(pageReq: PageRequest[_], showComments: Boolean)
        : xml.NodeSeq = {
    // Bypass the cache if the page doesn't yet exist (it's being created),
    // because in the past there was some error because non-existing pages
    // had no ids (so feels safer to bypass).
    if (pageReq.pageExists && pageReq.pageRoot == PageRoot.Real(Page.BodyId) &&
        pageReq.pageVersion == PageVersion.LatestApproved) {
      val key = _pageHtmlKey(
        pageReq.pageId_!, origin = pageReq.host, showComments)
      lookupInCache(key, orCacheAndReturn = {
        Some(super.renderPage(pageReq, showComments))
      }) getOrDie "DwE93IB7"
    }
    else {
      // Bypass cache.
      super.renderPage(pageReq, showComments)
    }
  }


  def uncacheRenderedPage(pageId: String, origin: String) {
    // COULD do this for each origin listed in DW1_TENANT_HOSTS,
    // alternatively, cache a Map[serveraddress, page-html] instead.
    removeFromCache(_pageHtmlKey(pageId, origin, true))
    removeFromCache(_pageHtmlKey(pageId, origin, false))
  }


  private def _pageHtmlKey(pageId: String, origin: String,
        showComments: Boolean): String =
    s"$pageId.$tenantId.$origin.$showComments.PageHtml"

}

