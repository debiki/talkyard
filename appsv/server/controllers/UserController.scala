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

import scala.collection.Seq
import com.debiki.core._
import com.debiki.core.Prelude._
import com.debiki.core.Participant.{MinUsernameLength, isGuestId}
import debiki._
import debiki.JsonUtils._
import debiki.dao.ReadMoreResult
import debiki.EdHttp._
import talkyard.server.http._
import java.{util => ju}
import play.api.mvc
import play.api.libs.json._
import play.api.mvc.{Action, ControllerComponents}
import scala.util.Try
import scala.collection.{mutable => mut}
import debiki.RateLimits.TrackReadingActivity
import talkyard.server.{TyContext, TyController}
import talkyard.server.authz.{Authz, PatAndPrivPrefs, AuthzCtxOnAllWithReqer}
import talkyard.server.security.WhatApiSecret
import javax.inject.Inject
import org.scalactic.{Bad, Good}
import talkyard.server.JsX
import talkyard.server.JsX._
import talkyard.server.authn.MinAuthnStrength
import talkyard.server.TyLogging


/** Handles requests related to users.
 */
class UserController @Inject()(cc: ControllerComponents, edContext: TyContext)
  extends TyController(cc, edContext) with TyLogging {

  import context.security.{throwNoUnless, throwIndistinguishableNotFound}
  import context.globals

  val MaxEmailsPerUser: Int = 5  // also in js [4GKRDF0]


  def listCompleteUsers(whichUsers: St): Action[Unit] = StaffGetAction { req =>
    import req.dao
    val settings = dao.getWholeSiteSettings()
    var orderOffset: PeopleOrderOffset = PeopleOrderOffset.BySignedUpAtDesc
    var peopleFilter = PeopleFilter()

    whichUsers match {
      case "EnabledUsers" =>
        peopleFilter = peopleFilter.copy(
          onlyWithVerifiedEmail = settings.requireVerifiedEmail,
          onlyApproved = settings.userMustBeApproved)
      case "WaitingUsers" =>
        peopleFilter = peopleFilter.copy(
          // Don't ask staff to approve people who haven't yet verified their email address.
          onlyWithVerifiedEmail = settings.requireVerifiedEmail,
          onlyPendingApproval = true)
      case "NewUsers" =>
        // Show everyone, sorted by most recent signups first. This is the default sort order.
      case "StaffUsers" =>
        peopleFilter = peopleFilter.copy(onlyStaff = true)
      case "SuspendedUsers" =>
        peopleFilter = peopleFilter.copy(onlySuspended = true)
      /*case "SilencedUsers" =>
        peopleFilter = peopleFilter.copy(onlySilenced = true) */
      case "ThreatUsers" =>
        peopleFilter = peopleFilter.copy(onlyThreats = true)
      case x =>
        throwBadArgument("TyE2KBWT58", "whichUsers", x)
    }

    val peopleQuery = PeopleQuery(orderOffset, peopleFilter)

    dao.readTx { tx =>
      // Ok to load also deactivated users — the requester is staff.
      val membersAndStats = tx.loadUsersInclDetailsAndStats(peopleQuery)
      val members = membersAndStats.map(_._1)
      val reviewerIds = members.flatMap(_.reviewedById)
      val suspenderIds = members.flatMap(_.suspendedById)
      val usersById = tx.loadUsersAsMap(reviewerIds ++ suspenderIds)

      COULD // later load all groups too, for each user. Will need, if e.g. a moderator
      // may not see sbd's details, later. [private_pats] [hidden_profile]

      val usersJson = JsArray(membersAndStats.map(memberAndStats => {
        val member: UserInclDetails = memberAndStats._1
        val anyStats: Option[UserStats] = memberAndStats._2
        JsUserInclDetails(member, usersById, groups = Nil,
              callerIsAdmin = req.theUser.isAdmin,
              sensitiveAnonDisc = settings.enableAnonSens,
              maySeePresence = settings.enablePresence,
              callerIsStaff = true, anyStats = anyStats)
      }))
      OkSafeJson(Json.obj("users" -> usersJson))
    }
  }


  /** Loads a member or group, incl details, or a guest (then there are no details).
    */
  def loadUserAnyDetails(who: St): Action[U] = GetActionRateLimited(
          RateLimits.ReadsFromDb, MinAuthnStrength.EmbeddingStorageSid12) { request =>
    import request.{dao, requesterOrUnknown}
    import dao.siteId

    // First try looking up by `who` as a  numeric user id. If won't work,
    // lookup by `who` as username instead.

    CLEAN_UP // [load_pat_stats_grps]
    // Don't incl  anyUserStats  inside the member json?
    // Don't incl  groupIdsMaySee ?

    var (patId: PatId, isByUsernameOrEmail) = Try(who.toInt).toOption match {
      case Some(id) =>
        (id, false)
      case None =>
        _lookupMemberIdByEmailOrUsername(who, request) match {
          case Left(errCodeMsg) =>
            throwIndistinguishableNotFound(errCodeMsg._1,
                  s"User '$who' not found by username/email: ${errCodeMsg._2}")
          case Right(pat) =>
            COULD_OPTIMIZE // Don't just forget `pat`, to load again below.
            // Maybe best approach is to [cache_username_2_user_id] lookups?
            (pat.id, true)
        }
    }

    val (userJson0, anyStatsJson, pat) =
          _loadPatJsonDetailsById(patId, includeStats = true, request) match {
          case Left(errCodeMsg) =>
            throwIndistinguishableNotFound(errCodeMsg._1,
                  s"Pat id $patId not found: ${errCodeMsg._2}")
          case Right(res) =>
            res
        }
    var userJson = userJson0

    val allGroups: Vec[Group] = dao.getAllGroups()

    val targetStuff: PatAndPrivPrefs = dao.getPatAndPrivPrefs(pat, allGroups)
    val targetsPrivPrefs = targetStuff.privPrefsOfPat

    val isReqrSelf = requesterOrUnknown.id == pat.id

    // If the user has been deleted, don't allow looking up the anonymized profile,
    // via the old username, only via the "anon12345" username. (Shouldn't be possible
    // to guess and maybe find out an account's old username, after it's been deleted.)
    // (This test won't be needed, if old usernames are replaced w hashes. [6UKBWTA2])
    val lookingUpDeletedByUsername = pat.isGone && isByUsernameOrEmail &&
          // Since deleted, the current username is like "anon1234", and it's ok to
          // look up by that username, but not any other username.
          !pat.anyUsername.is(who)
    if (lookingUpDeletedByUsername && !requesterOrUnknown.isStaff) {
      dieIf(isReqrSelf, "TyE4P02FKJT", "Deleted user looking at own profile?")
      throwIndistinguishableNotFound(
            "TyEM0SEE_DELDUN", s"Pat '$who' deleted")
    }

    // Principal's.
    // (We'll need to always fetch these groups, in case some of them has the
    // future [maySeeProfiles] permission.)
    val groupsMaySee = dao.getGroupsReqrMaySee(requesterOrUnknown, Some(allGroups))

    val maySeeProfilePage = isReqrSelf || targetsPrivPrefs.maySeeMyProfileTrLv.forall(
                              _.isAtMost(requesterOrUnknown.effectiveTrustLevel2))

    if (!maySeeProfilePage)
      throwIndistinguishableNotFound("TyEM0SEEPROFL")

    // Later: [private_pats]
    val maySeeGroups = isReqrSelf || targetsPrivPrefs.maySeeMyMembershipsTrLv.forall(
                              _.isAtMost(requesterOrUnknown.effectiveTrustLevel2))
    val pptGroupIds =
          if (!maySeeGroups) Vec.empty
          else targetStuff.patsGroupIds.filter(id => groupsMaySee.exists(g => g.id == id))

    // Later, pass to JsUserInclDetails() instead of adding here.
    val tags: Seq[Tag] = dao.getTags(forPat = Some(pat.id))
    if (tags.nonEmpty) {
      userJson += "pubTags" -> JsArray(tags.map(JsTag))
    }

    val tagTypes: Seq[TagType] = dao.getTagTypesForTags(tags)

    // Maybe incl less data if embedded?
    CHECK_AUTHN_STRENGTH

    // Maybe? No, stats is ok to show? Could possibly add another conf val, hmm.
    /*val stats =
      if (maySeeActivity(userId, request.requester, request.dao)) anyStatsJson
      else JsNull */

    val maySeeStats = isReqrSelf || targetsPrivPrefs.maySeeMyApproxStatsTrLv.forall(
                              _.isAtMost(requesterOrUnknown.effectiveTrustLevel2))
    userJson += "anyUserStats" -> (maySeeStats ? anyStatsJson | JsNull)

    // Rename? This is the target's groups that the principal may see. [_similar_grp_fld_name]
    userJson += "groupIdsMaySee" -> JsArray(pptGroupIds.map(id => JsNumber(id)))

    OkSafeJson(Json.obj(
      "user" -> userJson,
      // COULD_OPTIMIZE: need only include user's (the target's) groups — or always incl in the
      // volatile json? [305STGW2] — so need not incl here again? No, that's a bad idea:
      // Let's say theres a university with over the years hundreds of different classes,
      // all public for other students to know about. Then, wouldn't want to send the list
      // of all classes always to all browsers.
      // Rename? This is the groups the principal may see. [_similar_grp_fld_name]
      "groupsMaySee" -> groupsMaySee.map(JsGroup),
      "tagTypes" -> tagTypes.map(JsTagType)))
  }


  private def _loadPatJsonById(userId: UserId, request: DebikiRequest[_]): JsObject = {
    _loadPatJsonDetailsById(userId, includeStats = false, request) match {
      case Left(errCodeMsg) => die(errCodeMsg._1, errCodeMsg._2)
      case Right(res) => res._1
    }
  }


  // Returns (pat-json, pat-stats-json, Pat)
  //
  private def _loadPatJsonDetailsById(userId: UserId, includeStats: Bo,
        request: DebikiRequest[_]): Either[(St, St), (JsObject, JsValue, Pat)] = {
    import request.dao

    val settings = dao.getWholeSiteSettings()
    val callerIsStaff = request.user.exists(_.isStaff)
    val callerIsAdmin = request.user.exists(_.isAdmin)
    val callerIsUserHerself = request.user.exists(_.id == userId)
    val isStaffOrSelf = callerIsStaff || callerIsUserHerself
    val reqrPerms: EffPatPerms =
          dao.deriveEffPatPerms(request.authzContext.groupIdsEveryoneLast)

    request.dao.readTx { tx =>
      val stats = includeStats ? tx.loadUserStats(userId) | None
      val (pptJson, pat) =
        if (Participant.isRoleId(userId)) {
          val memberOrGroup = tx.loadMemberInclDetailsById(userId) getOrElse {
            return Left(("TyE03JKR53", s"User $userId not found"))
          }
          val json = memberOrGroup match {
            case m: UserInclDetails =>
              val groups = tx.loadGroups(memberOrGroup)
              JsUserInclDetails(m, Map.empty, groups, callerIsAdmin = callerIsAdmin,
                    callerIsStaff = callerIsStaff, callerIsUserHerself = callerIsUserHerself,
                    maySeePresence = settings.enablePresence,
                    sensitiveAnonDisc = settings.enableAnonSens,
                    reqrPerms = Some(reqrPerms))
            case g: Group =>
              val ancestorGroups = tx.loadGroupsAncestorGroups(g)
              jsonForGroupInclDetails(g, ancestorGroups, callerIsAdmin = callerIsAdmin,
                    callerIsStaff = callerIsStaff, reqrPerms = Some(reqrPerms))
          }
          (json, memberOrGroup)
        }
        else {
          val pat = tx.loadParticipant(userId) getOrElse {
            return Left(("TyE03JKR57", s"Guest or Anonym $userId not found"))
          }
          val json = pat match {
            case anon: Anonym => JsPat(anon, TagsAndBadges.None)
            case guest: Guest => jsonForGuest(guest, Map.empty, callerIsStaff = callerIsStaff,
                callerIsAdmin = callerIsAdmin, reqrPerms = Some(reqrPerms))
          }
          (json, pat.asInstanceOf[ParticipantInclDetails])
        }
      dieIf(pat.id != userId, "TyE36WKDJ03")
      val statsJson =
          stats.map(JsUserStats(_, Some(reqrPerms), callerIsStaff = callerIsStaff,
                callerIsUserHerself = callerIsUserHerself,
                callerIsAdmin = callerIsAdmin, maySeePresence = settings.enablePresence,
                sensitiveAnonDisc = settings.enableAnonSens)).getOrElse(JsNull)
      Right((pptJson, statsJson,
          pat.noDetails))
    }
  }


  private def _lookupMemberIdByEmailOrUsername(emailOrUsername: String,
        request: DebikiRequest[_]): Either[(St, St), PatVb] = {

    val callerIsAdmin = request.user.exists(_.isAdmin)

    // For now, unless admin, don't allow emails, so cannot brut-force test email addresses.
    if (emailOrUsername.contains("@") && !callerIsAdmin)
      return Left(("EsE4UPYW2", "Lookup by email not allowed"))

    val isEmail = emailOrUsername.contains("@")
    if (isEmail)
      return Left(("EsE5KY02", "Lookup by email not implemented"))

    COULD_OPTIMIZE // Cache username —> user id + all hans usernames. [cache_username_2_user_id]
    request.dao.readOnlyTransaction { tx =>
      val member = tx.loadMemberVbByUsername(emailOrUsername) getOrElse {
        // Later, once lookup-by-email supported, if no user found:
        if (isEmail)
          return Left(("EsE4PYW20", "User not found"))

        // Username perhaps changed? Then ought to update the url, browser side [8KFU24R]
        val possibleUserIds = tx.loadUsernameUsages(emailOrUsername).map(_.userId).toSet
        if (possibleUserIds.isEmpty)
          return Left(("EsEZ6F0U", "User not found, or their profile isn't public"))

        if (possibleUserIds.size > 1)
          return Left(("EsE4AK7B", "Many users with this username, weird"))

        val userId = possibleUserIds.head

        tx.loadMemberInclDetailsById(userId) getOrElse {
          return Left(("TyE0USR0638", s"User with username $emailOrUsername hard deleted"))
        }
      }
      Right(member)
    }
  }


  /** [Dupl_perms] Nowadays, could be enough with reqrPerms — and remove
    * callerIsAdmin/Staff?
    */
  private def jsonForGroupInclDetails(group: Group, ancestorGroups: ImmSeq[Group],
        callerIsAdmin: Bo,
        callerIsStaff: Bo = false, reqrPerms: Opt[EffPatPerms] = None): JsObject = {
    var json = JsGroup(group)

    val privPrefs = group.privPrefs

    // Own and default prefs needed, if staff wants to edit.
    if (callerIsStaff) {
      json += "privPrefsOwn" -> JsPrivPrefs(privPrefs)
      // So can show the default priv prefs, on the priv prefs tab.
      val defaults = Authz.deriveDefaultPrivPrefs(ancestorGroups)
      json += "privPrefsDef" -> JsPrivPrefs(defaults)
    }

    // These needs to be public, so others get to know if they cannot
    // mention or message this group. [some_pub_priv_prefs] (& bit dupl code)
    val effPrefs = Authz.derivePrivPrefs(group, ancestorGroups)
    json = json.addAnyInt32("maySendMeDmsTrLv", effPrefs.maySendMeDmsTrLv)
    json = json.addAnyInt32("mayMentionMeTrLv", effPrefs.mayMentionMeTrLv)
    json = json.addAnyInt32("maySeeMyActivityTrLv", effPrefs.seeActivityMinTrustLevel)

    // A bit dupl code [B28JG4]  also in JsGroupInclDetailsForExport
    if (callerIsStaff) {
      json += "summaryEmailIntervalMins" -> JsNumberOrNull(group.summaryEmailIntervalMins)
      json += "summaryEmailIfActive" -> JsBooleanOrNull(group.summaryEmailIfActive)

      json += "uiPrefs" -> group.uiPrefs.getOrElse(JsEmptyObj)

      val perms = group.perms
      var permsJo = Json.obj(
            "maxUploadBytes" -> JsNumberOrNull(perms.maxUploadBytes),
            "allowedUplExts" -> JsStringOrNull(perms.allowedUplExts))
      // Revealing which user accounts can see others' email addresses, might make
      // such accounts targets for hackers. So, only show to staff, for now.
      // [can_see_who_can_see_email_adrs]
      if (callerIsStaff) {  // already tested above, again here, oh well
        perms.canSeeOthersEmailAdrs.foreach(v =>
              permsJo += "canSeeOthersEmailAdrs" -> JsBoolean(v))
      }
      json += "perms" -> permsJo  // should incl here too: [perms_missing]
    }
    json
  }


  /** [Dupl_perms] Nowadays, could be enough with reqrPerms — and remove
    * callerIsAdmin/Staff?
    */
  private def jsonForGuest(user: Guest, usersById: Map[UserId, Participant],
          callerIsStaff: Boolean, callerIsAdmin: Bo,
          reqrPerms: Opt[EffPatPerms] = None): JsObject = {
    val safeEmail = callerIsAdmin ? user.email | hideEmailLocalPart(user.email)
    var userJson = Json.obj(
      "id" -> user.id,
      "fullName" -> user.guestName,
      "bio" -> JsStringOrNull(user.about),
      "websiteUrl" -> JsStringOrNull(user.website),
      "location" -> JsStringOrNull(user.country))
      // += ipSuspendedTill
      // += browserIdCookieSuspendedTill
    if (callerIsStaff || reqrPerms.exists(_.canSeeOthersEmailAdrs)) {
      userJson += "email" -> JsString(safeEmail) ; RENAME // to emailAdr?
      // += ipSuspendedAt, ById, ByUsername, Reason
      // += browserIdCookieSuspendedAt, ById, ByUsername, Reason
    }
    userJson
  }


  def downloadPersonalData(userId: UserId): Action[Unit] = GetActionRateLimited(
        RateLimits.DownloaPersonalData,
        // Don't:  MinAuthnStrength.EmbeddingStorageSid12 — better require strong sid.
        ) { request: GetRequest =>
    import request.{dao, theRequester => requester}
    throwForbiddenIf(userId != requester.id && !requester.isAdmin,
      "TyE2PKAQX8", "Cannot download someone else's data")

    val result = dao.readOnlyTransaction { tx =>
      val member: UserInclDetails = tx.loadTheUserInclDetails(userId)

      // Later: Include current ip and cookie etc, if starts remembering for each request [6LKKEZW2]
      // (It'd be found in anyStats below, not in the audit log.)
      val auditLogEntries: Seq[AuditLogEntry] =
        tx.loadAuditLogEntries(userId = Some(userId), types = Nil,
              newerOrAt = None, newerThanEventId = None, olderOrAt = None, newestFirst = true,
              limit = 999, inclForgotten = false)
      val uniqueBrowserIdData = auditLogEntries.map(_.browserIdData).distinct
      val browserIdDataJson = uniqueBrowserIdData map { (browserIdData: BrowserIdData) =>
        Json.obj(
          "cookie" -> JsStringOrNull(browserIdData.idCookie),
          // "fingerprint" -> JsNumber(browserIdData.fingerprint),  // currently always zero
          "ip" -> JsString(browserIdData.ip))
      }

      val anyStats: Option[UserStats] = tx.loadUserStats(userId)
      val statsJson = anyStats.map(JsUserStats(_, reqrPerms = None,
                    callerIsStaff = false, callerIsAdmin = false, // does'nt matter
                    callerIsUserHerself = true,
                    maySeePresence = true, sensitiveAnonDisc = false)
            ) getOrElse JsNull

      val otherEmailAddresses =
        tx.loadUserEmailAddresses(userId).filterNot(_.emailAddress == member.primaryEmailAddress)
      val otherEmailsJson = JsArray(otherEmailAddresses.map(ea => JsString(ea.emailAddress)))

      // To do: Incl old expired sessions too? Or maybe that should be a separate
      // endpoint. [gdpr]
      val sessions = dao.listPatsSessions(userId)

      val identities: Seq[Identity] = tx.loadIdentities(userId)
      val identitiesJson = JsArray(identities map {
        case oauthId: OpenAuthIdentity =>
          val details: OpenAuthDetails = oauthId.openAuthDetails
          Json.obj(
            // UX SHOULD replace the IDP ids with IDP name, e.g. "Gmail" or "Facebook"?
            "confFileIdpId" -> JsStringOrNull(details.confFileIdpId),
            "idpId" -> JsI32OrNull(details.idpId),
            "idpUserId" -> details.idpUserId,
            "username" -> JsStringOrNull(details.username),
            "firstName" -> JsStringOrNull(details.firstName),
            "lastName" -> JsStringOrNull(details.lastName),
            "fullName" -> JsStringOrNull(details.fullName),
            "emailAddress" -> JsStringOrNull(details.email),
            "isEmailVerifiedByIdp" -> JsBoolOrNull(details.isEmailVerifiedByIdp),
            "userInfoJson" -> JsObjOrNull(details.userInfoJson),
            "avatarUrl" -> JsStringOrNull(details.avatarUrl))
        case openidId: IdentityOpenId =>
          val details: OpenIdDetails = openidId.openIdDetails
          Json.obj(
            "oidEndpoint" -> details.oidEndpoint,
            "oidRealm" -> details.oidRealm,
            "oidClaimedId" -> details.oidClaimedId,
            "oidOpLocalId" -> details.oidOpLocalId,
            "firstName" -> details.firstName,
            "emailAddress" -> JsStringOrNull(details.email),
            "country" -> details.country)
        case emailIdty: IdentityEmailId =>
          // Cannot happen. Aren't stored in the Identities table. Not interesting anyway:
          // it's just the email address, which is already included in the response.
          die("TyE26UKVW4")
      })

      val anyPicUrl = member.mediumAvatar.map(request.ugcOrCdnOrSiteOrigin + _.url)

      Json.obj(
        "fullName" -> JsStringOrNull(member.fullName),
        "username" -> JsString(member.username),
        "createdAtDateStr" -> JsString(toIso8601Day(member.createdAt.toJavaDate)),
        "primaryEmailAddress" -> JsString(member.primaryEmailAddress),
        "otherEmailAddresses" -> otherEmailsJson,
        "bio" -> JsStringOrNull(member.about),
        "websiteUrl" -> JsStringOrNull(member.website),
        "location" -> JsStringOrNull(member.country),
        // Incl in Uploads links archieve instead?
        "avatarImageUrl" -> JsStringOrNull(anyPicUrl),
        "trustLevel" -> JsString(member.effectiveTrustLevel.toString),
        "identities" -> identitiesJson,
        "statistics" -> statsJson,
        "browserIdDataRecentFirst" -> browserIdDataJson,
        "sessions" -> sessions.map(s => JsSession(s, inclPart1 = false)))
    }

    OkSafeJson(result)
  }


  def loadUserEmailsLogins(userId: UserId): Action[Unit] = GetAction { request =>
    loadUserEmailsLoginsImpl(userId, request)
  }


  private def loadUserEmailsLoginsImpl(userId: UserId, request: DebikiRequest[_]): mvc.Result = {
    import request.{dao, theRequester => requester}
    // Could refactor and break out functions. Later some day maybe.

    val perms: EffPatPerms =
          dao.deriveEffPatPerms(request.authzContext.groupIdsEveryoneLast)

    throwForbiddenIf(requester.id != userId && !perms.canSeeOthersEmailAdrs,
      "EdE5JKWTDY2", "You may not see someone elses email addresses")

    val isSelfOrAdmin = requester.id == userId || requester.isAdmin

    val (memberInclDetails, emails, identities) = dao.readOnlyTransaction { tx =>
      (tx.loadTheUserInclDetails(userId),
        tx.loadUserEmailAddresses(userId),
        tx.loadIdentities(userId))
    }

    val emailsJson = JsArray(emails map { userEmailAddress =>
      Json.obj(  // UserAccountEmailAddr
        "emailAddress" -> userEmailAddress.emailAddress,
        "addedAt" -> JsWhenMs(userEmailAddress.addedAt),
        "verifiedAt" -> JsWhenMsOrNull(userEmailAddress.verifiedAt))
    })

    var loginMethodsJson = JsArray(identities map { identity: Identity =>
      val (idpName: St,
           idpAuthUrl: Opt[St],
           idpUsername: Opt[St],
           idpUserId: Opt[St],
           emailAddr: Opt[St]) = identity match {
        case oa: OpenAuthIdentity =>
          val details = oa.openAuthDetails
          val customIdp = details.idpId flatMap dao.getSiteCustomIdentityProviderById
          val idpName = customIdp.map(_.nameOrAlias).getOrElse(
                details.confFileIdpId.get)
          val idpUsername = details.username
          val idpAuthUrl = customIdp.map(_.oauAuthorizationUrl)
          (idpName, idpAuthUrl, idpUsername, Some(details.idpUserId), details.email)
        case oid: IdentityOpenId =>
          val details = oid.openIdDetails
          (details.oidEndpoint, None, None, Some(details.oidClaimedId), details.email)
        case x =>
          (classNameOf(x), None, None, None, None)
      }

      // No need to show these details for moderators?  [granular_perms] ...
      // Typescript: UserAccountLoginMethod
      var methodJo = if (!isSelfOrAdmin) JsEmptyObj else Json.obj(
            // COULD instead use: JsIdentity  ?
            "loginType" -> classNameOf(identity),
            "provider" -> idpName,
            "idpAuthUrl" -> idpAuthUrl,
            "idpUsername" -> idpUsername,
            "idpUserId" -> idpUserId)

      // ... but they do have permission to see email addresses:
      methodJo += "idpEmailAddr" -> JsStringOrNull(emailAddr)
      methodJo
    })

    if (memberInclDetails.passwordHash.isDefined) {
      // Non-admins need not know? [granular_perms]
      // Typescript: UserAccountLoginMethod
      var methodJo = if (!isSelfOrAdmin) JsEmptyObj else Json.obj(
            "loginType" -> "LocalPwd",
            "provider" -> "Password",
            "idpUsername" -> memberInclDetails.username)

      methodJo += "idpEmailAddr" -> JsString(memberInclDetails.primaryEmailAddress)
      loginMethodsJson :+= methodJo
    }

    if (memberInclDetails.ssoId.isDefined) {
      // Tests: sso-login-member  TyT5HNATS20P.TyTE2ESSOLGIMS
      // Non-admins need not know? [granular_perms]
      // Typescript: UserAccountLoginMethod
      var methodJo = if (!isSelfOrAdmin) JsEmptyObj else Json.obj(
            "loginType" -> "TySsoApi",
            "provider" -> "Talkyard Single Sign-On API",
            "idpUserId" -> JsStringOrNull(memberInclDetails.ssoId))

      methodJo += "idpEmailAddr" -> JsString(memberInclDetails.primaryEmailAddress)
      loginMethodsJson :+= methodJo
    }

    OkSafeJson(Json.obj(  // UserAccountResponse
        "emailAddresses" -> emailsJson,
        "loginMethods" -> loginMethodsJson))
  }


  def setPrimaryEmailAddresses: Action[JsValue] =
        PostJsonAction(RateLimits.AddEmailLogin, maxBytes = 300, ignoreAlias = true) { request =>
    import request.{dao, body, theRequester => requester}
    // SECURITY maybe send an email and verify with the old address that changing to the new is ok?

    val userId = (body \ "userId").as[UserId]
    val emailAddress = (body \ "emailAddress").as[String]

    throwForbiddenIf(requester.id != userId && !requester.isAdmin,
      "EdE4JTA2F0", "You may not add an email address to someone elses account")

    dao.readWriteTransaction { tx =>
      val member = tx.loadTheUserInclDetails(userId)
      throwBadRequestIf(member.primaryEmailAddress == emailAddress,
        "EdE5GPTVXZ", "Already your primary address")
      val userEmailAddrs = tx.loadUserEmailAddresses(userId)
      val address = userEmailAddrs.find(_.emailAddress == emailAddress)
      throwForbiddenIf(address.isEmpty, "EdE2YGUWF03", "Not your email address")
      throwForbiddenIf(
        address.flatMap(_.verifiedAt).isEmpty, "EdE5AA20I", "Address not verified") // [7GUKRWJ]

      tx.updateUserInclDetails(member.copy(primaryEmailAddress = emailAddress))
    }

    dao.removeUserFromMemCache(userId)
    loadUserEmailsLoginsImpl(userId, request)
  }


  def addUserEmail: Action[JsValue] = PostJsonAction(RateLimits.AddEmailLogin, maxBytes = 300,
        ignoreAlias = true) { request =>
    import request.{dao, body, theRequester => requester}

    val userId = (body \ "userId").as[UserId]
    val emailAddress = (body \ "emailAddress").as[String]

    throwForbiddenIf(requester.id != userId && !requester.isAdmin,
      "EdE4JTA2F0", "You may not add an email address to someone else's account")
    throwForbiddenIf(userId < LowestTalkToMemberId,
      "TyE2GKD052", "Cannot add email addresses to built-in users")

    val member: UserInclDetails = dao.readWriteTransaction { tx =>
      val userEmailAddrs = tx.loadUserEmailAddresses(userId)
      throwForbiddenIf(userEmailAddrs.exists(_.emailAddress == emailAddress),
        "EdE5AVH20", "You've added that email already")
      throwForbiddenIf(userEmailAddrs.length >= MaxEmailsPerUser,
        "EdE2QDS0H", "You've added too many email addresses")
      val member = tx.loadTheUserInclDetails(userId) // also ensures the user exists
      val newAddress = UserEmailAddress(
        userId, emailAddress = emailAddress, addedAt = tx.now, verifiedAt = None)
      tx.insertUserEmailAddress(newAddress)
      member
    }

    BUG; RACE // If the server crashes / gets shut down, the email won't get sent.
    // Instead, add it to some emails-to-send queue. In the same transaction, as above. [EMAILTX]

    val email = createEmailAddrVerifEmailDontSend(member, request, emailAddress, isNewAddr = true)
    globals.sendEmail(email, dao.siteId)

    loadUserEmailsLoginsImpl(userId, request)
  }


  def resendEmailAddrVerifEmail: Action[JsValue] = PostJsonAction(
        RateLimits.ConfirmEmailAddress, maxBytes = 300, ignoreAlias = true) { request =>

    import request.{dao, body, theRequester => requester}

    TESTS_MISSING

    val userId = (body \ "userId").as[UserId]
    val emailAddress = (body \ "emailAddress").as[String]

    throwForbiddenIf(requester.id != userId && !requester.isAdmin,
      "TyE2PYBW0", "You may not send verification emails for someone else")
    throwForbiddenIf(userId < LowestTalkToMemberId,
      "TyE5GUK10", "Cannot send email address verification email to built-in user")

    val member: UserInclDetails = dao.readOnlyTransaction { tx =>
      val userEmailAddrs = tx.loadUserEmailAddresses(userId)
      throwForbiddenUnless(userEmailAddrs.exists(_.emailAddress == emailAddress),
        "TyE6UKBQ2", "The user doesn't have that email address")
      tx.loadTheUserInclDetails(userId)
    }

    val email = createEmailAddrVerifEmailDontSend(
          member, request, emailAddress, isNewAddr = false)

    BUG; RACE // If the server crashes here, the email won't get sent. [EMAILTX]
    globals.sendEmail(email, dao.siteId)

    loadUserEmailsLoginsImpl(userId, request)
  }



  private def createEmailAddrVerifEmailDontSend(
        user: UserInclDetails, request: DebikiRequest[_],
        newEmailAddress: St, isNewAddr: Bo): Email = {

    import context.globals, request.dao
    val (siteName, origin) = dao.theSiteNameAndOrigin()
    val host = request.host

    // A bit dupl code. Break out simplifying fn? Or reuse the other fn? [4CUJQT4]

    val lang = dao.getWholeSiteSettings().languageCode
    val emailTexts = talkyard.server.emails.out.Emails.inLanguage(lang)
    val email = Email.createGenIdAndSecret(
      EmailType.VerifyAddress,
      createdAt = globals.now(),
      sendTo = newEmailAddress,
      toUserId = Some(user.id),
      subject = s"[$siteName] Confirm your email address",   // I18N
      bodyHtmlWithSecret = (secret: St) => {
        val safeEmailAddrVerifUrl =
              globals.originOf(host) +
              routes.UserController.confirmOneMoreEmailAddress(secret)
        emailTexts.confirmOneMoreEmailAddressEmail(
          siteAddress = host,
          username = user.username,
          emailAddress = newEmailAddress,
          isNewAddr = isNewAddr,
          safeVerificationUrl = safeEmailAddrVerifUrl,
          expirationTimeInHours = EmailType.VerifyAddress.secretsExpireHours,
          globals)
      })

    dao.saveUnsentEmail(email)
    email
  }


  def confirmOneMoreEmailAddress(confirmationEmailId: St): Action[U] =
        GetActionAllowAnyoneRateLimited(RateLimits.ConfirmEmailAddress) { request =>
    import request.{dao, requester}

    // A bit dupl code. [4KDPREU2] Break out verifyEmailAddr() fn, place in UserDao.
    // No need for 2 different fns for verifying primary addr, and additional addrs.

    val secret = confirmationEmailId  // rename url param later?
    val email = dao.loadEmailCheckSecret(
          secret, mustBeOfType = EmailType.VerifyAddress) getOrIfBad { err =>
      throwForbidden("TyE1WRB20", s"Bad email address verification link: $err")
    }

    val toUserId = email.toUserId getOrElse throwForbidden(
      "EdE1FKDP0", "Wrong email type: No user id")

    // If, when logged in as X, one can verify the email for another account Y,
    // then, likely one will afterwards incorrectly believe that one is logged in as Y,
    // and maybe do something that only Y would do but not X. So say Forbidden.
    throwForbiddenIf(requester.map(_.id) isSomethingButNot toUserId,
      "TyE8KTQ1", "You're logged in as a the wrong user. Log out and click the verification link again.")

    val now = globals.now()

    val (member: UserInclDetails, verifiedPrimary) = dao.readWriteTransaction { tx =>
      var member = dao.loadTheUserInclDetailsById(toUserId)
      val userEmailAddrs = tx.loadUserEmailAddresses(toUserId)
      val userEmailAddr = userEmailAddrs.find(_.emailAddress == email.sentTo) getOrElse {
        // This might happen if a user removes hens address, and clicks the verif link afterwards?
        throwForbidden("EdE1WKBPE", "Not your email address, did you remove it?")
      }

      // Maybe pat keeps clicking the link many times. [reuse_verif_ln]
      if (!userEmailAddr.isVerified) {
        val addrVerified = userEmailAddr.copy(verifiedAt = Some(now))
        tx.updateUserEmailAddress(addrVerified)
      }

      // Admins can mark someone's primary email as *not* verified, and send another verif email.
      // So, although the user already has an account, we might be verifying the primary email again.
      val verifiedPrimary = member.primaryEmailAddress == userEmailAddr.emailAddress &&
            member.emailVerifiedAt.isEmpty

      if (verifiedPrimary) {
        member = member.copy(emailVerifiedAt = Some(now.toJavaDate))
        tx.updateUserInclDetails(member)
        // Now, with the primary email verified, can start sending summary emails.
        tx.reconsiderSendingSummaryEmailsTo(member.id)
      }

      (member, verifiedPrimary)
    }

    if (verifiedPrimary)
      dao.removeUserFromMemCache(member.id)

    // Redirect pat to hens user profile page, hens email addresses list. But maybe
    // hen isn't logged in? I think hen should not get logged in just by clicking
    // the link.  Maybe this isn't supposed to be an email address hen wants
    // to be able to login with.  Plus, email verification links can be clicked many
    // times (a UX thing, see [reuse_verif_ln]), so it's safer to not get logged in.

    val needsToLogin = requester.isEmpty && dao.getWholeSiteSettings().loginRequired

    val emailsPath = requester.isDefined ? "/preferences/account" | ""  // [4JKT28TS]
    CSP_MISSING
    Ok(views.html.emailVerified(
        SiteTpi(request),
        userProfileUrl = s"/-/users/${member.username}$emailsPath",
        needsToLogin = needsToLogin))
  }


  def removeUserEmail: Action[JsValue] = PostJsonAction(RateLimits.AddEmailLogin, maxBytes = 300,
        ignoreAlias = true) { request =>
    import request.{dao, body, theRequester => requester}

    val userId = (body \ "userId").as[UserId]
    val emailAddress = (body \ "emailAddress").as[String]

    throwForbiddenIf(requester.id != userId && !requester.isAdmin,
      "EdE6LTMQR20", "You may not remove an email address from someone else's account")

    dao.readWriteTransaction { tx =>
      val member = tx.loadTheUserInclDetails(userId) // ensures user exists
      throwForbiddenIf(member.primaryEmailAddress == emailAddress,
        "EdET7UKW2", s"Cannot remove the primary email address: $emailAddress")

      val anyAddress = tx.loadUserEmailAddresses(userId).find(_.emailAddress == emailAddress)
      throwForbiddenIf(anyAddress.isEmpty,
        "EdE8UKDR1", s"No such email address: $emailAddress")

      val identities = tx.loadIdentities(userId)
      val identityUsingEmail = identities.find(_.usesEmailAddress(emailAddress))
      identityUsingEmail foreach { identity =>
        throwForbidden(
          "EdE3Q1ZB9", s"Email address: $emailAddress in use, login method: ${identity.loginMethodName}")
      }
      tx.deleteUserEmailAddress(userId, emailAddress)
    }

    loadUserEmailsLoginsImpl(userId, request)
  }


  def editMember: Action[JsValue] = StaffPostJsonAction(maxBytes = 500) { request =>
    val memberId = (request.body \ "userId").as[UserId]
    val doWhatInt = (request.body \ "doWhat").as[Int]
    val doWhat = EditUserAction.fromInt(doWhatInt).getOrThrowBadArgument("TyE4BKQR28", "doWhat")
    request.dao.editUserIfAuZ(memberId, doWhat, request.who)
    Ok
  }


  def lockTrustLevel: Action[JsValue] = StaffPostJsonAction(maxBytes = 100) { request =>
    val userId = (request.body \ "userId").as[UserId]
    val trustLevelInt = (request.body \ "trustLevel").as[Int]
    val trustLevel = TrustLevel.fromInt(trustLevelInt) getOrElse throwBadRequest(
      "EsE4JYW0", s"Bad trust level: $trustLevelInt")
    request.dao.lockUserTrustLevel(userId, Some(trustLevel))
    Ok
  }


  def unlockTrustLevel: Action[JsValue] = StaffPostJsonAction(maxBytes = 100) { request =>
    val userId = (request.body \ "userId").as[UserId]
    request.dao.lockUserTrustLevel(userId, None)
    Ok
  }


  def lockThreatLevel: Action[JsValue] = StaffPostJsonAction(maxBytes = 100) { request =>
    val userId = (request.body \ "userId").as[UserId]
    val threatLevelInt = (request.body \ "threatLevel").as[Int]
    val threatLevel = ThreatLevel.fromInt(threatLevelInt) getOrElse throwBadRequest(
        "EsE2FW40C", s"Bad threat level: $threatLevelInt")
    if (Participant.isMember(userId)) {
      request.dao.lockUserThreatLevel(userId, Some(threatLevel))
    }
    else {
      request.dao.lockGuestThreatLevel(userId, Some(threatLevel))
    }
    Ok
  }


  def unlockThreatLevel: Action[JsValue] = StaffPostJsonAction(maxBytes = 100) { request =>
    val userId = (request.body \ "userId").as[UserId]
    if (Participant.isMember(userId)) {
      request.dao.lockUserThreatLevel(userId, None)
    }
    else {
      request.dao.lockGuestThreatLevel(userId, None)
    }
    Ok
  }


  def suspendUser: Action[JsValue] = StaffPostJsonAction(maxBytes = 300) { request =>
    val userId = (request.body \ "userId").as[UserId]
    val numDays = (request.body \ "numDays").as[Int]
    val reason = (request.body \ "reason").as[String]
    if (numDays < 1)
      throwBadReq("DwE4FKW0", "Please specify at least one day")
    if (reason.length > 255)
      throwBadReq("DwE4FKW0", "Too long suspend-user-reason")
    if (isGuestId(userId))
      throwBadReq("DwE5KE8", "Cannot suspend guest user ids")

    request.dao.suspendUser(userId, numDays, reason, suspendedById = request.theUserId)
    Ok
  }


  def unsuspendUser: Action[JsValue] = StaffPostJsonAction(maxBytes = 100) { request =>
    val userId = (request.body \ "userId").as[UserId]
    if (isGuestId(userId))
      throwBadReq("DwE7GPKU8", "Cannot unsuspend guest user ids")
    request.dao.unsuspendUser(userId)
    Ok
  }


  def blockGuest: Action[JsValue] = StaffPostJsonAction(maxBytes = 100) { request =>
    val postId = (request.body \ "postId").as[PostId]
    val numDays = -1 // (request.body \ "numDays").as[Int] // currently no longer in use
    val threatLevel = ThreatLevel.fromInt((request.body \ "threatLevel").as[Int]).getOrElse(
          throwBadArgument("EsE8GY2W", "threatLevel"))
    request.dao.blockGuestIfAuZ(
          postId, threatLevel, request.reqrTargetSelf.denyUnlessStaff())
    Ok
  }


  def unblockGuest: Action[JsValue] = StaffPostJsonAction(maxBytes = 100) { request =>
    val postId = (request.body \ "postId").as[PostId]
    request.dao.unblockGuest(postId, unblockerId = request.theUserId)
    Ok
  }


  /** If not staff, returns a summary only.
    */
  def loadAuthorBlocks(postId: Int): Action[Unit] = GetActionRateLimited(
        RateLimits.ReadsFromDb, MinAuthnStrength.EmbeddingStorageSid12) { request =>

    CHECK_AUTHN_STRENGTH

    val blocks: Seq[Block] = request.dao.loadAuthorBlocks(postId)
    var json = blocksSummaryJson(blocks, request.ctime)
    if (request.user.exists(_.isStaff)) {
      json += "blocks" -> JsArray(blocks map blockToJson)
    }
    OkSafeJson(json)
  }


  private def blocksSummaryJson(blocks: Seq[Block], now: ju.Date): JsObject = {
    var isBlocked = false
    var blockedForever = false
    var maxEndUnixMillis: UnixMillis = 0L
    for (block <- blocks) {
      if (block.blockedTill.isEmpty) {
        isBlocked = true
        blockedForever = true
      }
      else if (now.getTime <= block.blockedTill.get.getTime) {
        isBlocked = true
        maxEndUnixMillis = math.max(maxEndUnixMillis, block.blockedTill.get.getTime)
      }
    }
    var json = Json.obj(
      "isBlocked" -> isBlocked,
      "blockedForever" -> blockedForever)
    if (maxEndUnixMillis != 0L && !blockedForever) {
      json += "blockedTillMs" -> JsNumber(maxEndUnixMillis)
    }
    json
  }


  private def blockToJson(block: Block): JsObject = {
    Json.obj(
      "threatLevel" -> JsNumber(block.threatLevel.toInt),
      "ip" -> JsStringOrNull(block.ip.map(_.toString)),
      "browserIdCookie" -> block.browserIdCookie,
      "blockedById" -> block.blockedById,
      "blockedAtMs" -> block.blockedAt.getTime,
      "blockedTillMs" -> JsLongOrNull(block.blockedTill.map(_.getTime)))
  }


  def redirectToMyLastTopic: Action[Unit] = GetAction { request =>
    import request.{dao, theRequester => requester}
    // Load a few topics, in case some were deleted.
    val topicsInclForbidden = dao.loadPagesByUser(requester.id, isStaffOrSelf = true, limit = 5)
    val latestTopic = topicsInclForbidden find { page: PagePathAndMeta =>
      !page.meta.isDeleted && dao.maySeePageUseCache(page.meta, Some(requester)).maySee
    }
    val redirectToUrl = latestTopic.map(_.path.value) getOrElse "/"
    TemporaryRedirect(redirectToUrl)
  }


  def viewUserPage(whatever: String): Action[Unit] = AsyncGetAction { request =>
    val htmlStr = views.html.templates.users(SiteTpi(request)).body
    ViewPageController.addVolatileJsonAndPreventClickjacking2(htmlStr,
      unapprovedPostAuthorIds = Set.empty, request)
  }


  def loadMyPageData(pageIds: St): Action[U] = GetAction2(RateLimits.ReadsFromDb,
        MinAuthnStrength.EmbeddingStorageSid12) { request =>
    import request.dao
    QUICK; COULD_OPTIMIZE // don't use String.split('') — it sometimes creates a regex.
    // Review the whole code base. // Use Guava's Splitter instead.
    // https://guava.dev/releases/20.0/api/docs/com/google/common/base/Splitter.html

    COULD_OPTIMIZE // fewer requests
    // Later, load data for many pages:  [many_ifr_my_page_data]
    val pageIdsSeq: ImmSeq[PageId] =
          if (pageIds.indexOf(',') == -1) ImmSeq(pageIds)
          else pageIds.split(',').to(ImmSeq)
   // For now:
    val anyMeAndStuff: Opt[MeAndStuff] = loadMyPageDataImpl(request, pageIdsSeq.head)
    val stuffJsOb = anyMeAndStuff.map(_.stuffForMe.toJson(dao))
    OkSafeJson(Json.obj(
        "me" -> JsObjOrNull(anyMeAndStuff.map(_.me.meJsOb)),
        "stuffForMe" -> JsObjOrNull(stuffJsOb)))
  }


  private def loadMyPageDataImpl(request: ApiRequest[_], pageId: PageId)
        : Opt[MeAndStuff] = Some {
    import request.dao
    val pageMeta = request.dao.getPageMeta(pageId) getOrElse {
      // Might be an embedded comment page, not yet created because no comments posted.
      // Or we might be in the signup-to-become-owner step, when creating a new site.
      return dao.jsonMaker.userNoPageToJson(request)
    }

    CHECK_AUTHN_STRENGTH

    val pagePath = request.dao.getPagePath(pageId) getOrElse {
      // The page was apparently deleted some microseconds ago.
      return dao.jsonMaker.userNoPageToJson(request)
    }

    val pageCtx = request.dao.maySeePageUseCache(pageMeta, request.user) ifNot { debugCode =>
      return dao.jsonMaker.userNoPageToJson(request)
    }

    val pageRequest = new PageRequest(
      request.site,
      sid = request.sid,
      anyTySession = request.anyTySession,
      xsrfToken = request.xsrfToken,
      browserId = request.browserId,
      user = request.user,
      pageExists = true,
      pagePath = pagePath,
      pageMeta = Some(pageMeta),
      ancCatsRootLast = pageCtx.ancCatsRootLast,
      altPageId = None,
      embeddingUrl = request.embeddingUrlParam,  // [emb_forum_is_emb]
      dao = request.dao,
      request = request.request)

    val res: MeAndStuff =
      if (pageRequest.user.isDefined) {
        val renderedPage = request.dao.renderWholePageHtmlMaybeUseMemCache(pageRequest)
        dao.jsonMaker.userDataJson(pageRequest, renderedPage.unapprovedPostAuthorIds,
              renderedPage.anonsByRealId).getOrDie("EdE4ZBXKG")
      }
      else {
        val everyonesPerms = request.dao.getPermsForEveryone()
        val everyoneGroup = request.dao.getTheGroup(Group.EveryoneId)
        val me = dao.jsonMaker.noUserSpecificData(everyonesPerms, everyoneGroup)
        MeAndStuff(me, StuffForMe.empty)
      }

    res
  }


  def apiv0_showApiSecretInfo: Action[U] = ApiSecretGetJsonAction(
        WhatApiSecret.SiteSecret, RateLimits.ReadsFromCache) { req: GetRequest =>
    // For now, only sysbot can do API requests, and sysbot can do anything.
    val authzCtx = req.dao.getAuthzContextOnPats(req.requester)
    OkApiJson(Json.obj(
      "apiSecretInfo" -> Json.obj(
        "user" -> JsUserApiV0(req.theMember, brief = true, authzCtx),
        "capabilities" -> Json.arr("DoAnything", "SeeAnything"))))
        // Later: Created at, expires at
  }


  /** Ignores any [persona_mode] — the purpose is to help the true user remember what
    * han has read, regardless of they're anonymous or not for the moment. And others
    * can't access hans reading progress. [anon_read_progr]
    */
  def trackReadingProgress: Action[JsValue] = PostJsonAction(
        RateLimits.TrackReadingActivity,
        MinAuthnStrength.EmbeddingStorageSid12,
        maxBytes = 1000,
        ignoreAlias = true,
        ) { request =>

    import request.{dao, theRequester}
    val readMoreResult = trackReadingProgressImpl(request, request.body)
    val result =
      if (readMoreResult.numMoreNotfsSeen == 0) JsNull
      else {
        // Posts related to some notifications were seen. Update the notifications, client side,
        // so they'll get un-highlighted, since the posts they are about, have now been seen.

        CHECK_AUTHN_STRENGTH // Skip the notifications, if in embedded iframe?

        // dupl line [8AKBR0]
        val notfsAndCounts = dao.loadNotificationsSkipReviewTasks(
          theRequester.id, upToWhen = None, request.who, unseenFirst = true, limit = 20)

        // dupl code [7KABR20]
        Json.obj(  // ts: MePatch
          "numTalkToMeNotfs" -> notfsAndCounts.numTalkToMe,
          "numTalkToOthersNotfs" -> notfsAndCounts.numTalkToOthers,
          "numOtherNotfs" -> notfsAndCounts.numOther,
          "thereAreMoreUnseenNotfs" -> notfsAndCounts.thereAreMoreUnseen,
          "notifications" -> notfsAndCounts.notfsJson)
      }

    OkSafeJsValue(result)
  }


  /** In the browser, navigator.sendBeacon insists on sending plain text. So need this text handler.
    */
  def trackReadingProgressText: Action[String] = PostTextAction(RateLimits.TrackReadingActivity,
        MinAuthnStrength.EmbeddingStorageSid12, maxBytes = 1000, ignoreAlias = true) { request =>
    val bodyXsrfTokenRemoved = request.body.dropWhile(_ != '\n') // [7GKW20TD]
    val json = Json.parse(bodyXsrfTokenRemoved)
    trackReadingProgressImpl(request, json)
    Ok
  }


  private def trackReadingProgressImpl(request: DebikiRequest[_], body: JsValue): ReadMoreResult = {
    SECURITY // how prevent an evil js client from saying "I've read everything everywhere",
    // by calling this endpoint many times, and listing all pages + all post nrs.
    // Could be used to speed up the trust level transition from New to Basic to Member.

    import request.{siteId, dao, theRequester => requester}
    import talkyard.server.{WhenFormat, OptWhenFormat}

    throwForbiddenIf(requester.isAnon, "TyE8LUHE1", "Not tracking anonyms' reading progress")
    throwForbiddenIf(requester.isGuest, "EdE8LUHE2", "Not tracking guests' reading progress")
    throwForbiddenIf(requester.isGroup, "EdE5QFVB5", "Not tracking groups' reading progress")

    val anyPageId = (body \ "pageId").asOpt[PageId]
    var visitStartedAt = (body \ "visitStartedAt").as[When]
    val anyLastViewedPostNr = (body \ "lastViewedPostNr").asOpt[PostNr]
    var lastReadAt = (body \ "lastReadAt").as[Option[When]]
    var secondsReading = (body \ "secondsReading").as[Int]
    val pagePostNrIdsReadJsObjs = (body \ "pagePostNrIdsRead").as[Vector[JsObject]]
      // Cannot read super many posts in just 30 seconds (that's how often this endpoint
      // gets called [6AK2WX0G]) so ... lets restrict to 100? to prevent maybe-weird-DoS-attacks.
      .take(100)
    val pagePostNrIdsRead = pagePostNrIdsReadJsObjs.map(jsObj => {
      // COULD require that jsObj.pageId equals the outer pageId(s)?  So one cannot mark-as-read
      // posts on pages one didn't visit?
      val pageId = (jsObj \ "pageId").as[PageId]
      val postNr = (jsObj \ "postNr").as[PostNr]
      val postId = (jsObj \ "postId").as[PostId]
      PagePostNrId(pageId, postNr, postId)
    })

    val postNrsRead = pagePostNrIdsRead.map(_.postNr)
    val postNrsReadAsSet = postNrsRead.toSet

    throwForbiddenIf(anyLastViewedPostNr.isDefined && anyPageId.isEmpty,
      "TyE2AKBF58", "Got a last viewed post nr, but no page id")

    postNrsReadAsSet.find(_ < BodyNr) map { badNr =>
      // The title and draft post nrs are < 0 and shouldn't be included here.
      throwForbidden("TyE5RKPW025", s"Bad post nr, smaller than BodyNr: $badNr")
    }

    CHECK_AUTHN_STRENGTH
    // If page & post nrs read included, we check if _may_see_page, below.

    logger.trace(
      s"s$siteId, page $anyPageId: Post nrs read: $postNrsRead, seconds reading: $secondsReading")

    val now = globals.now()
    val lowPostNrsRead: Set[PostNr] = postNrsReadAsSet.filter(_ <= PageReadingProgress.MaxLowPostNr)
    val lastPostNrsReadRecentFirst =
      postNrsRead.filter(_ > PageReadingProgress.MaxLowPostNr).reverse.take(
        PageReadingProgress.MaxLastPostsToRemember).distinct

    if (visitStartedAt.isAfter(now)) {
      // Bad browser date-time setting?
      visitStartedAt = now
      if (lastReadAt.isDefined) {
        lastReadAt = Some(now)
      }
    }

    if (secondsReading > TrackReadingActivity.IntervalSeconds) {
      secondsReading = TrackReadingActivity.IntervalSeconds
      SECURITY; COULD // prevent the same user from calling much more often than the interval.
      // (But page reloads might --> a little bit more often.)
    }

    lastReadAt foreach { at =>
      if (at.isAfter(now)) {
        // Bad browser date-time setting?
        lastReadAt = Some(now)
      }
    }

    val anyPageReadingProgress = anyLastViewedPostNr map { lastViewedPostNr =>
      try PageReadingProgress(
        firstVisitedAt = visitStartedAt,
        lastVisitedAt = now,
        lastViewedPostNr = lastViewedPostNr,
        lastReadAt = lastReadAt,
        lastPostNrsReadRecentFirst = lastPostNrsReadRecentFirst,
        lowPostNrsRead = lowPostNrsRead,
        secondsReading = secondsReading)
      catch {
        case ex: Exception =>
          throwBadRequest("EdE5FKW02", ex.toString)
      }
    }

    COULD_OPTIMIZE // Don't need both this and [user_watches_pages_pubsub]?
    dao.pubSub.userIsActive(request.siteId, requester, request.theBrowserIdData)

    if (anyPageReadingProgress.isDefined) {
      // This visit happened on an article / discussion page.
      val pageId = anyPageId.getOrDie("TyE7KAKR25")

      // [upd_watchbar_has_read]
      val authzCtx: AuthzCtxOnAllWithReqer = request.authzCtxOnAllWithReqer.get
      var watchbar: BareWatchbar = dao.getOrCreateWatchbar(authzCtx)
      COULD_OPTIMIZE // Page loaded again below in trackReadingProgressClearNotfsPerhapsPromote().
      val page = dao.getPageMeta(pageId) getOrElse {
        throwIndistinguishableNotFound("TyE702SKJ", s"Page $pageId not found")
      }

      // This'll check if _may_see_page, throws Not Found if not. [WATCHSEC]
      dao.watchbarAddRecentMarkSeen(watchbar, page, authzCtx)

      dao.trackReadingProgressClearNotfsPerhapsPromote(
          requester, pageId, pagePostNrIdsRead.map(_.postId).toSet, anyPageReadingProgress.get)
    }
    else {
      // This visit happened on an admin page or user profile page.
      dao.rememberVisit(requester, lastVisitedAt = now)
    }
  }


  def toggleTips: Action[JsValue] = UserPostJsonAction(RateLimits.TrackReadingActivity,
      MinAuthnStrength.EmbeddingStorageSid12,  // [if_emb_forum]
        maxBytes = 200, ignoreAlias = true) { request =>
    import request.{dao, body, theRequester => requester}
    val tipsId: Opt[St] = parseOptSt(body, "tipsId")
    val hide: Bo = parseBo(body, "hide")
    val onlyAnnouncements: Bo = parseOptBo(body, "onlyAnnouncements") getOrElse false
    tipsId foreach { id =>
      anyTourTipsIdError(id) foreach EdHttp.throwBadRequest
    }
    dao.toggleTips(requester, anyTipsSeen = tipsId, hide = hide,
          onlyAnnouncements = onlyAnnouncements)
    Ok
  }

  def loadNotifications(userId: UserId, upToWhenMs: Long): Action[Unit] =
        GetActionRateLimited(
            RateLimits.ExpensiveGetRequest,
            MinAuthnStrength.EmbeddingStorageSid12,  // [if_emb_forum]
            ) { request =>
    // [to_paginate]
    loadNotificationsImpl(userId, upToWhen = None, request)
  }


  private def loadNotificationsImpl(userId: UserId, upToWhen: Opt[When], req: DebikiRequest[_])
        : mvc.Result = {
    val notfsAndCounts = req.dao.loadNotificationsSkipReviewTasks(userId, upToWhen, req.who)
    OkSafeJson(Json.obj("notfs" -> notfsAndCounts.notfsJson)) // ts: NotfSListResponse
  }


  def markAllNotfsAsSeen(): Action[JsValue] = PostJsonAction(RateLimits.MarkNotfAsSeen,
        MinAuthnStrength.EmbeddingStorageSid12,  // [if_emb_forum]
        maxBytes = 200, ignoreAlias = true) { request =>
    request.dao.markAllNotfsAsSeen(request.theUserId)
    loadNotificationsImpl(request.theUserId, upToWhen = None, request)
  }


  def markNotificationAsSeen(): Action[JsValue] = PostJsonAction(RateLimits.MarkNotfAsSeen,
        MinAuthnStrength.EmbeddingStorageSid12,  // [if_emb_forum]
        maxBytes = 200, ignoreAlias = true) { request =>
    import request.{dao, theRequesterId}
    val notfId = (request.body \ "notfId").as[NotificationId]
    dao.markNotificationAsSeen(theRequesterId, notfId)
    Ok
  }


  def snoozeNotifications(): Action[JsValue] = PostJsonAction(
        RateLimits.ConfigUser,
        MinAuthnStrength.EmbeddingStorageSid12,  // [if_emb_forum]
        maxBytes = 200, ignoreAlias = true) { request =>
    import request.{dao, theRequesterId}
    val untilWhen: Option[When] =
          (request.body \ "untilMins").as[JsValue] match {
            case JsFalse => None
            case JsNumber(whenMins) if whenMins >= 0 =>
              Some(When.fromMinutes(whenMins.toInt))
            case x => throwBadRequest("TyE46RKTDJ7", s"Bad untilMins: $x")
          }
    dao.snoozeNotifications(theRequesterId, untilWhen)
    Ok
  }


  def saveContentNotfPref: Action[JsValue] = PostJsonAction(RateLimits.ConfigUser,
          MinAuthnStrength.EmbeddingStorageSid12, maxBytes = 500, ignoreAlias = true,
          ) { request =>
    import request.{dao, theRequester => requester}
    val body = request.body
    val memberId = (body \ "memberId").as[MemberId]
    val anyPageIdMaybeEmptyPage = (body \ "pageId").asOpt[PageId]
    val pagesPatCreated = (body \ "pagesPatCreated").asOpt[Bo]
    val pagesPatRepliedTo = (body \ "pagesPatRepliedTo").asOpt[Bo]
    val pagesInCategoryId = (body \ "pagesInCategoryId").asOpt[CategoryId]
    val wholeSite = (body \ "wholeSite").asOpt[Bo]
    val newNotfLevelInt = (body \ "notfLevel").asOpt[i32]
    val newNotfLevel = newNotfLevelInt.flatMap(NotfLevel.fromInt)

    // If is a not-yet-created embedded comments page:
    val anyDiscussionId = (body \ "discussionId").asOpt[AltPageId] orElse (
          body \ "altPageId").asOpt[AltPageId] ; CLEAN_UP // deprecated name [058RKTJ64] 2020-06
    val anyEmbeddingUrl = (body \ "embeddingUrl").asOpt[String]
    val lazyCreatePageInCatId = (body \ "lazyCreatePageInCatId").asOpt[CategoryId]

    def participant = dao.getTheParticipant(memberId)

    throwForbiddenIf(memberId != requester.id && !requester.isStaff, "TyE5HKG205",
      "May not change other members notf prefs")
    throwForbiddenIf(memberId == Group.AdminsId && !requester.isAdmin, "TyE4HKW2R7",
      "May not change admin group's notf prefs")
    throwForbiddenIf(participant.isAdmin && !requester.isAdmin, "TyE5P2AQ04",
      "May not change admin user's notf prefs")

    throwForbiddenIf(pagesPatCreated is true, "TyE052RMSKF", "unimpl: pagesPatCreated")

    // If this is for a not yet created embedded comments page, then lazy-create it here.
    // (Sometimes people subscribe to comments for embedded blog comments discussions,
    // before any comments or Like votes have been submitted — then this is where the
    // emb page needs to get lazy-created, so the notf prefs has a page id to refer to.)
    BUG // lazy creating the page here reportedly results in a
        // "You have replies to posts of yours" email, although there aren't yet any replies.
        // https://www.talkyard.io/-227#post-8
    val (anyPageId: Option[PageId], newEmbPage: Option[NewEmbPage]) =
      if (anyPageIdMaybeEmptyPage is EmptyPageId) {
        val (newPageId: PageId, newEmbPage) =
              EmbeddedCommentsPageCreator.getOrCreatePageId(
                    anyPageId = Some(EmptyPageId), anyDiscussionId = anyDiscussionId,
                    anyEmbeddingUrl = anyEmbeddingUrl,
                    lazyCreatePageInCatId = lazyCreatePageInCatId, request)
        (Some(newPageId), newEmbPage)
      }
      else {
        (anyPageIdMaybeEmptyPage, None)
      }

    val newPref = Try(
          PageNotfPref(
                memberId,
                pageId = anyPageId,
                pagesPatRepliedTo = pagesPatRepliedTo.getOrElse(false),
                //pagesPatCreated = pagesPatCreated.getOrElse(false),
                pagesInCategoryId = pagesInCategoryId,
                wholeSite = wholeSite.getOrElse(false),
                notfLevel = newNotfLevel.getOrElse(NotfLevel.DoesNotMatterHere)))
            .getOrIfFailure(ex => throwBadRequest("TyE2ABKRP0", ex.getMessage))

    CHECK_AUTHN_STRENGTH

    val reqTgt = request.reqrAndTarget(participant)

    if (newNotfLevel.isDefined) {
      dao.savePageNotfPrefIfAuZ(newPref, reqTgt)
    }
    else {
      dao.deletePageNotfPrefIfAuZ(newPref, reqTgt)
    }

    OkSafeJson(
      EmbeddedCommentsPageCreator.makeAnyNewPageJson(newEmbPage))
  }


  def loadGroups: Action[Unit] = GetActionRateLimited(
          RateLimits.ReadsFromDb, MinAuthnStrength.EmbeddingStorageSid12) { request =>
    val groups = request.dao.getGroupsAndStatsReqrMaySee(request.requesterOrUnknown)
    OkSafeJsonArr(JsArray(groups map JsGroupAndStats))
  }


  def createGroup: Action[JsValue] = AdminPostJsonAction(maxBytes = 2000) { request =>
    val fullName: Option[String] = (request.body \ "fullName").as[String].trimNoneIfEmpty
    val username: String = (request.body \ "username").as[String].trim

    throwForbiddenIf(username.isEmpty, "TyE205MA6", "No username specified")

    request.dao.createGroup(username, fullName = fullName, request.reqrId) match {
      case Bad(errorMessage) =>
        throwForbidden("TyE603MRST", errorMessage)
      case Good(group) =>
        OkSafeJson(JsGroup(group))
    }
  }


  def deleteGroup: Action[JsValue] = AdminPostJsonAction(maxBytes = 2000) { request =>
    val groupIdToDelete: UserId = (request.body \ "groupIdToDelete").as[UserId]
    request.dao.deleteGroup(groupIdToDelete, request.reqrId)
    Ok
  }


  def listGroupMembers(groupId: UserId): Action[Unit] = GetActionRateLimited(
          RateLimits.ReadsFromDb, MinAuthnStrength.EmbeddingStorageSid12) { request =>
    val maybeMembers = request.dao.listGroupMembersIfReqrMaySee(groupId, request.requesterOrUnknown)
    val respJson = maybeMembers match {
      case None =>
        // May not know who the members are.
        JsFalse
      case Some(membs: ImmSeq[UserBase]) =>
        // [missing_tags_feats]  load tags and tag types, incl here.
        JsArray(membs.map(JsUser(_)))
    }
    OkSafeJsValue(respJson)
  }


  def addGroupMembers: Action[JsValue] = StaffPostJsonAction(maxBytes = 5000) { request =>
    val groupId = (request.body \ "groupId").as[UserId]
    val memberIds = (request.body \ "memberIds").as[Set[UserId]]
    request.dao.addGroupMembers(groupId, memberIds, request.reqrId)
    Ok
  }


  def removeGroupMembers: Action[JsValue] = StaffPostJsonAction(maxBytes = 5000) { request =>
    val groupId = (request.body \ "groupId").as[UserId]
    val memberIds = (request.body \ "memberIds").as[Set[UserId]]
    request.dao.removeGroupMembers(groupId, memberIds, request.reqrId)
    Ok
  }


  CHECK_AUTHN_STRENGTH // maybe sometimes not allowed from embedded comments pages?
  def listAllUsers(usernamePrefix: St): Action[U] = GetActionRateLimited(
          RateLimits.ReadsFromDb, MinAuthnStrength.EmbeddingStorageSid12) { request =>
    // Authorization check: Is a member? Add MemberGetAction?
    request.theMember

    val json = _listAllUsersImpl(usernamePrefix, request)
    OkSafeJsonArr(json)
  }


  CHECK_AUTHN_STRENGTH // maybe sometimes not allowed from embedded comments pages?
  def listMembersPubApi(usernamePrefix: String, usersOnly: Boolean)
        : Action[Unit] = GetAction { request =>
    // Allowed also if not logged in — so can use from a non-Talkyard client,
    // without any API secret.
    throwForbiddenIf(!request.siteSettings.enableApi,
      "TyE4305RKCGL4", o"""API not enabled. If you're admin, you can enable it
         in the Admin Area | Settings | Features tab.""")
    val json = _listAllUsersImpl(usernamePrefix, request)
    dieIf(!usersOnly, "TyE206KTTR4")  // else: return a 'groups:...' or 'members:' field
    OkApiJson(
      // [PUB_API] Wrap in an obj, so, later on, we can add more things (fields)
      // to the response, without breaking existing API consumers. E.g. some type of
      // cursor for iterating through all members.
      Json.obj(
        "users" -> json))
  }


  private val _ListUsersLimit = 50

  private def _listAllUsersImpl(usernamePrefix: String, request: ApiRequest[_]): JsArray = {
    import request.{requester, requesterOrUnknown, dao}
    // Also load deleted anon12345 members. Simpler, and they'll typically be very few or none. [5KKQXA4]
    // ... stop doing that?
    val patsPrefsMayList: ImmSeq[PatAndPrivPrefs] = dao.loadUserMayListByPrefix(
          usernamePrefix, caseSensitive = false, limit = _ListUsersLimit, requesterOrUnknown)
    _mkMentionOptionsJson(patsPrefsMayList, requester)
  }


  /** Listing usernames on a particular page is okay, if one may see the page
    * — however, listing all usernames for the whole site, isn't always okay.
    */
  def listUsernames(pageId: PageId, prefix: St): Action[U] = GetActionRateLimited(
          RateLimits.ReadsFromDb, MinAuthnStrength.EmbeddingStorageSid12) { request =>
    import request.{dao, requester, requesterOrUnknown}

    // If some time in the future there will be "hidden" accounts  [private_pats]
    // — someone who don't want strangers and new members to see hens profile —
    // then, would need to exclude those accounts here.

    CHECK_AUTHN_STRENGTH  // disallow if just sid part 1+2 but not embedded page

    dao.throwIfMayNotSeePage2(pageId, request.reqrTargetSelf)(anyTx = None)

    // Also load deleted anon12345 members. Simpler, and they'll typically be very few or none. [5KKQXA4]
    UX; COULD // Show a checkbox in the @mention-users list that says if deleted/suspended/banned
    // users should get loaded. By default, exclude such users, since they cannot be @mentioned
    // anyway (in the sense that they aren't getting notified, won't reply). [mention_all_cb]
    COULD // load groups too, so it'll be simpler to e.g. mention @support.
    // But this lists names on a page, but groups won't reply, so won't get listed. Hmm.
    // Maybe if one has typed >= 3 chars matching any group's or user's username, then,
    // show that group/user, also if hen hasn't replied on this page?
    // Or maybe two lists: People on this page, and all others?
    // There could even be a group setting: [mentions_prio_c], which admins can raise,
    // for their @support group — maybe then it'd get listed directly if just typing ' @'?

    // For now, listing by both prefix and page id not implemented.
    // Also, unclear if that's what the user wants?  Maybe they *want* to mention
    // someone not on the current page?
    val patAndPrefs: ImmSeq[PatAndPrivPrefs] = {
      if (prefix.nonEmpty) {
        dao.loadUserMayListByPrefix(
              prefix, caseSensitive = false, limit = _ListUsersLimit, requesterOrUnknown)
      }
      else {
        // This skips authors of hidden / deleted / private comments,  [priv_comts]
        // and bookmarks. [dont_list_bookmarkers]
        val users: ImmSeq[UserBr] = dao.listUsernamesOnPage(pageId = pageId)

        // Reqr may see page, so can see all users there anyway.
        // But maybe may not mention all of them, so we still need everyone's priv prefs.
        val allGroups: Vec[Group] = dao.getAllGroups()
        dao.derivePrivPrefs(users, allGroups)
      }
    }

    val jsArr = _mkMentionOptionsJson(patAndPrefs, requester)
    OkSafeJsonArr(jsArr)
  }


  private def _mkMentionOptionsJson(patAndPrefs: ImmSeq[PatAndPrivPrefs], requester: Opt[Pat])
          : JsArray = {
    JsArray(patAndPrefs map { (patPrefs: PatAndPrivPrefs) =>
        val nameAndUsername = patPrefs.pat
        // [PUB_API] .ts: ListUsersApiResponse, ListGroupsApiResponse, ListMembersApiResponse
        val jOb = Json.obj(
              "id" -> nameAndUsername.id,
              // Currently always present, since we're listing by username.
              "username" -> JsStringOrNull(nameAndUsername.anyUsername),
              // May be missing.
              "fullName" -> JsStringOrNull(nameAndUsername.anyName))
        _plusAnyNotMention(requester, patPrefs.privPrefsOfPat.mayMentionMeTrLv, jOb)
      })
  }


  /** This is just for client side UX. The server side checks are here: [filter_mentions].
    */
  private def _plusAnyNotMention(reqer: Opt[Pat], mayMentionMeTrLv: Opt[TrustLevel],
          jOb: JsObject): JsObject = {
    // Later: [private_pats] If the requester may not see the listed member, remove hen
    // from the list instead of adding mayMention: flase.
    var res = jOb
    mayMentionMeTrLv foreach { minLevel =>
      if (!reqer.exists(_.effectiveTrustLevel.isAtLeast(minLevel))) {
        res += "mayMention" -> JsFalse
        //s += "whyNotMention" -> " ..." // later
      }
    }
    res
  }


  /** maxBytes = 3000 because the about text might be fairly long.
    */
  def saveAboutMemberPrefs: Action[JsValue] = PostJsonAction(RateLimits.ConfigUser,
        maxBytes = 3000, ignoreAlias = true) { request =>
    val prefs = aboutMemberPrefsFromJson(request.body)
    _quickThrowUnlessMayEditPrefs(prefs.userId, request.theRequester)
    request.dao.saveAboutMemberPrefsIfAuZ(prefs, request.who)

    val patJson = _loadPatJsonById(prefs.userId, request)
    OkSafeJson(Json.obj("patNoStatsNoGroupIds" -> patJson))
  }


  def saveAboutGroupPreferences: Action[JsValue] = PostJsonAction(RateLimits.ConfigUser,
        maxBytes = 3000,
        // ignoreAlias = true, — or do care? Groups != oneself, maybe some admin
        // might believe they'd be editing the group settings anonymously?
        ) { request =>
    import request.{dao, theRequester => requester}
    val prefs = aboutGroupPrefsFromJson(request.body)
    if (!requester.isAdmin)
      throwForbidden("EdE5PYKW0", "Only admins may change group prefs, right now")
    dao.saveAboutGroupPrefs(prefs, request.who)

    val patJson = _loadPatJsonById(prefs.groupId, request)
    OkSafeJson(Json.obj("patNoStatsNoGroupIds" -> patJson))
  }


  def savePatPerms: Action[JsValue] = AdminPostJsonAction2(RateLimits.ConfigUser,
        maxBytes = 1000) { request =>
    import request.{body, dao, siteId}
    val patId = parseI32(body, "patId")
    val perms: PatPerms = JsX.parsePatPerms(body, siteId)(IfBadAbortReq)
    dao.savePatPerms(patId, perms, request.who)

    val patJson = _loadPatJsonById(patId, request)
    OkSafeJson(Json.obj("patNoStatsNoGroupIds" -> patJson))
  }


  def saveUiPreferences: Action[JsValue] = PostJsonAction(RateLimits.ConfigUser,
        maxBytes = 3000, ignoreAlias = true) { request =>
    import request.{body, dao, theRequester => requester}
    val memberId = (body \ "memberId").as[UserId]
    val prefs = (body \ "prefs").as[JsObject]
    throwForbiddenIf(prefs.fields.length > 10, "TyE7ABKSG2", "Too many UI prefs fields")
    anyWeirdJsObjField(prefs, maxLength = 10) foreach { problemMessage =>
      throwBadRequest("TyE5AKBR024", s"Weird UI prefs: $problemMessage")
    }
    dao.saveUiPrefs(memberId, prefs, request.who)
    Ok
  }


  def loadMembersCatsTagsSiteNotfPrefs(memberId: Int): Action[Unit] = GetActionRateLimited(
          RateLimits.ReadsFromDb, MinAuthnStrength.EmbeddingStorageSid12) { request =>
    loadMembersCatsTagsSiteNotfPrefsImpl(memberId, request)
  }


  def loadMembersCatsTagsSiteNotfPrefsImpl(memberId: Int, request: ApiRequest[_]): mvc.Result = {
    import request.{dao, theRequester => requester}
    throwForbiddenIf(memberId != requester.id && !requester.isAdmin,
        "TyE4RBSK8FG", "May not view someone elses notf prefs")
    throwForbiddenIf(memberId <= MaxGuestId,
        "TyE7WRG04RS2", "Guests cannot have notf prefs")
    throwForbiddenIf(memberId < Participant.LowestNormalMemberId,
      "TyE4RKTRE9", "Special built-in users cannot have notf prefs")
    val member = dao.getTheParticipant(memberId)
    val prefs = dao.loadMembersCatsTagsSiteNotfPrefs(member)
    val myCatsTagsSiteNotfPrefs = prefs.filter(_.peopleId == memberId)
    val groupsCatsTagsSiteNotfPrefs = prefs.filter(_.peopleId != memberId)

    // ----- Cats the *member* can see

    // This request is about memberId — what cats may hen see?

    val authContextForMember = dao.getForumAuthzContext(Some(member))

    val categoriesMemberMaySee = dao.listMaySeeCategoriesAllSections(
          inclDeleted = false, authContextForMember)

    val categoryIdsMemberMaySee = categoriesMemberMaySee.map(_.id)  // (or use a set?)

    // ----- Cats the *requester* can see

    // The person that sent the HTTP request might be someone else than memberId.
    // What cats may the requester see? Could be more, if is admin; or fewer, if,
    // say, memberId is an admin, and the requester is a moderator, and there are
    // admin-only categories.

    val categoriesRequesterMaySee = dao.listMaySeeCategoriesAllSections(
          inclDeleted = false, request.authzContext)

    // ----- Merge the cat lists

    val (
      categoriesBothMaySee: Seq[Category],
      categoriesOnlyRequesterMaySee: Seq[Category]) =
          categoriesRequesterMaySee.partition(c => categoryIdsMemberMaySee.contains(c.id))

    val groups = dao.getGroupsReqrMaySee(requester)

    OkSafeJson(Json.obj(  // OwnPageNotfPrefs
      "id" -> memberId,
      "myCatsTagsSiteNotfPrefs" -> JsArray(myCatsTagsSiteNotfPrefs.map(JsPageNotfPref)),
      "groupsCatsTagsSiteNotfPrefs" -> JsArray(groupsCatsTagsSiteNotfPrefs.map(JsPageNotfPref)),
      "categoriesMaySee" -> categoriesBothMaySee.map(JsCategoryInclDetails),
      "categoriesMayNotSee" -> categoriesOnlyRequesterMaySee.map(JsCategoryInclDetails),
      "groups" -> groups.map(JsGroup)))
  }


  def saveMemberPrivacyPrefs: Action[JsValue] = PostJsonAction(RateLimits.ConfigUser,
        MinAuthnStrength.EmbeddingStorageSid12,
        // Look at Typescript interface PrivacyPrefs — it's around 500 chars, so 1000
        // should be ok for a while.
        maxBytes = 1000, ignoreAlias = true) { request =>
    val userId = parseInt32(request.body, "userId")
    val prefs: MemberPrivacyPrefs = JsX.memberPrivacyPrefsFromJson(request.body)
    _quickThrowUnlessMayEditPrefs(userId, request.theRequester)
    request.dao.saveMemberPrivacyPrefsIfAuZ(forUserId = userId, prefs, byWho = request.who)

    val patJson = _loadPatJsonById(userId, request)
    OkSafeJson(Json.obj("patNoStatsNoGroupIds" -> patJson))
  }


  private def _quickThrowUnlessMayEditPrefs(userId: UserId, requester: Participant): Unit = {
    // There's a check elsewhere  [mod_0_conf_adm] that mods cannot change admins' preferences.
    val staffOrSelf = requester.isStaff || requester.id == userId
    throwForbiddenIf(!staffOrSelf, "TyE5KKQSFW0", "May not edit other people's preferences")
    throwForbiddenIf(userId < LowestTalkToMemberId,
            "TyE2GKVQ", "Cannot configure preferences for this user, it's a built-in user")
    throwForbiddenIf(userId == Group.ModeratorsId,
            "TyE2GKVP", o"""Cannot configure preferences for moderators — configure for the Staff
            group instead."""")  // [0_conf_mod_priv_prefs]
  }


  def saveGuest: Action[JsValue] = StaffPostJsonAction(maxBytes = 300) { request =>
    val guestId = (request.body \ "guestId").as[UserId]
    val name = (request.body \ "name").as[String].trim
    if (name.isEmpty)
      throwForbidden("DwE4KWP9", "No name specified")

    try { request.dao.saveGuest(guestId, name = name) }
    catch {
      case DbDao.DuplicateGuest =>
        throwForbidden("DwE5KQP4", o"""There is another guest with the exact same name
            and other data. Please change the name, e.g. append "2".""")
    }

    val patJson = _loadPatJsonById(guestId, request)
    OkSafeJson(Json.obj("patNoStatsNoGroupIds" -> patJson))
  }


  def deleteUser: Action[JsValue] = PostJsonAction(RateLimits.CreateUser, maxBytes = 100) { request =>
    import request.{dao, theRequester => requester}
    val userId = (request.body \ "userId").as[UserId]
    val isOneself = userId == requester.id
    throwForbiddenIf(!isOneself && !requester.isAdmin,
      "TyE7UBQP21", "Cannot delete other user")
    val anonNNN = dao.deleteUser(userId, request.who)
    val response = OkSafeJsValue(JsString(anonNNN.username))
    // Log the user out, if hen deleted hens own account.
    if (isOneself) response.discardingCookies(context.security.DiscardingSessionCookies: _*)
    else response
  }


  private def aboutMemberPrefsFromJson(json: JsValue): AboutUserPrefs = {
    val username = (json \ "username").as[String]
    Validation.checkUsername(username) badMap { errorMessage =>
      throwBadReq("TyE44KUY0", s"Bad username: $errorMessage")
    }

    SECURITY; ANNOYING // add checks for other lengths, to avoid database constraint exceptions.
              // See if I've added all db constraints also.
              // And return 400 Bad Req if weird json instead of Internal Error
              // — use parseSt, parseOptInt32(json, "fieldName") etc.
    // Create getStringMaxLen and getOptStringMaxLen helpers?
    val about = (json \ "about").asOpt[String].trimNoneIfBlank
    if (about.exists(_.length > 1500))
      throwForbidden("EdE2QRRD40", "Too long about text, max is 1500 chars")  // db: max = 2000

    AboutUserPrefs(
      userId = (json \ "userId").as[UserId],
      fullName = (json \ "fullName").asOptStringNoneIfBlank,
      username = username,
      emailAddress = (json \ "emailAddress").as[String],
      // This one shouldn't be here: [REFACTORNOTFS] -----------
      emailPref = EmailNotfPrefs.fromInt(parseI32(json, "emailPref"))
            .getOrElse(throwBadReq("TyE5AWF603MRD", "Bade emailPref")),
      summaryEmailIntervalMins = (json \ "summaryEmailIntervalMins").asOpt[Int],
      summaryEmailIfActive = (json \ "summaryEmailIfActive").asOpt[Boolean],
      // ----------------------------------------------------
      about = (json \ "about").asOpt[String].trimNoneIfBlank,
      location = (json \ "location").asOpt[String].trimNoneIfBlank,
      url = (json \ "url").asOpt[String].trimNoneIfBlank)
  }


  private def aboutGroupPrefsFromJson(json: JsValue): AboutGroupPrefs = {
    val username = (json \ "username").as[String]
    if (username.length < MinUsernameLength)
      throwBadReq("EdE2QDP04", "Username too short")

    AboutGroupPrefs(
      groupId = (json \ "userId").as[UserId],
      fullName = (json \ "fullName").asOptStringNoneIfBlank,
      username = username,
      // This one shouldn't be here: [REFACTORNOTFS] -----------
      summaryEmailIntervalMins = (json \ "summaryEmailIntervalMins").asOpt[Int],
      summaryEmailIfActive = (json \ "summaryEmailIfActive").asOpt[Boolean])
    // ----------------------------------------------------
  }

}

