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
  def siteId: SiteId

  def setSiteId(id: SiteId)

  /** Continues using the same connection. */
  def asSystem: SystemTransaction

  def deferConstraints()

  def countWebsites(createdFromIp: String, creatorEmailAddress: String, testSites: Boolean): Int
  def countWebsitesTotal(testSites: Boolean): Int

  /** Throws SiteAlreadyExistsException if the site already exists.
    * Throws TooManySitesCreatedException if you've created too many websites already
    * (from the same IP or email address).
    */
  def createSite(name: String, status: SiteStatus, hostname: String,
    embeddingSiteUrl: Option[String], creatorIp: String, creatorEmailAddress: String,
    quotaLimitMegabytes: Option[Int], maxSitesPerIp: Int, maxSitesTotal: Int,
    isTestSiteOkayToDelete: Boolean, pricePlan: PricePlan): Site

  def loadSite(): Option[Site]
  def bumpSiteVersion()
  def updateSite(changedSite: Site)


  // Try to remove, use sth more generic like insertUser()? or insertGuest() instead?
  def createUnknownUser(date: ju.Date)

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
  def loadCategoryPathRootLast(categoryId: CategoryId): Seq[Category]
  def nextCategoryId(): Int
  def insertCategoryMarkSectionPageStale(category: Category)
  def updateCategoryMarkSectionPageStale(category: Category)
  def loadAboutCategoryPageId(categoryId: CategoryId): Option[PageId]

  def loadPost(uniquePostId: UniquePostId): Option[Post]
  def loadThePost(uniquePostId: UniquePostId): Post =
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
  def loadPostsByUniqueId(postIds: Iterable[UniquePostId]): immutable.Map[UniquePostId, Post]
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

  def nextPostId(): UniquePostId
  def insertPost(newPost: Post)
  def updatePost(newPost: Post)

  def indexPostsSoon(posts: Post*)
  def indexAllPostsOnPage(pageId: PageId)
  def indexPagesSoon(pageMeta: PageMeta*)

  def spamCheckPostsSoon(byWho: Who, spamRelReqStuff: SpamRelReqStuff, posts: Post*)

  // Rename to insert/loadPageMemberIds? [rename]
  def insertMessageMember(pageId: PageId, userId: UserId, addedById: UserId): Boolean
  def removePageMember(pageId: PageId, userId: UserId): Boolean
  def loadMessageMembers(pageId: PageId): Set[UserId]
  // Returns recently active pages first.
  def loadPageIdsUserIsMemberOf(userId: UserId, onlyPageRoles: Set[PageRole]): immutable.Seq[PageId]

  def loadLastPostRevision(postId: UniquePostId): Option[PostRevision]
  def loadPostRevision(postId: UniquePostId, revisionNr: Int): Option[PostRevision]
  def insertPostRevision(revision: PostRevision)
  def updatePostRevision(revision: PostRevision)

  def loadActionsByUserOnPage(userId: UserId, pageId: PageId): immutable.Seq[PostAction]
  def loadActionsDoneToPost(pageId: PageId, postNr: PostNr): immutable.Seq[PostAction]

  def deleteVote(pageId: PageId, postNr: PostNr, voteType: PostVoteType, voterId: UserId): Boolean
  def insertVote(uniquePostId: UniquePostId, pageId: PageId, postNr: PostNr, voteType: PostVoteType, voterId: UserId)

  /** Remembers that the specified posts have been read by a certain user.
    */
  def updatePostsReadStats(pageId: PageId, postNrsRead: Set[PostNr], readById: UserId,
        readFromIp: String)

  def loadPostsReadStats(pageId: PageId, postNr: Option[PostNr]): PostsReadStats
  def loadPostsReadStats(pageId: PageId): PostsReadStats
  def movePostsReadStats(oldPageId: PageId, newPageId: PageId,
    newPostNrsByOldNrs: Map[PostNr, PostNr])

  def loadAllTagsAsSet(): Set[TagLabel]
  def loadTagsAndStats(): Seq[TagAndStats]
  def loadTagsByPostId(postIds: Iterable[UniquePostId]): Map[UniquePostId, Set[TagLabel]]
  def loadTagsForPost(postId: UniquePostId): Set[TagLabel] =
    loadTagsByPostId(Seq(postId)).getOrElse(postId, Set.empty)
  def removeTagsFromPost(labels: Set[TagLabel], postId: UniquePostId)
  def addTagsToPost(labels: Set[TagLabel], postId: UniquePostId, isPage: Boolean)
  def renameTag(from: String, to: String)
  def setTagNotfLevel(userId: UserId, tagLabel: TagLabel, notfLevel: NotfLevel)
  def loadTagNotfLevels(userId: UserId): Map[TagLabel, NotfLevel]
  def listUsersWatchingTags(tags: Set[TagLabel]): Set[UserId]

  def loadFlagsFor(pagePostNrs: immutable.Seq[PagePostNr]): immutable.Seq[PostFlag]
  def insertFlag(uniquePostId: UniquePostId, pageId: PageId, postNr: PostNr, flagType: PostFlagType, flaggerId: UserId)
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
    insertPagePath(PagePath(tenantId = this.siteId, folder = pagePath.folder,
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


  @deprecated("now", "use this.now instead")
  def currentTime: ju.Date

  lazy val now: When = When.fromDate(currentTime)


  /** Remembers that a file has been uploaded and where it's located. */
  def insertUploadedFileMeta(uploadRef: UploadRef, sizeBytes: Int, mimeType: String,
        dimensions: Option[(Int, Int)])
  def deleteUploadedFileMeta(uploadRef: UploadRef)

  /** Uploaded files are referenced via 1) URLs in posts (e.g. `<a href=...> <img src=...>`)
    * and 2) from users, if a file is someone's avatar image.
    */
  def updateUploadedFileReferenceCount(uploadRef: UploadRef)

  /** Remembers that an uploaded file is referenced from this post. */
  def insertUploadedFileReference(postId: UniquePostId, uploadRef: UploadRef, addedById: UserId)
  def deleteUploadedFileReference(postId: UniquePostId, uploadRef: UploadRef): Boolean
  def loadUploadedFileReferences(postId: UniquePostId): Set[UploadRef]
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

  def nextIdentityId: IdentityId
  def insertIdentity(Identity: Identity)
  def loadIdtyDetailsAndUser(userId: UserId): Option[(Identity, User)]

  def nextAuthenticatedUserId: UserId
  def insertAuthenticatedUser(user: MemberInclDetails)

  def tryLogin(loginAttempt: LoginAttempt): LoginGrant
  def loginAsGuest(loginAttempt: GuestLoginAttempt): GuestLoginResult
  def configIdtySimple(ctime: ju.Date, emailAddr: String, emailNotfPrefs: EmailNotfPrefs)

  def loadMemberInclDetails(userId: UserId): Option[MemberInclDetails]
  def loadMemberInclDetailsByUsername(username: String): Option[MemberInclDetails]

  def loadTheMemberInclDetails(userId: UserId): MemberInclDetails =
    loadMemberInclDetails(userId).getOrElse(throw UserNotFoundException(userId))

  // def updateMember(user: Member): Boolean — could add, [6DCU0WYX2]
  def updateMemberInclDetails(user: MemberInclDetails): Boolean
  def updateGuest(guest: Guest): Boolean

  def loadUser(userId: UserId): Option[User]
  def loadTheUser(userId: UserId) = loadUser(userId).getOrElse(throw UserNotFoundException(userId))
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

  /** Loads users watching the specified page, any parent categories or forums,
    * and people watching everything on the whole site.
    */
  def loadUserIdsWatchingPage(pageId: PageId): Seq[UserId]

  def loadRolePageSettings(roleId: RoleId, pageId: PageId): Option[RolePageSettings]
  def loadRolePageSettingsOrDefault(roleId: RoleId, pageId: PageId) =
        loadRolePageSettings(roleId, pageId) getOrElse RolePageSettings.Default

  def listUsernames(pageId: PageId, prefix: String): Seq[NameAndUsername]

  def saveRolePageSettings(roleId: RoleId, pageId: PageId, settings: RolePageSettings)

  def saveUnsentEmail(email: Email): Unit
  def saveUnsentEmailConnectToNotfs(email: Email, notfs: Seq[Notification])
  def updateSentEmail(email: Email): Unit
  def loadEmailById(emailId: String): Option[Email]

  def nextReviewTaskId(): ReviewTaskId
  def upsertReviewTask(reviewTask: ReviewTask)
  def loadReviewTask(id: ReviewTaskId): Option[ReviewTask]
  def loadReviewTasks(olderOrEqualTo: ju.Date, limit: Int): Seq[ReviewTask]
  def loadReviewTasksAboutUser(userId: UserId, limit: Int, orderBy: OrderBy): Seq[ReviewTask]
  def loadReviewTasksAboutPostIds(postIds: Iterable[UniquePostId]): immutable.Seq[ReviewTask]
  def loadReviewTaskCounts(isAdmin: Boolean): ReviewTaskCounts
  def loadPendingPostReviewTask(postId: UniquePostId): Option[ReviewTask]
  def loadPendingPostReviewTask(postId: UniquePostId, taskCreatedById: UserId): Option[ReviewTask]

  def nextNotificationId(): NotificationId
  def saveDeleteNotifications(notifications: Notifications)
  def updateNotificationSkipEmail(notifications: Seq[Notification])
  def markNotfAsSeenSkipEmail(userId: UserId, notfId: NotificationId)
  def loadNotificationsForRole(roleId: RoleId, limit: Int, unseenFirst: Boolean,
    upToWhen: Option[ju.Date] = None): Seq[Notification]
  def listUsersNotifiedAboutPost(postId: UniquePostId): Set[UserId]


  def startAuditLogBatch()
  /** Returns (entry-id, Option(batch-id)). */
  def nextAuditLogEntryId(): (AuditLogEntryId, Option[AuditLogEntryId])
  def insertAuditLogEntry(entry: AuditLogEntry)
  def loadCreatePostAuditLogEntry(postId: UniquePostId): Option[AuditLogEntry]
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
case class PostNotFoundByIdException(postId: UniquePostId) extends QuickMessageException(
  s"Post not found by id: $postId")

