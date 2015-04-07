/**
 * Copyright (C) 2012-2013 Kaj Magnus Lindberg (born 1979)
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

import java.{util => ju}
import collection.{immutable => imm, mutable => mut}
import com.debiki.core.{PostActionPayload => PAP}
import scala.reflect.ClassTag
import Prelude._
import PageParts._
import FlagType.FlagType


sealed abstract class PostVoteType
object PostVoteType {
  case object Like extends PostVoteType
  case object Wrong extends PostVoteType
  //case object Rude extends PostVoteType
  //case object Boring extends PostVoteType
}


case class PostVote(
  pageId: PageId,
  postId: PostId,
  voterId: UserId2,
  voteType: PostVoteType)


/** Represents a part of a page (e.g. the title, the body, or a comment — a "Post")
  * or a change to a part of the page (e.g. an edit of a comment — a "Patch").
  * PostAction wraps the RawPostAction instance that created / changed the page part,
  * and adds utility methods.
  */
class PostAction[P](  // [P <: PostActionPayload] causes compilation errors
  val page: PageParts,
  val rawAction: RawPostAction[P]) {

  def postId = rawAction.postId
  def payload: P = rawAction.payload

  @deprecated("use page instead", "now")
  def debate = page

  def id: ActionId = rawAction.id

  def creationDati = rawAction.ctime

  def userIdData = rawAction.userIdData
  def userId = userIdData.userId
  def user : Option[User] = page.people.user(userIdData.userId)
  def user_! : User = user.getOrDie("DwE3905FU0", s"No user for action `$id', page `${page.id}'")
  def theUser = user_!


  def ip: String = userIdData.ip
  def ipSaltHash: String = saltAndHashIp(ip)

  def pagePostId = PagePostId(page.id, postId)
}


/** A post action that is affected by other actions. For example,
  * a Post is affected by DeletePost, and DeletePost is affected by Undo.
  * However, Undo isn't affected by any other action (an Undo cannot be Undo:ne),
  * and does therefore not implement this trait.
  */
trait PostActionActedUpon {
  self: PostAction[_] =>

  protected def actions: List[PostAction[_]] = self.page.getActionsByTargetId(id)


  protected def findLastAction[P <: PostActionPayload](payload: P): Option[PostAction[P]] =
    actions.find { action =>
      action.payload == payload  // && !action.isDeleted
    }.asInstanceOf[Option[PostAction[P]]]


  protected def findLastActionByType[P <: PostActionPayload](implicit classTag: ClassTag[P])
        : Option[PostAction[P]] =
    actions.find { action =>
      if (classTag.runtimeClass.isInstance(action.payload))
        true
      else
        false
    }.asInstanceOf[Option[PostAction[P]]]

}



trait MaybeApproval {

  /** If defined, this action implicitly approves the related post.
    *
    * For example, if an admin edits a post, then `edit.approval`
    * might be set to Approval.AuthoritativeUser, and `edit.isApplied`
    * would be set to true, and then the new version of the edited post
    * has automatically been approved, directly on creation.
    * Sometimes a Post isn't approved until later, via a Review.
    * Then Post.directApproval is None and Post.lastApproval is Some(...).
    */
  def directApproval: Option[Approval]

}



class ApplyPatchAction(page: PageParts, val editApp: PostAction[PAP.EditApp])
  extends PostAction(page, editApp.rawAction) with MaybeApproval {
  def directApproval = editApp.payload.approval
}



class ApprovePostAction(page: PageParts, val rawApproval: RawPostAction[PAP.ApprovePost])
  extends PostAction(page, rawApproval) with MaybeApproval {

  def directApproval = Some(rawApproval.payload.approval)
  lazy val target: Post = page.getPost(rawApproval.postId) getOrDie "DwE93UX7"

}


class RejectEditsAction(page: PageParts, val rawRejection: RawPostAction[PAP.RejectEdits])
  extends PostAction(page, rawRejection) with MaybeApproval {

  def directApproval = None
  lazy val target: Post = page.getPost(rawRejection.postId) getOrDie "DwE1dUI8"

}

// vim: fdm=marker et ts=2 sw=2 fo=tcqwn list

