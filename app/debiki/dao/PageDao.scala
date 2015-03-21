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
import Prelude._


class PageDao(override val id: PageId, val siteDao: SiteDao) extends Page2 {

  var cachedMeta: Option[PageMeta] = None
  var cachedPath: Option[PagePath] = None
  var cachedAncestorIdsParentFirst: Option[List[PageId]] = None
  var cachedParts: Option[PageParts2] = None

  override def siteId = siteDao.siteId


  override def meta: PageMeta = {
    if (cachedMeta.isEmpty) {
      cachedMeta = siteDao.loadPageMeta(id)
    }
    cachedMeta getOrElse throwPageNotFound()
  }


  override def parts: PageParts2 = {
    if (cachedParts.isEmpty) {
      cachedParts = Some(new PageParts2 {}) // siteDao.loadPageParts2(id)
    }
    cachedParts getOrElse throwPageNotFound()
  }


  override def ancestorIdsParentFirst: List[PageId] = {
    if (cachedAncestorIdsParentFirst.isEmpty) {
      cachedAncestorIdsParentFirst = Some(siteDao.loadAncestorIdsParentFirst(id))
    }
    cachedAncestorIdsParentFirst.get
  }


  override def path: PagePath = {
    if (cachedPath.isEmpty) {
      cachedPath = siteDao.lookupPagePath(id)
    }
    cachedPath getOrElse throwPageNotFound()
  }


  private def throwPageNotFound() =
    throwNotFound("DwE404GKP3", s"Page not found, id: `$id'")

}

