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

package talkyard.server.sitepatch

import com.debiki.core._
import com.debiki.core.Prelude._
import debiki.dao.{ForumDao, ReadOnlySiteDao, SiteDao}
import debiki.EdHttp.{throwForbidden, throwForbiddenIf}
import debiki.TextAndHtml
import org.scalactic.{Bad, ErrorMessage, Good, Or}
import play.api.libs.json.JsObject
import scala.collection.mutable
import scala.collection.immutable


/** Later: This class should not contain complete items like Category and Post. [PPATCHOBJS]
  * Instead, it should consist of CategoryPatch (exist) and PostPatch and
  * GuestPatch etc, where some fields can be left out.
  * That'd be useful if one wants to upsert something and overwrite only
  * some fields, and leave the others unchanged.  — No? Use ActionBatch for that instead? [ACTNPATCH]
  *
  * So, all things need two representations: Thing and ThingPatch.
  * But don't implement anything more than CategoryPatch, until people ask for that.
  *
  * Also, these ThingPatch should be able to refer to each other via
  * external ids, in a patch, so the Talkyard clients won't need to
  * construct these patch > 2e9 "temporary import ids" — or "patch item id" ?
  * See "LowestTempImpId".
  *
  * SitePatch is a (possibly small) set of things to add to a site,
  * whilst a SiteDump is a SitePatch that includes the whole site.
  *
  * RENAME to SiteUpsertPatch? [ACTNPATCH]
  */
case class SitePatch(
  upsertOptions: Option[UpsertOptions],
  site: Option[SiteInclDetails],
  settings: Option[SettingsToSave],
  apiSecrets: immutable.Seq[ApiSecret],
  guests: immutable.Seq[Guest],
  guestEmailNotfPrefs: immutable.Map[String, EmailNotfPrefs],
  // Includes built-in groups — they can be renamed or have their settings changed,
  // and if restoring a dump to a new site, such changes should be remembered.
  groups: immutable.Seq[Group],
  groupPps: immutable.Seq[GroupParticipant],
  users: immutable.Seq[UserInclDetails],
  pptStats: immutable.Seq[UserStats],
  pptVisitStats: immutable.Seq[UserVisitStats],
  usernameUsages: immutable.Seq[UsernameUsage],
  memberEmailAddrs: immutable.Seq[UserEmailAddress],
  identities: immutable.Seq[Identity],
  invites: immutable.Seq[Invite],
  notifications: immutable.Seq[Notification],
  categoryPatches: immutable.Seq[CategoryPatch],
  categories: immutable.Seq[Category],  // later, remove, see: [PPATCHOBJS]
  pages: immutable.Seq[PageMeta],
  pagePaths: immutable.Seq[PagePathWithId],
  pageIdsByAltIds: immutable.Map[AltPageId, PageId],
  pagePopularityScores: immutable.Seq[PagePopularityScores],
  pageNotfPrefs: immutable.Seq[PageNotfPref],
  pageParticipants: immutable.Seq[PageParticipant],
  drafts: immutable.Seq[Draft],
  posts: immutable.Seq[Post],
  postActions: immutable.Seq[PostAction],
  postVotes: immutable.Seq[PostVoteToInsert] = Nil,
  links: ImmSeq[Link],
  permsOnPages: immutable.Seq[PermsOnPages],
  reviewTasks: immutable.Seq[ReviewTask],
  webhooks: ImmSeq[Webhook],
  // This is if the data in the dump, is just test data and can be deleted.
  // This might be different from if the server runs in Test mode, or if
  // we're upserting via an e2e test endpoint or not — see importRealSiteData()
  // in tests/e2e/  [06KWFNDS2].
  isTestSiteOkDelete: Boolean = false,
  isTestSiteIndexAnyway: Boolean = false) {

  /* MISSING:
 public | audit_log3              | table    | edc
 public | backup_test_log3        | table    | edc
 public | blocks3                 | table    | edc
 public | emails_out3             | table    | edc  [4023SRKG5]
 public | index_queue3            | table    | edc
 public | page_html_cache_t       | table    | edc  — can skip, is a cache
 public | post_read_stats3        | table    | edc
 public | post_revisions3         | table    | edc
 public | post_tags3              | table    | edc
 public | spam_check_queue3       | table    | edc
 public | tag_notf_levels3        | table    | edc
 public | upload_refs3            | table    | edc
 public | uploads3                | table    | edc
  */

  def theSite: SiteInclDetails = site.getOrDie("TyE053KKPSA6")

  def toSimpleJson(siteDao: ReadOnlySiteDao): JsObject = {
    SitePatchMaker.createPostgresqlJsonBackup(
      anyDump = Some(this),
      simpleFormat = true,
      anyDao = Some(siteDao))
  }

  def toPatchJson: JsObject = {
    SitePatchMaker.createPostgresqlJsonBackup(anyDump = Some(this), simpleFormat = false)
  }

  /** For tests. */
  def withVersionPlusOne: SitePatch = copy(
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
      posts.length >= many * 2 ||  // since at least 2 posts per page: title and body [SOMNYPSTS]
      postActions.length >= many ||
      links.length >= many ||
      permsOnPages.length >= many ||
      reviewTasks.length >= many ||
      webhooks.length >= many
  }
}


case class UpsertOptions(
  // Default: false, send no notfs. [TyT3BG05KTJ2]
  sendNotifications: Option[Boolean])


object SitePatch {
  val empty: SitePatch = SitePatch(
    upsertOptions = None,
    site = None,
    settings = None,
    apiSecrets = Vector.empty,
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
    links = Vector.empty,
    permsOnPages = Vector.empty,
    reviewTasks = Vector.empty,
    webhooks = Vector.empty)
}



/** REFACTOR  Change SimpleSitePatch to a ActionPatch? [ACTNPATCH] **edit: ActionBatch?
  * see below**   and do *not*
  * generate a SitePatch to import — instead, iterate through the things
  * in the ActionPatch and call the correct Dao functions to make things
  * happen in the same way as if people were doing things via their web client.
  * All in the same transaction.
  *
  * Hmm, instead: ActionBatch = a group of actions/commands to do:
  * (and does nothing, if there's an insertion conflict for example
  * — and returns info about what was, and wasn't, done.)
  *
  * POST /-/v0/do-action-batch    or just:  /-/v0/act  or  /-/v0/do-batch   /do  /do-something ?
  * Update: Seems will be  /-/v0/batch-do,  see  pub-api.ts.
  * {
  *   actionBatch: [{   // or actionGroups? no, "group" is also used for user groups
  *     sendDirectMessages: [{ from: ... , to: ..., text: ..., textFormatLang: ... }],
  *     createCategories: ...,
  *     createPages: [{ ...a chat page ...}],
  *     actionOptions: {
  *       generateNotifications: false,
  *     },
  *   },
  *   {
  *     createPosts: [{ ... a chat message ...}],
  *     actionOptions: {
  *       generateNotifications: true,
  *     },
  *   }]
  * }
  *
  * Or:
  *   actionGroups: [{
  *     editPosts: [{ ... ]}
  *   }]
  *
  *   actionGroups: [{
  *     deletePosts: [{ ... ]}
  *   }]
  *
  */
case class SimpleSitePatch(
  upsertOptions: Option[UpsertOptions] = None,
  categoryPatches: immutable.Seq[CategoryPatch] = Nil,
  pagePatches: immutable.Seq[SimplePagePatch] = Nil,
  postPatches: immutable.Seq[SimplePostPatch] = Nil) {


  def loadThingsAndMakeComplete(dao: SiteDao): SitePatch Or ErrorMessage = {
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
    *
    * REFACTOR [ACTNPATCH] Instead of the above, have a class ActionBatchDoer that
    * live-applies all changes in an ActionBatch, without constructing an intermediate
    * SitePatch.
    */
  def makeComplete(dao: ReadOnlySiteDao): SitePatch Or ErrorMessage = {  // why not a r/o tx?
    var nextCategoryId = LowestTempImpId
    var nextPageId = LowestTempImpId
    var nextPostId = LowestTempImpId
    val nextPostNrByPage = mutable.HashMap[PageId, PostNr]().withDefaultValue(LowestTempImpId)
    val now = dao.now()

    // This works with the current users of the API — namely, upserting categories.
    val categories = mutable.ArrayBuffer[Category]()
    val pages = mutable.ArrayBuffer[PageMeta]()
    val pagePaths = mutable.ArrayBuffer[PagePathWithId]()
    val pageParticipants = mutable.ArrayBuffer[PageParticipant]()
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
        doVoteStyle = None,                              // for now
        doVoteInTopicList = None,                        // for now
        unlistCategory = false,                          // for now
        unlistTopics = false,                            // for now
        includeInSummaries = IncludeInSummaries.Default, // for now
        createdAt = now.toJavaDate,
        updatedAt = now.toJavaDate))

      permsOnPages.append(ForumDao.makeEveryonesDefaultCategoryPerms(nextCategoryId))

      // Wait, don't enable this yet — would need to update many many tests:
      //permsOnPages.append(ForumDao.makeFullMembersDefaultCategoryPerms(nextCategoryId))

      permsOnPages.append(ForumDao.makeStaffCategoryPerms(nextCategoryId))

      appendPage(
        pageExtId = categoryPatch.extImpId.map(_ + "_about_page"),
        pageType = PageType.AboutCategory,
        pageSlug = "about-" + theCategorySlug,
        authorId = SysbotUserId,
        pageMemberRefs = Nil,
        categoryId = Some(nextCategoryId),
        titlePostExtId = categoryPatch.extImpId.map(_ + "_about_page_title"),
        // Sync the title with CategoryToSave [G204MF3]
        titleHtmlUnsafe = s"Description of the $theCategoryName category",
        bodyPostExtId = categoryPatch.extImpId.map(_ + "_about_page_body"),
        bodySource = theCategoryDescription,
        bodyMarkupLang = Some(MarkupLang.Html))
        .badMap { problem => return Bad(problem) }
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
        pageMemberRefs = pagePatch.pageMemberRefs,
        categoryId = category.map(_.id),
        titlePostExtId = Some(pagePatch.extId + "_title"),
        titleHtmlUnsafe = pagePatch.title,
        bodyPostExtId = Some(pagePatch.extId + "_body"),
        bodySource = pagePatch.bodySource,
        bodyMarkupLang = pagePatch.bodyMarkupLang)
        .badMap { problem => return Bad(problem) }
    }


    def appendPage(
      pageExtId: Option[ExtId],
      pageType: PageType,
      pageSlug: String,
      authorId: UserId,
      pageMemberRefs: Seq[ParsedRef],
      categoryId: Option[CategoryId],
      titleHtmlUnsafe: String,
      titlePostExtId: Option[ExtId],
      bodySource: String,
      bodyPostExtId: Option[ExtId],
      bodyMarkupLang: Option[MarkupLang]): Unit Or ErrorMessage = {

      // Page already exists?
      val pageMetaInDb: Option[PageMeta] =
        pageExtId.flatMap(extId => dao.getPageMetaByExtId(extId))

      // For now, not decided what to do if the upserted page is different from
      // the one in the database. Overwrite or not?
      if (pageMetaInDb.isDefined) {
        return Good(())
      }

      // (Always picks the Else branch, as of now)
      val pageMeta: PageMeta = pageMetaInDb getOrElse {
        nextPageId += 1
        PageMeta.forNewPage(
          extId = pageExtId,
          pageId = nextPageId.toString,
          pageRole = pageType,
          authorId = authorId,
          creationDati = now.toJavaDate,
          numPostsTotal = 2,
          categoryId = categoryId,
          publishDirectly = true)
      }

      pages.append(pageMeta)

      pagePaths.append(PagePathWithId(
        folder = "/",
        pageId = nextPageId.toString,
        showId = true,
        pageSlug = pageSlug,
        canonical = true))

      // Dupl code [IMPCORH]
      val bodyHtmlSanitized =
        if (bodyMarkupLang is MarkupLang.Html) {
          TextAndHtml.sanitizeRelaxed(bodySource)
        }
        else {
          val postRenderSettings = dao.makePostRenderSettings(pageMeta.pageType)
          val textAndHtml = dao.textAndHtmlMaker.forBodyOrComment(
                bodySource, embeddedOriginOrEmpty = postRenderSettings.embeddedOriginOrEmpty,
                followLinks = false)
          textAndHtml.safeHtml
        }

      val titleHtmlSanitized = TextAndHtml.sanitizeTitleText(titleHtmlUnsafe)

      nextPostId += 1
      val titlePost = Post(  // dupl code, use Post.create() instead [DUPPSTCRT]
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
        numTimesRead = 0,
        // SHOULD maybe init smtpMsgIdPrefix here? But isn't nextPageId a temp id,
        // so too early to do?  So skip, for now:  [init_smtp_msg_id]
        // smtpMsgIdPrefix = Some(s"${nextPageId.toString}.${PageParts.TitleNr}")
        smtpMsgIdPrefix = None,
        )

      nextPostId += 1
      val bodyPost = titlePost.copy(
        id = nextPostId,
        extImpId = bodyPostExtId,
        nr = PageParts.BodyNr,
        approvedSource = Some(bodySource),
        approvedHtmlSanitized = Some(bodyHtmlSanitized))

      posts.append(titlePost)
      posts.append(bodyPost)

      // Members to join the page?
      pageMemberRefs foreach { ref: ParsedRef =>
        // Currently cannot create members and add to page at the same time. [JB205KDN]
        val pp: Participant = dao.getParticipantByParsedRef(ref) getOrElse {
          return Bad(s"No member matching ref $ref, for page extId '$pageExtId' [TyE40QMSJV3]")
        }
        throwForbiddenIf(pp.isGuest, "TyE502QK4JV", "Cannot add guests to page")
        throwForbiddenIf(pp.isBuiltIn, "TyE7WKCT24GT", "Cannot add built-in users to page")
        // For now at least:
        throwForbiddenIf(pp.isGroup, "TyE602RKNP35", "Currently cannot add groups to page")

        pageParticipants.append(  // [UPSPAMEM]
          PageParticipant(
            pageId = pageMeta.pageId,
            userId = pp.id,
            addedById = Some(SysbotUserId),  // change to isMember: true/false
            removedById = None,
            inclInSummaryEmailAtMins = 0,
            readingProgress = None))
      }

      Good(())
    }


    // ----- Upsert posts

    for (postPatch: SimplePostPatch <- postPatches) {
      val pageInDb: Option[PageMeta] = dao.getPageMetaByParsedRef(postPatch.pageRef)
      val pageInPatch: Option[PageMeta] = getPageMetaInPatchByParsedRef(postPatch.pageRef)

      // Is any page in the database the same as the one in the patch?
      (pageInDb, pageInPatch) match {
        case (Some(thePageInDb), Some(thePageInPatch)) =>
          if (thePageInDb.extImpId != thePageInPatch.extImpId)
            return Bad(o"""The supposedly same page in db as the one in the patch,
              have different extId:s, so they are *not* the same page:
              ext id in db: '${thePageInDb.extImpId}',
              in the patch: '${thePageInPatch.extImpId}'
              whole page in db: $thePageInDb,
              whole page in patch: $thePageInPatch
              [TyE05MRKJ6]""")

          if (!isPageTempId(thePageInPatch.pageId) &&
            thePageInPatch.pageId != thePageInDb.pageId)
            return Bad(o"""The supposedly same page in db as the one in the patch,
              have different ids, so they are *not* the same page:
              page id in db: '${thePageInDb.pageId}',
              in patch: '${thePageInPatch.pageId}'
              whole page in db: $thePageInDb,
              whole page in patch: $thePageInPatch
              [TyE7KDQ42K2]""")

        case _ =>
      }

      val pageMeta = pageInDb.orElse(pageInPatch) getOrElse {
        return Bad(s"Page missing: '${postPatch.pageRef}' [TyE406WKDGF4]")
      }

      val pageId = pageMeta.pageId
      val postNr = nextPostNrByPage(pageId)

      nextPostNrByPage(pageId) = postNr + 1

      val parentPostInDb: Option[Post] = postPatch.parentNr flatMap { pNr =>
        if (pNr >= FirstTempImpId || isPageTempId(pageId)) None
        else dao.loadPostByPageIdNr(pageId, pNr)
      }

      val parentPostInPatch: Option[Post] = postPatch.parentNr.flatMap(pNr =>
        getPostInPatchByPageIdNr(pageId, pNr))

      val parentPost = parentPostInDb orElse parentPostInPatch

      val author = dao.getParticipantByParsedRef(postPatch.authorRef)  getOrElse {
        return Bad(s"Author not found: '${postPatch.authorRef}' [TyE502KTDXG52]")
      }

      // Dupl code [IMPCORH]
      val htmlSanitized =
        if (postPatch.bodyMarkupLang is MarkupLang.Html) {
          TextAndHtml.sanitizeRelaxed(postPatch.bodySource)
        }
        else {
          val postRenderSettings = dao.makePostRenderSettings(pageMeta.pageType)
          val textAndHtml = dao.textAndHtmlMaker.forBodyOrComment(
                postPatch.bodySource,
                embeddedOriginOrEmpty = postRenderSettings.embeddedOriginOrEmpty,
                followLinks = false)
          textAndHtml.safeHtml
        }

      val post = Post.create(
            uniqueId = nextPostId,
            extImpId = Some(postPatch.extId),
            pageId = pageId,
            postNr = postNr,
            parent = parentPost,
            multireplyPostNrs = Set.empty,
            postType = postPatch.postType,
            createdAt = now.toJavaDate,
            createdById = author.id,
            source = postPatch.bodySource,
            htmlSanitized = htmlSanitized,
            approvedById = Some(SysbotUserId))

      posts.append(post)
    }


    // ----- Helper fns

    def getPageMetaInPatchByParsedRef(ref: ParsedRef): Option[PageMeta] = {
      ref match {
        case ParsedRef.ExternalId(extId) =>
          pages.find(_.extImpId is extId)
        case ParsedRef.TalkyardId(id) =>
          pages.find(_.pageId == id)
        case wrongRefType =>
          throwForbidden("TyE603RKJGL5", s"Wrong SimplePagePatch ref type: $wrongRefType")
      }
    }

    def getPostInPatchByPageIdNr(pageId: PageId, postNr: PostNr): Option[Post] = {
      posts.find(p => p.pageId == pageId && p.nr == postNr)
    }


    // ----- The result

    val result = SitePatch.empty.copy(
      upsertOptions = upsertOptions,
      categories = categories.toVector,
      pages = pages.toVector,
      pagePaths = pagePaths.toVector,
      pageParticipants = pageParticipants.toVector,
      posts = posts.toVector,
      permsOnPages = permsOnPages.toVector)

    Good(result)
  }
}
