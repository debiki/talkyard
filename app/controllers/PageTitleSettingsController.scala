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
import debiki.EdHttp._
import ed.server.{EdContext, EdController}
import ed.server.http._
import javax.inject.Inject
import play.api.libs.json._
import play.api.mvc.{Action, ControllerComponents}
import talkyard.server.JsX.{JsStringOrNull, JsPageMeta}


/** Edits the page title and changes settings like forum category, URL path,
  * which layout to use, <html><head><title> and description.
  */
class PageTitleSettingsController @Inject()(cc: ControllerComponents, edContext: EdContext)
  extends EdController(cc, edContext) {


  def editTitleSaveSettings: Action[JsValue] = PostJsonAction(RateLimits.EditPost, maxBytes = 2000) {
        request: JsonPostRequest =>
    import request.{dao, theRequester => requester}

    val pageId = (request.body \ "pageId").as[PageId]
    val anyNewTitle = (request.body \ "newTitle").asOptStringNoneIfBlank
    val anyNewCategoryId = (request.body \ "categoryId").asOpt[CategoryId]
    val anyNewRoleInt = (request.body \ "pageRole").asOpt[Int]
    val anyDoingStatusInt = (request.body \ "doingStatus").asOpt[Int]
    val anyFolder = (request.body \ "folder").asOpt[String] map { folder =>
      if (folder.trim.isEmpty) "/" else folder.trim
    }
    val anySlug = (request.body \ "slug").asOptStringNoneIfBlank
    val anyShowId = (request.body \ "showId").asOpt[Boolean]
    val anyLayout = (request.body \ "pageLayout").asOpt[Int].flatMap(PageLayout.fromInt)
    val anyHtmlTagCssClasses = (request.body \ "htmlTagCssClasses").asOptStringNoneIfBlank
    val anyHtmlHeadTitle = (request.body \ "htmlHeadTitle").asOptStringNoneIfBlank
    val anyHtmlHeadDescription = (request.body \ "htmlHeadDescription").asOptStringNoneIfBlank

    val anyNewRole: Option[PageType] = anyNewRoleInt map { newRoleInt =>
      PageType.fromInt(newRoleInt) getOrElse throwBadArgument("DwE4GU8", "pageRole")
    }

    val anyNewDoingStatus: Option[PageDoingStatus] = anyDoingStatusInt map { value =>
      PageDoingStatus.fromInt(value) getOrElse throwBadArgument("TyE2ABKR04", "doingStatus")
    }

    val hasManuallyEditedSlug = anySlug.exists(slug => {
      // The user interface currently makes impossible to post a new slug, without a page title.
      val title = anyNewTitle getOrElse throwForbidden("TyE2AKBF05", "Cannot post slug but not title")
      slug != context.nashorn.slugifyTitle(title)
    })

    if (anyLayout.isDefined) {
      throwForbiddenIf(!request.theUser.isAdmin,
        "EdE7PK4QL", "Only admins may change the topic list layout")
      throwForbiddenIf(anyNewRole.exists(_ != PageType.Forum),
        "EdEZ5FK20", "Cannot change topic list layout and page type at the same time")
    }

    val oldMeta = request.dao.getPageMeta(pageId) getOrElse throwNotFound(
      "DwE4KEF20", "The page was deleted just now")

    val pageTypeAfter = anyNewRole getOrElse oldMeta.pageType

    throwForbiddenIf(oldMeta.pageType == PageType.AboutCategory,  //  [4AKBE02]
      "TyEEDCATDSCTTL", "Don't edit the category description topic title — edit the topic text instead")

    throwForbiddenIf(pageTypeAfter != oldMeta.pageType && !oldMeta.pageType.mayChangeRole,
      "DwE5KGU02", s"Cannot change page role ${oldMeta.pageType} to something else")

    throwForbiddenIf(anyNewDoingStatus.isDefined && !pageTypeAfter.hasDoingStatus,
      "TyE0PGDNGSTS", s"Pages of type $pageTypeAfter shouldn't have a doing-status")

    throwForbiddenIf(anyLayout.isDefined && pageTypeAfter != PageType.Forum,
      "EdE5FKL0P", "Can only specify topic list layout for forum pages")

    // Authorization.
    SECURITY; SHOULD // do same authz checks as when editing posts?
    // throwNoUnless(Authz.mayEditPost(  ... ?  Not so urgent, mods somewhat ok to trust?
    // Fix this, by moving this impl to a (new?) Dao? And look at:  PostsDao.editPostIfAuth(...)
    if (!request.theUser.isStaff && request.theUserId != oldMeta.authorId)
      throwForbidden("TyECHOTRPGS", "You may not change other people's pages")

    if (anyFolder.isDefined || hasManuallyEditedSlug || anyShowId.isDefined) {
      if (!request.theUser.isAdmin)
        throwForbidden("DwE5KEP8", o"""Only admins may change the URL path
           and certain other stuff""")
    }

    if (anyNewRole.is(PageType.Forum) || (anyNewRole.isEmpty && oldMeta.pageType == PageType.Forum)) {
      throwForbiddenIf(anyShowId.is(true), "TyE22PKGEW0", "Forum pages should not show the page id.")
      throwForbiddenIf(anySlug.isDefined, "TyE2PKDPU0", "Forum pages should have no page slug")
    }

    // For now, disallow slugs like 'latest', 'top', 'unread' etc — because right now
    // they'd be mistaken for forum sort orders. [5AQXJ2]
    anySlug foreach { slug =>
      if (slug == "latest" || slug == "active" || slug == "new" || slug == "top" || slug == "unread")
        throwForbidden("TyE2PKHWR0", s"Page slug '$slug' is currently reserved, use something else")
    }

    // SECURITY COULD prevent non-admins from changing the title of pages other than forum topics.
    // (A moderator shouldn't be able to rename the whole forum, or e.g. the about-us page.)

    // Bad request?
    if (anyFolder.exists(!PagePath.isOkayFolder(_)))
      throwBadReq("DwE4KEF23", "Bad folder, must be like: '/some/folder/'")

    if (anySlug.exists(!PagePath.isOkaySlug(_)))
      throwBadReq("DwE6KEF21", "Bad slug, must be like: 'some-page-slug'")

    if (anyNewTitle.exists(_.length > MaxTitleLength))
      throwBadReq("DwE8KYU2", s"Title too long, max length is $MaxTitleLength")

    if (anyHtmlTagCssClasses.exists(!HtmlUtils.OkCssClassRegex.matches(_)))
      throwBadReq("DwE5kEF2", s"Bad CSS class, doesn't match: ${HtmlUtils.OkCssClassRegexText}")

    val editsHtmlStuff = anyHtmlTagCssClasses.isDefined || anyHtmlHeadTitle.isDefined ||
      anyHtmlHeadDescription.isDefined
    if (editsHtmlStuff && !request.theMember.isStaff)
      throwForbidden("EdE4WU8F2", "You may not edit CSS classes or HTML tags")

    RACE; BUG // minor, below: First title committed, then page settings. If the server crashes in
    // between, only the title will be changed — that's fairly okay I think; ignore for now.
    // Also, if two separate requests, then one might edit the title, the other the slug, with
    // weird results. Totally unlikely to happen. Ignore for now.
    //
    BUG // minor. The lost update bug, when changing path and meta, if two people call this endpoint at
    // exactly the same time. Ignore for now, it's just that all changes won't be saved,
    // but the page will still be in an okay state afterwards.

    // Update page title.
    anyNewTitle foreach { newTitle => {
      val newTextAndHtml = dao.textAndHtmlMaker.forTitle(newTitle)
      request.dao.editPostIfAuth(pageId = pageId, postNr = PageParts.TitleNr, deleteDraftNr = None,
        request.who, request.spamRelatedStuff, newTextAndHtml)
    }}

    // Load old section page id before changing it.
    val oldSectionPageId: Option[PageId] = oldMeta.categoryId map request.dao.loadTheSectionPageId

    // Update page settings.
    var newMeta = oldMeta
    newMeta = anyNewRole.map(newMeta.copyWithNewRole).getOrElse(newMeta)
    newMeta = anyNewDoingStatus.map(s =>
      newMeta.copyWithNewDoingStatus(s, context.globals.now())).getOrElse(newMeta)
    val addsNewDoingStatusMetaPost = newMeta.doingStatus != oldMeta.doingStatus
    newMeta = newMeta.copy(
      categoryId = anyNewCategoryId.orElse(oldMeta.categoryId),
      htmlTagCssClasses = anyHtmlTagCssClasses.getOrElse(oldMeta.htmlTagCssClasses),
      htmlHeadTitle = anyHtmlHeadTitle.getOrElse(oldMeta.htmlHeadTitle),
      htmlHeadDescription = anyHtmlHeadDescription.getOrElse(oldMeta.htmlHeadDescription),
      layout = anyLayout.getOrElse(oldMeta.layout),
      // A meta post about changing the doingStatus.
      numPostsTotal = oldMeta.numPostsTotal + (addsNewDoingStatusMetaPost ? 1 | 0),
      version = oldMeta.version + 1)

    request.dao.readWriteTransaction { tx =>  // COULD wrap everything in this transaction
                                                        // and move it to PagesDao?
      tx.updatePageMeta(newMeta, oldMeta = oldMeta, markSectionPageStale = true)
      if (addsNewDoingStatusMetaPost) {
        dao.addMetaMessage(requester, s" marked this topic as ${newMeta.doingStatus}", pageId, tx)
      }
      if (newMeta.categoryId != oldMeta.categoryId) {
        tx.indexAllPostsOnPage(pageId)
      }
      // Should: Update audit log
    }

    // Update URL path (folder, slug, show/hide page id).
    // The last thing we do, update the url path, so it cannot happen that we change the
    // url path, but then afterwards something else fails so we reply error — that would
    // be bad because the browser wouldn't know if it should update its url path or not.
    var newPath: Option[PagePathWithId] = None
    if (anyFolder.orElse(anySlug).orElse(anyShowId).isDefined) {
      try {
        newPath = Some(
          request.dao.moveRenamePage(
            pageId, newFolder = anyFolder, newSlug = anySlug, showId = anyShowId))
      }
      catch {
        case ex: DbDao.PageNotFoundException =>
          throwNotFound("DwE34FK81", "The page was deleted just now")
        case DbDao.PathClashException(newPagePath) =>
          throwForbidden(
            "DwE4FKEU5", o"""Cannot move page '$pageId' to ${newPagePath.value}. There is
              already another page there. Please move that page elsewhere, first""")
      }
    }

    if (newMeta.isChatPinnedGlobally != oldMeta.isChatPinnedGlobally) {
      // If is pinned globally, and we changed topic type to/from chat, then this page will/no-longer
      // be pinned in the watchbar. Then need to rerender the watchbar, affects all pages. [0GPHSR4]
      // Also: [ZBK2F4E]
      request.dao.emptyCache()
    }
    else {
      // Refresh cache, plus any forum page if this page is a forum topic.
      // (Forum pages cache category JSON and a latest topics list, includes titles.)
      val newSectionPageId = newMeta.categoryId map request.dao.loadTheSectionPageId
      val idsToRefresh = (pageId :: oldSectionPageId.toList ::: newSectionPageId.toList).distinct
      idsToRefresh.foreach(request.dao.refreshPageInMemCache)
    }

    val (_, newAncestorsJson) = dao.jsonMaker.makeForumIdAndAncestorsJson(newMeta)
    // The browser will update the title and the url path in the address bar.
    OkSafeJson(Json.obj(  // ts if EditPageResponse
      "newTitlePost" -> dao.jsonMaker.postToJson2(postNr = PageParts.TitleNr, pageId = pageId,
          includeUnapproved = true),
      "newAncestorsRootFirst" -> newAncestorsJson,
      "newUrlPath" -> JsStringOrNull(newPath.map(_.value)),
      "newPageMeta" -> JsPageMeta(newMeta)))  // [7RGEF24]
  }

}

