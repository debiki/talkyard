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


trait SiteTransaction {
  def commit()
  def rollback()
  def siteId: SiteId

  def loadResourceUsage(): ResourceUse
  def loadPostsOnPage(pageId: PageId, siteId: Option[SiteId] = None): immutable.Seq[Post2]
  def loadAncestorPostIdsParentFirst(pageId: PageId): immutable.Seq[PageId]

  def saveNewPost(newPost: Post2)
  def saveUpdatedPost(newPost: Post2)

  def lookupPagePath(pageId: PageId): Option[PagePath]
  def loadAllPageMetas(): immutable.Seq[PageMeta]
  def loadPageMeta(pageId: PageId): Option[PageMeta]
  def updatePageMeta(newMeta: PageMeta, oldMeta: PageMeta)

  def loadPagePartsOld(pageId: PageId): Option[PageParts]

  def currentTime: ju.Date

  def loadUser(userId: UserId2): Option[User] = loadUser(userId.toString)
  def loadUser(userId: UserId): Option[User]
  def loadUsersOnPageAsMap2(pageId: PageId, siteId: Option[SiteId] = None): Map[UserId, User]

}

