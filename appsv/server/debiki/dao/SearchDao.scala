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

package debiki.dao

import com.debiki.core._
import com.debiki.core.Prelude._
import talkyard.server.search.{PageAndHits, SearchHit}
import scala.collection.immutable.Seq
import scala.concurrent.{ExecutionContext, Future}


case class SearchQuery(
  fullTextQuery: String,
  tagNames: Set[String],
  notTagNames: Set[String],
  categoryIds: Set[CategoryId]) {

  require(!tagNames.exists(_.isEmpty), "EsE6KWU80")

  def isEmpty = fullTextQuery.trim.isEmpty && tagNames.isEmpty && categoryIds.isEmpty

}



trait SearchDao {
  this: SiteDao =>

  implicit def executionContext: ExecutionContext = context.executionContext


  /**
    * @param addMarkTagClasses — if the html class here:
    *   <mark class="esHL1">text hit</mark> should be included or not.
    */
  def fullTextSearch(searchQuery: SearchQuery, anyRootPageId: Option[PageId],
        user: Option[Participant], addMarkTagClasses: Boolean): Future[Seq[PageAndHits]] = {
    COULD_OPTIMIZE // cache the most recent N search results for M minutes?
    // And refresh whenever anything changes anywhere, e.g. gets edited /
    // permissions changed / moved elsewhere / created / renamed.
    // But! Bug risk! What if takes 1 second until ElasticSearch is done indexing —
    // and we cached sth 0.5 before. Stale search results cache!
    searchEngine.search(searchQuery, anyRootPageId, user,
        addMarkTagClasses = addMarkTagClasses) map { hits: Seq[SearchHit] =>
      groupByPageFilterAndSort(hits, user)
    }
  }


  private def groupByPageFilterAndSort(searchHits: Seq[SearchHit], user: Option[Participant])
        : Seq[PageAndHits] = {
    val hitsByPageId: Map[PageId, Seq[SearchHit]] =
      searchHits.groupBy(hit => hit.pageId)

    // Sort hits-and-pages by the best hit on each page. This means that
    // the page with the highest scored hit is shown first.
    val pageIdsAndHitsSorted: Seq[(PageId, Seq[SearchHit])] =
      hitsByPageId.toVector sortBy { case (pageId, hits: Seq[SearchHit]) =>
        - hits.map(_.score).max
      }

    // Later: Have ElasticSearch do as much filtering as possible instead, to e.g. filter
    // out private messages the user isn't not allowed to see, earlier. Better performance,
    // and we'll get as many search hits as we want.
    val pageStuffByPageIdInclForbidden = getPageStuffById(hitsByPageId.keys)
    val pageStuffByPageId = pageStuffByPageIdInclForbidden filter { case (pageId, pageStuff) =>
      val isStaffOrAuthor = user.exists(u => u.isStaff || u.id == pageStuff.pageMeta.authorId)
      val (maySee, _) = maySeePageUseCache(pageStuff.pageMeta, user,
        maySeeUnlisted = isStaffOrAuthor)
      maySee
    }

    // Add page meta and also sort hits by score, desc.
    val pageStuffAndHitsTotallySorted: Seq[PageAndHits] =
      pageIdsAndHitsSorted flatMap { case (pageId, hits) =>
        pageStuffByPageId.get(pageId) flatMap { pageStuff =>
          getPagePath2(pageStuff.pageId) map { path =>
            PageAndHits(pageStuff, path, hitsByScoreDesc = hits.sortBy(-_.score))
          }
        }
      }

    pageStuffAndHitsTotallySorted
  }


  /** Unindexes everything on some pages. Intended for test suites only.
    * Returns the number of *posts* that were unindexed.
    */
  def debugUnindexPosts(pageAndPostIds: PagePostNr*): Unit = {
    ???
  }

}
