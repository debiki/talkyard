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
import Prelude._


/**
 */
abstract class DebikiRequest[A] {

  def sid: SidOk
  def xsrfToken: XsrfOk
  def identity: Option[Identity]
  def user: Option[User]
  def dao: TenantDao
  def request: Request[A]

  require(dao.quotaConsumers.tenantId == tenantId)
  require(dao.quotaConsumers.ip == Some(ip))
  require(dao.quotaConsumers.roleId ==
     user.filter(_.isAuthenticated).map(_.id))

  def tenantId = dao.tenantId

  def loginId: Option[String] = sid.loginId

  /**
   * The login id of the user making the request. Throws 403 Forbidden
   * if not logged in (shouldn't happen normally).
   */
  def loginId_! : String =
    loginId getOrElse throwForbidden("DwE03kRG4", "Not logged in")

  def user_! : User =
    user getOrElse throwForbidden("DwE86Wb7", "Not logged in")

  def identity_! : Identity =
    identity getOrElse throwForbidden("DwE7PGJ2", "Not logged in")

  /**
   * The display name of the user making the request. Throws 403 Forbidden
   * if not available, i.e. if not logged in (shouldn't happen normally).
   */
  def displayName_! : String =
    sid.displayName getOrElse throwForbidden("DwE97Ik3", "Not logged in")

  def ip = request.remoteAddress

  /**
   * The end user's IP address, *iff* it differs from the login address.
   */
  def newIp: Option[String] = None  // None always, for now

  /**
   * Approximately when the server started serving this request.
   */
  lazy val ctime: ju.Date = new ju.Date

  /**
   * The scheme, host and port specified in the request.
   *
   * For now, the scheme is hardcoded to http.
   */
  def origin: String = "http://"+ request.host

  def queryString = request.queryString

  def body = request.body

  def quotaConsumers = dao.quotaConsumers

}
/**
 * A page related request.
 *
 * Sometimes only the browser ip is known (then there'd be no
 * Login/Identity/User).
 */
case class PageRequest[A](
  sid: SidOk,
  xsrfToken: XsrfOk,
  identity: Option[Identity],
  user: Option[User],
  pageExists: Boolean,
  /** Ids of groups to which the requester belongs. */
  // userMemships: List[String],
  /** If the requested page does not exist, pagePath.pageId is empty. */
  pagePath: PagePath,
  permsOnPage: PermsOnPage,
  dao: TenantDao,
  request: Request[A]) extends DebikiRequest[A] {

  require(pagePath.tenantId == tenantId) //COULD remove tenantId from pagePath
  require(!pageExists || pagePath.pageId.isDefined)

  def pageId: Option[String] = pagePath.pageId

  /**
   * Throws 404 Not Found if id unknown. The page id is known if it
   * was specified in the request, *or* if the page exists.
   */
  def pageId_! : String = pagePath.pageId getOrElse
    throwNotFound("DwE93kD4", "Page does not exist: "+ pagePath.path)

  /**
   * The page this PageRequest concerns, or None if not found
   * (e.g. if !pageExists, or if it was deleted just moments ago).
   */
  lazy val page_? : Option[Debate] =
    if (pageExists)
      pageId.flatMap(id => dao.loadPage(id))
    // Don't load the page even if it was *created* moments ago.
    // having !pageExists and page_? = Some(..) feels risky.
    else None

  /**
   * The page this PageRequest concerns. Throws 404 Not Found if not found.
   *
   * (The page might have been deleted, just after the access control step.)
   */
  lazy val page_! : Debate =
    page_? getOrElse throwNotFound("DwE43XWY", "Page not found")

}


