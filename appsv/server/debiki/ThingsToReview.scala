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

import scala.collection.Seq
import com.debiki.core._
import com.debiki.core.Prelude._
import scala.collection.immutable



case class ThingsToReview(
  posts: immutable.Seq[Post],
  pageMetas: immutable.Seq[PageMeta],
  people: Seq[Participant],
  flags: immutable.Seq[PostFlag]) {

  private val postsByNr: Map[PostNr, Post] = Map(posts.map(post => post.nr -> post): _*)
  private val pagesById: Map[PageId, PageMeta] = Map(pageMetas.map(meta => meta.pageId -> meta): _*)
  private val peopleById: Map[UserId, Participant] = Map(people.map(user => user.id -> user): _*)
  private val flagsByPostNr: Map[PostNr, immutable.Seq[PostFlag]] = flags.groupBy(_.postNr)

  def thePost(id: PostNr): Post = postsByNr.get(id) getOrDie "DwE8F0Be2"
  def thePage(id: PageId): PageMeta = pagesById.get(id) getOrDie "DwE6PKJ5"
  def theUser(id: UserId): Participant = peopleById.get(id) getOrDie "DwE2dKG8"
  def theFlagsFor(id: PostNr): immutable.Seq[PostFlag] = flagsByPostNr.getOrElse(id, Nil)
}
