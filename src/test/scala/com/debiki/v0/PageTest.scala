// vim: ts=2 sw=2 et
/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */

package com.debiki.v0

import org.specs2.mutable._
import Prelude._
import java.{util => ju}


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
    CreatePostAction(id = Page.BodyId, parent = Page.BodyId, ctime = new ju.Date(1000),
        loginId = "101", newIp = None, text = textInitially,
        markup = "", approval = None, tyype = PostType.Text,
        where = None)

  val bodySkeletonAutoApproved = bodySkeleton.copy(
        approval = Some(Approval.WellBehavedUser))

  val bodySkeletonPrelApproved = bodySkeleton.copy(
    approval = Some(Approval.Preliminary))

  val bodyApprovalSkeleton =
    ReviewPostAction("11", targetId = bodySkeleton.id, loginId = "111", newIp = None,
        ctime = new ju.Date(11000), approval = Some(Approval.Manual))

  val bodyRejectionSkeleton = bodyApprovalSkeleton.copy(approval = None)

  val editSkeleton =
    Edit(id = "12", postId = bodySkeleton.id, ctime = new ju.Date(12000),
        loginId = "112", newIp = None,
        text = makePatch(from = textInitially, to = textAfterFirstEdit),
        newMarkup = None, approval = None, autoApplied = false)

  def deletionOfEdit =
    Delete(id = "13", postId = editSkeleton.id,
      loginId = "113", newIp = None, ctime = new ju.Date(13000),
      wholeTree = false, reason = "")

  val editAppSkeleton =
    EditApp(id = "14", editId = editSkeleton.id, loginId = "114",
        newIp = None, ctime = new ju.Date(14000),
        approval = None, result = "ignored")

  val deletionOfEditApp =
    Delete(id = "15", postId = editAppSkeleton.id,
        loginId = "115", newIp = None, ctime = new ju.Date(15000),
        wholeTree = false, reason = "")

  val approvalOfEditApp = ReviewPostAction(id = "16", targetId = editAppSkeleton.id,
        loginId = "116", newIp = None, ctime = new ju.Date(16000),
        approval = Some(Approval.Manual))

  val rejectionOfEditApp = approvalOfEditApp.copy(approval = None)

  val ratingOfBody = Rating("17", postId = bodySkeleton.id, loginId = "117",
    newIp = None, ctime = new ju.Date(17000), tags = Nil)

  val flagOfBody = Flag("18", postId = bodySkeleton.id, loginId = "118",
    newIp = None, ctime = new ju.Date(18000), reason = FlagReason.Spam,
    details = "")


  case class PageWithEditApplied(page: Debate, edit: Edit, applDate: ju.Date)

  val EmptyPage = Debate("a")

  def makePageWithEditApplied(autoApplied: Boolean): PageWithEditApplied = {
    val (edit, editApplDati) =
      if (autoApplied)
        (editSkeleton.copy(autoApplied = true), editSkeleton.ctime)
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



class PageTest extends Specification with PageTestValues {

  "A page" can {

    "convert reply ids to and from integers" in {
      Page.intToReplyId(0) must_== "" // 0 is not used anyway (it's reserved)
      Page.intToReplyId(1) must_== "1"
      Page.intToReplyId(9) must_== "9"
      Page.intToReplyId(10) must_== "A"
      Page.intToReplyId(35) must_== "Z"
      Page.intToReplyId(36) must_== "a"
      Page.intToReplyId(61) must_== "z"
      Page.intToReplyId(62) must_== "10"
      Page.intToReplyId(63) must_== "11"
      Page.intToReplyId(64) must_== "12"
      Page.intToReplyId(72) must_== "1A"
      Page.intToReplyId(98) must_== "1a"
      Page.intToReplyId(123) must_== "1z"
      Page.intToReplyId(124) must_== "20"
      Page.intToReplyId(134) must_== "2A"
      Page.intToReplyId(185) must_== "2z"
      Page.intToReplyId(187) must_== "31"
      Page.intToReplyId(197) must_== "3B"
      Page.intToReplyId(4475) must_== "1AB" // 1 * 62 ** 2 + 10 * 62 + 11 = 4475
      Page.intToReplyId(89925) must_== "NOP" // 23 * (62 ** 2) + 24 * 62 + 25 = 89925
      Page.intToReplyId(246205) must_== "xyz" // 63 * (62 ** 2) + 64 * 62 + 65 = 246205

      // ... And convert back again:
      Page.replyIdToInt("") must_== 0
      Page.replyIdToInt("0") must_== 0
      Page.replyIdToInt("1") must_== 1
      Page.replyIdToInt("9") must_== 9
      Page.replyIdToInt("A") must_== 10
      Page.replyIdToInt("Z") must_== 35
      Page.replyIdToInt("a") must_== 36
      Page.replyIdToInt("z") must_== 61
      Page.replyIdToInt("10") must_== 62
      Page.replyIdToInt("11") must_== 63
      Page.replyIdToInt("12") must_== 64
      Page.replyIdToInt("1A") must_== 72
      Page.replyIdToInt("1a") must_== 98
      Page.replyIdToInt("1z") must_== 123
      Page.replyIdToInt("20") must_== 124
      Page.replyIdToInt("2A") must_== 134
      Page.replyIdToInt("2z") must_== 185
      Page.replyIdToInt("31") must_== 187
      Page.replyIdToInt("3B") must_== 197
      Page.replyIdToInt("1AB") must_== 4475 // 1 * 62 ** 2 + 10 * 62 + 11 = 4475
      Page.replyIdToInt("NOP") must_== 89925 // 23 * (62 ** 2) + 24 * 62 + 25 = 89925
      Page.replyIdToInt("xyz") must_== 246205 // 63 * (62 ** 2) + 64 * 62 + 65 = 246205
    }

    "have a body" >> {
      "unapproved" >> {
        val page = EmptyPage + bodySkeleton
        page.body_!.currentVersionReviewed must_== false
        page.body_!.currentVersionRejected must_== false
        page.body_!.currentVersionApproved must_== false
        page.body_!.initiallyApproved must_== false
        page.body_!.lastApprovalDati must_== None
        page.body_!.lastManualApprovalDati must_== None
        page.body_!.text must_== textInitially
      }

      "approved, automatically, permanently" >> {
        val page = EmptyPage + bodySkeletonAutoApproved
        page.body_!.currentVersionReviewed must_== true
        page.body_!.currentVersionRejected must_== false
        page.body_!.currentVersionApproved must_== true
        page.body_!.currentVersionPrelApproved must_== false
        page.body_!.someVersionPermanentlyApproved must_== true
        page.body_!.initiallyApproved must_== true
        page.body_!.lastApprovalDati must_== Some(bodySkeleton.ctime)
        page.body_!.lastManualApprovalDati must_== None
        page.body_!.text must_== textInitially
      }

      "approved, automatically, preliminarily" >> {
        val page = EmptyPage + bodySkeletonPrelApproved
        page.body_!.currentVersionReviewed must_== true // by the computer
        page.body_!.currentVersionRejected must_== false
        page.body_!.currentVersionApproved must_== true
        page.body_!.currentVersionPrelApproved must_== true
        page.body_!.someVersionPermanentlyApproved must_== false
        page.body_!.initiallyApproved must_== true
        page.body_!.lastPermanentApproval must_== None
        page.body_!.lastApproval must_== Some(bodySkeletonPrelApproved)
        page.body_!.lastApprovalDati must_== Some(bodySkeleton.ctime)
        page.body_!.lastManualApprovalDati must_== None
        page.body_!.text must_== textInitially
      }

      "approved, automatically, permanently, then rejected" >> {
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

      "approved, automatically, preliminarily, then rejected" >> {
        // The rejection cancels all effects of the preliminary approval.
        val page = EmptyPage + bodySkeletonPrelApproved + bodyRejectionSkeleton
        _verifyBodyCorrectlyRejected(page)
      }

      "approved, manually" >> {
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
        page.body_!.text must_== textInitially
      }

      "rejected" >> {
        val page = EmptyPage + bodySkeleton + bodyRejectionSkeleton
        _verifyBodyCorrectlyRejected(page)
      }

      def _verifyBodyCorrectlyRejected(page: Debate) {
        val body = page.body_!
        body.currentVersionReviewed must_== true
        body.currentVersionRejected must_== true
        body.currentVersionApproved must_== false
        body.currentVersionPrelApproved must_== false
        body.someVersionPermanentlyApproved must_== false
        body.initiallyApproved must_== false
        body.lastPermanentApproval must_== None
        body.lastApproval must_== None
        body.lastApprovalDati must_== None
        body.lastManualApprovalDati must_== None
        body.text must_== textInitially
      }
    }


    "have a body, with an edit, pending" >> {
      val body =
        bodySkeleton.copy(approval = Some(Approval.WellBehavedUser))
      val page = EmptyPage + body + editSkeleton
      page.body_!.text must_== textInitially
      page.body_!.modificationDati must_== page.body_!.creationDati

      page.body_!.editsDeletedDescTime must beEmpty
      page.body_!.editsAppliedDescTime must beEmpty
      page.body_!.editsRevertedDescTime must beEmpty
      page.body_!.editsPendingDescTime must beLike {
        case List(edit) =>
          edit.id must_== editSkeleton.id
          edit.creationDati must_== editSkeleton.ctime
          edit.applicationDati must_== None
          edit.revertionDati must_== None
          edit.deletionDati must_== None
          edit.isPending must_== true
          edit.isApplied must_== false
          edit.isReverted must_== false
          edit.isDeleted must_== false
      }
    }


    "have a body, with an edit, deleted" >> {
      val page = EmptyPage + bodySkeletonAutoApproved +
         editSkeleton + deletionOfEdit
      page.body_!.text must_== textInitially
      page.body_!.modificationDati must_== page.body_!.creationDati

      page.body_!.editsPendingDescTime must beEmpty
      page.body_!.editsAppliedDescTime must beEmpty
      page.body_!.editsRevertedDescTime must beEmpty
      page.body_!.editsDeletedDescTime must beLike {
        case List(edit) =>
          edit.id must_== editSkeleton.id
          edit.applicationDati must_== None
          edit.revertionDati must_== None
          edit.deletionDati must_== Some(deletionOfEdit.ctime)
          edit.isPending must_== false
          edit.isApplied must_== false
          edit.isReverted must_== false
          edit.isDeleted must_== true
      }
    }


    "have a body, with an edit, applied" >> {

      "automatically" >> {
        _testImpl(autoApplied = true)
      }

      "manually" >> {
        _testImpl(autoApplied = false)
      }

      def _testImpl(autoApplied: Boolean) {
        val PageWithEditApplied(page, edit, editApplDati) =
           makePageWithEditApplied(autoApplied)

        page.body_!.text must_== textAfterFirstEdit
        page.body_!.modificationDati must_== editApplDati

        page.body_!.editsPendingDescTime must beEmpty
        page.body_!.editsDeletedDescTime must beEmpty
        page.body_!.editsRevertedDescTime must beEmpty
        page.body_!.editsAppliedDescTime must beLike {
          case List(edit) =>
            edit.id must_== editSkeleton.id
            edit.applicationDati must_== Some(editApplDati)
            edit.revertionDati must_== None
            edit.deletionDati must_== None
            edit.isPending must_== false
            edit.isApplied must_== true
            edit.isReverted must_== false
            edit.isDeleted must_== false
        }
      }
    }

    "have a body, with an edit, applied" >> {

      "automatically, then reverted & deleted (cannot revert only)" >> {
        _testImpl(autoApplied = true)
      }

      "manually, then reverted" >> {
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
        body.text must_== textInitially
        body.modificationDati must_== revertionDati

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
            edit.deletionDati must_==
               (if (autoApplied) Some(revertionDati) else None)
            edit.isPending must_== !autoApplied
            edit.isApplied must_== false
            edit.isReverted must_== true
            edit.isDeleted must_== autoApplied
        }
      }

      "manually, then reverted and then deleted" >> {
        val PageWithEditApplied(pageNotReverted, _, _) =
              makePageWithEditApplied(autoApplied = false)
        val deletionAfterRevertion = deletionOfEdit.copy(
              ctime = new ju.Date(deletionOfEditApp.ctime.getTime + 1))
        val page = pageNotReverted + deletionOfEditApp + deletionAfterRevertion

        val body = page.body_!
        body.text must_== textInitially
        // When the edit itself was deleted doesn't matter, only when it
        // was reverted.
        body.modificationDati must_== deletionOfEditApp.ctime

        body.editsPendingDescTime must beEmpty
        body.editsAppliedDescTime must beEmpty
        findEditIn(body.editsRevertedDescTime)
        findEditIn(body.editsDeletedDescTime)

        def findEditIn(list: List[Patch]) = list must beLike {
          case List(edit) =>
            edit.id must_== editSkeleton.id
            edit.applicationDati must_== None
            edit.revertionDati must_== Some(deletionOfEditApp.ctime)
            edit.deletionDati must_== Some(deletionAfterRevertion.ctime)
            edit.isPending must_== false
            edit.isApplied must_== false
            edit.isReverted must_== true
            edit.isDeleted must_== true
        }
      }
    }



    "have a body, with an edit, applied, and" >> {

      "unapproved" >> {
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
        page.body_!.text must_== textAfterFirstEdit
        testEditLists(page.body_!)
      }

      "approved, automatically, permanently" >> {
        val page = PageWithEditManuallyAppliedAndAutoApproved
        //val page = EmptyPage + bodySkeletonAutoApproved +
        //   editSkeleton + editAppSkeleton.copy(
        //      approval = Some(Approval.WellBehavedUser))
        _testApprovedEdit(page.body_!, editAppSkeleton.ctime,
            manualApprovalDati = None, preliminarily = false)
      }

      "approved, automatically, preliminarily" >> {
        val page = PageWithEditManuallyAppliedAndPrelApproved
        _testApprovedEdit(page.body_!, editAppSkeleton.ctime,
          manualApprovalDati = None, preliminarily = true)
      }

      "approved, automatically, permanently, then rejected" >> {
        // The rejection should have no effect. See the comment in
        // another "permanently, then rejected" test, somewhere above.
      }

      "approved, automatically, preliminarily, then rejected" >> {
        // The rejection cancels the auto prel approval.
        val page = PageWithEditManuallyAppliedAndPrelApprovedThenRejected
        _testRejectedEdit(page)
      }

      "approved, manually" >> {
        val page = PageWithEditManuallyAppliedAndExplApproved
        //val page = EmptyPage + bodySkeletonAutoApproved +
        ///   editSkeleton + editAppSkeleton + approvalOfEditApp
        _testApprovedEdit(page.body_!, approvalOfEditApp.ctime,
            manualApprovalDati = Some(approvalOfEditApp.ctime),
            preliminarily = false)
      }

      "approved, and then reverted, but the revertion is not yet approved" >> {
        // Cannot implement right now: not possible to approve / not-approve
        // deletions of EditApp:s.
      }

      "rejected" >> {
        val page = PageWithEditManuallyAppliedAndRejected
        //val page = EmptyPage + bodySkeletonAutoApproved +
        //   editSkeleton + editAppSkeleton + rejectionOfEditApp
        _testRejectedEdit(page)
      }

      def _testRejectedEdit(page: Debate) {
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
        body.text must_== textAfterFirstEdit
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
          post.lastPermanentApproval must_== Some(post.action)
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
        post.text must_== textAfterFirstEdit
        testEditLists(post)
      }
    }


    "have a body, with one edit, pending, and a more recent edit that is" >> {
      "pending" >> {
        // text = textApproved = textInitially
      }

      "applied, not approved" >> {
        // text = textAfterSecondEditSkipFirst
        // textApproved = textInitially
      }

      "applied, and approved" >> {
        // Do this 2 times:
        // for the second edit being 1) manually and 2) auto approved.

        // text = textApproved = textAfterSecondEditSkipFirst
      }

      "applied and rejected" >> {
        // text = textAfterSecondEditSkipFirst
        // textApproved = textInitially
      }
    }


    "have a body, with one approved edit, and another that is" >> {

      "pending" >> {
        // text = textApproved = textAfterFirstEdit
      }

      // Do this 2 times:
      // for the first edit being 1) manually and 2) auto approved.

      "unapproved" >> {
        // text = textAfterSecondEdit
        // textApproved = textAfterFirstEdit
      }

      "approved" >> {
        // Do this 2 times:
        // for the second edit being 1) manually and 2) auto approved.

        // text = textApproved = textAfterSecondEdit
      }

      "approved, manually" >> {
        // text = textApproved = textAfterSecondEdit
      }

      "rejected" >> {
        // text = textAfterFirstEdit
        // textApproved = textAfterFirstEdit
      }
    }

  }

}


