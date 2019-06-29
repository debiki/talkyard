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

import java.io.RandomAccessFile
import com.debiki.core._
import com.debiki.core.Prelude._
import debiki.EdHttp.ResultException
import debiki.dao.DaoAppSuite
import org.scalatest._
import java.{io => jio}


class SiteDumpImporterAppSpec extends DaoAppSuite(disableScripts = false) {


  def createSite(id: String): Site = {
    globals.systemDao.createAdditionalSite(
      pubId = s"imptest_$id", name = s"imp-test-$id", status = SiteStatus.Active,
      hostname = Some(s"imp-test-$id"),
      embeddingSiteUrl = None, organizationName = s"Imp Test Org $id",
      creatorId = SystemUserId, // not in use when createdFromSiteId is None
      browserIdData, isTestSiteOkayToDelete = true, skipMaxSitesCheck = true,
      deleteOldSite = false, pricePlan = "Unknown", createdFromSiteId = None)
  }


  def upsert(siteId: SiteId, dump: SiteBackup) {
    val importer = SiteBackupImporterExporter(globals)
    importer.upsertIntoExistingSite(siteId, dump, browserIdData)
  }


  val FirstGuestTempImpId: UserId = - LowestTempImpId - 1

  lazy val GuestWithAllFields = Guest(
    id = FirstGuestTempImpId,
    extImpId = Some(s"guest_temp_imp_id_$FirstGuestTempImpId"),
    createdAt = globals.now(),
    guestName = "Gräddelina Guest",
    guestBrowserId = Some("guest-br-id"), email = "guestemail@x.co",
    emailNotfPrefs = EmailNotfPrefs.Receive)

  lazy val UnapprovedUser =
    UserInclDetails(
      id = LowestTempImpId + 1,
      extImpId = Some(s"user-ext-imp-id-${LowestTempImpId + 1}"),
      externalId = Some("user-ext-sso-id-101"),
      fullName = Some(s"User temp imp id ${LowestTempImpId + 1} Full Name"),
      username = "usr_tid_2e9p1_usrnme",
      createdAt = globals.now(),
      isApproved = None,
      reviewedAt = None,
      reviewedById = None,
      primaryEmailAddress = "user-101@x.co",
      emailNotfPrefs = EmailNotfPrefs.Receive)

  val PageTempImpId = "2000000333"

  lazy val CategoryWithSectPageId333 = Category(
    id = LowestTempImpId + 1,
    extImpId = Some(s"cat-w-ext-imp-id-${LowestTempImpId + 1}"),
    sectionPageId = PageTempImpId,
    parentId = None,
    defaultSubCatId = Some(2),
    name = "CategoryWithSectPageId333",
    slug = s"category-with-sect-page-id-${PageTempImpId}",
    position = 1,
    description = Some("Description of CategoryWithSectPageId333"),
    newTopicTypes = Vector(PageType.Discussion),
    unlistCategory = false,
    unlistTopics = false,
    includeInSummaries = IncludeInSummaries.Default,
    createdAt = globals.now().toJavaDate,
    updatedAt = globals.now().toJavaDate)

  lazy val CategoryWithSectPageId333SubCat = Category(
    id = CategoryWithSectPageId333.id + 1,
    extImpId = Some(s"cat-w-ext-imp-id-${CategoryWithSectPageId333.id + 1}"),
    sectionPageId = PageTempImpId,
    parentId = Some(CategoryWithSectPageId333.id),
    defaultSubCatId = None,
    name = "CategoryWithSectPageId333SubCat",
    slug = s"category-with-sect-page-id-${PageTempImpId}-sub-cat",
    position = 10,
    description = Some("Description of CategoryWithSectPageId333SubCat"),
    newTopicTypes = Vector(PageType.Discussion),
    unlistCategory = false,
    unlistTopics = false,
    includeInSummaries = IncludeInSummaries.Default,
    createdAt = globals.now().toJavaDate,
    updatedAt = globals.now().toJavaDate)

  lazy val MayAllPermsForCatWSectPageId333 = PermsOnPages(
    id = LowestTempImpId + 1,
    forPeopleId = Group.FullMembersId,
    onWholeSite = None,
    onCategoryId = Some(CategoryWithSectPageId333SubCat.id),
    onPageId = None,
    onPostId = None,
    onTagId = None,
    mayEditPage = Some(true),
    mayEditComment = Some(true),
    mayEditWiki = Some(true),
    mayEditOwn = Some(true),
    mayDeletePage = Some(true),
    mayDeleteComment = Some(true),
    mayCreatePage = Some(true),
    mayPostComment = Some(true),
    maySee = Some(true),
    maySeeOwn = Some(true))

  lazy val PageMeta333 = PageMeta(
    pageId = PageTempImpId,
    extImpId = Some(s"page-${PageTempImpId}-ext-imp-id"),
    pageType = PageType.AboutCategory,
    version = 1,
    createdAt = globals.now().toJavaDate,
    updatedAt = globals.now().toJavaDate,
    authorId = SystemUserId,
    embeddingPageUrl = None,
    categoryId = Some(CategoryWithSectPageId333.id))

  lazy val PagePathToPage333 = PagePathWithId(
    folder = "/",
    pageId = PageTempImpId,
    showId = true,
    pageSlug = s"page-$PageTempImpId-slug",
    canonical = true)

  lazy val Page333TitlePost: Post = Post.createTitle(
    uniqueId = 1,
    extImpId = Some(s"page-$PageTempImpId-title-ext-imp-id"),
    pageId = PageTempImpId,
    createdAt = globals.now().toJavaDate,
    createdById = SystemUserId,
    source = s"Page${PageTempImpId}TitlePost source text",
    htmlSanitized = s"<span>Page${PageTempImpId}TitlePost source text</span>",
    approvedById = None)

  lazy val Page333BodyPost: Post = Post.createBody(
    uniqueId = 2,
    extImpId = Some(s"page-$PageTempImpId-body-ext-imp-id"),
    pageId = PageTempImpId,
    postType = PostType.Normal,
    createdAt = globals.now().toJavaDate,
    createdById = SystemUserId,
    source = s"Page${PageTempImpId}BodyPost source text",
    htmlSanitized = s"<p>Page${PageTempImpId}BodyPost source text</p>",
    approvedById = None)



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

      lazy val dumpToUpsert = SiteBackup.empty.copy(
        guests = Vector(GuestWithAllFields),
        // users = Vector(UnapprovedUser), later
        categories = Vector(CategoryWithSectPageId333, CategoryWithSectPageId333SubCat),
        pages = Vector(PageMeta333),
        pagePaths = Vector(PagePathToPage333),
        posts = Vector(Page333TitlePost, Page333BodyPost),
        permsOnPages = Vector(MayAllPermsForCatWSectPageId333))

      val sectPageId = "1"

      // Temp imp ids > 2e9 + 1,2,3,4 ... converted to real ids 1,2,3,4 ....
      lazy val dumpToReadBack = SiteBackup.empty.copy(
        guests = Vector(
          GuestWithAllFields.copy(id = -10)),
        //users = Vector(
        // UnapprovedUser.copy(id = 100)), later
        categories = Vector(
          CategoryWithSectPageId333.copy(
            id = 1, sectionPageId = sectPageId, defaultSubCatId = Some(2)),
          CategoryWithSectPageId333SubCat.copy(
            id = 2, sectionPageId = sectPageId, parentId = Some(1))),
        pages = Vector(
          PageMeta333.copy(pageId = sectPageId, categoryId = Some(1))),
        pagePaths = Vector(
          PagePathToPage333.copy(pageId = sectPageId)),
        posts = Vector(
          Page333TitlePost.copy(pageId = sectPageId),
          Page333BodyPost.copy(pageId = sectPageId)),
        permsOnPages = Vector(
          MayAllPermsForCatWSectPageId333))

      "import the items" in {
        site = createSite(siteName)
        upsert(site.id, dumpToUpsert)
      }

      "now they're all there" in {
        val dump = SiteBackupMaker(context = context).loadSiteDump(site.id)
        val expectedDump = dumpToReadBack.copy(site = Some(SiteInclDetails(
          id = dump.theSite.id,
          pubId = dump.theSite.pubId,
          status = SiteStatus.Active,
          name = "imp-test-" + siteName,
          createdAt = dump.theSite.createdAt,
          createdFromIp = Some("1.2.3.4"),
          creatorEmailAddress = None,
          //numCategories = 2,
          numPages = 1,
          numPosts = 2,
          numPostTextBytes = dump.theSite.numPostTextBytes,
          nextPageId = 2,
          quotaLimitMbs = Some(100),
          hostnames = Vector(HostnameInclDetails(
            hostname = "imp-test-" + siteName, Hostname.RoleCanonical, addedAt = globals.now())),
          version = 1,
          numParticipants = 14,
        )))
        dump mustBe expectedDump
      }

      "re-importing the dump has no effect" - {
        "re-import" in {
        }

        "has no effect" in {
        }
      }
    }

    "re-import a dump with old and new items, upserts only the new items" in {
      var site: Site = null

    }

    "two sites can share the same upload" in {
      var site: Site = null

      /*
      val dao = globals.siteDao(Site.FirstSiteId)

      info("create user, site 1")
      val magic = "site1_6kmf2"
      val user = dao.createPasswordUserCheckPasswordStrong(NewPasswordUserData.create(
        name = Some(s"User $magic"), username = s"user_$magic", email = s"user-$magic@x.co",
        password = Some(magic), createdAt = globals.now(), isAdmin = true, isOwner = false).get,
        browserIdData)

      info("create site 2")
      val site2 = globals.systemDao.createAdditionalSite(
        pubId = "dummy56205", name = "site-two-name", status = SiteStatus.Active,
        hostname = Some("site-two"),
        embeddingSiteUrl = None, organizationName = "Test Org Name", creatorId = user.id,
        browserIdData, isTestSiteOkayToDelete = true, skipMaxSitesCheck = true,
        deleteOldSite = false, pricePlan = "Unknown", createdFromSiteId = None)

      info("create user (owner), site 2")
      val dao2 = globals.siteDao(site2.id)
      val user2 = dao2.createPasswordUserCheckPasswordStrong(NewPasswordUserData.create(
        name = Some(s"User $magic"), username = s"user_$magic", email = s"user-$magic@x.co",
        password = Some(magic), createdAt = globals.now(), isAdmin = true, isOwner = true).get,
        browserIdData) */
    }

  }

}
