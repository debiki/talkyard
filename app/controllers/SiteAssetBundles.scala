/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package controllers

import com.debiki.v0._
import debiki._
import debiki.DebikiHttp._
import java.{util => ju}
import play.api._
import ApiActions._
import Prelude._


/**
 * Bundles and serves site specific assets.
 *
 * The assets are served from e.g.: `server/-/site/styles.<version>.css`
 * where `<version>` is a URL safe SHA1 hash of the asset bundle text.
 * (So whenever the bundle contents changes, the URL also changes — and
 * we can ask the browser to cache forever. This is asset versioning.)
 */
object SiteAssetBundles extends mvc.Controller {


  def at(file: String) = GetAction { request =>
    // `file` is like: bundle-name.<version>.css.
    file match {
      case AssetBundleFileNameRegex(nameNoSuffix, version, suffix) =>
        // Ignore `version` for now. It's only used for asset versioning —
        // but we always serve the most recent version of the bundle.
        val bundleText = try {
          request.dao.loadAssetBundle(nameNoSuffix, suffix)
        }
        catch {
          case ex: DebikiException =>
            throwNotFound(ex.errorCode, ex.details)
        }

        Ok(bundleText) // COULD cache forever, asset versioning
      case _ =>
        NotFoundResult("DwE93BY1", s"Bad asset bundle URL path: $file")
    }
  }


  /**
   * <bundle-name-no-suffix>.<suffix>.
   */
  val AssetBundleNameRegex = """([a-z-]+)\.(css)""".r


  /**
   * <bundle-name-no-suffix>-<version>.<suffix>.
   * The version is a URL safe base64 hash, and used for asset versioning.
   */
  val AssetBundleFileNameRegex = """([a-z-]+)\.([a-zA-Z0-9_-]+)\.(css)""".r


  def assetBundleFileName(nameNoSuffix: String, version: String, suffix: String) =
    s"$nameNoSuffix.$version.$suffix"

}

