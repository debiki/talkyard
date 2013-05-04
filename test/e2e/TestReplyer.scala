/**
 * Copyright (c) 2013 Kaj Magnus Lindberg (born 1979)
 */

package test.e2e

import com.debiki.v0.Prelude._
import com.debiki.v0.ActionId
import org.scalatest.time.{Seconds, Span}


/** Adds replies to the article or other comments.
  */
trait TestReplyer {
  self: DebikiBrowserSpec with StuffTestClicker with TestLoginner =>

  private var replyFormSno = 0


  /** Adds a new reply; returns its id.
    */
  def replyToArticle(text: String): ActionId = {
    clickArticleReplyLink()
    writeAndSubmitReply(text)
  }


  def replyToComment(postId: ActionId, text: String): ActionId = {
    showActionLinks(postId)
    val replyLink = findActionLink_!(postId, "dw-a-reply")
    scrollIntoView(replyLink)
    click on replyLink
    writeAndSubmitReply(text)
  }


  private def writeAndSubmitReply(text: String): ActionId = {
    writeReply(text)

    val postIdsBefore = findAllPostIds

    clickPostReply()

    eventually {
      // Handle any login dialogs.
      // find("dw-fs-lgi-simple") foreach { _ =>
      // }

      // Handle any email notifications question.
      if (find("dw-f-eml-prf").map(_.isDisplayed) == Some(true)) {
        click on noEmailBtn
      }

      val postIdsNow = findAllPostIds
      val anyNewPostId = (postIdsNow -- postIdsBefore).headOption
      val newPostId = anyNewPostId getOrDie "Waiting for the new reply to appear..."

      find(cssSelector(s"#post-$newPostId .dw-p-bd-blk > *")).map(_.text) match {
        case Some(`text`) => // ok
        case Some(x) => throw new Exception(s"Bad reply text: $x")
        case None => throw new Exception("No reply text")
      }

      newPostId
    }
  }


  /** Finds the ids of all posts (without the "post-" prefix).
    */
  private def findAllPostIds =
    findAll(cssSelector(".dw-p")).flatMap(_.attribute("id").map(_.drop(5).toInt)).toSet


  def clickArticleReplyLink() {
    eventually {
      scrollIntoView(articleReplyLink)
      click on articleReplyLink
    }
  }


  def writeReply(text: String) {
    replyFormSno += 1
    val textAreaId = s"dw-fi-reply-text_sno-$replyFormSno"
    eventually {
      click on textAreaId
      enter(text)
      textArea(textAreaId).value must be === text
    }
  }


  def clickPostReply() {
    eventually {
      click on cssSelector(".dw-fi-submit")
    }
  }


  def anyCommentIsPendingModeration =
    pageSource contains "Comment pending moderation"


  def articleReplyLink = cssSelector(".dw-p-as-hz > .dw-a-reply")


}

