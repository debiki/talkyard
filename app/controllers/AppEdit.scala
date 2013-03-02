/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package controllers

import com.debiki.v0._
import debiki._
import debiki.DebikiHttp._
import play.api._
import libs.json.{JsString, JsValue}
import play.api.data._
import play.api.data.Forms._
import play.api.mvc.{Action => _, _}
import scala.collection.{mutable => mut}
import PageActions._
import ApiActions._
import Prelude._
import Utils.{OkHtml, Passhasher}


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


  def showEditFormAnyPage(
        pageId: String, pagePath: String, pageRole: String, postId: String)
        = GetAction { request =>

    val pageReqPerhapsNoPage =
      PageRequest.forPageThatMightExist(request, pagePathStr = pagePath, pageId = pageId)

    val completePageReq =
      if (pageReqPerhapsNoPage.pageExists) pageReqPerhapsNoPage
      else {
        // Since the page doesn't exist, this request probably concerns
        // a newly created but unsaved page. Construct a dummy page with
        // 1) the correct meta data (e.g. correct page role), and with
        // 2) an empty dummy post in place of the one that doesn't
        // yet exist, but is to be edited.
        // Could reuse AppCreatePage.newPageMetaFromUrl(..) in some way?
        val pageMeta =
          PageMeta.forNewPage(
            PageRole.parse(pageRole),
            pageReqPerhapsNoPage.user_!,
            Debate(pageId),
            creationDati = pageReqPerhapsNoPage.ctime,
            // These shouldn't matter when rendering the edit form anyway:
            parentPageId = None, publishDirectly = false)
        val pageReqWithMeta = pageReqPerhapsNoPage.copyWithPreloadedMeta(pageMeta)
        val postToEdit = _createPostToEdit(pageReqWithMeta, postId,
          authorLoginId = DummyPage.DummyAuthorLogin.id)
        pageReqWithMeta.copyWithPreloadedActions(Debate(pageId) + postToEdit)
      }

    _showEditFormImpl(completePageReq, postId)
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

    val (vipo, lazyCreateOpt) = _getOrCreatePostToEdit(request, postId,
      authorLoginId = DummyPage.DummyAuthorLogin.id)
    val draftText = vipo.text  // in the future, load user's draft from db.
    val editForm = Utils.formHtml(request).editForm(
       vipo, newText = draftText, userName = request.sid.displayName)
    OkHtml(editForm)
  }


  /**
   * Edits posts. Creates pages too, if needed.
   *
   * JSON format, as Yaml:
   *  # Parent pages must be listed before their child pages.
   *  # If a page with `pageId` (see below) exists, other `createPagesUnlessExist`
   *  # entries for that particular page are ignored.
   *  createPagesUnlessExist:
   *    - passhash
   *      pageId
   *      pagePath
   *      pageRole
   *      pageStatus
   *      parentPageId
   *    - ...more pages
   *
   *  editPosts:
   *    - pageId
   *      postId
   *      text
   *      markup
   *    - ...more edits
   */
  def edit = PostJsonAction(maxLength = MaxPostSize) {
        request: JsonPostRequest =>

    val ErrPrefix = "/-/edit: Bad JSON:"

    def getTextOrThrow(map: Map[String, JsValue], key: String): String =
      getTextOptOrThrow(map, key).getOrElse(throwBadReq(
        "DwE390IR7", s"$ErrPrefix Entry missing: $key"))

    def getTextOptOrThrow(map: Map[String, JsValue], key: String): Option[String] =
      map.get(key).map(_ match {
        case s: JsString => s.value
        case x => throwBadReq("DwE77dY0", o"""$ErrPrefix Entry `$key' is no string: `$x',
            it is a ${classNameOf(x)}""")
      })

    val jsonBody = request.body.as[Map[String, List[Map[String, JsValue]]]]

    // ----- Create pages

    // First create all required pages. (For example, if saving the title
    // of a new blog post, first save the blog main page and the blog post page
    // itself, if not already done.)

    val createPagesMaps: List[Map[String, JsValue]] =
      jsonBody.getOrElse("createPagesUnlessExist", Nil)
    var pageReqsById = Map[String, (PageRequest[_], Approval)]()

    for (pageData <- createPagesMaps) {
      val passhashStr = getTextOrThrow(pageData, "passhash")
      val approvalStr = getTextOrThrow(pageData, "newPageApproval")
      val pageId = getTextOrThrow(pageData, "pageId")
      val pagePathStr = getTextOrThrow(pageData, "pagePath")
      val pageRoleStr = getTextOrThrow(pageData, "pageRole")
      val pageStatusStr = getTextOrThrow(pageData, "pageStatus")
      val parentPageIdStr = getTextOrThrow(pageData, "parentPageId")

      val prevPageApproval = Approval.parse(approvalStr)
      val pageRole = PageRole.parse(pageRoleStr)
      val pageStatus = PageStatus.parse(pageStatusStr)
      val parentPageId =
        if (parentPageIdStr isEmpty) None else Some(parentPageIdStr)

      try {
        val createPageReq = PageRequest.forPageToCreate(request, pagePathStr, pageId)
        val newPath = createPageReq.pagePath

        val correctPasshash = AppCreatePage.makePagePasshash(
          prevPageApproval, pageRole, pageStatus, folder = newPath.folder,
          slug = newPath.pageSlug, showId = newPath.showId, pageId = pageId,
          parentPageId = parentPageId)

        if (passhashStr != correctPasshash)
          throwForbidden("DwE82RfY5", "Bad passhash")

        // In case the user has been allowed to create a new page, then did
        // evil things, and now finally submitted the first edit of the page, then,
        // here we need to consider his/her deeds, and perhaps cancel the old
        // already granted approval.
        val newPageApproval =
          AutoApprover.upholdNewPageApproval(createPageReq, prevPageApproval) getOrElse
            throwForbidden("DwE03WCS8", "Page creation approval retracted")

        // Throws PageExistsException if page already exists.
        val pageReq = createPage(createPageReq,
          pageRole = pageRole, pageStatus = pageStatus, parentPageId = parentPageId)

        pageReqsById += pageId -> (pageReq, newPageApproval)
      }
      catch {
        case ex: PageRequest.PageExistsException =>
          // Fine, ignore. We're probably continuing editing a page we just created.
      }
    }

    // ----- Edit posts

    val editMapsUnsorted: List[Map[String, JsValue]] =
      jsonBody.getOrElse("editPosts", Nil)

    val editMapsByPageId: Map[String, List[Map[String, JsValue]]] =
      editMapsUnsorted.groupBy(map => getTextOrThrow(map, "pageId"))
    var editIdsAndPages = List[(List[String], Debate)]()

    for ((pageId, editMaps) <- editMapsByPageId) {

      val (pageReqPerhapsNoMe, anyNewPageApproval) = pageReqsById.get(pageId) match {
        case None =>
          (PageRequest.forPageThatExists(request, pageId), None)
        case Some((pageReq, newPageApproval)) =>
          // We just created the page. Reuse the PageRequest that was used
          // when we created it.
          (pageReq, Some(newPageApproval))
      }

      // Include current user on the page to be edited, or it won't be
      // possible to render the page to html, later, because the current
      // user's name might be included in the generated html: "Edited by: ..."
      // (but if this is the user's first contribution to the page, s/he
      // is currently not included in the associated People).
      val pageRequest = pageReqPerhapsNoMe.copyWithMeOnPage_!

      var actions = List[RawPostActionOld]()
      var idsOfEditedPosts = List[String]()

      for (editMap <- editMaps) {
        val newText = getTextOrThrow(editMap, "text")
        val newMarkupOpt = getTextOptOrThrow(editMap, "markup")
        val postId = getTextOrThrow(editMap, "postId")

        _throwIfTooMuchData(newText, pageRequest)

        // If we're creating a new page lazily, by editing title or body,
        // ensure we're really editing the title or body.
        if (anyNewPageApproval.isDefined &&
            postId != Page.BodyId && postId != Page.TitleId)
          throwForbidden(
            "DwE69Ro8", "Title or body must be edited before other page parts")

        // COULD call _saveEdits once per page instead of once
        // per action per page.
        val editAndLazyPost: List[RawPostActionOld] =
          _saveEdits(pageRequest, postId = postId, newText = newText,
          newMarkupOpt = newMarkupOpt, anyNewPageApproval)

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


  private def createPage[A](
    pageReq: PageRequest[A],
    pageRole: PageRole,
    pageStatus: PageStatus,
    parentPageId: Option[String]): PageRequest[A] = {

    assErrIf(pageReq.pageExists, "DwE70QU2")

    // SECURITY SHOULD do this test in AppCreatePage instead?, when generating page id:
    //if (!pageReq.permsOnPage.createPage)
      //throwForbidden("DwE01rsk351", "You may not create that page")

    val pageMeta = PageMeta.forNewPage(
      pageRole, pageReq.user_!, Debate(pageReq.pageId_!), pageReq.ctime,
      parentPageId = parentPageId, publishDirectly = pageStatus == PageStatus.Published)

    val newPage = pageReq.dao.createPage(
      PageStuff(pageMeta, pageReq.pagePath, Debate(pageMeta.pageId)))

    pageReq.copyWithPreloadedPage(newPage, pageExists = true)
  }


  private def _saveEdits(pageReq: PageRequest[_],
        postId: String, newText: String, newMarkupOpt: Option[String],
        anyNewPageApproval: Option[Approval])
        : List[RawPostActionOld] = {

    val (post, lazyCreateOpt) =
      _getOrCreatePostToEdit(pageReq, postId, authorLoginId = pageReq.loginId_!)
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
      anyNewPageApproval orElse (upholdEarlierApproval(pageReq, postId) getOrElse {
        if (mayEdit) AutoApprover.perhapsApprove(pageReq)
        else None
      })

    var edit = Edit(
      id = "?x", postId = post.id, ctime = pageReq.ctime,
      loginId = loginId, newIp = pageReq.newIp,
      text = patchText, newMarkup = newMarkupOpt,
      approval = approval, autoApplied = mayEdit)

    var actions = lazyCreateOpt.toList ::: edit :: Nil

    pageReq.dao.savePageActionsGenNotfs(pageReq, actions).toList
  }


  /**
   * Returns (true/false, reason) if the user may/not edit `vipo'.
   */
  def mayEdit(user: Option[User], post: ViPo, perms: PermsOnPage)
        : (Boolean, String) = {

    def isOwnPost = user.map(_.id) == Some(post.identity_!.userId)
    def isPage = post.id == Page.BodyId || post.id == Page.TitleId

    if (post.id == Page.ConfigPostId && !perms.editPageTemplate)
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


  /**
   * Finds out if the user is creating a missing title or body of a page
   * s/he just created, and, if so, attempts to uphold the approval previously
   * granted when the page was created.
   *
   * Returns None if there isn't any earlier approval to uphold.
   * Returns Some(Some(approval)) if an earlier approval was uphold,
   *   and Some(None) if the earlier approval was retracted.
   */
  private def upholdEarlierApproval(pageReq: PageRequest[_], postId: String)
        : Option[Option[Approval]] = {

    if (postId != Page.BodyId && postId != Page.TitleId)
      return None

    val page = pageReq.page_!
    val titleOrBodyExists = page.title.isDefined || page.body.isDefined
    val titleOrBodyAbsent = page.title.isEmpty || page.body.isEmpty
    if (!titleOrBodyExists || !titleOrBodyAbsent) {
      // We're not creating a missing title or body, after having created
      // the body or title.
      return None
    }

    val titleOrBody = (page.title orElse page.body).get
    if (titleOrBody.user_! == pageReq.user_!) {
      // This user authored the title or body, and is now attempting to create
      // the missing body or title. Prefer to uphold the earlier approval.
      val newReview = titleOrBody.lastApproval.flatMap(_.approval) flatMap {
        earlierApproval =>
          AutoApprover.upholdNewPageApproval(pageReq, earlierApproval)
      }
      return Some(newReview)
    }

    None
  }


  private def _getOrCreatePostToEdit(
        pageReq: PageRequest[_], postId: String, authorLoginId: String)
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
      else if (postId == Page.TitleId || postId == Page.ConfigPostId ||
          postId == Page.BodyId) {
        Some(_createPostToEdit(pageReq, postId = postId, authorLoginId = authorLoginId))
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


  private def _createPostToEdit(
        pageReq: PageRequest[_], postId: String, authorLoginId: String): Post = {

    val markup =
      if (postId == Page.ConfigPostId) Markup.Code
      else if (postId == Page.TitleId) Markup.DefaultForPageTitle
      else if (postId == Page.BodyId) Markup.defaultForPageBody(pageReq.pageRole_!)
      else Markup.DefaultForComments

    // 1. (A page body, title or template is its own parent.
    // Dupl knowledge! see AppCreatePage.handleForm.)
    // 2. The post will be auto approved implicitly, if the Edit is
    // auto approved.
    Post(id = postId, parent = postId, ctime = pageReq.ctime,
      loginId = authorLoginId, newIp = pageReq.newIp, text = "",
      markup = markup.id, where = None, approval = None)
  }

}

