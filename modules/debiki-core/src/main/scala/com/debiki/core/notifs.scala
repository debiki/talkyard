/**
 * Copyright (C) 2012 Kaj Magnus Lindberg (born 1979)
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
  eventActionId: ActionId,
  triggerActionId: ActionId,
  recipientActionId: ActionId,
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

  def apply(
        tyype: EmailType,
        sendTo: String,
        toUserId: Option[UserId],
        subject: String,
        bodyHtmlText: (String) => String): Email = {
    val emailId = _generateId()
    Email(
      id = emailId,
      tyype = tyype,
      sentTo = sendTo,
      toUserId = toUserId,
      sentOn = None,
      createdAt = new ju.Date(),
      subject = subject,
      bodyHtmlText = bodyHtmlText(emailId),
      providerEmailId = None,
      failureText = None)
  }

  /**
   * The email id should be a random value, so it cannot be guessed,
   * because it's a key in unsubscribe URLs.
   */
  private def _generateId(): String = nextRandomString() take 8
}


case class Email(
  id: String,
  tyype: EmailType,
  sentTo: String,
  toUserId: Option[UserId],
  sentOn: Option[ju.Date],
  createdAt: ju.Date,
  subject: String,
  bodyHtmlText: String,
  providerEmailId: Option[String],
  failureText: Option[String] = None) {

  if (tyype == EmailType.CreateAccount || tyype == EmailType.ResetPassword) {
    assErrIf(toUserId.isEmpty, "DwE44BPK6", s"Email `$id' lacks toUserId")
  }

  def toGuestId: Option[String] =
    if (toUserId.nonEmpty && toUserId.get.startsWith("-")) Some(toUserId.get drop 1)
    else None

  def toRoleId: Option[String] =
    if (toUserId.nonEmpty && !toUserId.get.startsWith("-")) Some(toUserId.get)
    else None
}


sealed abstract class EmailType
object EmailType {
  case object Notification extends EmailType
  case object CreateAccount extends EmailType  // COULD rename to VerifyEmailAddress
  case object ResetPassword extends EmailType
}
