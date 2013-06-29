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

package debiki

import com.debiki.v0._
import debiki._
import debiki.DebikiHttp._
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



/** Loads bundles of styles and scripts.
  *
  * The bundles are loaded both from the file system (well, from JAR files)
  * and from the database. The reason is that e.g. CSS can be placed
  * both in the file system and in the database:
  * 1) In the file system, under version control. This might be is suitable for
  *   single site installations, where the server admin also controls the
  *   file system, and is able to check in theme files (e.g. styles and scripts)
  *   into Git.
  * 2) In the database. This is the only option for multi-site installations
  *   where the admins don't have access to the file system. (Instead, they
  *   create style files via a Web browser, and the files are stored in the
  *   database.)
  *
  * If there's a file system bundle and a database bundle with the same name, their
  * contents is concatenated — and the database bundle is appended, so it takes
  * precedence over the file system stuff.
  *
  * If you cache the result, you might want to consider race conditions
  * — have a look at CachingAssetBundleDao.loadBundleAndDependencies().
  */
case class AssetBundleLoader(bundleNameNoSuffix: String,  bundleSuffix: String, dao: TenantDao) {

  val bundleName = s"$bundleNameNoSuffix.$bundleSuffix"

  /**
   * Loads and concatenates the contents of the files in an asset bundle.
   */
  def loadAssetBundle(): AssetBundleAndDependencies = {

    val fileBundleText = loadBundleFromJarFiles()
    val databaseBundleData = loadBundleFromDatabase()

    val bundleText = fileBundleText + "\n" + databaseBundleData.text
    val sha1sum = hashSha1Base64UrlSafe(bundleText)

    AssetBundleAndDependencies(
      bundleText,
      sha1sum,
      assetPageIds = databaseBundleData.assetPageIds,
      configPageIds = databaseBundleData.configPageIds,
      missingOptAssetPaths = databaseBundleData.missingOptAssetPaths)
  }


  private def loadBundleFromJarFiles(): String = {
    // Currently I've configured Grunt to bundle only:
    //   app/views/themes/<themeName>/styles.css/*.css
    // to:
    //   public/themes/<themeName>/styles.css
    // So return "" if the bundle is named something else.
    if (bundleName != "styles.css")
      return ""

    val themeName = dao.loadWebsiteConfig().getText("theme") getOrElse {
      return ""
    }

    Play.resource(s"public/themes/$themeName/$bundleName") match {
      case None => ""
      case Some(url) =>
        val inputStream = url.openStream()
        val bundleText = scala.io.Source.fromInputStream(inputStream).mkString("")
        inputStream.close()
        bundleText
    }
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

    // Load the JS/CSS pages that are to be bundled.
    val assetPathsAndPages: Seq[(PagePath, Option[PageParts])] = assetPaths map { path =>
      val page = dao.loadPageAnyTenant(
        tenantId = path.tenantId, pageId = path.pageId.get)
      (path, page)
    }

    // Die if we didn't find all assets to bundle.
    assetPathsAndPages find (_._2 isEmpty) match {
      case Some((pagePath, None)) =>
        die(DebikiException("DwE53X03", o"""Asset '${pagePath.path}'
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
          baseSiteId = dao.tenantId, baseFolder = "/themes/local/") match {
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

