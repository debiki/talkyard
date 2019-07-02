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
import debiki.dao.DaoAppSuite
import org.scalatest._


class SiteDumpImporterAppSpec extends DaoAppSuite(disableScripts = false) with DumpMaker {


  "SiteDumpImporter can" - {

    "import nothing into an empty site" - {
      var site: Site = null
      val siteName = "empty-5079267"

      "import" in {
        site = createSite(siteName)
        upsert(site.id, SiteBackup.empty)
      }

      "read back, it's empty" in {
        val dump = SiteBackupMaker(context = context).loadSiteDump(site.id)
        val expectedDump = SiteBackup.empty.copy(site = Some(SiteInclDetails(
          id = dump.theSite.id,
          pubId = dump.theSite.pubId,
          status = SiteStatus.Active,
          name = "imp-test-" + siteName,
          createdAt = dump.theSite.createdAt,
          createdFromIp = Some("1.2.3.4"),
          creatorEmailAddress = None,
          nextPageId = 1,
          quotaLimitMbs = Some(100),
          hostnames = Vector(HostnameInclDetails(
            hostname = "imp-test-" + siteName, Hostname.RoleCanonical, addedAt = globals.now())),
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
        site = createSite(siteName)
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
            name = "imp-test-" + siteName,
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
              hostname = "imp-test-" + siteName, Hostname.RoleCanonical, addedAt = globals.now())),
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
        site = createSite(siteName)
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
            name = "imp-test-" + siteName,
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
              hostname = "imp-test-" + siteName, Hostname.RoleCanonical, addedAt = globals.now())),
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


  }

}
