/**
 * Copyright (c) 2011-2012 Kaj Magnus Lindberg (born 1979)
 */

package debiki

import com.debiki.v0.Prelude._
import com.google.{common => guava}
import controllers.PageRequest
import debiki.DebikiHttp.throwNotFound
import java.{util => ju}
import play.api.Logger
import scala.xml.NodeSeq
import PageCache._
import com.debiki.v0._


object PageCache {
  case class Key(
    tenantId: String,
    pageGuid: String,
    hostAndPort: String,
    showComments: Boolean)
}


/**
 * Caches serialized pages, the most recent approved version only.
 *
 * BUG: Each page should always be accessed via the same hostAndPort,
 * otherwise `refreshLater` fails to refresh all cached versions of
 * the page.
 *
 * Uses `PageRequest.dao` to load pages from the database.
 */
class PageCache {

  /**
   * Passes the current quota consumer to _loadAndRender. Needed because
   * Google Guava's cache lookup method takes an unchangeable key only,
   * but we need to use different TenantDao:s when loading pages,
   * so the correct tenant's quota is consumed.
   */
  private val _tenantDaoDynVar =
    new util.DynamicVariable[TenantDao](null)


  private val _pageCache: ju.concurrent.ConcurrentMap[Key, NodeSeq] =
    new guava.collect.MapMaker().
       softValues().
       maximumSize(100*1000).
       //expireAfterWrite(10. TimeUnits.MINUTES).
       makeComputingMap(new guava.base.Function[Key, NodeSeq] {
      def apply(k: Key): NodeSeq = {
        val tenantDao = _tenantDaoDynVar.value
        assert(tenantDao ne null)
        _loadAndRender(k, PageRoot.TheBody, PageVersion.LatestApproved,
            tenantDao)
      }
    })


  private def _loadAndRender(k: Key, pageRoot: PageRoot,
        pageVersion: PageVersion, tenantDao: TenantDao): NodeSeq = {
    assert(k.tenantId == tenantDao.tenantId)
    // COULD load only Page.BodyId, Page.TitleId if !showComments.
    tenantDao.loadPage(k.pageGuid) match {
      case Some(page) =>
        PageRenderer.renderArticleAndComments(page, pageVersion, pagePath,
          pageRoot, hostAndPort = k.hostAndPort, showComments = k.showComments)
      case None =>
        // Page missing. Should have been noticed during access control.
        // (Or perhaps it was deleted moments ago and this is actually no
        // error?)
        assErr("DwE35eQ20", "Page "+ safed(k.pageGuid) +" not found")
    }
  }


  def get(pageReq: PageRequest[_], commentVisibility: CommentVisibility)
        : NodeSeq = {
    try {
      val config = DebikiHttp.newUrlConfig(pageReq)
      // The dialog templates includes the user name and cannot currently
      // be cached.
      val templates = HtmlForms(config, pageReq.xsrfToken.value,
        pageReq.pageRoot, pageReq.permsOnPage).dialogTemplates
      val key = Key(
        pageReq.tenantId, pageReq.pagePath.pageId.get, pageReq.request.host,
        showComments = commentVisibility != CommentVisibility.Hidden)
      (pageReq.pageRoot, pageReq.pageVersion) match {
        case (PageRoot.Real(Page.BodyId), PageVersion.LatestApproved) =>
          _tenantDaoDynVar.withValue(pageReq.dao) {
            // The page (with the article and all comments) includes
            // nothing user specific and can thus be cached.
            val page = _pageCache.get(key)
            page ++ templates
          }

        case (otherRoot, version) =>
          // The cache currently works only for the page body as page root.
          _loadAndRender(key, otherRoot, version, pageReq.dao) ++ templates
      }
    } catch {
      case e: NullPointerException =>
        // Another user and thread might remove the page at any time?
        // COULD create a DebikiLogger.warnThrowNotFound(...)
        Logger.warn("Page "+ safed(pageReq.pagePath) +" not found")
        throwNotFound("DwE091k5J83", "Page "+ safed(pageReq.pagePath) +" not found")
    }
  }


  def refreshLater(tenantId: String, pageId: String, host: String) {
    // For now, simply drop the cache entry.
    // COULD send a message to an actor that refreshes the page later.
    // Then the caller won't have to wait.
    // COULD fix BUG: only clears the cache for the current host and port
    // (problems e.g. if you use localhost:8080 and <ip>:8080).
    _pageCache.remove(Key(tenantId, pageId, host, showComments = true))
    _pageCache.remove(Key(tenantId, pageId, host, showComments = false))
  }

}

