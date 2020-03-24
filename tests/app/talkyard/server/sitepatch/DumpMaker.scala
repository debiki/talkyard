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

package talkyard.server.sitepatch

import java.io.RandomAccessFile
import com.debiki.core._
import com.debiki.core.Prelude._
import debiki.EdHttp.ResultException
import debiki.dao.{DaoAppSuite, SiteDao}
import org.scalatest._
import java.{io => jio}


trait DumpMaker {
  self: DaoAppSuite =>


  def upsert(siteId: SiteId, patch: SitePatch) {
    val importer = SitePatcher(globals)
    importer.upsertIntoExistingSite(siteId, patch, browserIdData)
  }

  def upsertSimplePatch(simplePatch: SimpleSitePatch, siteDao: SiteDao) {
    val importer = SitePatcher(globals)
    val completePatch = simplePatch.makeComplete(siteDao).getOrDie("TyETSTSIMPL2COMPL")
    importer.upsertIntoExistingSite(siteDao.siteId, completePatch, browserIdData)
  }



  val FirstGuestTempImpId: UserId = - LowestTempImpId - 1

  lazy val GuestWithAllFields: Guest = makeGuest(FirstGuestTempImpId)

  def makeGuest(id: UserId): Guest = Guest(
    id = id,
    extId = Some(s"guest_w_temp_imp_id_$id"),
    createdAt = globals.now(),
    guestName = s"Guest With Id $id",
    guestBrowserId = Some(s"guest-br-id-$id"),
    email = s"guest-$id@x.co",
    emailNotfPrefs = EmailNotfPrefs.Unspecified)



  lazy val UnapprovedUser: UserInclDetails = makeUnapprovedUser(LowestTempImpId + 1)

  def makeUnapprovedUser(id: UserId) =
    UserInclDetails(
      id = id,
      extId = Some(s"user-w-temp-imp-id-$id"),
      ssoId = Some(s"user-sso-id-for-temp-imp-id-$id"),
      fullName = Some(s"User W Temp Imp Id $id Full Name"),
      username = s"usr_tid_$id",
      createdAt = globals.now(),
      isApproved = None,
      reviewedAt = None,
      reviewedById = None,
      primaryEmailAddress = s"user-tid-$id@x.co",
      emailNotfPrefs = EmailNotfPrefs.Receive)


  val AboutCatPageTempImpId333 = "2000000333"


  lazy val CategoryWithSectPageId333: Category =
    makeCategory(LowestTempImpId + 1, AboutCatPageTempImpId333, defSubCat = Some(2))

  lazy val CategoryWithSectPageId333SubCat: Category = makeCategory(
    categoryId = CategoryWithSectPageId333.id + 1,
    sectionPageId = AboutCatPageTempImpId333,
    parentId = Some(CategoryWithSectPageId333.id))


  def makeCategory(categoryId: CategoryId, sectionPageId: PageId,
        parentId: Option[CategoryId] = None, defSubCat: Option[CategoryId] = None) =
    Category(
      id = categoryId,
      extImpId = Some(s"cat-w-temp-imp-id-$categoryId"),
      sectionPageId = sectionPageId,
      parentId = parentId,
      defaultSubCatId = defSubCat,
      name = s"Category Imp Id $categoryId Section Page $sectionPageId",
      slug = s"category-$categoryId-w-sect-page-$sectionPageId",
      position = 1,
      description = Some(s"Description of Category W Temp Imp Id $categoryId"),
      newTopicTypes = Vector(PageType.Discussion),
      unlistCategory = false,
      unlistTopics = false,
      includeInSummaries = IncludeInSummaries.Default,
      createdAt = globals.now().toJavaDate,
      updatedAt = globals.now().toJavaDate)



  lazy val MayAllPermsForFullMembersOnSubCatWSectPageId333: PermsOnPages = makePermsOnPagesMayAllYes(
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


  lazy val AboutCatPageMeta333: PageMeta =
    makePageMeta(AboutCatPageTempImpId333, categoryId = Some(CategoryWithSectPageId333.id))
    .copy(pageType = PageType.AboutCategory)

  def makePageMeta(id: PageId, categoryId: Option[CategoryId]) = PageMeta(
    pageId = id,
    extImpId = Some(s"page-w-imp-id$id"),
    pageType = PageType.Discussion,
    version = 1,
    createdAt = globals.now().toJavaDate,
    updatedAt = globals.now().toJavaDate,
    authorId = SystemUserId,
    embeddingPageUrl = None,
    categoryId = categoryId)


  lazy val AboutCatPagePath333: PagePathWithId = makePagePath(pageId = AboutCatPageTempImpId333)

  def makePagePath(pageId: PageId) = PagePathWithId(
    folder = "/",
    pageId = pageId,
    showId = true,
    pageSlug = s"page-w-imp-id-$pageId-slug",
    canonical = true)


  lazy val Page333TitlePost: Post = makePost(
    LowestTempImpId + 1, pageId = AboutCatPageTempImpId333, nr = PageParts.TitleNr)

  lazy val Page333BodyPost: Post = makePost(
    LowestTempImpId + 2, pageId = AboutCatPageTempImpId333, nr = PageParts.BodyNr)

  lazy val Page333Reply: Post = makePost(
    LowestTempImpId + 3, pageId = AboutCatPageTempImpId333, nr = LowestTempImpId + PageParts.FirstReplyNr,
        parent = Some(Page333BodyPost))

  def makePost(id: PostId, pageId: PageId, nr: PostNr, parent: Option[Post] = None): Post = {
    val text = s"Text text, page w imp id $AboutCatPageTempImpId333, post imp nr $nr"
    Post.create(
      uniqueId = id,
      extImpId = Some(s"page-$pageId-post-w-imp-id-$id-imp-nr-$nr"),
      pageId = pageId,
      postNr = nr,
      parent = parent,
      multireplyPostNrs = Set.empty,
      postType = PostType.Normal,
      createdAt = globals.now().toJavaDate,
      createdById = SystemUserId,
      source = text,
      htmlSanitized = s"<p>$text</p>",
      approvedById = None)
  }

}
