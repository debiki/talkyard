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
import talkyard.server.http._
import play.api.libs.json._
import play.api.mvc._
import scala.concurrent.Future
import talkyard.server.{TyContext, TyController, RenderedPage}
import javax.inject.Inject
import ViewPageController._
import debiki.dao.NoUsersOnlineStuff
import talkyard.server.authn.LoginReason
import talkyard.server.authn.MinAuthnStrength
import talkyard.server.authz.MaySeeOrWhyNot
import talkyard.server.JsX.JsObjOrNull



/** Shows pages and individual posts.
  *
  * Also loads the users permissions on the page, and info on which
  * comments the user has authored or rated, and also loads the user's
  * comments that are pending approval — although such unapproved comments
  * aren't loaded, when other people view the page.
  */
class ViewPageController @Inject()(cc: ControllerComponents, edContext: TyContext)
  extends TyController(cc, edContext) {

  import context.security.throwIndistinguishableNotFound
  import context.globals
  import context.security



  CHECK_AUTHN_STRENGTH
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

    // & sid leveL?
    val (maySeeResult, debugCode) = dao.maySeePostUseCache(pageId, postNr, request.user)
    maySeeResult match {
      case MaySeeOrWhyNot.YesMaySee =>
        // Fine, don't throw.
      case MaySeeOrWhyNot.NopeNoPostWithThatNr =>
        throwNotFound("_TyEBADPOSTNR", s"There's no post nr $postNr on page $pageId [$debugCode]")
      case MaySeeOrWhyNot.NopePostDeleted =>
        throwNotFound("_TyEPOSTGONE_", s"Post nr $postNr on page $pageId has been deleted [$debugCode]")
      case _ =>
        // Don't indicate that the page exists, because the page slug might tell strangers
        // what it is about. [7C2KF24]
        throwIndistinguishableNotFound(debugCode)
    }

    // Later, if caching post json, don't forget to uncache, if author or post tags
    // added/removed. [if_caching_posts]
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
  CHECK_AUTHN_STRENGTH
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

    val pageCtx = dao.maySeePageUseCache(pageMeta, request.user) ifNot { debugCode =>
      throwIndistinguishableNotFound("LoadJson-" + debugCode)
    }

    // Continue also if correctPagePath.value != specifiedPagePath.value — that'll get
    // corrected client site [4DKWWY0].

    // ?? maybe: if (request.user.isEmpty)
    //  globals.strangerCounter.strangerSeen(request.siteId, request.theBrowserIdData)

    val pageRequest = new PageRequest[U](
      request.site,
      request.anyTySession,
      sid = request.sid,
      xsrfToken = request.xsrfToken,
      browserId = request.browserId,
      user = request.user,
      pageExists = true,
      pagePath = correctPagePath,
      pageMeta = Some(pageMeta),
      ancCatsRootLast = pageCtx.ancCatsRootLast,
      altPageId = None,
      embeddingUrl = None,
      dao = dao,
      request = request.request)

    // Json for strangers and the publicly visible parts of the page.
    val renderedPage = dao.renderWholePageHtmlMaybeUseMemCache(pageRequest)

    // Any stuff, like unapproved comments, only the current user may see.
    COULD_OPTIMIZE // this loads some here unneeded data about the current user.
    // we only need: watchbar and .myDataByPageId[].  [load_less_me_data]
    val anyMeAndStuff: Opt[MeAndStuff] =
      dao.jsonMaker.userDataJson(pageRequest, renderedPage.unapprovedPostAuthorIds,
            renderedPage.anonsByRealId)

    Future.successful(
      OkSafeJson(
        Json.obj(  // ts: PageJsonAndMe
          "reactStoreJsonString" -> renderedPage.reactStoreJsonString,
          "me" -> JsObjOrNull(anyMeAndStuff.map(_.me.meJsOb)),
          "stuffForMe" -> JsObjOrNull(anyMeAndStuff.map(_.stuffForMe.toJson(dao))))))
  }


  private def getPageAsHtml(path: String, request: GetRequest): Future[Result] = {
    // If page not found, or access not allowed, show the same login dialog, so the user
    // won't know if the page exists or not.
    def makeLoginDialog(exception: ResultException): Result = {
      CSP_MISSING
      NotFound(views.html.authn.authnPage(
        SiteTpi(request),
        loginReasonInt = LoginReason.LoginBecauseNotFound.toInt,
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


  def markPageAsSeen(pageId: PageId): Action[JsValue] = PostJsonAction(NoRateLimits,
        MinAuthnStrength.EmbeddingStorageSid12, maxBytes = 2) { request =>
    CHECK_AUTHN_STRENGTH
    request.dao.getAnyWatchbar(request.theReqerId) foreach { watchbar =>
      val newWatchbar = watchbar.markPageAsSeen(pageId)
      request.dao.saveWatchbar(request.theUserId, newWatchbar)
    }
    Ok
  }


  private def getPageAsHtmlImpl(request: GetRequest): Future[Result] = {
    // Similar to loadPost and getPageAsJsonImpl, keep in sync. [7PKW0YZ2]
    dieIfAssetsMissingIfDevTest()

    val specifiedPagePath = PagePath.fromUrlPath(request.siteId, request.request.path) match {
      case PagePath.Parsed.Good(path) => path
      case PagePath.Parsed.Bad(error) => throwBadRequest("TyEPAGEPATH", error)
      case PagePath.Parsed.Corrected(newPath) => throwTemporaryRedirect(newPath)
    }

    val dao = request.dao
    val user = request.user
    val siteSettings = dao.getWholeSiteSettings()
    val authenticationRequired = siteSettings.userMustBeAuthenticated ||
      siteSettings.userMustBeApproved

    val showAuthnDiag = authenticationRequired &&
          // But if we're creating the site, and it's private — then, before
          // the first admin has been created, we're not done with creating the site.
          // Then, skip the authn dialog, instead, show the [create_something_here_page],
          // which will ask pat to sign up as owner.
          request.site.status != SiteStatus.NoAdmin

    if (showAuthnDiag) {
      if (!user.exists(_.isAuthenticated)) {
        // If SSO enabled and siteSettings.ssoLoginRequiredLogoutUrl defined, then
        // could redirect here directly to the SSO url. However, then we'd need
        // a certain makeSsoUrl() here too — but it's in Javascript only.
        // So instead we do any such redirect in Javascript. [COULDSSOREDIR]
        CSP_MISSING
        return Future.successful(Ok(views.html.authn.authnPage(
          SiteTpi(request),
          loginReasonInt = LoginReason.AuthnRequiredToRead.toInt,
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
        var forbiddenResp = ForbiddenResult(s"TyM0APPR_-$code", message)
        if (logout) {
          COULD_OPTIMIZE // do these two in the same tx:
          dao.logout(request.theReqer, bumpLastSeen = true)
          dao.terminateSessionForCurReq(request.underlying)

          forbiddenResp = forbiddenResp.discardingCookies(security.DiscardingSessionCookies: _*)
        }
        return Future.successful(forbiddenResp)
      }
    }

    val correctPagePath = dao.checkPagePath(specifiedPagePath) getOrElse {
      // The page doesn't exist.
      if (specifiedPagePath.value != HomepageUrlPath) {
        throwIndistinguishableNotFound()
      }

      // Show a [create_something_here_page] (see TemplateRenderer).
      val pageRequest = makeEmptyPageRequest(
          request, pageId = EmptyPageId, showId = false, pageRole = PageType.WebPage, globals.now())
      val json = dao.jsonMaker.emptySiteJson(pageRequest).toString()
      val html = views.html.specialpages.createSomethingHerePage(SiteTpi(pageRequest, Some(json))).body
      val renderedPage = RenderedPage(html, "NoJson-2WBKCG7",
            unapprovedPostAuthorIds = Set.empty, anonsByRealId = Map.empty)
      return addVolatileJsonAndPreventClickjacking(renderedPage, pageRequest)
    }

    val pageMeta = correctPagePath.pageId.flatMap(dao.getPageMeta) getOrElse {
      // Apparently the page was just deleted.
      // COULD load meta in the checkPagePath transaction (above), so that this cannot happen.
      throwIndistinguishableNotFound()
    }

    val pageCtx = dao.maySeePageUseCache(pageMeta, request.user) ifNot { debugCode =>
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

    val pageRequest = new PageRequest[U](
      request.site,
      request.anyTySession,
      sid = request.sid,
      xsrfToken = request.xsrfToken,
      browserId = request.browserId,
      user = request.user,
      pageExists = true,
      pagePath = correctPagePath,
      pageMeta = Some(pageMeta),
      ancCatsRootLast = pageCtx.ancCatsRootLast,
      altPageId = None,
      embeddingUrl = None,
      dao = dao,
      request = request.request)

    val renderedPage = dao.renderWholePageHtmlMaybeUseMemCache(pageRequest)

    addVolatileJsonAndPreventClickjacking(renderedPage, pageRequest)
  }

}


object ViewPageController {

  val HtmlEncodedVolatileJsonMagicStringNoQuotes =
    "__html_encoded_volatile_json__"

  val HtmlEncodedVolatileJsonMagicStringQuoted: St =
    "\"" + HtmlEncodedVolatileJsonMagicStringNoQuotes + "\""

  val ContSecPolHeaderName = "Content-Security-Policy"
  val objectSrcNonePolicy = "object-src 'none'; "
  val frameAncestorsSpace = "frame-ancestors "
  val frameAncestorsNone = s"$frameAncestorsSpace'none'"


  RENAME // to addVolatileJsonAndContentSecurityPolicy
  def addVolatileJsonAndPreventClickjacking(renderedPage: RenderedPage, request: PageRequest[_],
        embeddingUrl: Option[String] = None,
        skipUsersOnline: Boolean = false, xsrfTokenIfNoCookies: Option[String] = None): Future[Result] = {
    val pageHtml = renderedPage.html
    addVolatileJsonAndPreventClickjacking2(pageHtml, renderedPage.unapprovedPostAuthorIds, request,
      anonsByRealId = renderedPage.anonsByRealId,
      embeddingUrl = embeddingUrl, skipUsersOnline = skipUsersOnline,
      xsrfTokenIfNoCookies = xsrfTokenIfNoCookies)
  }


  RENAME // to addVolatileJsonAndContentSecurityPolicy
  def addVolatileJsonAndPreventClickjacking2(pageHtmlNoVolData: String,
        unapprovedPostAuthorIds: Set[UserId], request: DebikiRequest[_],
        anonsByRealId: Map[PatId, Seq[Anonym]] = Map.empty,
        embeddingUrl: Option[String] = None,
        skipUsersOnline: Boolean = false, xsrfTokenIfNoCookies: Option[String] = None): Future[Result] = {
    import request.{dao, requester}

    // Could do asynchronously later. COULD avoid sending back empty json fields
    // — first verify that then nothing will break though.
    val usersOnlineStuff =
      if (skipUsersOnline) NoUsersOnlineStuff
      else dao.getUsersOnlineStuff()

    val anyMeAndRestrStuff: Opt[MeAndStuff] =
      request match {
        case pageRequest: PageRequest[_] =>
          dao.jsonMaker.userDataJson(pageRequest, unapprovedPostAuthorIds, anonsByRealId)
        case _: DebikiRequest[_] =>
          dao.jsonMaker.userNoPageToJson(request)
      }

    var volatileJson = Json.obj(  // ts: VolatileDataFromServer
      "usersOnline" -> usersOnlineStuff.cachedUsersJson,
      "numStrangersOnline" -> usersOnlineStuff.numStrangers,
      "me" -> JsObjOrNull(anyMeAndRestrStuff.map(_.me.meJsOb)),
      "stuffForMe" -> JsObjOrNull(anyMeAndRestrStuff.map(_.stuffForMe.toJson(dao))),
      )

    request.context.globals.anyMaintWork foreach { work: MaintWork =>
      var jOb = Json.obj("untilSecs" -> work.untilUnixSecs)
      work.maintWordsHtmlSafe.foreach(m => jOb += "msgLineHtmlSafe" -> JsString(m))
      work.maintMessageHtmlSafe.foreach(m => jOb += "msgParaHtmlSafe" -> JsString(m))
      volatileJson += "maintWork" -> jOb
    }

    // (If the requester is logged in so we could load a real 'me' here,
    // then, somehow the browser sent the server the session id, so no need to
    // include it in the response — the browser knows already.
    // However if this is the first page the user looks at, not yet logged in,
    // then, it might have no xsrf token — need to include. (But not session id.)
    xsrfTokenIfNoCookies foreach { token =>
      volatileJson = volatileJson + ("xsrfTokenIfNoCookies" -> JsString(token))   // [NOCOOKIES]
    }

    // Insert volatile and user specific data into the HTML.
    // The Scala templates take care to place the <script type="application/json">
    // tag with the magic-string-that-we'll-replace-with-user-specific-data before
    // user editable HTML for comments and the page title and body. [8BKAZ2G]
    // (We replace the quotes around the string too, or the page json would end up
    // inside "...".)
    val htmlEncodedJson = org.owasp.encoder.Encode.forHtmlContent(volatileJson.toString)
    val pageHtml = org.apache.commons.lang3.StringUtils.replaceOnce(
          pageHtmlNoVolData, HtmlEncodedVolatileJsonMagicStringQuoted, htmlEncodedJson)

    requester.foreach(dao.pubSub.userIsActive(request.siteId, _, request.theBrowserIdData))

    var response = play.api.mvc.Results.Ok(pageHtml)

    // Prevent clickjacking or embedding & "stealing" content. Previously done in Nginx [7ACKRQ20].
    val allowEmbeddingFrom: String = request.siteSettings.allowEmbeddingFromBetter.mkString(" ")
    SECURITY // should one check for more weird chars? If evil admin attacks hens own site?
    // "':/*" are ok, because one may include protocol and/or port, in CSP frame-ancestors,
    // and "'self'", and wildcar '*'.
    def allowEmbeddingIsWeird: Bo = allowEmbeddingFrom.exists("\r\t\n,;?&#\"\\" contains _)

    val framePolicy: St = {  // reindent later
    if (allowEmbeddingFrom.isEmpty || allowEmbeddingIsWeird) {
      response = response.withHeaders("X-Frame-Options" -> "DENY")  // for old browsers
      frameAncestorsNone
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
      // Also update: [4GUYQC0]   [embng_url]
      frameAncestorsSpace + allowEmbeddingFrom + allowIfLocalhost
    }
    }

    val globals = request.context.globals
    val featureFlags = globals.config.featureFlags

    val scriptSrcPolicy: St =
          if (!featureFlags.contains("ffUseScriptSrcSelfCsp")) ""
          else {
            var okOrigins = ""
            if (!featureFlags.contains("ffNoPolyfillDotIo")) {
              okOrigins += "https://cdn.polyfill.io "
            }
            globals.anyCdnOrigin foreach { cdnOrigin =>
              okOrigins += cdnOrigin
            }
            // Only let side admins add custom scripts.
            globals.anyUgcOriginFor(request.site, forAssetsByAdmins = true) foreach { origin =>
              assert(origin contains "://a-", "TyE02RAMJL4")
              okOrigins += " " + origin
            }
            s"script-src 'self' $okOrigins; "
          }

    // Maybe need:
    // style-src    — inline styles supposedly blocked by default.
    // https://content-security-policy.com/examples/allow-inline-style
    // > When you enable CSP, it will block inline styles
    // e.g.: <div style="..."> or <style>...</style>

    SECURITY; SHOULD // use an even more strict policy:  default-src 'none';
    // and then 'self' and any CDN for some of:
    //    script-src  connect-src  img-src  style-src  base-uri  form-action

    // Could add a Report-top attr, to get to know about violations:
    // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy/report-to
    // Sends violation info via POST & JSON to specified uri.
    val objSrcPolicy =
          if (featureFlags contains "ffNoObjSrcCsp") ""
          else objectSrcNonePolicy

    // You can check the CSP with: https://csp-evaluator.withgoogle.com/
    val contSecPolicy = objSrcPolicy + scriptSrcPolicy + framePolicy

    response = response.withHeaders(
          ContSecPolHeaderName -> contSecPolicy)  // [7ACKRQ20]

    // IE11 supports only "X-Content-Security-Policy" and the "sandbox" value,
    // but we shouldn't use it here (it's like <iframe sandbox=...>).

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
      request.anyTySession,
      sid = request.sid,
      xsrfToken = request.xsrfToken,
      browserId = request.browserId,
      user = request.user,
      pageExists = false,  // CLEAN_UP REMOVE? use pageId == EmptyPageId instead?
      pagePath = pagePath,
      pageMeta = newTopicMeta,
      ancCatsRootLast = Nil,
      dao = request.dao,
      request = request.request)
  }

}
