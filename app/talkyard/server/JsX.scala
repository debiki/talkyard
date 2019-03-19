/**
 * Copyright (c) 2012-2018 Kaj Magnus Lindberg
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

package talkyard.server

import com.debiki.core._
import com.debiki.core.Prelude._
import java.{util => ju}
import play.api.libs.json._




object JsX {

  def JsSiteInclDetails(site: SiteInclDetails): JsObject = {
    Json.obj(
      "id" -> site.id,
      "pubId" -> site.publId,
      "name" -> site.name,
      "status" -> site.status.toInt,
      "createdAt" -> site.createdAt.millis,
      "createdFromIp" -> site.createdFromIp,
      "creatorEmailAddress" -> site.creatorEmailAddress,
      "nextPageId" -> site.nextPageId,
      "quotaLimitMbs" -> site.quotaLimitMbs,
      "version" -> site.version,
      "numGuests" -> site.numGuests,
      "numIdentities" -> site.numIdentities,
      "numRoles" -> site.numRoles,
      "numRoleSettings" -> site.numRoleSettings,
      "numPages" -> site.numPages,
      "numPosts" -> site.numPosts,
      "numPostTextBytes" -> site.numPostTextBytes,
      "numPostsRead" -> site.numPostsRead,
      "numActions" -> site.numActions,
      "numNotfs" -> site.numNotfs,
      "numEmailsSent" -> site.numEmailsSent,
      "numAuditRows" -> site.numAuditRows,
      "numUploads" -> site.numUploads,
      "numUploadBytes" -> site.numUploadBytes,
      "numPostRevisions" -> site.numPostRevisions,
      "numPostRevBytes" -> site.numPostRevBytes,
      "hostnames" -> Json.arr(site.hostnames.map(JsHostInclDetails)))
  }

  def JsHostInclDetails(host: HostnameInclDetails): JsObject = {
    Json.obj(
      "hostname" -> host.hostname,
      "role" -> host.role.toInt,
      "addedAt" -> host.addedAt.millis)
  }

  def JsUserOrNull(user: Option[Participant]): JsValue =  // RENAME to JsParticipantOrNull
    user.map(JsUser).getOrElse(JsNull)

  def JsUser(user: Participant): JsObject = {  // Typescript: Participant, RENAME to JsParticipant
    var json = Json.obj(
      "id" -> JsNumber(user.id),
      "username" -> JsStringOrNull(user.anyUsername),
      "fullName" -> JsStringOrNull(user.anyName))
    user.tinyAvatar foreach { uploadRef =>
      json += "avatarTinyHashPath" -> JsString(uploadRef.hashPath)
    }
    user.smallAvatar foreach { uploadRef =>
      json += "avatarSmallHashPath" -> JsString(uploadRef.hashPath)
    }
    if (user.isGuest) {
      json += "isGuest" -> JsTrue
    }
    else {
      require(user.isAuthenticated, "EdE8GPY4")
      json += "isAuthenticated" -> JsTrue  // COULD remove this, client side, use !isGuest instead
    }
    if (user.email.isEmpty) {
      json += "isEmailUnknown" -> JsTrue
    }
    if (user.isAdmin) {
      json += "isAdmin" -> JsTrue
    }
    if (user.isModerator) {
      json += "isModerator" -> JsTrue
    }
    if (user.isGone) {
      json += "isGone" -> JsTrue
    }
    json
  }

  def JsGroup(group: Group): JsObject = {
    var json = Json.obj(
      "id" -> group.id,
      "username" -> group.theUsername,
      "fullName" -> group.name,
      "isGroup" -> JsTrue)
      // "grantsTrustLevel" -> group.grantsTrustLevel)
    group.tinyAvatar foreach { uploadRef =>
      json += "avatarTinyHashPath" -> JsString(uploadRef.hashPath)
    }
    json
  }

  val JsEmptyObj = JsObject(Nil)

  def JsPagePath(pagePath: PagePath): JsValue =
    Json.obj(
      "value" -> pagePath.value,
      "folder" -> pagePath.folder,
      "showId" -> pagePath.showId,
      "slug" -> pagePath.pageSlug)

  def JsPageMetaBrief(meta: PageMeta): JsValue =  // Typescript interface PageMetaBrief
    Json.obj(
      "pageId" -> meta.pageId,
      "createdAtMs" -> JsDateMs(meta.createdAt),
      "createdById" -> meta.authorId,
      "lastReplyAtMs" -> JsDateMsOrNull(meta.lastApprovedReplyAt),
      "lastReplyById" -> JsNumberOrNull(meta.lastApprovedReplyById),
      "pageRole" -> meta.pageType.toInt,
      "categoryId" -> JsNumberOrNull(meta.categoryId),
      "embeddingPageUrl" -> JsStringOrNull(meta.embeddingPageUrl),
      "closedAtMs" -> JsDateMsOrNull(meta.closedAt),
      "lockedAtMs" -> JsDateMsOrNull(meta.lockedAt),
      "frozenAtMs" -> JsDateMsOrNull(meta.frozenAt),
      "hiddenAtMs" -> JsWhenMsOrNull(meta.hiddenAt),
      "deletedAtMs" -> JsDateMsOrNull(meta.deletedAt))

  def JsFlag(flag: PostFlag): JsValue =
    Json.obj(
      "flaggerId" -> flag.flaggerId,
      "flagType" -> flag.flagType.toInt,
      "flaggedAt" -> JsWhenMs(flag.doneAt),
      //flagReason
      "uniqueId" -> flag.uniqueId,
      "pageId" -> flag.pageId,
      "postNr" -> flag.postNr)

  def JsStringOrNull(value: Option[String]): JsValue =
    value.map(JsString).getOrElse(JsNull)

  def JsBooleanOrNull(value: Option[Boolean]): JsValue =
    value.map(JsBoolean).getOrElse(JsNull)

  def JsNumberOrNull(value: Option[Int]): JsValue =
    value.map(JsNumber(_)).getOrElse(JsNull)

  def JsLongOrNull(value: Option[Long]): JsValue =
    value.map(JsNumber(_)).getOrElse(JsNull)

  def JsFloatOrNull(value: Option[Float]): JsValue =
    value.map(v => JsNumber(BigDecimal(v))).getOrElse(JsNull)

  def JsWhenMs(when: When) =
    JsNumber(when.unixMillis)

  def JsDateMs(value: ju.Date) =
    JsNumber(value.getTime)

  def JsWhenMsOrNull(value: Option[When]): JsValue =
    value.map(when => JsNumber(when.unixMillis)).getOrElse(JsNull)

  def JsDateMsOrNull(value: Option[ju.Date]): JsValue =
    value.map(JsDateMs).getOrElse(JsNull)

  def DateEpochOrNull(value: Option[ju.Date]): JsValue =
    value.map(date => JsNumber(date.getTime)).getOrElse(JsNull)

  def date(value: ju.Date) =
    JsString(toIso8601NoSecondsNoT(value))

  def dateOrNull(value: Option[ju.Date]): JsValue = value match {
    case Some(v) => date(v)
    case None => JsNull
  }

  def JsDraftLocator(draftLocator: DraftLocator): JsObject = {
    Json.obj(
      "draftType" -> draftLocator.draftType.toInt,
      "categoryId" -> JsNumberOrNull(draftLocator.categoryId),
      "toUserId" -> JsNumberOrNull(draftLocator.toUserId),
      "postId" -> JsNumberOrNull(draftLocator.postId),
      "pageId" -> JsStringOrNull(draftLocator.pageId),
      "postNr" -> JsNumberOrNull(draftLocator.postNr))
  }

  def JsDraftOrNull(draft: Option[Draft]): JsValue =
    draft.map(JsDraft).getOrElse(JsNull)

  def JsDraft(draft: Draft): JsObject = {
    Json.obj(
      "byUserId" -> draft.byUserId,
      "draftNr" -> draft.draftNr,
      "forWhat" -> JsDraftLocator(draft.forWhat),
      "createdAt" -> JsWhenMs(draft.createdAt),
      "lastEditedAt" -> JsWhenMsOrNull(draft.lastEditedAt),
      "deletedAt" -> JsWhenMsOrNull(draft.deletedAt),
      "topicType" -> JsNumberOrNull(draft.topicType.map(_.toInt)),
      "postType" -> JsNumberOrNull(draft.postType.map(_.toInt)),
      "title" -> JsString(draft.title),
      "text" -> JsString(draft.text))
  }


  def JsPageNotfPref(notfPref: PageNotfPref): JsObject = {
    Json.obj(  // PageNotfPref
      "memberId" -> notfPref.peopleId,
      "notfLevel" -> notfPref.notfLevel.toInt,
      "pageId" -> notfPref.pageId,
      "pagesInCategoryId" -> notfPref.pagesInCategoryId,
      "wholeSite" -> notfPref.wholeSite)
  }


  def JsApiSecret(apiSecret: ApiSecret): JsObject = {
    Json.obj(
      "nr" -> apiSecret.nr,
      "userId" -> JsNumberOrNull(apiSecret.userId),
      "createdAt" -> JsWhenMs(apiSecret.createdAt),
      "deletedAt" -> JsWhenMsOrNull(apiSecret.deletedAt),
      "isDeleted" -> apiSecret.isDeleted,
      "secretKey" -> JsString(apiSecret.secretKey))
  }

}

