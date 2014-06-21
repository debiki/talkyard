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
import FlagType.FlagType


/** Actions builds up a page: a page consists of various posts,
  * e.g. the title post, the body post, and comments posted, and actions
  * that edit and affect these posts. (This is the action, a.k.a. command,
  * design pattern.)
  *
  * RawPostAction is used by DbDao (database data-access-object), when saving and loading pages.
  * If you want some more functionality, use the PostAction:s Post and Patch instead.
  * (That's what you almost have to do anyway because that's what
  * Debate(/PageParts/whatever) gives you.)
  *
  * @param id A local id, unique per page. "?" means unknown (used when
  * creating new posts).
  * @param payload What this action does. For example, creates a new post,
  * edits a post, flags it, closes a thread, etcetera.
  */
case class RawPostAction[P](   // caused weird compilation errors:  [P <: PostActionPayload](
  id: ActionId,
  creationDati: ju.Date,
  payload: P,
  postId: ActionId,
  userIdData: UserIdData,
  deletedAt: Option[ju.Date] = None,
  deletedById: Option[UserId] = None) {

  require(id != PageParts.NoId)
  require(payload.isInstanceOf[PAP]) // for now, until above template constraint works
  require(deletedAt.isDefined == deletedById.isDefined, "DwE806FW1")

  def ctime = creationDati

  def loginId = userIdData.loginId
  def userId = userIdData.userId
  def ip = userIdData.ip

  def anyGuestId = userIdData.anyGuestId
  def anyRoleId = userIdData.anyRoleId

  def browserFingerprint = userIdData.browserFingerprint
  def browserIdCookie = userIdData.browserIdCookie

  def textLengthUtf8: Int = payload.asInstanceOf[PAP].textLengthUtf8

  def isDeleted = deletedAt.nonEmpty
}



object RawPostAction {

  def forNewPost(
      id: ActionId,
      creationDati: ju.Date,
      userIdData: UserIdData,
      parentPostId: Option[ActionId],
      text: String,
      markup: String,
      approval: Option[Approval],
      where: Option[String] = None) = {
    if (Some(id) == parentPostId)
      assErr("DwE23GFf0")

    RawPostAction(
      id, creationDati, postId = id, userIdData = userIdData,
      payload = PAP.CreatePost(
        parentPostId = parentPostId, text = text,
        markup = markup, approval = approval, where = where))
  }


  def forNewTitleBySystem(text: String, creationDati: ju.Date) =
    forNewTitle(text, creationDati, userIdData = SystemUser.UserIdData,
      approval = Some(Approval.AuthoritativeUser))


  def forNewPageBodyBySystem(text: String, creationDati: ju.Date, pageRole: PageRole) =
    forNewPageBody(text, creationDati, pageRole, userIdData = SystemUser.UserIdData,
      approval = Some(Approval.AuthoritativeUser))


  def forNewTitle(text: String, creationDati: ju.Date,
               userIdData: UserIdData, approval: Option[Approval]) =
    forNewPost(PageParts.TitleId, creationDati, userIdData = SystemUser.UserIdData,
      parentPostId = None, text = text,
      markup = Markup.DefaultForPageTitle.id, approval = approval)


  def forNewPageBody(text: String, creationDati: ju.Date, pageRole: PageRole,
                  userIdData: UserIdData, approval: Option[Approval]) =
    forNewPost(PageParts.BodyId, creationDati, userIdData = userIdData,
      parentPostId = None, text = text,
      markup = Markup.defaultForPageBody(pageRole).id, approval = approval)


  def copyCreatePost(
        old: RawPostAction[PAP.CreatePost],
        id: ActionId = PageParts.NoId,
        creationDati: ju.Date = null,
        loginId: String = null,
        userId: String = null,
        ip: String = null,
        parentPostId: Option[PostId] = null,
        text: String = null,
        markup: String = null,
        approval: Option[Approval] = null): RawPostAction[PAP.CreatePost] = {
    val theCopy = RawPostAction(
      id = if (id != PageParts.NoId) id else old.id,
      postId = if (id != PageParts.NoId) id else old.id, // same as id
      creationDati =  if (creationDati ne null) creationDati else old.creationDati,
      userIdData = UserIdData(
        loginId = if (loginId ne null) Some(loginId) else old.userIdData.loginId,
        userId = if (userId ne null) userId else old.userIdData.userId,
        ip = if (ip ne null) ip else old.userIdData.ip,
        browserIdCookie = old.userIdData.browserIdCookie,
        browserFingerprint = old.userIdData.browserFingerprint),
      payload = PAP.CreatePost(
        parentPostId = if (parentPostId ne null) parentPostId else old.payload.parentPostId,
        text = if (text ne null) text else old.payload.text,
        markup = if (markup ne null) markup else old.payload.markup,
        approval = if (approval ne null) approval else old.payload.approval))

    if (Some(theCopy.id) == theCopy.payload.parentPostId)
      assErr("DwE65DK2")

    theCopy
  }


  def toEditPost(
        id: ActionId, postId: ActionId, ctime: ju.Date,
        userIdData: UserIdData,
        text: String, autoApplied: Boolean, approval: Option[Approval],
        newMarkup: Option[String] = None) =
    RawPostAction(
      id, ctime, postId = postId, userIdData = userIdData,
      payload = PAP.EditPost(
        text = text, newMarkup = newMarkup, autoApplied = autoApplied, approval = approval))


  def copyEditPost(
        old: RawPostAction[PAP.EditPost],
        id: ActionId = PageParts.NoId,
        postId: ActionId = PageParts.NoId,
        createdAt: ju.Date = null,
        loginId: String = null,
        userId: String = null,
        ip: String = null,
        text: String = null,
        autoApplied: Option[Boolean] = None,
        approval: Option[Approval] = null,
        newMarkup: Option[String] = null) =
    RawPostAction(
      id = if (id != PageParts.NoId) id else old.id,
      postId = if (postId != PageParts.NoId) postId else old.postId,
      creationDati =  if (createdAt ne null) createdAt else old.creationDati,
      userIdData = UserIdData(
        loginId = if (loginId ne null) Some(loginId) else old.userIdData.loginId,
        userId = if (userId ne null) userId else old.userIdData.userId,
        ip = if (ip ne null) ip else old.userIdData.ip,
        browserIdCookie = old.userIdData.browserIdCookie,
        browserFingerprint = old.userIdData.browserFingerprint),
      payload = PAP.EditPost(
        text = if (text ne null) text else old.payload.text,
        newMarkup = if (newMarkup ne null) newMarkup else old.payload.newMarkup,
        autoApplied = if (autoApplied.isDefined) autoApplied.get else old.payload.autoApplied,
        approval = if (approval ne null) approval else old.payload.approval))


  def copyApplyEdit(
        old: RawPostAction[PAP.EditApp],
        id: ActionId = PageParts.NoId,
        postId: ActionId = PageParts.NoId,
        createdAt: ju.Date = null,
        loginId: String = null,
        userId: String = null,
        ip: String = null,
        editId: ActionId = PageParts.NoId,
        approval: Option[Approval] = null) =
    RawPostAction(
      id = if (id != PageParts.NoId) id else old.id,
      postId = if (postId != PageParts.NoId) postId else old.postId,
      creationDati =  if (createdAt ne null) createdAt else old.creationDati,
      userIdData = UserIdData(
        loginId = if (loginId ne null) Some(loginId) else old.userIdData.loginId,
        userId = if (userId ne null) userId else old.userIdData.userId,
        ip = if (ip ne null) ip else old.userIdData.ip,
        browserIdCookie = old.userIdData.browserIdCookie,
        browserFingerprint = old.userIdData.browserFingerprint),
      payload = PAP.EditApp(
        editId = if (editId != PageParts.NoId) editId else old.payload.editId,
        approval = if (approval ne null) approval else old.payload.approval))


  def toApprovePost(
        id: ActionId,
        postId: ActionId,
        userIdData: UserIdData,
        ctime: ju.Date,
        approval: Approval): RawPostAction[PAP.ApprovePost] =
    RawPostAction(
      id, creationDati = ctime, postId = postId, userIdData = userIdData,
      payload = PAP.ApprovePost(approval))


  def copyApprovePost(
        old: RawPostAction[PAP.ApprovePost],
        id: ActionId = PageParts.NoId,
        postId: ActionId = PageParts.NoId,
        loginId: String = null,
        userId: String = null,
        createdAt: ju.Date = null,
        ip: String = null,
        approval: Approval = null): RawPostAction[PAP.ApprovePost] =
    RawPostAction(
      id = if (id != PageParts.NoId) id else old.id,
      creationDati = if (createdAt ne null) createdAt else old.creationDati,
      postId = if (postId != PageParts.NoId) postId else old.postId,
      userIdData = UserIdData(
        loginId = if (loginId ne null) Some(loginId) else old.userIdData.loginId,
        userId = if (userId ne null) userId else old.userIdData.userId,
        ip = if (ip ne null) ip else old.userIdData.ip,
        browserIdCookie = old.userIdData.browserIdCookie,
        browserFingerprint = old.userIdData.browserFingerprint),
      payload = if (approval ne null) PAP.ApprovePost(approval) else old.payload)


  def toRejectEdits(
    id: ActionId,
    postId: ActionId,
    userIdData: UserIdData,
    createdAt: ju.Date,
    deleteEdits: Boolean): RawPostAction[PAP.RejectEdits] =
      RawPostAction(
        id, creationDati = createdAt, postId = postId, userIdData = userIdData,
        payload = PAP.RejectEdits(deleteEdits))


  def toDeletePost(
        andReplies: Boolean,
        id: ActionId,
        postIdToDelete: ActionId,
        userIdData: UserIdData,
        createdAt: ju.Date) =
    RawPostAction(
      id, creationDati = createdAt, postId = postIdToDelete, userIdData = userIdData,
      payload = if (andReplies) PAP.DeleteTree else PAP.DeletePost(clearFlags = false))

}

