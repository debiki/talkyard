/**
 * Copyright (c) 2012-2013 Kaj Magnus Lindberg
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

package com.debiki.core

import org.scalatest.{FreeSpec, MustMatchers}
import Prelude._
import java.{util => ju}

/*
class PagePartsTest extends FreeSpec with MustMatchers with PageTestValues {

  "A page can" - {

    "have a body" - {
      "unapproved" in {
        val page = EmptyPage + bodySkeleton
        page.body_!.directApproval mustBe None
        page.body_!.currentVersionReviewed mustBe false
        page.body_!.currentVersionRejected mustBe false
        page.body_!.currentVersionApproved mustBe false
        page.body_!.initiallyApproved mustBe false
        page.body_!.lastApprovalDati mustBe None
        page.body_!.lastManualApprovalDati mustBe None
        page.body_!.currentText mustBe textInitially
      }

      "approved, automatically, permanently" in {
        val page = EmptyPage + bodySkeletonAutoApproved
        page.body_!.currentVersionReviewed mustBe true
        page.body_!.currentVersionRejected mustBe false
        page.body_!.currentVersionApproved mustBe true
        page.body_!.currentVersionPrelApproved mustBe false
        page.body_!.someVersionPermanentlyApproved mustBe true
        page.body_!.initiallyApproved mustBe true
        page.body_!.lastApprovalDati mustBe Some(bodySkeleton.ctime)
        page.body_!.lastManualApprovalDati mustBe None
        page.body_!.currentText mustBe textInitially
      }

      "approved, automatically, preliminarily" in {
        val page = EmptyPage + bodySkeletonPrelApproved
        page.body_!.currentVersionReviewed mustBe true // by the computer
        page.body_!.currentVersionRejected mustBe false
        page.body_!.currentVersionApproved mustBe true
        page.body_!.currentVersionPrelApproved mustBe true
        page.body_!.someVersionPermanentlyApproved mustBe false
        page.body_!.initiallyApproved mustBe true
        page.body_!.lastPermanentApprovalDati mustBe None
        page.body_!.lastApprovalDati mustBe Some(page.body_!.creationDati)
        page.body_!.lastApprovalType mustBe page.body_!.directApproval
        page.body_!.lastApprovalDati mustBe Some(bodySkeleton.ctime)
        page.body_!.lastManualApprovalDati mustBe None
        page.body_!.currentText mustBe textInitially
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

      "approved, automatically, preliminarily, then deleted" in {
        // The rejection cancels all effects of the preliminary approval.
        val page = EmptyPage + bodySkeletonPrelApproved + bodyDeletionSkeleton
        _verifyBodyCorrectlyDeleted(page, prelApproved = true)
      }

      "approved, manually" in {
        val page = EmptyPage + bodySkeleton +
           bodyApprovalSkeleton
        page.body_!.currentVersionReviewed mustBe true
        page.body_!.currentVersionRejected mustBe false
        page.body_!.currentVersionApproved mustBe true
        page.body_!.currentVersionPrelApproved mustBe false
        page.body_!.someVersionPermanentlyApproved mustBe true
        page.body_!.initiallyApproved mustBe false
        page.body_!.lastApprovalDati mustBe Some(bodyApprovalSkeleton.ctime)
        page.body_!.lastManualApprovalDati mustBe
           Some(bodyApprovalSkeleton.ctime)
        page.body_!.currentText mustBe textInitially
      }

      "rejected" in {
        val page = EmptyPage + bodySkeleton + bodyDeletionSkeleton
        _verifyBodyCorrectlyDeleted(page, prelApproved = false)
      }

      def _verifyBodyCorrectlyDeleted(page: PageParts, prelApproved: Boolean) {
        val body = page.body_!
        body.isPostDeleted mustBe true
        body.currentVersionReviewed mustBe prelApproved
        body.currentVersionRejected mustBe false
        body.currentVersionApproved mustBe prelApproved
        body.currentVersionPrelApproved mustBe prelApproved
        body.someVersionPermanentlyApproved mustBe false
        body.initiallyApproved mustBe prelApproved
        body.lastPermanentApprovalDati mustBe None
        if (prelApproved) {
          body.lastApprovalType mustBe Some(Approval.Preliminary)
          body.lastApprovalDati mustBe Some(bodySkeletonPrelApproved.ctime)
        }
        else {
          body.lastApprovalType mustBe None
          body.lastApprovalDati mustBe None
        }
        body.lastManualApprovalDati mustBe None
        body.currentText mustBe textInitially
      }
    }


    "have a body, with an edit, pending" in {
      val body =
        bodySkeleton.copy(payload = bodySkeleton.payload.copy(
          approval = Some(Approval.WellBehavedUser)))
      val page = EmptyPage + body + editSkeleton
      page.body_!.currentText mustBe textInitially
      page.body_!.textLastEditedAt mustBe page.body_!.creationDati

      page.body_!.editsDeletedDescTime must be (empty)
      page.body_!.editsAppliedDescTime must be (empty)
      page.body_!.editsRevertedDescTime must be (empty)
      page.body_!.editsPendingDescTime match {
        case List(edit) =>
          edit.id mustBe editSkeleton.id
          edit.creationDati mustBe editSkeleton.ctime
          edit.applicationDati mustBe None
          edit.revertionDati mustBe None
          edit.deletedAt mustBe None
          edit.isPending mustBe true
          edit.isApplied mustBe false
          edit.isReverted mustBe false
          edit.isDeleted mustBe false
      }
    }


    "have a body, with an edit, deleted" in {
      // I've set `isDeleted = false` in Patch.scala, for now.
      pending /*
      val page = EmptyPage + bodySkeletonAutoApproved +
         editSkeleton + deletionOfEdit
      page.body_!.currentText mustBe textInitially
      page.body_!.textLastEditedAt mustBe page.body_!.creationDati

      page.body_!.editsPendingDescTime must be (empty)
      page.body_!.editsAppliedDescTime must be (empty)
      page.body_!.editsRevertedDescTime must be (empty)
      page.body_!.editsDeletedDescTime match {
        case List(edit) =>
          edit.id mustBe editSkeleton.id
          edit.applicationDati mustBe None
          edit.revertionDati mustBe None
          edit.deletedAt mustBe Some(deletionOfEdit.ctime)
          edit.isPending mustBe false
          edit.isApplied mustBe false
          edit.isReverted mustBe false
          edit.isDeleted mustBe true
      } */
    }


    "have a body, with an edit, applied" - {

      "automatically" in {
        _testImpl(autoApplied = true)
      }

      "manually" in {
        _testImpl(autoApplied = false)
      }

      def _testImpl(autoApplied: Boolean) {
        val PageWithEditApplied(page, edit, editApplDati) =
           makePageWithEditApplied(autoApplied)

        page.body_!.currentText mustBe textAfterFirstEdit
        page.body_!.textLastEditedAt mustBe editApplDati

        page.body_!.editsPendingDescTime must be (empty)
        page.body_!.editsDeletedDescTime must be (empty)
        page.body_!.editsRevertedDescTime must be (empty)
        page.body_!.editsAppliedDescTime match {
          case List(edit) =>
            edit.id mustBe editSkeleton.id
            edit.applicationDati mustBe Some(editApplDati)
            edit.revertionDati mustBe None
            edit.deletedAt mustBe None
            edit.isPending mustBe false
            edit.isApplied mustBe true
            edit.isReverted mustBe false
            edit.isDeleted mustBe false
        }
      }
    }

    "have a body, with an edit, applied" - {

      "automatically, then reverted & deleted (cannot revert only)" in {
        // I've set `isDeleted = false` in Patch.scala, for now.
        // _testImpl(autoApplied = true)
        pending
      }

      "manually, then reverted" in {
        // I've set `isDeleted = false` in Patch.scala, for now.
        // _testImpl(autoApplied = false)
        pending
      }

      /*
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
        body.currentText mustBe textInitially
        body.textLastEditedOrRevertedAt mustBe revertionDati

        // If `autoApplied` the Edit is deleted, otherwise it's pending again.
        if (autoApplied) body.editsPendingDescTime must be (empty)
        else findEditInList(body.editsPendingDescTime)

        if (autoApplied) findEditInList(body.editsDeletedDescTime)
        else body.editsDeletedDescTime must be (empty)

        body.editsAppliedDescTime must be (empty)
        findEditInList(body.editsRevertedDescTime)

        def findEditInList(list: List[Patch]) = list match {
          case List(edit) =>
            edit.id mustBe editSkeleton.id
            edit.applicationDati mustBe None
            edit.revertionDati mustBe Some(revertionDati)
            edit.deletedAt mustBe
               (if (autoApplied) Some(revertionDati) else None)
            edit.isPending mustBe !autoApplied
            edit.isApplied mustBe false
            edit.isReverted mustBe true
            edit.isDeleted mustBe autoApplied
        }
      }*/

      "manually, then reverted and then deleted" in {
        // I've set `isDeleted = false` in Patch.scala, for now.
        pending /*
        val PageWithEditApplied(pageNotReverted, _, _) =
              makePageWithEditApplied(autoApplied = false)
        val deletionAfterRevertion = deletionOfEdit.copy(
          creationDati = new ju.Date(deletionOfEditApp.ctime.getTime + 1))
        val page = pageNotReverted + deletionOfEditApp + deletionAfterRevertion

        val body = page.body_!
        body.currentText mustBe textInitially
        // When the edit itself was deleted doesn't matter, only when it
        // was reverted.
        body.textLastEditedOrRevertedAt mustBe deletionOfEditApp.ctime

        body.editsPendingDescTime must be (empty)
        body.editsAppliedDescTime must be (empty)
        findEditIn(body.editsRevertedDescTime)
        findEditIn(body.editsDeletedDescTime)

        def findEditIn(list: List[Patch]) = list match {
          case List(edit) =>
            edit.id mustBe editSkeleton.id
            edit.applicationDati mustBe None
            edit.revertionDati mustBe Some(deletionOfEditApp.ctime)
            edit.deletedAt mustBe Some(deletionAfterRevertion.ctime)
            edit.isPending mustBe false
            edit.isApplied mustBe false
            edit.isReverted mustBe true
            edit.isDeleted mustBe true
        }*/
      }
    }



    "have a body, with an edit, applied, and" - {

      "unapproved" in {
        val page = EmptyPage + bodySkeletonAutoApproved +
           editSkeleton + editAppSkeleton // not approved

        page.body_!.currentVersionReviewed mustBe false
        page.body_!.currentVersionRejected mustBe false
        page.body_!.currentVersionApproved mustBe false
        page.body_!.someVersionApproved mustBe true
        page.body_!.initiallyApproved mustBe true
        page.body_!.lastReviewDati mustBe Some(page.body_!.creationDati)
        page.body_!.lastApprovalDati mustBe Some(page.body_!.creationDati)
        page.body_!.lastManualApprovalDati mustBe None
        page.body_!.currentText mustBe textAfterFirstEdit
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
        pending
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
        body.currentVersionReviewed mustBe true
        body.currentVersionRejected mustBe true
        body.currentVersionApproved mustBe false
        body.currentVersionPrelApproved mustBe false
        body.someVersionPermanentlyApproved mustBe true
        body.someVersionApproved mustBe true
        body.initiallyApproved mustBe true
        body.lastReviewDati mustBe Some(rejectionOfEditApp.ctime)
        body.lastApprovalDati mustBe Some(page.body_!.creationDati)
        body.lastManualApprovalDati mustBe None
        body.currentText mustBe textAfterFirstEdit
        testEditLists(body)
      }

      def testEditLists(post: Post) {
        post.editsPendingDescTime must be (empty)
        post.editsDeletedDescTime must be (empty)
        post.editsRevertedDescTime must be (empty)
        post.editsAppliedDescTime match {
          case List(edit) =>
            edit.id mustBe editSkeleton.id
            edit.applicationDati mustBe Some(editAppSkeleton.ctime)
            edit.isPending mustBe false
            edit.isApplied mustBe true
            edit.isReverted mustBe false
            edit.isDeleted mustBe false
        }
      }

      def _testApprovedEdit(post: Post, approvalDati: ju.Date,
            manualApprovalDati: Option[ju.Date], preliminarily: Boolean) {
        post.currentVersionReviewed mustBe true //
        post.currentVersionRejected mustBe false
        post.currentVersionApproved mustBe true
        post.currentVersionPrelApproved mustBe preliminarily
        post.someVersionPermanentlyApproved mustBe true // orig version aprvd
        post.someVersionApproved mustBe true

        if (preliminarily)
          post.lastPermanentApprovalDati mustBe Some(post.creationDati)
        // Could test other cases:
        // post.lastPermanentApproval mustBe (
        //  if (preliminarily) post.action
        //  else if (manualApproval) manualApproval // missing
        //  else the-edit)
        // post.lastApproval mustBe ....)

        post.initiallyApproved mustBe true
        post.lastReviewDati mustBe Some(approvalDati)
        post.lastApprovalDati mustBe Some(approvalDati)
        post.lastManualApprovalDati mustBe manualApprovalDati
        post.currentText mustBe textAfterFirstEdit
        testEditLists(post)
      }
    }


    "have a body, with one edit, pending, and a more recent edit that is" - {
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


    "have a body, with one approved edit, and another that is" - {

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
*/

// vim: fdm=marker et ts=2 sw=2 fo=tcqwn list
