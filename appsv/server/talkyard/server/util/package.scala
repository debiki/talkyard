/**
 * Copyright (C) 2017 Kaj Magnus Lindberg
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

package talkyard.server

import com.debiki.core.Prelude._
import com.debiki.core._
import scala.xml.Elem



package object util {

  object email {
    def makeBoringLink(title: String, url: String): Elem =
      <a href={url} style="color: #333 !important;">{title}</a>

    def makeUnderlinedLink(title: String, url: String): Elem =
      <a href={url} style="color: #333 !important;">{title}</a>

    def makeFooter(regardsFromName: String, regardsFromUrl: String, unsubUrl: String): Elem =
      <div>
        <p>
          Kind regards,<br/>
          { makeBoringLink(regardsFromName, url = regardsFromUrl) }
        </p>
        <p style='font-size: 85%; opacity: 0.68; margin-top: 2em;'>
          { makeUnderlinedLink("Unsubscribe", url = unsubUrl) }
        </p>
        <p style='font-size: 85%; opacity: 0.68;'>
          Powered by {
            makeUnderlinedLink("Talkyard", url = "https://www.talkyard.io") }
        </p>
      </div>
  }

}

