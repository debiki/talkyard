/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package controllers

import com.debiki.v0._
import debiki._
import debiki.DebikiHttp._
import java.{util => ju}
import play.api._
import play.api.mvc.{Action => _, _}
import play.api.Play.current
import ApiActions._
import SafeActions._
import Prelude._
import Utils.ValidationImplicits._


object AppCreateWebsite extends mvc.Controller {

  val log = play.api.Logger("app.create-website")

  def newWebsiteAddr(websiteName: String,
        tpi: InternalTemplateProgrammingInterface): String = {
    websiteName +"."+ tpi.websiteConfigValue("new-website-domain",
      or = throwForbidden(
        "DwE903IKW3", "You may not create a new website from this website"))
  }


  def showWebsiteNameForm() = GetAction { request =>
    _throwIfMayNotCreateWebsite(creatorIpAddr = request.ip)

    val tpi = InternalTemplateProgrammingInterface(request.dao)
    Ok(views.html.createWebsiteChooseName(tpi,
      xsrfToken = request.xsrfToken.value))
  }


  def handleWebsiteNameForm() = JsonOrFormDataPostAction(maxBytes = 100) {
      request =>

    val newWebsiteName =
      request.body.getEmptyAsNone("website-name") getOrElse
        throwBadReq("DwE01kI72", "Please specify a name for your new website")

    if (request.body.getFirst("accept-terms") != Some("yes"))
      throwForbidden(
        "DwE9fZ31", "To create a new website, you need to accept the "+
         "Terms of Use and the Privacy Policy.")

    // Preliminary test of if it's possible & allowed to create the website.
    val tpi = InternalTemplateProgrammingInterface(request.dao)
    _throwIfMayNotCreateWebsite(creatorIpAddr = request.ip,
       newWebsiteAddr = Some(newWebsiteAddr(newWebsiteName, tpi)))

    Redirect(routes.AppCreateWebsite.showWebsiteOwnerForm.url)
       .withSession(
          request.session + ("website-name" -> newWebsiteName))
  }


  def showWebsiteOwnerForm() = CheckSidActionNoBody {
        (sidOk, xsrfOk, request) =>
    Ok(views.html.login(xsrfToken = xsrfOk.value,
      returnToUrl = routes.AppCreateWebsite.tryCreateWebsite.url,
      title = "Choose Website Owner",
      providerLoginMessage = "It will become the owner of the new website."))
  }


  def tryCreateWebsite() = GetAction { request =>

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
          : PlainResult = {
      // For now:
      throwForbidden(errorCode, errorMessage)
      // Could instead show this page, + helpful info on why failed:
      //Ok(views.html.createWebsite(doWhat = "showClaimWebsiteLoginForm",
      //  xsrfToken = xsrfOk.value))
    }

    val newWebsiteName = request.session.get("website-name") getOrElse {
      throwForbidden("DwE091EQ7", "No website-name cookie")
    }

    val tpi = InternalTemplateProgrammingInterface(request.dao)
    val websiteAddr = newWebsiteAddr(newWebsiteName, tpi)

    //_throwIfMayNotCreateWebsite(creatorIpAddr = request.remoteAddress,
    //  websiteAddr = Some(request.host))

    log.debug("Creating website, name: "+ newWebsiteName +
       ", address: "+ websiteAddr)

    // SECURITY should whitelist allowed OpenID and OAuth providers.

    // Require OpenID or OAuth (todo) or password (todo) login.
    val idtyOpenId = identity.asInstanceOf[IdentityOpenId]

    val newWebsite = request.dao.createWebsite(
       name = newWebsiteName, address = websiteAddr,
       ownerIp = request.ip, ownerLoginId = loginId,
       ownerIdentity = idtyOpenId, ownerRole = user)

    val result = newWebsite match {
      case Some(website) =>
        // COULD do this in the same transaction as `createWebsite`?
        val email = _makeNewWebsiteEmail(website, user)
        request.dao.saveUnsentEmail(email)

        Debiki.sendEmail(email, website.id)

        Redirect("http://"+ websiteAddr +
           routes.AppCreateWebsite.welcomeOwner.url)
      case None =>
        Ok(views.html.createWebsiteFailNotFirst())
    }

    result.withSession(request.session - "website-name")
  }


  def welcomeOwner() = CheckSidActionNoBody { (sidOk, xsrfOk, request) =>
    // SHOULD log in user, so s/he can create pages or choose a template.
    // Like so? Pass a magic token in the URL, which is valid for 1 minute,
    // and then, here, check if DW1_LOGINS has *no logins* for the new websitew
    // Then, if the URL token is valid, auto-login the user
    // because s/he is the owner and this'll work *once* only. (Assuming
    // we're using HTTPS (which we aren't), i.e. no man in the middle attack.)
    Ok(views.html.createWebsiteWelcomeOwner())
  }


  private def _makeNewWebsiteEmail(website: Tenant, owner: User): Email = {
    val message =
      views.html.createWebsiteWelcomeEmail(website.chost_!.address).body
    Email(sendTo = owner.email, subject = "New Debiki website created",
      bodyHtmlText = message)
  }


  private def _tenantDao(request: mvc.Request[_], roleId: Option[String])
        : TenantDao = {
    val tenantId = DebikiHttp.lookupTenantIdOrThrow(request, Debiki.SystemDao)
    val ipAddr = request.remoteAddress
    Debiki.tenantDao(tenantId, ipAddr, roleId)
  }


  private def _throwIfMayNotCreateWebsite(creatorIpAddr: String,
        newWebsiteAddr: Option[String] = None) {
    // SECURITY
    // Perhaps like so:
    // Check request made from allowed hostname (probably www.debiki.com)
    // Unless logged in:
    //   If > 10 tenants already created from ipAddr, deny.
    // If logged in:
    //   If > 100 tenants already created from ipAddr, deny.
    //   If > 10 tenants already created by the current role, deny.
  }

}
