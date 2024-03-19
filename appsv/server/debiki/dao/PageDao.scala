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
import debiki.AllSettings


/** Loads posts and things related to a specific page.
  *
  * (There's also a class PagesDao (with a 's' in the name) that focuses on
  * whole pages.)
  */
// REFACTOR  combine PageDao and PagePartsDao into the same class, "PageDao". [ONEPAGEDAO]
case class PageDao(override val id: PageId, settings: AllSettings,
      transaction: SiteTransaction, anyDao: Opt[SiteDao],
      whichPosts: WhichPostsOnPage = WhichPostsOnPage.OnlyPublic(activeOnly = false))
  extends Page {

  assert(id ne null)

  def sitePageId = SitePageId(transaction.siteId, id)

  var _path: Option[PagePathWithId] = null

  val parts = PagePartsDao(id, settings, transaction, anyDao, whichPosts)

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


case class NotYetCreatedEmbeddedPage(
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

  override def parts: PageParts = PreLoadedPageParts(meta, allPosts = Vec.empty)

  override def version: PageVersion = 1
}


// REFACTOR  combine PageDao and PagePartsDao into the same class, "PageDao". [ONEPAGEDAO]
case class PagePartsDao(
  override val pageId: PageId,
  settings: AllSettings,
  transaction: SiteTx,
  // COULD_OPTIMIZE Use any dao instead of the tx always if possible?
  anyDao: Opt[SiteDao] = None,
  // Public (not bookmarks or priv comts) is the default.
  whichPosts: WhichPostsOnPage = WhichPostsOnPage.OnlyPublic(activeOnly = false),
  ) extends PageParts {

  assert(pageId ne null)

  private var _meta: Option[PageMeta] = null

  def pageMeta: PageMeta = {
    COULD_OPTIMIZE // often the caller has loaded the page meta already
    if (_meta eq null) {
      exists // this loads the page meta
      dieIf(_meta eq null, "TyE5M7K5UF2")
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
    // For now, this is for embedded comments only  [POSTSORDR].  [per_page_type_props]
    if (pageMeta.pageType != PageType.EmbeddedComments)
      return None
    if (settings.origPostReplyBtnTitle.isEmpty)
      return None
    Some(settings.origPostReplyBtnTitle)
  }

  def origPostVotes: OrigPostVotes = {
    // For now, this is for embedded comments only  [POSTSORDR].  [per_page_type_props]
    if (pageMeta.pageType != PageType.EmbeddedComments)
      return OrigPostVotes.Default
    settings.origPostVotes
  }

  override def enableDisagreeVote: Bo = {
    // Distant future: Lookup based on page type and category, maybe tags,
    // in cont_settings_t [cont_settings_t]. Maybe also who the current user is?
    // If, say, a community wants to enable this vote only for >= Full Members.
    settings.enableDisagreeVote
  }

  def postsOrderNesting: PostsOrderNesting = {
    PostsOrderNesting(discPropsDerived.comtOrder, discPropsDerived.comtNesting)
  }

  private var _discPropsDerived: DiscPropsDerived = _
  private def discPropsDerived: DiscPropsDerived = {
    if (_discPropsDerived eq null) {
      _discPropsDerived = deriveDiscProps()
    }
    _discPropsDerived
  }

  private def deriveDiscProps(): DiscPropsDerived = {
    val cats = ancestorCatsRootLast()
    DiscProps.derive(
          selfSource = Some(pageMeta),
          ancestorSourcesSpecificFirst = cats,
          // One can specify a different emb commments default sort order.
          // [per_page_type_props] [POSTSORDR]
          defaults = settings.discPropsFor(pageMeta.pageType))
  }

  private def ancestorCatsRootLast(): ImmSeq[Cat] = {
    anyDao match {
      case Some(dao) => dao.getAncestorCategoriesSelfFirst(pageMeta.categoryId)
      case None => transaction.loadCategoryPathRootLast(pageMeta.categoryId, inclSelfFirst = true)
    }
  }

  private var _allPosts: Vec[Post] = _

  def loadAllPosts(): Unit = {
    if (_allPosts eq null) {
      _allPosts = transaction.loadPostsOnPage(pageId, whichPosts)
    }
  }

  override def allPosts: Vec[Post] = {
    if (_allPosts eq null) {
      loadAllPosts()
    }
    _allPosts
  }


  def updatePostInMem_unimpl(posts: Iterable[Post]): PagePartsDao = this // impl later?

  def siteId: SiteId = transaction.siteId

  private def throwPageNotFound() =
    throwNotFound("TyE404GKP3", s"s$siteId: Page not found, id: `$pageId'")
}
