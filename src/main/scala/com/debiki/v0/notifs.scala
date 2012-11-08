/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package com.debiki.v0

import java.{util => ju}
import Prelude._


/**
 * A notification of a page action.
 *
 * Example: You write a comment. Chatty Charlie replies to it. After a while,
 * Adam the admin approves it; this triggers a notification to you that you've
 * received a reply:
 *  - Your comment is the recipientActionId
 *  - Charlie's reply is the eventActionId (you're notified about this event)
 *  - The approval of Charlies reply is the triggerActionId
 *
 * @param ctime When the notification was created
 * @param recipientUserId To whom the notification should be sent
 * @param pageTitle The titel of the page where the event happened
 * @param pageId
 * @param eventType The type of the event
 * @param eventActionId The id of the event the recipient is notified about
 * @param triggerActionId The action that triggered the notification
 * @param recipientActionId The action the recipient made, which is the reason
 *  s/he is to be notified.
 */
case class NotfOfPageAction(
  ctime: ju.Date,
  recipientUserId: String,
  pageTitle: String,
  pageId: String,
  eventType: NotfOfPageAction.Type,
  eventActionId: String,
  triggerActionId: String,
  recipientActionId: String,
  recipientUserDispName: String,
  eventUserDispName: String,
  triggerUserDispName: Option[String],
  /** True iff an email should be created and sent. */
  emailPending: Boolean,
  /** An email that informs the recipient about this event.
  Might not yet have been sent. */
  emailId: Option[String] = None,
  debug: Option[String] = None) {

  // If the email is to be created and sent, then it must not already exist.
  require(!emailPending || emailId.isEmpty)

  def recipientRoleId: Option[String] =
    if (recipientUserId startsWith "-") None else Some(recipientUserId)

  def recipientIdtySmplId: Option[String] =
    if (recipientUserId startsWith "-") Some(recipientUserId drop 1) else None
}



object NotfOfPageAction {
  sealed abstract class Type
  object Type {
    case object PersonalReply extends Type
    case object MyPostApproved extends Type
  }
}



/**
 * Notifications and email addresses, needed to mail out the notfs.
 */
case class NotfsToMail(
  notfsByTenant: Map[String, Seq[NotfOfPageAction]],
  usersByTenantAndId: Map[(String, String), User])



object Email {

  def apply(sendTo: String, subject: String, bodyHtmlText: String): Email =
    Email(
      id = _generateId(),
      sentTo = sendTo,
      sentOn = None,
      subject = subject,
      bodyHtmlText = bodyHtmlText,
      providerEmailId = None,
      failureText = None)

  /**
   * The email id should be a random value, so it cannot be guessed,
   * because it's a key in unsubscribe URLs.
   */
  private def _generateId(): String = nextRandomString() take 8
}


case class Email(
  id: String,
  sentTo: String,
  sentOn: Option[ju.Date],
  subject: String,
  bodyHtmlText: String,
  providerEmailId: Option[String],
  failureText: Option[String] = None)


// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list

