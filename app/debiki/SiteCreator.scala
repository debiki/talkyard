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

package debiki

import com.debiki.core._
import com.debiki.core.Prelude._
import controllers.AppCreatePage
import debiki.dao.{SiteDao, ConfigValueDao}
import java.{util => ju}



/** Creates new websites.
  *
  * If a forum or blog is to be created, creates it at http://server-address/.
  * and nothing else.
  *
  * If a simple website is to be created, creates a homepage at http://server-address/,
  * and nothing else.
  */
object SiteCreator {

  val DefaultHomepageTitle = "Default Homepage (click to edit)"

  object ConfValNames {
    val NewSiteConfigText = "new-site-config-page-text"
    val NewSiteDomain = "new-site-domain"
  }


  sealed abstract class NewSiteType
  object NewSiteType {
    case object Forum extends NewSiteType
    case object Blog extends NewSiteType
    case object SimpleSite extends NewSiteType
  }


  /** Must be a valid host namme, not too long or too short (less than 6 chars),
    * no '.' and no leading or trailing '-'. See test suite in
    * AppCreateWebsiteSpec.
    */
  def isOkayWebsiteName(name: String): Boolean = {
    _OkWebsiteNameRegex matches name
  }

  private val _OkWebsiteNameRegex = """[a-z][a-z0-9\-]{4,38}[a-z0-9]""".r


  def createWebsite(
        siteType: NewSiteType,
        dao: SiteDao,
        creationDati: ju.Date,
        name: String,
        host: String,
        ownerIp: String,
        ownerLoginId: String,
        ownerIdentity: IdentityOpenId,
        ownerRole: User): Option[(Tenant, User)] = {

    require(isOkayWebsiteName(name))

    // CreateWebsite throws error if one creates too many websites
    // from the same IP.
    val newSiteAndOwner = dao.createWebsite(
      name = name, address = host, ownerIp = ownerIp, ownerLoginId = ownerLoginId,
      ownerIdentity = ownerIdentity, ownerRole = ownerRole)

    newSiteAndOwner match {
      case Some((website, ownerAtNewSite)) =>
        // COULD try to do this in the same transaction as `createWebsite`?
        // -- This whole function could be rewritten/replaced to/with
        //      CreateSiteSystemDaoMixin.createSiteImpl() ?  in debiki-dao-pgsql
        val newWebsiteDao = Globals.siteDao(
          siteId = website.id, ip = ownerIp, roleId = None)

        val email = makeNewWebsiteEmail(website, ownerAtNewSite)
        newWebsiteDao.saveUnsentEmail(email)

        Globals.sendEmail(email, website.id)

        val newSiteConfigText = dao.loadWebsiteConfig().getText(
          ConfValNames.NewSiteConfigText) getOrDie "DwE74Vf9"

        newWebsiteDao.createPage(makeConfigPage(
          newSiteConfigText, siteId = website.id, creationDati = creationDati,
          path = s"/${ConfigValueDao.WebsiteConfigPageSlug}"))

        createHomepage(newWebsiteDao, creationDati = creationDati)

        newSiteAndOwner

      case None =>
        None
    }
  }


  private def makeNewWebsiteEmail(website: Tenant, owner: User): Email = {
    val address = website.chost_!.address
    val message = views.html.createsite.welcomeEmail(address).body
    Email(sendTo = owner.email,
      subject = s"New Debiki website created, here: http://$address",
      bodyHtmlText = message)
  }


  def makeConfigPage(text: String, siteId: String, creationDati: ju.Date, path: String)
        : Page = {
    val pageId = AppCreatePage.generateNewPageId()
    val pageBody = PostActionDto.forNewPageBodyBySystem(
      text, creationDati, PageRole.Code)
    val actions = PageParts(pageId, SystemUser.Person, actionDtos = List(pageBody))
    val parsedPagePath = PagePath.fromUrlPath(siteId, path = path) match {
      case PagePath.Parsed.Good(pagePath) if !pagePath.showId => pagePath
      case x => assErr("DwE7Bfh2", s"Bad hardcoded config page path: $path")
    }
    Page(
      PageMeta.forNewPage(
        PageRole.Code, SystemUser.User, actions, creationDati, publishDirectly = true),
      PagePath(siteId, folder = parsedPagePath.folder,
        pageId = Some(pageId), showId = false, pageSlug = parsedPagePath.pageSlug),
      ancestorIdsParentFirst = Nil,
      actions)
  }


  /**
   * Creates an empty page at /, with PageRole.Homepage, so I don't need
   * to tell users how to create a homepage. Instead, I create a default
   * empty homepage, and add a "Use this page as homepage" button,
   * so they can easily switch homepage.
   * If they make another page to the homepage, the default homepage
   * is automatically moved from / to /_old/default-homepage.
   */
  private def createHomepage(newWebsiteDao: SiteDao, creationDati: ju.Date) {
    val pageId = AppCreatePage.generateNewPageId()
    val emptyPage = PageParts(pageId, SystemUser.Person)
    val pageMeta = PageMeta.forNewPage(
      PageRole.Generic, SystemUser.User, emptyPage, creationDati, publishDirectly = true)
    val oldPath = PagePath(newWebsiteDao.siteId, folder = "/_old/",
      pageId = Some(pageId), showId = false, pageSlug = "default-homepage")

    // First create the homepage at '/_old/default-homepage'.
    // Then change its location to '/'. If the admin later on lets
    // another page be the homepage, then '/' would be overwritten by the
    // new homepage. The old path to the oridinal homepage will then be
    // activated again.
    newWebsiteDao.createPage(Page(pageMeta, oldPath, ancestorIdsParentFirst = Nil, emptyPage))
    newWebsiteDao.moveRenamePage(pageId, newFolder = Some("/"), newSlug = Some(""))

    // Set homepage title.
    val title = PostActionDto.forNewTitleBySystem(text = DefaultHomepageTitle, creationDati)
    newWebsiteDao.savePageActionsGenNotfsImpl(
      PageNoPath(emptyPage, ancestorIdsParentFirst = Nil, pageMeta), List(title))
  }

}
