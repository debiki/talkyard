/**
 * Copyright (C) 2013 Kaj Magnus Lindberg (born 1979)
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

package test

import com.debiki.core.Prelude._
import org.scalatest.{Suite, SuiteMixin, Outcome}
import org.scalatest.exceptions.TestPendingException
import scala.util.control.NonFatal


/**
 * If one test fails, this traits cancels all remaining tests.
 */
trait CancelAllOnFirstFailure extends SuiteMixin {
  self: Suite =>

  private var anyFailure = false

  abstract override def withFixture(test: NoArgTest): Outcome = {
    if (anyFailure) {
      cancel
    }
    else try {
      val outcome = super.withFixture(test)
      if (outcome.isExceptional) {
        System.out.println("Canceling tests, error: " + outcome.toString)
        anyFailure = true
      }
      outcome
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
