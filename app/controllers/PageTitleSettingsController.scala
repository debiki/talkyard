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

import com.debiki.core._
import com.debiki.core.Prelude._
import com.debiki.core.PageParts.MaxTitleLength
import debiki._
import debiki.DebikiHttp._
import debiki.ReactJson.JsStringOrNull
import io.efdi.server.http._
import play.api._
import play.api.libs.json._
import play.api.mvc.{Action => _, _}
import scala.concurrent.ExecutionContext.Implicits.global


/** Edits the page title and changes settings like forum category, URL path,
  * which layout to use, <html><head><title> and description.
  */
object PageTitleSettingsController extends mvc.Controller {


  def editTitleSaveSettings = PostJsonAction(RateLimits.EditPost, maxBytes = 2000) {
        request: JsonPostRequest =>

    val pageId = (request.body \ "pageId").as[PageId]
    val newTitle = (request.body \ "newTitle").as[String].trim
    val anyNewCategoryId = (request.body \ "categoryId").asOpt[CategoryId]
    val anyNewRoleInt = (request.body \ "pageRole").asOpt[Int]
    val anyFolder = (request.body \ "folder").asOpt[String] map { folder =>
      if (folder.trim.isEmpty) "/" else folder.trim
    }
    val anySlug = (request.body \ "slug").asOptStringTrimmed
    val anyShowId = (request.body \ "showId").asOpt[Boolean]
    val anyLayout = (request.body \ "pageLayout").asOpt[Int].map(new PageLayout(_))
    val anyHtmlTagCssClasses = (request.body \ "htmlTagCssClasses").asOptStringTrimmed
    val anyHtmlHeadTitle = (request.body \ "htmlHeadTitle").asOptStringTrimmed
    val anyHtmlHeadDescription = (request.body \ "htmlHeadDescription").asOptStringTrimmed

    val anyNewRole: Option[PageRole] = anyNewRoleInt map { newRoleInt =>
      PageRole.fromInt(newRoleInt) getOrElse throwBadArgument("DwE4GU8", "pageRole")
    }

    val hasManuallyEditedSlug = anySlug.exists(slug =>
      slug != ReactRenderer.slugifyTitle(newTitle))

    if (anyLayout.isDefined) {
      throwForbiddenIf(!request.theUser.isAdmin,
        "EdE7PK4QL", "Only admins may change the topic list layout")
      throwForbiddenIf(anyNewRole.exists(_ != PageRole.Forum),
        "EdEZ5FK20", "Cannot change topic list layout and page type at the same time")
    }

    val oldMeta = request.dao.getPageMeta(pageId) getOrElse throwNotFound(
      "DwE4KEF20", "The page was deleted just now")

    if (anyNewRole.exists(_ != oldMeta.pageRole) && !oldMeta.pageRole.mayChangeRole)
      throwForbidden("DwE5KGU02", s"Cannot change page role ${oldMeta.pageRole} to something else")

    throwForbiddenIf(anyLayout.isDefined && oldMeta.pageRole != PageRole.Forum,
      "EdE5FKL0P", "Can only specify topic list layout for forum pages")

    // Authorization.
    if (!request.theUser.isStaff && request.theUserId != oldMeta.authorId)
      throwForbidden("DwE4KEP2", "You may not rename this page")

    if (anyFolder.isDefined || hasManuallyEditedSlug || anyShowId.isDefined) {
      if (!request.theUser.isAdmin)
        throwForbidden("DwE5KEP8", o"""Only admins may change the URL path
           and certain other stuff""")
    }

    // SECURITY COULD prevent non-admins from changing the title of pages other than forum topics.
    // (A moderator shouldn't be able to rename the whole forum, or e.g. the about-us page.)

    // Bad request?
    if (anyFolder.exists(!PagePath.isOkayFolder(_)))
      throwBadReq("DwE4KEF23", "Bad folder, must be like: '/some/folder/'")

    if (anySlug.exists(!PagePath.isOkaySlug(_)))
      throwBadReq("DwE6KEF21", "Bad slug, must be like: 'some-page-slug'")

    if (newTitle.length > MaxTitleLength)
      throwBadReq("DwE8KYU2", s"Title too long, max length is $MaxTitleLength")

    if (anyHtmlTagCssClasses.exists(!HtmlUtils.OkCssClassRegex.matches(_)))
      throwBadReq("DwE5kEF2", s"Bad CSS class, doesn't match: ${HtmlUtils.OkCssClassRegexText}")

    val editsHtmlStuff = anyHtmlTagCssClasses.isDefined || anyHtmlHeadTitle.isDefined ||
      anyHtmlHeadDescription.isDefined
    if (editsHtmlStuff && !request.theMember.isStaff)
      throwForbidden("EdE4WU8F2", "You may not edit CSS classes or HTML tags")

    // Race condition below: First title committed, then page settings. If the server crashes in
    // between, only the title will be changed — that's fairly okay I think; ignore for now.
    // Also, if two separate requests, then one might edit the title, the other the slug, with
    // weird results. Totally unlikely to happen. Ignore for now.
    //
    // And the lost update bug, when changing path and meta, if two people call this endpoint at
    // exactly the same time. Ignore for now, it's just that all changes won't be saved,
    // but the page will still be in an okay state afterwards.

    // Update page title.
    val newTextAndHtml = TextAndHtml(newTitle, isTitle = true)

    request.dao.editPostIfAuth(pageId = pageId, postNr = PageParts.TitleNr,
      request.who, request.spamRelatedStuff, newTextAndHtml)

    // Load old section page id before changing it.
    val oldSectionPageId: Option[PageId] = oldMeta.categoryId map request.dao.loadTheSectionPageId

    // Update page settings.
    var newMeta = anyNewRole.map(oldMeta.copyWithNewRole).getOrElse(oldMeta)
    newMeta = newMeta.copy(
      categoryId = anyNewCategoryId.orElse(oldMeta.categoryId),
      htmlTagCssClasses = anyHtmlTagCssClasses.getOrElse(oldMeta.htmlTagCssClasses),
      htmlHeadTitle = anyHtmlHeadTitle.getOrElse(oldMeta.htmlHeadTitle),
      htmlHeadDescription = anyHtmlHeadDescription.getOrElse(oldMeta.htmlHeadDescription),
      layout = anyLayout.getOrElse(oldMeta.layout),
      version = oldMeta.version + 1)

    request.dao.readWriteTransaction { transaction =>  // COULD wrap everything in this transaction
                                                        // and move it to PagesDao?
      transaction.updatePageMeta(newMeta, oldMeta = oldMeta, markSectionPageStale = true)
      if (newMeta.categoryId != oldMeta.categoryId) {
        transaction.indexAllPostsOnPage(pageId)
      }
    }

    // Update URL path (folder, slug, show/hide page id).
    // The last thing we do, update the url path, so it cannot happen that we change the
    // url path, but then afterwards something else fails so we reply error — that would
    // be bad because the browser wouldn't know if it should update its url path or not.
    var newPath: Option[PagePath] = None
    if (anyFolder.orElse(anySlug).orElse(anyShowId).isDefined) {
      try {
        newPath = Some(
          request.dao.moveRenamePage(
            pageId, newFolder = anyFolder, newSlug = anySlug, showId = anyShowId))
      }
      catch {
        case ex: DbDao.PageNotFoundException =>
          throwNotFound("DwE34FK81", "The page was deleted just now")
        case DbDao.PathClashException(existingPagePath, newPagePath) =>
          throwForbidden(
            "DwE4FKEU5", o"""Cannot move page to ${existingPagePath.value}. There is
              already another page there. Please move that page elsewhere, first""")
      }
    }

    // Refresh cache, plus any forum page if this page is a forum topic.
    // (Forum pages cache category JSON and a latest topics list, includes titles.)
    val newSectionPageId = newMeta.categoryId map request.dao.loadTheSectionPageId
    val idsToRefresh = (pageId :: oldSectionPageId.toList ::: newSectionPageId.toList).distinct
    idsToRefresh.foreach(request.dao.refreshPageInMemCache)

    val (_, newAncestorsJson) = ReactJson.makeForumIdAndAncestorsJson(newMeta, request.dao)

    // The browser will update the title and the url path in the address bar.
    OkSafeJson(Json.obj(
      "newTitlePost" -> ReactJson.postToJson2(postNr = PageParts.TitleNr, pageId = pageId,
          request.dao, includeUnapproved = true),
      "newAncestorsRootFirst" -> newAncestorsJson,
      "newUrlPath" -> JsStringOrNull(newPath.map(_.value))))
  }

}

