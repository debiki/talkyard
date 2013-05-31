/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package debiki

import com.debiki.v0._
import controllers.SiteAssetBundles
import java.{util => ju}
import Prelude._
import CachingAssetBundleDao._


case class AssetBundle(body: String, version: String)


trait AssetBundleDao {
  self: TenantDao =>


  final def loadAssetBundleVersion(
        bundleNameNoSuffix: String, bundleSuffix: String): String =
    loadBundleAndDependencies(bundleNameNoSuffix, bundleSuffix).version


  final def loadAssetBundle(nameNoSuffix: String, suffix: String): AssetBundle = {
    val bundleAndDeps = loadBundleAndDependencies(nameNoSuffix, suffix)
    AssetBundle(bundleAndDeps.assetBundleText, version = bundleAndDeps.version)
  }


  protected def loadBundleAndDependencies(nameNoSuffix: String, suffix: String)
      : AssetBundleAndDependencies =
    AssetBundleLoader(nameNoSuffix, suffix, this).loadAssetBundle()

}



trait CachingAssetBundleDao extends AssetBundleDao {
  self: TenantDao with CachingDao =>

  onPageCreated { page =>
    tryUncacheAll(
      makeSitePathDependencyKey(page.siteId, path = page.path.path))
  }

  onPageSaved { sitePageId =>
    tryUncacheAll(
      makeDependencyKey(sitePageId))
  }

  onPageMoved { (newPath: PagePath) =>
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


  protected override def loadBundleAndDependencies(nameNoSuffix: String, suffix: String)
      : AssetBundleAndDependencies = {
    val bundleName = s"$nameNoSuffix.$suffix"
    val bundleKey = makeBundleKey(bundleName, tenantId = tenantId)
    val cachedBundleAndDeps = lookupInCache[AssetBundleAndDependencies](bundleKey)
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

    val bundleAndDeps = super.loadBundleAndDependencies(nameNoSuffix, suffix)
    cacheDependencies(bundleName, bundleAndDeps)
    putInCache(bundleKey, bundleAndDeps)

    bundleAndDeps
  }


  /**
   * Caches 1) which pages the bundle depends on, so it can be uncached,
   * should any of the dependencies change. And 2) which non-existing optional
   * assets the bundle depends on, so the bundle can be regenerated if any
   * of those assets is created later on.
   */
  private def cacheDependencies(
        bundleName: String, bundleAndDeps: AssetBundleAndDependencies) {
    val bundleDeps = BundleDependencyData(bundleName, bundleAndDeps, siteId = siteId)
    for (sitePageId <- bundleDeps.dependeePageIds) {
      val depKey = makeDependencyKey(sitePageId)
      putInCache(depKey, bundleDeps)
    }

    for (sitePath <- bundleDeps.missingOptAssetPaths) {
      val depKey = makeSitePathDependencyKey(sitePath)
      putInCache(depKey, bundleDeps)
    }
  }


  private def tryUncacheAll(dependencyKey: String) {
    lookupInCache[BundleDependencyData](dependencyKey) foreach { depsData =>
      doUncacheAll(depsData)
    }
  }


  private def doUncacheAll(bundleDeps: BundleDependencyData) {
    // First uncache dependencies. Then uncache bundle.
    // (If you uncache the bundle first, another thread might start to regenerate
    // it and cache dependencies, whilst you're still busy uncaching the mostly
    // same dependencies!)

    for (depSitePageIds <- bundleDeps.dependeePageIds) {
      removeFromCache(
        makeDependencyKey(depSitePageIds))
    }

    for (depSitePath <- bundleDeps.missingOptAssetPaths) {
      removeFromCache(
        makeSitePathDependencyKey(depSitePath))
    }

    removeFromCache(
      makeBundleKey(
        bundleDeps.bundleName, tenantId = bundleDeps.siteId))
  }


  private def makeBundleKey(bundleName: String, tenantId: String) =
    s"$tenantId|$bundleName|AssetBundle"

  private def makeDependencyKey(sitePageId: SitePageId) =
    s"${sitePageId.siteId}|${sitePageId.pageId}|BundleSitePageIdDep"

  private def makeSitePathDependencyKey(siteId: String, path: String): String =
    s"$siteId|$path|BundleSitePathDep"

  private def makeSitePathDependencyKey(sitePath: SitePath): String =
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
