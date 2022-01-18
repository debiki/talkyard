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

package controllers

import com.debiki.core._
import debiki.EdHttp._
import talkyard.server.{TyContext, TyController}
import talkyard.server.http._
import javax.inject.Inject
import play.api.mvc.{Action, ControllerComponents}
import scala.util.matching.Regex
import SiteAssetBundlesController._


/**
 * Bundles and serves site specific assets.
 *
 * The assets are served from e.g.: `server/-/site/PUB_SITE_ID/styles.<version>.css`
 * where `<version>` is a URL safe SHA1 hash of the asset bundle text.
 * (So whenever the bundle contents changes, the URL also changes — and
 * we can ask the browser to cache forever. This is asset versioning.)
 */
class SiteAssetBundlesController @Inject()(cc: ControllerComponents, edContext: TyContext)
  extends TyController(cc, edContext) {

  import context.globals

  /**
   * Serves asset bundles.
   *
   * - Asks the client to cache the response forever (1 year), since asset
   * versioning is used (a new URL is generated whenever the bundle body
   * changes).
   * - Sets no cookies, since the intention is that the response be cached
   * by proxy servers.
   */
  // ?? not in use ?? I changed to 'customAsset' and added a site id param?
  CLEAN_UP; REMOVE // ?
  def at(file: String) = GetAction { request =>
    customAssetImpl(siteId = request.siteId, fileName = file, request)
  }


  def customAsset(pubSiteId: PubSiteId, fileName: String): Action[Unit] = GetAction { request =>
    val siteId = globals.systemDao.getSiteIdByPubId(pubSiteId) getOrElse {
      throwNotFound("TyE2PKH8", s"No site with publ id $pubSiteId")
    }
    customAssetImpl(siteId = siteId, fileName = fileName, request)
  }


  private def customAssetImpl(siteId: SiteId, fileName: String, request: DebikiRequest[_]) = {
    val dao = globals.siteDao(siteId)
    // `fileName` is like: bundle-name.<version>.css.
    fileName match {
      case AssetBundleFileNameRegex(nameNoSuffix, _, suffix) =>
        // Ignore `version` for now. It's only used for asset versioning —
        // but we always serve the most recent version of the bundle.
        val bundle = try {
          CLEAN_UP // this is no longer possible?: (because I simplified th assets system)
          // SECURITY don't load foreign tenant stuff from any private
          // other-site/_hidden-underscore-folder/, or if read access restricted
          // in some other manner. (Fix later, in AssetBundleLoader?)
          dao.getAssetBundle(nameNoSuffix, suffix)
        }
        catch {
          case ex: DebikiException =>
            throwNotFound(ex.errorCode, ex.details)
        }

        val etag = bundle.version
        val isEtagOk = request.headers.get(IF_NONE_MATCH).contains(etag)
        if (isEtagOk) {
          NotModified
        }
        else {
          val contentType =
            if (request.uri endsWith "css") CSS
            else if (request.uri endsWith "js") JAVASCRIPT
            else TEXT
          Ok(bundle.body).withHeaders(
            CACHE_CONTROL -> "max-age=31536000, s-maxage=31536000, public",
            ETAG -> etag,
            // Really don't set any new cookies (don't know from where they
            // could come, but remove any anyway).
            SET_COOKIE -> "") as contentType
        }
      case _ =>
        NotFoundResult("DwE93BY1", s"Not found: $fileName")
    }
  }
}


object SiteAssetBundlesController {

  /**
   * <bundle-name-no-suffix>.<suffix>.
   */
  val StylesheetAssetBundleNameRegex: Regex = """([a-z-]+)\.(css)""".r


  /**
   * <bundle-name-no-suffix>-<version>.<suffix>.
   * The version is a URL safe base64 hash, and used for asset versioning.
   */
  val AssetBundleFileNameRegex: Regex = """([a-z-]+)\.([a-zA-Z0-9_-]+)\.(css|js)""".r


  def assetBundleFileName(nameNoSuffix: String, version: String, suffix: String) =
    s"$nameNoSuffix.$version.$suffix"

}

