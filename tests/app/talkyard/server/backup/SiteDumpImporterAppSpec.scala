/**
 * Copyright (c) 2019 Kaj Magnus Lindberg
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

package talkyard.server.backup

import com.debiki.core._
import com.debiki.core.Prelude._
import debiki.TextAndHtmlMaker
import debiki.dao._
import org.scalatest._


class SiteDumpImporterAppSpec extends DaoAppSuite(disableScripts = false) with DumpMaker {


  "SiteDumpImporter can" - {

    "import nothing into an empty site" - {
      var site: Site = null
      val siteName = "empty-5079267"

      "import" in {
        site = createSite(siteName)._1
        upsert(site.id, SiteBackup.empty)
      }

      "read back, it's empty" in {
        val dump = SiteBackupMaker(context = context).loadSiteDump(site.id)
        val expectedDump = SiteBackup.empty.copy(site = Some(SiteInclDetails(
          id = dump.theSite.id,
          pubId = dump.theSite.pubId,
          status = SiteStatus.Active,
          name = "site-" + siteName,
          createdAt = dump.theSite.createdAt,
          createdFromIp = Some("1.2.3.4"),
          creatorEmailAddress = None,
          nextPageId = 1,
          quotaLimitMbs = Some(100),
          hostnames = Vector(HostnameInclDetails(
            hostname = siteName, Hostname.RoleCanonical, addedAt = globals.now())),
          version = 1,
          numParticipants = 13,
        )))
        dump mustBe expectedDump
      }
    }


    "import one item of each type into an empty site" - {
      var site: Site = null
      val siteName = "one-of-each-2958395"

      var nextExpectedCategoryId_ = 0

      def nextExpectedCategoryId(): CategoryId = {
        nextExpectedCategoryId_ += 1
        nextExpectedCategoryId_
      }

      lazy val initialDumpToUpsert = SiteBackup.empty.copy(
        guests = Vector(GuestWithAllFields),
        guestEmailNotfPrefs = Map(
          // This will override GuestWithAllFields.emailNotfPrefs: (50525205)
          GuestWithAllFields.email -> EmailNotfPrefs.Receive),
        // users = Vector(UnapprovedUser), later
        categories = Vector(CategoryWithSectPageId333, CategoryWithSectPageId333SubCat),
        pages = Vector(PageMeta333),
        pagePaths = Vector(PagePathToPage333),
        posts = Vector(Page333TitlePost, Page333BodyPost),
        permsOnPages = Vector(MayAllPermsForCatWSectPageId333))

      val sectPageId = "1"

      // Temp imp ids > 2e9 + 1,2,3,4 ... converted to real ids 1,2,3,4 ....
      lazy val expectedDumpWithoutSiteMeta = initialDumpToUpsert.copy(
        guests = Vector(
          GuestWithAllFields.copy(
            id = -10,
            // This is from guestEmailNotfPrefs, and overrides the value in the Guest
            // instance imported above: (50525205)
            emailNotfPrefs = EmailNotfPrefs.Receive)),
        //users = Vector(
        // UnapprovedUser.copy(id = 100)), later
        categories = Vector(
          CategoryWithSectPageId333.copy(
            id = nextExpectedCategoryId(), sectionPageId = sectPageId, defaultSubCatId = Some(2)),
          CategoryWithSectPageId333SubCat.copy(
            id = nextExpectedCategoryId(), sectionPageId = sectPageId, parentId = Some(1))),
        pages = Vector(
          PageMeta333.copy(
            pageId = sectPageId,
            categoryId = Some(1),
            numPostsTotal = 2)),
        pagePaths = Vector(
          PagePathToPage333.copy(pageId = sectPageId)),
        posts = Vector(
          Page333TitlePost.copy(id = 1, pageId = sectPageId),
          Page333BodyPost.copy(id = 2, pageId = sectPageId)),
        permsOnPages = Vector(
          MayAllPermsForCatWSectPageId333.copy(
            id = 1,
            onCategoryId = Some(2))))

      var expectedDump: SiteBackup = null
      var actualDump: SiteBackup = null

      "import the items" in {
        site = createSite(siteName)._1
        upsert(site.id, initialDumpToUpsert)
      }

      "load / recreate dump from database" in {
        actualDump = SiteBackupMaker(context = context).loadSiteDump(site.id)
      }

      "now they're all there" in {
        expectedDump = expectedDumpWithoutSiteMeta.copy(
          site = Some(SiteInclDetails(
            id = actualDump.theSite.id,
            pubId = actualDump.theSite.pubId,
            status = SiteStatus.Active,
            name = "site-" + siteName,
            createdAt = actualDump.theSite.createdAt,
            createdFromIp = Some("1.2.3.4"),
            creatorEmailAddress = None,
            //numCategories = 2,
            numPages = 1,
            numPosts = 2,
            numPostTextBytes = actualDump.theSite.numPostTextBytes,
            nextPageId = 2,
            quotaLimitMbs = Some(100),
            hostnames = Vector(HostnameInclDetails(
              hostname = siteName, Hostname.RoleCanonical, addedAt = globals.now())),
            version = 1,
            numParticipants = 14)))
        actualDump mustBe expectedDump
      }

      "re-importing the dump has no effect" - {
        "import the same things, a 2nd time" in {
          upsert(site.id, initialDumpToUpsert)
        }

        "read back" in {
          actualDump = SiteBackupMaker(context = context).loadSiteDump(site.id)
        }

        "nothing changed" in {
          actualDump mustBe expectedDump
        }
      }

    }


    "re-import a dump with a new sub category, upserts the sub category" - {
      var site: Site = null
      val siteName = "re-imp-more-6094624"

      var expectedDump: SiteBackup = null
      var actualDump: SiteBackup = null
      var latestDumpToUpsert: SiteBackup = null

      lazy val rootCat = actualDump.categories.find(_.parentId.isEmpty) getOrDie "TyE305HSDRA"
      lazy val sectPage = actualDump.pages.headOption getOrDie "TyE5HKRT024R"

      lazy val initialDumpToUpsert = SiteBackup.empty.copy(
        categories = Vector(CategoryWithSectPageId333, CategoryWithSectPageId333SubCat),
        pages = Vector(PageMeta333))

      val expectedSectPageId = "1"

      lazy val expectedDumpWithoutSiteMeta = initialDumpToUpsert.copy(
        categories = Vector(
          CategoryWithSectPageId333.copy(
            id = 1, sectionPageId = expectedSectPageId, defaultSubCatId = Some(2)),
          CategoryWithSectPageId333SubCat.copy(
            id = 2, sectionPageId = expectedSectPageId, parentId = Some(1))),
        pages = Vector(
          PageMeta333.copy(
            pageId = expectedSectPageId,
            categoryId = Some(1),
            numPostsTotal = 0)))

      "import the items" in {
        site = createSite(siteName)._1
        upsert(site.id, initialDumpToUpsert)
      }

      "load / recreate dump from database" in {
        actualDump = SiteBackupMaker(context = context).loadSiteDump(site.id)
      }

      "now they're all there" in {
        expectedDump = expectedDumpWithoutSiteMeta.copy(
          site = Some(SiteInclDetails(
            id = actualDump.theSite.id,
            pubId = actualDump.theSite.pubId,
            status = SiteStatus.Active,
            name = "site-" + siteName,
            createdAt = actualDump.theSite.createdAt,
            createdFromIp = Some("1.2.3.4"),
            creatorEmailAddress = None,
            //numCategories = 2,
            numPages = 1,
            numPosts = 0,
            numPostTextBytes = actualDump.theSite.numPostTextBytes,
            nextPageId = 2,
            quotaLimitMbs = Some(100),
            hostnames = Vector(HostnameInclDetails(
              hostname = siteName, Hostname.RoleCanonical, addedAt = globals.now())),
            version = 1,
            numParticipants = 13)))
        actualDump mustBe expectedDump
      }

      lazy val newCat = makeCategory(
        LowestTempImpId + 1, sectionPageId = sectPage.pageId, parentId = Some(rootCat.id))
            .copy(extImpId = Some("additional_cat_ext_imp_id"))

      "add a sub category" in {
        // categories = initialDumpToUpsert.categories.toVector :+ newCat)
        upsert(site.id, SiteBackup.empty.copy(categories = Vector(newCat)))
      }

      "read back" in {
        actualDump = SiteBackupMaker(context = context).loadSiteDump(site.id)
      }

      "find the new sub cat" in {
        val newCatWithRealIds = newCat.copy(id = 3)
        expectedDump = expectedDump.copy(
          categories = expectedDump.categories :+ newCatWithRealIds)
        actualDump mustBe expectedDump
      }

    }


    def createSiteWithOneCatAndPage(hostname: String)
          : (Site, CreateForumResult, User, SiteDao) = {
      val (site, dao) = createSite(hostname)
      val owen = createPasswordOwner("owner_un", dao)
      val forum: CreateForumResult = dao.createForum(
          s"Forum $hostname", folder = "/", isForEmbCmts = true, Who(owen.id, browserIdData)
          ) getOrDie "TyE305RTG3"

      createPage(PageType.Discussion, textAndHtmlMaker.testTitle("Forum Title"),
        textAndHtmlMaker.testBody("Forum intro text."), SysbotUserId, browserIdData,
        dao, Some(forum.defaultCategoryId))

      (site, forum, owen, dao)
    }


    "Import new pages and replies" - {
      lazy val (site, forum, owen, dao) = createSiteWithOneCatAndPage("imp-pages-relpies")
      val upsertedPageExtId = "ups_ext_id"
      val upsertedPageAltId = "ups_alt_id"
      lazy val upsertedPageComplete = PageMeta333.copy(
        extImpId = Some(upsertedPageExtId),
        authorId = owen.id,
        pageType = PageType.Discussion)
      lazy val upsertedPageOnlyExtId = PageMeta333.copy(
        extImpId = Some(upsertedPageExtId))

      "create site" in {
        site // lazy creates it
      }

      "add a page with one reply" - {
        var patchToUpsert: SiteBackup = null

        "add the page and reply" in {
          // This binds extId "embedded_comments" with a temp in-patch id, in the site patch,
          // to the emb comments category with a real id in the database.
          // Later, when there's a PageMetaPatch class that can reference its category
          // by ext id (and not just internal real id), this dummy category won't be needed.
          val dummyCategory = makeCategory(
            CategoryWithSectPageId333.id,
            sectionPageId = forum.pagePath.pageId,
            defSubCat = Some(forum.defaultCategoryId)
            ).copy(extImpId = Some("embedded_comments"))

          patchToUpsert = SiteBackup.empty.copy(
            categories = Vector(dummyCategory),
            pages = Vector(upsertedPageComplete),
            pageIdsByAltIds = Map(upsertedPageAltId -> upsertedPageComplete.pageId),
            pagePaths = Vector(PagePathToPage333),
            posts =
                Vector(Page333TitlePost, Page333BodyPost, Page333Reply)
                .map(_.copy(
                  createdById = owen.id,
                  currentRevisionById = owen.id)))

          upsert(site.id, patchToUpsert)
        }

        "load the site contents, it looks ok" in {
          loadDumpCheckLooksOk()
        }

        "re-insert the patch" in {
          upsert(site.id, patchToUpsert)
        }

        "didn't change anything" in {
          loadDumpCheckLooksOk()
        }

        def loadDumpCheckLooksOk() {
          info("read back")
          val actualDump = SiteBackupMaker(context = context).loadSiteDump(site.id)

          info("find the new page")
          val defaultCatPages = actualDump.pages.filter(_.categoryId is forum.defaultCategoryId)
          val actualNewPage = defaultCatPages.find(_.authorId == owen.id) getOrDie "TyE306HMREDF25"

          info("it has the correct ext id")
          actualNewPage.extImpId mustBe Some(upsertedPageExtId)

          info("it's in the General category, together with the category descr page and the new page")
          // There're 3 pages in the category: the category description, the page
          // created via createPage() above, and the forum welcome topic.
          defaultCatPages.length mustBe 3
          defaultCatPages.find(_.pageId == actualNewPage.pageId) getOrDie "TyE507KSPG2"

          info("find the title, body and reply")
          val actualPosts = actualDump.posts.filter(_.pageId == actualNewPage.pageId)
          val actualTitle = actualPosts.find(_.nr == PageParts.TitleNr) getOrDie "TyE305KRBT01"
          val actualBody = actualPosts.find(_.nr == PageParts.BodyNr) getOrDie "TyE05KT6A01"
          val actualReply = actualPosts.find(_.nr == PageParts.FirstReplyNr) getOrDie "TyE6TKFG0501"
          actualPosts.length mustBe 3

          info("with the correct text contents")
          actualTitle.currentSource mustBe Page333TitlePost.currentSource
          actualBody.currentSource mustBe Page333BodyPost.currentSource
          actualReply.currentSource mustBe Page333Reply.currentSource

          info("those are te only posts with ext ids")
          val postsWithExtImpId = actualDump.posts.filter(_.extImpId.isDefined)
          postsWithExtImpId.length mustBe 3
        }
      }


      "add a reply to a page, via the page's ext id" - {
        var patchToUpsert: SiteBackup = null
        lazy val reply2 = Page333Reply.copy(extImpId = Some("reply_2_ext_id"))

        "import (upsert) a site patch with the reply" in {
          patchToUpsert = SiteBackup.empty.copy(
            pages = Vector(
              // Needed so the new reply has a page to reference in the patch.
              upsertedPageOnlyExtId),
            //pageIdsByAltIds = Map(upsertedPageAltId -> PageMeta333.pageId),
            posts =
              Vector(
                // The body post is needed (309360327), so the reply has a parent post
                // to reference, in the patch. Later, with a PostPatch that can reference
                // a parent page via ext id, then, can remove the body post here?
                Page333BodyPost, reply2).map(_.copy(
                  createdById = owen.id,
                  currentRevisionById = owen.id)))

          upsert(site.id, patchToUpsert)
        }

        "load the site contents, it looks ok" in {
          loadDumpCheckLooksOk()
        }

        "re-upsert the new reply" in {
          upsert(site.id, patchToUpsert)
        }

        "didn't change anything" in {
          loadDumpCheckLooksOk()
        }

        def loadDumpCheckLooksOk() {
          info("read back")
          val actualDump = SiteBackupMaker(context = context).loadSiteDump(site.id)

          info("find the page")
          val actualNewPage = actualDump.pages.find(_.extImpId is upsertedPageExtId
              ) getOrDie "TyE6PKDHAFF05"

          info("find the title, body, old reply and new reply")
          val actualPosts = actualDump.posts.filter(_.pageId == actualNewPage.pageId)
          actualPosts.find(_.nr == PageParts.TitleNr) getOrDie "TyE305KRBT02"
          actualPosts.find(_.nr == PageParts.BodyNr) getOrDie "TyE05KT6A02"
          actualPosts.find(_.nr == PageParts.FirstReplyNr) getOrDie "TyE6TKFG0502"
          val actualReply = actualPosts.find(_.nr == PageParts.FirstReplyNr + 1) getOrDie "TyE5AP20Z"
          actualPosts.length mustBe 4

          info("with the correct text contents")
          actualReply.currentSource mustBe reply2.currentSource

          info("those are te only posts with ext ids")
          val postsWithExtImpId = actualDump.posts.filter(_.extImpId.isDefined)
          postsWithExtImpId.length mustBe 4
        }
      }


      /*  no, this will lookup via ext id instead :- /
      "Add more replies to the page, via page alt id" - {
        var patchToUpsert: SiteBackup = null
        lazy val reply3 = Page333Reply.copy(extImpId = Some("reply_3_alt_id"))

        "import (upsert) a site patch with the reply" in {
          patchToUpsert = SiteBackup.empty.copy(
            pages = Vector(
              // Needed so the new reply has a page to reference in the patch.
              upsertedPageOnlyExtId),
            pageIdsByAltIds = Map(upsertedPageAltId -> upsertedPageOnlyExtId.pageId),
            posts =
              Vector(
                // Body post is needed, see (309360327).
                Page333BodyPost, reply3).map(_.copy(
                  createdById = owen.id,
                  currentRevisionById = owen.id)))

          upsert(site.id, patchToUpsert)
        }

        "load the site contents, it looks ok" in {
          loadDumpCheckLooksOk()
        }

        "re-upsert the new reply" in {
          upsert(site.id, patchToUpsert)
        }

        "didn't change anything" in {
          loadDumpCheckLooksOk()
        }

        def loadDumpCheckLooksOk() {
          info("read back")
          val actualDump = SiteBackupMaker(context = context).loadSiteDump(site.id)

          info("find the page, ext id shouldn't have changed")
          val actualNewPage = actualDump.pages.find(_.extImpId is upsertedPageExtId
                ) getOrDie "TyE5KBRT305"

          info("find the title, body, old reply, reply via ext id, and via alt id")
          val actualPosts = actualDump.posts.filter(_.pageId == actualNewPage.pageId)
          actualPosts.find(_.nr == PageParts.TitleNr) getOrDie "TyE305KRBT03"
          actualPosts.find(_.nr == PageParts.BodyNr) getOrDie "TyE05KT6A03"
          actualPosts.find(_.nr == PageParts.FirstReplyNr) getOrDie "TyE6TKFG0503"
          actualPosts.find(_.nr == PageParts.FirstReplyNr + 1) getOrDie "TyE306RKKT4"
          val actualReply = actualPosts.find(_.nr == PageParts.FirstReplyNr + 2) getOrDie "TyE0HBJSR"
          actualPosts.length mustBe 5

          info("with the correct text contents")
          actualReply.currentSource mustBe reply3.currentSource

          info("those are te only posts with ext ids")
          val postsWithExtImpId = actualDump.posts.filter(_.extImpId.isDefined)
          postsWithExtImpId.length mustBe 5
        }
      }*/


      "Reject a page with mismatching ext id or alt id" - {
      }
    }

  }

}
