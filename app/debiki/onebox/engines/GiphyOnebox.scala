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

package debiki.onebox.engines

import com.debiki.core._
import com.debiki.core.Prelude._
import debiki.Globals
import debiki.TextAndHtml.safeEncodeForHtml
import debiki.onebox._
import org.scalactic.{Bad, Good, Or}
import scala.util.matching.Regex


class GiphyPrevwRendrEng(globals: Globals)
  extends InstantLinkPrevwRendrEng(globals) {

  override val regex: Regex =
    """^(https?:)?\/\/giphy\.com\/(gifs|embed)/[a-zA-Z0-9-]*-?[a-zA-Z0-9]+(/html5)?$""".r

  // (?:...) is a non capturing group.
  // *? is like * but non greedy.
  val findIdRegex: Regex =
    """(?:https?:)\/\/[^/]+\/[a-z]+\/[a-zA-Z0-9-]*?-?([a-zA-Z0-9]+)""".r

  override def providerName: Option[String] = Some("Giphy")

  def providerLnPvCssClassName = "s_LnPv-Giphy"

  override val alreadySanitized = true


  def renderInstantly(linkToRender: RenderPreviewParams): St Or LinkPreviewProblem = {
    val unsafeUrl = linkToRender.unsafeUrl
    val unsafeId = findIdRegex.findGroupIn(unsafeUrl) getOrElse {
      return Bad(LinkPreviewProblem(
            "Cannot find Giphy video id in URL", unsafeUrl = unsafeUrl, "TyEGIPHYURL"))
     }

    // The id is [a-zA-Z0-9] so need not be sanitized, but do anyway.
    val safeId = safeEncodeForHtml(unsafeId)

    // Optonally disable / sandbox this iframe [trust_ext_content]

    // The hardcoded width & height below are probably incorrect. They can be retrieved
    // via Giphys API: https://github.com/Giphy/GiphyAPI#get-gif-by-id-endpoint
    Good(o"""
     <iframe src="https://giphy.com/embed/$safeId"
       width="480" height="400" frameBorder="0" class="giphy-embed" allowFullScreen>
     </iframe>
      """.trim)
  }

}


