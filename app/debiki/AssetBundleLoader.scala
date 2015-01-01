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

import com.debiki.core._
import debiki.DebikiHttp._
import debiki.dao.SiteDao
import java.{util => ju}
import play.api.Play
import play.api.Play.current
import Prelude._
import WebsiteConfig.AssetBundleItem
import AssetBundleLoader._


case class AssetBundleAndDependencies(
  assetBundleText: String,
  version: String, // SHA1 hash of assetBundleText
  assetPageIds: Seq[SitePageId],
  configPageIds: Seq[SitePageId],
  missingOptAssetPaths: Seq[SitePath])
  // COULD: missingAssets: Seq[MissingAsset])


/* COULD rebuild a broken bundle, if a missing asset is created.
 * siteOrHostId: Either the tenant ID was resolved, or only the address to
 * a not-yet-created website is known.
 * assetPath: Remember page path, not id, since there is not yet any id.
object AssetBundleAndDependencies {
  case class MissingAsset(
    siteHostOrId: Either[String, String],
    assetPath: String)
} */



/** Loads CSS config values. Currently broken, too complicated, try
  * to remove/simplify somehow.
  *
  * ?? what ??:
  * If you cache the result, you might want to consider race conditions
  * — have a look at CachingAssetBundleDao.loadBundleAndDependencies().
  */
case class AssetBundleLoader(bundleNameNoSuffix: String,  bundleSuffix: String, dao: SiteDao) {

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
    def die(exception: DebikiException) =
      throw DebikiException(
        "DwE9b3HK1", o"""Cannot serve '$bundleNameNoSuffix.<version>.$bundleSuffix':
            ${exception.getMessage}""")

    // Find PagePath:s to each JS/CSS page in the bundle.
    val (assetPaths, missingOptAssetPaths) =
      try { findAssetPagePaths() }
      catch {
        case ex: DebikiException => die(ex)
      }

    if (assetPaths.isEmpty && missingOptAssetPaths.isEmpty)
      return DatabaseBundleData("", Nil, Nil, Nil)

    // Load the JS/CSS pages that are to be bundled.
    val assetPathsAndPages: Seq[(PagePath, Option[PageParts])] = assetPaths map { path =>
      val page = dao.loadPageAnyTenant(
        tenantId = path.tenantId, pageId = path.pageId.get)
      (path, page)
    }

    // Die if we didn't find all assets to bundle.
    assetPathsAndPages find (_._2 isEmpty) match {
      case Some((pagePath, None)) =>
        die(DebikiException("DwE53X03", o"""Asset '${pagePath.value}'
          in bundle '$bundleName' not found"""))
      case _ => ()
    }

    // Construct the currently approved text of the JS/CSS pages.
    val assetBodies: Seq[String] =
      assetPathsAndPages map (_._2.get.approvedBodyText getOrElse "")
    val bundleText = {
      val sb = new StringBuilder
      assetBodies.foreach { sb append _ }
      sb.toString
    }

    // Find ids of config pases, and assets included in the bundle.
    // (If any of these pages is modified, we'll rebuild the bundle.)
    val assetPageIds = assetPaths map (_.sitePageId getOrDie "DwE90If5")
    val siteConfig = dao.loadWebsiteConfig()
    val configPageIds = siteConfig.configLeaves.map(_.sitePageId)

    DatabaseBundleData(bundleText, assetPageIds, configPageIds = configPageIds,
      missingOptAssetPaths = missingOptAssetPaths)
  }


  /** Returns PagePath:s to JS and CSS pages that are to be included in the
    * asset bundle. Includes PagePath:s to *optional* assets that are not found,
    * but dies if non-optional assets are not found.
    */
  private def findAssetPagePaths(): (Seq[PagePath], Seq[SitePath]) = {

    def die(errCode: String, details: String) =
      throw DebikiException(
        errCode, s"There's an error in _site.conf: $details")

    val assetUrls =
      try { dao.loadWebsiteConfig().listAssetBundleUrls(bundleName) }
      catch {
        case ex: WebsiteConfigException =>
          die("DwE2B1x8", ex.getMessage)
      }

    def itsEntryPrefix = s"The 'asset-bundles' entry for '$bundleName'"

    var missingOptPaths = List[SitePath]()

    val assetPaths: Seq[PagePath] =
          assetUrls flatMap { case AssetBundleItem(assetUrl, isOptional) =>
      import UrlToPagePathResolver.Result
      UrlToPagePathResolver.resolveUrl(assetUrl, dao,
          baseSiteId = dao.siteId, baseFolder = "/themes/local/") match {
        case Result.BadUrl(errorMessage) =>
          die("DwE3bK31", o"""$itsEntryPrefix lists an invalid URL: $assetUrl,
             error: $errorMessage""")
        case Result.HostNotFound(host) =>
          die("DwE58BK3", s"$itsEntryPrefix refers to an unknown host: $host")
        case Result.PageNotFound =>
          if (!isOptional) die(
            "DwE4YBz3", s"$itsEntryPrefix refers to non-existing page: $assetUrl")
          val path = stripOrigin(assetUrl) getOrElse  assetUrl
          missingOptPaths ::= SitePath(dao.siteId, path = path)
          Nil
        case Result.Ok(path) =>
          path::Nil
      }
    }

    (assetPaths, missingOptPaths)
  }

}



object AssetBundleLoader {

  private case class DatabaseBundleData(
    text: String,
    assetPageIds: Seq[SitePageId],
    configPageIds: Seq[SitePageId],
    missingOptAssetPaths: Seq[SitePath])

}

