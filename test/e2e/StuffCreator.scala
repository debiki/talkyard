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


/**
 * A specification for browser end-to-end/integration tests.
 */
trait StuffCreator {
  self: Assertions with WebBrowser =>

  def firstSiteHost = s"localhost:$testServerPort"


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
  private lazy val (loginGrant: LoginGrant, postTemplate: Post) = {

    val login = Login(id = "?", prevLoginId = None, ip = "1.1.1.1",
      date = new ju.Date, identityId = "?i")

    val identitySimple = IdentitySimple(id = "?i", userId = "?",
      name = "Stoffe Kreitor", email = "no@email.no", location = "", website = "")

    val loginReq = LoginRequest(login, identitySimple)
    val loginGrant = firstSiteDao.saveLogin(loginReq)

    val postTemplate = Post(id = "?", parent = "1", ctime = new ju.Date,
      loginId = loginGrant.login.id, newIp = None, text = "", markup = "para",
      tyype = PostType.Text, where = None, approval = Some(Approval.AuthoritativeUser))

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

    // TODO
    // Create ./example-theme/theme.conf and ./example-theme/styles.css,
    // referred to by the new site config page.
    //createThemeToExtend()

    createSiteConfigPage(firstSiteId, i"""
          |new-site-domain: $firstSiteHost
          |new-site-terms-of-use: /hosting/terms-of-service
          |new-site-privacy-policy: /hosting/privacy-policy
          |new-site-config-page-text: |
          |  # extend: localhost:$testServerPort/example-theme/theme.conf
          |  asset-bundles:
          |    styles.css:
          |      - /dummy-file.css, optional
          |""")

    (firstSite.id, "http://" + firstSiteHost)
  }


  /**
   * Creates the _website-config.yaml page for stie `siteId` and inserts
   * `configValues`.
   */
  private def createSiteConfigPage(siteId: String, configValues: String) {
    val p = postTemplate
    val body = p.copy(id = Page.BodyId, text = configValues)
    val pagePath = PagePath(
      firstSiteId, "/", pageId = None, showId = false, pageSlug = "_website-config.yaml")
    val page = Debate(guid = "?", posts = body::Nil)
    firstSiteDao.createPage(PageStuff.forNewPage(
      pagePath, page, publishDirectly = true))
  }


  /**
   * Creates a test page in site `firstSiteId`.
   */
  def createTestPage() = {

    val bodyPost = postTemplate.copy(
      id = Page.BodyId, text = "Test page text 953Ih31.")

    val pagePath = PagePath(
      firstSiteId, "/", pageId = None, showId = true, pageSlug = "test-page")

    val debateNoId = Debate(guid = "?", posts = bodyPost::Nil)
    val pageStuffNoPeople = firstSiteDao.createPage(PageStuff.forNewPage(
      pagePath, debateNoId, publishDirectly = true))

    val pageWithPeople = firstSiteDao.loadPage(pageStuffNoPeople.id).getOrElse(
      fail("Error loading page with people"))

    new Page {
      val url = firstSiteHost + pageStuffNoPeople.path.path
    }
  }

}


