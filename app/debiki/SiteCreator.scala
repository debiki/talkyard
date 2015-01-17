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
import controllers.CreatePageController
import debiki.dao.SiteDao
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


  sealed abstract class NewSiteType
  object NewSiteType {
    case object Forum extends NewSiteType
    case object Blog extends NewSiteType
    case object SimpleSite extends NewSiteType
    case object EmbeddedComments extends NewSiteType
  }


  /** Must be a valid host namme, not too long or too short (less than 6 chars),
    * no '.' and no leading or trailing '-'. See test suite in SiteCreatorSpec.
    */
  def isOkayWebsiteName(name: String): Boolean = {
    _OkWebsiteNameRegex matches name
  }

  private val _OkWebsiteNameRegex = """[a-z][a-z0-9\-]{4,38}[a-z0-9]""".r


  def createWebsite(
        siteType: NewSiteType,
        dao: SiteDao,
        creationDati: ju.Date,
        name: Option[String],
        host: Option[String],
        embeddingSiteUrl: Option[String],
        ownerIp: String,
        ownerIdentity: Option[Identity],
        ownerRole: User): Option[(Tenant, User)] = {

    name foreach { n => require(isOkayWebsiteName(n), "DwE18SHN6") }

    // CreateWebsite throws error if one creates too many websites
    // from the same IP.
    val (website, ownerAtNewSite) =
      dao.createWebsite(
        name = name, address = host, embeddingSiteUrl = embeddingSiteUrl,
        ownerIp = ownerIp,
        ownerIdentity = ownerIdentity, ownerRole = ownerRole) getOrElse {
      return None
    }

    // COULD try to do this in the same transaction as `createWebsite`?
    // -- This whole function could be rewritten/replaced to/with
    //      CreateSiteSystemDaoMixin.createSiteImpl() ?  in debiki-dao-pgsql
    val newWebsiteDao = Globals.siteDao(
      siteId = website.id, ip = ownerIp, roleId = None)

    val email = makeNewWebsiteEmail(website, siteType, ownerAtNewSite)
    newWebsiteDao.saveUnsentEmail(email)

    Globals.sendEmail(email, website.id)

    siteType match {
      case NewSiteType.EmbeddedComments =>
        // Need create nothing.
      case NewSiteType.Forum =>
        createBlogOrForum(newWebsiteDao, PageRole.Forum, creationDati)
      case NewSiteType.Blog =>
        createBlogOrForum(newWebsiteDao, PageRole.Blog, creationDati)
      case NewSiteType.SimpleSite =>
        createHomepage(newWebsiteDao, creationDati = creationDati)
    }

    Some((website, ownerAtNewSite))
  }


  private def makeNewWebsiteEmail(website: Tenant, siteType: NewSiteType, owner: User): Email = {
    val (body, subject) = siteType match {
      case NewSiteType.EmbeddedComments =>
        val body = views.html.createembeddedsite.welcomeEmail(website, owner.displayName).body
        val subject = o"""Embedded comments enabled for
          http://${website.embeddingSiteUrl getOrDie "DwE45GH0"}"""
        (body, subject)
      case _ =>
        val address = website.chost_!.address
        val body = views.html.createsite.welcomeEmail(address).body
        val subject = s"New Debiki website created: http://$address"
        (body, subject)
    }
    Email(EmailType.Notification, sendTo = owner.email, toUserId = Some(owner.id),
      subject = subject, bodyHtmlText = (emailId) => body)
  }


  /** Creates a blog or a forum, located at http://serveraddress/, that is,
    * the blog or forum becomes the homepage.
    */
  private def createBlogOrForum(newSiteDao: SiteDao, pageRole: PageRole, createdAt: ju.Date) {
    val pageId = newSiteDao.nextPageId()

    var actions = List(RawPostAction.forNewTitle(
      if (pageRole == PageRole.Blog) BlogTitle else ForumTitle,
      createdAt, SystemUser.UserIdData, Some(Approval.AuthoritativeUser)))
    if (pageRole == PageRole.Forum) {
      actions ::= RawPostAction.forNewPageBody(ForumBody, createdAt, PageRole.Forum,
        SystemUser.UserIdData, Some(Approval.AuthoritativeUser))
    }

    val pageParts = PageParts(pageId, rawActions = actions)
    val pageMeta = PageMeta.forNewPage(
      pageRole, SystemUser.User, pageParts, createdAt, publishDirectly = true)
    val pagePath = PagePath(newSiteDao.siteId, folder = "/",
      pageId = Some(pageId), showId = false, pageSlug = "")

    newSiteDao.createPage(Page(pageMeta, pagePath, ancestorIdsParentFirst = Nil, pageParts))
  }


  val BlogTitle = "Blog Title (click to edit)"

  val ForumTitle = "Forum Title (click to edit)"
  val ForumBody = i"""
      |Forum description here. What is this forum about?
      |
      |Click to edit. Select Improve in the menu that appears."""


  /**
   * Creates an empty page at /, with PageRole.Homepage, so I don't need
   * to tell users how to create a homepage. Instead, I create a default
   * empty homepage, and add a "Use this page as homepage" button,
   * so they can easily switch homepage.
   * If they make another page to the homepage, the default homepage
   * is automatically moved from / to /_old/default-homepage.
   */
  private def createHomepage(newWebsiteDao: SiteDao, creationDati: ju.Date) {
    val pageId = newWebsiteDao.nextPageId()
    val emptyPage = PageParts(pageId, people = SystemUser.Person)
    val pageMeta = PageMeta.forNewPage(
      PageRole.HomePage, SystemUser.User, emptyPage, creationDati, publishDirectly = true)
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
    val title = RawPostAction.forNewTitleBySystem(text = DefaultHomepageTitle, creationDati)
    newWebsiteDao.savePageActionsGenNotfsImpl(
      PageNoPath(emptyPage, ancestorIdsParentFirst = Nil, pageMeta), List(title))
  }

}
