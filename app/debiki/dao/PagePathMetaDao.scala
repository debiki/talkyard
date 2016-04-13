/**
 * Copyright (C) 2012 Kaj Magnus Lindberg (born 1979)
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
import java.{util => ju}
import CachingDao.CacheKey



trait PagePathMetaDao {
  self: SiteDao =>

  /*
  def movePages(pageIds: Seq[PageId], fromFolder: String, toFolder: String) =
    siteDbDao.movePages(pageIds, fromFolder = fromFolder, toFolder = toFolder)
    */


  def moveRenamePage(pageId: PageId, newFolder: Option[String] = None,
        showId: Option[Boolean] = None, newSlug: Option[String] = None)
        : PagePath =
    readWriteTransaction(_.moveRenamePage(pageId = pageId, newFolder = newFolder,
      showId = showId, newSlug = newSlug))


  def checkPagePath(pathToCheck: PagePath): Option[PagePath] =
    readOnlyTransaction(_.checkPagePath(pathToCheck))


  def lookupPagePath(pageId: PageId): Option[PagePath] =
    readOnlyTransaction(_.loadPagePath(pageId))


  def lookupPagePathAndRedirects(pageId: PageId): List[PagePath] =
    readOnlyTransaction(_.lookupPagePathAndRedirects(pageId))


  def loadPageMeta(pageId: PageId): Option[PageMeta] =
    readOnlyTransaction(_.loadPageMeta(pageId))


  // COULD override and use the page meta cache, but currently only called
  // by the moderation page, so not needed right now.
  def loadPageMetasAsMap(pageIds: Seq[PageId], anySiteId: Option[SiteId] = None)
        : Map[PageId, PageMeta] =
    readOnlyTransaction(_.loadPageMetasAsMap(pageIds, anySiteId))


  def loadPageMetaAndPath(pageId: PageId): Option[PagePathAndMeta] = {
    // I don't think writing a dedicated SQL query that does this in one
    // roundtrip is worth the trouble? Won't work with NoSQL databases anyway?
    val anyMeta = loadPageMeta(pageId)
    val anyPath = lookupPagePath(pageId)
    for (meta <- anyMeta; path <- anyPath)
      yield PagePathAndMeta(path, meta)
  }

}



trait CachingPagePathMetaDao extends PagePathMetaDao {
  self: CachingSiteDao =>


  /*
  @deprecated("Cannot fire page moved events?", since = "now")
  override def movePages(pageIds: Seq[String], fromFolder: String,
        toFolder: String) = {
    unimplemented("Firing page moved events")
    pageIds foreach (_removeCachedPathsTo _)
    super.movePages(pageIds, fromFolder = fromFolder, toFolder = toFolder)
  }*/


  onPageSaved { sitePageId =>
    uncacheMetaAndAncestors(sitePageId)
  }


  override def moveRenamePage(pageId: PageId, newFolder: Option[String] = None,
        showId: Option[Boolean] = None, newSlug: Option[String] = None)
        : PagePath = {
    _removeCachedPathsTo(pageId)

    val newPath = super.moveRenamePage(pageId = pageId, newFolder = newFolder,
      showId = showId, newSlug = newSlug)

    // I don't know how this could happen, but in case there's already an
    // entry that maps `newPath` to something, remove it.
    removeFromCache(_pathWithIdByPathKey(newPath))

    firePageMoved(newPath)
    newPath
  }


  override def checkPagePath(pathToCheck: PagePath): Option[PagePath] = {
    val key = _pathWithIdByPathKey(pathToCheck)
    lookupInCache[PagePath](key) foreach { path =>
      return Some(path)
    }
    val siteCacheVersion = siteCacheVersionNow()
    super.checkPagePath(pathToCheck) map { correctPath =>
      // Don't cache non-exact paths if page id shown, since there are
      // infinitely many such paths.
      // Performance, caching: COULD let checkPagePath() clarify whether
      // pathToCheck was actually found in the database (in DW1_PAGE_PATHS),
      // and cache it, if found, regardless of if id shown in url.
      // Or better & much simpler: Cache SitePageId —> correctPath.
      if (!pathToCheck.showId || correctPath.value == pathToCheck.value)
        putInCache(key, CacheValue(correctPath, siteCacheVersion))
      return Some(correctPath)
    }
    None
  }


  override def lookupPagePath(pageId: PageId): Option[PagePath] =
    lookupInCache(
      _pathByPageIdKey(pageId),
      orCacheAndReturn =
        super.lookupPagePath(pageId = pageId))


  private def _removeCachedPathsTo(pageId: PageId) {
    // Remove cache entries from id to path,
    // and from a browser's specified path to the correct path with id.
    super.lookupPagePath(pageId) foreach { oldPath =>
      removeFromCache(_pathWithIdByPathKey(oldPath))
      removeFromCache(_pathByPageIdKey(pageId))
    }

    // ---- Obsolete comment:
    // Could also remove paths similar to `oldPath` but with a trailing
    // slash added or removed, because `checkPagePath` might have
    // remembered that e.g. /-pageid maps to `oldPath`.
    // Could also remove any /-pageid path.
    // This feels rather unimporant though.
    // The effect should be that incorrect page paths might return
    // 404 Not Found until the server has been restarted?
    // ----
  }


  override def loadPageMeta(pageId: PageId): Option[PageMeta] =
    lookupInCache[PageMeta](
      pageMetaByIdKey(SitePageId(siteId, pageId)),
      orCacheAndReturn = super.loadPageMeta(pageId))


  private def uncacheMetaAndAncestors(sitePageId: SitePageId) {
    removeFromCache(ancestorIdsKey(sitePageId))
    removeFromCache(pageMetaByIdKey(sitePageId))
  }


  // Might be a page from another site. (For example, we might be looking up
  // an URL to find which page to include in an asset bundle — the page
  // could be a public stylesheet from e.g. www.debik.com.)
  private def _pathWithIdByPathKey(pagePath: PagePath) =
    CacheKey(pagePath.siteId, s"${pagePath.value}|PagePathByPath")

  private def _pathByPageIdKey(pageId: PageId) =
    CacheKey(siteId, s"$pageId|PagePathById")

  private def pageMetaByIdKey(sitePageId: SitePageId) =
    CacheKey(sitePageId.siteId, s"${sitePageId.pageId}|PageMetaById")

  private def ancestorIdsKey(sitePageId: SitePageId) =
    CacheKey(sitePageId.siteId, s"${sitePageId.pageId}|AncestorIdsById")

}

