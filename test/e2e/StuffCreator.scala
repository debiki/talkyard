/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package test.e2e

import com.debiki.v0.Prelude._
import com.debiki.v0._
import debiki.Debiki
import java.{util => ju}
import org.scalatest.Assertions
import org.scalatest.selenium.WebBrowser
import play.api.test.Helpers.testServerPort
import com.debiki.v0.{PostActionPayload => PAP}


/**
 * A specification for browser end-to-end/integration tests.
 */
trait StuffCreator {

  def firstSiteHost = s"localhost:$testServerPort"


  val DefaultBackgroundColor = "rgba(255, 248, 220, 1)" // that's cornsilk


  /**
   * The id of website with origin http://localhost:test-server-port.
   * It's created lazily.
   *
   * `firstSiteOrigin` is computed here so accessing it triggers the
   * creation of the site, if not done before.
   *
   * Perhaps I should do this in `beforeAll` instead?
   */
  lazy val (firstSiteId: String, firstSiteOrigin: String) = {
    Debiki.systemDao.lookupTenant("http", firstSiteHost) match {
      case FoundNothing =>
        createFirstSite()
      case FoundChost(siteId) =>
        (siteId, "http://" + firstSiteHost)
      case _ => assErr("DwE26kbSF7")
    }
  }


  lazy val firstSiteDao = Debiki.tenantDao(firstSiteId, "127.0.0.1")


  /**
   * A loginGrant for a certain user that creates all stuff.
   */
  private lazy val (loginGrant: LoginGrant, postTemplate: PostActionDto[PAP.CreatePost]) = {

    val login = Login(id = "?", prevLoginId = None, ip = "1.1.1.1",
      date = new ju.Date, identityId = "?i")

    val identitySimple = IdentitySimple(id = "?i", userId = "?",
      name = "Stoffe Kreitor", email = "no@email.no", location = "", website = "")

    val loginReq = LoginRequest(login, identitySimple)
    val loginGrant = firstSiteDao.saveLogin(loginReq)

    val postTemplate = PostActionDto.forNewPost(
      id = "?", parentPostId = PageParts.BodyId, creationDati = new ju.Date,
      loginId = loginGrant.login.id, userId = loginGrant.user.id,
      newIp = None, text = "", markup = "para",
      approval = Some(Approval.AuthoritativeUser))

    (loginGrant, postTemplate)
  }


  /**
   * Creates a `localhost` website, from which creation of other websites
   * is allowed.
   *
   * Returns (firstSiteId, firstSiteOrigin).
   */
  private def createFirstSite(): (String, String) = {
    val firstSite = Debiki.systemDao.createTenant(name = "FirstSite")
    val firstSiteDao = Debiki.tenantDao(firstSite.id, "127.0.0.1")
    firstSiteDao.addTenantHost(TenantHost(
      firstSiteHost, TenantHost.RoleCanonical, TenantHost.HttpsNone))

    // Create ./themes/example/theme.conf and ./themes/example/theme.css,
    // referred to by the new site config page.
    createCodePage(firstSiteId, "/themes/example/", "theme.conf", i"""
      |asset-bundles:
      |  styles.css:
      |    - http://$firstSiteHost/themes/example/theme.css
      |    - /themes/local/theme.css, optional
      |""")

    createCodePage(firstSiteId, "/themes/example/", "theme.css", i"""
      |body {
      |  background: $DefaultBackgroundColor !important;
      |}
      |""")

    createCodePage(firstSiteId, "/", "_website-config.yaml", i"""
          |new-site-domain: $firstSiteHost
          |new-site-terms-of-use: /hosting/terms-of-service
          |new-site-privacy-policy: /hosting/privacy-policy
          |new-site-config-page-text: |
          |  extend: http://$firstSiteHost/themes/example/theme.conf
          |""")

    (firstSite.id, "http://" + firstSiteHost)
  }


  private def createCodePage(siteId: String, folder: String, slug: String, text: String) {
    val body = PostActionDto.copyCreatePost(postTemplate,
      id = PageParts.BodyId, text = text, markup = Markup.Code.id)
    val pagePath = PagePath(
      firstSiteId, folder, pageId = None, showId = false, pageSlug = slug)
    val page = PageParts(guid = "?", actionDtos = body::Nil)
    firstSiteDao.createPage(Page.newPage(
      PageRole.Generic, pagePath, page, publishDirectly = true, author = loginGrant.user))
  }


  /**
   * Creates a test page in site `firstSiteId`, returns a URL.
   */
  def createTestPage(
        pageRole: PageRole,
        pageSlug: String = "test-page",
        title: String,
        body: Option[String]): String = {

    val titlePost = PostActionDto.copyCreatePost(postTemplate,
      id = PageParts.TitleId, parentPostId = PageParts.TitleId, text = title)

    val bodyPost = body map { text =>
      PostActionDto.copyCreatePost(postTemplate, id = PageParts.BodyId, text = text)
    }

    val pagePath = PagePath(
      firstSiteId, "/", pageId = None, showId = true, pageSlug = pageSlug)

    val debateNoId = PageParts(guid = "?", actionDtos = titlePost :: bodyPost.toList)
    val pageStuffNoPeople = firstSiteDao.createPage(Page.newPage(
      pageRole, pagePath, debateNoId, publishDirectly = true, author = loginGrant.user))

    val pageWithPeople = firstSiteDao.loadPage(pageStuffNoPeople.id).getOrElse(
      assErr("DwE381kK0", "Error loading page with people"))

    firstSiteHost + pageStuffNoPeople.path.path
  }

}


