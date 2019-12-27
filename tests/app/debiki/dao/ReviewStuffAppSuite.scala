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
import org.scalatest._


class ReviewStuffAppSuite(randomString: String)
  extends DaoAppSuite(disableScripts = true, disableBackgroundJobs = true, butEnableJanitor = true) {

  private def r = randomString
  var nameCounter = 0

  class NestedPostsSuite extends FreeSpec with MustMatchers with BeforeAndAfterAll {
    var thePageId: PageId = _
    lazy val theAdmin: Participant =  createPasswordOwner(s"aaddmm_${nextNameNr}_$r", dao)
    lazy val dao: SiteDao = {
      globals.systemDao.getOrCreateFirstSite()
      globals.siteDao(Site.FirstSiteId)
    }
    lazy val categoryId: CategoryId =
      dao.createForum("Forum", s"/forum-$nextNameNr-$r/", isForEmbCmts = false,
        Who(theAdmin.id, browserIdData)).get.defaultCategoryId

    def whoAdmin: Who = Who(theAdmin.id, browserIdData)

    def nextNameNr: Int = { nameCounter += 1; nameCounter }

    def newAdminAndPage() {
      thePageId = dao.createPage(PageType.Discussion, PageStatus.Published,
        anyCategoryId = Some(categoryId), anyFolder = Some("/"), anySlug = Some(""),
        titleTextAndHtml = textAndHtmlMaker.testTitle("title_62952 $r"),
        bodyTextAndHtml = textAndHtmlMaker.testBody("discussion_230593 $r"),
        showId = true, deleteDraftNr = None,
        Who(theAdmin.id, browserIdData), dummySpamRelReqStuff).pageId
    }

    def testAdminsRepliesApproved(adminId: UserId, pageId: PageId) {
      for (i <- 1 to 10) {
        val result = dao.insertReply(textAndHtmlMaker.testBody(s"reply_9032372 $r, i = $i"), pageId,
          replyToPostNrs = Set(PageParts.BodyNr), PostType.Normal, deleteDraftNr = None,
          Who(adminId, browserIdData), dummySpamRelReqStuff)
        result.post.isCurrentVersionApproved mustBe true
        result.post.approvedById mustBe Some(adminId)
      }
    }

    def reply(memberId: UserId, text: String): InsertPostResult = {
      dao.insertReply(textAndHtmlMaker.testBody(text), thePageId,
        replyToPostNrs = Set(PageParts.BodyNr), PostType.Normal, deleteDraftNr = None,
        Who(memberId, browserIdData), dummySpamRelReqStuff)
    }

    def approveButUndo(reviewTask: ReviewTask) {
      dao.makeReviewDecisionIfAuthz(Seq(reviewTask.id), whoAdmin,anyRevNr = Some(FirstRevisionNr),
        ReviewDecision.Accept)
      val wasUndone = dao.tryUndoReviewDecisionIfAuthz(reviewTask.id, whoAdmin)
      dieUnless(wasUndone, "TyE4KDWS0")
    }

    def approve(reviewTask: ReviewTask) {
      dao.makeReviewDecisionIfAuthz(Seq(reviewTask.id), whoAdmin, anyRevNr = Some(FirstRevisionNr),
        ReviewDecision.Accept)
      // Wait until the Janitor has carried out the decision. [5YMBWQT]
      globals.testFastForwardTimeMillis((ReviewDecision.UndoTimoutSeconds + 1) * MillisPerSecond)
      var delay = 100
      var total = 0
      while (true) {
        val task = dao.readOnlyTransaction(_.loadReviewTask(reviewTask.id)).get
        if (task.completedAt.isDefined)
          return
        dieIf(total > 5000, "TyE4UKGWT20", "The Janitor isn't working? Or you debug paused?")
        System.out.println(s"Waitig for the Janitor to carry out review decision ${reviewTask.id}...")
        Thread.sleep(delay)
        total += delay
        delay = (delay * 1.5).toInt
      }
    }

    def checkReviewTaskGenerated(post: Post, reasons: Seq[ReviewReason]) {
      dao.readOnlyTransaction { transaction =>
        val task = transaction.loadPendingPostReviewTask(post.id) getOrElse {
          fail("No review task generated for post with text: " + post.currentSource)
        }
        task.createdById mustBe SystemUserId
        task.maybeBadUserId mustBe post.createdById
        reasons.foreach(task.reasons must contain(_))
        task.createdAtRevNr mustBe Some(FirstRevisionNr)
        task.postId mustBe Some(post.id)
        task.postNr mustBe Some(post.nr)
      }
    }

    def checkNoReviewTask(post: Post) {
      dao.readOnlyTransaction { transaction =>
        transaction.loadPendingPostReviewTask(post.id) mustBe None
      }
    }
  }

}
