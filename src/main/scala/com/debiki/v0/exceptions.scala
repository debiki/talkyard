/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package com.debiki.v0


/**
 * Fills in no stack trace, and is therefore cheap to throw (like simple `return`s).
 */
class QuickException extends Exception {

  // Fill in no stack trace. Calculating the stack trace is very expensive,
  // and this is a control flow exception rather than an error condition.
  // (Well, actually, the end user might have made an error, but that's
  // expected :-)  )
  override def fillInStackTrace(): Throwable = this

}


class DebikiException(val errorCode: String, val details: String)
  extends QuickException {

  override def getMessage = s"$details [error $errorCode]"

}


object DebikiException {

  def apply(errorCode: String, details: String) =
    new DebikiException(errorCode, details)

}

