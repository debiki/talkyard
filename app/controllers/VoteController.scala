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

    val voteType: PostVoteType = voteStr match {
      case "VoteLike" => PostVoteType.Like
      case "VoteWrong" => PostVoteType.Wrong
      case _ => throwBadReq("DwE35gKP8", s"Bad vote type: $voteStr")
    }

    if (delete) {
      request.dao.deleteVote(pageId, postId, voteType, voterId = request.theUser.id)
    }
    else {
      request.dao.voteOnPost(pageId, postId, voteType,
        voterId = request.theUser.id, voterIp = request.ip, postIdsRead)
    }

    val json = ReactJson.postToJson2(postId = postId, pageId = pageId, request.dao,
      includeUnapproved = false)
    OkSafeJson(json)
  }

}

