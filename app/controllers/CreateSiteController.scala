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
import debiki.dao.SiteDao
import java.{util => ju}
import play.api._
import play.api.mvc.{Action => _, _}
import play.api.Play.current
import play.api.mvc.BodyParsers.parse.empty
import requests._
import Utils.ValidationImplicits._


/** Creates new websites, including a homepage and a _site.conf page.
  */
object CreateSiteController extends mvc.Controller {

  private val log = play.api.Logger("app.create-site")


  def start = mvc.Action { request =>
    Redirect(routes.CreateSiteController.showWebsiteOwnerForm(""))
  }


  def startCreateForum = mvc.Action { request =>
    Redirect(routes.CreateSiteController.showWebsiteOwnerForm("NewForum"))
  }


  def newWebsiteAddr(websiteName: String, dao: SiteDao): String = {
    def die = throwForbidden(
      "DwE30SC3", "You may not create a new website from this website")
    val siteConfig = dao.loadWebsiteConfig()
    val domain = Globals.baseDomain

    // Ensure other required config values are present too (fail fast).
    // COULD remove this once I've found some other way to not allow creation of new
    // sites via just any existing site (only via www.debiki.com).
    siteConfig.getText("new-site-config-page-text") getOrElse die

    s"$websiteName.$domain"
  }


  def showWebsiteOwnerForm(siteType: String) = SessionAction(empty) {
        request: SessionRequestNoBody =>
    Ok(views.html.login.loginPage(xsrfToken = request.xsrfOk.value,
      returnToUrl = routes.CreateSiteController.showSiteTypeForm(siteType).url,
      title = "Choose Website Owner Account",
      providerLoginMessage = "It will become the owner of the new website.",
      showCreateAccountOption = true))
  }


  def showSiteTypeForm(siteType: String) = GetAction { request =>
    _throwIfMayNotCreateWebsite(request)
    if (siteType.nonEmpty) {
      // We already know what kind of site to create; skip this step.
      Redirect(routes.CreateSiteController.showWebsiteNameForm(siteType))
    }
    else {
      val tpi = InternalTemplateProgrammingInterface(request.dao)
      Ok(views.html.createsite.chooseType(tpi, xsrfToken = request.xsrfToken.value))
    }
  }


  def handleSiteTypeForm() = JsonOrFormDataPostAction(maxBytes = 200) { request =>
    val siteType =
      request.body.getEmptyAsNone("siteType") getOrElse
        throwBadReq("DwE73Gb81", "Please specify site type")
    // Check that type can be parsed.
    parseSiteTypeOrThrow(siteType)
    Redirect(routes.CreateSiteController.showWebsiteNameForm(siteType))
  }


  def showWebsiteNameForm(siteType: String) = GetAction { request =>
    _throwIfMayNotCreateWebsite(request)
    val tpi = InternalTemplateProgrammingInterface(request.dao)
    Ok(views.html.createsite.chooseName(tpi, siteType, xsrfToken = request.xsrfToken.value))
  }


  def handleWebsiteNameForm(siteType: String) = JsonOrFormDataPostAction(maxBytes = 200) {
      request =>

    val newWebsiteName =
      request.body.getEmptyAsNone("websiteNameInp") getOrElse
        throwBadReq("DwE01kI72", "Please specify a name for your new website")

    if (!SiteCreator.isOkayWebsiteName(newWebsiteName))
      throwForbidden("DwE390IR3", "Bad website name. (The name must be "+
        "at least 6 characters long, not be too long, contain only "+
        "lowercase a-z, 0-9 and hyphens ('-').)")

    if (request.body.getFirst("acceptTermsInp") != Some("yes"))
      throwForbidden(
        "DwE9fZ31", "To create a new website, you need to accept the "+
         "Terms of Use and the Privacy Policy.")

    val websiteAddr = newWebsiteAddr(newWebsiteName, request.dao)

    // *Preliminarily* test if it's possible & allowed to create the website.
    _throwIfMayNotCreateWebsite(request, newWebsiteAddr = Some(websiteAddr))

    tryCreateWebsite(request, siteType, siteName = newWebsiteName)
  }


  private def tryCreateWebsite(request: DebikiRequest[_], siteType: String, siteName: String) = {

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

    val newSiteType = parseSiteTypeOrThrow(siteType)

    val websiteAddr = newWebsiteAddr(siteName, request.dao)

    _throwIfMayNotCreateWebsite(request, newWebsiteAddr = Some(websiteAddr))

    log.info(o"""Creating website, name: $siteName, type: $newSiteType,
      address: $websiteAddr, on behalf of: $user""")


    // SECURITY should whitelist allowed OpenID and OAuth providers.

    if (identity.isInstanceOf[IdentitySimple])
      throwForbidden("DwE4GEI2", "Guests may not create websites.")

    val result =
      SiteCreator.createWebsite(
        newSiteType,
        request.dao,
        request.ctime,
        name = Some(siteName),
        host = Some(websiteAddr),
        embeddingSiteUrl = None,
        ownerIp = request.ip,
        ownerLoginId = loginId,
        ownerIdentity = identity,
        ownerRole = user) match {
      case Some(site) =>
        Redirect(s"http://$websiteAddr${routes.CreateSiteController.welcomeOwner.url}")
      case None =>
        Ok(views.html.createsite.failNotFirst(siteType))
    }

    result
  }


  def welcomeOwner() = SessionAction(empty) { _: SessionRequestNoBody =>
    // SHOULD log in user, so s/he can create pages or choose a template.
    // Like so? Pass a magic token in the URL, which is valid for 1 minute,
    // and then, here, check if DW1_LOGINS has *no logins* for the new websitew
    // Then, if the URL token is valid, auto-login the user
    // because s/he is the owner and this'll work *once* only. (Assuming
    // we're using HTTPS (which we aren't), i.e. no man in the middle attack.)
    Ok(views.html.createsite.welcomeOwner())
  }


  def _throwIfMayNotCreateWebsite(request: DebikiRequest[_],
        newWebsiteAddr: Option[String] = None) {
    if (request.host != "www.debiki.com" &&
        !request.host.contains("localhost:") &&
        !request.host.contains("127.0.0.1:"))
      throwForbidden(
        "DwE093AQ2", "You cannot create a new website via that website")

    COULD // check if website already exists, then deny

    // Tenantdao.createWebsite already throws error if too many websites
    // created from the same IP.
  }


  private def parseSiteTypeOrThrow(siteType: String) = siteType match {
    case "NewForum" => debiki.SiteCreator.NewSiteType.Forum
    case "NewBlog" => debiki.SiteCreator.NewSiteType.Blog
    case "NewSimpleSite" => debiki.SiteCreator.NewSiteType.SimpleSite
    case _ => throwBadReq("DwE38ZfR3", s"Bad site type: $siteType")
  }

}
