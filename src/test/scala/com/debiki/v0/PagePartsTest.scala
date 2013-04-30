/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package com.debiki.v0

import org.specs2.mutable._
import Prelude._
import java.{util => ju}
import PostActionDto.{copyCreatePost, copyReviewPost}
import com.debiki.v0.{PostActionPayload => PAP}


/**
 * Constructs a page, with a body text (id = Page.BodyId),
 * and an Edit of that text,
 * and an EditApp of that Edit,
 * and a Delete of that Edit, or the EditApp,
 * or a ReviewPostAction & approval of the EditApp,
 * or a ReviewPostAction & rejection of the EditApp.
 */
trait PageTestValues {

  val datiBeforeFirstAction = new ju.Date(0)

  val textInitially = "initial-body-text"
  val textAfterFirstEdit = "body-text-after-first-edit"

  val bodySkeleton =
    PostActionDto(id = PageParts.BodyId, postId = PageParts.BodyId,
      creationDati = new ju.Date(1000),
      loginId = "101", userId = "?", newIp = None,
      payload = PostActionPayload.CreatePost(
        parentPostId = PageParts.BodyId,
        text = textInitially,
        markup = "",
        approval = None))

  val bodySkeletonAutoApproved =
    copyCreatePost(bodySkeleton, approval = Some(Approval.WellBehavedUser))

  val bodySkeletonPrelApproved =
    copyCreatePost(bodySkeleton, approval = Some(Approval.Preliminary))

  val bodyApprovalSkeleton = PostActionDto.toReviewPost(
    "11", postId = bodySkeleton.id, loginId = "111", userId = "?", newIp = None,
        ctime = new ju.Date(11000), approval = Some(Approval.Manual))

  val bodyRejectionSkeleton = copyReviewPost(bodyApprovalSkeleton, approval = None)

  val editSkeleton =
    PostActionDto.toEditPost(
        id = "12", postId = bodySkeleton.id, ctime = new ju.Date(12000),
        loginId = "112", userId = "?", newIp = None,
        text = makePatch(from = textInitially, to = textAfterFirstEdit),
        newMarkup = None, approval = None, autoApplied = false)

  def deletionOfEdit =
    PostActionDto(id = "13", postId = editSkeleton.postId,
      loginId = "113", userId = "?", newIp = None, creationDati = new ju.Date(13000),
      payload = PAP.Delete(editSkeleton.id))

  val editAppSkeleton =
    EditApp(id = "14", editId = editSkeleton.id, postId = editSkeleton.postId,
      loginId = "114", userId = "?", newIp = None, ctime = new ju.Date(14000),
      approval = None, result = "ignored")

  val deletionOfEditApp =
    PostActionDto(id = "15", postId = editAppSkeleton.postId,
        loginId = "115", userId = "?", newIp = None, creationDati = new ju.Date(15000),
        payload = PAP.Delete(editSkeleton.id))

  val approvalOfEditApp = PostActionDto.toReviewPost(id = "16", postId = editAppSkeleton.id,
        loginId = "116", userId = "?", newIp = None, ctime = new ju.Date(16000),
        approval = Some(Approval.Manual))

  val rejectionOfEditApp = copyReviewPost(approvalOfEditApp, approval = None)

  val ratingOfBody = Rating("17", postId = bodySkeleton.id, loginId = "117", userId = "?",
    newIp = None, ctime = new ju.Date(17000), tags = Nil)

  val flagOfBody = Flag("18", postId = bodySkeleton.id, loginId = "118", userId = "?",
    newIp = None, ctime = new ju.Date(18000), reason = FlagReason.Spam,
    details = "")


  case class PageWithEditApplied(
    page: PageParts, edit: PostActionDto[PAP.EditPost], applDate: ju.Date)

  val EmptyPage = PageParts("a")

  def makePageWithEditApplied(autoApplied: Boolean): PageWithEditApplied = {
    val (edit, editApplDati) =
      if (autoApplied)
        (PostActionDto.copyEditPost(editSkeleton, autoApplied = Some(true)), editSkeleton.ctime)
      else
        (editSkeleton, editAppSkeleton.ctime)
    var page = EmptyPage + bodySkeletonAutoApproved + edit
    if (!autoApplied) page = page + editAppSkeleton
    PageWithEditApplied(page, edit, editApplDati)
  }

  lazy val PageWithEditManuallyAppliedNotApproved =
    EmptyPage + bodySkeletonAutoApproved + editSkeleton + editAppSkeleton

  lazy val PageWithEditManuallyAppliedAndExplApproved =
    EmptyPage + bodySkeletonAutoApproved + editSkeleton +
       editAppSkeleton + approvalOfEditApp

  lazy val PageWithEditManuallyAppliedAndAutoApproved =
    EmptyPage + bodySkeletonAutoApproved + editSkeleton +
       editAppSkeleton.copy(approval = Some(Approval.WellBehavedUser))

  lazy val PageWithEditManuallyAppliedAndPrelApproved =
    EmptyPage + bodySkeletonAutoApproved + editSkeleton +
       editAppSkeleton.copy(approval = Some(Approval.Preliminary))

  lazy val PageWithEditManuallyAppliedAndPrelApprovedThenRejected =
    PageWithEditManuallyAppliedAndPrelApproved + rejectionOfEditApp

  lazy val PageWithEditManuallyAppliedAndRejected =
    EmptyPage + bodySkeletonAutoApproved + editSkeleton +
     editAppSkeleton + rejectionOfEditApp

  lazy val PageWithEditManuallyAppliedNothingApproved =
    EmptyPage + bodySkeleton + editSkeleton + editAppSkeleton

  val datiAfterLastAction = new ju.Date(20000)
}



class PagePartsTest extends Specification with PageTestValues {

  "A page" can {

    "convert reply ids to and from integers" in {
      PageParts.intToReplyId(0) must_== "" // 0 is not used anyway (it's reserved)
      PageParts.intToReplyId(1) must_== "1"
      PageParts.intToReplyId(9) must_== "9"
      PageParts.intToReplyId(10) must_== "A"
      PageParts.intToReplyId(35) must_== "Z"
      PageParts.intToReplyId(36) must_== "a"
      PageParts.intToReplyId(61) must_== "z"
      PageParts.intToReplyId(62) must_== "10"
      PageParts.intToReplyId(63) must_== "11"
      PageParts.intToReplyId(64) must_== "12"
      PageParts.intToReplyId(72) must_== "1A"
      PageParts.intToReplyId(98) must_== "1a"
      PageParts.intToReplyId(123) must_== "1z"
      PageParts.intToReplyId(124) must_== "20"
      PageParts.intToReplyId(134) must_== "2A"
      PageParts.intToReplyId(185) must_== "2z"
      PageParts.intToReplyId(187) must_== "31"
      PageParts.intToReplyId(197) must_== "3B"
      PageParts.intToReplyId(4475) must_== "1AB" // 1 * 62 ** 2 + 10 * 62 + 11 = 4475
      PageParts.intToReplyId(89925) must_== "NOP" // 23 * (62 ** 2) + 24 * 62 + 25 = 89925
      PageParts.intToReplyId(230577) must_== "xyz" // 59 * (62 ** 2) + 60 * 62 + 61 = 230577

      // ... And convert back again:
      PageParts.replyIdToInt("") must_== 0
      PageParts.replyIdToInt("0") must_== 0
      PageParts.replyIdToInt("1") must_== 1
      PageParts.replyIdToInt("9") must_== 9
      PageParts.replyIdToInt("A") must_== 10
      PageParts.replyIdToInt("Z") must_== 35
      PageParts.replyIdToInt("a") must_== 36
      PageParts.replyIdToInt("z") must_== 61
      PageParts.replyIdToInt("10") must_== 62
      PageParts.replyIdToInt("11") must_== 63
      PageParts.replyIdToInt("12") must_== 64
      PageParts.replyIdToInt("1A") must_== 72
      PageParts.replyIdToInt("1a") must_== 98
      PageParts.replyIdToInt("1z") must_== 123
      PageParts.replyIdToInt("20") must_== 124
      PageParts.replyIdToInt("2A") must_== 134
      PageParts.replyIdToInt("2z") must_== 185
      PageParts.replyIdToInt("31") must_== 187
      PageParts.replyIdToInt("3B") must_== 197
      PageParts.replyIdToInt("1AB") must_== 4475 // 1 * 62 ** 2 + 10 * 62 + 11 = 4475
      PageParts.replyIdToInt("NOP") must_== 89925 // 23 * (62 ** 2) + 24 * 62 + 25 = 89925
      PageParts.replyIdToInt("xyz") must_== 230577 // 59 * (62 ** 2) + 60 * 62 + 61 = 230577
    }

    "have a body" >> {
      "unapproved" in {
        val page = EmptyPage + bodySkeleton
        page.body_!.currentVersionReviewed must_== false
        page.body_!.currentVersionRejected must_== false
        page.body_!.currentVersionApproved must_== false
        page.body_!.initiallyApproved must_== false
        page.body_!.lastApprovalDati must_== None
        page.body_!.lastManualApprovalDati must_== None
        page.body_!.currentText must_== textInitially
      }

      "approved, automatically, permanently" in {
        val page = EmptyPage + bodySkeletonAutoApproved
        page.body_!.currentVersionReviewed must_== true
        page.body_!.currentVersionRejected must_== false
        page.body_!.currentVersionApproved must_== true
        page.body_!.currentVersionPrelApproved must_== false
        page.body_!.someVersionPermanentlyApproved must_== true
        page.body_!.initiallyApproved must_== true
        page.body_!.lastApprovalDati must_== Some(bodySkeleton.ctime)
        page.body_!.lastManualApprovalDati must_== None
        page.body_!.currentText must_== textInitially
      }

      "approved, automatically, preliminarily" in {
        val page = EmptyPage + bodySkeletonPrelApproved
        page.body_!.currentVersionReviewed must_== true // by the computer
        page.body_!.currentVersionRejected must_== false
        page.body_!.currentVersionApproved must_== true
        page.body_!.currentVersionPrelApproved must_== true
        page.body_!.someVersionPermanentlyApproved must_== false
        page.body_!.initiallyApproved must_== true
        page.body_!.lastPermanentApprovalDati must_== None
        page.body_!.lastApproval must_== Some(page.body_!)
        page.body_!.lastApprovalDati must_== Some(bodySkeleton.ctime)
        page.body_!.lastManualApprovalDati must_== None
        page.body_!.currentText must_== textInitially
      }

      "approved, automatically, permanently, then rejected" in {
        // This shouldn't happen — the computer shouldn't allow
        // you to reject a permanently approved comment.
        // Instead, first you'd need to delete the approval.
        // Anyway, if this *does* happen (perhaps two people approve
        // and reject a comment at the very same time), then this rejection
        // doesn't cancel the approval, since it's a permanent approval
        // and happened before the rejection. (But had the approval been
        // preliminary, it'd been cancelled). What this rejection does,
        // is it cancels all edits that happened after the permanent approval.
        // But there are no such edits, so the rejection has no effect.
      }

      "approved, automatically, preliminarily, then rejected" in {
        // The rejection cancels all effects of the preliminary approval.
        val page = EmptyPage + bodySkeletonPrelApproved + bodyRejectionSkeleton
        _verifyBodyCorrectlyRejected(page)
      }

      "approved, manually" in {
        val page = EmptyPage + bodySkeleton +
           bodyApprovalSkeleton
        page.body_!.currentVersionReviewed must_== true
        page.body_!.currentVersionRejected must_== false
        page.body_!.currentVersionApproved must_== true
        page.body_!.currentVersionPrelApproved must_== false
        page.body_!.someVersionPermanentlyApproved must_== true
        page.body_!.initiallyApproved must_== false
        page.body_!.lastApprovalDati must_== Some(bodyApprovalSkeleton.ctime)
        page.body_!.lastManualApprovalDati must_==
           Some(bodyApprovalSkeleton.ctime)
        page.body_!.currentText must_== textInitially
      }

      "rejected" in {
        val page = EmptyPage + bodySkeleton + bodyRejectionSkeleton
        _verifyBodyCorrectlyRejected(page)
      }

      def _verifyBodyCorrectlyRejected(page: PageParts) {
        val body = page.body_!
        body.currentVersionReviewed must_== true
        body.currentVersionRejected must_== true
        body.currentVersionApproved must_== false
        body.currentVersionPrelApproved must_== false
        body.someVersionPermanentlyApproved must_== false
        body.initiallyApproved must_== false
        body.lastPermanentApprovalDati must_== None
        body.lastApprovalType must_== None
        body.lastApprovalDati must_== None
        body.lastManualApprovalDati must_== None
        body.currentText must_== textInitially
      }
    }


    "have a body, with an edit, pending" in {
      val body =
        bodySkeleton.copy(payload = bodySkeleton.payload.copy(
          approval = Some(Approval.WellBehavedUser)))
      val page = EmptyPage + body + editSkeleton
      page.body_!.currentText must_== textInitially
      page.body_!.textLastEditedAt must_== page.body_!.creationDati

      page.body_!.editsDeletedDescTime must beEmpty
      page.body_!.editsAppliedDescTime must beEmpty
      page.body_!.editsRevertedDescTime must beEmpty
      page.body_!.editsPendingDescTime must beLike {
        case List(edit) =>
          edit.id must_== editSkeleton.id
          edit.creationDati must_== editSkeleton.ctime
          edit.applicationDati must_== None
          edit.revertionDati must_== None
          edit.deletedAt must_== None
          edit.isPending must_== true
          edit.isApplied must_== false
          edit.isReverted must_== false
          edit.isDeleted must_== false
      }
    }


    "have a body, with an edit, deleted" in {
      val page = EmptyPage + bodySkeletonAutoApproved +
         editSkeleton + deletionOfEdit
      page.body_!.currentText must_== textInitially
      page.body_!.textLastEditedAt must_== page.body_!.creationDati

      page.body_!.editsPendingDescTime must beEmpty
      page.body_!.editsAppliedDescTime must beEmpty
      page.body_!.editsRevertedDescTime must beEmpty
      page.body_!.editsDeletedDescTime must beLike {
        case List(edit) =>
          edit.id must_== editSkeleton.id
          edit.applicationDati must_== None
          edit.revertionDati must_== None
          edit.deletedAt must_== Some(deletionOfEdit.ctime)
          edit.isPending must_== false
          edit.isApplied must_== false
          edit.isReverted must_== false
          edit.isDeleted must_== true
      }
    }


    "have a body, with an edit, applied" >> {

      "automatically" in {
        _testImpl(autoApplied = true)
      }

      "manually" in {
        _testImpl(autoApplied = false)
      }

      def _testImpl(autoApplied: Boolean) {
        val PageWithEditApplied(page, edit, editApplDati) =
           makePageWithEditApplied(autoApplied)

        page.body_!.currentText must_== textAfterFirstEdit
        page.body_!.textLastEditedAt must_== editApplDati

        page.body_!.editsPendingDescTime must beEmpty
        page.body_!.editsDeletedDescTime must beEmpty
        page.body_!.editsRevertedDescTime must beEmpty
        page.body_!.editsAppliedDescTime must beLike {
          case List(edit) =>
            edit.id must_== editSkeleton.id
            edit.applicationDati must_== Some(editApplDati)
            edit.revertionDati must_== None
            edit.deletedAt must_== None
            edit.isPending must_== false
            edit.isApplied must_== true
            edit.isReverted must_== false
            edit.isDeleted must_== false
        }
      }
    }

    "have a body, with an edit, applied" >> {

      "automatically, then reverted & deleted (cannot revert only)" in {
        _testImpl(autoApplied = true)
      }

      "manually, then reverted" in {
        _testImpl(autoApplied = false)
      }

      def _testImpl(autoApplied: Boolean) {
        val PageWithEditApplied(pageNotReverted, edit, editApplDati) =
          makePageWithEditApplied(autoApplied)

        // To revert an auto applied Edit, we have to delete the Edit itself.
        // To revert a manually applied Edit, we instead delete the EditApp.
        val (page, revertionDati) =
           if (autoApplied)
             (pageNotReverted + deletionOfEdit, deletionOfEdit.ctime)
           else
             (pageNotReverted + deletionOfEditApp, deletionOfEditApp.ctime)

        val body = page.body_!
        body.currentText must_== textInitially
        body.textLastEditedOrRevertedAt must_== revertionDati

        // If `autoApplied` the Edit is deleted, otherwise it's pending again.
        if (autoApplied) body.editsPendingDescTime must beEmpty
        else findEditInList(body.editsPendingDescTime)

        if (autoApplied) findEditInList(body.editsDeletedDescTime)
        else body.editsDeletedDescTime must beEmpty

        body.editsAppliedDescTime must beEmpty
        findEditInList(body.editsRevertedDescTime)

        def findEditInList(list: List[Patch]) = list must beLike {
          case List(edit) =>
            edit.id must_== editSkeleton.id
            edit.applicationDati must_== None
            edit.revertionDati must_== Some(revertionDati)
            edit.deletedAt must_==
               (if (autoApplied) Some(revertionDati) else None)
            edit.isPending must_== !autoApplied
            edit.isApplied must_== false
            edit.isReverted must_== true
            edit.isDeleted must_== autoApplied
        }
      }

      "manually, then reverted and then deleted" in {
        val PageWithEditApplied(pageNotReverted, _, _) =
              makePageWithEditApplied(autoApplied = false)
        val deletionAfterRevertion = deletionOfEdit.copy(
          creationDati = new ju.Date(deletionOfEditApp.ctime.getTime + 1))
        val page = pageNotReverted + deletionOfEditApp + deletionAfterRevertion

        val body = page.body_!
        body.currentText must_== textInitially
        // When the edit itself was deleted doesn't matter, only when it
        // was reverted.
        body.textLastEditedOrRevertedAt must_== deletionOfEditApp.ctime

        body.editsPendingDescTime must beEmpty
        body.editsAppliedDescTime must beEmpty
        findEditIn(body.editsRevertedDescTime)
        findEditIn(body.editsDeletedDescTime)

        def findEditIn(list: List[Patch]) = list must beLike {
          case List(edit) =>
            edit.id must_== editSkeleton.id
            edit.applicationDati must_== None
            edit.revertionDati must_== Some(deletionOfEditApp.ctime)
            edit.deletedAt must_== Some(deletionAfterRevertion.ctime)
            edit.isPending must_== false
            edit.isApplied must_== false
            edit.isReverted must_== true
            edit.isDeleted must_== true
        }
      }
    }



    "have a body, with an edit, applied, and" >> {

      "unapproved" in {
        val page = EmptyPage + bodySkeletonAutoApproved +
           editSkeleton + editAppSkeleton // not approved

        page.body_!.currentVersionReviewed must_== false
        page.body_!.currentVersionRejected must_== false
        page.body_!.currentVersionApproved must_== false
        page.body_!.someVersionApproved must_== true
        page.body_!.initiallyApproved must_== true
        page.body_!.lastReviewDati must_== Some(page.body_!.creationDati)
        page.body_!.lastApprovalDati must_== Some(page.body_!.creationDati)
        page.body_!.lastManualApprovalDati must_== None
        page.body_!.currentText must_== textAfterFirstEdit
        testEditLists(page.body_!)
      }

      "approved, automatically, permanently" in {
        val page = PageWithEditManuallyAppliedAndAutoApproved
        //val page = EmptyPage + bodySkeletonAutoApproved +
        //   editSkeleton + editAppSkeleton.copy(
        //      approval = Some(Approval.WellBehavedUser))
        _testApprovedEdit(page.body_!, editAppSkeleton.ctime,
            manualApprovalDati = None, preliminarily = false)
      }

      "approved, automatically, preliminarily" in {
        val page = PageWithEditManuallyAppliedAndPrelApproved
        _testApprovedEdit(page.body_!, editAppSkeleton.ctime,
          manualApprovalDati = None, preliminarily = true)
      }

      "approved, automatically, permanently, then rejected" in {
        // The rejection should have no effect. See the comment in
        // another "permanently, then rejected" test, somewhere above.
      }

      "approved, automatically, preliminarily, then rejected" in {
        // The rejection cancels the auto prel approval.
        val page = PageWithEditManuallyAppliedAndPrelApprovedThenRejected
        _testRejectedEdit(page)
      }

      "approved, manually" in {
        val page = PageWithEditManuallyAppliedAndExplApproved
        //val page = EmptyPage + bodySkeletonAutoApproved +
        ///   editSkeleton + editAppSkeleton + approvalOfEditApp
        _testApprovedEdit(page.body_!, approvalOfEditApp.ctime,
            manualApprovalDati = Some(approvalOfEditApp.ctime),
            preliminarily = false)
      }

      "approved, and then reverted, but the revertion is not yet approved" in {
        // Cannot implement right now: not possible to approve / not-approve
        // deletions of EditApp:s.
      }

      "rejected" in {
        val page = PageWithEditManuallyAppliedAndRejected
        //val page = EmptyPage + bodySkeletonAutoApproved +
        //   editSkeleton + editAppSkeleton + rejectionOfEditApp
        _testRejectedEdit(page)
      }

      def _testRejectedEdit(page: PageParts) {
        val body = page.body_!
        body.currentVersionReviewed must_== true
        body.currentVersionRejected must_== true
        body.currentVersionApproved must_== false
        body.currentVersionPrelApproved must_== false
        body.someVersionPermanentlyApproved must_== true
        body.someVersionApproved must_== true
        body.initiallyApproved must_== true
        body.lastReviewDati must_== Some(rejectionOfEditApp.ctime)
        body.lastApprovalDati must_== Some(page.body_!.creationDati)
        body.lastManualApprovalDati must_== None
        body.currentText must_== textAfterFirstEdit
        testEditLists(body)
      }

      def testEditLists(post: Post) {
        post.editsPendingDescTime must beEmpty
        post.editsDeletedDescTime must beEmpty
        post.editsRevertedDescTime must beEmpty
        post.editsAppliedDescTime must beLike {
          case List(edit) =>
            edit.id must_== editSkeleton.id
            edit.applicationDati must_== Some(editAppSkeleton.ctime)
            edit.isPending must_== false
            edit.isApplied must_== true
            edit.isReverted must_== false
            edit.isDeleted must_== false
        }
      }

      def _testApprovedEdit(post: Post, approvalDati: ju.Date,
            manualApprovalDati: Option[ju.Date], preliminarily: Boolean) {
        post.currentVersionReviewed must_== true //
        post.currentVersionRejected must_== false
        post.currentVersionApproved must_== true
        post.currentVersionPrelApproved must_== preliminarily
        post.someVersionPermanentlyApproved must_== true // orig version aprvd
        post.someVersionApproved must_== true

        if (preliminarily)
          post.lastPermanentApprovalDati must_== Some(post.creationDati)
        // Could test other cases:
        // post.lastPermanentApproval must_== (
        //  if (preliminarily) post.action
        //  else if (manualApproval) manualApproval // missing
        //  else the-edit)
        // post.lastApproval must_== ....)

        post.initiallyApproved must_== true
        post.lastReviewDati must_== Some(approvalDati)
        post.lastApprovalDati must_== Some(approvalDati)
        post.lastManualApprovalDati must_== manualApprovalDati
        post.currentText must_== textAfterFirstEdit
        testEditLists(post)
      }
    }


    "have a body, with one edit, pending, and a more recent edit that is" >> {
      "pending" in {
        // text = textApproved = textInitially
      }

      "applied, not approved" in {
        // text = textAfterSecondEditSkipFirst
        // textApproved = textInitially
      }

      "applied, and approved" in {
        // Do this 2 times:
        // for the second edit being 1) manually and 2) auto approved.

        // text = textApproved = textAfterSecondEditSkipFirst
      }

      "applied and rejected" in {
        // text = textAfterSecondEditSkipFirst
        // textApproved = textInitially
      }
    }


    "have a body, with one approved edit, and another that is" >> {

      "pending" in {
        // text = textApproved = textAfterFirstEdit
      }

      // Do this 2 times:
      // for the first edit being 1) manually and 2) auto approved.

      "unapproved" in {
        // text = textAfterSecondEdit
        // textApproved = textAfterFirstEdit
      }

      "approved" in {
        // Do this 2 times:
        // for the second edit being 1) manually and 2) auto approved.

        // text = textApproved = textAfterSecondEdit
      }

      "approved, manually" in {
        // text = textApproved = textAfterSecondEdit
      }

      "rejected" in {
        // text = textAfterFirstEdit
        // textApproved = textAfterFirstEdit
      }
    }

  }

}


// vim: fdm=marker et ts=2 sw=2 fo=tcqwn list
