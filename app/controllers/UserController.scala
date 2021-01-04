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
import com.debiki.core.Participant.{MinUsernameLength, isGuestId}
import debiki._
import debiki.JsonUtils._
import debiki.dao.{LoadPostsResult, ReadMoreResult, SiteDao}
import debiki.EdHttp._
import ed.server.http._
import java.{util => ju}
import play.api.mvc
import play.api.libs.json._
import play.api.mvc.{Action, ControllerComponents}
import scala.util.Try
import debiki.RateLimits.TrackReadingActivity
import ed.server.{EdContext, EdController}
import ed.server.auth.Authz
import javax.inject.Inject
import org.scalactic.{Bad, Good}
import talkyard.server.JsX
import talkyard.server.JsX._
import talkyard.server.p_Result
import talkyard.server.TyLogging


/** Handles requests related to users.
 */
class UserController @Inject()(cc: ControllerComponents, edContext: EdContext)
  extends EdController(cc, edContext) with TyLogging {

  import context.security.{throwNoUnless, throwIndistinguishableNotFound}
  import context.globals

  val MaxEmailsPerUser: Int = 5  // also in js [4GKRDF0]


  def listCompleteUsers(whichUsers: String): Action[Unit] = StaffGetAction { request =>
    val settings = request.dao.getWholeSiteSettings()
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

    request.dao.readOnlyTransaction { tx =>
      // Ok to load also deactivated users — the requester is staff.
      val membersAndStats = tx.loadUsersInclDetailsAndStats(peopleQuery)
      val members = membersAndStats.map(_._1)
      val reviewerIds = members.flatMap(_.reviewedById)
      val suspenderIds = members.flatMap(_.suspendedById)
      val usersById = tx.loadUsersAsMap(reviewerIds ++ suspenderIds)
      COULD // later load all groups too, for each user. Not needed now though. [2WHK7PU0]
      val usersJson = JsArray(membersAndStats.map(memberAndStats => {
        val member: UserInclDetails = memberAndStats._1
        val anyStats: Option[UserStats] = memberAndStats._2
        JsUserInclDetails(member, usersById, groups = Nil, callerIsAdmin = request.theUser.isAdmin,
          callerIsStaff = true, anyStats = anyStats)
      }))
      OkSafeJson(Json.toJson(Map("users" -> usersJson)))
    }
  }


  /** Loads a member or group, incl details, or a guest (then there are no details).
    */
  def loadUserAnyDetails(who: String): Action[Unit] = GetAction { request =>
    import request.{dao, requesterOrUnknown}
    // First try looking up by `who` as a  numeric user id. If won't work,
    // lookup by `who` as username instead.

    CLEAN_UP // make reusable   [load_pat_stats_grps]
    // Don't incl  anyUserStats  inside the member json?
    // Don't incl  groupIdsMaySee ?

    var (userJson, anyStatsJson, ppt) = Try(who.toInt).toOption match {
      case Some(id) => loadPatJsonAnyDetailsById(id, includeStats = true, request)
      case None => loadMemberOrGroupJsonInclDetailsByEmailOrUsername(
        who, includeStats = true, request)
    }
    val groupsMaySee = dao.getGroupsReqrMaySee(requesterOrUnknown)
    val pptGroupIdsMaybeRestr = dao.getOnesGroupIds(ppt)
    val pptGroupIds = pptGroupIdsMaybeRestr.filter(id => groupsMaySee.exists(g => g.id == id))
    // Maybe? No, stats is ok to show? Could possibly add another conf val, hmm.
    /*val stats =
      if (maySeeActivity(userId, request.requester, request.dao)) anyStatsJson
      else JsNull */
    userJson += "anyUserStats" -> anyStatsJson
    userJson += "groupIdsMaySee" -> JsArray(pptGroupIds.map(id => JsNumber(id)))
    OkSafeJson(Json.obj(
      "user" -> userJson,
      // COULD_OPTIMIZE: need only include user's groups — or always incl in the
      // volatile json? [305STGW2] — so need not incl here again?
      "groupsMaySee" -> groupsMaySee.map(JsGroup)))
  }


  // A tiny bit dupl code [5YK02F4]
  // Returns (pat-json, pat-stats-json, Pat)
  //
  private def loadPatJsonAnyDetailsById(userId: UserId, includeStats: Bo,
        request: DebikiRequest[_]): (JsObject, JsValue, Pat) = {
    val callerIsStaff = request.user.exists(_.isStaff)
    val callerIsAdmin = request.user.exists(_.isAdmin)
    val callerIsUserHerself = request.user.exists(_.id == userId)
    val isStaffOrSelf = callerIsStaff || callerIsUserHerself
    request.dao.readOnlyTransaction { tx =>
      val stats = includeStats ? tx.loadUserStats(userId) | None
      val (pptJson, pat) =
        if (Participant.isRoleId(userId)) {
          val memberOrGroup = tx.loadTheMemberInclDetails(userId)
          val groups = tx.loadGroups(memberOrGroup)
          val json = memberOrGroup match {
            case m: UserInclDetails =>
              JsUserInclDetails(m, Map.empty, groups, callerIsAdmin = callerIsAdmin,
                callerIsStaff = callerIsStaff, callerIsUserHerself = callerIsUserHerself)
            case g: Group =>
              jsonForGroupInclDetails(g, callerIsAdmin = callerIsAdmin,
                callerIsStaff = callerIsStaff)
          }
          (json, memberOrGroup)
        }
        else {
          val guest = tx.loadTheGuest(userId)
          val json = jsonForGuest(guest, Map.empty, callerIsStaff = callerIsStaff,
            callerIsAdmin = callerIsAdmin)
          (json, guest)
        }
      dieIf(pat.id != userId, "TyE36WKDJ03")
      (pptJson, stats.map(JsUserStats(_, isStaffOrSelf)).getOrElse(JsNull), pat.noDetails)
    }
  }


  // A tiny bit dupl code [5YK02F4]
  private def loadMemberOrGroupJsonInclDetailsByEmailOrUsername(emailOrUsername: String,
        includeStats: Boolean, request: DebikiRequest[_])
        : (JsObject, JsValue, Participant) = {
    val callerIsStaff = request.user.exists(_.isStaff)
    val callerIsAdmin = request.user.exists(_.isAdmin)

    // For now, unless admin, don't allow emails, so cannot brut-force test email addresses.
    if (emailOrUsername.contains("@") && !callerIsAdmin)
      throwForbidden("EsE4UPYW2", "Lookup by email not allowed")

    val isEmail = emailOrUsername.contains("@")
    if (isEmail)
      throwNotImplemented("EsE5KY02", "Lookup by email not implemented")

    request.dao.readOnlyTransaction { tx =>
      val memberOrGroup =
            tx.loadMemberInclDetailsByUsername(emailOrUsername) getOrElse {
        if (isEmail)
          throwNotFound("EsE4PYW20", "User not found")

        // Username perhaps changed? Then ought to update the url, browser side [8KFU24R]
        val possibleUserIds = tx.loadUsernameUsages(emailOrUsername).map(_.userId).toSet
        if (possibleUserIds.isEmpty)
          throwNotFound("EsEZ6F0U", "User not found")

        if (possibleUserIds.size > 1)
          throwNotFound("EsE4AK7B", "Many users with this username, weird")

        val userId = possibleUserIds.head

        // If the user has been deleted, don't allow looking up the anonymized profile,
        // via the old username. (This !isGone test won't be needed, if old usernames are
        // replaced with hashes. [6UKBWTA2])
        tx.loadMemberInclDetailsById(userId).filter(_ match {
          case member: UserInclDetails => !member.isGone || callerIsStaff
          case _ => true
        }) getOrElse throwNotFound("EsE8PKU02", "User not found")
      }

      val groups = tx.loadGroups(memberOrGroup)

      memberOrGroup match {
        case member: UserInclDetails =>
          val stats = includeStats ? tx.loadUserStats(member.id) | None
          val callerIsUserHerself = request.user.exists(_.id == member.id)
          val isStaffOrSelf = callerIsStaff || callerIsUserHerself
          val userJson = JsUserInclDetails(
            member, Map.empty, groups, callerIsAdmin = callerIsAdmin,
            callerIsStaff = callerIsStaff, callerIsUserHerself = callerIsUserHerself)
          (userJson, stats.map(JsUserStats(_, isStaffOrSelf)).getOrElse(JsNull), member.noDetails)
        case group: Group =>
          val groupJson = jsonForGroupInclDetails(
            group, callerIsAdmin = callerIsAdmin, callerIsStaff = callerIsStaff)
          (groupJson, JsNull, group)
      }
    }
  }


  private def jsonForGroupInclDetails(group: Group, callerIsAdmin: Bo,
        callerIsStaff: Bo = false): JsObject = {
    var json = Json.obj(   // hmm a bit dupl code [B28JG4]  also in JsGroup
      "id" -> group.id,
      "isGroup" -> JsTrue,
      //"createdAtEpoch" -> JsWhen(group.createdAt),
      "username" -> group.theUsername,
      "fullName" -> JsStringOrNull(group.name))
    if (callerIsStaff) {
      json += "summaryEmailIntervalMins" -> JsNumberOrNull(group.summaryEmailIntervalMins)
      json += "summaryEmailIfActive" -> JsBooleanOrNull(group.summaryEmailIfActive)
      json += "uiPrefs" -> group.uiPrefs.getOrElse(JsEmptyObj)
      val perms = group.perms
      json += "maxUploadBytes" -> JsNumberOrNull(perms.maxUploadBytes)
      json += "allowedUplExts" -> JsStringOrNull(perms.allowedUplExts)
    }
    json
  }


  private def jsonForGuest(user: Guest, usersById: Map[UserId, Participant],
                           callerIsStaff: Boolean, callerIsAdmin: Boolean): JsObject = {
    val safeEmail = callerIsAdmin ? user.email | hideEmailLocalPart(user.email)
    var userJson = Json.obj(
      "id" -> user.id,
      "fullName" -> user.guestName,
      "bio" -> JsStringOrNull(user.about),
      "websiteUrl" -> JsStringOrNull(user.website),
      "location" -> JsStringOrNull(user.country))
      // += ipSuspendedTill
      // += browserIdCookieSuspendedTill
    if (callerIsStaff) {
      userJson += "email" -> JsString(safeEmail)
      // += ipSuspendedAt, ById, ByUsername, Reason
      // += browserIdCookieSuspendedAt, ById, ByUsername, Reason
    }
    userJson
  }


  def listTopicsByUser(userId: UserId): Action[Unit] = GetAction { request =>
    import request.{dao, requester}

    val isStaff = requester.exists(_.isStaff)
    val isStaffOrSelf = isStaff || requester.exists(_.id == userId)
    val user = dao.getTheParticipant(userId)

    throwForbiddenIfActivityPrivate(userId, requester, dao)

    val topicsInclForbidden = dao.loadPagesByUser(
      userId, isStaffOrSelf = isStaffOrSelf, limit = 200)
    val topics = topicsInclForbidden filter { page: PagePathAndMeta =>
      dao.maySeePageUseCache(page.meta, requester, maySeeUnlisted = isStaffOrSelf)._1
    }
    ForumController.makeTopicsResponse(categoryId = None, topics, dao)
  }


  def listPostsByUser(authorId: UserId): Action[Unit] = GetAction { request: GetRequest =>
    listPostsImpl(authorId, all = false, request)
  }


  private def listPostsImpl(authorId: UserId, all: Boolean, request: GetRequest): mvc.Result = {
    import request.{dao, requester}

    request.context

    val requesterIsStaff = requester.exists(_.isStaff)
    val requesterIsStaffOrAuthor = requesterIsStaff || requester.exists(_.id == authorId)
    val author = dao.getParticipant(authorId) getOrElse throwNotFound("EdE2FWKA9", "Author not found")

    throwForbiddenIfActivityPrivate(authorId, requester, dao)

    // For now. LATER: if really many posts, generate an archive in the background.
    // And if !all, and > 100 posts, add a load-more button.
    val limit = all ? 9999 | 100

    val LoadPostsResult(postsOneMaySee, pageStuffById) =
          dao.loadPostsMaySeeByQuery(
                requester, OrderBy.MostRecentFirst, limit = limit,
                // One probably wants to see one's own not-yet-approved posts.
                inclUnapprovedPosts = requesterIsStaffOrAuthor,
                inclTitles = false, onlyEmbComments = false,
                inclUnlistedPagePosts = requesterIsStaffOrAuthor,
                writtenById = Some(authorId))

    val posts = postsOneMaySee
    val tagsByPostId = dao.readOnlyTransaction(_.loadTagsByPostId(posts.map(_.id)))

    val postsJson = posts flatMap { post =>
      val pageStuff = pageStuffById.get(post.pageId) getOrDie "EdE2KW07E"
      val pageMeta = pageStuff.pageMeta
      val tags = tagsByPostId.getOrElse(post.id, Set.empty)
      var postJson = dao.jsonMaker.postToJsonOutsidePage(post, pageMeta.pageType,
            showHidden = true, includeUnapproved = requesterIsStaffOrAuthor, tags)

      pageStuffById.get(post.pageId) map { pageStuff =>
        postJson += "pageId" -> JsString(post.pageId)
        postJson += "pageTitle" -> JsString(pageStuff.title)
        postJson += "pageRole" -> JsNumber(pageStuff.pageRole.toInt)
        if (requesterIsStaff && (post.numPendingFlags > 0 || post.numHandledFlags > 0)) {
          postJson += "numPendingFlags" -> JsNumber(post.numPendingFlags)
          postJson += "numHandledFlags" -> JsNumber(post.numHandledFlags)
        }
        postJson
      }
    }

    OkSafeJson(Json.obj(
      "author" -> JsUser(author),
      "posts" -> JsArray(postsJson)))
  }


  def downloadUsersContent(authorId: UserId): Action[Unit] = GetActionRateLimited(
        RateLimits.DownloadOwnContentArchive) { request: GetRequest =>
    // These responses can be huge; don't prettify the json.
    listPostsImpl(authorId, all = true, request)
  }


  def downloadPersonalData(userId: UserId): Action[Unit] = GetActionRateLimited(
        RateLimits.DownloaPersonalData) { request: GetRequest =>
      import request.{dao, theRequester => requester}
    throwForbiddenIf(userId != requester.id && !requester.isAdmin,
      "TyE2PKAQX8", "Cannot download someone else's data")

    val result = dao.readOnlyTransaction { tx =>
      val member: UserInclDetails = tx.loadTheUserInclDetails(userId)

      // Later: Include current ip and cookie etc, if starts remembering for each request [6LKKEZW2]
      // (It'd be found in anyStats below, not in the audit log.)
      val auditLogEntries: Seq[AuditLogEntry] =
        tx.loadAuditLogEntriesRecentFirst(userId, tyype = None, limit = 999, inclForgotten = false)
      val uniqueBrowserIdData = auditLogEntries.map(_.browserIdData).distinct
      val browserIdDataJson = uniqueBrowserIdData map { (browserIdData: BrowserIdData) =>
        Json.obj(
          "cookie" -> JsStringOrNull(browserIdData.idCookie),
          // "fingerprint" -> JsNumber(browserIdData.fingerprint),  // currently always zero
          "ip" -> JsString(browserIdData.ip))
      }

      val anyStats: Option[UserStats] = tx.loadUserStats(userId)
      val statsJson = anyStats.map(JsUserStats(_, isStaffOrSelf = true)) getOrElse JsNull

      val otherEmailAddresses =
        tx.loadUserEmailAddresses(userId).filterNot(_.emailAddress == member.primaryEmailAddress)
      val otherEmailsJson = JsArray(otherEmailAddresses.map(ea => JsString(ea.emailAddress)))

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
        "avatarImageUrl" -> JsStringOrNull(member.mediumAvatar.map(request.cdnOrSiteOrigin + _.url)),
        "trustLevel" -> JsString(member.effectiveTrustLevel.toString),
        "identities" -> identitiesJson,
        "statistics" -> statsJson,
        "browserIdDataRecentFirst" -> browserIdDataJson)
    }

    // These responses are fairly brief; ok to prettify the json.
    OkSafeJson(result, pretty = true)
  }


  private def throwForbiddenIfActivityPrivate(userId: UserId, requester: Option[Participant], dao: SiteDao): Unit = {
    throwForbiddenIf(!maySeeActivity(userId, requester, dao),
      "TyE4JKKQX3", "Not allowed to list activity for this user")
  }


  private def maySeeActivity(userId: UserId, requester: Option[Participant], dao: SiteDao): Boolean = {
    // Guests cannot hide their activity. One needs to create a real account.
    if (!Participant.isMember(userId))
      return true

    // Staff and the user henself can view hens activity.
    if (requester.exists(r => r.isStaff || r.id == userId))
      return true

    val memberInclDetails = dao.loadTheMemberInclDetailsById(userId)
    memberInclDetails.seeActivityMinTrustLevel match {
      case None => true
      case Some(minLevel) =>
        requester.exists(_.effectiveTrustLevel.toInt >= minLevel.toInt)
    }
  }


  def loadUserEmailsLogins(userId: UserId): Action[Unit] = GetAction { request =>
    loadUserEmailsLoginsImpl(userId, request)
  }


  private def loadUserEmailsLoginsImpl(userId: UserId, request: DebikiRequest[_]): mvc.Result = {
    import request.{dao, theRequester => requester}
    // Could refactor and break out functions. Later some day maybe.

    throwForbiddenIf(requester.id != userId && !requester.isAdmin,
      "EdE5JKWTDY2", "You may not see someone elses email addresses")

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
      Json.obj(  // Typescript: UserAccountLoginMethod
        // COULD instead use: JsIdentity  ?
        "loginType" -> classNameOf(identity),
        "provider" -> idpName,
        "idpAuthUrl" -> idpAuthUrl,
        "idpUsername" -> idpUsername,
        "idpUserId" -> idpUserId,
        "idpEmailAddr" -> JsStringOrNull(emailAddr))
    })

    if (memberInclDetails.passwordHash.isDefined) {
      loginMethodsJson :+= Json.obj(  // UserAccountLoginMethod
        "loginType" -> "LocalPwd",
        "provider" -> "Password",
        "idpUsername" -> memberInclDetails.username,
        "idpEmailAddr" -> memberInclDetails.primaryEmailAddress)
    }

    if (memberInclDetails.ssoId.isDefined) {
      // Tests: sso-login-member  TyT5HNATS20P.TyTE2ESSOLGIMS
      loginMethodsJson :+= Json.obj(  // UserAccountLoginMethod
        "loginType" -> "TySsoApi",
        "provider" -> "Talkyard Single Sign-On API",
        "idpEmailAddr" -> memberInclDetails.primaryEmailAddress,
        "idpUserId" -> JsStringOrNull(memberInclDetails.ssoId))
    }

    OkSafeJson(Json.obj(  // UserAccountResponse
      "emailAddresses" -> emailsJson,
      "loginMethods" -> loginMethodsJson))
  }


  def setPrimaryEmailAddresses: Action[JsValue] =
        PostJsonAction(RateLimits.AddEmailLogin, maxBytes = 300) { request =>
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


  def addUserEmail: Action[JsValue] = PostJsonAction(RateLimits.AddEmailLogin, maxBytes = 300) {
        request =>
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
        RateLimits.ConfirmEmailAddress, maxBytes = 300) { request =>

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

    val email = createEmailAddrVerifEmailDontSend(member, request, emailAddress, isNewAddr = false)

    BUG; RACE // If the server crashes here, the email won't get sent. [EMAILTX]
    globals.sendEmail(email, dao.siteId)

    loadUserEmailsLoginsImpl(userId, request)
  }



  private def createEmailAddrVerifEmailDontSend(user: UserInclDetails, request: DebikiRequest[_],
                                                newEmailAddress: String, isNewAddr: Boolean): Email = {

    import context.globals, request.dao
    val (siteName, origin) = dao.theSiteNameAndOrigin()
    val host = request.host

    val emailId = Email.generateRandomId()

    // A bit dupl code. Break out simplifying fn? Or reuse the other fn? [4CUJQT4]
    val safeEmailAddrVerifUrl =
      globals.originOf(host) +
        routes.UserController.confirmOneMoreEmailAddress(
          emailId) // safe, generated by the server

    val email = Email.newWithId(
      emailId,
      EmailType.VerifyAddress,
      createdAt = globals.now(),
      sendTo = newEmailAddress,
      toUserId = Some(user.id),
      subject = s"[$siteName] Confirm your email address",
      bodyHtmlText =
        views.html.confirmOneMoreEmailAddressEmail(
          siteAddress = host,
          username = user.username,
          emailAddress = newEmailAddress,
          isNewAddr = isNewAddr,
          safeVerificationUrl = safeEmailAddrVerifUrl,
          expirationTimeInHours = 1,
          globals).body)

    dao.saveUnsentEmail(email)
    email
  }


  def confirmOneMoreEmailAddress(confirmationEmailId: String): Action[Unit] =
        GetActionAllowAnyoneRateLimited(RateLimits.ConfirmEmailAddress) { request =>
    import request.{dao, requester}

    // A bit dupl code. [4KDPREU2] Break out verifyEmailAddr() fn, place in UserDao.

    val email = dao.loadEmailById(confirmationEmailId) getOrElse {
      throwForbidden("EdE1WRB20", "Link expired? Or bad email id.")
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

      val addrVerified = userEmailAddr.copy(verifiedAt = Some(now))
      tx.updateUserEmailAddress(addrVerified)

      // Admins can mark someone's primary email as *not* verified, and send another verif email.
      // So, although the user already has an account, we might be verifying the primary email again.
      val verifiedPrimary =
        member.primaryEmailAddress == userEmailAddr.emailAddress && member.emailVerifiedAt.isEmpty

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

    // What do now? Let's redirect to the user's email list.
    // But maybe the user is not currently logged in? I don't think hen should get logged in
    // just by clicking the link. Maybe this isn't supposed to be an email address hen wants
    // to be able to login with.

    val needsToLogin = requester.isEmpty && dao.getWholeSiteSettings().loginRequired

    val emailsPath = requester.isDefined ? "/preferences/account" | ""  // [4JKT28TS]
    CSP_MISSING
    Ok(views.html.emailVerified(
        SiteTpi(request),
        userProfileUrl = s"/-/users/${member.username}$emailsPath",
        needsToLogin = needsToLogin))
  }


  def removeUserEmail: Action[JsValue] = PostJsonAction(RateLimits.AddEmailLogin, maxBytes = 300) {
        request =>
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
    request.dao.blockGuest(postId, numDays = numDays, threatLevel, blockerId = request.theUserId)
    Ok
  }


  def unblockGuest: Action[JsValue] = StaffPostJsonAction(maxBytes = 100) { request =>
    val postId = (request.body \ "postId").as[PostId]
    request.dao.unblockGuest(postId, unblockerId = request.theUserId)
    Ok
  }


  /** If not staff, returns a summary only.
    */
  def loadAuthorBlocks(postId: Int): Action[Unit] = GetAction { request =>
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
      !page.meta.isDeleted && dao.maySeePageUseCache(page.meta, Some(requester))._1
    }
    val redirectToUrl = latestTopic.map(_.path.value) getOrElse "/"
    TemporaryRedirect(redirectToUrl)
  }


  def viewUserPage(whatever: String): Action[Unit] = AsyncGetAction { request =>
    val htmlStr = views.html.templates.users(SiteTpi(request)).body
    ViewPageController.addVolatileJsonAndPreventClickjacking2(htmlStr,
      unapprovedPostAuthorIds = Set.empty, request)
  }


  def loadMyPageData(pageId: PageId): Action[Unit] = GetAction { request =>
    val json = loadMyPageDataImpl(request, pageId)
    OkSafeJson(json)
  }


  private def loadMyPageDataImpl(request: ApiRequest[_], pageId: PageId): JsValue = {
    import request.dao
    val pageMeta = request.dao.getPageMeta(pageId) getOrElse {
      // Might be an embedded comment page, not yet created because no comments posted.
      // Or we might be in the signup-to-become-owner step, when creating a new site.
      return dao.jsonMaker.userNoPageToJson(request)
    }

    val pagePath = request.dao.getPagePath(pageId) getOrElse {
      // The page was apparently deleted some microseconds ago.
      return dao.jsonMaker.userNoPageToJson(request)
    }

    val (maySee, _) = request.dao.maySeePageUseCache(pageMeta, request.user)
    if (!maySee)
      return dao.jsonMaker.userNoPageToJson(request)

    val pageRequest = new PageRequest(
      request.site,
      sid = request.sid,
      xsrfToken = request.xsrfToken,
      browserId = request.browserId,
      user = request.user,
      pageExists = true,
      pagePath = pagePath,
      pageMeta = Some(pageMeta),
      altPageId = None,
      embeddingUrl = None,
      dao = request.dao,
      request = request.request)

    val json =
      if (pageRequest.user.isDefined) {
        val renderedPage = request.dao.renderPageMaybeUseMemCache(pageRequest)
        dao.jsonMaker.userDataJson(pageRequest, renderedPage.unapprovedPostAuthorIds).getOrDie(
          "EdE4ZBXKG")
      }
      else {
        val everyonesPerms = request.dao.getPermsForEveryone()
        val everyoneGroup = request.dao.getTheGroup(Group.EveryoneId)
        dao.jsonMaker.noUserSpecificData(everyonesPerms, everyoneGroup)
      }

    json
  }


  def trackReadingProgress: Action[JsValue] = PostJsonAction(RateLimits.TrackReadingActivity,
        maxBytes = 1000) { request =>
    import request.{dao, theRequester}
    val readMoreResult = trackReadingProgressImpl(request, request.body)
    val result =
      if (readMoreResult.numMoreNotfsSeen == 0) JsNull
      else {
        // Posts related to some notifications were seen. Update the notifications, client side,
        // so they'll get un-highlighted, since the posts they are about, have now been seen.

        // dupl line [8AKBR0]
        val notfsAndCounts = dao.loadNotificationsSkipReviewTasks(
          theRequester.id, upToWhen = None, request.who, unseenFirst = true, limit = 20)

        // dupl code [7KABR20]
        Json.obj(
          "numTalkToMeNotfs" -> notfsAndCounts.numTalkToMe,
          "numTalkToOthersNotfs" -> notfsAndCounts.numTalkToOthers,
          "numOtherNotfs" -> notfsAndCounts.numOther,
          "thereAreMoreUnseenNotfs" -> notfsAndCounts.thereAreMoreUnseen,
          "notifications" -> notfsAndCounts.notfsJson)
      }

    OkSafeJson(result)
  }


  /** In the browser, navigator.sendBeacon insists on sending plain text. So need this text handler.
    */
  def trackReadingProgressText: Action[String] = PostTextAction(RateLimits.TrackReadingActivity,
        maxBytes = 1000) { request =>
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
    import ed.server.{WhenFormat, OptWhenFormat}

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

    request.dao.pubSub.userIsActive(request.siteId, requester, request.theBrowserIdData)

    if (anyPageReadingProgress.isDefined) {
      // This visit happened on an article / discussion page.
      dieIf(anyPageId.isEmpty, "TyE7KAKR25")
      dao.trackReadingProgressClearNotfsPerhapsPromote(
        requester, anyPageId.get, pagePostNrIdsRead.map(_.postId).toSet, anyPageReadingProgress.get)
    }
    else {
      // This visit happened on an admin page or user profile page.
      dao.rememberVisit(requester, lastVisitedAt = now)
    }
  }


  def markTourTipsSeen: Action[JsValue] = PostJsonAction(RateLimits.TrackReadingActivity,
        maxBytes = 200) { request =>
    import request.{dao, body, theRequester => requester}
    val tourTipsIdSeen = (body \ "tourTipsId").as[JsString].value
    anyTourTipsIdError(tourTipsIdSeen) foreach EdHttp.throwBadRequest
    dao.rememberTourTipsSeen(requester, Some(Vector(tourTipsIdSeen)))
    Ok
  }

  def loadNotifications(userId: UserId, upToWhenMs: Long): Action[Unit] =
        GetActionRateLimited(RateLimits.ExpensiveGetRequest) { request =>
    loadNotificationsImpl(userId, upToWhen = None, request)
  }


  def loadNotificationsImpl(userId: UserId, upToWhen: Option[When], request: DebikiRequest[_])
        : mvc.Result = {
    val notfsAndCounts = request.dao.loadNotificationsSkipReviewTasks(userId, upToWhen, request.who)
    OkSafeJson(notfsAndCounts.notfsJson)
  }


  def markAllNotfsAsSeen(): Action[JsValue] = PostJsonAction(RateLimits.MarkNotfAsSeen, 200) {
        request =>
    request.dao.markAllNotfsAsSeen(request.theUserId)
    loadNotificationsImpl(request.theUserId, upToWhen = None, request)
  }


  def markNotificationAsSeen(): Action[JsValue] = PostJsonAction(RateLimits.MarkNotfAsSeen, 200) {
        request =>
    import request.{dao, theRequesterId}
    val notfId = (request.body \ "notfId").as[NotificationId]
    dao.markNotificationAsSeen(theRequesterId, notfId)
    Ok
  }


  def snoozeNotifications(): Action[JsValue] =
          PostJsonAction(RateLimits.ConfigUser, 200) { request =>
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


  def saveContentNotfPref: Action[JsValue] = PostJsonAction(RateLimits.ConfigUser, maxBytes = 500) {
        request =>
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

    if (newNotfLevel.isDefined) {
      dao.savePageNotfPref(newPref, request.who)
    }
    else {
      dao.deletePageNotfPref(newPref, request.who)
    }

    OkSafeJson(
      EmbeddedCommentsPageCreator.makeAnyNewPageJson(newEmbPage))
  }


  def loadGroups: Action[Unit] = GetActionRateLimited(RateLimits.ReadsFromDb) { request =>
    val groups = request.dao.getGroupsAndStatsReqrMaySee(request.requesterOrUnknown)
    OkSafeJson(JsArray(groups map JsGroupAndStats))
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


  def listGroupMembers(groupId: UserId): Action[Unit] =
        GetActionRateLimited(RateLimits.ReadsFromDb) { request =>
    val maybeMembers = request.dao.listGroupMembersIfReqrMaySee(groupId, request.requesterOrUnknown)
    val membersJson: JsValue = maybeMembers.map(ms => JsArray(ms map JsUser)).getOrElse(JsFalse)
    OkSafeJson(membersJson)
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


  SECURITY // don't allow if user listing disabled, & isn't staff [8FKU2A4]
  def listAllUsers(usernamePrefix: String): Action[Unit] = GetAction { request =>
    // Authorization check: Is a member? Add MemberGetAction?
    request.theMember

    val json = listAllUsersImpl(usernamePrefix, request)
    OkSafeJson(json)
  }


  SECURITY // user listing disabled? [8FKU2A4]
  def listMembersPubApi(usernamePrefix: String, usersOnly: Boolean)
        : Action[Unit] = GetAction { request =>
    // Allowed also if not logged in — so can use from a non-Talkyard client,
    // without any API secret.
    throwForbiddenIf(!request.siteSettings.enableApi,
      "TyE4305RKCGL4", o"""API not enabled. If you're admin, you can enable it
         in the Admin Area | Settings | Features tab.""")
    val json = listAllUsersImpl(usernamePrefix, request)
    dieIf(!usersOnly, "TyE206KTTR4")  // else: return a 'groups:...' or 'members:' field
    OkApiJson(
      // [PUB_API] Wrap in an obj, so, later on, we can add more things (fields)
      // to the response, without breaking existing API consumers. E.g. some type of
      // cursor for iterating through all members.
      Json.obj(
        "users" -> json))
  }


  private def listAllUsersImpl(usernamePrefix: String, request: ApiRequest[_]): JsArray = {
    // Also load deleted anon12345 members. Simpler, and they'll typically be very few or none. [5KKQXA4]
    // ... stop doing that?
    val members = request.dao.loadUsersWithUsernamePrefix(
      usernamePrefix, caseSensitive = false, limit = 50)
    JsArray(
      members map { member =>
        // [PUB_API] .ts: ListUsersApiResponse, ListGroupsApiResponse, ListMembersApiResponse
        Json.obj(
          "id" -> member.id,
          "username" -> member.username,
          "fullName" -> member.fullName)
      })
  }


  /** Listing usernames on a particular page is okay, if one may see the page
    * — however, listing all usernames for the whole site, isn't always okay. [8FKU2A4]
    */
  def listUsernames(pageId: PageId, prefix: String): Action[Unit] = GetAction { request =>
    import request.dao

    val pageMeta = dao.getPageMeta(pageId) getOrElse throwIndistinguishableNotFound("EdE4Z0B8P5")
    val categoriesRootLast = dao.getAncestorCategoriesRootLast(pageMeta.categoryId)

    SECURITY // Later: skip authors of hidden / deleted / whisper posts.  [whispers]
    // Or if some time in the future there will be "hidden" accounts  [hdn_acts]
    // — someone who don't want strangers and new members to see hens profile —
    // then, would need to exclude those accounts here.

    throwNoUnless(Authz.maySeePage(
      pageMeta, request.user, dao.getGroupIdsOwnFirst(request.user),
      dao.getAnyPrivateGroupTalkMembers(pageMeta), categoriesRootLast,
      tooManyPermissions = dao.getPermsOnPages(categoriesRootLast)), "EdEZBXKSM2")

    // Also load deleted anon12345 members. Simpler, and they'll typically be very few or none. [5KKQXA4]
    val names = dao.listUsernames(
      pageId = pageId, prefix = prefix, caseSensitive = false, limit = 50)

    val json = JsArray(
      names map { nameAndUsername =>
        Json.obj(
          "id" -> nameAndUsername.id,
          "username" -> nameAndUsername.username,
          "fullName" -> nameAndUsername.fullName)
      })
    OkSafeJson(json)
  }


  /** maxBytes = 3000 because the about text might be fairly long.
    */
  def saveAboutMemberPrefs: Action[JsValue] = PostJsonAction(RateLimits.ConfigUser,
        maxBytes = 3000) { request =>
    val prefs = aboutMemberPrefsFromJson(request.body)
    throwUnlessMayEditPrefs(prefs.userId, request.theRequester)
    request.dao.saveAboutMemberPrefs(prefs, request.who)

    // Try to reuse: [load_pat_stats_grps]
    val (patJson, _, _) = loadPatJsonAnyDetailsById(
          prefs.userId, includeStats = false, request)
    OkSafeJson(Json.obj("patNoStatsNoGroupIds" -> patJson))
  }


  def saveAboutGroupPreferences: Action[JsValue] = PostJsonAction(RateLimits.ConfigUser,
        maxBytes = 3000) { request =>
    import request.{dao, theRequester => requester}
    val prefs = aboutGroupPrefsFromJson(request.body)
    if (!requester.isAdmin)
      throwForbidden("EdE5PYKW0", "Only admins may change group prefs, right now")
    dao.saveAboutGroupPrefs(prefs, request.who)

    // Try to reuse: [load_pat_stats_grps]
    val (patJson, _, _) = loadPatJsonAnyDetailsById(
          prefs.groupId, includeStats = false, request)
    OkSafeJson(Json.obj("patNoStatsNoGroupIds" -> patJson))
  }


  def savePatPerms: Action[JsValue] = AdminPostJsonAction2(RateLimits.ConfigUser,
        maxBytes = 1000) { request =>
    import request.{body, dao, siteId}
    val patId = parseI32(body, "patId")
    val perms: PatPerms = JsX.parsePatPerms(body, siteId)
    dao.savePatPerms(patId, perms, request.who)

    // Try to reuse: [load_pat_stats_grps]
    val (patJson, _, _) = loadPatJsonAnyDetailsById(patId, includeStats = false, request)
    OkSafeJson(Json.obj("patNoStatsNoGroupIds" -> patJson))
  }


  def saveUiPreferences: Action[JsValue] = PostJsonAction(RateLimits.ConfigUser,
        maxBytes = 3000) { request =>
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


  def loadMembersCatsTagsSiteNotfPrefs(memberId: Int): Action[Unit] = GetAction { request =>
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

    val authContextForMember = dao.getForumAuthzContext(Some(member))

    val categoriesMemberMaySee = dao.listMaySeeCategoriesAllSections(
      includeDeleted = false, authContextForMember)

    val categoryIdsMemberMaySee = categoriesMemberMaySee.map(_.id)  // (or use a set?)

    val categoriesRequesterMaySee = dao.listMaySeeCategoriesAllSections(
      includeDeleted = false, request.authzContext)

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
        maxBytes = 100) { request =>
    val prefs: MemberPrivacyPrefs = memberPrivacyPrefsFromJson(request.body)
    throwUnlessMayEditPrefs(prefs.userId, request.theRequester)
    request.dao.saveMemberPrivacyPrefs(prefs, request.who)

    // Try to reuse: [load_pat_stats_grps]
    val (patJson, _, _) = loadPatJsonAnyDetailsById(
          prefs.userId, includeStats = false, request)
    OkSafeJson(Json.obj("patNoStatsNoGroupIds" -> patJson))
  }


  private def throwUnlessMayEditPrefs(userId: UserId, requester: Participant): Unit = {
    // There's a check elsewhere  [mod_0_conf_adm] that mods cannot
    // change admins' preferences.
    val staffOrSelf = requester.isStaff || requester.id == userId
    throwForbiddenIf(!staffOrSelf, "TyE5KKQSFW0", "May not edit other people's preferences")
    throwForbiddenIf(userId < LowestTalkToMemberId,
      "TyE2GKVQ", "Cannot configure preferences for this user, it's a built-in user")
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

    // Try to reuse: [load_pat_stats_grps]
    val (patJson, _, _) = loadPatJsonAnyDetailsById(
          guestId, includeStats = false, request)
    OkSafeJson(Json.obj("patNoStatsNoGroupIds" -> patJson))
  }


  def deleteUser: Action[JsValue] = PostJsonAction(RateLimits.CreateUser, maxBytes = 100) { request =>
    import request.{dao, theRequester => requester}
    val userId = (request.body \ "userId").as[UserId]
    val isOneself = userId == requester.id
    throwForbiddenIf(!isOneself && !requester.isAdmin,
      "TyE7UBQP21", "Cannot delete other user")
    val anonNNN = dao.deleteUser(userId, request.who)
    val response = OkSafeJson(JsString(anonNNN.username))
    // Log the user out, if hen deleted hens own account.
    if (isOneself) response.discardingCookies(context.security.DiscardingSessionCookie)
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


  private def memberPrivacyPrefsFromJson(json: JsValue): MemberPrivacyPrefs = {
    val anySeeActivityInt = (json \ "seeActivityMinTrustLevel").asOpt[Int]
    MemberPrivacyPrefs(
      userId = (json \ "userId").as[UserId],
      seeActivityMinTrustLevel = anySeeActivityInt.flatMap(TrustLevel.fromInt))
  }

}

