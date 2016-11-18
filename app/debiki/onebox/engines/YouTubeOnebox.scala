/**
 * Copyright (c) 2015 Kaj Magnus Lindberg
 * Parts Copyright (c) 2013 jzeta (Joanna Zeta)
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
 *
 * The parts copyrighted by jzeta are available under the MIT license:
 * - https://github.com/discourse/onebox/blob/master/lib/onebox/engine/youtube_onebox.rb
 * - https://github.com/discourse/onebox/blob/master/LICENSE.txt
 */

package debiki.onebox.engines

import com.debiki.core._
import com.debiki.core.Prelude._
import debiki.onebox._
import java.{net => jn, util => ju}
import scala.util.{Try, Success, Failure}
import YouTubeOnebox._



class YouTubeOnebox extends InstantOneboxEngine {

  val regex = """^https?:\/\/(?:www\.)?(?:m\.)?(?:youtube\.com|youtu\.be)\/.+$""".r

  val cssClassName = "dw-ob-youtube"

  /** Do not use java.net.URL because it might try to do a reverse lookup of the hostname
    * (its operator equals).
    */
  private var javaUri: jn.URI = _

  override val alreadySanitized = true

  def renderInstantly(safeUrl: String): Try[String] = {
    javaUri = new jn.URI(safeUrl)
    findVideoId(javaUri) match {
      case Some(videoId) =>
        // We must sanitize here because alreadySanitized above is true, so that
        // the iframe below won't be removed.
        val safeId = sanitizeUrl(videoId)
        val unsafeParams = findParams(javaUri) getOrElse {
          return Failure(com.debiki.core.DebikiException(
            "EdE7DI60", "Bad YouTube video URL, cannot create onebox"))
        }
        val safeParams = sanitizeUrl(unsafeParams)
        // wmode=opaque makes it possible to cover the iframe with a transparent div,
        // which Utterscroll needs so the iframe won't steal mouse move events.
        // The default wmode is windowed which in effect places it above everything.
        // See http://stackoverflow.com/questions/3820325/overlay-opaque-div-over-youtube-iframe
        // Seems wmode might not be needed in Chrome today (June 2015) but feels better to
        // add it anyway.
        Success(o"""
          <iframe src="https://www.youtube.com/embed/$safeId?wmode=opaque&$safeParams"
              frameborder="0" allowfullscreen></iframe>""")
      case None =>
        // To do: Have a look at
        //  https://github.com/discourse/onebox/blob/master/lib/onebox/engine/youtube_onebox.rb
        Failure(com.debiki.core.DebikiException(
          "DwE45kFE2", "Cannot currently onebox this YouTube URL"))
    }
  }

}


object YouTubeOnebox {

  private val SlashVideoIdRegex = """\/([^\/]+)""".r
  private val SlashEmbedSlashVideoIdRegex = """\/embed\/([^\/]+)""".r
  private val QueryStringVideoIdRegex = """v=([^&\?]+)""".r.unanchored


  /** We can get the video id directly for URLs like:
    * - https://www.youtube.com/watch?v=112233abc
    * - http://youtu.be/112233abc
    * - https://www.youtube.com/embed/112233abc
    */
  def findVideoId(javaUri: jn.URI): Option[String] = {
    val path = javaUri.getPath
    if (javaUri.getHost endsWith "youtu.be") {
      // The url is like: http://youtu.be/112233abc
      SlashVideoIdRegex findGroupIn path
    }
    else if (path contains "/embed/") {
      // The url is like: https://www.youtube.com/embed/112233abc
      SlashEmbedSlashVideoIdRegex findGroupIn path
    }
    else if (javaUri.getQuery.nonEmpty) {
      // The url is like: https://www.youtube.com/watch?v=112233abc
      QueryStringVideoIdRegex findGroupIn javaUri.getQuery
    }
    else {
      None
    }
  }


  private def findParams(javaUri: jn.URI): Option[String] = {
    import scala.collection.JavaConversions._
    var result = ""
    val params: ju.List[org.apache.http.NameValuePair] =
      try org.apache.http.client.utils.URLEncodedUtils.parse(javaUri, "UTF8")
      catch {
        case exception: Exception =>
          return None
      }
    for (nameValue <- params) {
      val name = nameValue.getName
      val value = nameValue.getValue
      // ... fix later ...
    }
    Some(result)
  }
}


