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

package views.html.templates

import com.debiki.core._


/** Support code for searchResults.scala.html.
  */
object SearchResultsTemplateCode {

  def groupHitsByPageDescScore(searchResult: FullTextSearchResult)
        : Seq[(Option[PageMeta], Seq[FullTextSearchHit])] = {

    val hitsByPageId: Map[PageId, Seq[FullTextSearchHit]] =
      searchResult.hits.groupBy(hit => hit.post.pageId)

    // Sort hits-and-pages by the best hit on each page. This means that
    // the page with the very best hit is shown first.
    val pageIdsAndHitsSorted: Vector[(PageId, Seq[FullTextSearchHit])] =
      hitsByPageId.toVector sortBy { case (pageId, hits: Seq[FullTextSearchHit]) =>
        hits.map(_.score).max
      }

    // Add page meta and also sort hits by score, desc.
    val metaAndHitsTotallySorted: Vector[(Option[PageMeta], Seq[FullTextSearchHit])] =
      pageIdsAndHitsSorted map { case (pageId, hits) =>
        val anyPageMeta = searchResult.pageMetaByPageId.get(pageId)
        val hitsByScoreDesc = hits.sortBy(-_.score)
        (anyPageMeta, hitsByScoreDesc)
      }

    metaAndHitsTotallySorted
  }

}
