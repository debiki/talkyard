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
import talkyard.server.authz.{Authz, AuthzCtxOnPats}
import talkyard.server.api.{UpsertTypeParams, CreateTagParams}
import org.scalactic.{Bad, Good, Or}

import com.debiki.core.Notification.NewPost
import play.api.libs.json._
import talkyard.server.parser.DoAsAnonFieldName

import scala.collection.immutable
import scala.util.matching.Regex




// Split into JsX and JsObj, where JsX are primitives like Int, Float, Boolean etc,
// and JsObj reads objects. There'll be JsObjV1, V2, V3 etc for backwards compatibility
// with reading old site dumps. And the most recent JsObj can be a trait, that gets
// inherited by all JsObjVX and then they override and change only the things they do
// different.
//
object JsX {   RENAME // to JsonPaSe

  def JsErrMsgCode(err: ErrMsgCode): JsObject = {  // ts: ErrMsgCode
    Json.obj(
        "errMsg" -> JsString(err.message),
        "errCode" -> JsString(err.code))
  }

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
          "rdbQuotaMiBs" -> stats.rdbQuotaMiBs,
          "dbStorageUsedBytes" -> stats.estimatedDbBytesUsed,
          "fileStorageLimitBytes" -> stats.fileStorageLimitBytes,
          "fileQuotaMiBs" -> stats.fileQuotaMiBs,
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


  def JsNotice(n: Notice): JsObject = {
    Json.obj(
          "id" -> n.noticeId,
          "toPatId" -> n.toPatId,
          "firstAtMins" -> JsWhenMins(n.firstAt),
          "lastAtMins" -> JsWhenMins(n.lastAt),
          "numTotal" -> n.numTotal,
          "noticeData" -> JsObjOrNull(n.noticeData))
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


  def JsKnownAnonym(anon: Anonym): JsObject = {  // ts: KnownAnonym
    // Bit hacky: Pretend we're showing this anonym for the person behind the anonym.
    // Later, maybe incl a boolean flag instead?
    JsPat(anon, TagsAndBadges.None, toShowForPatId = Some(anon.anonForPatId))
  }


  def JsUserOrNull(user: Option[Participant]): JsValue =  // RENAME to JsParticipantOrNull
    user.map(JsUser(_)).getOrElse(JsNull)


  def JsPat(pat: Pat, tagAndBadges: TagsAndBadges,  // Typescript: Pat
        toShowForPatId: Opt[PatId] = None): JsObject = {
    JsUser(pat, tagAndBadges.badges.getOrElse(pat.id, Nil), toShowForPatId = toShowForPatId)
  }


  /// As little info about someone as possible — just name and tiny avatar. Currently
  /// used for showing in the forum topic list.
  ///
  def JsPatNameAvatar(user: Pat): JsObject = {  // ts: PatNameAvatar
    var json = Json.obj(
      "id" -> JsNumber(user.id),
      "username" -> JsStringOrNull(user.anyUsername),
      "fullName" -> JsStringOrNull(user.anyName))
    user.tinyAvatar foreach { uploadRef =>
      json += "avatarTinyHashPath" -> JsString(uploadRef.hashPath)
    }
    json
  }

  /** If 'user' is an anonym or pseudonym, then, hens true id is *not* included, unless
    * toShowForPatId is hens true id  (or, later, if toShowForPatId has permission to
    * see anonyms  [see_alias]).  That is, if the person requesting to see a page,
    * is the the same the ano/pseudony, then, the ano/pseudonym's true id is included
    * so that that person can see hens own anonym(s).
    *
    * ts: Pat and subclasses, e.g. Guest, Anonym.
    */
  def JsUser(user: Pat, tags: Seq[Tag] = Nil, toShowForPatId: Opt[PatId] = None,
          inclSuspendedTill: Bo = false): JsObject = {  //RENAME to JsPat, ts: Pat
    var json = JsPatNameAvatar(user)
    user.smallAvatar foreach { uploadRef =>
      json += "avatarSmallHashPath" -> JsString(uploadRef.hashPath)
    }

    if (user.isAnon) user match {
      case anon: Anonym =>
        json += "isAnon" -> JsTrue  ; REMOVE // ?, maybe anonStatus is enough
        json += "anonStatus" -> JsNumber(anon.anonStatus.toInt)
        // If this anonym is user `toShowForPatId`s own anonym, include details — so
        // that user can see it's hens own anonym.
        toShowForPatId foreach { showForPatId: PatId =>
          if (anon.anonForPatId == showForPatId) {
            // [see_own_alias]
            json += AnonForIdFieldName -> JsNumber(anon.anonForPatId)
            //on += "anonOnPageId" -> JsString(anon.anonOnPageId),
          }
        }
      case x => die(s"An isAnon pat isn't an Anonym, it's an: ${classNameOf(x)}")
    }
    else if (user.isGuest) {
      json += "isGuest" -> JsTrue
    }
    else {
      require(user.isAuthenticated, "EdE8GPY4")
      json += "isAuthenticated" -> JsTrue  // COULD_OPTIMIZE remove this, client side, use !isGuest instead
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
    if (tags.nonEmpty) {
      json += "pubTags" -> JsArray(tags map JsTag)
    }
    if (inclSuspendedTill && user.suspendedTill.isDefined) {
      json += "suspendedTillEpoch" -> DateEpochOrNull(user.suspendedTill)  // [incl_susp_till]
    }
    json
  }

  val AnonForIdFieldName = "anonForId"

  // A bit dupl code. [dupl_pat_json_apiv0]
  def JsUserApiV0(pat: Pat, brief: Bo, authzCtx: AuthzCtxOnPats): JsObject = {
    unimplIf(!brief, "TyE306RE5")
    // Later, excl name, if is private.  [private_pats]
    var json = Json.obj(
        "id" -> JsNumber(pat.id),
        "username" -> JsStringOrNull(pat.anyUsername),
        "fullName" -> JsStringOrNull(pat.anyName))

    if (authzCtx.maySeeExtIds) {
      pat.extId.foreach(json += "extId" -> JsString(_))
      pat match {
        case u: UserBase => u.ssoId.foreach(json += "ssoId" -> JsString(_))
        case _ => ()
      }
    }
    json
  }


  /** [Dupl_perms] Nowadays, could be enough with reqrPerms — and remove
    * callerIsAdmin/Staff?
    */
  def JsUserInclDetails(user: UserInclDetails,
        usersById: Map[UserId, User], // CLEAN_UP remove, send back a user map instead
        groups: immutable.Seq[Group],
        callerIsAdmin: Bo, callerIsStaff: Bo = false, callerIsUserHerself: Bo = false,
        maySeePresence: Bo, sensitiveAnonDisc: Bo,
        reqrPerms: Opt[EffPatPerms] = None,
        anyStats: Option[UserStats] = None, inclPasswordHash: Bo = false)
      : JsObject = {

    def callerIsStaff_ = callerIsAdmin || callerIsStaff
    val reqrIsStaffOrSelf = callerIsStaff_ || callerIsUserHerself

    dieIf(inclPasswordHash && !callerIsAdmin, "TyE305KSJWG2")

    var userJson = Json.obj(  // MemberInclDetails  [B28JG4]
      "id" -> user.id,
      "ssoId" -> JsStringOrNull(user.ssoId),
      "externalId" -> JsStringOrNull(user.ssoId),  // deprecated 2020-03-25 [395KSH20]
      "extId" -> JsStringOrNull(user.extId),
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
      "seeActivityMinTrustLevel" -> // [ty_v1] remove
            JsNumberOrNull(user.privPrefs.seeActivityMinTrustLevel.map(_.toInt)),
      "avatarTinyHashPath" -> JsStringOrNull(user.tinyAvatar.map(_.hashPath)),
      "avatarSmallHashPath" -> JsStringOrNull(user.smallAvatar.map(_.hashPath)),
      "avatarMediumHashPath" -> JsStringOrNull(user.mediumAvatar.map(_.hashPath)),
      "suspendedTillEpoch" -> DateEpochOrNull(user.suspendedTill),  // REMOVE
      "suspendedTillMs" -> DateEpochOrNull(user.suspendedTill),  // RENAME
      "effectiveTrustLevel" -> user.effectiveTrustLevel.toInt)

    if (reqrIsStaffOrSelf || maySeePresence) {
      // Later: [see_presence_start_date]
      userJson += "createdAtEpoch" -> JsNumber(user.createdAt.millis)  // REMOVE
      userJson += "createdAtMs" -> JsNumber(user.createdAt.millis)  // RENAME
      // (Don't think need not exclude deletedAt & suspendedTillMs)
    }

    // Private, and of interest client side only to oneself and staff, if wants to edit.
    if (reqrIsStaffOrSelf) {
      userJson += "privPrefsOwn" -> JsPrivPrefs(user.privPrefs)
      // Good to know what the defaults are, since usually that's what's in use — most
      // people don't look at or configure their own prefs that much.
      val defaults = Authz.deriveDefaultPrivPrefs(groups)
      userJson += "privPrefsDef" -> JsPrivPrefs(defaults)
    }

    // But these effective prefs need to be public, see [some_pub_priv_prefs] (& bit dupl code).
    // so the client can show/disable e.g. the Send Message button, if DMs allowed or not.
    val effPrefs = Authz.derivePrivPrefs(user, groups)
    userJson = userJson.addAnyInt32("maySendMeDmsTrLv", effPrefs.maySendMeDmsTrLv)
    userJson = userJson.addAnyInt32("mayMentionMeTrLv", effPrefs.mayMentionMeTrLv)
    userJson = userJson.addAnyInt32("maySeeMyActivityTrLv", effPrefs.seeActivityMinTrustLevel)

    val maySeeEmailAdrs = reqrPerms.exists(_.canSeeOthersEmailAdrs)

    if (reqrIsStaffOrSelf || maySeeEmailAdrs) {
      // May see local part is tested here:
      //      - may-see-email-adrs.2br.d  TyTSEEEMLADRS01.TyTHIDELOCALEMLPART
      val safeEmail =
        if (callerIsAdmin || callerIsUserHerself || maySeeEmailAdrs) user.primaryEmailAddress
        else hideEmailLocalPart(user.primaryEmailAddress)

      userJson += "email" -> JsString(safeEmail)   // REMOVE
      userJson += "emailAddress" -> JsString(safeEmail)  // RENAME to emailAdr
      userJson += "emailVerifiedAtMs" -> JsDateMsOrNull(user.emailVerifiedAt)  // RENAME to emailAdr...
      userJson += "emailVerifiedAt" -> JsDateMsOrNull(user.emailVerifiedAt)
      userJson += "emailNotfPrefs" -> JsNumber(user.emailNotfPrefs.toInt)
    }

    if (reqrIsStaffOrSelf) {
      // Don't incl these though, even if the reqr may see pats email adr.
      // These are partly about the group(s), not just pat, and it's possible that
      // the reqr shouldn't know anything about these groups?
      userJson += "summaryEmailIntervalMinsOwn" -> JsNumberOrNull(user.summaryEmailIntervalMins)
      if (groups.nonEmpty) userJson += "summaryEmailIntervalMins" ->
        JsNumberOrNull(user.effectiveSummaryEmailIntervalMins(groups))
      userJson += "summaryEmailIfActiveOwn" -> JsBooleanOrNull(user.summaryEmailIfActive)
      if (groups.nonEmpty) userJson += "summaryEmailIfActive" ->
        JsBooleanOrNull(user.effectiveSummaryEmailIfActive(groups))

      userJson += "hasPassword" -> JsBoolean(user.passwordHash.isDefined)
      if (inclPasswordHash)
        userJson += "passwordHash" -> JsStringOrNull(user.passwordHash)

      userJson += "uiPrefs" -> user.uiPrefs.getOrElse(JsEmptyObj)
      userJson += "isApproved" -> JsBooleanOrNull(user.isApproved)
      userJson += "approvedAtMs" -> JsDateMsOrNull(user.reviewedAt)
      userJson += "approvedAt" -> JsDateMsOrNull(user.reviewedAt)
      userJson += "approvedById" -> JsNumberOrNull(user.reviewedById)

      val anyReviewer = user.reviewedById.flatMap(usersById.get)
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
        userJson += "anyUserStats" -> JsUserStats(stats, reqrPerms,
              callerIsStaff = callerIsStaff, callerIsAdmin = callerIsAdmin,
              callerIsUserHerself = callerIsUserHerself,
              maySeePresence = maySeePresence, sensitiveAnonDisc = sensitiveAnonDisc)
      }
    }

    userJson
  }


  def JsPrivPrefs(prefs: MemberPrivacyPrefs): JsObject = {
    var obj = JsEmptyObj2
    obj = obj.addAnyInt32("maySeeMyBriefBioTrLv", prefs.maySeeMyBriefBioTrLv)
    obj = obj.addAnyInt32("maySeeMyMembershipsTrLv", prefs.maySeeMyMembershipsTrLv)
    obj = obj.addAnyInt32("maySeeMyProfileTrLv", prefs.maySeeMyProfileTrLv)
    obj = obj.addAnyInt32("mayFindMeTrLv", prefs.mayFindMeTrLv)
    obj = obj.addAnyInt32("maySeeMyPresenceTrLv", prefs.maySeeMyPresenceTrLv)
    obj = obj.addAnyInt32("maySeeMyApproxStatsTrLv", prefs.maySeeMyApproxStatsTrLv)
    obj = obj.addAnyInt32("maySeeMyActivityTrLv", prefs.seeActivityMinTrustLevel)
    obj = obj.addAnyInt32("maySendMeDmsTrLv", prefs.maySendMeDmsTrLv)
    obj = obj.addAnyInt32("mayMentionMeTrLv", prefs.mayMentionMeTrLv)
    obj
  }


  def memberPrivacyPrefsFromJson(json: JsValue): MemberPrivacyPrefs = {
    MemberPrivacyPrefs(
          maySeeMyBriefBioTrLv = parseOptTrustLevel(json, "maySeeMyBriefBioTrLv"),
          maySeeMyMembershipsTrLv = parseOptTrustLevel(json, "maySeeMyMembershipsTrLv"),
          maySeeMyProfileTrLv = parseOptTrustLevel(json, "maySeeMyProfileTrLv"),
          mayFindMeTrLv = parseOptTrustLevel(json, "mayFindMeTrLv"),
          maySeeMyPresenceTrLv = parseOptTrustLevel(json, "maySeeMyPresenceTrLv"),
          maySeeMyApproxStatsTrLv = parseOptTrustLevel(json, "maySeeMyApproxStatsTrLv"),
          seeActivityMinTrustLevel = parseOptTrustLevel(json, "maySeeMyActivityTrLv",
                  // [ty_v1] remove both these:
                  altField = "seeActivityTrLv", alt2 = "seeActivityMinTrustLevel"),
          maySendMeDmsTrLv = parseOptTrustLevel(json, "maySendMeDmsTrLv"),
          mayMentionMeTrLv = parseOptTrustLevel(json, "mayMentionMeTrLv"),
          )
  }


  /// ts: Session
  def JsSession(sess: TySessionInDbMaybeBad, inclPart1: Bo, isCurrent: Bo = false): JsObject = {
    // Don't include the actual session id. (That is, exclude parts 2 – 5. *Could* maybe
    // theoretically include them, since they're hashes, but bad idea, and not needed.)
    var json = Json.obj(
          "patId" -> sess.patId,
          "createdAt" -> JsWhenMs(sess.createdAt),
          "deletedAt" -> JsWhenMsOrNull(sess.deletedAt),
          "expiredAt" -> JsWhenMsOrNull(sess.expiredAt),
          "version" -> JsNumber(sess.version),
          "startHeaders" -> sess.startHeaders)
    if (inclPart1) {
      json += "part1" -> JsString(sess.part1CompId)
    }
    if (isCurrent) {
      json += "isCurrent" -> JsTrue
    }
    json
  }


  /** [Dupl_perms] Nowadays, could be enough with reqrPerms — and remove
    * callerIsAdmin/Staff?
    */
  def JsUserStats(stats: UserStats, reqrPerms: Opt[EffPatPerms],
          callerIsStaff: Bo = false, callerIsAdmin: Bo,
          callerIsUserHerself: Bo = false,
          maySeePresence: Bo, sensitiveAnonDisc: Bo,
          ): JsObject = {
    val tourTipsIds: immutable.Seq[String] = stats.tourTipsSeen getOrElse Nil
    var result = Json.obj(
      "userId" -> stats.userId,
      "numDiscourseRepliesPosted" -> stats.numDiscourseRepliesPosted,
      "numDiscourseTopicsRepliedIn" -> stats.numDiscourseTopicsRepliedIn,
      "numDiscourseTopicsCreated" -> stats.numDiscourseTopicsCreated,
      "numChatMessagesPosted" -> stats.numChatMessagesPosted,
      "numChatTopicsRepliedIn" -> stats.numChatTopicsRepliedIn,
      "numChatTopicsCreated" -> stats.numChatTopicsCreated,
      "numLikesGiven" -> stats.numLikesGiven,
      "numLikesReceived" -> stats.numLikesReceived,
      "numSolutionsProvided" -> stats.numSolutionsProvided,
      )

    if (maySeePresence || callerIsStaff) {
      result += "lastPostedAt" -> JsWhenMsOrNull(stats.lastPostedAt)
    }

    // Let's skip, if only `callerIsUserHerself` but not `maySeePresence`?
    // Otherwise looks as if *others* can see one's own presence too, if one can see
    // it oneself.  And, lost of fields here can help others guess who an
    // anonym is, e.g. an anon comment gets posted, and only one person has
    // `lastSeenAt` showing a-few-seconds-ago. [deanon_risk]
    // Later: Include only dates after when presence got enabled. [see_presence_start_date]
    if (maySeePresence) {
      result += "lastSeenAt" -> JsWhenMs(stats.lastSeenAt)
      result += "firstSeenAt" -> JsWhenMs(stats.firstSeenAtOr0)
      result += "firstNewTopicAt" -> JsWhenMsOrNull(stats.firstNewTopicAt)
      result += "firstDiscourseReplyAt" -> JsWhenMsOrNull(stats.firstDiscourseReplyAt)
      result += "firstChatMessageAt" -> JsWhenMsOrNull(stats.firstChatMessageAt)
      result += "numDaysVisited" -> JsNumber(stats.numDaysVisited)
      result += "numSecondsReading" -> JsNumber(stats.numSecondsReading)
      result += "numDiscourseRepliesRead" -> JsNumber(stats.numDiscourseRepliesRead)
      result += "numDiscourseTopicsEntered" -> JsNumber(stats.numDiscourseTopicsEntered)
      result += "numChatMessagesRead" -> JsNumber(stats.numChatMessagesRead)
      result += "numChatTopicsEntered" -> JsNumber(stats.numChatTopicsEntered)
    }

    // These can be used to guess who an anonym is. E.g. anonymity tour not seen,
    // then, an anonymous comment appears and a person's anonymity related tour
    // changes to seen. Or someone replies to an anonymous comment, and another
    // user's `lastEmailedAt` changes — did that other user get a notification
    // email, and is thus the author of the anon comment? [deanon_risk]
    if (callerIsStaff && !sensitiveAnonDisc || callerIsUserHerself) {
      result += "tourTipsSeen" -> JsArray(tourTipsIds.map(JsString))
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


  def JsGroup(group: Group): JsObject = {   // dupl code [B28JG4] also in JsPatNameAvatar
    var json = Json.obj(
      "id" -> group.id,
      "username" -> group.theUsername,
      "fullName" -> JsStringOrNull(group.name),
      "isGroup" -> JsTrue)
      // "grantsTrustLevel" -> group.grantsTrustLevel)
    group.tinyAvatar foreach { uploadRef =>
      json += "avatarTinyHashPath" -> JsString(uploadRef.hashPath)
    }
    if (group.isDeleted) json += "isDeleted" -> JsTrue
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


  /** Verbose, more details included.
    */
  def JsGroupAndStatsVb(groupAndStats: GroupAndStats, isStaff: Bo): JsObject = {
    var json = JsGroupAndStats(groupAndStats)

    // Needed, for the Inspect page, for admins.
    unimplIf(!isStaff, "Must be staff [TyE702KJCW]")
    json += "privPrefsOwn" -> JsPrivPrefs(groupAndStats.group.privPrefs)

    // Not currently needed: privPrefsDef.  Or incl anyway?
    // val ancestorGroups = tx.loadGroupsAncestorGroups(g) // some caller
    // val defaults = Authz.deriveDefaultPrivPrefs(ancestorGroups)

    json  // [perms_missing]
  }


  // If ever using for sth else than exporting dump files, then,
  // sometimes exclude  canSeeOthersEmailAdrs  below.  [can_see_who_can_see_email_adrs]
  def JsGroupInclDetailsForExport(group: Group): JsObject = {
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

    perms.canSeeOthersEmailAdrs.foreach(v =>
          json += "canSeeOthersEmailAdrs" -> JsBoolean(v))

    json
  }



  def parsePatPerms(jsVal: JsValue, siteId: SiteId)(mab: MessAborter): PatPerms = {
    val jsob = asJsObject(jsVal, "pat perms")
    val anyMaxUplBytes = parseOptI32(jsob, "maxUploadBytes")
    val anyExts = parseOptSt(jsob, "allowedUplExts")
    PatPerms.create(mab,
          maxUploadBytes = anyMaxUplBytes,
          allowedUplExts = anyExts,
          canSeeOthersEmailAdrs = parseOptBo(jsob, "canSeeOthersEmailAdrs"),
          )
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


  val JsEmptyObj: JsObject = JsObject(Nil)

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
      "comtOrder" -> JsNum32OrNull(pageMeta.comtOrder.map(_.toInt)),
      "comtsStartHidden" -> JsNum32OrNull(pageMeta.comtsStartHidden.map(_.toInt)),
      "comtsStartAnon" -> JsNum32OrNull(pageMeta.comtsStartAnon.map(_.toInt)),
      "newAnonStatus" -> JsNum32OrNull(pageMeta.newAnonStatus.map(_.toInt)),
      //"comtNesting" -> pageMeta.comtNesting,
      "forumSearchBox" -> JsNum32OrNull(pageMeta.forumSearchBox),
      "forumMainView" -> JsNum32OrNull(pageMeta.forumMainView),
      "forumCatsTopics" -> JsNum32OrNull(pageMeta.forumCatsTopics),
      "pinOrder" -> JsNumberOrNull(pageMeta.pinOrder),
      "pinWhere" -> JsNumberOrNull(pageMeta.pinWhere.map(_.toInt)),
      "numLikes" -> pageMeta.numLikes,
      "numWrongs" -> pageMeta.numWrongs,
      "numBurys" -> pageMeta.numBurys,
      "numUnwanteds" -> pageMeta.numUnwanteds,
      "numRepliesVisible" -> pageMeta.numRepliesVisible,
      "numRepliesTotal" -> pageMeta.numRepliesTotal,
      "numPostsTotal" -> pageMeta.numPostsTotal,
      "numOrigPostDoItVotes" -> pageMeta.numOrigPostDoItVotes,
      "numOrigPostDoNotVotes" -> pageMeta.numOrigPostDoNotVotes,
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
      "deletedById" -> JsNumberOrNull(pageMeta.deletedById),
      "htmlTagCssClasses" -> pageMeta.htmlTagCssClasses,
      "htmlHeadTitle" -> pageMeta.htmlHeadTitle,
      "htmlHeadDescription" -> pageMeta.htmlHeadDescription)
  }


  // Is duplicated here and there, oh well. At least currently there's no other
  // json field named "nr" that can have negative values (like private posts do).
  val PostNrIdFieldName = "nr"

  RENAME // add suffix:  JsPostVb_butNoPatRels  ?
  def JsPostInclDetails(post: Post): JsObject = {
    COULD_OPTIMIZE // Skip null / false fields, so less json.
    // E.g. excl currRevSourcePatch, instead of 'currRevSourcePatch: null'.
    Json.obj(
      "id" -> post.id,
      "pageId" -> post.pageId,
      PostNrIdFieldName -> post.nr,
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
      // Maybe add sth like talkyard.server.parser.JsonConf that says if any doerId.privId
      // should be included or not?
      "doerId" -> postAction.doerId.pubId,  // [export_privid]
      "actionType" -> postAction.actionType.toInt)
  }


  def JsLink(link: Link): JsObject = {
    Json.obj(
          "fromPostId" -> link.fromPostId,
          "linkUrl" -> link.linkUrl,
          "addedAt" -> JsWhenMs(link.addedAt),
          "addedById" -> link.addedById,
          "isExternal" -> link.isExternal,
          //toStaffSpace
          "toPageId" -> JsStringOrNull(link.toPageId),
          "toPostId" -> JsNum32OrNull(link.toPostId),
          "toPatId" -> JsNum32OrNull(link.toPpId),
          "toTagId" -> JsNum32OrNull(link.toTagId),
          "toCatId" -> JsNum32OrNull(link.toCategoryId))
  }


  def parseJsLink(jsVal: JsValue, mab: MessAborter): Link = {
    try {
      val jsOb = asJsObject(jsVal, "link")
      Link(
          fromPostId = parseInt32(jsOb, "fromPostId"),
          linkUrl = parseSt(jsOb, "linkUrl"),
          addedAt = parseWhen(jsOb, "addedAt"),
          addedById = parseInt32(jsOb, "addedById"),
          isExternal = parseOptBo(jsOb, "isExternal") getOrElse false,
          //toStaffSpace =
          toPageId = parseOptSt(jsOb, "toPageId"),
          toPostId = parseOptInt32(jsOb, "toPostId"),
          toPpId = parseOptInt32(jsOb, "toPatId"),
          toTagId = parseOptInt32(jsOb, "toTagId"),
          toCategoryId = parseOptInt32(jsOb, "toCatId"))
    }
    catch {
      case ex: BadJsonException =>
        mab.abort("TyEJSNLNK", s"Invalid link JSON: ${ex.getMessage}")
    }
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
      "doItVotesPopFirst" -> JsBoolOrNull(category.doVoteStyle.map(_ => true)),
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


  def JsTagType(tagType: TagType): JsObject = {
    Json.obj(
        "id" -> tagType.id,
        "canTagWhat" -> tagType.canTagWhat,
        "dispName" -> tagType.dispName,
        "urlSlug" -> JsStringOrNull(tagType.urlSlug),
        "wantsValue" -> JsNum32OrNull(tagType.wantsValue.map(_.toInt)),
        "valueType" -> JsNum32OrNull(tagType.valueType.map(_.toInt)))
  }


  def JsTagTypeMaybeRefId(tagType: TagType, inclRefId: Bo, inclCreatedBy: Bo = false): JsObject = {
    var res = JsTagType(tagType)
    if (inclRefId) tagType.refId foreach { refId =>
      res += "refId" -> JsString(refId)
    }
    if (inclCreatedBy) {
      res += "createdById" -> JsNumber(tagType.createdById)
    }
    res
  }


  def JsTagTypeArray(tagTypes: Iterable[TagType], inclRefId: Bo, inclCreatedBy: Bo = false)
          : JsArray = {
    JsArray(tagTypes.map(tt => JsTagTypeMaybeRefId(
          tt, inclRefId = inclRefId, inclCreatedBy = inclCreatedBy)).to(Vec))
  }


  def parseTagType(jsVal: JsValue, createdById: Opt[PatId] = None)(mab: MessAborter): TagType = {
    // Sync with: JsX.parseUpsertTypeParams() below.
    val jOb = asJsObject(jsVal, "tag type")
    val id = parseInt32(jOb, "id")
    val refId = parseOptSt(jOb, "refId")
    val scopedToPatId = None // later: Opt[PatId] = parseOptInt32(jOb, "scopedToPatId")
    val canTagWhat = parseInt32(jOb, "canTagWhat")
    val dispName = parseSt(jOb, "dispName")
    val anySlug = parseOptSt(jOb, "urlSlug").noneIfBlank
    val createdByIdInJson = parseOptInt32(jOb, "createdById")
    val valueType: Opt[TypeValueType] = parseOptTypeValueType(jOb, "valueType")
    val wantsValue: Opt[NeverAlways] = parseOptNeverAlways(jOb, "wantsValue") orElse {
      if (valueType.isEmpty) None
      else Some(NeverAlways.Recommended)
    }
    createdById foreach { id =>
      if (createdByIdInJson.isSomethingButNot(id)) {
        mab.abort("TyE2MW04MEFQ2", s"createdById in JSON [${createdByIdInJson.get
              }] != createdById in fn param [$id]")
      }
    }
    val byId = createdById.orElse(createdByIdInJson) getOrElse throwMissing(
          "TyE0CRBYID25", "createdById")

    TagType(
          id = id,
          refId = refId,
          scopedToPatId = scopedToPatId,
          canTagWhat = canTagWhat,
          urlSlug = anySlug,
          dispName = dispName,
          createdById = byId,
          wantsValue = wantsValue,
          valueType = valueType)(mab)
  }


  def parseUpsertTypeParams(jsVal: JsValue)(mab: MessAborter): UpsertTypeParams = {
    // Sync with: JsX.parseTagType() above.
    val jOb = asJsObject(jsVal, "tag type")
    val kindOfType = parseSt(jOb, "kindOfType")
    val canTagWhat = kindOfType match {
      case "TagType" => TagType.CanTagAllPosts
      //   "BadgeType" => TagType.CanTagAllPats
      case _ =>
        mab.abort("TyETYPEKIND04", s"Unknown kind of type: '$kindOfType'")
    }
    val valueType: Opt[TypeValueType] = parseOptTypeValueTypeStr_apiV0(jOb, "valueType")
    val wantsValue: Opt[NeverAlways] =
            // parseOptNeverAlways(jOb, "wantsValue") — maybe later
            if (valueType.isEmpty) None
            else Some(NeverAlways.Recommended)
    UpsertTypeParams(
          // If id empty, then, looking up by refId instead. [type_id_or_ref_id]
          anyId = parseOptInt32(jOb, "id"),
          refId = parseOptSt(jOb, "refId"),
          canTagWhat = canTagWhat,
          urlSlug = parseOptSt(jOb, "urlSlug").noneIfBlank,
          dispName = parseSt(jOb, "dispName"),
          wantsValue = wantsValue,
          valueType = valueType)
  }


  def JsTag(tag: Tag): JsObject = {
    var jOb = Json.obj(
        "id" -> tag.id,
        "tagTypeId" -> tag.tagTypeId)
    tag.onPatId foreach { id =>
      jOb += "onPatId" -> JsNumber(id)
    }
    tag.onPostId foreach { id =>
      jOb += "onPostId" -> JsNumber(id)
    }
    tag.valType foreach { t =>
      jOb += "valType" -> JsNumber(t.toInt)
    }
    tag.valInt32 foreach { v =>
      jOb += "valInt32" -> JsNumber(v)
    }
    tag.valFlt64 foreach { v =>
      jOb += "valFlt64" -> JsNumber(v)
    }
    tag.valStr foreach { v =>
      jOb += "valStr" -> JsString(v)
    }
    // valUrl?: St;      // later
    // valJson?: Object; //
    jOb
  }


  def parseTag(jsVal: JsValue)(mab: MessAborter): Tag = {
    val jOb = asJsObject(jsVal, "tag")
    val id = parseInt32(jOb, "id")
    val tagTypeId = parseInt32(jOb, "tagTypeId")
    val onPatId = parseOptInt32(jOb, "onPatId")
    val onPostId = parseOptInt32(jOb, "onPostId")
    Tag(id = id,
          tagTypeId = tagTypeId,
          parentTagId_unimpl = None,
          onPatId = onPatId,
          onPostId = onPostId,
          // Dupl code, ok? [parse_tag_vals]
          valType = parseOptTypeValueType(jOb, "valType"),
          valInt32 = parseOptInt32(jOb, "valInt32"),
          valFlt64 = parseOptFloat64(jOb, "valFlt64"),
          valStr = parseOptSt(jOb, "valStr"),
          )(mab)
  }


  def parseTagParam(jVal: JsValue, whatPage: Opt[PageRef] = None): CreateTagParams = {
    val jOb: JsObject = asJsObject(jVal, "tag param")
    val tagTypeSt = parseSt(jOb, "tagType")
    val tagTypeRef = parseTypeRef(tagTypeSt) getOrIfBad { msg =>
      throwBadJson("TyETYPEREF042", "Bad tag type ref: $msg")
    }
    CreateTagParams(
          tagTypeRef,
          whatPage = whatPage.orElse(debiki.JsonUtils.parseOptPageRef(jOb, "onPage")),
          parentTagId_unimpl = None,
          onPostNr = parseOptInt32(jOb, "postNr"),
          onPostRef = debiki.JsonUtils.parseOptPostRef(jOb, "onPost"),
          // Dupl code, that's ok? [parse_tag_vals]
          valType = parseOptTypeValueTypeStr_apiV0(jOb, "valType"),
          valInt32 = parseOptInt32(jOb, "valInt32"),
          valFlt64 = parseOptFloat64(jOb, "valFlt64"),
          valStr = parseOptSt(jOb, "valStr"))
  }


  def JsTagStats(stats: TagTypeStats): JsObject = {
    Json.obj(
        "tagTypeId" -> stats.tagTypeId,
        "numTotal" -> JsNumber(stats.numTotal),
        "numPostTags" -> JsNumber(stats.numPostTags),
        "numPatBadges" -> JsNumber(stats.numPatBadges))
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
      "flaggerId" -> flag.flaggerId.pubId,  // [export_privid]
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

  def JsNum16OrNull(value: Opt[i16]): JsValue =
    JsNumberOrNull(value.map(_.toInt))

  def JsNum32OrNull(value: Opt[i32]): JsValue =
    JsNumberOrNull(value)

  def JsNumberOrNull(value: Option[Int]): JsValue =  // RENAME use JsNum32OrNull instead
    JsI32OrNull(value)

  def JsI32OrNull(value: Opt[i32]): JsValue = JsInt32OrNull(value)

  def JsInt32OrNull(value: Opt[i32]): JsValue =  // Scala 3: union types:  i32 | i64  ?
    value.map(JsNumber(_)).getOrElse(JsNull)

  def JsNum64OrNull(value: Opt[i64]): JsValue =
    JsLongOrNull(value)

  def JsLongOrNull(value: Option[Long]): JsValue =   // RENAME use JsNum64OrNull instead
    value.map(JsNumber(_)).getOrElse(JsNull)

  def JsFloatOrNull(value: Option[Float]): JsValue =   // RENAME to JsFloat32OrNull
    value.map(v => JsNumber(BigDecimal(v))).getOrElse(JsNull)

  def JsFloat64OrNull(value: Opt[f64]): JsValue =
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

  def JsWhenMins(value: When): JsNumber =
    JsNumber(value.unixMinutes)

  def JsWhenMins(value: WhenMins): JsNumber =
    JsNumber(value.mins)

  def JsWhenMinsOrNull(value: Option[When]): JsValue =
    value.map(JsWhenMins) getOrElse JsNull

  def JsWhenMins2OrNull(value: Opt[WhenMins]): JsValue =
    value.map(JsWhenMins) getOrElse JsNull

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
    var res = Json.obj(
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
    draft.doAsAnon foreach { whichAlias =>
      res += DoAsAnonFieldName -> JsWhichAliasId(whichAlias)
    }
    res
  }


  def JsWhichAliasId(which: WhichAliasId): JsObject = {
    import WhichAliasId._
    which match {
      case Oneself =>
        Json.obj(
            "self" -> true)
      case SameAnon(anonId: PatId) =>
        Json.obj(
            "sameAnonId" -> JsNumber(anonId),
            // Later, also incl: (but not yet saved in db, for drafts)  [chk_alias_status]
            //"anonStatus" -> anon.anonStatus
            )
      case LazyCreatedAnon(anonStatus: AnonStatus) =>
        Json.obj(
            "anonStatus" -> JsNumber(anonStatus.toInt),
            "lazyCreate" -> JsTrue)
      // Maybe later, also:
      // case NewAnon(anonStatus: AnonStatus) =>
      //    "createNew_tst" -> ...
    }
  }


  def JsPagePopularityScores(scores: PagePopularityScores): JsObject = {
    Json.obj(
      "pageId" -> scores.pageId,
      "updatedAt" -> JsWhenMs(scores.updatedAt),
      "algorithmVersion" -> scores.scoreAlgorithm,
      "dayScore" -> scores.dayScore,
      "weekScore" -> scores.weekScore,
      "monthScore" -> scores.monthScore,
      "quarterScore" -> scores.quarterScore,
      "yearScore" -> scores.yearScore,
      "triennialScore" -> scores.triennialScore,
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


  def apiV0_parseExternalUser(jsObj: JsObject, ssoId: Opt[St] = None)
          : ExternalUser = {
    // A bit dupl code — this is for parsing JSON, the other for PASETO. [dupl_parse_ext_user]
    ExternalUser(  // Typescript ExternalUser [7KBA24Y] no SingleSignOnUser
          ssoId = ssoId getOrElse parseSt(jsObj, "ssoId"),
          extId = (jsObj \ "extId").asOptStringNoneIfBlank,
          primaryEmailAddress = (jsObj \ "primaryEmailAddress").as[String].trim,
          isEmailAddressVerified = (jsObj \ "isEmailAddressVerified").as[Boolean],
          username = (jsObj \ "username").asOptStringNoneIfBlank,
          fullName = (jsObj \ "fullName").asOptStringNoneIfBlank,
          avatarUrl = (jsObj \ "avatarUrl").asOptStringNoneIfBlank,
          // BIO
          aboutUser = (jsObj \ "aboutUser").asOptStringNoneIfBlank,  // RENAME to 'bio', right
          isAdmin = (jsObj \ "isAdmin").asOpt[Boolean].getOrElse(false),
          isModerator = (jsObj \ "isModerator").asOpt[Boolean].getOrElse(false),
          )(IfBadAbortReq)
  }

}

