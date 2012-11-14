/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package debiki

import com.debiki.v0._
import controllers._
import java.{util => ju}
import scala.xml.NodeSeq
import EmailNotfPrefs.EmailNotfPrefs
import Prelude._


trait RenderedPageHtmlDao {
  this: TenantDao =>


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
  self: TenantDao =>


  override def renderTemplate(pageReq: PageRequest[_],
        appendToBody: NodeSeq = Nil): String = {
    // Bypass the cache if the page doesn't yet exist (it's being created),
    // because in the past there was some error because non-existing pages
    // had no ids (so feels safer to bypass).
    TemplateRenderer(pageReq, appendToBody).renderTemplate()
  }


  override def renderPage(pageReq: PageRequest[_], showComments: Boolean)
        : xml.NodeSeq = {
    if (pageReq.pageExists) {
      val commentVisibility =
        if (showComments) CommentVisibility.Visible
        else CommentVisibility.Hidden
      Debiki.PageCache.get(pageReq, commentVisibility)
    }
    else {
      super.renderPage(pageReq, showComments)
    }
  }


  def uncacheRenderedPage(pageId: String, host: String) {
    Debiki.PageCache.refreshLater(tenantId = tenantId, pageId = pageId,
      host = host)
  }

}

