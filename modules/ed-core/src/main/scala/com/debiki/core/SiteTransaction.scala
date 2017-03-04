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

  def listHostnames(): Seq[SiteHost]
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
  def upsertReadProgress(userId: UserId, pageId: PageId, pageTimings: ReadingProgress)

  def loadLastPostRevision(postId: PostId): Option[PostRevision]
  def loadPostRevision(postId: PostId, revisionNr: Int): Option[PostRevision]
  def insertPostRevision(revision: PostRevision)
  def updatePostRevision(revision: PostRevision)

  def loadActionsByUserOnPage(userId: UserId, pageId: PageId): immutable.Seq[PostAction]
  def loadActionsDoneToPost(pageId: PageId, postNr: PostNr): immutable.Seq[PostAction]

  def deleteVote(pageId: PageId, postNr: PostNr, voteType: PostVoteType, voterId: UserId): Boolean
  def insertVote(uniquePostId: PostId, pageId: PageId, postNr: PostNr, voteType: PostVoteType, voterId: UserId)

  /** Remembers that the specified posts have been read by a certain user.
    */
  def updatePostsReadStats(pageId: PageId, postNrsRead: Set[PostNr], readById: UserId,
        readFromIp: String)

  def loadUserStats(userId: UserId): Option[UserStats]
  def upsertUserStats(userStats: UserStats)

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

  def loadFlagsFor(pagePostNrs: immutable.Seq[PagePostNr]): immutable.Seq[PostFlag]
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
  def loadCachedPageContentHtml(pageId: PageId): Option[(String, CachedPageVersion)]
  // (Could move this one to a transactionless Dao interface?)
  def saveCachedPageContentHtmlPerhapsBreakTransaction(
    pageId: PageId, version: CachedPageVersion, html: String): Boolean


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
  def loadInvite(secretKey: String): Option[Invite]
  def loadInvites(createdById: UserId): immutable.Seq[Invite]
  def loadAllInvites(limit: Int): immutable.Seq[Invite]

  def nextIdentityId: IdentityId
  def insertIdentity(Identity: Identity)
  def loadIdtyDetailsAndUser(userId: UserId): Option[(Identity, User)]

  def nextMemberId: UserId
  def insertMember(user: MemberInclDetails)

  def tryLoginAsMember(loginAttempt: MemberLoginAttempt): MemberLoginGrant
  def loginAsGuest(loginAttempt: GuestLoginAttempt): GuestLoginResult
  def configIdtySimple(ctime: ju.Date, emailAddr: String, emailNotfPrefs: EmailNotfPrefs)

  def loadMemberInclDetails(userId: UserId): Option[MemberInclDetails]
  def loadMemberInclDetailsByUsername(username: String): Option[MemberInclDetails]

  def loadTheMemberInclDetails(userId: UserId): MemberInclDetails =
    loadMemberInclDetails(userId).getOrElse(throw UserNotFoundException(userId))

  // def updateMember(user: Member): Boolean — could add, [6DCU0WYX2]
  def updateMemberInclDetails(user: MemberInclDetails): Boolean
  def updateGuest(guest: Guest): Boolean

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
    loadUser(userId).map(_.asInstanceOf[Member])
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

  def loadMemberByEmailOrUsername(emailOrUsername: String): Option[Member]

  def loadMembersWithPrefix(usernamePrefix: String): immutable.Seq[Member]

  def loadUsers(): immutable.Seq[User]
  def loadMembersInclDetails(
    onlyApproved: Boolean = false,
    onlyPendingApproval: Boolean = false): immutable.Seq[MemberInclDetails]

  def loadOwner(): Option[MemberInclDetails]

  def insertGroup(group: Group)
  def loadGroupsAsSeq(): immutable.Seq[Group]

  def loadGroupIds(user: User): Vector[UserId] = {
    val G = Group

    val member = user match {
      case _: Guest | UnknownUser => return Vector(G.EveryoneId)
      case m: Member => m
      // later: case g: Group => g // groups are members
    }

    // For now. Later, also do db request and add custom groups.

    if (member.isAdmin)
      return Vector(member.id, G.AdminsId, G.StaffId, G.CoreMembersId, G.RegularsId,
        G.TrustedId, G.FullMembersId, G.BasicMembersId, G.NewMembersId, G.EveryoneId)

    if (member.isModerator)
      return Vector(member.id, G.ModeratorsId, G.StaffId, G.CoreMembersId, G.RegularsId,
        G.TrustedId, G.FullMembersId, G.BasicMembersId, G.NewMembersId, G.EveryoneId)

    member.effectiveTrustLevel match {
      case TrustLevel.New =>
        Vector(member.id, G.NewMembersId, G.EveryoneId)
      case TrustLevel.Basic =>
        Vector(member.id, G.BasicMembersId, G.NewMembersId, G.EveryoneId)
      case TrustLevel.FullMember =>
        Vector(member.id, G.FullMembersId, G.BasicMembersId, G.NewMembersId, G.EveryoneId)
      case TrustLevel.Helper =>
        Vector(member.id, G.TrustedId,
          G.FullMembersId, G.BasicMembersId, G.NewMembersId, G.EveryoneId)
      case TrustLevel.Regular =>
        Vector(member.id, G.RegularsId, G.TrustedId,
          G.FullMembersId, G.BasicMembersId, G.NewMembersId, G.EveryoneId)
      case TrustLevel.CoreMember =>
        Vector(member.id, G.CoreMembersId, G.RegularsId, G.TrustedId,
          G.FullMembersId, G.BasicMembersId, G.NewMembersId, G.EveryoneId)
    }
  }


  /** Loads users watching the specified page, any parent categories or forums,
    * and people watching everything on the whole site.
    */
  def loadUserIdsWatchingPage(pageId: PageId): Seq[UserId]

  def loadUsersPageSettings(userId: UserId, pageId: PageId): Option[UsersPageSettings]
  def loadUsersPageSettingsOrDefault(userId: UserId, pageId: PageId): UsersPageSettings =
    loadUsersPageSettings(userId, pageId) getOrElse UsersPageSettings.Default

  def saveUsersPageSettings(userId: UserId, pageId: PageId, settings: UsersPageSettings)

  def listUsernames(pageId: PageId, prefix: String): Seq[NameAndUsername]

  def saveUnsentEmail(email: Email): Unit
  def saveUnsentEmailConnectToNotfs(email: Email, notfs: Seq[Notification])
  def updateSentEmail(email: Email): Unit
  def loadEmailById(emailId: String): Option[Email]

  def nextReviewTaskId(): ReviewTaskId
  def upsertReviewTask(reviewTask: ReviewTask)
  def loadReviewTask(id: ReviewTaskId): Option[ReviewTask]
  def loadReviewTasks(olderOrEqualTo: ju.Date, limit: Int): Seq[ReviewTask]
  def loadReviewTasksAboutUser(userId: UserId, limit: Int, orderBy: OrderBy): Seq[ReviewTask]
  def loadReviewTasksAboutPostIds(postIds: Iterable[PostId]): immutable.Seq[ReviewTask]
  def loadReviewTaskCounts(isAdmin: Boolean): ReviewTaskCounts
  def loadPendingPostReviewTask(postId: PostId): Option[ReviewTask]
  def loadPendingPostReviewTask(postId: PostId, taskCreatedById: UserId): Option[ReviewTask]

  def nextNotificationId(): NotificationId
  def saveDeleteNotifications(notifications: Notifications)
  def updateNotificationSkipEmail(notifications: Seq[Notification])
  def markNotfAsSeenSkipEmail(userId: UserId, notfId: NotificationId)
  def loadNotificationsForRole(roleId: RoleId, limit: Int, unseenFirst: Boolean,
    upToWhen: Option[ju.Date] = None): Seq[Notification]
  def listUsersNotifiedAboutPost(postId: PostId): Set[UserId]


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
  def loadAuditLogEntriesRecentFirst(userId: UserId, tyype: AuditLogEntryType, limit: Int)
        : immutable.Seq[AuditLogEntry]

  def loadBlocks(ip: String, browserIdCookie: String): immutable.Seq[Block]
  def insertBlock(block: Block)
  def unblockIp(ip: InetAddress)
  def unblockBrowser(browserIdCookie: String)
}


case class UserNotFoundException(userId: UserId) extends QuickMessageException(
  s"User found by id: $userId")
case class PageNotFoundException(pageId: PageId) extends QuickMessageException(
  s"Page found by id: $pageId")
case class PostNotFoundException(pageId: PageId, postNr: PostNr) extends QuickMessageException(
  s"Post not found by nr, page, post: $pageId, $postNr")
case class PostNotFoundByIdException(postId: PostId) extends QuickMessageException(
  s"Post not found by id: $postId")

