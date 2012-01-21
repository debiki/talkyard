/**
 * Copyright (c) 2011 Kaj Magnus Lindberg (born 1979)
 */

package com.debiki.v0

import _root_.java.{util => ju, io => jio}
import Prelude._

/** Info on the request and requester.
 *  Sometimes only the ip is known (but there's no Login/Identity/User).
 */
case class RequestInfo(
  tenantId: String,
  ip: String,
  loginId: Option[String],
  identity: Option[Identity],
  user: Option[User],
  /** Ids of groups to which the requester belongs. */
  // userMemships: List[String],
  pagePath: PagePath,
  doo: Do
){
  require(pagePath.tenantId == tenantId) // COULD remove tenantId from pagePath
}


// COULD rename this file to perms.scala?  (permissions)

/** Identifies a page, by id or by path, and knows the path
 *  component in the URL to the page.
 *
 *  (Cannot split into separate case classes for pages and folders?
 *  /some/path/  might refer to a folder *or* a page -- the index page.)
 */
case class PagePath(  // COULD move to debate.scala.  Rename to RequestPath?
  tenantId: String,  // COULD be a Dao(parameter) instead?
  // This is either the page's parent folder, or, if no page was specified,
  // the actual target of the path.
  folder: String,
  pageId: Option[String], // COULD break out PageLookup, so would never be None
  showId: Boolean,
  pageSlug: String
){
  require(tenantId.nonEmpty)
  require(pageId != Some("?"))
  require(pageId != Some(""))
  require(folder.startsWith("/"))
  require(folder.endsWith("/"))
  // In Oracle RDBMS, "-" is stored instead of "", since Oracle
  // converts "" to null.
  require(pageSlug != "-")

  def path: String =
    if (showId) {
      val g = pageId.getOrElse(assErr( //Break out GuidLookup so cannot happen?
                "DwE23r124", "ID unknown."))
        if (pageSlug isEmpty) folder +"-"+ g
        else folder +"-"+ g +"-"+ pageSlug
    } else {
      folder + pageSlug
    }

  def slugOrIdOrQustnMark =
    if (pageSlug nonEmpty) pageSlug else pageId.map("-"+ _) getOrElse "?"

  /** True if the slug ends with e.g. `.template' or `.js' or `.css'.
   */
  def isCodePage =
    isTemplatePage ||
    (pageSlug endsWith ".js") ||
    (pageSlug endsWith ".css")

  def isTemplatePage = pageSlug endsWith ".template"

  /** True iff path ends with a `/'. Then this is a path to a  folder or
   *  a folder's index page (which is a page with an empty slug and !showId).
   */
  def isFolderPath = path endsWith "/"   // COULD rename to isFolderOrIndex
}


case class PageDetails(
  status: PageStatus,
  cachedTitle: Option[String],
  cachedPublTime: Option[ju.Date],
  cachedSgfntMtime: Option[ju.Date]
)


/** The page status, see debiki-for-developers.txt #9vG5I.
 */
sealed abstract class PageStatus
object PageStatus {
  case object Draft extends PageStatus
  case object Published extends PageStatus
  case object Deleted extends PageStatus
  val All = List(Draft, Published, Deleted)
}


sealed abstract class PageSortOrder
object PageSortOrder {
  //case object ByTitle extends PageSortOrder
  case object ByPath extends PageSortOrder
  case object ByPublTime extends PageSortOrder
}


/** Things an end user can do.
 */
sealed abstract class Do  // COULD rename to RequestType? UserRequest?

object Do {
  /*
  def fromText(text: String): Action = text match {
    // COULD find out how to do this automatically in Scala?
    //case "create" => Create  // was renamed to "newpage" in
                               // debiki-app-lift, Boot.scala
    case "reply" => Reply
    case "edit" => Edit
    case "view" => View
    case x => Unsupported(x)
  }*/

  case object Act extends Do
  case object CreatePage extends Do
  case object Reply extends Do
  case object Rate extends Do
  case object FlagPost extends Do
  case object Edit extends Do
  case object ViewEdits extends Do
  case object ApplyEdits extends Do
  case object Apply extends Do
  case object DeletePost extends Do  // TODO rename to Delete
  case object View extends Do
  /** When you Do.Use e.g. CSS or a PNG image, it's returned to the
   *  browser as text/css, or image/png, not wrapped in html. */
  case object Use extends Do
  case class Unsupported(whatUnsafe: String) extends Do {
    override def toString: String = "Unsupported("+ safe(whatUnsafe) +")"
  }
  case object List extends Do
  case object FeedAtom extends Do
}


/** A certain user's or group's permissions on something.
 */
sealed abstract class Perms

object PermsOnPage {

  val All = PermsOnPage(true, true, true, true, true, true, true)

  val Wiki = PermsOnPage(
    accessPage = true,
    createPage = true,
    editPage = true,
    editAnyReply = true,
    editNonAutReply = true
  )

  val None = PermsOnPage()
}

/** PermsOnPage
 *
 *  A users permissions on a certain page.
 */
case class PermsOnPage(

  val accessPage: Boolean = false,

  val createPage: Boolean = false,

  /** As of right now, templates are dangerous: they can include CSS
   * and Javascript. */
  val editPageTemplate: Boolean = false,

  //val replyVisible: Boolean = false
  //val replyHidden: Boolean = false  // will be reviewed later
  //val giveFeedback: Boolean = false  // only shown to article author & editors

  /** Edit the page body and title. */
  val editPage: Boolean = false,

  /** Edit all users' replies. */
  val editAnyReply: Boolean = false,

  /** Edit non-authenticated users' replies. */
  val editNonAutReply: Boolean = false,

  /** Should be granted to admins, managers, moderators only.
   *
   *  Other people should instead flag posts, and if a post is flagged
   *  e.g. Illegal X times it's automatically hidden.
   *  So flagging, not deletions, is how most users remove bad posts.
   */
  val deleteAnyReply: Boolean = false

) extends Perms

// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
