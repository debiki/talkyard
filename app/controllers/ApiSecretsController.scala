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
import debiki.EdHttp._
import debiki.JsX.JsApiSecret
import ed.server.{EdContext, EdController}
import ed.server.http._
import javax.inject.Inject
import play.api.libs.json._
import play.api.mvc._
import scala.collection.immutable


class ApiSecretsController @Inject()(cc: ControllerComponents, edContext: EdContext)
  extends EdController(cc, edContext) {


  def listApiSecrets(): Action[Unit] = AdminGetAction { request: GetRequest =>
    val secrets = request.dao.listApiSecrets(limit = 100)
    OkSafeJson(JsArray(secrets map JsApiSecret))
  }


  def createApiSecret: Action[JsValue] = AdminPostJsonAction(maxBytes = 500) {
        request: JsonPostRequest =>
    import request.{body, dao}
    val forUserId: Option[UserId] = (body \ "forUserId").asOpt[UserId]

    // For now:
    throwForbiddenIf(forUserId.isDefined, "TyE2ABKR5", "Unimplemented")

    val secret = dao.createApiSecret(forUserId)
    OkSafeJson(JsApiSecret(secret))
  }


  def deleteApiSecrets: Action[JsValue] = AdminPostJsonAction(maxBytes = 10*1000) {
        request: JsonPostRequest =>
    import request.{dao, body}
    val secretNrs = (body \ "secretNrs").as[immutable.Seq[ApiSecretNr]]
    dao.deleteApiSecrets(secretNrs)
    Ok
  }

}
