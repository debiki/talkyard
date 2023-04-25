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
import debiki.JsonUtils.{parseOptInt32, asJsObject}
import debiki.JsonUtils.parseOptZeroSomeNone
import talkyard.server.{TyContext, TyController}
import talkyard.server.http._
import talkyard.server.authz.Authz
import javax.inject.Inject
import play.api.libs.json._
import play.api.mvc.{Action, ControllerComponents}
import talkyard.server.JsX.{JsStringOrNull, JsPageMeta}


/** Edits the page title and changes settings like forum category, URL path,
  * which layout to use, <html><head><title> and description.
  *
  * MOVE to PageController, right?  It's confusing to have 2 controllers that do
  * almost the same things.
  */
class PageTitleSettingsController @Inject()(cc: ControllerComponents, edContext: TyContext)
  extends TyController(cc, edContext) {

  import context.security.{throwNoUnless, throwIndistinguishableNotFound}

  def editTitleSaveSettings: Action[JsValue] = PostJsonAction(RateLimits.EditPost, maxBytes = 2000) {
        request: JsonPostRequest =>
    import request.{body, dao, theRequester => requester}

    val pageJo = asJsObject(request.body, "the request body")
    CLEAN_UP // use JsonUtils below, not '\'.
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
    val anyForumSearchBox = parseOptInt32(body, "forumSearchBox")
    val anyForumMainView = parseOptInt32(body, "forumMainView")
    val anyForumCatsTopics = parseOptInt32(body, "forumCatsTopics")

    // Dupl code, will remove after [add_nodes_t].
    // If the requester isn't staff, these aren't sent, become None.  [onl_staff_set_comt_ord]
    // If is staff, then can be Some(Some(value)), or Some(None) to clear and inherit instead
    // from anc cats.
    val anyComtOrder: Opt[Opt[PostSortOrder]] =
          parseOptZeroSomeNone(request.body, "comtOrder")(PostSortOrder.fromOptVal)
    val anyComtNesting: Opt[Opt[ComtNesting_later]] =
          parseOptZeroSomeNone(request.body, "comtNesting")(x => x.map(_.toShort))

    val comtsStartHidden = NeverAlways.fromOptInt(parseOptInt32(pageJo, "comtsStartHidden"))
    val comtsStartAnon = NeverAlways.fromOptInt(parseOptInt32(pageJo, "comtsStartAnon"))
    val newAnonStatus = AnonStatus.fromOptInt(parseOptInt32(pageJo, "newAnonStatus"))

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

    // Core members may change the page type (e.g. from Discussion to Idea), and
    // doing status, of pages they can see. Later, there will instead be
    // can-alter-page permissions.  [alterPage]
    val changesOnlyTypeOrStatus =
          // If we got the page id (required, always present) and exactly one more field, ...
          pageJo.value.size == 2 &&
          // ... and it is the page type or doing status, then, pat is trying to change,
          // well, only the type or doing status.  Nothing else.
          (anyNewDoingStatus.isDefined || anyNewRole.isDefined)

    // AuthZ check 1/3:
    // Could skip authz check 2/3 below: [.dbl_auz] ?
    val oldCatsRootLast = dao.getAncestorCategoriesRootLast(oldMeta.categoryId)
    val requestersGroupIds = dao.getOnesGroupIds(requester)
    throwNoUnless(Authz.mayEditPage(
          pageMeta = oldMeta,
          pat = requester,
          groupIds = requestersGroupIds,
          pageMembers = dao.getAnyPrivateGroupTalkMembers(oldMeta),
          catsRootLast = oldCatsRootLast,
          tooManyPermissions = dao.getPermsOnPages(oldCatsRootLast),
          changesOnlyTypeOrStatus = changesOnlyTypeOrStatus,
          maySeeUnlisted = true), "TyE0EDPGPRPS1")

    val pageTypeAfter = anyNewRole getOrElse oldMeta.pageType

    throwForbiddenIf(oldMeta.pageType == PageType.AboutCategory,  //  [4AKBE02]
      "TyEEDCATDSCTTL", "Don't edit the category description topic title — edit the topic text instead")

    throwForbiddenIf(pageTypeAfter != oldMeta.pageType && !oldMeta.pageType.mayChangeRole,
      "DwE5KGU02", s"Cannot change page role ${oldMeta.pageType} to something else")

    throwForbiddenIf(anyNewDoingStatus.isDefined && !pageTypeAfter.hasDoingStatus,
      "TyE0PGDNGSTS", s"Pages of type $pageTypeAfter shouldn't have a doing-status")

    throwForbiddenIf(anyLayout.isDefined && pageTypeAfter != PageType.Forum,
      "EdE5FKL0P", "Can only specify topic list layout for forum pages")

    // (Could incl `anyLayout` too)
    val forumViewChanged: Bo = anyForumSearchBox.isDefined ||
          anyForumMainView.isDefined || anyForumCatsTopics.isDefined
    throwForbiddenIf(forumViewChanged && pageTypeAfter != PageType.Forum,
          "TyE0FORMPGE", "Can only edit these properties for forum pages")

    throwForbiddenIf(
          !request.theUser.isStaff && anyComtOrder.isSomethingButNot(oldMeta.comtOrder),
          "TyEXCMTORD", "You may not change the comment sort order")

    throwForbiddenIf(
          !request.theUser.isStaff && anyComtNesting.isSomethingButNot(oldMeta.comtNesting),
          "TyEXCMTNST", "You may not change the comment nesting max depth")

    if (!request.theUser.isStaff && request.theUserId != oldMeta.authorId &&
          !(changesOnlyTypeOrStatus && request.theUser.isStaffOrCoreMember))
      throwForbidden("TyECHOTRPGS", "You may not change other people's pages")

    if (!request.theUser.isAdmin) {
      // Forum page URL.
      throwForbiddenIf(hasManuallyEditedSlug,
          "TyENEWPATH001", "Only admins may change the page slug")
      throwForbiddenIf(anyFolder.isDefined,
          "TyENEWPATH002", "Only admins can specify url/path/folders/")
      throwForbiddenIf(anyShowId.isDefined,
          "TyENEWPATH003", "Only admins can hide or show page ids")

      // How a forum looks.
      throwForbiddenIf(anyLayout.isDefined,
          "TyE0EDFORUMLAYT", "Only admins may edit forum topics layout")
      throwForbiddenIf(forumViewChanged,
          "TyE0EDFORUMPRPS", "Only admins may edit forum properties")
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

    if (anySlug.exists(_.length > PagePath.MaxSlugLength))
      throwBadReq("TyE5YWH3A", s"Bad page slug: Too long — max ${PagePath.MaxSlugLength} characters")

    if (anySlug.exists(!PagePath.isOkaySlug(_)))
      throwBadReq("TyE6KEF2B", "Bad page slug, must be like: 'some-page-slug'")

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
      // AuthZ check 2/3, unnecessary? We've already verified that pat may edit the page
      // (which includes editing the title).  [.dbl_auz]
      // Could do this in the same tx as updating the page meta below? [.ed_pg_1_tx]
      // Then we'd also access check the new category, if moving the page at the same time
      // as editing the title (doesn't matter? Pat could just edit the title first, then
      // move it, in a separate step.)
      val newTextAndHtml = dao.textAndHtmlMaker.forTitle(newTitle)
      request.dao.editPostIfAuth(pageId = pageId, postNr = PageParts.TitleNr, deleteDraftNr = None,
        request.who, request.spamRelatedStuff, newTextAndHtml)
    }}

    // Load old section page id before changing it.
    val oldSectionPageId: Option[PageId] = oldMeta.categoryId map request.dao.getTheSectionPageId

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
          forumSearchBox = anyForumSearchBox.orElse(oldMeta.forumSearchBox),
          forumMainView = anyForumMainView.orElse(oldMeta.forumMainView),
          forumCatsTopics = anyForumCatsTopics.orElse(oldMeta.forumCatsTopics),
          comtOrder = anyComtOrder getOrElse oldMeta.comtOrder,
          comtNesting = anyComtNesting getOrElse oldMeta.comtNesting,
          comtsStartHidden = comtsStartHidden,
          comtsStartAnon = comtsStartAnon,
          newAnonStatus = newAnonStatus,
          // A meta post about changing the doingStatus.
          numPostsTotal = oldMeta.numPostsTotal + (addsNewDoingStatusMetaPost ? 1 | 0),
          version = oldMeta.version + 1)

    // AuthZ check 3/3: May pat access any new category?
    // Later: If a Core Member wants to move a page to another category,  [core_move_page]
    // allow that, but only if no *additional* people then gets to see the page.
    // (But if fewer, that's ok.) — There'll also be [alterPage] maybe move page permissions.
    if (newMeta.categoryId != oldMeta.categoryId) {
      val newCatsRootLast = dao.getAncestorCategoriesRootLast(newMeta.categoryId)
      throwNoUnless(Authz.mayEditPage(
            pageMeta = newMeta,
            pat = requester,
            groupIds = requestersGroupIds,
            pageMembers = dao.getAnyPrivateGroupTalkMembers(newMeta),
            catsRootLast = newCatsRootLast,
            tooManyPermissions = dao.getPermsOnPages(newCatsRootLast),
            changesOnlyTypeOrStatus = changesOnlyTypeOrStatus,
            maySeeUnlisted = true), "TyE0EDPGPRPS2")
    }

    request.dao.writeTx { (tx, staleStuff) =>  // COULD wrap everything in this transaction
                                                // and move it to PagesDao? [.ed_pg_1_tx]
      tx.updatePageMeta(newMeta, oldMeta = oldMeta, markSectionPageStale = true)
      if (addsNewDoingStatusMetaPost) {
        dao.addMetaMessage(requester, s" marked this topic as ${newMeta.doingStatus}", pageId, tx)
      }

      if (newMeta.categoryId != oldMeta.categoryId) {
        tx.indexAllPostsOnPage(pageId)
      }

      // If moved to new category, with maybe different access permissions
      // or maybe even deleted,
      // or if topic type changed to, say, private chat, then,
      // need to uncache backlinks on other pages back to this page.
      val maybeStaleBacklinks =
            newMeta.categoryId != oldMeta.categoryId ||
            newMeta.pageType.isPrivateGroupTalk != oldMeta.pageType.isPrivateGroupTalk

      if (maybeStaleBacklinks) {
        TESTS_MISSING  // TyTBACKLNSCAT
        val linkedPageIds = tx.loadPageIdsLinkedFromPage(pageId)
        staleStuff.addPageIds(linkedPageIds, pageModified = false, backlinksStale = true)
        // Page version bumped above.
        staleStuff.addPageId(pageId, memCacheOnly = true)
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
      request.dao.clearDatabaseCacheAndMemCache()
    }
    else {
      // Refresh cache, plus any forum page if this page is a forum topic.
      // (Forum pages cache category JSON and a latest topics list, includes titles.)
      val newSectionPageId = newMeta.categoryId map request.dao.getTheSectionPageId
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

