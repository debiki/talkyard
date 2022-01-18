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

package talkyard.server.sitepatch

import com.debiki.core.Prelude._
import com.debiki.core._
import debiki._
import debiki.EdHttp._
import talkyard.server._
import talkyard.server.http.DebikiRequest
import javax.inject.Inject
import play.api._
import play.api.libs.json._
import play.api.mvc.{Action, ControllerComponents, Result}
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
class SitePatchController @Inject()(cc: ControllerComponents, edContext: TyContext)
  extends TyController(cc, edContext) {

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
      SitePatchMaker.createPostgresqlJsonBackup(anyTx = Some(tx), simpleFormat = false)
    }
    Ok(json.toString()) as JSON
  }


  /** These are dangerous endpoints, DoS attack risk.  [UPSRTPERM] */
  private def throwIfMayNot(request: DebikiRequest[_], errCode: String, message: => String = null): Unit = {
    throwForbiddenIf(
      globals.isProd
        // Iff is self hosted, we'd be using the default site — then, allow.
        && !request.isDefaultSite
        // For multi site servers: Either a magic password, or an allow-patch conf val.
        && !security.hasOkForbiddenPassword(request)
        && !(
            request.site.featureFlags.contains("ffMayPatchSite")
            || globals.config.mayPatchSite(request.siteId)),  // <—— will remove
      errCode,
      if (message ne null) message
      else "Not allowed. Ask for help at https://www.talkyard.io/forum/")
  }


  def upsertSimpleJson: Action[JsValue] = ApiSecretPostJsonAction(
          RateLimits.UpsertFew, maxBytes = maxImportDumpBytes) { request =>
    throwIfMayNot(request, "TyEM0UPSSIMPL")

    // This parses JSON, and converts the simple patch contents to a "complete" patch
    // that can be upserted.
    val sitePatch = SitePatchParser(context).parseDumpJsonMaybeThrowBadRequest(
      siteId = Some(request.siteId), request.body, simpleFormat = true, isE2eTest = false)

    if (sitePatch.hasManyThings) {
      request.context.rateLimiter.rateLimit(RateLimits.UpsertMany, request)
    }
    upsertSitePatchImpl(sitePatch, request)
  }


  def upsertPatchJson(): Action[JsValue] = ApiSecretPostJsonAction(
          RateLimits.UpsertDump, maxBytes = maxImportDumpBytes) { request =>
    throwIfMayNot(request, "TyEM0UPSPATCH")

    val sitePatch = SitePatchParser(context).parseDumpJsonMaybeThrowBadRequest(
      siteId = Some(request.siteId), request.body, simpleFormat = false, isE2eTest = false)
    upsertSitePatchImpl(sitePatch, request)
  }


  private def upsertSitePatchImpl(dump: SitePatch, request: DebikiRequest[_]) = {
    // Avoid PostgreSQL serialization errors. [one-db-writer]
    globals.pauseAutoBackgorundRenderer3Seconds()

    val upsertedThings = doImportOrUpserts {
      SitePatcher(globals).upsertIntoExistingSite(
          request.siteId, dump, request.theBrowserIdData)
    }

    Ok(upsertedThings.toSimpleJson(request.dao).toString()) as JSON
  }


  /*
  How to upload a single file, as per the Play Framework docs:
    (https://www.playframework.com/documentation/2.7.x/ScalaFileUpload)

  def upload = Action(parse.temporaryFile) { request =>
    request.body.moveFileTo(Paths.get("/tmp/picture/uploaded"), replace = true)
    Ok("File uploaded")
  }

  Or, uploading many files, see: [5039RKJW45]
  */


  SECURITY; COULD // make this an Owner endpoint, but not for all Admin:s?
  def restoreBackupOverwriteSite(): Action[JsValue] = AdminPostJsonAction2(
        RateLimits.UpsertDump, maxBytes = maxImportDumpBytes) { request =>
    throwIfMayNot(request, "TyEM0RESTR")
    importOverwriteImpl(request.underlying, request.body,
      overwriteSite = request.dao.getSite(), isTest = false)
  }


  def importSiteJson(deleteOldSite: Option[Boolean]): Action[JsValue] =
        ExceptionAction(parse.json(maxLength = maxImportDumpBytes)) { request =>
    // Dupl code (968754903265).
    throwForbiddenIf(!globals.config.mayImportSite,
      "TyEMAY0IMPDMP", o"""May not import site dumps. Set talkyard.mayImportSite to true,
         in ${talkyard.server.ProdConfFilePath}, to allow this. And restart.""")
    val isTestDeleteOld = deleteOldSite is true
    if (isTestDeleteOld && !globals.isProd) {
      globals.testResetTime()
    }
    importOverwriteImpl(request, request.body, overwriteSite = None, isTest = isTestDeleteOld)
  }


  def importTestSite: Action[JsValue] = ExceptionAction(parse.json(maxLength = maxImportDumpBytes)) {
        request =>
    // Dupl code (968754903265) — this endpoint can be replaced by the other
    // importSiteJson() just above, and a url param 'isTestDeleteOld'?
    throwForbiddenIf(!security.hasOkE2eTestPassword(request),
      "TyE5JKU2", "Importing test sites only allowed when e2e testing")
    globals.testResetTime()
    importOverwriteImpl(request, request.body, overwriteSite = None, isTest = true)
  }


  private def importOverwriteImpl(request: play.api.mvc.Request[_], json: JsValue,
        overwriteSite: Option[Site], isTest: Boolean)
        : Result = {
    val (browserId, moreNewCookies) =
          security.getBrowserIdCreateCookieIfMissing(request, isLogin = false)
    val browserIdData = BrowserIdData(ip = request.remoteAddress,
          idCookie = browserId.map(_.cookieValue), fingerprint = 0)
    val response = importSiteImpl(json, browserIdData, overwriteSite, isTest = isTest)
    response.withCookies(moreNewCookies: _*)
  }


  private val ImportLock = new Object
  @volatile
  private var numImporingNow = 0


  private def importSiteImpl(json: JsValue, browserIdData: BrowserIdData,
      overwriteSite: Option[Site], isTest: Boolean): mvc.Result = {

    // Avoid PostgreSQL serialization errors. [one-db-writer]
    globals.pauseAutoBackgorundRenderer3Seconds()

    val siteData: SitePatch = {
        val siteDump = SitePatchParser(context).parseDumpJsonMaybeThrowBadRequest(
          siteId = None, json, simpleFormat = false, isE2eTest = isTest)
        throwBadRequestIf(siteDump.site.isEmpty, "TyE305MHKR2", "No site meta included in dump")
        throwBadRequestIf(siteDump.settings.isEmpty, "TyE5KW0PG", "No site settings included in dump")
        // Unless we're deleting any old site, don't import the new site's hostnames —
        // they can cause unique key errors. The site owner can instead add the right
        // hostnames via the admin interface later.
        siteDump
    }

    val siteMeta = siteData.site.getOrDie("TyE04HKRG53")
    val onlyTestHostnames = siteMeta.hostnames.forall(h => Hostname.isE2eTestHostname(h.hostname))

    // For now, so broken tests fail fast?
    dieIf(isTest && !onlyTestHostnames,
      "TyE602WKJHF63", s"Test site hostnames should start with: ${Hostname.E2eTestPrefix}")

    val newSite: Site = doImportOrUpserts {
      // Delete test sites with the same hostnames, to avoid unique key errors. [DELTSTHOSTS]
      if (isTest && onlyTestHostnames) {
        globals.systemDao.deleteSitesWithNameOrHostnames(
              siteMeta.name, hostnames = siteMeta.hostnames.map(_.hostname).toSet)
      }

      SitePatcher(globals).importCreateSite(
        siteData, browserIdData, anySiteToOverwrite = overwriteSite, isTest = isTest)
    }

    val anySiteCanonHost = newSite.canonicalHostnameStr
    val anySiteOrigin = anySiteCanonHost.map(globals.schemeColonSlashSlash + _)

    Ok(Json.obj(
      "id" -> newSite.id,
      "pubId" -> newSite.pubId,
      "origin" -> JsStringOrNull(anySiteOrigin),
      "siteIdOrigin" -> globals.siteByIdOrigin(newSite.id),
      "cdnOriginOrEmpty" -> JsString(globals.anyCdnOrigin getOrElse ""),
      "cdnOrSiteOrigin" -> JsStringOrNull(globals.anyCdnOrigin orElse anySiteOrigin)
      )) as JSON
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
      catch {
        case DbDao.SiteAlreadyExistsException(site, details) =>
          throwForbidden("TyE6DKDT025", o"""There's another site with that name already,
            details: $details""")
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

