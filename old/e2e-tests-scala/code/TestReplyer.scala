/**
 * Copyright (C) 2013 Kaj Magnus Lindberg (born 1979)
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

package test.e2e.code

import com.debiki.core.Prelude._
import com.debiki.core.ActionId
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
    findAll(cssSelector(".dw-p")).flatMap({ post =>
      // Embedded comment pages have an empty .dw-p, and for some reason Selenium or
      // the browser believes it has an empty id attribute too, although Chrome's debug
      // inspector doesn't show any id. So treat empty id as no id.
      val anyIdAttr = post.attribute("id")
      if (anyIdAttr == Some("")) {
        None
      }
      else {
        // Drop "post-".
        anyIdAttr.map(_.drop(5).toInt)
      }
    }).toSet


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


  override def reloadPage()(implicit driver: org.openqa.selenium.WebDriver) {
    replyFormSno = 0
    // I don't know how to call WebBrowser.reloadPage() from here?
    // self.reloadPage() recurses, and super.reloadPage() -> compilation error.
    // So I just copied the implementation to here. This is error prone?
    // In case some other function also override reloadPage().  ??
    driver.navigate.refresh()
  }


  def clickPostReply() {
    eventually {
      click on cssSelector(".dw-page .dw-fs-re .dw-fi-submit")
    }
  }


  def anyCommentIsPendingModeration =
    pageSource contains "Comment pending moderation"


  def articleReplyLink = {
    // Check reply link location for horizontal, vertical layouts and embedded
    // comments pages.
    val anyHorizontalReplyBtn = find(cssSelector(".dw-p-as-hz > .dw-a-reply"))
    val anyVerticalReplyBtn = find(cssSelector(".dw-ar-t > .dw-p-as > .dw-a-reply"))
    val anyEmbeddedCommentsToolbarBtn = find(cssSelector(".dw-cmts-tlbr .dw-a-reply"))
    val anyBtn = anyHorizontalReplyBtn orElse anyVerticalReplyBtn orElse
      anyEmbeddedCommentsToolbarBtn
    anyBtn.get
  }


}

