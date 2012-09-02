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
    Post(id = "1", parent = "1", ctime = new ju.Date(1000),
        loginId = "100", newIp = None, text = textInitially,
        markup = "", autoApproval = None, tyype = PostType.Text,
        where = None)

  val bodySkeletonAutoApproved = bodySkeleton.copy(
        autoApproval = Some(AutoApproval.WellBehavedUser))

  val manualBodyApprovalDate = new ju.Date(1010)

  val bodyApprovalSkeleton =
    Review("11", targetId = bodySkeleton.id, loginId = "101", newIp = None,
        ctime = manualBodyApprovalDate, isApproved = true)

  val bodyRejectionSkeleton = bodyApprovalSkeleton.copy(isApproved = false)

  val editSkeleton =
    Edit(id = "12", postId = bodySkeleton.id, ctime = new ju.Date,
        loginId = "102", newIp = None,
        text = makePatch(from = textInitially, to = textAfterFirstEdit),
        newMarkup = None, autoApproval = None, autoApplied = false)

  def deletionOfEdit =
    Delete(id = "13", postId = editSkeleton.id,
      loginId = "103", newIp = None, ctime = new ju.Date, wholeTree = false,
      reason = "")

  val editAppSkeleton =
    EditApp(id = "14", editId = editSkeleton.id, loginId = "104",
        newIp = None, ctime = new ju.Date, autoApproval = None,
        result = "ignored")

  val approvalOfEditApp = Review(id = "15", targetId = editAppSkeleton.id,
        loginId = "105", newIp = None, ctime = new ju.Date,
        isApproved = true)

  val rejectionOfEditApp = approvalOfEditApp.copy(isApproved = false)


  "A page" can {

    "have a body" >> {
      "unapproved" >> {
        val page = Debate.empty("a") + bodySkeleton
        page.body_!.currentVersionReviewed must_== false
        page.body_!.currentVersionRejected must_== false
        page.body_!.currentVersionApproved must_== false
        page.body_!.initiallyAutoApproved must_== false
        page.body_!.lastApprovalDate must_== None
        page.body_!.text must_== textInitially
        page.body_!.textApproved must_== ""
      }

      "approved, automatically" >> {
        val page = Debate.empty("a") + bodySkeletonAutoApproved
        page.body_!.currentVersionReviewed must_== true
        page.body_!.currentVersionRejected must_== false
        page.body_!.currentVersionApproved must_== true
        page.body_!.initiallyAutoApproved must_== true
        page.body_!.lastApprovalDate must_== Some(bodySkeleton.ctime)
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
        page.body_!.lastApprovalDate must_== Some(manualBodyApprovalDate)
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
        page.body_!.lastApprovalDate must_== None
        page.body_!.text must_== textInitially
        page.body_!.textApproved must_== ""
      }
    }


    "have a body, with an edit, pending" >> {
      val body =
        bodySkeleton.copy(autoApproval = Some(AutoApproval.WellBehavedUser))
      val page = Debate.empty("a") + body + editSkeleton
      page.body_!.text must_== textInitially
      page.body_!.mdatiPerhapsReviewed must_== page.body_!.cdati

      page.body_!.editsDeleted must beEmpty
      page.body_!.editsAppdDesc must beEmpty
      page.body_!.editsAppdRevd must beEmpty
      page.body_!.editsPending must beLike {
        case List(edit) =>
          edit.id must_== editSkeleton.id
          true
        case _ => false
      }
    }


    "have a body, with an edit, deleted" >> {
      val page = Debate.empty("a") + bodySkeletonAutoApproved +
         editSkeleton + deletionOfEdit
      page.body_!.text must_== textInitially
      page.body_!.mdatiPerhapsReviewed must_== page.body_!.cdati

      page.body_!.editsPending must beEmpty
      page.body_!.editsAppdDesc must beEmpty
      page.body_!.editsAppdRevd must beEmpty
      page.body_!.editsDeleted must beLike {
        case List((edit, deletion)) =>
          edit.id must_== editSkeleton.id
          deletion.id must_== deletionOfEdit.id
          true
        case _ => false
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
        page.body_!.lastReviewDate must_== Some(page.body_!.cdati)
        page.body_!.lastApprovalDate must_== Some(page.body_!.cdati)
        page.body_!.text must_== textAfterFirstEdit
        page.body_!.textApproved must_== textInitially
        testEditLists(page.body_!)
      }

      "approved, automatically" >> {
        val page = Debate.empty("a") + bodySkeletonAutoApproved +
           editSkeleton + editAppSkeleton.copy(
              autoApproval = Some(AutoApproval.WellBehavedUser))
        testApprovedPost(page.body_!)
      }

      "approved, manually" >> {
        val page = Debate.empty("a") + bodySkeletonAutoApproved +
           editSkeleton + editAppSkeleton + approvalOfEditApp
        testApprovedPost(page.body_!)
      }

      "rejected" >> {
        val page = Debate.empty("a") + bodySkeletonAutoApproved +
           editSkeleton + editAppSkeleton + rejectionOfEditApp

        page.body_!.currentVersionReviewed must_== true
        page.body_!.currentVersionRejected must_== true //
        page.body_!.currentVersionApproved must_== false
        page.body_!.someVersionApproved must_== true
        page.body_!.initiallyAutoApproved must_== true
        page.body_!.lastReviewDate must_== Some(rejectionOfEditApp.ctime)
        page.body_!.lastApprovalDate must_== Some(page.body_!.cdati)
        page.body_!.text must_== textAfterFirstEdit
        page.body_!.textApproved must_== textInitially
        testEditLists(page.body_!)
      }

      def testEditLists(post: ViPo) {
        post.editsPending must beEmpty
        post.editsDeleted must beEmpty
        post.editsAppdRevd must beEmpty
        post.editsAppdDesc must beLike {
          case List((edit, editApp)) =>
            edit.id must_== edit.id
            editApp.id must_== editAppSkeleton.id
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
        post.lastReviewDate must_== Some(editAppSkeleton.ctime)
        post.lastApprovalDate must_== Some(editAppSkeleton.ctime)
        post.text must_== textAfterFirstEdit
        post.textApproved must_== textAfterFirstEdit
        testEditLists(post)
      }
    }


    "have a body, with one approved edit, and another edits that is" >> {
      "unapproved" >> {
        // text = textAfterFirstEdit
      }

      "approved, automatically" >> {
        // text = textInitially
      }

      "approved, manually" >> {
        // text = textInitially
      }

      "rejected" >> {
        // text = textAfterFirstEdit
      }
    }


    "have a body, with one rejected edit, and another edits that is" >> {
      "unapproved" >> {
        // text = textInitially
      }

      "approved, automatically" >> {
        // text = textAfterSecondEdit
      }

      "approved, manually" >> {
        // text = textAfterSecondEdit
      }

      "rejected" >> {
        // text = textInitially
      }
    }

  }

}


