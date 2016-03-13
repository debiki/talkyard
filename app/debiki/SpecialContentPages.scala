/**
 * Copyright (C) 2014 Kaj Magnus Lindberg (born 1979)
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


/** Provides default values for special content pages, e.g. a default website
  * Content License, or a default Jurisdiction section, for the Terms of Use page.
  *
  * These special content pages have special ids so they can be looked up
  * easily. The ids starts with "_" to indicate that they're special page ids.
  * E.g. "_stylesheet".
  */
@deprecated("now?", "come up with something better instead?")
object SpecialContentPages {

  case class Content(text: String)


  /** A magic string that means the default contents is to be used. */
  val UseDefaultContentMark = "__use_default__"


  def lookup(pageId: PageId): Option[Content] = Some(pageId match {
    case StylesheetId => Content("")
    case x => return None
  })


  val StylesheetId = "_stylesheet"

}

