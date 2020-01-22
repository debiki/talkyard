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
import debiki.dao.{ForumDao, ReadOnySiteDao, SiteDao}
import debiki.EdHttp.throwForbiddenIf
import debiki.TextAndHtml
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
  upsertOptions: Option[UpsertOptions],
  site: Option[SiteInclDetails],
  settings: Option[SettingsToSave],
  apiSecrets: Seq[ApiSecret],
  summaryEmailIntervalMins: Int, // for now [7FKB4Q1]
  summaryEmailIfActive: Boolean, // for now [7FKB4Q1]
  guests: Seq[Guest],
  guestEmailNotfPrefs: Map[String, EmailNotfPrefs],
  // Includes built-in groups — they can be renamed or have their settings changed,
  // and if restoring a dump to a new site, such changes should be remembered.
  groups: Seq[Group],
  groupPps: Seq[GroupParticipant],
  users: Seq[UserInclDetails],
  pptStats: Seq[UserStats],
  pptVisitStats: Seq[UserVisitStats],
  usernameUsages: Seq[UsernameUsage],
  memberEmailAddrs: Seq[UserEmailAddress],
  identities: Seq[Identity],
  invites: Seq[Invite],
  notifications: Seq[Notification],
  categoryPatches: Seq[CategoryPatch],
  categories: Seq[Category],  // later, remove, see: [PPATCHOBJS]
  pages: Seq[PageMeta],
  pagePaths: Seq[PagePathWithId],
  pageIdsByAltIds: Map[AltPageId, PageId],
  pagePopularityScores: Seq[PagePopularityScores],
  pageNotfPrefs: Seq[PageNotfPref],
  pageParticipants: Seq[PageParticipant],
  drafts: Seq[Draft],
  posts: Seq[Post],
  postActions: Seq[PostAction],
  permsOnPages: Seq[PermsOnPages],
  reviewTasks: Seq[ReviewTask],
  isTestSiteOkDelete: Boolean = false) {

  /* MISSING:
 public | audit_log3              | table    | edc
 public | backup_test_log3        | table    | edc
 public | blocks3                 | table    | edc
 public | category_notf_levels3   | table    | edc -- remove?
 public | emails_out3             | table    | edc
 public | index_queue3            | table    | edc
 public | page_html3              | table    | edc
 public | post_read_stats3        | table    | edc
 public | post_revisions3         | table    | edc
 public | post_tags3              | table    | edc
 public | spam_check_queue3       | table    | edc
 public | tag_notf_levels3        | table    | edc
 public | upload_refs3            | table    | edc
 public | uploads3                | table    | edc
  */

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
      apiSecrets.size >= many ||
      (guests.length + groups.length + users.length) >= many ||
      guestEmailNotfPrefs.size >= many ||
      groupPps.size >= many ||
      pptStats.length >= many ||
      pptVisitStats.length >= many ||
      usernameUsages.length >= many ||
      memberEmailAddrs.length >= many ||
      identities.length >= many ||
      invites.length >= many ||
      notifications.length >= many ||
      (categoryPatches.length + categories.length) >= many ||
      pages.length >= many ||
      pagePaths.length >= many ||
      pageIdsByAltIds.size >= many ||
      pagePopularityScores.size >= many ||
      pageNotfPrefs.length >= many ||
      pageParticipants.size >= many ||
      drafts.length >= many ||
      posts.length >= many * 2 ||  // since at least 2 posts per page: title and body
      postActions.length >= many ||
      permsOnPages.length >= many ||
      reviewTasks.length >= many
  }
}


case class UpsertOptions(
  // Default: false, send no notfs. [TyT3BG05KTJ2]
  sendNotifications: Option[Boolean])


case object SiteBackup {
  val empty = SiteBackup(
    upsertOptions = None,
    site = None,
    settings = None,
    apiSecrets = Vector.empty,
    summaryEmailIntervalMins = 60, // for now [7FKB4Q1]
    summaryEmailIfActive = false, // for now [7FKB4Q1]
    guests = Vector.empty,
    guestEmailNotfPrefs = Map.empty,
    groups = Vector.empty,
    users = Vector.empty,
    groupPps = Vector.empty,
    pptStats = Vector.empty,
    pptVisitStats = Vector.empty,
    usernameUsages = Vector.empty,
    memberEmailAddrs = Vector.empty,
    identities = Vector.empty,
    invites = Vector.empty,
    notifications = Vector.empty,
    pages = Vector.empty,
    pagePaths = Vector.empty,
    pageIdsByAltIds = Map.empty,
    pagePopularityScores = Vector.empty,
    pageNotfPrefs = Vector.empty,
    pageParticipants = Vector.empty,
    categoryPatches = Vector.empty,
    categories = Vector.empty,
    drafts = Vector.empty,
    posts = Vector.empty,
    postActions = Vector.empty,
    permsOnPages = Vector.empty,
    reviewTasks = Vector.empty)
}



case class SimpleSitePatch(
  upsertOptions: Option[UpsertOptions] = None,
  categoryPatches: Seq[CategoryPatch] = Nil,
  pagePatches: Seq[SimplePagePatch] = Nil) {


  def loadThingsAndMakeComplete(dao: SiteDao): SiteBackup Or ErrorMessage = {
    // For now, pick the first random root category. Sub communities currently
    // disabled. [4GWRQA28]  But the site must not be empty — we need something
    // to insert the new contents into:
    throwForbiddenIf(dao.getRootCategories().isEmpty,
      "TyE6PKWTY4", "No root category has been created")
    makeComplete(dao)
  }


  /** Adds missing data to this SimplePatch so it becomes a "complete" SitePatch,
    * which describes precisely what things and values to upsert.
    *
    * Example: A CategoryPatch has a 'description' field, and if it gets changed,
    * makeComplete() adds a patch for the category's About page body post too — because
    * that's where the description is kept (.i.e in the About page,
    * the page body post text).
    */
  def makeComplete(dao: ReadOnySiteDao): SiteBackup Or ErrorMessage = {
    var nextCategoryId = LowestTempImpId
    var nextPageId = LowestTempImpId
    var nextPostId = LowestTempImpId
    val now = dao.now()

    // This works with the current users of the API — namely, upserting categories.
    val categories = mutable.ArrayBuffer[Category]()
    val pages = mutable.ArrayBuffer[PageMeta]()
    val pagePaths = mutable.ArrayBuffer[PagePathWithId]()
    val permsOnPages = mutable.ArrayBuffer[PermsOnPages]()
    val posts = mutable.ArrayBuffer[Post]()


    // ----- Upsert categories, and description pages

    for (categoryPatch <- categoryPatches) {
      nextCategoryId += 1

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
        dao.getCategoryByRef(ref) getOrIfBad { problem =>
          return Bad(s"Bad category ref: '$ref', the problem: $problem [TyE5FKDLW206]")
        } getOrElse {
          return Bad(s"Category not found: '$ref' [TyE8KFUW240]")
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

      permsOnPages.append(ForumDao.makeEveryonesDefaultCategoryPerms(nextCategoryId))
      permsOnPages.append(ForumDao.makeStaffCategoryPerms(nextCategoryId))

      appendPage(
        pageExtId = categoryPatch.extImpId.map(_ + "_about_page"),
        pageType = PageType.AboutCategory,
        pageSlug = "about-" + theCategorySlug,
        authorId = SysbotUserId,
        categoryId = Some(nextCategoryId),
        titlePostExtId = categoryPatch.extImpId.map(_ + "_about_page_title"),
        // Sync the title with CategoryToSave [G204MF3]
        titleHtmlUnsafe = s"Description of the $theCategoryName category",
        bodyPostExtId = categoryPatch.extImpId.map(_ + "_about_page_body"),
        bodyHtmlUnsafe = theCategoryDescription)
    }


    // ----- Upsert pages

    for (pagePatch: SimplePagePatch <- pagePatches) {
      val category: Option[Category] = pagePatch.categoryRef.map { ref =>
        dao.getCategoryByRef(ref) getOrIfBad { problem =>
          return Bad(s"Bad category ref: '$ref', the problem: $problem [TyE8SKHNWJ2]")
        } getOrElse {
          return Bad(s"Category not found: '$ref' [TyE2UPMSD064]")
        }
      }

      val author: Option[Participant] = pagePatch.authorRef.map { ref =>
        dao.getParticipantByRef(ref) getOrIfBad { problem =>
          return Bad(s"Bad author ref: '$ref', the problem: $problem [TyE5KD2073]")
        } getOrElse {
          return Bad(s"Author not found: '$ref' [TyE6WUKJC]")
        }
      }

      val pageSlug = dao.nashorn.slugifyTitle(pagePatch.title)

      appendPage(
        pageExtId = Some(pagePatch.extId),
        pageType = pagePatch.pageType getOrElse PageType.Discussion,
        pageSlug = pageSlug,
        authorId = author.map(_.id) getOrElse SysbotUserId,
        categoryId = category.map(_.id),
        titlePostExtId = Some(pagePatch.extId + "_title"),
        titleHtmlUnsafe = pagePatch.title,
        bodyPostExtId = Some(pagePatch.extId + "_body"),
        bodyHtmlUnsafe = pagePatch.body)
    }


    def appendPage(
      pageExtId: Option[ExtId],
      pageType: PageType,
      pageSlug: String,
      authorId: UserId,
      categoryId: Option[CategoryId],
      titleHtmlUnsafe: String,
      titlePostExtId: Option[ExtId],
      bodyHtmlUnsafe: String,
      bodyPostExtId: Option[ExtId],
    ) {
      nextPageId += 1

      pages.append(PageMeta.forNewPage(
        extId = pageExtId,
        pageId = nextPageId.toString,
        pageRole = pageType,
        authorId = authorId,
        creationDati = now.toJavaDate,
        numPostsTotal = 2,
        categoryId = categoryId,
        publishDirectly = true))

      pagePaths.append(PagePathWithId(
        folder = "/",
        pageId = nextPageId.toString,
        showId = true,
        pageSlug = pageSlug,
        canonical = true))

      // Assume the page title and body source is html, not CommonMark.
      // Later, could add a field title/bodyMarkupLang: 'Html' or 'Commonmark'? [IMPCORH]
      //
      val bodyHtmlSanitized = Jsoup.clean(bodyHtmlUnsafe, TextAndHtml.relaxedHtmlTagWhitelist)
      val titleHtmlSanitized = Jsoup.clean(titleHtmlUnsafe, Whitelist.basic)

      nextPostId += 1
      val titlePost = Post(
        id = nextPostId,
        extImpId = titlePostExtId,
        pageId = nextPageId.toString,
        nr = PageParts.TitleNr,
        parentNr = None,
        multireplyPostNrs = Set.empty,
        tyype = PostType.Normal,
        createdAt = now.toJavaDate,
        createdById = authorId,
        currentRevisionById = authorId,
        currentRevStaredAt = now.toJavaDate,
        currentRevLastEditedAt = None,
        currentRevSourcePatch = None,
        currentRevisionNr = FirstRevisionNr,
        previousRevisionNr = None,
        lastApprovedEditAt = None,
        lastApprovedEditById = None,
        numDistinctEditors = 1,
        safeRevisionNr = Some(FirstRevisionNr),
        approvedSource = Some(titleHtmlUnsafe),
        approvedHtmlSanitized = Some(titleHtmlSanitized),
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
        extImpId = bodyPostExtId,
        nr = PageParts.BodyNr,
        approvedSource = Some(bodyHtmlUnsafe),
        approvedHtmlSanitized = Some(bodyHtmlSanitized))

      posts.append(titlePost)
      posts.append(bodyPost)
    }


    val result = SiteBackup.empty.copy(
      upsertOptions = upsertOptions,
      categories = categories.toVector,
      pages = pages.toVector,
      pagePaths = pagePaths.toVector,
      posts = posts.toVector,
      permsOnPages = permsOnPages.toVector)

    Good(result)
  }
}
