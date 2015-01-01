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


object WebsiteConfigLeaf {

  def fromSnakeYamlMap(map: Map[String, Any], sitePageId: SitePageId): WebsiteConfigLeaf =
    new WebsiteConfigLeaf(map, sitePageId)

}


class WebsiteConfigLeaf private (
  private val websiteConfMap: Map[String, Any],
  /** The page from which this config leaf was constructed. */
  val sitePageId: SitePageId) {

  def die(errCode: String, details: String) =
    throw new WebsiteConfigException(errCode, details)


  def anyConfigUrlToExtend: Option[String] = {
    val anyExtend = websiteConfMap.get("extend")
    try { anyExtend.asInstanceOf[Option[String]] }
    catch {
      case ex: ClassCastException =>
        die("DwE5LB8", o"""The config value `extends` is not a string,
          it is a ${classNameOf(anyExtend)}""")
    }
  }


  def getText(confValName: String): Option[String] = {
    val anyValue = websiteConfMap.get(confValName)
    try { anyValue.map(_.toString) }
    catch {
      case ex: ClassCastException =>
        throw TemplateRenderer.PageConfigException(
          "DwE0KBw5", o"""Error loading website config value `$confValName':
            It is not a String, it is a: ${classNameOf(anyValue.get)}""")
    }
  }

}

