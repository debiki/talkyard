/**
 * Copyright (c) 2021 Kaj Magnus Lindberg
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
import debiki.MaxLimits
import debiki.EdHttp.ResultException
import java.{util => ju}


class MaxLimitsDaoAppSpec extends DaoAppSuite(
        disableScripts = true, disableBackgroundJobs = true) {

  val site1 = new TestSiteAndDao(1, this)
  val site2 = new TestSiteAndDao(2, this)

  // Root cat, staff cat, and ideas, questions, problems cats = 5.
  val numCatsInNewForum = 5

  lazy val forum1Id: PageId = createForumOneResult.pagePath.pageId

  lazy val forum2Id: PageId = createForumTwoResult.pagePath.pageId

  lazy val createForumOneResult: CreateForumResult = site1.dao.createForum(
        title = "Forum One", folder = "/forum1/", isForEmbCmts = false,
        Who(SystemUserId, browserIdData)).get

  lazy val createForumTwoResult: CreateForumResult = site2.dao.createForum(
        title = "Forum Two", folder = "/forum2/", isForEmbCmts = false,
        Who(SystemUserId, browserIdData)).get


  "A site cannot create more than MaxLimit * that-site's-multipliers things" - {

    "prepare: create test sites and things, try to fail fast" in {
      site1.dao
      site2.dao
      forum1Id
      forum2Id
    }

    import MaxLimits.Default.maxCategories

    s"Suad super-admin bumps site 1 and 2's disk quota" in {
      val moreQuotaPatch = SuperAdminSitePatch.empty().copy(rdbQuotaMiBs = Some(100))
      globals.systemDao.updateSites(Seq(
            moreQuotaPatch.forSite(site1.id),
            moreQuotaPatch.forSite(site2.id)))
    }

    s"Default max limits is reasonably large" in {
      maxCategories mustBe >=(50)
    }

    s"Site 2 can create $maxCategories cats" in {
      for (catNr <- (numCatsInNewForum + 1) to maxCategories) {
        createCategory(
              slug = s"s2-cat-1-$catNr",
              forumPageId = createForumTwoResult.pagePath.pageId,
              parentCategoryId = createForumTwoResult.rootCategoryId,
              authorId = SystemUserId,
              browserIdData,
              site2.dao)
      }
    }

    "But not more than that" in {
      intercept[ResultException] {
        createCategory(
              slug = s"bad-cat",
              forumPageId = createForumTwoResult.pagePath.pageId,
              parentCategoryId = createForumTwoResult.rootCategoryId,
              authorId = SystemUserId,
              browserIdData,
              site2.dao)
      }.getMessage must include("TyE2MNYCATS_")
    }

    "Suad bumps the max limits" in {
      val patch = SuperAdminSitePatch.empty(site2.id).copy(
            readLimitsMultiplier = Some(2f),
            logLimitsMultiplier = Some(2f),
            createLimitsMultiplier = Some(2f))
      globals.systemDao.updateSites(Seq(patch))
    }

    "Site 2 can now create 2x more cats" in {
      for (catNr <- 1 to maxCategories) {
        createCategory(
              slug = s"s2-cat-2-$catNr",
              forumPageId = createForumTwoResult.pagePath.pageId,
              parentCategoryId = createForumTwoResult.rootCategoryId,
              authorId = SystemUserId,
              browserIdData,
              site2.dao)
      }
    }

    "But that's it. No more" in {
      intercept[ResultException] {
        createCategory(
              slug = s"s2-bad-cat",
              forumPageId = createForumTwoResult.pagePath.pageId,
              parentCategoryId = createForumTwoResult.rootCategoryId,
              authorId = SystemUserId,
              browserIdData,
              site2.dao)
      }.getMessage must include("TyE2MNYCATS_")
    }


    s"Site 1 can still create only $maxCategories cats" in {
      for (catNr <- (numCatsInNewForum + 1) to maxCategories) {
        createCategory(
              slug = s"s1-cat-$catNr",
              forumPageId = createForumOneResult.pagePath.pageId,
              parentCategoryId = createForumOneResult.rootCategoryId,
              authorId = SystemUserId,
              browserIdData,
              site1.dao)
      }
    }

    "... not more than that" in {
      intercept[ResultException] {
        createCategory(
              slug = s"s1-bad-cat",
              forumPageId = createForumOneResult.pagePath.pageId,
              parentCategoryId = createForumOneResult.rootCategoryId,
              authorId = SystemUserId,
              browserIdData,
              site1.dao)
      }.getMessage must include("TyE2MNYCATS_")
    }
  }

}
