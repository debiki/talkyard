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

package debiki.dao

import com.debiki.core._
import com.debiki.core.Prelude._
import debiki._
import debiki.EdHttp.{throwInternalError, throwNotFound}
import ed.server.http.PageRequest
import play.{api => p}
import RenderedPageHtmlDao._
import ed.server.RenderedPage
import java.{util => ju}
import scala.collection.mutable


object RenderedPageHtmlDao {

  /** The server origin is included in the inline javascript — needed
    * when rendering server side.
    * (Hmm, it isn't ever included in generated html links? If it is, should cache
    * PageStuff by origin too [5JKWBP2], and the html in the database, page_html3.)
    *
    * The same page might be requested via different origins, if one moves a site
    * to a new address: some browser will continue using the old address, whilst the move
    * is in progress. (And if not cached, then that'd open for a DoS attack they could do.)
    * And also when testing on localhost. Or accessing via https://site-X.basedomain.com.
    */
  private def renderedPageKey(sitePageId: SitePageId, origin: String) =
    MemCacheKey(sitePageId.siteId, s"${sitePageId.pageId}|$origin|PageHtml")

}


trait RenderedPageHtmlDao {
  self: SiteDao =>


  memCache.onPageCreated { _ =>
    uncacheForums(this.siteId)
  }

  memCache.onPageSaved { sitePageId =>
    uncacheAndRerenderPage(sitePageId)
    uncacheForums(sitePageId.siteId)
  }


  private def loadPageFromDatabaseAndRender(pageRequest: PageRequest[_]): RenderedPage = {
    if (!pageRequest.pageExists)
      throwNotFound("EdE00404", "Page not found")

    globals.mostMetrics.getRenderPageTimer(pageRequest.pageRole).time {
      val anyPageQuery = pageRequest.parsePageQuery()
      val anyPageRoot = pageRequest.pageRoot

      val renderResult: PageToJsonResult =
        jsonMaker.pageToJson(pageRequest.thePageId, anyPageRoot, anyPageQuery)

      val (cachedHtml, cachedVersion) =
        renderContent(pageRequest.thePageId, renderResult.version, renderResult.jsonString)

      val tpi = new PageTpi(pageRequest, renderResult.jsonString, renderResult.version,
        cachedHtml, cachedVersion, renderResult.pageTitle, renderResult.customHeadTags,
        anyAltPageId = pageRequest.altPageId, anyEmbeddingUrl = pageRequest.embeddingUrl)

      val pageHtml: String = views.html.templates.page(tpi).body

      RenderedPage(pageHtml, renderResult.jsonString, renderResult.unapprovedPostAuthorIds)
    }
  }


  def renderPageMaybeUseCache(pageReq: PageRequest[_]): RenderedPage = {
    // Bypass the cache if the page doesn't yet exist (it's being created),
    // because in the past there was some error because non-existing pages
    // had no ids (so feels safer to bypass).
    var useMemCache = pageReq.pageExists
    useMemCache &= pageReq.pageRoot.contains(PageParts.BodyNr)
    useMemCache &= !pageReq.debugStats
    useMemCache &= !pageReq.bypassCache

    // When paginating forum topics in a non-Javascript client, we cannot use the cache.
    useMemCache &= pageReq.parsePageQuery().isEmpty

    if (!useMemCache)
      return loadPageFromDatabaseAndRender(pageReq)

    val key = renderedPageKey(pageReq.theSitePageId, pageReq.origin)
    memCache.lookup(key, orCacheAndReturn = {
      // Remember the server's origin, so we'll be able to uncache pages cached with this origin.
      // Could CLEAN_UP this later. Break out reusable fn? place in class MemCache?  [5KDKW2A]
      val originsKey = s"$siteId|origins"
      memCache.cache.asMap().merge(
        originsKey,
        MemCacheValueIgnoreVersion(Set(pageReq.origin)),
        new ju.function.BiFunction[DaoMemCacheAnyItem, DaoMemCacheAnyItem, DaoMemCacheAnyItem] () {
          def apply(oldValue: DaoMemCacheAnyItem, newValue: DaoMemCacheAnyItem): DaoMemCacheAnyItem = {
            val oldSet = oldValue.value.asInstanceOf[Set[String]]
            val newSet = newValue.value.asInstanceOf[Set[String]]
            if (newSet subsetOf oldSet) {
              oldValue
            }
            else {
              val origins = oldSet.toBuffer
              newSet.foreach(origins.append(_))
              MemCacheValueIgnoreVersion(origins.toSet)
            }
          }
        })

      if (pageReq.thePageRole == PageRole.Forum) {
        rememberForum(pageReq.thePageId)
      }
      // Here we might load and mem-cache actually stale html from the database. But if
      // loading stale html, we also enqueue the page to be rerendered in the background,
      // and once it's been rerendered, we update this mem cache. [7UWS21]
      Some(loadPageFromDatabaseAndRender(pageReq))
    }, metric = globals.mostMetrics.renderPageCacheMetrics) getOrDie "DwE93IB7"
  }


  private def renderContent(pageId: PageId, currentJsonVersion: CachedPageVersion,
        reactStore: String): (String, CachedPageVersion) = {
    // COULD reuse the caller's transaction, but the caller currently uses > 1  :-(
    // Or could even do this outside any transaction.
    readOnlyTransaction { transaction =>
      transaction.loadCachedPageContentHtml(pageId) foreach { case (cachedHtml, cachedHtmlVersion) =>
        // Here we can compare hash sums of the up-to-date data and the data that was
        // used to generate the cached page. We ignore page version and site version.
        // Hash sums are always correct, so we'll never rerender unless we actually need to.
        if (cachedHtmlVersion.appVersion != currentJsonVersion.appVersion ||
            cachedHtmlVersion.reactStoreJsonHash != currentJsonVersion.reactStoreJsonHash) {
          // The browser will make cachedhtml up-to-date by running React.js with up-to-date
          // json, so it's okay to return cachedHtml. However, we'd rather send up-to-date
          // html, and this page is being accessed, so regenerate html. [4KGJW2]
          p.Logger.debug(o"""Page $pageId site $siteId is accessed and out-of-date,
               sending rerender-in-background message [DwE5KGF2]""")
          // COULD wait 150 ms for the background thread to finish rendering the page?
          // Then timeout and return the old cached page.
          globals.renderPageContentInBackground(SitePageId(siteId, pageId))
        }
        return (cachedHtml, cachedHtmlVersion)
      }
    }

    // Now we'll have to render the page contents [5KWC58], so we have some html to send back
    // to the client, in case the client is a search engine bot — I suppose those
    // aren't happy with only up-to-date json (but no html) + running React.js.
    val newHtml = context.nashorn.renderPage(reactStore) getOrElse throwInternalError(
      "DwE500RNDR", "Error rendering page")

    readWriteTransaction { transaction =>
      transaction.saveCachedPageContentHtmlPerhapsBreakTransaction(
        pageId, currentJsonVersion, newHtml)
    }
    (newHtml, currentJsonVersion)
  }


  private def rememberForum(forumPageId: PageId) {
    // COULD Use ConcurrentMap.merge(k, v, remappingFunction) instead? Maybe break out fn? [5KDKW2A]
    var done = false
    do {
      val key = this.forumsKey(siteId)
      memCache.lookup[List[PageId]](key) match {
        case None =>
          done = memCache.putIfAbsent(key, MemCacheValueIgnoreVersion(List(forumPageId)))
        case Some(cachedForumIds) =>
          if (cachedForumIds contains forumPageId)
            return
          val newForumIds = forumPageId :: cachedForumIds
          done = memCache.replace(key, MemCacheValueIgnoreVersion(cachedForumIds),
            newValue = MemCacheValueIgnoreVersion(newForumIds))
      }
    }
    while (!done)
  }


  private def forAllAccessedOrigins(fn: (String) => Unit): Unit = {
    var origins = memCache.lookup[Set[String]](MemCacheKey(siteId, "origins")) getOrElse Set.empty
    origins foreach fn
  }


  def removePageFromMemCache(sitePageId: SitePageId) {
    forAllAccessedOrigins { origin =>
      memCache.remove(renderedPageKey(sitePageId, origin))
    }
  }


  private def uncacheAndRerenderPage(sitePageId: SitePageId) {
    removePageFromMemCache(sitePageId)

    // Don't remove the database-cached rendered html, because it takes long to regenerate. [6KP368]
    // Instead, send old stale cached content html to the browsers,
    // and they'll make it up-to-date when they render the React json client side
    // (we do send up-to-date json, always). — After a short while, some background
    // threads will have regenerated the content and updated the cache, and then
    // the browsers will get up-to-date html again.
    // So don't:
    //    removeFromCache(contentKey(sitePageId))
    // Instead:
    globals.renderPageContentInBackground(sitePageId)

    // BUG race condition: What if anotoher thread started rendering a page
    // just before the invokation of this function, and is finished
    // just after we've cleared the cache? Then that other thread will insert
    // a stale cache item. Could fix, by verifying that when you cache
    // something, the current version of the page is the same as the page
    // version when you started generating the cache value (e.g. started
    // rendering a page).
  }


  /** Forums list other pages sorted by modification time, so whenever any
    * page is modified, it's likely that a forum page should be rerendered.
    * Also, if a new category is added, the parent forum should be rerendered.
    * For simplicity, we here uncache all forums.
    */
  private def uncacheForums(siteId: SiteId) {
    val forumIds = memCache.lookup[List[String]](forumsKey(siteId)) getOrElse Nil
    forAllAccessedOrigins { origin =>
      forumIds foreach { forumId =>
        memCache.remove(renderedPageKey(SitePageId(siteId, forumId), origin))
      }
      // Don't remove any database-cached html, see comment above. [6KP368]
    }
  }


  private def forumsKey(siteId: SiteId) =
    MemCacheKey(siteId, "|ForumIds") // "|" is required by a debug check function

}

