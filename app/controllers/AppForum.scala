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
 * Handles requests related to forums, forum topics and forum groups.
 */
object AppForum extends mvc.Controller {


  /**
   * Wraps a forum in a forum group. That is, wraps a page F with role PageRole.Forum
   * in a new page FG with role PageRole.ForumGroup. FG's parent will be F's
   * original parent, if any. F's new parent will be FG.
   *
   * JSON format, as Yaml:
   *  wrapForumsInNewGroup:
   *    - forumPageId
   *    - ... more forums to wrap, in the same group
   */
  def wrapForumsInNewGroup = PostJsonAction(maxLength = 1000) {
        request: JsonPostRequest =>

    // Access control.

    if (!request.user_!.isAdmin)
      throwForbidden("DwE6GdC9", "Please login as admin")

    // Parse request.

    val forumPathsAndMetas: List[PagePathAndMeta] = {
      val jsonBody = request.body.as[Map[String, List[String]]]

      val idsOfForumsToWrap: List[String] =
        jsonBody.getOrElse("wrapForumsInNewGroup", Nil)

      if (idsOfForumsToWrap.isEmpty)
        unimplemented // return Ok

      idsOfForumsToWrap map { forumPageId =>
        request.dao.loadPageMetaAndPath(forumPageId) match {
          case Some(pathAndMeta) => pathAndMeta
          case None =>
            throwNotFound("DwE3kE1", s"Forum not found, page id: $forumPageId")
        }
      }
    }

    // Find common parent page and folder, and check for bugs.

    val (anyCommonParentId, commonParentFolder, makeIndexPage) = {
      var anyParentId: Option[String] = null
      var commonParentFolder = ""
      var makeIndexPage = false

      for (forum <- forumPathsAndMetas) {
        if (forum.role != PageRole.Forum && forum.role != PageRole.ForumGroup) {
          throwForbidden("DwE4UWx3", o"""Page `${forum.id}' is not a forum
            nor a forum group""")
        }
        else if (anyParentId eq null) {
          anyParentId = forum.parentPageId
          commonParentFolder = forum.folder
          makeIndexPage = forum.path.isFolderOrIndexPage
        }
        else if (anyParentId != forum.parentPageId) {
          throwForbidden("DwE2YKf8", o"""Specified forums have different parent pages,
            namely `$anyParentId' and `${forum.parentPageId}'""")
        }
        else if (forum.folder != commonParentFolder) {
          throwForbidden("DwE5XAw8", o"""Specified forums are located in different
            folders, namely `$commonParentFolder' and `${forum.folder}'""")
        }
        else if (makeIndexPage || forum.path.isFolderOrIndexPage) {
          throwForbidden("DwE6BcH8", o"""Cannot wrap specified forums in a group:
            Many forums specified, but one of them is an index page.
            Forums that are index pages can only be wrapped one at a time.""")
        }
      }

      (anyParentId, commonParentFolder, makeIndexPage)
    }

    // Move any index page forum.

    // If we're wrapping a folder index page, first move it
    // elsewhere, so we can place the new parent group as the folder index.
    // (Or there'll be a PathClashException.)

    val forumsWithAnyIndexMoved =
      if (makeIndexPage) {
        assErrIf(forumPathsAndMetas.length != 1, "DwE73BK3")
        forumPathsAndMetas map { forum =>
          val newPath = request.dao.moveRenamePage(
            forum.id, showId = Some(true), newSlug = Some("forum"))
          forum.copy(path = newPath)
        }
      }
      else {
        forumPathsAndMetas
      }

    // Create a forum group with parent `anyCommonParentId`.

    val groupMeta = PageMeta.forNewPage(
      PageRole.ForumGroup, request.user_!, PageParts("?"), request.ctime,
      parentPageId = anyCommonParentId, publishDirectly = true)

    val groupPath = PagePath(tenantId = request.tenantId, folder = commonParentFolder,
      pageId = None, showId = !makeIndexPage,
      pageSlug = if (makeIndexPage) "" else "forum")

    val parentGroup = request.dao.createPage(
      PageStuff(groupMeta, groupPath, PageParts(groupMeta.pageId)))

    // Update other forums: Set their parent page to the parent group.
    // Is `makeIndexPage`, there should be only one child forum, and we need
    // to change its path (so it won't clash with the new group).

    val childForums = for (forum <- forumsWithAnyIndexMoved) {
      val metaWithGroupAsParent = forum.meta.copy(parentPageId = Some(parentGroup.id))
      request.dao.updatePageMeta(metaWithGroupAsParent, old = forum.meta)

      PagePathAndMeta(forum.path, metaWithGroupAsParent)
    }

    Ok

    // BrowserPagePatcher.jsonForNewAndEditedPages(
    //    newPages = List(PagePathAndMeta(groupPath, groupMeta)),
    //    modifiedPages = childForums)
  }

}

