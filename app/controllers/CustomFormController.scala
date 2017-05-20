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
import ed.server.auth.Authz
import ed.server.http._
import play.api.libs.json.{JsArray, JsValue, Json}
import play.api.mvc
import play.api.mvc.Action


/** Saves a {{{<form>}}} as either 1) a new reply, in JSON (for the db) + Yaml (for presentation),
  * or as 2) a new topic — then in title + human friendly body.
  */
object CustomFormController extends mvc.Controller {


  def handleJsonReply: Action[JsValue] = PostJsonAction(
        RateLimits.PostReply, maxBytes = MaxPostSize) { request =>

    val pageId = (request.body \ "pageId").as[PageId]
    val formInputs = (request.body \ "formInputs").as[JsArray]
    val textAndHtml = TextAndHtml.withCompletedFormData(formInputs) getOrIfBad { errorMessage =>
      throwBadRequest("EsE7YK4W0", s"Bad form inputs JSON: $errorMessage")
    }

    val dao = request.dao
    val pageMeta = dao.getPageMeta(pageId) getOrElse
      throwIndistinguishableNotFound("EdE2WK0F")

    val categoriesRootLast = dao.loadAncestorCategoriesRootLast(pageMeta.categoryId)

    // (A bit weird, here we authz with Authz.maySubmitCustomForm(), but later in
    // PostsDao.insertReply via Authz.mayPostReply() — but works okay.)
    throwNoUnless(Authz.maySubmitCustomForm(
      request.userAndLevels, request.user.map(dao.getGroupIds).getOrElse(Nil),
      pageMeta, inCategoriesRootLast = categoriesRootLast,
      permissions = dao.getPermsOnPages(categoriesRootLast)),
      "EdE2TE4A0")

    request.dao.insertReply(textAndHtml, pageId, Set.empty, PostType.CompletedForm,
        request.whoOrUnknown, request.spamRelatedStuff)
    Ok
  }


  def handleNewTopic: Action[JsValue] = PostJsonAction(
        RateLimits.PostReply, maxBytes = MaxPostSize) { request =>

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


  def handleUsabilityTestingForm: Action[JsValue] = PostJsonAction(
        RateLimits.PostReply, maxBytes = MaxPostSize) { request =>  // [plugin]

    val pageTypeIdString = (request.body \ "pageTypeId").as[String]
    val pageTypeId = pageTypeIdString.toIntOption.getOrThrowBadArgument("EsE6JFU02", "pageTypeId")
    val pageType = PageRole.fromInt(pageTypeId).getOrThrowBadArgument("EsE39PK01", "pageTypeId")

    val addressOfWebsiteToTest: String = {
      val address = (request.body \ "websiteAddress").as[String]
      if (address.matches("https?://")) address else s"http://$address"
    }
    if (addressOfWebsiteToTest.count(_ == ':') > 1)
      throwBadRequest("EdE7FKWU0", "Too many protocols (':') in website address")
    if (addressOfWebsiteToTest.exists("<>[](){}'\"\n\t\\ " contains _))
      throwBadRequest("EdE2WXBP6", "Weird character(s) in website address")

    val titleText = addressOfWebsiteToTest.replaceFirst("https?://", "")

    // This'll be sanitized.
    val instructions = (request.body \ "instructionsToTester").as[String]
    val bodyText = i"""
       |**Go here:** [$titleText]($addressOfWebsiteToTest)
       |
       |**Then answer these questions, and follow the instructions:**
       |
       |$instructions
       """

    val titleTextAndHtml = TextAndHtml.forTitle(titleText)
    val bodyTextAndHtml = TextAndHtml.forBodyOrCommentAsPlainTextWithLinks(bodyText)

    val categorySlug = (request.body \ "categorySlug").as[String]
    val category = request.dao.loadCategoryBySlug(categorySlug).getOrThrowBadArgument(
      "EsE0FYK42", s"No category with slug: $categorySlug")

    val pagePath = request.dao.createPage(pageType, PageStatus.Published, Some(category.id),
      anyFolder = None, anySlug = None, titleTextAndHtml, bodyTextAndHtml,
      showId = true, request.who, request.spamRelatedStuff)

    Ok /*
    if (request.isAjax)
      OkSafeJson(Json.obj("nextUrl" -> nextUrl)) // pagePath.pageId.getOrDie("DwE8GIK9")))
    else
      TemporaryRedirect(nextUrl) */
  }
}
