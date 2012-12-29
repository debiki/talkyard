/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package test

import org.scalatest.{Suite, SuiteMixin}
import org.scalatest.exceptions.TestPendingException
import scala.util.control.NonFatal
import com.debiki.v0.Prelude._


/**
 * If one test fails, then this traits lets all other tests fail, with
 * status pending. (They're pending the fix of the failed test.)
 */
trait FailsOneCancelRemaining extends SuiteMixin {
  self: Suite =>

  private var anyFailure = false

  abstract override def withFixture(test: NoArgTest) {
    if (anyFailure) {
      cancel
    }
    else try {
      super.withFixture(test)
    }
    catch {
      case ex: TestPendingException =>
        throw ex
      case NonFatal(t: Throwable) =>
        anyFailure = true
        throw t
    }
  }
}

