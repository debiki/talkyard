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
  def handleVotes = PostJsonAction(maxLength = 500) { request: JsonPostRequest =>
    val body = request.body
    val pageId = (body \ "pageId").as[PageId]
    val postId = (body \ "postId").as[PostId]
    val voteStr = (body \ "vote").as[String]
    val actionStr = (body \ "action").as[String]
    val postIdsReadSeq = (body \ "postIdsRead").as[immutable.Seq[PostId]]

    val postIdsRead = postIdsReadSeq.toSet
    if (postIdsReadSeq.length != postIdsRead.size)
      throwBadReq("DwE942F0", "Duplicate postIdsRead")
    if (!postIdsRead.contains(postId))
      throwBadReq("DwE46F82", "postId not part of postIdsRead")

    val delete: Boolean = actionStr match {
      case "CreateVote" => false
      case "DeleteVote" => true
      case _ => throwBadReq("DwE42GPJ0", s"Bad action: $actionStr")
    }

    val voteType: PostActionPayload.Vote = voteStr match {
      case "VoteLike" => PostActionPayload.VoteLike
      case "VoteWrong" => PostActionPayload.VoteWrong
      case "VoteOffTopic" => PostActionPayload.VoteOffTopic
      case _ => throwBadReq("DwE35gKP8", s"Bad vote type: $voteStr")
    }

    val (pageReq, pageParts) =
      if (delete) {
        request.dao.deleteVote(request.userIdData, pageId, postId, voteType)

        val pageReq = PageRequest.forPageThatExists(request, pageId) getOrElse throwNotFound(
          "DwE22PF1", s"Page `$pageId' not found")
        (pageReq, pageReq.page_!)
      }
      else {
        // Prevent the user from voting many times by deleting any existing vote.
        // COULD consider doing this by browser cookie id and/or ip and/or fingerprint,
        // so it's not possible to vote many times from many accounts on one single
        // computer?
        // COULD move this to RdbSiteDao? So it'll be easier to test, won't need Selenium?
        request.dao.deleteVote(request.userIdData, pageId, postId, voteType)

        // Now create the vote.
        val vote = RawPostAction(id = PageParts.UnassignedId, postId = postId,
          creationDati = request.ctime, userIdData = request.userIdData, payload = voteType)
        val pageReq = PageRequest.forPageThatExists(request, pageId) getOrElse throwNotFound(
          "DwE48FK9", s"Page `$pageId' not found")

        val (updatedPage, _) =
          pageReq.dao.savePageActionsGenNotfs(pageReq, vote::Nil)

        pageReq.dao.updatePostsReadStats(pageId, postIdsRead, vote)

        (pageReq, updatedPage.parts)
      }

    val json = BrowserPagePatcher(pageReq).jsonForPost(postId, pageParts)
    OkSafeJson(json)
  }

}

