/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package com.debiki.v0

import java.{util => ju}
import Prelude._


/** E,g, a notification of a reply to a comment the user has made.
 *
 *  Sent by email and/or shown on the Web site.
 */
case class InboxItem(
  tyype: Do,
  title: String,
  summary: String,
  pageId: String,
  pageActionId: String,
  sourceActionId: String,
  ctime: ju.Date)


/** Used when saving an inbox item to database.
 *
 *  All InboxItem fields are not present, because they're stored
 *  elsewhere in the database and available later when an
 *  InboxItem is to be constructed anyway.
 */
case class InboxSeed(
  // Either a role id or an unauthenticated user id (i.e. IdentitySimple).
  // Starts with '-' for unauthenticated users.
  userId: String,
  pageId: String,
  pageActionId: String,
  sourceActionId: String,
  ctime: ju.Date
){
  def roleId: Option[String] =
    if (userId startsWith "-") None else Some(userId)

  def idtySmplId: Option[String] =
    if (userId startsWith "-") Some(userId drop 1) else None
}


object Inbox {

  def calcSeedsFrom(user: Option[User], adding: Seq[Action],
                    to: Debate): Seq[InboxSeed] = {
    val actions = adding
    val page = to
    val seeds: Seq[InboxSeed] = actions flatMap (_ match {
      case post: Post =>
        val postRepliedTo = page.vipo_!(post.parent)
        val userRepliedTo = postRepliedTo.user_!
        if (user.map(_.id) == Some(userRepliedTo.id)) {
          // Don't notify the user of his/her own replies.
          Nil
        }
        else if (post.tyype == PostType.Text) {
          InboxSeed(userId = userRepliedTo.id, pageId = page.guid,
                pageActionId = post.id, sourceActionId = post.id,
                ctime = post.ctime) :: Nil
        } else {
          // Currently not supported.
          // Need to make loadInboxItem understand DW1_PAGE_ACTIONS = 'Tmpl',
          // and should render Template suggestions differently from
          // normal replies? The link should open the suggestion
          // on a new page, with the template as root post?
          Nil
        }
      case e: Edit =>
        Nil  // fix later
      case app: EditApp =>
        Nil  // fix later
      case flag: Flag =>
        Nil  // fix later
      case _ =>
        Nil  // skip for now
    })

    // val pageAuthorInboxSeed = ...
    // val moderatorInboxSeed = ...
    seeds  // ++ pageAuthorInboxSeed ++ moderatorInboxSeed
  }
}


// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list

