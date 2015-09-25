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

import actions.ApiActions.{AdminGetAction, AdminPostJsonAction}
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


  def loadSiteSettings = AdminGetAction { request: GetRequest =>
    val settings = request.dao.loadWholeSiteSettings()
    OkSafeJson(settings.toJson)
  }


  def loadSectionSettings(rootPageId: PageId) = AdminGetAction { request: GetRequest =>
    val settings = request.dao.loadPageTreeSettings(rootPageId)
    OkSafeJson(settings.toJson)
  }


  def saveSetting = AdminPostJsonAction(maxLength = 5000) { request: JsonPostRequest =>
    val body = request.body
    val pageId = (body \ "pageId").asOpt[PageId]
    val tyype = (body \ "type").as[String]
    val name = (body \ "name").as[String]

    val newValue: Any = (body \ "newValue").get match {
      case JsBoolean(value) =>
        value
      case JsNumber(value: BigDecimal) =>
        if (value.isValidDouble) value.toDouble
        else if (value.isValidLong) value.toLong
        else throwBadReq("DwE2GKS6", s"Bad new number: $value")
      case JsString(value) =>
        value
      case x =>
        throwBadReq("DwE47XS0", s"Bad new value: `$x'")
    }

    val section = tyype match {
      case "WholeSite" =>
        SettingsTarget.WholeSite
      case "PageTree" =>
        SettingsTarget.PageTree(pageId getOrElse throwBadReq("DwE44GE0", "No page id specified"))
      case "SinglePage" =>
        SettingsTarget.SinglePage(pageId getOrElse throwBadReq("DwE55XU1", "No page id specified"))
      case x =>
        throwBadReq("DwE48UFk9", s"Bad section type: `$x'")
    }

    if (section == SettingsTarget.WholeSite && name == "EmbeddingSiteUrl") {
      // Temporary special case, until I've moved the embedding site url from
      // DW1.TENANT.EMBEDDING_SITE_URL to a normal setting in DW1_SETTINGS.
      val newValueAsString = newValue.asInstanceOf[String]
      val changedSite = request.dao.loadSite().copy(embeddingSiteUrl = Some(newValueAsString))
      request.dao.updateSite(changedSite)
    }
    else {
      request.dao.saveSetting(section, name, newValue)
    }
    Ok
  }

}

