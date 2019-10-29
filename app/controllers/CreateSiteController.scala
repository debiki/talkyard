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

import com.debiki.core._
import com.debiki.core.Prelude._
import debiki._
import debiki.EdHttp._
import ed.server.{EdContext, EdController}
import ed.server.http._
import javax.inject.Inject
import org.owasp.encoder.Encode
import play.api.libs.json._
import play.api.mvc.{Action, ControllerComponents}
import scala.util.Try
import talkyard.server.DeleteWhatSite


/** Creates new empty sites, for forums, blogs or embedded comments.
  */
class CreateSiteController @Inject()(cc: ControllerComponents, edContext: EdContext)
  extends EdController(cc, edContext) {

  import context.security._
  import context.globals

  // Let people use hostnames that start with 'test-' — good to know which sites are
  // in fact just people's test sites.
  // But reserve 'test--' (see if statement further below [7UKPwF2]) and these prefixes:
  private val TestSitePrefixes =
    Seq("smoke-test-", "smoketest-", "delete-", "e2e-", "comments-for-e2e-")

  // Don't allow names like x2345.example.com — x2345 is shorter than 6 chars (x23456 is ok though).
  private val MinLocalHostnameLength = 6


  def showPage(isTest: String): Action[Unit] = GetAction { request: GetRequest =>
    val isTestBool = Try(isTest.toBoolean).toOption getOrElse throwBadArgument("EsE5JUM2", "isTest")
    throwIfMayNotCreateSite(request, isTestBool)

    if (!hasOkForbiddenPassword(request)) {
      val numSites = globals.systemDao.countSites(isTestBool, request.theBrowserIdData)
      val conf = globals.config.createSite

      val (maxPerPerson, maxTotal, test) =
        if (isTestBool) (conf.maxTestSitesPerPerson, conf.maxTestSitesTotal, "test")
        else (conf.maxSitesPerPerson, conf.maxSitesTotal, "")

      if (numSites.byYou >= maxPerPerson)
        throwForbidden("EsE7KU20W", s"You have created too many $test forums already, sorry.")

      if (numSites.total >= maxTotal) {
        globals.config.createSite.tooManyTryLaterPagePath match {
          case None =>
            throwForbidden("EsE8VK2F4", s"People have created too many $test forums already, sorry.")
          case Some(path) =>
            throwTemporaryRedirect(path)
        }
      }
    }

    Ok(views.html.createsite.createSitePage(isTestBool, SiteTpi(request)).body) as HTML
  }


  def createSite: Action[JsValue] = PostJsonAction(RateLimits.CreateSite, maxBytes = 500) {
        request =>
    val isTestSiteOkayToDelete = (request.body \ "testSiteOkDelete").asOpt[Boolean].contains(true)
    throwIfMayNotCreateSite(request, isTestSiteOkayToDelete)

    // In case we're running end-to-end tests:
    globals.testResetTime()

    val acceptTermsAndPrivacy = (request.body \ "acceptTermsAndPrivacy").as[Boolean]
    val anyLocalHostname = (request.body \ "localHostname").asOpt[String]
    val anyEmbeddingSiteAddress = (request.body \ "embeddingSiteAddress").asOpt[String]
    val organizationName = (request.body \ "organizationName").as[String].trim
    val pricePlanInt = (request.body \ "pricePlan").as[Int]
    val okForbiddenPassword = hasOkForbiddenPassword(request)
    val okE2ePassword = hasOkE2eTestPassword(request.request)

    val localHostname = anyLocalHostname getOrElse {
      val embAddr = anyEmbeddingSiteAddress getOrElse {
        throwForbidden("EdE2FGHS0", "No local hostname and no embedding address")
      }
      val hostnameWithDashes = embAddr
        .replaceFirst("https?://", "")
        .replaceAll("[.:]+", "-")   // www.example.com:8080 —> www-example-com-8080
        .replaceFirst("/.*$", "")   // www.weird.com/some/path —> www-weird-com  only
      Hostname.EmbeddedCommentsHostnamePrefix + hostnameWithDashes
    }

    if (!acceptTermsAndPrivacy)
      throwForbidden("DwE877FW2", "You need to accept the terms of use and privacy policy")

    if (!Site.isOkayName(localHostname))
      throwForbidden("DwE5YU70", "Bad site name")

    if (localHostname.length < MinLocalHostnameLength && !okForbiddenPassword)
      // This "cannot" happen — JS makes this impossible. So need not be a user friendly message.
      throwForbidden("DwE2JYK8", "The local hostname should be at least six chars")

    if (ed.server.security.ReservedNames.isSubdomainReserved(localHostname))
      throwForbidden("TyE5KWW02", s"Subdomain is reserved: '$localHostname'; choose another please")

    // Test sites have a certain prefix, so I know it's okay to delete them. [7UKPwF2]
    if (TestSitePrefixes.exists(localHostname.startsWith) && !isTestSiteOkayToDelete)
      throwForbidden("DwE48WK3", o"""Please choose another hostname; it must not
          start with any of: ${ TestSitePrefixes.mkString(", ") }""")
    if (localHostname.contains("--") && !isTestSiteOkayToDelete)
      throwForbidden("DwE5JKP3", "Please choose another hostname; it must not contain: --")

    if (organizationName.isEmpty)
      throwForbidden("DwE4KEWW5", "No organization name specified")
    if (organizationName.length > 100)
      throwForbidden("DwE7KEP36", "Too long organization name: more than 100 characters")

    val pricePlan = pricePlanInt match {  // [4GKU024S]
      case 0 => "Unknown"
      case 1 => "NonCommercial"
      case 2 => "Business"
      case 3 => "EmbeddedComments"
      case _ => throwBadArgument("EsE7YKW28", "pricePlan", "not 0, 1, 2 or 3")
    }

    val hostname = s"$localHostname.${globals.baseDomainNoPort}"
    val deleteWhatSite =
      if (isTestSiteOkayToDelete && Hostname.isE2eTestHostname(hostname))
        DeleteWhatSite.SameHostname
      else
        DeleteWhatSite.NoSite

    val goToUrl: String =
      try {
        globals.systemDao.createAdditionalSite(
          pubId = Site.newPublId(),
          name = localHostname, SiteStatus.NoAdmin, hostname = Some(hostname),
          embeddingSiteUrl = anyEmbeddingSiteAddress,
          creatorId = request.user.map(_.id) getOrElse UnknownUserId,
          browserIdData = request.theBrowserIdData, organizationName = organizationName,
          isTestSiteOkayToDelete = isTestSiteOkayToDelete,
          skipMaxSitesCheck = okE2ePassword || okForbiddenPassword,
          deleteWhatSite = deleteWhatSite, pricePlan = pricePlan,
          createdFromSiteId = Some(request.siteId))

        val newSiteOrigin = globals.originOf(hostname)

        if (!isTestSiteOkayToDelete) {
          val now = globals.now()
          globals.config.superAdmin.emailAddresses foreach { superAdminEmailAddress =>
            val email = Email.newWithId(
              Email.generateRandomId(),
              EmailType.SiteCreatedSuperAdminNotf,
              createdAt = now,
              sendTo = superAdminEmailAddress,
              toUserId = None,
              subject = s"[Talkyard] New site created",
              bodyHtmlText = i"""
                |newSiteOrigin: ${ Encode.forHtmlContent(newSiteOrigin) }<br>
                |embeddingUrl: ${ anyEmbeddingSiteAddress map Encode.forHtmlContent }<br>
                |organizationName: ${ Encode.forHtmlContent(organizationName) }<br>
                |pricePlan: ${ Encode.forHtmlContent(pricePlan) }<br>
                |createdAt: ${ toIso8601T(now.toJavaDate) }<br>
                |""")
            globals.sendEmail(email, request.siteId)
          }
        }

        newSiteOrigin
      }
      catch {
        case DbDao.SiteAlreadyExistsException(site, details) =>
          throwForbidden("TyE4ZKTP02", o"""A site with that name or id has already been created,
              details: $details""")
        case _: DbDao.TooManySitesCreatedByYouException =>
          throwForbidden("DwE7IJ08", "You have created too many sites already, sorry.")
        case DbDao.TooManySitesCreatedInTotalException =>
          globals.config.createSite.tooManyTryLaterPagePath match {
            case None =>
              throwForbidden("EsE3YK5U8", "People have created too many forums already, sorry.")
            case Some(path) =>
              path
          }
      }

    OkSafeJson(Json.obj("nextUrl" -> goToUrl))
  }


  def deleteTestSite: Action[JsValue] = PostJsonAction(RateLimits.CreateSite, maxBytes = 500) {
        request =>
    val localHostname = (request.body \ "localHostname").as[String]
    throwForbiddenUnless(Hostname.isE2eTestHostname(localHostname), "EdE7UKFW2", "Not a test site")
    request.dao.readWriteTransaction { tx =>
      tx.asSystem.deleteAnyHostname(localHostname)
    }
    Ok
  }


  private def throwIfMayNotCreateSite(request: DebikiRequest[_], isTest: Boolean) {
    import ed.server.Whatever
    if (isTest && (
        globals.anyCreateTestSiteHostname.contains(Whatever) ||
        globals.anyCreateTestSiteHostname.contains(request.hostname))) {
      // We're creating a test site with a test address, fine.
      return
    }
    globals.anyCreateSiteHostname match {
      case None =>
        throwForbidden("DwE4KEGG0", s"This server is not configured to allow creation of new sites: config value '${Globals.CreateSiteHostnameConfValName}' missing")
      case Some(createSiteHostname) =>
        if (createSiteHostname != Whatever && createSiteHostname != request.hostname)
          throwForbidden("DwE093AQ2", "You cannot create new sites from this address")
    }
  }

}
