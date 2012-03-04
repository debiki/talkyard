/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package controllers

import com.debiki.v0._
import debiki._
import debiki.DebikiHttp._
import java.{util => ju}
import play.api._
import play.api.data._
import play.api.data.Forms._
import play.api.mvc.{Action => _, _}
import Actions._
import Prelude._

object AppReply extends mvc.Controller {


  def showForm(pathIn: PagePath, pageRoot: PageRoot, postId: String)
        = PageGetAction(pathIn) {
      pageReq: PageGetRequest =>

    val replyForm: xml.NodeSeq =
      Utils.formHtml(pageReq, pageRoot).replyForm(
        replyToPostId = postId, text = "")

    Ok(replyForm) as HTML
  }


  def handleForm(pathIn: PagePath, pageRoot: PageRoot, postId: String)
        = PagePostAction(maxUrlEncFormBytes = 10 * 1000)(pathIn) {
      pageReq: PagePostRequest =>

    val replyForm = Form(tuple(
      FormHtml.Reply.InputNames.Text -> nonEmptyText,
      FormHtml.Reply.InputNames.Where -> optional(text)))
    replyForm.bindFromRequest()(pageReq.request).fold(
      error => {
        Logger.debug("Bad request: " + error.toString)//COULD: debugThrowBadReq
        DebikiHttp.BadReqResult("DwE94k39", error.toString)
      }, {
        case (text, whereOpt) =>
          val newIp = None // for now

          var posts = Post(id = "?", parent = postId, ctime = new ju.Date,
            loginId = pageReq.loginId_!, newIp = newIp, text = text,
            markup = Markup.DefaultForComments.id, tyype = PostType.Text,
            where = whereOpt) :: Nil

          //_ TODO check that post.parent does exist!
          // COULD check for e.g. an identical post (same *text*
          // (and whereOpt) ?)

          Debiki.savePageActions(pageReq, posts)
    })

    Utils.renderOrRedirect(pageReq, pageRoot)
  }

}
