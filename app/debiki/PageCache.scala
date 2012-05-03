/**
 * Copyright (c) 2011-2012 Kaj Magnus Lindberg (born 1979)
 */

package debiki

import com.debiki.v0.Prelude._
import com.debiki.v0.{liftweb => lw}
import com.google.{common => guava}
import controllers.Actions.PageRequest
import debiki.DebikiHttp.throwNotFound
import java.{util => ju}
import play.api.Logger
import scala.xml.NodeSeq
import PageCache._
import com.debiki.v0._


object PageCache {
  case class Key(tenantId: String, pageGuid: String, hostAndPort: String)
}

/**
 * Caches serialized pages, if the root post is the page body.
 *
 * Each page should always be accessed via the same hostAndPort,
 * otherwise `refreshLater` fails to refresh all cached versions of
 * the page.
 */
class PageCache(val daoFactory: DaoFactory) {

  // Passes the current quota consumer to _loadAndRender. Needed because
  // Google Guava's cache lookup method takes an unchangeable key only.
  private val _quotaConsumersDynVar =
    new util.DynamicVariable[QuotaConsumers](null)

  private val _pageCache: ju.concurrent.ConcurrentMap[Key, NodeSeq] =
    new guava.collect.MapMaker().
       softValues().
       maximumSize(100*1000).
       //expireAfterWrite(10. TimeUnits.MINUTES).
       makeComputingMap(new guava.base.Function[Key, NodeSeq] {
      def apply(k: Key): NodeSeq = {
        val quotaConsumers = _quotaConsumersDynVar.value
        assert(quotaConsumers ne null)
        val dao = daoFactory.buildTenantDao(quotaConsumers)
        _loadAndRender(k, PageRoot.TheBody, dao)
      }
    })

  private def _loadAndRender(k: Key, pageRoot: PageRoot, dao: TenantDao)
        : NodeSeq = {
    dao.loadPage(k.tenantId, k.pageGuid) match {
      case Some(debate) =>
        val config = DebikiHttp.newUrlConfig(k.hostAndPort)
        // Hmm, DebateHtml and pageTrust should perhaps be wrapped in
        // some PageRendererInput class, that is handled to PageCache,
        // so PageCache don't need to know anything about how to render
        // a page. But for now:
        val pageTrust = PageTrust(debate)
        // layoutPage() takes long, because markup source is converted to html.
        val nodes =
          DebateHtml(debate, pageTrust).configure(config).layoutPage(pageRoot)
        nodes map { html =>
        // The html is serialized here only once, then it's added to the
        // page cache (if pageRoot is the Page.body -- see get() below).
          xml.Unparsed(lw.Html5.toString(html))
        }
      case None =>
        // Page missing. Should have been noticed during access control.
        assErr("DwE35eQ20", "Page "+ safed(k.pageGuid) +" not found")
    }
  }


  def get(pageReq: PageRequest[_], pageRoot: PageRoot): NodeSeq = {
    try {
      val config = DebikiHttp.newUrlConfig(pageReq)
      // The dialog templates includes the user name and cannot currently
      // be cached.
      val templates = FormHtml(config, pageReq.xsrfToken.token,
        pageRoot, pageReq.permsOnPage).dialogTemplates
      val key = Key(
        pageReq.tenantId, pageReq.pagePath.pageId.get, pageReq.request.host)
      pageRoot match {
        case PageRoot.Real(Page.BodyId) =>
          _quotaConsumersDynVar.withValue(pageReq.quotaConsumers) {
            // The page (with the article and all comments) includes
            // nothing user specific and can thus be cached.
            val page = _pageCache.get(key)
            page ++ templates
          }

        case otherRoot =>
          // The cache currently works only for the page body as page root.
          val dao = daoFactory.buildTenantDao(pageReq.quotaConsumers)
          _loadAndRender(key, otherRoot, dao) ++ templates
      }
    } catch {
      case e: NullPointerException =>
        // Another user and thread might remove the page at any time?
        // COULD create a DebikiLogger.warnThrowNotFound(...)
        Logger.warn("Page "+ safed(pageReq.pagePath) +" not found")
        throwNotFound("DwE091k5J83", "Page "+ safed(pageReq.pagePath) +" not found")
    }
  }


  def refreshLater(pageReq: PageRequest[_]) {
    // For now, simply drop the cache entry.
    // COULD send a message to an actor that refreshes the page later.
    // Then the caller won't have to wait.
    // COULD fix BUG: only clears the cache for the current host and port
    // (problems e.g. if you use localhost:8080 and <ip>:8080).
    _pageCache.remove(Key(pageReq.tenantId, pageReq.pagePath.pageId.get,
      pageReq.request.host))
  }

}

