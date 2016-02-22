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

import com.debiki.core.Prelude._
import com.debiki.core._
import debiki.DebikiHttp._
import debiki.JsonUtils._
import debiki._
import io.efdi.server.http._
import java.{util => ju}
import play.api._
import play.api.libs.json._
import play.api.mvc.{Action => _}


/** Imports and exports dumps of websites.
  *
  * Currently: json only. Later: json + files in a .tar.gz.
  * Or msgpack? http://msgpack.org/index.html — but probably no big reason to use it
  * (disk space savings are small, and it makes debugging harder: unreadable files).
  * Don't use bson.
  *
  * Search for [readlater] for stuff ignored right now.
  */
object ImportExportController extends mvc.Controller {


  def importSiteJson = PostJsonAction(RateLimits.NoRateLimits, maxLength = 9999) { request =>
    val okE2ePassword = hasOkE2eTestPassword(request.request)
    if (!okE2ePassword)
      throwForbidden("EsE5JKU2", "Importing sites is only allowed for e2e testing right now")

    val siteData =
      try parseSiteJson(request, isE2eTest = okE2ePassword)
      catch {
        case ex: JsonUtils.BadJsonException =>
          throwBadRequest("EsE4GYM8", "Bad json structure: " + ex.getMessage)
        case ex: IllegalArgumentException =>
          // Some case class constructor failure.
          throwBadRequest("EsE7BJSN4", o"""Error constructing things, probably because of
              invalid value combinations: ${ex.getMessage}""")
      }

    val newSite = doImportSite(siteData, request)

    Ok(Json.obj(
      "site" -> Json.obj(
        "id" -> newSite.id,
        "siteIdOrigin" -> Globals.siteByIdOrigin(newSite.id)))) as JSON
  }


  private case class ImportSiteData(
    site: Site,
    users: Seq[CompleteUser])


  private def parseSiteJson(request: JsonPostRequest, isE2eTest: Boolean): ImportSiteData = {
    val bodyJson = request.body

    val (siteJson, usersJson) =
      try {
        (readJsObject(bodyJson, "site"),
          readJsArray(bodyJson, "users"))
      }
      catch {
        case ex: IllegalArgumentException =>
          throwBadRequest("EsE6UJM2", s"Invalid json: ${ex.getMessage}")
      }

    val siteToSave =
      try readSite(siteJson)
      catch {
        case ex: IllegalArgumentException =>
          throwBadRequest("EsE6UJM2", s"Invalid 'site' object json: ${ex.getMessage}")
      }

    val users: Seq[CompleteUser] = usersJson.value.zipWithIndex map { case (json, index) =>
      readUserOrError(json, isE2eTest) match {
        case Left(errorMessage) =>
          throwBadReq(
            "EsE5KPMW2", s"Invalid user json at index $index in the 'users' list: $errorMessage")
        case Right(user) =>
          user
      }
    }

    ImportSiteData(siteToSave, users)
  }


  def doImportSite(siteData: ImportSiteData, request: JsonPostRequest): Site = {
    // COULD do this in the same transaction as the one below — then, would need a function
    // `transaction.continueWithSiteId(zzz)`?
    val siteToSave = siteData.site
    val site = request.dao.createSite(
      siteToSave.name,
      siteToSave.canonicalHost.getOrDie("EsE2FUPFY7").hostname,
      embeddingSiteUrl = siteToSave.embeddingSiteUrl,
      pricePlan = None,
      creatorEmailAddress = siteToSave.creatorEmailAddress,
      creatorId = SystemUserId,
      browserIdData = request.theBrowserIdData,
      isTestSiteOkayToDelete = true,
      skipMaxSitesCheck = true)

    val newDao = Globals.siteDao(site.id)
    newDao.readWriteTransaction { transaction =>
      siteData.users foreach { user =>
        val newId = transaction.nextAuthenticatedUserId
        transaction.insertAuthenticatedUser(user.copy(id = newId))
      }
    }

    site
  }


  def readSite(jsObject: JsObject): Site = {
    val localHostname = readString(jsObject, "localHostname")
    Site(
      id = readString(jsObject, "id"),
      name = localHostname,
      creatorIp = "0.0.0.0",
      creatorEmailAddress = readString(jsObject, "creatorEmailAddress"),
      embeddingSiteUrl = None,
      hosts = List(
        SiteHost(localHostname, SiteHost.RoleCanonical)))
  }


  def readUserOrError(jsValue: JsValue, isE2eTest: Boolean): Either[String, CompleteUser] = {
    val jsObj = jsValue match {
      case x: JsObject => x
      case bad =>
        return Left(s"Not a json object, but a: " + classNameOf(bad))
    }

    val id = try readInt(jsObj, "id") catch {
      case ex: IllegalArgumentException =>
        return Left(s"Invalid user id: " + ex.getMessage)
    }
    val username = try readString(jsObj, "username") catch {
      case ex: IllegalArgumentException =>
        return Left(s"Invalid username: " + ex.getMessage)
    }

    try {
      val passwordHash = readOptString(jsObj, "passwordHash")
      passwordHash.foreach(DebikiSecurity.throwIfBadPassword(_, isE2eTest))
      Right(CompleteUser(
        id = id,
        username = username,
        fullName = readString(jsObj, "fullName"),
        createdAt = readDateMs(jsObj, "createdAtMs"),
        isApproved = readOptBool(jsObj, "isApproved"),
        approvedAt = readOptDateMs(jsObj, "approvedAtMs"),
        approvedById = readOptInt(jsObj, "approvedById"),
        emailAddress = readString(jsObj, "emailAddress"),
        emailNotfPrefs = EmailNotfPrefs.Receive, // [readlater]
        emailVerifiedAt = readOptDateMs(jsObj, "emailVerifiedAtMs"),
        emailForEveryNewPost = readOptBool(jsObj, "emailForEveryNewPost") getOrElse false,
        passwordHash = passwordHash,
        country = readOptString(jsObj, "country") getOrElse "",
        website = readOptString(jsObj, "website") getOrElse "",
        tinyAvatar = None, // [readlater]
        smallAvatar = None, // [readlater]
        mediumAvatar = None, // [readlater]
        isOwner = readOptBool(jsObj, "isOwner") getOrElse false,
        isAdmin = readOptBool(jsObj, "isAdmin") getOrElse false,
        isModerator = readOptBool(jsObj, "isModerator") getOrElse false,
        suspendedAt = readOptDateMs(jsObj, "suspendedAtMs"),
        suspendedTill = readOptDateMs(jsObj, "suspendedTillMs"),
        suspendedById = readOptInt(jsObj, "suspendedById"),
        suspendedReason = readOptString(jsObj, "suspendedReason")))
    }
    catch {
      case ex: IllegalArgumentException =>
        Left(s"Bad json for user id $id, username '$username': ${ex.getMessage}")
    }
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

