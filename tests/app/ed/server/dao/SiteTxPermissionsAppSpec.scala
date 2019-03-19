/**
 * Copyright (C) 2017 Kaj Magnus Lindberg
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

package ed.server.dao

import com.debiki.core._
import debiki._
import debiki.dao.{CreateForumResult, DaoAppSuite, SiteDao}


class SiteTxPermissionsAppSpec extends DaoAppSuite {

  // Everyone's permissions on the General category,
  // staff's permissions on the General category,
  // everyone's permissions on the Sample-Topics category,
  // staff's permissions on the Sample-Topics category,
  // staff's permissions on the Staff category,
  // = 5
  val NumDefaultForumPermissions = 5


  "SiteTransaction can handle PermsOnPages" - {
      var dao: SiteDao = null
      var admin: Participant = null
      var userA: Participant = null
      var userB: Participant = null
      var guest: Participant = null
      var pageAId: PageId = null
      var pageBId: PageId = null
      var pageAPost2: Post = null
      var createForumResult: CreateForumResult = null

      var allPermsWholeSite: PermsOnPages = null
      var permsOnCat: PermsOnPages = null
      var permsOnPage: PermsOnPages = null
      var permsOnPost: PermsOnPages = null


      "prepare: create site and users" in {
        globals.systemDao.getOrCreateFirstSite()
        dao = globals.siteDao(Site.FirstSiteId)

        admin = createPasswordOwner(s"poc_adm", dao)
        userA = createPasswordUser(s"poc_u_a", dao)
        userB = createPasswordUser(s"poc_u_b", dao)
        guest = dao.loginAsGuest(GuestLoginAttempt(ip = "2.2.2.2", globals.now().toJavaDate,
          name = "Guestellina", guestBrowserId = "guestellinacookie"))
      }


      "find no perms when there are none" in {
        dao.readOnlyTransaction { transaction =>
          val permsLoaded = transaction.loadPermsOnPages()
          permsLoaded.length mustBe 0
        }
      }


      "prepare: create forum and pages" in {
        createForumResult = dao.createForum(title = "PermsOnPages Forum", folder = "/",
          isForEmbCmts = false, Who(admin.id, browserIdData)).get

        pageAId = createPage(PageType.Discussion, textAndHtmlMaker.forTitle("Page Title XY 12 AB"),
          textAndHtmlMaker.forBodyOrComment("Page body."), authorId = admin.id, browserIdData,
          dao, anyCategoryId = None)
        pageAPost2 = reply(admin.id, pageAId, s"Post 2")(dao)
        reply(admin.id, pageAId, s"Post 3")(dao)
        reply(admin.id, pageAId, s"Post 4")(dao)

        pageBId = createPage(PageType.Discussion, textAndHtmlMaker.forTitle("Other Page Title"),
          textAndHtmlMaker.forBodyOrComment("Other page body."), authorId = admin.id, browserIdData,
          dao, anyCategoryId = None)
        reply(admin.id, pageBId, s"Post 2")(dao)
      }


      "load and save PermsOnPages" in {
        dao.readWriteTransaction { transaction =>
          info("save and load whole site perms")

          val allPermsWholeSiteNoId = PermsOnPages(
            id = NoPermissionId,
            forPeopleId = userA.id,
            onWholeSite = Some(true),
            onCategoryId = None,
            onPageId = None,
            onPostId = None,
            onTagId = None,
            mayEditPage = Some(true),
            mayEditComment = Some(true),
            mayEditWiki = Some(true),
            mayDeletePage = Some(true),
            mayDeleteComment = Some(true),
            mayCreatePage = Some(true),
            mayPostComment = Some(true),
            maySee = Some(true))

          allPermsWholeSite = transaction.insertPermsOnPages(allPermsWholeSiteNoId)
          allPermsWholeSiteNoId.copy(id = allPermsWholeSite.id) mustBe allPermsWholeSite

          var permsLoaded = transaction.loadPermsOnPages()
          permsLoaded must contain(allPermsWholeSite)
          permsLoaded.length mustBe (1 + NumDefaultForumPermissions)

          info("save and load category perms")

          val permsOnCatNoId = PermsOnPages(
            id = NoPermissionId,
            forPeopleId = userA.id,
            onWholeSite = None,
            onCategoryId = Some(createForumResult.defaultCategoryId),
            onPageId = None,
            onPostId = None,
            onTagId = None,
            mayEditPage = Some(true),
            mayEditComment = None,
            mayEditWiki = None,
            mayDeletePage = Some(true),
            mayDeleteComment = None,
            mayCreatePage = Some(true),
            mayPostComment = None,
            maySee = Some(true))

          permsOnCat = transaction.insertPermsOnPages(permsOnCatNoId)
          permsOnCatNoId.copy(id = permsOnCat.id) mustBe permsOnCat

          permsLoaded = transaction.loadPermsOnPages()
          permsLoaded must contain(allPermsWholeSite)
          permsLoaded must contain(permsOnCat)
          permsLoaded.length mustBe (2 + NumDefaultForumPermissions)

          info("save and load page perms")

          val permsOnPageNoId = PermsOnPages(
            id = NoPermissionId,
            forPeopleId = userA.id,
            onWholeSite = None,
            onCategoryId = None,
            onPageId = Some(pageAId),
            onPostId = None,
            onTagId = None,
            // Let's invert all perms, in comparison to the perms-on-category above.
            mayEditPage = None,
            mayEditComment = Some(true),
            mayEditWiki = Some(true),
            mayDeletePage = None,
            mayDeleteComment = Some(true),
            mayCreatePage = None,
            mayPostComment = Some(true),
            maySee = None)

          permsOnPage = transaction.insertPermsOnPages(permsOnPageNoId)
          permsOnPageNoId.copy(id = permsOnPage.id) mustBe permsOnPage

          permsLoaded = transaction.loadPermsOnPages()
          permsLoaded must contain(allPermsWholeSite)
          permsLoaded must contain(permsOnCat)
          permsLoaded must contain(permsOnPage)
          permsLoaded.length mustBe (3 + NumDefaultForumPermissions)

          info("save and load post perms")

          val permsOnPostNoId = PermsOnPages(
            id = NoPermissionId,
            forPeopleId = userA.id,
            onWholeSite = None,
            onCategoryId = None,
            onPageId = None,
            onPostId = Some(pageAPost2.id),
            onTagId = None,
            mayEditPage = Some(true),
            mayEditComment = Some(true),
            mayEditWiki = Some(true),
            mayDeletePage = Some(true),
            mayDeleteComment = None,
            mayCreatePage = None,
            mayPostComment = None,
            maySee = Some(true))

          permsOnPost = transaction.insertPermsOnPages(permsOnPostNoId)
          permsOnPostNoId.copy(id = permsOnPost.id) mustBe permsOnPost

          permsLoaded = transaction.loadPermsOnPages()
          permsLoaded must contain(allPermsWholeSite)
          permsLoaded must contain(permsOnCat)
          permsLoaded must contain(permsOnPage)
          permsLoaded must contain(permsOnPost)
          permsLoaded.length mustBe (4 + NumDefaultForumPermissions)

          // Perms on a tag: Later.
        }
      }


      "won't save dupl perms" in {
        val wholeSitePerms = PermsOnPages(
          id = NoPermissionId,
          forPeopleId = userA.id,
          onWholeSite = Some(true),
          onCategoryId = None,
          onPageId = None,
          onPostId = None,
          onTagId = None,
          mayEditPage = Some(true),
          mayEditComment = Some(true),
          mayEditWiki = Some(true),
          mayDeletePage = Some(true),
          mayDeleteComment = Some(true),
          mayCreatePage = Some(true),
          mayPostComment = Some(true),
          maySee = Some(true))

        info("for whole site")
        dao.readWriteTransaction { transaction =>
          intercept[Exception] {
            transaction.insertPermsOnPages(wholeSitePerms)
          }
          // Rollback, because intercept[] above caught the SQL exception so
          // dao.readWriteTransaction() will otherwise attempt to commit.
          transaction.rollback()
        }

        info("for category")
        dao.readWriteTransaction { transaction =>
          intercept[Exception] {
            transaction.insertPermsOnPages(
              wholeSitePerms.copy(onWholeSite = None,
                onCategoryId = Some(createForumResult.defaultCategoryId)))
          }
          transaction.rollback()
        }

        info("for page")
        dao.readWriteTransaction { transaction =>
          intercept[Exception] {
            transaction.insertPermsOnPages(
              wholeSitePerms.copy(onWholeSite = None, onPageId = Some(pageAId)))
          }
          transaction.rollback()
        }

        info("for post")
        dao.readWriteTransaction { transaction =>
          intercept[Exception] {
            transaction.insertPermsOnPages(
              wholeSitePerms.copy(onWholeSite = None, onPostId = Some(pageAPost2.id)))
          }
          transaction.rollback()
        }

        // Later:
        // info("for tag")
      }


      "can delete perms" in {
        dao.readWriteTransaction { transaction =>
          transaction.deletePermsOnPages(Seq(allPermsWholeSite.id, permsOnPage.id))
          val permsLoaded = transaction.loadPermsOnPages()
          // allPermsWholeSite — gone
          permsLoaded must contain(permsOnCat)
          // permsOnPage — gone
          permsLoaded must contain(permsOnPost)
          permsLoaded.length mustBe (2 + NumDefaultForumPermissions)
        }
      }
  }

}
