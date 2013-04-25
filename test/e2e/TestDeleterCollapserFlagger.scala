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
    // Click More...; this makes the delete link appear.
    val moreLink = findActionLink(postId, "dw-a-more")
    scrollIntoView(moreLink)

    // For whatever reasons, `mouse.moveMouse` and `Actions.moveToElement` doesn't
    // trigger the hover event that makes the More... menu visible, so it can be
    // clicked. Instead, fire the hover event "manually":
    // (I'll break out a reusable function... later on.)
    executeScript(i"""
      jQuery('#post-$postId').parent().find('> .dw-p-as').trigger('mouseenter');
      """)

    // More details on how I failed to trigger the on hover event. This didn't work:
    //   val mouse = (webDriver.asInstanceOf[HasInputDevices]).getMouse
    //   val hoverItem: Locatable = moreLink.underlying.asInstanceOf[Locatable]
    //   mouse.mouseMove(hoverItem.getCoordinates)
    // Neither did this:
    //   (new Actions(webDriver)).moveToElement(moreLink.underlying).perform()

    click on moreLink

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

