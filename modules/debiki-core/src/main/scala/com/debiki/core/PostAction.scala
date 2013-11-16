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
import Prelude._
import PageParts._
import FlagReason.FlagReason


object PostActionOld {

  // Remove, when all PostActionDtoOld have been replaced with PostActionDto.
  def apply(page: PageParts, action: PostActionDtoOld): PostActionOld = action match {
    case a: PostActionDto[_] => page.getActionById(action.id) getOrDie "DwE20KF58"
    case a: PostActionDtoOld => new PostActionOld(page, a)
  }

}



/** Represents a part of a page (e.g. the title, the body, or a comment — a "Post")
  * or a change to a part of the page (e.g. an edit of a comment — a "Patch").
  * PostAction wraps the PostActionDto instance that created / changed the page part,
  * and adds utility methods.
  */
class PostAction[P](  // [P <: PostActionPayload] causes compilation errors
  page: PageParts,
  val actionDto: PostActionDto[P]) extends PostActionOld(page, actionDto) {

  def postId = actionDto.postId
  def payload: P = actionDto.payload

}


/** A post action that is affected by other actions. For example,
  * a Post is affected by DeletePost, and DeletePost is affected by Undo.
  * However, Undo isn't affected by any other action (an Undo cannot be Undo:ne),
  * and does therefore not implement this trait.
  */
trait PostActionActedUpon {
  self: PostActionOld =>

  protected def actions: List[PostAction[_]] = page.getActionsByTargetId(id)

  protected def findLastAction[P <: PostActionPayload](payload: P): Option[PostAction[P]] =
    actions.find { action =>
      action.payload == payload  // && !action.wasUndone
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



// SmartPageAction[Rating].
/** A virtual Action, that is, an Action plus some utility methods that
 *  look up other stuff in the relevant Debate.
 */
class PostActionOld(val debate: PageParts, val action: PostActionDtoOld) {
  def page = debate // should rename `debate` to `page`
  def id: ActionId = action.id
  def creationDati = action.ctime
  def loginId = action.loginId
  def login: Option[Login] = debate.people.login(action.loginId)
  def login_! : Login = login.getOrElse(runErr(
     "DwE6gG32", s"No login with id `${action.loginId}' for action $id"))
  def identity: Option[Identity] = login.flatMap(l =>
                                    debate.people.identity(l.identityRef.identityId))
  def identity_! : Identity = debate.people.identity_!(login_!.identityRef.identityId)
  def userId = {
    // Temporary (?) debug test: (I just introduced `userId`)
    identity foreach { i => assErrIf(i.userId != action.userId, "DwE43KbX6") }
    action.userId
  }
  def user : Option[User] = debate.people.user(action.userId)
  def user_! : User = debate.people.user_!(action.userId)
  def ip: Option[String] = action.newIp.orElse(login.map(_.ip))
  def ip_! : String = action.newIp.getOrElse(login_!.ip)
  def ipSaltHash: Option[String] = ip.map(saltAndHashIp(_))
  def ipSaltHash_! : String = saltAndHashIp(ip_!)

}



class ApplyPatchAction(page: PageParts, val editApp: EditApp)
  extends PostActionOld(page, editApp) with MaybeApproval {
  def directApproval = editApp.approval
}



class Review(page: PageParts, val review: PostActionDto[PAP.ReviewPost])
  extends PostAction(page, review) with MaybeApproval {

  def directApproval = review.payload.approval
  lazy val target: Post = page.getPost(review.postId) getOrDie "DwE93UX7"

}


// vim: fdm=marker et ts=2 sw=2 fo=tcqwn list

