/**
 * Copyright (C) 2015 Kaj Magnus Lindberg (born 1979)
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
import com.debiki.core.EmailNotfPrefs._
import scala.collection.immutable
import Prelude._


trait SiteTransaction {
  def commit()
  def rollback()
  def hasBeenRolledBack: Boolean

  def siteId: SiteId

  def setSiteId(id: SiteId)

  /** Continues using the same connection. */
  def asSystem: SystemTransaction

  @deprecated("now", "Use Globals.now() instead, so auto tests can fast forward time")
  def now: When

  def deferConstraints()


  def loadSite(): Option[Site]
  def bumpSiteVersion()
  def updateSite(changedSite: Site)


  // Try to remove, use sth more generic like insertUser()? or insertGuest() instead?
  def createUnknownUser()

  def loadSiteVersion(): Int

  def loadSiteSettings(): Option[EditedSettings]
  def upsertSiteSettings(settings: SettingsToSave)

  def loadHostsInclDetails(): Seq[SiteHostInclDetails]
  def insertSiteHost(host: SiteHost)
  def changeCanonicalHostRoleToExtra()
  def changeExtraHostsRole(newRole: SiteHost.Role)

  def loadResourceUsage(): ResourceUse

  def loadCategory(categoryId: CategoryId): Option[Category]
  def loadCategoryMap(): Map[CategoryId, Category]
  def loadCategoryPathRootLast(anyCategoryId: Option[CategoryId]): immutable.Seq[Category] = {
    loadCategoryPathRootLast(anyCategoryId.getOrElse({ return Nil }))
  }
  def loadCategoryPathRootLast(categoryId: CategoryId): immutable.Seq[Category]
  def nextCategoryId(): Int
  def insertCategoryMarkSectionPageStale(category: Category)
  def updateCategoryMarkSectionPageStale(category: Category)
  def loadAboutCategoryPageId(categoryId: CategoryId): Option[PageId]

  def loadPost(uniquePostId: PostId): Option[Post]
  def loadThePost(uniquePostId: PostId): Post =
    loadPost(uniquePostId).getOrElse(throw PostNotFoundByIdException(uniquePostId))

  def loadPost(which: PagePostNr): Option[Post] = loadPost(which.pageId, which.postNr)
  def loadPost(pageId: PageId, postNr: PostNr): Option[Post]
  def loadThePost(which: PagePostNr): Post = loadThePost(which.pageId, which.postNr)
  def loadThePost(pageId: PageId, postNr: PostNr): Post =
    loadPost(pageId, postNr).getOrElse(throw PostNotFoundException(pageId, postNr))

  def loadTitleAndOrigPost(pageId: PageId): Seq[Post] =
    loadPosts(Seq(PagePostNr(pageId, PageParts.TitleNr), PagePostNr(pageId, PageParts.BodyNr)))

  def loadTitle(pageId: PageId): Option[Post] =
    loadPosts(Seq(PagePostNr(pageId, PageParts.TitleNr))).headOption

  def loadOrigPost(pageId: PageId): Option[Post] =
    loadPosts(Seq(PagePostNr(pageId, PageParts.BodyNr))).headOption

  def loadOrigPostAndLatestPosts(pageId: PageId, limit: Int): Seq[Post]
  def loadPostsOnPage(pageId: PageId, siteId: Option[SiteId] = None): immutable.Seq[Post]
  def loadPosts(pagePostNrs: Iterable[PagePostNr]): immutable.Seq[Post]
  def loadPostsByUniqueId(postIds: Iterable[PostId]): immutable.Map[PostId, Post]

  def loadAllUnapprovedPosts(pageId: PageId, limit: Int): immutable.Seq[Post]
  def loadUnapprovedPosts(pageId: PageId, by: UserId, limit: Int): immutable.Seq[Post]
  def loadCompletedForms(pageId: PageId, limit: Int): immutable.Seq[Post]

  /*
  def loadPosts(authorId: Option[UserId], includeTitles: Boolean, includeChatMessages: Boolean,
        limit: Int, orderBy: OrderBy, onPageId: Option[PageId] = None, onlyUnapproved: Boolean = false): immutable.Seq[Post]
        */
  def loadPopularPostsByPage(pageIds: Iterable[PageId], limitPerPage: Int)
        : Map[PageId, immutable.Seq[Post]]

  def loadApprovedOrigPostAndRepliesByPage(pageIds: Iterable[PageId]): Map[PageId, immutable.Seq[Post]]

  def loadPostsToReview(): immutable.Seq[Post]
  def loadPostsByAuthorSkipTitles(userId: UserId, limit: Int, orderBy: OrderBy): immutable.Seq[Post]

  def loadTitlesPreferApproved(pageIds: Iterable[PageId]): Map[PageId, String] = {
    val titlePosts = loadPosts(pageIds.map(PagePostNr(_, PageParts.TitleNr)))
    Map(titlePosts.map(post => {
      post.pageId -> post.approvedSource.getOrElse(post.currentSource)
    }): _*)
  }

  def nextPostId(): PostId
  def insertPost(newPost: Post)
  def updatePost(newPost: Post)

  def indexPostsSoon(posts: Post*)
  def indexAllPostsOnPage(pageId: PageId)
  def indexPagesSoon(pageMeta: PageMeta*)

  def spamCheckPostsSoon(byWho: Who, spamRelReqStuff: SpamRelReqStuff, posts: Post*)

  // Rename to insert/loadPageMemberIds? [rename]
  def insertMessageMember(pageId: PageId, userId: UserId, addedById: UserId): Boolean
  def removePageMember(pageId: PageId, userId: UserId, removedById: UserId): Boolean
  def removeDeletedMemberFromAllPages(userId: UserId)

  def loadMessageMembers(pageId: PageId): Set[UserId]

  def loadAnyPrivateGroupTalkMembers(pageMeta: PageMeta): Set[UserId] = {
    if (pageMeta.pageRole.isPrivateGroupTalk)
      loadMessageMembers(pageMeta.pageId)
    else
      Set.empty
  }

  // Returns recently active pages first.
  def loadPageIdsUserIsMemberOf(userId: UserId, onlyPageRoles: Set[PageRole]): immutable.Seq[PageId]
  def loadReadProgress(userId: UserId, pageId: PageId): Option[ReadingProgress]
  def loadReadProgressAndIfHasSummaryEmailed(userId: UserId, pageId: PageId)
        : (Option[ReadingProgress], Boolean)
  def upsertReadProgress(userId: UserId, pageId: PageId, pageTimings: ReadingProgress)
  def rememberHasIncludedInSummaryEmail(userId: UserId, pageId: PageId, now: When)

  def loadPageVisitTrusts(pageId: PageId): Map[UserId, VisitTrust]

  def loadPagePopularityScore(pageId: PageId): Option[PagePopularityScores]
  def upsertPagePopularityScore(scores: PagePopularityScores)

  def loadLastPostRevision(postId: PostId): Option[PostRevision]
  def loadPostRevision(postId: PostId, revisionNr: Int): Option[PostRevision]
  def insertPostRevision(revision: PostRevision)
  def updatePostRevision(revision: PostRevision)

  def loadActionsOnPage(pageId: PageId): immutable.Seq[PostAction]
  def loadActionsByUserOnPage(userId: UserId, pageId: PageId): immutable.Seq[PostAction]
  def loadActionsDoneToPost(pageId: PageId, postNr: PostNr): immutable.Seq[PostAction]

  def deleteVote(pageId: PageId, postNr: PostNr, voteType: PostVoteType, voterId: UserId): Boolean
  def insertVote(uniquePostId: PostId, pageId: PageId, postNr: PostNr, voteType: PostVoteType, voterId: UserId)
  /** Loads the first X voter ids, sorted by ... what? Currently loads all. [1WVKPW02] */
  def loadVoterIds(postId: PostId, voteType: PostVoteType): Seq[UserId]

  /** Remembers that the specified posts have been read by a certain user.
    */
  def updatePostsReadStats(pageId: PageId, postNrsRead: Set[PostNr], readById: UserId,
        readFromIp: String)


  def loadUserStats(userId: UserId): Option[UserStats]
  def upsertUserStats(userStats: UserStats)

  /** Also updates the user stats, but avoids races about writing to unrelated fields. */
  def bumpNextSummaryEmailDate(memberId: UserId, nextEmailAt: Option[When])
  def bumpNextAndLastSummaryEmailDate(memberId: UserId, lastAt: When, nextAt: Option[When])

  def reconsiderSendingSummaryEmailsTo(memberId: UserId) {
    // When set to null, the user will be considered for summary emails and marked yes-get or no.
    bumpNextSummaryEmailDate(memberId, nextEmailAt = None)
  }

  /** This will make the server have a look at everyone, and see if it's time to send them
    * summary emails (e.g. because the Everyone group's settings were changed).
    */
  def reconsiderSendingSummaryEmailsToEveryone()


  def loadUserVisitStats(userId: UserId): immutable.Seq[UserVisitStats]
  def upsertUserVisitStats(visitStats: UserVisitStats)

  def loadPostsReadStats(pageId: PageId, postNr: Option[PostNr]): PostsReadStats
  def loadPostsReadStats(pageId: PageId): PostsReadStats
  def movePostsReadStats(oldPageId: PageId, newPageId: PageId,
    newPostNrsByOldNrs: Map[PostNr, PostNr])

  def loadAllTagsAsSet(): Set[TagLabel]
  def loadTagsAndStats(): Seq[TagAndStats]
  def loadTagsByPostId(postIds: Iterable[PostId]): Map[PostId, Set[TagLabel]]
  def loadTagsForPost(postId: PostId): Set[TagLabel] =
    loadTagsByPostId(Seq(postId)).getOrElse(postId, Set.empty)
  def removeTagsFromPost(labels: Set[TagLabel], postId: PostId)
  def addTagsToPost(labels: Set[TagLabel], postId: PostId, isPage: Boolean)
  def renameTag(from: String, to: String)
  def setTagNotfLevel(userId: UserId, tagLabel: TagLabel, notfLevel: NotfLevel)
  def loadTagNotfLevels(userId: UserId): Map[TagLabel, NotfLevel]
  def listUsersWatchingTags(tags: Set[TagLabel]): Set[UserId]

  def loadFlagsFor(pagePostNrs: Iterable[PagePostNr]): immutable.Seq[PostFlag]
  def insertFlag(uniquePostId: PostId, pageId: PageId, postNr: PostNr, flagType: PostFlagType, flaggerId: UserId)
  def clearFlags(pageId: PageId, postNr: PostNr, clearedById: UserId)

  def nextPageId(): PageId

  def loadAllPageMetas(): immutable.Seq[PageMeta]
  def loadPageMeta(pageId: PageId): Option[PageMeta]
  def loadPageMetasAsMap(pageIds: Iterable[PageId], anySiteId: Option[SiteId] = None)
        : Map[PageId, PageMeta]
  def loadThePageMeta(pageId: PageId): PageMeta =
    loadPageMeta(pageId).getOrElse(throw PageNotFoundException(pageId))

  /** Loads meta for all forums, blog and wiki main pages. */
  //def loadPageMetaForAllSections(): Seq[PageMeta]

  def loadOpenChatsPinnedGlobally(): immutable.Seq[PageMeta]

  def loadPageMetas(pageIds: Iterable[PageId]): immutable.Seq[PageMeta]
  def insertPageMetaMarkSectionPageStale(newMeta: PageMeta)

  final def updatePageMeta(newMeta: PageMeta, oldMeta: PageMeta, markSectionPageStale: Boolean) {
    dieIf(newMeta.pageRole != oldMeta.pageRole && !oldMeta.pageRole.mayChangeRole, "EsE4KU0W2")
    dieIf(newMeta.version < oldMeta.version, "EsE6JKU0D4")
    updatePageMetaImpl(newMeta, oldMeta = oldMeta, markSectionPageStale)
  }
  protected def updatePageMetaImpl(newMeta: PageMeta, oldMeta: PageMeta,
        markSectionPageStale: Boolean)

  def markPagesWithUserAvatarAsStale(userId: UserId)
  def markSectionPageContentHtmlAsStale(categoryId: CategoryId)
  def loadCachedPageContentHtml(pageId: PageId, renderParams: PageRenderParams)
        : Option[(String, CachedPageVersion)]
  def upsertCachedPageContentHtml(
        pageId: PageId, version: CachedPageVersion, reactStorejsonString: String, html: String)


  def insertAltPageId(altPageId: AltPageId, realPageId: PageId)
  def insertAltPageIdIfFree(altPageId: AltPageId, realPageId: PageId)
  def listAltPageIds(realPageId: PageId): Set[AltPageId]
  def loadRealPageId(altPageId: AltPageId): Option[PageId]

  def insertPagePath(pagePath: PagePath): Unit
  def insertPagePath(pagePath: PagePathWithId): Unit =
    insertPagePath(PagePath(siteId = this.siteId, folder = pagePath.folder,
      pageId = Some(pagePath.pageId), showId = pagePath.showId, pageSlug = pagePath.slug))

  def loadPagePath(pageId: PageId): Option[PagePath]
  def checkPagePath(pathToCheck: PagePath): Option[PagePath]  // rename? check? load? what?
  /**
    * Loads all PagePaths that map to pageId. The canonical path is placed first
    * and the tail consists only of any redirection paths.
    */
  def lookupPagePathAndRedirects(pageId: PageId): List[PagePath]
  def listPagePaths(pageRanges: PathRanges, include: List[PageStatus],
    orderOffset: PageOrderOffset, limit: Int): Seq[PagePathAndMeta]

  def loadPagesInCategories(categoryIds: Seq[CategoryId], pageQuery: PageQuery, limit: Int)
        : Seq[PagePathAndMeta]

  /** Orders by most recent first. */
  def loadPagesByUser(userId: UserId, isStaffOrSelf: Boolean, limit: Int): Seq[PagePathAndMeta]

  def moveRenamePage(pageId: PageId,
    newFolder: Option[String] = None, showId: Option[Boolean] = None,
    newSlug: Option[String] = None): PagePath


  /** Remembers that a file has been uploaded and where it's located. */
  def insertUploadedFileMeta(uploadRef: UploadRef, sizeBytes: Int, mimeType: String,
        dimensions: Option[(Int, Int)])
  def deleteUploadedFileMeta(uploadRef: UploadRef)

  /** Uploaded files are referenced via 1) URLs in posts (e.g. `<a href=...> <img src=...>`)
    * and 2) from users, if a file is someone's avatar image.
    */
  def updateUploadedFileReferenceCount(uploadRef: UploadRef)

  /** Remembers that an uploaded file is referenced from this post. */
  def insertUploadedFileReference(postId: PostId, uploadRef: UploadRef, addedById: UserId)
  def deleteUploadedFileReference(postId: PostId, uploadRef: UploadRef): Boolean
  def loadUploadedFileReferences(postId: PostId): Set[UploadRef]
  def loadSiteIdsUsingUpload(ref: UploadRef): Set[SiteId]

  /** Returns the refs currently in use, e.g. as user avatar images or
    * images / attachments inserted into posts.
    */
  def filterUploadRefsInUse(uploadRefs: Iterable[UploadRef]): Set[UploadRef]
  def updateUploadQuotaUse(uploadRef: UploadRef, wasAdded: Boolean)


  def insertInvite(invite: Invite)
  def updateInvite(invite: Invite): Boolean
  def forgetInviteEmailSentToAddress(userId: UserId, replaceWithAddr: String)
  def loadInvite(secretKey: String): Option[Invite]
  def loadInvites(createdById: UserId): immutable.Seq[Invite]
  def loadAllInvites(limit: Int): immutable.Seq[Invite]

  def nextIdentityId: IdentityId
  def insertIdentity(Identity: Identity)
  def loadIdentities(userId: UserId): immutable.Seq[Identity]
  def loadOpenAuthIdentity(key: OpenAuthProviderIdKey): Option[OpenAuthIdentity]
  def loadOpenIdIdentity(openIdDetails: OpenIdDetails): Option[IdentityOpenId]
  def deleteAllUsersIdentities(userId: UserId)

  def nextMemberId: UserId
  def insertMember(user: MemberInclDetails)

  def tryLoginAsMember(loginAttempt: MemberLoginAttempt, requireVerifiedEmail: Boolean)
        : MemberLoginGrant
  def loginAsGuest(loginAttempt: GuestLoginAttempt): GuestLoginResult
  def configIdtySimple(ctime: ju.Date, emailAddr: String, emailNotfPrefs: EmailNotfPrefs)

  def loadMemberInclDetails(userId: UserId): Option[MemberInclDetails] =
    loadMemberOrGroupInclDetails(userId) map {
      case member: MemberInclDetails => member
      case group: Group => throw GotAGroupException(group.id)
    }

  def loadGroupInclDetails(groupId: UserId): Option[Group] =
    loadMembersAndGroupsInclDetailsById(Seq(groupId)).headOption map {
      case m: MemberInclDetails => throw GotANotGroupException(m.id)
      case g: Group => g
    }

  def loadMemberOrGroupInclDetails(userId: UserId): Option[MemberOrGroupInclDetails]
  def loadMemberOrGroupInclDetailsByUsername(username: String): Option[MemberOrGroupInclDetails]

  def loadTheMemberInclDetails(userId: UserId): MemberInclDetails =
    loadMemberInclDetails(userId).getOrElse(throw UserNotFoundException(userId))

  def loadTheGroupInclDetails(userId: UserId): Group =
    loadGroupInclDetails(userId).getOrElse(throw UserNotFoundException(userId))

  def loadTheMemberOrGroupInclDetails(userId: UserId): MemberOrGroupInclDetails =
    loadMemberOrGroupInclDetails(userId).getOrElse(throw UserNotFoundException(userId))

  def loadGroups(memberOrGroup: MemberOrGroupInclDetails): immutable.Seq[Group] = {
    val allGroups = loadGroupsAsMap()
    val groupIds = loadGroupIds(memberOrGroup)
    groupIds.flatMap(allGroups.get)
  }

  // def updateMember(user: Member): Boolean — could add, [6DCU0WYX2]
  def updateMemberInclDetails(user: MemberInclDetails): Boolean
  def updateGuest(guest: Guest): Boolean

  def insertUserEmailAddress(userEmailAddress: UserEmailAddress)
  def updateUserEmailAddress(userEmailAddress: UserEmailAddress)
  def deleteUserEmailAddress(userId: UserId, emailAddress: String)
  def deleteAllUsersEmailAddresses(userId: UserId)
  def loadUserEmailAddresses(userId: UserId): Seq[UserEmailAddress]

  def insertUsernameUsage(usage: UsernameUsage)
  def updateUsernameUsage(usage: UsernameUsage)
  def loadUsersOldUsernames(userId: UserId): Seq[UsernameUsage]
  def loadUsernameUsages(username: String): Seq[UsernameUsage]

  def loadUser(userId: UserId): Option[User]
  def loadTheUser(userId: UserId): User =
    loadUser(userId).getOrElse(throw UserNotFoundException(userId))

  def loadGuest(userId: UserId): Option[Guest] = {
    dieIf(userId > User.MaxGuestId, "EsE8FY032")
    loadUser(userId).map(_.asInstanceOf[Guest])
  }
  def loadTheGuest(userId: UserId): Guest = {
    dieIf(userId > User.MaxGuestId, "EsE6YKWU2")
    loadTheUser(userId).asInstanceOf[Guest]
  }
  def loadMember(userId: UserId): Option[Member] = {
    dieIf(userId <= User.MaxGuestId, "EsE6YKWU2")
    loadUser(userId).map(_.toMemberOrThrow)
  }
  def loadTheMember(userId: UserId): Member = loadMember(userId).getOrDie(
    "EsEFK320FG", s"Member $userId missing")

  def isAdmin(userId: UserId): Boolean = loadMember(userId).exists(_.isAdmin)

  def loadUsers(userIds: Iterable[UserId]): immutable.Seq[User]
  def loadTheUsers(userIds: UserId*): immutable.Seq[User] = {
    val usersById = loadUsersAsMap(userIds)
    userIds.to[immutable.Seq] map { id =>
      usersById.getOrElse(id, throw UserNotFoundException(id))
    }
  }

  def loadUsersAsMap(userIds: Iterable[UserId]): Map[UserId, User]

  def loadMembersAsMap(userIds: Iterable[UserId]): Map[UserId, Member] = {
    dieIf(userIds.exists(_ <= User.MaxGuestId), "EsE5YKG2")
    loadUsersAsMap(userIds).mapValues(_.asInstanceOf[Member])
  }

  def loadMemberByPrimaryEmailOrUsername(emailOrUsername: String): Option[Member]

  def loadMembersWithPrefix(usernamePrefix: String): immutable.Seq[Member]

  def loadUsers(): immutable.Seq[User]
  def loadMembersInclDetailsAndStats(peopleQuery: PeopleQuery)
    : immutable.Seq[(MemberInclDetails, Option[UserStats])]

  def loadMembersInclDetailsById(userIds: Iterable[UserId]): immutable.Seq[MemberInclDetails] =
    loadMembersAndGroupsInclDetailsById(userIds) map {
      case member: MemberInclDetails => member
      case group: Group => throw GotAGroupException(group.id)
    }

  def loadMembersAndGroupsInclDetailsById(userIds: Iterable[UserId])
        : immutable.Seq[MemberOrGroupInclDetails]

  def loadOwner(): Option[MemberInclDetails]

  def insertGroup(group: Group)
  def updateGroup(group: Group)
  def loadGroupsAsSeq(): immutable.Seq[Group]
  def loadGroupsAsMap(): Map[UserId, Group] = loadGroupsAsSeq().map(g => g.id -> g).toMap

  def loadGroupIds(anyUser: Option[User]): Vector[UserId] = {
    anyUser.map(loadGroupIds) getOrElse Vector(Group.EveryoneId)
  }

  def loadGroupIds(memberOrGroupInclDetails: MemberOrGroupInclDetails): Vector[UserId] = {
    val user = memberOrGroupInclDetails match {
      case m: MemberInclDetails => m.briefUser
      case g: Group => g
    }
    loadGroupIds(user)
  }

  def loadGroupIds(user: User): Vector[UserId] = {
    val G = Group

    val member = user match {
      case _: Guest | UnknownUser => return Vector(G.EveryoneId)
      case m: Member => m
      case g: Group => return makeGroupIdsForGroup(g)
    }

    // For now. Later, also do db request and add custom groups.  [7JKC1104]

    if (member.isAdmin)
      return Vector(member.id, G.AdminsId, G.StaffId, G.CoreMembersId, G.RegularMembersId,
        G.TrustedMembersId, G.FullMembersId, G.BasicMembersId, G.NewMembersId, G.EveryoneId)

    if (member.isModerator)
      return Vector(member.id, G.ModeratorsId, G.StaffId, G.CoreMembersId, G.RegularMembersId,
        G.TrustedMembersId, G.FullMembersId, G.BasicMembersId, G.NewMembersId, G.EveryoneId)

    member.effectiveTrustLevel match {
      case TrustLevel.NewMember =>
        Vector(member.id, G.NewMembersId, G.EveryoneId)
      case TrustLevel.BasicMember =>
        Vector(member.id, G.BasicMembersId, G.NewMembersId, G.EveryoneId)
      case TrustLevel.FullMember =>
        Vector(member.id, G.FullMembersId, G.BasicMembersId, G.NewMembersId, G.EveryoneId)
      case TrustLevel.TrustedMember =>
        Vector(member.id, G.TrustedMembersId,
          G.FullMembersId, G.BasicMembersId, G.NewMembersId, G.EveryoneId)
      case TrustLevel.RegularMember =>
        Vector(member.id, G.RegularMembersId, G.TrustedMembersId,
          G.FullMembersId, G.BasicMembersId, G.NewMembersId, G.EveryoneId)
      case TrustLevel.CoreMember =>
        Vector(member.id, G.CoreMembersId, G.RegularMembersId, G.TrustedMembersId,
          G.FullMembersId, G.BasicMembersId, G.NewMembersId, G.EveryoneId)
    }
  }


  private def makeGroupIdsForGroup(group: Group): Vector[UserId] = {
    // For now. Later, also do db request and add custom groups.  [7JKC1104]
    val G = Group
    group.id match {
      case G.NewMembersId =>
        Vector(G.NewMembersId, G.EveryoneId)
      case G.BasicMembersId =>
        Vector(G.BasicMembersId, G.NewMembersId, G.EveryoneId)
      case G.FullMembersId =>
        Vector(G.FullMembersId, G.BasicMembersId, G.NewMembersId, G.EveryoneId)
      case G.TrustedMembersId =>
        Vector(G.TrustedMembersId, G.FullMembersId, G.BasicMembersId, G.NewMembersId, G.EveryoneId)
      case G.RegularMembersId =>
        Vector(G.RegularMembersId, G.TrustedMembersId,
          G.FullMembersId, G.BasicMembersId, G.NewMembersId, G.EveryoneId)
      case G.CoreMembersId =>
        Vector(G.CoreMembersId, G.RegularMembersId, G.TrustedMembersId,
          G.FullMembersId, G.BasicMembersId, G.NewMembersId, G.EveryoneId)
      case G.StaffId =>
        Vector(G.StaffId, G.CoreMembersId, G.RegularMembersId,
          G.TrustedMembersId, G.FullMembersId, G.BasicMembersId, G.NewMembersId, G.EveryoneId)
      case G.ModeratorsId =>
        Vector(G.ModeratorsId, G.StaffId, G.CoreMembersId, G.RegularMembersId,
          G.TrustedMembersId, G.FullMembersId, G.BasicMembersId, G.NewMembersId, G.EveryoneId)
      case G.AdminsId =>
        Vector(G.AdminsId, G.StaffId, G.CoreMembersId, G.RegularMembersId,
          G.TrustedMembersId, G.FullMembersId, G.BasicMembersId, G.NewMembersId, G.EveryoneId)
      case _ =>
        Vector(G.EveryoneId)
    }
  }


  /** Loads users watching the specified page, any parent categories or forums,
    * and people watching everything on the whole site.
    */
  def loadUserIdsWatchingPage(pageId: PageId): Seq[UserId]

  def loadUserPageSettings(userId: UserId, pageId: PageId): Option[UserPageSettings]
  def loadUserPageSettingsOrDefault(userId: UserId, pageId: PageId): UserPageSettings =
    loadUserPageSettings(userId, pageId) getOrElse UserPageSettings.Default

  def saveUserPageSettings(userId: UserId, pageId: PageId, settings: UserPageSettings)

  def listUsernames(pageId: PageId, prefix: String): Seq[NameAndUsername]

  def saveUnsentEmail(email: Email): Unit
  def saveUnsentEmailConnectToNotfs(email: Email, notfs: Seq[Notification])
  def updateSentEmail(email: Email): Unit
  def loadEmailById(emailId: String): Option[Email]
  def loadEmailsSentTo(userIds: Set[UserId], after: When,
        emailType: EmailType): Map[UserId, Seq[Email]]
  def forgetEmailSentToAddress(userId: UserId, replaceWithAddr: String)

  def nextReviewTaskId(): ReviewTaskId
  def upsertReviewTask(reviewTask: ReviewTask)
  def loadReviewTask(id: ReviewTaskId): Option[ReviewTask]
  def loadReviewTasks(olderOrEqualTo: ju.Date, limit: Int): Seq[ReviewTask]
  def loadReviewTasksAboutUser(userId: UserId, limit: Int, orderBy: OrderBy): Seq[ReviewTask]
  def loadReviewTasksAboutPostIds(postIds: Iterable[PostId]): immutable.Seq[ReviewTask]
  def loadReviewTaskCounts(isAdmin: Boolean): ReviewTaskCounts
  def loadPendingPostReviewTask(postId: PostId): Option[ReviewTask]
  def loadUndecidedPostReviewTask(postId: PostId, taskCreatedById: UserId): Option[ReviewTask]

  def nextNotificationId(): NotificationId
  def saveDeleteNotifications(notifications: Notifications)
  def updateNotificationSkipEmail(notifications: Seq[Notification])
  def markNotfAsSeenSkipEmail(userId: UserId, notfId: NotificationId)
  def loadNotificationsForRole(roleId: RoleId, limit: Int, unseenFirst: Boolean,
    upToWhen: Option[ju.Date] = None): Seq[Notification]
  def loadMentionsOfPeopleInPost(postId: PostId): Seq[Notification]
  def listUsersNotifiedAboutPost(postId: PostId): Set[UserId]
  /** Useful when writing tests. */
  def countNotificationsPerUser(): Map[UserId, Int]


  /** If no id, assigns an id. Returns the perms, with id. */
  def insertPermsOnPages(permsOnContent: PermsOnPages): PermsOnPages
  def updatePermsOnPages(permsOnContent: PermsOnPages)
  def deletePermsOnPages(ids: Iterable[PermissionId])
  def loadPermsOnPages(): immutable.Seq[PermsOnPages]
  def loadPermsOnCategory(categoryId: CategoryId): immutable.Seq[PermsOnPages] = {
    COULD_OPTIMIZE // could filter in db query instead
    loadPermsOnPages().filter(_.onCategoryId.is(categoryId))
  }


  def startAuditLogBatch()
  /** Returns (entry-id, Option(batch-id)). */
  def nextAuditLogEntryId(): (AuditLogEntryId, Option[AuditLogEntryId])
  def insertAuditLogEntry(entry: AuditLogEntry)
  def loadCreatePostAuditLogEntry(postId: PostId): Option[AuditLogEntry]
  def loadCreatePostAuditLogEntriesBy(browserIdData: BrowserIdData, limit: Int, orderBy: OrderBy)
        : Seq[AuditLogEntry]
  def loadAuditLogEntriesRecentFirst(userId: UserId, tyype: Option[AuditLogEntryType], limit: Int,
        inclForgotten: Boolean): immutable.Seq[AuditLogEntry]

  def loadBlocks(ip: String, browserIdCookie: Option[String]): immutable.Seq[Block]
  def insertBlock(block: Block)
  def unblockIp(ip: InetAddress)
  def unblockBrowser(browserIdCookie: String)
}


/** Include stack trace, so can find bugs. (So don't use QuickMessageException). */
case class GotAGroupException(groupId: UserId) extends Exception(
  s"Got a group when trying to load member $groupId [EdE2SBA4J7]")

case class GotANotGroupException(groupId: UserId) extends Exception(
  s"Got a not-group when trying to load group $groupId [EdE4GW1WA9]")

case class GotAGuestException(groupId: UserId) extends Exception(
  s"Got a guest when trying to load member $groupId [EdE4GAR0W1]")

case object GotUnknownUserException extends Exception

case class UserNotFoundException(userId: UserId) extends QuickMessageException(
  s"User found by id: $userId")
case class PageNotFoundException(pageId: PageId) extends QuickMessageException(
  s"Page found by id: $pageId")
case class PostNotFoundException(pageId: PageId, postNr: PostNr) extends QuickMessageException(
  s"Post not found by nr, page, post: $pageId, $postNr")
case class PostNotFoundByIdException(postId: PostId) extends QuickMessageException(
  s"Post not found by id: $postId")

