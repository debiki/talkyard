/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package controllers

import com.debiki.v0._
import debiki._
import debiki.DebikiHttp._
import play.api._
import play.api.data._
import play.api.data.Forms._
import play.api.mvc.{Action => _, _}
import PageActions._
import Prelude._
import Utils.{OkHtml, OkHtmlBody}


object AppReply extends mvc.Controller {


  def showForm(pathIn: PagePath, postId: String) = PageGetAction(pathIn) {
      pageReq: PageGetRequest =>

    val replyForm: xml.NodeSeq =
      Utils.formHtml(pageReq).replyForm(replyToPostId = postId, text = "")

    OkHtml(replyForm)
  }


  def handleForm(pathIn: PagePath, postId: String)
        = PagePostAction(MaxPostSize)(pathIn) {
      pageReq: PagePostRequest =>

    import Utils.ValidationImplicits._
    import HtmlForms.Reply.{InputNames => Inp}

    if (!pageReq.pageVersion.isLatest)
      throwBadReq("DwE72XS8", "Can only reply to latest page version")

    if (pageReq.page_!.post(postId) isEmpty)
      throwBadReq("DwEe8HD36", "Cannot reply to post "+ safed(postId) +
         "; it does not exist")

    val text = pageReq.getEmptyAsNone(Inp.Text) getOrElse
      throwBadReq("DwE93k21", "Empty reply")
    val whereOpt = pageReq.getEmptyAsNone(Inp.Where)

    val approval =  // for now
      if (!pageReq.user_!.isAdmin) None
      else Some(Approval.AuthoritativeUser)

    val postNoId = Post(id = "?", parent = postId, ctime = pageReq.ctime,
      loginId = pageReq.loginId_!, newIp = pageReq.newIp, text = text,
      markup = Markup.DefaultForComments.id, tyype = PostType.Text,
      where = whereOpt, approval = approval)

    val List(postWithId: Post) = Debiki.savePageActions(pageReq, postNoId::Nil)

    if (pageReq.isAjax)
      //BrowserPagePatcher.jsonFor(pageReq.page_!, newPosts = post::Nil)
      Utils.renderOrRedirect(pageReq)
    else
      _showHtmlResultPage(pageReq, postWithId)
  }


  private def _showHtmlResultPage(pageReq: PageRequest[_], post: Post)
        : PlainResult = {
    val nextPageUrl =
      Utils.queryStringAndHashToView(pageReq.pageRoot, pageReq.pageVersion,
         post.approval.map(_ => post.id),
         // Write a '?' even if query string is empty, so '?reply' is removed.
         forceQuery = true)
    OkHtmlBody(
      if (post.approval.isDefined)
        <p>Comment saved.</p>
        <p><a href={nextPageUrl}>Okay, let me view it</a></p>
      else
        <p>Comment awaiting moderation.</p>
        <p><a href={nextPageUrl}>Okay, return to page</a></p>)
  }

}
