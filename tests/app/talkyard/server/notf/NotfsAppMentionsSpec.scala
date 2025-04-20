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

package  talkyard.server.notf

import com.debiki.core._
import debiki.dao._
import java.{util => ju}
import talkyard.server.authz.ReqrAndTgt


class NotfsAppMentionsSpec extends DaoAppSuite(disableScripts = false) {
  var dao: SiteDao = _

  var createForumResult: CreateForumResult = _
  var categoryId: CategoryId = _

  var owner: User = _
  var ownerWho: Who = _
  var moderator: User = _
  val numStaffUsers = 2

  var member1: User = _
  var member2: User = _
  var member3: User = _
  var member4: User = _
  var member5NotInAnyChat: User = _
  var member6NotInAnyChat: User = _
  var member7NotInAnyChat: User = _
  var member8Dot: User = _
  var member9Dash: User = _
  var memberNeverMentioned: User = _

  var withRepliesTopicId: PageId = _

  var oldChatTopicId: PageId = _
  var chatTopicOneId: PageId = _
  var chatTopicTwoId: PageId = _
  var chatTopicManyJoinedId: PageId = _

  var expectedTotalNumNotfs = 0

  lazy val sysAndOwner = ReqrAndTgt(SystemUser_forTests, BrowserIdData.System, owner)


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
      createForumResult = dao.createForum("Forum", "/notf-test-forum/", isForEmbCmts = false, ownerWho).get
      categoryId = createForumResult.defaultCategoryId
      moderator = createPasswordModerator("ntf_mod", dao)
      member1 = createPasswordUser("ntf_mem1", dao)
      member2 = createPasswordUser("ntf_mem2", dao)
      member3 = createPasswordUser("ntf_mem3", dao)
      member4 = createPasswordUser("ntf_mem4", dao)
      member5NotInAnyChat = createPasswordUser("ntf_0cht5", dao)
      member6NotInAnyChat = createPasswordUser("ntf_0cht6", dao)
      member7NotInAnyChat = createPasswordUser("ntf_0cht7", dao)
      member8Dot = createPasswordUser("ntf.mem8", dao)
      member9Dash = createPasswordUser("ntf-mem9", dao)
      memberNeverMentioned = createPasswordUser("ntf_wrng", dao)

      // Disable notfs about everything to the owner, other notfs counts will be wrong.
      // Dupl code. [7UJKWRQ2]
      dao.readWriteTransaction { tx =>
        tx.deletePageNotfPref(PageNotfPref(owner.id, NotfLevel.Normal, wholeSite = true))
      }
    }

    "staff creates stuff" in {
      withRepliesTopicId = createPage(PageType.Discussion,
        textAndHtmlMaker.testTitle("withRepliesTopicId"),
        textAndHtmlMaker.testBody("withRepliesTopicId bd"),
        owner.id, browserIdData, dao, Some(categoryId))
      reply(moderator.id, withRepliesTopicId, s"Reply 1 (post nr 2) by mod", parentNr = None)(dao)
      expectedTotalNumNotfs += 1

      // The rest of the tests don't expect Owner to be notified about everything.
      dao.savePageNotfPrefIfAuZ(
        PageNotfPref(owner.id, NotfLevel.Normal, pageId = Some(withRepliesTopicId)),
        reqrTgt = sysAndOwner)

      // This stuff might be incorrectly matched & break the tests, if there're buggy SQL queries.
      oldChatTopicId = createPage(PageType.OpenChat,
        textAndHtmlMaker.testTitle("oldChatTopicId"), textAndHtmlMaker.testBody("chat purpose 2953"),
        owner.id, browserIdData, dao, Some(categoryId))
      dao.addUsersToPage(Set(owner.id), oldChatTopicId, byWho = ownerWho)
      dao.addUsersToPage(Set(moderator.id), oldChatTopicId, byWho = ownerWho)
      dao.savePageNotfPrefIfAuZ(
        PageNotfPref(owner.id, NotfLevel.Normal, pageId = Some(oldChatTopicId)),
        reqrTgt = sysAndOwner)
      chat(owner.id, oldChatTopicId, "chat message 1")(dao)
      // Needs to be a different member, otherwise the prev chat message gets appended to, instead.
      chat(moderator.id, oldChatTopicId, "chat message 2")(dao)

      chatTopicOneId = createPage(PageType.OpenChat,
        textAndHtmlMaker.testTitle("chatTopicId"), textAndHtmlMaker.testBody("chatTopicId body"),
        owner.id, browserIdData, dao, Some(categoryId))
      dao.savePageNotfPrefIfAuZ(
        PageNotfPref(owner.id, NotfLevel.Normal, pageId = Some(chatTopicOneId)),
        reqrTgt = sysAndOwner)

      chatTopicTwoId = createPage(PageType.OpenChat,
        textAndHtmlMaker.testTitle("chatTopicTwoId"),
        textAndHtmlMaker.testBody("chatTopicTwoId purpose"),
        owner.id, browserIdData, dao, Some(categoryId))
      dao.savePageNotfPrefIfAuZ(
        PageNotfPref(owner.id, NotfLevel.Normal, pageId = Some(chatTopicTwoId)),
        reqrTgt = sysAndOwner)

      chatTopicManyJoinedId = createPage(PageType.OpenChat,
        textAndHtmlMaker.testTitle("chatTopicManyJoinedId"),
        textAndHtmlMaker.testBody("chatTopicManyJoinedId purpose"),
        owner.id, browserIdData, dao, Some(categoryId))
      dao.savePageNotfPrefIfAuZ(
        PageNotfPref(owner.id, NotfLevel.Normal, pageId = Some(chatTopicManyJoinedId)),
        reqrTgt = sysAndOwner)

      dao.addUsersToPage(Set(owner.id), chatTopicManyJoinedId, byWho = ownerWho)
      dao.addUsersToPage(Set(moderator.id), chatTopicManyJoinedId, byWho = ownerWho)
      dao.addUsersToPage(Set(member1.id), chatTopicManyJoinedId, byWho = ownerWho)
      dao.addUsersToPage(Set(member2.id), chatTopicManyJoinedId, byWho = ownerWho)
      dao.addUsersToPage(Set(member3.id), chatTopicManyJoinedId, byWho = ownerWho)
      dao.addUsersToPage(Set(member4.id), chatTopicManyJoinedId, byWho = ownerWho)

      countTotalNumNotfs() mustBe expectedTotalNumNotfs
    }


    "notifies staff about a new member's first chat messages  TyTIT50267MT" - {
      // Without this, notification counts would be off with 2. Dupl code (9625676).

      var fisrtChatMessage: Post = null
      "member1 posts the chat message" in {
        fisrtChatMessage = chat(member1.id, chatTopicManyJoinedId, "My first message")(dao)
        expectedTotalNumNotfs += numStaffUsers
        numStaffUsers mustBe 2  // ttt
      }
      "staff gets notified" in {
        countTotalNumNotfs() mustBe expectedTotalNumNotfs
      }
      "and approves it" in {
        val p = fisrtChatMessage
        dao.moderatePostInstantly(pageId = p.pageId, postId = p.id, p.currentRevisionNr,
              ReviewDecision.Accept, moderator)
      }
    }

    "create no mention (in a chat)" - {
      "totally no mention" in {
        chat(member1.id, chatTopicManyJoinedId, "Hello")(dao)
        countTotalNumNotfs() mustBe expectedTotalNumNotfs
      }
      "when typing an email address" in {
        chat(member1.id, chatTopicManyJoinedId, "Hello someone@example.com")(dao)
        countTotalNumNotfs() mustBe expectedTotalNumNotfs
      }
      "when typing two @: @@" in {
        chat(member1.id, chatTopicManyJoinedId, s"Hello @@${member4.theUsername}")(dao)
        countTotalNumNotfs() mustBe expectedTotalNumNotfs
      }
      "when typing a non-existing username" in {
        chat(member1.id, chatTopicManyJoinedId, "Hello @does_not_exist")(dao)
        countTotalNumNotfs() mustBe expectedTotalNumNotfs
      }
      "when mentioning oneself" in {
        val myself = member1
        chat(myself.id, chatTopicManyJoinedId, s"Hello @${myself.theUsername}")(dao)
        countTotalNumNotfs() mustBe expectedTotalNumNotfs
      }
    }


    "staff notified about member2's first chat messages" in {
      // Without this, notification counts would be off with 2. Dupl code (9625676).
      val firstPost: Post = chat(member2.id, chatTopicManyJoinedId,
            "member2's first")(dao)
      expectedTotalNumNotfs += numStaffUsers
      info("staff notified about member2's first post")
      countTotalNumNotfs() mustBe expectedTotalNumNotfs
      info("staff approves")
      dao.moderatePostInstantly(pageId = firstPost.pageId, postId = firstPost.id,
            firstPost.currentRevisionNr, ReviewDecision.Accept, moderator)
    }

    "and about member3's first chat messages" in {
      // Without this, notification counts would be off with 2. Dupl code (9625676).
      val firstPost: Post = chat(member3.id, chatTopicManyJoinedId,
            "member3's first")(dao)
      expectedTotalNumNotfs += numStaffUsers
      info("staff notified about member3's first post")
      countTotalNumNotfs() mustBe expectedTotalNumNotfs
      info("staff approves")
      dao.moderatePostInstantly(pageId = firstPost.pageId, postId = firstPost.id,
            firstPost.currentRevisionNr, ReviewDecision.Accept, moderator)
    }

    "create specific people mentions (in a chat)" - {
      "create one mention, edit-delete, edit-recreate one mention" in {
        // Chat as mem 2 (not mem 1), so won't append to prev chat message.

        val chatPost = chat(member2.id, chatTopicManyJoinedId,
            s"Hello @${member1.theUsername}")(dao)
        expectedTotalNumNotfs += 1
        countTotalNumNotfs() mustBe expectedTotalNumNotfs
        listUsersNotifiedAbout(chatPost.id) mustBe Set(member1.id)
      }

      "create three mentions, edit-append delete two, real-edit-recreate one" in {
        info("mention 3 people")
        // Chat as mem 3 (not mem 2), so won't append to prev chat message.

        val chatPost = chat(member3.id, chatTopicManyJoinedId,
            s"Hi @${member1.theUsername} @${member2.theUsername} @${moderator.theUsername}")(dao)
        expectedTotalNumNotfs += 3
        countTotalNumNotfs() mustBe expectedTotalNumNotfs
        listUsersNotifiedAbout(chatPost.id) mustBe Set(member1.id, member2.id, moderator.id)

        info("edit and delete two mentions")
        edit(chatPost, member3.id,
            s"Hi @${member1.theUsername}")(dao)
        expectedTotalNumNotfs -= 2
        countTotalNumNotfs() mustBe expectedTotalNumNotfs
        listUsersNotifiedAbout(chatPost.id) mustBe Set(member1.id)

        // No, this no longer appends — instead, when @mention:ing sbd else, a new
        // chat message starts (so post id += 1, and num notfs += 2, now). TyT306WKCDE4 [NEXTCHATMSG]
        info("chat-append-recreate one mention")
        val post2 = chat(member3.id, chatTopicManyJoinedId,  // appends to the same message
            s"Hi @${member1.theUsername} and @${moderator.theUsername} again")(dao)
        post2.id mustBe (chatPost.id + 1)
        expectedTotalNumNotfs += 2
        countTotalNumNotfs() mustBe expectedTotalNumNotfs
        listUsersNotifiedAbout(post2.id) mustBe Set(member1.id, moderator.id)
      }

      "mention someone not in the chat, then append-add, then edit-add others not in the chat" in {
        // Chat as mem 1 (not mem 3), so won't append to prev chat message.

        info("mention someone")
        val chatPost = chat(member1.id, chatTopicManyJoinedId,
            s"Hi @${member5NotInAnyChat.theUsername}")(dao)
        expectedTotalNumNotfs += 1
        countTotalNumNotfs() mustBe expectedTotalNumNotfs
        listUsersNotifiedAbout(chatPost.id) mustBe Set(member5NotInAnyChat.id)

        // Now this creates a new message  [NEXTCHATMSG]
        info("append to message, mention same person again, plus someone else")
        val post2 = chat(member1.id, chatTopicManyJoinedId,
            s"Hi again @${member5NotInAnyChat.theUsername}, + @${member6NotInAnyChat.theUsername}")(dao)
        post2.id mustBe (chatPost.id + 1)
        expectedTotalNumNotfs += 2
        countTotalNumNotfs() mustBe expectedTotalNumNotfs
        listUsersNotifiedAbout(post2.id) mustBe Set(member5NotInAnyChat.id, member6NotInAnyChat.id)

        info("edit message & mention a third")
        edit(post2, member1.id,
          s"""Hi @${member5NotInAnyChat.theUsername} @${member6NotInAnyChat.theUsername}
              @${member7NotInAnyChat.theUsername}""")(dao)
        expectedTotalNumNotfs += 1
        countTotalNumNotfs() mustBe expectedTotalNumNotfs
        listUsersNotifiedAbout(post2.id) mustBe Set(
            member5NotInAnyChat.id, member6NotInAnyChat.id, member7NotInAnyChat.id)
      }
    }

    "mention @all" - {
      "if isn't staff, mentioning '@all' has no effect" in {
        // Post as member 2 not member 1, so as not to append to prev message.

        info("not when posting new chat message")
        val chatPost = chat(member2.id, chatTopicManyJoinedId, s"Hi @all")(dao)
        expectedTotalNumNotfs += 0
        countTotalNumNotfs() mustBe expectedTotalNumNotfs
        listUsersNotifiedAbout(chatPost.id) mustBe Set.empty

        edit(chatPost, member2.id, s"""Bye bye""")(dao)
        expectedTotalNumNotfs -= 0
        countTotalNumNotfs() mustBe expectedTotalNumNotfs

        // Now "appending" a @mention instead creates a new message  [NEXTCHATMSG]
        info("not when post-appending")
        val post2 = chat(member2.id, chatTopicManyJoinedId, s"... More @all")(dao)
        post2.id mustBe (chatPost.id + 1)
        expectedTotalNumNotfs += 0
        countTotalNumNotfs() mustBe expectedTotalNumNotfs

        edit(post2, member2.id, "Bye bye again")(dao)
        expectedTotalNumNotfs -= 0
        countTotalNumNotfs() mustBe expectedTotalNumNotfs

        info("not when editing")
        edit(post2, member2.id, "Hi @all again")(dao)
        expectedTotalNumNotfs += 0
        countTotalNumNotfs() mustBe expectedTotalNumNotfs
      }

      "in an empty chat (no one but oneself), won't notify people not in the chat" in {
        dao.addUsersToPage(Set(moderator.id), chatTopicTwoId, byWho = ownerWho)
        val chatPost = chat(moderator.id, chatTopicTwoId,
            s"Hi @all")(dao)
        expectedTotalNumNotfs += 0
        countTotalNumNotfs() mustBe expectedTotalNumNotfs
      }

      "in a chat with one other member, and edit-remove, chat-append" in {
        dao.addUsersToPage(Set(moderator.id), chatTopicOneId, byWho = ownerWho)
        dao.addUsersToPage(Set(member1.id), chatTopicOneId, byWho = ownerWho)

        info("say '... @all ...'")
        val chatPost = chat(moderator.id, chatTopicOneId,
            s"Hi @all")(dao)
        expectedTotalNumNotfs += 1
        countTotalNumNotfs() mustBe expectedTotalNumNotfs
        listUsersNotifiedAbout(chatPost.id) mustBe Set(member1.id)

        info("edit-remove '@all'")
        edit(chatPost, moderator.id,
            s"""Hi not all""")(dao)
        expectedTotalNumNotfs -= 1
        countTotalNumNotfs() mustBe expectedTotalNumNotfs
        listUsersNotifiedAbout(chatPost.id) mustBe Set.empty

        // Now "appending" a @mention instead creates a new message  [NEXTCHATMSG]
        info("chat-append '@all' again")
        val post2 = chat(moderator.id, chatTopicOneId,
            s"Hi @all")(dao)
        post2.id mustBe (chatPost.id + 1)
        expectedTotalNumNotfs += 1
        countTotalNumNotfs() mustBe expectedTotalNumNotfs
        listUsersNotifiedAbout(post2.id) mustBe Set(member1.id)

        info("edit-remove '@all'")
        edit(post2, moderator.id,
          s"""Hi not not not""")(dao)
        expectedTotalNumNotfs -= 1
        countTotalNumNotfs() mustBe expectedTotalNumNotfs
        listUsersNotifiedAbout(post2.id) mustBe Set.empty

        info("edit-add '@all' a third time")
        edit(post2, moderator.id,
          s"""Hi @all""")(dao)
        expectedTotalNumNotfs += 1
        countTotalNumNotfs() mustBe expectedTotalNumNotfs
        listUsersNotifiedAbout(post2.id) mustBe  Set(member1.id)
      }

      "mention @all + mem 4,5,6, in large chat, then edit-rm @all and mem 5, edit-add mem 7" in {
        val chatPost = chat(owner.id, chatTopicManyJoinedId,
            s"""@all + @${member4.theUsername} + @${member5NotInAnyChat.theUsername} +
                @${member6NotInAnyChat.theUsername}""")(dao)
        expectedTotalNumNotfs += 7  // 6 (incl mem 4) - oneself + mem-5-and-6 = 7
        countTotalNumNotfs() mustBe expectedTotalNumNotfs
        listUsersNotifiedAbout(chatPost.id) mustBe Set(
            member1.id, member2.id, member3.id, member4.id, moderator.id,
            member5NotInAnyChat.id, member6NotInAnyChat.id)

        info("edit-remove '@all', keep 4,6")
        edit(chatPost, owner.id,
            s"Only: @${member4.theUsername} @${member6NotInAnyChat.theUsername}")(dao)
        expectedTotalNumNotfs -= 5
        countTotalNumNotfs() mustBe expectedTotalNumNotfs
        listUsersNotifiedAbout(chatPost.id) mustBe Set(member4.id, member6NotInAnyChat.id)

        info("edit-add-back '@all' + member 7")
        edit(chatPost, owner.id,
            s"@all + @${member6NotInAnyChat.theUsername} + @${member7NotInAnyChat.theUsername}")(dao)
        expectedTotalNumNotfs += 5
        countTotalNumNotfs() mustBe expectedTotalNumNotfs
        listUsersNotifiedAbout(chatPost.id) mustBe Set(
            member1.id, member2.id, member3.id, member4.id, moderator.id,
            member6NotInAnyChat.id, member7NotInAnyChat.id)
      }

      "mention @all, kick a member, then remove @all — also the former member gets unmentioned" in {
        // Post as moderator, so as not to append to owner's prev message.

        val chatPost = chat(moderator.id, chatTopicManyJoinedId, "Good morning @all.")(dao)
        expectedTotalNumNotfs += 5  // 6 - oneself
        countTotalNumNotfs() mustBe expectedTotalNumNotfs
        listUsersNotifiedAbout(chatPost.id) mustBe Set(
            member1.id, member2.id, member3.id, member4.id, owner.id)

        dao.removeUsersFromPage(Set(member4.id), chatTopicManyJoinedId, byWho = ownerWho)

        info("edit-remove '@all'")
        edit(chatPost, moderator.id, "No one.")(dao)
        expectedTotalNumNotfs -= 5
        countTotalNumNotfs() mustBe expectedTotalNumNotfs
        listUsersNotifiedAbout(chatPost.id) mustBe Set.empty

        info("edit-add '@all' now won't notify the removed member")
        edit(chatPost, moderator.id, "Hi @all!")(dao)
        expectedTotalNumNotfs += 4
        countTotalNumNotfs() mustBe expectedTotalNumNotfs
        listUsersNotifiedAbout(chatPost.id) mustBe Set(
            member1.id, member2.id, member3.id, owner.id)  // not member4
      }

      "mention with dot in username, in a discourse topic" in {
        val replyToDotName: Post = reply(
            owner.id, withRepliesTopicId, s"Hmm @${member8Dot.theUsername} hi!",
            parentNr = Some(PageParts.BodyNr))(dao)
        expectedTotalNumNotfs += 1
        countTotalNumNotfs() mustBe expectedTotalNumNotfs
        listUsersNotifiedAbout(replyToDotName.id) mustBe Set(member8Dot.id)
      }

      "mention with dash in username, in a discourse topic" in {
        val replyToDashName: Post = reply(
          owner.id, withRepliesTopicId, s"Hi @${member9Dash.theUsername} wow!",
          parentNr = Some(PageParts.BodyNr))(dao)
        expectedTotalNumNotfs += 1
        countTotalNumNotfs() mustBe expectedTotalNumNotfs
        listUsersNotifiedAbout(replyToDashName.id) mustBe Set(member9Dash.id)
      }

    }
  }
}
