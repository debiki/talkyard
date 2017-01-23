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

/*
package com.debiki.tck.dao.specs

import com.debiki.core._
import com.debiki.core.DbDao.{DuplicateVoteException, LikesOwnPostException}
import com.debiki.core.{PostActionPayload => PAP}
import com.debiki.core.Prelude._
import com.debiki.tck.dao.DbDaoSpec
import com.debiki.tck.dao.code._
import java.{util => ju}
import org.scalatest._


/** Tests votes: save, load, vote on others' comments, on ones own comment (not allowed).
  */
class VoteSpec(daoFactory: DbDaoFactory) extends DbDaoSpec(daoFactory) with Inside {

  lazy val utils = new TestUtils(daoFactory)
  lazy val site = utils.createFirstSite()
  lazy val siteUtils = new SiteTestUtils(site, daoFactory)
  def dao = siteUtils.dao


  "The DAO can" - {

    var page: PageNoPath = null

    val GuestIp2 = "0.0.0.2"
    var guestUser2: User = null
    var guestIdData2: UserIdData = null
    var post2: Post = null

    val GuestIp3 = "0.0.0.3"
    var guestUser3: User = null
    var post3: Post = null

    val PasswordIp4 = "0.0.0.4"
    var passwordLoginGrant4: LoginGrant = null
    var post4: Post = null


    def allComments = Seq(post2.id, post3.id, post4.id)


    /** Returns like, wrong, off-topic vote counts for posts #2, #3 and #4.
      */
    def countCommentVotes(): Seq[(Int, Int, Int)] = {
      val loadedPage = dao.loadPageParts(page.id) getOrElse fail()
      var result = Vector[(Int, Int, Int)]()
      for (postId <- allComments) {
        val post = loadedPage.getPost_!(postId)
        result :+= (post.numLikeVotes, post.numWrongVotes, post.numOffTopicVotes)
      }
      result
    }


    "create users and comments" - {
      "create guest 2, comment #2" in {
        guestUser2 = siteUtils.loginAsGuest(name = "Test Guest 2", ip = GuestIp2)
        guestIdData2 = UserIdData.newTest(guestUser2.id)
        page = siteUtils.createPageAndBody(
          guestUser2, PageRole.ForumTopic, "The page text").withoutPath
        val (tmpPage, tmpPost) = siteUtils.addComment(guestUser2, page, "By guest 2")
        page = siteUtils.review(guestUser2, tmpPage, tmpPost.id, Approval.AuthoritativeUser)
        post2 = page.parts.getPost(tmpPost.id) getOrElse fail("Post not found")
      }

      "create guest 3, comment #3" in {
        guestUser3 = siteUtils.loginAsGuest(name = "Test Guest 3", ip = GuestIp3)
        val (tmpPage, tmpPost) = siteUtils.addComment(guestUser3, page, "By guest 3")
        page = siteUtils.review(guestUser3, tmpPage, tmpPost.id, Approval.AuthoritativeUser)
        post3 = page.parts.getPost(tmpPost.id) getOrElse fail("Post not found")
      }

      "create password user 4, comment #4" in {
        val user = siteUtils.createPasswordRole()
        passwordLoginGrant4 = siteUtils.login(user, ip = PasswordIp4)
        val (tmpPage, tmpPost) =
          siteUtils.addComment(passwordLoginGrant4.user, page, "By password 4")
        page = siteUtils.review(passwordLoginGrant4.user, tmpPage, tmpPost.id, Approval.AuthoritativeUser)
        post4 = page.parts.getPost(tmpPost.id) getOrElse fail("Post not found")
      }
    }

    "find comments but no votes" in {
      countCommentVotes() mustBe Vector((0, 0, 0), (0, 0, 0), (0, 0, 0))
    }

    "one can Like, Wrong and Off-Topic vote others posts — and find the Like vote again" - {
      "guest 2 votes on post #3" in {
        val (tmpPage, vote: RawPostAction[_]) =
          siteUtils.vote(guestUser2, page, post3.id, PAP.VoteLike)
        page = tmpPage

        // Just once, verify that we get back exactly the same vote as we saved.
        inside(dao.loadPageParts(page.id)) {
          case Some(parts: PageParts) => {
            inside(parts.getActionById(vote.id)) {
              case Some(vote: PostAction[_]) =>
                vote.rawAction mustBe vote
            }
          }
        }

        countCommentVotes() mustBe Seq((0, 0, 0), (1, 0, 0), (0, 0, 0))
        val (tmpPageB, _) = siteUtils.vote(guestUser2, page, post3.id, PAP.VoteWrong)
        page = tmpPageB
        countCommentVotes() mustBe Seq((0, 0, 0), (1, 1, 0), (0, 0, 0))
        val (tmpPageC, _) = siteUtils.vote(guestUser2, page, post3.id, PAP.VoteOffTopic)
        page = tmpPageC
        countCommentVotes() mustBe Seq((0, 0, 0), (1, 1, 1), (0, 0, 0))
      }

      "guest 3 votes on post #4" in {
        val (tmpPage, _) = siteUtils.vote(guestUser3, page, post4.id, PAP.VoteLike)
        page = tmpPage
        val (tmpPageB, _) = siteUtils.vote(guestUser3, page, post4.id, PAP.VoteWrong)
        page = tmpPageB
        val (tmpPageC, _) = siteUtils.vote(guestUser3, page, post4.id, PAP.VoteOffTopic)
        page = tmpPageC
        countCommentVotes() mustBe Seq((0, 0, 0), (1, 1, 1), (1, 1, 1))
      }

      "password user 4 votes on post #2" in {
        val (tmpPage, _) = siteUtils.vote(passwordLoginGrant4.user, page, post2.id, PAP.VoteLike)
        page = tmpPage
        val (tmpPageB, _) = siteUtils.vote(passwordLoginGrant4.user, page, post2.id, PAP.VoteWrong)
        page = tmpPageB
        val (tmpPageC, _) = siteUtils.vote(passwordLoginGrant4.user, page, post2.id, PAP.VoteOffTopic)
        page = tmpPageC
        countCommentVotes() mustBe Seq((1, 1, 1), (1, 1, 1), (1, 1, 1))
      }
    }

    "one cannot vote more than once on the same post" - {
      "guest 2 votes on post #3 again" in {
        an [DuplicateVoteException.type] must be thrownBy {
          siteUtils.vote(guestUser2, page, post3.id, PAP.VoteLike)
        }
        an [DuplicateVoteException.type] must be thrownBy {
          siteUtils.vote(guestUser2, page, post3.id, PAP.VoteWrong)
        }
        an [DuplicateVoteException.type] must be thrownBy {
          val (tmpPageC, _) = siteUtils.vote(guestUser2, page, post3.id, PAP.VoteOffTopic)
        }
      }

      "password user 4 votes on post #2 again" in {
        an [DuplicateVoteException.type] must be thrownBy {
          siteUtils.vote(passwordLoginGrant4.user, page, post2.id, PAP.VoteLike)
        }
        an [DuplicateVoteException.type] must be thrownBy {
          siteUtils.vote(passwordLoginGrant4.user, page, post2.id, PAP.VoteWrong)
        }
        an [DuplicateVoteException.type] must be thrownBy {
          siteUtils.vote(passwordLoginGrant4.user, page, post2.id, PAP.VoteOffTopic)
        }
      }

      "no new votes were added" in {
        countCommentVotes() mustBe Seq((1, 1, 1), (1, 1, 1), (1, 1, 1))
      }
    }

    "one cannot Like ones own post" - {
      "guest 2 attempts to like his own comment #2" in {
        an [LikesOwnPostException.type] must be thrownBy {
          siteUtils.vote(guestUser2, page, post2.id, PAP.VoteLike)
        }
      }

      "password user 4 attempts to like his own comment #4" in {
        an [LikesOwnPostException.type] must be thrownBy {
          siteUtils.vote(passwordLoginGrant4.user, page, post4.id, PAP.VoteLike)
        }
      }

      "no new votes were added" in {
        countCommentVotes() mustBe Seq((1, 1, 1), (1, 1, 1), (1, 1, 1))
      }
    }

    "one *can* OffTopic-vote ones own post" - {
      "guest 2 off-topic votes his own comment #2" in {
        val (tmpPage, _) = siteUtils.vote(guestUser2, page, post2.id, PAP.VoteOffTopic)
        page = tmpPage
        countCommentVotes() mustBe Seq((1, 1, 2), (1, 1, 1), (1, 1, 1))
      }

      "password user 4 off-topic votes his own comment #4" in {
        val (tmpPage, _) = siteUtils.vote(passwordLoginGrant4.user, page, post4.id, PAP.VoteOffTopic)
        page = tmpPage
        countCommentVotes() mustBe Seq((1, 1, 2), (1, 1, 1), (1, 1, 2))
      }
    }

    "one can undo ones votes" - {
      "guest user 2 deletes her votes" in {
        dao.deleteVote(guestIdData2, page.id, post3.id, PAP.VoteLike)
        countCommentVotes() mustBe Seq((1, 1, 2), (0, 1, 1), (1, 1, 2))
        dao.deleteVote(guestIdData2, page.id, post3.id, PAP.VoteWrong)
        countCommentVotes() mustBe Seq((1, 1, 2), (0, 0, 1), (1, 1, 2))
        dao.deleteVote(guestIdData2, page.id, post3.id, PAP.VoteOffTopic)
        countCommentVotes() mustBe Seq((1, 1, 2), (0, 0, 0), (1, 1, 2))
      }

      "password user deletes her votes" in {
        dao.deleteVote(passwordLoginGrant4.testUserIdData, page.id, post2.id, PAP.VoteLike)
        dao.deleteVote(passwordLoginGrant4.testUserIdData, page.id, post2.id, PAP.VoteWrong)
        dao.deleteVote(passwordLoginGrant4.testUserIdData, page.id, post2.id, PAP.VoteOffTopic)
        countCommentVotes() mustBe Seq((0, 0, 1), (0, 0, 0), (1, 1, 2))
      }
    }

  }

}
*/


