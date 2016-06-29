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
import debiki._
import ed.server.search.{PageAndHits, SearchHit, SearchEngine}
import io.efdi.server.http._
import org.{elasticsearch => es}
import play.api.Play.current
import redis.RedisClient
import scala.collection.immutable.Seq
import scala.concurrent.ExecutionContext.Implicits.global
import scala.concurrent.Future
import SiteDao._



trait SearchDao {
  this: SiteDao =>


  def fullTextSearch(phrase: String, anyRootPageId: Option[PageId]): Future[Seq[PageAndHits]] = {
    searchEngine.fullTextSearch(phrase, anyRootPageId) map { hits: Seq[SearchHit] =>
      groupAndSortBestFirst(hits)
    }
  }


  private def groupAndSortBestFirst(searchHits: Seq[SearchHit]): Seq[PageAndHits] = {
    val hitsByPageId: Map[PageId, Seq[SearchHit]] =
      searchHits.groupBy(hit => hit.pageId)

    // Sort hits-and-pages by the best hit on each page. This means that
    // the page with the highest scored hit is shown first.
    val pageIdsAndHitsSorted: Seq[(PageId, Seq[SearchHit])] =
      hitsByPageId.toVector sortBy { case (pageId, hits: Seq[SearchHit]) =>
        - hits.map(_.score).max
      }

    val pageStuffByPageId = loadPageStuff(hitsByPageId.keys)

    // Add page meta and also sort hits by score, desc.
    val pageStuffAndHitsTotallySorted: Seq[PageAndHits] =
      pageIdsAndHitsSorted flatMap { case (pageId, hits) =>
        pageStuffByPageId.get(pageId) map { pageStuff =>
          PageAndHits(pageStuff, hitsByScoreDesc = hits.sortBy(-_.score))
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
