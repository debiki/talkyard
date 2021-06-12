/**
 * Copyright (c) 2020 Kaj Magnus Lindberg
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
import com.debiki.core.PageParts.{BodyNr, TitleNr}
import debiki.EdHttp.ResultException
import java.{util => ju}


class CategoriesDaoAppSpec extends DaoAppSuite(
        disableScripts = true, disableBackgroundJobs = true) {


  val when: When = When.fromMillis(3100010001000L)
  val createdAt: When = when.minusMillis(10001000)

  var curDaoMaybeStale: SiteDao = _
  var daoStale: Bo = false

// Dupl code, use TestSiteAndDao instead.
  def daoSite1: SiteDao = {
    if (curDaoMaybeStale eq null) {
      globals.systemDao.getOrCreateFirstSite()
      curDaoMaybeStale = globals.siteDao(Site.FirstSiteId)
    }
    else if (daoStale) {
      curDaoMaybeStale = globals.siteDao(Site.FirstSiteId)
    }
    curDaoMaybeStale
  }

  lazy val forumId: PageId = createForumResult.pagePath.pageId
  lazy val catA: Cat = createCatAResult.category
  lazy val catB: Cat = createCatBResult.category
  var catC: Cat = _
  var catD: Cat = _

  lazy val forum2Id: PageId = createForum2Result.pagePath.pageId
  lazy val catM_f2: Cat = createCatMResult.category

  lazy val createForumResult: CreateForumResult = daoSite1.createForum(
        title = "Forum with Cat Cycles", folder = "/forum1/", isForEmbCmts = false,
        Who(SystemUserId, browserIdData)).get

  lazy val createForum2Result: CreateForumResult = daoSite1.createForum(
        title = "Forum 2 Cat M", folder = "/forum2/", isForEmbCmts = false,
        Who(SystemUserId, browserIdData)).get

  lazy val createCatAResult: CreateCategoryResult = createCategory(
        slug = "cat-a",
        forumPageId = createForumResult.pagePath.pageId,
        parentCategoryId = createForumResult.rootCategoryId,
        authorId = SystemUserId,
        browserIdData,
        daoSite1)

  lazy val createCatBResult: CreateCategoryResult = createCategory(
        slug = "cat-b",
        forumPageId = createForumResult.pagePath.pageId,
        parentCategoryId = createForumResult.rootCategoryId,
        authorId = SystemUserId,
        browserIdData,
        daoSite1)

  lazy val createCatMResult: CreateCategoryResult = createCategory(
        slug = "cat-m-forum2",
        forumPageId = createForum2Result.pagePath.pageId,
        parentCategoryId = createForum2Result.rootCategoryId,
        authorId = SystemUserId,
        browserIdData,
        daoSite1)


  "CategoriesDao can create and move cats, but refuses to create cat cycles" - {

    "prepare" in {
      // This will lazy init. Do in order, so db transactions happen in the right order,
      // and so any init problems get noticed here.
      daoSite1
      forumId
      catA
      catB
    }

    "refuses to make cat B a sub cat of itself: B —> B" in {
      intercept[ResultException] {
        editCategory(catB, permissions = Nil, browserIdData, daoSite1,
              newParentId = Some(catB.id))
      }.getMessage must include("TyECATCYCL03_")
    }

    "can make B a sub cat of A: A —> B" in {
      editCategory(catB, permissions = Nil, browserIdData, daoSite1,
            newParentId = Some(catA.id))
      daoStale = true
    }

    "refuses to change B's section page to different from parent A" in {
      intercept[ResultException] {
        editCategory(catB, permissions = Nil, browserIdData, daoSite1,
              newSectPageId = Some("5678"))  // wrong id
      }.getMessage must include("TyECATSECT05_")
    }

    "refuses to create cat cycle A —> B —> A" in {
      intercept[ResultException] {
        editCategory(catA, permissions = Nil, browserIdData, daoSite1,
              newParentId = Some(catB.id))
      }.getMessage must include("TyECATCYCL03_")
    }

    "won't create cat C as sub cat of B:  A —> B —> C,  cats depth 3 not implemented" in {
      intercept[ResultException] {
        createCategory(
              slug = "cat-c",
              forumPageId = forumId,
              parentCategoryId = catB.id,
              authorId = SystemUserId,
              browserIdData,
              daoSite1)
      }.getMessage must include("TyECATDEPTH3A_")
    }

    "won't create cat C with wrong section page id" in {
      intercept[ResultException] {
        createCategory(
              slug = "cat-c",
              forumPageId = "5678",  // wrong
              parentCategoryId = catA.id,
              authorId = SystemUserId,
              browserIdData,
              daoSite1)
      }.getMessage must include("TyECATSECT05_")
    }

    "but yes can create cat C as sub cat of A:  A —> C" in {
      catC = createCategory(
            slug = "cat-c",
            forumPageId = forumId,
            parentCategoryId = catA.id,
            authorId = SystemUserId,
            browserIdData,
            daoSite1).category
    }

    "create cat D, a base cat" in {
      catD = createCategory(
            slug = "cat-d",
            forumPageId = forumId,
            parentCategoryId = catA.parentId.get,
            authorId = SystemUserId,
            browserIdData,
            daoSite1).category
    }

    "won't move cat A to D:  Root —> D —> A —> {B, C}  — would get deeper than 3" in {
      intercept[ResultException] {
        editCategory(catA, permissions = Nil, browserIdData, daoSite1,
              newParentId = Some(catD.id))
      }.getMessage must include("TyECATDEPTH3B_")
    }

    "won't move cat M sect page 2 to sub cat of A, different sect page 1" in {
      intercept[ResultException] {
        editCategory(catM_f2, permissions = Nil, browserIdData, daoSite1,
              newParentId = Some(catA.id))
      }.getMessage must include("TyECATSECT05_")
    }

    "but can cat M to sub cat of A, if updating the section / index page id" in {
      editCategory(catM_f2.copy(sectionPageId = catA.sectionPageId),
            permissions = Nil, browserIdData, daoSite1,
            newParentId = Some(catA.id))
      daoStale = true
    }

    "cat tree looks fine" in {
      val catsById = daoSite1.getCatsById()
      val cA = catsById(catA.id)
      val cB = catsById(catB.id)
      val cC = catsById(catC.id)
      val cD = catsById(catD.id)
      val cM = catsById(catM_f2.id)

      cA.id mustBe catA.id

      // Wasn't changed to catB.id:
      cA.parentId mustBe Some(createForumResult.rootCategoryId)

      cB.parentId mustBe Some(catA.id)
      cC.parentId mustBe Some(catA.id)
      cD.parentId mustBe catA.parentId
      cM.parentId mustBe Some(catA.id)

      cB.sectionPageId mustBe catA.sectionPageId
      cC.sectionPageId mustBe catA.sectionPageId
      cD.sectionPageId mustBe catA.sectionPageId
      cM.sectionPageId mustBe catA.sectionPageId
    }
  }

}
