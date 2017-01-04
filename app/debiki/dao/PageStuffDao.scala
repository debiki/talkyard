/**
 * Copyright (C) 2012 Kaj Magnus Lindberg (born 1979)
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
import com.debiki.core.PageParts.{TitleNr, BodyNr}
import debiki._
import scala.collection.immutable
import scala.collection.mutable
import scala.collection.mutable.ArrayBuffer


/** Page stuff, e.g. title, body excerpt (for pinned topics), user ids.
  */
case class PageStuff(
  pageId: PageId,
  pageRole: PageRole,
  title: String,
  bodyExcerpt: Option[String],
  bodyImageUrls: immutable.Seq[String],
  popularRepliesImageUrls: immutable.Seq[String],
  authorUserId: UserId,
  lastReplyerId: Option[UserId],
  frequentPosterIds: Seq[UserId])(val pageMeta: PageMeta) extends PageTitleRole {

  def role = pageRole

  def categoryId = pageMeta.categoryId

  def userIds: immutable.Seq[UserId] = {
    var ids = frequentPosterIds.toVector :+ authorUserId
    if (lastReplyerId.isDefined) ids :+= lastReplyerId.get
    ids
  }
}



trait PageStuffDao {
  self: SiteDao =>

  // The whole excerpt is shown immediately; nothing happens on click.
  val ExcerptLength = 250

  // Most text initially hidden, only first line shown. On click, everything shown — so
  // include fairly many chars.
  val StartLength = 250

  val logger = play.api.Logger

  memCache.onPageSaved { sitePageId =>
    memCache.remove(cacheKey(sitePageId))
  }


  def getPageStuffById(pageIds: Iterable[PageId]): Map[PageId, PageStuff] = {
    // Somewhat dupl code [5KWE02], PagePathMetaDao.getPageMetasAsMap() and UserDao are similar.
    // Break out helper function getManyById[K, V](keys) ?

    var pageStuffById = Map[PageId, PageStuff]()
    val idsNotCached = ArrayBuffer[PageId]()

    // Look up in cache.
    for (pageId <- pageIds) {
      val anyStuff = memCache.lookup[PageStuff](cacheKey(pageId))
      anyStuff match {
        case Some(stuff) => pageStuffById += pageId -> stuff
        case None => idsNotCached.append(pageId)
      }
    }

    // Ask the database for any remaining stuff.
    val siteCacheVersion = memCache.siteCacheVersionNow()
    val reaminingStuff = if (idsNotCached.isEmpty) Nil else {
      readOnlyTransaction { transaction =>
        loadPageStuffById(idsNotCached, transaction)
      }
    }
    for ((pageId, stuff) <- reaminingStuff) {
      pageStuffById += pageId -> stuff
      memCache.put(cacheKey(pageId), MemCacheItem(stuff, siteCacheVersion))
    }

    pageStuffById
  }


  def loadPageStuffById(pageIds: Iterable[PageId], transaction: SiteTransaction)
        : Map[PageId, PageStuff] = {
    if (pageIds.isEmpty)
      return Map.empty
    var stuffById = Map[PageId, PageStuff]()
    val pageMetasById = transaction.loadPageMetasAsMap(pageIds)

    // Load titles and bodies for all pages. (Because in forum topic lists, we show excerpts
    // of pinned topics, and the start of other topics.)
    val titlesAndBodies = transaction.loadPosts(pageIds flatMap { pageId =>
      Seq(PagePostNr(pageId, TitleNr), PagePostNr(pageId, BodyNr))
    })

    val popularPosts: Map[PageId, immutable.Seq[Post]] =
      transaction.loadPopularPostsByPage(pageIds, limitPerPage = 10)

    val userIdsToLoad = {
      val pageMetas = pageMetasById.values
      val ids = mutable.Set[UserId]()
      ids ++= pageMetas.map(_.authorId)
      ids ++= pageMetas.flatMap(_.lastReplyById)
      pageMetas foreach { meta =>
        ids ++= meta.frequentPosterIds
      }
      ids
    }

    val usersById = transaction.loadUsersAsMap(userIdsToLoad.toSeq)

    for (pageMeta <- pageMetasById.values) {
      val pageId = pageMeta.pageId
      val anyBody = titlesAndBodies.find(post => post.pageId == pageId && post.nr == BodyNr)
      val anyTitle = titlesAndBodies.find(post => post.pageId == pageId && post.nr == TitleNr)
      val anyAuthor = usersById.get(pageMeta.authorId)
      val popularPostsBestFirst = popularPosts.getOrElse(pageId, Nil)
      val popularImageUrls: immutable.Seq[String] = popularPostsBestFirst flatMap { post =>
        post.approvedHtmlSanitized.flatMap(ReactJson.findImageUrls(_).headOption) take 5
      }
      // For pinned topics: The excerpt is only shown in forum topic lists for pinned topics,
      // and should be the first paragraph only.
      // Other topics: The excerpt is shown on the same line as the topic title, as much as fits.
      // [7PKY2X0]
      val anyExcerpt: Option[PostExcerpt] = anyBody.flatMap(_.approvedHtmlSanitized map { html =>
        val length = pageMeta.isPinned ? ExcerptLength | StartLength
        ReactJson.htmlToExcerpt(html, length, firstParagraphOnly = pageMeta.isPinned)
      })

      val summary = PageStuff(
        pageId,
        pageMeta.pageRole,
        title = anyTitle.flatMap(_.approvedSource) getOrElse "(No title)",
        bodyExcerpt = anyExcerpt.map(_.text),
        bodyImageUrls = anyExcerpt.map(_.firstImageUrls).getOrElse(Vector.empty),
        popularRepliesImageUrls = popularImageUrls,
        authorUserId = pageMeta.authorId,
        lastReplyerId = pageMeta.lastReplyById,
        frequentPosterIds = pageMeta.frequentPosterIds)(pageMeta)

      stuffById += pageMeta.pageId -> summary
    }

    stuffById
  }


  private def cacheKey(pageId: PageId, otherSiteId: SiteId = null): MemCacheKey = {
    val theSiteId = if (otherSiteId ne null) otherSiteId else siteId
    MemCacheKey(theSiteId, s"$pageId|PageStuff")
  }


  private def cacheKey(sitePageId: SitePageId): MemCacheKey =
    cacheKey(otherSiteId = sitePageId.siteId, pageId = sitePageId.pageId)

}

