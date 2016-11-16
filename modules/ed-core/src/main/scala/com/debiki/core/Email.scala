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


object Email {

  def newWithId(
    emailId: String,
    tyype: EmailType,
    sendTo: String,
    toUserId: Option[UserId],
    subject: String,
    bodyHtmlText: String): Email = {
    Email(
      id = emailId,
      tyype = tyype,
      sentTo = sendTo,
      toUserId = toUserId,
      sentOn = None,
      createdAt = new ju.Date(),
      subject = subject,
      bodyHtmlText = bodyHtmlText,
      providerEmailId = None,
      failureText = None)
  }

  def apply(
        tyype: EmailType,
        sendTo: String,
        toUserId: Option[UserId],
        subject: String,
        bodyHtmlText: (String) => String): Email = {
    val emailId = generateRandomId()
    newWithId(
      emailId,
      tyype,
      sendTo = sendTo,
      toUserId = toUserId,
      subject = subject,
      bodyHtmlText = bodyHtmlText(emailId))
  }

  def isE2eTestEmailAddress(address: String) =
    address.startsWith("e2e-test--") && address.endsWith("@example.com")

  /** The email id should be a random value, so it cannot be guessed,
    * because it's a key in reset password, unsubscription and create account urls.
    */
  def generateRandomId(): String = nextRandomString() take 16
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

  if (tyype == EmailType.CreateAccount || tyype == EmailType.ResetPassword ||
      tyype == EmailType.InvitePassword || tyype == EmailType.InviteAccepted) {
    dieIf(toUserId.isEmpty, "DwE44BPK6", s"Email '$id' lacks toUserId")
  }

}


sealed abstract class EmailType
object EmailType {
  case object Invite extends EmailType
  case object InviteAccepted extends EmailType
  case object InvitePassword extends EmailType
  case object Notification extends EmailType
  case object CreateAccount extends EmailType  // COULD rename to VerifyEmailAddress
  case object ResetPassword extends EmailType
}


