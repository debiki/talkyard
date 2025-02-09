/**
 * Copyright (C) 2012-2015 Kaj Magnus Lindberg (born 1979)
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

package debiki

import scala.collection.Seq
import com.debiki.core._
import debiki.dao.SiteDao
import java.{util => ju}
import Prelude._
import AssetBundleLoader._


case class AssetBundleAndDependencies(
  assetBundleText: String,
  version: String, // SHA1 hash of assetBundleText
  assetPageIds: Seq[SitePageId],
  configPageIds: Seq[SitePageId],
  missingOptAssetPaths: Seq[SitePath])



/** Loads CSS config values. Currently broken, too complicated, try
  * to remove/simplify somehow.
  *
  * ?? what ??:
  * If you cache the result, you might want to consider race conditions
  * — have a look at CachingAssetBundleDao.loadBundleAndDependencies().
  */
case class AssetBundleLoader(bundleNameNoSuffix: String,  bundleSuffix: String, dao: SiteDao) {

  val SiteCssPageId = "_stylesheet"
  val SiteJsPageId = "_javascript"

  val bundleName = s"$bundleNameNoSuffix.$bundleSuffix"

  /** Loads and concatenates the contents of the files in an asset bundle.
    */
  def loadAssetBundle(): AssetBundleAndDependencies = {

    val databaseBundleData = loadBundleFromDatabase()

    val bundleText = databaseBundleData.text
    val sha1sum = hashSha1Base64UrlSafe(bundleText)

    AssetBundleAndDependencies(
      bundleText,
      sha1sum,
      assetPageIds = databaseBundleData.assetPageIds,
      configPageIds = databaseBundleData.configPageIds,
      missingOptAssetPaths = databaseBundleData.missingOptAssetPaths)
  }


  private def loadBundleFromDatabase(): DatabaseBundleData = {

    val specialContentPageId =
      if (bundleNameNoSuffix == "styles") SiteCssPageId
      else if (bundleNameNoSuffix == "scripts") SiteJsPageId
      else die("EdE2WTXY05")
    val assetsPost = dao.loadPost(specialContentPageId, PageParts.BodyNr) getOrElse {
      return DatabaseBundleData("", Nil, Nil, Nil)
    }

    val bundleTextMaybeUseDefault = assetsPost.currentSource

    // The default text for assets bundles, is nothing.
    val bundleText =
      if (bundleTextMaybeUseDefault == SpecialContentPages.UseDefaultContentMark) ""
      else bundleTextMaybeUseDefault

    // Old comment:
    //   Find ids of config pagses, and assets included in the bundle.
    //   (If any of these pages is modified, we'll rebuild the bundle.)
    // Nowadays only one single CSS page is supported: SiteCssPageId. Much simpler.

    DatabaseBundleData(bundleText, List(SitePageId(dao.siteId, specialContentPageId)),
      configPageIds = Nil, missingOptAssetPaths = Nil)
  }

}



object AssetBundleLoader {

  private case class DatabaseBundleData(
    text: String,
    assetPageIds: Seq[SitePageId],
    configPageIds: Seq[SitePageId],
    missingOptAssetPaths: Seq[SitePath])

}

