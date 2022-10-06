/**
 * Copyright (c) 2016 Kaj Magnus Lindberg
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
import talkyard.server.authz.{AuthzCtxOnAllWithReqer, AuthzCtxWithReqer}


/** Returns an empty watchbar. Only the CachingWatchbarDao does something useful.
  *
  * I don't want to save watchbars in PostgreSQL because that'd mean 1 db write request per
  * forum member & page view (because the recent topics list in the watchbar gets updated
  * whenever the user visits a new page).
  */
trait WatchbarDao {
  self: SiteDao with PageStuffDao =>

  val StrangersWatchbarKey = MemCacheKey(siteId, "StrangersWatchbar")

  memCache.onPageSaved { sitePageId =>
    // Perhaps globally pinned chat title edited? Then needs to rerender watchbar. Also: [ZBK2F4E]
    memCache.remove(StrangersWatchbarKey)
  }


  def getStrangersWatchbar(): BareWatchbar = {
    memCache.lookup[BareWatchbar](
      StrangersWatchbarKey,
      orCacheAndReturn = {
        readOnlyTransaction { tx =>
          val globalChatsInclForbidden = tx.loadOpenChatsPinnedGlobally()
          val globalChatsMaySee = globalChatsInclForbidden filter { chatPageMeta =>
            val (maySee, debugCode) = maySeePageUseCache(chatPageMeta, user = None)
            maySee
          }
          val globalChatIds = globalChatsMaySee.map(_.pageId)
          Some(BareWatchbar.withChatChannelAndDirectMessageIds(globalChatIds, Nil))
        }
      }) getOrDie "EsE2GBR7W5"
  }


  def getAnyWatchbar(userId: UserId): Opt[BareWatchbar] = {
    memCache.lookup[BareWatchbar](
        key(userId),
        orCacheAndReturn = {
          // [weird_dbl_cache]
          redisCache.loadWatchbar(userId)
        })
  }


  RENAME // to getOrCreateCacheWatchbar?
  def getOrCreateWatchbar(authzCtx: AuthzCtxOnAllWithReqer): BareWatchbar = {
    // Hmm, double caching? Mem + Redis. This doesn't make sense? Let's keep it like this for
    // a while and see what'll happen. At least it's fast. And lasts across Play app restarts.
    // [weird_dbl_cache]
    val userId = authzCtx.theReqer.id
    memCache.lookup[BareWatchbar](
      key(userId),
      orCacheAndReturn = redisCache.loadWatchbar(userId) orElse Some({
        readTx { tx =>
          val defaultChatsInclForbidden = tx.loadOpenChatsPinnedGlobally()
          val defaultChats = defaultChatsInclForbidden filter { defChat =>
            val (may, _) = maySeePageUseCacheAndAuthzCtx(defChat, authzCtx)
            may
          }
          val defaultChatIds = defaultChats.map(_.pageId)
          val chatChannelIdsTooMany = tx.loadPageIdsUserIsMemberOf(
                authzCtx.groupIdsUserIdFirst, Set(PageType.OpenChat, PageType.PrivateChat))
          // A PageType.OpenChat might be both a default chat, and one pat has joined,
          // so remove them from the has-joined list. [open_chat_dupl]
          val chatChannelIds = chatChannelIdsTooMany.filterNot(defaultChatIds contains _)

          // Let's show the default chats first — they can be things like "Support" or "Welcome",
          // which makes sense to show first, before one's own more specific chats?
          // Ok to `++` concatenate here — different page types: JoinlessChat vs PrivateChat,
          // whilst OpenChat is de-duplicated above. So there won't be any duplicates.
          val allPatsChatIds = defaultChatIds ++ chatChannelIds

          val directMessageIds = tx.loadPageIdsUserIsMemberOf(
                authzCtx.groupIdsUserIdFirst, Set(PageType.FormalMessage))
          BareWatchbar.withChatChannelAndDirectMessageIds(allPatsChatIds, directMessageIds)
        }
      }),
      ignoreSiteCacheVersion = true) getOrDie "EsE4UYKF5"
  }


  /* BUG race conditions, if e.g. saveWatchbar & markPageAsUnreadInWatchbar called at the
  * same time. Could perhaps solve by creating a Watchbar actor that serializes access?
  */
  def saveWatchbar(userId: UserId, watchbar: Watchbar): Unit = {   RENAME // to ...InMem? or cacheWatchbar?
    memCache.put(
      key(userId),
      MemCacheValueIgnoreVersion(watchbar))
    redisCache.saveWatchbar(userId, watchbar)
  }


  def markPageAsUnreadInWatchbar(user: User, pageId: PageId): U = {
    val authzCtx = getAuthzCtxOnPagesForPat(user)
    val watchbar = getOrCreateWatchbar(authzCtx)  // or just skip if not created
    val newWatchbar = watchbar.markPageAsUnread(pageId)
    saveWatchbar(user.id, newWatchbar)
  }


  def fillInWatchbarTitlesEtc(watchbar: BareWatchbar): WatchbarWithTitles = {
    val pageStuffById = getPageStuffById(watchbar.watchedPageIds)
    watchbar.addTitlesEtc(pageStuffById)
  }


  private def key(userId: UserId) = MemCacheKey(siteId, s"$userId|Watchbar")

}


