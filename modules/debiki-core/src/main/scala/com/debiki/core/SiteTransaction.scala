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

import java.{util => ju}
import scala.collection.immutable


// SHOULD/COULD convert old method implementations to start using transactions.
trait SiteTransaction {
  def commit()
  def rollback()
  def siteId: SiteId

  def loadSettings(targets: Seq[SettingsTarget]): Seq[RawSettings]

  def loadResourceUsage(): ResourceUse
  def loadAncestorPostIdsParentFirst(pageId: PageId): immutable.Seq[PageId]

  def loadPost(pageId: PageId, postId: PostId): Option[Post2]
  def loadThePost(pageId: PageId, postId: PostId): Post2 =
    loadPost(pageId, postId).getOrElse(throw PostNotFoundException(pageId, postId))

  def loadPostsOnPage(pageId: PageId, siteId: Option[SiteId] = None): immutable.Seq[Post2]
  def loadPosts(pagePostIds: Iterable[PagePostId]): immutable.Seq[Post2]
  def loadPostsToReview(): immutable.Seq[Post2]
  def insertPost(newPost: Post2)
  def updatePost(newPost: Post2)

  def loadActionsByUserOnPage(userId: UserId2, pageId: PageId): immutable.Seq[PostAction2]
  def loadActionsDoneToPost(pageId: PageId, postId: PostId): immutable.Seq[PostAction2]

  def deleteVote(pageId: PageId, postId: PostId, voteType: PostVoteType, voterId: UserId2): Boolean
  def insertVote(pageId: PageId, postId: PostId, voteType: PostVoteType, voterId: UserId2)

  /** Remembers that the specified posts have been read by a certain user.
    */
  def updatePostsReadStats(pageId: PageId, postIdsRead: Set[PostId], readById: UserId2,
        readFromIp: String)

  def loadPostsReadStats(pageId: PageId, postId: Option[PostId]): PostsReadStats


  def loadFlagsFor(postIds: immutable.Seq[PostId]): immutable.Seq[PostFlag]
  def insertFlag(pageId: PageId, postId: PostId, flagType: PostFlagType, flaggerId: UserId2)
  def clearFlags(pageId: PageId, postId: PostId, clearedById: UserId2)


  def nextPageId(): PageId

  def loadAllPageMetas(): immutable.Seq[PageMeta]
  def loadPageMeta(pageId: PageId): Option[PageMeta]
  def loadThePageMeta(pageId: PageId): PageMeta =
    loadPageMeta(pageId).getOrElse(throw PageNotFoundException(pageId))

  def loadPageMetas(pageIds: Seq[PageId]): immutable.Seq[PageMeta]
  def loadPageMetasAsMap(pageIds: Iterable[PageId]): Map[PageId, PageMeta]
  def insertPageMeta(newMeta: PageMeta)
  def updatePageMeta(newMeta: PageMeta, oldMeta: PageMeta)

  def loadPagePath(pageId: PageId): Option[PagePath]
  def insertPagePath(pagePath: PagePath)

  def loadPagePartsOld(pageId: PageId): Option[PageParts]

  def currentTime: ju.Date

  def loadUser(userId: UserId2): Option[User] = loadUser(userId.toString)
  def loadUser(userId: UserId): Option[User]
  def loadUsers(userIds: Seq[UserId2]): immutable.Seq[User]
  def loadUsersOnPageAsMap2(pageId: PageId, siteId: Option[SiteId] = None): Map[UserId, User]
  def loadUsersAsMap2(userIds: Iterable[UserId2]): Map[UserId2, User]
  def loadUserByEmailOrUsername(emailOrUsername: String): Option[User]

  def loadUserIdsWatchingPage(pageId: PageId): Seq[UserId]

  def loadRolePageSettings(roleId: RoleId, pageId: PageId): Option[RolePageSettings]
  def loadRolePageSettingsOrDefault(roleId: RoleId, pageId: PageId) =
        loadRolePageSettings(roleId, pageId) getOrElse RolePageSettings.Default

  def saveDeleteNotifications(notifications: Notifications)

}


case class PageNotFoundException(pageId: PageId) extends QuickException
case class PostNotFoundException(pageId: PageId, postId: PostId) extends QuickException

