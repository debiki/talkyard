/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package controllers

import com.debiki.v0._
import debiki._
import debiki.DebikiHttp._
import java.{util => ju}
import play.api._
import play.api.mvc.{Action => _, AsyncResult, BodyParsers}
import play.api.Play.current
import Actions._
import Prelude._
import Utils.ValidationImplicits._


object AppCreateTenant extends mvc.Controller {


  val (newTenantParentDomain, newTenantPort) = {
    def getString = Play.configuration.getString(_: String, validValues = None)
    val domain = getString("new-tenant.parent-domain") getOrElse "localhost"
    val port = getString("new-tenant.port") getOrElse ""
    (domain, port)
  }

  val _secretNewTenantSalt = "a0kr3Qi8BgwIWF"  // hardcoded, for now

  val _newTenantPasswordHashLength = 12


  def showWebsiteNameForm() = CheckSidActionNoBody {
        (sidOk, xsrfOk, request) =>

    val curTenantId = "?"
    val ipAddr = request.remoteAddress
    _throwIfMayNotCreateTenant(curTenantId, ipAddr, sidOk.roleId)

    Ok(views.html.createTenant(doWhat = "showWebsiteNameForm"))
  }


  def handleWebsiteNameForm() = CheckSidAction(
        BodyParsers.parse.urlFormEncoded(maxLength = 100)) {
        (sidOk, xsrfOk, request) =>

    // SHOULD consume IP quota — but not tenant quota!? — when generating
    // new tenant ID. Don't consume tenant quota because the tenant
    // would be www.debiki.com?

    val curTenantId = "?"
    val ipAddr = request.remoteAddress
    // val dao = Debiki.tenantDao(tenantId, ip = ipAddr, roleId = sidOk.roleId)
    _throwIfMayNotCreateTenant(curTenantId, ipAddr, roleIdOpt = sidOk.roleId)

    // Don't save this new tenant id to database, until we've
    // redirected to the new tenant id, and the tenant creator has logged in
    // *with an identity we support* (e.g. OpenID or, in the future,
    // Twitter or Facebook).
    val newTenantId = "123abc"  // dao.nextTenantId()
    val newTenantAddr = newTenantId +"."+ newTenantParentDomain

    // Sign the next request, so no one but the current user can
    // login to the new tenant and become its owner.
    // (The browser won't include the session id cookie when it is
    // redirected, because the redirect is to another host. So we need
    // something in the URL I think.)
    val passwordUnsigned = _generatePassword(newTenantId, ipAddr)
    val passwordSigned = _signPassword(passwordUnsigned)

    // We cannot (?) use Play's reverse routing here, because we're routing
    // to another host.
    var newTenantOrigin = "http://"+ newTenantAddr
    if (newTenantPort nonEmpty) newTenantOrigin += ":"+ newTenantPort
    Redirect(newTenantOrigin +"/-/new-tenant-login?password="+ passwordSigned)
  }


  def showOwnerLoginForm(password: String) =
        ExceptionActionNoBody { request =>

    val newTenantId = "123abc"
    val ipAddr = request.remoteAddress
    _throwIfBadPassword(password, tenantId = newTenantId, ip = ipAddr)

    val newPasswordUnsigned = _generatePassword(newTenantId, ipAddr)
    val newPasswordSigned = _signPassword(newPasswordUnsigned)

    Ok(views.html.createTenant(doWhat = "showOwnerLoginForm",
      loginFormPassword = newPasswordSigned))
  }


  def handleOwnerLoginForm() = ExceptionAction(
        BodyParsers.parse.urlFormEncoded(maxLength = 1000)) {
        implicit request =>

    val newTenantId = "123abc"
    val ipAddr = request.remoteAddress
    val password = request.body.getOrThrowBadReq("login-password")
    _throwIfBadPassword(password, tenantId = newTenantId, ip = ipAddr)

    val nextPageAfterLogin = routes.AppCreateTenant.welcomeOwner.absoluteURL()
    AppAuthOpenid.asyncLogin(returnToUrl = nextPageAfterLogin)
  }


  def welcomeOwner() = ExceptionActionNoBody { request =>
    Ok(views.html.createTenant(doWhat = "welcomeOwner"))
  }


  private def _generatePassword(newTenantId: String, ipAddr: String): String = {
    (new ju.Date).getTime +"."+
       (math.random * Int.MaxValue).toInt +"."+
       newTenantId +"."+
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


  private def _throwIfMayNotCreateTenant(
        curTenantId: String, ipAddr: String, roleIdOpt: Option[String]) {
    // Perhaps like so:
    // Unless logged in:
    //   If > 10 tenants already created from ipAddr, deny.
    // If logged in:
    //   If > 100 tenants already created from ipAddr, deny.
    //   If > 10 tenants already created by the current role, deny.
  }


  private def _throwIfMayNotLogin(oneTimePassword: String) {
    // Unless magic token signed correctly by server, deny.
  }

}
