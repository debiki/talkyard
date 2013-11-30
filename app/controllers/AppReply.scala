/**
 * Copyright (C) 2012 Kaj Magnus Lindberg (born 1979)
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

package controllers

import actions.PageActions._
import com.debiki.core._
import com.debiki.core.Prelude._
import com.debiki.core.{PostActionPayload => PAP}
import controllers.Utils.OkSafeJson
import debiki._
import debiki.DebikiHttp._
import play.api._
import play.api.data._
import play.api.data.Forms._
import play.api.mvc.{Action => _, _}
import requests.PageRequest
import Utils.{OkHtml, OkHtmlBody}
import BrowserPagePatcher.TreePatchSpec


/** Handles reply form submissions.
  */
object AppReply extends mvc.Controller {


  def handleForm(pathIn: PagePath, postId: ActionId)
        = PagePostAction(MaxPostSize)(pathIn) {
      pageReq: PagePostRequest =>

    import Utils.ValidationImplicits._

    val text = pageReq.getEmptyAsNone("dw-fi-reply-text") getOrElse
      throwBadReq("DwE93k21", "Empty reply")
    val whereOpt = pageReq.getEmptyAsNone("dw-fi-reply-where")

    val json = saveReply(pageReq, replyTo = postId, text, whereOpt)
    OkSafeJson(json)
  }


  def saveReply(pageReqNoMeOnPage: PageRequest[_], replyTo: PostId, text: String,
        whereOpt: Option[String] = None) = {

    val postIdToReplyTo = replyTo

    val pageReq = pageReqNoMeOnPage.copyWithMeOnPage_!
    if (pageReq.oldPageVersion.isDefined)
      throwBadReq("DwE72XS8", "Can only reply to latest page version")

    if (pageReq.page_!.getPost(postIdToReplyTo) isEmpty)
      throwBadReq("DwEe8HD36", s"Cannot reply to post `$postIdToReplyTo'; it does not exist")

    val approval = AutoApprover.perhapsApprove(pageReq)

    val postNoId = PostActionDto(id = PageParts.UnassignedId, postId = PageParts.UnassignedId,
      creationDati = pageReq.ctime, loginId = pageReq.loginId_!, userId = pageReq.user_!.id,
      newIp = pageReq.newIp, payload = PAP.CreatePost(
        parentPostId = postIdToReplyTo, text = text, markup = Markup.DefaultForComments.id,
        where = whereOpt, approval = approval))

    val (pageWithNewPost, List(postWithId: PostActionDto[PAP.CreatePost])) =
      pageReq.dao.savePageActionsGenNotfs(pageReq, postNoId::Nil)

    val patchSpec = TreePatchSpec(postWithId.id, wholeTree = true)
    BrowserPagePatcher(pageReq).jsonForTrees(pageWithNewPost.parts, patchSpec)
  }

}
