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
import scala.collection.mutable.ArrayBuffer
import scala.collection.{immutable, mutable}
import Prelude._
import PageParts._



/** The parts of a page are 1) posts: any title post, any body post, and any comments,
  * and 2) people, namely those who have authored or edited the posts.
  *
  * Should be immutable. If backed by the database, a serializable isolation level
  * transaction should be used.
  *
  * TODO move to debiki-server instead?
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

  def highestReplyId: Option[PostId] = {
    if (allPosts.isEmpty)
      return None
    val maxPostId = allPosts.map(_.id).max
    if (PageParts.isArticleOrConfigPostId(maxPostId)) None
    else Some(maxPostId)
  }

  def pageId: PageId
  def titlePost: Option[Post2] = post(PageParts.TitleId)

  def topLevelComments: immutable.Seq[Post2] =
    childrenByParentId.getOrElse(PageParts.NoId, Nil) filterNot { post =>
      PageParts.isArticleOrConfigPostId(post.id)
    }

  def allPosts: Seq[Post2]

  def post(postId: PostId): Option[Post2] = postsById.get(postId)
  def thePost(postId: PostId): Post2 = post(postId) getOrDie "DwE9PKG3"


  def numRepliesTotal = allPosts.length
  def numRepliesVisible = allPosts count { post =>
    post.isSomeVersionApproved && !post.isDeleted && !post.isHidden
  }


  def theUser(userId: UserId2): User


  def childrenOf(postId: PostId): immutable.Seq[Post2] =
    childrenByParentId.getOrElse(postId, Nil)


  def successorsOf(postId: PostId): immutable.Seq[Post2] = {
    val pending = ArrayBuffer[Post2](childrenByParentId.getOrElse(postId, Nil): _*)
    val successors = ArrayBuffer[Post2]()
    while (pending.nonEmpty) {
      val next = pending.remove(0)
      if (successors.find(_.id == next.id).nonEmpty) {
        die("DwE9FKW3", s"Cycle detected on page '$pageId'; it includes post '${next.id}'")
      }
      successors.append(next)
      pending.append(childrenOf(next.id): _*)
    }
    successors.toVector
  }


  def hasNonDeletedSuccessor(postId: PostId): Boolean = {
    // For now:
    childrenOf(postId) find { child =>
      !child.deletedStatus.isDeleted ||
        // Perhaps grandchildren not deleted?
        child.deletedStatus.onlyThisDeleted
    } nonEmpty
  }


  def parentOf(postId: PostId): Option[Post2] =
    thePost(postId).parentId.map(id => thePost(id))


  /** Ancestors, starting with postId's parent. */
  def ancestorsOf(postId: PostId): List[Post2] = {
    var ancestors: List[Post2] = Nil
    var curPost: Option[Post2] = Some(thePost(postId))
    while ({
      curPost = parentOf(curPost.get.id)
      curPost.nonEmpty
    }) {
      ancestors ::= curPost.get
    }
    ancestors.reverse
  }


  def findCommonAncestorId(postIds: Seq[PostId]): PostId = {
    TESTS_MISSING // COULD check for cycles?
    if (postIds.isEmpty || postIds.contains(PageParts.NoId))
      return PageParts.NoId

    val firstPost = thePost(postIds.head)
    var commonAncestorIds: Seq[PostId] = firstPost.id :: ancestorsOf(firstPost.id).map(_.id)
    for (nextPostId <- postIds.tail) {
      val nextPost = thePost(nextPostId)
      var ancestorIds = nextPost.id :: ancestorsOf(nextPost.id).map(_.id)
      var commonAncestorFound = false
      while (ancestorIds.nonEmpty && !commonAncestorFound) {
        val nextAncestorId = ancestorIds.head
        if (commonAncestorIds.contains(nextAncestorId)) {
          commonAncestorIds = commonAncestorIds.dropWhile(_ != nextAncestorId)
          commonAncestorFound = true
        }
        else {
          ancestorIds = ancestorIds.tail
        }
      }
      if (ancestorIds.isEmpty)
        return NoId
    }
    commonAncestorIds.head
  }

}


abstract class People2 {

  def theUser(id: UserId2): User

}
