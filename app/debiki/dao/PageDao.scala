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

package debiki.dao

import com.debiki.core._
import debiki.DebikiHttp._
import java.{util => ju}
import scala.collection.immutable
import Prelude._


case class PageDao(override val id: PageId, transaction: SiteTransaction) extends Page {

  var _meta: Option[PageMeta] = null
  var _path: Option[PagePath] = null
  var _ancestorIdsParentFirst: immutable.Seq[PageId] = null

  val parts = new PagePartsDao(id, transaction)

  override def siteId = transaction.siteId


  override def meta: PageMeta = {
    if (_meta eq null) {
      _meta = transaction.loadPageMeta(id)
    }
    _meta getOrElse throwPageNotFound()
  }


  override def ancestorIdsParentFirst: immutable.Seq[PageId] = {
    if (_ancestorIdsParentFirst eq null) {
      _ancestorIdsParentFirst = transaction.loadAncestorPostIdsParentFirst(id)
    }
    _ancestorIdsParentFirst
  }


  override def path: PagePath = {
    if (_path eq null) {
      _path = transaction.loadPagePath(id)
    }
    _path getOrElse throwPageNotFound()
  }


  private def throwPageNotFound() =
    throwNotFound("DwE404GKP3", s"Page not found, id: `$id'")

}


case class PagePartsDao(override val pageId: PageId, transaction: SiteTransaction)
  extends PageParts {

  private var _usersById: Map[UserId, User] = null
  private var _allPosts: immutable.Seq[Post] = null

  override def theUser(userId: UserId): User = {
    loadUsersOnPage()
    _usersById.get(userId) getOrDie
      s"User not found, id: '$userId', page: '$pageId' [DwE4BYW2]"
  }

  def loadAllPosts() {
    if (_allPosts eq null) {
      _allPosts = transaction.loadPostsOnPage(pageId)
    }
  }

  override def allPosts: Seq[Post] = {
    if (_allPosts eq null) {
      loadAllPosts()
    }
    _allPosts
  }

  def loadUsersOnPage() {
    if (_usersById eq null) {
      _usersById = transaction.loadUsersOnPageAsMap2(pageId)
    }
  }
}
