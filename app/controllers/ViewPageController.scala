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
import debiki.EdHttp._
import ed.server.http._
import play.api.libs.json._
import play.api.mvc._
import scala.concurrent.Future
import ed.server.{EdContext, EdController, RenderedPage}
import javax.inject.Inject
import ViewPageController._
import debiki.dao.UsersOnlineStuff
import ed.server.security.EdSecurity



/** Shows pages and individual posts.
  *
  * Also loads the users permissions on the page, and info on which
  * comments the user has authored or rated, and also loads the user's
  * comments that are pending approval — although such unapproved comments
  * aren't loaded, when other people view the page.
  */
class ViewPageController @Inject()(cc: ControllerComponents, edContext: EdContext)
  extends EdController(cc, edContext) {

  import context.security.throwIndistinguishableNotFound
  import context.globals
  import context.security



  def loadPost(pageId: PageId, postNr: PostNr): Action[Unit] = GetActionAllowAnyone { request =>
    // Similar to getPageAsJsonImpl and getPageAsHtmlImpl, keep in sync. [7PKW0YZ2]

    val dao = request.dao
    val siteSettings = dao.getWholeSiteSettings()
    val authenticationRequired = siteSettings.userMustBeAuthenticated ||
      siteSettings.userMustBeApproved

    if (authenticationRequired) {
      if (!request.theUser.isAuthenticated)
        throwForbidden("EdE7KFW02", "Not authenticated")

      if (siteSettings.userMustBeApproved && !request.theUser.isApprovedOrStaff)
        throwForbidden("EdE4F8WV0", "Account not approved")
    }

    val (maySee, debugCode) = dao.maySeePostUseCache(pageId, postNr, request.user)
    if (!maySee) {
      // Don't indicate that the page exists, because the page slug might tell strangers
      // what it is about. [7C2KF24]
      throwIndistinguishableNotFound(debugCode)
    }

    val json = dao.jsonMaker.makeStorePatchForPostNr(pageId, postNr, showHidden = true) getOrElse {
      throwNotFound("EdE6PK4SI2", s"Post ${PagePostNr(pageId, postNr)} not found")
    }
    OkSafeJson(json)
  }


  /** Load a page like so: GET server/page/path and you'll get normal HTML.
    * Load it instead like so: GET server/page/path?json — and you'll get JSON for usage
    * in "instant" navigation in the single-page-app (SPA).
    *
    * Why ?json instead of e.g. GET server/-/get-page-json?path=/page/path ? Because with the ?json
    * approach, the request logs will contain /page/path rather than /-/get-page-json?path=...,
    * and then log parsing tools will understand that the JSON requests are real page navigation
    * steps that updates the browser's URL to the page path.
    * Good for analytics and understanding what the users do at the site?
    * The SPA stuff is just an optimization.
    */
  def viewPage(path: String): Action[Unit] = AsyncGetActionAllowAnyone { request =>
    if (request.queryString.get("json").isDefined) {
      getPageAsJson(path, request)
    }
    else {
      getPageAsHtml(path, request)
    }
  }


  def makeProblemJsonResult(problemCode: Int, problemMessage: String = ""): Result =
    OkSafeJson(Json.obj(
      "problemCode" -> problemCode,
      "problemMessage" -> problemMessage))


  private def getPageAsJson(path: String, request: GetRequest): Future[Result] = {
    try {
      getPageAsJsonImpl(path, request) recover {
        case ex: ResultException if ex.statusCode == NOT_FOUND =>
          makeProblemJsonResult(NOT_FOUND)
      }
    }
    catch {
      case ex: ResultException if ex.statusCode == NOT_FOUND =>
        Future.successful(makeProblemJsonResult(NOT_FOUND))
    }
  }


  private def getPageAsJsonImpl(path: String, request: GetRequest): Future[Result] = {
    // Similar to loadPost and getPageAsHtmlImpl, keep in sync. [7PKW0YZ2]

    // If the URL needs to be corrected, the client can do that via the browser history api,
    // so don't throw any redirect or sth like that.
    val specifiedPagePath: PagePath = PagePath.fromUrlPath(request.siteId, request.request.path) match {
      case PagePath.Parsed.Good(goodPath) => goodPath
      case PagePath.Parsed.Corrected(correctedPath) =>
        // For now
        return Future.successful(makeProblemJsonResult(BAD_REQUEST,
          s"Unimplemented: Correcting page path from $path to $correctedPath [EdE6GJHML2]"))
      case PagePath.Parsed.Bad(error) =>
        return Future.successful(makeProblemJsonResult(BAD_REQUEST, "Bad page path [EdE2WBR04]"))
    }

    val dao = request.dao
    val user = request.user
    val siteSettings = dao.getWholeSiteSettings()
    val authenticationRequired = siteSettings.userMustBeAuthenticated ||
      siteSettings.userMustBeApproved

    // Need not return detailed error messages. Those are shown on the initial page load,
    // by getPageAsHtmlImpl.
    if (authenticationRequired) {
      if (!user.exists(_.isAuthenticated))
        return Future.successful(makeProblemJsonResult(UNAUTHORIZED))

      if (siteSettings.userMustBeApproved && !user.exists(_.isApprovedOrStaff))
        return Future.successful(makeProblemJsonResult(UNAUTHORIZED))
    }

    val correctPagePath = dao.checkPagePath(specifiedPagePath) getOrElse {
      throwIndistinguishableNotFound("LoadJson-NotFound")
    }

    val pageMeta = correctPagePath.pageId.flatMap(dao.getPageMeta) getOrElse {
      throwIndistinguishableNotFound("LoadJson-NoMeta")
    }

    val (maySee, debugCode) = dao.maySeePageUseCache(pageMeta, request.user)
    if (!maySee) {
      throwIndistinguishableNotFound("LoadJson-" + debugCode)
    }

    // Continue also if correctPagePath.value != specifiedPagePath.value — that'll get
    // corrected client site [4DKWWY0].

    // ?? maybe: if (request.user.isEmpty)
    //  globals.strangerCounter.strangerSeen(request.siteId, request.theBrowserIdData)

    val pageRequest = new PageRequest[Unit](
      request.site,
      sid = request.sid,
      xsrfToken = request.xsrfToken,
      browserId = request.browserId,
      user = request.user,
      pageExists = true,
      pagePath = correctPagePath,
      pageMeta = Some(pageMeta),
      altPageId = None,
      embeddingUrl = None,
      dao = dao,
      request = request.request)

    // Json for strangers and the publicly visible parts of the page.
    val renderedPage = request.dao.renderPageMaybeUseMemCache(pageRequest)

    // Any stuff, like unapproved comments, only the current user may see.
    COULD_OPTIMIZE // this loads some here unneeded data about the current user.
    val anyUserSpecificDataJson: Option[JsObject] =
      dao.jsonMaker.userDataJson(pageRequest, renderedPage.unapprovedPostAuthorIds)

    Future.successful(
      OkSafeJson(
        Json.obj(
          "reactStoreJsonString" -> renderedPage.reactStoreJsonString,
          "me" -> anyUserSpecificDataJson)))
  }


  private def getPageAsHtml(path: String, request: GetRequest): Future[Result] = {
    // If page not found, or access not allowed, show the same login dialog, so the user
    // won't know if the page exists or not.
    def makeLoginDialog(exception: ResultException): Result = {
      NotFound(views.html.login.loginPopup(
        SiteTpi(request),
        mode = "LoginBecauseNotFound",
        // error =  result.body
        serverAddress = s"//${request.host}",
        returnToUrl = request.uri,
        debugMessage = exception.bodyToString)) as HTML
    }

    try {
      getPageAsHtmlImpl(request) recover {
        case ex: ResultException if ex.statusCode == NOT_FOUND =>
          makeLoginDialog(ex)
      }
    }
    catch {
      case ex: ResultException if ex.statusCode == NOT_FOUND =>
        Future.successful(makeLoginDialog(ex))
    }
  }


  def markPageAsSeen(pageId: PageId): Action[JsValue] = PostJsonAction(NoRateLimits, maxBytes = 2) {
        request =>
    val watchbar = request.dao.getOrCreateWatchbar(request.theUserId)
    val newWatchbar = watchbar.markPageAsSeen(pageId)
    request.dao.saveWatchbar(request.theUserId, newWatchbar)
    Ok
  }


  private def getPageAsHtmlImpl(request: GetRequest): Future[Result] = {
    // Similar to loadPost and getPageAsJsonImpl, keep in sync. [7PKW0YZ2]
    dieIfAssetsMissingIfDevTest()

    val specifiedPagePath = PagePath.fromUrlPath(request.siteId, request.request.path) match {
      case PagePath.Parsed.Good(path) => path
      case PagePath.Parsed.Bad(error) => throwBadRequest("DwE0kI3E4", error)
      case PagePath.Parsed.Corrected(newPath) => throwTemporaryRedirect(newPath)
    }

    val dao = request.dao
    val user = request.user
    val siteSettings = dao.getWholeSiteSettings()
    val authenticationRequired = siteSettings.userMustBeAuthenticated ||
      siteSettings.userMustBeApproved

    if (authenticationRequired) {
      if (!user.exists(_.isAuthenticated)) {
        return Future.successful(Ok(views.html.login.loginPopup(
          SiteTpi(request),
          mode = "LoginToAuthenticate",
          serverAddress = s"//${request.host}",
          returnToUrl = request.uri)) as HTML)
      }

      if (siteSettings.userMustBeApproved && !user.exists(_.isApprovedOrStaff)) {
        var logout = false
        val (message, code) = request.theUser match {
          case _: Guest => ("Guest login not allowed", "TyE0GUESTS")
          case member: User =>
            member.isApproved match {
              case None =>
                // Logout, because maybe there're other people who use the same computer,
                // but different accounts? A bit annoying if they'd all had to wait until this
                // user gets approved. Also, could be a security issue, to be unable to logout.
                UX; COULD // show a logout button, instead of always logging out. (4GPKB2)
                logout = true
                (o"""Your account has not yet been approved. Please wait until
                  someone in our staff has approved it.""", "TyMAPPRPEND_")
              case Some(false) =>
                // Log out, so can try again as another user. (4GPKB2)
                logout = true
                ("You may not access this site with this account, sorry.", "TyMNOACCESS_")
              case Some(true) =>
                die("DwE7KEWK2", "Both not approved and approved")
            }
        }
        var forbidden = ForbiddenResult(s"TyM0APPR_-$code", message)
        if (logout) forbidden = forbidden.discardingCookies(security.DiscardingSessionCookie)
        return Future.successful(forbidden)
      }
    }

    val correctPagePath = dao.checkPagePath(specifiedPagePath) getOrElse {
      // The page doesn't exist.
      if (specifiedPagePath.value != HomepageUrlPath) {
        throwIndistinguishableNotFound()
      }

      // Show a create-something-here page (see TemplateRenderer).
      val pageRequest = makeEmptyPageRequest(
          request, pageId = EmptyPageId, showId = false, pageRole = PageType.WebPage, globals.now())
      val json = dao.jsonMaker.emptySiteJson(pageRequest).toString()
      val html = views.html.specialpages.createSomethingHerePage(SiteTpi(pageRequest, Some(json))).body
      val renderedPage = RenderedPage(html, "NoJson-2WBKCG7", unapprovedPostAuthorIds = Set.empty)
      return addVolatileJsonAndPreventClickjacking(renderedPage, pageRequest)
    }

    val pageMeta = correctPagePath.pageId.flatMap(dao.getPageMeta) getOrElse {
      // Apparently the page was just deleted.
      // COULD load meta in the checkPagePath transaction (above), so that this cannot happen.
      throwIndistinguishableNotFound()
    }

    val (maySee, debugCode) = dao.maySeePageUseCache(pageMeta, request.user)
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
      globals.strangerCounter.strangerSeen(request.siteId, request.theBrowserIdData)

    val pageRequest = new PageRequest[Unit](
      request.site,
      sid = request.sid,
      xsrfToken = request.xsrfToken,
      browserId = request.browserId,
      user = request.user,
      pageExists = true,
      pagePath = correctPagePath,
      pageMeta = Some(pageMeta),
      altPageId = None,
      embeddingUrl = None,
      dao = dao,
      request = request.request)

    val renderedPage = dao.renderPageMaybeUseMemCache(pageRequest)

    addVolatileJsonAndPreventClickjacking(renderedPage, pageRequest)
  }

}


object ViewPageController {

  val HtmlEncodedVolatileJsonMagicString =
    "\"__html_encoded_volatile_json__\""

  val ContSecPolHeaderName = "Content-Security-Policy"
  val XContSecPolHeaderName = s"X-$ContSecPolHeaderName"
  val frameAncestorsSpace = "frame-ancestors "
  val frameAncestorsNone = s"$frameAncestorsSpace'none'"


  def addVolatileJsonAndPreventClickjacking(renderedPage: RenderedPage, request: PageRequest[_],
        embeddingUrl: Option[String] = None,
        skipUsersOnline: Boolean = false, xsrfTokenIfNoCookies: Option[String] = None): Future[Result] = {
    val pageHtml = renderedPage.html
    addVolatileJsonAndPreventClickjacking2(pageHtml, renderedPage.unapprovedPostAuthorIds, request,
      embeddingUrl = embeddingUrl, skipUsersOnline = skipUsersOnline,
      xsrfTokenIfNoCookies = xsrfTokenIfNoCookies)
  }


  def addVolatileJsonAndPreventClickjacking2(pageHtmlNoVolData: String,
        unapprovedPostAuthorIds: Set[UserId], request: DebikiRequest[_],
        embeddingUrl: Option[String] = None,
        skipUsersOnline: Boolean = false, xsrfTokenIfNoCookies: Option[String] = None): Future[Result] = {
    import request.{dao, requester}

    // Could do asynchronously later. COULD avoid sending back empty json fields
    // — first verify that then nothing will break though.
    val usersOnlineStuff =
      if (skipUsersOnline) UsersOnlineStuff(users = Nil, usersJson = JsArray(), numStrangers = 0)
      else dao.loadUsersOnlineStuff()

    val anyUserSpecificDataJson: Option[JsValue] =
      request match {
        case pageRequest: PageRequest[_] =>
          dao.jsonMaker.userDataJson(pageRequest, unapprovedPostAuthorIds)
        case _: DebikiRequest[_] =>
          Some(dao.jsonMaker.userNoPageToJson(request))
      }

    var volatileJson = Json.obj(  // VolatileDataFromServer
      "usersOnline" -> usersOnlineStuff.usersJson,
      "numStrangersOnline" -> usersOnlineStuff.numStrangers,
      "me" -> anyUserSpecificDataJson.getOrElse(JsNull).asInstanceOf[JsValue])

    xsrfTokenIfNoCookies foreach { token =>
      volatileJson = volatileJson + ("xsrfTokenIfNoCookies" -> JsString(token))   // [NOCOOKIES]
    }

    // Insert volatile and user specific data into the HTML.
    // The Scala templates take care to place the <script type="application/json">
    // tag with the magic-string-that-we'll-replace-with-user-specific-data before
    // user editable HTML for comments and the page title and body. [8BKAZ2G]
    val htmlEncodedJson = org.owasp.encoder.Encode.forHtmlContent(volatileJson.toString)
    val pageHtml = org.apache.commons.lang3.StringUtils.replaceOnce(
        pageHtmlNoVolData, HtmlEncodedVolatileJsonMagicString, htmlEncodedJson)

    requester.foreach(dao.pubSub.userIsActive(request.siteId, _, request.theBrowserIdData))

    var response = play.api.mvc.Results.Ok(pageHtml)

    // Prevent clickjacking or embedding & "stealing" content. Previously done in Nginx [7ACKRQ20].
    val allowEmbeddingFrom: String = request.siteSettings.allowEmbeddingFromBetter.mkString(" ")
    SECURITY // should one check for more weird chars? If evil admin attacks hens own site?
    // "':/*" are ok, because one may include protocol and/or port, in CSP frame-ancestors,
    // and "'self'", and wildcar '*'.
    def allowEmbeddingIsWeird = allowEmbeddingFrom.exists("\r\t\n,;?&#\"\\" contains _)
    if (allowEmbeddingFrom.isEmpty || allowEmbeddingIsWeird) {
      response = response.withHeaders(
          "X-Frame-Options" -> "DENY",  // For old browsers.
          ContSecPolHeaderName -> frameAncestorsNone,
          XContSecPolHeaderName -> frameAncestorsNone) // IE11
    }
    else {
      // People sometimes try out the blog comments, on localhost; let them do that,
      // without updating the allow-embedding-from setting. [5RTCN2]
      val embeddingHostname = embeddingUrl.flatMap(GetHostnameRegex.findGroupIn)
      val allowIfLocalhost = if (embeddingHostname isNot "localhost") "" else {
        // Don't:  " localhost:*" without specifying protocol — that would require
        // the embedding page to be HTTPS, if testing on localhost against a Talkyard
        // server over HTTPS. However, when testing on localhost, one typically
        // wants to use HTTP (even if Talkyard is HTTPS).
        // See: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy/frame-ancestors
        // """If no URL scheme is specified for a host-source and the iframe is
        // loaded from an https URL, the URL for the page loading the iframe must
        // also be https"""
        " http://localhost:* https://localhost:*"
      }
      val framePolicy = frameAncestorsSpace + allowEmbeddingFrom + allowIfLocalhost
      SECURITY; COULD // +=
      //  "; object-src 'none'; script-src 'self' https://cdn.polyfill.io"
      // See: https://csp-evaluator.withgoogle.com/
      // Need to add a feature flag, so can disable if accidentally breaks sth.
      // Also, how backw compat is this? with older browsers? Ask at SO?
      response = response.withHeaders(
          ContSecPolHeaderName -> framePolicy,  // [7ACKRQ20]
          XContSecPolHeaderName -> framePolicy) // IE11
      // Also update: [4GUYQC0]
    }

    Future.successful(response as play.api.http.ContentTypes.HTML)
  }

  def makeEmptyPageRequest(request: DebikiRequest[Unit], pageId: PageId, showId: Boolean,
        pageRole: PageType, now: When): PageGetRequest = {
    val pagePath = PagePath(
      siteId = request.siteId,
      folder = "/",
      pageId = Some(pageId),
      showId = showId,
      pageSlug = "")

    val newTopicMeta = PageMeta.forNewPage(
      pageId = pageId,
      pageRole = pageRole,
      authorId = SystemUserId,
      creationDati = now.toJavaDate,
      numPostsTotal = 0,
      categoryId = None,
      publishDirectly = true)

    new DummyPageRequest(
      request.site,
      sid = request.sid,
      xsrfToken = request.xsrfToken,
      browserId = request.browserId,
      user = request.user,
      pageExists = false,  // CLEAN_UP REMOVE? use pageId == EmptyPageId instead?
      pagePath = pagePath,
      pageMeta = newTopicMeta,
      dao = request.dao,
      request = request.request)
  }

}
