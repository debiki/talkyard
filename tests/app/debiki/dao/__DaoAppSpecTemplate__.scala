/**
 * Copyright (c) 2022 Kaj Magnus Lindberg
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
import com.debiki.core.Prelude._
import debiki.EdHttp.ResultException
import java.{util => ju}
import debiki.dao.DaoAppSuite.Jan2020


@org.scalatest.Ignore
class __DaoAppSpecTemplate__ extends DaoAppSuite(
        disableScripts = true, disableBackgroundJobs = true) {

  val site1 = new TestSiteAndDao(1, this)
  val site2 = new TestSiteAndDao(2, this)


  lazy val forumOneId: PageId = createForumOneResult.pagePath.pageId
  lazy val catA: Cat = createCatAResult.category

  lazy val forumTwoId: PageId = createForumTwoResult.pagePath.pageId

  lazy val createForumOneResult: CreateForumResult = site1.dao.createForum(
        title = "Forum One", folder = "/forum1/", isForEmbCmts = false,
        Who(SystemUserId, browserIdData)).get

  lazy val createForumTwoResult: CreateForumResult = site1.dao.createForum(
        title = "Forum Two", folder = "/forum2/", isForEmbCmts = false,
        Who(SystemUserId, browserIdData)).get

  lazy val createCatAResult: CreateCategoryResult = createCategory(
        slug = "cat-a",
        forumPageId = createForumOneResult.pagePath.pageId,
        parentCategoryId = createForumOneResult.rootCategoryId,
        authorId = SystemUserId,
        browserIdData,
        site1.dao)


  "Something can do it" - {

    /*
    "Create test sites and things, try to fail fast" in {
      // This will lazy init. Do in order, so db transactions happen in the right order,
      // and so any init problems get noticed here.
      site1.dao
      site2.dao
      forumOneId
      catA
    }

    "Something" in {
      intercept[ResultException] {
      }.getMessage must include("")
    }

    "The thing happens" in {
      // ...
      site1.daoStale = true
    }
    */
  }

}
