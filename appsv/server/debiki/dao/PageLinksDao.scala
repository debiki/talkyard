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

package debiki.dao

import com.debiki.core._
import com.debiki.core.Prelude._
import org.scalactic.{ErrorMessage, Or}
import scala.collection.immutable
import scala.collection.mutable
import talkyard.server.dao.StaleStuff



trait PageLinksDao {
  self: SiteDao =>

  // No, instead, see  uncacheLinks()  below  [rm_cache_listeners]
  // memCache.onPageCreated { ... }
  // memCache.onPageSaved { ... }


  def getPageIdsLinkedFrom(pageId: PageId): Set[PageId] = {
    COULD_OPTIMIZE  // cache
    loadPageIdsLinkedFrom(pageId)
  }


  def loadPageIdsLinkedFrom(pageId: PageId): Set[PageId] = {
    readTx(_.loadPageIdsLinkedFromPage(pageId))
  }


  def getPageIdsLinkingTo(pageId: PageId, inclDeletedHidden: Boolean): Set[PageId] = {
    require(!inclDeletedHidden, "TyE53KTDP6")  // for now
    // Later: Incl inclDeletedHidden in key, or always load all links,
    // and cache, per link, if the linking page is deleted or hidden?
    RACE // [cache_race_counter] (02526SKB)
    memCache.lookup(
          linksToKey(pageId),
          orCacheAndReturn = Some {
            loadPageIdsLinkingTo(pageId, inclDeletedHidden = false)
          }).get
  }


  def loadPageIdsLinkingTo(pageId: PageId, inclDeletedHidden: Boolean): Set[PageId] = {
    readTx(_.loadPageIdsLinkingToPage(pageId, inclDeletedHidden))
  }


  def uncacheLinks(staleStuff: StaleStuff): Unit = {
    // Need not refresh pages linked from indirectly modified pages — any
    // links from them shouldn't have changed, since weren't modified themselves.
    // But if a category got deleted or access restricted, then, would need
    // to to something here — if we didn't clear the whole site cache already,
    // on such changes.  [cats_clear_cache]
    //
    // [sleeping_links_bug] Should also uncache links from pages *directly* modified?
    // But only if backlinks stale. The filter should be on backlinks not in/dircetly?
    //
    val uncacheLinksToPageIds = staleStuff.stalePageIdsInMemIndirectly

    // This shouldn't be needed — stalePageIdsInMemIndirectly ought to include
    // all pages we might need to uncache, already.
    /* -------
    // Maybe because of a race, the database and cache knows about slightly
    // different links? So uncache based on both?
    val uncacheLinksFromPageIds = staleStuff.stalePageIdsInMemDirectly
    val linkedPageIds: Set[PageId] = uncacheLinksFromPageIds.flatMap(loadPageIdsLinkedFrom)
    val moreIds: Set[PageId] = uncacheLinksFromPageIds.flatMap(getPageIdsLinkedFrom)
    ------- */

    val allToUncache = uncacheLinksToPageIds  // ++ linkedPageIds ++ moreIds

    allToUncache.foreach { pageId =>
      memCache.remove(linksToKey(pageId))
      RACE // [cache_race_counter]  might incorrectly get added back here (02526SKB)
    }
  }


  private def linksToKey(pageId: PageId) =
    MemCacheKey(siteId, s"$pageId|PgLns")


}

