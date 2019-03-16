/**
 * Copyright (c) 2015-2019 Kaj Magnus Lindberg
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

package talkyard.server.backup

import com.debiki.core.Prelude._
import com.debiki.core._
import debiki._
import debiki.EdHttp._
import ed.server._
import javax.inject.Inject
import play.api._
import play.api.libs.json._
import play.api.mvc.{Action, ControllerComponents}


/** Imports and exports dumps of websites.
  *
  * Currently: json only. Later: json + files in a .tar.gz.
  * Or msgpack? http://msgpack.org/index.html — but probably no big reason to use it
  * (disk space savings are small, and it makes debugging harder: unreadable files).
  * Don't use bson.
  *
  * Search for [readlater] for stuff ignored right now.
  */
class SiteBackupController @Inject()(cc: ControllerComponents, edContext: EdContext)
  extends EdController(cc, edContext) {

  import context.globals
  import context.security
  import context.safeActions.ExceptionAction

  val MaxBytes = 1001000


  def exportSiteJson(): Action[Unit] = StaffGetAction { _ =>
    Ok
  }


  def importSiteJson(deleteOldSite: Option[Boolean]): Action[JsValue] =
        PostJsonAction(RateLimits.CreateSite, maxBytes = MaxBytes) { _ =>
    //val deleteOld = deleteOldSite.contains(true)
    //val createdFromSiteId = Some(request.siteId)
    //val response = importSiteImpl(request, request.theBrowserIdData, deleteOld, isTest = false)
    unimplemented("EdE2KWUP0") // check what kind of permission?
  }


  def importTestSite: Action[JsValue] = ExceptionAction(parse.json(maxLength = MaxBytes)) {
        request =>
    globals.testResetTime()
    val (browserId, moreNewCookies) = security.getBrowserIdCookieMaybeCreate(request)
    val browserIdData = BrowserIdData(ip = request.remoteAddress, idCookie = browserId.map(_.cookieValue),
      fingerprint = 0)
    val response = importSiteImpl(request, browserIdData, deleteOld = true, isTest = true)
    response.withCookies(moreNewCookies: _*)
  }


  private val ImportLock = new Object
  @volatile
  private var numImporingNow = 0


  private def importSiteImpl(request: mvc.Request[JsValue], browserIdData: BrowserIdData,
        deleteOld: Boolean, isTest: Boolean): mvc.Result = {
    dieIf(deleteOld && !isTest, "EdE5FKWU02")

    val okE2ePassword = security.hasOkE2eTestPassword(request)
    if (!okE2ePassword)
      throwForbidden("EsE5JKU2", "Importing sites is only allowed for e2e testing right now")

    // Avoid PostgreSQL serialization errors. [one-db-writer]
    globals.pauseAutoBackgorundRenderer3Seconds()

    val siteData =
      try SiteBackupReader(context).parseSiteJson(request.body, isE2eTest = okE2ePassword)
      catch {
        case ex: JsonUtils.BadJsonException =>
          throwBadRequest("EsE4GYM8", "Bad json structure: " + ex.getMessage)
        case ex: IllegalArgumentException =>
          // Some case class constructor failure.
          throwBadRequest("EsE7BJSN4", o"""Error constructing things, probably because of
              invalid value combinations: ${ex.getMessage}""")
      }

    throwForbiddenIf(
      deleteOld && !siteData.site.hosts.forall(h => SiteHost.isE2eTestHostname(h.hostname)),
      "EdE7GPK4F0", s"Can only overwrite hostnames that start with ${SiteHost.E2eTestPrefix}")

    // Don't allow more than one import at a time, because results in a
    // "PSQLException: ERROR: could not serialize access due to concurrent update" error:

    if (numImporingNow > 3)
      throwServiceUnavailable("TyE2MNYIMPRT", s"Too many parallel imports: $numImporingNow")

    val newSite = ImportLock synchronized {
      numImporingNow += 1
      try {
        SiteBackupImporterExporter(globals).importSite(
          siteData, browserIdData, deleteOldSite = deleteOld)
      }
      finally {
        numImporingNow -= 1
      }
    }

    Ok(Json.obj(
      "id" -> newSite.id,
      "origin" -> (globals.schemeColonSlashSlash + newSite.theCanonicalHost.hostname),
      "siteIdOrigin" -> globals.siteByIdOrigin(newSite.id))) as JSON
  }


  /* Later: Need to handle file uploads / streaming, so can import e.g. images.
  def importSite(siteId: SiteId) = PostFilesAction(RateLimits.NoRateLimits, maxBytes = 9999) {
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

