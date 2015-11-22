/**
 * Copyright (C) 2015 Kaj Magnus Lindberg
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

package com.debiki.core

import com.debiki.core.Prelude._
import java.{util => ju}
import PostRevision._
import scala.collection.immutable
import scala.collection.mutable.ArrayBuffer


/** There might be many reasons to review something, so the review reason is a 2**x integer
  * so that many reasons can be combined in one single Long and stored in one single
  * database field. Example: NewPost —> not reviewed —> edited = NewPost.toInt & PostEdited.toInt
  */
sealed abstract class ReviewReason(IntVal: Int) { def toInt = IntVal }
object ReviewReason {

  // DON'T FORGET to update fromLong(..) below if adding/commenting-in a reason.

  case object NewPost extends ReviewReason(1)
  /** The first post by a new user, or first few posts, should be reviewed. */
  case object FirstOrEarlyPost extends ReviewReason(1 << 2)
  /** Closed forum topics aren't bumped, so no one might notice the new reply — review needed. */
  case object NoBumpPost extends ReviewReason(1 << 4)

  case object PostEdited extends ReviewReason(1 << 10)
  case object TitleEdited extends ReviewReason(1 << 11)
  case object PostFlagged extends ReviewReason(1 << 12)
  case object PostUnpopular extends ReviewReason(1 << 13)

  case object UserNewAvatar extends ReviewReason(1 << 20)
  case object UserNameEdited extends ReviewReason(1 << 21)
  case object UserAboutTextEdited extends ReviewReason(1 << 22)


  def fromLong(value: Long): immutable.Seq[ReviewReason] = {
    TESTS_MISSING // Convert -1 to reasons and check resulting seq length, and convert 0.
    val reasons = ArrayBuffer[ReviewReason]()
    if ((value & NewPost.toInt) != 0) reasons.append(NewPost)
    if ((value & FirstOrEarlyPost.toInt) != 0) reasons.append(FirstOrEarlyPost)
    if ((value & NoBumpPost.toInt) != 0) reasons.append(NoBumpPost)
    if ((value & PostEdited.toInt) != 0) reasons.append(PostEdited)
    if ((value & TitleEdited.toInt) != 0) reasons.append(TitleEdited)
    if ((value & PostFlagged.toInt) != 0) reasons.append(PostFlagged)
    if ((value & PostUnpopular.toInt) != 0) reasons.append(PostUnpopular)
    if ((value & UserNewAvatar.toInt) != 0) reasons.append(UserNewAvatar)
    if ((value & UserNameEdited.toInt) != 0) reasons.append(UserNameEdited)
    if ((value & UserAboutTextEdited.toInt) != 0) reasons.append(UserAboutTextEdited)
    reasons.to[immutable.Seq]
  }

  def toLong(reasons: immutable.Seq[ReviewReason]): Long = {
    TESTS_MISSING // Convert Nil and Seq(only-one) and Seq(a-few-reasons).
    var value = 0
    reasons.foreach(value += _.toInt)
    value
  }

}


