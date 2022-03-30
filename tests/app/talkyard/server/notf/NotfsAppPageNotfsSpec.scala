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

package  talkyard.server.notf

import com.debiki.core._
import com.debiki.core.Prelude._
import debiki.dao._
import java.{util => ju}


class NotfsAppPageNotfsSpec extends DaoAppSuite() {

  lazy val (site, dao) = createSite("notfsapppagenotfsspec", SettingsToSave(
    // Disable review task notfs — this test was written, before they were added. Better to
    // create a separate test dedicated to various review task notfs settings combos?
    numFirstPostsToReview = Some(Some(0)),
    numFirstPostsToApprove = Some(Some(0))))

  var createForumResult: CreateForumResult = _
  var categoryId: CategoryId = _

  var owner: User = _
  var ownerWho: Who = _
  var member1: User = _
  var member2: User = _
  var member3: User = _
  var member4: User = _
  var memberNoNotfsConfigd: User = _

  var owensTopicIdOne: PageId = _
  var owensTopicIdTwo: PageId = _
  var member1sPageOne: PageId = _
  var everyoneNotfdTopicId: PageId = _

  var oldChatTopicId: PageId = _
  var chatTopicOneId: PageId = _
  var chatTopicTwoId: PageId = _
  var chatTopicManyJoinedId: PageId = _

  var expectedTotalNumNotfs = 0


  def countTotalNumNotfs(): Int =
    dao.readOnlyTransaction(_.countNotificationsPerUser().values.sum)


  def listUsersNotifiedAbout(postId: PostId): Set[UserId] = {
    dao.readOnlyTransaction(_.listUsersNotifiedAboutPost(postId))
  }



  "NotificationGenerator can create and remove notifications" - {
    val now = new ju.Date()

    "prepare" in {
      globals.testSetTime(startTime)
      globals.systemDao.getOrCreateFirstSite()
      owner = createPasswordOwner("ntf_ownr", dao)
      ownerWho = Who(owner.id, browserIdData)
      createForumResult = dao.createForum("Forum", "/notf-test-frm/", isForEmbCmts = false, ownerWho).get
      categoryId = createForumResult.defaultCategoryId

      member1 = createPasswordUser("ntf_mem1", dao)
      member2 = createPasswordUser("ntf_mem2", dao)
      member3 = createPasswordUser("ntf_mem3", dao)
      member4 = createPasswordUser("ntf_mem4", dao)

      memberNoNotfsConfigd = createPasswordUser("ntf_nfng", dao)
    }


    // ----- Whole site notfs


    "config notfs for member 1 and 2: every post, and new topics, respectively, whole site" in {
      dao.readWriteTransaction { tx =>
        tx.upsertPageNotfPref(PageNotfPref(member1.id, NotfLevel.WatchingAll, wholeSite = true))
        tx.upsertPageNotfPref(PageNotfPref(member2.id, NotfLevel.WatchingFirst, wholeSite = true))
      }
    }

    "Owen creates a page" in {
      owensTopicIdOne = createPage(PageType.Discussion,
        textAndHtmlMaker.testTitle("owensTopicIdOne"),
        textAndHtmlMaker.testBody("owensTopicIdOne bd"),
        owner.id, browserIdData, dao, Some(categoryId))

      // Both member 1 and 2 want to know about new topics.
      val origPost = dao.loadPost(owensTopicIdOne, PageParts.BodyNr).get
      listUsersNotifiedAbout(origPost.id) mustBe Set(member1.id, member2.id)
      expectedTotalNumNotfs += 2
      countTotalNumNotfs() mustBe expectedTotalNumNotfs
    }

    "...  replies to himself" in {
      val aReply = reply(owner.id, owensTopicIdOne, "aReply", parentNr = None)(dao)

      // Only member 1 want to know about every post.
      listUsersNotifiedAbout(aReply.id) mustBe Set(member1.id)
      expectedTotalNumNotfs += 1
      countTotalNumNotfs() mustBe expectedTotalNumNotfs
    }


    // ----- Edit whole site notfs


    "member 1 now wants only new topics, member 2 normal, and member 3 every post" in {
      dao.readWriteTransaction { tx =>
        tx.upsertPageNotfPref(PageNotfPref(member1.id, NotfLevel.WatchingFirst, wholeSite = true))
        tx.upsertPageNotfPref(PageNotfPref(member2.id, NotfLevel.Normal, wholeSite = true))
        tx.upsertPageNotfPref(PageNotfPref(member3.id, NotfLevel.WatchingAll, wholeSite = true))
      }
    }

    "Owen creates another page" in {
      owensTopicIdTwo = createPage(PageType.Discussion,
        textAndHtmlMaker.testTitle("owensTopicIdTwo"),
        textAndHtmlMaker.testBody("owensTopicIdTwo bd"),
        owner.id, browserIdData, dao, Some(categoryId))

      // Now member 1 and 3 got notified about this new topic.
      val origPost = dao.loadPost(owensTopicIdTwo, PageParts.BodyNr).get
      listUsersNotifiedAbout(origPost.id) mustBe Set(member1.id, member3.id)
      expectedTotalNumNotfs += 2
      countTotalNumNotfs() mustBe expectedTotalNumNotfs
    }

    "...  replies to himself again" in {
      val aReply = reply(owner.id, owensTopicIdTwo, "aReply", parentNr = None)(dao)

      // Only member 3 want to know about every post.
      listUsersNotifiedAbout(aReply.id) mustBe Set(member3.id)
      expectedTotalNumNotfs += 1
      countTotalNumNotfs() mustBe expectedTotalNumNotfs
    }


    "Member 1 and 2 mute the site. Member 3 now wants normal notfs" in {
      dao.readWriteTransaction { tx =>
        tx.upsertPageNotfPref(PageNotfPref(member1.id, NotfLevel.Muted, wholeSite = true))
        tx.upsertPageNotfPref(PageNotfPref(member2.id, NotfLevel.Muted, wholeSite = true))
        tx.upsertPageNotfPref(PageNotfPref(member3.id, NotfLevel.Normal, wholeSite = true))
      }
    }

    "Member 1 creates a page" in {
      member1sPageOne = createPage(PageType.Discussion,
        textAndHtmlMaker.testTitle("member1sPageOne"),
        textAndHtmlMaker.testBody("member1sPageOne bd"),
        member1.id, browserIdData, dao, Some(categoryId))
    }

    "... will get notfs for every post, since created it" in {
      val notfLevels = dao.readOnlyTransaction(
        _.loadPageNotfLevels(member1.id, member1sPageOne, categoryId = None))
      notfLevels mustBe PageNotfLevels(
        forPage = Some(NotfLevel.WatchingAll),
        forWholeSite = Some(NotfLevel.Muted))
    }

    "Owen gets notified — he listens to everything, since is owner" in {
      val origPost = dao.loadPost(member1sPageOne, PageParts.BodyNr).get
      listUsersNotifiedAbout(origPost.id) mustBe Set(owner.id)
      expectedTotalNumNotfs += 1
      countTotalNumNotfs() mustBe expectedTotalNumNotfs
    }


    // ----- Page notf prefs override whole site prefs


    "Member 2 replies to member 1, who gets notified: it's a direct reply" in {
      val aReply = reply(member2.id, member1sPageOne, "aReply", parentNr = None)(dao)

      // Member 1, and Owen.
      listUsersNotifiedAbout(aReply.id) mustBe Set(member1.id, owner.id)
      expectedTotalNumNotfs += 2
      countTotalNumNotfs() mustBe expectedTotalNumNotfs
    }

    "... Member 2 starts Tracking the page, since posted on the page  *not impl* [REFACTORNOTFS]" in {
      dao.readWriteTransaction { tx =>
        tx.upsertPageNotfPref(
            PageNotfPref(member2.id, NotfLevel.Tracking, pageId = Some(member1sPageOne)))
      }
      /*
      val notfLevels = dao.readOnlyTransaction(
        _.loadPageNotfLevels(member2.id, member1sPageOne, categoryId = None))
      notfLevels mustBe PageNotfLevels(
        forPage = Some(NotfLevel.Tracking),
        forWholeSite = Some(NotfLevel.Muted))  */
    }

    "Member 3 replies to member 2" in {
      val aReply = reply(member3.id, member1sPageOne, "A reply to the 1st reply",
        parentNr = Some(PageParts.FirstReplyNr))(dao)

      // Member 1 (watches page), member 2 (direct reply), and Owen.
      listUsersNotifiedAbout(aReply.id) mustBe Set(member1.id, member2.id, owner.id)
      expectedTotalNumNotfs += 3
      countTotalNumNotfs() mustBe expectedTotalNumNotfs
    }


    // ----- Group notfs

    "Notification settings for the AllMembers group work, and can be overridden by each member" - {

      "All members listens for new topics. Except for member 1: Normal, member 2: Muted" in {
        dao.readWriteTransaction { tx =>
          tx.upsertPageNotfPref(
            PageNotfPref(Group.AllMembersId, NotfLevel.WatchingFirst, wholeSite = true))

          tx.upsertPageNotfPref(PageNotfPref(member1.id, NotfLevel.Normal, wholeSite = true))
          tx.upsertPageNotfPref(PageNotfPref(member2.id, NotfLevel.Muted, wholeSite = true))

          // Delete this pref.
          tx.deletePageNotfPref(PageNotfPref(member3.id, NotfLevel.Normal, wholeSite = true))
        }
      }

      var memberIdsNotified: Set[UserId] = null

      "Owen creates a topic, people get notified" in {
        everyoneNotfdTopicId = createPage(PageType.Discussion,
          textAndHtmlMaker.testTitle("owensTopicIdOne"),
          textAndHtmlMaker.testBody("owensTopicIdOne bd"),
          owner.id, browserIdData, dao, Some(categoryId))

        val origPost = dao.loadPost(everyoneNotfdTopicId, PageParts.BodyNr).get
        memberIdsNotified = listUsersNotifiedAbout(origPost.id)
      }

      o"""The AllMembers group, and members 3, 4, memberNoNotfsConfigd
            (notf of new topics, whole site), get notified""" in {
        // Member 2 has muted the site, and
        // member 1 has set site notfs to Normal — that overrides AllMember's notf setting.
        memberIdsNotified  mustBe Set(
            Group.AllMembersId, member3.id, member4.id, memberNoNotfsConfigd.id)
      }

      "In total, 4 peoples got notified" in {
        expectedTotalNumNotfs += 4
        countTotalNumNotfs() mustBe expectedTotalNumNotfs
      }

      "Owen posts a reply, to member 2 on Mebmer 1's page, and member 1 and 2 get notified" in {
        val aReply = reply(owner.id, member1sPageOne, "everyoneNotfdTopicId",
          parentNr = Some(PageParts.FirstReplyNr) // that's member 2's reply to member 1
          )(dao)
        memberIdsNotified = listUsersNotifiedAbout(aReply.id)
      }

      "... member 1 (created the page) and member 2 (direct reply) get notified" in {
        memberIdsNotified mustBe Set(member1.id, member2.id)
        expectedTotalNumNotfs += 2
        countTotalNumNotfs() mustBe expectedTotalNumNotfs
      }
    }



    // More later?:

    //  member watches page
    //  member watches category
    //  member watches whole site

    //  event on other page —> nothing

    //  group watches page
    //  group watches category
    //  group watches whole site

    //  group watches page,           member has muted
    //  group watches category,       member has muted
    //  group watches whole site,     member has muted

    //  group has muted page,      member watches all posts
    //  group has muted category,  member watches page, all posts
    //  group has muted category,  member watches category, new topics

    //  group watches new-topics category,    member watches all, page
    //  group watches new-topics category,    member watches all, category
    //  group watches new-topics category,    member watches all, whole site

    //  group watches new-topics whole-site,    member watches all, page
    //  group watches new-topics whole-site,    member watches all, category
    //  group watches new-topics whole-site,    member watches all, whole site

    //  group A watches page, every post
    //  group B watches page, muted
    //    —> max notf level
    //  swap A <–> B, try again, should be max notf level again

  }
}
