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
    val page = pageReq.page_!
    val my = pageReq.user_!

    val permsMap = ReactJson.permsOnPageJson(pageReq.permsOnPage)

    val rolePageSettings =
      pageReq.anyRoleId map { roleId =>
        val settings = pageReq.dao.loadRolePageSettings(roleId = roleId, pageId = page.id)
        ReactJson.rolePageSettingsToJson(settings)
      } getOrElse JsNull

    val json = toJson(Map(
      "isAdmin" -> toJson(pageReq.user.map(_.isAdmin).getOrElse(false)),
      "permsOnPage" -> toJson(permsMap),
      "rolePageSettings" -> rolePageSettings))

    if (Play.isDev) Json.prettyPrint(json)
    else Json.stringify(json)
  }

}
