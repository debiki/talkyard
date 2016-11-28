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
import debiki.{TextAndHtml, Globals}
import java.{util => ju}


class TagsAppSpec extends DaoAppSuite() {
  lazy val dao = Globals.siteDao(Site.FirstSiteId)

  lazy val categoryId: CategoryId =
    dao.createForum("Forum", "/tag-test-forum/",
      Who(theOwner.id, browserIdData)).uncategorizedCategoryId

  lazy val theOwner: User = createPasswordOwner("tag_adm", dao)
  lazy val theModerator: User = createPasswordModerator("tag_mod", dao)
  lazy val theMember: User = createPasswordUser("tag_mbr", dao)
  lazy val theWrongMember: User = createPasswordUser("wr_tg_mbr", dao)
  var thePageId: PageId = _

  def reply(memberId: UserId, text: String, parentNr: Option[PostNr] = None): Post = {
    dao.insertReply(TextAndHtml.testBody(text), thePageId,
      replyToPostNrs = Set(parentNr getOrElse PageParts.BodyNr), PostType.Normal,
      Who(memberId, browserIdData), dummySpamRelReqStuff).post
  }

  def addRemoveTags(post: Post, tags: Set[TagLabel], memberId: UserId) {
    dao.addRemoveTagsIfAuth(post.pageId, post.uniqueId, tags, Who(memberId, browserIdData))
  }

  def watchTag(memberId: UserId, tagLabel: TagLabel) {
    dao.setTagNotfLevelIfAuth(theMember.id, tagLabel, NotfLevel.WatchingFirst,
      Who(memberId, browserIdData))
  }

  def stopWatchingTag(memberId: UserId, tagLabel: TagLabel) {
    dao.setTagNotfLevelIfAuth(theMember.id, tagLabel, NotfLevel.Normal,
      Who(memberId, browserIdData))
  }

  def countNotificationsToAbout(userId: UserId, postId: UniquePostId): Int = {
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

    "load, add, remove tags" in {
      thePageId = createPage(PageRole.Discussion, TextAndHtml.testTitle("Title"),
        TextAndHtml.testBody("body"), theOwner.id, browserIdData, dao, Some(categoryId))
      val postNoTags = reply(theMember.id, "No tags")
      val postWithTags = reply(theMember.id, "With tags")
      val postWithTagsLater = reply(theMember.id, "With tags, later")

      info("load 0 tags")
      dao.loadAllTagsAsSet() mustBe empty
      dao.loadTagsForPost(postNoTags.uniqueId) mustBe empty
      dao.loadTagsForPost(postWithTags.uniqueId) mustBe empty

      info("tag a post")
      addRemoveTags(postWithTags, Set(TagLabel1), theMember.id)

      info("find the tag")
      dao.loadAllTagsAsSet() mustBe Set(TagLabel1)
      dao.loadTagsForPost(postNoTags.uniqueId) mustBe empty
      dao.loadTagsForPost(postWithTags.uniqueId) mustBe Set(TagLabel1)

      info("add many tags")
      addRemoveTags(postWithTags, TagsOneTwoThree, theMember.id)

      info("find them")
      dao.loadAllTagsAsSet() mustBe TagsOneTwoThree
      dao.loadTagsForPost(postNoTags.uniqueId) mustBe empty
      dao.loadTagsForPost(postWithTags.uniqueId) mustBe TagsOneTwoThree

      info("remove a tag")
      addRemoveTags(postWithTags, TagsOneThree, theMember.id)

      info("now it's gone")
      dao.loadAllTagsAsSet() mustBe TagsOneThree
      dao.loadTagsForPost(postNoTags.uniqueId) mustBe empty
      dao.loadTagsForPost(postWithTags.uniqueId) mustBe TagsOneThree

      info("add and remove tags at the same time")
      addRemoveTags(postWithTags, TagsTwoFour, theMember.id)

      info("find the new tags")
      dao.loadAllTagsAsSet() mustBe TagsTwoFour
      dao.loadTagsForPost(postNoTags.uniqueId) mustBe empty
      dao.loadTagsForPost(postWithTags.uniqueId) mustBe TagsTwoFour

      info("tag two posts")
      addRemoveTags(postWithTagsLater, TagsOneTwoThree, theMember.id)
      dao.loadAllTagsAsSet() mustBe TagsOneTwoThreeFour
      dao.loadTagsForPost(postNoTags.uniqueId) mustBe empty
      dao.loadTagsForPost(postWithTags.uniqueId) mustBe TagsTwoFour
      dao.loadTagsForPost(postWithTagsLater.uniqueId) mustBe TagsOneTwoThree
    }


    "check permissions" in {
      val post = reply(theMember.id, "Some text")

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
      thePageId = createPage(PageRole.Discussion, TextAndHtml.testTitle("Title2"),
        TextAndHtml.testBody("body2"), SystemUserId, browserIdData, dao, Some(categoryId))

      val post = dao.readOnlyTransaction(_.loadThePost(thePageId, PageParts.BodyNr))

      info("gets notified about tagged topics")
      countNotificationsToAbout(theMember.id, post.uniqueId) mustBe 0
      addRemoveTags(post, Set(WatchedTag), theModerator.id)
      dao.listUsersNotifiedAboutPost(post.uniqueId) mustEqual Set(theMember.id)
      countNotificationsToAbout(theMember.id, post.uniqueId) mustBe 1

      info("only notified once of each post")
      addRemoveTags(post, Set(WatchedTag2), theModerator.id)
      countNotificationsToAbout(theMember.id, post.uniqueId) mustBe 1

      info("gets notified about tagged comments")
      val comment = reply(theModerator.id, "A comment")
      countNotificationsToAbout(theMember.id, comment.uniqueId) mustBe 0
      addRemoveTags(comment, Set(WatchedTag), theModerator.id)
      countNotificationsToAbout(theMember.id, comment.uniqueId) mustBe 1

      info("only notified once of each comment")
      addRemoveTags(comment, Set(WatchedTag2), theModerator.id)
      countNotificationsToAbout(theMember.id, comment.uniqueId) mustBe 1

      info("can stop watching a tag")
      stopWatchingTag(theMember.id, WatchedTag)

      info("no longer gets notified about that tag")
      val comment2 = reply(theModerator.id, "Comment 2")
      addRemoveTags(comment2, Set(WatchedTag), theModerator.id)
      countNotificationsToAbout(theMember.id, comment2.uniqueId) mustBe 0
    }

  }
}
