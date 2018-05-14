/**
 * Copyright (c) 2014-2016 Kaj Magnus Lindberg
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

import com.debiki.core._
import com.debiki.core.Prelude._
import debiki._
import debiki.EdHttp._
import ed.server.{EdContext, EdController}
import ed.server.http._
import javax.inject.Inject
import play.api.libs.json._
import play.api.mvc.{Action, ControllerComponents}


/** Loads and saves settings, for the whole website, site sections,
  * and individual pages. In the future probably also for user roles.
  */
class SettingsController @Inject()(cc: ControllerComponents, edContext: EdContext)
  extends EdController(cc, edContext) {

  import context.globals

  def loadSiteSettings: Action[Unit] = AdminGetAction { request: GetRequest =>
    loadSiteSettingsImpl(request)
  }


  private def loadSiteSettingsImpl(request: DebikiRequest[_]) = {
    val settings = request.dao.getWholeSiteSettings()
    val editedSettings = settings.editedSettingsChain.headOption getOrElse EditedSettings.empty
    // What's the default, if settings from parent categories have been inherited? Therefore:
    dieIf(settings.editedSettingsChain.length > 1, "EsE4GJKU0", "not tested")
    OkSafeJson(Json.obj(
      "effectiveSettings" -> settings.toJson,
      "defaultSettings" -> settings.default.toJson,
      "baseDomain" -> globals.baseDomainNoPort,
      "cnameTargetHost" -> JsString(globals.config.cnameTargetHost.getOrElse(
          s"? (config value ${Config.CnameTargetHostConfValName} missing [EsM5KGCJ2]) ?")),
      "hosts" -> request.dao.listHostnames().sortBy(_.hostname).map(host => {
        Json.obj("hostname" -> host.hostname, "role" -> host.role.IntVal)
      })
    ))
  }


  def saveSiteSettings: Action[JsValue] = AdminPostJsonAction(maxBytes = 10*1000) {
        request: JsonPostRequest =>
    val settingsToSave = debiki.Settings2.settingsToSaveFromJson(request.body, globals.config)
    throwForbiddenIf(settingsToSave.orgFullName.exists(_.isEmptyOrContainsBlank),
      "EdE5KP8R2", "Cannot clear the organization name")
    request.dao.saveSiteSettings(settingsToSave, request.who)
    loadSiteSettingsImpl(request)
  }


  def changeHostname: Action[JsValue] = AdminPostJsonAction(maxBytes = 100) { request: JsonPostRequest =>
    val newHostname = (request.body \ "newHostname").as[String]
    request.dao.changeSiteHostname(newHostname)
    Ok
  }


  def updateExtraHostnames: Action[JsValue] = AdminPostJsonAction(maxBytes = 50) {
        request: JsonPostRequest =>
    val redirect = (request.body \ "redirect").as[Boolean]
    val role = if (redirect) SiteHost.RoleRedirect else SiteHost.RoleDuplicate
    request.dao.changeExtraHostsRole(newRole = role)
    Ok
  }

}

