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

  val log = play.api.Logger("app.create-site")


  object ConfValNames {
    val NewSiteConfigText = "new-site-config-page-text"
    val NewSiteDomain = "new-site-domain"
  }


  def newWebsiteAddr(websiteName: String, dao: TenantDao): String = {
    def die = throwForbidden(
      "DwE30SC3", "You may not create a new website from this website")
    val siteConfig = dao.loadWebsiteConfig()
    val domain = siteConfig.getText(ConfValNames.NewSiteDomain) getOrElse die
    // Ensure other required config values are present too (fail fast).
    siteConfig.getText(ConfValNames.NewSiteConfigText) getOrElse die
    s"$websiteName.$domain"
  }


  def showWebsiteNameForm() = GetAction { request =>
    _throwIfMayNotCreateWebsite(request)

    val tpi = InternalTemplateProgrammingInterface(request.dao)
    Ok(views.html.createWebsiteChooseName(tpi,
      xsrfToken = request.xsrfToken.value))
  }


  def handleWebsiteNameForm() = JsonOrFormDataPostAction(maxBytes = 100) {
      request =>

    val newWebsiteName =
      request.body.getEmptyAsNone("websiteNameInp") getOrElse
        throwBadReq("DwE01kI72", "Please specify a name for your new website")

    if (!isOkayWebsiteName(newWebsiteName))
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

    Redirect(routes.AppCreateWebsite.showWebsiteOwnerForm.url)
       .withSession(
          request.session + ("website-name" -> newWebsiteName))
  }


  def showWebsiteOwnerForm() = CheckSidActionNoBody {
        (sidOk, xsrfOk, request) =>
    Ok(views.html.login(xsrfToken = xsrfOk.value,
      returnToUrl = routes.AppCreateWebsite.tryCreateWebsite.url,
      title = "Choose Website Owner Account",
      providerLoginMessage = "It will become the owner of the new website.",
      showCreateAccountOption = true))
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

    val websiteAddr = newWebsiteAddr(newWebsiteName, request.dao)

    _throwIfMayNotCreateWebsite(request, newWebsiteAddr = Some(websiteAddr))

    log.info("Creating website, name: "+ newWebsiteName +
       ", address: "+ websiteAddr +", on behalf of: "+ user)

    // SECURITY should whitelist allowed OpenID and OAuth providers.

    // Require OpenID or OAuth (todo) or password (todo) login.
    val idtyOpenId = identity.asInstanceOf[IdentityOpenId]

    val result =
      createWebsite(
        request.dao,
        request.ctime,
        name = newWebsiteName,
        host = websiteAddr,
        ownerIp = request.ip,
        ownerLoginId = loginId,
        ownerIdentity = idtyOpenId,
        ownerRole = user) match {
      case Some(site) =>
        Redirect(s"http://$websiteAddr${routes.AppCreateWebsite.welcomeOwner.url}")
      case None =>
        Ok(views.html.createWebsiteFailNotFirst())
    }

    result.withSession(request.session - "website-name")
  }


  def createWebsite(
        dao: TenantDao,
        creationDati: ju.Date,
        name: String,
        host: String,
        ownerIp: String,
        ownerLoginId: String,
        ownerIdentity: IdentityOpenId,
        ownerRole: User): Option[(Tenant, User)] = {

    // CreateWebsite throws error if one creates too many websites
    // from the same IP.
    val newSiteAndOwner = dao.createWebsite(
       name = name, address = host, ownerIp = ownerIp, ownerLoginId = ownerLoginId,
       ownerIdentity = ownerIdentity, ownerRole = ownerRole)

    newSiteAndOwner match {
      case Some((website, ownerAtNewSite)) =>
        // COULD try to do this in the same transaction as `createWebsite`?
        val newWebsiteDao = Debiki.tenantDao(
          tenantId = website.id, ip = ownerIp, roleId = None)

        val email = _makeNewWebsiteEmail(website, ownerAtNewSite)
        newWebsiteDao.saveUnsentEmail(email)

        Debiki.sendEmail(email, website.id)

        val newSiteConfigText = dao.loadWebsiteConfig().getText(
          ConfValNames.NewSiteConfigText) getOrDie "DwE74Vf9"

        createConfigPage(newSiteConfigText, newWebsiteDao, creationDati = creationDati)
        createHomepage(newWebsiteDao, creationDati = creationDati)

        newSiteAndOwner

      case None =>
        None
    }
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


  /**
   * Must be a valid host namme, not too long or too short (less than 6 chars),
   * no '.' and no leading or trailing '-'. See test suite in
   * AppCreateWebsiteSpec.
   */
  def isOkayWebsiteName(name: String): Boolean = {
    _OkWebsiteNameRegex matches name
  }


  private val _OkWebsiteNameRegex = """[a-z][a-z0-9\-]{4,38}[a-z0-9]""".r


  private def _makeNewWebsiteEmail(website: Tenant, owner: User): Email = {
    val address = website.chost_!.address
    val message = views.html.createWebsiteWelcomeEmail(address).body
    Email(sendTo = owner.email,
      subject = s"New Debiki website created, here: http://$address",
      bodyHtmlText = message)
  }


  private def _throwIfMayNotCreateWebsite(request: ApiRequest[_],
        newWebsiteAddr: Option[String] = None) {
    if (request.host != "www.debiki.com" &&
        !request.host.contains("localhost:"))
      throwForbidden(
        "DwE093AQ2", "You cannot create a new website via that website")

    COULD // check if website already exists, then deny

    // Tenantdao.createWebsite already throws error if too many websites
    // created from the same IP.
  }


  private def createConfigPage(
    text: String, newSiteDao: TenantDao, creationDati: ju.Date) {

    val pageId = AppCreatePage.generateNewPageId()
    val pageBody = Post.newPageBodyBySystem(text, creationDati, PageRole.Code)

    newSiteDao.createPage(PageStuff(
      PageMeta.forNewPage(
        PageRole.Code, creationDati, pageId = pageId, publishDirectly = true),
      PagePath(newSiteDao.tenantId, folder = "/",
        pageId = Some(pageId), showId = false, pageSlug = "_website-config.yaml"),
      Debate(pageId, posts = List(pageBody))))
  }


  /**
   * Creates an empty page at /, with PageRole.Homepage, so I don't need
   * to tell users how to create a homepage. Instead, I create a default
   * empty homepage, and add a "Use this page as homepage" button,
   * so they can easily switch homepage.
   * If they make another page to the homepage, the default homepage
   * is automatically moved from / to /_old/default-homepage.
   */
  private def createHomepage(newWebsiteDao: TenantDao, creationDati: ju.Date) {
    val pageId = AppCreatePage.generateNewPageId()
    val emptyPage = Debate(pageId)
    val pageMeta = PageMeta.forNewPage(
      PageRole.Generic, creationDati, pageId = pageId, publishDirectly = true)
    val oldPath = PagePath(newWebsiteDao.tenantId, folder = "/_old/",
      pageId = Some(pageId), showId = false, pageSlug = "default-homepage")

    // First create the homepage at '/_old/default-homepage'.
    // Then change its location to '/'. If the admin later on lets
    // another page be the homepage, then '/' would be overwritten by the
    // new homepage. The old path to the oridinal homepage will then be
    // activated again.
    newWebsiteDao.createPage(PageStuff(pageMeta, oldPath, emptyPage))
    newWebsiteDao.moveRenamePage(pageId, newFolder = Some("/"), newSlug = Some(""))

    // Set homepage title.
    val title = Post.newTitleBySystem(text = DefaultHomepageTitle, creationDati)
    newWebsiteDao.savePageActionsGenNotfsImpl(emptyPage, List(title), pageMeta)
  }


  val DefaultHomepageTitle = "Default Homepage (click to edit)"

}
