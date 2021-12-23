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
import debiki.EdHttp.ResultException
import java.{util => ju}


class AnonymAppSpec extends DaoAppSuite(
        disableScripts = true, disableBackgroundJobs = true) {

  val site1 = new TestSiteAndDao(1, this)
  val site2 = new TestSiteAndDao(2, this)

  var createForumOneResult: CreateForumResult = _
  var createForumTwoResult: CreateForumResult = _

  var forumOneId: PageId = _
  var forumTwoId: PageId = _

  var createCatAResult: CreateCategoryResult = _
  var catA: Cat = _

  var ownerS1: Participant = _
  var userOneS1: Participant = _
  var userTwoS1: Participant = _

  var createPageResult: CreatePageResult = _
  var pageId: St = _

  "Something can do it" - {

    "Prepare" in {
      createForumOneResult = site1.dao.createForum(
            title = "Forum One", folder = "/forum1/", isForEmbCmts = false,
            Who(SystemUserId, browserIdData)).get

      createForumTwoResult = site1.dao.createForum(
            title = "Forum Two", folder = "/forum2/", isForEmbCmts = false,
            Who(SystemUserId, browserIdData)).get

      forumOneId = createForumOneResult.pagePath.pageId
      forumTwoId = createForumTwoResult.pagePath.pageId

      createCatAResult = createCategory(
            slug = "cat-a",
            forumPageId = createForumOneResult.pagePath.pageId,
            parentCategoryId = createForumOneResult.rootCategoryId,
            authorId = SystemUserId,
            browserIdData,
            site1.dao)

      catA = createCatAResult.category

      ownerS1 = createPasswordOwner("6mwe2tr0", site1.dao)
      userOneS1 = createPasswordUser("ff6622zz", site1.dao, trustLevel = TrustLevel.BasicMember)
      userTwoS1 = createPasswordUser("mm33ww77", site1.dao, trustLevel = TrustLevel.BasicMember)
    }

    "Try post anonymously — but anon posts are disabled, by default" in {
      val dao = site1.dao
      createPageResult = createPage2(PageType.Discussion, dao.textAndHtmlMaker.forTitle("Anon Test"),
            bodyTextAndHtml = dao.textAndHtmlMaker.forBodyOrComment("Test anon post."),
            authorId = userOneS1.id, browserIdData, dao, anyCategoryId = Some(catA.id),
            doAsAnon = Some(WhichAnon.NewAnon(AnonStatus.IsAnonBySelf)))
      pageId = createPageResult.id
    }

    "Load an anon user" in {
      val dao = site1.dao
      dao.readTx { tx =>
        val page = dao.newPageDao(pageId, tx)
        val pageParts = page.parts
        val relevantPosts = pageParts.allPosts // loads all posts, if needed
        //val userIdsToLoad = mut.Set[UserId]()
        //userIdsToLoad ++= relevantPosts.map(_.createdById)  // or relevantApprovedPosts? [iz01]
        val userIdsToLoad = relevantPosts.map(_.createdById)

        // Will this work
        val usersById = tx.loadParticipantsAsMap(userIdsToLoad)
      }
    }

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
