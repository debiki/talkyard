/**
 * Copyright (c) 2018 Kaj Magnus Lindberg
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
import debiki.EdHttp._
import talkyard.server.{TyContext, TyController}
import talkyard.server.http._
import javax.inject.Inject
import play.api.libs.json._
import play.api.mvc._
import scala.collection.immutable
import talkyard.server.JsX.JsApiSecret


class ApiSecretsController @Inject()(cc: ControllerComponents, edContext: TyContext)
  extends TyController(cc, edContext) {


  def listApiSecrets(): Action[Unit] = AdminGetAction { request: GetRequest =>
    listApiSecretsImpl(request)
  }


  private def listApiSecretsImpl(request: DebikiRequest[_]): Result = {
    val secrets = request.dao.listApiSecrets(limit = 100)
    OkSafeJson(JsArray(secrets map JsApiSecret))
  }


  def createApiSecret: Action[JsValue] = AdminPostJsonAction(maxBytes = 500) {
        request: JsonPostRequest =>
    import request.{body, dao}

    throwForbiddenIf(!dao.getWholeSiteSettings().enableApi,
          "TyE8B6MEG24M", "API not enabled")

    // Feels best to explicitly require forAnyUser=true, so won't accidentally create
    // a for-any-user key just because forgot to specify user id.
    val forUserId: Option[UserId] = (body \ "forUserId").asOpt[UserId]
    val forAnyUser: Option[Boolean] = (body \ "forAnyUser").asOpt[Boolean]

    // Right now, only API secrets that work with any user id, have been implemented.
    throwForbiddenIf(forUserId.isDefined, "TyE2ABKR5", "Unimplemented")
    throwForbiddenIf(forAnyUser isNot true, "TyE5KLRG02", "Unimplemented")

    val secret = dao.createApiSecret(forUserId)
    OkSafeJson(JsApiSecret(secret))
  }


  def deleteApiSecrets: Action[JsValue] = AdminPostJsonAction(maxBytes = 10*1000) {
        request: JsonPostRequest =>

    // Maybe makes sense to allow this, even if API not enabled, so one can still
    // delete old secrets.

    import request.{dao, body}
    val secretNrs = (body \ "secretNrs").as[immutable.Seq[ApiSecretNr]]
    dao.deleteApiSecrets(secretNrs)
    listApiSecretsImpl(request)
  }

}

// ADD_TO_DOCS:  Show a user friendly message, if an API secret is missing, e.g.
// if there should be one in the config file: [api_secr_type]
/*
val maintenanceApiSecret = context.globals.conf.getOptional[St]("talkyard.maintenanceApiSecret")
  .getOrThrowForbidden("TyE0MAINTSECRETCONF", i"""
      |No maintenance API secret configured.
      |
      |Add this to /opt/talkyard/conf/play-framework.conf:
      |
      |    talkyard.maintenanceApiSecret="long_random_maintenance_API_secret"
      |
      |and restart the Talkyard app server:
      |
      |    sudo -i
      |    cd /opt/talkyard/
      |    docker-compose restart app
      |
      |Then, include in this API request:
      |
      |Auth: ...
      |""")
*/
