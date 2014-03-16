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
import java.{util => ju}
import Prelude._


trait PagePathMetaDao {
  self: SiteDao =>

  /*
  def movePages(pageIds: Seq[String], fromFolder: String, toFolder: String) =
    siteDbDao.movePages(pageIds, fromFolder = fromFolder, toFolder = toFolder)
    */


  def moveRenamePage(pageId: String, newFolder: Option[String] = None,
        showId: Option[Boolean] = None, newSlug: Option[String] = None)
        : PagePath =
    siteDbDao.moveRenamePage(pageId = pageId, newFolder = newFolder,
      showId = showId, newSlug = newSlug)


  def movePageToItsPreviousLocation(pagePath: PagePath): Option[PagePath] = {
    siteDbDao.movePageToItsPreviousLocation(pagePath)
  }


  def checkPagePath(pathToCheck: PagePath): Option[PagePath] =
    siteDbDao.checkPagePath(pathToCheck)


  def lookupPagePath(pageId: String): Option[PagePath] =
    siteDbDao.lookupPagePath(pageId = pageId)


  def lookupPagePathAndRedirects(pageId: String): List[PagePath] =
    siteDbDao.lookupPagePathAndRedirects(pageId)


  def loadPageMeta(pageId: String): Option[PageMeta] =
    siteDbDao.loadPageMeta(pageId)


  def loadAncestorIdsParentFirst(pageId: PageId): List[PageId] =
    siteDbDao.loadAncestorIdsParentFirst(pageId)


  def loadPageMetaAndPath(pageId: String): Option[PagePathAndMeta] = {
    // I don't think writing a dedicated SQL query that does this in one
    // roundtrip is worth the trouble? Won't work with NoSQL databases anyway?
    val anyMeta = loadPageMeta(pageId)
    val ancestorIds = loadAncestorIdsParentFirst(pageId)
    val anyPath = lookupPagePath(pageId)
    for (meta <- anyMeta; path <- anyPath)
      yield PagePathAndMeta(path, ancestorIds, meta)
  }


  def updatePageMeta(meta: PageMeta, old: PageMeta) =
    siteDbDao.updatePageMeta(meta, old = old)


  /**
   * Returns a list like: grandparent-meta :: parent-meta :: meta-for-pageId :: Nil
   */
  final def listAncestorsAndOwnMeta(pageId: String): List[(PagePath, PageMeta)] = {
    var curPageMeta = loadPageMeta(pageId)
    var curPagePath = lookupPagePath(pageId)
    var result: List[(PagePath, PageMeta)] = Nil

    while (curPageMeta.isDefined && curPagePath.isDefined) {
      result ::= (curPagePath.get, curPageMeta.get)
      val parentId = curPageMeta.get.parentPageId
      curPageMeta = parentId.flatMap(loadPageMeta _)
      curPagePath = parentId.flatMap(lookupPagePath _)
    }

    result
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


  override def moveRenamePage(pageId: String, newFolder: Option[String] = None,
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


  override def movePageToItsPreviousLocation(pagePath: PagePath): Option[PagePath] = {
    require(pagePath.tenantId == siteId)
    val restoredPath = super.movePageToItsPreviousLocation(pagePath)
    restoredPath foreach { path =>
      _removeCachedPathsTo(path.pageId.get)
      firePageMoved(path)
    }
    restoredPath
  }


  override def checkPagePath(pathToCheck: PagePath): Option[PagePath] = {
    val key = _pathWithIdByPathKey(pathToCheck)
    lookupInCache[PagePath](key) foreach { path =>
      return Some(path)
    }
    super.checkPagePath(pathToCheck) map { correctPath =>
      // Don't cache non-exact paths if page id shown, since there are
      // infinitely many such paths.
      // Performance, caching: COULD let checkPagePath() clarify whether
      // pathToCheck was actually found in the database (in DW1_PAGE_PATHS),
      // and cache it, if found, regardless of if id shown in url.
      // Or better & much simpler: Cache SitePageId —> correctPath.
      if (!pathToCheck.showId || correctPath.path == pathToCheck.path)
        putInCache(key, correctPath)
      return Some(correctPath)
    }
    None
  }


  override def lookupPagePath(pageId: String): Option[PagePath] =
    lookupInCache(
      _pathByPageIdKey(pageId),
      orCacheAndReturn =
        super.lookupPagePath(pageId = pageId))


  private def _removeCachedPathsTo(pageId: String) {
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


  override def loadPageMeta(pageId: String): Option[PageMeta] =
    lookupInCache[PageMeta](
      pageMetaByIdKey(pageId),
      orCacheAndReturn = super.loadPageMeta(pageId))


  override def loadAncestorIdsParentFirst(pageId: PageId): List[PageId] = {
    // [freshcache] SHOULD discard cached values older than a certain whole-site-invalidation value.
    lookupInCache(
      ancestorIdsByIdKey(pageId),
      orCacheAndReturn = Some(super.loadAncestorIdsParentFirst(pageId))) getOrDie "DwE4GLi6"
  }


  override def updatePageMeta(meta: PageMeta, old: PageMeta) {
    // BUG SHOULD uncache meta for old and new parent page too,
    // if this page changes parent page?
    uncachePageMeta(meta.pageId)
    super.updatePageMeta(meta, old = old)
  }


  def uncachePageMeta(pageId: String) {
    removeFromCache(pageMetaByIdKey(pageId))
  }


  // Might be a page from another site. (For example, we might be looking up
  // an URL to find which page to include in an asset bundle — the page
  // could be a public stylesheet from e.g. www.debik.com.)
  private def _pathWithIdByPathKey(pagePath: PagePath) =
    s"${pagePath.tenantId}|${pagePath.path}|PagePathByPath"

  private def _pathByPageIdKey(pageId: String) =
    s"$siteId|$pageId|PagePathById"

  private def pageMetaByIdKey(pageId: String) =
    s"$siteId|$pageId|PageMetaById"

  private def ancestorIdsByIdKey(pageId: PageId) =
    s"$siteId|$pageId|AncestorIdsById"

}

