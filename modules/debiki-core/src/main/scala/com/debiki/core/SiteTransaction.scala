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
import scala.collection.immutable


// SHOULD/COULD convert old method implementations to start using transactions.
trait SiteTransaction {
  def commit()
  def rollback()
  def siteId: SiteId

  def deferConstraints()

  /** Throws SiteAlreadyExistsException if the site already exists.
    * Throws TooManySitesCreatedException if you've created too many websites already
    * (from the same IP or email address).
    */
  def createSite(name: String, hostname: String, embeddingSiteUrl: Option[String],
    creatorIp: String, creatorEmailAddress: String, pricePlan: Option[String],
    quotaLimitMegabytes: Option[Int], isTestSiteOkayToDelete: Boolean): Site

  def addSiteHost(host: SiteHost)
  def loadSiteVersion(): Int

  def loadSettings(targets: Seq[SettingsTarget]): Seq[RawSettings]

  def loadResourceUsage(): ResourceUse

  def loadCategory(categoryId: CategoryId): Option[Category]
  def nextCategoryId(): Int
  def insertCategoryMarkSectionPageStale(category: Category)
  def updateCategoryMarkSectionPageStale(category: Category)

  def loadPost(uniquePostId: UniquePostId): Option[Post]
  def loadThePost(uniquePostId: UniquePostId): Post =
    loadPost(uniquePostId).getOrElse(throw PostNotFoundByIdException(uniquePostId))

  def loadPost(pageId: PageId, postId: PostId): Option[Post]
  def loadThePost(pageId: PageId, postId: PostId): Post =
    loadPost(pageId, postId).getOrElse(throw PostNotFoundException(pageId, postId))

  def loadPostsOnPage(pageId: PageId, siteId: Option[SiteId] = None): immutable.Seq[Post]
  def loadPosts(pagePostIds: Iterable[PagePostId]): immutable.Seq[Post]
  def loadPostsToReview(): immutable.Seq[Post]

  def nextPostId(): UniquePostId
  def insertPost(newPost: Post)
  def updatePost(newPost: Post)

  def loadLastPostRevision(postId: UniquePostId): Option[PostRevision]
  def loadPostRevision(postId: UniquePostId, revisionNr: Int): Option[PostRevision]
  def insertPostRevision(revision: PostRevision)
  def updatePostRevision(revision: PostRevision)

  def loadActionsByUserOnPage(userId: UserId, pageId: PageId): immutable.Seq[PostAction]
  def loadActionsDoneToPost(pageId: PageId, postId: PostId): immutable.Seq[PostAction]

  def deleteVote(pageId: PageId, postId: PostId, voteType: PostVoteType, voterId: UserId): Boolean
  def insertVote(uniquePostId: UniquePostId, pageId: PageId, postId: PostId, voteType: PostVoteType, voterId: UserId)

  /** Remembers that the specified posts have been read by a certain user.
    */
  def updatePostsReadStats(pageId: PageId, postIdsRead: Set[PostId], readById: UserId,
        readFromIp: String)

  def loadPostsReadStats(pageId: PageId, postId: Option[PostId]): PostsReadStats


  def loadFlagsFor(pagePostIds: immutable.Seq[PagePostId]): immutable.Seq[PostFlag]
  def insertFlag(uniquePostId: UniquePostId, pageId: PageId, postId: PostId, flagType: PostFlagType, flaggerId: UserId)
  def clearFlags(pageId: PageId, postId: PostId, clearedById: UserId)

  def nextPageId(): PageId

  def loadAllPageMetas(): immutable.Seq[PageMeta]
  def loadPageMeta(pageId: PageId): Option[PageMeta]
  def loadThePageMeta(pageId: PageId): PageMeta =
    loadPageMeta(pageId).getOrElse(throw PageNotFoundException(pageId))

  def loadPageMetas(pageIds: Seq[PageId]): immutable.Seq[PageMeta]
  def loadPageMetasAsMap(pageIds: Iterable[PageId]): Map[PageId, PageMeta]
  def insertPageMetaMarkSectionPageStale(newMeta: PageMeta)
  def updatePageMeta(newMeta: PageMeta, oldMeta: PageMeta, markSectionPageStale: Boolean)

  def markSectionPageContentHtmlAsStale(categoryId: CategoryId)
  def loadCachedPageContentHtml(pageId: PageId): Option[(String, CachedPageVersion)]
  // (Could move this one to a transactionless Dao interface?)
  def saveCachedPageContentHtmlPerhapsBreakTransaction(
    pageId: PageId, version: CachedPageVersion, html: String): Boolean

  def loadPagePath(pageId: PageId): Option[PagePath]
  def insertPagePath(pagePath: PagePath)

  def currentTime: ju.Date


  /** Remembers that a file has been uploaded and where it's located. */
  def insertUploadedFileMeta(uploadRef: UploadRef, sizeBytes: Int, mimeType: String,
        dimensions: Option[(Int, Int)])
  def deleteUploadedFileMeta(uploadRef: UploadRef)

  /** Remembers that an uploaded file is referenced from this post. */
  def insertUploadedFileReference(postId: UniquePostId, uploadRef: UploadRef, addedById: UserId)
  def deleteUploadedFileReference(postId: UniquePostId, uploadRef: UploadRef): Boolean
  def loadUploadedFileReferences(postId: UniquePostId): Set[UploadRef]


  def insertInvite(invite: Invite)
  def updateInvite(invite: Invite): Boolean
  def loadInvite(secretKey: String): Option[Invite]
  def loadInvites(createdById: UserId): immutable.Seq[Invite]

  def nextIdentityId: IdentityId
  def insertIdentity(Identity: Identity)

  def nextAuthenticatedUserId: UserId
  def insertAuthenticatedUser(user: CompleteUser)

  def loginAsGuest(loginAttempt: GuestLoginAttempt): GuestLoginResult

  def loadCompleteUser(userId: UserId): Option[CompleteUser]

  def loadTheCompleteUser(userId: UserId): CompleteUser =
    loadCompleteUser(userId).getOrElse(throw UserNotFoundException(userId))

  def updateCompleteUser(user: CompleteUser): Boolean
  def updateGuest(guest: User): Boolean

  def loadUser(userId: UserId): Option[User]
  def loadTheUser(userId: UserId) = loadUser(userId).getOrElse(throw UserNotFoundException(userId))

  def loadUsers(userIds: Seq[UserId]): immutable.Seq[User]
  def loadTheUsers(userIds: UserId*): immutable.Seq[User] = {
    val usersById = loadUsersAsMap(userIds)
    userIds.to[immutable.Seq] map { id =>
      usersById.getOrElse(id, throw UserNotFoundException(id))
    }
  }

  def loadUsersOnPageAsMap2(pageId: PageId, siteId: Option[SiteId] = None): Map[UserId, User]
  def loadUsersAsMap(userIds: Iterable[UserId]): Map[UserId, User]
  def loadUserByEmailOrUsername(emailOrUsername: String): Option[User]

  def loadUsers(): immutable.Seq[User]
  def loadCompleteUsers(
    onlyApproved: Boolean = false,
    onlyPendingApproval: Boolean = false): immutable.Seq[CompleteUser]

  def loadUserIdsWatchingPage(pageId: PageId): Seq[UserId]

  def loadRolePageSettings(roleId: RoleId, pageId: PageId): Option[RolePageSettings]
  def loadRolePageSettingsOrDefault(roleId: RoleId, pageId: PageId) =
        loadRolePageSettings(roleId, pageId) getOrElse RolePageSettings.Default

  def saveDeleteNotifications(notifications: Notifications)

  def nextAuditLogEntryId: AuditLogEntryId
  def insertAuditLogEntry(entry: AuditLogEntry)
  def loadCreatePostAuditLogEntry(postId: UniquePostId): Option[AuditLogEntry]

  def loadBlocks(ip: String, browserIdCookie: String): immutable.Seq[Block]
  def insertBlock(block: Block)
  def unblockIp(ip: InetAddress)
  def unblockBrowser(browserIdCookie: String)
}


case class UserNotFoundException(userId: UserId) extends QuickException
case class PageNotFoundException(pageId: PageId) extends QuickException
case class PostNotFoundException(pageId: PageId, postId: PostId) extends QuickException
case class PostNotFoundByIdException(postId: UniquePostId) extends QuickException

