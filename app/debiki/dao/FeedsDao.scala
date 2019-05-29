/**
 * Copyright (c) 2018 Kaj Magnus Lindberg
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
import debiki.EdHttp.throwNotFound


/** Generates and caches Atom feeds for recent comments or recent topics.
  */
trait FeedsDao {
  self: SiteDao =>


  memCache.onPageCreated { sitePageId =>
    memCache.remove(feedKey)
  }

  memCache.onPageSaved { sitePageId =>
    memCache.remove(feedKey)
  }


  def getAtomFeedXml(): xml.Node = {
    memCache.lookup[xml.Node](
      feedKey,
      orCacheAndReturn = {
        Some(loadAtomFeedXml())
      }) getOrDie "TyE5KBR7JQ0"
  }


  def loadAtomFeedXml(): xml.Node = {
    // ----- Dupl code [4AKB2F0]
    val postsInclForbidden = readOnlyTransaction { tx =>
      tx.loadPostsSkipTitles(limit = 25, OrderBy.MostRecentFirst, byUserId = None)
    }
    val pageIdsInclForbidden = postsInclForbidden.map(_.pageId).toSet
    val pageMetaById = getPageMetasAsMap(pageIdsInclForbidden)
    val postsOneMaySee = for {
      post <- postsInclForbidden
      pageMeta <- pageMetaById.get(post.pageId)
      if maySeePostUseCache(post, pageMeta, user = None, maySeeUnlistedPages = false)._1.may
    } yield post
    val pageIds = postsOneMaySee.map(_.pageId).distinct
    val pageStuffById = getPageStuffById(pageIds)
    // ----- /Dupl code

    if (postsOneMaySee.isEmpty)
      throwNotFound("TyE0FEEDPOSTS", "No posts found, or they are private")

    val origin = theSiteOrigin()
    debiki.AtomFeedXml.renderFeed(origin, postsOneMaySee, pageStuffById)
  }


  private def feedKey = MemCacheKey(siteId, "FeedKey")

}

