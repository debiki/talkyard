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
import talkyard.server.search._
import scala.collection.immutable.Seq
import scala.concurrent.{ExecutionContext, Future}


// MOVE to package talkyard.server.search
trait SearchDao {
  this: SiteDao =>

  implicit def executionContext: ExecutionContext = context.executionContext


  /**
    * @param addMarkTagClasses — if the html class here:
    *   <mark class="esHL1">text hit</mark> should be included or not.
    */
  def fullTextSearch(searchQuery: SearchQuery, anyRootPageId: Opt[PageId],
          user: Opt[Pat], addMarkTagClasses: Bo)
          : Future[SearchResultsCanSee] = {
    COULD_OPTIMIZE // cache the most recent N search results for M minutes?
    // And refresh whenever anything changes anywhere, e.g. gets edited /
    // permissions changed / moved elsewhere / created / renamed.
    // But! Bug risk! What if takes 1 second until ElasticSearch is done indexing —
    // and we cached sth 0.5 before. Stale search results cache!
    searchEngine.search(searchQuery, anyRootPageId, user,
        addMarkTagClasses = addMarkTagClasses) map { hits: Seq[SearchHit] =>
      groupByPageAccessCheckAndSort(hits, user)
    }
  }


  private def groupByPageAccessCheckAndSort(searchHits: Seq[SearchHit], user: Opt[Pat])
          : SearchResultsCanSee = {
    val hitsByPageId: Map[PageId, Seq[SearchHit]] =
      searchHits.groupBy(hit => hit.pageId)

    // ----- Group by page

    // Sort hits-and-pages by the best hit on each page. This means that
    // the page with the highest scored hit is shown first.
    COULD_OPTIMIZE // Skip this for pages pat may not see anyway. (Then need to move this
    // downwards to after the access check.)
    val pageIdsAndHitsSorted: Seq[(PageId, Seq[SearchHit])] =
      hitsByPageId.toVector sortBy { case (pageId, hits: Seq[SearchHit]) =>
        - hits.map(_.score).max
      }

    // ----- Access check  [se_acs_chk]

    COULD_OPTIMIZE // Remember the categories — they're getting looked up, for
    // access control, but then forgotten. However, here we look them up again:
    // [search_results_extra_cat_lookup]

    // Later: Have ElasticSearch do as much filtering as possible instead, to e.g. filter
    // out private messages the user isn't not allowed to see, earlier. Better performance,
    // and we'll get as many search hits as we want.
    val pageStuffByIdInclForbidden = getPageStuffById(hitsByPageId.keys)
    val pageStuffByIdCanSee = pageStuffByIdInclForbidden filter { case (_, pageStuff) =>
      val isStaffOrAuthor = user.exists(u => u.isStaff || u.id == pageStuff.pageMeta.authorId)
      COULD_OPTIMIZE // Do for all pages in the same cat, at once?  [authz_chk_mny_pgs]
      val maySeeResult = maySeePageUseCache(pageStuff.pageMeta, user,
            maySeeUnlisted = isStaffOrAuthor)
      maySeeResult.maySee
    }

    // ----- Sort

    // Add page meta and also sort hits by score, desc.
    val pageStuffAndHitsTotallySorted: Seq[PageAndHits] =
      pageIdsAndHitsSorted flatMap { case (pageId, hits) =>
        pageStuffByIdCanSee.get(pageId) flatMap { pageStuff =>
          getPagePath2(pageStuff.pageId) map { path =>
            PageAndHits(pageStuff, path, hitsByScoreDesc = hits.sortBy(-_.score))
          }
        }
      }

    SearchResultsCanSee(
          pageStuffAndHitsTotallySorted)
  }


  /** Unindexes everything on some pages. Intended for test suites only.
    * Returns the number of *posts* that were unindexed.
    */
  def debugUnindexPosts(pageAndPostIds: PagePostNr*): Unit = {
    ???
  }

}
