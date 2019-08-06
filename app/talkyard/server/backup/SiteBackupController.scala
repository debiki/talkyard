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
import ed.server.http.DebikiRequest
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

  private def maxImportDumpBytes: Int = globals.config.maxImportDumpBytes


  def exportSiteJson(): Action[Unit] = AdminGetAction { request =>
    exportSiteJsonImpl(request)
  }


  def exportSiteJsonImpl(request: DebikiRequest[_]): play.api.mvc.Result = {
    throwForbiddenIf(!request.theRequester.isAdmin,
      "TyE0ADM", "Only admins and Sysbot may export sites")
    if (!security.hasOkForbiddenPassword(request)) {
      request.context.rateLimiter.rateLimit(RateLimits.ExportSite, request)
    }
    val json = context.globals.siteDao(request.siteId).readOnlyTransaction { tx =>
      SiteBackupMaker.createPostgresqlJsonBackup(anyTx = Some(tx))
    }
    Ok(json.toString()) as JSON
  }


  def upsertSimpleJson: Action[JsValue] = ApiSecretPostJsonAction(
          RateLimits.UpsertSimple, maxBytes = maxImportDumpBytes) { request =>
    // Dangerous endpoint, DoS attack risk.
    // As of 2019-08, site 121 at talkyard.net wants to try this. [SITE121]
    throwForbiddenIf(globals.isProd && request.site.id != 121 && request.site.id != FirstSiteId &&
      !security.hasOkForbiddenPassword(request),
      "TyE306KDGL25", "Not allowed. Ask for permission at https://www.talkyard.io/forum/")

    // Parse JSON, construct a dump "manually", and call
    // upsertDumpJsonImpl(dump, request)
    val sitePatch = SiteBackupReader(context).parseDumpJsonMaybeThrowBadRequest(
      siteId = Some(request.siteId), request.body, simpleFormat = true, isE2eTest = false)
    upsertSitePatchImpl(sitePatch, request)
  }


  def upsertPatchJson(): Action[JsValue] = ApiSecretPostJsonAction(
          RateLimits.UpsertDump, maxBytes = maxImportDumpBytes) { request =>
    // Dangerous endpoint, DoS attack risk.
    // As of 2019-08, site 121 at talkyard.net wants to try this. [SITE121]
    throwForbiddenIf(globals.isProd && request.site.id != 121 && request.site.id != FirstSiteId &&
      !security.hasOkForbiddenPassword(request),
      "TyE602AKFDG", "Not allowed. Ask for permission at https://www.talkyard.io/forum/ ")

    val sitePatch = SiteBackupReader(context).parseDumpJsonMaybeThrowBadRequest(
      siteId = Some(request.siteId), request.body, simpleFormat = false, isE2eTest = false)
    upsertSitePatchImpl(sitePatch, request)
  }


  private def upsertSitePatchImpl(dump: SiteBackup, request: DebikiRequest[_]) = {
    // Avoid PostgreSQL serialization errors. [one-db-writer]
    globals.pauseAutoBackgorundRenderer3Seconds()

    // We don't want to change things like site hostname or settings, via this endpoint.
    throwBadRequestIf(dump.site.isDefined, "TyE5AKB025", "Don't include site meta in patch")
    throwBadRequestIf(dump.settings.isDefined, "TyE6AKBF02", "Don't include site settings in patch")

    val upsertedThings = doImportOrUpserts {
      SiteBackupImporterExporter(globals).upsertIntoExistingSite(
          request.siteId, dump, request.theBrowserIdData)
    }

    Ok(upsertedThings.toJson.toString()) as JSON
  }


  def importSiteJson(deleteOldSite: Option[Boolean]): Action[JsValue] =
        ExceptionAction(parse.json(maxLength = maxImportDumpBytes)) { request =>
    throwForbiddenIf(!globals.config.mayImportSite, "TyEMAY0IMPDMP", "May not import site dumps")
    throwForbiddenIf(deleteOldSite is true, "TyE56AKSD2", "Deleting old sites not yet well tested enough")
    /*
    //val createdFromSiteId = Some(request.siteId)
    val response = importSiteImpl(
      request.underlying, request.theBrowserIdData, deleteOld = false, isTest = false)
    response */
    val (browserId, moreNewCookies) = security.getBrowserIdCookieMaybeCreate(request)
    val browserIdData = BrowserIdData(ip = request.remoteAddress, idCookie = browserId.map(_.cookieValue),
      fingerprint = 0)
    val response = importSiteImpl(request, browserIdData, deleteOld = deleteOldSite is true,
      isTest = false)
    response.withCookies(moreNewCookies: _*)
  }


  def importTestSite: Action[JsValue] = ExceptionAction(parse.json(maxLength = maxImportDumpBytes)) {
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

    val siteData = {
        val siteDump = SiteBackupReader(context).parseDumpJsonMaybeThrowBadRequest(
          siteId = None, request.body, simpleFormat = false, isE2eTest = isTest)
        throwBadRequestIf(siteDump.site.isEmpty, "TyE305MHKR2", "No site meta included in dump")
        throwBadRequestIf(siteDump.settings.isEmpty, "TyE5KW0PG", "No site settings included in dump")
        // Unless we're deleting any old site, don't import the new site's hostnames —
        // they can cause unique key errors. The site owner can instead add the right
        // hostnames via the admin interface later.
        if (deleteOld) siteDump // won't be any unique key error
        else {
          // Later: Could import the hostnames, if currently absent in the database?
          // However, maybe sometimes people import the same site many times, to test if works?
          // And if the hostnames are imported the first time only, that can cause confusion?
          // Maybe better to *never* import hostnames. Or choose, via url param?
          val pubId = Site.newPublId()
          siteDump.copy(site = Some(siteDump.site.getOrDie("TyE305TBK").copy(
            pubId = pubId,
            name = "imp-" + pubId,  // for now. Maybe remove  .name  field?
            hostnames = Nil)))
        }
    }

    val siteMeta = siteData.site.getOrDie("TyE04HKRG53")

    throwForbiddenIf(
      deleteOld && !siteMeta.hostnames.forall(h => Hostname.isE2eTestHostname(h.hostname)),
      "EdE7GPK4F0", s"Can only overwrite hostnames that start with ${Hostname.E2eTestPrefix}")

    val newSite = doImportOrUpserts {
      SiteBackupImporterExporter(globals).importCreateSite(
        siteData, browserIdData, deleteOldSite = deleteOld)
    }

    val anyHostname = newSite.canonicalHostname.map(
      h => globals.schemeColonSlashSlash + h.hostname)

    Ok(Json.obj(
      "id" -> newSite.id,
      "origin" -> JsStringOrNull(anyHostname),
      "siteIdOrigin" -> globals.siteByIdOrigin(newSite.id))) as JSON
  }


  private def doImportOrUpserts[R](block: => R): R = {
    // Don't allow more than one import at a time, because results in a
    // "PSQLException: ERROR: could not serialize access due to concurrent update" error:
    if (numImporingNow > 3) throwServiceUnavailable(
      "TyE2MNYIMPRT", s"Too many parallel imports: $numImporingNow")
    val result: R = ImportLock synchronized {
      numImporingNow += 1
      try {
        block
      }
      finally {
        numImporingNow -= 1
      }
    }
    result
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

