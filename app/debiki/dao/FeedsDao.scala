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
import debiki.EdHttp.{throwForbiddenIf, throwNotFound}
import debiki.RateLimits
import ed.server.http.ApiRequest


/** Generates and caches Atom feeds for recent comments or recent topics.
  */
trait FeedsDao {
  self: SiteDao =>


  memCache.onPageCreated { sitePageId =>
    emptyFeedsCache()
  }

  memCache.onPageSaved { sitePageId =>
    emptyFeedsCache()
  }

  private def emptyFeedsCache(): Unit = {   // (CACHHHEE)
    memCache.remove(siteFeedKey(SysbotUserId))
    memCache.remove(siteFeedKey(NoUserId))
    memCache.remove(commentsFeedKey(SysbotUserId))
    memCache.remove(commentsFeedKey(NoUserId))
  }

  def getAtomFeedXml(request: ApiRequest[_], onlyEmbeddedComments: Boolean)
        : xml.Node = {
    import request.{requester => anyRequester}

    // Cache only the Sysbot user's requests (for now at least),
    // So won't need to add complicated clear-cache code now.  (CACHHHEE)
    if (anyRequester.exists(_.id != SysbotUserId)) {
      self.context.rateLimiter.rateLimit(RateLimits.ExpensiveGetRequest, request)
      return loadAtomFeedXml(anyRequester, onlyEmbComments = onlyEmbeddedComments)
    }

    // This'll be NoUserId or SysbotUserId, see above.
    val pptId = anyRequester.map(requester => {
      if (requester.isAuthenticated) requester.id
      else NoUserId
    }) getOrElse NoUserId

    dieIf(pptId != NoUserId && pptId != SysbotUserId, "TyE502RKSEH5") // (CACHHHEE)

    val key = onlyEmbeddedComments ? commentsFeedKey(pptId) | siteFeedKey(pptId)

    memCache.lookup[xml.Node](key, orCacheAndReturn = Some {
      loadAtomFeedXml(anyRequester, onlyEmbComments = onlyEmbeddedComments)
    }) getOrDie "TyE5KBR7JQ0"
  }


  def loadAtomFeedXml(anyRequester: Option[Participant], onlyEmbComments: Boolean)
        : xml.Node = {
    val LoadPostsResult(postsOneMaySee, pageStuffById) =
          loadPostsMaySeeByQuery(
                anyRequester, OrderBy.MostRecentFirst, limit = 25,
                inclUnapprovedPosts = false, inclTitles = false,
                onlyEmbComments = onlyEmbComments,
                inclUnlistedPagePosts = onlyEmbComments,
                writtenById = None)

    if (postsOneMaySee.isEmpty)
      throwNotFound("TyE0FEEDPOSTS", "No posts found, or they are private")

    val origin = theSiteOrigin()
    debiki.AtomFeedXml.renderFeed(origin, postsOneMaySee, pageStuffById,
          isForEmbeddedComments = onlyEmbComments)
  }


  private def siteFeedKey(pptId: UserId) = MemCacheKey(siteId, s"$pptId|FeedKey")
  private def commentsFeedKey(pptId: UserId) = MemCacheKey(siteId, s"$pptId|CmtsFeedKey")

}

