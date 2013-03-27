// Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)

package com.debiki.v0

import java.{util => ju}
import collection.{immutable => imm, mutable => mut}
import Prelude._
import PageParts._
import FlagReason.FlagReason
import com.debiki.v0.{PostActionPayload => PAP}


object PostActionOld {

  // Remove, when all PostActionDtoOld have been replaced with PostActionDto.
  def apply(page: PageParts, action: PostActionDtoOld): PostActionOld = action match {
    case a: PostActionDto[_] => page.getActionById(action.id) getOrDie "DwE20KF58"
    case a: PostActionDtoOld => new PostActionOld(page, a)
  }

}



class PostAction[P](  // [P <: PostActionPayload] causes compilation errors
  page: PageParts,
  val actionDto: PostActionDto[P]) extends PostActionOld(page, actionDto) {

  def postId = actionDto.postId
  def payload: P = actionDto.payload
}



trait MaybeApproval {

  /** If defined, this action implicitly approves the related post.
    *
    * For example, if an admin edits a post, then `edit.approval`
    * might be set to Approval.AuthoritativeUser, and `edit.isApplied`
    * would be set to true, and then the new version of the edited post
    * has "automatically" been approved.
    */
  def approval: Option[Approval]

}



// SmartPageAction[Rating].
/** A virtual Action, that is, an Action plus some utility methods that
 *  look up other stuff in the relevant Debate.
 */
class PostActionOld(val debate: PageParts, val action: PostActionDtoOld) {
  def page = debate // should rename `debate` to `page`
  def id: String = action.id
  def creationDati = action.ctime
  def loginId = action.loginId
  def login: Option[Login] = debate.people.login(action.loginId)
  def login_! : Login = login.getOrElse(runErr(
     "DwE6gG32", "No login with id "+ safed(action.loginId) +
     " for action "+ safed(id)))
  def identity: Option[Identity] = login.flatMap(l =>
                                    debate.people.identity(l.identityId))
  def identity_! : Identity = debate.people.identity_!(login_!.identityId)
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

  def isTreeDeleted = {
    // In case there are > 1 deletions, consider the first one only.
    // (Once an action has been deleted, it isn't really possible to
    // delete it again in some other manner? However non transactional
    // (nosql) databases might return many deletions? and we should
    // care only about the first.)
    firstDelete.map(_.wholeTree) == Some(true)
  }

  def isDeleted = deletions nonEmpty

  // COULD optimize this, do once for all posts, store in map.
  lazy val deletions = debate.deletions.filter(_.postId == action.id)

  /** Deletions, the most recent first. */
  lazy val deletionsDescTime = deletions.sortBy(- _.ctime.getTime)

  lazy val lastDelete = deletionsDescTime.headOption
  lazy val firstDelete = deletionsDescTime.lastOption

  def deletionDati: Option[ju.Date] = firstDelete.map(_.ctime)
}



class ApplyPatchAction(page: PageParts, val editApp: EditApp)
  extends PostActionOld(page, editApp) with MaybeApproval {
  def approval = editApp.approval
}



class Review(page: PageParts, val review: ReviewPostAction)
  extends PostActionOld(page, review) with MaybeApproval {

  def approval = review.approval
  lazy val target: Post = page.getPost(review.postId) getOrDie "DwE93UX7"

}


// vim: fdm=marker et ts=2 sw=2 fo=tcqwn list

