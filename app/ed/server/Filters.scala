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

package ed.server

import akka.stream.Materializer
import com.debiki.core._
import javax.inject.Inject
import play.api.http.DefaultHttpFilters
import play.filters.gzip.{GzipFilter, GzipFilterConfig}



/** Tells Play Framework to gzip responses, but not movies/images/music.
  *
  * Docs: https://www.playframework.com/documentation/2.5.x/GzipEncoding
  */
class Filters @Inject() (materializer: Materializer) extends DefaultHttpFilters(
  new GzipFilter (
    new GzipFilterConfig(
      shouldGzip = (request, response) => {
        // Play Framework (v2.4 at least) won't call this function for responses that already
        // have a content encoding, e.g. things that have been gzipped already,
        // like min.js.gz files.
        import org.jboss.netty.handler.codec.http.HttpHeaders.Names
        assert(response.header.headers.get(Names.CONTENT_ENCODING).isEmpty)

        // Compressing images tend to make them larger (they're compressed already).
        val uri = request.uri
        val isImage = uri.endsWith(".png") || uri.endsWith(".jpeg")|| uri.endsWith(".jpg") ||
              uri.endsWith(".gif")
        val isMovie = uri.endsWith(".mp4") || uri.endsWith(".m4v")
        val isMusic = uri.endsWith(".mp3")
        COULD // check many more suffixes
        !isImage && !isMovie && !isMusic
      }))(materializer))

