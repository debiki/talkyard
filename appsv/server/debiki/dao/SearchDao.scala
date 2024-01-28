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
import talkyard.server.authz.AuthzCtxOnForum
import scala.collection.{mutable => mut}
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
          authzCtx: AuthzCtxOnForum, anyOffset: Opt[i32], addMarkTagClasses: Bo)
          : Future[SearchResultsCanSee] = {
    COULD_OPTIMIZE // cache the most recent N search results for M minutes?
    // And refresh whenever anything changes anywhere, e.g. gets edited /
    // permissions changed / moved elsewhere / created / renamed.
    // But! Bug risk! What if takes 1 second until ElasticSearch is done indexing —
    // and we cached sth 0.5 before. Stale search results cache!
    searchEngine.search(searchQuery, anyRootPageId, user = authzCtx.requester,
          anyOffset = anyOffset, addMarkTagClasses = addMarkTagClasses) map {
              hits: Seq[SearchHit] =>
      groupByPageAccessCheck(hits, authzCtx)
    }
  }


  private def groupByPageAccessCheck(searchHits: Seq[SearchHit], authzCtx: AuthzCtxOnForum)
          : SearchResultsCanSee = {

    // ElasticSearch has already sorted the hits by score or by any by-us explicitly
    // specified sort order.  Let's remember the order of the pages on which the best
    // hits were found:
    val pageSortOrder: Vec[PageId] = {
      val linkedSet = mut.LinkedHashSet[PageId]() // elem order is insertion order
      searchHits.foreach(h => linkedSet.add(h.pageId))
      linkedSet.toVector
    }

    // ----- Group by page

    // For each page, group all hits on that page, together.

    val hitsByPageId: Map[PageId, Seq[SearchHit]] = searchHits.groupBy(hit => hit.pageId)

    WOULD_OPTIMIZE // Skip this for pages pat may not see anyway. (Then need to move this
    // downwards to after the access check.)
    val pageIdsAndHitsSorted: Seq[(PageId, Seq[SearchHit])] =
      pageSortOrder map { pageId =>
        // These should already be in best-first order — groupBy() preserves
        // element order, at least in Scala 2.17 and the previous 10+ years.
        val hits = hitsByPageId.getOrDie(pageId, "TyE7MRTLN25")
        pageId -> hits
      }

    // ----- Access check pages  [se_acs_chk]

    WOULD_OPTIMIZE // Remember the categories — they're getting looked up, for
    // access control, but then forgotten. However, here we look them up again:
    // [search_results_extra_cat_lookup]
    // But the Dao [caches_the_cats], doesn't it? So won't get looked up again then?

    COULD_OPTIMIZE // Have ElasticSearch do as much filtering as possible instead, to e.g. filter
    // out private messages the user isn't not allowed to see, earlier. Better performance,
    // and we'll get as many search hits as we want.
    // But probably need to double check here anyway that we only return things
    // the requester may see, in case the ES index is stale somehow. Still, that'll
    // be a bit more efficient if there's fewer may-not-see things.

    val pageStuffById = getPageStuffById(hitsByPageId.keys)
    // So we can load all posts at once, that's more efficient.
    val hitPostIds = mut.HashSet[PostId]()
    val reqr: Opt[Pat] = authzCtx.requester

    val pagesPathHits: Seq[(PageStuff, PagePathWithId, Seq[SearchHit])] =
            pageIdsAndHitsSorted flatMap { case (pageId, hits) =>
      pageStuffById.get(pageId) flatMap { pageStuff: PageStuff =>
        val isStaffOrAuthor = reqr.exists(u => u.isStaff || u.id == pageStuff.pageMeta.authorId)
        WOULD_OPTIMIZE // Do for all pages in the same cat, at once?  [authz_chk_mny_pgs]

        val maySeeResult =
              maySeePageUseCacheAndAuthzCtx(
                      pageStuff.pageMeta, authzCtx, maySeeUnlisted = isStaffOrAuthor)
        if (!maySeeResult.maySee) None
        else {
          getPagePath2(pageStuff.pageId) map { path =>
            hits.foreach(h => hitPostIds.add(h.postId))
            (pageStuff, path, hits)
          }
        }
      }
    }

    // ----- Access check posts  [se_acs_chk]

    val postsById = readTx(_.loadPostsByUniqueId(hitPostIds))

    val pagesPostsHitsMaySee = pagesPathHits flatMap { case (pageStuff, path, hits) =>
      val hitsAndPostsMaySee: Seq[(SearchHit, Post)] = hits flatMap { hit =>
        postsById.get(hit.postId) flatMap { post =>
          val (seePost, debugCode) =
                maySeePostIfMaySeePage(reqr, post)
          if (!seePost.may) None
          else Some(hit -> post)
        }
      }

      if (hitsAndPostsMaySee.isEmpty) None
      else Some(
            // The hits have been sorted already by ES.
            PageAndHits(pageStuff, path, hitPosts = hitsAndPostsMaySee))
    }

    SearchResultsCanSee(pagesPostsHitsMaySee)
  }


  /** Unindexes everything on some pages. Intended for test suites only.
    * Returns the number of *posts* that were unindexed.
    */
  def debugUnindexPosts(pageAndPostIds: PagePostNr*): Unit = {
    ???
  }

}
