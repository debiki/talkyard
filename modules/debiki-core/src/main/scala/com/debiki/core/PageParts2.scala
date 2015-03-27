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

import java.{util => ju}
import com.debiki.core.{PostActionPayload => PAP}
import com.debiki.core.PostActionPayload.EditPost
import scala.collection.mutable.ArrayBuffer
import scala.{collection => col}
import scala.collection.{immutable, mutable}
import Prelude._
import PageParts._



/** The parts of a page are 1) posts: any title post, any body post, and any comments,
  * and 2) people, namely those who have authored or edited the posts.
  *
  * Should be immutable? If backed by the database, a serializable isolation level
  * transaction should be used.
  */
abstract class PageParts2 extends People2 {

  private lazy val postsById: collection.Map[PostId, Post2] = {
    val postsMap = mutable.HashMap[PostId, Post2]()
    for (post <- allPosts) {
      postsMap.put(post.id, post)
    }
    postsMap
  }

  private lazy val childrenByParentId: collection.Map[PostId, immutable.Seq[Post2]] = {
    // COULD find out how to specify the capacity?
    val childMap = mutable.HashMap[PostId, Vector[Post2]]()
    for (post <- allPosts) {
      val parentIdOrNoId = post.parentId getOrElse PageParts.NoId
      var siblings = childMap.getOrElse(parentIdOrNoId, Vector[Post2]())
      siblings = siblings :+ post
      childMap.put(parentIdOrNoId, siblings)
    }
    childMap
  }

  def highestReplyId: PostId = allPosts.map(_.id).max
  private def dummyDate = new ju.Date
  def pageId = "dummy"
  def titlePost: Option[Post2] = None
  def loadAllPosts() {}
  def topLevelComments: Seq[Post2] = Nil
  def allPosts: Seq[Post2]

  def post(postId: PostId): Option[Post2] = postsById.get(postId)
  def thePost(postId: PostId): Post2 = post(postId) getOrDie "DwE9PKG3"

  /** Returns the post with id postId, its parent, grandparent, and so on. */
  def ancestorsStartingAt(postId: PostId): Seq[Post2] = Nil // TODO

  def derivePostStatuses(postId: PostId): PostStatuses = PostStatuses.Default // TODO

  def numRepliesInclDeleted: Int = 1 // TODO

  def theUser(userId: UserId2): User

  def childrenOf(postId: PostId): immutable.Seq[Post2] =
    childrenByParentId.getOrElse(postId, Nil)

}


abstract class People2 {

  def theUser(id: UserId2): User

}
