/**
 * Copyright (c) 2013 Kaj Magnus Lindberg (born 1979)
 */

package test.e2e

import com.debiki.v0.Prelude._
import org.scalatest.time.{Seconds, Span}


/** Deletes or collapses or flags comments and comment trees.
  */
trait TestDeleterCollapserFlagger {
  self: DebikiBrowserSpec with StuffTestClicker =>


  def deleteSingleComment(postId: String) {
    deleteCommentImpl(postId, wholeTree = false)
  }


  def deleteCommentTree(postId: String) {
    deleteCommentImpl(postId, wholeTree = true)
  }


  private def deleteCommentImpl(postId: String, wholeTree: Boolean) {
    // Click delete link.
    val deleteLink = findActionLink(postId, "dw-a-delete")
    click on deleteLink

    // Check "delete all replies too?" checkbox.
    if (wholeTree) {
      click on "dw-fi-dl-tree"
    }

    // Submit form.
    click on "dw-fi-submit"
  }

}

