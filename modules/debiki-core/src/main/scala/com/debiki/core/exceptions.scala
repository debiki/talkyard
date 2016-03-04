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


/**
 * Fills in no stack trace, and is therefore cheap to throw (like simple `return`s).
 */
class QuickException extends Exception {

  override def getMessage = "QuickException"

  // Fill in no stack trace. Calculating the stack trace is very expensive,
  // and this is a control flow exception rather than an error condition.
  // (Well, actually, the end user might have made an error, but that's
  // expected :-)  )
  override def fillInStackTrace(): Throwable = this

}


class QuickMessageException(val message: String)
  extends QuickException {

  override def getMessage = message

}


class DebikiException(val errorCode: String, val details: String)
  extends QuickException {

  override def getMessage = s"$details [$errorCode]"

}


object DebikiException {

  def apply(errorCode: String, details: String) =
    new DebikiException(errorCode, details)

}

