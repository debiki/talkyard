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


trait DumpMaker {
  self: DaoAppSuite =>


  /*
  def createSite(id: String): Site = {
    globals.systemDao.createAdditionalSite(
      pubId = s"imptest_$id", name = s"imp-test-$id", status = SiteStatus.Active,
      hostname = Some(s"imp-test-$id"),
      embeddingSiteUrl = None, organizationName = s"Imp Test Org $id",
      creatorId = SystemUserId, // not in use when createdFromSiteId is None
      browserIdData, isTestSiteOkayToDelete = true, skipMaxSitesCheck = true,
      deleteOldSite = false, pricePlan = "Unknown", createdFromSiteId = None)
  } */


  def upsert(siteId: SiteId, dump: SiteBackup) {
    val importer = SiteBackupImporterExporter(globals)
    importer.upsertIntoExistingSite(siteId, dump, browserIdData)
  }



  val FirstGuestTempImpId: UserId = - LowestTempImpId - 1

  lazy val GuestWithAllFields: Guest = makeGuest(FirstGuestTempImpId)

  def makeGuest(id: UserId): Guest = Guest(
    id = id,
    extImpId = Some(s"guest_temp_imp_id_$id"),
    createdAt = globals.now(),
    guestName = s"Guest With Id $id",
    guestBrowserId = Some(s"guest-br-id-$id"), email = s"guest-$id@x.co",
    emailNotfPrefs = EmailNotfPrefs.Unspecified)



  lazy val UnapprovedUser: UserInclDetails = makeUnapprovedUser(LowestTempImpId + 1)

  def makeUnapprovedUser(id: UserId) =
    UserInclDetails(
      id = id,
      extImpId = Some(s"user-ext-imp-id-$id"),
      externalId = Some(s"user-ext-sso-id-for-temp-id-$id"),
      fullName = Some(s"User temp imp id $id Full Name"),
      username = s"usr_tid_$id",
      createdAt = globals.now(),
      isApproved = None,
      reviewedAt = None,
      reviewedById = None,
      primaryEmailAddress = s"user-tid-$id@x.co",
      emailNotfPrefs = EmailNotfPrefs.Receive)


  val PageTempImpId = "2000000333"


  lazy val CategoryWithSectPageId333: Category =
    makeCategory(LowestTempImpId + 1, PageTempImpId, defSubCat = Some(2))

  lazy val CategoryWithSectPageId333SubCat: Category = makeCategory(
    categoryId = CategoryWithSectPageId333.id + 1,
    sectionPageId = PageTempImpId,
    parentId = Some(CategoryWithSectPageId333.id))


  def makeCategory(categoryId: CategoryId, sectionPageId: PageId,
        parentId: Option[CategoryId] = None, defSubCat: Option[CategoryId] = None) =
    Category(
      id = categoryId,
      extImpId = Some(s"cat-w-ext-imp-id-$categoryId"),
      sectionPageId = sectionPageId,
      parentId = parentId,
      defaultSubCatId = defSubCat,
      name = s"Category $categoryId Section Page $sectionPageId",
      slug = s"category-$categoryId-w-sect-page-$sectionPageId",
      position = 1,
      description = Some(s"Description of Category W Id $categoryId"),
      newTopicTypes = Vector(PageType.Discussion),
      unlistCategory = false,
      unlistTopics = false,
      includeInSummaries = IncludeInSummaries.Default,
      createdAt = globals.now().toJavaDate,
      updatedAt = globals.now().toJavaDate)



  lazy val MayAllPermsForCatWSectPageId333: PermsOnPages = makePermsOnPagesMayAllYes(
    LowestTempImpId + 1, forPeopleId = Group.FullMembersId,
    onCategoryId = Some(CategoryWithSectPageId333SubCat.id))

  def makePermsOnPagesMayAllYes(
        permsId: PermissionId, forPeopleId: UserId, onCategoryId: Option[CategoryId]) =
    PermsOnPages(
      id = permsId,
      forPeopleId = forPeopleId,
      onWholeSite = None,
      onCategoryId = onCategoryId,
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


  lazy val PageMeta333: PageMeta =
    makePageMeta(PageTempImpId, categoryId = Some(CategoryWithSectPageId333.id))

  def makePageMeta(id: PageId, categoryId: Option[CategoryId]) = PageMeta(
    pageId = id,
    extImpId = Some(s"page-$id-ext-imp-id"),
    pageType = PageType.AboutCategory,
    version = 1,
    createdAt = globals.now().toJavaDate,
    updatedAt = globals.now().toJavaDate,
    authorId = SystemUserId,
    embeddingPageUrl = None,
    categoryId = categoryId)


  lazy val PagePathToPage333: PagePathWithId = makePagePath(pageId = PageTempImpId)

  def makePagePath(pageId: PageId) = PagePathWithId(
    folder = "/",
    pageId = pageId,
    showId = true,
    pageSlug = s"page-$pageId-slug",
    canonical = true)


  lazy val Page333TitlePost: Post = makePost(
    LowestTempImpId + 1, pageId = PageTempImpId, nr = PageParts.TitleNr)

  lazy val Page333BodyPost: Post = makePost(
    LowestTempImpId + 2, pageId = PageTempImpId, nr = PageParts.BodyNr)

  lazy val Page333Reply: Post = makePost(
    LowestTempImpId + 3, pageId = PageTempImpId, nr = LowestTempImpId + PageParts.FirstReplyNr,
        parent = Some(Page333BodyPost))

  def makePost(id: PostId, pageId: PageId, nr: PostNr, parent: Option[Post] = None): Post = Post.create(
    uniqueId = id,
    extImpId = Some(s"page-$pageId-post-id-$id-nr-$nr"),
    pageId = pageId,
    postNr = nr,
    parent = parent,
    multireplyPostNrs = Set.empty,
    postType = PostType.Normal,
    createdAt = globals.now().toJavaDate,
    createdById = SystemUserId,
    source = s"Page${PageTempImpId}BodyPost source text",
    htmlSanitized = s"<p>Page${PageTempImpId}BodyPost source text</p>",
    approvedById = None)

}
