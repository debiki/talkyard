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
  * database field. Examples:
  *   NewPost —> not reviewed —> edited = NewPost.toInt & PostEdited.toInt
  *   (i.e. a new post --> review reason New Post.
  *    then someone edits it --> review reason PostEdited, too.
  *    So now there are two reasons to review it (but only one review task, so
  *    the staff will just review the post once).)
  */
sealed abstract class ReviewReason(val IntVal: Int, val isOnPage: Boolean = true) {
  def toInt = IntVal
}

// WOULD change this to be like ReviewTaskResolution(value: Int) extends AnyVal & magic bits
object ReviewReason {

  // DON'T FORGET to update fromLong(..) below if adding/commenting-in a reason.

  /** Always review stuff done by a mild / moderate threat level user. */
  case object IsByThreatUser extends ReviewReason(1 << 0)

  /** The first/first-few posts by a new user should be reviewed. */
  case object IsByNewUser extends ReviewReason(1 << 1)

  // << 2 and << 3 reserved for other user types. Perhaps IsByGuest?

  /** We don't need any NewPage reason, because if the ReviewTask post nr is BodyId,
    * then we know it's for a new page. */
  case object NewPost extends ReviewReason(1 << 4)

  /** Closed forum topics aren't bumped, so no one might notice the new reply — review needed. */
  case object NoBumpPost extends ReviewReason(1 << 5)

  case object Edit extends ReviewReason(1 << 6)

  /** Edited long after creation — perhaps user added spam links, hopes no one will notice? */
  case object LateEdit extends ReviewReason(1 << 7)

  case object PostFlagged extends ReviewReason(1 << 8)

  /** If a post gets Unwanted votes or many Bury or Wrong, but few Likes. */
  case object PostUnpopular extends ReviewReason(1 << 9)

  case object PostIsSpam extends ReviewReason(1 << 10)

  case object UserCreated extends ReviewReason(1 << 20, isOnPage = false)
  case object UserNewAvatar extends ReviewReason(1 << 21, isOnPage = false)
  case object UserNameEdited extends ReviewReason(1 << 22, isOnPage = false)
  case object UserAboutTextEdited extends ReviewReason(1 << 23, isOnPage = false)


  def fromLong(value: Long): immutable.Seq[ReviewReason] = {
    TESTS_MISSING // Convert -1 to reasons and check resulting seq length, and convert 0.
    val reasons = ArrayBuffer[ReviewReason]()
    if ((value & IsByThreatUser.toInt) != 0) reasons.append(IsByThreatUser)
    if ((value & IsByNewUser.toInt) != 0) reasons.append(IsByNewUser)
    if ((value & NewPost.toInt) != 0) reasons.append(NewPost)
    if ((value & NoBumpPost.toInt) != 0) reasons.append(NoBumpPost)
    if ((value & Edit.toInt) != 0) reasons.append(Edit)
    if ((value & LateEdit.toInt) != 0) reasons.append(LateEdit)
    if ((value & PostFlagged.toInt) != 0) reasons.append(PostFlagged)
    if ((value & PostUnpopular.toInt) != 0) reasons.append(PostUnpopular)
    if ((value & PostIsSpam.toInt) != 0) reasons.append(PostIsSpam)
    if ((value & UserCreated.toInt) != 0) reasons.append(UserCreated)
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


