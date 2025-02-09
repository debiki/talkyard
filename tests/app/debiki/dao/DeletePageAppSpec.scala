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

import scala.collection.Seq
import com.debiki.core._
import debiki.EdHttp.ResultException
import debiki._


class DeletePageAppSpec extends DaoAppSuite(disableScripts = true, disableBackgroundJobs = true) {

  "PagesDao can delete pages" - {
    var dao: SiteDao = null
    var admin: Participant = null

    lazy val forum: CreateForumResult =
      dao.createForum(title = "Forum to delete", folder = "/", isForEmbCmts = false,
            Who(SystemUserId, browserIdData)).get

    lazy val forumId: PageId = forum.pagePath.pageId

    lazy val discussionId = createPage(PageType.Discussion, textAndHtmlMaker.testTitle("Title"),
      textAndHtmlMaker.testBody("Body text"), authorId = SystemUserId, browserIdData, dao)

    lazy val htmlPageId = createPage(PageType.CustomHtmlPage, textAndHtmlMaker.testTitle("Title"),
      textAndHtmlMaker.testBody("Body text"), authorId = SystemUserId, browserIdData, dao)

    lazy val otherPageId = createPage(PageType.Discussion, textAndHtmlMaker.testTitle("Title"),
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
            Who(admin.trueId2, browserIdData), asAlias = None, undelete = false)

      // Verify marked as deleted.
      dao.getPageMeta(discussionId).get.deletedAt mustBe defined
      dao.getPageMeta(forumId).get.deletedAt mustBe defined
      dao.getPageMeta(htmlPageId).get.deletedAt mustBe defined
      dao.getPageMeta(otherPageId).get.deletedAt mustBe None

      // Undelete, verify no longer marked as deleted.
      dao.deletePagesIfAuth(Seq(discussionId, forumId, htmlPageId),
            Who(admin.trueId2, browserIdData), asAlias = None, undelete = true)
      dao.getPageMeta(discussionId).get.deletedAt mustBe None
      dao.getPageMeta(forumId).get.deletedAt mustBe None
      dao.getPageMeta(htmlPageId).get.deletedAt mustBe None
    }


    lazy val moderator = createPasswordModerator(s"dltr_mod", dao)

    "moderators cannot delete pages they cannot see — pages not in the forum yet" in {
      for (pageId <- Seq(discussionId, htmlPageId, otherPageId)) {
        intercept[ResultException] {
          dao.deletePagesIfAuth(
                Seq(pageId), Who(moderator.trueId2, browserIdData), None, undelete = false)
          dao.getPageMeta(discussionId).get.deletedAt mustBe defined
        }.getMessage must include("TyEM0SEEPG_")
      }
    }

    lazy val user = createPasswordUser(s"dltr_mbr", dao)

    "non-staff also may not delete pages they cannot see" in {
      intercept[ResultException] {
        dao.deletePagesIfAuth(
              Seq(discussionId), Who(user.trueId2, browserIdData), None, undelete = false)
      }.getMessage must include("TyEM0SEEPG_")
    }

    def moveToCat(pageId: PageId, catId: CatId): U = {
      val pageBefore = dao.getPageMeta(pageId).get
      val pageInCat = pageBefore.copy(categoryId = Some(catId))
      dao.writeTx { (tx, _) =>
        tx.updatePageMeta(pageInCat, oldMeta = pageBefore, markSectionPageStale = true)
      }
    }

    "An admin moves the pages into the forum staff cat, so mods can see them" in {
      moveToCat(discussionId, forum.staffCategoryId)
      moveToCat(forumId, forum.staffCategoryId)
      moveToCat(htmlPageId, forum.staffCategoryId)
      // But not other-page-id.
    }


    "now mods can delete discussions — they may now see them" - {
      "delete page" in {
        dao.deletePagesIfAuth(
              Seq(discussionId), Who(moderator.trueId2, browserIdData), None, undelete = false)
        dao.getPageMeta(discussionId).get.deletedAt mustBe defined
      }

      "undelete page" in {
        dao.deletePagesIfAuth(
              Seq(discussionId), Who(moderator.trueId2, browserIdData), None, undelete = true)
        dao.getPageMeta(discussionId).get.deletedAt mustBe None
      }

      "still cannot delete the *other* page, it's still not in the forum" in {
        intercept[ResultException] {
          dao.deletePagesIfAuth(
                Seq(otherPageId), Who(moderator.trueId2, browserIdData), None, undelete = false)
        }.getMessage must include("TyEM0SEEPG_")
      }

      "cannot delete forum" in {
        intercept[ResultException] {
          dao.deletePagesIfAuth(
                Seq(forumId), Who(moderator.trueId2, browserIdData), None, undelete = false)
        }.getMessage must include("EsE5GKF23_")
      }

      "cannot delete custom html page" in {
        intercept[ResultException] {
          dao.deletePagesIfAuth(
                Seq(htmlPageId), Who(moderator.trueId2, browserIdData), None, undelete = false)
        }.getMessage must include("EsE5GKF23_")
      }
    }

    "do nothing if page doesn't exist" in {
      val admin = createPasswordOwner(s"dltr_adm2", dao)
      val badPageId = "zzwwffpp"
      dao.deletePagesIfAuth(
            Seq(badPageId), Who(admin.trueId2, browserIdData), None, undelete = false)
      dao.getPageMeta(badPageId) mustBe None
    }

    "non-staff users still cannot see the pages — they're in the staff cat" in {
      intercept[ResultException] {
        dao.deletePagesIfAuth(
              Seq(discussionId), Who(user.trueId2, browserIdData), None, undelete = false)
      }.getMessage must include("TyEM0SEEPG_")
    }

    "An admin moves the disc page into a publ cat" in {
      moveToCat(discussionId, forum.defaultCategoryId)
    }

    "non-staff can now see it — but still may not delete it" in {
      intercept[ResultException] {
        dao.deletePagesIfAuth(
              Seq(discussionId), Who(user.trueId2, browserIdData), None, undelete = false)
      }.getMessage must include("TyEDELOTRSPG_")
    }

    "An admin sets the user as page author  TyTXAUT6920" in {
      TESTS_MISSING
    }

    "Now the user can delete the page" in {
      TESTS_MISSING
    }
  }

}
