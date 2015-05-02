/**
 * Copyright (C) 2012 Kaj Magnus Lindberg (born 1979)
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

import actions.ApiActions.PostJsonAction
import com.debiki.core._
import com.debiki.core.Prelude._
import debiki._
import debiki.DebikiHttp._
import play.api._
import play.api.libs.json.Json
import Utils._


/** Creates pages.
  */
object CreatePageController extends mvc.Controller {


  def createPage = PostJsonAction(RateLimits.CreateTopic, maxLength = 20 * 1000) { request =>
    import request.{dao, body}

    val anyParentPageId = (body \ "parentPageId").asOpt[PageId]
    val pageRoleStr = (body \ "pageRole").as[String]
    val pageRole = PageRole.parse(pageRoleStr)
    val pageStatusStr = (body \ "pageStatus").as[String]
    val pageStatus = PageStatus.parse(pageStatusStr)
    val anyFolder = (body \ "folder").asOpt[String]
    val titleText = (body \ "pageTitle").as[String]
    val bodyText = (body \ "pageBody").as[String]
    val showId = (body \ "showId").asOpt[Boolean].getOrElse(true)
    val pageSlug = (body \ "pageSlug").asOpt[String].getOrElse(
      "new-forum-topic") // for now, ought to slugify title

    val pagePath = request.dao.createPage2(pageRole, pageStatus, anyParentPageId, anyFolder,
      titleText, bodyText, showId, pageSlug = pageSlug, authorId = request.theUser.id)

    OkSafeJson(Json.obj("newPageId" -> pagePath.pageId.getOrDie("DwE8GIK9")))
  }

  /* Later: When creating a new category, also create a category definition page:
    i"""
      |[Replace this first paragraph with a short description of this category.
      |Please keep it short — the text will appear on the category list page.]
      |
      |Here, after the first paragraph, you can add a longer description, with
      |for example category guidelines or rules.
      |
      |Below in the comments section, you can discuss this category. For example,
      |should it be merged with another category? Or should it be split
      |into many categories?
      |"""
   */

}
