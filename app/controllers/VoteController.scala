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
import debiki.EdHttp._
import ed.server.{EdContext, EdController}
import ed.server.auth.Authz
import ed.server.http._
import javax.inject.Inject
import play.api.libs.json._
import play.api.mvc.{Action, ControllerComponents}
import talkyard.server.JsX.{JsUser, JsStringOrNull}


/** Handles votes, e.g. "I like this comment" or "this comment is faulty" votes.
 */
class VoteController @Inject()(cc: ControllerComponents, edContext: EdContext)
  extends EdController(cc, edContext) {

  import context.security.throwNoUnless


  /** Currently handles only one vote at a time. Example post data, in Yaml:
    *   pageId: "123abc"
    *   postNr: 123
    *   vote: "VoteLike"      # or "VoteWrong" or "VoteBury"
    *   action: "CreateVote"  # or "DeleteVote"
    *   postIdsRead: [1, 9, 53, 82]
    */
  def handleVotes: Action[JsValue] = PostJsonAction(RateLimits.RatePost, maxBytes = 500) {
        request: JsonPostRequest =>
    import request.{body, dao, theRequester => requester}
    val anyPageId = (body \ "pageId").asOpt[PageId]
    val anyDiscussionId = (body \ "altPageId").asOpt[AltPageId] ; CLEAN_UP // rename to "discussionId" [058RKTJ64]
    val anyEmbeddingUrl = (body \ "embeddingUrl").asOpt[String]
    val postNr = (body \ "postNr").as[PostNr] ; SHOULD // change to id, not nr? [idnotnr]
    val voteStr = (body \ "vote").as[String]
    val actionStr = (body \ "action").as[String]
    val postNrsReadSeq = (body \ "postNrsRead").asOpt[immutable.Seq[PostNr]]

    val postNrsRead = postNrsReadSeq.getOrElse(Nil).toSet

    val delete: Boolean = actionStr match {
      case "CreateVote" => false
      case "DeleteVote" => true
      case _ => throwBadReq("DwE42GPJ0", s"Bad action: $actionStr")
    }

    throwForbiddenIf(requester.isGroup, "TyE5PZWC2", "Groups may not vote")
    throwForbiddenIf(postNr < PageParts.BodyNr, "TyE4WDK20", s"Bad vote-on post nr: $postNr")
    postNrsReadSeq.foreach(_.find(_ < PageParts.BodyNr) foreach { badNr =>
      throwForbidden("TyE5BKPFU0", s"Bad post nr read: $badNr")
    })

    // Check for bad requests
    if (delete) {
      if (postNrsReadSeq.isDefined)
        throwBadReq("DwE30Df5", "postIdsReadSeq specified when deleting a vote")
    }
    else {
      if (postNrsReadSeq.map(_.length) isNot postNrsRead.size)
        throwBadReq("DwE942F0", "Duplicate nrs in postNrsRead")
      if (!postNrsRead.contains(postNr))
        throwBadReq("DwE46F82", "postNr not part of postNrsRead")
    }

    val voteType: PostVoteType = voteStr match {
      case "VoteLike" => PostVoteType.Like
      case "VoteWrong" => PostVoteType.Wrong
      case "VoteBury" => PostVoteType.Bury
      case "VoteUnwanted" => PostVoteType.Unwanted
      case _ => throwBadReq("DwE35gKP8", s"Bad vote type: $voteStr")
    }

    val (pageId, newEmbPage) = EmbeddedCommentsPageCreator.getOrCreatePageId(
      anyPageId = anyPageId, anyDiscussionId = anyDiscussionId,
      anyEmbeddingUrl = anyEmbeddingUrl, request)

    if (delete) {
      dao.deleteVote(pageId, postNr, voteType, voterId = request.theUser.id)
    }
    else {
      dao.ifAuthAddVote(pageId, postNr, voteType,
        voterId = request.theUser.id, voterIp = request.ip, postNrsRead)
    }

    val postJson = dao.jsonMaker.postToJson2(postNr = postNr, pageId = pageId,
      includeUnapproved = false, showHidden = true)

    val responseJson =
      EmbeddedCommentsPageCreator.makeAnyNewPageJson(newEmbPage) +
        ("updatedPost" -> postJson)

    OkSafeJson(responseJson)
  }


  def loadVoters(postId: PostId, voteType: Int): Action[Unit] = GetAction { request =>
    import request.{dao, requester}

    val pageMeta: PageMeta = dao.getThePageMetaForPostId(postId)
    val categoriesRootLast = dao.getAncestorCategoriesRootLast(pageMeta.categoryId)

    throwNoUnless(Authz.maySeePage(
      pageMeta, requester,
      dao.getGroupIdsOwnFirst(requester),
      dao.getAnyPrivateGroupTalkMembers(pageMeta),
      categoriesRootLast,
      tooManyPermissions = dao.getPermsOnPages(categoriesRootLast)),
      "EdE2QVBF06")

    val theVoteType = PostVoteType.fromInt(voteType) getOrElse throwBadArgument("EdE2QTKB40", "voteType")
    val voters = dao.readOnlyTransaction { tx =>
      val ids = tx.loadVoterIds(postId, theVoteType)
      tx.loadParticipants(ids)
    }
    val json = Json.obj(
      "numVoters" -> voters.size, // currently all voters always loaded [1WVKPW02]
      "someVoters" -> JsArray(voters map JsUser))
    OkSafeJson(json)
  }
}

