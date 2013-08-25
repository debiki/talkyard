/**
 * Copyright (C) 2013 Kaj Magnus Lindberg (born 1979)
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

package com.debiki.core

import com.debiki.core.{PostActionPayload => PAP}
import java.{util => ju}
import play.api.libs.json._
import Prelude._



/** Serializes things from/to JSON.
  * Hmm COULD use Writes and Reads instead:  http://stackoverflow.com/a/13925926/694469
  *
  * Don't change the JSON representation of something without knowing what you're
  * doing, or you'll break something: e.g. the browser might expect JSON
  * formatted in a certain manner, and the full text search database
  * also might expect JSON in a certain format.
  */
private[core]
object Protocols {


  def postToJson(post: Post): JsObject = {

    def toDateStringOrNull(anyDate: Option[ju.Date]): JsValue =
      anyDate.map(date => JsString(toIso8601T(date))) getOrElse JsNull

    def getTextOrNull(anyText: Option[String]): JsValue =
      anyText.map(JsString(_)) getOrElse JsNull

    val json = Json.obj(
      "pageId" -> post.page.id,
      "postId" -> post.id,
      "createdAt" -> toIso8601T(post.creationDati),
      "parentPostId" -> post.parentId,
      "currentText" -> post.currentText,
      "currentMarkup" -> post.markup,
      "anyDirectApproval" -> getTextOrNull(post.directApproval.map(_.toString)),
      "where" -> getTextOrNull(post.where),
      "loginId" -> post.loginId,
      "userId" -> post.userId,
      "newIp" -> getTextOrNull(post.actionDto.newIp),

      "lastActedUponAt" -> toIso8601T(post.lastActedUponAt),
      "lastReviewDati" -> toDateStringOrNull(post.lastReviewDati),
      "lastAuthoritativeReviewDati" -> toDateStringOrNull(post.lastAuthoritativeReviewDati),
      "lastApprovalDati" -> toDateStringOrNull(post.lastApprovalDati),
      "lastApprovedText" -> getTextOrNull(post.approvedText),
      "lastPermanentApprovalDati" -> toDateStringOrNull(post.lastPermanentApprovalDati),
      "lastManualApprovalDati" -> toDateStringOrNull(post.lastManualApprovalDati),
      "lastEditAppliedAt" -> toDateStringOrNull(post.lastEditAppliedAt),
      "lastEditRevertedAt" -> toDateStringOrNull(post.lastEditRevertedAt),
      "lastEditorId" -> getTextOrNull(post.lastEditorId),
      "postCollapsedAt" -> toDateStringOrNull(post.postCollapsedAt),
      "treeCollapsedAt" -> toDateStringOrNull(post.treeCollapsedAt),
      "treeClosedAt" -> toDateStringOrNull(post.treeClosedAt),
      "postDeletedAt" -> toDateStringOrNull(post.postDeletedAt),
      "treeDeletedAt" -> toDateStringOrNull(post.treeDeletedAt),
      "numEditSuggestionsPending" -> post.numPendingEditSuggestions,
      "numEditsAppliedUnreviewed" -> post.numEditsAppliedUnreviewed,
      "numEditsAppldPrelApproved" -> post.numEditsAppldPrelApproved,
      "numEditsToReview" -> post.numEditsToReview,
      "numDistinctEditors" -> post.numDistinctEditors,
      "numCollapsesToReview" -> post.numCollapsesToReview,
      "numUncollapsesToReview" -> post.numUncollapsesToReview,
      "numDeletesToReview" -> post.numDeletesToReview,
      "numUndeletesToReview" -> post.numUndeletesToReview,
      "numFlagsPending" -> post.numPendingFlags,
      "numFlagsHandled" -> post.numHandledFlags,

      "numCollapsePostVotesPro" -> post.numCollapsePostVotesPro,
      "numCollapsePostVotesCon" -> post.numCollapsePostVotesCon,
      "numUncollapsePostVotesPro" -> post.numUncollapsePostVotesPro,
      "numUncollapsePostVotesCon" -> post.numUncollapsePostVotesCon,
      "numCollapseTreeVotesPro" -> post.numCollapseTreeVotesPro,
      "numCollapseTreeVotesCon" -> post.numCollapseTreeVotesCon,
      "numUncollapseTreeVotesPro" -> post.numUncollapseTreeVotesPro,
      "numUncollapseTreeVotesCon" -> post.numUncollapseTreeVotesCon,
      "numDeletePostVotesPro" -> post.numDeletePostVotesPro,
      "numDeletePostVotesCon" -> post.numDeletePostVotesCon,
      "numUndeletePostVotesPro" -> post.numUndeletePostVotesPro,
      "numUndeletePostVotesCon" -> post.numUndeletePostVotesCon,
      "numDeleteTreeVotesPro" -> post.numDeleteTreeVotesPro,
      "numDeleteTreeVotesCon" -> post.numDeleteTreeVotesCon,
      "numUndeleteTreeVotesPro" -> post.numUndeleteTreeVotesPro,
      "numUndeleteTreeVotesCon" -> post.numUndeleteTreeVotesCon)

    json
  }


  def jsonToPost(json: JsValue): Post = {

    import play.api.libs.json.Reads.IsoDateReads

    val payload = PAP.CreatePost(
      parentPostId = (json \ "parentPostId").as[ActionId],
      text = (json \ "currentText").as[String],
      markup = (json \ "currentMarkup").as[String],
      approval = (json \ "anyDirectApproval").asOpt[String].map(Approval.parse _),
      where = (json \ "where").asOpt[String])

    val id = (json \ "postId").as[ActionId]

    val creationPostActionDto = PostActionDto[PAP.CreatePost](
      id = id,
      creationDati = (json \ "createdAt").as[ju.Date],
      payload = payload,
      postId = id,
      loginId = (json \ "loginId").as[String],
      userId = (json \ "userId").as[String],
      newIp = (json \ "newIp").asOpt[String])

    val numCollapsePostVotes = PostVoteState(
      pro     = (json \ "numCollapsePostVotesPro").as[Int],
      con     = (json \ "numCollapsePostVotesCon").as[Int],
      undoPro = (json \ "numUncollapsePostVotesPro").as[Int],
      undoCon = (json \ "numUncollapsePostVotesCon").as[Int])

    val numCollapseTreeVotes = PostVoteState(
      pro     = (json \ "numCollapseTreeVotesPro").as[Int],
      con     = (json \ "numCollapseTreeVotesCon").as[Int],
      undoPro = (json \ "numUncollapseTreeVotesPro").as[Int],
      undoCon = (json \ "numUncollapseTreeVotesCon").as[Int])

    val numDeletePostVotes = PostVoteState(
      pro     = (json \ "numDeletePostVotesPro").as[Int],
      con     = (json \ "numDeletePostVotesCon").as[Int],
      undoPro = (json \ "numUndeletePostVotesPro").as[Int],
      undoCon = (json \ "numUndeletePostVotesCon").as[Int])

    val numDeleteTreeVotes = PostVoteState(
      pro     = (json \ "numDeleteTreeVotesPro").as[Int],
      con     = (json \ "numDeleteTreeVotesCon").as[Int],
      undoPro = (json \ "numUndeleteTreeVotesPro").as[Int],
      undoCon = (json \ "numUndeleteTreeVotesCon").as[Int])

    val state = new PostState(
      creationPostActionDto       = creationPostActionDto,
      lastActedUponAt             = (json \ "lastActedUponAt").as[ju.Date],
      lastReviewDati              = (json \ "lastReviewDati").asOpt[ju.Date],
      lastAuthoritativeReviewDati = (json \ "lastAuthoritativeReviewDati").asOpt[ju.Date],
      lastApprovalDati            = (json \ "lastApprovalDati").asOpt[ju.Date],
      lastApprovedText            = (json \ "lastApprovedText").asOpt[String],
      lastPermanentApprovalDati   = (json \ "lastPermanentApprovalDati").asOpt[ju.Date],
      lastManualApprovalDati      = (json \ "lastManualApprovalDati").asOpt[ju.Date],
      lastEditAppliedAt           = (json \ "lastEditAppliedAt").asOpt[ju.Date],
      lastEditRevertedAt          = (json \ "lastEditRevertedAt").asOpt[ju.Date],
      lastEditorId                = (json \ "lastEditorId").asOpt[String],
      postCollapsedAt             = (json \ "postCollapsedAt").asOpt[ju.Date],
      treeCollapsedAt             = (json \ "treeCollapsedAt").asOpt[ju.Date],
      treeClosedAt                = (json \ "treeClosedAt").asOpt[ju.Date],
      postDeletedAt               = (json \ "postDeletedAt").asOpt[ju.Date],
      treeDeletedAt               = (json \ "treeDeletedAt").asOpt[ju.Date],
      numEditSuggestions          = (json \ "numEditSuggestionsPending").as[Int],
      numEditsAppliedUnreviewed   = (json \ "numEditsAppliedUnreviewed").as[Int],
      numEditsAppldPrelApproved   = (json \ "numEditsAppldPrelApproved").as[Int],
      numEditsToReview            = (json \ "numEditsToReview").as[Int],
      numDistinctEditors          = (json \ "numDistinctEditors").as[Int],
      numCollapsePostVotes        = numCollapsePostVotes,
      numCollapseTreeVotes        = numCollapseTreeVotes,
      numCollapsesToReview        = (json \ "numCollapsesToReview").as[Int],
      numUncollapsesToReview      = (json \ "numUncollapsesToReview").as[Int],
      numDeletePostVotes          = numDeletePostVotes,
      numDeleteTreeVotes          = numDeleteTreeVotes,
      numDeletesToReview          = (json \ "numDeletesToReview").as[Int],
      numUndeletesToReview        = (json \ "numUndeletesToReview").as[Int],
      numPendingFlags             = (json \ "numFlagsPending").as[Int],
      numHandledFlags             = (json \ "numFlagsHandled").as[Int])

    val pageId = (json \ "pageId").as[String]
    val page = PageParts(pageId, actionDtos = creationPostActionDto::Nil)

    // COULD rename `isLoadedFromCache` to ... wasDeserialized? Or wasSavedAndLoaded?
    // or `isNew = false`?
    Post(page, state, isLoadedFromCache = true)
  }

}
