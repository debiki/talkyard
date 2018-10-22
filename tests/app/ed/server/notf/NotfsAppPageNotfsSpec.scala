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

package ed.server.notf

import com.debiki.core._
import debiki.dao._
import java.{util => ju}


class NotfsAppPageNotfsSpec extends DaoAppSuite() {
  var dao: SiteDao = _

  var createForumResult: CreateForumResult = _
  var categoryId: CategoryId = _

  var owner: Member = _
  var ownerWho: Who = _
  var moderator: Member = _
  var member1: Member = _
  var member2: Member = _
  var member3: Member = _
  var member4: Member = _
  var memberNoNotfsConfigd: Member = _

  var owensTopicIdOne: PageId = _
  var owensTopicIdTwo: PageId = _
  var member1sPageOne: PageId = _

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


  def edit(post: Post, editorId: UserId, newText: String)(dao: SiteDao) : Unit =
    super.edit(post, editorId, newText, skipNashorn = false)(dao)

  def chat(memberId: UserId, pageId: PageId, text: String)(dao: SiteDao): Post =
    super.chat(memberId, pageId, text, skipNashorn = false)(dao)

  def reply(memberId: UserId, pageId: PageId, text: String, parentNr: Option[PostNr])(
        dao: SiteDao): Post =
    super.reply(memberId, pageId, text, parentNr = parentNr, skipNashorn = false)(dao)


  "NotificationGenerator can create and remove notifications" - {
    val now = new ju.Date()

    "prepare" in {
      globals.testSetTime(startTime)
      globals.systemDao.getOrCreateFirstSite()
      dao = globals.siteDao(Site.FirstSiteId)
      owner = createPasswordOwner("ntf_ownr", dao)
      ownerWho = Who(owner.id, browserIdData)
      createForumResult = dao.createForum("Forum", "/notf-test-forum/", isForEmbCmts = false, ownerWho)
      categoryId = createForumResult.defaultCategoryId
      moderator = createPasswordModerator("ntf_mod", dao)

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
      owensTopicIdOne = createPage(PageRole.Discussion,
        textAndHtmlMaker.testTitle("owensTopicIdOne"),
        textAndHtmlMaker.testBody("owensTopicIdOne bd"),
        owner.id, browserIdData, dao, Some(categoryId))

      // Both member 1 and 2 want to know about new topics.
      expectedTotalNumNotfs += 2
      countTotalNumNotfs() mustBe expectedTotalNumNotfs
      val origPost = dao.loadPost(owensTopicIdOne, PageParts.BodyNr).get
      listUsersNotifiedAbout(origPost.id) mustBe Set(member1.id, member2.id)
    }

    "...  replies to himself" in {
      val aReply = reply(owner.id, owensTopicIdOne, "aReply", parentNr = None)(dao)

      // Only member 1 want to know about every post.
      expectedTotalNumNotfs += 1
      countTotalNumNotfs() mustBe expectedTotalNumNotfs
      listUsersNotifiedAbout(aReply.id) mustBe Set(member1.id)
    }


    // ----- Edit whole site notfs


    "member 1 now wants only new topic notfs, member 2 nothing, and member 3 every post" in {
      dao.readWriteTransaction { tx =>
        tx.upsertPageNotfPref(PageNotfPref(member1.id, NotfLevel.WatchingFirst, wholeSite = true))
        tx.upsertPageNotfPref(PageNotfPref(member2.id, NotfLevel.Normal, wholeSite = true))
        tx.upsertPageNotfPref(PageNotfPref(member3.id, NotfLevel.WatchingAll, wholeSite = true))
      }
    }

    "Owen creates another page" in {
      owensTopicIdTwo = createPage(PageRole.Discussion,
        textAndHtmlMaker.testTitle("owensTopicIdTwo"),
        textAndHtmlMaker.testBody("owensTopicIdTwo bd"),
        owner.id, browserIdData, dao, Some(categoryId))

      // Now member 1 and 3 want to know about new topics.
      expectedTotalNumNotfs += 2
      countTotalNumNotfs() mustBe expectedTotalNumNotfs
      val origPost = dao.loadPost(owensTopicIdTwo, PageParts.BodyNr).get
      listUsersNotifiedAbout(origPost.id) mustBe Set(member1.id, member3.id)
    }

    "...  replies to himself again" in {
      val aReply = reply(owner.id, owensTopicIdTwo, "aReply", parentNr = None)(dao)

      // Only member 3 want to know about every post.
      expectedTotalNumNotfs += 1
      countTotalNumNotfs() mustBe expectedTotalNumNotfs
      listUsersNotifiedAbout(aReply.id) mustBe Set(member3.id)
    }


    "Member 1 mutes the site. Member 2 and 3 now wants normal notfs" in {
      dao.readWriteTransaction { tx =>
        tx.upsertPageNotfPref(PageNotfPref(member1.id, NotfLevel.Muted, wholeSite = true))
        tx.upsertPageNotfPref(PageNotfPref(member2.id, NotfLevel.Muted, wholeSite = true))
        tx.upsertPageNotfPref(PageNotfPref(member3.id, NotfLevel.Normal, wholeSite = true))
      }
    }

    "Member 1 creates a page" in {
      member1sPageOne = createPage(PageRole.Discussion,
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
      expectedTotalNumNotfs += 1
      countTotalNumNotfs() mustBe expectedTotalNumNotfs
      val origPost = dao.loadPost(member1sPageOne, PageParts.BodyNr).get
      listUsersNotifiedAbout(origPost.id) mustBe Set(owner.id)
    }


    // ----- Page notf prefs override whole site prefs


    "Member 2 replies to member 1, who gets notified: it's a direct reply" in {
      val aReply = reply(member2.id, member1sPageOne, "aReply", parentNr = None)(dao)

      // Member 1, and Owen.
      expectedTotalNumNotfs += 2
      countTotalNumNotfs() mustBe expectedTotalNumNotfs
      listUsersNotifiedAbout(aReply.id) mustBe Set(member1.id, owner.id)
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
      expectedTotalNumNotfs += 3
      countTotalNumNotfs() mustBe expectedTotalNumNotfs
      listUsersNotifiedAbout(aReply.id) mustBe Set(member1.id, member2.id, owner.id)
    }

  }
}
