/**
 * Copyright (c) 2011-2012 Kaj Magnus Lindberg (born 1979)
 */

package debiki

import com.debiki.v0.Prelude._
import com.google.{common => guava}
import java.{util => ju}
import net.liftweb.{util => lu}
import scala.xml.NodeSeq
import net.liftweb.common._
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
class PageCache(val dao: Dao) {

  private val _pageCache: ju.concurrent.ConcurrentMap[Key, NodeSeq] =
    new guava.collect.MapMaker().
       softValues().
       maximumSize(100*1000).
       //expireAfterWrite(10. TimeUnits.MINUTES).
       makeComputingMap(new guava.base.Function[Key, NodeSeq] {
      def apply(k: Key): NodeSeq =
        _loadAndRender(k, PageRoot.TheBody)
    })

  private def _loadAndRender(k: Key, pageRoot: PageRoot): NodeSeq = {
    dao.loadPage(k.tenantId, k.pageGuid) match {
      case Full(debate) =>
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
          xml.Unparsed(lu.Html5.toString(html))
        }
      case Empty =>
        // Page missing. Should have been noticed during access control.
        assErr("DwE35eQ20", "Page "+ safed(k.pageGuid) +" not found")
      case f: Failure =>
        runErr("DwE8kN3", "Error loading page "+ safed(k.pageGuid) +":\n"+ f)
    }
  }

  def get(tenantId: String, pageGuid: String, hostAndPort: String,
          pageRoot: PageRoot): NodeSeq = {
    try {
      val config = DebikiHttp.newUrlConfig(hostAndPort)
      // The dialog templates includes the user name and cannot currently
      // be cached.
      val templates =
        FormHtml(config, pageRoot,
          PermsOnPage.None // for now TODO
          ).dialogTemplates
      pageRoot match {
        case PageRoot.Real(Page.BodyId) =>
          // The page (with the article and all comments) includes nothing user
          // specific and can thus be cached.
          val page = _pageCache.get(Key(tenantId, pageGuid, hostAndPort))
          page ++ templates

        case x =>
          // The cache currently works only for the page body as page root.
          _loadAndRender(Key(tenantId, pageGuid, hostAndPort), x) ++
             templates
      }
    } catch {
      case e: NullPointerException =>
        assErr("DwE091k5J83", "Page "+ safed(pageGuid) +" not found")
    }
  }

  def refreshLater(tenantId: String, pageGuid: String) {
    // For now, simply drop the cache entry.
    // COULD send a message to an actor that refreshes the page later.
    // Then the caller won't have to wait.
    // BUG only clears the cache for the current host and port
    // (problems e.g. if you use localhost:8080 and <ip>:8080).
    _pageCache.remove(Key(tenantId, pageGuid,
      "hostAndPort_read-from-session-in-some-manner"))
  }

}
