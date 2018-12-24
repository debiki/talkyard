/**
 * Copyright (C) 2014 Kaj Magnus Lindberg (born 1979)
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

import org.scalactic.{Bad, ErrorMessage, Good, Or}
import Prelude._
import scala.util.matching.Regex


object Validation {

  private val EmailOkCharsRegex = """\S+@\S+\.\S+$""".r

  // Right now, [.-] in usernames only allowed server side, because there're such
  // usernames already (by accident). Wait with enabling client side, until has impl
  // canonical usernames. [CANONUN]
  val UsernameBadCharsRegex: Regex = s"[^a-zA-Z0-9_.-]".r  // [UNPUNCT]

  private val TwoSpecialCharsRegex = ".*[_.-]{2}.*".r


  // CLEAN_UP don't return the name — looks as if it's maybe getting changed
  def checkName(name: Option[String]): Option[String] Or ErrorMessage = {
    if (name.map(_.trim) != name)
      return Bad("Name starts or ends with blanks")

    if (name.exists(_.length > 100))
      return Bad("The name is too long")

    Good(name)
  }

  // CLEAN_UP don't return the email — looks as if it's maybe getting changed
  def checkEmail(email: String): String Or ErrorMessage = {
    if (!email.isEmpty && EmailOkCharsRegex.unapplySeq(email).isEmpty)
      return Bad("Invalid email address")

    Good(email)
  }

  def requireOkEmail(email: String, errorCode: String) {
    checkEmail(email) badMap { errorMessage =>
      Prelude.throwIllegalArgument(errorCode, s"Bad email: $errorMessage")
    }
  }


  val StackExchangeUsernameRegex: Regex = "^__sx_[a-z]+_[0-9]+__$".r

  val TooShortErrorMessage = "The username is too short; it must be at least 3 characters"
  val TooLongErrorMessage = "The username is too long; it must be at most 20 characters"
  // Because of [UNPUNCT], currently cannot change *to* a username with [.-], only '_' allowed.
  // However some usernames already contain '.' (that's fine).
  def badCharsErrorMessage(char: String) =
    s"The username must use characters a-z, A-Z, 0-9 and _ only, this char not allowed: $char"
  val TwoSpecialCharsErrorMessage = "The username has two special chars in a row"
  val BadFirstCharErrorMessage = "The username's first character must be one of a-z, A-Z, 0-9 _"
  val BadLastCharErrorMessage = "The username's last character must be one of a-z, A-Z, 0-9"
  def justWeird(username: String, okayUsername: Option[String]): String = {
    val tryInsteadWith = okayUsername.map(n => s"try instead with '$n'") getOrElse ""
    s"The username is weird: '$username', $tryInsteadWith [TyE2LKB57A]"
  }

  /** Allows only usernames like '123_some_username', 3 - 20 chars.
    */
  // CLEAN_UP don't return the username — looks as if it's maybe getting changed
  def checkUsername(username: String): String Or ErrorMessage = {  CLEAN_UP // merge with ReservedNames [2PGKR8ML]
    // Tested here:
    // - ValidationTest  TyT2AKB503
    // - weird-usernames.2browsers  TyT5ABKPUW2
    // Also see [2WJBG04]

    if (StackExchangeUsernameRegex.matches(username))  // [2QWGRC8P]
      return Good(username) ; SECURITY ; COULD // require that site id is 92 or 98 (the two demo forums)

    if (username.length < Participant.MinUsernameLength)
      return Bad(TooShortErrorMessage)

    if (username.length > Participant.MaxUsernameLength)
      return Bad(TooLongErrorMessage)

    if (!charIsAzNumOrUnderscore(username.head))
      return Bad(BadFirstCharErrorMessage)

    if (!charIsAzOrNum(username.last))
      return Bad(BadLastCharErrorMessage)

    val anyBadChar = UsernameBadCharsRegex.findFirstIn(username)
    anyBadChar foreach { badChar =>
      return Bad(badCharsErrorMessage(badChar))
    }

    if (TwoSpecialCharsRegex.matches(username))
      return Bad(TwoSpecialCharsErrorMessage)

    // If the username needs to be changed somehow, to become okay — then reject it.
    val okayUsername = Participant.makeOkayUsername(username, allowDotDash = true, _ => false)
    if (okayUsername isNot username)
      return Bad(justWeird(username, okayUsername))

    Good(username)
  }

}
