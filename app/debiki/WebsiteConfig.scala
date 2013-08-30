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

import com.debiki.core._
import com.debiki.core.Prelude._
import java.{util => ju}
import WebsiteConfig._


object WebsiteConfig {

  case class AssetBundleItem(url: String, isOptional: Boolean = false)

}


/**
 * Provides configuration values for a website. Starts with configLeaves.head,
 * then fallbacks to configLeaves.tail.head, then .tail.tail.head and so on.
 */
case class WebsiteConfig(configLeaves: Seq[WebsiteConfigLeaf]) {


  def getText(confValName: String): Option[String] = {
    for (leaf <- configLeaves; value <- leaf.getText(confValName))
      return Some(value)
    None
  }


  /**
   * Parses any asset bundle config values. They look like so:
   *
   * asset-bundles:
   *  bundle-1-name:
   *    - /path/to/some-file.js
   *    - http://another-site-hosted-by-this-server/some-file.js
   *    - /file.js, optional
   *    - /file2.js, version 2013-01-28T00:00:00Z
   *    - /optional-and-specific-version.js, optional, version 2013-01-28T00:00:00Z
   *
   * Optional files:
   * A missing file results in an error, unless you've append ", optional".
   * Rationale: When a new website is created, it's nice (?) to be able to
   * mark a certain  /themes/local/theme.css  as optional, because usually
   * it doesn't exist, unless you want to configure CSS for that particular site.
   * But it's better (?) to fail fast if non-optional files are missing.
   *
   * Specific versions: (Not implemented, ignored if used)
   * If you refer to a file on another site (e.g. to
   *  www.debiki.com/themes/default-2012-10-09/theme.css), then that file might
   * be changed without notice and break your site. By appending
   * ", version YYYY-MM-DDTHH24:MI:SSZ" you can specify which version of that file
   * to use.
   */
  def listAssetBundleUrls(bundleNameSuffix: String): Seq[AssetBundleItem] = {
    for (leaf <- configLeaves; bundles <- leaf.listAssetBundleUrls(bundleNameSuffix))
      return bundles
    Nil
  }

}



class WebsiteConfigException(errorCode: String, details: String)
  extends DebikiException(errorCode, details)


object WebsiteConfigException {
  def apply(errorCode: String, details: String): WebsiteConfigException =
    new WebsiteConfigException(errorCode, details)
}
