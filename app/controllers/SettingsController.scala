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

package controllers

import actions.ApiActions.{GetAction, PostJsonAction}
import com.debiki.core._
import com.debiki.core.Prelude._
import debiki._
import debiki.DebikiHttp._
import play.api._
import play.api.libs.json._
import requests.{GetRequest, JsonPostRequest}
import Utils.OkSafeJson


/** Loads and saves settings, for the whole website, site sections,
  * and individual pages. In the future probably also for user roles.
  */
object SettingsController extends mvc.Controller {


  def loadSiteSettings = GetAction { request: GetRequest =>
    ???
  }


  def loadSectionSettings = GetAction { request: GetRequest =>
    ???
  }


  def saveSetting = PostJsonAction(maxLength = 500) { request: JsonPostRequest =>
    ???
  }


}

