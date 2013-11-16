/**
 * Copyright (C) 2012-2013 Kaj Magnus Lindberg (born 1979)
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

import actions.ApiActions._
import actions.PageActions._
import com.debiki.core._
import com.debiki.core.Prelude._
import com.debiki.core.{PostActionPayload => PAP}
import debiki._
import debiki.DebikiHttp._
import play.api._
import libs.json.{JsString, JsValue}
import play.api.data._
import play.api.data.Forms._
import play.api.mvc.{Action => _, _}
import requests._
import scala.collection.{mutable => mut}
import Utils.{OkSafeJson, OkHtml, Passhasher, parseIntOrThrowBadReq}


/** Edits pages. And lazily saves new unsaved pages "created" by AppCreatePage.
  *
 * SECURITY BUG I think it's possible to use edit GET/POST requests
 * to access and *read* hidden pages. I don't think I do any access control
 * when sending the current markup source back to the browser? Only when
 * actually saving something ...?
 *  -- I'm doing it *sometimes* when loading PermsOnPage via
 *  PageActions.PageReqAction?
 */
object AppEdit extends mvc.Controller {


  def showEditForm(pathIn: PagePath, postId: ActionId)
        = PageGetAction(pathIn) {
      pageReq: PageGetRequest =>
    _showEditFormImpl(pageReq, postId)
  }


  def showEditFormAnyPage(
        pageId: String, pagePath: String, pageRole: String, postId: String)
        = GetAction { request =>

    val postIdAsInt = parseIntOrThrowBadReq(postId, "DwE1Hu80")

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
            PageParts(pageId),
            creationDati = pageReqPerhapsNoPage.ctime,
            // These shouldn't matter when rendering the edit form anyway:
            parentPageId = None, publishDirectly = false)
        val pageReqWithMeta = pageReqPerhapsNoPage.copyWithPreloadedMeta(pageMeta)
        val postToEdit = _createPostToEdit(pageReqWithMeta, postIdAsInt, DummyAuthorIds)
        pageReqWithMeta.copyWithPreloadedActions(PageParts(pageId) + postToEdit)
      }

    _showEditFormImpl(completePageReq, postIdAsInt)
  }


  def _showEditFormImpl(pageReqWithoutMe: PageRequest[_], postId: ActionId) = {
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

    val (vipo, lazyCreateOpt) = _getOrCreatePostToEdit(request, postId, DummyAuthorIds)
    val draftText = vipo.currentText  // in the future, load user's draft from db.
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

    def getIntOrThrow(map: Map[String, JsValue], key: String): Int =
      parseIntOrThrowBadReq(getTextOrThrow(map, key), "DwE38XU7")

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

        val ancestorIdsParentFirst: List[PageId] =
          parentPageId map { parentId =>
            val parentsAncestorIds = request.dao.loadAncestorIdsParentFirst(parentId)
            parentId :: parentsAncestorIds
          } getOrElse Nil

        // In case the user has been allowed to create a new page, then did
        // evil things, and now finally submitted the first edit of the page, then,
        // here we need to consider his/her deeds, and perhaps cancel the old
        // already granted approval.
        val newPageApproval =
          AutoApprover.upholdNewPageApproval(
            createPageReq, prevPageApproval
            // SECURITY SHOULD check access to ancestor pages again:
            // security settings might have been changed since the original page creation
            // request was approved. I.e. pass `ancestorIdsParentFirst` to AutoApprover?
            // But there's a race condition! What if security settings are changed again,
            // just after we checked access.
            /* , ancestorIdsParentFirst */) getOrElse
            throwForbidden("DwE03WCS8", "Page creation approval retracted")

        // Throws PageExistsException if page already exists.
        val pageReq = createPage(createPageReq, pageRole, pageStatus, ancestorIdsParentFirst)

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
    var editIdsAndPages = List[(List[ActionId], PageParts)]()

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

      var actions = List[PostActionDtoOld]()
      var idsOfEditedPosts = List[ActionId]()

      for (editMap <- editMaps) {
        val newText = getTextOrThrow(editMap, "text")
        val newMarkupOpt = getTextOptOrThrow(editMap, "markup")
        val postId = getIntOrThrow(editMap, "postId")

        _throwIfTooMuchData(newText, pageRequest)

        // If we're creating a new page lazily, by editing title or body,
        // ensure we're really editing the title or body.
        if (anyNewPageApproval.isDefined &&
            postId != PageParts.BodyId && postId != PageParts.TitleId)
          throwForbidden(
            "DwE69Ro8", "Title or body must be edited before other page parts")

        // COULD call _saveEdits once per page instead of once
        // per action per page.
        _saveEdits(pageRequest, postId = postId, newText = newText,
            newMarkupOpt = newMarkupOpt, anyNewPageApproval) match {
          case None => // No changes made. (newText is the current text.)
          case Some((anyLazilyCreatedPost: Option[_], edit)) =>
            actions :::= anyLazilyCreatedPost.toList ::: edit :: Nil
            idsOfEditedPosts ::= edit.id
        }
      }

      val page = pageRequest.page_! ++ actions
      editIdsAndPages ::= (idsOfEditedPosts, page)
    }

    // Show the unapproved version of this post, so any applied edits are included.
    // (An edit suggestion, however, won't be included, until it's been applied.)
    OkSafeJson(
      BrowserPagePatcher(request, showAllUnapproved = true)
        .jsonForMyEditedPosts(editIdsAndPages))
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
    ancestorIdsParentFirst: List[String]): PageRequest[A] = {

    assErrIf(pageReq.pageExists, "DwE70QU2")

    // SECURITY SHOULD do this test in AppCreatePage instead?, when generating page id:
    //if (!pageReq.permsOnPage.createPage)
      //throwForbidden("DwE01rsk351", "You may not create that page")

    val pageMeta = PageMeta.forNewPage(
      pageRole, pageReq.user_!, PageParts(pageReq.pageId_!), pageReq.ctime,
      parentPageId = ancestorIdsParentFirst.headOption,
      publishDirectly = pageStatus == PageStatus.Published)

    val newPage = pageReq.dao.createPage(
      Page(pageMeta, pageReq.pagePath, ancestorIdsParentFirst, PageParts(pageMeta.pageId)))

    pageReq.copyWithPreloadedPage(newPage, pageExists = true)
  }


  /** Saves an edit in the database.
    * Returns 1) any lazily created post, and 2) the edit that was saved.
    * Returns None if no changes was made (if old text == new text).
    */
  private def _saveEdits(pageReq: PageRequest[_],
        postId: ActionId, newText: String, newMarkupOpt: Option[String],
        anyNewPageApproval: Option[Approval])
        : Option[(Option[PostActionDtoOld], PostActionDtoOld)] = {

    val (post, lazyCreateOpt) =
      _getOrCreatePostToEdit(
        pageReq, postId, AuthorIds(pageReq.loginId_!, userId = pageReq.user_!.id))
    val markupChanged =
      newMarkupOpt.isDefined && newMarkupOpt != Some(post.markup)
    if (newText == post.currentText && !markupChanged)
      return None  // need do nothing

    // Don't allow any kind of html in replies.
    //if (markupChanged && pid != Page.BodyId && !Markup.isPlain(newMarkup))
    // reply forbidden
    // (and also when *creating* a post)

    val patchText = makePatch(from = post.currentText, to = newText)

    val (mayEdit, mayEditReason) =
      AppEdit.mayEdit(pageReq.user, post, pageReq.permsOnPage)

    def editsOwnPost = pageReq.user_!.id == post.userId

    val approval =
      anyNewPageApproval orElse (upholdEarlierApproval(pageReq, postId) getOrElse {
        if (mayEdit) {
          if (editsOwnPost && post.currentVersionPrelApproved) {
            // Let the user continue editing his/her preliminarily approved comment.
            Some(Approval.Preliminary)
          }
          else {
            AutoApprover.perhapsApprove(pageReq)
          }
        }
        else None
      })

    var edit = PostActionDto.toEditPost(
      id = PageParts.UnassignedId, postId = post.id, ctime = pageReq.ctime,
      loginId = pageReq.loginId_!, userId = pageReq.user_!.id, newIp = pageReq.newIp,
      text = patchText, newMarkup = newMarkupOpt,
      approval = approval, autoApplied = mayEdit)

    var actions = lazyCreateOpt.toList ::: edit :: Nil
    val (_, actionsWithIds) = pageReq.dao.savePageActionsGenNotfs(pageReq, actions)

    val anyLazyCreate = lazyCreateOpt.map(_ => actionsWithIds.head)
    assert(anyLazyCreate.isDefined == (actionsWithIds.size == 2))
    assert(anyLazyCreate.isEmpty == (actionsWithIds.size == 1))

    Some((anyLazyCreate, actionsWithIds.last))
  }


  /**
   * Returns (true/false, reason) if the user may/not edit `vipo'.
   */
  def mayEdit(user: Option[User], post: Post, perms: PermsOnPage)
        : (Boolean, String) = {

    def isOwnPost = user.map(_.id) == Some(post.userId)
    def isPage = post.id == PageParts.BodyId || post.id == PageParts.TitleId

    if (post.id == PageParts.ConfigPostId && !perms.editPageTemplate)
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
  private def upholdEarlierApproval(pageReq: PageRequest[_], postId: ActionId)
        : Option[Option[Approval]] = {

    if (postId != PageParts.BodyId && postId != PageParts.TitleId)
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
      val newReview = titleOrBody.lastApprovalType flatMap {
        earlierApproval =>
          AutoApprover.upholdNewPageApproval(pageReq, earlierApproval)
      }
      return Some(newReview)
    }

    None
  }


  private case class AuthorIds(loginId: String, userId: String)


  private val DummyAuthorIds = AuthorIds(
    loginId = DummyPage.DummyAuthorLogin.id,
    userId = DummyPage.DummyAuthorUser.id)


  private def _getOrCreatePostToEdit(
        pageReq: PageRequest[_], postId: ActionId, authorIds: AuthorIds)
        : (Post, Option[PostActionDto[PAP.CreatePost]]) = {

    val anyPost: Option[Post] = pageReq.page_!.getPost(postId)

    // The page title and template are created automatically
    // if they don't exist, when they are to be edited.
    val lazyCreateOpt: Option[PostActionDto[PAP.CreatePost]] = {
      // Usually, the post-to-be-edited already exists.
      if (anyPost isDefined) {
        None
      }
      // But create a title or template, lazily, if needed.
      else if (postId == PageParts.TitleId || postId == PageParts.ConfigPostId ||
          postId == PageParts.BodyId) {
        Some(_createPostToEdit(pageReq, postId = postId, authorIds))
      }
      // Most post are not created automatically (instead error is returned).
      else {
        None
      }
    }

    val post = anyPost.getOrElse(
      lazyCreateOpt.map(new Post(pageReq.page_!, _)).getOrElse {
        throwNotFound("DwE3k2190", s"Post not found: $postId")
      })

    (post, lazyCreateOpt)
  }


  private def _createPostToEdit(
        pageReq: PageRequest[_], postId: ActionId, authorIds: AuthorIds)
        : PostActionDto[PAP.CreatePost] = {

    val markup =
      if (postId == PageParts.ConfigPostId) Markup.Code
      else if (postId == PageParts.TitleId) Markup.DefaultForPageTitle
      else if (postId == PageParts.BodyId) Markup.defaultForPageBody(pageReq.pageRole_!)
      else Markup.DefaultForComments

    // 1. (A page body, title or template is its own parent.
    // Dupl knowledge! see AppCreatePage.handleForm.)
    // 2. The post will be auto approved implicitly, if the Edit is
    // auto approved.
    PostActionDto(
      id = postId, postId = postId, creationDati = pageReq.ctime,
      loginId = authorIds.loginId, userId = authorIds.userId, newIp = pageReq.newIp,
      payload = PAP.CreatePost(
        parentPostId = postId, text = "",
        markup = markup.id, where = None, approval = None))
  }

}

