/**
 * Copyright (c) 2015-2019 Kaj Magnus Lindberg
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
import debiki.dao.ForumDao
import org.jsoup.Jsoup
import org.jsoup.safety.Whitelist
import org.scalactic.{Bad, ErrorMessage, Good, Or}
import play.api.libs.json.JsObject
import scala.collection.mutable


/** Later: This class should not contain complete items like Category and Post. [PPATCHOBJS]
  * Instead, it should consist of CategoryPatch (exist) and PostPatch and
  * GuestPatch etc, where some fields can be left out.
  * That'd be useful if one wants to upsert something and overwrite only
  * some fields, and leave the others unchanged.
  *
  * So, all things need two representations: Thing and ThingPatch.
  * But don't implement anything more than CategoryPatch, until people ask for that.
  *
  * Also, these ThingPatch should be able to refer to each other via
  * external ids, in a patch, so the Talkyard clients won't need to
  * construct these patch > 2e9 "temporary import ids" — or "patch item id" ?
  * See "LowestTempImpId".
  *
  */
case class SiteBackup(  // RENAME to SiteDmup *no* SitePatch, and all related classes too.
                        // SitePatch is a (possibly small) set of changes to do to a site,
                        // whilst a SiteDump is a SitePatch that includes the whole site.
  site: Option[SiteInclDetails],
  settings: Option[SettingsToSave],
  summaryEmailIntervalMins: Int, // for now [7FKB4Q1]
  summaryEmailIfActive: Boolean, // for now [7FKB4Q1]
  guests: Seq[Guest],
  guestEmailNotfPrefs: Map[String, EmailNotfPrefs],
  groups: Seq[Group],
  users: Seq[UserInclDetails],
  categoryPatches: Seq[CategoryPatch],
  categories: Seq[Category],  // later, remove, see: [PPATCHOBJS]
  pages: Seq[PageMeta],
  pagePaths: Seq[PagePathWithId],
  pageIdsByAltIds: Map[AltPageId, PageId],
  posts: Seq[Post],
  permsOnPages: Seq[PermsOnPages]) {

  def theSite: SiteInclDetails = site.getOrDie("TyE053KKPSA6")

  def toSimpleJson: JsObject = {
    SiteBackupMaker.createPostgresqlJsonBackup(anyDump = Some(this), simpleFormat = true)
  }

  def toPatchJson: JsObject = {
    SiteBackupMaker.createPostgresqlJsonBackup(anyDump = Some(this), simpleFormat = false)
  }

  /** For tests. */
  def withVersionPlusOne: SiteBackup = copy(
    site = site.map(s => s.copy(version = s.version + 1)))

  def hasManyThings: Boolean = {
    val many = 3  // one, two, many.
    // Allow in total > many things, if things of each type is < many.
    // So can /-/v0/upsert-simple a category, which results in 1 category,
    // 1 about page, and 2 posts (about page title and body).
    site.isDefined ||
      settings.isDefined ||
      (guests.length + groups.length + users.length) >= many ||
      (categoryPatches.length + categories.length) >= many ||
      pages.length >= many ||
      pagePaths.length >= many ||
      posts.length >= many * 2 ||  // since at least 2 posts per page: title and body
      permsOnPages.length >= many
  }
}


case object SiteBackup {
  val empty = SiteBackup(
    site = None,
    settings = None,
    summaryEmailIntervalMins = 60, // for now [7FKB4Q1]
    summaryEmailIfActive = false, // for now [7FKB4Q1]
    guests = Vector.empty,
    guestEmailNotfPrefs = Map.empty,
    groups = Vector.empty,
    users = Vector.empty,
    pages = Vector.empty,
    pagePaths = Vector.empty,
    pageIdsByAltIds = Map.empty,
    categoryPatches = Vector.empty,
    categories = Vector.empty,
    posts = Vector.empty,
    permsOnPages = Vector.empty)
}


case class SimpleSitePatch(
  categoryPatches: Seq[CategoryPatch]) {

  /** Adds missing data to this SimplePatch so it becomes a "complete" SitePatch,
    * which describes precisely what things and values to upsert.
    *
    * Example: A CategoryPatch has a 'description' field, and if it gets changed,
    * makeComplete() adds a patch for the category's About page body post too — because
    * that's where the description is kept (.i.e in the About page,
    * the page body post text).
    */
  def makeComplete(oldCats: Seq[Category], now: When): SiteBackup Or ErrorMessage = {
    var nextCategoryId = LowestTempImpId
    var nextPageId = LowestTempImpId
    var nextPostId = LowestTempImpId

    // This works with the current users of the API — namely, upserting categories.
    val categories = mutable.ArrayBuffer[Category]()
    val pages = mutable.ArrayBuffer[PageMeta]()
    val pagePaths = mutable.ArrayBuffer[PagePathWithId]()
    val permsOnPages = mutable.ArrayBuffer[PermsOnPages]()
    val posts = mutable.ArrayBuffer[Post]()

    for (categoryPatch <- categoryPatches) {
      nextCategoryId += 1
      nextPageId += 1
      nextPostId += 1

      val theCategorySlug = categoryPatch.slug getOrElse {
        return Bad("Category has no slug [TyE205MRDJ5]")
      }

      val theCategoryName = categoryPatch.name getOrElse {
        return Bad(s"Category with slug '$theCategorySlug' has no name [TyE205MRDJ5]")
      }

      val theCategoryDescription = categoryPatch.description getOrElse {
        return Bad(s"Category with slug '$theCategorySlug' has no description")
      }

      val parentCategory: Category = categoryPatch.parentRef map { ref =>
        if (ref startsWith "extid:") {
          val parentExtId = ref drop "extid:".length
          oldCats.find(_.extImpId is parentExtId) getOrElse {
            return Bad(s"Parent category not found: No category has ext id '$parentExtId' [TyE6WKTH2T5]")
          }
        }
        else if (ref startsWith "tyid:") {
          // Later: Lookup by internal id.
          return Bad(s"'tyid:' refs not yet implemented [TyE205MRG4]")
        }
        else {
          var refDots = ref.takeWhile(_ != ':') take 14
          if (refDots.length >= 14) refDots = refDots.dropRight(1) + "..."
          return Bad(s"Unknown ref type: '$refDots', should be e.g. 'extid:...' [TyE5RKD2LR46]")
        }
      } getOrElse {
        return Bad("No parentRef: 'extid:....' specified, that's not yet supported [TyE205WKDLF2]")
        /* Later:
        // Find the root category? Currently should be exactly one, since sub communities
        // currently disabled. [4GWRQA28] Or maybe the root category should have a default ext id?
        // like, "first_root_category" ?
        oldCats.find(_.parentId.isEmpty) getOrElse {
          return Bad("No root category [TyE205KRTG4]")
        } */
      }

      categories.append(Category(
        id = nextCategoryId,
        extImpId = categoryPatch.extImpId,
        sectionPageId = parentCategory.sectionPageId,
        parentId = Some(parentCategory.id),
        defaultSubCatId = None,
        name = theCategoryName,
        slug = theCategorySlug,
        position = categoryPatch.position getOrElse Category.DefaultPosition,
        description = Some(theCategoryDescription),
        newTopicTypes = Vector(PageType.Question),       // for now
        unlistCategory = false,                          // for now
        unlistTopics = false,                            // for now
        includeInSummaries = IncludeInSummaries.Default, // for now
        createdAt = now.toJavaDate,
        updatedAt = now.toJavaDate))

      pages.append(PageMeta.forNewPage(
        extId = categoryPatch.extImpId.map(_ + "_about_page"),
        pageId = nextPageId.toString,
        pageRole = PageType.AboutCategory,
        authorId = SysbotUserId,
        creationDati = now.toJavaDate,
        numPostsTotal = 2,
        categoryId = Some(nextCategoryId),
        publishDirectly = true))

      pagePaths.append(PagePathWithId(
        folder = "/",
        pageId = nextPageId.toString,
        showId = true,
        pageSlug = "about-" + theCategorySlug,
        canonical = true))

      // Assume the title source is html, not CommonMark. How can we know? [IMPCORH]
      val descriptionSanitized = Jsoup.clean(theCategoryDescription, Whitelist.basicWithImages)

      // Sync the title with CategoryToSave [G204MF3]
      val titleSource = s"Description of the $theCategoryName category"
      val titleSanitized = Jsoup.clean(titleSource, Whitelist.basic)

      val titlePost = Post(
        id = nextPostId,
        extImpId = categoryPatch.extImpId.map(_ + "_about_page_title"),
        pageId = nextPageId.toString,
        nr = PageParts.TitleNr,
        parentNr = None,
        multireplyPostNrs = Set.empty,
        tyype = PostType.Normal,
        createdAt = now.toJavaDate,
        createdById = SysbotUserId,
        currentRevisionById = SysbotUserId,
        currentRevStaredAt = now.toJavaDate,
        currentRevLastEditedAt = None,
        currentRevSourcePatch = None,
        currentRevisionNr = FirstRevisionNr,
        previousRevisionNr = None,
        lastApprovedEditAt = None,
        lastApprovedEditById = None,
        numDistinctEditors = 1,
        safeRevisionNr = Some(FirstRevisionNr),
        approvedSource = Some(titleSource),
        approvedHtmlSanitized = Some(titleSanitized),
        approvedAt = Some(now.toJavaDate),
        approvedById = Some(SysbotUserId),
        approvedRevisionNr = Some(FirstRevisionNr),
        collapsedStatus = CollapsedStatus.Open,
        collapsedAt = None,
        collapsedById = None,
        closedStatus = ClosedStatus.Open,
        closedAt = None,
        closedById = None,
        bodyHiddenAt = None,
        bodyHiddenById = None,
        bodyHiddenReason = None,
        deletedStatus = DeletedStatus.NotDeleted,
        deletedAt = None,
        deletedById = None,
        pinnedPosition = None,
        branchSideways = None,
        numPendingFlags = 0,
        numHandledFlags = 0,
        numPendingEditSuggestions = 0,
        numLikeVotes = 0,
        numWrongVotes = 0,
        numBuryVotes = 0,
        numUnwantedVotes = 0,
        numTimesRead = 0)

      nextPostId += 1
      val bodyPost = titlePost.copy(
        id = nextPostId,
        extImpId = categoryPatch.extImpId.map(_ + "_about_page_body"),
        nr = PageParts.BodyNr,
        approvedSource = Some(theCategoryDescription),
        approvedHtmlSanitized = Some(descriptionSanitized))

      posts.append(titlePost)
      posts.append(bodyPost)

      permsOnPages.append(ForumDao.makeEveryonesDefaultCategoryPerms(nextCategoryId))
      permsOnPages.append(ForumDao.makeStaffCategoryPerms(nextCategoryId))
    }

    val result = SiteBackup.empty.copy(
      categories = categories.toVector,
      pages = pages.toVector,
      pagePaths = pagePaths.toVector,
      posts = posts.toVector,
      permsOnPages = permsOnPages.toVector)

    Good(result)
  }
}
