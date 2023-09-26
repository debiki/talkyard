/**
 * Copyright (c) 2016 Kaj Magnus Lindberg
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
import debiki.{JsonUtils, RateLimits, SiteTpi}
import debiki.EdHttp._
import debiki.JsonUtils._
import talkyard.server.{TyContext, TyController}
import talkyard.server.http.JsonPostRequest
import debiki.dao.SASiteStuff
import javax.inject.Inject
import play.{api => p}
import play.api.libs.json._
import play.api.mvc.{Action, ControllerComponents}
import talkyard.server.JsX._


class SuperAdminController @Inject()(cc: ControllerComponents, edContext: TyContext)
  extends TyController(cc, edContext) {

  import context.globals

  def redirect: Action[Unit] = GetAction { apiReq =>
    Redirect(routes.SuperAdminController.superAdminApp("").url)
  }


  def superAdminApp(clientRoute: String): Action[Unit] = SuperAdminGetAction { apiReq =>
    _root_.controllers.dieIfAssetsMissingIfDevTest()
    val siteTpi = SiteTpi(apiReq)
    CSP_MISSING
    val pageBody = views.html.adminPage(siteTpi, appId = "theSuperAdminApp").body
    Ok(pageBody) as HTML
  }


  // (Rename to getDashboardData() ?)
  def listSites(): Action[Unit] = SuperAdminGetAction { request =>
    listSitesImpl()
  }


  def updateSites(): Action[JsValue] = SuperAdminPostJsonAction(maxBytes = 10*1000) {
          request =>
    val jsObjs = request.body.as[Seq[JsObject]]
    val patches: Seq[SuperAdminSitePatch] = jsObjs.map(jsObj => {
      val siteId = (jsObj \ "id").as[SiteId]
      val newStatusInt = (jsObj \ "status").as[Int]
      val newNotes = (jsObj \ "superStaffNotes").asOptStringNoneIfBlank
      val featureFlags = (jsObj \ "featureFlags").asTrimmedSt
      val rdbQuotaMiBs = parseOptInt32(jsObj, "rdbQuotaMiBs")
      val fileQuotaMiBs = parseOptInt32(jsObj, "fileQuotaMiBs")
      val readLimitsMultiplier = parseOptFloat32(jsObj, "readLimsMult")
      val logLimitsMultiplier = parseOptFloat32(jsObj, "logLimsMult")
      val createLimitsMultiplier = parseOptFloat32(jsObj, "createLimsMult")
      val newStatus = SiteStatus.fromInt(newStatusInt) getOrElse {
        throwBadRequest("EsE402KU2", s"Bad status: $newStatusInt")
      }
      SuperAdminSitePatch(
            siteId = siteId,
            newStatus,
            newNotes = newNotes,
            rdbQuotaMiBs = rdbQuotaMiBs,
            fileQuotaMiBs = fileQuotaMiBs,
            readLimitsMultiplier = readLimitsMultiplier,
            logLimitsMultiplier = logLimitsMultiplier,
            createLimitsMultiplier = createLimitsMultiplier,
            featureFlags = featureFlags)
    })
    globals.systemDao.updateSites(patches)
    listSitesImpl()
  }


  def schedulePurgeSites(): Action[JsValue] = SuperAdminPostJsonAction(maxBytes = 1000) {
          request =>
    val jsObjs = request.body.as[Seq[JsObject]]

    val siteIdDays: Seq[(SiteId, Opt[f32])] = jsObjs.map(jsObj => {
      val siteId = parseInt32(jsObj, "siteId")
      val purgeAfterDays = parseOptFloat32(jsObj, "purgeAfterDays")
      (siteId, purgeAfterDays)
    })

    for ((siteId: SiteId, days) <- siteIdDays) {
      globals.systemDao.schedulePurgeSite(siteId = siteId, afterDays = days)
    }
    listSitesImpl()
  }


  def testIndexSites(): Action[JsValue] = PostJsonAction(
          RateLimits.AdminWritesToDb, maxBytes = 1000) { req =>
    throwForbiddenIf(globals.isProdLive, "TyE0INDEX3967", o"""I want as payload
          a complete index from the closest-to-you-but-one public library, of books
          at least 100.00 years old by authors whose names start with Y.""")
    _reindexImpl(req)
  }

  def reindexSites(): Action[JsValue] = SuperAdminPostJsonAction(maxBytes = 1000) { req =>
    _reindexImpl(req)
  }

  private def _reindexImpl(req: JsonPostRequest): p.mvc.Result = {
    val body = asJsObject(req.body, "The request body")
    val siteIds = parseJsArray(body, "siteIdsToReIx").map(it => asInt32(it, "site id"))
    globals.systemDao.reindexSites(siteIds = siteIds.toSet)
    Ok
  }


  private def listSitesImpl(): p.mvc.Result = {
    // The most recent first.
    // : (Seq[SiteInclDetails], Map[SiteId, Seq[UserInclDetails]], Map[SiteId, (TimeRange, i32)]) =
    //val (sitesUnsorted: Seq[SiteInclDetails], staffBySiteId) =
    val siteStuff: Seq[SASiteStuff] = globals.systemDao.loadSitesInclDetailsAndStaff()
    val sitesNewFirst = siteStuff.sortBy(-_.site.createdAt.toUnixMillis)
    val jobSumStat = siteStuff.foldLeft((0, 0)) { (stat: (i32, i32), stuff: SASiteStuff) =>
      (stat._1 + stuff.reindexRange.oneIfDefined, stat._2 + stuff.reindexQueueLen)
    }
    OkSafeJson(Json.obj(
      "appVersion" -> globals.applicationVersion,
      "superadmin" -> Json.obj(
        "firstSiteHostname" -> JsStringOrNull(globals.defaultSiteHostname),
        "baseDomain" -> globals.baseDomainWithPort,
        "autoPurgeDelayDays" -> JsFloat64OrNull(globals.config.autoPurgeDelayDays),
        "sites" -> sitesNewFirst.map(_siteToJson))))
  }


  private def _siteToJson(siteStuff: SASiteStuff) = {
    val site = siteStuff.site
    Json.obj(  // ts: SASite
      "id" -> site.id,
      "pubId" -> site.pubId,
      "status" -> site.status.toInt,
      "hostnames" -> JsArray(site.hostnames.map(h => JsString(h.hostname))),
      "canonicalHostname" -> JsStringOrNull(site.canonicalHostname.map(_.hostname)),
      "name" -> site.name,
      "superStaffNotes" -> JsStringOrNull(site.superStaffNotes),
      "featureFlags" -> JsString(site.featureFlags),
      "createdAtMs" -> site.createdAt.millis,
      "deletedAtMs" -> JsWhenMsOrNull(site.deletedAt),
      "autoPurgeAtMs" -> JsWhenMsOrNull(site.autoPurgeAt),
      "purgedAtMs" -> JsWhenMsOrNull(site.purgedAt),
      "readLimsMult" -> JsFloatOrNull(site.readLimitsMultiplier),
      "logLimsMult" -> JsFloatOrNull(site.logLimitsMultiplier),
      "createLimsMult" -> JsFloatOrNull(site.createLimitsMultiplier),
      "stats" -> JsSiteStats(site.stats),
      "staffUsers" -> JsArray(siteStuff.staff.map { staffUser =>
        JsUserInclDetails(
              staffUser, usersById = Map.empty, groups = Nil, callerIsAdmin = true)
      }),
      "reindexRangeMs" -> (siteStuff.reindexRange match {
        case None => JsNull
        case Some(range) => Json.arr(
              JsWhenMs(range.from),
              JsNumber(range.fromOfs),
              JsWhenMs(range.to),
              JsNumber(range.toOfs))
      }),
      "reindexQueueLen" -> siteStuff.reindexQueueLen,
      )
  }


  // An API secret in the config file, will have to do, for now.
  // Later, use ApiSecretsController, an ApiSecret of type PlanMaintenance  [api_secr_type]
  def apiV0_planMaintenance: Action[JsValue] = ApiSecretPostJsonAction(
          RateLimits.AdminWritesToDb, maxBytes = 2000) { req: JsonPostRequest =>
    apiV0_planMaintenance_impl(req)
  }


  private def apiV0_planMaintenance_impl(req: JsonPostRequest): p.mvc.Result = {
    val maintUntil: Opt[Opt[i64]] =
          JsonUtils.parseOptInt64OrNullSomeNone(req.body, "maintenanceUntilUnixSecs")
    throwBadRequestIf(maintUntil.exists(v => v.exists(_ <= 0)),
          "TyEMAINTUNTIL", "maintenanceUntilUnixSecs should be > 0")

    val maintWordsHtmlUnsafe: Opt[Opt[St]] =
          JsonUtils.parseOptStOrNullSomeNone(req.body, "maintWordsHtml")
    val maintMessageHtmlUnsafe: Opt[Opt[St]] =
          JsonUtils.parseOptStOrNullSomeNone(req.body, "maintMessageHtml")

    val settingsAft = context.globals.systemDao.writeTxLockNoSites { tx =>
      val settingsBef = tx.loadSystemSettings()
      val settingsAft = settingsBef.copy(
            maintenanceUntilUnixSecs =
                maintUntil.getOrElse(settingsBef.maintenanceUntilUnixSecs),
            maintWordsHtmlUnsafe =
                maintWordsHtmlUnsafe.getOrElse(settingsBef.maintWordsHtmlUnsafe),
            maintMessageHtmlUnsafe =
                maintMessageHtmlUnsafe.getOrElse(settingsBef.maintMessageHtmlUnsafe))
      if (settingsAft == settingsBef)
        return Ok

      tx.updateSystemSettings(settingsAft)
      settingsAft
    }

    globals.updateSystemSettings(settingsAft)
    Ok
  }
}

