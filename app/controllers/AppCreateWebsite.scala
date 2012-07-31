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


  /**
   * The one and only host from which it's allowed to create new websites,
   * probably www.debiki.com.
   */
  val websiteCreationHost: Option[String] = {
    val host = Play.configuration.getString(
      "debiki.create-website.only-from-host")
    assErrIf(Play.isProd && host.isEmpty,
      "DwE01kr55", "No debiki.create-website.only-from-host specified")
    host
  }


  val newWebsiteDomain = Play.configuration.getString(
    "debiki.create-website.new-domain")


  /* val _secretNewTenantSalt = "a0kr3Qi8BgwIWF"  // hardcoded, for now

  val _newTenantPasswordHashLength = 12  */


  def showWebsiteNameForm() = CheckSidActionNoBody {
        (sidOk, xsrfOk, request) =>

    if (websiteCreationHost.nonEmpty &&
        websiteCreationHost != Some(request.host))
      throwForbidden("DwE32kJ5", "You may not create a website from this host")

    val dao = _tenantDao(request, sidOk.roleId)
    _throwIfMayNotCreateWebsite(dao, newWebsiteAddr = None,
       creatorIpAddr = request.remoteAddress)

    Ok(views.html.createWebsite(doWhat = "showWebsiteNameForm",
      xsrfToken = xsrfOk.value))
  }


  def handleWebsiteNameForm() = CheckSidAction(
        BodyParsers.parse.urlFormEncoded(maxLength = 100)) {
      (sidOk, xsrfOk, request) =>

    // SHOULD consume IP quota — but not tenant quota!? — when generating
    // new tenant ID. Don't consume tenant quota because the tenant
    // would be www.debiki.com?

    val newWebsiteName =
       request.body.getEmptyAsNone("website-name") getOrElse
        throwBadReq("DwE01kI72", "Please specify a name for your new website")

    val newWebsiteAddr =
       newWebsiteName +"."+ newWebsiteDomain.getOrElse(request.host)

    // Preliminary test of if it's possible & allowed to create the website.
    val dao = _tenantDao(request, sidOk.roleId)
    _throwIfMayNotCreateWebsite(dao, newWebsiteAddr = Some(newWebsiteAddr),
       creatorIpAddr = request.remoteAddress)

    // Sign the next request, so no one but the current user can
    // login to the new tenant and become its owner.
    // (The browser won't include the session id cookie when it is
    // redirected, because the redirect is to another host. So we need
    // something in the URL I think.)
    //val passwordUnsigned = _generatePassword(newTenantId, request.remoteAddress)
    //val passwordSigned = _signPassword(passwordUnsigned)

    // We cannot (?) use Play's reverse routing here, because we're routing
    // to another host.
    var newWebsiteOrigin = "http://"+ newWebsiteAddr
    log.debug("About to create website, name: "+ newWebsiteName +
       ", origin: "+ newWebsiteOrigin)

    // COULD remember & prevent reusage of recent passwords.
    // Doesn't matter much though: # tenants per IP is limited.
    Redirect(newWebsiteOrigin +"/-/create-website")//?password="+ passwordSigned)
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

    // But we cannot possibly have logged in yet — that's what we're just
    // about to do *next*.
    assErrIf(sidOk.loginId.nonEmpty, "DwE076TZ13")
    assErrIf(sidOk.roleId.nonEmpty, "DwE019BG78")

    // Create the website, so the login succeeds (the login will be
    // saved in the database, and a website id is needed).
    // For a while, the website will have no owner.
    // The first one to login with an OpenID
    // [SECURITY] from a whitelisted (not imlpemented) OpenID provider
    // will become the website owner.
    _throwIfMayNotCreateWebsite(unimplemented, //Debiki.SystemDao,
       newWebsiteAddr = Some(request.host),
       creatorIpAddr = request.remoteAddress)

    val (newWebsiteName, newWebsiteAddr) =
      _extractNameAndAddressFromHost(request.host)

    log.debug("Creating website, name: "+ newWebsiteName +
       ", address: "+ newWebsiteAddr)
    // Debiki.SystemDao.createWebsite(newWebsiteName, address = newWebsiteAddr)

    AppAuthOpenid.asyncLogin(returnToUrl =
       routes.AppCreateWebsite.claimWebsiteWelcomeOwner.absoluteURL())
  }


  def claimWebsiteWelcomeOwner() = CheckSidActionNoBody {
        (sidOk, xsrfOk, request) =>

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

    if (!user.isAuthenticated) _throwRedirectToLoginPage(
      "DwE01B7", "Cannot create website: User not authenticated. "+
         "Please login again, but not as guest")

    if (user.email isEmpty) _throwRedirectToLoginPage(
      "DwE56Yr5", "Cannot create website: User's email address unknown. " +
         "Please use an account that has an email address")

    val (newWebsiteName, newWebsiteAddr) =
      _extractNameAndAddressFromHost(request.host)

    log.debug("Granting ownership of new website to role id "+
       sidOk.roleId.get + ", website name: "+ newWebsiteName +
       ", address: "+ newWebsiteAddr)

    // request.dao.tryAddFirstWebsiteOwner(sidOk.roleId.get) // hmm

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



  private def _throwRedirectToLoginPage(errorCode: String,
        errorMessage: String) {
    throwForbidden(errorCode, errorMessage) // for now
  }

  /*
  private def _generatePassword(websiteName: String, ipAddr: String): String = {
    (new ju.Date).getTime +"."+
       (math.random * Int.MaxValue).toInt +"."+
       websiteName +"."+
       ipAddr
  }


  private def _signPassword(password: String): String = {
    val saltedHash = hashSha1Base64UrlSafe(password +"."+ _secretNewTenantSalt)
       .take(_newTenantPasswordHashLength)
    password +"."+ saltedHash
  }


  private def _throwIfBadPassword(password: String, tenantId: String,
        ip: String) {
    val passwordUnsigned = password.dropRightWhile(_ != '.').dropRight(1)
    val passwordCorrectlySigned = _signPassword(passwordUnsigned)
    if (password != passwordCorrectlySigned)
      throwForbidden("DwE021kR5", "Bad one-time-password")
  }
  */

  private def _throwIfMayNotCreateWebsite(dao: TenantDao,
        newWebsiteAddr: Option[String], creatorIpAddr: String) {
    // Perhaps like so:
    // Unless logged in:
    //   If > 10 tenants already created from ipAddr, deny.
    // If logged in:
    //   If > 100 tenants already created from ipAddr, deny.
    //   If > 10 tenants already created by the current role, deny.
  }


  /*
  private def _throwIfMayNotLogin(oneTimePassword: String) {
    // Unless magic token signed correctly by server, deny.
  }
  */

}
