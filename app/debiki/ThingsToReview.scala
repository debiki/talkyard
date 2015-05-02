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

package debiki

import com.debiki.core._
import com.debiki.core.Prelude._
import scala.collection.immutable



case class ThingsToReview(
  posts: immutable.Seq[Post],
  pageMetas: immutable.Seq[PageMeta],
  people: Seq[User],
  flags: immutable.Seq[PostFlag]) {

  private val postsById: Map[PostId, Post] = Map(posts.map(post => post.id -> post): _*)
  private val pagesById: Map[PageId, PageMeta] = Map(pageMetas.map(meta => meta.pageId -> meta): _*)
  private val peopleById: Map[UserId, User] = Map(people.map(user => user.id -> user): _*)
  private val flagsByPostId: Map[PostId, immutable.Seq[PostFlag]] = flags.groupBy(_.postId)

  def thePost(id: PostId): Post = postsById.get(id) getOrDie "DwE8F0Be2"
  def thePage(id: PageId): PageMeta = pagesById.get(id) getOrDie "DwE6PKJ5"
  def theUser(id: UserId): User = peopleById.get(id) getOrDie "DwE2dKG8"
  def theFlagsFor(id: PostId): immutable.Seq[PostFlag] = flagsByPostId.getOrElse(id, Nil)
}
