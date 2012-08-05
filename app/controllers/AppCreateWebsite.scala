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
import Actions._
import Prelude._
import Utils.ValidationImplicits._


object AppCreateWebsite extends mvc.Controller {

  val log = play.api.Logger("app.create-website")

  // Add to dev config file?
  // debiki.create-website.only-from-address="localhost:9000"
  // debiki.create-website.new-domain="debiki.localhost:9000"

  /**
   * The one and only host from which it's allowed to create new websites,
   * probably www.debiki.com.
   */
  val websiteCreationHost: Option[String] = {
    val host = Play.configuration.getString(
      "debiki.create-website.only-from-address")
    assErrIf(Play.isProd && host.isEmpty,
      "DwE01kr55", "No debiki.create-website.only-from-address specified")
    host
  }


  val newWebsiteDomain = Play.configuration.getString(
    "debiki.create-website.new-domain")


  def newWebsiteAddr(websiteName: String, request: Request[_]) =
    websiteName +"."+ newWebsiteDomain.getOrElse(request.host)

  def showWebsiteNameForm() = CheckSidActionNoBody {
        (sidOk, xsrfOk, request) =>

    if (websiteCreationHost.nonEmpty &&
        websiteCreationHost != Some(request.host))
      throwForbidden(
        "DwE3kJ5", "You may not create a website from this address")

    _throwIfMayNotCreateWebsite(creatorIpAddr = request.remoteAddress)

    Ok(views.html.createWebsite(doWhat = "showWebsiteNameForm",
      xsrfToken = xsrfOk.value))
  }


  def handleWebsiteNameForm() = CheckSidAction(
        BodyParsers.parse.urlFormEncoded(maxLength = 100)) {
      (sidOk, xsrfOk, request) =>

    val newWebsiteName =
       request.body.getEmptyAsNone("website-name") getOrElse
        throwBadReq("DwE01kI72", "Please specify a name for your new website")

    // Preliminary test of if it's possible & allowed to create the website.
    _throwIfMayNotCreateWebsite(creatorIpAddr = request.remoteAddress,
       newWebsiteAddr = Some(newWebsiteAddr(newWebsiteName, request)))

    Redirect(routes.AppCreateWebsite.showWebsiteOwnerForm.url)
       .withSession(
          request.session + ("website-name" -> newWebsiteName))
  }


  def showWebsiteOwnerForm() = CheckSidActionNoBody {
        (sidOk, xsrfOk, request) =>
    Ok(views.html.createWebsite(doWhat = "showWebsiteOwnerForm",
       xsrfToken = xsrfOk.value))
  }


  def handleWebsiteOwnerForm() = ExceptionAction(
        BodyParsers.parse.urlFormEncoded(maxLength = 1000)) {
      implicit request =>
    AppAuthOpenid.asyncLogin(returnToUrl =
       routes.AppCreateWebsite.tryCreateWebsite.absoluteURL())
  }


  def tryCreateWebsite() = CheckSidActionNoBody { (sidOk, xsrfOk, request) =>

    if (sidOk.roleId isEmpty)
      throwForbidden("DwE013k586", "Cannot create website: Not logged in")

    val dao = _tenantDao(request, sidOk.roleId)

    // Check permissions
    val (identity, user) = {
      val loginId = sidOk.loginId.getOrElse(assErr("DwE01955"))
      dao.loadIdtyAndUserDetailed(loginId) match {
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
// BUG! newWebsiteName incl domain
    val newWebsiteName = request.session.get("website-name") getOrElse {
      throwForbidden("DwE091EQ7", "No website-name cookie")
    }

    val websiteAddr = newWebsiteAddr(newWebsiteName, request)

    //_throwIfMayNotCreateWebsite(creatorIpAddr = request.remoteAddress,
    //  websiteAddr = Some(request.host))

    log.debug("Creating website, name: "+ newWebsiteName +
       ", address: "+ websiteAddr)

    // SECURITY should whitelist allowed OpenID and OAuth providers.

    // Require OpenID or OAuth (todo) or password (todo) login.
    val idtyOpenId = identity.asInstanceOf[IdentityOpenId]

    val wasCreated = dao.createWebsite(
       name = newWebsiteName, address = websiteAddr,
       creatorIpAddr = request.remoteAddress, ownerIdentity = idtyOpenId,
       ownerRole = user)

    val result =
      if (wasCreated)
        Redirect("http://"+ websiteAddr +
           routes.AppCreateWebsite.welcomeOwner.url)
      else
        Ok(views.html.createWebsite(doWhat = "failSomeoneElseWasFirst"))

    result.withSession(request.session - "website-name")
  }


  def welcomeOwner() = CheckSidActionNoBody { (sidOk, xsrfOk, request) =>
    Ok(views.html.createWebsite(doWhat = "welcomeOwner"))
  }


  private def _tenantDao(request: mvc.Request[_], roleId: Option[String])
        : TenantDao = {
    val curTenantId = AppAuth.lookupTenantByHost(request.host)
    val ipAddr = request.remoteAddress
    Debiki.tenantDao(curTenantId, ipAddr, roleId)
  }


  private def _throwIfMayNotCreateWebsite(creatorIpAddr: String,
        newWebsiteAddr: Option[String] = None) {
    // Perhaps like so:
    // Unless logged in:
    //   If > 10 tenants already created from ipAddr, deny.
    // If logged in:
    //   If > 100 tenants already created from ipAddr, deny.
    //   If > 10 tenants already created by the current role, deny.
  }

}
