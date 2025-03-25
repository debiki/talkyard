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
import talkyard.server.authz.{ReqrAndTgt, StaffReqrAndTgt}


// RENAME to BlockAndBanAppSpec?
class ThreatLevelsAppSpec extends ReviewStuffAppSuite("6gp4") {  // TyTI_TRUST_THREAT_LV

  override def nestedSuites = Vector(
    new NestedPostsSuite {
      override def beforeAll(): U = {
        dao.saveSiteSettings(SettingsToSave(
          orgFullName = Some(Some("Test Org Name")),
          maxPostsPendApprBefore = Some(Some(0)),
          numFirstPostsToApprove = Some(Some(0)),
          numFirstPostsToReview = Some(Some(0))), Who.System)
      }

      "create page" in {
        newAdminAndPage()
        letEveryoneTalkAndStaffModerate(dao)
      }

      "members, mild and moderate threat level: comments are added to the moderation queue" in {
        val member = createPasswordUser(s"mem_78201", dao)

        info("non threats may post replies")
        var post = reply(member.id, "reply_02844_a").post
        post.approvedById mustBe Some(SystemUserId)
        checkNoReviewTask(post)

        info("mild threat –> reviewed afterwards")
        dao.lockUserThreatLevel(member.id, Some(ThreatLevel.MildThreat))
        post = reply(member.id, "reply_02844_a").post
        post.approvedById mustBe Some(SystemUserId)
        checkReviewTaskGenerated(post, Seq(ReviewReason.IsByThreatUser))

        info("moderate threat –> need approve before shown")
        dao.lockUserThreatLevel(member.id, Some(ThreatLevel.ModerateThreat))
        post = reply(member.id, "reply_02844_b").post
        post.approvedById mustBe None
        checkReviewTaskGenerated(post, Seq(ReviewReason.IsByThreatUser))

        info("severe threat –> forbidden")
        dao.lockUserThreatLevel(member.id, Some(ThreatLevel.SevereThreat))
        intercept[Exception]{
          reply(member.id, "reply_02844_b").post
        }.getMessage must include("EsE5Y80G2_")

        info("can clear threat level")
        dao.lockUserThreatLevel(member.id, None)
        post = reply(member.id, "reply_02844_c").post
        post.approvedById mustBe Some(SystemUserId)
        checkNoReviewTask(post)
      }

      def makeModReqr(): StaffReqrAndTgt =
        ReqrAndTgt.self(theAdmin, BrowserIdData.Test).denyUnlessStaff()

      def makeGuest(): Guest =
        dao.loginAsGuest(GuestLoginAttempt(ip = "3.4.5.6",
              date = globals.now().toJavaDate, name = "A Guest",
              email = "aguest@email.co", "guestBrId-2480437"))


      "guest, mild and moderate threat level: comments are added to the moderation queue" in {
        val modSelf = makeModReqr()
        val guest = makeGuest()

        info("guests may post replies, the first 2 are always queued for review") // [4JKFWP4]
        var post = reply(guest.id, "reply_63502_a_1").post
        post.approvedById mustBe Some(SystemUserId)
        checkReviewTaskGenerated(post, Seq(ReviewReason.IsByNewUser))
        post = reply(guest.id, "reply_63502_a_2").post
        post.approvedById mustBe Some(SystemUserId)
        checkReviewTaskGenerated(post, Seq(ReviewReason.IsByNewUser))
        post = reply(guest.id, "reply_63502_a_3").post
        post.approvedById mustBe Some(SystemUserId)
        checkNoReviewTask(post)

        info("mild threat guest –> review after")
        dao.blockGuestIfAuZ(post.id, ThreatLevel.MildThreat, modSelf)
        post = reply(guest.id, "reply_63502_b").post
        post.approvedById mustBe Some(SystemUserId)
        checkReviewTaskGenerated(post, Seq(ReviewReason.IsByThreatUser))

        info("moderate threat guest –> review before")
        dao.unblockGuest(post.id, theAdmin.id) // for now, else unique key error in db [6YF42]
        dao.blockGuestIfAuZ(post.id, ThreatLevel.ModerateThreat, modSelf)
        post = reply(guest.id, "reply_63502_c").post
        post.approvedById mustBe None
        checkReviewTaskGenerated(post, Seq(ReviewReason.IsByThreatUser))

        info("severe threat –> forbidden")
        dao.unblockGuest(post.id, theAdmin.id) // for now, else unique key error in db [6YF42]
        dao.blockGuestIfAuZ(post.id, ThreatLevel.SevereThreat, modSelf)
        intercept[Exception]{
          reply(guest.id, "reply_02844_d").post
        }.getMessage must include("EsE5Y80G2_")

        info("can clear guest threat level")
        dao.unblockGuest(post.id, theAdmin.id)
        post = reply(guest.id, "reply_02844_e").post
        post.approvedById mustBe Some(SystemUserId)
        checkNoReviewTask(post)
      }

      "ban user" in {
        val modSelf = makeModReqr()
        val modId = modSelf.reqr.id
        val user = createPasswordUser(s"mem_60258", dao)

        info("user posts two replies")
        val post1 = reply(user.id, "reply_70326_a").post
        post1.approvedById mustBe Some(SystemUserId)
        checkNoReviewTask(post1)
        val post2 = reply(user.id, "reply_70326_b").post
        post2.approvedById mustBe Some(SystemUserId)
        checkNoReviewTask(post2)

        info("mod bans user")
        dao.writeTx { (tx, ss) =>
          dao.banAuthorOf(post2, reason = "Didn't pat my cat", bannedById = modId)(tx, ss)
        }

        info("user can't post more posts")
        intercept[Exception]{
          replyIfAuZ(user, "reply_70326_c").post
        }.getMessage must include("TyEM0REPLY1-TyEM0RE_SUSP")
      }

      "ban guest" in {
        val modSelf = makeModReqr()
        val guest = makeGuest()

        info("guests posts two replies") // [4JKFWP4]
        val post1 = reply(guest.id, "reply_73061_a_1").post
        post1.approvedById mustBe Some(SystemUserId)
        checkNoReviewTask(post1)
        val post2 = reply(guest.id, "reply_73061_a_2").post
        post2.approvedById mustBe Some(SystemUserId)
        checkNoReviewTask(post2)

        // This will not, though, auto delete post1. But review decision
        // ReviewDecision.DeleteAndBanSpammer would do that. (That'd be another test spec.)
        info("mod bans guest")  // [mod_bans_guest_app_test]
        dao.writeTx { (tx, ss) =>
          dao.banAuthorOf(post2, reason = "Upset my cat", bannedById = modSelf.reqr.id)(tx, ss)
        }

        info("guest forbidden to post more posts")
        intercept[Exception]{
          replyIfAuZ(guest, "reply_73061_a_3").post
        }.getMessage must include("EsE5Y80G2_")
      }
    })

}
