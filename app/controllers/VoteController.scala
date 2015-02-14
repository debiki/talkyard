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

package controllers

import actions.ApiActions.PostJsonAction
import com.debiki.core._
import com.debiki.core.Prelude._
import collection.immutable
import debiki._
import debiki.DebikiHttp._
import play.api._
import play.api.libs.json._
import requests.{PageRequest, JsonPostRequest}
import Utils.OkSafeJson


/** Handles votes, e.g. "I like this comment" or "this comment is faulty" votes.
 */
object VoteController extends mvc.Controller {


  /** Currently handles only one vote at a time. Example post data, in Yaml:
    *   pageId: "123abc"
    *   postId: 123
    *   vote: "VoteLike"      # or "VoteWrong" or "VoteOffTopic"
    *   action: "CreateVote"  # or "DeleteVote"
    *   postIdsRead: [1, 9, 53, 82]
    */
  def handleVotes = PostJsonAction(RateLimits.RatePost, maxLength = 500) { request: JsonPostRequest =>
    val body = request.body
    val pageId = (body \ "pageId").as[PageId]
    val postId = (body \ "postId").as[PostId]
    val voteStr = (body \ "vote").as[String]
    val actionStr = (body \ "action").as[String]
    val postIdsReadSeq = (body \ "postIdsRead").asOpt[immutable.Seq[PostId]]

    val postIdsRead = postIdsReadSeq.getOrElse(Nil).toSet

    val delete: Boolean = actionStr match {
      case "CreateVote" => false
      case "DeleteVote" => true
      case _ => throwBadReq("DwE42GPJ0", s"Bad action: $actionStr")
    }

    // Check for bad requests
    if (delete) {
      if (postIdsReadSeq.isDefined)
        throwBadReq("DwE30Df5", "postIdsReadSeq specified when deleting a vote")
    }
    else {
      if (postIdsReadSeq.map(_.length) != Some(postIdsRead.size))
        throwBadReq("DwE942F0", "Duplicate ids in postIdsRead")
      if (!postIdsRead.contains(postId))
        throwBadReq("DwE46F82", "postId not part of postIdsRead")
    }

    val voteType: PostActionPayload.Vote = voteStr match {
      case "VoteLike" => PostActionPayload.VoteLike
      case "VoteWrong" => PostActionPayload.VoteWrong
      case "VoteOffTopic" => PostActionPayload.VoteOffTopic
      case _ => throwBadReq("DwE35gKP8", s"Bad vote type: $voteStr")
    }

    def deleteVoteAndNotf() {
      request.dao.deleteVoteAndNotf(request.userIdData, pageId, postId, voteType)
    }

    val (pageReq, pageParts) =
      if (delete) {
        deleteVoteAndNotf()

        val pageReq = PageRequest.forPageThatExists(request, pageId) getOrElse throwNotFound(
          "DwE22PF1", s"Page `$pageId' not found")
        (pageReq, pageReq.thePageParts)
      }
      else {
        // Prevent the user from voting many times by deleting any existing vote.
        // COULD consider doing this by browser cookie id and/or ip and/or fingerprint,
        // so it's not possible to vote many times from many accounts on one single
        // computer?
        // COULD move this to RdbSiteDao? So it'll be easier to test, won't need Selenium?
        deleteVoteAndNotf()

        // Now create the vote.
        val voteNoId = RawPostAction(id = PageParts.UnassignedId, postId = postId,
          creationDati = request.ctime, userIdData = request.userIdData, payload = voteType)
        val pageReq = PageRequest.forPageThatExists(request, pageId) getOrElse throwNotFound(
          "DwE48FK9", s"Page `$pageId' not found")

        val (updatedPage, voteWithId) = try {
          pageReq.dao.savePageActionGenNotfs(pageReq, voteNoId)
        }
        catch {
          case DbDao.DuplicateVoteException =>
            throwConflict("DwE26FX0", "Duplicate votes")
          case DbDao.LikesOwnPostException =>
            throwBadReq("DwE84QM0", "Cannot like own post")
        }

        // Downvotes (wrong, off-topic) should result in only the downvoted post
        // being marked as read, because a post *not* being downvoted shouldn't
        // give that post worse rating. (Remember that the rating of a post is
        // roughly the number of Like votes / num-times-it's-been-read.)
        val postsToMarkAsRead =
          if (voteType == PostActionPayload.VoteLike)
            postIdsRead
          else
            Set(postId)

        pageReq.dao.updatePostsReadStats(pageId, postsToMarkAsRead, voteWithId)
        (pageReq, updatedPage.parts)
      }

    val post = pageParts.getPost_!(postId)
    OkSafeJson(ReactJson.postToJson(post))
  }

}

