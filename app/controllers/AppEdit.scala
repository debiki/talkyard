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


object AppEdit extends mvc.Controller {


  def showEditForm(pathIn: PagePath, postId: String)
        = PageGetAction(pathIn) {
      pageReq: PageGetRequest =>

    val (vipo, lazyCreateOpt) = _getOrCreatePostToEdit(pageReq, postId)
    val draftText = vipo.text  // in the future, load user's draft from db.
    val editForm = Utils.formHtml(pageReq).editForm(
      vipo, newText = draftText,
      userName = pageReq.sid.displayName)
    OkHtml(editForm)
  }


  def handleEditForm(pathIn: PagePath, postId: String)
        = PagePostAction(MaxPostSize)(pathIn) {
      pageReq: PagePostRequest =>

    import Utils.ValidationImplicits._
    import HtmlForms.Edit.{InputNames => Inp}

    val text = pageReq.getEmptyAsNone(Inp.Text) getOrElse
       throwBadReq("DwE8bJX2", "Empty edit")
    val markupOpt = pageReq.getEmptyAsNone(Inp.Markup)

    // Too must data?
    val postSize = text.size
    val user = pageReq.user_!
    if (user.isAdmin) {
      // Allow up to MaxPostSize chars (see above).
    }
    else if (user.isAuthenticated) {
      if (postSize > MaxPostSizeForAuUsers)
        throwEntityTooLarge("DwE413kX5", "Please do not upload that much text")
    }
    else {
      if (postSize > MaxPostSizeForUnauUsers)
        throwEntityTooLarge("DwE413IJ1", "Please do not upload that much text")
    }

    _saveEdits(pageReq, postId, text, markupOpt)
    Utils.renderOrRedirect(pageReq)
  }


  private def _saveEdits(pageReq: PagePostRequest,
        postId: String, newText: String, newMarkupOpt: Option[String]) {

    val (post, lazyCreateOpt) = _getOrCreatePostToEdit(pageReq, postId)
    val markupChanged =
      newMarkupOpt.isDefined && newMarkupOpt != Some(post.markup)
    if (newText == post.text && !markupChanged)
      return  // need do nothing

    // Don't allow any kind of html in replies.
    //if (markupChanged && pid != Page.BodyId && !Markup.isPlain(newMarkup))
    // reply forbidden
    // (and also when *creating* a post)

    val patchText = makePatch(from = post.text, to = newText)
    val loginId = pageReq.loginId_!

    val (mayEdit, mayEditReason) =
      AppEdit.mayEdit(pageReq.user, post, pageReq.permsOnPage)

    // For now:
    val approval =
      if (mayEdit && pageReq.user_!.isAdmin)
        Some(Approval.AuthoritativeUser)
      else None

    var edit = Edit(
      id = "?x", postId = post.id, ctime = pageReq.ctime,
      loginId = loginId, newIp = pageReq.newIp,
      text = patchText, newMarkup = newMarkupOpt,
      approval = approval, autoApplied = mayEdit)

    var actions = lazyCreateOpt.toList ::: edit :: Nil

    Debiki.savePageActions(pageReq, actions)
  }


  /**
   * Returns (true/false, reason) if the user may/not edit `vipo'.
   */
  def mayEdit(user: Option[User], post: ViPo, perms: PermsOnPage)
        : (Boolean, String) = {

    def isOwnPost = user.map(_.id) == Some(post.identity_!.userId)
    def isPage = post.id == Page.BodyId || post.id == Page.TitleId

    if (post.id == Page.TemplateId && !perms.editPageTemplate)
      (false, "May not edit page template")
    else if (isOwnPost)
      (true, "May edit own post")
    else if (perms.editAnyReply && !isPage)
      (true, "May edit any reply")
    else if (perms.editPage && isPage)
      (true, "May edit root post")
    else
      (false, "")
  }


  private def _getOrCreatePostToEdit(pageReq: PageRequest[_], postId: String)
        : (ViPo, Option[Post]) = {

    val page = pageReq.page_!
    val vipoOpt: Option[ViPo] = page.vipo(postId)

    // The page title and template are created automatically
    // if they don't exist, when they are to be edited.
    // Their author is considered to be the author of the page body.
    val lazyCreateOpt: Option[Post] = {
      // Usually, the post-to-be-edited already exists.
      if (vipoOpt isDefined) {
        None
      }
      // Create a title or template, automatically.
      else if (postId == Page.TitleId || postId == Page.TemplateId) {
        val pageAuthorLoginId = page.body_!.post.loginId
        val markup =
          if (postId == Page.TemplateId) Markup.Code
          else Markup.Html

        // 1. (A page title and template (and body) is its own parent.
        // Dupl knowledge! see AppCreatePage.handleForm.)
        // 2. The post will be auto approved implicitly, if the Edit is
        // auto approved.
        Some(Post(id = postId, parent = postId, ctime = pageReq.ctime,
          loginId = pageAuthorLoginId, newIp = pageReq.newIp, text = "",
          markup = markup.id, tyype = PostType.Text,
          where = None, approval = None))
      }
      // Most post are not created automatically (instead error is returned).
      else {
        None
      }
    }

    val vipo = vipoOpt.getOrElse(
      lazyCreateOpt.map(new ViPo(page, _)).getOrElse {
        throwNotFound("DwE3k2190", "Post not found: "+ safed(postId))
      })

    (vipo, lazyCreateOpt)
  }

}

