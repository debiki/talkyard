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
import debiki.EdHttp._
import ed.server._
import ed.server.auth.Authz
import javax.inject.Inject
import play.api.libs.json.{JsArray, JsValue, Json}
import play.api.mvc._


/** Saves a {{{<form>}}} as either 1) a new reply, in JSON (for the db) + Yaml (for presentation),
  * or as 2) a new topic — then in title + human friendly body.
  */
class CustomFormController @Inject()(cc: ControllerComponents, edContext: EdContext)
  extends EdController(cc, edContext) {

  import context.security.{throwIndistinguishableNotFound, throwNoUnless}


  def handleJsonReply: Action[JsValue] = PostJsonAction(
        RateLimits.PostReply, maxBytes = MaxPostSize) { request =>
    import request.dao

    val pageId = (request.body \ "pageId").as[PageId]
    val formInputs = (request.body \ "formInputs").as[JsArray]
    val textAndHtml = dao.textAndHtmlMaker.withCompletedFormData(formInputs) getOrIfBad { errorMessage =>
      throwBadRequest("EsE7YK4W0", s"Bad form inputs JSON: $errorMessage")
    }

    val pageMeta = dao.getPageMeta(pageId) getOrElse
      throwIndistinguishableNotFound("EdE2WK0F")

    val categoriesRootLast = dao.getAncestorCategoriesRootLast(pageMeta.categoryId)

    // (A bit weird, here we authz with Authz.maySubmitCustomForm(), but later in
    // PostsDao.insertReply via Authz.mayPostReply() — but works okay.)
    throwNoUnless(Authz.maySubmitCustomForm(
      request.userAndLevels, dao.getGroupIdsOwnFirst(request.user),
      pageMeta, inCategoriesRootLast = categoriesRootLast,
      tooManyPermissions = dao.getPermsOnPages(categoriesRootLast)),
      "EdE2TE4A0")

    request.dao.insertReply(textAndHtml, pageId, Set.empty, PostType.CompletedForm,
        deleteDraftNr = None, request.whoOrUnknown, request.spamRelatedStuff)
    Ok
  }


  def handleNewTopic: Action[JsValue] = PostJsonAction(
        RateLimits.PostReply, maxBytes = MaxPostSize) { request =>
    import request.dao

    val pageTypeIdString = (request.body \ "pageTypeId").as[String]
    val pageTypeId = pageTypeIdString.toIntOption.getOrThrowBadArgument("EsE6JFU02", "pageTypeId")
    val pageType = PageType.fromInt(pageTypeId).getOrThrowBadArgument("EsE39PK01", "pageTypeId")
    val titleText = (request.body \ "newTopicTitle").as[String]
    val bodyText = (request.body \ "newTopicBody").as[String]
    val titleTextAndHtml = dao.textAndHtmlMaker.forTitle(titleText)
    val bodyTextAndHtml = dao.textAndHtmlMaker.forBodyOrCommentAsPlainTextWithLinks(bodyText)

    // BUG (need not fix now) if there are many sub communities with the same category slug. [4GWRQA28]
    val categorySlug = (request.body \ "categorySlug").as[String]
    val category = request.dao.getCategoryBySlug(categorySlug).getOrThrowBadArgument(
        "EsE0FYK42", s"No category with slug: $categorySlug")

    val pagePath = request.dao.createPage(pageType, PageStatus.Published, Some(category.id),
      anyFolder = None, anySlug = None, titleTextAndHtml, bodyTextAndHtml,
      showId = true, deleteDraftNr = None,
      request.who, request.spamRelatedStuff)

    OkSafeJson(Json.obj("newPageId" -> pagePath.pageId))
  }

}
