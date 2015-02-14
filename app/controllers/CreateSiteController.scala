/**
 * Copyright (C) 2013 Kaj Magnus Lindberg (born 1979)
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
import actions.SafeActions._
import com.debiki.core._
import com.debiki.core.Prelude._
import controllers.Utils.{ OkSafeJson, isOkayEmailAddress }
import debiki._
import debiki.DebikiHttp._
import debiki.dao.SiteDao
import java.{util => ju}
import play.api._
import play.api.libs.json._
import play.api.mvc.{Action => _, _}
import play.api.mvc.BodyParsers.parse.empty
import requests._


/** Creates new empty sites, for forums, blogs or embedded comments.
  *
  * Each new empty site remembers an admin email address. When the site creator later
  * logs in with that email address, s/he becomes admin for the site.
  */
object CreateSiteController extends mvc.Controller {

  private val log = play.api.Logger


  def start = GetAction { request =>
    throwIfMayNotCreateWebsite(request)
    Ok(views.html.createsite.createSitePage(SiteTpi(request)).body) as HTML
  }


  def createSite = PostJsonAction(RateLimits.CreateSite, maxLength = 200) { request =>
    throwIfMayNotCreateWebsite(request)

    val acceptTermsAndPrivacy = (request.body \ "acceptTermsAndPrivacy").as[Boolean]
    val emailAddress = (request.body \ "emailAddress").as[String]
    val localHostname = (request.body \ "localHostname").as[String]
    val anyEmbeddingSiteAddress = (request.body \ "embeddingSiteAddress").asOpt[String]

    if (!acceptTermsAndPrivacy)
      throwForbidden("DwE877FW2", "You need to accept the terms of use and privacy policy")

    if (!isOkaySiteName(localHostname))
      throwForbidden("DwE5YU70", "Bad site name")

    if (!isOkayEmailAddress(emailAddress))
      throwForbidden("DwE8FKJ4", "Bad email address")

    val hostname = s"$localHostname.${Globals.baseDomain}"

    val newSite: Tenant =
      try {
        request.dao.createSite(
          name = localHostname, hostname = hostname, embeddingSiteUrl = anyEmbeddingSiteAddress,
          creatorIp = request.ip, creatorEmailAddress = emailAddress)
      }
      catch {
        case _: DbDao.SiteAlreadyExistsException =>
          throwForbidden("DwE039K2", "A site with that name has already been created")
        case _: DbDao.TooManySitesCreatedException =>
          throwForbidden("DwE7IJ08", "You have created too many sites already, sorry.")
      }

    OkSafeJson(
      Json.obj("newSiteOrigin" -> newSite.chost_!.origin))
  }


  /** Must be a valid host name, not too long or too short (less than 6 chars),
    * no '.' and no leading or trailing '-'. See test suite in SiteCreatorSpec.
    */
  def isOkaySiteName(name: String): Boolean = {
    OkWebsiteNameRegex matches name
  }

  private val OkWebsiteNameRegex = """[a-z][a-z0-9\-]{4,38}[a-z0-9]""".r


  private def throwIfMayNotCreateWebsite(request: DebikiRequest[_]) {
    // For now, allow only www.debiki.com. Later on, check some config value?
    if (request.host != "www.debiki.com" &&
      !request.host.contains("localhost:") &&
      !request.host.contains("127.0.0.1:"))
      throwForbidden("DwE093AQ2", "You cannot create a new website from here.")
  }

}
