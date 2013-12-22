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

package com.debiki.core

import java.{util => ju}
import Prelude._



trait HasPageMeta {
  self: {
    def meta: PageMeta
    def ancestorIdsParentFirst: List[PageId]
  } =>

  require(meta.parentPageId == ancestorIdsParentFirst.headOption)

  def id = meta.pageId
  def role = meta.pageRole
  def parentPageId = meta.parentPageId

  // Useful if referring to instance as e.g. "pathAndMeta", without "page" in the name.
  def pageId = meta.pageId
}



trait HasPagePath {
  self: { def path: PagePath } =>

  def anyId = path.pageId
  @deprecated("now", "use `siteId` instead")
  def tenantId = path.tenantId
  def siteId = path.tenantId
  def folder = path.folder
  def slug = path.pageSlug
  def idShownInUrl = path.showId
}



object Page {

  def apply(pathAndMeta: PagePathAndMeta, parts: PageParts): Page = Page(
    meta = pathAndMeta.meta,
    path = pathAndMeta.path,
    ancestorIdsParentFirst = pathAndMeta.ancestorIdsParentFirst,
    parts = parts)

  def newPage(
        pageRole: PageRole,
        path: PagePath,
        parts: PageParts,
        publishDirectly: Boolean = false,
        author: User): Page = {
    val partsInclAuthor = parts + author
    val meta = PageMeta.forNewPage(
      pageRole,
      author,
      parts = partsInclAuthor,
      creationDati = parts.oldestDati getOrElse new ju.Date,
      publishDirectly = publishDirectly)
    Page(meta, path, ancestorIdsParentFirst = Nil, partsInclAuthor)
  }

  def newEmptyPage(pageRole: PageRole, path: PagePath, author: User) =
    newPage(pageRole, path, PageParts(guid = "?"), author = author)

}


/** A Page can be a blog post, a forum topic, a forum topic list, a Wiki page,
  * a Wiki main page, or a site's homepage — for example.
  *
  * @param meta Meta info on the page, e.g. creation date and author user id.
  * @param path Where the page is located: site id + URL path to the page.
  * @param parts Page contents: title, body and comments.
  */
case class Page(
  meta: PageMeta,
  path: PagePath,
  ancestorIdsParentFirst: List[PageId],
  parts: PageParts) extends HasPageMeta with HasPagePath {

  requireMetaMatchesPaths(this)
  require(meta.pageId == parts.id)

  def hasIdAssigned = id != "?"

  def copyWithNewId(newId: String) =
    copy(
      meta = meta.copy(pageId = newId),
      path = path.copy(pageId = Some(newId)),
      parts = parts.copy(guid = newId))

  def copyWithNewSiteId(newSiteId: String) =
    copy(path = path.copy(tenantId = newSiteId))

  def copyWithNewAncestors(newAncestorIdsParentFirst: List[PageId]): Page =
    copy(
      meta = meta.copy(parentPageId = newAncestorIdsParentFirst.headOption),
      ancestorIdsParentFirst = newAncestorIdsParentFirst)

  def withoutPath = PageNoPath(parts, ancestorIdsParentFirst, meta)
}


/** A page that does not know what it contains (the `parts` fields is absent).
  */
case class PagePathAndMeta(
  path: PagePath,
  ancestorIdsParentFirst: List[PageId],
  meta: PageMeta)
  extends HasPagePath with HasPageMeta {

  requireMetaMatchesPaths(this)
}



/** Helper function that checks that page meta and page path IDs matches. */
object requireMetaMatchesPaths {
  def apply(page: {
    def meta: PageMeta
    def path: PagePath
    def ancestorIdsParentFirst: List[PageId]
  }) {
    if (page.path.pageId.isDefined) require(page.meta.pageId == page.path.pageId.get)
    else require(page.meta.pageId == "?")

    require(page.ancestorIdsParentFirst.headOption == page.meta.parentPageId,
      o"""meta.parentPageId != ancestorIdsParentFirst.head:
    ${page.meta.parentPageId} and ${page.ancestorIdsParentFirst}, page id: ${page.meta.pageId}""")
  }
}



/** A page that does not know where it's located (it doesn't know its URL or ancestor ids).
  */
case class PageNoPath(parts: PageParts, ancestorIdsParentFirst: List[PageId], meta: PageMeta)
  extends HasPageMeta {

  def +(user: User): PageNoPath =
    copy(parts = parts + user)

  def +(actionDto: PostActionDtoOld): PageNoPath =
    copy(parts = parts + actionDto)

}



object PageMeta {

  def forNewPage(
        pageRole: PageRole,
        author: User,
        parts: PageParts,
        creationDati: ju.Date = new ju.Date,
        parentPageId: Option[String] = None,
        publishDirectly: Boolean = false) =
    PageMeta(
      pageId = parts.pageId,
      pageRole = pageRole,
      creationDati = creationDati,
      modDati = creationDati,
      pubDati = if (publishDirectly) Some(creationDati) else None,
      parentPageId = parentPageId,
      pageExists = false,
      cachedTitle = parts.maybeUnapprovedTitleText,
      cachedAuthorDispName = author.displayName,
      cachedAuthorUserId = author.id,
      cachedNumPosters = parts.numPosters,
      cachedNumActions = parts.actionCount,
      cachedNumPostsToReview = parts.numPostsToReview,
      cachedNumPostsDeleted = parts.numPostsDeleted,
      cachedNumRepliesVisible = parts.numRepliesVisible,
      cachedLastVisiblePostDati = parts.lastVisiblePostDati,
      cachedNumChildPages = 0)

  def forChangedPage(originalMeta: PageMeta, changedPage: PageParts): PageMeta = {
    require(changedPage.id == originalMeta.pageId)

    // Re the page modification dati: Sometimes an empty page is created,
    // and then, later on, a title (for example) is added to the page. But this
    // title might have an older creation time than the page itself, if the
    // title was created in-memory before the page. Then use the page's
    // modification time, not the title's, so we won't accidentally set the
    // page modification time to *before* its creation time.
    val modifiedAt = new ju.Date(math.max(
      changedPage.modificationDati.map(_.getTime) getOrElse 0: Long,
      originalMeta.modDati.getTime))

    originalMeta.copy(
      cachedTitle = changedPage.approvedTitleText,
      modDati = modifiedAt,
      cachedNumPosters = changedPage.numPosters,
      cachedNumActions = changedPage.actionCount,
      cachedNumPostsDeleted = changedPage.numPostsDeleted,
      cachedNumRepliesVisible = changedPage.numRepliesVisible,
      cachedNumPostsToReview = changedPage.numPostsToReview,
      cachedLastVisiblePostDati = changedPage.lastVisiblePostDati)
    // (cachedNumChildPages is updated elsewhere — when a child page is created.)
  }

}



case class PageMeta(
  pageId: String,
  pageRole: PageRole,
  creationDati: ju.Date,
  modDati: ju.Date,
  pubDati: Option[ju.Date] = None,
  sgfntModDati: Option[ju.Date] = None,
  parentPageId: Option[String] = None,
  pageExists: Boolean = true,
  cachedTitle: Option[String] = None,
  cachedAuthorDispName: String,
  cachedAuthorUserId: String,
  cachedNumPosters: Int = 0,
  cachedNumActions: Int = 0,
  cachedNumPostsDeleted: Int = 0,
  cachedNumRepliesVisible: Int = 0,
  cachedNumPostsToReview: Int = 0,
  cachedNumChildPages: Int = 0,
  cachedLastVisiblePostDati: Option[ju.Date] = None) {

  def status: PageStatus =
    if (pubDati.isDefined) PageStatus.Published
    else PageStatus.Draft

}



sealed abstract class PageRole {
  def parentRole: Option[PageRole] = None
  def childRole: Option[PageRole] = None
}


object PageRole {
  case object Generic extends PageRole

  case object Code extends PageRole

  case object EmbeddedComments extends PageRole

  case object Blog extends PageRole {
    override val childRole = Some(BlogPost)
  }

  case object BlogPost extends PageRole {
    override val parentRole = Some(Blog)
  }

  // Ooops, ForumGroup + Forum + ForumTopic feels over complicated. Should
  // remove ForumGroup and keep only Forum and ForumTopic.
  case object ForumGroup extends PageRole {
    // BUG, childRole should include ForumGroup itself.
    override val childRole = Some(Forum)
  }

  case object Forum extends PageRole {
    override val parentRole = Some(ForumGroup)
    override val childRole = Some(ForumTopic)
  }

  case object ForumTopic extends PageRole {
    override val parentRole = Some(Forum)
  }

  case object WikiMainPage extends PageRole {
    override val childRole = Some(WikiPage)
  }

  case object WikiPage extends PageRole {
    override val parentRole = Some(WikiMainPage)
  }


  // Hmm, regrettably this breaks should I rename any case object.
  // Perhaps use a match ... case list instead?
  private val _PageRoleLookup = Vector(
    Generic, EmbeddedComments, Blog, BlogPost,
    ForumGroup, Forum, ForumTopic,
    WikiMainPage, WikiPage,
    Code).map(x => (x, x.toString))

  def parse(pageRoleString: String): PageRole =
    _PageRoleLookup.find(_._2 == pageRoleString).map(_._1).getOrElse(
      illArgErr("DwE930rR3", s"Bad page role: `$pageRoleString'"))

}



/**
 * The page status, see debiki-for-developers.txt #9vG5I.
 */
sealed abstract class PageStatus
object PageStatus {
  // COULD rename to PrivateDraft, becaus ... other pages with limited
  // visibility might be considered Drafts (e.g. pages submitted for review).
  case object Draft extends PageStatus
  //COULD rename to Normal, because access control rules might result in
  // it effectively being non-pulbished.
  case object Published extends PageStatus

  case object Deleted extends PageStatus
  val All = List(Draft, Published, Deleted)

  def parse(text: String): PageStatus = text match {
    case "Draft" => Draft
    case "Published" => Published
    case "Deleted" => Deleted
    case x => illArgErr("DwE3WJH7", s"Bad page status: `$x'")
  }
}


case class PagePostId(pageId: PageId, postId: PostId)

