// vim: ts=2 sw=2 et
/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */

package com.debiki.v0

import org.specs._
import Prelude._
import java.{util => ju}


class PageTest extends SpecificationWithJUnit {

  val textInitially = "initial-body-text"
  val textAfterFirstEdit = "body-text-after-first-edit"

  val bodySkeleton =
    Post(id = "1", parent = "1", ctime = new ju.Date(1001),
        loginId = "100", newIp = None, text = textInitially,
        markup = "", autoApproval = None, tyype = PostType.Text,
        where = None)

  val bodySkeletonAutoApproved = bodySkeleton.copy(
        autoApproval = Some(AutoApproval.WellBehavedUser))

  val bodyApprovalSkeleton =
    Review("11", targetId = bodySkeleton.id, loginId = "101", newIp = None,
        ctime = new ju.Date(1011), isApproved = true)

  val bodyRejectionSkeleton = bodyApprovalSkeleton.copy(isApproved = false)

  val editSkeleton =
    Edit(id = "12", postId = bodySkeleton.id, ctime = new ju.Date(1012),
        loginId = "102", newIp = None,
        text = makePatch(from = textInitially, to = textAfterFirstEdit),
        newMarkup = None, relatedPostAutoApproval = None, autoApplied = false)

  def deletionOfEdit =
    Delete(id = "13", postId = editSkeleton.id,
      loginId = "103", newIp = None, ctime = new ju.Date(1013),
      wholeTree = false, reason = "")

  val editAppSkeleton =
    EditApp(id = "14", editId = editSkeleton.id, loginId = "104",
        newIp = None, ctime = new ju.Date(1014),
        relatedPostAutoApproval = None, result = "ignored")

  val deletionOfEditApp =
    Delete(id = "15", postId = editAppSkeleton.id,
        loginId = "105", newIp = None, ctime = new ju.Date(1015),
        wholeTree = false, reason = "")

  val approvalOfEditApp = Review(id = "16", targetId = editAppSkeleton.id,
        loginId = "106", newIp = None, ctime = new ju.Date(1016),
        isApproved = true)

  val rejectionOfEditApp = approvalOfEditApp.copy(isApproved = false)


  case class PageWithEditApplied(page: Debate, edit: Edit, applDate: ju.Date)

  def makePageWithEditApplied(autoApplied: Boolean): PageWithEditApplied = {
    val (edit, editApplDati) =
      if (autoApplied)
        (editSkeleton.copy(autoApplied = true), editSkeleton.ctime)
      else
        (editSkeleton, editAppSkeleton.ctime)
    var page = Debate.empty("a") + bodySkeletonAutoApproved + edit
    if (!autoApplied) page = page + editAppSkeleton
    PageWithEditApplied(page, edit, editApplDati)
  }


  "A page" can {

    "have a body" >> {
      "unapproved" >> {
        val page = Debate.empty("a") + bodySkeleton
        page.body_!.currentVersionReviewed must_== false
        page.body_!.currentVersionRejected must_== false
        page.body_!.currentVersionApproved must_== false
        page.body_!.initiallyAutoApproved must_== false
        page.body_!.lastApprovalDati must_== None
        page.body_!.text must_== textInitially
        page.body_!.textApproved must_== ""
      }

      "approved, automatically" >> {
        val page = Debate.empty("a") + bodySkeletonAutoApproved
        page.body_!.currentVersionReviewed must_== true
        page.body_!.currentVersionRejected must_== false
        page.body_!.currentVersionApproved must_== true
        page.body_!.initiallyAutoApproved must_== true
        page.body_!.lastApprovalDati must_== Some(bodySkeleton.ctime)
        page.body_!.text must_== textInitially
        page.body_!.textApproved must_== textInitially
      }

      "approved, manually" >> {
        val page = Debate.empty("a") + bodySkeleton +
           bodyApprovalSkeleton
        page.body_!.currentVersionReviewed must_== true
        page.body_!.currentVersionRejected must_== false
        page.body_!.currentVersionApproved must_== true
        page.body_!.initiallyAutoApproved must_== false
        page.body_!.lastApprovalDati must_== Some(bodyApprovalSkeleton.ctime)
        page.body_!.text must_== textInitially
        page.body_!.textApproved must_== textInitially
      }

      "rejected" >> {
        val page = Debate.empty("a") + bodySkeleton +
           bodyRejectionSkeleton
        page.body_!.currentVersionReviewed must_== true
        page.body_!.currentVersionRejected must_== true
        page.body_!.currentVersionApproved must_== false
        page.body_!.initiallyAutoApproved must_== false
        page.body_!.lastApprovalDati must_== None
        page.body_!.text must_== textInitially
        page.body_!.textApproved must_== ""
      }
    }


    "have a body, with an edit, pending" >> {
      val body =
        bodySkeleton.copy(autoApproval = Some(AutoApproval.WellBehavedUser))
      val page = Debate.empty("a") + body + editSkeleton
      page.body_!.text must_== textInitially
      page.body_!.modfDatiPerhapsReviewed must_== page.body_!.creationDati

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
          true
        case _ => false
      }
    }


    "have a body, with an edit, deleted" >> {
      val page = Debate.empty("a") + bodySkeletonAutoApproved +
         editSkeleton + deletionOfEdit
      page.body_!.text must_== textInitially
      page.body_!.modfDatiPerhapsReviewed must_== page.body_!.creationDati

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
          true
        case _ => false
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
        page.body_!.textApproved must_== textInitially
        page.body_!.modfDatiPerhapsReviewed must_== editApplDati

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
            true
          case _ => false
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
        body.textApproved must_== textInitially
        body.modfDatiPerhapsReviewed must_== revertionDati

        // If `autoApplied` the Edit is deleted, otherwise it's pending again.
        if (autoApplied) body.editsPendingDescTime must beEmpty
        else findEditInList(body.editsPendingDescTime)

        if (autoApplied) findEditInList(body.editsDeletedDescTime)
        else body.editsDeletedDescTime must beEmpty

        body.editsAppliedDescTime must beEmpty
        findEditInList(body.editsRevertedDescTime)

        def findEditInList(list: List[ViEd]) = list must beLike {
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
            true
          case _ => false
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
        body.textApproved must_== textInitially
        // When the edit itself was deleted doesn't matter, only when it
        // was reverted.
        body.modfDatiPerhapsReviewed must_== deletionOfEditApp.ctime

        body.editsPendingDescTime must beEmpty
        body.editsAppliedDescTime must beEmpty
        findEditIn(body.editsRevertedDescTime)
        findEditIn(body.editsDeletedDescTime)

        def findEditIn(list: List[ViEd]) = list must beLike {
          case List(edit) =>
            edit.id must_== editSkeleton.id
            edit.applicationDati must_== None
            edit.revertionDati must_== Some(deletionOfEditApp.ctime)
            edit.deletionDati must_== Some(deletionAfterRevertion.ctime)
            edit.isPending must_== false
            edit.isApplied must_== false
            edit.isReverted must_== true
            edit.isDeleted must_== true
            true
          case _ => false
        }
      }
    }



    "have a body, with an edit, applied, and" >> {

      "unapproved" >> {
        val page = Debate.empty("a") + bodySkeletonAutoApproved +
           editSkeleton + editAppSkeleton // not approved

        page.body_!.currentVersionReviewed must_== false
        page.body_!.currentVersionRejected must_== false
        page.body_!.currentVersionApproved must_== false
        page.body_!.someVersionApproved must_== true
        page.body_!.initiallyAutoApproved must_== true
        page.body_!.lastReviewDati must_== Some(page.body_!.creationDati)
        page.body_!.lastApprovalDati must_== Some(page.body_!.creationDati)
        page.body_!.text must_== textAfterFirstEdit
        page.body_!.textApproved must_== textInitially
        testEditLists(page.body_!)
      }

      "approved, automatically" >> {
        val page = Debate.empty("a") + bodySkeletonAutoApproved +
           editSkeleton + editAppSkeleton.copy(
              relatedPostAutoApproval = Some(AutoApproval.WellBehavedUser))
        testApprovedPost(page.body_!)
      }

      "approved, manually" >> {
        val page = Debate.empty("a") + bodySkeletonAutoApproved +
           editSkeleton + editAppSkeleton + approvalOfEditApp
        testApprovedPost(page.body_!)
      }

      "approved, and then reverted, but the revertion is not yet approved" >> {

      }

      "rejected" >> {
        val page = Debate.empty("a") + bodySkeletonAutoApproved +
           editSkeleton + editAppSkeleton + rejectionOfEditApp

        page.body_!.currentVersionReviewed must_== true
        page.body_!.currentVersionRejected must_== true //
        page.body_!.currentVersionApproved must_== false
        page.body_!.someVersionApproved must_== true
        page.body_!.initiallyAutoApproved must_== true
        page.body_!.lastReviewDati must_== Some(rejectionOfEditApp.ctime)
        page.body_!.lastApprovalDati must_== Some(page.body_!.creationDati)
        page.body_!.text must_== textAfterFirstEdit
        page.body_!.textApproved must_== textInitially
        testEditLists(page.body_!)
      }

      def testEditLists(post: ViPo) {
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
            true
          case _ => false
        }
      }

      def testApprovedPost(post: ViPo) {
        post.currentVersionReviewed must_== true //
        post.currentVersionRejected must_== false
        post.currentVersionApproved must_== true
        post.someVersionApproved must_== true
        post.initiallyAutoApproved must_== true
        post.lastReviewDati must_== Some(editAppSkeleton.ctime)
        post.lastApprovalDati must_== Some(editAppSkeleton.ctime)
        post.text must_== textAfterFirstEdit
        post.textApproved must_== textAfterFirstEdit
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


