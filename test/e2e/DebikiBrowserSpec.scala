/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package test.e2e

import java.{util => ju}
import org.openqa.selenium.WebDriver
import org.scalatest.{BeforeAndAfterAll, FreeSpec}
import org.scalatest.matchers.MustMatchers
import org.scalatest.selenium.WebBrowser
import org.scalatest.concurrent.{Eventually, ScaledTimeSpans}
import org.scalatest.time.{Span, Seconds, Millis}
import play.api.{test => pt}
import play.api.test.Helpers.testServerPort
import com.debiki.v0.Prelude._
import com.debiki.v0._
import debiki.Debiki
import test.FailsOneCancelRemaining


/**
 * A specification for browser end-to-end/integration tests.
 */
abstract class DebikiBrowserSpec extends FreeSpec with WebBrowser
  with FailsOneCancelRemaining with BeforeAndAfterAll
  with Eventually with ScaledTimeSpans
  with MustMatchers {

  implicit override val patienceConfig = PatienceConfig(
    // Set long timeout so I can step through code in the debugger.
    timeout = scaled(Span(60, Seconds)),
    interval = scaled(Span(100, Millis)))

  private def firstSiteHost = s"localhost:$testServerPort"

  implicit def webDriver = _webDriver
  private var _webDriver: WebDriver = null


  override def beforeAll() {
    _webDriver = ChromeDriverFactory.createDriver()
  }


  override def afterAll() {
    webDriver.quit()
  }


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
    import debiki.Debiki.systemDao
    systemDao.lookupTenant("http", firstSiteHost) match {
      case FoundNothing =>
        val firstSite = systemDao.createTenant(name = "FirstSite")
        val firstSiteDao = Debiki.tenantDao(firstSite.id, "127.0.0.1")
        firstSiteDao.addTenantHost(TenantHost(
          firstSiteHost, TenantHost.RoleCanonical, TenantHost.HttpsNone))
        (firstSite.id, "http://" + firstSiteHost)
      case FoundChost(siteId) =>
        (siteId, "http://" + firstSiteHost)
      case _ => assErr("DwE26kbSF7")
    }
  }


  /**
   * Creates a test page in site `firstSiteId`.
   */
  def createTestPage() = {

    val postTemplate = Post(id = "?", parent = "1", ctime = new ju.Date,
      loginId = "?", newIp = None, text = "", markup = "para",
      tyype = PostType.Text, where = None, approval = None)

    val login = Login(id = "?", prevLoginId = None, ip = "1.1.1.1",
      date = new ju.Date, identityId = "?i")
    val identitySimple = IdentitySimple(id = "?i", userId = "?",
      name = "Målligan", email = "no@email.no", location = "", website = "")

    val firstSiteDao = Debiki.tenantDao(firstSiteId, "127.0.0.1")

    val loginReq = LoginRequest(login, identitySimple)
    val loginGrant = firstSiteDao.saveLogin(loginReq)

    lazy val bodyPost = postTemplate.copy(
      id = Page.BodyId, loginId = loginGrant.login.id, text = "Test page text 953Ih31.")

    val pagePath = PagePath(
      firstSiteId, "/", pageId = None, showId = true, pageSlug = "test-page")

    val debateNoId = Debate(guid = "?", posts = bodyPost::Nil)
    val pageStuffNoPeople = firstSiteDao.createPage(PageStuff.forNewPage(
      pagePath, debateNoId, publishDirectly = true))

    val pageWithPeople = firstSiteDao.loadPage(pageStuffNoPeople.id).getOrElse(
      fail("Error loading page with people"))

    // Approve the page.
    firstSiteDao.savePageActions(pageWithPeople, List(Review(
      "?", targetId = Page.BodyId, loginId = loginGrant.login.id,
      newIp = None, ctime = new ju.Date, approval = Some(Approval.Manual))))

    new Page {
      val url = firstSiteHost + pageStuffNoPeople.path.path
    }
  }

}


