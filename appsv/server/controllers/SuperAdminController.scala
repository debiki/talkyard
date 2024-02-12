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
import talkyard.server.security.WhatApiSecret.ServerSecretFor
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
    listSitesImpl(inclStaff = true)
  }


  def listSites_amsV0(): Action[U] = ApiSecretGetJsonAction(
          ServerSecretFor("ams"), RateLimits.ExpensiveGetRequest) { _ =>
    listSitesImpl(inclStaff = false)
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
    listSitesImpl(inclStaff = true)
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
    listSitesImpl(inclStaff = true)
  }


  def testIndexSites(): Action[JsValue] = PostJsonAction(
          RateLimits.AdminWritesToDb, maxBytes = 1000) { req =>
    throwForbiddenIf(globals.isProdLive, "TyE0INDEX3967", o"""I want as payload
          a complete index from the closest-to-you-but-one public library, of books
          at least 100.00 years old, with titles that include the word "Fire",
          which my doves can read for my phoenix bird, who otherwise gets quite
          restless and even hot with anger.""")
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


  private def listSitesImpl(inclStaff: Bo): p.mvc.Result = {
    val siteStuff: Seq[SASiteStuff] = globals.systemDao.loadSitesInclDetailsAndStaff()
    // Sort recent first.
    val sitesNewFirst = siteStuff.sortBy(-_.site.createdAt.toUnixMillis)
    // Count reindex ranges, and reindex queue length.
    val jobSumStat = siteStuff.foldLeft((0, 0)) { (stat: (i32, i32), stuff: SASiteStuff) =>
      (stat._1 + stuff.reindexRange.oneIfDefined, stat._2 + stuff.reindexQueueLen)
    }
    OkSafeJson(Json.obj(
      "appVersion" -> globals.applicationVersion,
      "superadmin" -> Json.obj(
        "firstSiteHostname" -> JsStringOrNull(globals.defaultSiteHostname),
        "baseDomain" -> globals.baseDomainWithPort,
        "autoPurgeDelayDays" -> JsFloat64OrNull(globals.config.autoPurgeDelayDays),
        "totReindexRanges" -> jobSumStat._1,
        "totReindexQueueLen" -> jobSumStat._2,
        "sites" -> sitesNewFirst.map(s => _siteToJson(s, inclStaff = inclStaff)))))
  }


  private def _siteToJson(siteStuff: SASiteStuff, inclStaff: Bo) = {
    val site = siteStuff.site
    var json = Json.obj(  // ts: SASite
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

    if (inclStaff) {
      json += "staffUsers" -> JsArray(siteStuff.staff.map { staffUser =>
        JsUserInclDetails(
          staffUser, usersById = Map.empty, groups = Nil, callerIsAdmin = true)
      })
    }
    json
  }


  def listCoworkersAllSites_amsV0: Action[Unit] = ApiSecretGetJsonAction(
          ServerSecretFor("ams"), RateLimits.ExpensiveGetRequest) { apiReq =>
    val coworkersBySite = apiReq.systemDao.listCoworkersAllSites()
    val json = JsObject(coworkersBySite.map(x => {
      val (siteId, cows) = x
      siteId.toString -> JsArray(cows.map((cow: Coworker) => {
        var jOb = Json.obj(
              "id" -> cow.userId,
              "trustLevel" -> cow.trustLevel.toInt,
              "createdAtMin" -> JsWhenMins(cow.createdAt))

        if (cow.isOwner) jOb += "isOwner" -> JsTrue
        if (cow.isAdmin) jOb += "isAdmin" -> JsTrue
        if (cow.isModerator) jOb += "isModerator" -> JsTrue

        cow.lockedTrustLevel.foreach(tl => jOb += "lockedTrustLevel" -> JsNumber(tl.toInt))

        // Only for site owners and admins.  (The [coworkers_query] loads this
        // only for admins & owners.) — Or let's skip completely?
        // cow.username.foreach(un => jOb += "username" -> JsString(un))
        // cow.fullName.foreach(fn => jOb += "fullName" -> JsString(fn))

        // Full email addresses only to owners and admins.
        cow.emailAdrOrDomain.foreach(em => jOb += "emailAdrOrDomain" -> JsString(em))

        cow.isApproved.foreach(isApr => jOb += "isApproved" -> JsBoolean(isApr))
        cow.emailVerifiedAt.foreach(at => jOb += "emailVerifiedAtMin" -> JsWhenMins(at))
        cow.lastSeenAt.foreach(at => jOb += "lastSeenAt" -> JsWhenMins(at))
        cow.lastPostedAt.foreach(at => jOb += "lastPostedAt" -> JsWhenMins(at))
        cow.lastEmailedAt.foreach(at => jOb += "lastEmailedAt" -> JsWhenMins(at))
        cow.suspendedTill.foreach(till => jOb += "suspendedTill" -> JsWhenMins(till))
        cow.deactivatedAt.foreach(at => jOb += "deactivatedAt" -> JsWhenMins(at))
        cow.deletedAt.foreach(at => jOb += "deletedAt" -> JsWhenMins(at))
        jOb
      }))
    }))

    OkSafeJson(json)
  }


  // An API secret in the config file, will have to do, for now.
  // Later, use ApiSecretsController, an ApiSecret of type PlanMaintenance  [api_secr_type]
  def apiV0_planMaintenance: Action[JsValue] = ApiSecretPostJsonAction(
          ServerSecretFor("sysmaint"), RateLimits.AdminWritesToDb, maxBytes = 2000,
          ) { req: JsonPostRequest =>
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

