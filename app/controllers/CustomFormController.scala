/**
 * Copyright (C) 2015-2016 Kaj Magnus Lindberg
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

import com.debiki.core._
import com.debiki.core.Prelude._
import debiki._
import debiki.DebikiHttp._
import ed.server._
import io.efdi.server.http._
import play.api.libs.json.{JsArray, Json}
import play.api.mvc


/** Saves a {{{<form>}}} as either 1) a new reply, in JSON (for the db) + Yaml (for presentation),
  * or as 2) a new topic — then in title + human friendly body.
  */
object CustomFormController extends mvc.Controller {


  def handleJsonReply = PostJsonAction(RateLimits.PostReply, maxLength = MaxPostSize) { request =>
    val pageId = (request.body \ "pageId").as[PageId]
    val formInputs = (request.body \ "formInputs").as[JsArray]
    val textAndHtml = TextAndHtml.withCompletedFormData(formInputs) getOrIfBad { errorMessage =>
      throwBadRequest("EsE7YK4W0", s"Bad form inputs JSON: $errorMessage")
    }
    request.dao.insertReply(textAndHtml, pageId, Set.empty, PostType.CompletedForm,
        request.whoOrUnknown, request.spamRelatedStuff)
    Ok
  }


  def handleNewTopic = PostJsonAction(RateLimits.PostReply, maxLength = MaxPostSize) { request =>
    val pageTypeIdString = (request.body \ "pageTypeId").as[String]
    val pageTypeId = pageTypeIdString.toIntOption.getOrThrowBadArgument("EsE6JFU02", "pageTypeId")
    val pageType = PageRole.fromInt(pageTypeId).getOrThrowBadArgument("EsE39PK01", "pageTypeId")
    val titleText = (request.body \ "newTopicTitle").as[String]
    val bodyText = (request.body \ "newTopicBody").as[String]
    val titleTextAndHtml = TextAndHtml.forTitle(titleText)
    val bodyTextAndHtml = TextAndHtml.forBodyOrCommentAsPlainTextWithLinks(bodyText)

    val categorySlug = (request.body \ "categorySlug").as[String]
    val category = request.dao.loadCategoryBySlug(categorySlug).getOrThrowBadArgument(
        "EsE0FYK42", s"No category with slug: $categorySlug")

    val pagePath = request.dao.createPage(pageType, PageStatus.Published, Some(category.id),
      anyFolder = None, anySlug = None, titleTextAndHtml, bodyTextAndHtml,
      showId = true, request.who, request.spamRelatedStuff)

    OkSafeJson(Json.obj("newPageId" -> pagePath.pageId.getOrDie("DwE8GIK9")))
  }

}
