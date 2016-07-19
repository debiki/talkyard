/**
 * Copyright (c) 2015 Kaj Magnus Lindberg
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
import debiki.{Globals, TextAndHtml}
import io.efdi.server.Who
import org.scalatest._
import org.scalatestplus.play.OneAppPerSuite
import play.api.test.FakeApplication


class ReviewStuffAppSuite(randomString: String)
  extends DaoAppSuite(disableScripts = true, disableBackgroundJobs = true) {

  def r = randomString
  var nameCounter = 0

  class NestedPostsSuite extends FreeSpec with MustMatchers with BeforeAndAfterAll {
    var thePageId: PageId = null
    lazy val theAdmin: User =  createPasswordOwner(s"aaddmm_${nextNameNr}_$r", dao)
    lazy val dao: SiteDao = Globals.siteDao(Site.FirstSiteId)
    lazy val categoryId: CategoryId =
      dao.createForum("Forum", s"/forum-$nextNameNr-$r/",
        Who(theAdmin.id, browserIdData)).uncategorizedCategoryId

    def nextNameNr = { nameCounter += 1; nameCounter }

    def newAdminAndPage() = {
      thePageId = dao.createPage(PageRole.Discussion, PageStatus.Published,
        anyCategoryId = Some(categoryId), anyFolder = Some("/"), anySlug = Some(""),
        titleTextAndHtml = TextAndHtml.testTitle("title_62952 $r"),
        bodyTextAndHtml = TextAndHtml.testBody("discussion_230593 $r"),
        showId = true, Who(theAdmin.id, browserIdData)).thePageId
    }

    def testAdminsRepliesApproved(adminId: UserId, pageId: PageId) {
      for (i <- 1 to 10) {
        val result = dao.insertReply(TextAndHtml.testBody(s"reply_9032372 $r, i = $i"), pageId,
          replyToPostNrs = Set(PageParts.BodyNr), PostType.Normal, Who(adminId, browserIdData))
        result.post.isCurrentVersionApproved mustBe true
        result.post.approvedById mustBe Some(adminId)
      }
    }

    def reply(memberId: UserId, text: String): InsertPostResult = {
      dao.insertReply(TextAndHtml.testBody(text), thePageId,
        replyToPostNrs = Set(PageParts.BodyNr), PostType.Normal, Who(memberId, browserIdData))
    }

    def approve(reviewTask: ReviewTask): Unit = {
      dao.completeReviewTask(reviewTask.id, theAdmin.id, anyRevNr = Some(FirstRevisionNr),
        ReviewAction.Accept, browserIdData)
    }

    def checkReviewTaskGenerated(post: Post, reasons: Seq[ReviewReason]) {
      dao.readOnlyTransaction { transaction =>
        val task = transaction.loadPendingPostReviewTask(post.uniqueId) getOrElse {
          fail("No review task generated for post with text: " + post.currentSource)
        }
        task.causedById mustBe post.createdById
        reasons.foreach(task.reasons must contain(_))
        task.createdAtRevNr mustBe Some(FirstRevisionNr)
        task.postId mustBe Some(post.uniqueId)
        task.postNr mustBe Some(post.nr)
      }
    }

    def checkNoReviewTask(post: Post) {
      dao.readOnlyTransaction { transaction =>
        transaction.loadPendingPostReviewTask(post.uniqueId) mustBe None
      }
    }
  }

}
