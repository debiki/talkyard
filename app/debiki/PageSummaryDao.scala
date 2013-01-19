/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package debiki

import com.debiki.v0._
import controllers.SiteAssetBundles
import java.{util => ju}
import Prelude._
import CachingAssetBundleDao._


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
  self: TenantDao =>

  val ExcerptLength = 120

  def loadPageSummaries(pageIds: Seq[String]): Map[String, PageSummary] = {
    var summariesById = Map[String, PageSummary]()

    for (pageId <- pageIds; page <- loadPage(pageId); body <- page.body) {
      var numPostsApproved = 0
      var numPostsRejected = 0
      var numPostsPendingReview = 0
      var numPostsFlagged = 0
      var numPostsDeleted = 0
      var lastDefiniteApprovalDati = Option(new ju.Date(0))

      val posts: Seq[ViPo] = page.posts.map(post => page.vipo_!(post.id))
      for (post <- posts) {
        if (post.isDeleted) numPostsDeleted += 1
        else if (!post.currentVersionReviewed || post.currentVersionPrelApproved)
          numPostsPendingReview += 1
        else if (post.currentVersionRejected) numPostsRejected += 1
        else numPostsApproved += 1

        if (post.flagsDescTime.nonEmpty) numPostsFlagged += 1

        if (post.currentVersionApproved && !post.currentVersionPrelApproved &&
          lastDefiniteApprovalDati.get.getTime < post.lastApprovalDati.get.getTime) {
          lastDefiniteApprovalDati = post.lastApprovalDati
        }
      }

      if (lastDefiniteApprovalDati.get.getTime == 0)
        lastDefiniteApprovalDati = None

      val excerpt =
        if (body.text.length <= ExcerptLength + 3) body.text
        else body.text.take(ExcerptLength) + "..."

      val summary = PageSummary(
        title = page.titleText getOrElse ("(No title)"),
        textExcerpt = excerpt,
        authorDisplayName = body.user_!.displayName,
        authorUserId = body.user_!.id,
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
  self: TenantDao with CachingDao =>

}



object CachingPageSummaryDao {

}
