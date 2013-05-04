/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package controllers

import com.debiki.v0
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
import BrowserPagePatcher.PostPatchSpec
import v0.{PostActionPayload => PAP}


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

    // Only approved parts of a page are rendered. Therefore, temporarily approve
    // the new post, for now, when rendering it and sending it back to the user.
    var partsWithApproval = pageWithNewPost.parts
    if (approval.isEmpty)
      partsWithApproval += PostActionDto.forTemporaryApprovalOf(postWithId)

    if (pageReq.isAjax) {
      val patchSpec = PostPatchSpec(postWithId.id, wholeThread = true)
      BrowserPagePatcher.jsonForThreadsAndPosts(
        List((partsWithApproval, List(patchSpec))), pageReq)
    }
    else
      _showHtmlResultPage(pageReq, postWithId)
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
