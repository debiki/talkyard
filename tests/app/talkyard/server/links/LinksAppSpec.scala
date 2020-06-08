/**
 * Copyright (c) 2020 Kaj Magnus Lindberg
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

package talkyard.server.links

import com.debiki.core._
import com.debiki.core.Prelude._
import debiki.TitleSourceAndHtml
import debiki.dao._
import play.api.libs.json.{JsObject, JsString, Json}


class LinksAppSpec extends DaoAppSuite {

  val when: When = When.fromMillis(3100010001000L)
  val createdAt: When = when.minusMillis(10001000)

  lazy val daoSite1: SiteDao = {
    globals.systemDao.getOrCreateFirstSite()
    globals.siteDao(Site.FirstSiteId)
  }


  lazy val createForumResult: CreateForumResult = daoSite1.createForum(
        title = "Forum to delete", folder = "/", isForEmbCmts = false,
        Who(SystemUserId, browserIdData)).get

  lazy val forumId: PageId = createForumResult.pagePath.pageId

  lazy val defCatId: CategoryId = createForumResult.defaultCategoryId

  lazy val category2: Category = category2Result.category
  lazy val category2Result: CreateCategoryResult = createCategory(
        slug = "cat-2",
        forumPageId = createForumResult.pagePath.pageId,
        parentCategoryId = createForumResult.rootCategoryId,
        authorId = SystemUserId,
        browserIdData,
        daoSite1)

  /*
  lazy val (site2, daoSite2) = createSite("site2")

  lazy val forumSite2Id: PageId = daoSite2.createForum(
        title = "Forum site 2", folder = "/", isForEmbCmts = false,
        Who(SystemUserId, browserIdData)).get.pagePath.pageId
  */


  lazy val userMmm: User = createPasswordUser("u_mmm234", daoSite1)
  lazy val userOoo: User = createPasswordOwner("u_ooo567", daoSite1)



  // ----- External links, oEmbed

  // (We don't need any pages or categories for these tests to work.)

  val extLinkOneUrl = "https://ex.co/ext-widget"
  val extLinkOneOEmbUrl = s"https://ex.co/oembed?url=$extLinkOneUrl"
  val extLinkOneOEmbJsonOrig: JsObject = Json.obj("html" -> JsString("<b>Contents</b>"))
  val extLinkOneOEmbJsonEdited: JsObject = Json.obj("html" -> JsString("<i>Edited</i>"))

  val extLinkTwoUrl = "https://ex.two.co/ext-two-widget"
  val extLinkTwoOEmbUrl = s"https://ex.two.co/wow-an-oembed?url=$extLinkTwoUrl"
  val extLinkTwoAnotherOEmbUrl = s"$extLinkTwoOEmbUrl&par=am"
  val extLinkTwoOEmbJson: JsObject = Json.obj("html" -> JsString("<b>Two Two</b>"))
  val extLinkTwoAnotherOEmbJson: JsObject = Json.obj("html" -> JsString("<b>Another</b>"))

  lazy val linkPreviewOneOrig: LinkPreview = LinkPreview(
        linkUrl = extLinkOneUrl,
        fetchedFromUrl = extLinkOneOEmbUrl,
        fetchedAt = when,
        // cache_max_secs_c = ... — later
        statusCode = 200,
        previewType = LinkPreviewTypes.OEmbed,
        firstLinkedById = userMmm.id,
        contentJson = extLinkOneOEmbJsonOrig)

  lazy val linkPreviewOneEdited: LinkPreview =
    linkPreviewOneOrig.copy(
          contentJson = extLinkOneOEmbJsonEdited)

  lazy val linkPreviewTwo: LinkPreview = LinkPreview(
        linkUrl = extLinkTwoUrl,
        fetchedFromUrl = extLinkTwoOEmbUrl,
        fetchedAt = when.plusMillis(10),
        // cache_max_secs_c = ... — later
        statusCode = 200,
        previewType = LinkPreviewTypes.OEmbed,
        firstLinkedById = userOoo.id,
        contentJson = extLinkTwoOEmbJson)

  lazy val linkPreviewTwoOtherOEmbUrl: LinkPreview = linkPreviewTwo.copy(
        linkUrl = extLinkTwoUrl,
        fetchedFromUrl = extLinkTwoAnotherOEmbUrl,
        fetchedAt = when.plusMillis(110),
        firstLinkedById = userMmm.id,
        contentJson = extLinkTwoAnotherOEmbJson)


  "prepare: create site 1 and 2, and owners, forums".in {
    // Lazy create things:
    daoSite1 // creates site 1
    //daoSite2 // creates site 2, incl owner
    createForumResult
    userOoo
    userMmm
  }


  "Link previews: Insert, update, find, delete" - {

    "Insert".inWriteTx(daoSite1) { (tx, _) =>
      tx.upsertLinkPreview(linkPreviewOneOrig)
      tx.upsertLinkPreview(linkPreviewTwo)
    }

    "Read back".inReadTx(daoSite1) { tx =>
      tx.loadLinkPreviewByUrl(extLinkOneUrl, extLinkOneOEmbUrl + "-wrong") mustBe None
      tx.loadLinkPreviewByUrl(extLinkOneUrl + "-wrong", extLinkOneOEmbUrl) mustBe None
      val pv1 = tx.loadLinkPreviewByUrl(extLinkOneUrl, extLinkOneOEmbUrl).get
      pv1 mustBe linkPreviewOneOrig

      val pv2 = tx.loadLinkPreviewByUrl(extLinkTwoUrl, extLinkTwoOEmbUrl).get
      pv2 mustBe linkPreviewTwo

      // Mixing link one and two — no no.
      tx.loadLinkPreviewByUrl(extLinkOneUrl, extLinkTwoOEmbUrl) mustBe None
      tx.loadLinkPreviewByUrl(extLinkTwoUrl, extLinkOneOEmbUrl) mustBe None
    }

    "Update".inWriteTx(daoSite1) { (tx, _) =>
      linkPreviewOneOrig.firstLinkedById mustBe userMmm.id // not userOoo, ttt
      tx.upsertLinkPreview(
            linkPreviewOneEdited.copy(
                  // This change should get ignored — only the *first*
                  // user who typed the ext link, is remembered.
                  firstLinkedById = userOoo.id))
    }

    "Read back after update".inReadTx(daoSite1) { tx =>
      val editedPrevw = tx.loadLinkPreviewByUrl(extLinkOneUrl, extLinkOneOEmbUrl).get
      editedPrevw mustBe linkPreviewOneEdited
      editedPrevw.firstLinkedById mustBe userMmm.id  // not userOoo

      info("the 2nd link preview didn't change")
      val pv2 = tx.loadLinkPreviewByUrl(extLinkTwoUrl, extLinkTwoOEmbUrl).get
      pv2 mustBe linkPreviewTwo
    }

    "Delete link preview one".inWriteTx(daoSite1) { (tx, _) =>
      tx.deleteLinkPreviews(extLinkOneUrl)
    }

    "... thereafter it's gone".inReadTx(daoSite1) { tx =>
      tx.loadLinkPreviewByUrl(extLinkOneUrl, extLinkOneOEmbUrl) mustBe None

      info("but the 2nd preview is still there")
      val pv2 = tx.loadLinkPreviewByUrl(extLinkTwoUrl, extLinkTwoOEmbUrl).get
      pv2 mustBe linkPreviewTwo
    }

    o"""Can upsert many oEmbed previews for the same external link — e.g. if
          downloaded for different screen sizes""".inWriteTx(daoSite1) { (tx, _) =>
      tx.upsertLinkPreview(linkPreviewTwoOtherOEmbUrl)
    }

    "Can get from db, per link + oEmbed url".inReadTx(daoSite1) { tx =>
      val pv2 = tx.loadLinkPreviewByUrl(extLinkTwoUrl, extLinkTwoOEmbUrl).get
      pv2 mustBe linkPreviewTwo

      val pv2Other = tx.loadLinkPreviewByUrl(extLinkTwoUrl, extLinkTwoAnotherOEmbUrl).get
      pv2Other mustBe linkPreviewTwoOtherOEmbUrl

      tx.loadAllLinkPreviewsByUrl(extLinkTwoUrl) mustBe Seq(
            linkPreviewTwo, linkPreviewTwoOtherOEmbUrl)
    }

    "Can delete all oEmbeds per ext link at once".inWriteTx(daoSite1) { (tx, _) =>
      tx.deleteLinkPreviews(extLinkTwoUrl) mustBe 2
    }

    "Gone".inReadTx(daoSite1) { tx =>
      tx.loadLinkPreviewByUrl(extLinkTwoUrl, extLinkTwoOEmbUrl) mustBe None
      tx.loadLinkPreviewByUrl(extLinkTwoUrl, extLinkTwoAnotherOEmbUrl) mustBe None
      tx.loadAllLinkPreviewsByUrl(extLinkTwoUrl) mustBe Seq.empty
    }
  }



  // ----- Internal links

  // The text on these posts and pages doesn't actually link to anything.
  // But we'll insert links anyway — we're testing the SQL code, not the CommonMark
  // parsing & find external links code.

  def createLetterPage(letter: Char, anyCategoryId: Option[CategoryId] = None)
        : CreatePageResult =
    createPage2(
          PageType.Discussion, TitleSourceAndHtml(s"Title $letter"),
          textAndHtmlMaker.testBody(s"Body $letter."), authorId = SystemUserId,
          browserIdData, daoSite1, anyCategoryId = anyCategoryId)

  lazy val pageA: CreatePageResult = createLetterPage('A')
  // Place B in a category different from defCatId, so we can verify a page
  // in another category isn't affected by deleting defCatId.
  lazy val pageB: CreatePageResult = createLetterPage('B', Some(category2.id))
  lazy val pageC: CreatePageResult = createLetterPage('C', Some(defCatId))
  lazy val pageD: CreatePageResult = createLetterPage('D')
  lazy val pageE: CreatePageResult = createLetterPage('E')
  lazy val pageF: CreatePageResult = createLetterPage('F')
  // All links lead to Z, or Q.
  lazy val pageZ: CreatePageResult = createLetterPage('Z')
  lazy val pageQ: CreatePageResult = createLetterPage('Q')

  lazy val pageEReplyOne: Post = reply(
        SystemUserId, pageE.id, text = "pg E re One", parentNr = Some(BodyNr))(daoSite1)

  lazy val pageEReplyTwo: Post = reply(
        SystemUserId, pageE.id, text = "pg E re Two", parentNr = Some(BodyNr))(daoSite1)

  lazy val pageFReplyToHide: Post = reply(
        SystemUserId, pageF.id, text = "pg F re Hide", parentNr = Some(BodyNr))(daoSite1)


  // We'll start with links A —> {B, Z} only:
  lazy val linkAToB: Link = Link(
        fromPostId = pageA.bodyPost.id,
        linkUrl = s"/-${pageB.id}",
        addedAt = when,
        addedById = SystemUserId,
        isExternal = false,
        toPageId = Some(pageB.id),
        toPostId = None,
        toPpId = None,
        toTagId = None,
        toCategoryId = None)

  lazy val linkAToZ: Link = linkAToB.copy(
        linkUrl = s"/-${pageZ.id}",
        toPageId = Some(pageZ.id))

  // These inserted a bit later:
  lazy val linkBToZ: Link = linkAToZ.copy(fromPostId = pageB.bodyPost.id)
  lazy val linkCToZ: Link = linkAToZ.copy(fromPostId = pageC.bodyPost.id)
  lazy val linkDToZ: Link = linkAToZ.copy(fromPostId = pageD.bodyPost.id)

  // Even later, replies linking to Z:
  lazy val linkEReOneToQ: Link = linkAToZ.copy(
        fromPostId = pageEReplyOne.id,
        linkUrl = s"/-${pageQ.id}",
        toPageId = Some(pageQ.id))
  lazy val linkEReTwoToQ: Link = linkEReOneToQ.copy(fromPostId = pageEReplyTwo.id)
  lazy val linkFReToQ: Link = linkEReOneToQ.copy(fromPostId = pageFReplyToHide.id)


  "Internal links: Insert, update, find, delete" - {

    "Prepare: Create pages" in {
      // Need to create the pages before the links, because if the pages got
      // lazy created when their `lazy val` are accessed by the links, the page
      // tx:s would start *after* the link tx:es, and foreign keys would fail.
      pageA; pageB; pageC; pageD; pageE; pageF; pageZ; pageQ
    }

    "Insert A —> {B,Z}".inWriteTx(daoSite1) { (tx, _) =>
      tx.upsertLink(linkAToB) mustBe true
      tx.upsertLink(linkAToZ) mustBe true
    }

    "Find links from a post: A's body post".inReadTx(daoSite1) { tx =>
      tx.loadLinksFromPost(345678) mustBe Seq.empty
      tx.loadLinksFromPost(pageA.bodyPost.id) mustBe Seq(linkAToB, linkAToZ)
      tx.loadLinksFromPost(pageB.bodyPost.id) mustBe Seq.empty
      tx.loadLinksFromPost(pageC.bodyPost.id) mustBe Seq.empty

      info("Find page ids linked from a page")
      tx.loadPageIdsLinkedFromPage("23456789") mustBe Set.empty
      tx.loadPageIdsLinkedFromPage(pageA.id) mustBe Set(pageB.id, pageZ.id)
      tx.loadPageIdsLinkedFromPage(pageB.id) mustBe Set.empty
      tx.loadPageIdsLinkedFromPage(pageC.id) mustBe Set.empty

      info("Find page ids linked from a post: A –> {B,Z}")
      tx.loadPageIdsLinkedFromPosts(Set.empty) mustBe Set.empty
      tx.loadPageIdsLinkedFromPosts(Set(1234567, 2345678, 3456789)) mustBe Set.empty
      tx.loadPageIdsLinkedFromPosts(Set(pageA.bodyPost.id)) mustBe Set(pageB.id, pageZ.id)
      tx.loadPageIdsLinkedFromPosts(Set(pageB.bodyPost.id)) mustBe Set.empty
      tx.loadPageIdsLinkedFromPosts(Set(pageC.bodyPost.id)) mustBe Set.empty
      tx.loadPageIdsLinkedFromPosts(Set(pageZ.bodyPost.id)) mustBe Set.empty

      info("Find page ids linked from many posts: {A,B} —> {B,Z}")
      tx.loadPageIdsLinkedFromPosts(
            Set(pageA.bodyPost.id, pageB.bodyPost.id)) mustBe Set(pageB.id, pageZ.id)
      info("Find self-self is fine: {A,Z} —> {B,Z}  because A —> {B,Z}")
      tx.loadPageIdsLinkedFromPosts(
            Set(pageA.bodyPost.id, pageZ.bodyPost.id)) mustBe Set(pageB.id, pageZ.id)

      info("Find links to a page")
      tx.loadLinksToPage("3456789") mustBe Seq.empty
      tx.loadLinksToPage(pageA.id) mustBe Seq.empty
      tx.loadLinksToPage(pageB.id) mustBe Seq(linkAToB)
      tx.loadLinksToPage(pageC.id) mustBe Seq.empty
      tx.loadLinksToPage(pageZ.id) mustBe Seq(linkAToZ)

      info("Find page ids linking to a page")
      tx.loadPageIdsLinkingToPage(pageA.id, inclDeletedHidden = false) mustBe Set.empty
      tx.loadPageIdsLinkingToPage(pageB.id, inclDeletedHidden = false) mustBe Set(pageA.id)
      tx.loadPageIdsLinkingToPage(pageC.id, inclDeletedHidden = false) mustBe Set.empty
      tx.loadPageIdsLinkingToPage(pageZ.id, inclDeletedHidden = false) mustBe Set(pageA.id)
    }

    "Delete link A —> B".inWriteTx(daoSite1) { (tx, _) =>
      val bodyId = pageA.bodyPost.id
      tx.deleteLinksFromPost(bodyId, Set.empty) mustBe 0
      tx.deleteLinksFromPost(bodyId, Set("/wrong-link")) mustBe 0
      tx.deleteLinksFromPost(bodyId, Set("/wrong", "/and/wrong-2")) mustBe 0
      tx.deleteLinksFromPost(bodyId, Set(linkAToB.linkUrl + "wrong")) mustBe 0
      tx.deleteLinksFromPost(bodyId, Set(linkAToB.linkUrl)) mustBe 1
      tx.deleteLinksFromPost(bodyId, Set(linkAToB.linkUrl)) mustBe 0  // already gone
    }

    "Link A —> B gone".inReadTx(daoSite1) { tx =>
      info("Find links from post: Only A —> Z remains")
      tx.loadLinksFromPost(pageA.bodyPost.id) mustBe Seq(linkAToZ)

      info("Find page ids linked from page A: not B, only Z")
      tx.loadPageIdsLinkedFromPage(pageA.id) mustBe Set(pageZ.id)
      tx.loadPageIdsLinkedFromPage(pageB.id) mustBe Set.empty
      tx.loadPageIdsLinkedFromPage(pageC.id) mustBe Set.empty
      tx.loadPageIdsLinkedFromPage(pageZ.id) mustBe Set.empty

      info("Find page A body post —> Z link,  but not —> B")
      tx.loadPageIdsLinkedFromPosts(Set(pageA.bodyPost.id)) mustBe Set(pageZ.id)

      info("Find links to page Z:  A —> Z only")
      tx.loadLinksToPage(pageA.id) mustBe Seq.empty
      tx.loadLinksToPage(pageB.id) mustBe Seq.empty
      tx.loadLinksToPage(pageC.id) mustBe Seq.empty
      tx.loadLinksToPage(pageZ.id) mustBe Seq(linkAToZ)

      info("Find page ids linking to Z:  page A")
      tx.loadPageIdsLinkingToPage(pageA.id, inclDeletedHidden = false) mustBe Set.empty
      tx.loadPageIdsLinkingToPage(pageB.id, inclDeletedHidden = false) mustBe Set.empty
      tx.loadPageIdsLinkingToPage(pageC.id, inclDeletedHidden = false) mustBe Set.empty
      tx.loadPageIdsLinkingToPage(pageZ.id, inclDeletedHidden = false) mustBe Set(pageA.id)
    }

    "Add links: {B,C,D} —> Z".inWriteTx(daoSite1) { (tx, _) =>
      tx.upsertLink(linkBToZ)
      tx.upsertLink(linkCToZ)
      tx.upsertLink(linkDToZ)
    }

    "Find link {B,C,D} —> Z".inReadTx(daoSite1) { tx =>
      info("First, old link A —> Z")
      tx.loadLinksFromPost(pageA.bodyPost.id) mustBe Seq(linkAToZ)
      tx.loadPageIdsLinkedFromPage(pageA.id) mustBe Set(pageZ.id)

      info("The new {B,C,D} —> Z")
      tx.loadLinksFromPost(pageB.bodyPost.id) mustBe Seq(linkBToZ)
      tx.loadLinksFromPost(pageC.bodyPost.id) mustBe Seq(linkCToZ)
      tx.loadLinksFromPost(pageD.bodyPost.id) mustBe Seq(linkDToZ)
      tx.loadPageIdsLinkedFromPage(pageB.id) mustBe Set(pageZ.id)
      tx.loadPageIdsLinkedFromPage(pageC.id) mustBe Set(pageZ.id)
      tx.loadPageIdsLinkedFromPage(pageD.id) mustBe Set(pageZ.id)

      info("Now Z is linked from A, B, C, D: Exact links")
      tx.loadLinksToPage(pageA.id) mustBe Seq.empty
      tx.loadLinksToPage(pageB.id) mustBe Seq.empty
      tx.loadLinksToPage(pageC.id) mustBe Seq.empty
      tx.loadLinksToPage(pageD.id) mustBe Seq.empty
      tx.loadLinksToPage(pageZ.id) mustBe Seq(linkAToZ, linkBToZ, linkCToZ, linkDToZ)

      info("... and page ids")
      tx.loadPageIdsLinkingToPage(pageA.id, inclDeletedHidden = false) mustBe Set.empty
      tx.loadPageIdsLinkingToPage(pageB.id, inclDeletedHidden = false) mustBe Set.empty
      tx.loadPageIdsLinkingToPage(pageC.id, inclDeletedHidden = false) mustBe Set.empty
      tx.loadPageIdsLinkingToPage(pageD.id, inclDeletedHidden = false) mustBe Set.empty
      tx.loadPageIdsLinkingToPage(pageE.id, inclDeletedHidden = false) mustBe Set.empty
      tx.loadPageIdsLinkingToPage(pageZ.id, inclDeletedHidden = false) mustBe Set(
            pageA.id, pageB.id, pageC.id, pageD.id)
    }

    "Links from deleted *pages* are ignored  TyT7RD3LM5" - {
      "Delete page A".inWriteTx(daoSite1) { (tx, staleStuff) =>
        daoSite1.deletePagesImpl(Seq(pageA.id), SystemUserId, browserIdData,
              doingReviewTask = None)(tx, staleStuff)
      }

      "Now only pages B, C and D links to Z".inReadTx(daoSite1) { tx =>
        // This loads also links on deleted pages.
        tx.loadLinksToPage(pageZ.id) mustBe Seq(linkAToZ, linkBToZ, linkCToZ, linkDToZ)
        // This skips deleted pages and categories.
        tx.loadPageIdsLinkingToPage(pageZ.id, inclDeletedHidden = false) mustBe Set(
              pageB.id, pageC.id, pageD.id)
      }
    }

    "Links from deleted *categories* are ignored  TyT042RKD36" - {
      "Delete page C's category".inWriteTx(daoSite1) { (tx, staleStuff) =>
        pageC.anyCategoryId mustBe Some(defCatId) // page C will get deleted, implicitly, ttt
        pageB.anyCategoryId mustBe Some(category2.id) // page B not affected, ttt
        daoSite1.deleteUndelCategoryImpl(defCatId, delete = true,
              Who(SystemUserId, browserIdData))(tx)
      }

      "Now only page B and D links to Z".inReadTx(daoSite1) { tx =>
        // This loads also links from deleted pages.
        tx.loadLinksToPage(pageZ.id) mustBe Seq(linkAToZ, linkBToZ, linkCToZ, linkDToZ)
        // This skips links from deleted pages and categories.
        tx.loadPageIdsLinkingToPage(pageZ.id, inclDeletedHidden = false) mustBe Set(
              // Note: B didn't get accidentally deleted — it's in a category,
              // but not the now deleted category.
              pageB.id, pageD.id)
      }
    }

    "Undelete page A".inWriteTx(daoSite1) { (tx, staleStuff) =>
      daoSite1.deletePagesImpl(Seq(pageA.id), SystemUserId, browserIdData,
            doingReviewTask = None, undelete = true)(tx, staleStuff)
    }

    "Undelete category".inWriteTx(daoSite1) { (tx, staleStuff) =>
      daoSite1.deleteUndelCategoryImpl(defCatId, delete = false,
            Who(SystemUserId, browserIdData))(tx)
    }

    "Now page A and C link to Z again, and B and D link too".inReadTx(daoSite1) { tx =>
      // This loads also links on deleted pages.
      tx.loadLinksToPage(pageZ.id) mustBe Seq(linkAToZ, linkBToZ, linkCToZ, linkDToZ)

      // This skips deleted pages and categories.
      tx.loadPageIdsLinkingToPage(pageZ.id, inclDeletedHidden = false) mustBe Set(
            pageA.id, pageB.id, pageC.id, pageD.id)

      info("No other links")
      tx.loadLinksToPage(pageA.id) mustBe Nil
      tx.loadLinksToPage(pageB.id) mustBe Nil
      tx.loadLinksToPage(pageC.id) mustBe Nil
      tx.loadLinksToPage(pageD.id) mustBe Nil
      tx.loadLinksToPage(pageE.id) mustBe Nil
      tx.loadLinksToPage(pageF.id) mustBe Nil
      tx.loadLinksToPage(pageQ.id) mustBe Nil
      tx.loadPageIdsLinkingToPage(pageA.id, inclDeletedHidden = false) mustBe Set.empty
      tx.loadPageIdsLinkingToPage(pageB.id, inclDeletedHidden = false) mustBe Set.empty
      tx.loadPageIdsLinkingToPage(pageC.id, inclDeletedHidden = false) mustBe Set.empty
      tx.loadPageIdsLinkingToPage(pageD.id, inclDeletedHidden = false) mustBe Set.empty
      tx.loadPageIdsLinkingToPage(pageE.id, inclDeletedHidden = false) mustBe Set.empty
      tx.loadPageIdsLinkingToPage(pageF.id, inclDeletedHidden = false) mustBe Set.empty
      tx.loadPageIdsLinkingToPage(pageQ.id, inclDeletedHidden = false) mustBe Set.empty
    }

    "Delete page Z".inWriteTx(daoSite1) { (tx, staleStuff) =>
      daoSite1.deletePagesImpl(Seq(pageZ.id), SystemUserId, browserIdData,
            doingReviewTask = None, undelete = true)(tx, staleStuff)
    }

    "Can find links to deleted page Z".inReadTx(daoSite1) { tx =>
      tx.loadLinksToPage(pageZ.id) mustBe Seq(linkAToZ, linkBToZ, linkCToZ, linkDToZ)
      // This only excludes deleted pages that link *to* Z, doesn't matter
      // that Z itself is deleted:
      tx.loadPageIdsLinkingToPage(pageZ.id, inclDeletedHidden = false) mustBe Set(
            pageA.id, pageB.id, pageC.id, pageD.id)
    }



    "Replies, not just page bodies, can link to other pages" - {
      "Add replies" in {
        pageEReplyOne
        pageEReplyTwo
        pageFReplyToHide
      }

      "Link page E reply One to page Q".inWriteTx(daoSite1) { (tx, _) =>
        tx.upsertLink(linkEReOneToQ) mustBe true
      }

      "Now the reply links to Q".inReadTx(daoSite1) { tx =>
        tx.loadLinksToPage(pageQ.id) mustBe Seq(linkEReOneToQ)

        info("and thereby page E links to Q too")
        tx.loadPageIdsLinkedFromPage(pageE.id) mustBe Set(pageQ.id)
        tx.loadPageIdsLinkingToPage(pageQ.id, inclDeletedHidden = false) mustBe Set(pageE.id)
      }

      "Fake edit the reply: Delete the link".inWriteTx(daoSite1) { (tx, _) =>
        tx.deleteLinksFromPost(
              linkEReOneToQ.fromPostId, Set(linkEReOneToQ.linkUrl))
      }

      "Now E —> Q link gone".inReadTx(daoSite1) { tx =>
        info("No links at all to page Q")
        tx.loadLinksToPage(pageQ.id) mustBe Seq.empty

        info("Page E doesn't link to Q")
        tx.loadPageIdsLinkedFromPage(pageE.id) mustBe Set.empty
        tx.loadPageIdsLinkingToPage(pageQ.id, inclDeletedHidden = false) mustBe Set.empty
      }

      "Link both reply One and Two to Q".inWriteTx(daoSite1) { (tx, _) =>
        info("Add back reply One —> page Q link")
        tx.upsertLink(linkEReOneToQ) mustBe true
        info("Add new reply Two —> page Q link")
        tx.upsertLink(linkEReTwoToQ) mustBe true
      }

      "Now both replies {One,Two} —> page Q".inReadTx(daoSite1) { tx =>
        tx.loadLinksToPage(pageQ.id) mustBe Seq(linkEReOneToQ, linkEReTwoToQ)
        tx.loadLinksFromPost(pageEReplyOne.id) mustBe Seq(linkEReOneToQ)
        tx.loadLinksFromPost(pageEReplyTwo.id) mustBe Seq(linkEReTwoToQ)

        info("And page E —> page Q")
        tx.loadPageIdsLinkedFromPage(pageE.id) mustBe Set(pageQ.id)
        tx.loadPageIdsLinkingToPage(pageQ.id, inclDeletedHidden = false) mustBe Set(pageE.id)
      }
    }


    "Links from deleted posts are ignored  TyT602AMDUN" - {

      "Delete reply One".inWriteTx(daoSite1) { (tx, staleStuff) =>
        daoSite1.deletePostImpl(
              pageEReplyOne.pageId, pageEReplyOne.nr, deletedById = SystemUserId,
              doingReviewTask = None, browserIdData, tx, staleStuff)
      }

      "Reply Two links to Q, and Re One too although post deleted".inReadTx(daoSite1) { tx =>
        tx.loadLinksToPage(pageQ.id) mustBe Seq(linkEReOneToQ, linkEReTwoToQ)

        info("page E still —> Q, because reply Two not deleted (only re One deleted)")
        tx.loadPageIdsLinkingToPage(pageQ.id, inclDeletedHidden = false) mustBe Set(pageE.id)
      }

      "Delete reply Two too".inWriteTx(daoSite1) { (tx, staleStuff) =>
        daoSite1.deletePostImpl(
              pageEReplyTwo.pageId, pageEReplyTwo.nr, deletedById = SystemUserId,
              doingReviewTask = None, browserIdData, tx, staleStuff)
      }

      "Now the posts still link to Q".inReadTx(daoSite1) { tx =>
        tx.loadLinksToPage(pageQ.id) mustBe Seq(linkEReOneToQ, linkEReTwoToQ)

        info("but page E doesn't, when deleted replies One and Two skipped")
        tx.loadPageIdsLinkingToPage(pageQ.id, inclDeletedHidden = false) mustBe Set.empty

        info("however it does, if deleted replies One and Two *are* considered")
        tx.loadPageIdsLinkedFromPage(pageE.id) mustBe Set(pageQ.id)
      }

      "Delete the links".inWriteTx(daoSite1) { (tx, staleStuff) =>
        tx.deleteLinksFromPost(pageEReplyOne.id, Set(linkEReOneToQ.linkUrl))
        tx.deleteLinksFromPost(pageEReplyTwo.id, Set(linkEReTwoToQ.linkUrl))
      }

      "Now the deleted replies very much don't link to Q".inReadTx(daoSite1) { tx =>
        tx.loadLinksToPage(pageQ.id) mustBe Nil
        tx.loadPageIdsLinkingToPage(pageQ.id, inclDeletedHidden = false) mustBe Set.empty
        tx.loadPageIdsLinkedFromPage(pageE.id) mustBe Set.empty
        tx.loadPageIdsLinkedFromPosts(Set(
              linkEReOneToQ.fromPostId,
              linkEReTwoToQ.fromPostId)) mustBe Set.empty
      }
    }


    "Links from hidden posts are ignored  TyT5KD20G7" - {

      "add a reply to Hide on page F linking to Q".inWriteTx(daoSite1) { (tx, _) =>
        tx.upsertLink(linkFReToQ) mustBe true
      }

      "Now F —> Q".inReadTx(daoSite1) { tx =>
        info("exact links")
        tx.loadLinksToPage(pageQ.id) mustBe Seq(linkFReToQ)
        tx.loadLinksFromPost(linkFReToQ.fromPostId) mustBe Seq(linkFReToQ)

        info("page ids")
        tx.loadPageIdsLinkingToPage(pageQ.id, inclDeletedHidden = false) mustBe Set(pageF.id)
        tx.loadPageIdsLinkedFromPosts(Set(linkFReToQ.fromPostId)) mustBe Set(pageQ.id)
        tx.loadPageIdsLinkedFromPage(pageF.id) mustBe Set(pageQ.id)
      }

      "Hide page F's reply that links to Q".inWriteTx(daoSite1) { (tx, staleStuff) =>
        daoSite1.hidePostsOnPage(Seq(pageFReplyToHide), pageId = pageF.id,
              reason = "Test test")(tx, staleStuff)
      }

      "The link is still there".inReadTx(daoSite1) { tx =>
        tx.loadLinksToPage(pageQ.id) mustBe Seq(linkFReToQ)
        tx.loadLinksFromPost(pageFReplyToHide.id) mustBe Seq(linkFReToQ)

        info("but page F doesn't —> Q, when hidden posts skipped")
        tx.loadPageIdsLinkingToPage(pageQ.id, inclDeletedHidden = false) mustBe Set.empty

        info("F does —> Q though, when hidden posts included")
        tx.loadPageIdsLinkedFromPage(pageF.id) mustBe Set(pageQ.id)
      }
    }

  }

}

