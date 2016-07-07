/**
 * Copyright (c) 2013, 2016 Kaj Magnus Lindberg
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

package controllers

import com.debiki.core._
import debiki.RateLimits
import ed.server.search.PageAndHits
import io.efdi.server.http._
import play.api._
import play.api.mvc.Result
import scala.collection.immutable.Seq
import scala.concurrent.ExecutionContext.Implicits.global
import scala.concurrent.Future
import Prelude._


/** Full text search, for a whole site, or for a site section, e.g. a single
  * forum (including all sub forums and topics), a single blog, or wiki.
  */
object SearchController extends mvc.Controller {

  private val SearchPhraseFieldName = "searchPhrase"

  def searchWholeSiteFor(phrase: String) = AsyncGetAction { apiReq =>
    searchImpl(phrase, anyRootPageId = None, apiReq)
  }


  def searchWholeSite() = AsyncJsonOrFormDataPostAction(RateLimits.FullTextSearch,
        maxBytes = 200) { apiReq: ApiRequest[JsonOrFormDataBody] =>
    val searchPhrase = apiReq.body.getOrThrowBadReq(SearchPhraseFieldName)
    searchImpl(searchPhrase, anyRootPageId = None, apiReq)
  }


  def searchSiteSectionFor(phrase: String, pageId: String) = AsyncGetAction { apiReq =>
    debiki.RateLimiter.rateLimit(RateLimits.FullTextSearch, apiReq)
    searchImpl(phrase, anyRootPageId = Some(pageId), apiReq)
  }


  def searchSiteSection(pageId: String) = AsyncJsonOrFormDataPostAction(
        RateLimits.FullTextSearch, maxBytes = 200) { apiReq =>
    val searchPhrase = apiReq.body.getOrThrowBadReq(SearchPhraseFieldName)
    searchImpl(searchPhrase, anyRootPageId = Some(pageId), apiReq)
  }


  private def searchImpl(phrase: String, anyRootPageId: Option[String],
        apiReq:  DebikiRequest[_]): Future[Result] = {
    apiReq.dao.fullTextSearch(phrase, anyRootPageId, apiReq.user) map {
        searchResults: Seq[PageAndHits] =>
      val siteTpi = debiki.SiteTpi(apiReq)
      val htmlStr = views.html.templates.searchResults(
          siteTpi, anyRootPageId, phrase, searchResults).body
      Ok(htmlStr) as HTML
    }
  }


}

