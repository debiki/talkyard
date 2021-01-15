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
import debiki.JsonUtils
import debiki.JsonUtils._
import debiki.EdHttp._
import java.{util => ju}

import com.debiki.core.Notification.NewPost
import play.api.libs.json._

import scala.collection.immutable
import scala.util.matching.Regex




// Split into JsX and JsObj, where JsX are primitives like Int, Float, Boolean etc,
// and JsObj reads objects. There'll be JsObjV1, V2, V3 etc for backwards compatibility
// with reading old site dumps. And the most recent JsObj can be a trait, that gets
// inherited by all JsObjVX and then they override and change only the things they do
// different.
//
object JsX {

  def JsSiteInclDetails_old(site: SiteInclDetails): JsObject = {
    Json.obj(
      "id" -> site.id,
      "pubId" -> site.pubId,
      "name" -> site.name,
      "status" -> site.status.toInt,
      "createdAtMs" -> site.createdAt.millis,
      "createdFromIp" -> site.createdFromIp,
      "creatorEmailAddress" -> site.creatorEmailAddress,
      "nextPageId" -> site.nextPageId,
      "quotaLimitMbs" -> site.quotaLimitMbs,
      "version" -> site.version,
      "numGuests" -> site.numGuests,
      "numIdentities" -> site.numIdentities,
      "numRoles" -> site.numParticipants,
      "numRoleSettings" -> site.numPageUsers,
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
      "hostnames" -> site.hostnames.map(JsHostnameInclDetails))
  }


  def JsHostnameInclDetails(host: HostnameInclDetails): JsObject = {
    Json.obj(
      "hostname" -> host.hostname,
      "role" -> host.role.toInt,
      "addedAt" -> host.addedAt.millis)
  }


  def readJsHostnameInclDetails(json: JsObject): HostnameInclDetails = {
    HostnameInclDetails(
      hostname = readJsString(json, "hostname"),
      role = Hostname.Role.fromInt(readJsInt(json, "role")).get,
      addedAt = readJsWhen(json, "addedAt"))
  }


  def JsSiteStats(stats: ResourceUse): JsObject = {
    Json.obj(
          "dbStorageLimitBytes" -> stats.databaseStorageLimitBytes,
          "dbStorageUsedBytes" -> stats.estimatedDbBytesUsed,
          "fileStorageLimitBytes" -> stats.fileStorageLimitBytes,
          "fileStorageUsedBytes" -> stats.fileStorageUsedBytes,
          "numAuditRows" -> stats.numAuditRows,
          "numGuests" -> stats.numGuests,
          "numIdentities" -> stats.numIdentities,
          "numParticipants" -> stats.numParticipants,
          "numPages" -> stats.numPages,
          "numPageParticipants" -> stats.numPageParticipants,
          "numPosts" -> stats.numPosts,
          "numPostTextBytes" -> stats.numPostTextBytes,
          "numPostRevisions" -> stats.numPostRevisions,
          "numPostRevBytes" -> stats.numPostRevBytes,
          "numPostsRead" -> stats.numPostsRead,
          "numActions" -> stats.numActions,
          "numUploads" -> stats.numUploads,
          "numUploadBytes" -> stats.numUploadBytes,
          "numNotfs" -> stats.numNotfs,
          "numEmailsSent" -> stats.numEmailsSent)
  }


  def JsInvite(invite: Invite, shallHideEmailLocalPart: Boolean, inclSecret: Boolean = false): JsObject = {
    val safeEmail =
      if (shallHideEmailLocalPart) hideEmailLocalPart(invite.emailAddress)
      else invite.emailAddress
    var json = Json.obj(   // change Typescript interface Invite to this [REFINVFLDS]
      "invitedEmailAddress" -> safeEmail,
      "startAtUrl" -> JsStringOrNull(invite.startAtUrl),
      "addToGroupIds" -> JsArray(invite.addToGroupIds.toSeq.map(id => JsNumber(id))),
      "invitedById" -> invite.createdById,
      "invitedAt" -> invite.createdAt.getTime,
      "acceptedAt" -> JsDateMsOrNull(invite.acceptedAt),
      "becameUserId" -> JsNumberOrNull(invite.userId),
      "deletedAt" -> JsDateMsOrNull(invite.deletedAt),
      "deletedById" -> JsNumberOrNull(invite.deletedById),
      "invalidatedAt" -> JsDateMsOrNull(invite.invalidatedAt))
    if (inclSecret) {
      json += "secretKey" -> JsString(invite.secretKey)
    }
    json
  }


  def JsGuestInclDetails(guest: Guest, inclEmail: Boolean): JsObject = {
    var json = JsUser(guest)
    if (inclEmail) {
      json += "emailAddress" -> JsString(guest.email)
      json += "emailNotfPrefs" -> JsNumber(guest.emailNotfPrefs.toInt)
    }
    json += "createdAt" -> JsWhenMs(guest.createdAt)
    json += "guestBrowserId" -> JsStringOrNull(guest.guestBrowserId)
    json += "extId" -> JsStringOrNull(guest.extId)
    json
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


  def JsUserInclDetails(user: UserInclDetails,
        usersById: Map[UserId, User], // CLEAN_UP remove, send back a user map instead
        groups: immutable.Seq[Group],
        callerIsAdmin: Boolean, callerIsStaff: Boolean = false, callerIsUserHerself: Boolean = false,
        anyStats: Option[UserStats] = None, inclPasswordHash: Boolean = false)
      : JsObject = {
    def callerIsStaff_ = callerIsAdmin || callerIsStaff
    dieIf(inclPasswordHash && !callerIsAdmin, "TyE305KSJWG2")
    var userJson = Json.obj(  // MemberInclDetails  [B28JG4]
      "id" -> user.id,
      "ssoId" -> JsStringOrNull(user.ssoId),
      "externalId" -> JsStringOrNull(user.ssoId),  // deprecated 2020-03-25 [395KSH20]
      "extId" -> JsStringOrNull(user.extId),
      "createdAtEpoch" -> JsNumber(user.createdAt.millis),  // REMOVE
      "createdAtMs" -> JsNumber(user.createdAt.millis),  // RENAME
      "username" -> user.username,
      "fullName" -> user.fullName,
      "isAdmin" -> user.isAdmin,
      "isModerator" -> user.isModerator,
      "deactivatedAtMs" -> JsWhenMsOrNull(user.deactivatedAt),  // REMOVE
      "deactivatedAt" -> JsWhenMsOrNull(user.deactivatedAt),
      "deletedAtMs" -> JsWhenMsOrNull(user.deletedAt),  // REMOVE
      "deletedAt" -> JsWhenMsOrNull(user.deletedAt),
      "bio" -> JsStringOrNull(user.about),
      "websiteUrl" -> JsStringOrNull(user.website),
      "location" -> JsStringOrNull(user.country),
      "seeActivityMinTrustLevel" -> JsNumberOrNull(user.seeActivityMinTrustLevel.map(_.toInt)),
      "avatarTinyHashPath" -> JsStringOrNull(user.tinyAvatar.map(_.hashPath)),
      "avatarSmallHashPath" -> JsStringOrNull(user.smallAvatar.map(_.hashPath)),
      "avatarMediumHashPath" -> JsStringOrNull(user.mediumAvatar.map(_.hashPath)),
      "suspendedTillEpoch" -> DateEpochOrNull(user.suspendedTill),  // REMOVE
      "suspendedTillMs" -> DateEpochOrNull(user.suspendedTill),  // RENAME
      "effectiveTrustLevel" -> user.effectiveTrustLevel.toInt)

    if (callerIsStaff_ || callerIsUserHerself) {
      val anyReviewer = user.reviewedById.flatMap(usersById.get)
      val safeEmail =
        if (callerIsAdmin || callerIsUserHerself) user.primaryEmailAddress
        else hideEmailLocalPart(user.primaryEmailAddress)

      userJson += "email" -> JsString(safeEmail)   // REMOVE
      userJson += "emailAddress" -> JsString(safeEmail)
      userJson += "emailVerifiedAtMs" -> JsDateMsOrNull(user.emailVerifiedAt)  // RENAME emailAddr...
      userJson += "emailVerifiedAt" -> JsDateMsOrNull(user.emailVerifiedAt)
      userJson += "hasPassword" -> JsBoolean(user.passwordHash.isDefined)
      if (inclPasswordHash)
        userJson += "passwordHash" -> JsStringOrNull(user.passwordHash)
      userJson += "emailNotfPrefs" -> JsNumber(user.emailNotfPrefs.toInt)
      userJson += "summaryEmailIntervalMinsOwn" -> JsNumberOrNull(user.summaryEmailIntervalMins)
      if (groups.nonEmpty) userJson += "summaryEmailIntervalMins" ->
        JsNumberOrNull(user.effectiveSummaryEmailIntervalMins(groups))
      userJson += "summaryEmailIfActiveOwn" -> JsBooleanOrNull(user.summaryEmailIfActive)
      if (groups.nonEmpty) userJson += "summaryEmailIfActive" ->
        JsBooleanOrNull(user.effectiveSummaryEmailIfActive(groups))
      userJson += "uiPrefs" -> user.uiPrefs.getOrElse(JsEmptyObj)
      userJson += "isApproved" -> JsBooleanOrNull(user.isApproved)
      userJson += "approvedAtMs" -> JsDateMsOrNull(user.reviewedAt)
      userJson += "approvedAt" -> JsDateMsOrNull(user.reviewedAt)
      userJson += "approvedById" -> JsNumberOrNull(user.reviewedById)
      userJson += "approvedByName" -> JsStringOrNull(anyReviewer.flatMap(_.fullName))
      userJson += "approvedByUsername" -> JsStringOrNull(anyReviewer.flatMap(_.username))
      userJson += "suspendedAtEpoch" -> DateEpochOrNull(user.suspendedAt)
      userJson += "suspendedAtMs" -> DateEpochOrNull(user.suspendedAt)
      userJson += "suspendedReason" -> JsStringOrNull(user.suspendedReason)
    }

    if (callerIsStaff_) {
      val anySuspender = user.suspendedById.flatMap(usersById.get)
      userJson += "suspendedById" -> JsNumberOrNull(user.suspendedById)
      userJson += "suspendedByUsername" -> JsStringOrNull(anySuspender.flatMap(_.username))
      userJson += "trustLevel" -> JsNumber(user.trustLevel.toInt)
      userJson += "lockedTrustLevel" -> JsNumberOrNull(user.lockedTrustLevel.map(_.toInt))
      userJson += "threatLevel" -> JsNumber(user.threatLevel.toInt)
      userJson += "lockedThreatLevel" -> JsNumberOrNull(user.lockedThreatLevel.map(_.toInt))

      anyStats foreach { stats =>
        userJson += "anyUserStats" -> JsUserStats(stats, isStaffOrSelf = true)
      }
    }

    userJson
  }


  def JsUserStats(stats: UserStats, isStaffOrSelf: Boolean): JsObject = {
    val tourTipsIds: immutable.Seq[String] = stats.tourTipsSeen getOrElse Nil
    var result = Json.obj(
      "userId" -> stats.userId,
      "lastSeenAt" -> JsWhenMs(stats.lastSeenAt),
      "lastPostedAt" -> JsWhenMsOrNull(stats.lastPostedAt),
      "firstSeenAt" -> JsWhenMs(stats.firstSeenAtOr0),
      "firstNewTopicAt" -> JsWhenMsOrNull(stats.firstNewTopicAt),
      "firstDiscourseReplyAt" -> JsWhenMsOrNull(stats.firstDiscourseReplyAt),
      "firstChatMessageAt" -> JsWhenMsOrNull(stats.firstChatMessageAt),
      "numDaysVisited" -> stats.numDaysVisited,
      "numSecondsReading" -> stats.numSecondsReading,
      "numDiscourseRepliesRead" -> stats.numDiscourseRepliesRead,
      "numDiscourseRepliesPosted" -> stats.numDiscourseRepliesPosted,
      "numDiscourseTopicsEntered" -> stats.numDiscourseTopicsEntered,
      "numDiscourseTopicsRepliedIn" -> stats.numDiscourseTopicsRepliedIn,
      "numDiscourseTopicsCreated" -> stats.numDiscourseTopicsCreated,
      "numChatMessagesRead" -> stats.numChatMessagesRead,
      "numChatMessagesPosted" -> stats.numChatMessagesPosted,
      "numChatTopicsEntered" -> stats.numChatTopicsEntered,
      "numChatTopicsRepliedIn" -> stats.numChatTopicsRepliedIn,
      "numChatTopicsCreated" -> stats.numChatTopicsCreated,
      "numLikesGiven" -> stats.numLikesGiven,
      "numLikesReceived" -> stats.numLikesReceived,
      "numSolutionsProvided" -> stats.numSolutionsProvided,
      "tourTipsSeen" -> JsArray(tourTipsIds.map(JsString)))
    if (isStaffOrSelf) {
      result += "lastEmailedAt" -> JsWhenMsOrNull(stats.lastEmailedAt)
      result += "lastSummaryEmailAt" -> JsWhenMsOrNull(stats.lastSummaryEmailAt)
      result += "nextSummaryEmailAt" -> JsWhenMsOrNull(stats.nextSummaryEmailAt)
      result += "emailBounceSum" -> JsNumber(stats.emailBounceSum.toDouble)
      result += "topicsNewSince" -> JsWhenMs(stats.topicsNewSince)
      result += "notfsNewSinceId" -> JsNumber(stats.notfsNewSinceId)
    }
    result
  }


  def JsUserVisitStats(stats: UserVisitStats): JsObject = {
    Json.obj(
      "userId" -> stats.userId,
      "visitDate" -> JsWhenDayMs(stats.visitDate),
      "numSecondsReading" -> stats.numSecondsReading,
      "numDiscourseRepliesRead" -> stats.numDiscourseRepliesRead,
      "numDiscourseTopicsEntered" -> stats.numDiscourseTopicsEntered,
      "numChatMessagesRead" -> stats.numChatMessagesRead,
      "numChatTopicsEntered" -> stats.numChatTopicsEntered)
  }


  def JsUsernameUsage(usernameUsage: UsernameUsage): JsObject = {
    Json.obj(
      "usernameLowercase" -> usernameUsage.usernameLowercase,
      "inUseFrom" -> JsWhenMs(usernameUsage.inUseFrom),
      "inUseTo" -> JsWhenMsOrNull(usernameUsage.inUseTo),
      "userId" -> usernameUsage.userId,
      "firstMentionAt" -> JsWhenMsOrNull(usernameUsage.firstMentionAt))
  }


  def JsIdentity(identity: Identity): JsObject = {
    identity match {
      case oauIdty: OpenAuthIdentity =>
        val details = oauIdty.openAuthDetails
        Json.obj(
          "identityType" -> "OAuth", // REMOVE
          "identityId" -> oauIdty.id,
          "userId" -> oauIdty.userId,
          "providerId" -> JsStringOrNull(details.confFileIdpId), // REMOVE
          "confFileIdpId" -> JsStringOrNull(details.confFileIdpId),
          "idpId" -> JsI32OrNull(details.idpId),
          "providerKey" -> details.idpUserId,  // REMOVE
          "idpUserId" -> details.idpUserId,
          "firstName" -> JsStringOrNull(details.firstName),
          "lastName" -> JsStringOrNull(details.lastName),
          "fullName" -> JsStringOrNull(details.fullName),
          "email" -> JsStringOrNull(details.email),
          "avatarUrl" -> JsStringOrNull(details.avatarUrl))
      case identityOpenId: IdentityOpenId =>
        unimplemented("IdentityOpenId to json [TyE305KRT01]")
      case identityEmailId: IdentityEmailId =>
        unimplemented("IdentityEmailIdT to json [yE305KRT02]")
    }
  }


  def JsGroup(group: Group): JsObject = {   // dupl code [B28JG4] also in UserController
    var json = Json.obj(
      "id" -> group.id,
      "username" -> group.theUsername,
      "fullName" -> JsStringOrNull(group.name),
      "isGroup" -> JsTrue)
      // "grantsTrustLevel" -> group.grantsTrustLevel)
    group.tinyAvatar foreach { uploadRef =>
      json += "avatarTinyHashPath" -> JsString(uploadRef.hashPath)
    }
    group.isDeleted  // what?
    json
  }


  def JsGroupAndStats(groupAndStats: GroupAndStats): JsObject = {
    var json = JsGroup(groupAndStats.group)
    groupAndStats.stats foreach { stats =>
      json += "stats" -> Json.obj(
        "numMembers" -> JsNumber(stats.numMembers))
    }
    json
  }


  def JsGroupInclDetails(group: Group, inclEmail: Boolean): JsObject = {
    var json = JsGroup(group)
    json += "extId" -> JsStringOrNull(group.extId)
    json += "createdAt" -> JsWhenMs(group.createdAt)
    // "tinyAvatar"
    // "smallAvatar"
    // Dupl code: [B28JG4]
    json += "summaryEmailIntervalMins" -> JsNumberOrNull(group.summaryEmailIntervalMins)
    json += "summaryEmailIfActive" -> JsBooleanOrNull(group.summaryEmailIfActive)
    json += "grantsTrustLevel" -> JsNumberOrNull(group.grantsTrustLevel.map(_.toInt))
    json += "uiPrefs" -> group.uiPrefs.getOrElse(JsNull)
    val perms = group.perms
    json += "maxUploadBytes" -> JsNumberOrNull(perms.maxUploadBytes)
    json += "allowedUplExts" -> JsStringOrNull(perms.allowedUplExts)
    json
  }



  def parsePatPerms(jsVal: JsValue, siteId: SiteId): PatPerms = {
    val jsob = asJsObject(jsVal, "pat perms")
    val anyMaxUplBytes = parseOptI32(jsob, "maxUploadBytes")
    val anyExts = parseOptSt(jsob, "allowedUplExts")
    PatPerms.create(ifBad = ThrowBadReq,
          maxUploadBytes = anyMaxUplBytes,
          allowedUplExts = anyExts)
  }


  def JsGroupParticipant(groupPp: GroupParticipant): JsObject = {
    Json.obj(
      "groupId" -> groupPp.groupId,
      "ppId" -> groupPp.ppId,
      "isMember" -> groupPp.isMember,
      "isManager" -> groupPp.isManager,
      "isAdder" -> groupPp.isAdder,
      "isBouncer" -> groupPp.isBouncer)
  }


  def JsMemberEmailAddress(member: UserEmailAddress): JsObject = {
    Json.obj(
      "userId" -> member.userId,
      "emailAddress" -> member.emailAddress,
      "addedAt" -> JsWhenMs(member.addedAt),
      "verifiedAt" -> JsWhenMsOrNull(member.verifiedAt))
  }


  def JsNotf(notf: Notification): JsObject = {
    // Related code, for the web app: makeNotificationsJson [305RKDAP25]
    var json = Json.obj(
      "id" -> notf.id,
      "createdAt" -> JsDateMs(notf.createdAt),
      "notfType" -> notf.tyype.toInt,
      "toUserId" -> notf.toUserId,
      "emailId" -> JsStringOrNull(notf.emailId),
      "emailStatus" -> notf.emailStatus.toInt,
      "seenAt" -> JsDateMsOrNull(notf.seenAt))
    notf match {
      case np: NewPost =>
        json += "postId" -> JsNumber(np.uniquePostId)
        json += "byUserId" -> JsNumber(np.byUserId)
    }
    json
  }


  val JsEmptyObj = JsObject(Nil)

  def JsObjOrNull(obj: Opt[JsObject]): JsValue =
    obj getOrElse JsNull

  def JsArrOrNull(arr: Opt[JsArray]): JsValue =
    arr getOrElse JsNull


  def JsPageMeta(pageMeta: PageMeta): JsObject = {  // Typescript interface PageMeta
    Json.obj(
      "id" -> pageMeta.pageId,
      "pageType" -> pageMeta.pageType.toInt,
      "version" -> pageMeta.version,
      "createdAtMs" -> JsDateMs(pageMeta.createdAt),
      "updatedAtMs" -> JsDateMs(pageMeta.updatedAt),
      "publishedAtMs" -> JsDateMsOrNull(pageMeta.publishedAt),
      "bumpedAtMs" -> JsDateMsOrNull(pageMeta.bumpedAt),
      "lastApprovedReplyAt" -> JsDateMsOrNull(pageMeta.lastApprovedReplyAt),
      "lastApprovedReplyById" -> JsNumberOrNull(pageMeta.lastApprovedReplyById),
      "categoryId" -> JsNumberOrNull(pageMeta.categoryId),
      "embeddingPageUrl" -> JsStringOrNull(pageMeta.embeddingPageUrl),
      "authorId" -> pageMeta.authorId,
      "frequentPosterIds" -> pageMeta.frequentPosterIds,
      "layout" -> pageMeta.layout.toInt,
      "pinOrder" -> JsNumberOrNull(pageMeta.pinOrder),
      "pinWhere" -> JsNumberOrNull(pageMeta.pinWhere.map(_.toInt)),
      "numLikes" -> pageMeta.numLikes,
      "numWrongs" -> pageMeta.numWrongs,
      "numBurys" -> pageMeta.numBurys,
      "numUnwanteds" -> pageMeta.numUnwanteds,
      "numRepliesVisible" -> pageMeta.numRepliesVisible,
      "numRepliesTotal" -> pageMeta.numRepliesTotal,
      "numPostsTotal" -> pageMeta.numPostsTotal,
      "numOrigPostLikeVotes" -> pageMeta.numOrigPostLikeVotes,
      "numOrigPostWrongVotes" -> pageMeta.numOrigPostWrongVotes,
      "numOrigPostBuryVotes" -> pageMeta.numOrigPostBuryVotes,
      "numOrigPostUnwantedVotes" -> pageMeta.numOrigPostUnwantedVotes,
      "numOrigPostRepliesVisible" -> pageMeta.numOrigPostRepliesVisible,
      "answeredAt" -> JsDateMsOrNull(pageMeta.answeredAt),
      "answerPostId" -> JsNumberOrNull(pageMeta.answerPostId),
      "doingStatus" -> pageMeta.doingStatus.toInt,
      "plannedAt" -> JsDateMsOrNull(pageMeta.plannedAt),
      "startedAt" -> JsDateMsOrNull(pageMeta.startedAt),
      "doneAt" -> JsDateMsOrNull(pageMeta.doneAt),
      "closedAt" -> JsDateMsOrNull(pageMeta.closedAt),
      "lockedAt" -> JsDateMsOrNull(pageMeta.lockedAt),
      "frozenAt" -> JsDateMsOrNull(pageMeta.frozenAt),
      "unwantedAt" -> JsNull,
      "hiddenAt" -> JsWhenMsOrNull(pageMeta.hiddenAt),
      "deletedAt" -> JsDateMsOrNull(pageMeta.deletedAt),
      "htmlTagCssClasses" -> pageMeta.htmlTagCssClasses,
      "htmlHeadTitle" -> pageMeta.htmlHeadTitle,
      "htmlHeadDescription" -> pageMeta.htmlHeadDescription)
  }


  def JsPostInclDetails(post: Post): JsObject = {
    COULD_OPTIMIZE // Skip null / false fields, so less json.
    // E.g. excl currRevSourcePatch, instead of 'currRevSourcePatch: null'.
    Json.obj(
      "id" -> post.id,
      "pageId" -> post.pageId,
      "nr" -> post.nr,
      "parentNr" -> JsNumberOrNull(post.parentNr),
      "multireplyPostNrs" -> JsArray(), // post.multireplyPostNrs
      "postType" -> post.tyype.toInt,
      "createdAt" -> JsDateMs(post.createdAt),
      "createdById" -> post.createdById,
      "currRevById" -> post.currentRevisionById,
      "currRevStartedAt" -> JsDateMs(post.currentRevStaredAt),
      "currRevLastEditedAt" -> JsDateMsOrNull(post.currentRevLastEditedAt),
      "currRevSourcePatch" -> JsStringOrNull(post.currentRevSourcePatch),
      "currRevNr" -> post.currentRevisionNr,
      "prevRevNr" -> JsNumberOrNull(post.previousRevisionNr),
      "lastApprovedEditAt" -> JsDateMsOrNull(post.lastApprovedEditAt),
      "lastApprovedEditById" -> JsNumberOrNull(post.lastApprovedEditById),
      "numDistinctEditors" -> post.numDistinctEditors,
      "safeRevNr" -> JsNumberOrNull(post.safeRevisionNr),
      "approvedSource" -> JsStringOrNull(post.approvedSource),
      "approvedHtmlSanitized" -> JsStringOrNull(post.approvedHtmlSanitized),
      "approvedAt" -> JsDateMsOrNull(post.approvedAt),
      "approvedById" -> JsNumberOrNull(post.approvedById),
      "approvedRevNr" -> JsNumberOrNull(post.approvedRevisionNr),
      "collapsedStatus" -> post.collapsedStatus.underlying,
      "collapsedAt" -> JsDateMsOrNull(post.collapsedAt),
      "collapsedById" -> JsNumberOrNull(post.collapsedById),
      "closedStatus" -> post.closedStatus.underlying,
      "closedAt" -> JsDateMsOrNull(post.closedAt),
      "closedById" -> JsNumberOrNull(post.closedById),
      "bodyHiddenAt" -> JsDateMsOrNull(post.bodyHiddenAt),
      "bodyHiddenById" -> JsNumberOrNull(post.bodyHiddenById),
      "bodyHiddenReason" -> JsStringOrNull(post.bodyHiddenReason),
      "deletedStatus" -> post.deletedStatus.underlying,
      "deletedAt" -> JsDateMsOrNull(post.deletedAt),
      "deletedById" -> JsNumberOrNull(post.deletedById),
      "pinnedPosition" -> JsNumberOrNull(post.pinnedPosition),
      "branchSideways" -> JsNumberOrNull(post.branchSideways.map(_.toInt)),
      "numPendingFlags" -> post.numPendingFlags,
      "numHandledFlags" -> post.numHandledFlags,
      "numPendingEditSuggestions" -> post.numPendingEditSuggestions,
      "numLikeVotes" -> post.numLikeVotes,
      "numWrongVotes" -> post.numWrongVotes,
      "numBuryVotes" -> post.numBuryVotes,
      "numUnwantedVotes" -> post.numUnwantedVotes,
      "numTimesRead" -> post.numTimesRead)
  }


  def JsPostAction(postAction: PostAction): JsObject = {
    Json.obj(
      "postId" -> postAction.uniqueId,
      "pageId" -> postAction.pageId,
      "postNr" -> postAction.postNr,
      "doneAt" -> JsWhenMs(postAction.doneAt),
      "doerId" -> postAction.doerId,
      "actionType" -> postAction.actionType.toInt)
  }


  def JsCategoryInclDetails(category: Category): JsObject = {
    Json.obj(
      "id" -> category.id,  // : CategoryId,
      "extId" -> JsStringOrNull(category.extImpId),
      "sectionPageId" -> category.sectionPageId,  // : PageId,
      // Later when adding child categories, see all: [0GMK2WAL] (currently parentId is just for the
      // root category).
      "parentId" -> JsNumberOrNull(category.parentId),
      "defaultSubCatId" -> JsNumberOrNull(category.defaultSubCatId),
      "name" -> category.name,
      "slug" -> category.slug,
      "position" -> category.position,
      "description" -> JsStringOrNull(category.description), // remove [502RKDJWF5]
      // [refactor] [5YKW294] [rename] Should no longer be a list. Change db too, from "nnn,nnn,nnn" to single int.
      "newTopicTypes" -> category.newTopicTypes.map(_.toInt),  // : immutable.Seq[PageType],
      // REFACTOR these two should be one field?: Unlist.Nothing = 0, Unlist.Topics = 1, Unlist.Category = 2?
      "unlistCategory" -> category.unlistCategory,
      "unlistTopics" -> category.unlistTopics,
      //  -----------
      "includeInSummaries" -> category.includeInSummaries.toInt,
      "createdAtMs" -> JsDateMs(category.createdAt),
      "updatedAtMs" -> JsDateMs(category.updatedAt),
      "lockedAtMs" -> JsDateMsOrNull(category.lockedAt),
      "frozenAtMs" -> JsDateMsOrNull(category.frozenAt),
      "deletedAtMs" -> JsDateMsOrNull(category.deletedAt))
  }

  def JsPagePath(pagePath: PagePath): JsValue =
    Json.obj(  // dupl code (4AKBS03)
      "value" -> pagePath.value,
      "folder" -> pagePath.folder,
      "pageId" -> JsStringOrNull(pagePath.pageId),
      "showId" -> pagePath.showId,
      "slug" -> pagePath.pageSlug)

  def JsPagePathWithId(pagePath: PagePathWithId): JsValue =
    Json.obj(  // dupl code (4AKBS03)
      "value" -> pagePath.value,
      "folder" -> pagePath.folder,
      "pageId" -> JsString(pagePath.pageId),
      "showId" -> pagePath.showId,
      "slug" -> pagePath.pageSlug,
      "canonical" -> pagePath.canonical)

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
      "doingStatus" -> meta.doingStatus.toInt,
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


  def JsSpamCheckResult(spamCheckResult: SpamCheckResult): JsObject = {
    var result = Json.obj(
      "spamCheckerDomain" -> spamCheckResult.spamCheckerDomain,
      "isSpam" -> spamCheckResult.isSpam)  // read here: [02MRHL2]
    spamCheckResult match {
      case spamFoundResult: SpamCheckResult.SpamFound =>
        result += "isCertain" -> JsBoolean(spamFoundResult.isCertain)
        result += "staffMayUnhide" -> JsBoolean(spamFoundResult.staffMayUnhide)
      case _ =>
    }
    result
  }

  def JsStringOrNull(value: Option[String]): JsValue =
    value.map(JsString).getOrElse(JsNull)

  def readJsString(json: JsObject, field: String): String =
    JsonUtils.readString(json, field)

  def JsBooleanOrNull(value: Option[Boolean]): JsValue =  // RENAME to JsBoolOrNull
    JsBoolOrNull(value)

  def JsBoolOrNull(value: Option[Boolean]): JsValue =
    value.map(JsBoolean).getOrElse(JsNull)

  def JsNumberOrNull(value: Option[Int]): JsValue =  // RENAME to JsNum32OrNull
    JsI32OrNull(value)

  def JsI32OrNull(value: Opt[i32]): JsValue =  // Scala 3: union types:  i32 | i64  ?
    value.map(JsNumber(_)).getOrElse(JsNull)

  def JsLongOrNull(value: Option[Long]): JsValue =   // RENAME to JsNum64OrNull ?
    value.map(JsNumber(_)).getOrElse(JsNull)

  def JsFloatOrNull(value: Option[Float]): JsValue =
    value.map(v => JsNumber(BigDecimal(v))).getOrElse(JsNull)

  def readJsLong(json: JsObject, field: String): Long =
    (json \ field).asInstanceOf[JsNumber].value.toLong

  def readJsInt(json: JsObject, field: String): Int =
    JsonUtils.readInt(json, field)

  def readJsFloat(json: JsObject, field: String): Float =
    (json \ field).asInstanceOf[JsNumber].value.toFloat

  def JsWhenMs(when: When) =
    JsNumber(when.unixMillis)

  def JsWhenDayMs(when: WhenDay) =
    JsNumber(when.unixDays.toLong * MillisPerDay)

  def readJsWhen(json: JsObject, field: String): When =
    JsonUtils.readWhen(json, field)

  def JsDateMs(value: ju.Date) =
    JsNumber(value.getTime)

  def JsWhenMsOrNull(value: Option[When]): JsValue =
    value.map(when => JsNumber(when.unixMillis)).getOrElse(JsNull)

  def JsWhenMinsOrNull(value: Option[When]): JsValue =
    value.map(when => JsNumber(when.unixMinutes)).getOrElse(JsNull)

  def JsDateMsOrNull(value: Option[ju.Date]): JsValue =
    value.map(JsDateMs).getOrElse(JsNull)

  def DateEpochOrNull(value: Option[ju.Date]): JsValue =
    value.map(date => JsNumber(date.getTime)).getOrElse(JsNull)

  private def date(value: ju.Date) =
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


  def JsPagePopularityScores(scores: PagePopularityScores): JsObject = {
    Json.obj(
      "pageId" -> scores.pageId,
      "updatedAt" -> JsWhenMs(scores.updatedAt),
      "algorithmVersion" -> scores.algorithmVersion,
      "dayScore" -> scores.dayScore,
      "weekScore" -> scores.weekScore,
      "monthScore" -> scores.monthScore,
      "quarterScore" -> scores.quarterScore,
      "yearScore" -> scores.yearScore,
      "allScore" -> scores.allScore)
  }


  def JsPageNotfPref(notfPref: PageNotfPref): JsObject = {
    Json.obj(  // ts PageNotfPref
      "memberId" -> notfPref.peopleId,
      "notfLevel" -> notfPref.notfLevel.toInt,
      "pageId" -> notfPref.pageId,
      "pagesPatCreated" -> notfPref.pagesPatCreated,
      "pagesPatRepliedTo" -> notfPref.pagesPatRepliedTo,
      "pagesInCategoryId" -> notfPref.pagesInCategoryId,
      "wholeSite" -> notfPref.wholeSite)
  }


  def JsPageParticipant(pagePp: PageParticipant): JsObject = {
    Json.obj(
      "pageId" -> pagePp.pageId,
      "userId" -> pagePp.userId,
      "addedById" -> JsNumberOrNull(pagePp.addedById),
      "removedById" -> JsNumberOrNull(pagePp.removedById),
      "inclInSummaryEmailAtMins" -> pagePp.inclInSummaryEmailAtMins,
      "readingProgress" -> pagePp.readingProgress.map(JsReadingProgress))
  }


  def JsReadingProgress(readingProgress: PageReadingProgress): JsObject = {
    Json.obj(
      "firstVisitedAt" -> JsWhenMs(readingProgress.firstVisitedAt),
      "lastVisitedAt" -> JsWhenMs(readingProgress.lastVisitedAt),
      "lastViewedPostNr" -> JsNumber(readingProgress.lastViewedPostNr),
      "lastReadAt" -> JsWhenMsOrNull(readingProgress.lastReadAt),
      "lastPostNrsReadRecentFirst" -> JsArray(
        readingProgress.lastPostNrsReadRecentFirst.map(rp => JsNumber(rp))),
      "lowPostNrsRead" -> JsArray(
        readingProgress.lowPostNrsRead.toSeq.map(x => JsNumber(x))),
      "secondsReading" -> readingProgress.secondsReading)
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


  def JsReviewTask(reviewTask: ReviewTask): JsObject = {
    // Related code: reviewStufToJson [073SMDR26]
    Json.obj(
      "id" -> reviewTask.id,
      "reasonsLong" -> ReviewReason.toLong(reviewTask.reasons),
      "createdById" -> reviewTask.createdById,
      "createdAt" -> JsDateMs(reviewTask.createdAt),
      "createdAtRevNr" -> JsNumberOrNull(reviewTask.createdAtRevNr),
      "moreReasonsAt" -> JsDateMsOrNull(reviewTask.moreReasonsAt),
      //moreReasonsAtRevNr: Option[ju.Date] = None,
      "decidedAt" -> JsDateMsOrNull(reviewTask.decidedAt),
      "completedAt" -> JsDateMsOrNull(reviewTask.completedAt),
      "decidedAtRevNr" -> JsNumberOrNull(reviewTask.decidedAtRevNr),
      "decidedById" -> JsNumberOrNull(reviewTask.decidedById),
      "invalidatedAt" -> JsDateMsOrNull(reviewTask.invalidatedAt),
      "decision" -> JsNumberOrNull(reviewTask.decision.map(_.toInt)),
      "maybeBadUserId" -> JsNumber(reviewTask.maybeBadUserId),
      "pageId" -> JsStringOrNull(reviewTask.pageId),
      "postId" -> JsNumberOrNull(reviewTask.postId),
      "postNr" -> JsNumberOrNull(reviewTask.postNr))
  }


  /** Public login info, for this Identity Provider (IDP) — does Not include
    * the OIDC client id or secret.
    */
  def JsIdentityProviderPubFields(idp: IdentityProvider): JsObject = {
    Json.obj(
      // "id" — no. Might leak info about how many providers have been configured.
      // (Maybe there are some inactive, for example.)
      "protocol" -> idp.protocol,
      "alias" -> idp.alias,
      "enabled" -> idp.enabled,
      "displayName" -> JsStringOrNull(idp.displayName),
      "description" -> JsStringOrNull(idp.description),
      "guiOrder" -> JsNumberOrNull(idp.guiOrder))
  }


  def JsIdentityProviderSecretConf(idp: IdentityProvider): JsObject = {
    val pubFields = JsIdentityProviderPubFields(idp)
    val oauAuthReqClaimsJsVal: JsValue = idp.oauAuthReqClaims.getOrElse(JsNull)
    pubFields ++ Json.obj(
        "confFileIdpId" -> JsStringOrNull(idp.confFileIdpId),
        "id" -> JsI32OrNull(idp.idpId),
        "trustVerifiedEmail" -> idp.trustVerifiedEmail,
        "emailVerifiedDomains" -> JsStringOrNull(idp.emailVerifiedDomains),
        "linkAccountNoLogin" -> idp.linkAccountNoLogin,
        "syncMode" -> idp.syncMode,
        "oauAuthorizationUrl" -> idp.oauAuthorizationUrl,
        "oauAuthReqScope" -> JsStringOrNull(idp.oauAuthReqScope),
        "oauAuthReqClaims" -> oauAuthReqClaimsJsVal,
        "oauAuthReqHostedDomain" -> JsStringOrNull(idp.oauAuthReqHostedDomain),
        "oauAccessTokenUrl" -> idp.oauAccessTokenUrl,
        "oauAccessTokenAuthMethod" -> JsStringOrNull(idp.oauAccessTokenAuthMethod),
        "oauClientId" -> idp.oauClientId,
        "oauClientSecret" -> idp.oauClientSecret,
        "oauIssuer" -> JsStringOrNull(idp.oauIssuer),
        "oidcUserInfoUrl" -> idp.oidcUserInfoUrl,
        "oidcUserInfoFieldsMap" -> JsObjOrNull(idp.oidcUserInfoFieldsMap),
        "oidcUserinfoReqSendUserIp" -> JsBoolOrNull(idp.oidcUserinfoReqSendUserIp),
        "oidcLogoutUrl" -> JsStringOrNull(idp.oidcLogoutUrl))
  }

}

