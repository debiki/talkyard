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

  private def renderedPageKey(sitePageId: SitePageId, pageRenderParams: PageRenderParams) = {
    val pageId = sitePageId.pageId
    val mobile = if (pageRenderParams.widthLayout == WidthLayout.Tiny) "tny" else "med"
    val embedded = if (pageRenderParams.isEmbedded) "emb" else "dir"
    // Here the origin matters (don't use .remoteOriginOrEmpty) because it's used
    // in inline scripts [INLTAGORIG]. A change doesn't require a server restart (e.g. one might
    // might move one's site to a custom domain, at runtime), so need to incl in the key.
    val origin = pageRenderParams.origin
    val cdnOrigin = pageRenderParams.cdnOriginOrEmpty // could skip, change requires restart —> cache gone
    // Skip page query and page root. Won't cache, if they're not default, anyway. [5V7ZTL2]
    MemCacheKey(sitePageId.siteId, s"$pageId|$mobile|$embedded|$origin|$cdnOrigin|PageHtml")
  }
}


trait RenderedPageHtmlDao {
  self: SiteDao =>

  import play.api.Logger

  memCache.onPageCreated { _ =>
    uncacheForums(this.siteId)
  }

  memCache.onPageSaved { sitePageId =>
    uncacheAndRerenderPage(sitePageId)
    uncacheForums(sitePageId.siteId)   // [2F5HZM7]
  }


  private def loadPageFromDatabaseAndRender(pageRequest: PageRequest[_], renderParams: PageRenderParams)
        : RenderedPage = {
    if (!pageRequest.pageExists)
      throwNotFound("TyE00404", "Page not found")

    val pageId = pageRequest.thePageId

    globals.mostMetrics.getRenderPageTimer(pageRequest.pageRole).time {
      val jsonResult: PageToJsonResult = jsonMaker.pageToJson(pageId, renderParams)

      // This is the html for the topic and replies, i.e. the main content / interesting thing.
      val (cachedHtmlContent, cachedVersion) =
        renderContentMaybeUseDatabaseCache(
            pageId, renderParams, jsonResult.version, jsonResult.reactStoreJsonString)

      val tpi = new PageTpi(pageRequest, jsonResult.reactStoreJsonString, jsonResult.version,
        cachedHtmlContent, cachedVersion, jsonResult.pageTitle, jsonResult.customHeadTags,
        anyAltPageId = pageRequest.altPageId, anyEmbeddingUrl = pageRequest.embeddingUrl)

      // This is the html for the whole page: <html>, <head>, <body>, and <script>s,
      // and the html content.
      val pageHtml: String = views.html.templates.page(tpi).body

      RenderedPage(pageHtml, jsonResult.reactStoreJsonString, jsonResult.unapprovedPostAuthorIds)
    }
  }


  def renderPageMaybeUseMemCache(pageRequest: PageRequest[_]): RenderedPage = {
    // Bypass the cache if the page doesn't yet exist (it's being created),
    // because in the past there was some error because non-existing pages
    // had no ids (so feels safer to bypass).
    var useMemCache = pageRequest.pageExists
    useMemCache &= !pageRequest.debugStats
    useMemCache &= !pageRequest.bypassCache

    // When paginating forum topics in a non-Javascript client, we cannot use the cache. [5V7ZTL2]
    useMemCache &= pageRequest.parsePageQuery().isEmpty

    // If rendering the page starting at certain reply (instead of the orig post),
    // don't use the mem cache (which post to use as the root isn't incl in the cache key). [5V7ZTL2]
    useMemCache &= pageRequest.pageRoot.contains(PageParts.BodyNr)

    val renderParams = PageRenderParams(
      widthLayout = if (pageRequest.isMobile) WidthLayout.Tiny else WidthLayout.Medium,
      isEmbedded = pageRequest.embeddingUrl.nonEmpty,
      origin = pageRequest.origin,
      anyCdnOrigin = globals.anyCdnOrigin,
      anyPageRoot = pageRequest.pageRoot,
      anyPageQuery = pageRequest.parsePageQuery())

    if (!useMemCache)
      return loadPageFromDatabaseAndRender(pageRequest, renderParams)

    val key = renderedPageKey(pageRequest.theSitePageId, renderParams)
    val result = memCache.lookup(key,
      ifFound = {
        Logger.trace(s"s$siteId: Page found in mem cache: $key")
      },
      orCacheAndReturn = {
      Logger.trace(s"s$siteId: Page not in mem cache: $key")

      // Remember the server's origin, so we'll be able to uncache pages cached with this origin.
      // Could CLEAN_UP this later. Break out reusable fn? place in class MemCache?  [5KDKW2A]
      val originsKey = s"$siteId|origins"
      memCache.cache.asMap().merge(
        originsKey,
        MemCacheValueIgnoreVersion(Set(renderParams.origin)),
        new ju.function.BiFunction[DaoMemCacheAnyItem, DaoMemCacheAnyItem, DaoMemCacheAnyItem] () {
          def apply(oldValue: DaoMemCacheAnyItem, newValue: DaoMemCacheAnyItem): DaoMemCacheAnyItem = {
            val oldSet = oldValue.value.asInstanceOf[Set[String]]
            val newSet = newValue.value.asInstanceOf[Set[String]]
            if (newSet subsetOf oldSet) {
              oldValue
            }
            else {
              Logger.trace(s"s$siteId: Mem-Remembering origin: ${ newSet -- oldSet }")
              val origins = oldSet.toBuffer
              newSet.foreach(origins.append(_))
              MemCacheValueIgnoreVersion(origins.toSet)
            }
          }
        })

      if (pageRequest.thePageRole == PageRole.Forum) {
        Logger.trace(s"s$siteId: Mem-Remembering forum: ${pageRequest.thePageId}")
        rememberForum(pageRequest.thePageId)
      }

      // Here we might load and mem-cache actually stale html from the database. But if
      // loading stale html, we also enqueue the page to be rerendered in the background,
      // and once it's been rerendered, we update this mem cache. [7UWS21]
      Some(loadPageFromDatabaseAndRender(pageRequest, renderParams))
    },
      metric = globals.mostMetrics.renderPageCacheMetrics) getOrDie "DwE93IB7"

    result
  }


  private def renderContentMaybeUseDatabaseCache(pageId: PageId, renderParams: PageRenderParams,
        currentReactStoreJsonVersion: CachedPageVersion, currentReactStoreJsonString: String)
        : (String, CachedPageVersion) = {
    // COULD reuse the caller's transaction, but the caller currently uses > 1  :-(
    // Or could even do this outside any transaction.

    readOnlyTransaction { tx =>
      tx.loadCachedPageContentHtml(pageId, renderParams) foreach { case (cachedHtml, cachedHtmlVersion) =>

        def versionsString = o"""render params: $renderParams,
          db cache version: ${cachedHtmlVersion.computerString}
          current version: ${currentReactStoreJsonVersion.computerString}"""

        // Here we can compare hash sums of the up-to-date data and the data that was
        // used to generate the cached page. We ignore page version and site version.
        // Hash sums are always correct, so we'll never rerender unless we actually need to.
        if (cachedHtmlVersion.appVersion != currentReactStoreJsonVersion.appVersion ||
            cachedHtmlVersion.reactStoreJsonHash != currentReactStoreJsonVersion.reactStoreJsonHash) {
          // The browser will make cachedhtml up-to-date by running React.js with up-to-date
          // json, so it's okay to return cachedHtml. However, we'd rather send up-to-date
          // html, and this page is being accessed, so regenerate html. [4KGJW2]
          p.Logger.debug(o"""s$siteId: Page $pageId requested, db cache stale,
               will rerender soon, $versionsString [TyMRENDRSOON]""")
          // COULD wait 150 ms for the background thread to finish rendering the page?
          // Then timeout and return the old cached page.
          globals.renderPageContentInBackground(SitePageId(siteId, pageId), Some(
              PageRenderParamsAndHash(renderParams, currentReactStoreJsonVersion.reactStoreJsonHash)))
        }
        else {
          p.Logger.trace(o"""s$siteId: Page found in db cache, reusing: $pageId,
              $versionsString [TyMREUSEDB]""")
        }
        return (cachedHtml, cachedHtmlVersion)
      }
    }

    p.Logger.trace(o"""s$siteId: Page not in db cache: $pageId, rendering now..., version:
        ${currentReactStoreJsonVersion.computerString} [TyMRENDRNOW]""")

    // Now we'll have to render the page contents [5KWC58], so we have some html to send back
    // to the client, in case the client is a search engine bot — I suppose those
    // aren't happy with only up-to-date json (but no html) + running React.js.
    val newHtml = context.nashorn.renderPage(currentReactStoreJsonString) getOrElse throwInternalError(
      "TyE500RNDR", "Error rendering page")

    readWriteTransaction { tx =>
      tx.upsertCachedPageContentHtml(
          pageId, currentReactStoreJsonVersion, currentReactStoreJsonString, newHtml)
    }

    (newHtml, currentReactStoreJsonVersion)
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


  def removePageFromMemCache(sitePageId: SitePageId, pageRenderParams: Option[PageRenderParams] = None) {
    pageRenderParams foreach { params =>
      Logger.trace(s"Removing mem-cached page: ${sitePageId.toPrettyString}, $params [TyMMW20ZF4]...")
      memCache.remove(renderedPageKey(sitePageId, params))
      return
    }

    Logger.trace(
        s"Removing mem-cached page: ${sitePageId.toPrettyString}, all param combos [TyMJW2F72]...")

    forAllAccessedOrigins { origin =>
      removePageFromMemCacheForOrigin(origin, sitePageId)
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
    // Instead:  [7BWTWR2]
    globals.renderPageContentInBackground(sitePageId, customParams = None)

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
        val sitePageId = SitePageId(siteId, forumId)
        Logger.trace(s"Removing mem-cached forum page: ${sitePageId.toPrettyString}...")
        removePageFromMemCacheForOrigin(origin, sitePageId)
      }
      // Don't remove any database-cached html, see comment above. [6KP368]
    }
  }


  private def removePageFromMemCacheForOrigin(origin: String, sitePageId: SitePageId) {
    // Try uncache, for all combinations of embedded = true/false and page widths = tiny/medium
    // — we don't remember which requests we've gotten and what we've cached.

    // A bit dupl code. [2FKBJAL3]
    var renderParams = PageRenderParams(
      widthLayout = WidthLayout.Tiny,
      isEmbedded = false,
      origin = origin,
      // Changing cdn origin requires restart, then mem cache disappears. So ok reuse anyCdnOrigin here.
      anyCdnOrigin = globals.anyCdnOrigin,
      // Requests with custom page root or page query, aren't cached. [5V7ZTL2]
      anyPageRoot = None,
      anyPageQuery = None)

    memCache.remove(renderedPageKey(sitePageId, renderParams))

    renderParams = renderParams.copy(isEmbedded = true)
    memCache.remove(renderedPageKey(sitePageId, renderParams))

    renderParams = renderParams.copy(widthLayout = WidthLayout.Medium, isEmbedded = false)
    memCache.remove(renderedPageKey(sitePageId, renderParams))

    renderParams = renderParams.copy(isEmbedded = true)
    memCache.remove(renderedPageKey(sitePageId, renderParams))
  }

  private def forumsKey(siteId: SiteId) =
    MemCacheKey(siteId, "|ForumIds") // "|" is required by a debug check function

}

