/**
 * Copyright (C) 2013 Kaj Magnus Lindberg (born 1979)
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

import scala.collection.{mutable => mut}
import scala.collection.mutable.DoubleLinkedList


/* Disabled. Uses Post, it's gone, now it's Post2.

/** Given a sequence of pinnings of posts, calculates the resulting positions
  * of all pinned posts. Used by PageParts.
  *
  * For example, if posts A, B, and C are pinned like this, then this happens:
  * A at position 1 --> [A]     (that is, A first, on position 1, and nothing else pinned)
  * B at position 1 --> [B, A]  (that is, B pushes A from position 1 to position 2)
  * C at position 2 --> [B, C, A]
  * C at position 3 --> [B, A, C]
  *
  * Currently requires that all pinned posts have been loaded, otherwise
  * some intermediate derived positions will be wrong (for example,
  * if you load only 5 pinned posts, and then pin a post at position 10,
  * it'll be pinned at position 6 — just after all currently known pinned posts).
  */
class PinnedPositionCalcer {

  /** For each set of siblings among which any post is pinned, we'll create a
    * buffer: [Some(postA), Some(postB), None, None, ....]
    * where Some(postX) indicates that postX is pinned at the same position
    * as where it occurs in the buffer.
    */
  private val pinnedPostsByParent = mut.Map[PostId, DoubleLinkedList[Post]]()


  def pinPost(post: Post, position: Int) {
    require(position > 0)

    var pinnedPosts = pinnedPostsByParent.get(post.parentIdOrNoId) getOrElse {
      val list = DoubleLinkedList[Post](post)
      pinnedPostsByParent(post.parentIdOrNoId) = list
      return
    }

    var entry = pinnedPosts

    // Remove `post` from pinnedPost, if present.
    while (entry.next != entry) {
      if (entry.elem == post) {
        entry.remove()
        if (entry eq pinnedPosts) {
          pinnedPosts = entry.next
          pinnedPostsByParent(post.parentIdOrNoId) = entry.next
        }
      }
      entry = entry.next
    }

    // Insert `post` into pinnedPost, at the correct position.
    val zeroBasedPosition = position - 1
    val length = pinnedPosts.size
    if (zeroBasedPosition >= length) {
      pinnedPosts = pinnedPosts.append(DoubleLinkedList(post))
      pinnedPostsByParent(post.parentIdOrNoId) = pinnedPosts
    }
    else {
      entry = pinnedPosts
      var i = 0
      while (i < zeroBasedPosition) {
        entry = entry.next
        i += 1
      }
      if (entry.prev ne null) {
        entry.prev.insert(DoubleLinkedList(post))
      }
      else {
        val newList = DoubleLinkedList(post)
        newList.insert(pinnedPosts)
        pinnedPostsByParent(post.parentIdOrNoId) = newList
      }
    }
  }


  def effectivePositionOf(post: Post): Option[Int] = {
    val pinnedPosts = pinnedPostsByParent.get(post.parentIdOrNoId) getOrElse {
      return None
    }
    val position = pinnedPosts.indexOf(post)
    if (position == -1)
      return None

    Some(position + 1)
  }

}

*/
