/**
 * Copyright (C) 2014 Kaj Magnus Lindberg (born 1979)
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


/**
  * @param repliedToPostId If defined, means this action represents a reply to a post.
  * @param votedLike If true, this action represents a Like vote of some post.
  * @param votedWrong
  * @param votedBury
  */
case class UserActionInfo(
  userId: UserId,
  pageId: String,
  pageTitle: String,
  pageRole: PageRole,
  postId: PostId,
  postExcerpt: String,
  actionId: ActionId,
  actingUserId: UserId,
  actingUserDisplayName: String,
  targetUserId: UserId,
  targetUserDisplayName: String,
  createdAt: ju.Date,
  createdNewPage: Boolean,
  repliedToPostId: Option[PostId],
  editedPostId: Option[PostId],
  approved: Boolean,
  deleted: Boolean,
  pinned: Boolean,
  collapsed: Boolean,
  closed: Boolean,
  votedLike: Boolean,
  votedWrong: Boolean,
  votedBury: Boolean)

