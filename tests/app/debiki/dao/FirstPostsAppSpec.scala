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

import scala.collection.Seq
import com.debiki.core._
import com.debiki.core.Prelude._
import debiki.EdHttp.ResultException


class FirstPostsAppSpec extends ReviewStuffAppSuite("4fy2") {  // TyTIT205RKDJ4

  val reviewReasons = Seq(ReviewReason.NewPost, ReviewReason.IsByNewUser)

  override def nestedSuites = Vector(
    new NestedPostsSuite {
      "PostsDao will, by default:" - {
        "approve replies by a new admin" in {
          newAdminAndPage()
          testAdminsRepliesApproved(theAdmin.id, thePageId)
        }
      }
      "allow new members by default" in {
        val member = createPasswordUser(s"mem_78201", dao)
        reply(member.id, "reply_04285_a").post.approvedById mustBe Some(SystemUserId)
        reply(member.id, "reply_04285_b").post.approvedById mustBe Some(SystemUserId)
        reply(member.id, "reply_04285_c").post.approvedById mustBe Some(SystemUserId)
      }
    },

    new NestedPostsSuite {
      override def beforeAll: Unit = {
        dao.saveSiteSettings(SettingsToSave(
          orgFullName = Some(Some("Test Org Name")),
          maxPostsPendApprBefore = Some(Some(1)),
          numFirstPostsToApprove = Some(Some(1)),
          numFirstPostsToReview = Some(Some(0))), Who.System)
      }

      "PostsDao will, with approve = 1 and allow = undef, 1, 2" - {
        "approve all replies by a new admin" in {
          newAdminAndPage()
          testAdminsRepliesApproved(theAdmin.id, thePageId)
        }

        "allow then reject posts by a new member" in {
          val member = createPasswordUser(s"mem_863439", dao)

          info("allow one")
          val firstReplyResult = reply(member.id, "reply_863439_a")
          firstReplyResult.post.isSomeVersionApproved mustBe false
          checkReviewTaskGenerated(firstReplyResult.post, reviewReasons)

          info("then reject")
          intercept[ResultException] {
            reply(member.id, "reply_863439_b")
          }.getMessage must include("_EsE6YKF2_")

          info("accept one more when allow = 2")
          dao.saveSiteSettings(SettingsToSave(maxPostsPendApprBefore = Some(Some(2))), Who.System)
          val secondReplyResult = reply(member.id, "reply_863439_d")
          secondReplyResult.post.isSomeVersionApproved mustBe false

          info("but generate no review task, because Approve + Notify = 1 + 0 = only 1st reviewed")
          checkReviewTaskGenerated(secondReplyResult.post, reviewReasons)

          info("then reject again")
          intercept[ResultException] {
            reply(member.id, "reply_863439_e")
          }.getMessage must include("_EsE6YKF2_")

          info("approve — but undo the approval ...")
          approveButUndo(firstReplyResult.reviewTask.get)
          var firstReply2 = dao.loadPost(thePageId, firstReplyResult.post.nr).get
          firstReply2.approvedById mustBe None

          info("approve the very first post (this waits until undo timeout has elapsed)...")
          approve(firstReplyResult.reviewTask.get)
          firstReply2 = dao.loadPost(thePageId, firstReplyResult.post.nr).get
          firstReply2.approvedById mustBe Some(theAdmin.id)

          info("cannot undo approval any longer (because the undo timeout has elapsed)...")
          val wasUndone = dao.tryUndoReviewDecisionIfAuthz(firstReplyResult.reviewTask.get.id, whoAdmin)
          wasUndone mustBe false

          info("...and then also auto-approve all early posts")
          val secondReply2 = dao.loadPost(thePageId, secondReplyResult.post.nr).get
          secondReply2.isCurrentVersionApproved mustBe true
          secondReply2.approvedById mustBe Some(SystemUserId)

          info("allow & auto-approve more posts, since the first post has been approved")
          val thirdReplyResult = reply(member.id, "reply_863439_f")
          thirdReplyResult.post.approvedById mustBe Some(SystemUserId)
          checkNoReviewTask(thirdReplyResult.post)

          /* No longer works because no review tasks generated for auto-approved posts.
          info("allow, if approve bumped to 3 (2 + 1 approved by admin & system = 3 in total)")
          dao.saveSiteSettings(SettingsToSave(
            numFirstPostsToApprove = Some(Some(3)),
            maxPostsPendApprBefore = Some(Some(3))), Who.System)
          val fourthReplyResult = reply(member.id, "reply_863439_g")
          fourthReplyResult.post.approvedById mustBe Some(SystemUserId)
          checkNoReviewTask(fourthReplyResult.post)

          info("allow but not approve, if Approve & Approve bumped to 5")
          dao.saveSiteSettings(SettingsToSave(
            maxPostsPendApprBefore = Some(Some(5)),
            numFirstPostsToApprove = Some(Some(5))), Who.System)
          val fifthReplyResult = reply(member.id, "reply_863439_h")
          fifthReplyResult.post.isSomeVersionApproved mustBe false
          checkReviewTaskGenerated(fifthReplyResult.post, reviewReasons)

          info("then reject")
          intercept[ResultException] {
            reply(member.id, "reply_863439_i")
          }.getMessage must include("_EsE6YKF2_")
          */
        }
      }
    },

    new NestedPostsSuite {
      override def beforeAll: Unit = {
        dao.saveSiteSettings(SettingsToSave(
          maxPostsPendApprBefore = Some(Some(5)),
          numFirstPostsToApprove = Some(Some(3)),
          numFirstPostsToReview = Some(Some(0))), Who.System)
      }

      "PostsDao will, with max-pending-approval = 5, approve = 3:  TyT305RKDJ5" - {
        "approve all replies by a new admin" in {
          newAdminAndPage()
          testAdminsRepliesApproved(theAdmin.id, thePageId)
        }

        "allow four replies by a new member" in {
          val member = createPasswordUser(s"mem_77025", dao)

          info("allow 1,2,3,4 but not approve")
          val firstReplyResult = reply(member.id, "reply_77025_a")
          val secondReplyResult = reply(member.id, "reply_77025_b")
          val thirdReplyResult = reply(member.id, "reply_77025_c")
          val fourthReplyResult = reply(member.id, "reply_77025_d")
          val fifthReplyResult = reply(member.id, "reply_77025_e")

          firstReplyResult.post.isSomeVersionApproved mustBe false
          secondReplyResult.post.isSomeVersionApproved mustBe false
          thirdReplyResult.post.isSomeVersionApproved mustBe false
          fourthReplyResult.post.isSomeVersionApproved mustBe false
          fifthReplyResult.post.isSomeVersionApproved mustBe false

          info("review tasks for 1,2,3,4,5")
          checkReviewTaskGenerated(firstReplyResult.post, reviewReasons)
          checkReviewTaskGenerated(secondReplyResult.post, reviewReasons)
          checkReviewTaskGenerated(thirdReplyResult.post, reviewReasons)
          checkReviewTaskGenerated(fourthReplyResult.post, reviewReasons)
          checkReviewTaskGenerated(fifthReplyResult.post, reviewReasons)

          info("then reject")
          intercept[ResultException] {
            reply(member.id, "reply_77025_f  to reject")
          }.getMessage must include("_EsE6YKF2_")

          info("approve reply no 1")
          approve(firstReplyResult.reviewTask.get)
          val firstReply2 = dao.loadPost(thePageId, firstReplyResult.post.nr).get
          firstReply2.approvedById mustBe Some(theAdmin.id)

          info("now one more reply accepted")
          val sixthReplyResult = reply(member.id, "reply_77025_f")

          info("but only one")
          intercept[ResultException] {
            reply(member.id, "reply_77025_g  to reject")
          }.getMessage must include("_EsE6YKF2_")

          info("approve reply no 3")
          approve(thirdReplyResult.reviewTask.get)
          val thirdReply2 = dao.loadPost(thePageId, thirdReplyResult.post.nr).get
          thirdReply2.approvedById mustBe Some(theAdmin.id)

          info("one more reply accepted, again")
          val seventhReplyResult = reply(member.id, "reply_77025_g")

          info("reject additional replies")
          intercept[ResultException] {
            reply(member.id, "reply_77025_h  to reject")
          }.getMessage must include("_EsE6YKF2_")

          info("approve reply no 2  — now 1, 2, 3 appproved, all that's needed")
          approve(secondReplyResult.reviewTask.get)
          val secondReply2 = dao.loadPost(thePageId, secondReplyResult.post.nr).get
          secondReply2.approvedById mustBe Some(theAdmin.id)

          info("...and then auto-approve no 4, 5, 6, 7?")
          val fourthReply2 = dao.loadPost(thePageId, fourthReplyResult.post.nr).get
          fourthReply2.approvedById mustBe Some(SystemUserId)
          val fifthReply2 = dao.loadPost(thePageId, fifthReplyResult.post.nr).get
          fifthReply2.approvedById mustBe Some(SystemUserId)

          val sixthReply2 = dao.loadPost(thePageId, sixthReplyResult.post.nr).get
          sixthReply2.approvedById mustBe Some(SystemUserId)
          val seventhReply2 = dao.loadPost(thePageId, seventhReplyResult.post.nr).get
          seventhReply2.approvedById mustBe Some(SystemUserId)

          info("...but nr 3 remains approved by admin")
          val thirdReply3 = dao.loadPost(thePageId, thirdReplyResult.post.nr).get
          thirdReply3.approvedById mustBe Some(theAdmin.id)

          info("allow subsequent replies")
          val eighthReplyResult = reply(member.id, "reply_77025_h")
          val ninethReplyResult = reply(member.id, "reply_77025_i")
          checkNoReviewTask(eighthReplyResult.post)
          checkNoReviewTask(ninethReplyResult.post)

          info("still allow, after Approve & Allow disabled")
          dao.saveSiteSettings(SettingsToSave(
            maxPostsPendApprBefore = Some(Some(0)),
            numFirstPostsToApprove = Some(Some(0))), Who.System)
          val tenthReplyResult = reply(member.id, "reply_77025_j")
          checkNoReviewTask(tenthReplyResult.post)

          import EditedSettings.MaxNumFirstPosts
          dieIf(MaxNumFirstPosts != 10, "TyE05RKT55")  // ttt
          info(s"can post more than MaxNumFirstPosts = $MaxNumFirstPosts posts")
          val eleventhReplyResult = reply(member.id, "reply_77025_k")
          val twelthReplyResult = reply(member.id, "reply_77025_l")
          checkNoReviewTask(eleventhReplyResult.post)
          checkNoReviewTask(twelthReplyResult.post)
        }
      }
    },


    new NestedPostsSuite {
      override def beforeAll: Unit = {
        dao.saveSiteSettings(SettingsToSave(
          maxPostsPendApprBefore = Some(Some(0)),
          numFirstPostsToApprove = Some(Some(0)),
          numFirstPostsToReview = Some(Some(2))), Who.System)
      }

      "PostsDao will, with allow = 0, approve = 0, notify = 2:" - {
        "approve all replies by a new admin" in {
          newAdminAndPage()
          testAdminsRepliesApproved(theAdmin.id, thePageId)
        }

        "allow all replies by a new member" in {
          val member = createPasswordUser(s"mem_55032", dao)

          info("auto-approve 1,2,3,4")
          val firstReplyResult = reply(member.id, "reply_55032_a")
          val secondReplyResult = reply(member.id, "reply_55032_b")
          val thirdReplyResult = reply(member.id, "reply_55032_c")
          val fourthReplyResult = reply(member.id, "reply_55032_d")
          firstReplyResult.post.approvedById mustBe Some(SystemUserId)
          secondReplyResult.post.approvedById mustBe Some(SystemUserId)
          thirdReplyResult.post.approvedById mustBe Some(SystemUserId)
          fourthReplyResult.post.approvedById mustBe Some(SystemUserId)

          info("generate review tasks for 1,2 but not 3,4")
          checkReviewTaskGenerated(firstReplyResult.post, reviewReasons)
          checkReviewTaskGenerated(secondReplyResult.post, reviewReasons)
          checkNoReviewTask(thirdReplyResult.post)
          checkNoReviewTask(fourthReplyResult.post)
        }
      }
    },

    new NestedPostsSuite {
      override def beforeAll: Unit = {
        dao.saveSiteSettings(SettingsToSave(
          maxPostsPendApprBefore = Some(Some(3)),
          numFirstPostsToApprove = Some(Some(1)),
          numFirstPostsToReview = Some(Some(1))), Who.System)
      }

      "PostsDao can combine Allow and Notify" - {
        "when Allow = 3, Approve = 1, Notify = 1" in {
          newAdminAndPage()
          val member = createPasswordUser(s"mem_33951", dao)

          val firstReplyResult = reply(member.id, "reply_33951_a")
          val secondReplyResult = reply(member.id, "reply_33951_b")
          val thirdReplyResult = reply(member.id, "reply_33951_c")
          firstReplyResult.post.isSomeVersionApproved mustBe false
          secondReplyResult.post.isSomeVersionApproved mustBe false
          thirdReplyResult.post.isSomeVersionApproved mustBe false

          info("generate review tasks for 1,2 but not 3")
          checkReviewTaskGenerated(firstReplyResult.post, reviewReasons)
          checkReviewTaskGenerated(secondReplyResult.post, reviewReasons)
          checkReviewTaskGenerated(thirdReplyResult.post, reviewReasons)

          info("reject reply nr 4")
          intercept[ResultException] {
            reply(member.id, "reply_33951_d")
          }.getMessage must include("_EsE6YKF2_")

          info("approve nr 1, auto-approve 2 & 3")
          approve(firstReplyResult.reviewTask.get)
          val firstReply2 = dao.loadPost(thePageId, firstReplyResult.post.nr).get
          val secondReply2 = dao.loadPost(thePageId, secondReplyResult.post.nr).get
          val thirdReply2 = dao.loadPost(thePageId, thirdReplyResult.post.nr).get
          firstReply2.approvedById mustBe Some(theAdmin.id)
          secondReply2.approvedById mustBe Some(SystemUserId)
          thirdReply2.approvedById mustBe Some(SystemUserId)

          info("now auto-approve, but no review task")
          val fourthReplyResult = reply(member.id, "reply_33951_c")
          fourthReplyResult.post.approvedById mustBe Some(SystemUserId)
          checkNoReviewTask(fourthReplyResult.post)
        }
      }
    },


    new NestedPostsSuite {
      override def beforeAll: Unit = {
        dao.saveSiteSettings(SettingsToSave(
          maxPostsPendApprBefore = Some(Some(2)),
          numFirstPostsToApprove = Some(Some(1)),
          numFirstPostsToReview = Some(Some(1))), Who.System)
      }

      "PostsDao" - {
        "auto-approves chat messages, and doesn't let them interfere with discussion replies" in {
          pending
          newAdminAndPage()
          val chatPageId = createPage(PageType.OpenChat, textAndHtmlMaker.testTitle("Chat Page 594284"),
            textAndHtmlMaker.testBody("Purpose: 594284"), theAdmin.id, browserIdData, dao,
            anyCategoryId = Some(categoryId))

          val member = createPasswordUser(s"mem_740331", dao)
          val who = Who(member.id, browserIdData)
          dao.joinOrLeavePageIfAuth(chatPageId, join = true, who)

          info("insert a chat messages, it gets auto-approved")
          val firstChat = dao.insertChatMessage(textAndHtmlMaker.testBody("chat_740331_a"), chatPageId,
            deleteDraftNr = None, who, dummySpamRelReqStuff).post
          firstChat.approvedById mustBe Some(SystemUserId)

          info("can still insert a reply")
          val firstReplyResult = reply(member.id, "reply_740331_a")
          firstReplyResult.post.isSomeVersionApproved mustBe false
          checkReviewTaskGenerated(firstReplyResult.post, reviewReasons)

          info("another chat message")
          val secondChat = dao.insertChatMessage(textAndHtmlMaker.testBody("chat_740331_d"), chatPageId,
            deleteDraftNr = None, who, dummySpamRelReqStuff).post
          secondChat.approvedById mustBe Some(SystemUserId)

          info("can nevertheless insert reply 2")
          val secondReplyResult = reply(member.id, "reply_740331_b")
          secondReplyResult.post.isSomeVersionApproved mustBe false
          checkReviewTaskGenerated(secondReplyResult.post, reviewReasons)

          info("yet another chat message")
          val thirdChat = dao.insertChatMessage(textAndHtmlMaker.testBody("chat_740331_f"), chatPageId,
            deleteDraftNr = None, who, dummySpamRelReqStuff).post
          thirdChat.approvedById mustBe Some(SystemUserId)

          info("rejct reply 3")
          intercept[ResultException] {
            reply(member.id, "reply_740331_c")
          }.getMessage must include("_EsE6YKF2_")

          info("allow more replies, once first reply approved")
          approve(firstReplyResult.reviewTask.get)

          val thirdReplyResult = reply(member.id, "reply_740331_d")
          thirdReplyResult.post.approvedById mustBe Some(SystemUserId)
          checkNoReviewTask(thirdReplyResult.post)

          val fourthReplyResult = reply(member.id, "reply_740331_e")
          fourthReplyResult.post.approvedById mustBe Some(SystemUserId)
          checkNoReviewTask(fourthReplyResult.post)
        }
      }
    },


    new NestedPostsSuite {
      override def beforeAll: Unit = {
        dao.saveSiteSettings(SettingsToSave(
          maxPostsPendApprBefore = Some(Some(2)),
          numFirstPostsToApprove = Some(Some(1)),
          numFirstPostsToReview = Some(Some(1))), Who.System)
      }

      "PagesDao" - {
        "lets staff approve and review a user's firts pages too, not just replies" in {
          val member = createPasswordUser(s"mem_4zm2", dao)

          info("create Allow = 2 pages, pending approval since Approve > 0")
          val first = createPage(PageType.Discussion, textAndHtmlMaker.testTitle("Member Page 4ZM2"),
            textAndHtmlMaker.testBody("Page body 4ZM2."), member.id, browserIdData, dao,
            anyCategoryId = Some(categoryId))

          val second = createPage(PageType.Discussion, textAndHtmlMaker.testTitle("Member Page 4ZM2 b"),
            textAndHtmlMaker.testBody("Page body 4ZM2 b."), member.id, browserIdData, dao,
            anyCategoryId = Some(categoryId))

          info("rejct page 3")
          intercept[ResultException] {
            createPage(PageType.Discussion, textAndHtmlMaker.testTitle("Member Page 4ZM2 c"),
                textAndHtmlMaker.testBody("Page body 4ZM2 c."), member.id, browserIdData, dao,
                anyCategoryId = Some(categoryId))
          }.getMessage must include("_EsE6YKF2_")
        }
      }
    },


    new NestedPostsSuite {
      override def beforeAll: Unit = {
        dao.saveSiteSettings(SettingsToSave(
                numFirstPostsToApprove = Some(Some(0)),
                numFirstPostsToReview = Some(Some(0)),
                maxPostsPendApprBefore = Some(Some(3)),
                requireApprovalIfTrustLte = Some(Some(TrustLevel.BasicMember))),
              Who.System)
      }

      "requireApprovalIfTrustLte" - {
        "member" - {
          "staff needs to approve posts by trust level <= Basic Member   TyT305RKTH205" in {
            newAdminAndPage()
            val member = createPasswordUser(s"m_20wk46", dao,
                  trustLevel = TrustLevel.BasicMember)

            info("member posts reply A")
            val firstReplyResult = reply(member.id, "reply_20wk46_a")
            info("member posts reply B")
            val secondReplyResult = reply(member.id, "reply_20wk46_b")
            info("member posts reply C")
            val thirdReplyResult = reply(member.id, "reply_20wk46_c")
            firstReplyResult.post.isSomeVersionApproved mustBe false
            secondReplyResult.post.isSomeVersionApproved mustBe false
            thirdReplyResult.post.isSomeVersionApproved mustBe false

            val reviewReasons = Seq(ReviewReason.IsByLowTrustLevel)

            info("generate review tasks for all posts")
            checkReviewTaskGenerated(firstReplyResult.post, reviewReasons)
            checkReviewTaskGenerated(secondReplyResult.post, reviewReasons)
            checkReviewTaskGenerated(thirdReplyResult.post, reviewReasons)

            info("reject reply D — already maxPostsPendApprBefore = 3 pending approval")
            intercept[ResultException] {
              reply(member.id, "reply_20wk46_d — should fail")
            }.getMessage must include("TyE2MNYPNDAPR_")

            info("approve posts A, B, C")
            approve(firstReplyResult.reviewTask.get)
            approve(secondReplyResult.reviewTask.get)
            approve(thirdReplyResult.reviewTask.get)
            val firstReply2 = dao.loadPost(thePageId, firstReplyResult.post.nr).get
            val secondReply2 = dao.loadPost(thePageId, secondReplyResult.post.nr).get
            val thirdReply2 = dao.loadPost(thePageId, thirdReplyResult.post.nr).get
            firstReply2.approvedById mustBe Some(theAdmin.id)
            secondReply2.approvedById mustBe Some(theAdmin.id)
            thirdReply2.approvedById mustBe Some(theAdmin.id)

            info("can now post reply D. Still requires approval, no longer rejected")
            val fourthReplyResult = reply(member.id, "reply_20wk46_d")
            fourthReplyResult.post.isSomeVersionApproved mustBe false
            checkReviewTaskGenerated(fourthReplyResult.post, reviewReasons)

            info("and reply E, F")
            val fifthReplyResult = reply(member.id, "reply_20wk46_e")
            val sixthReplyResult = reply(member.id, "reply_20wk46_f")
            checkReviewTaskGenerated(fifthReplyResult.post, reviewReasons)
            checkReviewTaskGenerated(sixthReplyResult.post, reviewReasons)

            info("reject reply G — already 3 posts pending approval, again")
            intercept[ResultException] {
              reply(member.id, "reply_20wk46_g")
            }.getMessage must include("TyE2MNYPNDAPR_")

            info("change trust level to Full Member")
            val memberFull = dao.readWriteTransaction { tx =>
              var m = tx.loadTheUserInclDetails(member.id)
              m = m.copy(trustLevel = TrustLevel.FullMember)
              tx.updateUserInclDetails(m)
              m.briefUser
            }

            info("now replies accepted, since ok trust level: reply G")
            val seventhReplyResult = reply(memberFull.id, "reply_20wk46_g")
            seventhReplyResult.post.isSomeVersionApproved mustBe true
            checkNoReviewTask(seventhReplyResult.post)

            info("and H")
            val eigthReplyResult = reply(memberFull.id, "reply_20wk46_h")
            eigthReplyResult.post.isSomeVersionApproved mustBe true
            checkNoReviewTask(eigthReplyResult.post)
          }
        }
      }
    })

}
