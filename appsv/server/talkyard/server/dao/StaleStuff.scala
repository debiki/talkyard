/**
 * Copyright (c) 2020 Kaj Magnus Lindberg
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

package talkyard.server.dao

import com.debiki.core._
import com.debiki.core.Prelude._
import debiki.Globals
import scala.collection.{mutable => mut}
import scala.collection.immutable


/**
  *
  * @param pageId
  * @param memCacheOnly
  * @param pageModified
  * @param backlinksStale — if backlinks on this page, back to other pages,
  *   are stale, e.g. one of those other pages got renamed,
  *   or moved to a different access restricted category so the
  *   backlink should disappear.
  * @param ancestorCategoriesStale
  * @param bylinesStale
  */
case class StalePage(
  pageId: PageId,
  memCacheOnly: Bo,
  pageModified: Bo,
  backlinksStale: Bo,
  ancestorCategoriesStale: Bo,
  bylinesStale: Bo)


/** Remembers things that got out-of-date and should be uncached, e.g. html
  * for a page cached in page_html_t (page_html3).
  *
  * Since we 1) pass a StaleStuff to "all" functions (well, soon, getting started
  * now), forgetting it, causes a compilation error.
  * And since 2) [[SiteDao.writeTx]] automatically when the transaction ends,
  * uncaches all stale stuff, cannot easily forget to uncache stale stuff?
  *
  * Mutable. Not thread safe.
  */
class StaleStuff {
  private var _allPagesStale = false
  private val _stalePages = mut.Map[PageId, StalePage]()
  private val _stalePpIdsMemCacheOnly = mut.Set[PatId]()

  def nonEmpty: Bo =
    _allPagesStale ||
    _stalePages.nonEmpty ||
    _stalePpIdsMemCacheOnly.nonEmpty


  // ----- Participants

  def staleParticipantIdsInMem: Set[UserId] =
    _stalePpIdsMemCacheOnly.to[immutable.Set]

  def addPatIds(patIds: Set[PatId]): U = {
    // Only cached in-memory.
    patIds foreach _stalePpIdsMemCacheOnly.add
  }

  def addParticipantId(ppId: UserId, memCacheOnly: Bo): U = {
    // Only cached in-memory. Remove memCacheOnly param? It's confusing?
    unimplIf(!memCacheOnly, "TyE036WH7MN24")
    _stalePpIdsMemCacheOnly.add(ppId)
  }

  def addPatDynData(patId: PatId, memCacheOnly: Bo): U = {
    unimplIf(!memCacheOnly, "TyE036WH7MN25")
    // Noop, currently not cached.
  }


  // ----- Pages

  def stalePages: Iterator[StalePage] = _stalePages.valuesIterator

  def stalePageIdsInDb: Set[PageId] =
    // WOULD_OPTIMIZE calc toSet just once, remember (forget if new page added)
    stalePages.filter(!_.memCacheOnly).map(_.pageId).toSet

  def stalePageIdsInMem: Set[PageId] = {
    // This includes all stale pages (there's no stale-only-in-database).
    val r = stalePages.map(_.pageId).toSet
    CLEAN_UP  // just use  _stalePages.keys.toSet  instead?  but .keySet has wrong type.
    dieIf(Globals.isDevOrTest && _stalePages.keys.toSet != r, "TyE056KWTD6")
    r
  }

  def addPagesWithPostIds(postIds: Set[PostId], tx: SiteTx): U = {
    val pagePostNrByPostId = tx.loadPagePostNrsByPostIds(postIds)
    val pageIdsDirectlyAffected: Set[PageId] = pagePostNrByPostId.values.map(_.pageId).toSet
    addPageIds(pageIdsDirectlyAffected)
  }

  def addPagesWithVisiblePostsBy(patIds: Set[PatId], tx: SiteTx): U = {
    val _200k = 200 * 1000
    val pageIds: Set[PageId] = tx.loadPageIdsWithVisiblePostsBy(patIds, limit = _200k)
    if (pageIds.size < _200k) {
      addPageIds(pageIds, pageModified = false, bylinesStale = true)
    }
    else {
      // This won't happen until after 10+ years? Can any human
      // ever write 200 000 posts? Yes maybe: 200e3 / (50 * 365) = 11 years, if
      // writing 50 posts every day. Maybe a bot? However, rate limits, and they
      // wouldn't create that many new pages? Instead, they'd append to the same page?
      // Anyway. Maybe we don't want to load say 1M page ids. Let's update the pages
      // directly in the database instead, and clear the mem cache?
      // Or, just clear the whole page cache? But that might be a bad idea too? Hmm.
      // For now: (doesn't matter until after 10+ years!?)
      addAllPages()
    }
  }

  def addAllPages(): U =
    _allPagesStale = true

  def areAllPagesStale: Bo = _allPagesStale


  /** Pages that need to be refreshed, not because they themselves got modified,
    * but because something else got modified.
    * Example: Page A links to page B. Page A got renamed — so the backlinks
    * displayed on page B back to A, should get updated with the new title of
    * the linking page A. Here, A was directly modified, and B indirectly.
    *
    * Hmm, instead, needs a staleBacklinksPageIds?  [sleeping_links_bug]
    */
  def stalePageIdsInMemIndirectly: Set[PageId] =
    stalePages.filter(p => !p.pageModified).map(_.pageId).toSet

  def stalePageIdsInMemDirectly: Set[PageId] =
    stalePages.filter(p => p.pageModified).map(_.pageId).toSet

  /**
    * @param memCacheOnly If page_meta_t.version_c (pages3.version) got bumped,
    *   that's enough — then it's different from page_html_t.version_c already
    *   and the database "knows" the cached html is out-of-date.
    *   Then, pass memCacheOnly = true here (so won't need to write to the db
    *   twice that the cached html is out-of-date).
    * @param backlinksStale If backlinks on this page, back to other pages
    *   that link to it, needs to be refreshed.
    */
  def addPageId(pageId: PageId, memCacheOnly: Bo = false,
          pageModified: Bo = true, backlinksStale: Bo = false,
          bylinesStale: Bo = false): U = {
    dieIf(!pageModified && !backlinksStale && !bylinesStale,
          "TyE305KTDT", "Nothing happened")
    val oldEntry = _stalePages.get(pageId)
    val newEntry = oldEntry.map(o =>
          o.copy(
            memCacheOnly = o.memCacheOnly && memCacheOnly,
            pageModified = o.pageModified || pageModified,
            backlinksStale = o.backlinksStale || backlinksStale,
            bylinesStale = o.bylinesStale || bylinesStale))
        .getOrElse(StalePage(
            pageId,
            memCacheOnly = memCacheOnly,
            pageModified = pageModified,
            backlinksStale = backlinksStale,
            // Not yet implemented:
            ancestorCategoriesStale = false,
            bylinesStale = bylinesStale))

    if (oldEntry isNot newEntry) {
      _stalePages.update(pageId, newEntry)
    }
  }

  def addPageIds(pageIds: Set[PageId], memCacheOnly: Bo = false,
          pageModified: Bo = true, backlinksStale: Bo = false,
          bylinesStale: Bo = false): U = {
    pageIds foreach { pageId =>
      addPageId(pageId, memCacheOnly = memCacheOnly, pageModified = pageModified,
            backlinksStale = backlinksStale, bylinesStale = bylinesStale)
    }
  }

  def includesPageModified(pageId: PageId): Boolean = {
    _stalePages.get(pageId).exists(_.pageModified)
  }


  def clearStaleStuffInDatabase(tx: SiteTx): U = {
    if (areAllPagesStale) {
      tx.bumpSiteVersion()
    }
    else {
      // Refresh database page cache:
      tx.markPagesHtmlStale(stalePageIdsInDb)
    }
  }


  def clearStaleStuffInMemory(dao: debiki.dao.SiteDao): U = {
    if (areAllPagesStale) {
      // Currently then need to: (although clears unnecessarily much)
      dao.memCache.clearThisSite()
    }
    else if (nonEmpty) {
      staleParticipantIdsInMem foreach { ppId =>
        dao.removeUserFromMemCache(ppId)
      }
      stalePageIdsInMem foreach { pageId =>
        dao.refreshPageInMemCache(pageId)
      }
      dao.uncacheLinks(this)
    }
  }

}

