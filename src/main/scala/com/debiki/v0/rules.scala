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
  pagePath: PagePath
){
  require(pagePath.tenantId == tenantId) // COULD remove tenantId from pagePath
}


case class PageDetails(
  status: PageStatus,
  cachedTitle: Option[String],
  cachedPublTime: Option[ju.Date],
  cachedSgfntMtime: Option[ju.Date],
  cachedAuthors: List[PageDetails.AuthorInfo],
  cachedCommentCount: Int)

object PageDetails {
  case class AuthorInfo(roleId: String, displayName: String)
}


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


/** A certain user's or group's permissions on something.
 */
sealed abstract class Perms

object PermsOnPage {

  val All = PermsOnPage(true, true, true, true, true, true, true, true, true)

  val Wiki = PermsOnPage(
    accessPage = true,
    createPage = true,
    editPage = true,
    editAnyReply = true,
    editUnauReply = true
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

  val moveRenamePage: Boolean = false,

  val hidePageIdInUrl: Boolean = false,

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

  /** Edit unauthenticated users' replies. */
  val editUnauReply: Boolean = false,

  /** Should be granted to admins, managers, moderators only.
   *
   *  Other people should instead flag posts, and if a post is flagged
   *  e.g. Illegal X times it's automatically hidden.
   *  So flagging, not deletions, is how most users remove bad posts.
   */
  val deleteAnyReply: Boolean = false

) extends Perms

// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
