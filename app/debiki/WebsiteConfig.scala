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

}



class WebsiteConfigException(errorCode: String, details: String)
  extends DebikiException(errorCode, details)


object WebsiteConfigException {
  def apply(errorCode: String, details: String): WebsiteConfigException =
    new WebsiteConfigException(errorCode, details)
}
