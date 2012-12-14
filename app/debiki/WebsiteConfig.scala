/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package debiki

import com.debiki.v0._
import com.debiki.v0.Prelude._
import java.{util => ju}

object WebsiteConfig {

  def fromSnakeYamlMap(map: Map[String, Any]): WebsiteConfig =
    new WebsiteConfig(map)

}


class WebsiteConfig private (private val websiteConfMap: Map[String, Any]) {

  def die(errCode: String, details: String) =
    throw new WebsiteConfigException(errCode, details)

  def listAssetBundleUrls(bundleNameSuffix: String): Seq[String] = {

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

    val assetUrls: List[String] = confMap.get(bundleNameSuffix) match {
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

    assetUrls
  }

}


class WebsiteConfigException(errorCode: String, message: String)
  extends DebikiException(errorCode, message)

