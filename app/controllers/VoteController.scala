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

import com.debiki.core._
import com.debiki.core.Prelude._
import collection.immutable
import debiki._
import debiki.DebikiHttp._
import io.efdi.server.http._
import play.api._
import play.api.libs.json._


/** Handles votes, e.g. "I like this comment" or "this comment is faulty" votes.
 */
object VoteController extends mvc.Controller {


  /** Currently handles only one vote at a time. Example post data, in Yaml:
    *   pageId: "123abc"
    *   postId: 123
    *   vote: "VoteLike"      # or "VoteWrong" or "VoteBury"
    *   action: "CreateVote"  # or "DeleteVote"
    *   postIdsRead: [1, 9, 53, 82]
    */
  def handleVotes = PostJsonAction(RateLimits.RatePost, maxLength = 500) { request: JsonPostRequest =>
    val body = request.body
    val pageId = (body \ "pageId").as[PageId]
    val postNr = (body \ "postId").as[PostNr]
    val voteStr = (body \ "vote").as[String]
    val actionStr = (body \ "action").as[String]
    val postNrsReadSeq = (body \ "postIdsRead").asOpt[immutable.Seq[PostNr]]

    val postNrsRead = postNrsReadSeq.getOrElse(Nil).toSet

    val delete: Boolean = actionStr match {
      case "CreateVote" => false
      case "DeleteVote" => true
      case _ => throwBadReq("DwE42GPJ0", s"Bad action: $actionStr")
    }

    // Check for bad requests
    if (delete) {
      if (postNrsReadSeq.isDefined)
        throwBadReq("DwE30Df5", "postIdsReadSeq specified when deleting a vote")
    }
    else {
      if (postNrsReadSeq.map(_.length) != Some(postNrsRead.size))
        throwBadReq("DwE942F0", "Duplicate ids in postIdsRead")
      if (!postNrsRead.contains(postNr))
        throwBadReq("DwE46F82", "postId not part of postIdsRead")
    }

    val voteType: PostVoteType = voteStr match {
      case "VoteLike" => PostVoteType.Like
      case "VoteWrong" => PostVoteType.Wrong
      case "VoteBury" => PostVoteType.Bury
      case "VoteUnwanted" => PostVoteType.Unwanted
      case _ => throwBadReq("DwE35gKP8", s"Bad vote type: $voteStr")
    }

    if (delete) {
      request.dao.deleteVote(pageId, postNr, voteType, voterId = request.theUser.id)
    }
    else {
      request.dao.ifAuthAddVote(pageId, postNr, voteType,
        voterId = request.theUser.id, voterIp = request.ip, postNrsRead)
    }

    val json = ReactJson.postToJson2(postNr = postNr, pageId = pageId, request.dao,
      includeUnapproved = false, showHidden = true)
    OkSafeJson(json)
  }

}

