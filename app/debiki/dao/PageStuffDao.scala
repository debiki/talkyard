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
import debiki.ReactJson.{htmlToTextWithNewlines, ToTextResult}
import debiki._
import java.{util => ju}
import scala.collection.mutable
import CachingDao.{CacheKey, CacheValue}
import org.jsoup.Jsoup


/** Page stuff, e.g. title, body excerpt (for pinned topics), author name.
  * We might not load all stuff inside a transaction, so sometimes some data might
  * suddenly have vanished — that's why e.g. the author is an Option[User].
  */
case class PageStuff(
  pageId: PageId,
  pageRole: PageRole,
  title: String,
  bodyExcerptIfPinned: Option[String],
  author: Option[User],
  // author* below are deprecated.
  authorUserId: UserId,
  authorUsername: Option[String],
  authorFullName: Option[String],
  authorAvatarUrl: Option[String],
  lastReplyer: Option[User],
  frequentPosters: Seq[User]) extends PageTitleRole {
  def role = pageRole
}



trait PageStuffDao {
  self: SiteDao =>

  val ExcerptLength = 250

  val logger = play.api.Logger


  def loadPageStuffAsList(pageIds: Iterable[PageId]): Seq[Option[PageStuff]] = {
    val stuffByPageId = loadPageStuff(pageIds)
    pageIds.toSeq.map(stuffByPageId.get)
  }


  def loadPageStuff(pageIds: Iterable[PageId]): Map[PageId, PageStuff] = {
    if (pageIds.isEmpty)
      return Map.empty
    readOnlyTransaction { transaction =>
      loadPageStuffImpl(pageIds, transaction)
    }
  }


  def loadPageStuffImpl(pageIds: Iterable[PageId], transaction: SiteTransaction)
        : Map[PageId, PageStuff] = {
    if (pageIds.isEmpty)
      return Map.empty
    var stuffById = Map[PageId, PageStuff]()
    val pageMetasById = transaction.loadPageMetasAsMap(pageIds)

    // Load titles for all pages, and bodies for pinned topics
    // (because in forum topic lists, we show excerpts of pinned topics).
    val titlesAndBodies = transaction.loadPosts(pageIds flatMap { pageId =>
      var pagePostIds = Seq(PagePostNr(pageId, TitleNr))
      val pageMeta = pageMetasById.get(pageId)
      if (pageMeta.exists(_.isPinned)) {
        pagePostIds :+= PagePostNr(pageId, BodyNr)
      }
      pagePostIds
    })

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

      // The text in the first paragraph, but at most ExcerptLength chars.
      // For pinned topics only — the excerpt is only shown in forum topic lists for pinned topics.
      var anyExcerpt: Option[String] = None
      if (pageMeta.isPinned) {
        anyExcerpt = anyBody.flatMap(_.approvedHtmlSanitized match {
          case None => None
          case Some(html) =>
            val excerpt = ReactJson.htmlToExcerpt(html, ExcerptLength)
            Some(excerpt)
        })
      }

      val summary = PageStuff(
        pageId,
        pageMeta.pageRole,
        title = anyTitle.flatMap(_.approvedSource) getOrElse "(No title)",
        bodyExcerptIfPinned = anyExcerpt,
        author = anyAuthor,
        authorUserId = pageMeta.authorId,
        authorUsername = anyAuthor.flatMap(_.anyUsername),
        authorFullName = anyAuthor.flatMap(_.anyName),
        // When listing pages, we show many users: creator, last reply, etc. and many pages,
        // so we'll use the tiny avatar image. Should I rename to tinyAuthorAvatarUrl?
        authorAvatarUrl = anyAuthor.flatMap(_.tinyAvatar.map(_.url)),
        lastReplyer = pageMeta.lastReplyById.flatMap(usersById.get),
        frequentPosters = pageMeta.frequentPosterIds.flatMap(usersById.get))

      stuffById += pageMeta.pageId -> summary
    }

    stuffById
  }

}



trait CachingPageStuffDao extends PageStuffDao {
  self: SiteDao with CachingDao =>

  onPageSaved { sitePageId =>
    removeFromCache(cacheKey(sitePageId))
  }


  override def loadPageStuff(pageIds: Iterable[PageId]): Map[PageId, PageStuff] = {
    var summariesById = Map[PageId, PageStuff]()
    var idsNotCached = List[PageId]()

    // Look up summaries in cache.
    for (pageId <- pageIds) {
      val anySummary = lookupInCache[PageStuff](cacheKey(pageId))
      anySummary match {
        case Some(summary) => summariesById += pageId -> summary
        case None => idsNotCached ::= pageId
      }
    }

    // Ask the database for any remaining summaries.
    val siteCacheVersion = siteCacheVersionNow()
    val reaminingSummaries = super.loadPageStuff(idsNotCached)
    for ((pageId, summary) <- reaminingSummaries) {
      summariesById += pageId -> summary
      putInCache(cacheKey(pageId), CacheValue(summary, siteCacheVersion))
    }

    summariesById
  }


  private def cacheKey(pageId: PageId, otherSiteId: SiteId = null): CacheKey = {
    val theSiteId = if (otherSiteId ne null) otherSiteId else siteId
    CacheKey(theSiteId, s"$pageId|PageStuff")
  }


  private def cacheKey(sitePageId: SitePageId): CacheKey =
    cacheKey(otherSiteId = sitePageId.siteId, pageId = sitePageId.pageId)

}



object CachingPageStuffDao {

}
