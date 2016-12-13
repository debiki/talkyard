/**
 * Copyright (c) 2012-2015 Kaj Magnus Lindberg
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
import debiki.RateLimits.NoRateLimits
import debiki._
import io.efdi.server.http._
import java.{util => ju}
import debiki.dao.SiteDao
import play.api._
import play.api.Play.current
import play.api.mvc.{Action => _, _}
import play.api.libs.json._
import scala.concurrent.Future
import scala.concurrent.ExecutionContext.Implicits.global
import DebikiHttp._



/** Shows pages and individual posts.
  *
  * Also loads the users permissions on the page, and info on which
  * comments the user has authored or rated, and also loads the user's
  * comments that are pending approval — although such unapproved comments
  * aren't loaded, when other people view the page.
  */
object ViewPageController extends mvc.Controller {


  val HtmlEncodedVolatileJsonMagicString =
    "\"__html_encoded_volatile_json__\""


  def loadPost(pageId: PageId, postNr: PostNr) = GetActionAllowAnyone { request =>
    val dao = request.dao
    val siteSettings = dao.loadWholeSiteSettings()
    val authenticationRequired = siteSettings.userMustBeAuthenticated ||
      siteSettings.userMustBeApproved

    if (authenticationRequired && !request.theUser.isAuthenticated)
      throwForbidden("EdE7KFW02", "Not authenticated")

    if (siteSettings.userMustBeApproved && !request.theUser.isApprovedOrStaff)
      throwForbidden("EdE4F8WV0", "Account not approved")

    val pageMeta = dao.loadPageMeta(pageId) getOrElse
      throwIndistinguishableNotFound("ZE8PK2WY")

    val (maySee, debugCode) = maySeePage(pageMeta, request.user, dao)
    if (!maySee) {
      // Don't indicate that the page exists, because the page slug might tell strangers
      // what it is about. [7C2KF24]
      throwIndistinguishableNotFound(debugCode)
    }

    val json = ReactJson.makeStorePatchForPostNr(pageId, postNr, dao, showHidden = true) getOrElse {
      throwNotFound("EdE6PK4SI2", s"Post ${PagePostNr(pageId, postNr)} not found")
    }
    OkSafeJson(json)
  }


  def viewPage(path: String) = AsyncGetActionAllowAnyone { request =>
    viewPageImpl(request)
  }


  def markPageAsSeen(pageId: PageId) = PostJsonAction(NoRateLimits, maxLength = 2) { request =>
    val watchbar = request.dao.getOrCreateWatchbar(request.theUserId)
    val newWatchbar = watchbar.markPageAsSeen(pageId)
    request.dao.saveWatchbar(request.theUserId, newWatchbar)
    Ok
  }


  private def viewPageImpl(request: GetRequest): Future[Result] = {
    dieIfAssetsMissingIfDevTest()
    Globals.throwForbiddenIfSecretNotChanged()

    val specifiedPagePath = PagePath.fromUrlPath(request.siteId, request.request.path) match {
      case PagePath.Parsed.Good(path) => path
      case PagePath.Parsed.Bad(error) => throwBadRequest("DwE0kI3E4", error)
      case PagePath.Parsed.Corrected(newPath) => throwTemporaryRedirect(newPath)
    }

    val dao = request.dao
    val siteSettings = dao.loadWholeSiteSettings()
    val authenticationRequired = siteSettings.userMustBeAuthenticated ||
      siteSettings.userMustBeApproved

    if (authenticationRequired && !request.isAuthenticated) {
      return Future.successful(Ok(views.html.login.loginPopup(
        SiteTpi(request),
        mode = "LoginToAuthenticate",
        serverAddress = s"//${request.host}",
        returnToUrl = request.uri)) as HTML)
    }

    if (siteSettings.userMustBeApproved && !request.isApprovedOrStaff) {
      val message = request.theUser.isApproved match {
        case None =>
          o"""Your account has not yet been approved. Please wait until
            someone in our staff has approved it."""
        case Some(false) =>
          "You may not access this site, sorry. There is no point in trying again."
        case Some(true) =>
          die("DwE7KEWK2", "Both not approved and approved")
      }
      throwForbidden("DwE403KGW0", message)
    }

    val correctPagePath = dao.checkPagePath(specifiedPagePath) getOrElse {
      // The page doesn't exist.
      if (specifiedPagePath.value != HomepageUrlPath) {
        throwIndistinguishableNotFound()
      }
      // Show a create-something-here page (see TemplateRenderer).
      return doRenderPage(
        makeEmptyPageRequest(
          request, pageId = EmptyPageId, showId = false, pageRole = PageRole.WebPage))
    }

    val pageMeta = correctPagePath.pageId.flatMap(dao.loadPageMeta) getOrElse {
      // Apparently the page was just deleted.
      // COULD load meta in the checkPagePath transaction (above), so that this cannot happen.
      throwIndistinguishableNotFound()
    }

    val (maySee, debugCode) = maySeePage(pageMeta, request.user, dao)
    if (!maySee) {
      // Don't indicate that the page exists, because the page slug might tell strangers
      // what it is about. [7C2KF24]
      throwIndistinguishableNotFound(debugCode)
    }

    if (correctPagePath.value != specifiedPagePath.value) {
      //Results.MovedPermanently(correct.value)  -- NO browsers might cache forever. [7KEW2Z]
      // Later: Could set cache-control 1 day or 1 week? So won't be totally forever.
      // And perhaps add a checkbox "[x] Redirect permanently (cache-control 1 week)
      // in the admin area.
      return Future.successful(Results.SeeOther(correctPagePath.value))
    }

    if (request.user.isEmpty)
      Globals.strangerCounter.strangerSeen(request.siteId, request.theBrowserIdData)

    val pageRequest = new PageRequest[Unit](
      request.siteIdAndCanonicalHostname,
      sid = request.sid,
      xsrfToken = request.xsrfToken,
      browserId = request.browserId,
      user = request.user,
      pageExists = true,
      pagePath = correctPagePath,
      pageMeta = Some(pageMeta),
      dao = dao,
      request = request.request)

    doRenderPage(pageRequest)
  }


  /** Returns true/false, + iff false, a why-forbidden debug reason code.
    */
  def maySeePage(pageMeta: PageMeta, user: Option[User], dao: SiteDao): (Boolean, String) = {
    COULD; REFACTOR; // move this fn to PageDao?  [2KWU043YU1]
    if (user.exists(_.isAdmin))
      return (true, "")

    if (!user.exists(_.isStaff)) {
      pageMeta.categoryId match {
        case Some(categoryId) =>
          val categories = dao.loadCategoriesRootLast(categoryId)
          if (categories.exists(_.staffOnly))
            return (false, "EsE8YGK25")
        case None =>
          // Fine, as of now, let everyone view pages not placed in any category, by default.
      }

      pageMeta.pageRole match {
        case PageRole.SpecialContent | PageRole.Code =>
          return (false, "EsE4YK02R")
        case _ =>
          // Fine.
      }

      val onlyForAuthor = pageMeta.isDeleted // later: or if !isPublished
      if (onlyForAuthor && !user.exists(_.id == pageMeta.authorId))
        return (false, "EsE5GK702")
    }

    if (pageMeta.pageRole.isPrivateGroupTalk) {
      val theUser = user getOrElse {
        return (false, "EsE4YK032-No-User")
      }

      if (!theUser.isAuthenticated)
        return (false, "EsE2GYF04-Is-Guest")

      val memberIds = dao.loadMessageMembers(pageMeta.pageId)
      if (!memberIds.contains(theUser.id))
        return (false, "EsE5K8W27-Not-Page-Member")
    }

    (true, "")
  }


  private def doRenderPage(request: PageGetRequest): Future[Result] = {
    var pageHtml = request.dao.renderPage(request)

    {
      val usersOnlineStuff = request.dao.loadUsersOnlineStuff() // could do asynchronously later
      val anyUserSpecificDataJson = ReactJson.userDataJson(request)
      val volatileJson = Json.obj(
        "usersOnline" -> usersOnlineStuff.usersJson,
        "numStrangersOnline" -> usersOnlineStuff.numStrangers,
        "me" -> anyUserSpecificDataJson.getOrElse(JsNull).asInstanceOf[JsValue])

      // Insert volatile and user specific data into the HTML.
      // The Scala templates take care to place the <script type="application/json">
      // tag with the magic-string-that-we'll-replace-with-user-specific-data before
      // user editable HTML for comments and the page title and body.
      val htmlEncodedJson = org.owasp.encoder.Encode.forHtmlContent(volatileJson.toString)
      pageHtml = org.apache.commons.lang3.StringUtils.replaceOnce(
          pageHtml, HtmlEncodedVolatileJsonMagicString, htmlEncodedJson)

      Future.successful(Ok(pageHtml) as HTML)
    }
  }


  def makeEmptyPageRequest(request: DebikiRequest[Unit], pageId: PageId, showId: Boolean,
        pageRole: PageRole): PageGetRequest = {
    val pagePath = PagePath(
      tenantId = request.siteId,
      folder = "/",
      pageId = Some(pageId),
      showId = showId,
      pageSlug = "")

    val newTopicMeta = PageMeta.forNewPage(
      pageId = pageId,
      pageRole = pageRole,
      authorId = SystemUserId,
      creationDati = new ju.Date,
      categoryId = None,
      publishDirectly = true)

    new DummyPageRequest(
      request.siteIdAndCanonicalHostname,
      sid = request.sid,
      xsrfToken = request.xsrfToken,
      browserId = request.browserId,
      user = request.user,
      pageExists = false,
      pagePath = pagePath,
      pageMeta = newTopicMeta,
      dao = request.dao,
      request = request.request)
  }

}
