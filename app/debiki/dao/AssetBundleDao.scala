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
import debiki._
import java.{util => ju}
import CachingAssetBundleDao._


case class AssetBundle(body: String, version: String)


/** BUG if server running and you edit the _stylesheet page, and update it, this has no
  * effect, until you restart the server. But if the page exists when the server is stated,
  * updates do refresh the cache. Fix this by listening for changes of page SiteCssPageId only?
  */
trait AssetBundleDao {
  self: SiteDao =>


  def getAssetBundleVersion(bundleNameNoSuffix: String, bundleSuffix: String): String =
    getBundleAndDependencies(bundleNameNoSuffix, bundleSuffix).version


  def getAssetBundle(nameNoSuffix: String, suffix: String): AssetBundle = {
    val bundleAndDeps = getBundleAndDependencies(nameNoSuffix, suffix)
    AssetBundle(bundleAndDeps.assetBundleText, version = bundleAndDeps.version)
  }


  memCache.onPageCreated { pagePath =>
    tryUncacheAll(
      makeSitePathDependencyKey(pagePath.siteId, path = pagePath.value))
  }

  memCache.onPageSaved { sitePageId =>
    tryUncacheAll(
      makeDependencyKey(sitePageId))
  }

  memCache.onPageMoved { (newPath: PagePath) =>
    tryUncacheAll(
      makeDependencyKey(newPath.sitePageId getOrDie "DwE54BI3"))
  }

  // Somewhat unimportant?, but:
  // Could add: onPageCreated { ... }, onWebsiteCreated { ... },
  // so that a broken bundle will be fixed when a missing asset is created,
  // or even when a missing website is created. Currently, any previously
  // broken and cached bundle, but that is now in fact okay, is only fixed
  // on server restart.
  // Could add, when that functionality exists: onGroupPermissionsChanged { ... }


  private def getBundleAndDependencies(nameNoSuffix: String, suffix: String)
      : AssetBundleAndDependencies = {
    val bundleName = s"$nameNoSuffix.$suffix"
    val bundleKey = makeBundleKey(bundleName, tenantId = siteId)
    val cachedBundleAndDeps = memCache.lookup[AssetBundleAndDependencies](bundleKey)
    if (cachedBundleAndDeps.isDefined)
      return cachedBundleAndDeps.get

    // Concerning race conditions: There should be none (but there are, currently).
    // Consider these there cases:
    // We could be 1) be loading a bundle of behalf of a *published*
    // version of the website, and a published version can never change
    // (in the same manner as the contents of a Git commit can never change).
    // Or we could be loading 2) a published *test* version, that is later to
    // be promoted to the current active version. Such a test version is
    // also frozen, like a Git commit. Or 3) we could be loading
    // assets on behalf of a developer's / an admin's "local" test version.
    // But only the developer or the admin, and no one else, should have
    // access to that version.
    // — In no case will race conditions be an issue.
    //
    // However right now I haven't implemented website versioning.
    // So there are race conditions. If many people modify asset definitions,
    // and move or edit asset files, at the same time, corrupt asset bundles
    // might be generated, and they might last until the _site.conf file
    // is edited and saved (or until the server is restarted).
    //
    // Website versioning would include all files with a '.' in their name.
    // E.g. _site.conf, some-script.js, some-style.css, some-template.tpl.
    // But not blog posts or the homepage or other "normal pages".

    val siteCacheVersion = memCache.siteCacheVersionNow()
    val bundleAndDeps = AssetBundleLoader(nameNoSuffix, suffix, this).loadAssetBundle()
    cacheDependencies(bundleName, bundleAndDeps, siteCacheVersion)
    memCache.put(bundleKey, MemCacheItem(bundleAndDeps, siteCacheVersion))

    bundleAndDeps
  }


  /**
   * Caches 1) which pages the bundle depends on, so it can be uncached,
   * should any of the dependencies change. And 2) which non-existing optional
   * assets the bundle depends on, so the bundle can be regenerated if any
   * of those assets is created later on.
   */
  private def cacheDependencies(
        bundleName: String, bundleAndDeps: AssetBundleAndDependencies, siteCacheVersion: Long) {
    val bundleDeps = BundleDependencyData(bundleName, bundleAndDeps, siteId = siteId)
    for (sitePageId <- bundleDeps.dependeePageIds) {
      val depKey = makeDependencyKey(sitePageId)
      memCache.put(depKey, MemCacheItem(bundleDeps, siteCacheVersion))
    }

    for (sitePath <- bundleDeps.missingOptAssetPaths) {
      val depKey = makeSitePathDependencyKey(sitePath)
      memCache.put(depKey, MemCacheItem(bundleDeps, siteCacheVersion))
    }
  }


  private def tryUncacheAll(dependencyKey: MemCacheKey) {
    memCache.lookup[BundleDependencyData](dependencyKey) foreach { depsData =>
      doUncacheAll(depsData)
    }
  }


  private def doUncacheAll(bundleDeps: BundleDependencyData) {
    // First uncache dependencies. Then uncache bundle.
    // (If you uncache the bundle first, another thread might start to regenerate
    // it and cache dependencies, whilst you're still busy uncaching the mostly
    // same dependencies!)

    for (depSitePageIds <- bundleDeps.dependeePageIds) {
      memCache.remove(
        makeDependencyKey(depSitePageIds))
    }

    for (depSitePath <- bundleDeps.missingOptAssetPaths) {
      memCache.remove(
        makeSitePathDependencyKey(depSitePath))
    }

    memCache.remove(
      makeBundleKey(
        bundleDeps.bundleName, tenantId = bundleDeps.siteId))
  }


  private def makeBundleKey(bundleName: String, tenantId: String) =
    MemCacheKey(siteId, s"$bundleName|AssetBundle")

  private def makeDependencyKey(sitePageId: SitePageId) =
    MemCacheKey(sitePageId.siteId, s"${sitePageId.pageId}|BundleSitePageIdDep")

  private def makeSitePathDependencyKey(siteId: String, path: String): MemCacheKey =
    MemCacheKey(siteId, s"$path|BundleSitePathDep")

  private def makeSitePathDependencyKey(sitePath: SitePath): MemCacheKey =
    makeSitePathDependencyKey(sitePath.siteId, path = sitePath.path)

}



object CachingAssetBundleDao {

  class BundleDependencyData(
    val siteId: String,
    val bundleName: String,
    val dependeePageIds: List[SitePageId],
    val missingOptAssetPaths: List[SitePath])

  case object BundleDependencyData {
    def apply(
          bundleName: String,
          bundleAndDeps: AssetBundleAndDependencies,
          siteId: String): BundleDependencyData = {
      new BundleDependencyData(
        siteId = siteId,
        bundleName = bundleName,
        dependeePageIds =
          bundleAndDeps.configPageIds.toList ::: bundleAndDeps.assetPageIds.toList,
        missingOptAssetPaths = bundleAndDeps.missingOptAssetPaths.toList)
    }
  }

}
