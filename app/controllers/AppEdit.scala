/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package controllers

import com.debiki.v0._
import debiki._
import debiki.DebikiHttp._
import play.api._
import libs.json.JsValue
import play.api.data._
import play.api.data.Forms._
import play.api.mvc.{Action => _, _}
import scala.collection.{mutable => mut}
import PageActions._
import ApiActions._
import Prelude._
import Utils.{OkHtml}


/**
 * SECURITY BUG I think it's possible to use edit GET/POST requests
 * to access and *read* hidden pages. I don't think I do any access control
 * when sending the current markup source back to the browser? Only when
 * actually saving something ...?
 *  -- I'm doing it *sometimes* when loading PermsOnPage via
 *  PageActions.PageReqAction?
 */
object AppEdit extends mvc.Controller {


  def showEditForm(pathIn: PagePath, postId: String)
        = PageGetAction(pathIn) {
      pageReq: PageGetRequest =>
    _showEditFormImpl(pageReq, postId)
  }


  // In case the page has been moved since it was cached, or rendered
  // in the browser, the posted page path might be incorrect. If so,
  // simply fix it. (The path is only useful if the page doesn't yet exist,
  // so we know where to create it.)
  private def yesFixPath = true


  def showEditFormAnyPage(pageId: String, pagePath: String, postId: String)
        = GetAction { request =>

    val pageReqPerhapsNoPage =
      PageRequest(request, pagePathStr = pagePath, pageId = pageId,
        fixBadPath = yesFixPath)

    val pageReq =
      if (pageReqPerhapsNoPage.pageExists) pageReqPerhapsNoPage
      else {
        // Since the page doesn't exist, this request probably concerns
        // a newly created but unsaved page. Construct a dummy page with
        // an empty dummy post in place of the one that doesn't
        // yet exist, but is to be edited.
        val postToEdit = _createPostToEdit(pageReqPerhapsNoPage, postId)
        val meta = PageMeta.forNewPage(pageId, pageReqPerhapsNoPage.ctime)
        pageReqPerhapsNoPage.copyWithPreloadedPage(
          meta, Debate(pageId) + postToEdit, pageExists = false)
      }

    _showEditFormImpl(pageReq, postId)
  }


  def _showEditFormImpl(pageReqWithoutMe: PageRequest[_], postId: String) = {
    // I think, but I don't remember why, we need to add the current user
    // to page.people, iff `postId` needs to be created (e.g. it's the
    // page title that hasn't yet been created so the server will create
    // a dummy post, and as author specify the current user).
    // Don't require that there be any current user though — s/he might
    // not yet have logged in. (And then I think it's not possible
    // to lazily create a completely new post, because there's no one to
    // specify as owner for the dummy post that the server lazy-creates
    // — but you can edit existing post though, if you're not logged in.)
    val request = pageReqWithoutMe.copyWithAnyMeOnPage // needed?

    val (vipo, lazyCreateOpt) = _getOrCreatePostToEdit(request, postId)
    val draftText = vipo.text  // in the future, load user's draft from db.
    val editForm = Utils.formHtml(request).editForm(
       vipo, newText = draftText, userName = request.sid.displayName)
    OkHtml(editForm)
  }


  /**
   * Lazy-creates the page that is to be edited, if it does not exist, and
   * also lazy-creates the post to be edited, if it does not exist.
   */
  def handleEditForm(pathIn: PagePath, postId: String)
        = PagePostAction(MaxPostSize)(pathIn, pageMustExist = false) {
      pageReqOrig: PagePostRequest =>

    import Utils.ValidationImplicits._
    import HtmlForms.Edit.{InputNames => Inp}

    val text = pageReqOrig.getEmptyAsNone(Inp.Text) getOrElse
       throwBadReq("DwE8bJX2", "Empty edit")
    val markupOpt = pageReqOrig.getEmptyAsNone(Inp.Markup)

    _throwIfTooMuchData(text, pageReqOrig)

    val pageReqNoMeOnPage = _createPageIfNeeded(pageReqOrig, PageRole.Any,
      parentPageId = None)
    val pageReq = pageReqNoMeOnPage.copyWithMeOnPage_!
    _saveEdits(pageReq, postId, text, markupOpt)
    Utils.renderOrRedirect(pageReq)
  }


  /**
   * JSON format:  {edits: [{ pageId, pagePath, postId, text, markup }]}
   */
  def edit = PostJsonAction(maxLength = MaxPostSize) {
        request: JsonPostRequest =>

    def getOrThrow(map: Map[String, String], key: String): String =
      map.getOrElse(key, throwBadReq(
        "DwE390IR7", "/-/edit JSON entry missing: "+ key))

    val jsonBody = request.body.as[Map[String, List[Map[String, String]]]]

    val editMapsUnsorted: List[Map[String, String]] = jsonBody("edits")

    val editMapsByPageId: Map[String, List[Map[String, String]]] =
      editMapsUnsorted.groupBy(map => map("pageId"))

    var editIdsAndPages = List[(List[String], Debate)]()

    for ((pageId, editMaps) <- editMapsByPageId) {

      val pagePathStr = (editMaps.head)("pagePath")
      val pageRoleStr = (editMaps.head)("pageRole")
      val parentPageIdStr = (editMaps.head)("parentPageId")

      // Ensure all entries for `pageId` have the same page path.
      val badPath = editMaps.find(
        map => map.get("pagePath") != Some(pagePathStr))
      if (badPath nonEmpty) throwBadReq(
          "DwE390XR23", "Different page paths for page id "+ pageId +": "+
          pagePathStr +", and: "+ badPath.get)

      // COULD ensure page role and parent page id entries are identical
      // for all edits to the same page. Or should I add explicit
      // `ensurePageExists: { pageId, pageRole, path, parentPageId }`
      // entries before the actual edit data? (Lazy-creating pages is a
      // little bit complicated since both edit data and page creation data
      // needs to be posted to the server, and there might be many edits
      // of the same page.)

      val pageRole = AppCreatePage.stringToPageRole(pageRoleStr)
      val parentPageId =
        if (parentPageIdStr isEmpty) None else Some(parentPageIdStr)

      val pageReqPerhapsNoPage = PageRequest(request, pagePathStr, pageId,
        fixBadPath = yesFixPath)

      val pageReqPerhapsNoMe = _createPageIfNeeded(pageReqPerhapsNoPage,
        pageRole, parentPageId = parentPageId)
      // Include current user on the page to be edited, or it won't be
      // possible to render the page to html, later, because the current
      // user's name might be included in the generated html: "Edited by: ..."
      // (but if this is the user's first contribution to the page, s/he
      // is currently not included in the associated People).
      val pageRequest = pageReqPerhapsNoMe.copyWithMeOnPage_!

      var actions = List[Action]()
      var idsOfEditedPosts = List[String]()

      for (editMap <- editMaps) {
        val newText = getOrThrow(editMap, "text")
        val newMarkupOpt = editMap.get("markup")
        val postId = getOrThrow(editMap, "postId")

        _throwIfTooMuchData(newText, pageRequest)

        // COULD call _saveEdits once per page instead of once
        // per action per page.
        val editAndLazyPost: List[Action] =
          _saveEdits(pageRequest, postId = postId, newText = newText,
          newMarkupOpt = newMarkupOpt)

        if (editAndLazyPost.isEmpty) {
          // No changes made. (newText is the current text.)
        }
        else {
          val edit = editAndLazyPost.find(_.isInstanceOf[Edit]).getOrElse(
             assErr("DwE9kH3")).asInstanceOf[Edit]
          actions :::= editAndLazyPost
          idsOfEditedPosts ::= edit.id
        }
      }

      val page = pageRequest.page_! ++ actions
      editIdsAndPages ::= (idsOfEditedPosts, page)
    }

    BrowserPagePatcher.jsonForMyEditedPosts(editIdsAndPages, request)
  }


  private def _throwIfTooMuchData(text: String, request: DebikiRequest[_]) {
    val postSize = text.size
    val user = request.user_!
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
  }


  /**
   * If the requested page does not exist, creates it, and returns
   * a PagePostRequest to the new page.
   */
  private def _createPageIfNeeded[A](pageReq: PageRequest[A],
        pageRole: PageRole, parentPageId: Option[String]): PageRequest[A] = {
    if (pageReq.pageExists)
      return pageReq

    if (!pageReq.permsOnPage.createPage)
      throwForbidden("DwE01rsk351", "You may not create that page")

    val pageId = pageReq.pageId.getOrElse(throwBadReq(
      "DwE39KR8", "No page id, cannot lazy-create page at "+ pageReq.pagePath))

    val pageMeta = PageMeta.forNewPage(pageId, pageReq.ctime, pageRole,
      parentPageId = parentPageId)

    val newPage = pageReq.dao.createPage(
      PageStuff(pageMeta, pageReq.pagePath, Debate(pageId)))

    pageReq.copyWithPreloadedPage(newPage, pageExists = true)
  }


  private def _saveEdits(pageReq: PageRequest[_],
        postId: String, newText: String, newMarkupOpt: Option[String])
        : List[Action] = {

    val (post, lazyCreateOpt) = _getOrCreatePostToEdit(pageReq, postId)
    val markupChanged =
      newMarkupOpt.isDefined && newMarkupOpt != Some(post.markup)
    if (newText == post.text && !markupChanged)
      return Nil  // need do nothing

    // Don't allow any kind of html in replies.
    //if (markupChanged && pid != Page.BodyId && !Markup.isPlain(newMarkup))
    // reply forbidden
    // (and also when *creating* a post)

    val patchText = makePatch(from = post.text, to = newText)
    val loginId = pageReq.loginId_!

    val (mayEdit, mayEditReason) =
      AppEdit.mayEdit(pageReq.user, post, pageReq.permsOnPage)

    val approval =
      if (mayEdit) AutoApprover.perhapsApprove(pageReq)
      else None

    var edit = Edit(
      id = "?x", postId = post.id, ctime = pageReq.ctime,
      loginId = loginId, newIp = pageReq.newIp,
      text = patchText, newMarkup = newMarkupOpt,
      approval = approval, autoApplied = mayEdit)

    var actions = lazyCreateOpt.toList ::: edit :: Nil

    pageReq.dao.savePageActions(pageReq, actions).toList
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
    val vipoOpt: Option[ViPo] = pageReq.page_!.vipo(postId)

    // The page title and template are created automatically
    // if they don't exist, when they are to be edited.
    val lazyCreateOpt: Option[Post] = {
      // Usually, the post-to-be-edited already exists.
      if (vipoOpt isDefined) {
        None
      }
      // But create a title or template, lazily, if needed.
      else if (postId == Page.TitleId || postId == Page.TemplateId ||
          postId == Page.BodyId) {
        Some(_createPostToEdit(pageReq, postId = postId))
      }
      // Most post are not created automatically (instead error is returned).
      else {
        None
      }
    }

    val vipo = vipoOpt.getOrElse(
      lazyCreateOpt.map(new ViPo(pageReq.page_!, _)).getOrElse {
        throwNotFound("DwE3k2190", "Post not found: "+ safed(postId))
      })

    (vipo, lazyCreateOpt)
  }


  private def _createPostToEdit(pageReq: PageRequest[_], postId: String)
        : Post = {
    val markup =
      if (postId == Page.TemplateId) Markup.Code
      else if (postId == Page.TitleId) Markup.DefaultForPageTitle
      else if (postId == Page.BodyId) Markup.DefaultForPageBody
      else Markup.DefaultForComments

    // 1. (A page body, title or template is its own parent.
    // Dupl knowledge! see AppCreatePage.handleForm.)
    // 2. The post will be auto approved implicitly, if the Edit is
    // auto approved.
    Post(id = postId, parent = postId, ctime = pageReq.ctime,
      loginId = pageReq.loginId_!, newIp = pageReq.newIp, text = "",
      markup = markup.id, tyype = PostType.Text,
      where = None, approval = None)
  }

}

