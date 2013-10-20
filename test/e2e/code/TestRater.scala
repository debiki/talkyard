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


/** Adds replies to the article or other comments.
  */
trait TestRater {
  self: DebikiBrowserSpec with StuffTestClicker =>

  val GoodRating = "interesting"
  val BadRating = "faulty"


  def rateComment(postId: PostId, rating: String) {
    clickRateAction(postId)
    clickRatingTag(rating)
    clickSubmit()
  }


  private def clickRateAction(postId: PostId) {
    showActionLinks(postId)
    val rateLink = findActionLink_!(postId, "dw-a-rate")
    scrollIntoView(rateLink)
    click on rateLink
  }


  private def clickRatingTag(rating: String) {
  }


  private def clickSubmit() {
    click on cssSelector(".dw-page .dw-fs-ra .dw-fi-submit")
  }

}

