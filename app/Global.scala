/**
 * Copyright (C) 2012-2015 Kaj Magnus Lindberg
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

import play.api._
import play.api.mvc._
import play.filters.gzip.GzipFilter



class HtmlJsCssGzipFilter extends GzipFilter(
  shouldGzip = (request: RequestHeader, response: ResponseHeader) => {
    // Play Framework won't call this function for responses that already have a content
    // encoding, e.g. things that have been gzipped already, like min.js.gz files.
    import org.jboss.netty.handler.codec.http.HttpHeaders.Names
    assert(response.headers.get(Names.CONTENT_ENCODING).isEmpty)

    // Compressing images tend to make them larger (they're compressed already).
    val uri = request.uri
    val isImage = uri.endsWith(".png") || uri.endsWith(".jpg") || uri.endsWith(".gif")
    val isMovie = uri.endsWith(".mp4") || uri.endsWith(".m4v")
    !isImage && !isMovie
  })



/** Delegates to debiki.Globals.
  */
object Global extends WithFilters(new HtmlJsCssGzipFilter()) with GlobalSettings {

  override def onStart(app: Application) {
    debiki.Globals.onServerStartup(app)
  }


  override def onStop(app: Application) {
    debiki.Globals.onServerShutdown(app)
  }

}


