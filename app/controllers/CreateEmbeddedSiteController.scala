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
import debiki._
import debiki.DebikiHttp._
import java.{util => ju}
import play.api._
import play.api.mvc.{Action => _, _}
import play.api.mvc.BodyParsers.parse.empty
import play.api.Logger.logger
import requests._
import Utils.ValidationImplicits._


/** Creates sites for embedded-comments and/or embedded-forum.
  *
  * The new site can be accessed via a site-by-id URL: <siteId>.<Globals.siteByIdDomain>
  * e.g. 123.id.debiki.net. Since we access the site by id, the user don't need
  * to specify any site name.
  *
  * Some code is somewhat duplicated between this class and CreateSiteController,
  * but I think that's better than complicated if/then/else jumps between
  * various URLs in the site creation flow.
  */
object CreateEmbeddedSiteController extends mvc.Controller {

  def hostnameToEmbeddedSite(siteId: SiteId) =
    Globals.SiteByIdHostnamePrefix + siteId + "." + Globals.baseDomain

  def adminUrlForEmbeddedSite(siteId: SiteId): String =
    s"http://${hostnameToEmbeddedSite(siteId)}${routes.AdminController.viewAdminPage.url}"


  def start = mvc.Action { request =>
    Redirect(routes.CreateEmbeddedSiteController.showSiteOwnerForm.url)
  }


  def showSiteOwnerForm() = SessionAction(empty) { request: SessionRequestNoBody =>
    Ok(views.html.login.loginPage(xsrfToken = request.xsrfOk.value,
      returnToUrl = routes.CreateEmbeddedSiteController.showEmbeddingSiteUrlForm.url,
      title = "Choose Website Owner Account",
      providerLoginMessage = "It will become the owner of the embedded discussions.",
      showCreateAccountOption = true))
  }


  def showEmbeddingSiteUrlForm() = GetAction { request =>
    val tpi = InternalTemplateProgrammingInterface(request.dao)
    Ok(views.html.createembeddedsite.specifyEmbeddingSiteUrl(
      tpi, xsrfToken = request.xsrfToken.value))
  }


  def handleEmbeddingSiteUrlForm() = JsonOrFormDataPostAction(maxBytes = 200) { request =>

    val embeddingSiteUrl =
      request.body.getEmptyAsNone("embeddingSiteUrl") getOrElse
        throwBadReq("DwE44SEG5", o"""Please specify the address of the website on which you
          want to enable embedded commens""")

    if (request.body.getFirst("acceptTermsInp") != Some("yes"))
      throwForbidden(
        "DwE20GJ5", "You need to accept the Terms of Use and the Privacy Policy.")

    Redirect(routes.CreateEmbeddedSiteController.tryCreateEmbeddedSite.url)
       .withSession(
          request.session + ("embeddingSiteUrl" -> embeddingSiteUrl))
  }


  def tryCreateEmbeddedSite() = GetAction { request =>

    // Check permissions — and load authentication details, so OpenID/OAuth
    // info can be replicated to a new identity + user in the new website.
    val loginId = request.loginId_!
    val (identity, user) = {
      request.dao.loadIdtyDetailsAndUser(forLoginId = loginId) match {
        case Some((identity, user)) => (identity, user)
        case None =>
          runErr("DwE01j920", "Cannot create website: Bad login ID: "+ loginId)
      }
    }

    if (!user.isAuthenticated) _showLoginPageAgain(
      "DwE01B7", "Cannot create website: User not authenticated. "+
         "Please login again, but not as guest")

    if (user.email isEmpty) _showLoginPageAgain(
      "DwE56Yr5", "Cannot create website: User's email address unknown. " +
         "Please use an account that has an email address")

    def _showLoginPageAgain(errorCode: String, errorMessage: String)
          : SimpleResult = {
      // For now:
      throwForbidden(errorCode, errorMessage)
      // Could instead show this page, + helpful info on why failed:
      //Ok(views.html.createWebsite(doWhat = "showClaimWebsiteLoginForm",
      //  xsrfToken = xsrfOk.value))
    }

    val embeddingSiteUrl = request.session.get("embeddingSiteUrl") getOrElse {
      throwForbidden("DwE85FK57", "No embeddingSiteUrl cookie")
    }

    CreateSiteController._throwIfMayNotCreateWebsite(request)

    logger.info(o"""Creating embedded site, embedding site: $embeddingSiteUrl,
      on behalf of: $user""")


    // SECURITY should whitelist allowed OpenID and OAuth providers.

    if (identity.isInstanceOf[IdentitySimple])
      throwForbidden("DwE4GEI2", "Guests may not create websites.")

    val (site, owner) =
      SiteCreator.createWebsite(
        siteType = SiteCreator.NewSiteType.EmbeddedComments,
        request.dao,
        request.ctime,
        name = None,
        host = None,
        embeddingSiteUrl = Some(embeddingSiteUrl),
        ownerIp = request.ip,
        ownerLoginId = loginId,
        ownerIdentity = identity,
        ownerRole = user) getOrElse assErr(
          "DwE33IR0", o"""Embedded site names shouldn't cause primary/unique key conflicts;
           they have no names""")

    val hostname = hostnameToEmbeddedSite(site.id)
    Redirect(s"http://$hostname${routes.CreateEmbeddedSiteController.welcomeOwner.url}")
      .withSession(request.session - "embeddingSiteUrl")
  }


  def welcomeOwner() = GetAction { request =>
    // (See comment about automatic login to new site, in CreateSiteController.welcomeOwner())
    val site = request.dao.loadSite()
    Ok(views.html.createembeddedsite.welcomeOwner(site))
  }


  def embeddingSiteInstructionsPage() = GetAction { request =>
    val site = request.dao.loadSite()
    Ok(views.html.createembeddedsite.embeddingSiteInstructionsPage(site))
  }

}
