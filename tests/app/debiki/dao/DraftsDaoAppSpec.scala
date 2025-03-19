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

package debiki.dao

import com.debiki.core._
import com.debiki.core.Prelude._
import org.scalatest._


class DraftsDaoAppSpec extends DaoAppSuite(disableScripts = true, disableBackgroundJobs = true) {
  var dao: SiteDao = _
  var owner: Participant = _
  var userOne: Participant = _
  var userTwo: Participant = _

  var forumPageId: PageId = _
  var categoryId: CategoryId = _

  var pageId: PageId = _
  var draftOne: Draft = _
  var draftTwoNewerForNewTopic: Draft = _
  var draftTwoEdited: Draft = _
  var draftThreeOlderDirectMessage: Draft = _
  var draftThreeDeleted: Draft = _
  var draftThreeUndeleted: Draft = _
  var draftThreeNewest: Draft = _
  var draftFourNewTopic: Draft = _
  var draftFiveForEdits: Draft = _
  var draftSixAnonReply: Draft = _

  val DraftOneText = "DraftOneText"
  val DraftTwoTitleOrig = "DraftTwoTitleOrig"
  val DraftTwoTitleEdited = "DraftTwoTitleEdited"
  val DraftTwoTextOrig = "DraftTwoTextOrig"
  val DraftTwoTextEdited = "DraftTwoTextEdited"
  val DraftThreeText = "DraftThreeText"
  val DraftFourText = "DraftFourText"
  val DraftFiveTextForEdits = "DraftFiveTextForEdits"
  val DraftSixAnonReplyText = "DraftSixAnonReplyText"

  lazy val now: When = globals.now()


  "DraftsDao can" - {

    "prepare" in {
      globals.systemDao.getOrCreateFirstSite()
      dao = globals.siteDao(Site.FirstSiteId)
      owner = createPasswordOwner("5kwu8f40", dao)
      userOne = createPasswordUser("pp22xxnn", dao, trustLevel = TrustLevel.BasicMember)
      userTwo = createPasswordUser("jjyyzz55", dao, trustLevel = TrustLevel.BasicMember)
      pageId = createPage(PageType.Discussion, dao.textAndHtmlMaker.forTitle("Reply Draft Page"),
        bodyTextAndHtml = dao.textAndHtmlMaker.forBodyOrComment("Text text."),
        authorId = SystemUserId, browserIdData, dao, anyCategoryId = None)

      val createForumResult =
          dao.createForum("Forum", s"/drafts-forum/", isForEmbCmts = false,
            Who(owner.id, browserIdData)).get
      categoryId = createForumResult.defaultCategoryId
      forumPageId = createForumResult.pagePath.pageId
    }

    "find the first draft nr" in {
      dao.readOnlyTransaction { tx =>
        tx.nextDraftNr(userOne.id) mustBe 1
      }
    }

    "save a draft for a reply" in {    TESTS_MISSING // test progr post drafts too
      val post = dao.loadPost(pageId, PageParts.BodyNr) getOrDie "TyE2ABKS40L"
      val locator = DraftLocator(
        DraftType.Reply,
        pageId = Some(pageId),
        postNr = Some(PageParts.BodyNr),
        postId = Some(post.id))

      draftOne = Draft(
        byUserId = userOne.id,
        draftNr = 1,
        createdAt = now,
        forWhat = locator,
        postType = Some(PostType.Normal),
        doAsAnon = None,
        title = "",
        text = DraftOneText)

      dao.readWriteTransaction { tx =>
        tx.upsertDraft(draftOne)
      }
    }

    "find the 2nd draft nr" in {
      dao.readOnlyTransaction { tx =>
        tx.nextDraftNr(userOne.id) mustBe 2
      }
    }

    "list zero drafts for user two" in {
      dao.readOnlyTransaction { tx =>
        tx.listDraftsRecentlyEditedFirst(userTwo.id, limit = 999) mustBe Nil
      }
    }

    "list one draft for user one" in {
      dao.readOnlyTransaction { tx =>
        tx.listDraftsRecentlyEditedFirst(userOne.id, limit = 999) mustBe Vector(draftOne)
      }
    }

    "save another draft, for a new topic" in {
      val locator = DraftLocator(
        DraftType.Topic,
        categoryId = Some(categoryId),
        pageId = Some(forumPageId))

      draftTwoNewerForNewTopic = Draft(
        byUserId = userOne.id,
        draftNr = 2,
        forWhat = locator,
        createdAt = now.plusMillis(1000),  // newer
        topicType = Some(PageType.Discussion),
        doAsAnon = None,
        title = "New topic title",
        text = DraftTwoTextOrig)

      dao.readWriteTransaction { tx =>
        tx.upsertDraft(draftTwoNewerForNewTopic)
      }
    }

    "save yet another draft, for a direct message" in {
      val locator = DraftLocator(
        DraftType.DirectMessage,
        toUserId = Some(userTwo.id))

      draftThreeOlderDirectMessage = Draft(
        byUserId = userOne.id,
        draftNr = 3,
        forWhat = locator,
        createdAt = now.minusMillis(1000),  // older
        topicType = Some(PageType.Discussion),
        doAsAnon = None,
        title = "Direct message title",
        text = DraftThreeText)

      dao.readWriteTransaction { tx =>
        tx.upsertDraft(draftThreeOlderDirectMessage)
      }
    }

    "list three drafts for user one, in correct order" in {
      dao.readOnlyTransaction { tx =>
        val drafts = tx.listDraftsRecentlyEditedFirst(userOne.id, limit = 999)
        drafts.length mustBe 3
        drafts mustBe Vector(
            draftTwoNewerForNewTopic, draftOne, draftThreeOlderDirectMessage)
      }
    }

    "won't find non-existing drafts" in {
      dao.readOnlyTransaction { tx =>
        tx.loadDraftByNr(userOne.id, 123456) mustBe None
      }
    }

    "can load drafts by nr" in {
      dao.readOnlyTransaction { tx =>
        val d1 = draftOne
        val d2 = draftTwoNewerForNewTopic
        val d3 = draftThreeOlderDirectMessage
        tx.loadDraftByNr(userOne.id, d1.draftNr) mustBe Some(d1)
        tx.loadDraftByNr(userOne.id, d2.draftNr) mustBe Some(d2)
        tx.loadDraftByNr(userOne.id, d3.draftNr) mustBe Some(d3)
      }
    }

    "can load drafts by locator" in {
      dao.readOnlyTransaction { tx =>
        val d1 = draftOne
        val d2 = draftTwoNewerForNewTopic
        val d3 = draftThreeOlderDirectMessage
        tx.loadDraftsByLocator(userOne.id, d1.forWhat) mustBe Vector(d1)
        tx.loadDraftsByLocator(userOne.id, d2.forWhat) mustBe Vector(d2)
        tx.loadDraftsByLocator(userOne.id, d3.forWhat) mustBe Vector(d3)
      }
    }

    "soft delete a draft" in {
      draftThreeDeleted = draftThreeOlderDirectMessage.copy(deletedAt = Some(now.plusMillis(21000)))
      dao.readWriteTransaction { tx =>
        tx.upsertDraft(draftThreeDeleted)
      }
    }

    "no longer incl in drafts list (but the others still are)" in {
      dao.readOnlyTransaction { tx =>
        val drafts = tx.listDraftsRecentlyEditedFirst(userOne.id, limit = 999)
        drafts.length mustBe 2
        drafts mustBe Vector(
          draftTwoNewerForNewTopic, draftOne)
      }
    }

    "can still load the others, by id and loctor" in {
      dao.readOnlyTransaction { tx =>
        val d1 = draftOne
        val d2 = draftTwoNewerForNewTopic
        tx.loadDraftByNr(userOne.id, d1.draftNr) mustBe Some(d1)
        tx.loadDraftByNr(userOne.id, d2.draftNr) mustBe Some(d2)
        tx.loadDraftsByLocator(userOne.id, d1.forWhat) mustBe Vector(d1)
        tx.loadDraftsByLocator(userOne.id, d2.forWhat) mustBe Vector(d2)
      }
    }

    "load the deleted draft, by nr, it's now in deleted status [TyT2ARDW3]" in {
      dao.readOnlyTransaction { tx =>
        draftThreeDeleted.draftNr mustBe draftThreeOlderDirectMessage.draftNr
        tx.loadDraftByNr(userOne.id, draftThreeDeleted.draftNr) mustBe Some(draftThreeDeleted)
      }
    }

    "but loading the deleted draft by locator = nothing" in {
      dao.readOnlyTransaction { tx =>
        tx.loadDraftsByLocator(userOne.id, draftThreeDeleted.forWhat) mustBe Vector()
      }
    }

    "can undelete a draft [TyT2ARDW3]" in {
      draftThreeUndeleted = draftThreeDeleted.copy(deletedAt = None)
      dao.readWriteTransaction { tx =>
        tx.upsertDraft(draftThreeUndeleted)
      }
    }

    "now it gets loaded by locator" in {
      dao.readOnlyTransaction { tx =>
        tx.loadDraftsByLocator(userOne.id, draftThreeUndeleted.forWhat) mustBe Vector(draftThreeUndeleted)
      }
    }

    "can upsert-change editedAt" in {
      dao.readOnlyTransaction { tx =>
        val drafts = tx.listDraftsRecentlyEditedFirst(userOne.id, limit = 999)
        drafts.length mustBe 3
        drafts mustBe Vector(draftTwoNewerForNewTopic, draftOne, draftThreeUndeleted)
      }

      draftThreeNewest = draftThreeUndeleted.copy(createdAt = now.plusMillis(29000))  // newest
      dao.readWriteTransaction { tx =>
        tx.upsertDraft(draftThreeNewest)
      }

      // This is what happens in the upsert:
      draftThreeNewest = draftThreeUndeleted.copy(lastEditedAt = Some(draftThreeNewest.createdAt))

      dao.readOnlyTransaction { tx =>
        tx.loadDraftByNr(userOne.id, draftThreeNewest.draftNr) mustBe Some(draftThreeNewest)

        val drafts = tx.listDraftsRecentlyEditedFirst(userOne.id, limit = 999)
        drafts.length mustBe 3
        drafts mustBe Vector(draftThreeNewest, draftTwoNewerForNewTopic, draftOne)
      }
    }

    "hard delete a draft" in {
      dao.readWriteTransaction { tx =>
        tx.deleteDraft(userOne.id, draftThreeNewest.draftNr)
      }
    }

    "now cannot load it any more at all, gone" in {
      dao.readOnlyTransaction { tx =>
        val d3 = draftThreeOlderDirectMessage
        tx.loadDraftByNr(userOne.id, d3.draftNr) mustBe None
        tx.loadDraftsByLocator(userOne.id, d3.forWhat) mustBe Nil
      }
    }

    "can edit a draft" in {
      draftTwoEdited = draftTwoNewerForNewTopic.copy(
        createdAt = now.plusMillis(12000),  // (4BKARE2)
        title = DraftTwoTitleEdited,
        text = DraftTwoTextEdited)
      dao.readWriteTransaction { tx =>
        tx.upsertDraft(draftTwoEdited)
      }
      // This is what the db code does — the upsert works as an edit, because draft already exists.
      draftTwoEdited = draftTwoEdited.copy(
        createdAt = draftTwoNewerForNewTopic.createdAt,
        lastEditedAt = Some(draftTwoEdited.createdAt))
    }

    "when reloading, the changes are there" in {
      dao.readOnlyTransaction { tx =>
        val d2 = draftTwoEdited
        tx.loadDraftByNr(userOne.id, d2.draftNr) mustBe Some(draftTwoEdited)
        tx.loadDraftsByLocator(userOne.id, d2.forWhat) mustBe Vector(draftTwoEdited)
      }
    }

    "the other draft wasn't changed" in {
      dao.readOnlyTransaction { tx =>
        val d1 = draftOne
        tx.loadDraftByNr(userOne.id, d1.draftNr) mustBe Some(d1)
        tx.loadDraftsByLocator(userOne.id, d1.forWhat) mustBe Vector(d1)
      }
    }

    "save a second new-topic draft" in {
      val locator = DraftLocator(
        DraftType.Topic,
        categoryId = Some(categoryId),
        pageId = Some(forumPageId))

      draftFourNewTopic = Draft(
        byUserId = userOne.id,
        draftNr = 4,
        forWhat = locator,
        createdAt = now.plusMillis(9000),  // newest, but older than the edits (4BKARE2)
        topicType = Some(PageType.Question),
        doAsAnon = None,
        title = "Is this a good question to ask?",
        text = DraftTwoTextOrig)

      dao.readWriteTransaction { tx =>
        tx.upsertDraft(draftFourNewTopic)
      }
    }

    "load only the new topic draft, by draft nr" in {
      dao.readOnlyTransaction { tx =>
        val d4 = draftFourNewTopic
        tx.loadDraftByNr(userOne.id, d4.draftNr) mustBe Some(d4)
      }
    }

    "load by both two new topic drafts, by locator" in {
      dao.readOnlyTransaction { tx =>
        val d2 = draftTwoEdited // is for new topic, too. And newest, since edted.
        val d4 = draftFourNewTopic
        val draftsLoaded = tx.loadDraftsByLocator(userOne.id, d4.forWhat)
        draftsLoaded.length mustBe 2
        draftsLoaded mustBe Vector(d2, d4)
      }
    }

    "save a draft, for edits" in {
      val post = dao.loadPost(pageId, PageParts.BodyNr) getOrDie "TyE5ABKR31"
      val locator = DraftLocator(
        DraftType.Edit,
        pageId = Some(pageId),
        postNr = Some(PageParts.BodyNr),
        postId = Some(post.id))

      draftFiveForEdits = Draft(
        byUserId = userOne.id,
        draftNr = 5,
        createdAt = now,
        forWhat = locator,
        postType = Some(PostType.Normal),
        doAsAnon = None,
        title = "",
        text = DraftFiveTextForEdits)

      dao.readWriteTransaction { tx =>
        tx.upsertDraft(draftFiveForEdits)
      }
    }

    "finds the for-edits draft, by draft locator" in {
      dao.readOnlyTransaction { tx =>
        tx.loadDraftsByLocator(userOne.id, draftFiveForEdits.forWhat) mustBe Vector(draftFiveForEdits)
      }
    }

    "... and draft one, by locator, without also finding draft 5" in {
      dao.readOnlyTransaction { tx =>
        tx.loadDraftsByLocator(userOne.id, draftOne.forWhat) mustBe Vector(draftOne)
      }
    }

    "... won't find anything, for the wrong post id (but correct page id and nr)" in {
      dao.readOnlyTransaction { tx =>
        val badId = Some(45678)
        tx.loadDraftsByLocator(userOne.id, draftFiveForEdits.forWhat.copy(postId = badId)) mustBe Nil
        tx.loadDraftsByLocator(userOne.id, draftOne.forWhat.copy(postId = badId)) mustBe Nil
      }
    }

    "save a draft for an anonymous reply, as a new anon" in {
      val post = dao.loadPost(pageId, PageParts.BodyNr) getOrDie "TyE2ABKS40L"
      val locator = DraftLocator(
            DraftType.Reply,
            pageId = Some(pageId),
            postNr = Some(PageParts.BodyNr),
            postId = Some(post.id))

      draftSixAnonReply = Draft(
            byUserId = userOne.id,
            draftNr = 6,
            createdAt = now,
            forWhat = locator,
            postType = Some(PostType.Normal),
            doAsAnon = Some(WhichAliasId.LazyCreatedAnon(AnonStatus.IsAnonCanAutoDeanon)),
            title = "",
            text = DraftSixAnonReplyText)

      dao.writeTx { (tx, _) =>
        tx.upsertDraft(draftSixAnonReply)
      }
    }

    "find the anon reply draft nr — and one's old true id reply too (draftOne)" in {
      dao.readOnlyTransaction { tx =>
        tx.loadDraftsByLocator(userOne.id, draftOne.forWhat) mustBe Vec(
              draftSixAnonReply, draftOne)
      }
    }

    TESTS_MISSING // Edit & update the anon draft too.  TyTEDUPDDFT04

    TESTS_MISSING // Save anon draft, reuse an anon.    TyTDFTREUSEANON
  }

}
