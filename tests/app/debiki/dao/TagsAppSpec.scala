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
import java.{util => ju}
import org.scalatest.{FreeSpec, MustMatchers}


class TagsDaoSpec extends FreeSpec with MustMatchers {

  "TagsDao can" - {
    "findTagLabelProblem" - {
      "ok tag name: zz,  zzz,  zzzz.... max length" in {
        var anyProbem = TagsDao.findTagLabelProblem("zz")
        anyProbem mustBe empty

        anyProbem = TagsDao.findTagLabelProblem("zzz")
        anyProbem mustBe empty

        anyProbem = TagsDao.findTagLabelProblem("z" * TagsDao.MaxTagLength)
        anyProbem mustBe empty
      }

      "ok tag name: all letters a-z" in {
        val anyProbem = TagsDao.findTagLabelProblem("abcdefghijklmnopqrstuvwxyz")
        anyProbem mustBe empty
      }

      "ok tag name: all numbes 0-9" in {
        val anyProbem = TagsDao.findTagLabelProblem("0123456789")
        anyProbem mustBe empty
      }

      "ok tag name: some punctuation at the end" in {
        val anyProbem = TagsDao.findTagLabelProblem("punct_~:.-")
        anyProbem mustBe empty
      }

      "ok tag name: some punctuation in the start" in {
        val anyProbem = TagsDao.findTagLabelProblem("_~:.-punct")
        anyProbem mustBe empty
      }

      "ok tag name: some punctuation in the middle" in {
        val anyProbem = TagsDao.findTagLabelProblem("pun_~:.-nct")
        anyProbem mustBe empty
      }

      "empty tag name" in {
        val anyProbem = TagsDao.findTagLabelProblem("")
        anyProbem.map(_.code) mustBe Some("TyEMINTAGLEN_")
      }

      "too long tag name" in {
        val anyProbem = TagsDao.findTagLabelProblem("z" * (TagsDao.MaxTagLength + 1))
        anyProbem.map(_.code) mustBe Some("TyEMAXTAGLEN_")
      }

      "whitespace" in {
        val anyProbem = TagsDao.findTagLabelProblem("z z")
        anyProbem.map(_.code) mustBe Some("TyETAGBLANK_")
      }

      "bad punct" in {
        for (c <- """!"#$%&'()*+,/;<=>?@[\]^`{|}""") {
          val anyProbem = TagsDao.findTagLabelProblem("badpunct_" + c)
          anyProbem.map(_.message).getOrElse("") must contain(c)
          anyProbem.map(_.code) mustBe Some("TyETAGPUNCT_")
        }
      }
    }
  }
}


class TagsAppSpec extends DaoAppSuite() {
  lazy val dao: SiteDao = {
    globals.systemDao.getOrCreateFirstSite()
    globals.siteDao(Site.FirstSiteId)
  }

  lazy val categoryId: CategoryId =
    dao.createForum("Forum", "/tag-test-forum/", isForEmbCmts = false,
      Who(theOwner.id, browserIdData)).defaultCategoryId

  lazy val theOwner: Participant = createPasswordOwner("tag_adm", dao)
  lazy val theModerator: Participant = createPasswordModerator("tag_mod", dao)
  lazy val theMember: Participant = createPasswordUser("tag_mbr", dao)
  lazy val theWrongMember: Participant = createPasswordUser("wr_tg_mbr", dao)
  var thePageId: PageId = _

  def addRemoveTags(post: Post, tags: Set[TagLabel], memberId: UserId) {
    dao.addRemoveTagsIfAuth(post.pageId, post.id, tags, Who(memberId, browserIdData))
  }

  def watchTag(memberId: UserId, tagLabel: TagLabel) {
    dao.setTagNotfLevelIfAuth(theMember.id, tagLabel, NotfLevel.WatchingFirst,
      Who(memberId, browserIdData))
  }

  def stopWatchingTag(memberId: UserId, tagLabel: TagLabel) {
    dao.setTagNotfLevelIfAuth(theMember.id, tagLabel, NotfLevel.Normal,
      Who(memberId, browserIdData))
  }

  def countNotificationsToAbout(userId: UserId, postId: PostId): Int = {
    var notfs = dao.loadNotificationsForRole(userId, limit = 999, unseenFirst = true)
    notfs.count({
      case notf: Notification.NewPost => notf.uniquePostId == postId
      case x => fail(s"Bad notf type: ${classNameOf(x)}")
    })
  }

  val TagLabel1 = "TagLabel1"
  val TagLabel2 = "TagLabel2"
  val TagLabel3 = "TagLabel3"
  val TagLabel4 = "TagLabel4"

  val TagsOneTwoThree = Set(TagLabel1, TagLabel2, TagLabel3)
  val TagsOneTwoThreeFour = Set(TagLabel1, TagLabel2, TagLabel3, TagLabel4)
  val TagsOneThree = Set(TagLabel1, TagLabel3)
  val TagsTwoFour = Set(TagLabel2, TagLabel4)

  val WatchedTag = "WatchedTag"
  val WatchedTag2 = "WatchedTag2"

  "The Dao can tag pages and posts" - {
    val now = new ju.Date()

    "prepare" in {
      dao
      theOwner

      // Disable notfs about everything to the owner, other notfs counts will be wrong.
      // Dupl code. [7UJKWRQ2]
      dao.readWriteTransaction { tx =>
        tx.deletePageNotfPref(PageNotfPref(theOwner.id, NotfLevel.Normal, wholeSite = true))
      }
    }

    "load, add, remove tags" in {
      thePageId = createPage(PageRole.Discussion, textAndHtmlMaker.testTitle("Title"),
        textAndHtmlMaker.testBody("body"), theOwner.id, browserIdData, dao, Some(categoryId))
      val postNoTags = reply(theMember.id, thePageId, "No tags")(dao)
      val postWithTags = reply(theMember.id, thePageId, "With tags")(dao)
      val postWithTagsLater = reply(theMember.id, thePageId, "With tags, later")(dao)

      info("load 0 tags")
      dao.loadAllTagsAsSet() mustBe empty
      dao.loadTagsForPost(postNoTags.id) mustBe empty
      dao.loadTagsForPost(postWithTags.id) mustBe empty

      info("tag a post")
      addRemoveTags(postWithTags, Set(TagLabel1), theMember.id)

      info("find the tag")
      dao.loadAllTagsAsSet() mustBe Set(TagLabel1)
      dao.loadTagsForPost(postNoTags.id) mustBe empty
      dao.loadTagsForPost(postWithTags.id) mustBe Set(TagLabel1)

      info("add many tags")
      addRemoveTags(postWithTags, TagsOneTwoThree, theMember.id)

      info("find them")
      dao.loadAllTagsAsSet() mustBe TagsOneTwoThree
      dao.loadTagsForPost(postNoTags.id) mustBe empty
      dao.loadTagsForPost(postWithTags.id) mustBe TagsOneTwoThree

      info("remove a tag")
      addRemoveTags(postWithTags, TagsOneThree, theMember.id)

      info("now it's gone")
      dao.loadAllTagsAsSet() mustBe TagsOneThree
      dao.loadTagsForPost(postNoTags.id) mustBe empty
      dao.loadTagsForPost(postWithTags.id) mustBe TagsOneThree

      info("add and remove tags at the same time")
      addRemoveTags(postWithTags, TagsTwoFour, theMember.id)

      info("find the new tags")
      dao.loadAllTagsAsSet() mustBe TagsTwoFour
      dao.loadTagsForPost(postNoTags.id) mustBe empty
      dao.loadTagsForPost(postWithTags.id) mustBe TagsTwoFour

      info("tag two posts")
      addRemoveTags(postWithTagsLater, TagsOneTwoThree, theMember.id)
      dao.loadAllTagsAsSet() mustBe TagsOneTwoThreeFour
      dao.loadTagsForPost(postNoTags.id) mustBe empty
      dao.loadTagsForPost(postWithTags.id) mustBe TagsTwoFour
      dao.loadTagsForPost(postWithTagsLater.id) mustBe TagsOneTwoThree
    }


    "check permissions" in {
      val post = reply(theMember.id, thePageId, "Some text")(dao)

      info("The wrong member may not tag")
      intercept[Exception] {
        addRemoveTags(post, TagsOneTwoThree, theWrongMember.id)
      }

      info("The author may add tags")
      addRemoveTags(post, TagsOneTwoThree, theMember.id)

      info("Moderators and admins may always edit tags")
      addRemoveTags(post, TagsOneTwoThreeFour, theModerator.id)
      addRemoveTags(post, TagsTwoFour, theOwner.id)
    }


    "people can watch tags" in {
      watchTag(theMember.id, WatchedTag)
      watchTag(theMember.id, WatchedTag2)
      val moderatorWho = Who(theModerator.id, browserIdData)

      // No notfs will be sent to the system user.
      thePageId = createPage(PageRole.Discussion, textAndHtmlMaker.testTitle("Title2"),
        textAndHtmlMaker.testBody("body2"), SystemUserId, browserIdData, dao, Some(categoryId))

      val post = dao.readOnlyTransaction(_.loadThePost(thePageId, PageParts.BodyNr))

      info("gets notified about tagged topics")
      countNotificationsToAbout(theMember.id, post.id) mustBe 0
      addRemoveTags(post, Set(WatchedTag), theModerator.id)
      dao.listUsersNotifiedAboutPost(post.id) mustEqual Set(theMember.id)
      countNotificationsToAbout(theMember.id, post.id) mustBe 1

      info("only notified once of each post")
      addRemoveTags(post, Set(WatchedTag2), theModerator.id)
      countNotificationsToAbout(theMember.id, post.id) mustBe 1

      info("gets notified about tagged comments")
      val comment = reply(theModerator.id, thePageId, "A comment")(dao)
      countNotificationsToAbout(theMember.id, comment.id) mustBe 0
      addRemoveTags(comment, Set(WatchedTag), theModerator.id)
      countNotificationsToAbout(theMember.id, comment.id) mustBe 1

      info("only notified once of each comment")
      addRemoveTags(comment, Set(WatchedTag2), theModerator.id)
      countNotificationsToAbout(theMember.id, comment.id) mustBe 1

      info("can stop watching a tag")
      stopWatchingTag(theMember.id, WatchedTag)

      info("no longer gets notified about that tag")
      val comment2 = reply(theModerator.id, thePageId, "Comment 2")(dao)
      addRemoveTags(comment2, Set(WatchedTag), theModerator.id)
      countNotificationsToAbout(theMember.id, comment2.id) mustBe 0
    }

  }
}
