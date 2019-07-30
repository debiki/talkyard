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

import scala.collection.mutable.ArrayBuffer
import scala.collection.{immutable, mutable}
import Prelude._
import PageParts._
import org.scalactic.{Bad, Good, One, Or}


object PageParts {


  // Letting the page body / original post be number 1 is compatible with Discourse.
  // COULD change to TitleNr = -1. That'd *reduce bug risk* because right now,
  // client side, one always need to remember to use `if (_.isNumber(postNr))` instead of just
  // `if (postNr)` to see if one got a post number or not. [4WKBA20]
  val TitleNr = 0

  val BodyNr = 1
  val FirstReplyNr = 2  // [5FKF0F2]

  val LowestPostNr: Int = TitleNr   // would need to remove if does: [4WKBA20]
  assert(LowestPostNr == 0)

  val NoNr: Int = -1   // would be good to change to 0 instead [4WKBA20]

  val MaxTitleLength = 150

  def isArticleOrTitlePostNr(nr: PostNr): Boolean =
    nr == PageParts.BodyNr || nr == PageParts.TitleNr



  def lastVisibleReply(posts: Seq[Post]): Option[Post] = {
    val replies: Seq[Post] = posts.filter(post =>
      post.isReply && post.isVisible)  // (96502764)
    //replies.maxOptBy(_.createdAt.getTime) ?? why maxOptBy not found ??
    if (replies.isEmpty) None
    else Some(replies.maxBy(_.createdAt.getTime))
  }


  /** Finds the 0 to 3 most frequent posters.
    * Would: If two users have both posted X posts, then, among them, pick the most recent poster?
    */
  def findFrequentPosters(posts: Seq[Post], ignoreIds: Set[UserId]): Seq[UserId] = {
    val numPostsByUserId = mutable.HashMap[UserId, Int]().withDefaultValue(0)
    for {
      post <- posts
      if post.isReply && post.isVisible  // (96502764)
      if !ignoreIds.contains(post.createdById)  // [3296KGP]
    } {
      val numPosts = numPostsByUserId(post.createdById)
      numPostsByUserId(post.createdById) = numPosts + 1
    }
    val userIdsAndNumPostsSortedDesc =
      numPostsByUserId.toSeq.sortBy(userIdAndNumPosts => userIdAndNumPosts._2)
    userIdsAndNumPostsSortedDesc.take(3).map(_._1)
  }

}


case class PreLoadedPageParts(
  pageId: PageId,
  allPosts: immutable.Seq[Post]) extends PageParts


/** The parts of a page are 1) posts: any title post, any body post, and any comments,
  * and 2) people, namely those who have authored or edited the posts.
  *
  * Should be immutable. If backed by the database, a serializable isolation level
  * transaction should be used.
  *
  * TODO move to debiki-server instead?
  */
abstract class PageParts {

  private lazy val postsByNr: collection.Map[PostNr, Post] = {
    val postsMap = mutable.HashMap[PostNr, Post]()
    for (post <- allPosts) {
      postsMap.put(post.nr, post)
    }
    postsMap
  }

  private lazy val childrenBestFirstByParentNr: collection.Map[PostNr, immutable.Seq[Post]] = {
    // COULD find out how to specify the capacity?
    val childMap = mutable.HashMap[PostNr, Vector[Post]]()
    for (post <- allPosts) {
      val parentNrOrNoNr = post.parentNr getOrElse PageParts.NoNr
      var siblings = childMap.getOrElse(parentNrOrNoNr, Vector[Post]())
      siblings = siblings :+ post
      childMap.put(parentNrOrNoNr, siblings)
    }
    childMap.mapValues(Post.sortPostsBestFirst)
  }

  def lastPostButNotOrigPost: Option[Post] =
    postByNr(highestReplyNr)

  // Could rename to highestPostNrButNotOrigPost? Because includes chat comments & messages too.
  def highestReplyNr: Option[PostNr] = {
    if (allPosts.isEmpty)
      return None
    val maxNr = allPosts.map(_.nr).max
    if (PageParts.isArticleOrTitlePostNr(maxNr)) None
    else Some(maxNr)
  }

  def pageId: PageId
  def titlePost: Option[Post] = postByNr(PageParts.TitleNr)

  def parentlessReplies: immutable.Seq[Post] =
    childrenBestFirstByParentNr.getOrElse(PageParts.NoNr, Nil) filterNot { post =>
      PageParts.isArticleOrTitlePostNr(post.nr)
    }

  def progressPosts: immutable.Seq[Post] =
    allPosts filter { post =>
      !PageParts.isArticleOrTitlePostNr(post.nr) && post.shallAppendLast
    }

  def allPosts: immutable.Seq[Post]

  def postByNr(postNr: PostNr): Option[Post] = postsByNr.get(postNr)
  def postByNr(postNr: Option[PostNr]): Option[Post] = postNr.flatMap(postsByNr.get)
  def thePostByNr(postNr: PostNr): Post = postByNr(postNr).getOrDie(
    "TyE9PKG3", s"Post nr $postNr on page $pageId not found")

  def postById(postId: PostId): Option[Post] = {
    COULD_OPTIMIZE // add a (lazy) by-id map?
    postsByNr.values.find(_.id == postId)
  }

  def thePostById(postId: PostId): Post = postById(postId).getOrDie(
    "EsE6YKG72", s"Post id $postId on page $pageId not found")

  def body: Option[Post] = postByNr(BodyNr)
  def theBody: Post = thePostByNr(BodyNr)
  def theTitle: Post = thePostByNr(TitleNr)

  /** Finds all of postNrs. If any single one (or more) is missing, returns Error. */
  def getPostsAllOrError(postNrs: Set[PostNr]): immutable.Seq[Post] Or One[PostNr] = {
    Good(postNrs.toVector map { nr =>
      postsByNr.getOrElse(nr, {
        return Bad(One(nr))
      })
    })
  }

  def numRepliesTotal: Int = allPosts.count(_.isReply)
  def numPostsTotal: Int = allPosts.length

  lazy val numRepliesVisible: Int = allPosts count { post =>
    post.isReply && post.isVisible
  }

  lazy val numOrigPostRepliesVisible: Int = allPosts count { post =>
    post.isOrigPostReply && post.isVisible
  }


  lazy val (numLikes, numWrongs, numBurys, numUnwanteds) = {
    var likes = 0
    var wrongs = 0
    var burys = 0
    var unwanteds = 0
    allPosts.filter(_.isVisible) foreach { post =>
      likes += post.numLikeVotes
      wrongs += post.numWrongVotes
      burys += post.numBuryVotes
      unwanteds += post.numUnwantedVotes
    }
    (likes, wrongs, burys, unwanteds)
  }


  lazy val lastVisibleReply: Option[Post] = {
    PageParts.lastVisibleReply(allPosts)
  }


  def frequentPosterIds: Seq[UserId] = {
    // Ignore the page creator and the last replyer, because they have their own first-&-last
    // entries in the Users column in the forum topic list. [7UKPF26], and a test [206K94QTD]
    PageParts.findFrequentPosters(this.allPosts,
      ignoreIds = body.map(_.createdById).toSet ++ lastVisibleReply.map(_.createdById).toSet)
  }


  /** Returns the index of `post` among its siblings, the first sibling is no 0.
    * Also tells if there are any non-deleted trees afterwards.
    */
  def siblingIndexOf(post: Post): (Int, Boolean) = post.parentNr match {
    case None => (0, false)
    case Some(parentNr) =>
      val siblings = childrenBestFirstOf(parentNr)
      var index = 0
      var result = -1
      while (index < siblings.length) {
        val sibling = siblings(index)
        if (sibling.nr == post.nr) {
          dieIf(result != -1, "DwE4JPU7")
          result = index
        }
        else if (result != -1) {
          if (!sibling.isDeleted || hasNonDeletedSuccessor(sibling.nr))
            return (result, true)
        }
        index += 1
      }
      (result, false)
  }


  def childrenBestFirstOf(postNr: PostNr): immutable.Seq[Post] =
    childrenBestFirstByParentNr.getOrElse(postNr, Nil)


  def descendantsOf(postNr: PostNr): immutable.Seq[Post] = {
    val pending = ArrayBuffer[Post](childrenBestFirstByParentNr.getOrElse(postNr, Nil): _*)
    val successors = ArrayBuffer[Post]()
    while (pending.nonEmpty) {
      val next = pending.remove(0)
      dieIf(successors.exists(_.nr == next.nr),
        "DwE9FKW3", s"Cycle detected on page '$pageId'; it includes post nr ${next.nr}")
      successors.append(next)
      pending.append(childrenBestFirstOf(next.nr): _*)
    }
    successors.toVector
  }


  def hasNonDeletedSuccessor(postNr: PostNr): Boolean = {
    // COULD optimize this, bad O(?) complexity when called on each node, like
    // ReactJson.pageToJsonImpl does — O(n*n)? Could start at the leaves and work up instead
    // and cache the result -> O(n).
    childrenBestFirstOf(postNr) exists { child =>
      !child.deletedStatus.isDeleted || hasNonDeletedSuccessor(child.nr)
    }
  }


  def parentOf(postNr: PostNr): Option[Post] =
    //thePostByNr(postNr).parentNr.map(id => thePostByNr(id))
    postByNr(postNr).flatMap(_.parentNr.flatMap(id => postByNr(id)))


  def depthOf(postNr: PostNr): Int =
    ancestorsOf(postNr).length


  /** Ancestors, starting with postId's parent. Dies if cycle. */
  def ancestorsOf(postNr: PostNr): List[Post] = {   COULD_OPTIMIZE // change to ArrayBuffer + Vector
    var ancestors: List[Post] = Nil
    var curPost: Option[Post] = Some(thePostByNr(postNr))
    var numLaps = 0
    while ({
      curPost = parentOf(curPost.get.nr)
      curPost.nonEmpty
    }) {
      numLaps += 1
      val theCurPost = curPost.get
      // To mostly avoid O(n^2) time, don't check for cycles so very often. [On2]
      dieIf((numLaps % 1000) == 0 && ancestors.exists(_.nr == theCurPost.nr),
        "EsE7YKW2", s"Post cycle on page $pageId around post nr ${theCurPost.nr}")
      ancestors ::= theCurPost
    }
    ancestors.reverse
  }


  def findCommonAncestorNr(postNrs: Seq[PostNr]): PostNr = {
    TESTS_MISSING
    if (postNrs.isEmpty || postNrs.contains(PageParts.NoNr))
      return PageParts.NoNr

    val postNrsVisited = mutable.HashSet[PostNr]()

    // But this cycle check isn't needed? ancestorsOf won't return a cycle; it dieIf instead.
    def dieIfCycle(postNr: PostNr) {
      dieIf(postNrsVisited contains postNr,
        "TyEPSTANCCYCL", s"Post parent nrs form a cycle on page $pageId, these nrs: $postNrsVisited")
      postNrsVisited.add(postNr)
    }

    val firstPost = thePostByNr(postNrs.head)
    var commonAncestorNrs: Seq[PostNr] = firstPost.nr :: ancestorsOf(firstPost.nr).map(_.nr)
    for (nextPostNr <- postNrs.tail) {
      val nextPost = thePostByNr(nextPostNr)
      var ancestorNrs = nextPost.nr :: ancestorsOf(nextPost.nr).map(_.nr)
      var commonAncestorFound = false
      postNrsVisited.clear()
      while (ancestorNrs.nonEmpty && !commonAncestorFound) {
        val nextAncestorNr = ancestorNrs.head
        dieIfCycle(nextAncestorNr)
        if (commonAncestorNrs.contains(nextAncestorNr)) {
          commonAncestorNrs = commonAncestorNrs.dropWhile(_ != nextAncestorNr)
          commonAncestorFound = true
        }
        else {
          ancestorNrs = ancestorNrs.tail
        }
      }
      if (ancestorNrs.isEmpty)
        return NoNr
    }
    commonAncestorNrs.head
  }

}
