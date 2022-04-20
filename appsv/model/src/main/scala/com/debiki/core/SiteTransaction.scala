/**
 * Copyright (C) 2015 Kaj Magnus Lindberg
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

package com.debiki.core

import java.net.InetAddress
import java.{util => ju}
import scala.collection.immutable
import scala.{collection => col}
import Prelude._


trait SiteTransaction {   RENAME // to SiteTx — already started with a type SiteTx = this
  def commit(): Unit
  def rollback(): Unit
  def hasBeenRolledBack: Boolean

  def siteId: SiteId

  def setSiteId(id: SiteId): Unit

  /** Continues using the same connection. */
  def asSystem: SystemTransaction

  def now: When

  def deferConstraints(): Unit

  // clearStaleStuffInDatabase(staleStuff)

  def loadSite(): Option[Site]
  def loadSiteInclDetails(): Option[SiteInclDetails]
  def bumpSiteVersion(): Unit
  def updateSite(changedSite: Site): Unit


  // Try to remove, use sth more generic like insertUser()? or insertGuest() instead?
  def createUnknownUser(): Unit

  def loadSiteVersion(): Int

  def loadSiteSettings(): Option[EditedSettings]
  def upsertSiteSettings(settings: SettingsToSave): Unit

  def loadHostsInclDetails(): Seq[HostnameInclDetails]
  def insertSiteHost(host: Hostname): Unit
  def updateHost(host: Hostname): Unit
  def changeCanonicalHostRoleToExtra(): Unit
  def changeExtraHostsRole(newRole: Hostname.Role): Unit

  def loadResourceUsage(): ResourceUse

  def loadAdminNotices(): ImmSeq[Notice]
  def addAdminNotice(noticeId: NoticeId): U


  def loadCategory(categoryId: CategoryId): Option[Category]
  def loadCategoryMap(): Map[CategoryId, Category]

  RENAME // to loadAncestorCatsRootLast?
  def loadCategoryPathRootLast(anyCatId: Opt[CatId], inclSelfFirst: Bo): ImmSeq[Cat] = {
    loadCategoryPathRootLast(
          anyCatId.getOrElse({ return Nil }), inclSelfFirst = inclSelfFirst)
  }
  def loadCategoryPathRootLast(categoryId: CatId, inclSelfFirst: Bo): ImmSeq[Cat]

  def nextCategoryId(): Int
  def insertCategoryMarkSectionPageStale(cat: Cat, mab: MessAborter): U
  def updateCategoryMarkSectionPageStale(cat: Cat, mab: MessAborter): U
  def loadAboutCategoryPageId(categoryId: CategoryId): Option[PageId]

  def loadPost(uniquePostId: PostId): Option[Post]   ; RENAME; QUICK // to loadPostById
  def loadThePost(uniquePostId: PostId): Post =     // RENAME; QUICK // to loadPostById
    loadPost(uniquePostId).getOrElse(throw PostNotFoundByIdException(uniquePostId))

  def loadPost(which: PagePostNr): Option[Post] = loadPost(which.pageId, which.postNr) ; RENAME; QUICK // to loadPostByNr
  def loadPost(pageId: PageId, postNr: PostNr): Option[Post]                           ; RENAME; QUICK // to loadPostByNr
  def loadThePost(which: PagePostNr): Post = loadThePost(which.pageId, which.postNr)   ; RENAME; QUICK // to loadThePostByNr
  def loadThePost(pageId: PageId, postNr: PostNr): Post =                             // RENAME; QUICK // to loadThePostByNr
    loadPost(pageId, postNr).getOrElse(throw PostNotFoundException(pageId, postNr))

  /** Also see: [[loadTitlesPreferApproved()]]  */
  def loadTitleAndOrigPost(pageId: PageId): Seq[Post] =
    loadPostsByNrs(Seq(PagePostNr(pageId, PageParts.TitleNr), PagePostNr(pageId, PageParts.BodyNr)))

  /** Also see: [[loadTitlesPreferApproved()]]  */
  def loadTitle(pageId: PageId): Option[Post] =
    loadPostsByNrs(Seq(PagePostNr(pageId, PageParts.TitleNr))).headOption

  def loadOrigPost(pageId: PageId): Option[Post] =
    loadPostsByNrs(Seq(PagePostNr(pageId, PageParts.BodyNr))).headOption

  def loadTheOrigPost(pageId: PageId): Post =
    loadOrigPost(pageId).getOrDie("TyE204RKT1J", s"s$siteId: OP missing, page $pageId")

  def loadOrigPostAndLatestPosts(pageId: PageId, limit: Int): Seq[Post]
  def loadPostsOnPage(pageId: PageId): Vec[Post]
  def loadPostsByNrs(pagePostNrs: Iterable[PagePostNr]): immutable.Seq[Post]
  def loadPostsByUniqueId(postIds: Iterable[PostId]): immutable.Map[PostId, Post]     ; RENAME; QUICK // to loadPostsByIds
  def loadPostsByExtIdAsMap(extImpIds: Iterable[ExtId]): immutable.Map[ExtId, Post]

  def loadAllPosts(): immutable.Seq[Post]
  def loadAllUnapprovedPosts(pageId: PageId, limit: Int): immutable.Seq[Post]
  def loadUnapprovedPosts(pageId: PageId, by: UserId, limit: Int): immutable.Seq[Post]
  def loadCompletedForms(pageId: PageId, limit: Int): immutable.Seq[Post]

  /** Loads the most Like voted posts, per page.
    * (Excluding posts with Unwanted votes or pending flags, and collapsed/hidden/deleted posts.)
    */
  def loadPopularPostsByPage(pageIds: Iterable[PageId], limitPerPage: Int, exclOrigPost: Boolean)
        : Map[PageId, immutable.Seq[Post]]

  def loadApprovedOrigPostAndRepliesByPage(pageIds: Iterable[PageId]): Map[PageId, immutable.Seq[Post]]

  def loadPostsToReview(): immutable.Seq[Post]

  // Later all these params can be a ListPostsQuery instead.
  // Also, these params:  includeDeleted,  includeHidden.
  //    includeChatMessages: Boolean,  onlyUnapproved: Boolean,
  //    onPageId: Option[PageId]
  def loadPostsByQuery(limit: Int, orderBy: OrderBy, byUserId: Option[UserId],
        includeTitlePosts: Boolean, inclUnapprovedPosts: Boolean,
        inclUnlistedPagePosts_unimpl: Boolean): immutable.Seq[Post]

  def loadEmbeddedCommentsApprovedNotDeleted(limit: Int, orderBy: OrderBy): immutable.Seq[Post]

  /** Also see: [[loadTitle()]] and [[loadTitleAndOrigPost()]]. */
  def loadTitlesPreferApproved(pageIds: Iterable[PageId]): Map[PageId, String] = {
    val titlePosts = loadPostsByNrs(pageIds.map(PagePostNr(_, PageParts.TitleNr)))
    Map(titlePosts.map(post => {
      post.pageId -> post.approvedSource.getOrElse(post.currentSource)
    }): _*)
  }

  def nextDraftNr(userId: UserId): DraftNr
  def upsertDraft(draft: Draft): Unit
  def deleteDraft(userId: UserId, draftNr: DraftNr): Boolean
  def loadAllDrafts(): immutable.Seq[Draft]
  def loadDraftByNr(userId: UserId, draftNr: DraftNr): Option[Draft]
  def loadDraftsByUserOnPage(userId: UserId, pageId: PageId): immutable.Seq[Draft]
  def loadDraftsByLocator(userId: UserId, draftLocator: DraftLocator): immutable.Seq[Draft]
  def listDraftsRecentlyEditedFirst(userId: UserId, limit: Int): immutable.Seq[Draft]

  def nextPostId(): PostId
  def insertPost(newPost: Post): Unit
  def updatePost(newPost: Post): Unit

  /** We index any approed text, or the unapproved source, see:
    * [[ed.server.search.makeElasticSearchJsonDocFor]]. [ix_unappr]
    */
  def indexPostsSoon(posts: Post*): Unit
  def indexAllPostsOnPage(pageId: PageId): Unit
  def indexPagesSoon(pageMeta: PageMeta*): Unit

  def insertSpamCheckTask(spamCheckTask: SpamCheckTask): Unit
  def loadSpamCheckTasksWaitingForHumanLatestLast(postId: PostId): immutable.Seq[SpamCheckTask]
  def updateSpamCheckTaskForPostWithResults(spamCheckTask: SpamCheckTask): Unit

  // Rename to insert/loadPageMemberIds? [rename]
  def insertMessageMember(pageId: PageId, userId: UserId, addedById: UserId): Boolean
  def removePageMember(pageId: PageId, userId: UserId, removedById: UserId): Boolean
  def removeDeletedMemberFromAllPages(userId: UserId): Unit

  def loadMessageMembers(pageId: PageId): Set[UserId]

  def loadAnyPrivateGroupTalkMembers(pageMeta: PageMeta): Set[UserId] = {
    if (pageMeta.pageType.isPrivateGroupTalk)
      loadMessageMembers(pageMeta.pageId)
    else
      Set.empty
  }

  // Returns recently active pages first.
  def loadPagePostNrsByPostIds(postIds: Iterable[PostId]): Map[PostId, PagePostNr]
  def loadPageIdsWithVisiblePostsBy(patIds: Set[PatId], limit: i32): Set[PageId]
  def loadPageIdsUserIsMemberOf(userAndGroupIds: Seq[MemId], onlyPageRoles: Set[PageType]): ImmSeq[PageId]
  def loadReadProgress(userId: UserId, pageId: PageId): Option[PageReadingProgress]
  def loadReadProgressAndIfHasSummaryEmailed(userId: UserId, pageId: PageId)
        : (Option[PageReadingProgress], Boolean)
  def upsertReadProgress(userId: UserId, pageId: PageId, pageTimings: PageReadingProgress): Unit
  def rememberHasIncludedInSummaryEmail(userId: UserId, pageId: PageId, now: When): Unit

  def loadAllPageParticipantsAllPages(): immutable.Seq[PageParticipant]
  def insertPageParticipant(pagePp: PageParticipant): Unit

  def loadPageVisitTrusts(pageId: PageId): Map[UserId, VisitTrust]

  def loadAllPagePopularityScores(): Seq[PagePopularityScores]
  def loadPagePopularityScore(pageId: PageId): Option[PagePopularityScores]
  def upsertPagePopularityScore(scores: PagePopularityScores): Unit

  def loadLastPostRevision(postId: PostId): Option[PostRevision]
  def loadPostRevision(postId: PostId, revisionNr: Int): Option[PostRevision]
  def insertPostRevision(revision: PostRevision): Unit
  def updatePostRevision(revision: PostRevision): Unit

  // Also see: loadVoterIds(postId) and  listUsernamesOnPage(pageId)
  def loadAuthorIdsByPostId(postIds: Set[PostId]): Map[PostId, UserId]

  def loadActionsOnPage(pageId: PageId): immutable.Seq[PostAction]
  def loadActionsByUserOnPage(userId: UserId, pageId: PageId): immutable.Seq[PostAction]
  def loadActionsDoneToPost(pageId: PageId, postNr: PostNr): immutable.Seq[PostAction]
  def loadAllPostActions(): immutable.Seq[PostAction]
  def insertPostAction(postAction: PostAction): Unit

  def deleteVote(pageId: PageId, postNr: PostNr, voteType: PostVoteType, voterId: UserId): Boolean
  /** Loads the first X voter ids, sorted by ... what? Currently loads all. [1WVKPW02]
    * Also see: loadAuthorIdsByPostId() */
  def loadVoterIds(postId: PostId, voteType: PostVoteType): Seq[UserId]

  /** Remembers that the specified posts have been read by a certain user.
    */
  def updatePostsReadStats(pageId: PageId, postNrsRead: Set[PostNr], readById: UserId,
        readFromIp: Opt[IpAdr]): U


  def loadParticipantAndStats(ppId: UserId): (Option[Participant], Option[UserStats]) = {
    val pp = loadParticipant(ppId) getOrElse {
      return (None, None)
    }
    val anyStats = loadUserStats(ppId)
    (Some(pp), anyStats)
  }

  def loadUserStats(userId: UserId): Option[UserStats]
  def loadAllUserStats(): immutable.Seq[UserStats]
  def upsertUserStats(userStats: UserStats): Unit

  /** Also updates the user stats, but avoids races about writing to unrelated fields. */
  def bumpNextSummaryEmailDate(memberId: UserId, nextEmailAt: Option[When]): Unit
  def bumpNextAndLastSummaryEmailDate(memberId: UserId, lastAt: When, nextAt: Option[When]): Unit

  def reconsiderSendingSummaryEmailsTo(memberId: UserId): Unit = {
    // When set to null, the user will be considered for summary emails and marked yes-get or no.
    bumpNextSummaryEmailDate(memberId, nextEmailAt = None)
  }

  /** This will make the server have a look at everyone, and see if it's time to send them
    * summary emails (e.g. because the Everyone group's settings were changed).
    */
  def reconsiderSendingSummaryEmailsToEveryone(): Unit


  def loadAllUserVisitStats(): immutable.Seq[UserVisitStats]
  def loadUserVisitStats(userId: UserId): immutable.Seq[UserVisitStats]
  def upsertUserVisitStats(visitStats: UserVisitStats): Unit

  def loadPostsReadStats(pageId: PageId, postNr: Option[PostNr]): PostsReadStats
  def loadPostsReadStats(pageId: PageId): PostsReadStats
  def movePostsReadStats(oldPageId: PageId, newPageId: PageId,
    newPostNrsByOldNrs: Map[PostNr, PostNr]): Unit

  // ----- Tag types (TagsRdbMixin)
  def nextTagTypeId(): i32
  def loadAllTagTypes(): ImmSeq[TagType]
  def loadTagTypeStats(): ImmSeq[TagTypeStats]
  def upsertTagType(tagType: TagType)(mab: MessAborter): U
  def hardDeleteTagType(tagType: TagType): Bo

  // ----- Tags (TagsRdbMixin)
  def nextTagId(): i32
  def addTag(tag: Tag): U
  def removeTags(tags: Seq[Tag]): U
  def loadTagsByPatId(patIds: PatId): ImmSeq[Tag]
  def loadTagsForPages(pageIds: Iterable[PageId]): Map[PageId, ImmSeq[Tag]]
  def loadPostTagsAndAuthorBadges(postIds: Iterable[PostId]): TagsAndBadges
  def loadTagsToRenderSmallPage(pageId: PageId): Seq[Tag]

  CLEAN_UP ; REMOVE // old tags code
  // -- Old: (TagsSiteDaoMixin) -----
  @deprecated("", "")
  def loadAllTagsAsSet(): Set[TagLabel]
  @deprecated("", "")
  def loadTagsByPostId(postIds: Iterable[PostId]): Map[PostId, Set[TagLabel]]
  @deprecated("", "")
  def loadTagsForPost(postId: PostId): Set[TagLabel] =
    loadTagsByPostId(Seq(postId)).getOrElse(postId, Set.empty)
  @deprecated("", "")
  def removeTagsFromPost(labels: Set[TagLabel], postId: PostId): Unit
  @deprecated("", "")
  def addTagsToPost(labels: Set[TagLabel], postId: PostId, isPage: Boolean): Unit
  @deprecated("", "")
  def renameTag(from: String, to: String): Unit
  @deprecated("", "")
  def setTagNotfLevel(userId: UserId, tagLabel: TagLabel, notfLevel: NotfLevel): Unit
  @deprecated("", "")
  def loadTagNotfLevels(userId: UserId): Map[TagLabel, NotfLevel]
  @deprecated("", "")
  def listUsersWatchingTags(tags: Set[TagLabel]): Set[UserId]
  // --------------------------

  def loadFlagsFor(pagePostNrs: Iterable[PagePostNr]): immutable.Seq[PostFlag]
  def clearFlags(pageId: PageId, postNr: PostNr, clearedById: UserId): Unit

  def nextPageId(): PageId

  def loadAllPageMetas(limit: Option[Int] = None): immutable.Seq[PageMeta]
  def loadPageMeta(pageId: PageId): Option[PageMeta]
  def loadPageMetasAsMap(pageIds: Iterable[PageId], anySiteId: Option[SiteId] = None)
        : Map[PageId, PageMeta]
  def loadThePageMeta(pageId: PageId): PageMeta =
    loadPageMeta(pageId).getOrElse(throw PageNotFoundException(pageId))

  /** Loads meta for all forums, blog and wiki main pages. */
  //def loadPageMetaForAllSections(): Seq[PageMeta]

  def loadOpenChatsPinnedGlobally(): immutable.Seq[PageMeta]

  def loadPageMetas(pageIds: Iterable[PageId]): immutable.Seq[PageMeta]
  def loadPageMetasByExtIdAsMap(extImpIds: Iterable[ExtId]): Map[ExtId, PageMeta]
  def loadPageMetasByAltIdAsMap(altIds: Iterable[AltPageId]): Map[AltPageId, PageMeta]
  def insertPageMetaMarkSectionPageStale(newMeta: PageMeta, isImporting: Bo = false)(
        mab: MessAborter): U

  final def updatePageMeta(newMeta: PageMeta, oldMeta: PageMeta, markSectionPageStale: Boolean): Unit = {
    dieIf(newMeta.pageType != oldMeta.pageType && !oldMeta.pageType.mayChangeRole, "EsE4KU0W2")
    dieIf(newMeta.version < oldMeta.version, "EsE6JKU0D4")
    updatePageMetaImpl(newMeta, oldMeta = oldMeta, markSectionPageStale)
  }
  protected def updatePageMetaImpl(newMeta: PageMeta, oldMeta: PageMeta,
        markSectionPageStale: Boolean): Unit

  def markPagesHtmlStaleIfVisiblePostsBy(patId: PatId): i32
  def markPagesHtmlStale(pageIds: Set[PageId]): Unit
  def markSectionPageContentHtmlAsStale(categoryId: CategoryId): Unit
  def loadCachedPageContentHtml(pageId: PageId, renderParams: PageRenderParams)
        : Option[(String, CachedPageVersion)]
  def upsertCachedPageContentHtml(
        pageId: PageId, version: CachedPageVersion, reactStorejsonString: String, html: String): Unit


  def insertAltPageId(altPageId: AltPageId, realPageId: PageId): Unit
  def insertAltPageIdIfFree(altPageId: AltPageId, realPageId: PageId): Unit
  def deleteAltPageId(altPageId: AltPageId): Unit
  def listAltPageIds(realPageId: PageId): Set[AltPageId]
  def loadRealPageId(altPageId: AltPageId): Option[PageId]
  def loadAllAltPageIds(): Map[AltPageId, PageId]

  def insertPagePath(pagePath: PagePathWithId): Unit

  def loadAllPagePaths(): immutable.Seq[PagePathWithId]
  def loadPagePath(pageId: PageId): Option[PagePathWithId]
  def checkPagePath(pathToCheck: PagePath): Option[PagePath]  // rename? check? load? what?
  /**
    * Loads all PagePaths that map to pageId. The canonical path is placed first
    * and the tail consists only of any redirection paths.
    */
  def lookupPagePathAndRedirects(pageId: PageId): List[PagePathWithId]
  def listPagePaths(pageRanges: PathRanges, include: List[PageStatus],
    orderOffset: PageOrderOffset, limit: Int): Seq[PagePathAndMeta]

  def loadPagesInCategories(categoryIds: Seq[CategoryId], pageQuery: PageQuery, limit: Int)
        : Vec[PagePathAndMeta]

  /** Orders by most recent first. */
  def loadPagesByUser(userId: UserId, isStaffOrSelf: Boolean, limit: Int): Seq[PagePathAndMeta]

  def moveRenamePage(pageId: PageId,
    newFolder: Option[String] = None, showId: Option[Boolean] = None,
    newSlug: Option[String] = None): PagePathWithId


  /** Remembers that a file has been uploaded and where it's located. */
  def insertUploadedFileMeta(uploadRef: UploadRef, sizeBytes: Int, mimeType: String,
        dimensions: Option[(Int, Int)]): Unit
  def deleteUploadedFileMeta(uploadRef: UploadRef): Unit

  /** Uploaded files are referenced via 1) URLs in posts (e.g. `<a href=...> <img src=...>`)
    * and 2) from users, if a file is someone's avatar image.
    */
  def updateUploadedFileReferenceCount(uploadRef: UploadRef): Unit

  /** Remembers that an uploaded file is referenced from this post.
    * This needs to be done also for not-yet-approved posts — otherwise,
    * the uploaded things will seem unused, and get deleted and would
    * then be missing, if the post gets approved, later.  */
  def insertUploadedFileReference(postId: PostId, uploadRef: UploadRef, addedById: UserId): Unit
  def deleteUploadedFileReference(postId: PostId, uploadRef: UploadRef): Boolean
  def loadUploadedFileReferences(postId: PostId): Set[UploadRef]

  def loadSiteIdsUsingUpload(ref: UploadRef): Set[SiteId] =
    loadSiteIdsUsingUploadImpl(ref: UploadRef, onlySiteId = None)

  def isSiteIdUsingUpload(siteId: SiteId, ref: UploadRef): Boolean =
    loadSiteIdsUsingUploadImpl(ref: UploadRef, onlySiteId = Some(siteId)).nonEmpty

  protected def loadSiteIdsUsingUploadImpl(
        ref: UploadRef, onlySiteId: Option[SiteId]): Set[SiteId]

  /** Returns the refs currently in use, e.g. as user avatar images or
    * images / attachments inserted into posts.
    */
  def filterUploadRefsInUse(uploadRefs: Iterable[UploadRef]): Set[UploadRef]
  def updateUploadQuotaUse(uploadRef: UploadRef, wasAdded: Boolean): Unit

  def upsertLinkPreview(linkPreview: LinkPreview): Unit
  def loadLinkPreviewByUrl(linkUrl: String, downloadUrl: String): Option[LinkPreview]
  def loadAllLinkPreviewsByUrl(linkUrl: String): Seq[LinkPreview]
  /** Deletes for all download urls (e.g. downloaded for different screen sizes) */
  def deleteLinkPreviews(linkUrl: String): Int

  def upsertLink(link: Link): Boolean
  def deleteLinksFromPost(postId: PostId, urls: Set[String]): Int
  def deleteAllLinksFromPost(postId: PostId): Int  // needed later, for hard delete?
  def loadAllLinks(): ImmSeq[Link]
  def loadLinksFromPost(postId: PostId): Seq[Link]
  def loadLinksToPage(pageId: PageId): Seq[Link]  // not needed? only called in test suite
  def loadPageIdsLinkedFromPage(pageId: PageId): Set[PageId]
  def loadPageIdsLinkedFromPosts(postIds: Set[PostId]): Set[PageId]
  def loadPageIdsLinkingToPage(pageId: PageId, inclDeletedHidden: Boolean): Set[PageId]

  def insertInvite(invite: Invite): Unit
  def updateInvite(invite: Invite): Boolean
  def forgetInviteEmailSentToAddress(userId: UserId, replaceWithAddr: String): Unit
  def loadInviteBySecretKey(secretKey: String): Option[Invite]
  // COULD RENAME these: append SortByRecentFirst
  def loadInvitesSentTo(emailAddress: String): immutable.Seq[Invite]
  def loadInvitesCreatedBy(createdById: UserId): immutable.Seq[Invite]
  def loadAllInvites(limit: Int): immutable.Seq[Invite]

  def upsertIdentityProvider(identityProvider: IdentityProvider): AnyProblem
  def deleteIdentityProviderById(idpId: IdpId): Bo
  def loadIdentityProviderByAlias(protocol: St, alias: St): Opt[IdentityProvider]
  def loadAllSiteCustomIdentityProviders(): Seq[IdentityProvider]

  def nextIdentityId: IdentityId
  def insertIdentity(Identity: Identity): Unit
  def loadIdentities(userId: UserId): immutable.Seq[Identity]
  def loadAllIdentities(): immutable.Seq[Identity]
  def loadOpenAuthIdentity(key: OpenAuthProviderIdKey): Option[OpenAuthIdentity]
  def deleteAllUsersIdentities(userId: UserId): Unit

  def nextGuestId: UserId
  def insertGuest(guest: Guest): Unit   // should be: GuestDetailed

  def nextMemberId: UserId
  def insertMember(user: UserInclDetails): Unit


  def loadSession(part1Maybe2Or3: Opt[St] = None, hash4HttpOnly: Opt[Array[i8]] = None,
        maybeActiveOnly: Bo = false): Opt[TySessionInDbMaybeBad]
  def loadOneOrTwoSessions(part1Maybe2Or3: Opt[St], hash4HttpOnly: Opt[Array[i8]],
        maybeActiveOnly: Bo): ImmSeq[TySessionInDbMaybeBad]
  def loadActiveSessions(patId: PatId): ImmSeq[TySessionInDbMaybeBad]
  def insertValidSession(session: TySession): U
  def upsertSession(session: TySessionInDbMaybeBad): U

  def tryLoginAsMember(loginAttempt: MemberLoginAttempt, requireVerifiedEmail: Boolean)
        : Hopefully[MemberLoginGrant]
  def loginAsGuest(loginAttempt: GuestLoginAttempt): GuestLoginResult
  def configIdtySimple(ctime: ju.Date, emailAddr: String, emailNotfPrefs: EmailNotfPrefs): Unit

  def loadUserInclDetails(userId: UserId): Option[UserInclDetails] =
    loadMemberInclDetailsById(userId) map {
      case user: UserInclDetails => user
      case group: Group =>
        REFACTOR // instead:  Member.asUserOr(ThrowBadReq)
        throw GotAGroupException(group.id)
    }

  def loadGroup(groupId: UserId): Option[Group] =
    loadGroupInclDetails(groupId) // right now, Group already includes all details

  def loadGroupInclDetails(groupId: UserId): Option[Group] =
    loadMembersVbById(Seq(groupId)).headOption map {
      case m: UserInclDetails => throw GotANotGroupException(m.id)
      case g: Group => g
    }

  def loadAllUsersInclDetails(): immutable.Seq[UserInclDetails]

  def loadMemberInclDetailsById(userId: UserId): Option[MemberInclDetails]

  def loadTheUserInclDetails(userId: UserId): UserInclDetails =
    loadUserInclDetails(userId).getOrElse(throw UserNotFoundException(userId))

  def loadTheGroupInclDetails(userId: UserId): Group =
    loadGroupInclDetails(userId).getOrElse(throw UserNotFoundException(userId))

  def loadTheMemberInclDetails(userId: UserId): MemberInclDetails =
    loadMemberInclDetailsById(userId).getOrElse(throw UserNotFoundException(userId))

  def loadGroups(memberOrGroup: MemberInclDetails): immutable.Seq[Group] = {
    val allGroups = loadAllGroupsAsMap()
    val groupIds = loadGroupIdsMemberIdFirst2(memberOrGroup)
    groupIds.flatMap(allGroups.get)
  }

  // def updateMember(user: Member): Boolean — could add, [6DCU0WYX2]

  def updateMemberInclDetails(member: MemberInclDetails): Unit = {
    member match {
      case g: Group => updateGroup(g)
      case u: UserInclDetails => updateUserInclDetails(u)
    }
  }

  def updateUserInclDetails(user: UserInclDetails): Boolean
  def updateGuest(guest: Guest): Boolean

  def insertUserEmailAddress(userEmailAddress: UserEmailAddress): Unit
  def updateUserEmailAddress(userEmailAddress: UserEmailAddress): Unit
  def deleteUserEmailAddress(userId: UserId, emailAddress: String): Unit
  def deleteAllUsersEmailAddresses(userId: UserId): Unit
  def loadUserEmailAddresses(userId: UserId): Seq[UserEmailAddress] // RENAME to loadMember...
  def loadUserEmailAddressesForAllUsers(): Seq[UserEmailAddress]    // RENAME to loadMember...

  def insertUsernameUsage(usage: UsernameUsage): Unit
  def deleteUsernameUsagesForMemberId(memberId: UserId): Int
  def updateUsernameUsage(usage: UsernameUsage): Unit
  def loadUsersOldUsernames(userId: UserId): Seq[UsernameUsage]
  def loadUsernameUsages(username: String): Seq[UsernameUsage]
  def loadAllUsernameUsages(): Seq[UsernameUsage]
  def isUsernameInUse(username: String): Boolean = loadUsernameUsages(username).nonEmpty

  def loadParticipant(userId: UserId): Option[Participant]
  def loadTheParticipant(userId: UserId): Participant =
    loadParticipant(userId).getOrElse(throw UserNotFoundException(userId))

  def loadAllGuests(): immutable.Seq[Guest]
  def loadAllGuestEmailNotfPrefsByEmailAddr(): Map[String, EmailNotfPrefs]

  def loadGuest(userId: UserId): Option[Guest] = {
    dieIf(userId > Participant.MaxGuestId, "EsE8FY032")
    loadParticipant(userId).map(_.asInstanceOf[Guest])
  }

  def loadTheGuest(userId: UserId): Guest = {
    dieIf(userId > Participant.MaxGuestId, "EsE6YKWU2", userId)
    loadTheParticipant(userId).asInstanceOf[Guest]
  }
  def loadUser(userId: UserId): Option[User] = {
    dieIf(userId <= Participant.MaxGuestId, "EsE2A8ERB3", userId)
    loadParticipant(userId).map(_.toUserOrThrow)
  }
  def loadTheUser(userId: UserId): User = loadUser(userId).getOrDie(
    "TyEFK320FG", s"User $userId missing")

  def loadMember(memberId: UserId): Option[Member] = {
    dieIf(memberId <= Participant.MaxGuestId, "TyE502KTD25", memberId)
    loadParticipant(memberId).map(_.toMemberOrThrow)
  }
  def loadTheMember(memberId: UserId): Member = loadMember(memberId).getOrDie(
    "TyE205THW53", s"Member $memberId missing")

  def isAdmin(userId: UserId): Boolean = loadUser(userId).exists(_.isAdmin)

  def loadParticipants(userIds: Iterable[UserId]): immutable.Seq[Participant]

  def loadTheParticipants(userIds: UserId*): immutable.Seq[Participant] = {
    val usersById = loadParticipantsAsMap(userIds)
    userIds.to[immutable.Seq] map { id =>
      usersById.getOrElse(id, throw UserNotFoundException(id))
    }
  }

  def loadPageRepliers(pageId: PageId, usersOnly: Bo): Seq[User]

  def loadParticipantsAsMap(userIds: Iterable[UserId]): Map[UserId, Participant]

  def loadUsersAsMap(userIds: Iterable[UserId]): Map[UserId, User] = {
    dieIf(userIds.exists(_ <= Participant.MaxGuestId), "EsE5YKG2")
    loadParticipantsAsMap(userIds).mapValues(_.asInstanceOf[User])
  }

  def loadUserByPrimaryEmailOrUsername(emailOrUsername: String): Option[User]
  def loadMemberVbByUsername(username: St): Opt[MemberVb]
  def loadMembersVbByUsername(usernames: Iterable[Username]): ImmSeq[MemberVb]
  def loadUserInclDetailsBySsoId(ssoId: String): Option[UserInclDetails]
  def loadUserInclDetailsByExtId(externalId: String): Option[UserInclDetails]
  def loadUserInclDetailsByEmailAddr(email: String): Option[UserInclDetails]

  def loadUsersWithUsernamePrefix(
    usernamePrefix: String, caseSensitive: Boolean = false, limit: Int = 50): immutable.Seq[User]

  // Also see: loadAuthorIdsByPostId(postIds)
  def listUsernamesOnPage(pageId: PageId): Seq[NameAndUsername]

  def loadAdmins(): immutable.Seq[User] =
    loadStaffUsers().filter(_.isAdmin)

  def loadStaffUsers(): immutable.Seq[User] =
    loadUsers(PeopleQuery(
      orderOffset = PeopleOrderOffset.BySignedUpAtDesc, // order doesn't matter
      peopleFilter = PeopleFilter(onlyStaff = true)))

  def loadUsers(peopleQuery: PeopleQuery): immutable.Seq[User] =
    // For now. (Loads some unneeded things.)
    loadUsersInclDetailsAndStats(peopleQuery).map(_._1.briefUser)

  def loadUsersInclDetailsAndStats(peopleQuery: PeopleQuery)
    : immutable.Seq[(UserInclDetails, Option[UserStats])]

  def loadTheUserInclDetailsAndStatsById(userId: UserId): (UserInclDetails, Option[UserStats]) = {
    COULD_OPTIMIZE // Could write a query that loads both. Reuse loadUsersInclDetailsAndStats?
    val user = loadTheUserInclDetails(userId)
    (user, loadUserStats(user.id))
  }

  def loadUsersInclDetailsById(userIds: Iterable[UserId]): immutable.Seq[UserInclDetails] =
    loadMembersVbById(userIds) map {
      case user: UserInclDetails => user
      case group: Group => throw GotAGroupException(group.id)
    }

  def loadMembersVbByRef(refs: Iterable[PatRef]): ImmSeq[MemberVb]

  def loadMembersVbById(userIds: Iterable[MembId]): ImmSeq[MemberVb]

  def loadParticipantsInclDetailsByIdsAsMap_wrongGuestEmailNotfPerf(ids: Iterable[UserId])
        : immutable.Map[UserId, ParticipantInclDetails]

  def loadParticipantsInclDetailsByExtIdsAsMap_wrongGuestEmailNotfPerf(extImpIds: Iterable[ExtId])
        : immutable.Map[ExtId, ParticipantInclDetails]

  def loadOwner(): Option[UserInclDetails]

  def loadGroupMembers(groupId: GroupId): Vec[Member]
  def loadGroupParticipantsAllCustomGroups(): Vector[GroupParticipant]
  /** Returns the ids of the members that got added (i.e. who were not already members). */
  def addGroupMembers(groupId: UserId, memberIdsToAdd: Set[UserId]): Set[UserId]
  def removeGroupMembers(groupId: UserId, memberIdsToRemove: Set[UserId]): Unit
  def removeAllGroupParticipants(groupId: UserId): Unit
  def removeDeletedMemberFromAllGroups(memberId: UserId): Unit

  def insertGroup(group: Group): Unit
  def deleteGroup(groupId: UserId): Unit
  def updateGroup(group: Group): Unit
  def loadAllGroupsAsSeq(): Vector[Group]
  def loadAllGroupsAsMap(): Map[UserId, Group] = loadAllGroupsAsSeq().map(g => g.id -> g).toMap

  def loadGroupIdsMemberIdFirst(anyUser: Option[Participant]): Vector[UserId] = {
    anyUser.map(loadGroupIdsMemberIdFirst) getOrElse Vector(Group.EveryoneId)
  }

  // Add '2' to the name to avoid a Scala compiler java.lang.StackOverflowError in SBT
  // — there's a similarly named function, with a Participant instead of MemberInclDetails,
  // just below, and the compiler (Scala 2.12.8) crashes if they have the same name.
  // Or was it -J-Xss10m (MB stack size) that solved this?
  def loadGroupIdsMemberIdFirst2(memberOrGroupInclDetails: MemberInclDetails): Vector[UserId] = {
    val memberNoDetails = memberOrGroupInclDetails match {
      case m: UserInclDetails => m.briefUser
      case g: Group => g
    }
    loadGroupIdsMemberIdFirst(memberNoDetails)
  }

  /** Loads ids of groups the member is in. Returns them, prefixed with
    * the members own id, first (guests aren't members; for them,
    * only Vector(EveryoneId) is returned).
    */
  def loadGroupIdsMemberIdFirst(ppt: Participant): Vector[UserId]


  def upsertPageNotfPref(notfPref: PageNotfPref): Unit
  def deletePageNotfPref(notfPref: PageNotfPref): Boolean  // notf level ignored
  // [REFACTORNOTFS] break out to a Dao, and load just for this member, but also all groups it's in?
  def loadPageNotfLevels(peopleId: UserId, pageId: PageId, categoryId: Option[CategoryId]): PageNotfLevels

  def loadAllPageNotfPrefs(): Seq[PageNotfPref]
  def loadPageNotfPrefsOnPage(pageId: PageId): Seq[PageNotfPref]
  def loadPageNotfPrefsOnCategory(categoryId: CategoryId): Seq[PageNotfPref]
  def loadPageNotfPrefsOnSite(): Seq[PageNotfPref]
  def loadNotfPrefsForMemberAboutPage(pageId: PageId, memberIds: Seq[MemberId]): Seq[PageNotfPref]
  def loadNotfPrefsForMemberAboutCatsTagsSite(memberIds: Seq[MemberId]): Seq[PageNotfPref]
  def loadNotfPrefsAboutPagesRepliedTo(memberIds: Seq[MemberId]): Seq[PageNotfPref]


  def saveUnsentEmail(email: Email): Unit
  def saveUnsentEmailConnectToNotfs(email: Email, notfs: Seq[Notification]): Unit
  def updateSentEmail(email: Email): Unit
  def loadEmailByIdOnly(emailId: St): Opt[Email]
  def loadEmailBySecretOrId(emailId: St): Opt[Email]
  def loadEmailsSentTo(userIds: Set[UserId], after: When,
        emailType: EmailType): Map[UserId, Seq[Email]]
  def loadEmailsToPatAboutThread(toPatId: PatId, pageId: PageId,
        parentPostNr: Opt[PostNr], limit: i32): ImmSeq[EmailOut]
  def forgetEmailSentToAddress(userId: UserId, replaceWithAddr: String): Unit

  def nextReviewTaskId(): ReviewTaskId
  def upsertReviewTask(reviewTask: ReviewTask): Unit
  def loadReviewTask(id: ReviewTaskId): Option[ReviewTask]
  def loadReviewTasks(olderOrEqualTo: Option[ju.Date], limit: Int): Seq[ReviewTask]
  def loadAllReviewTasks(): Seq[ReviewTask]
  def loadReviewTasksAboutUser(userId: UserId, limit: Int, orderBy: OrderBy): Seq[ReviewTask]
  def loadReviewTasksAboutPostIds(postIds: Iterable[PostId]): immutable.Seq[ReviewTask]
  def loadReviewTaskCounts(isAdmin: Boolean): ReviewTaskCounts
  def loadPendingPostReviewTask(postId: PostId): Option[ReviewTask]
  def loadUndecidedPostReviewTask(postId: PostId, taskCreatedById: UserId): Option[ReviewTask]

  def nextNotificationId(): NotificationId
  def saveDeleteNotifications(notifications: Notifications): Unit
  def deleteAnyNotification(toDelete: NotificationToDelete): Unit = {
    saveDeleteNotifications(Notifications(toDelete = immutable.Seq(toDelete)))
  }

  def updateNotificationSkipEmail(notifications: Seq[Notification]): Unit

  /** To mark all as seen, use notfId None. */
  def markNotfsAsSeen(userId: UserId, notfId: Option[NotificationId], skipEmails: Boolean): Unit
  def markNotfsForPostIdsAsSeen(userId: UserId, postIds: Set[PostId], skipEmails: Boolean): Int

  def loadAllNotifications(): immutable.Seq[Notification]

  def loadNotificationByEmailId(emailId: EmailOutId): Opt[Notf]

  /** This skips review tasks notfs — they're shown in the admin area instead, the review tab. */
  def loadNotificationsToShowInMyMenu(roleId: RoleId, limit: Int, unseenFirst: Boolean,
    skipDeleted: Boolean, upToWhen: Option[ju.Date] = None): Seq[Notification]

  def loadNotificationsAboutPost(postId: PostId, notfType: NotificationType,
        toPpId: Option[UserId] = None): Seq[Notification]
  def listUsersNotifiedAboutPost(postId: PostId): Set[UserId]
  /** Useful when writing tests. */
  def countNotificationsPerUser(): Map[UserId, Int]


  /** If no id, assigns an id. Returns the perms, with id. */
  def insertPermsOnPages(permsOnContent: PermsOnPages): PermsOnPages
  def updatePermsOnPages(permsOnContent: PermsOnPages): Unit
  def deletePermsOnPages(ids: Iterable[PermissionId]): Unit
  def loadPermsOnPages(): immutable.Seq[PermsOnPages]
  def loadPermsOnCategory(categoryId: CategoryId): immutable.Seq[PermsOnPages] = {
    COULD_OPTIMIZE // could filter in db query instead
    loadPermsOnPages().filter(_.onCategoryId.is(categoryId))
  }


  def startAuditLogBatch(): Unit
  /** Returns (entry-id, Option(batch-id)). */
  def nextAuditLogEntryId(): (AuditLogEntryId, Option[AuditLogEntryId])
  def insertAuditLogEntry(entry: AuditLogEntry): Unit
  def loadCreatePostAuditLogEntry(postId: PostId): Option[AuditLogEntry]
  def loadCreatePostAuditLogEntriesBy(browserIdData: BrowserIdData, limit: Int, orderBy: OrderBy)
        : Seq[AuditLogEntry]

  // For now. Later, own table?
  def loadEventsFromAuditLog(limit: i32, newerOrAt: Opt[When] = None,
        newerThanEventId: Opt[EventId] = None, olderOrAt: Opt[When] = None,
        newestFirst: Bo)
        : immutable.Seq[AuditLogEntry]

  def loadAuditLogEntries(userId: Opt[PatId], types: ImmSeq[AuditLogEntryType],
        newerOrAt: Opt[When], newerThanEventId: Opt[EventId],
        olderOrAt: Opt[When], newestFirst: Bo, limit: i32,
        inclForgotten: Bo): immutable.Seq[AuditLogEntry]

  def loadBlocks(ip: String, browserIdCookie: Option[String]): immutable.Seq[Block]
  def insertBlock(block: Block): Unit
  def unblockIp(ip: InetAddress): Unit
  def unblockBrowser(browserIdCookie: String): Unit

  def loadWebhook(id: WebhookId): Opt[Webhook]
  def loadAllWebhooks(): ImmSeq[Webhook]
  def upsertWebhook(webhook: Webhook): U
  def updateWebhookState(webhook: Webhook): U
  def deleteWebhook(webhookId: WebhookId): U
  def loadWebhookReqsOutRecentFirst(webhookId: WebhookId, limit: i32): ImmSeq[WebhookReqOut]
  def loadWebhookReqsOutRecentFirst(limit: i32): ImmSeq[WebhookReqOut]
  def insertWebhookReqOut(reqOut: WebhookReqOut): U
  def updateWebhookReqOutWithResp(reqOut: WebhookReqOut): U

  def nextApiSecretNr(): DraftNr
  def insertApiSecret(secret: ApiSecret): Unit
  def setApiSecretDeleted(secretNr: ApiSecretNr, when: When): Boolean
  def loadApiSecretBySecretKey(secretKey: String): Option[ApiSecret]
  def listApiSecretsRecentlyCreatedFirst(limit: Int): immutable.Seq[ApiSecret]
}


/** Include stack trace, so can find bugs. (So don't use QuickMessageException). */
case class GotAGroupException(groupId: UserId) extends Exception(
  s"Got a group when trying to load member $groupId [EdE2SBA4J7]")

case class GotANotGroupException(groupId: UserId) extends Exception(
  s"Got a not-group when trying to load group $groupId [EdE4GW1WA9]")

case class GotAGuestException(groupId: UserId, errCode: St = "") extends Exception(
  s"Got a guest when trying to load member $groupId [TyEGOTGST${dashErr(errCode)}]")

// COULD incl errCode
case object GotUnknownUserException extends Exception

case class UserNotFoundException(userId: UserId) extends QuickMessageException(
  s"User or group found by id: $userId")
case class PageNotFoundException(pageId: PageId) extends QuickMessageException(
  s"Page found by id: $pageId")
case class PostNotFoundException(pageId: PageId, postNr: PostNr) extends QuickMessageException(
  s"Post not found by nr, page, post: $pageId, $postNr")
case class PostNotFoundByIdException(postId: PostId) extends QuickMessageException(
  s"Post not found by id: $postId")


case class TagsAndBadgesSinglePosts(
  tags: Seq[Tag],
  badges: Seq[Tag])

case class TagsAndBadges(
  tags: col.Map[PostId, col.Seq[Tag]],
  badges: col.Map[PatId, col.Seq[Tag]]) {

  def tagTypeIds: Set[TagTypeId] =
    tags.values.flatMap(_.map(_.tagTypeId)).toSet ++
    badges.values.flatMap(_.map(_.tagTypeId)).toSet
}

object TagsAndBadges {
  val None: TagsAndBadges = TagsAndBadges(Map.empty, Map.empty)
}
