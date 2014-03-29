/**
 * Copyright (C) 2012 Kaj Magnus Lindberg (born 1979)
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
import java.{util => ju}
import CachingDao.{CacheKey, CacheValue}


/**
 * A mostly up-to-date summary of a page, e.g. title, body excerpt, comment counts.
 * Because of race conditions, it might not be completely accurate.
 */
case class PageSummary(
  title: String,
  textExcerpt: String,
  authorDisplayName: String,
  authorUserId: String,
  numContributors: Int,
  numActions: Int,
  numPostsApproved: Int,
  numPostsRejected: Int,
  numPostsPendingReview: Int,
  numPostsFlagged: Int,
  numPostsDeleted: Int,
  lastApprovedPostDati: Option[ju.Date])



trait PageSummaryDao {
  self: SiteDao =>

  val ExcerptLength = 500

  val logger = play.api.Logger("app.page-summary-dao")


  /**
   * Ignores race conditions, for example another thread that updates
   * a page when this function is generating a summary for that page.
   * They're ignored because I don't think it matters terribly much if e.g.
   * the reply count for one topic is +-1 incorrect... once a year or so?
   */
  def loadPageSummaries(pageIds: Seq[String]): Map[String, PageSummary] = {
    var summariesById = Map[String, PageSummary]()

    for {
      pageId <- pageIds
      page <- loadPageParts(pageId)
      author = (page.body orElse page.title).flatMap(_.user) getOrElse {
        logger.warn(s"No author loaded for page `$pageId' [error DwE903Ik2]")
        DummyPage.DummyAuthorUser
      }
    } {
      var numPostsApproved = 0
      var numPostsRejected = 0
      var numPostsPendingReview = 0
      var numPostsFlagged = 0
      var numPostsDeleted = 0
      var lastDefiniteApprovalDati = Option(new ju.Date(0))

      val posts: Seq[Post] = page.getAllPosts
      for (post <- posts) {

        // Update reply counts.
        if (post.isArticleOrConfig) { } // Ignore, this is no reply.
        else if (post.isDeletedSomehow) numPostsDeleted += 1
        else if (!post.currentVersionPermReviewed) numPostsPendingReview += 1
        else if (post.currentVersionRejected) numPostsRejected += 1
        else numPostsApproved += 1

        // Update spam and other unpleasantries info.
        if (post.flagsDescTime.nonEmpty) numPostsFlagged += 1

        // Update timestamps.
        if (post.currentVersionApproved && !post.currentVersionPrelApproved &&
          lastDefiniteApprovalDati.get.getTime < post.lastApprovalDati.get.getTime) {
          lastDefiniteApprovalDati = post.lastApprovalDati
        }
      }

      if (lastDefiniteApprovalDati.get.getTime == 0)
        lastDefiniteApprovalDati = None

      val excerpt: String = page.approvedBodyText match {
        case None => ""
        case Some(text) =>
          if (text.length <= ExcerptLength + 3) text
          else text.take(ExcerptLength) + "..."
      }

      val summary = PageSummary(
        title = page.approvedTitleTextOrNoTitle,
        textExcerpt = excerpt,
        authorDisplayName = author.displayName,
        authorUserId = author.id,
        numContributors = page.people.users.length,
        numActions = page.allActions.length,
        numPostsApproved = numPostsApproved,
        numPostsRejected = numPostsRejected,
        numPostsPendingReview = numPostsPendingReview,
        numPostsFlagged = numPostsFlagged,
        numPostsDeleted = numPostsDeleted,
        lastApprovedPostDati = lastDefiniteApprovalDati)

      summariesById += pageId -> summary
    }

    summariesById
  }

}



trait CachingPageSummaryDao extends PageSummaryDao {
  self: SiteDao with CachingDao =>

  onPageSaved { sitePageId =>
    removeFromCache(cacheKey(sitePageId))
  }


  override def loadPageSummaries(pageIds: Seq[String]): Map[String, PageSummary] = {
    var summariesById = Map[String, PageSummary]()
    var idsNotCached = List[String]()

    // Look up summaries in cache.
    for (pageId <- pageIds) {
      val anySummary = lookupInCache[PageSummary](cacheKey(pageId))
      anySummary match {
        case Some(summary) => summariesById += pageId -> summary
        case None => idsNotCached ::= pageId
      }
    }

    // Ask the database for any remaining summaries.
    val siteCacheVersion = siteCacheVersionNow()
    val reaminingSummaries = super.loadPageSummaries(idsNotCached)
    for ((pageId, summary) <- reaminingSummaries) {
      summariesById += pageId -> summary
      putInCache(cacheKey(pageId), CacheValue(summary, siteCacheVersion))
    }

    summariesById
  }


  private def cacheKey(pageId: String, otherSiteId: String = null): CacheKey = {
    val theSiteId = if (otherSiteId ne null) otherSiteId else siteId
    CacheKey(theSiteId, s"$pageId|PageSummary")
  }


  private def cacheKey(sitePageId: SitePageId): CacheKey =
    cacheKey(otherSiteId = sitePageId.siteId, pageId = sitePageId.pageId)

}



object CachingPageSummaryDao {

}
