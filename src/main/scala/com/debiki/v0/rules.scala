/**
 * Copyright (c) 2011 Kaj Magnus Lindberg (born 1979)
 */

package com.debiki.v0

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

/** Identifies a page, by guid or by path, and knows the path
 *  component in the URL to the page.
 */
case class PagePath(  // COULD move to debate.scala
  tenantId: String,  // COULD be a Dao(parameter) instead?
  folder: String,
  guid: Option[String], // COULD break out PageLookup, so would never be None
  guidInPath: Boolean,
  name: String
){
  require(tenantId.nonEmpty)
  require(guid != Some("?"))
  require(guid != Some(""))
  require(folder.startsWith("/"))
  require(folder.endsWith("/"))
  // In Oracle RDBMS, " " is stored instead of "", since Oracle
  // converts "" to null:
  require(name != " ")

  def path: String =
    if (guidInPath) {
      val g = guid.getOrElse(assErr( //  Break out GuidLookup so cannot happen?
                "GUID unknown. [debiki_error_23r12]"))
        if (name isEmpty) folder +"-"+ g
        else folder +"-"+ g +"-"+ name
    } else {
      folder + name
    }

  /** True iff path ends with a `/'. Then this is a path to a  folder or
   *  a folder's index page (which is a page with an empty name).
   */
  def isFolderPath = path endsWith "/"
}

/** Things an end user can do.
 */
sealed abstract class Do

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
  case object Create extends Do
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
}

// Could perhaps: -- but don't use numbers, use ordered case objects instead?
//object Perms {
//  val No = 0
//  val Hidden = 1
//  val ForReview = 2
//  val Visible = 3
//}

/** A certain user's or group's permissions on something.
 */
sealed abstract class Perms

object PermsOnPage {
  val All = PermsOnPage(true, true, true, true, true, true)
  val Wiki = All.copy(deleteAnyReply = false)
  val None = PermsOnPage()
}

/** PermsOnPage
 *
 *  A users permissions on a certain page.
 */
case class PermsOnPage(

  val accessPage: Boolean = false,

  val createPage: Boolean = false,

  //val replyVisible: Boolean = false
  //val replyHidden: Boolean = false  // will be reviewed later
  //val giveFeedback: Boolean = false  // only shown to article author & editors

  /** Edit the root post, i.e. the blog article, if this is a blog post. */
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