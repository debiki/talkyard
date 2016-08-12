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
import io.efdi.server.Who
import java.{util => ju}


class TagsAppSpec extends DaoAppSuite() {
  lazy val dao = Globals.siteDao(Site.FirstSiteId)

  lazy val categoryId: CategoryId =
    dao.createForum("Forum", "/tag-test-forum/",
      Who(theAdmin.id, browserIdData)).uncategorizedCategoryId

  lazy val theAdmin: User = createPasswordAdmin("tag_adm", dao)
  lazy val theModerator: User = createPasswordModerator("tag_mod", dao)
  lazy val theMember: User = createPasswordUser("tag_mbr", dao)
  lazy val theWrongMember: User = createPasswordUser("wr_tg_mbr", dao)
  var thePageId: PageId = _

  def reply(memberId: UserId, text: String, parentNr: Option[PostNr] = None): Post = {
    dao.insertReply(TextAndHtml.testBody(text), thePageId,
      replyToPostNrs = Set(parentNr getOrElse PageParts.BodyNr), PostType.Normal,
      Who(memberId, browserIdData)).post
  }

  def addRemoveTags(post: Post, tags: Set[TagLabel], memberId: UserId) {
    dao.addRemoveTagsIfAuth(post.pageId, post.uniqueId, tags, Who(memberId, browserIdData))
  }

  val TagLabel1 = "TagLabel1"
  val TagLabel2 = "TagLabel2"
  val TagLabel3 = "TagLabel3"
  val TagLabel4 = "TagLabel4"

  val TagsOneTwoThree = Set(TagLabel1, TagLabel2, TagLabel3)
  val TagsOneTwoThreeFour = Set(TagLabel1, TagLabel2, TagLabel3, TagLabel4)
  val TagsOneThree = Set(TagLabel1, TagLabel3)
  val TagsTwoFour = Set(TagLabel2, TagLabel4)


  "The Dao can tag pages and posts" - {
    val now = new ju.Date()

    "load, add, remove tags" in {
      thePageId = createPage(PageRole.Discussion, TextAndHtml.testTitle("Title"),
        TextAndHtml.testBody("body"), SystemUserId, browserIdData, dao, Some(categoryId))
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
      addRemoveTags(post, TagsTwoFour, theAdmin.id)
    }

  }
}
