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
   * because it's a key in reset password, unsubscription and create account urls.
   */
  private def _generateId(): String = nextRandomString() take 14
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

}


sealed abstract class EmailType
object EmailType {
  case object Notification extends EmailType
  case object CreateAccount extends EmailType  // COULD rename to VerifyEmailAddress
  case object ResetPassword extends EmailType
}


