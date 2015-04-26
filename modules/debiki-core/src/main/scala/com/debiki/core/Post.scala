/**
 * Copyright (C) 2012-2013 Kaj Magnus Lindberg (born 1979)
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

import collection.{immutable => imm, mutable => mut}
import java.{util => ju}
import play.api.libs.json._
import Prelude._



object Post {

  // def fromJson(json: JsValue) = Protocols.jsonToPost(json)

  def sortPosts2(posts: Seq[Post2]): Seq[Post2] = {
    posts // for now TODO implement
  }

  /** Sorts posts so e.g. interesting ones appear first, and deleted ones last.
    */
  def sortPosts2(posts: imm.Seq[Post2]): imm.Seq[Post2] = {
    posts.sortWith(sortPostsFn)
  }

  /** NOTE: Keep in sync with `sortPostIdsInPlace()` in client/app/ReactStore.ts
    */
  private def sortPostsFn(postA: Post2, postB: Post2): Boolean = {
    /* From app/debiki/HtmlSerializer.scala:
    if (a.pinnedPosition.isDefined || b.pinnedPosition.isDefined) {
      // 1 means place first, 2 means place first but one, and so on.
      // -1 means place last, -2 means last but one, and so on.
      val aPos = a.pinnedPosition.getOrElse(0)
      val bPos = b.pinnedPosition.getOrElse(0)
      assert(aPos != 0 || bPos != 0)
      if (aPos == 0) return bPos < 0
      if (bPos == 0) return aPos > 0
      if (aPos * bPos < 0) return aPos > 0
      return aPos < bPos
    } */

    // Place deleted posts last; they're rather uninteresting?
    if (!postA.deletedStatus.isDeleted && postB.deletedStatus.isDeleted)
      return true

    if (postA.deletedStatus.isDeleted && !postB.deletedStatus.isDeleted)
      return false

    // Place multireplies after normal replies. And sort multireplies by time,
    // for now, so it never happens that a multireply ends up placed before another
    // multireply that it replies to.
    // COULD place interesting multireplies first, if they're not constrained by
    // one being a reply to another.
    if (postA.multireplyPostIds.nonEmpty && postB.multireplyPostIds.nonEmpty) {
      if (postA.createdAt.getTime < postB.createdAt.getTime)
        return true
      if (postA.createdAt.getTime > postB.createdAt.getTime)
        return false
    }
    else if (postA.multireplyPostIds.nonEmpty) {
      return false
    }
    else if (postB.multireplyPostIds.nonEmpty) {
      return true
    }

    // Place interesting posts first.
    if (postA.likeScore > postB.likeScore)
      return true

    if (postA.likeScore < postB.likeScore)
      return false

    // Newest posts first. No, last
    if (postA.createdAt.getTime < postB.createdAt.getTime)
      return true
    else
      return false
  }

}

