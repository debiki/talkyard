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
import talkyard.server.JsX.JsStringOrNull


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

  val MaxBytes: Int = 50 * 1000 * 1000


  def exportSiteJson(): Action[Unit] = AdminGetAction { request =>
    // As of 2019-03, site 121 at talkyard.net wants to try this.
    throwForbiddenIf(globals.isProd && request.site.id != 121 &&
      !security.hasOkForbiddenPassword(request),
      "TyE7KRABP2", "Exporting json is still being tested out") // add rate limits
    val json = SiteBackupMaker(context).createPostgresqlJsonBackup(request.siteId)
    Ok(json.toString()) as JSON
  }


  def importSiteJson(deleteOldSite: Option[Boolean]): Action[JsValue] =
        ExceptionAction(parse.json(maxLength = MaxBytes)) { request =>
    throwForbiddenIf(!globals.config.mayImportSite, "TyEMAY0IMPDMP", "May not import site dumps")
    /*
    //val createdFromSiteId = Some(request.siteId)
    val response = importSiteImpl(
      request.underlying, request.theBrowserIdData, deleteOld = false, isTest = false)
    response */
    val (browserId, moreNewCookies) = security.getBrowserIdCookieMaybeCreate(request)
    val browserIdData = BrowserIdData(ip = request.remoteAddress, idCookie = browserId.map(_.cookieValue),
      fingerprint = 0)
    val response = importSiteImpl(request, browserIdData, deleteOld = false, isTest = false)
    response.withCookies(moreNewCookies: _*)
  }


  def importTestSite: Action[JsValue] = ExceptionAction(parse.json(maxLength = MaxBytes)) {
        request =>
    throwForbiddenIf(!security.hasOkE2eTestPassword(request),
      "TyE5JKU2", "Importing test sites only allowed when e2e testing")
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
    dieIf(deleteOld && !isTest, "TyE5FKWU02", "Can only delete old site, if is testing")

    // Avoid PostgreSQL serialization errors. [one-db-writer]
    globals.pauseAutoBackgorundRenderer3Seconds()

    val siteData =
      try {
        val sd = SiteBackupReader(context).parseSiteJson(request.body, isE2eTest = isTest)
        // Unless we're deleting any old site, don't import the new site's hostnames —
        // they can cause unique key errors. The site owner can instead add the right
        // hostnames via the admin interface later.
        if (deleteOld) sd // won't be any unique key error
        else {
          // Later: Could import the hostnames, if currently absent in the database?
          // However, I'd guess people import the same site many times? And if
          // the hostnames are imported the first time only, that can cause confusion?
          // Maybe better to *never* import hostnames. Or URL param?
          sd.copy(site = sd.site.copy(
            pubId = Site.newPublId(),
            name = "x" + nextRandomString().toLowerCase.take(10),  // for now. Maybe remove  .name  field?
            hostnames = Nil))
        }
      }
      catch {
        case ex: JsonUtils.BadJsonException =>
          throwBadRequest("EsE4GYM8", "Bad json structure: " + ex.getMessage)
        case ex: IllegalArgumentException =>
          // Some case class constructor failure.
          throwBadRequest("EsE7BJSN4", o"""Error constructing things, probably because of
              invalid value combinations: ${ex.getMessage}""")
      }

    throwForbiddenIf(
      deleteOld && !siteData.site.hostnames.forall(h => Hostname.isE2eTestHostname(h.hostname)),
      "EdE7GPK4F0", s"Can only overwrite hostnames that start with ${Hostname.E2eTestPrefix}")

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

    val anyHostname = newSite.canonicalHostname.map(
      h => globals.schemeColonSlashSlash + h.hostname)

    Ok(Json.obj(
      "id" -> newSite.id,
      "origin" -> JsStringOrNull(anyHostname),
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

