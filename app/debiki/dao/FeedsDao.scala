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
import debiki._
import debiki.EdHttp.throwNotFound
import scala.xml


/** Loads and saves settings for the whole website, a section of the website (e.g.
  * a forum or a blog) and individual pages.
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
      }) getOrDie "TyE5KBRQ0"
  }


  def loadAtomFeedXml(): xml.Node = {
    // ----- Dupl code [4AKB2F0]
    val postsInclForbidden = readOnlyTransaction { tx =>
      tx.loadPostsSkipTitles(limit = 20, OrderBy.MostRecentFirst, byUserId = None)
    }
    val pageIdsInclForbidden = postsInclForbidden.map(_.pageId).toSet
    val pageMetaById = getPageMetasAsMap(pageIdsInclForbidden)
    val posts = for {
      post <- postsInclForbidden
      pageMeta <- pageMetaById.get(post.pageId)
      if maySeePostUseCache(post, pageMeta, user = None, maySeeUnlistedPages = false)._1
    } yield post
    val pageIds = posts.map(_.pageId).distinct
    val pageStuffById = getPageStuffById(pageIds)
    // ----- /Dupl code

    if (posts.isEmpty)
      throwNotFound("TyENOFEED", "No posts found, or they are private")

    val origin = theSiteOrigin()
    debiki.AtomFeedXml.renderFeed(origin, posts, pageStuffById)
  }


  private def feedKey = MemCacheKey(siteId, "FeedKey")

}

