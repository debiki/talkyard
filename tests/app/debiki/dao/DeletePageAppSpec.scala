/**
 * Copyright (c) 2016 Kaj Magnus Lindberg
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

package debiki.dao

import com.debiki.core._
import debiki.EdHttp.ResultException
import debiki._


class DeletePageAppSpec extends DaoAppSuite(disableScripts = true, disableBackgroundJobs = true) {

  "PagesDao can delete pages" - {
    var dao: SiteDao = null
    var admin: Participant = null

    lazy val forumId = dao.createForum(title = "Forum to delete", folder = "/", isForEmbCmts = false,
      Who(SystemUserId, browserIdData)).get.pagePath.thePageId

    lazy val discussionId = createPage(PageRole.Discussion, textAndHtmlMaker.testTitle("Title"),
      textAndHtmlMaker.testBody("Body text"), authorId = SystemUserId, browserIdData, dao)

    lazy val htmlPageId = createPage(PageRole.CustomHtmlPage, textAndHtmlMaker.testTitle("Title"),
      textAndHtmlMaker.testBody("Body text"), authorId = SystemUserId, browserIdData, dao)

    lazy val otherPageId = createPage(PageRole.Discussion, textAndHtmlMaker.testTitle("Title"),
      textAndHtmlMaker.testBody("Body text"), authorId = SystemUserId, browserIdData, dao)

    "prepare" in {
      globals.systemDao.getOrCreateFirstSite()
      dao = globals.siteDao(Site.FirstSiteId)
      admin = createPasswordOwner(s"dltr_admn", dao)
    }

    "admin can delete and undelete pages of all types" in {
      dao.getPageMeta(discussionId).get.deletedAt mustBe None
      dao.getPageMeta(forumId).get.deletedAt mustBe None
      dao.getPageMeta(htmlPageId).get.deletedAt mustBe None

      // Delete all pages.
      dao.deletePagesIfAuth(Seq(discussionId, forumId, htmlPageId),
        admin.id, browserIdData, undelete = false)

      // Verify marked as deleted.
      dao.getPageMeta(discussionId).get.deletedAt mustBe defined
      dao.getPageMeta(forumId).get.deletedAt mustBe defined
      dao.getPageMeta(htmlPageId).get.deletedAt mustBe defined
      dao.getPageMeta(otherPageId).get.deletedAt mustBe None

      // Undelete, verify no longer marked as deleted.
      dao.deletePagesIfAuth(Seq(discussionId, forumId, htmlPageId),
        admin.id, browserIdData, undelete = true)
      dao.getPageMeta(discussionId).get.deletedAt mustBe None
      dao.getPageMeta(forumId).get.deletedAt mustBe None
      dao.getPageMeta(htmlPageId).get.deletedAt mustBe None
    }

    "moderators may delete discussions" in {
      val moderator = createPasswordModerator(s"dltr_mod", dao)

      dao.deletePagesIfAuth(Seq(discussionId), moderator.id, browserIdData, undelete = false)
      dao.getPageMeta(discussionId).get.deletedAt mustBe defined

      dao.deletePagesIfAuth(Seq(discussionId), moderator.id, browserIdData, undelete = true)
      dao.getPageMeta(discussionId).get.deletedAt mustBe None

      intercept[ResultException] {
        dao.deletePagesIfAuth(Seq(forumId), moderator.id, browserIdData, undelete = false)
      }.getMessage must include("EsE5GKF23_")

      intercept[ResultException] {
        dao.deletePagesIfAuth(Seq(htmlPageId), moderator.id, browserIdData, undelete = false)
      }.getMessage must include("EsE5GKF23_")
    }

    "do nothing if page doesn't exist" in {
      val admin = createPasswordOwner(s"dltr_adm2", dao)
      val badPageId = "zzwwffpp"
      dao.deletePagesIfAuth(Seq(badPageId), admin.id, browserIdData, undelete = false)
      dao.getPageMeta(badPageId) mustBe None
    }

    "non-staff may not delete" in {
      val user = createPasswordUser(s"dltr_mbr", dao)
      val discussionId = createPage(PageRole.Discussion, textAndHtmlMaker.testTitle("Title"),
        textAndHtmlMaker.testBody("Body text"), authorId = SystemUserId, browserIdData, dao)
      intercept[ResultException] {
        dao.deletePagesIfAuth(Seq(discussionId), user.id, browserIdData, undelete = false)
      }.getMessage must include("EsE7YKP424_")
    }
  }

}
