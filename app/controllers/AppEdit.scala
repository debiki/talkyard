/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package controllers

import com.debiki.v0._
import debiki._
import debiki.DebikiHttp._
import java.{util => ju}
import net.liftweb.common.{Box, Full, Empty, Failure}
import play.api._
import play.api.data._
import play.api.data.Forms._
import play.api.mvc.{Action => _, _}
import Actions._
import Prelude._

object AppEdit extends mvc.Controller {


  def showEditForm(pathIn: PagePath, pageRoot: PageRoot, postId: String)
        = PageGetAction(pathIn) {
      pageReq: PageGetRequest =>

    val (vipo, lazyCreateOpt) = _getOrCreatePostToEdit(pageReq.page_!, postId)
    val draftText = vipo.text  // in the future, load user's draft from db.
    val editForm = Utils.formHtml(pageReq, pageRoot).editForm(
      vipo, newText = draftText,
      userName = pageReq.sid.displayName)
    Ok(editForm) as HTML
  }


  def handleEditForm(pathIn: PagePath, pageRoot: PageRoot, postId: String)
        = PagePostAction(maxUrlEncFormBytes = 10 * 1000)(pathIn) {
      pageReq: PagePostRequest =>

    val editForm = Form(tuple(
      FormHtml.Edit.InputNames.Text -> nonEmptyText,
      FormHtml.Edit.InputNames.Markup -> optional(text)))

    editForm.bindFromRequest()(pageReq.request).fold(
      error => {
        Logger.debug("Bad request: " + error.toString)//COULD: debugThrowBadReq
        DebikiHttp.BadReqResult("DwE03k4", error.toString)
      }, {
        case (text, newMarkupOpt) =>
          _saveEdits(pageReq, pageReq.page_!, postId, text, newMarkupOpt)
      })

    Utils.renderOrRedirect(pageReq, pageRoot)
  }


  private def _saveEdits(pageReq: PagePostRequest, page: Debate,
        postId: String, newText: String, newMarkupOpt: Option[String]) {

    val (post, lazyCreateOpt) = _getOrCreatePostToEdit(page, postId)
    val markupChanged =
      newMarkupOpt.isDefined && newMarkupOpt != Some(post.markup)
    if (newText == post.text && !markupChanged)
      return  // need do nothing

    // Don't allow any kind of html in replies.
    //if (markupChanged && pid != Page.BodyId && !Markup.isPlain(newMarkup))
    // reply forbidden
    // (and also when *creating* a post)

    val now = new ju.Date
    val newIp = None // for now
    val patchText = makePatch(from = post.text, to = newText)
    val loginId = pageReq.loginId_!
    var actions = List[Action](Edit(
      id = "?x", postId = post.id, ctime = now,
      loginId = loginId, newIp = newIp,
      text = patchText, newMarkup = newMarkupOpt))

    var (mayEdit, mayEditReason) =
      _mayEdit(pageReq.user, post, pageReq.permsOnPage)
    if (mayEdit) {
      // For now, auto-apply the edit. Voting of which edits to apply
      // or disregard not yet implemented (or rather implemented but
      // disabled for now).
      actions ::= EditApp(id = "?", editId = "?x", ctime = now,
        loginId = loginId, newIp = newIp, result = newText)
    } else {
      // Store the edit suggestion in the database, unapplied.
      // (Together with any automatically created empty title or template.)
    }

    // Reverse, or foreign keys might be violated.
    actions = actions.reverse
    actions :::= lazyCreateOpt.toList

    // ------- COULD use Debiki.savePageActions(...) instead
    val actionsWithIds = Debiki.Dao.savePageActions(
      pageReq.tenantId, page.guid, actions)

    if (mayEdit)
      Debiki.PageCache.refreshLater(pageReq)
    // -------
  }


  /**
   * Returns (true/false, reason) if the user may/not edit `vipo'.
   */
  private def _mayEdit(user: Option[User], post: ViPo,
        perms: PermsOnPage): (Boolean, String) = {

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


  private def _getOrCreatePostToEdit(page: Debate, postId: String)
        : (ViPo, Option[Post]) = {

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
        val newIp = None // for now

        // (A page title and template (and body) is its own parent.)
        Some(Post(id = postId, parent = postId, ctime = new ju.Date,
          loginId = pageAuthorLoginId, newIp = newIp, text = "",
          markup = markup.id, tyype = PostType.Text,
          where = None))
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

