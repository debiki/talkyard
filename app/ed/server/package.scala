/**
 * Copyright (c) 2016 Kaj Magnus Lindberg
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

package ed

import com.debiki.core._
import debiki.DebikiHttp.throwBadArgument
import java.{util => ju}


package object server {

  val Whatever = "*"

  implicit class GetOrThrowBadArgument[A](val underlying: Option[A]) {
    def getOrThrowBadArgument(errorCode: String, parameterName: String, message: => String = "")
          : A = {
      underlying getOrElse {
        throwBadArgument(errorCode, parameterName, message)
      }
    }
  }


  /** @param html Html for the whole page.
    * @param unapprovedPostAuthorIds Ids of authors who have posted stuff that hasn't yet been
    *   approved. If one of these authors views the page, hens unapproved posts should
    *   be loaded too, so hen can edit them. (Normally, unapproved posts aren't loaded.)
    */
  case class RenderedPage(
    html: String,
    unapprovedPostAuthorIds: Set[UserId])

}

