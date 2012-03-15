/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package com.debiki.v0

import java.{util => ju}
import Prelude._


/**
 * A notification of a page action.
 *
 * @param ctime When the notification was created
 * @param recipientUserId To whom the notification should be sent
 * @param pageTitle The titel of the page where the event happened
 * @param pageId
 * @param eventType The type of the event
 * @param eventActionId The id of the event
 * @param targetActionId An action that the event-action acted upon
 * @param recipientActionId The action the recipient made, that is the reason
 *  s/he is to be notified.
 */
case class NotfOfPageAction(
  ctime: ju.Date,
  recipientUserId: String,
  pageTitle: String,
  pageId: String,
  eventType: NotfOfPageAction.Type,
  eventActionId: String,
  targetActionId: Option[String],
  recipientActionId: String,
  recipientUserDispName: String,
  eventUserDispName: String,
  targetUserDispName: Option[String]) {

  assErrIf(targetActionId.isDefined != targetUserDispName.isDefined, "DwE8Xd2")
  assErrIf(eventType == NotfOfPageAction.Type.PersonalReply && (
    targetActionId.isDefined || targetUserDispName.isDefined), "DwE09Kb35")

  def recipientRoleId: Option[String] =
    if (recipientUserId startsWith "-") None else Some(recipientUserId)

  def recipientIdtySmplId: Option[String] =
    if (recipientUserId startsWith "-") Some(recipientUserId drop 1) else None
}


object NotfOfPageAction {
  sealed abstract class Type
  object Type {
    case object PersonalReply extends Type
  }
}


/**
 * Notifications and email addresses, needed to mail out the notfs.
 */
case class NotfsToMail(
  notfsByTenant: Map[String, Seq[NotfOfPageAction]],
  usersByTenantAndId: Map[(String, String), User])


object Notification {


  def calcFrom(user: User, adding: Seq[Action], to: Debate)
        : Seq[NotfOfPageAction] = {

    val actions = adding
    val page = to
    val seeds: Seq[NotfOfPageAction] = actions flatMap (_ match {
      case post: Post =>
        val postRepliedTo = page.vipo_!(post.parent)
        val userRepliedTo = postRepliedTo.user_!
        if (user.id == Some(userRepliedTo.id)) {
          // Don't notify the user of his/her own replies.
          Nil
        }
        else if (post.tyype == PostType.Text) {
          NotfOfPageAction(
            ctime = post.ctime,
            recipientUserId = userRepliedTo.id,
            pageTitle = page.titleText.getOrElse("Unnamed page"),
            pageId = page.id, 
            eventType = NotfOfPageAction.Type.PersonalReply,
            eventActionId = post.id,
            targetActionId = None,
            recipientActionId = postRepliedTo.id,
            recipientUserDispName = postRepliedTo.user_!.displayName,
            eventUserDispName = user.displayName,
            targetUserDispName = None) :: Nil
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


case class EmailSent(
  id: String, 
  sentTo: String,
  sentOn: ju.Date,
  subject: String,
  bodyHtmlText: String,
  providerEmailId: String)


// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list

