/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package debiki

import com.debiki.v0._
import java.{util => ju}
import Prelude._


trait PagePathDao {
  self: TenantDao =>


  def movePages(pageIds: Seq[String], fromFolder: String, toFolder: String) =
    tenantDbDao.movePages(pageIds, fromFolder = fromFolder, toFolder = toFolder)


  def moveRenamePage(pageId: String, newFolder: Option[String] = None,
        showId: Option[Boolean] = None, newSlug: Option[String] = None)
        : PagePath =
    tenantDbDao.moveRenamePage(pageId = pageId, newFolder = newFolder,
      showId = showId, newSlug = newSlug)


  def movePageToItsPreviousLocation(pagePath: PagePath): Option[PagePath] = {
    tenantDbDao.movePageToItsPreviousLocation(pagePath)
  }


  def checkPagePath(pathToCheck: PagePath): Option[PagePath] =
    tenantDbDao.checkPagePath(pathToCheck)


  def lookupPagePath(pageId: String): Option[PagePath] =
    tenantDbDao.lookupPagePath(pageId = pageId)


  def lookupPagePathAndRedirects(pageId: String): List[PagePath] =
    tenantDbDao.lookupPagePathAndRedirects(pageId)


  def loadPageMeta(pageId: String): Option[PageMeta] =
    tenantDbDao.loadPageMeta(pageId)

}



trait CachingPagePathDao extends PagePathDao {
  self: CachingTenantDao =>


  override def movePages(pageIds: Seq[String], fromFolder: String,
        toFolder: String) = {
    pageIds foreach (_removeCachedPathsTo _)
    super.movePages(pageIds, fromFolder = fromFolder, toFolder = toFolder)
  }


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


  override def checkPagePath(pathToCheck: PagePath): Option[PagePath] = {
    val key = _pathWithIdByPathKey(pathToCheck)
    lookupInCache[PagePath](key) foreach { path =>
      return Some(path)
    }
    super.checkPagePath(pathToCheck) map { correctPath =>
      // Only cache correct paths, since there are infinitely many incorrect
      // paths that map to `correctPath`, if page id included in path.
      if (correctPath.path == pathToCheck.path)
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


  /**
   * There's currently no way to programmatically change page meta info
   * (parent page id and page role), so need not remove page meta entries
   * from cache.
   */
  override def loadPageMeta(pageId: String): Option[PageMeta] =
    lookupInCache[PageMeta](
      pageMetaByIdKey(pageId),
      orCacheAndReturn = super.loadPageMeta(pageId))


  def uncachePageMeta(pageId: String) {
    removeFromCache(pageMetaByIdKey(pageId))
  }


  private def _pathWithIdByPathKey(pagePath: PagePath) =
    s"$tenantId|${pagePath.path}|PagePathByPath"


  private def _pathByPageIdKey(pageId: String) =
    s"$tenantId|$pageId|PagePathById"


  private def pageMetaByIdKey(pageId: String) =
    s"$tenantId|$pageId|PageMetaById"

}

