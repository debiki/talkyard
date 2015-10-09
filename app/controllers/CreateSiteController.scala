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
import com.debiki.core._
import com.debiki.core.Prelude._
import controllers.Utils.{ OkSafeJson, isOkayEmailAddress }
import debiki._
import debiki.DebikiHttp._
import debiki.antispam.AntiSpam.throwForbiddenIfSpam
import play.api.libs.json._
import play.api.mvc.Controller
import requests._
import scala.concurrent.ExecutionContext.Implicits.global


/** Creates new empty sites, for forums, blogs or embedded comments.
  *
  * Each new empty site remembers an admin email address. When the site creator later
  * logs in with that email address, s/he becomes admin for the site.
  */
object CreateSiteController extends Controller {

  private val log = play.api.Logger

  // Let people use hostnames that start with 'test-' — good to know which sites are
  // in fact just people's test sites.
  // But reserve 'test--' (see if statement further below) and these prefixes:
  private val TestSitePrefixes = Seq("smoke-test-", "smoketest-", "delete-", "e2e-")

  def start = GetAction { request =>
    throwIfMayNotCreateSite(request)
    Ok(views.html.createsite.createSitePage(SiteTpi(request)).body) as HTML
  }


  def createSite = AsyncPostJsonAction(RateLimits.CreateSite, maxLength = 200) { request =>
    throwIfMayNotCreateSite(request)

    val acceptTermsAndPrivacy = (request.body \ "acceptTermsAndPrivacy").as[Boolean]
    val emailAddress = (request.body \ "emailAddress").as[String]
    val localHostname = (request.body \ "localHostname").as[String]
    val anyEmbeddingSiteAddress = (request.body \ "embeddingSiteAddress").asOpt[String]
    val anyPricePlan = (request.body \ "pricePlan").asOpt[String]
    val isTestSiteOkayToDelete = (request.body \ "testSiteOkDelete").asOpt[Boolean] == Some(true)

    if (!acceptTermsAndPrivacy)
      throwForbidden("DwE877FW2", "You need to accept the terms of use and privacy policy")

    if (!isOkaySiteName(localHostname))
      throwForbidden("DwE5YU70", "Bad site name")

    if (!isOkayEmailAddress(emailAddress))
      throwForbidden("DwE8FKJ4", "Bad email address")

    // Test sites have a certain prefix, so I know it's okay to delete them.
    if (TestSitePrefixes.exists(localHostname startsWith) && !isTestSiteOkayToDelete)
      throwForbidden("DwE48WK3", o"""Please choose another hostname; it must not
          start with any of: ${ TestSitePrefixes.mkString(", ") }""")
    if (localHostname.contains("--") && !isTestSiteOkayToDelete)
      throwForbidden("DwE5JKP3", "Please choose another hostname; it must not contain: --")

    /* Don't force people to choose a price plan directly. Instead just show a link to the pricing
    page, but let them start use their site for free for a while. Not until later, when
    they are fairly sure that they to continue using their site, do they need to read
    details about pricing.
    if (anyPricePlan.isEmpty)
      throwForbidden("DwE7KJEP8", "No price plan")
    */

    if (anyPricePlan.exists(_.trim.isEmpty))
      throwForbidden("DwE4KEWW5", "Bad price plan: Empty string")

    if (anyPricePlan.exists(_.length > 50))
      throwForbidden("DwE7KEP36", "Bad price plan: Too long")

    Globals.antiSpam.detectRegistrationSpam(request, name = localHostname,
        email = emailAddress) map { isSpamReason =>
      throwForbiddenIfSpam(isSpamReason, "DwE4KG28")

      val hostname = s"$localHostname.${Globals.baseDomainNoPort}"

      val newSite: Site =
        try {
          request.dao.createSite(
            name = localHostname, hostname = hostname, embeddingSiteUrl = anyEmbeddingSiteAddress,
            creatorEmailAddress = emailAddress,
            creatorId = request.user.map(_.id) getOrElse UnknownUserId,
            browserIdData = request.theBrowserIdData, pricePlan = anyPricePlan,
            isTestSiteOkayToDelete = isTestSiteOkayToDelete)
        }
        catch {
          case _: DbDao.SiteAlreadyExistsException =>
            throwForbidden("DwE039K2", "A site with that name has already been created")
          case _: DbDao.TooManySitesCreatedException =>
            throwForbidden("DwE7IJ08", "You have created too many sites already, sorry.")
        }

      OkSafeJson(
        Json.obj("newSiteOrigin" -> Globals.originOf(hostname)))
    }
  }


  /** Must be a valid host name, not too long or too short (less than 6 chars),
    * no '.' and no leading or trailing '-'. See test suite in SiteCreatorSpec.
    */
  def isOkaySiteName(name: String): Boolean = {
    OkWebsiteNameRegex matches name
  }

  private val OkWebsiteNameRegex = """[a-z][a-z0-9\-]{4,38}[a-z0-9]""".r


  private def throwIfMayNotCreateSite(request: DebikiRequest[_]) {
    Globals.anyCreateSiteHostname match {
      case None =>
        throwForbidden("DwE4KEGG0", "This server is not configured to allow creation of new sites")
      case Some(createSiteHostname) =>
        if (createSiteHostname != request.hostname)
          throwForbidden("DwE093AQ2", "You cannot create new sites from this address")
    }
  }

}
