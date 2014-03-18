/**
 * Copyright (C) 2014 Kaj Magnus Lindberg (born 1979)
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

package debiki.dao

import com.debiki.core._
import com.debiki.core.Prelude._
import debiki._
import debiki.DebikiHttp._
import java.{util => ju}
import requests.PageRequest


/** Loads and saves pages and page parts (e.g. posts and patches).
 */
trait PageDao {
  self: SiteDao =>


  def createPage(page: Page): Page = siteDbDao.createPage(page)


  /** Saves page actions and places messages in users' inboxes, as needed.
    * Returns a pair with 1) the page including new actions plus the current user,
    * and 2) the actions, but with ids assigned.
    */
  final def savePageActionsGenNotfs(pageReq: PageRequest[_], actions: Seq[PostActionDtoOld])
      : (PageNoPath, Seq[PostActionDtoOld]) = {
    val pagePartsNoAuthor = pageReq.pageNoPath_!.parts
    // We're probably going to render parts of the page later, and then we
    // need the user, so add it to the page — it's otherwise absent if this is
    // the user's first contribution to the page.
    val pageParts = pagePartsNoAuthor ++ pageReq.anyMeAsPeople
    val page = PageNoPath(pageParts, pageReq.ancestorIdsParentFirst_!, pageReq.pageMeta_!)
    savePageActionsGenNotfsImpl(page, actions)
  }


  final def savePageActionsGenNotfs(pageId: PageId, actions: Seq[PostActionDtoOld], authors: People)
      : (PageNoPath, Seq[PostActionDtoOld]) = {

    val pageNoAuthor = loadPage(pageId) getOrElse throwBadReq(
      "DwE6Xf80", s"Page not found, id: `$pageId'; could not do all changes")
    val page = pageNoAuthor ++ authors

    val pageMeta = siteDbDao.loadPageMeta(page.id) getOrElse
      throwNotFound("DwE115Xf3", s"Found no meta for page ${page.id}")

    val ancestorPageIds = loadAncestorIdsParentFirst(pageId)

    savePageActionsGenNotfsImpl(PageNoPath(page, ancestorPageIds, pageMeta), actions)
  }


  def savePageActionsGenNotfsImpl(page: PageNoPath, actions: Seq[PostActionDtoOld])
      : (PageNoPath, Seq[PostActionDtoOld]) = {
    if (actions isEmpty)
      return (page, Nil)

    // COULD check that e.g. a deleted post is really a post, an applied edit is
    // really an edit, an action undone is not itself an Undo action,
    // and lots of other similar tests.

    val (pageWithNewActions, actionsWithId) =
      siteDbDao.savePageActions(page, actions.toList)

    (pageWithNewActions, actionsWithId)
  }


  def deleteVote(userIdData: UserIdData, pageId: PageId, postId: PostId,
        voteType: PostActionPayload.Vote) {
    siteDbDao.deleteVote(userIdData, pageId, postId, voteType)
  }

  def loadPage(debateId: String): Option[PageParts] =
    siteDbDao.loadPage(debateId)


  def loadPageAnyTenant(sitePageId: SitePageId): Option[PageParts] =
    loadPageAnyTenant(tenantId = sitePageId.siteId, pageId = sitePageId.pageId)


  def loadPageAnyTenant(tenantId: String, pageId: String): Option[PageParts] =
    siteDbDao.loadPage(pageId, tenantId = Some(tenantId))

}



trait CachingPageDao extends PageDao {
  self: CachingSiteDao =>


  override def createPage(page: Page): Page = {
    val pageWithIds = super.createPage(page)
    firePageCreated(pageWithIds)
    pageWithIds
  }


  override def savePageActionsGenNotfsImpl(page: PageNoPath, actions: Seq[PostActionDtoOld])
      : (PageNoPath, Seq[PostActionDtoOld]) = {

    if (actions isEmpty)
      return (page, Nil)

    val newPageAndActionsWithId =
      super.savePageActionsGenNotfsImpl(page, actions)

    refreshPageInCache(page.id)
    newPageAndActionsWithId
  }


  private def refreshPageInCache(pageId: PageId) {
    // Possible optimization: Examine all actions, and refresh cache e.g.
    // the RenderedPageHtmlDao cache only
    // if there are e.g. EditApp:s or approved Post:s (but ignore Edit:s --
    // unless applied & approved). Include that info in the call to `firePageSaved` below.

    firePageSaved(SitePageId(siteId = siteId, pageId = pageId))

    // if (is _site.conf || is any stylesheet or script)
    // then clear all asset bundle related caches. For ... all websites, for now??

    // Would it be okay to simply overwrite the in mem cache with this
    // updated page? — Only if I make `++` avoid adding stuff that's already
    // present!
    //val pageWithNewActions =
    // page_! ++ actionsWithId ++ pageReq.login_! ++ pageReq.user_!

    // In the future, also refresh page index cache, and cached page titles?
    // (I.e. a cache for DW1_PAGE_PATHS.)

    // ------ Page action cache (I'll probably remove it)
    // COULD instead update value in cache (adding the new actions to
    // the cached page). But then `savePageActionsGenNotfs` also needs to know
    // which users created the actions, so their login/idty/user instances
    // can be cached as well (or it won't be possible to render the page,
    // later, when it's retrieved from the cache).
    // So: COULD save login, idty and user to databaze *lazily*.
    // Also, logins that doesn't actually do anything won't be saved
    // to db, which is goood since they waste space.
    // (They're useful for statistics, but that should probably be
    // completely separated from the "main" db?)

    /*  Updating the cache would be something like: (with ~= Google Guava cache)
      val key = Key(tenantId, debateId)
      var replaced = false
      while (!replaced) {
        val oldPage =
           _cache.tenantDaoDynVar.withValue(this) {
             _cache.cache.get(key)
           }
        val newPage = oldPage ++ actions ++ people-who-did-the-actions
        // newPage might == oldPage, if another thread just refreshed
        // the page from the database.
        replaced = _cache.cache.replace(key, oldPage, newPage)
    */
    removeFromCache(_pageActionsKey(pageId))
    // ------ /Page action cache
  }


  override def deleteVote(userIdData: UserIdData, pageId: PageId, postId: PostId,
        voteType: PostActionPayload.Vote) {
    super.deleteVote(userIdData, pageId, postId, voteType)
    refreshPageInCache(pageId)
  }


  override def loadPage(pageId: String): Option[PageParts] =
    lookupInCache[PageParts](_pageActionsKey(pageId),
      orCacheAndReturn = {
        super.loadPage(pageId)
      })


  def _pageActionsKey(pageId: String): String = s"$pageId|$siteId|PageActions"

}

