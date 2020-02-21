/**
 * Copyright (C) 2015 Kaj Magnus Lindberg
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
import debiki.EdHttp.throwNotFound
import scala.collection.immutable
import Prelude._
import debiki.{AllSettings, EffectiveSettings}


// REFACTOR  combine PageDao and PagePartsDao into the same class, "PageDao". [ONEPAGEDAO]
case class PageDao(override val id: PageId, settings: AllSettings, transaction: SiteTransaction)
  extends Page {

  def sitePageId = SitePageId(transaction.siteId, id)

  var _path: Option[PagePathWithId] = null

  val parts = PagePartsDao(id, settings, transaction)

  override def siteId: SiteId = transaction.siteId

  def exists: Boolean =
    parts.exists

  def version: PageVersion = meta.version
  def isClosed: Boolean = meta.isClosed

  override def meta: PageMeta =
    parts.pageMeta


  override def path: Option[PagePathWithId] = {
    if (_path eq null) {
      _path = transaction.loadPagePath(id)
    }
    _path
  }

}


case class NonExistingPage(
  override val siteId: SiteId,
  pageRole: PageType,
  anyCategoryId: Option[CategoryId],
  embeddingUrl: String,
  now: When) extends Page {

  override def id: PageId = EmptyPageId

  override def meta: PageMeta = PageMeta.forNewPage(
    pageId = EmptyPageId,
    pageRole,
    authorId = SystemUserId,
    creationDati = now.toJavaDate,
    numPostsTotal = 0,
    categoryId = anyCategoryId,
    embeddingUrl = Some(embeddingUrl),
    publishDirectly = true)

  override def path: Option[PagePathWithId] =
    Some(PagePathWithId.fromIdOnly(pageId = EmptyPageId, canonical = true))

  override def parts: PageParts = PreLoadedPageParts(meta, allPosts = Nil)

  override def version: PageVersion = 1
}


// REFACTOR  combine PageDao and PagePartsDao into the same class, "PageDao". [ONEPAGEDAO]
case class PagePartsDao(
  override val pageId: PageId,
  settings: AllSettings,
  transaction: SiteTransaction) extends PageParts {


  private var _meta: Option[PageMeta] = null

  def pageMeta: PageMeta = {
    if (_meta eq null) {
      exists // this loads the page meta
      dieIf(_meta eq null, "EsE7K5UF2")
    }
    _meta getOrElse throwPageNotFound()
  }

  def exists: Boolean = {
    if (_meta eq null) {
      _meta = transaction.loadPageMeta(pageId)
    }
    _meta.isDefined
  }

  def origPostReplyBtnTitle: Option[String] = {
    // For now, this is for embedded comments only  [POSTSORDR].
    if (pageMeta.pageType != PageType.EmbeddedComments)
      return None
    if (settings.origPostReplyBtnTitle.isEmpty)
      return None
    Some(settings.origPostReplyBtnTitle)
  }

  def origPostVotes: OrigPostVotes = {
    // For now, this is for embedded comments only  [POSTSORDR].
    if (pageMeta.pageType != PageType.EmbeddedComments)
      return OrigPostVotes.Default
    settings.origPostVotes
  }

  def postsOrderNesting: PostsOrderNesting = {
    // COULD_OPTIMIZE // often the caller has loaded the page meta already
    // For now, changing the sort order, is for embedded comments only [POSTSORDR].
    val sortOrder =
      if (pageMeta.pageType == PageType.EmbeddedComments)
        settings.discPostSortOrder
      else
        PostSortOrder.BestFirst
    PostsOrderNesting(sortOrder, settings.discPostNesting)
  }

  private var _allPosts: immutable.Seq[Post] = _

  def loadAllPosts() {
    if (_allPosts eq null) {
      _allPosts = transaction.loadPostsOnPage(pageId)
    }
  }

  override def allPosts: immutable.Seq[Post] = {
    if (_allPosts eq null) {
      loadAllPosts()
    }
    _allPosts
  }

  def siteId: SiteId = transaction.siteId

  private def throwPageNotFound() =
    throwNotFound("TyE404GKP3", s"s$siteId: Page not found, id: `$pageId'")
}
