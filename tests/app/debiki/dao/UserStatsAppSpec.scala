/**
 * Copyright (c) 2017 Kaj Magnus Lindberg
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
import debiki.{Globals, TextAndHtml}
import java.{util => ju}
import scala.collection.mutable


class UserStatsAppSpec extends DaoAppSuite() {
  lazy val dao: SiteDao = Globals.siteDao(Site.FirstSiteId)

  lazy val categoryId: CategoryId =
    dao.createForum("Forum", "/tag-test-forum/",
      Who(owner.id, browserIdData)).uncategorizedCategoryId

  lazy val owner: Member = createPasswordOwner("tag_adm", dao)
  lazy val moderator: Member = createPasswordModerator("tag_mod", dao)
  lazy val member1: Member = createPasswordUser("tag_mb1", dao)
  lazy val wrongMember: Member = createPasswordUser("wr_tg_mbr", dao)

  var noRepliesTopicId: PageId = _
  var withRepliesTopicId: PageId = _
  var noMessagesChatTopicId: PageId = _
  var withMessagesChatTopicId: PageId = _

  val startTime: When = When.fromMillis(1000)


  def reply(memberId: UserId, pageId: PageId, text: String, parentNr: Option[PostNr] = None)
        : Post = {
    dao.insertReply(TextAndHtml.testBody(text), pageId,
      replyToPostNrs = Set(parentNr getOrElse PageParts.BodyNr), PostType.Normal,
      Who(memberId, browserIdData), dummySpamRelReqStuff).post
  }


  "The Dao can gather user statistics" - {
    val now = new ju.Date()

    "staff creates stuff" in {
      Globals.test.setTime(startTime)

      noRepliesTopicId = createPage(PageRole.Discussion,
        TextAndHtml.testTitle("noRepliesTopicId"), TextAndHtml.testBody("noRepliesTopicIde body"),
        owner.id, browserIdData, dao, Some(categoryId))

      withRepliesTopicId = createPage(PageRole.Discussion,
        TextAndHtml.testTitle("withRepliesTopicId"), TextAndHtml.testBody("withRepliesTopicId bd"),
        owner.id, browserIdData, dao, Some(categoryId))

      reply(moderator.id, withRepliesTopicId, s"Reply 1 (post nr 2)")
      reply(moderator.id, withRepliesTopicId, s"Reply 2 (post nr 3)")
      reply(moderator.id, withRepliesTopicId, s"Reply 3 (post nr 4)")

      noMessagesChatTopicId = createPage(PageRole.OpenChat,
        TextAndHtml.testTitle("chatTopicId"), TextAndHtml.testBody("chatTopicId body"),
        owner.id, browserIdData, dao, Some(categoryId))

      withMessagesChatTopicId = createPage(PageRole.OpenChat,
        TextAndHtml.testTitle("withMessagesChatTopicId"),
        TextAndHtml.testBody("withMessagesChatTopicId purpose"),
        owner.id, browserIdData, dao, Some(categoryId))

      // dao.insertChatMessage(...)
      // ...
    }

    "a member starts with blank stats" in {
      val (mem, stats) = loadTheMemberAndStats(member1.id)(dao)
      stats mustBe UserStats.forNewUser(mem.id, firstSeenAt = startTime, emailedAt = None)
    }

    "... logs in, stats get updated" in {
    }

    "... posts a topic, stats get updated" in {
    }

    "... posts a discourse reply, stats get updated" in {
    }

    "... posts a chat message, stats get updated" in {
    }

    "...reads a discourse topic, but no replies, topics-viewed updated, but not replies-read" in {
    }

    "... reads a discourse topic, with replies, now replies-read gets updated" in {
    }

    "... views a chat topic, stats gets updated" in {
    }

    /*
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
    */

  }
}
