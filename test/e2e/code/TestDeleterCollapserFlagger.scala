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

import com.debiki.core.ActionId
import com.debiki.core.Prelude._
import org.scalatest.time.{Seconds, Span}


/** Deletes or collapses or flags comments and comment trees.
  */
trait TestDeleterCollapserFlagger {
  self: DebikiBrowserSpec with StuffTestClicker =>


  def deleteSingleComment(postId: ActionId) {
    deleteCommentImpl(postId, wholeTree = false)
  }


  def deleteCommentTree(postId: ActionId) {
    deleteCommentImpl(postId, wholeTree = true)
  }


  private def deleteCommentImpl(postId: ActionId, wholeTree: Boolean) {
    showActionLinks(postId)

    // Click More...; this makes the delete link appear (unless already done).
    findActionLink(postId, "dw-a-more") foreach { moreLink =>
      scrollIntoView(moreLink)
      click on moreLink
    }

    val deleteLink = findActionLink_!(postId, "dw-a-delete")
    scrollIntoView(deleteLink)
    click on deleteLink

    // Check "delete all replies too?" checkbox.
    if (wholeTree) {
      click on "dw-fi-dl-tree"
    }

    // Submit form.
    click on cssSelector("#dw-f-dl .dw-fi-submit")

    eventually {
      isPostDeleted(postId) must be === true
    }
  }

}

