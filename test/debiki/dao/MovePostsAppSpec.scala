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
import com.debiki.core.PageParts.{BodyNr, TitleNr}
import debiki.DebikiHttp.ResultException
import debiki.{TextAndHtml, Globals}
import java.{util => ju}


class MovePostsAppSpec extends DaoAppSuite(disableScripts = true, disableBackgroundJobs = true) {
  lazy val dao = Globals.siteDao(Site.FirstSiteId)
  lazy val theModerator: User = createPasswordModerator("move_mod", dao)
  lazy val theMember: User = createPasswordUser("move_mbr", dao)
  var thePageId: PageId = _

  def reply(memberId: UserId, text: String, parentNr: Option[PostNr] = None): Post = {
    dao.insertReply(TextAndHtml.testBody(text), thePageId,
      replyToPostNrs = Set(parentNr getOrElse PageParts.BodyNr), PostType.Normal,
      Who(memberId, browserIdData), dummySpamRelReqStuff).post
  }

  "The Dao can move posts" - {
    val now = new ju.Date()

    "move one posts, but must be staff" in {
      thePageId = createPage(PageRole.Discussion, TextAndHtml.testTitle("Title"),
        TextAndHtml.testBody("body"), SystemUserId, browserIdData, dao)
      val firstParent = reply(theModerator.id, "1st parent")
      val secondParent = reply(theModerator.id, "2nd parent")
      val postToMove = reply(theModerator.id, "to move", Some(firstParent.nr))
      val metaBefore = dao.readOnlyTransaction(_.loadThePageMeta(thePageId))

      info("non-staff may not move the post")
      intercept[ResultException] {
        dao.movePostIfAuth(
          postToMove.pagePostId, secondParent.pagePostNr, theMember.id, browserIdData)
      }.getMessage must include("EsE6YKG2_")

      info("staff may move it")
      val postAfter = dao.movePostIfAuth(
        postToMove.pagePostId, secondParent.pagePostNr, theModerator.id, browserIdData)._1
      postAfter.parentNr mustBe Some(secondParent.nr)
      val reloadedPost = dao.readOnlyTransaction(_.loadThePost(postToMove.uniqueId))
      reloadedPost.parentNr mustBe Some(secondParent.nr)

      info("page meta unchanged")
      val metaAfter = dao.readOnlyTransaction(_.loadThePageMeta(thePageId))
      metaBefore mustBe metaAfter
    }

    "won't do bad things" in {
      thePageId = createPage(PageRole.Discussion, TextAndHtml.testTitle("Title"),
        TextAndHtml.testBody("body"), SystemUserId, browserIdData, dao)
      val firstReply = reply(theModerator.id, "1st reply")
      val secondReply = reply(theModerator.id, "2nd reply")
      val (titleId, bodyId) = dao.readOnlyTransaction { transaction =>
        (transaction.loadThePost(thePageId, TitleNr).uniqueId,
         transaction.loadThePost(thePageId, BodyNr).uniqueId)
      }

      info("refuses to move orig post title")
      intercept[ResultException] {
        dao.movePostIfAuth(
          PagePostId(thePageId, titleId), secondReply.pagePostNr, theModerator.id, browserIdData)
      }.getMessage must include("EsE7YKG25_")

      info("refuses to move orig post body")
      intercept[ResultException] {
        dao.movePostIfAuth(
          PagePostId(thePageId, bodyId), secondReply.pagePostNr, theModerator.id, browserIdData)
      }.getMessage must include("EsE7YKG25_")

      info("refuses to place reply below title")
      intercept[ResultException] {
        dao.movePostIfAuth(
          PagePostId(thePageId, secondReply.uniqueId), PagePostNr(thePageId, TitleNr),
          theModerator.id, browserIdData)
      }.getMessage must include("EsE4YKJ8_")

      info("won't try to move a post that doesn't exist")
      intercept[PostNotFoundByIdException] {
        dao.movePostIfAuth(
          PagePostId(thePageId, 9999), secondReply.pagePostNr, theModerator.id, browserIdData)
      }

      info("refuses to place reply below non-existing post")
      intercept[ResultException] {
        dao.movePostIfAuth(
          PagePostId(thePageId, secondReply.uniqueId), PagePostNr(thePageId, 9999),
          theModerator.id, browserIdData)
      }.getMessage must include("EsE7YKG42_")
    }

    "won't create cycles" in {
      thePageId = createPage(PageRole.Discussion, TextAndHtml.testTitle("Title"),
        TextAndHtml.testBody("body"), SystemUserId, browserIdData, dao)
      val postA = reply(theModerator.id, "A")
      val postB = reply(theModerator.id, "B", parentNr = Some(postA.nr))
      val postC = reply(theModerator.id, "C", parentNr = Some(postB.nr))
      val postC2 = reply(theModerator.id, "C2", parentNr = Some(postB.nr))
      val postD = reply(theModerator.id, "D", parentNr = Some(postC.nr))

      info("won't create A —> B —> A")
      intercept[ResultException] {
        dao.movePostIfAuth(postA.pagePostId, postB.pagePostNr, theModerator.id, browserIdData)
      }.getMessage must include("EsE7KCCL_")

      info("won't create A —> B –> C —> A")
      intercept[ResultException] {
        dao.movePostIfAuth(postA.pagePostId, postC.pagePostNr, theModerator.id, browserIdData)
      }.getMessage must include("EsE7KCCL_")

      info("agrees to move D from C to C2, fine")
      dao.movePostIfAuth(postD.pagePostId, postC2.pagePostNr, theModerator.id, browserIdData)
      val reloadedD = dao.readOnlyTransaction(_.loadThePost(postD.uniqueId))
      reloadedD.parentNr mustBe Some(postC2.nr)

      info("won't create C2 —> D —> C2")
      intercept[ResultException] {
        dao.movePostIfAuth(postC2.pagePostId, postD.pagePostNr, theModerator.id, browserIdData)
      }.getMessage must include("EsE7KCCL_")

      info("but agrees to move C from to D, fine")
      dao.movePostIfAuth(postC.pagePostId, postD.pagePostNr, theModerator.id, browserIdData)
      val reloadedC = dao.readOnlyTransaction(_.loadThePost(postC.uniqueId))
      reloadedC.parentNr mustBe Some(postD.nr)
    }

    "move a post A... with many descendants to X –> Y —> A..." in {
      thePageId = createPage(PageRole.Discussion, TextAndHtml.testTitle("Title"),
        TextAndHtml.testBody("body"), SystemUserId, browserIdData, dao)
      val postA = reply(theModerator.id, "A")
      val postB = reply(theModerator.id, "B", parentNr = Some(postA.nr))
      val postC = reply(theModerator.id, "C", parentNr = Some(postB.nr))
      val postC2 = reply(theModerator.id, "C2", parentNr = Some(postB.nr))
      val postX = reply(theModerator.id, "X")
      val postY = reply(theModerator.id, "Y", parentNr = Some(postX.nr))

      dao.movePostIfAuth(postA.pagePostId, postY.pagePostNr, theModerator.id, browserIdData)

      dao.readOnlyTransaction { transaction =>
        val pageParts = PageDao(thePageId, transaction).parts
        pageParts.thePost(postY.nr).parentNr mustBe Some(postX.nr)
        pageParts.ancestorsOf(postY.nr).map(_.nr) mustBe Seq(postX.nr, BodyNr)
        pageParts.ancestorsOf(postA.nr).map(_.nr) mustBe Seq(postY.nr, postX.nr, BodyNr)
        pageParts.ancestorsOf(postC.nr).map(_.nr) mustBe Seq(
          postB.nr, postA.nr, postY.nr, postX.nr, BodyNr)
      }
    }

    "move one post to another page" in {
      thePageId = createPage(PageRole.Discussion, TextAndHtml.testTitle("Page One"),
        TextAndHtml.testBody("Body one."), SystemUserId, browserIdData, dao)

      val pageTwoId = createPage(PageRole.Discussion, TextAndHtml.testTitle("Page Two"),
        TextAndHtml.testBody("Body two."), SystemUserId, browserIdData, dao)
      val postOnPageTwo = dao.insertReply(TextAndHtml.testBody("Post on page 2."), pageTwoId,
        replyToPostNrs = Set(PageParts.BodyNr), PostType.Normal,
        Who(SystemUserId, browserIdData = browserIdData), dummySpamRelReqStuff).post

      // Create after page 2 so becomes the most recent one.
      val post = reply(theModerator.id, "A post.")

      val fromPageMetaBefore = dao.readOnlyTransaction(_.loadThePageMeta(thePageId))
      val toPageMetaBefore = dao.readOnlyTransaction(_.loadThePageMeta(pageTwoId))

      info("move it")
      val postAfter = dao.movePostIfAuth(post.pagePostId, postOnPageTwo.pagePostNr,
        theModerator.id, browserIdData)._1

      postAfter.pageId mustBe pageTwoId
      postAfter.parentNr mustBe Some(postOnPageTwo.nr)

      val reloadedPost = dao.readOnlyTransaction(_.loadThePost(post.uniqueId))
      reloadedPost.pageId mustBe pageTwoId
      reloadedPost.parentNr mustBe Some(postOnPageTwo.nr)

      info("from page meta properly updated")
      val fromPageMetaAfter = dao.readOnlyTransaction(_.loadThePageMeta(thePageId))
      fromPageMetaAfter mustBe fromPageMetaBefore.copy(
        updatedAt = fromPageMetaAfter.updatedAt,
        frequentPosterIds = Nil,
        lastReplyAt = None,
        lastReplyById = None,
        numOrigPostRepliesVisible = fromPageMetaBefore.numRepliesVisible - 1,
        numRepliesVisible = fromPageMetaBefore.numRepliesVisible - 1,
        numRepliesTotal = fromPageMetaBefore.numRepliesTotal - 1,
        version = toPageMetaBefore.version + 1)

      info("to page meta properly updated")
      val toPageMetaAfter = dao.readOnlyTransaction(_.loadThePageMeta(pageTwoId))
      toPageMetaAfter mustBe toPageMetaBefore.copy(
        updatedAt = toPageMetaAfter.updatedAt,
        // The System user = OP author, so skipped. The moved post = skipped since is most recent.
        frequentPosterIds = Nil,
        lastReplyAt = Some(postAfter.createdAt),
        lastReplyById = Some(postAfter.createdById),
        numOrigPostRepliesVisible = toPageMetaBefore.numRepliesVisible + 0, // not an OP reply
        numRepliesVisible = toPageMetaBefore.numRepliesVisible + 1,
        numRepliesTotal = toPageMetaBefore.numRepliesTotal + 1,
        version = toPageMetaBefore.version + 1)

      info("post read stats moved to new page")
    }

    "move a tree to another page" in {
      thePageId = createPage(PageRole.Discussion, TextAndHtml.testTitle("Page One"),
        TextAndHtml.testBody("Body one."), SystemUserId, browserIdData, dao)
      val postA = reply(theModerator.id, "A")
      val postB = reply(theModerator.id, "B", parentNr = Some(postA.nr))
      val postC = reply(theModerator.id, "C", parentNr = Some(postB.nr))
      val postD = reply(theModerator.id, "D", parentNr = Some(postC.nr))
      val postD2 = reply(theModerator.id, "D2", parentNr = Some(postC.nr))
      val otherPost = reply(theModerator.id, "Other")

      val pageTwoId = createPage(PageRole.Discussion, TextAndHtml.testTitle("Page Two"),
        TextAndHtml.testBody("Body two."), SystemUserId, browserIdData, dao)
      val postOnPageTwo = dao.insertReply(TextAndHtml.testBody("Post on page 2."), pageTwoId,
        replyToPostNrs = Set(PageParts.BodyNr), PostType.Normal,
        Who(SystemUserId, browserIdData = browserIdData), dummySpamRelReqStuff).post

      info("can move the tree")
      val postAfterMove = dao.movePostIfAuth(postA.pagePostId, postOnPageTwo.pagePostNr,
        theModerator.id, browserIdData)._1
      postAfterMove.pageId mustBe pageTwoId
      postAfterMove.parentNr mustBe Some(postOnPageTwo.nr)

      info("tree gone one first page, present on second instead")
      val maxNewNr = dao.readOnlyTransaction { transaction =>
        val firstParts = PageDao(thePageId, transaction).parts
        firstParts.post(postA.nr) mustBe None
        firstParts.post(postB.nr) mustBe None
        firstParts.post(postC.nr) mustBe None
        firstParts.post(postD.nr) mustBe None
        firstParts.post(postD2.nr) mustBe None

        val secondPage = PageDao(pageTwoId, transaction)
        val postAAfter = secondPage.parts.thePostById(postA.uniqueId)
        val postBAfter = secondPage.parts.thePostById(postB.uniqueId)
        val postCAfter = secondPage.parts.thePostById(postC.uniqueId)
        val postDAfter = secondPage.parts.thePostById(postD.uniqueId)
        val postD2After = secondPage.parts.thePostById(postD2.uniqueId)

        postAAfter.parentNr mustBe Some(postOnPageTwo.nr)
        postBAfter.parentNr mustBe Some(postAAfter.nr)
        postCAfter.parentNr mustBe Some(postBAfter.nr)
        postDAfter.parentNr mustBe Some(postCAfter.nr)
        postD2After.parentNr mustBe Some(postCAfter.nr)

        secondPage.parts.ancestorsOf(postD2After.nr).map(_.nr) mustBe Seq(
          postCAfter.nr, postBAfter.nr, postAAfter.nr, postOnPageTwo.nr, BodyNr)

        secondPage.parts.highestReplyNr getOrDie "EsE6Y8WQ0"
      }

      info("can add replies to the original page")
      val lastReplyOrigPage = reply(theModerator.id, "Last reply.")
      lastReplyOrigPage.nr mustBe (otherPost.nr + 1)

      info("can add replies to the new page")
      val lastPostPageTwo = dao.insertReply(TextAndHtml.testBody("Last post, page 2."), pageTwoId,
        replyToPostNrs = Set(maxNewNr), PostType.Normal, Who(SystemUserId, browserIdData),
        dummySpamRelReqStuff).post
      lastPostPageTwo.nr mustBe (maxNewNr + 1)
    }

    "moves post read stats to new page" in {
      val ip = "1.2.3.4"
      thePageId = createPage(PageRole.Discussion, TextAndHtml.testTitle("Page One"),
        TextAndHtml.testBody("Body one."), SystemUserId, browserIdData, dao)
      val postUnread = reply(theModerator.id, "Not read, won't move")
      val postRead = reply(theModerator.id, "Won't move this.")
      val postToMove = reply(theModerator.id, "Will move this.")

      val pageTwoId = createPage(PageRole.Discussion, TextAndHtml.testTitle("Page Two"),
        TextAndHtml.testBody("Body two."), SystemUserId, browserIdData, dao)
      val postOnPageTwo = dao.insertReply(TextAndHtml.testBody("Post on page 2."), pageTwoId,
        replyToPostNrs = Set(PageParts.BodyNr), PostType.Normal,
        Who(SystemUserId, browserIdData = browserIdData), dummySpamRelReqStuff).post

      val fromPageMetaBefore = dao.readOnlyTransaction(_.loadThePageMeta(thePageId))
      val toPageMetaBefore = dao.readOnlyTransaction(_.loadThePageMeta(pageTwoId))

      info("create post read stats, find on first page")
      dao.readWriteTransaction(_.updatePostsReadStats(
        thePageId, Set(postRead.nr, postToMove.nr), theModerator.id, ip))

      val fromPageReadStatsBefore = dao.readOnlyTransaction(_.loadPostsReadStats(thePageId))
      fromPageReadStatsBefore.guestIpsByPostNr.get(postUnread.nr) mustBe None
      fromPageReadStatsBefore.guestIpsByPostNr.get(postRead.nr) mustBe None
      fromPageReadStatsBefore.guestIpsByPostNr.get(postToMove.nr) mustBe None
      fromPageReadStatsBefore.roleIdsByPostNr.get(postUnread.nr) mustBe None
      fromPageReadStatsBefore.roleIdsByPostNr.get(postRead.nr) mustBe Some(Set(theModerator.id))
      fromPageReadStatsBefore.roleIdsByPostNr.get(postToMove.nr) mustBe Some(Set(theModerator.id))

      info("move a post")
      val postAfter = dao.movePostIfAuth(postToMove.pagePostId, postOnPageTwo.pagePostNr,
        theModerator.id, browserIdData)._1
      postAfter.pageId mustBe pageTwoId
      postAfter.parentNr mustBe Some(postOnPageTwo.nr)

      info("post read stats moved to new page")
      val fromPageReadStatsAfter = dao.readOnlyTransaction(_.loadPostsReadStats(thePageId))
      val toPageReadStatsAfter = dao.readOnlyTransaction(_.loadPostsReadStats(pageTwoId))

      fromPageReadStatsAfter.guestIpsByPostNr.get(postUnread.nr) mustBe None
      fromPageReadStatsAfter.guestIpsByPostNr.get(postRead.nr) mustBe None
      fromPageReadStatsAfter.guestIpsByPostNr.get(postToMove.nr) mustBe None
      fromPageReadStatsAfter.roleIdsByPostNr.get(postUnread.nr) mustBe None
      fromPageReadStatsAfter.roleIdsByPostNr.get(postRead.nr) mustBe Some(Set(theModerator.id))
      fromPageReadStatsAfter.roleIdsByPostNr.get(postToMove.nr) mustBe None

      toPageReadStatsAfter.guestIpsByPostNr.get(postOnPageTwo.nr) mustBe None
      toPageReadStatsAfter.guestIpsByPostNr.get(postAfter.nr) mustBe None
      toPageReadStatsAfter.roleIdsByPostNr.get(postOnPageTwo.nr) mustBe None
      toPageReadStatsAfter.roleIdsByPostNr.get(postAfter.nr) mustBe Some(Set(theModerator.id))
    }
  }

}
