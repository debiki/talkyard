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
import debiki.DebikiHttp.ResultException
import debiki.{Globals, TextAndHtml}
import org.scalatest.{BeforeAndAfterAll, MustMatchers, FreeSpec}


class FirstPostsAppSpec extends DaoAppSuite(disableScripts = true) {

  var nameCounter = 0

  class nestedPostsSuite extends FreeSpec with MustMatchers with BeforeAndAfterAll {
    var thePageId: PageId = null
    var theAdmin: User = null
    lazy val dao: SiteDao = Globals.siteDao(Site.FirstSiteId)

    def nextNameNr = { nameCounter += 1; nameCounter }

    def newAdminAndPage() = {
      theAdmin = createPasswordAdmin(s"aaddmm_$nextNameNr", dao)
      thePageId = dao.createPage(PageRole.Discussion, PageStatus.Published,
        anyCategoryId = None, anyFolder = Some("/"), anySlug = Some(""),
        titleTextAndHtml = TextAndHtml.testTitle("title_62952"),
        bodyTextAndHtml = TextAndHtml.testBody("discussion_230593"),
        showId = true, authorId = theAdmin.id, browserIdData = browserIdData).thePageId
    }

    def testAdminsRepliesApproved(adminId: UserId, pageId: PageId) {
      for (i <- 1 to 10) {
        val result = dao.insertReply(TextAndHtml.testBody(s"reply_9032372, i = $i"), pageId,
          replyToPostNrs = Set(PageParts.BodyNr), PostType.Normal, authorId = adminId,
          browserIdData = browserIdData)
        result.post.isCurrentVersionApproved mustBe true
        result.post.approvedById mustBe Some(adminId)
      }
    }

    def reply(memberId: UserId, text: String): Post = {
      dao.insertReply(TextAndHtml.testBody(text), thePageId,
        replyToPostNrs = Set(PageParts.BodyNr), PostType.Normal, authorId = memberId,
        browserIdData = browserIdData).post
    }

    def checkReviewTaskGenerated(post: Post) {
      dao.readOnlyTransaction { transaction =>
        val task = transaction.loadPendingPostReviewTask(post.uniqueId) getOrElse {
          fail("No review task generated for post with text: " + post.currentSource)
        }
        task.causedById mustBe post.createdById
        task.reasons must contain(ReviewReason.NewPost)
        task.reasons must contain(ReviewReason.IsByNewUser)
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


  override def nestedSuites = Vector(
    new nestedPostsSuite {
      "PostsDao will, by default:" - {
        "approve replies by a new admin" in {
          newAdminAndPage()
          testAdminsRepliesApproved(theAdmin.id, thePageId)
        }
      }
      "allow new members by default" in {
        val member = createPasswordUser(s"mem_78201", dao)
        reply(member.id, "reply_04285_a").approvedById mustBe Some(SystemUserId)
        reply(member.id, "reply_04285_b").approvedById mustBe Some(SystemUserId)
        reply(member.id, "reply_04285_c").approvedById mustBe Some(SystemUserId)
      }
    },

    new nestedPostsSuite {
      override def beforeAll {
        dao.saveSetting(SettingsTarget.WholeSite, "allowNumFirstPosts", Some(1))
        dao.saveSetting(SettingsTarget.WholeSite, "approveNumFirstPosts", Some(1))
        dao.saveSetting(SettingsTarget.WholeSite, "notifyNumFirstPosts", Some(0))
      }

      "PostsDao will, with approve = 1 and allow = undef, 1, 2" - {
        "approve all replies by a new admin" in {
          newAdminAndPage()
          testAdminsRepliesApproved(theAdmin.id, thePageId)
        }

        "allow then reject posts by a new member" in {
          val member = createPasswordUser(s"mem_863439", dao)

          info("allow one")
          val firstReply = reply(member.id, "reply_863439_a")
          firstReply.isSomeVersionApproved mustBe false
          checkReviewTaskGenerated(firstReply)

          info("then reject")
          intercept[ResultException] {
            reply(member.id, "reply_863439_b")
          }.getMessage must include("_EsE6YKF2_")

          info("accept one more when allow = 2")
          dao.saveSetting(SettingsTarget.WholeSite, "allowNumFirstPosts", Some(2))
          val secondReply = reply(member.id, "reply_863439_d")
          secondReply.isSomeVersionApproved mustBe false

          info("but generate no review task, because Approve + Notify = 1 + 0 = only 1st reviewed")
          checkNoReviewTask(secondReply)

          info("then reject again")
          intercept[ResultException] {
            reply(member.id, "reply_863439_e")
          }.getMessage must include("_EsE6YKF2_")

          info("approve the very first post...")
          dao.approvePost(thePageId, firstReply.nr, theAdmin.id)
          val firstReply2 = dao.loadPost(thePageId, firstReply.nr).get
          firstReply2.approvedById mustBe Some(theAdmin.id)

          info("...and then also auto-approve all early posts")
          val secondReply2 = dao.loadPost(thePageId, secondReply.nr).get
          secondReply2.isCurrentVersionApproved mustBe true
          secondReply2.approvedById mustBe Some(SystemUserId)

          info("allow & auto-approve more posts, since the first post has been approved")
          val thirdReply = reply(member.id, "reply_863439_f")
          thirdReply.approvedById mustBe Some(SystemUserId)
          checkNoReviewTask(thirdReply)

          info("allow, if approve bumped to 3 (2 + 1 approved by admin & system = 3 in total)")
          dao.saveSetting(SettingsTarget.WholeSite, "approveNumFirstPosts", Some(3))
          val fourthReply = reply(member.id, "reply_863439_g")
          fourthReply.approvedById mustBe Some(SystemUserId)
          checkNoReviewTask(fourthReply)

          info("allow but not approve, if Approve & Approve bumped to 5")
          dao.saveSetting(SettingsTarget.WholeSite, "allowNumFirstPosts", Some(5))
          dao.saveSetting(SettingsTarget.WholeSite, "approveNumFirstPosts", Some(5))
          val fifthReply = reply(member.id, "reply_863439_h")
          fifthReply.isSomeVersionApproved mustBe false
          checkReviewTaskGenerated(fifthReply)

          info("then reject")
          intercept[ResultException] {
            reply(member.id, "reply_863439_i")
          }.getMessage must include("_EsE6YKF2_")
        }
      }
    },

    new nestedPostsSuite {
      override def beforeAll {
        dao.saveSetting(SettingsTarget.WholeSite, "allowNumFirstPosts", Some("5"))
        dao.saveSetting(SettingsTarget.WholeSite, "approveNumFirstPosts", Some("3"))
        dao.saveSetting(SettingsTarget.WholeSite, "notifyNumFirstPosts", Some(0))
      }

      "PostsDao will, with allow = 4, approve = 2:" - {
        "approve all replies by a new admin" in {
          newAdminAndPage()
          testAdminsRepliesApproved(theAdmin.id, thePageId)
        }

        "allow four replies by a new member" in {
          val member = createPasswordUser(s"mem_77025", dao)

          info("allow 1,2,3,4 but not approve")
          val firstReply = reply(member.id, "reply_77025_a")
          val secondReply = reply(member.id, "reply_77025_b")
          val thirdReply = reply(member.id, "reply_77025_c")
          val fourthReply = reply(member.id, "reply_77025_d")
          val fifthReply = reply(member.id, "reply_77025_e")

          firstReply.isSomeVersionApproved mustBe false
          secondReply.isSomeVersionApproved mustBe false
          thirdReply.isSomeVersionApproved mustBe false
          fourthReply.isSomeVersionApproved mustBe false
          fifthReply.isSomeVersionApproved mustBe false

          // Only the 3 first because Approve + Notify = 3 + 0 = the three first.
          info("review tasks for 1,2,3, but not 4,5")
          checkReviewTaskGenerated(firstReply)
          checkReviewTaskGenerated(secondReply)
          checkReviewTaskGenerated(thirdReply)
          checkNoReviewTask(fourthReply)
          checkNoReviewTask(fifthReply)

          info("then reject")
          intercept[ResultException] {
            reply(member.id, "reply_77025_f")
          }.getMessage must include("_EsE6YKF2_")

          info("approve reply no 1")
          dao.approvePost(thePageId, firstReply.nr, theAdmin.id)
          val firstReply2 = dao.loadPost(thePageId, firstReply.nr).get
          firstReply2.approvedById mustBe Some(theAdmin.id)

          info("still reject")
          intercept[ResultException] {
            reply(member.id, "reply_77025_g")
          }.getMessage must include("_EsE6YKF2_")

          info("approve reply no 3")
          dao.approvePost(thePageId, thirdReply.nr, theAdmin.id)
          val thirdReply2 = dao.loadPost(thePageId, thirdReply.nr).get
          thirdReply2.approvedById mustBe Some(theAdmin.id)

          info("still reject")
          intercept[ResultException] {
            reply(member.id, "reply_77025_h")
          }.getMessage must include("_EsE6YKF2_")

          info("approve reply no 2 (now 1,2,3 are appproved)...")
          dao.approvePost(thePageId, secondReply.nr, theAdmin.id)
          val secondReply2 = dao.loadPost(thePageId, secondReply.nr).get
          secondReply2.approvedById mustBe Some(theAdmin.id)

          info("...and then auto-approve no 4 and 5")
          val fourthReply2 = dao.loadPost(thePageId, fourthReply.nr).get
          fourthReply2.approvedById mustBe Some(SystemUserId)
          val fifthReply2 = dao.loadPost(thePageId, fifthReply.nr).get
          fifthReply2.approvedById mustBe Some(SystemUserId)

          info("...but no 3 remains approved by admin")
          val thirdReply3 = dao.loadPost(thePageId, thirdReply.nr).get
          thirdReply3.approvedById mustBe Some(theAdmin.id)

          info("allow subsequent replies")
          val sixthReply = reply(member.id, "reply_77025_i")
          val seventhReply = reply(member.id, "reply_77025_j")
          checkNoReviewTask(sixthReply)
          checkNoReviewTask(seventhReply)

          info("still allow, after Approve & Allow disabled")
          dao.saveSetting(SettingsTarget.WholeSite, "approveNumFirstPosts", Some(0))
          dao.saveSetting(SettingsTarget.WholeSite, "allowNumFirstPosts", Some(0))
          val eightReply = reply(member.id, "reply_77025_k")
          checkNoReviewTask(eightReply)
        }
      }
    },

    new nestedPostsSuite {
      override def beforeAll {
        dao.saveSetting(SettingsTarget.WholeSite, "allowNumFirstPosts", Some("0"))
        dao.saveSetting(SettingsTarget.WholeSite, "approveNumFirstPosts", Some("0"))
        dao.saveSetting(SettingsTarget.WholeSite, "notifyNumFirstPosts", Some("2"))
      }

      "PostsDao will, with allow = 0, approve = 0, notify = 2:" - {
        "approve all replies by a new admin" in {
          newAdminAndPage()
          testAdminsRepliesApproved(theAdmin.id, thePageId)
        }

        "allow all replies by a new member" in {
          val member = createPasswordUser(s"mem_55032", dao)

          info("auto-approve 1,2,3,4")
          val firstReply = reply(member.id, "reply_55032_a")
          val secondReply = reply(member.id, "reply_55032_b")
          val thirdReply = reply(member.id, "reply_55032_c")
          val fourthReply = reply(member.id, "reply_55032_d")
          firstReply.approvedById mustBe Some(SystemUserId)
          secondReply.approvedById mustBe Some(SystemUserId)
          thirdReply.approvedById mustBe Some(SystemUserId)
          fourthReply.approvedById mustBe Some(SystemUserId)

          info("generate review tasks for 1,2 but not 3,4")
          checkReviewTaskGenerated(firstReply)
          checkReviewTaskGenerated(secondReply)
          checkNoReviewTask(thirdReply)
          checkNoReviewTask(fourthReply)
        }
      }
    },

    new nestedPostsSuite {
      override def beforeAll {
        dao.saveSetting(SettingsTarget.WholeSite, "allowNumFirstPosts", Some("3"))
        dao.saveSetting(SettingsTarget.WholeSite, "approveNumFirstPosts", Some("1"))
        dao.saveSetting(SettingsTarget.WholeSite, "notifyNumFirstPosts", Some("1"))
      }

      "PostsDao can combine Allow and Notify" - {
        "when Allow = 3, Approve = 1, Notify = 1" in {
          newAdminAndPage()
          val member = createPasswordUser(s"mem_33951", dao)

          val firstReply = reply(member.id, "reply_33951_a")
          val secondReply = reply(member.id, "reply_33951_b")
          val thirdReply = reply(member.id, "reply_33951_c")
          firstReply.isSomeVersionApproved mustBe false
          secondReply.isSomeVersionApproved mustBe false
          thirdReply.isSomeVersionApproved mustBe false

          info("generate review tasks for 1,2 but not 3")
          checkReviewTaskGenerated(firstReply)
          checkReviewTaskGenerated(secondReply)
          checkNoReviewTask(thirdReply)

          info("reject reply nr 4")
          intercept[ResultException] {
            reply(member.id, "reply_33951_d")
          }.getMessage must include("_EsE6YKF2_")

          info("approve nr 1, auto-approve 2 & 3")
          dao.approvePost(thePageId, firstReply.nr, theAdmin.id)
          val firstReply2 = dao.loadPost(thePageId, firstReply.nr).get
          val secondReply2 = dao.loadPost(thePageId, secondReply.nr).get
          val thirdReply2 = dao.loadPost(thePageId, thirdReply.nr).get
          firstReply2.approvedById mustBe Some(theAdmin.id)
          secondReply2.approvedById mustBe Some(SystemUserId)
          thirdReply2.approvedById mustBe Some(SystemUserId)

          info("now auto-approve, but no review task")
          val fourthReply = reply(member.id, "reply_33951_c")
          fourthReply.approvedById mustBe Some(SystemUserId)
          checkNoReviewTask(fourthReply)
        }
      }
    },

    new nestedPostsSuite {
      override def beforeAll {
        dao.saveSetting(SettingsTarget.WholeSite, "allowNumFirstPosts", Some("2"))
        dao.saveSetting(SettingsTarget.WholeSite, "approveNumFirstPosts", Some("1"))
        dao.saveSetting(SettingsTarget.WholeSite, "notifyNumFirstPosts", Some("1"))
      }

      "PostsDao" - {
        "auto-approves chat messages, and doesn't let them interfere with discussion replies" in {
          newAdminAndPage()
          val chatPageId = createPage(PageRole.OpenChat, TextAndHtml.testTitle("Chat Page 594284"),
            TextAndHtml.testBody("Purpose: 594284"), theAdmin.id, browserIdData, dao)

          val member = createPasswordUser(s"mem_740331", dao)
          dao.joinPageIfAuth(chatPageId, member.id, browserIdData)

          info("insert a chat messages, it gets auto-approved")
          val firstChat = dao.insertChatMessage(TextAndHtml.testBody("chat_740331_a"), chatPageId,
            member.id, browserIdData).post
          firstChat.approvedById mustBe Some(SystemUserId)

          info("can still insert a reply")
          val firstReply = reply(member.id, "reply_740331_a")
          firstReply.isSomeVersionApproved mustBe false
          checkReviewTaskGenerated(firstReply)

          info("another chat message")
          val secondChat = dao.insertChatMessage(TextAndHtml.testBody("chat_740331_d"), chatPageId,
            member.id, browserIdData).post
          secondChat.approvedById mustBe Some(SystemUserId)

          info("can nevertheless insert reply 2")
          val secondReply = reply(member.id, "reply_740331_b")
          secondReply.isSomeVersionApproved mustBe false
          checkReviewTaskGenerated(secondReply)

          info("yet another chat message")
          val thirdChat = dao.insertChatMessage(TextAndHtml.testBody("chat_740331_f"), chatPageId,
            member.id, browserIdData).post
          thirdChat.approvedById mustBe Some(SystemUserId)

          info("rejct reply 3")
          intercept[ResultException] {
            reply(member.id, "reply_740331_c")
          }.getMessage must include("_EsE6YKF2_")

          info("allow more replies, once first reply approved")
          dao.approvePost(thePageId, firstReply.nr, theAdmin.id)

          val thirdReply = reply(member.id, "reply_740331_d")
          thirdReply.approvedById mustBe Some(SystemUserId)
          checkNoReviewTask(thirdReply)

          val fourthReply = reply(member.id, "reply_740331_e")
          fourthReply.approvedById mustBe Some(SystemUserId)
          checkNoReviewTask(fourthReply)
        }
      }
    })

}
