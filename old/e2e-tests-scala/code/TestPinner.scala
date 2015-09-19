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

import com.debiki.core.PostId
import com.debiki.core.Prelude._
import org.scalatest.time.{Seconds, Span}


/** Pins posts, e.g. at position 1 so they appear first, even if they
  * don't have many upvotes.
  */
trait TestPinner {
  self: DebikiBrowserSpec with StuffTestClicker =>


  def pinCommentViaMenu(postId: PostId, position: Int) {
    clickPinAction(postId)
    eventually {
      click on cssSelector("#dw-f-pin-pos [name='position']")
    }
    enter(s"$position")
    click on cssSelector("#dw-f-pin-pos [type='submit']")
  }


  private def clickPinAction(postId: PostId) {
    clickShowMoreActions(postId)
    val pinActions = findAll(cssSelector(".dw-a-pin"))
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

