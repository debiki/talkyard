/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package debiki

import com.debiki.v0._
import controllers.SiteAssetBundles
import java.{util => ju}
import Prelude._
import SiteAssetBundles.{AssetBundleNameRegex, assetBundleFileName}



trait AssetBundleDao {
  self: TenantDao =>


  def loadAssetBundleFileName(bundleName: String): String = {
    bundleName match {
      case AssetBundleNameRegex(nameNoSuffix, suffix) =>
        val assetBundleText =
          AssetBundleLoader.loadAssetBundle(nameNoSuffix, suffix, this)
        val version = hashSha1Base64UrlSafe(assetBundleText)
        assetBundleFileName(nameNoSuffix, version, suffix)
      case _ =>
        throw new TemplateRenderer.BadTemplateException(
          "DwE13BKf8", o"""Bad assets bundle: $bundleName,
            should be like: some-bundle-name.css, or scripts.js""")
    }
  }


  def loadAssetBundle(nameNoSuffix: String, suffix: String): String = {
    AssetBundleLoader.loadAssetBundle(nameNoSuffix, suffix, this)
  }

}



trait CachingAssetBundleDao extends AssetBundleDao {
  self: TenantDao with CachingDao =>

}

