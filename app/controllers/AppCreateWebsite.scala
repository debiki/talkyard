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

    val newWebsiteAddr =
       newWebsiteName +"."+ newWebsiteDomain.getOrElse(request.host)

    // Preliminary test of if it's possible & allowed to create the website.
    _throwIfMayNotCreateWebsite(creatorIpAddr = request.remoteAddress,
       newWebsiteAddr = Some(newWebsiteAddr))

    // We cannot (?) use Play's reverse routing here, because we're routing
    // to another host.
    var newWebsiteOrigin = "http://"+ newWebsiteAddr
    log.info("About to create website, name: "+ newWebsiteName +
       ", origin: "+ newWebsiteOrigin)

    Redirect(newWebsiteOrigin +"/-/login-to-claim-website")
  }


  def showClaimWebsiteLoginForm() = CheckSidActionNoBody {
        (sidOk, xsrfOk, request) =>
      Ok(views.html.createWebsite(doWhat = "showClaimWebsiteLoginForm",
         xsrfToken = xsrfOk.value))
  }


  def handleClaimWebsiteLoginForm() = ExceptionAction(
        BodyParsers.parse.urlFormEncoded(maxLength = 1000)) {
      implicit request =>

    // Check the xsrf token.
    val (sidOk, xsrfOk, newCookies) = AppAuth.checkSidAndXsrfToken(request)

    // But we cannot possibly have logged in to the new website — that's what
    // we're about to do *next*.
    assErrIf(sidOk.loginId.nonEmpty, "DwE076TZ13")
    assErrIf(sidOk.roleId.nonEmpty, "DwE019BG78")

    // Create the website, so the login succeeds (the login will be
    // saved in the database, and a website id is needed).
    // For a while, the website will have no owner.
    // The first one to login with an OpenID
    // [SECURITY] from a whitelisted (not imlpemented) OpenID provider
    // will become the website owner.
    // (So if Alice and Bob both attempts to create a website with name x,
    // at the very same time, one of them will fail, but rather late: not
    // until after they've attempted to log in.)
    _throwIfMayNotCreateWebsite(creatorIpAddr = request.remoteAddress,
       newWebsiteAddr = Some(request.host))

    val (newWebsiteName, newWebsiteAddr) =
      _extractNameAndAddressFromHost(request.host)

    log.debug("Creating website, name: "+ newWebsiteName +
       ", address: "+ newWebsiteAddr)

    _createWebsiteUnlessExists(creatorIpAddr = request.remoteAddress,
        newWebsiteName = newWebsiteName, newWebsiteAddr = newWebsiteAddr)

    // BAD: Leaves login entry in DW1_USERS even if fails to claim website.
    // Should rewrite: Claim directly on website creation, and login
    // before, to the "original" website.
    AppAuthOpenid.asyncLogin(returnToUrl =
       routes.AppCreateWebsite.tryClaimWebsite.absoluteURL())
  }


  def tryClaimWebsite() = CheckSidActionNoBody { (sidOk, xsrfOk, request) =>

    if (sidOk.roleId isEmpty)
      throwForbidden("DwE013k586", "Cannot create website: Not logged in")

    val dao = _tenantDao(request, sidOk.roleId)

    // Check permissions
    val (identity, user) = {
      val loginId = sidOk.loginId.getOrElse(assErr("DwE01955"))
      dao.loadIdtyAndUser(loginId) match {
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

    val (newWebsiteName, newWebsiteAddr) =
      _extractNameAndAddressFromHost(request.host)

    log.debug("Granting ownership of new website to role id "+
       sidOk.roleId.get + ", website name: "+ newWebsiteName +
       ", address: "+ newWebsiteAddr)

    if (!dao.claimWebsite())
      Ok(views.html.createWebsite(doWhat = "failSomeoneElseWasFirst"))
    else
      Ok(views.html.createWebsite(doWhat = "welcomeOwner"))
  }


  private def _tenantDao(request: mvc.Request[_], roleId: Option[String])
        : TenantDao = {
    val curTenantId = AppAuth.lookupTenantByHost(request.host)
    val ipAddr = request.remoteAddress
    Debiki.tenantDao(curTenantId, ipAddr, roleId)
  }


  private def _extractNameAndAddressFromHost(host: String): (String, String) = {
    val newWebsiteName = host.takeWhile(_ != '.')
    val newWebsiteAddr = host
    (newWebsiteName, newWebsiteAddr)
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


  private def _createWebsiteUnlessExists(creatorIpAddr: String,
        newWebsiteName: String, newWebsiteAddr: String) {
    // SHOULD consume IP quota — but not tenant quota!? — when generating
    // new tenant ID. Don't consume tenant quota because the tenant
    // would be www.debiki.com?
    // Do this by splitting QuotaManager._charge into two functions: one that
    // loops over quota consumers, and another that charges one single
    // consumer. Then call the latter function, charge the IP only.

    // SHOULD not fail if already exists, but continue anyway.
    // Instead, `dao.claimWebsite` above will fail.
    val newTenant = Debiki.SystemDao.createTenant(newWebsiteName: String)
    val newHost = TenantHost(newWebsiteAddr, TenantHost.RoleCanonical,
       TenantHost.HttpsNone)
    val tenantDao = Debiki.tenantDao(newTenant.id, ip = creatorIpAddr)
    tenantDao.addTenantHost(newHost)
  }

}
