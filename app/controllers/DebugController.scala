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

package controllers

import actions.SafeActions.{ExceptionAction, SessionAction}
import com.debiki.core._
import java.{util => ju}
import play.api._
import play.api.libs.json.JsObject
import play.api.mvc.BodyParsers.parse.empty


/** Intended for troubleshooting, via the browser.
  */
object DebugController extends mvc.Controller {


  /** For performance tests. */
  def pingExceptionAction = ExceptionAction(empty) { request =>
      Ok("exception-action-pong")
    }


  /** For performance tests. */
  def pingSessionAction = SessionAction(empty) {
    request: actions.SafeActions.SessionRequestNoBody =>
      Ok("session-action-pong")
  }

}

