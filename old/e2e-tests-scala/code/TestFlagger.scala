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

package test.e2e.code

import com.debiki.core.PostId
import com.debiki.core.FlagType.FlagType
import com.debiki.core.Prelude._
import org.scalatest.time.{Seconds, Span}


/** Flags posts, e.g. reports a post as being inappropriate.
  */
trait TestFlagger {
  self: DebikiBrowserSpec with StuffTestClicker =>


  def flagPost(postId: PostId, flagType: FlagType) {
    clickFlagAction(postId)
    eventually {
      click on cssSelector("label[for^='dw-fi-flgs-spam'] > span")
    }
    eventually {
      click on cssSelector(".ui-dialog-content .dw-f-flg .dw-fi-submit")
    }
    eventually {
      val alert = switch to alertBox
      alert.accept()
    }
    // Wait until the browser has had time to remove the modal dialog overlay
    // (this sometimes takes a short while, don't know why).
    eventually {
      find(cssSelector(".ui-widget-overlay")) must be (empty)
    }
  }


  private def clickFlagAction(postId: PostId) {
    clickShowMoreActions(postId)
    val pinActions = findAll(cssSelector(".dw-a-flag"))
    val anyVisiblePinAction = pinActions.filter(_.isDisplayed).toSeq.headOption
    anyVisiblePinAction match {
      case None =>
        fail()
      case Some(pinAction) =>
        scrollIntoView(pinAction)
        click on pinAction
    }
  }

}

