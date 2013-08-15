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
import com.debiki.core
import com.debiki.core._
import com.debiki.core.{PostActionPayload => PAP}
import controllers.Utils.OkSafeJson
import debiki._
import debiki.DebikiHttp._
import play.api._
import play.api.data._
import play.api.data.Forms._
import play.api.mvc.{Action => _, _}
import Prelude._
import Utils.{OkHtml, OkHtmlBody}
import BrowserPagePatcher.PostPatchSpec


object AppReply extends mvc.Controller {


  def showForm(pathIn: PagePath, postId: ActionId) = PageGetAction(pathIn) {
      pageReq: PageGetRequest =>

    val replyForm: xml.NodeSeq =
      Utils.formHtml(pageReq).replyForm(replyToPostId = postId, text = "")

    OkHtml(replyForm)
  }


  def handleForm(pathIn: PagePath, postId: ActionId)
        = PagePostAction(MaxPostSize)(pathIn) {
      pageReqNoMeOnPage: PagePostRequest =>

    import Utils.ValidationImplicits._
    import HtmlForms.Reply.{InputNames => Inp}

    val pageReq = pageReqNoMeOnPage.copyWithMeOnPage_!
    if (pageReq.oldPageVersion.isDefined)
      throwBadReq("DwE72XS8", "Can only reply to latest page version")

    if (pageReq.page_!.getPost(postId) isEmpty)
      throwBadReq("DwEe8HD36", s"Cannot reply to post `$postId'; it does not exist")

    val text = pageReq.getEmptyAsNone(Inp.Text) getOrElse
      throwBadReq("DwE93k21", "Empty reply")
    val whereOpt = pageReq.getEmptyAsNone(Inp.Where)

    val approval = AutoApprover.perhapsApprove(pageReq)

    val postNoId = PostActionDto(id = PageParts.UnassignedId, postId = PageParts.UnassignedId,
      creationDati = pageReq.ctime, loginId = pageReq.loginId_!, userId = pageReq.user_!.id,
      newIp = pageReq.newIp, payload = PAP.CreatePost(
        parentPostId = postId, text = text, markup = Markup.DefaultForComments.id,
        where = whereOpt, approval = approval))

    val (pageWithNewPost, List(postWithId: PostActionDto[PAP.CreatePost])) =
      pageReq.dao.savePageActionsGenNotfs(pageReq, postNoId::Nil)

    if (pageReq.isAjax) {
      val patchSpec = PostPatchSpec(postWithId.id, wholeThread = true)
      OkSafeJson(
        BrowserPagePatcher(pageReq).jsonForThreadsAndPosts(pageWithNewPost.parts, patchSpec))
    }
    else {
      _showHtmlResultPage(pageReq, postWithId)
    }
  }


  private def _showHtmlResultPage(
        pageReq: PageRequest[_], post: PostActionDto[PAP.CreatePost]): PlainResult = {
    val nextPageUrl =
      Utils.queryStringAndHashToView(pageReq.pageRoot, pageReq.oldPageVersion,
         post.payload.approval.map(_ => post.id),
         // Write a '?' even if query string is empty, so '?reply' is removed.
         forceQuery = true)
    OkHtmlBody(
      if (post.payload.approval.isDefined)
        <p>Comment saved.</p>
        <p><a href={nextPageUrl}>Okay, let me view it</a></p>
      else
        <p>Comment awaiting moderation.</p>
        <p><a href={nextPageUrl}>Okay, return to page</a></p>)
  }

}
