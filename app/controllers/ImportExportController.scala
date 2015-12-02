/**
 * Copyright (c) 2015 Kaj Magnus Lindberg
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

import actions.ApiActions._
import com.debiki.core.PageParts.MaxTitleLength
import com.debiki.core.Prelude._
import com.debiki.core._
import debiki.DebikiHttp._
import debiki.ReactJson.JsStringOrNull
import debiki._
import debiki.antispam.AntiSpam.throwForbiddenIfSpam
import play.api._
import play.api.libs.json._
import play.api.mvc.{Action => _}
import requests._

import scala.concurrent.ExecutionContext.Implicits.global


/** Imports and exports dumps of websites.
  *
  * Currently: json only. Later: msgpack? http://msgpack.org/index.html.
  * Or json + files in a .tar.gz? But not bson.
  */
object ImportExportController extends mvc.Controller {


  def importSiteJson = PostJsonAction(RateLimits.NoRateLimits, maxLength = 9999) { request =>
    SECURITY ; MUST // auth. Rate limit. Disable unless e2e, for now.
    Ok
  }


  /* Later: Need to handle file uploads / streaming, so can import e.g. images.
  def importSite(siteId: SiteId) = PostFilesAction(RateLimits.NoRateLimits, maxLength = 9999) {
        request =>

    SEC URITY ; MU ST // auth. Disable unless e2e.

    val multipartFormData = request.body match {
      case Left(maxExceeded: mvc.MaxSizeExceeded) =>
        throwForbidden("EsE4JU21", o"""File too large: I got ${maxExceeded.length} bytes,
          but size limit is ??? bytes""")
      case Right(data) =>
        data
    }

    val numFilesUploaded = multipartFormData.files.length
    if (numFilesUploaded != 1)
      throwBadRequest("EsE2PUG4", s"Upload exactly one file — I got $numFilesUploaded files")

    val files = multipartFormData.files.filter(_.key == "data")
    if (files.length != 1)
      throwBadRequest("EdE7UYMF3", s"Use the key name 'file' please")

    val file = files.head
  } */

}

