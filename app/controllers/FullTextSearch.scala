/**
 * Copyright (C) 2013 Kaj Magnus Lindberg (born 1979)
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

import com.debiki.v0._
import debiki.TemplateRenderer
import java.{util => ju}
import play.api._
import ApiActions._
import Prelude._


/** Full text search, for a whole site, or for a site section, e.g. a single
  * forum (including all sub forums and topics), a single blog, or wiki.
  */
object FullTextSearch extends mvc.Controller {

  private val SearchPhraseFieldName = "searchPhrase"

  private val SearchResultsTemplate = "searchResults"


  def searchWholeSiteFor(phrase: String) = GetAction { apiReq =>
    searchImpl(phrase, anyRootPageId = None, apiReq)
  }


  def searchWholeSite() = JsonOrFormDataPostAction(maxBytes = 200) {
        apiReq: ApiRequest[JsonOrFormDataBody] =>
    val searchPhrase = apiReq.body.getOrThrowBadReq(SearchPhraseFieldName)
    searchImpl(searchPhrase, anyRootPageId = None, apiReq)
  }


  def searchSiteSectionFor(phrase: String, pageId: String) = GetAction { apiReq =>
    searchImpl(phrase, anyRootPageId = Some(pageId), apiReq)
  }


  def searchSiteSection(pageId: String) = JsonOrFormDataPostAction(maxBytes = 200) {
        apiReq: ApiRequest[JsonOrFormDataBody] =>
    val searchPhrase = apiReq.body.getOrThrowBadReq(SearchPhraseFieldName)
    searchImpl(searchPhrase, anyRootPageId = Some(pageId), apiReq)
  }


  private def searchImpl(phrase: String, anyRootPageId: Option[String],
        apiReq:  DebikiRequest[_]) = {

    import scala.concurrent.ExecutionContext.Implicits.global

    val futureSearchResult = apiReq.dao.fullTextSearch(phrase, anyRootPageId)
    val futureResponse = futureSearchResult map { searchResult =>
      val siteTpi = debiki.SiteTpi(apiReq)
      val theme = TemplateRenderer.getThemeName(siteTpi)
      val htmlStr = TemplateRenderer.renderThemeTemplate(
        theme, SearchResultsTemplate, Vector(siteTpi, anyRootPageId, phrase, searchResult))
      Ok(htmlStr) as HTML
    }

    mvc.AsyncResult(futureResponse)
  }

}

