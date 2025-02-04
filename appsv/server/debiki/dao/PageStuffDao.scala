/**
 * Copyright (C) 2012 Kaj Magnus Lindberg
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

import scala.collection.Seq
import com.debiki.core._
import com.debiki.core.Prelude._
import com.debiki.core.PageParts.{BodyNr, TitleNr}
import debiki._
import scala.collection.immutable
import scala.collection.mutable.ArrayBuffer

case class PatPostRelStuff[T <: PatNodeRelType](
  fromPatId: PatId, // or skip?
  toPost: Post,
  relType: PatNodeRel[T],
  //pageTitle: St,
  //pageMeta: St,
  //patsById: Map[PatId, Pat]
) {
  //def fromPat: Pat = patsById.getOrDie(patId, "TyEPAPOREL0PAT",
  //      s"Pat missing: patsById($fromPatId)")
  def pageId = toPost.pageId
}


/** Page stuff, e.g. title, body excerpt (for pinned topics), user ids.
  */
case class PageStuff(
  pageId: PageId,
  // But what about the page path? [incl_path_in_page_stuff]
  pageMeta: PageMeta,
  title: String,  // CLEAN_UP REMOVE
  approvedTitleSource: Option[String],
  currTitleSource: Option[String],
  bodyExcerpt: Option[String],
  // Need not cache these urls per server origin? [5JKWBP2]
  bodyImageUrls: immutable.Seq[String],
  pageTags: ImmSeq[Tag], // but not page author tags (badges)
  popularRepliesImageUrls: immutable.Seq[String],
  //authorIds: Vec[...]  — later
  authorUserId: UserId,  // RENAME to just authorId
  assigneeIds: Vec[MembId],
  lastReplyerId: Option[UserId],
  frequentPosterIds: Seq[UserId]) extends PageTitleRole {

  def pageVersion: PageVersion = pageMeta.version

  def titleMaybeUnapproved: Option[String] =
    approvedTitleSource orElse currTitleSource

  def role: PageType = pageType  // DELETE
  def pageType: PageType = pageMeta.pageType
  def doingStatus: PageDoingStatus = pageMeta.doingStatus

  def pageRole: PageType = pageType  // DELETE

  def categoryId: Option[CategoryId] = pageMeta.categoryId

  def addVisiblePatIdsTo(set: MutSet[PatId]): U = {
    // Later, don't include [private_pats], once impl.
    set.add(authorUserId)   // or +=
    //ids ++= authorIds later, if many
    frequentPosterIds.foreach(set.add)   // or ++= ?
    lastReplyerId.foreach(set.add)
    assigneeIds.foreach(set.add)
  }
}



object PageStuffDao {
  // The whole excerpt is shown immediately; nothing happens on click.
  val ExcerptLength = 250

  // Most text initially hidden, only first line shown. On click, everything shown — so
  // include fairly many chars.
  val StartLength = 250
}



trait PageStuffDao {
  self: SiteDao =>

  import PageStuffDao._

  memCache.onPageSaved { sitePageId =>
    memCache.remove(cacheKey(sitePageId))
  }


  RENAME // to getPageStuffById
  def getOnePageStuffById(pageId: PageId): Option[PageStuff] = {
    getPageStuffById(Seq(pageId)).get(pageId)
  }


  RENAME // to getPageStuffsById
  def getPageStuffById(pageIds: Iterable[PageId]): Map[PageId, PageStuff] = {
    getPageStuffsByIdVersion(pageIds.map(id => PageIdVersion(id, NoVersion)))
  }


  def getPageStuffsByIdVersion(pageIdVersions: Iterable[PageIdVersion])
        : Map[PageId, PageStuff] = {
    // Somewhat dupl code [5KWE02], PagePathMetaDao.getPageMetasAsMap() and UserDao are similar.
    // Break out helper function getManyById[K, V](keys) ?

    var pageStuffById = Map[PageId, PageStuff]()
    val idsNotCached = ArrayBuffer[PageId]()

    // Look up in cache — but ignore any out-of-date entries (in case there's a race).
    for (idVersion <- pageIdVersions) {
      import idVersion.pageId
      val anyStuff = memCache.lookup[PageStuff](cacheKey(pageId))
      anyStuff match {
        case Some(stuff) if idVersion.version <= stuff.pageVersion =>
          pageStuffById += pageId -> stuff
        case _ =>
          idsNotCached.append(pageId)
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


  def loadPageStuffById(pageIds: Iterable[PageId], tx: SiteTx): Map[PageId, PageStuff] = {
    if (pageIds.isEmpty)
      return Map.empty
    var stuffById = Map[PageId, PageStuff]()
    val pageMetasById = tx.loadPageMetasAsMap(pageIds)

    // Load titles and bodies for all pages. (Because in forum topic lists, we show excerpts
    // of pinned topics, and the start of other topics.)
    val titlesAndBodies = tx.loadPostsByNrs(pageIds flatMap { pageId =>
      Seq(PagePostNr(pageId, TitleNr), PagePostNr(pageId, BodyNr))
    })

    val popularRepliesByPageId: Map[PageId, immutable.Seq[Post]] =
      tx.loadPopularPostsByPageExclAggs(pageIds, limitPerPage = 10, exclOrigPost = true)

    val tagsByPageId = tx.loadTagsForPages(pageIds)

    for (pageMeta <- pageMetasById.values) {
      val pageId = pageMeta.pageId
      val anyBody = titlesAndBodies.find(post => post.pageId == pageId && post.nr == BodyNr)
      val anyTitle = titlesAndBodies.find(post => post.pageId == pageId && post.nr == TitleNr)
      val repliesPopularFirst = popularRepliesByPageId.getOrElse(pageId, Nil)
      val popularImageUrls: immutable.Seq[String] = repliesPopularFirst flatMap { post =>
        post.approvedHtmlSanitized.flatMap(JsonMaker.findImageUrls(_).headOption) take 5
      }

      // For pinned topics: The excerpt is only shown in forum topic lists for pinned topics,
      // and should be the first paragraph only.
      // Other topics: The excerpt is shown on the same line as the topic title, as much as fits.
      // [7PKY2X0]
      val anyExcerpt: Option[PostExcerpt] = anyBody.flatMap(_.approvedHtmlSanitized map { html =>
        val (length, firstParagraphOnly) =
          if (pageMeta.pageType == PageType.AboutCategory)
            (Category.DescriptionExcerptLength, true)  // <— instead of [502RKDJWF5]
          else
            (pageMeta.isPinned ? ExcerptLength | StartLength, pageMeta.isPinned)
        // Also for replies, see: [post_excerpts].
        JsonMaker.htmlToExcerpt(html, length, firstParagraphOnly)
      })

      val pageStuff = PageStuff(
        pageId,
        pageMeta,
        title = anyTitle.flatMap(_.approvedSource) getOrElse "(No title)",
        approvedTitleSource = anyTitle.flatMap(_.approvedSource),
        currTitleSource = anyTitle.map(_.currentSource),
        bodyExcerpt = anyExcerpt.map(_.text),
        bodyImageUrls = anyExcerpt.map(_.firstImageUrls).getOrElse(Vector.empty),
        pageTags = tagsByPageId.getOrElse(pageId, Nil),
        popularRepliesImageUrls = popularImageUrls,
        authorUserId = pageMeta.authorId,
        assigneeIds = anyBody.map(_.assigneeIds).getOrElse(Vec.empty),
        lastReplyerId = pageMeta.lastApprovedReplyById,
        frequentPosterIds = pageMeta.frequentPosterIds)

      stuffById += pageMeta.pageId -> pageStuff
    }

    stuffById
  }


  private def cacheKey(pageId: PageId, otherSiteId: SiteId = NoSiteId): MemCacheKey = {
    val theSiteId = if (otherSiteId != NoSiteId) otherSiteId else siteId
    MemCacheKey(theSiteId, s"$pageId|PageStuff")
  }


  private def cacheKey(sitePageId: SitePageId): MemCacheKey =
    cacheKey(otherSiteId = sitePageId.siteId, pageId = sitePageId.pageId)

}

