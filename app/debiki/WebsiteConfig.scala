/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package debiki

import com.debiki.v0._
import com.debiki.v0.Prelude._
import java.{util => ju}
import WebsiteConfig._


object WebsiteConfig {

  def fromSnakeYamlMap(map: Map[String, Any]): WebsiteConfig =
    new WebsiteConfig(map)


  case class AssetBundleItem(url: String, isOptional: Boolean)

}


class WebsiteConfig private (private val websiteConfMap: Map[String, Any]) {

  def die(errCode: String, details: String) =
    throw new WebsiteConfigException(errCode, details)


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

    val confMap: ju.LinkedHashMap[String, Any] =
      websiteConfMap.get("asset-bundles") match {
        case None =>
          die("DwE74BKz3", "No asset-bundles have been configured")
        case Some(confVal) =>
          try { confVal.asInstanceOf[ju.LinkedHashMap[String, Any]] }
          catch {
            case ex: ClassCastException =>
              die("DwE2B1x8", o"""The config value `asset-bundles` is not a map,
                it is a ${classNameOf(confVal)}""")
          }
      }

    def itsEntryPrefix = s"The 'asset-bundles' entry for '$bundleNameSuffix'"

    val assetUrlsAndMeta: List[String] = confMap.get(bundleNameSuffix) match {
      case null =>
        die("DwE37BKf4", s"There is no assets-bundle entry for $bundleNameSuffix")
      case javaUrls: ju.ArrayList[_] =>
        import scala.collection.JavaConversions._
        val listOfAny = javaUrls.toList
        listOfAny find (!_.isInstanceOf[String]) foreach { x =>
          die("DwE583B3", o"""$itsEntryPrefix lists a non-text value,
             of type: ${classNameOf(x)}, value: $x""")
        }
        listOfAny.asInstanceOf[List[String]]
      case x =>
        die("DwE2B1x8", s"$itsEntryPrefix is not a list, it is a ${classNameOf(x)}")
    }

    val assetItems = assetUrlsAndMeta map { url =>
      url match {
        case AssetUrlRegex(url, optional_?, versionDatiStr_?) =>
          // Ignore versionDatiStr_? for now; see docs of this function.
          AssetBundleItem(url, isOptional = optional_? ne null)
        case x =>
          die("DwE7TDW7", s"Malformed asset bundle list item: `$x'")
      }
    }

    assetItems
  }


  private val AssetUrlRegex = """^([^,]+)(, *optional)?(, version .+)?$""".r

}


class WebsiteConfigException(errorCode: String, message: String)
  extends DebikiException(errorCode, message)

