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
import debiki._
import java.{util => ju, io => jio}
import play.api._
import play.api.Play.current
import play.api.mvc.{Action => _, _}
import play.api.libs.json.Json.toJson
import play.api.libs.json._
import requests._
import DebikiHttp._
import Utils.ValidationImplicits._
import Utils.{OkHtml, OkXml}



/** Shows pages and individual posts.
  *
  * Also loads the users permissions on the page, and info on which
  * comments the user has authored or rated, and also loads the user's
  * comments that are pending approval — although such unapproved comments
  * aren't loaded, when other people view the page.
  */
object ViewPageController extends mvc.Controller {


  def showActionLinks(pathIn: PagePath, postId: ActionId) =
    PageGetAction(pathIn) { pageReq =>
      val links = Utils.formHtml(pageReq).actLinks(postId)
      OkHtml(links)
    }


  def viewPost(pathIn: PagePath) = PageGetAction(pathIn) { pageReq =>
    viewPostImpl(pageReq)
  }


  def viewPostImpl(pageReq: PageGetRequest) = {
    val pageDataJson = buildPageDataJosn(pageReq)
    val userPageDataJson = pageReq.user.isEmpty ? "" | buildUserPageDataJson(pageReq)
    // If not logged in, then include an empty user data tag, so the browser
    // notices that it got something, and won't call GET ?page-info.
    val dataNodes = <span>
      <pre id="dw-page-data">{ pageDataJson }</pre>
      <pre class="dw-user-page-data">{ userPageDataJson }</pre>
      </span>
    val pageHtml = pageReq.dao.renderTemplate(pageReq, appendToBody = dataNodes)
    Ok(pageHtml) as HTML
  }


  /**
   * Lists e.g. all posts and ratings by the current user, on a page.
   *
   * Initially, on page load, all (?) this info is already implicitly included
   * in the html sent by the server, e.g. the user's own posts are highlighted.
   * However, the user might logout and login, without refreshing the page,
   * so we need a way for the browser to fetch authorship info
   * dynamically.
   */
  def loadMyPageData(pageId: PageId) = GetAction { request =>
    val pageReq = PageRequest.forPageThatExists(request, pageId) getOrElse throwNotFound(
      "DwE404FL9", s"Page `$pageId' not found")
    val json = buildUserPageDataJson(pageReq)
    Ok(json)
  }


  /** Generates JSON like this: (illustrated in Yaml)
    *   categories:
    *    - name: "Category Name",
    *      pageId: "123abc",
    *      subCategories: []
    *    - ...
    *    - ...
    * Currently no sub categories are included.
    */
  def buildPageDataJosn(pageReq: PageRequest[_]): String = {
    if (pageReq.pageRole != Some(PageRole.Forum))
      return ""

    val categories: Seq[Category] = pageReq.dao.loadCategoryTree(pageReq.thePageId)
    val categoriesJson = categories map { category =>
      JsObject(Seq(
        "name" -> JsString(category.categoryName),
        "pageId" -> JsString(category.pageId),
        "slug" -> JsString(ForumController.categoryNameToSlug(category.categoryName)),
        "subCategories" -> JsArray()))
    }
    Json.obj("categories" -> categoriesJson).toString
  }


  def buildUserPageDataJson(pageReq: PageRequest[_]): String = {
    import pageReq.{permsOnPage => perms}
    val page = pageReq.page_!
    val my = pageReq.user_!

    // List permissions.
    val permsMap = Map(
      "accessPage" -> JsBoolean(perms.accessPage),
      "createPage" -> JsBoolean(perms.createPage),
      "moveRenamePage" -> JsBoolean(perms.moveRenamePage),
      "hidePageIdInUrl" -> JsBoolean(perms.hidePageIdInUrl),
      "editPageTemplate" -> JsBoolean(perms.editPageTemplate),
      "editPage" -> JsBoolean(perms.editPage),
      "editAnyReply" -> JsBoolean(perms.editAnyReply),
      "editGuestReply" -> JsBoolean(perms.editUnauReply),
      "collapseThings" -> JsBoolean(perms.collapseThings),
      "deleteAnyReply" -> JsBoolean(perms.deleteAnyReply),
      "pinReplies" -> JsBoolean(perms.pinReplies))

    // List posts by this user, so they can be highlighted.
    val ownPostsIdsList = page.postsByUser(withId = my.id).map(_.id)

    // List the user's ratings so they can be highlighted so the user
    // won't rate the same post over and over again.
    val userVotesMap = page.userVotesMap(pageReq.userIdData)
    val ownRatingsJsonMap = userVotesMap map { case (postId, votes) =>
      var voteStrs = Vector[String]()
      if (votes.votedLike) voteStrs = voteStrs :+ "VoteLike"
      if (votes.votedWrong) voteStrs = voteStrs :+ "VoteWrong"
      if (votes.votedOffTopic) voteStrs = voteStrs :+ "VoteOffTopic"
      postId.toString -> toJson(voteStrs)
    }

    // Generate html for any posts-by-this-user that are pending approval. Plus info
    // on ancestor post ids, so the browser knows where to insert the html.
    val postsOfInterest = if (my.isAdmin) page.getAllPosts else page.postsByUser(my.id)
    // If the post hasn't been approved at all, it's not present on the page, and
    // we need to patch the page with the whole thread.
    val pendingThreads = postsOfInterest filter { post =>
      !post.someVersionApproved
    }
    // If the post has been approved, it's already included on the page and we don't
    // want to overwrite the whole thread including replies, only update the post itself.
    val pendingPosts = postsOfInterest filter { post =>
      post.someVersionApproved && !post.currentVersionApproved
    }
    val pendingThreadsJsPatches: Seq[BrowserPagePatcher.JsPatch] =
      BrowserPagePatcher(pageReq).jsonForTreePatches(page, pendingThreads.map(_.id))
    val pendingPostsJsPatches: Seq[BrowserPagePatcher.JsPatch] =
      pendingPosts map { post =>
        BrowserPagePatcher(pageReq).jsonForPost(post)
      }

    val rolePageSettings =
      pageReq.anyRoleId map { roleId =>
        val settings = pageReq.dao.loadRolePageSettings(roleId = roleId, pageId = page.id)
        TemplateProgrammingInterface.rolePageSettingsToJson(settings)
      } getOrElse JsNull

    val json = toJson(Map(
      "isAdmin" -> toJson(pageReq.user.map(_.isAdmin).getOrElse(false)),
      "permsOnPage" -> toJson(permsMap),
      "authorOf" -> toJson(ownPostsIdsList),
      "ratings" -> toJson(ownRatingsJsonMap),
      // Suddenly using a by-page-id map is a bit weird, but what debiki-patch-page.ls
      // currently expects. Could map *everything* in the page id instead?
      // (Background: This is supposed to work on e.g. pages that lists many blog posts,
      // i.e. many pages.)
      "postsByPageId" -> toJson(Map(
          page.id -> toJson(pendingPostsJsPatches))),
      "threadsByPageId" -> toJson(Map(
          page.id -> toJson(pendingThreadsJsPatches))),
      "rolePageSettings" -> rolePageSettings))

    if (Play.isDev) Json.prettyPrint(json)
    else Json.stringify(json)
  }

}
