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
import debiki.{RateLimits, SiteTpi}
import debiki.DebikiHttp.throwBadRequest
import ed.server.search._
import io.efdi.server.http._
import play.api._
import scala.collection.immutable.Seq
import scala.concurrent.ExecutionContext.Implicits.global
import scala.concurrent.Future
import Prelude._
import debiki.dao.SearchQuery


/** Full text search, for a whole site, or for a site section, e.g. a single
  * forum (including all sub forums and topics), a single blog, or wiki.
  */
object SearchController extends mvc.Controller {

  private val SearchPhraseFieldName = "searchPhrase"


  /** 'q' not 'query', so urls becomes a tiny bit shorter, because people will sometimes
    * copy & paste search phrase urls in emails etc? Google uses 'q' not 'query' anyway.
    */
  def showSearchPage(q: Option[String]) = AsyncGetAction { request =>
    val htmlStr = views.html.templates.search(SiteTpi(request, isSearchPage = true)).body
    Future.successful(Ok(htmlStr) as HTML)
  }


  def doSearch() = AsyncPostJsonAction(RateLimits.FullTextSearch, maxBytes = 1000) {
        request: JsonPostRequest =>
    val rawQuery = (request.body \ "rawQuery").as[String]
    val searchQuery = parseRawSearchQueryString(rawQuery, categorySlug => {
      request.dao.loadCategoryBySlug(categorySlug).map(_.id)
    })
    request.dao.fullTextSearch(searchQuery, None, request.user) map {
      searchResults: Seq[PageAndHits] =>
        import play.api.libs.json._
        OkSafeJson(Json.obj(
          "pagesAndHits" -> searchResults.map((pageAndHits: PageAndHits) => {
            Json.obj(
              "pageId" -> pageAndHits.pageId,
              "pageTitle" -> pageAndHits.pageTitle,
              "hits" -> JsArray(pageAndHits.hitsByScoreDesc.map((hit: SearchHit) => Json.obj(
                "postId" -> hit.postId,
                "postNr" -> hit.postNr,
                "approvedRevisionNr" -> hit.approvedRevisionNr,
                "approvedTextWithHighligtsHtml" -> Json.arr(hit.approvedTextWithHighligtsHtml),
                "currentRevisionNr" -> hit.currentRevisionNr
              ))))
          })
        ))
    }
  }


  SECURITY // can these regexes be DoS attacked?
  // Regex syntax: *? means * but non-greedy — but doesn't work, selects "ccc,ddd" in this:
  // "tags:aaa,bbb tags:ccc,ddd", why, wheird [4GPK032]
  private val TagNamesRegex =        """^(?:.*? )?tags:([^ ]*) *(?:.*)$""".r
  private val NotTagNamesRegex =     """^(?:.*? )?-tags:([^ ]*) *(?:.*)$""".r
  private val CatSlugsRegex =        """^(?:.*? )?categories:([^ ]*) *(?:.*)$""".r


  def parseRawSearchQueryString(rawQuery: String,
        getCategoryIdFn: Function1[String, Option[CategoryId]]): SearchQuery = {
    // Sync with parseSearchQueryInputText(text) in JS [5FK8W2R]
    var fullTextQuery = rawQuery

    // Look for and replace "-tags" first, before "tags" (which would otherwise also match "-tags").
    val notTagNames: Set[String] = NotTagNamesRegex.findGroupIn(rawQuery) match {
      case None => Set.empty
      case Some(commaSeparatedTags) =>
        fullTextQuery = fullTextQuery.replaceAllLiterally(s"-tags:$commaSeparatedTags", "")
        commaSeparatedTags.split(',').toSet.filter(_.nonEmpty)
    }

    val tagNames: Set[String] = TagNamesRegex.findGroupIn(rawQuery) match {
      case None => Set.empty
      case Some(commaSeparatedTags) =>
        fullTextQuery = fullTextQuery.replaceAllLiterally(s"tags:$commaSeparatedTags", "")
        commaSeparatedTags.split(',').toSet.filter(_.nonEmpty)
    }

    val categoryIds: Set[CategoryId] = CatSlugsRegex.findGroupIn(rawQuery) match {
      case None => Set.empty
      case Some(commaSeparatedCats) =>
        fullTextQuery = fullTextQuery.replaceAllLiterally(s"categories:$commaSeparatedCats", "")
        val slugs = commaSeparatedCats.split(',').toSet.filter(_.nonEmpty)
        slugs.flatMap(getCategoryIdFn(_))
    }

    SearchQuery(
      fullTextQuery = fullTextQuery.trim, // ignore weird unicode blanks for now
      tagNames = tagNames,
      notTagNames = notTagNames,
      categoryIds = categoryIds)
  }

}

