/**
 * Copyright (C) 2014 Kaj Magnus Lindberg (born 1979)
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

package test.e2e.specs

import com.debiki.core.{PostId, PageId}
import test.e2e.code._


/** Methods for the moderation page, e.g. to approve and delete comments and
  * check flags.
  */
trait TestModeration {
  self: DebikiBrowserSpec with StuffTestClicker =>


  // For a discussion page. Should be moved to a page object?
  def waitUntilUserSpecificDataHandled() {
    eventually {
      find(cssSelector(".dw-user-page-data")) must be('empty)
    }
  }


  // For the admin dashboard. Should be moved to a page object?
  def checkCommentStatus(pageId: PageId, postId: PostId, commentStatusText: String,
        numSuggestions: Int = -1) {
    val commentLink = find(cssSelector(s"a[href='/-$pageId#post-$postId']")).
      getOrElse(fail(s"Comment `$postId' not listed"))
    commentLink.text.toLowerCase mustBe commentStatusText.toLowerCase

    if (numSuggestions != -1) {
      val link = findImprovementSuggestionsLink(pageId, postId)
      val isVisible = link.map(_.isDisplayed) == Some(true)
      if (numSuggestions == 0 && isVisible)
        fail(s"Improvement suggestions incorrectly listed for post `$postId'")
      if (numSuggestions >= 1 && !isVisible)
        fail(s"No improvement suggestions listed for post `$postId'")
    }
  }


  object CommentStatusText {
    val ApprovedComment = "Comment"
    val PrelApprovedComment = "New comment, preliminarily approved"
    val UnapprovedComment = "New comment"
    val UnapprovedEdits = "Comment, edited"
  }


  def findApproveNewPostLink(pageId: String, postId: PostId) =
    findPostInlineSomething(pageId, postId, cssClass = "approve-new-post")

  def clickApproveNewPost(pageId: String, postId: PostId) =
    click on findApproveNewPostLink(pageId, postId).getOrElse(fail(
      s"Approve new post link missing, page id: $pageId, post id: $postId"))

  def findPostApprovedMessage(pageId: String, postId: PostId) =
    findPostInlineSomething(pageId, postId, cssClass = "inline-message", text = "Approved.")


  def findDeleteNewPostLink(pageId: String, postId: PostId) =
    findPostInlineSomething(pageId, postId, cssClass = "delete-new-post")

  def clickDeleteNewPost(pageId: String, postId: PostId) =
    click on findDeleteNewPostLink(pageId, postId).getOrElse(fail(
      s"Delete new post link missing, page id: $pageId, post id: $postId"))

  def findDeleteFlaggedPostLink(pageId: String, postId: PostId) =
    findPostInlineSomething(pageId, postId, cssClass = "delete-flagged-post")

  def clickDeleteFlaggedPost(pageId: String, postId: PostId) =
    click on findDeleteFlaggedPostLink(pageId, postId).getOrElse(fail(
      s"Delete flagged post link missing, page id: $pageId, post id: $postId"))

  def findPostDeletedMessage(pageId: String, postId: PostId) =
    findPostInlineSomething(pageId, postId, cssClass = "inline-message", text = "Deleted.")


  def findClearFlagsLink(pageId: String, postId: PostId) =
    findPostInlineSomething(pageId, postId, cssClass = "clear-flags")

  def clickClearFlags(pageId: String, postId: PostId) =
    click on findClearFlagsLink(pageId, postId).getOrElse(fail(
      s"Clear flags link missing, page id: $pageId, post id: $postId"))

  def findFlagsClearedMessage(pageId: String, postId: PostId) =
    findPostInlineSomething(pageId, postId, cssClass = "inline-message", text = "Flags cleared.")


  def findImprovementSuggestionsLink(pageId: PageId, postId: PostId) =
    findPostInlineSomething(pageId, postId, "suggestions-link")


  private def findPostInlineSomething(
        pageId: String, postId: PostId, cssClass: String, text: String = null) = {
    val query = findPostElemXpath(pageId, postId) +
      s"//*[contains(concat(' ', @class, ' '), ' $cssClass ')]"
    var anyElem = find(xpath(query))
    if (text ne null) anyElem = anyElem filter { _.text == text }
    anyElem
  }


  def findAnyInlineButton(pageId: String, postId: PostId) = {
    val query = findPostElemXpath(pageId, postId) + "//button"
    findAll(xpath(query)).filter(_.isDisplayed).toList.headOption
  }


  private def findPostElemXpath(pageId: String, postId: PostId) = {
    // Find the link to the comment
    s"//a[@href='/-$pageId#post-$postId' and " +
      "contains(concat(' ', @class, ' '), ' action-description ')]" +
      // Find the <td> in which the link and inline actions are located
      "/../.."
  }

}


