/**
 * Copyright (c) 2012-2013 Kaj Magnus Lindberg (born 1979)
 */

package com.debiki.v0

import java.{util => ju}
import Prelude._



trait HasPageMeta {
  self: { def meta: PageMeta } =>

  def id = meta.pageId
  def role = meta.pageRole
  def parentPageId = meta.parentPageId
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
    Page(meta, path, partsInclAuthor)
  }

  def newEmptyPage(pageRole: PageRole, path: PagePath, author: User) =
    newPage(pageRole, path, PageParts(guid = "?"), author = author)

}


case class Page(
  meta: PageMeta,
  path: PagePath,
  parts: PageParts) extends HasPageMeta with HasPagePath {

  if (path.pageId.isDefined) require(meta.pageId == path.pageId.get)
  else require(meta.pageId == "?")

  require(meta.pageId == parts.id)

  def hasIdAssigned = id != "?"

  def copyWithNewId(newId: String) =
    Page(
      meta.copy(pageId = newId), path = path.copy(pageId = Some(newId)),
      parts = parts.copy(guid = newId))

  def copyWithNewSiteId(newSiteId: String) =
    Page(meta, path = path.copy(tenantId = newSiteId), parts)

  def withoutPath = PageNoPath(parts, meta)
}


/** A page that does not know what it contains (the `parts` fields is absent).
  */
case class PagePathAndMeta(path: PagePath, meta: PageMeta)
  extends HasPagePath with HasPageMeta



/** A page that does not know where it's located (it doesn't know its URL).
  */
case class PageNoPath(parts: PageParts, meta: PageMeta)
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

  case object Blog extends PageRole {
    override val childRole = Some(BlogPost)
  }

  case object BlogPost extends PageRole {
    override val parentRole = Some(Blog)
  }

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
    Generic, Blog, BlogPost,
    ForumGroup, Forum, ForumTopic,
    WikiMainPage, WikiPage, Code).map(x => (x, x.toString))

  def parse(pageRoleString: String): PageRole =
    _PageRoleLookup.find(_._2 == pageRoleString).map(_._1).getOrElse(
      illArgErr("DwE930rR3", s"Bad page role: `$pageRoleString'"))

}


/* In the future: ?

sealed abstract class PageStatus

object PageStatus {
  case object Normal extends PageStatus
  case object Deleted extends PageStatus
  case object Purged extends PageStatus
}
*/


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



