/**
 * Copyright (C) 2014 Kaj Magnus Lindberg (born 1979)
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


package com.debiki.tck.dao.specs

import com.debiki.core._
import com.debiki.core.{PostActionPayload => PAP}
import com.debiki.core.Prelude._
import com.debiki.tck.dao.DbDaoSpec
import com.debiki.tck.dao.code._
import java.{util => ju}
import org.scalatest._


class PostsReadStatsSpec(daoFactory: DbDaoFactory) extends DbDaoSpec(daoFactory) {

  lazy val utils = new TestUtils(daoFactory)
  lazy val site = utils.createFirstSite()
  lazy val siteUtils = new SiteTestUtils(site, daoFactory)


  "The DAO can" - {

    var page: PageNoPath = null
    val PageText = "The page text"
    var post2: Post = null
    var post3: Post = null
    var passwordIdentity: PasswordIdentity = null
    var passwordRole: User = null
    var passwordLoginGrant: LoginGrant = null
    var guestLoginGrant: LoginGrant = null
    var guestUser: User = null
    val GuestIp = "0.0.0.1"
    val GuestIp2 = "0.0.0.2"
    val PasswordIp = "0.0.1.0"

    "create a password role and a page and comment #2" in {
      val (identity, user) = siteUtils.createPasswordRole()
      passwordIdentity = identity
      passwordRole = user
      passwordLoginGrant = siteUtils.login(passwordIdentity, ip = PasswordIp)

      page = siteUtils.createPageAndBody(
        passwordLoginGrant, PageRole.ForumTopic, PageText).withoutPath

      val (tmpPage, tmpPost2) = siteUtils.addComment(passwordLoginGrant, page, "Password comment")
      page = siteUtils.review(passwordLoginGrant, tmpPage, tmpPost2.id, Approval.AuthoritativeUser)
      post2 = page.parts.getPost(tmpPost2.id) getOrElse fail("Comment not found")
    }

    "login as guest, add comment #3" in {
      guestLoginGrant = siteUtils.loginAsGuest(name = "Test Guest", ip = GuestIp)
      guestUser = guestLoginGrant.user
      val (tmpPage, tmpPost3) = siteUtils.addComment(guestLoginGrant, page, "Guest comment")
      page = siteUtils.review(passwordLoginGrant, tmpPage, tmpPost3.id, Approval.AuthoritativeUser)
      post3 = page.parts.getPost(tmpPost3.id) getOrElse fail("Comment not found")
    }

    "find no posts read stats, for non-existing page" in {
      siteUtils.dao.loadPostsReadStats("non_existing_page") mustBe
        PostsReadStats("non_existing_page", Map.empty, Map.empty)
    }

    "find no posts read stats, for page with no votes" in {
      siteUtils.dao.loadPostsReadStats(page.id) mustBe
        PostsReadStats(page.id, Map.empty, Map.empty)
    }

    "add some post read stats" in {
      val (tmpPage, dummyVote) = siteUtils.vote(guestLoginGrant, page, post2.id, PAP.VoteLike)
      page = tmpPage
      siteUtils.dao.updatePostsReadStats(page.id, Set(PageParts.BodyId, post2.id), dummyVote)
    }

    "find posts read stats" in {
      val stats = siteUtils.dao.loadPostsReadStats(page.id)
      stats mustBe PostsReadStats(
        page.id,
        Map(
          PageParts.BodyId -> Set(GuestIp),
          post2.id -> Set(GuestIp)),
        Map.empty)
    }

    "add even more post read stats" in {
      val (tmpPage, dummyVote) = siteUtils.vote(passwordLoginGrant, page, post2.id, PAP.VoteLike)
      page = tmpPage
      siteUtils.dao.updatePostsReadStats(
        page.id, Set(PageParts.BodyId, post2.id), dummyVote)
    }

    "find more posts read stats" in {
      val stats = siteUtils.dao.loadPostsReadStats(page.id)
      stats mustBe PostsReadStats(
        page.id,
        Map(
          PageParts.BodyId -> Set(GuestIp),
          post2.id -> Set(GuestIp)),
        Map(
          PageParts.BodyId -> Set(passwordRole.id),
          post2.id -> Set(passwordRole.id)))
    }

    "not fail on duplicated ip inserts" in {
      pending
    }

    "not fail on duplicated guest id inserts" in {
      pending
    }

    "not fail on duplicated role inserts" in {
      // Now the password user votes again, and attempts to update the posts-read-stats for
      // posts 1 and 2 again.
      val (tmpPage, dummyVote) = siteUtils.vote(passwordLoginGrant, page, post3.id, PAP.VoteLike)
      page = tmpPage
      siteUtils.dao.updatePostsReadStats(
        page.id, Set(PageParts.BodyId, post2.id, post3.id), dummyVote)
    }

    "find even more posts read stats" in {
      val stats = siteUtils.dao.loadPostsReadStats(page.id)
      stats mustBe PostsReadStats(
        page.id,
        Map(
          PageParts.BodyId -> Set(GuestIp),
          post2.id -> Set(GuestIp)),
        Map(
          PageParts.BodyId -> Set(passwordRole.id),
          post2.id -> Set(passwordRole.id),
          post3.id -> Set(passwordRole.id)))
    }
  }

}


