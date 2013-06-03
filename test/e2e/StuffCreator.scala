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

package test.e2e

import com.debiki.v0.Prelude._
import com.debiki.v0._
import debiki.Debiki
import java.{util => ju}
import org.scalatest.Assertions
import org.scalatest.selenium.WebBrowser
import play.api.test.Helpers.testServerPort
import com.debiki.v0.{PostActionPayload => PAP}
import PageParts.UnassignedId


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

    val identity = IdentityOpenId(id = "?i",
      userId = "?", oidEndpoint = "http://test-endpoint.com", oidVersion = "", oidRealm = "",
      oidClaimedId = "StuffCreatorClaimedId", oidOpLocalId = "StuffCreatorLocalId",
      firstName = "Stuff-Creator", email = "stuff-creator@example.com", country = "")

    val loginReq = LoginRequest(login, identity)
    val loginGrant = firstSiteDao.saveLogin(loginReq)

    val postTemplate = PostActionDto.forNewPost(
      id = UnassignedId, parentPostId = PageParts.BodyId, creationDati = new ju.Date,
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

    val firstSite = Debiki.systemDao.createFirstSite(new FirstSiteData {
      val name = "FirstSite"
      val address = firstSiteHost
      val https = TenantHost.HttpsNone
      val pagesToCreate = Nil
    })

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

    createCodePage(firstSiteId, "/", "_site.conf", i"""
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


  class TestPage(val url: String, val id: String) extends WebBrowser.Page


  /** Creates a test page in site `firstSiteId`.
    */
  def createTestPage(
        pageRole: PageRole,
        pageSlug: String = "test-page",
        title: String,
        body: Option[String]): TestPage = {

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

    new TestPage(
      url = firstSiteHost + pageStuffNoPeople.path.path,
      id = pageStuffNoPeople.path.pageId.get)
  }

}


