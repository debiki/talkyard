/**
 * Copyright (C) 2017 Kaj Magnus Lindberg
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
import java.{util => ju}


class UserStatsAppSpec extends DaoAppSuite() {
  var dao: SiteDao = _

  var owner: Member = _
  var ownerWho: Who = _

  var createForumResult: CreateForumResult = _
  var categoryId: CategoryId = _

  var moderator: Member = _
  var member1: Member = _
  var wrongMember: Member = _

  var noRepliesTopicId: PageId = _
  var withRepliesTopicId: PageId = _

  var twoMessagesChatTopicId: PageId = _
  var addMessagesChatTopicId: PageId = _
  var withMessagesChatTopicId: PageId = _

  var currentStats: UserStats = _


  def pretendThereAreManyReplies(pageId: PageId) {
    val oldMeta = dao.loadThePageMeta(pageId)
    val newMeta = oldMeta.copy(numRepliesTotal = 9999, numRepliesVisible = 9999, numPostsTotal = 9999)
    dao.readWriteTransaction(_.updatePageMeta(newMeta, oldMeta = oldMeta,
      markSectionPageStale = false))
  }


  "The Dao can gather user statistics" - {
    val now = new ju.Date()

    "prepare" in {
      globals.testSetTime(startTime)
      globals.systemDao.getOrCreateFirstSite()
      dao = globals.siteDao(Site.FirstSiteId)
      owner = createPasswordOwner("us_adm", dao)
      ownerWho = Who(owner.id, browserIdData)
      createForumResult = dao.createForum("Forum", "/tag-test-forum/", isForEmbCmts = false, ownerWho)
      categoryId = createForumResult.defaultCategoryId
      moderator = createPasswordModerator("us_mod", dao)
      member1 = createPasswordUser("us_mb1", dao)
      wrongMember = createPasswordUser("us_wr_mb", dao)
    }

    "staff creates stuff" in {
      noRepliesTopicId = createPage(PageRole.Discussion,
        textAndHtmlMaker.testTitle("noRepliesTopicId"),
        textAndHtmlMaker.testBody("noRepliesTopicIde body"),
        owner.id, browserIdData, dao, Some(categoryId))
      pretendThereAreManyReplies(noRepliesTopicId)

      withRepliesTopicId = createPage(PageRole.Discussion,
        textAndHtmlMaker.testTitle("withRepliesTopicId"),
        textAndHtmlMaker.testBody("withRepliesTopicId bd"),
        owner.id, browserIdData, dao, Some(categoryId))
      reply(moderator.id, withRepliesTopicId, s"Reply 1 (post nr 2)")(dao)
      reply(moderator.id, withRepliesTopicId, s"Reply 2 (post nr 3)")(dao)
      reply(moderator.id, withRepliesTopicId, s"Reply 3 (post nr 4)")(dao)
      pretendThereAreManyReplies(withRepliesTopicId)

      twoMessagesChatTopicId = createPage(PageRole.OpenChat,
        textAndHtmlMaker.testTitle("twoMessagesChatTopicId"),
        textAndHtmlMaker.testBody("chat purpose 2953"),
        owner.id, browserIdData, dao, Some(categoryId))
      dao.addUsersToPage(Set(owner.id), twoMessagesChatTopicId, byWho = ownerWho)
      dao.addUsersToPage(Set(moderator.id), twoMessagesChatTopicId, byWho = ownerWho)
      chat(owner.id, twoMessagesChatTopicId, "chat message 1")(dao)
      // Needs to be a different member, otherwise the prev chat message gets appended to, instead.
      chat(moderator.id, twoMessagesChatTopicId, "chat message 2")(dao)

      addMessagesChatTopicId = createPage(PageRole.OpenChat,
        textAndHtmlMaker.testTitle("chatTopicId"),
        textAndHtmlMaker.testBody("chatTopicId body"),
        owner.id, browserIdData, dao, Some(categoryId))
      pretendThereAreManyReplies(addMessagesChatTopicId)

      withMessagesChatTopicId = createPage(PageRole.OpenChat,
        textAndHtmlMaker.testTitle("withMessagesChatTopicId"),
        textAndHtmlMaker.testBody("withMessagesChatTopicId purpose"),
        owner.id, browserIdData, dao, Some(categoryId))
      // dao.insertChatMessage(...)
      // ...
      pretendThereAreManyReplies(withMessagesChatTopicId)
    }

    lazy val initialStats =
      UserStats.forNewUser(member1.id, firstSeenAt = startTime, emailedAt = None)

    "a member starts with blank stats" in {
      val (mem, stats) = loadTheMemberAndStats(member1.id)(dao)
      stats mustBe initialStats
    }

    "... logs out, last-seen stats get updated" in {
      playTimeMillis(1000)
      dao.logout(member1.id)
      val stats = loadUserStats(member1.id)(dao)
      stats mustBe initialStats.copy(lastSeenAt = currentTime)
    }

    "... logs in, stats get updated" in {
      playTimeMillis(1000)
      dao.verifyPrimaryEmailAddress(member1.id, globals.now().toJavaDate)
      val loginGrant = dao.tryLoginAsMember(PasswordLoginAttempt(
        ip = "1.2.3.4", globals.now().toJavaDate, member1.email, "public-us_mb1"))
      val stats = loadUserStats(member1.id)(dao)
      stats mustBe initialStats.copy(lastSeenAt = currentTime)
    }

    "... posts a topic, stats get updated" in {
      playTimeMillis(1000)
      createPage(PageRole.Discussion,
        textAndHtmlMaker.testTitle("topic"),
        textAndHtmlMaker.testBody("topic text"),
        member1.id, browserIdData, dao, Some(categoryId))
      currentStats = loadUserStats(member1.id)(dao)
      currentStats mustBe initialStats.copy(
        lastSeenAt = currentTime,
        lastPostedAt = Some(currentTime),
        firstNewTopicAt = Some(currentTime),
        numDiscourseTopicsCreated = 1)
    }

    "... posts a discourse reply, stats get updated" in {
      playTimeMillis(1000)
      reply(member1.id, noRepliesTopicId, s"A reply")(dao)
      val correctStats = currentStats.copy(
        lastSeenAt = currentTime,
        lastPostedAt = Some(currentTime),
        firstDiscourseReplyAt = Some(currentTime),
        numDiscourseRepliesPosted = currentStats.numDiscourseRepliesPosted + 1)
      currentStats = loadUserStats(member1.id)(dao)
      currentStats mustBe correctStats
    }

    "... posts a chat message, stats get updated" in {
      playTimeMillis(1000)
      dao.addUsersToPage(Set(member1.id), addMessagesChatTopicId, byWho = ownerWho)
      chat(member1.id, addMessagesChatTopicId, "Chat chat")(dao)
      val correctStats = currentStats.copy(
        lastSeenAt = currentTime,
        lastPostedAt = Some(currentTime),
        firstChatMessageAt = Some(currentTime),
        numChatMessagesPosted = currentStats.numChatMessagesPosted + 1)
      currentStats = loadUserStats(member1.id)(dao)
      currentStats mustBe correctStats
    }

    "... gets an email, last-emailed-at gets updated" in {
      playTimeMillis(1000)
      val email = Email(EmailType.Notification, createdAt = globals.now(),
        sendTo = member1.email, toUserId = Some(member1.id),
        subject = "Dummy email", bodyHtmlText = (emailId: String) => "Text text")
      dao.saveUnsentEmail(email)
      globals.sendEmail(email, dao.siteId)
      val startMs = System.currentTimeMillis()
      var newStats = loadUserStats(member1.id)(dao)
      newStats.lastEmailedAt mustBe empty
      while (newStats.lastEmailedAt.isEmpty && System.currentTimeMillis() - startMs < 5000) {
        newStats = loadUserStats(member1.id)(dao)
      }
      newStats.lastEmailedAt mustBe Some(currentTime)
      currentStats = newStats
    }

    "... looks at a discourse topic, but doesn't read it" in {
      playTimeMillis(1200)
      dao.trackReadingProgressClearNotfsPerhapsPromote(member1, noRepliesTopicId, Set.empty, ReadingProgress(
        firstVisitedAt = globals.now(),
        lastVisitedAt = globals.now(),
        lastViewedPostNr = PageParts.BodyNr,
        lastReadAt = None,
        lastPostNrsReadRecentFirst = Vector.empty,
        lowPostNrsRead = Set.empty,
        secondsReading = 0))
      val correctStats = currentStats.copy(lastSeenAt = currentTime, numDiscourseTopicsEntered = 1)
      currentStats = loadUserStats(member1.id)(dao)
      currentStats mustBe correctStats
    }

    "... reads the orig post" in {
      playTimeMillis(1000)
      dao.trackReadingProgressClearNotfsPerhapsPromote(member1, noRepliesTopicId, Set.empty, ReadingProgress(
        firstVisitedAt = globals.now(),
        lastVisitedAt = globals.now(),
        lastViewedPostNr = PageParts.BodyNr,
        lastReadAt = Some(globals.now()),
        lastPostNrsReadRecentFirst = Vector.empty,
        lowPostNrsRead = Set(PageParts.BodyNr),
        secondsReading = 12))
      val correctStats = currentStats.copy(
        lastSeenAt = currentTime,
        numSecondsReading = 12)

      currentStats = loadUserStats(member1.id)(dao)
      currentStats mustBe correctStats
      currentStats.numDiscourseRepliesRead mustBe 0 // orig post doesn't count
    }

    "... reads a discourse topic, with replies, now replies-read gets updated" in {
      playTimeMillis(1000)
      dao.trackReadingProgressClearNotfsPerhapsPromote(member1, withRepliesTopicId, Set.empty, ReadingProgress(
        firstVisitedAt = globals.now() minusMillis 400,
        lastVisitedAt = globals.now() minusMillis 200,
        lastViewedPostNr = 3,
        lastReadAt = Some(globals.now() minusMillis 300),
        lastPostNrsReadRecentFirst = Vector.empty,
        lowPostNrsRead = Set(3, 4, 17),
        secondsReading = 111))
      val correctStats = currentStats.copy(
        lastSeenAt = currentTime minusMillis 200,
        numSecondsReading = 123,  // 111 + 12
        numDiscourseTopicsEntered = 2, // noRepliesTopicId and withRepliesTopicId
        numDiscourseRepliesRead = 3)   // 3, 4, 17 above

      currentStats = loadUserStats(member1.id)(dao)
      currentStats mustBe correctStats
    }

    "... views even more replies" in {
      playTimeMillis(1000)
      dao.trackReadingProgressClearNotfsPerhapsPromote(member1, withRepliesTopicId, Set.empty, ReadingProgress(
        firstVisitedAt = globals.now() minusMillis 400,
        lastVisitedAt = globals.now(),
        lastViewedPostNr = 33,
        lastReadAt = Some(globals.now()),
        lastPostNrsReadRecentFirst = Vector.empty,
        lowPostNrsRead = Set(PageParts.BodyNr, 24, 32, 33, 34),
        secondsReading = 1111))
      val correctStats = currentStats.copy(
        lastSeenAt = currentTime,
        numSecondsReading = 1234,  // 1111 + 111 + 12
        numDiscourseRepliesRead = 3 + 4)   // 3, 4, 17, then 24, 32, 33, 34

      currentStats = loadUserStats(member1.id)(dao)
      currentStats mustBe correctStats
    }

    "... views a chat topic, low post nrs only, stats gets updated" in {
      playTimeMillis(1000)
      dao.trackReadingProgressClearNotfsPerhapsPromote(member1, withMessagesChatTopicId, Set.empty, ReadingProgress(
        firstVisitedAt = globals.now() minusMillis 500,
        lastVisitedAt = globals.now(),
        lastViewedPostNr = 10,
        lastReadAt = Some(globals.now()),
        lastPostNrsReadRecentFirst = Vector.empty,
        lowPostNrsRead = Set(1 to 10: _*),
        secondsReading = 4))
      val correctStats = currentStats.copy(
        lastSeenAt = currentTime,
        numSecondsReading = 1238,  // 1234 + 4
        numChatTopicsEntered = 1,
        numChatMessagesRead = 9)

      currentStats = loadUserStats(member1.id)(dao)
      currentStats mustBe correctStats
    }

    "... reads a bit more in the same a chat topic, still low post nrs" in {
      playTimeMillis(1000)
      dao.trackReadingProgressClearNotfsPerhapsPromote(member1, withMessagesChatTopicId, Set.empty, ReadingProgress(
        firstVisitedAt = globals.now() minusMillis 500,
        lastVisitedAt = globals.now(),
        lastViewedPostNr = 12055,
        lastReadAt = Some(globals.now()),
        lastPostNrsReadRecentFirst = Vector.empty,
        // Posts 5..10 already read, won't be counted again.
        lowPostNrsRead = Set(5 to ReadingProgress.MaxLowPostNr: _*),
        secondsReading = 1000))
      val correctStats = currentStats.copy(
        lastSeenAt = currentTime,
        numSecondsReading = 2238,  // 1238 + 1000
        // 1..10 had been read earlier.  -1 because orig-post isn't a chat message (it instead
        // contains the purpose of the chat).
        numChatMessagesRead = ReadingProgress.MaxLowPostNr - 1)

      currentStats = loadUserStats(member1.id)(dao)
      currentStats mustBe correctStats
    }

    "... views a chat topic with 2 messages, cannot read more than 2" in {
      playTimeMillis(1000)
      val exception = intercept[Exception] {
        dao.trackReadingProgressClearNotfsPerhapsPromote(member1, twoMessagesChatTopicId, Set.empty, ReadingProgress(
          firstVisitedAt = globals.now(),
          lastVisitedAt = globals.now(),
          lastViewedPostNr = 1,
          lastReadAt = Some(globals.now()),
          lastPostNrsReadRecentFirst = Vector.empty,
          lowPostNrsRead = Set(2, 3, 4),  // nr 4 doesn't exist
          secondsReading = 1))
      }
      exception.getMessage must include("EdE7UKW25_")
    }

    "... but can read 2" in {
      playTimeMillis(1000)
      dao.trackReadingProgressClearNotfsPerhapsPromote(member1, twoMessagesChatTopicId, Set.empty, ReadingProgress(
        firstVisitedAt = globals.now() minusMillis 500,
        lastVisitedAt = globals.now(),
        lastViewedPostNr = 1,
        lastReadAt = Some(globals.now()),
        lastPostNrsReadRecentFirst = Vector.empty,
        lowPostNrsRead = Set(1, 2, 3),  // nr 1 = the orig post, won't count, so +2 below (not +3)
        secondsReading = 200))
      val correctStats = currentStats.copy(
        lastSeenAt = currentTime,
        numSecondsReading = 2438,  // 2238 + 200
        numChatTopicsEntered = 2,
        numChatMessagesRead = ReadingProgress.MaxLowPostNr - 1 + 2)
      currentStats = loadUserStats(member1.id)(dao)
      currentStats mustBe correctStats
    }

    "... views a chat topic, high post nrs only, stats gets updated" in {
      pending // [7GPKW205]
    }

    "... gets a solution accepted" in {
      pending
    }

    "... gives a like" in {
      pending
    }

    "... gets a like" in {
      pending
    }

    "... has visited for one day" in {
      pending
    }

    "... visits for one more day" in {
      pending
    }

    "... resets topics-new-since" in {
      pending
    }
  }
}
