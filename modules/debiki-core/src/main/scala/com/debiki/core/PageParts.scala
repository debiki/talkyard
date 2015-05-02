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


object PageParts {


  // Letting the page body / original post be number 1 is compatible with Discourse.
  val TitleId = 0
  val BodyId = 1
  val FirstReplyId = 2

  val LowestPostId = TitleId
  assert(LowestPostId == 0)

  val NoId = -1

  // These are used when new comments or actions are submitted to the server.
  // When they're submitted, their ids are unknown (the server has not yet
  // assigned them any id).
  val UnassignedId = -1001
  val UnassignedId2 = -1002
  val UnassignedId3 = -1003
  val UnassignedId4 = -1004
  def isActionIdUnknown(id: ActionId) = id <= UnassignedId


  def isArticleOrConfigPostId(id: ActionId) =
    id == PageParts.BodyId || id == PageParts.TitleId


  def isReply(postId: PostId) = postId >= FirstReplyId

}



/** The parts of a page are 1) posts: any title post, any body post, and any comments,
  * and 2) people, namely those who have authored or edited the posts.
  *
  * Should be immutable. If backed by the database, a serializable isolation level
  * transaction should be used.
  *
  * TODO move to debiki-server instead?
  */
abstract class PageParts extends People {

  private lazy val postsById: collection.Map[PostId, Post] = {
    val postsMap = mutable.HashMap[PostId, Post]()
    for (post <- allPosts) {
      postsMap.put(post.id, post)
    }
    postsMap
  }

  private lazy val childrenByParentId: collection.Map[PostId, immutable.Seq[Post]] = {
    // COULD find out how to specify the capacity?
    val childMap = mutable.HashMap[PostId, Vector[Post]]()
    for (post <- allPosts) {
      val parentIdOrNoId = post.parentId getOrElse PageParts.NoId
      var siblings = childMap.getOrElse(parentIdOrNoId, Vector[Post]())
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
  def titlePost: Option[Post] = post(PageParts.TitleId)

  def topLevelComments: immutable.Seq[Post] =
    childrenByParentId.getOrElse(PageParts.NoId, Nil) filterNot { post =>
      PageParts.isArticleOrConfigPostId(post.id)
    }

  def allPosts: Seq[Post]

  def post(postId: PostId): Option[Post] = postsById.get(postId)
  def thePost(postId: PostId): Post = post(postId) getOrDie "DwE9PKG3"


  def numRepliesTotal = allPosts.length
  def numRepliesVisible = allPosts count { post =>
    post.isSomeVersionApproved && !post.isDeleted && !post.isHidden
  }


  def theUser(userId: UserId): User


  def childrenOf(postId: PostId): immutable.Seq[Post] =
    childrenByParentId.getOrElse(postId, Nil)


  def successorsOf(postId: PostId): immutable.Seq[Post] = {
    val pending = ArrayBuffer[Post](childrenByParentId.getOrElse(postId, Nil): _*)
    val successors = ArrayBuffer[Post]()
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


  def parentOf(postId: PostId): Option[Post] =
    thePost(postId).parentId.map(id => thePost(id))


  /** Ancestors, starting with postId's parent. */
  def ancestorsOf(postId: PostId): List[Post] = {
    var ancestors: List[Post] = Nil
    var curPost: Option[Post] = Some(thePost(postId))
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
