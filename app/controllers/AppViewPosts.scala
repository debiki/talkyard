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
import debiki._
import java.{util => ju, io => jio}
import play.api._
import play.api.Play.current
import play.api.mvc.{Action => _, _}
import play.api.libs.json.Json.toJson
import play.api.libs.json._
import DebikiHttp._
import Prelude._
import Utils.ValidationImplicits._
import Utils.{OkHtml, OkXml}



/** Shows pages and individual posts.
  */
object AppViewPosts extends mvc.Controller {


  def showActionLinks(pathIn: PagePath, postId: ActionId) =
    PageGetAction(pathIn) { pageReq =>
      val links = Utils.formHtml(pageReq).actLinks(postId)
      OkHtml(links)
    }


  def viewPost(pathIn: PagePath) = PageGetAction(pathIn) {
        pageReq =>
    val userPageDataJson = pageReq.user.isEmpty ? "" | buildUserPageDataJson(pageReq)
    // If not logged in, then include an empty Yaml tag, so the browser
    // notices that it got that elem, and won't call GET ?page-info.
    val infoNode = <pre class='dw-user-page-data'>{userPageDataJson}</pre>
    val pageHtml =
      pageReq.dao.renderTemplate(pageReq, appendToBody = infoNode)
    Ok(pageHtml) as HTML
  }


  /**
   * Lists e.g. all posts and ratings by a certain user, on a page.
   *
   * Initially, on page load, all (?) this info is already implicitly included
   * in the html sent by the server, e.g. the user's own posts are highlighted.
   * However, the user might logout and login, without refreshing the page,
   * so we need a way for the browser to fetch authorship info
   * dynamically.
   */
  // COULD rename to listUserPageData?
  def showPageInfo(pathIn: PagePath) = PageGetAction(pathIn) { pageReq =>
    if (!pageReq.request.rawQueryString.contains("&user=me"))
      throwBadReq("DwE0GdZ22", "Right now you need to specify ``&user=me''.")
    val json = buildUserPageDataJson(pageReq)
    Ok(json)
  }


  def buildUserPageDataJson(pageReq: PageRequest[_]): String = {
    import pageReq.{permsOnPage => perms}
    val page = pageReq.page_!
    val my = pageReq.user_!

    // List permissions.
    val permsMap = Map(
      "accessPage" -> perms.accessPage.toString,
      "createPage" -> perms.createPage.toString,
      "moveRenamePage" -> perms.moveRenamePage.toString,
      "hidePageIdInUrl" -> perms.hidePageIdInUrl.toString,
      "editPageTemplate" -> perms.editPageTemplate.toString,
      "editPage" -> perms.editPage.toString,
      "editAnyReply" -> perms.editAnyReply.toString,
      "editGuestReply" -> perms.editUnauReply.toString,
      "collapseThings" -> perms.collapseThings.toString,
      "deleteAnyReply" -> perms.deleteAnyReply.toString)

    // List posts by this user, so they can be highlighted.
    val ownPostsIdsList = page.postsByUser(withId = my.id).map(_.id)

    // List the user's ratings so they can be highlighted so the user
    // won't rate the same post again and again and again each day.
    // COULD list only the very last rating per post (currently all old
    // overwritten ratings are included).
    var ownRatingsMap = Map[String, JsValue]()
    for (rating <- page.ratingsByUser(withId = my.id)) {
      ownRatingsMap += rating.postId.toString -> toJson(rating.tags)
    }

    // Generate html for any posts-by-this-user that are pending approval. Plus info
    // on ancestor post ids, so the browser knows where to insert the html.
    val postsOfInterest = if (my.isAdmin) page.getAllPosts else page.postsByUser(my.id)
    val pendingPosts = postsOfInterest.filter(!_.currentVersionReviewed)
    val pendingPostsJsPatches: List[BrowserPagePatcher.JsPatch] =
      BrowserPagePatcher(pageReq).jsonForThreadPatches(page, pendingPosts.map(_.id))

    // (COULD include HTML for any notifications to the user.
    // Not really related to the current page only though.)
    // reply ++= "\nnotfs: ..."

    val json = toJson(Map(
      "permsOnPage" -> toJson(permsMap),
      "authorOf" -> toJson(ownPostsIdsList),
      "ratings" -> toJson(ownRatingsMap),
      // Suddenly using a by-page-id map is a bit weird, but what debiki-patch-page.ls
      // currently expects. Could map *everything* in the page id instead?
      // (Background: This is supposed to work on e.g. pages that lists many blog posts,
      // i.e. many pages.)
      "threadsByPageId" -> toJson(Map(
          page.id -> toJson(pendingPostsJsPatches)))))

    if (Play.isDev) Json.prettyPrint(json)
    else Json.stringify(json)
  }

}
