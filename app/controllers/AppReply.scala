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
import Utils.{OkHtml}


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
    import FormHtml.Reply.{InputNames => Inp}

    if (pageReq.page_!.post(postId) isEmpty)
      throwBadReq("DwEe8HD36", "Cannot reply to post "+ safed(postId) +
         "; it does not exist")

    val text = pageReq.getEmptyAsNone(Inp.Text) getOrElse
      throwBadReq("DwE93k21", "Empty reply")
    val whereOpt = pageReq.getEmptyAsNone(Inp.Where)

    val approval =  // for now
      if (!pageReq.user_!.isAdmin) None
      else Some(Approval.AuthoritativeUser)

    val post = Post(id = "?", parent = postId, ctime = pageReq.ctime,
      loginId = pageReq.loginId_!, newIp = pageReq.newIp, text = text,
      markup = Markup.DefaultForComments.id, tyype = PostType.Text,
      where = whereOpt, approval = approval)

    Debiki.savePageActions(pageReq, post::Nil)
    Utils.renderOrRedirect(pageReq)
  }

}
