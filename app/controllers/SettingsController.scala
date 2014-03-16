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
import requests.{GetRequest, JsonPostRequest}
import Utils.OkSafeJson


/** Loads and saves settings, for the whole website, site sections,
  * and individual pages. In the future probably also for user roles.
  */
object SettingsController extends mvc.Controller {


  def loadSiteSettings = GetAction { request: GetRequest =>
    val settings = request.dao.loadSiteSettings()
    OkSafeJson(settings.toJson)
  }


  def loadSectionSettings(rootPageId: PageId) = GetAction { request: GetRequest =>
    val settings = request.dao.loadSectionSettings(rootPageId)
    OkSafeJson(settings.toJson)
  }


  def saveSetting = PostJsonAction(maxLength = 500) { request: JsonPostRequest =>
    val body = request.body
    val pageId = (body \ "pageId").asOpt[PageId]
    val tyype = (body \ "type").as[String]
    val name = (body \ "name").as[String]
    val anyTextValue = (body \ "textValue").asOpt[String]
    val anyLongValue = (body \ "longValue").asOpt[Long]
    val anyDoubleValue = (body \ "doubleValue").asOpt[Double]

    val section = tyype match {
      case "WholeSite" =>
        Section.WholeSite
      case "PageTree" =>
        Section.PageTree(pageId getOrElse throwBadReq("DwE44GE0", "No page id specified"))
      case "SinglePage" =>
        Section.SinglePage(pageId getOrElse throwBadReq("DwE55XU1", "No page id specified"))
    }

    val value = anyTextValue.orElse(anyLongValue).orElse(anyDoubleValue) getOrElse
      throwBadReq("DwE0FSY5", "No value")

    request.dao.saveSetting(section, name, value)
    Ok
  }

}

