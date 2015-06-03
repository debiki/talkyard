/**
 * Copyright (C) 2013 Kaj Magnus Lindberg (born 1979)
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

package test.e2e.code

import com.debiki.core._
import com.debiki.core.Prelude._
import com.debiki.core.{PostActionPayload => PAP}
import debiki.Globals
import java.{util => ju}
import org.scalatest.Assertions
import org.scalatest.selenium.WebBrowser
import play.api.test.Helpers.testServerPort
import PageParts.UnassignedId


/**
 * A specification for browser end-to-end/integration tests.
 */
trait StuffCreator {


  /** A test site that's used for most tests. Do not use "localhost" because
    * Chrome silently refuses to set cookies for "localhost", causing tests
    * to fail later on with weird errors, like "not logged in".
    */
  def firstSiteHost = s"127.0.0.1:$testServerPort"


  /** The parent domain of new sites.
    *
    * When testing the creation of new sites, "localhost" must (?) be used,
    * not 127.0.0.1, so the new site address can be set to "test-site-1.localhost",
    * rather than "test-site-1.127.0.0.1". (Also see 'firstSiteHost' above.)
    */
  def newSiteDomain = {
    firstSiteOrigin // tempoarary fix to ensure site created in database
    s"localhost:$testServerPort"
  }


  val DefaultBackgroundColor = "rgba(255, 248, 220, 1)" // that's cornsilk


  def ensureFirstSiteCreated() {
    firstSiteId
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
    Globals.systemDao.lookupTenant("http", firstSiteHost) match {
      case FoundNothing =>
        createFirstSite()
      case FoundChost(siteId) =>
        (siteId, "http://" + firstSiteHost)
      case _ => assErr("DwE26kbSF7")
    }
  }


  lazy val firstSiteDao = Globals.siteDao(firstSiteId)


  /**
   * A loginGrant for a certain user that creates all stuff.
   */
  private lazy val (loginGrant: LoginGrant, postTemplate: RawPostAction[PAP.CreatePost]) = {

    val loginAttempt = OpenIdLoginAttempt(ip = "1.1.1.1",
      date = new ju.Date, openIdDetails = OpenIdDetails(
      oidEndpoint = "http://test-endpoint.com", oidVersion = "", oidRealm = "",
      oidClaimedId = "StuffCreatorClaimedId", oidOpLocalId = "StuffCreatorLocalId",
      firstName = "Stuff-Creator", email = Some("stuff-creator@example.com"), country = ""))

    val loginGrant = firstSiteDao.tryLogin(loginAttempt)

    val postTemplate = RawPostAction.forNewPost(
      id = UnassignedId, parentPostId = None, creationDati = new ju.Date,
      userIdData = UserIdData.newTest(userId = loginGrant.user.id),
      text = "", approval = Some(Approval.AuthoritativeUser))

    (loginGrant, postTemplate)
  }


  /**
   * Creates a `localhost` website, from which creation of other websites
   * is allowed.
   *
   * Returns (firstSiteId, firstSiteOrigin).
   */
  private def createFirstSite(): (String, String) = {

    val firstSite = ??? /* Globals.systemDao.createFirstSite(new FirstSiteData {
      val name = "FirstSite"
      val address = firstSiteHost
      val https = TenantHost.HttpsNone
      val pagesToCreate = Nil
      // Some E2E tests create embedded discussions, but that requires an embedding site URL.
      override val embeddingSiteUrl = Some("http://mycomputer:8080")
    }) */

    // Make the site accessible via "localhost": (in addition to 127.0.0.1)
    firstSiteDao.addTenantHost(
      SiteHost(newSiteDomain, SiteHost.RoleDuplicate, SiteHost.HttpsNone))

    // Create ./themes/example/theme.conf and ./themes/example/theme.css,
    // referred to by the new site config page.
    createCodePage(firstSiteId, "/themes/example/", "theme.conf", i"""
      |asset-bundles:
      |  styles.css:
      |    - http://$newSiteDomain/themes/example/theme.css
      |    - /themes/local/theme.css, optional
      |""")

    createCodePage(firstSiteId, "/themes/example/", "theme.css", i"""
      |body {
      |  background: $DefaultBackgroundColor !important;
      |}
      |""")

    createCodePage(firstSiteId, "/", "_site.conf", i"""
          |new-site-domain: $newSiteDomain
          |new-site-terms-of-use: /hosting/terms-of-service
          |new-site-privacy-policy: /hosting/privacy-policy
          |new-site-config-page-text: |
          |  extend: http://$newSiteDomain/themes/example/theme.conf
          |""")

    ??? // (firstSite.id, "http://" + firstSiteHost)
  }


  private def createCodePage(siteId: String, folder: String, slug: String, text: String) {
    val body = RawPostAction.copyCreatePost(postTemplate, id = PageParts.BodyId, text = text)
    val pagePath = PagePath(
      firstSiteId, folder, pageId = None, showId = false, pageSlug = slug)
    val page = PageParts(guid = "?", rawActions = body::Nil)
    firstSiteDao.createPage(Page.newPage(
      PageRole.WebPage, pagePath, page, publishDirectly = true, author = loginGrant.user))
  }


  class TestPage(val url: String, val id: String) extends WebBrowser.Page


  /** Creates a test page in site `firstSiteId`.
    */
  def createTestPage(
        pageRole: PageRole,
        pageSlug: String = "test-page",
        title: String,
        body: Option[String]): TestPage = {

    ??? /*  createPage gone, loadPageParts gone.
    val titlePost = RawPostAction.copyCreatePost(postTemplate,
      id = PageParts.TitleId, text = title)

    val bodyPost = body map { text =>
      RawPostAction.copyCreatePost(postTemplate, id = PageParts.BodyId, text = text)
    }

    val pagePath = PagePath(
      firstSiteId, "/", pageId = None, showId = true, pageSlug = pageSlug)

    val debateNoId = PageParts(guid = "?", rawActions = titlePost :: bodyPost.toList)
    val pageStuffNoPeople = firstSiteDao.createPage(Page.newPage(
      pageRole, pagePath, debateNoId, publishDirectly = true, author = loginGrant.user))

    val pageWithPeople = firstSiteDao.loadPageParts(pageStuffNoPeople.id).getOrElse(
      assErr("DwE381kK0", "Error loading page with people"))

    new TestPage(
      url = "http://" + firstSiteHost + pageStuffNoPeople.path.value,
      id = pageStuffNoPeople.path.pageId.get)
    */
  }

}


