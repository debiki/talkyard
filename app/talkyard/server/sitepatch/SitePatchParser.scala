/**
 * Copyright (c) 2015-2019 Kaj Magnus Lindberg
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

package talkyard.server.sitepatch

import com.debiki.core
import com.debiki.core.Prelude._
import com.debiki.core.PageParts.MaxTitleLength
import com.debiki.core._
import com.debiki.dao.rdb.PostsSiteDaoMixin
import debiki.JsonUtils._
import debiki._
import debiki.EdHttp._
import ed.server._
import java.{util => ju}
import org.scalactic._
import play.api.libs.json._
import scala.collection.mutable
import scala.collection.immutable
import scala.util.Try
import talkyard.server.JsX


/** Imports and exports dumps of websites.
  *
  * Currently: json only. Later: json + files in a .tar.gz.
  * Or msgpack? http://msgpack.org/index.html — but probably no big reason to use it
  * (disk space savings are small, and it makes debugging harder: unreadable files).
  * Don't use bson.
  *
  * Search for [readlater] for stuff ignored right now.
  */
case class SitePatchParser(context: EdContext) {

  import context.globals
  import context.security
  import context.safeActions.ExceptionAction

  val MaxBytes = 1001000


  def parseDumpJsonMaybeThrowBadRequest(siteId: Option[SiteId], bodyJson: JsValue, simpleFormat: Boolean,
          isE2eTest: Boolean): SitePatch = {
    try {
      if (simpleFormat) parseSimpleSitePatch(siteId getOrDie "TyE045ASDKH3", bodyJson)
      else parseSiteJson(bodyJson, isE2eTest = isE2eTest)
    }
    catch {
      case ex: JsonUtils.BadJsonException =>
        throwBadRequest("EsE4GYM8", "Bad json structure: " + ex.getMessage)
      case ex: IllegalArgumentException =>
        // Some case class constructor failure.
        throwBadRequest("EsE7BJSN4", o"""Invalid values, or combinations of values,
           in the uploaded json: ${ex.getMessage}""")
    }
  }


  private def parseSimpleSitePatch(siteId: SiteId, bodyJson: JsValue): SitePatch = {
    val (categoriesJson, pagesJson, postJson, anyUpsertOptionsJson) =
      try { // (this extra try...catch is for better error messages)
        // Only categories.
        // Right now, all people have asked for, is to upsert categories
        // (via /-/v0/upsert-simple ).
        (readJsArray(bodyJson, "categories", optional = true),
          readJsArray(bodyJson, "pages", optional = true),
          readJsArray(bodyJson, "posts", optional = true),
          readOptJsObject(bodyJson, "upsertOptions"))
      }
      catch {
        case ex: IllegalArgumentException =>
          throwBadRequest("TyE306TMRT2", s"Invalid json: ${ex.getMessage}")
      }

    val categoryPatches = categoriesJson.value.zipWithIndex map { case (json, index) =>
      readCategoryOrBad(json, mustBePatch = true, isE2eTest = false).getOrIfBad(error =>
        throwBadReq(
          "TyE205KTSK2", o"""Invalid category json at index $index in the 'categories' list: $error,
              json: $json"""))
      match {
        case Left(c: Category) => die("TyE0662TKSR")
        case Right(p: CategoryPatch) => p
      }
    }

    val pagePatches: Seq[SimplePagePatch] = pagesJson.value.zipWithIndex map { case (json, index) =>
      readSimplePagePatchOrBad(json).getOrIfBad(error =>
        throwBadReq(
          "TyE8KXLMT43", o"""Invalid SimplePagePatch json at
              index $index in the 'pages' list: $error, json: $json"""))
    }

    val postPatches: Seq[SimplePostPatch] = postJson.value.zipWithIndex map { case (json, index) =>
      readSimplePostPatchOrBad(json).getOrIfBad(error =>
        throwBadReq(
          "TyE5WKVJ025", o"""Invalid SimplePostPatch json at
              index $index in the 'posts' list: $error, json: $json"""))
    }

    val upsertOptions = anyUpsertOptionsJson map { json =>
      UpsertOptions(
        sendNotifications = readOptBool(json, "sendNotifications"))
    }

    val simplePatch = SimpleSitePatch(
      upsertOptions,
      categoryPatches.toVector,
      pagePatches.toVector,
      postPatches.toVector)

    val dao = context.globals.siteDao(siteId)
    val completePatch = simplePatch.loadThingsAndMakeComplete(dao) getOrIfBad { errorMessage =>
      throwBadRequest("TyE05JKRVHP8", s"s$siteId: Error interpreting patch: $errorMessage")
    }

    throwForbiddenIf(completePatch.hasManyThings && upsertOptions.exists(_.sendNotifications is true),
      "TyEUPSMNYNTFS_", o"""Cannot send notifications when upserting many posts and pages etcetera
        (more than one or two at a time) — that could cause problematically many notifications?""")

    completePatch
  }


  def parseSiteJson(bodyJson: JsValue, isE2eTest: Boolean): SitePatch = {
    import collection.immutable.Seq

    // When importing API secrets has been impl **EDIT: NOT DONE** then upd this test:
    // sso-all-ways-to-login.2browsers.test.ts  [5ABKR2038]  so it imports
    // an API secret (then, get to test the import-secrets code, + the test gets faster).

    val (siteMetaJson, settingsJson, apiSecretsJson,
        guestsJson, anyGuestEmailPrefsJson, groupsJson, groupPpsJson,
        usersJson, pptStatsJson, ppVisitStatsJson, usernameUsagesJson, identitiesJson,
        invitesJson, notificationsJson, memberEmailAddressesJson, pageNotfPrefsJson) =
      try {
        (readOptJsObject(bodyJson, "meta"),
          readOptJsObject(bodyJson, "settings"),
          readJsArray(bodyJson, "apiSecrets", optional = true),
          readJsArray(bodyJson, "guests", optional = true),
          readOptJsObject(bodyJson, "guestEmailPrefs"),
          readJsArray(bodyJson, "groups", optional = true),
          readJsArray(bodyJson, "groupPps", optional = true),
          readJsArray(bodyJson, "members", optional = true),   // RENAME to "users"
          readJsArray(bodyJson, "ppStats", optional = true),
          readJsArray(bodyJson, "ppVisitStats", optional = true),
          readJsArray(bodyJson, "usernameUsages", optional = true),
          readJsArray(bodyJson, "identities", optional = true),
          readJsArray(bodyJson, "invites", optional = true),
          readJsArray(bodyJson, "notifications", optional = true),
          readJsArray(bodyJson, "memberEmailAddresses", optional = true),
          readJsArray(bodyJson, "pageNotfPrefs", optional = true))
      }
      catch {
        case ex: IllegalArgumentException =>
          throwBadRequest("EsE6UJM2", s"Invalid json: ${ex.getMessage}")
      }

    // Need to split into this 2nd  ( ... ) = try { ... }  because max 22 elems in a tuple.

    val (permsOnPagesJson, pagesJson, pathsJson, pageIdsByAltIdsJson,
        pagePopularityScoresJson, pageParticipantsJson,
        categoriesJson, draftsJson, postsJson, postActionsJson, reviewTasksJson,
        isTestSiteOkDelete, isTestSiteIndexAnyway) =
      try {
        (readJsArray(bodyJson, "permsOnPages", optional = true),
          readJsArray(bodyJson, "pages", optional = true),
          readJsArray(bodyJson, "pagePaths", optional = true),
          readOptJsObject(bodyJson, "pageIdsByAltIds") getOrElse JsObject(Nil),  // RENAME to "pageIdsByLookupKeys"
          readJsArray(bodyJson, "pagePopularityScores", optional = true),
          readJsArray(bodyJson, "pageParticipants", optional = true),
          readJsArray(bodyJson, "categories", optional = true),
          readJsArray(bodyJson, "drafts", optional = true),
          readJsArray(bodyJson, "posts", optional = true),
          readJsArray(bodyJson, "postActions", optional = true),
          readJsArray(bodyJson, "reviewTasks", optional = true),
          readOptBool(bodyJson, "isTestSiteOkDelete").getOrElse(false),
          readOptBool(bodyJson, "isTestSiteIndexAnyway").getOrElse(false))
      }
      catch {
        case ex: IllegalArgumentException =>
          throwBadRequest("TyE6UJGKT03", s"Invalid json: ${ex.getMessage}")
      }

    val siteToSave: Option[SiteInclDetails] =
      try siteMetaJson.map(readSiteMeta)
      catch {
        case ex: IllegalArgumentException =>
          throwBadRequest("TyE50%KS26", s"Invalid 'site' object json: ${ex.getMessage}")
      }

    val settings = settingsJson.map(Settings2.settingsToSaveFromJson(_, globals))

    val apiSecrets: Seq[ApiSecret] = apiSecretsJson.value.zipWithIndex map {
          case (json, index) =>
      readApiSecretOrBad(json).getOrIfBad(errorMessage =>
        throwBadReq(
          "TyE305KTW5", o"""Invalid ApiSecret json at index $index
            in the 'apiSecrets' list: $errorMessage, json: $json"""))
    } toVector

    val guestEmailPrefs: Map[String, EmailNotfPrefs] = anyGuestEmailPrefsJson.map({ // [GSTPRFS]
          json =>
      val emailsAndPrefs = json.fields.map(emailAddrAndPrefJsVal => {
        val email = emailAddrAndPrefJsVal._1
        val prefsJson = emailAddrAndPrefJsVal._2
        prefsJson match {
          case JsNumber(value) =>
            val pref = EmailNotfPrefs.fromInt(value.toInt) getOrElse {
              throwBadRequest("TyE205WMTD1", s"Invalid email notf prefs integer value: $value")
            }
            email -> pref
          case x => throwBadRequest(
            "TyE506NP2", o"""Bad email notf pref value for email address $email: "$prefsJson"
            has type: ${classNameOf(x)}""")
        }
      })
      Map(emailsAndPrefs: _*)
    }) getOrElse Map.empty

    val guests: Seq[Guest] = guestsJson.value.toVector.zipWithIndex map { case (json, index) =>
      readGuestOrBad(json, guestEmailPrefs, isE2eTest).getOrIfBad(errorMessage =>
        throwBadReq(
          "EsE0GY72", o"""Invalid guest json at index $index in the 'guests' list: $errorMessage,
                json: $json"""))
    }

    val groups: Seq[Group] = groupsJson.value.toVector.zipWithIndex map { case (json, index) =>
      readGroupOrBad(json).getOrIfBad(errorMessage =>
        throwBadReq(
          "TyE603KHUR6", o"""Invalid Group json at index $index in the 'groups' list:
              $errorMessage, json: $json"""))
    }

    val groupParticipants: Seq[GroupParticipant] = groupPpsJson.value.toVector.zipWithIndex map {
          case (json, index) =>
      readGroupParticipantOrBad(json).getOrIfBad(errorMessage =>
        throwBadReq(
          "TyE5RKTGF03", o"""Invalid GroupParticipant json at index $index
              in the 'groupPps' list: $errorMessage, json: $json"""))
    }

    val users: Seq[UserInclDetails] = usersJson.value.toVector.zipWithIndex map { case (json, index) =>
      readUserOrBad(json, isE2eTest).getOrIfBad(errorMessage =>
          throwBadReq(
            "TyE06KWT24", o"""Invalid user json at index $index in the 'users' list: $errorMessage,
                json: $json"""))
    }

    val ppStats: Seq[UserStats] = pptStatsJson.value.toVector.zipWithIndex map { case (json, index) =>
      readPptStatsOrBad(json, isE2eTest).getOrIfBad(errorMessage =>
        throwBadReq(
          "TyE76K0RKD2", o"""Invalid UserStats json at index $index in the 'ppStats' list: $errorMessage,
                json: $json"""))
    }

    val ppVisitStats:  Seq[UserVisitStats] = ppVisitStatsJson.value.toVector.zipWithIndex map {
          case (json, index) =>
      readPpVisitStatsOrBad(json, isE2eTest).getOrIfBad(errorMessage =>
        throwBadReq(
          "TyE4WKT02S", o"""Invalid UserVisitStats json at index $index
            in the 'ppVisitStats' list: $errorMessage, json: $json"""))
    }

    val usernameUsages: Seq[UsernameUsage] = usernameUsagesJson.value.toVector.zipWithIndex map { case (json, index) =>
      readUsernameUsageOrBad(json, isE2eTest).getOrIfBad(errorMessage =>
        throwBadReq(
          "TyE5RKTUG05", o"""Invalid UsernameUsage json at index $index in
               the 'usernameUsages' list: $errorMessage, json: $json"""))
    }

    val memberEmailAddrs: Seq[UserEmailAddress] = memberEmailAddressesJson.value.toVector.zipWithIndex map { case (json, index) =>
      readMemberEmailAddrOrBad(json, isE2eTest).getOrIfBad(errorMessage =>
        throwBadReq(
          "TyE20UWKD45", o"""Invalid UserEmailAddress json at index $index in
               the 'memberEmailAddresses' list: $errorMessage, json: $json"""))
    }

    val identities: Seq[Identity] = identitiesJson.value.toVector.zipWithIndex map { case (json, index) =>
      readIdentityOrBad(json, isE2eTest).getOrIfBad(errorMessage =>
          throwBadReq(
            "TyE5KD2PJ", o"""Invalid Identity json at index $index in
              the 'identities' list: $errorMessage, json: $json"""))
    }

    val invites: Seq[Invite] = invitesJson.value.toVector.zipWithIndex map { case (json, index) =>
      readInviteOrBad(json, isE2eTest).getOrIfBad(errorMessage =>
        throwBadReq(
          "TyE783RKTWP3", o"""Invalid invite json at index $index in
             the 'invites' list: $errorMessage, json: $json"""))
    }

    val notifications: Seq[Notification] = notificationsJson.value.toVector.zipWithIndex map { case (json, index) =>
      readNotfOrBad(json, isE2eTest).getOrIfBad(errorMessage =>
        throwBadReq(
          "TyE60KRTD3", o"""Invalid Notification json at index $index in
             the 'notifications' list: $errorMessage, json: $json"""))
    }

    val pages: Seq[PageMeta] = pagesJson.value.toVector.zipWithIndex map { case (json, index) =>
      readPageOrBad(json, isE2eTest).getOrIfBad(errorMessage =>
        throwBadReq(
          "TyE402GKB0", o"""Invalid PageMeta json at index $index
            in the 'pages' list: $errorMessage json: $json"""))
    }

    val paths: Seq[PagePathWithId] = pathsJson.value.toVector.zipWithIndex map { case (json, index) =>
      readPagePathOrBad(json, isE2eTest).getOrIfBad(error =>
        throwBadReq(
          "Ese55GP1", o"""Invalid page path json at index $index in the 'pagePaths' list: $error,
              json: $json"""))
    }

    val pageIdsByAltIds: Map[AltPageId, PageId] = Map(pageIdsByAltIdsJson.fields map {
      case (altId, pageIdJs) =>
        pageIdJs match {
          case JsString(value) =>
            SECURITY; SHOULD // verify id and value are ok, no weird chars or blanks?  [05970KF5]
            // Review this for all imported things b.t.w.:  exd ids,  sso id,  emb urls,  page ids.
            // And verify not too many, per page — see:
            Validation.MaxDiscussionIdsAndEmbUrlsPerPage
            altId -> value
          case x => throwBadRequest(
            "TyE406TNW2", s"For alt page id '$altId', the page id is invalid: '$x'")
        }
    }: _*)

    val pagePopularityScores: Seq[PagePopularityScores] =
          pagePopularityScoresJson.value.toVector.zipWithIndex map {
      case (json, index) =>
        readPagePopularityScoresOrBad(json).getOrIfBad(errorMessage =>
          throwBadReq(
            "TyE703KUTTU25", o"""Invalid PagePopularityScores json at index $index in
               the 'pagePopularityScores' list: $errorMessage, json: $json"""))
    }

    val pageNotfPrefs: Seq[PageNotfPref] = pageNotfPrefsJson.value.toVector.zipWithIndex map {
          case (json, index) =>
      readPageNotfPrefOrBad(json, isE2eTest).getOrIfBad(errorMessage =>
        throwBadReq(
          "TyE5WKTU025", o"""Invalid PageNotfPref json at index $index in
               the 'pageNotfPrefs' list: $errorMessage, json: $json"""))
    }


    val pageParticipants: Seq[PageParticipant] = pageParticipantsJson.value.toVector.zipWithIndex map {
      case (json, index) =>
        readPageParticipantOrBad(json).getOrIfBad(errorMessage =>
          throwBadReq(
            "TyE703RKVH295", o"""Invalid PageParticipant json at index $index in
             the 'pageParticipants' list: $errorMessage, json: $json"""))
    }

    val categoryPatches = mutable.ArrayBuffer[CategoryPatch]()
    val categories = mutable.ArrayBuffer[Category]()

    categoriesJson.value.zipWithIndex foreach { case (json, index) =>
      readCategoryOrBad(json, mustBePatch =  false, isE2eTest).getOrIfBad(error =>
        throwBadReq(
          "EsE5PYK2", o"""Invalid category json at index $index in the 'categories' list: $error,
              json: $json"""))
        match {
          case Left(c: Category) => categories.append(c)
          case Right(p: CategoryPatch) => categoryPatches.append(p)
        }
    }

    val drafts: Seq[Draft] = draftsJson.value.toVector.zipWithIndex map {
      case (json, index) =>
        readDraftOrBad(json).getOrIfBad(errorMessage =>
          throwBadReq(
            "TyE70KSTUD6Z", o"""Invalid Draft json at index $index in
             the 'drafts' list: $errorMessage, json: $json"""))
    }


    val posts: Seq[Post] = postsJson.value.toVector.zipWithIndex map { case (json, index) =>
      readPostOrBad(json, isE2eTest).getOrIfBad(error =>
        throwBadReq(
          "TyE205KUD24", o"""Invalid Post json at index $index
            in the 'posts' list: $error, json: $json"""))
    }

    val postActions: Seq[PostAction] = postActionsJson.value.toVector.zipWithIndex map { case (json, index) =>
      readPostActionOrBad(json, isE2eTest).getOrIfBad(error =>
        throwBadReq(
          "TyE205KRU", o"""Invalid PostActio json at index $index in
              the 'postActions' list: $error, json: $json"""))
    }

    val permsOnPages: Seq[PermsOnPages] = permsOnPagesJson.value.toVector.zipWithIndex map {
          case (json, index) =>
      readPermsOnPageOrBad(json, isE2eTest).getOrIfBad(error =>
        throwBadReq(
          "TyE50RTG4", o"""Invalid PermsOnPage json at index $index in the 'permsOnPage' list:
              $error, json: $json"""))
    }

    val reviewTasks: Seq[ReviewTask] = reviewTasksJson.value.toVector.zipWithIndex map {
          case (json, index) =>
      readReivewTaskOrBad(json, isE2eTest).getOrIfBad(error =>
        throwBadReq(
          "TyE7JGL3K0J", o"""Invalid ReviewTask json at index $index in the 'reviewTasks' list:
              $error, json: $json"""))
    }

    SitePatch(upsertOptions = None, siteToSave, settings, apiSecrets,
      guests, guestEmailPrefs, groups,
      groupParticipants,
      users, ppStats, ppVisitStats, usernameUsages, memberEmailAddrs,
      identities, invites, notifications,
      categoryPatches.toVector, categories.toVector,
      pages, paths, pageIdsByAltIds, pagePopularityScores,
      pageNotfPrefs, pageParticipants,
      drafts, posts, postActions, permsOnPages, reviewTasks,
      isTestSiteOkDelete = isTestSiteOkDelete,
      isTestSiteIndexAnyway = isTestSiteIndexAnyway)
  }




  def readSiteMeta(jsObject: JsObject): SiteInclDetails = {
    val name = readString(jsObject, "name")

    val hostnamesJson = (jsObject \ "hostnames").asOpt[Seq[JsObject]].getOrElse(Nil)
    val hostnames: Seq[HostnameInclDetails] = {
      val hs = hostnamesJson.map(JsX.readJsHostnameInclDetails)
      if (hs.isEmpty) {
        val localHostname = readOptString(jsObject, "localHostname") getOrElse {
          throw new BadJsonException(s"Neither hostnames nor localHostname specified [TyE2KF4Y8]")
        }
        val fullHostname = s"$localHostname.${globals.baseDomainNoPort}"
        Seq(HostnameInclDetails(fullHostname, Hostname.RoleCanonical, addedAt = globals.now()))
      }
      else hs
    }

    val siteStatusInt = readInt(jsObject, "status")
    val siteStatus = SiteStatus.fromInt(siteStatusInt) getOrElse {
      throwBadRequest("EsE6YK2W4", s"Bad site status int: $siteStatusInt")
    }

    SiteInclDetails(
      id = NoSiteId,
      pubId = readOptString(jsObject, "pubId") getOrElse Site.newPublId(),
      status = siteStatus,
      name = name,
      createdAt = readWhen(jsObject, "createdAtMs"),
      createdFromIp = None,
      creatorEmailAddress = None,
      nextPageId = readInt(jsObject, "nextPageId"),
      quotaLimitMbs = None,
      version = readInt(jsObject, "version"),
      hostnames = hostnames.toList)
  }


  def readApiSecretOrBad(jsValue: JsValue): ApiSecret Or ErrorMessage  = {
    val jsObj = jsValue match {
      case x: JsObject => x
      case bad =>
        return Bad(s"ApiSecret is not a json object, but a: " + classNameOf(bad))
    }

    try {
      Good(ApiSecret(
        nr = readInt(jsObj, "nr"),
        userId = readOptInt(jsObj, "userId"),
        createdAt = readWhen(jsObj, "createdAt"),
        deletedAt = readOptWhen(jsObj, "deletedAt"),
        isDeleted = readBoolean(jsObj, "isDeleted"),
        secretKey = readString(jsObj, "secretKey")))
    }
    catch {
      case ex: IllegalArgumentException =>
        Bad(s"Bad json for ApiSecret: ${ex.getMessage}")
    }
  }


  def readGuestOrBad(jsValue: JsValue, guestEmailPrefs: Map[String, EmailNotfPrefs], isE2eTest: Boolean)
        : Guest Or ErrorMessage = {
    val jsObj = jsValue match {
      case x: JsObject => x
      case bad =>
        return Bad(s"Guest json is not an object, but a: " + classNameOf(bad))
    }
    val id = try readInt(jsObj, "id") catch {
      case ex: IllegalArgumentException =>
        return Bad(s"Invalid guest id: " + ex.getMessage)
    }

    try {
      val email = readOptString(jsObj, "emailAddress").trimNoneIfBlank
      Good(Guest(
        id = id,
        extId = readOptString(jsObj, "extId") orElse readOptString(jsObj, "extImpId"),
        createdAt = readWhen(jsObj, "createdAtMs"),
        guestName = readOptString(jsObj, "fullName").getOrElse(""),  // RENAME? to  guestName?
        guestBrowserId = readOptString(jsObj, "guestBrowserId"),
        email = email getOrElse "",
        // Any value here, would get ignored. Instead, when finding a guest's email notf pref,
        // we load guests' email notf prefs from another json object [GSTPRFS] and the
        // guest_prefs3 db table — which works also if a human returns later and gets
        // a different guest user account but uses the same email address.
        emailNotfPrefs = EmailNotfPrefs.Unspecified,
        country = readOptString(jsObj, "country").trimNoneIfBlank,
        lockedThreatLevel = readOptInt(jsObj, "lockedThreatLevel").flatMap(ThreatLevel.fromInt)))
    }
    catch {
      case ex: IllegalArgumentException =>
        Bad(s"Bad json for guest id $id: ${ex.getMessage}")
    }
  }


  def readIdentityOrBad(jsValue: JsValue, isE2eTest: Boolean): Identity Or ErrorMessage = {
    val jsObj = jsValue match {
      case x: JsObject => x
      case bad =>
        return Bad(s"Identity entry is not a json object, but a: " + classNameOf(bad))
    }

    val identityId: IdentityId = try readString(jsObj, "identityId") catch {
      case ex: IllegalArgumentException =>
        return Bad(s"Invalid identity id: " + ex.getMessage)
    }

    try {
      val identityType = readString(jsObj, "identityType")
      if (identityType != "OAuth") {
        return Bad("Only OpenAuth identities supported right now [TyE06@T32]")
      }
      val oauDetails = OpenAuthDetails(
        providerId = readString(jsObj, "providerId"),
        providerKey = readString(jsObj, "providerKey"),
        firstName = readOptString(jsObj, "firstName"),
        lastName = readOptString(jsObj, "lastName"),
        fullName = readOptString(jsObj, "fullName"),
        email = readOptString(jsObj, "email"),  // RENAME to emailAddr?
        avatarUrl = readOptString(jsObj, "avatarUrl"))
      val identity = OpenAuthIdentity(
        id = identityId,
        userId = readInt(jsObj, "userId"),
        openAuthDetails = oauDetails)
      Good(identity)
    }
    catch {
      case ex: IllegalArgumentException =>
        Bad(s"Bad json for identity id $identityId': ${ex.getMessage}")
    }
  }


  def readGroupOrBad(jsValue: JsValue): Group Or ErrorMessage = {
    val jsObj = jsValue match {
      case x: JsObject => x
      case bad =>
        return Bad(s"Group json is not an object, but a: " + classNameOf(bad))
    }
    val id = try readInt(jsObj, "id") catch {
      case ex: IllegalArgumentException =>
        return Bad(s"Invalid group id: " + ex.getMessage)
    }
    try {
      val grantsTrustLevelInt = readOptInt(jsObj, "grantsTrustLevel")
      val grantsTrustLevel = grantsTrustLevelInt map { levelInt =>
        TrustLevel.fromInt(levelInt) getOrElse {
          return Bad(s"Bad trust level: $grantsTrustLevelInt")
        }
      }
      Good(Group(
        id = id,
        theUsername = readString(jsObj, "username"),
        name = readOptString(jsObj, "fullName"),
        // RENAME to extId here and everywhere else ... Done, can soon remove 'orElse ...'.
        extId = readOptString(jsObj, "extId") orElse readOptString(jsObj, "extImpId"),
        createdAt = readWhen(jsObj, "createdAtMs"),
        tinyAvatar = None,   // [readlater] Option[UploadRef]  "avatarTinyHashPath"
        smallAvatar = None,  // [readlater] Option[UploadRef]
        summaryEmailIntervalMins = readOptInt(jsObj, "summaryEmailIntervalMins"),
        summaryEmailIfActive = readOptBool(jsObj, "summaryEmailIfActive"),
        grantsTrustLevel = grantsTrustLevel,
        uiPrefs = (jsObj \ "uiPrefs").asOpt[JsObject]))
    }
    catch {
      case ex: IllegalArgumentException =>
        Bad(s"Bad json for group id $id: ${ex.getMessage}")
    }
  }


  def readGroupParticipantOrBad(jsValue: JsValue): GroupParticipant Or ErrorMessage = {
    val jsObj = jsValue match {
      case x: JsObject => x
      case bad =>
        return Bad(s"GroupParticipant is not a json object, but a: " + classNameOf(bad))
    }

    val groupId = try readInt(jsObj, "groupId") catch {
      case ex: IllegalArgumentException =>
        return Bad(s"Invalid GroupParticipant group id: " + ex.getMessage)
    }

    try {
      Good(GroupParticipant(
        groupId = groupId,
        ppId = readInt(jsObj, "ppId"),
        isMember = readBoolean(jsObj, "isMember"),
        isManager = readBoolean(jsObj, "isManager"),
        isAdder = readBoolean(jsObj, "isAdder"),
        isBouncer = readBoolean(jsObj, "isBouncer")))
    }
    catch {
      case ex: IllegalArgumentException =>
        Bad(s"Bad json for GroupParticipant id $groupId': ${ex.getMessage}")
    }
  }


  def readUserOrBad(jsValue: JsValue, isE2eTest: Boolean): UserInclDetails Or ErrorMessage = {
    val jsObj = jsValue match {
      case x: JsObject => x
      case bad =>
        return Bad(s"User list entry is not a json object, but a: " + classNameOf(bad))
    }

    val id = try readInt(jsObj, "id") catch {
      case ex: IllegalArgumentException =>
        return Bad(s"Invalid user id: " + ex.getMessage)
    }
    val username = try readString(jsObj, "username") catch {
      case ex: IllegalArgumentException =>
        return Bad(s"Invalid username: " + ex.getMessage)
    }

    try {
      val passwordHash = readOptString(jsObj, "passwordHash")
      passwordHash.foreach(security.throwIfBadPassword(_, isE2eTest))
      Good(UserInclDetails(
        id = id,
        ssoId = readOptString(jsObj, "ssoId") orElse
          // deprecated [395KSH20]
          readOptString(jsObj, "externalId"),
        extId = readOptString(jsObj, "extId"),
        username = username,
        fullName = readOptString(jsObj, "fullName"),
        createdAt = readWhen(jsObj, "createdAtMs"),
        isApproved = readOptBool(jsObj, "isApproved"),
        reviewedAt = readOptDateMs(jsObj, "approvedAtMs"),  // [exp] RENAME to reviewdAt
        reviewedById = readOptInt(jsObj, "approvedById"),
        primaryEmailAddress = readString(jsObj, "emailAddress").trim,
        emailNotfPrefs = readEmailNotfsPref(jsObj).getOrElse(EmailNotfPrefs.Unspecified),
        emailVerifiedAt = readOptDateMs(jsObj, "emailVerifiedAtMs"),
        mailingListMode = readOptBool(jsObj, "mailingListMode") getOrElse false,
        summaryEmailIntervalMins = readOptInt(jsObj, "summaryEmailIntervalMins"),
        summaryEmailIfActive = readOptBool(jsObj, "summaryEmailIfActive"),
        passwordHash = passwordHash,
        country = readOptString(jsObj, "country"),
        website = readOptString(jsObj, "website"),
        about = readOptString(jsObj, "about"),
        seeActivityMinTrustLevel = readOptInt(jsObj, "seeActivityMinTrustLevel").flatMap(TrustLevel.fromInt),
        tinyAvatar = None, // [readlater]
        smallAvatar = None, // [readlater]
        mediumAvatar = None, // [readlater]
        uiPrefs = None,   // [readlater]
        isOwner = readOptBool(jsObj, "isOwner") getOrElse false,
        isAdmin = readOptBool(jsObj, "isAdmin") getOrElse false,
        isModerator = readOptBool(jsObj, "isModerator") getOrElse false,
        trustLevel = readOptInt(jsObj, "trustLevel").flatMap(TrustLevel.fromInt)
                      .getOrElse(TrustLevel.NewMember),
        lockedTrustLevel = readOptInt(jsObj, "lockedTrustLevel").flatMap(TrustLevel.fromInt),
        threatLevel = readOptInt(jsObj, "threatLevel").flatMap(ThreatLevel.fromInt)
                        .getOrElse(ThreatLevel.HopefullySafe),
        lockedThreatLevel = readOptInt(jsObj, "lockedThreatLevel").flatMap(ThreatLevel.fromInt),
        suspendedAt = readOptDateMs(jsObj, "suspendedAtMs"),
        suspendedTill = readOptDateMs(jsObj, "suspendedTillMs"),
        suspendedById = readOptInt(jsObj, "suspendedById"),
        suspendedReason = readOptString(jsObj, "suspendedReason"),
        deactivatedAt = readOptWhen(jsObj, "deactivatedAt"),
        deletedAt = readOptWhen(jsObj, "deletedAt")))
    }
    catch {
      case ex: IllegalArgumentException =>
        Bad(s"Bad json for user id $id, username '$username': ${ex.getMessage}")
    }
  }


  def readPptStatsOrBad(jsValue: JsValue, isE2eTest: Boolean): UserStats Or ErrorMessage = {
    val jsObj = jsValue match {
      case x: JsObject => x
      case bad =>
        return Bad(s"UserStats entry is not a json object, but a: " + classNameOf(bad))
    }

    val userId = try readInt(jsObj, "userId") catch {
      case ex: IllegalArgumentException =>
        return Bad(s"Invalid UserStats user id: " + ex.getMessage)
    }

    val tourTipsSeen = (jsObj \ "tourTipsSeen").asOpt[immutable.Seq[TourTipsId]]

    try {
      Good(UserStats(
        userId = userId,
        lastSeenAt = readWhen(jsObj, "lastSeenAt"),
        lastPostedAt = readOptWhen(jsObj, "lastPostedAt"),
        lastEmailedAt = readOptWhen(jsObj, "lastEmailedAt"),
        lastSummaryEmailAt = readOptWhen(jsObj, "lastSummaryEmailAt"),
        nextSummaryEmailAt = readOptWhen(jsObj, "nextSummaryEmailAt"),
        emailBounceSum = readFloat(jsObj, "emailBounceSum"),
        firstSeenAtOr0 = readWhen(jsObj, "firstSeenAt"),
        firstNewTopicAt = readOptWhen(jsObj, "firstNewTopicAt"),
        firstDiscourseReplyAt = readOptWhen(jsObj, "firstDiscourseReplyAt"),
        firstChatMessageAt = readOptWhen(jsObj, "firstChatMessageAt"),
        topicsNewSince = readWhen(jsObj, "topicsNewSince"),
        notfsNewSinceId = readInt(jsObj, "notfsNewSinceId"),
        numDaysVisited = readInt(jsObj, "numDaysVisited"),
        numSecondsReading = readInt(jsObj, "numSecondsReading"),
        numDiscourseRepliesRead = readInt(jsObj, "numDiscourseRepliesRead"),
        numDiscourseRepliesPosted = readInt(jsObj, "numDiscourseRepliesPosted"),
        numDiscourseTopicsEntered = readInt(jsObj, "numDiscourseTopicsEntered"),
        numDiscourseTopicsRepliedIn = readInt(jsObj, "numDiscourseTopicsRepliedIn"),
        numDiscourseTopicsCreated = readInt(jsObj, "numDiscourseTopicsCreated"),
        numChatMessagesRead = readInt(jsObj, "numChatMessagesRead"),
        numChatMessagesPosted = readInt(jsObj, "numChatMessagesPosted"),
        numChatTopicsEntered = readInt(jsObj, "numChatTopicsEntered"),
        numChatTopicsRepliedIn = readInt(jsObj, "numChatTopicsRepliedIn"),
        numChatTopicsCreated = readInt(jsObj, "numChatTopicsCreated"),
        numLikesGiven = readInt(jsObj, "numLikesGiven"),
        numLikesReceived = readInt(jsObj, "numLikesReceived"),
        numSolutionsProvided = readInt(jsObj, "numSolutionsProvided"),
        tourTipsSeen = tourTipsSeen,
        mayBeNegative = false))
    }
    catch {
      case ex: IllegalArgumentException =>
        Bad(s"Bad json for UserStats for user id $userId: ${ex.getMessage}")
    }
  }


  def readPpVisitStatsOrBad(jsValue: JsValue, isE2eTest: Boolean): UserVisitStats Or ErrorMessage  = {
    val jsObj = jsValue match {
      case x: JsObject => x
      case bad =>
        return Bad(s"UserVisitStats is not a json object, but a: " + classNameOf(bad))
    }

    val ppId = try readInt(jsObj, "userId") catch {
      case ex: IllegalArgumentException =>
        return Bad(s"Invalid UserVisitStats user id: " + ex.getMessage)
    }

    try {
      Good(UserVisitStats(
        userId = ppId,
        visitDate = readWhenDay(jsObj, "visitDate"),
        numSecondsReading = readInt(jsObj, "numSecondsReading"),
        numDiscourseRepliesRead = readInt(jsObj, "numDiscourseRepliesRead"),
        numDiscourseTopicsEntered = readInt(jsObj, "numDiscourseTopicsEntered"),
        numChatMessagesRead = readInt(jsObj, "numChatMessagesRead"),
        numChatTopicsEntered = readInt(jsObj, "numChatTopicsEntered")))
    }
    catch {
      case ex: IllegalArgumentException =>
        Bad(s"Bad json for UserVisitStats id $ppId': ${ex.getMessage}")
    }
  }


  def readUsernameUsageOrBad(json: JsValue, isE2eTest: Boolean): UsernameUsage Or ErrorMessage  = {
    val jsObj = json match {
      case x: JsObject => x
      case bad =>
        return Bad(s"UsernameUsage is not a json object, but a: " + classNameOf(bad))
    }

    try {
      Good(UsernameUsage(
        usernameLowercase = readString(jsObj, "usernameLowercase"),
        inUseFrom = readWhen(jsObj, "inUseFrom"),
        inUseTo = readOptWhen(jsObj, "inUseTo"),
        userId = readInt(jsObj, "userId"),
        firstMentionAt = readOptWhen(jsObj, "firstMentionAt")))
    }
    catch {
      case ex: IllegalArgumentException =>
        Bad(s"Bad json for UsernameUsage: ${ex.getMessage}")
    }
  }


  def readMemberEmailAddrOrBad(json: JsValue, isE2eTest: Boolean): UserEmailAddress Or ErrorMessage  = {
    val jsObj = json match {
      case x: JsObject => x
      case bad =>
        return Bad(s"UserEmailAddress is not a json object, but a: " + classNameOf(bad))
    }
    try {
      Good(UserEmailAddress(
        userId = readInt(jsObj, "userId"),
        emailAddress = readString(jsObj, "emailAddress"),
        addedAt = readWhen(jsObj, "addedAt"),
        verifiedAt = readOptWhen(jsObj, "verifiedAt")))
    }
    catch {
      case ex: IllegalArgumentException =>
        Bad(s"Bad json for UserEmailAddress: ${ex.getMessage}")
    }
  }


  def readPagePopularityScoresOrBad(jsValue: JsValue): PagePopularityScores Or ErrorMessage  = {
    val jsObj = jsValue match {
      case x: JsObject => x
      case bad =>
        return Bad(s"PagePopularityScores is not a json object, but a: " + classNameOf(bad))
    }

    val pageId = try readString(jsObj, "pageId") catch {
      case ex: IllegalArgumentException =>
        return Bad(s"Invalid PagePopularityScores page id: " + ex.getMessage)
    }

    try {
      Good(PagePopularityScores(
        pageId = pageId,
        updatedAt = readWhen(jsObj, "updatedAt"),
        algorithmVersion = readInt(jsObj, "algorithmVersion"),
        dayScore = readFloat(jsObj, "dayScore"),
        weekScore = readFloat(jsObj, "weekScore"),
        monthScore = readFloat(jsObj, "monthScore"),
        quarterScore = readFloat(jsObj, "quarterScore"),
        yearScore = readFloat(jsObj, "yearScore"),
        allScore = readFloat(jsObj, "allScore")))
    }
    catch {
      case ex: IllegalArgumentException =>
        Bad(s"Bad json for PagePopularityScore page id $pageId': ${ex.getMessage}")
    }
  }


  def readPageNotfPrefOrBad(json: JsValue, isE2eTest: Boolean): PageNotfPref Or ErrorMessage  = {
    val jsObj = json match {
      case x: JsObject => x
      case bad =>
        return Bad(s"PageNotfPref is not a json object, but a: " + classNameOf(bad))
    }
    try {
      val notfLevelInt = readInt(jsObj, "notfLevel")
      val notfLevel = NotfLevel.fromInt(notfLevelInt) getOrElse {
        return Bad(s"Not a notf level: $notfLevelInt")
      }
      Good(PageNotfPref(
        peopleId = readInt(jsObj, "memberId"),
        notfLevel = notfLevel,
        pageId = readOptString(jsObj, "pageId"),
        pagesInCategoryId = readOptInt(jsObj, "pagesInCategoryId"),
        //pagesWithTagLabelId: Option[TagLabelId] = None, — later
        wholeSite = readOptBool(jsObj, "wholeSite").getOrElse(false)))
    }
    catch {
      case ex: IllegalArgumentException =>
        Bad(s"Bad json for PageNotfPref: ${ex.getMessage}")
    }
  }


  def readPageParticipantOrBad(jsValue: JsValue): PageParticipant Or ErrorMessage  = {
    val jsObj = jsValue match {
      case x: JsObject => x
      case bad =>
        return Bad(s"PageParticipant is not a json object, but a: " + classNameOf(bad))
    }

    val ppId = try readInt(jsObj, "userId") catch {
      case ex: IllegalArgumentException =>
        return Bad(s"Invalid PageParticipant user id: " + ex.getMessage)
    }

    try {
      val anyReadingProgress =
          readOptJsObject(jsObj, "readingProgress").map(jsObj => PageReadingProgress(
        firstVisitedAt = readWhen(jsObj, "firstVisitedAt"),
        lastVisitedAt = readWhen(jsObj, "lastVisitedAt"),
        lastViewedPostNr = readInt(jsObj, "lastViewedPostNr"),
        lastReadAt = readOptWhen(jsObj, "lastReadAt"),
        lastPostNrsReadRecentFirst =
          (jsObj \ "lastPostNrsReadRecentFirst").as[Vector[PostNr]],
        lowPostNrsRead =
          (jsObj \ "lowPostNrsRead").as[Set[PostNr]],
        secondsReading = readInt(jsObj, "secondsReading")))

      Good(PageParticipant(
        pageId = readString(jsObj, "pageId"),
        userId = ppId,
        addedById = readOptInt(jsObj, "addedById"),
        removedById = readOptInt(jsObj, "removedById"),
        inclInSummaryEmailAtMins = readInt(jsObj, "inclInSummaryEmailAtMins"),
        readingProgress = anyReadingProgress))
    }
    catch {
      case ex: IllegalArgumentException =>
        Bad(s"Bad json for PageParticipant id $ppId': ${ex.getMessage}")
    }
  }


  def readInviteOrBad(json: JsValue, isE2eTest: Boolean): Invite Or ErrorMessage  = {
    val jsObj = json match {
      case x: JsObject => x
      case bad =>
        return Bad(s"Invite is not a json object, but a: " + classNameOf(bad))
    }
    try {
      val addToGroupsJsArr = (jsObj \ "addToGroupIds").asOpt[Seq[UserId]]
      val addToGroupIds: Set[UserId] = addToGroupsJsArr.getOrElse(Nil).toSet
      Good(Invite(
        emailAddress = readString(jsObj, "invitedEmailAddress"),
        startAtUrl = readOptString(jsObj, "startAtUrl"),
        addToGroupIds = addToGroupIds,
        secretKey = readString(jsObj, "secretKey"),
        createdById = readInt(jsObj, "invitedById"),
        createdAt = readDateMs(jsObj, "invitedAt"),
        acceptedAt = readOptDateMs(jsObj, "acceptedAt"),
        userId = readOptInt(jsObj, "becameUserId"),
        deletedAt = readOptDateMs(jsObj, "deletedAt"),
        deletedById = readOptInt(jsObj, "deletedById"),
        invalidatedAt = readOptDateMs(jsObj, "invalidatedAt")))
    }
    catch {
      case ex: IllegalArgumentException =>
        Bad(s"Bad json for Invite: ${ex.getMessage}")
    }
  }


  def readNotfOrBad(json: JsValue, isE2eTest: Boolean): Notification Or ErrorMessage  = {
    val jsObj = json match {
      case x: JsObject => x
      case bad =>
        return Bad(s"Notification is not a json object, but a: " + classNameOf(bad))
    }
    val notfId = try readInt(jsObj, "id") catch {
      case ex: IllegalArgumentException =>
        return Bad(s"Invalid Notification id: " + ex.getMessage)
    }
    try {
      val notfTypeInt = readInt(jsObj, "notfType")
      val notfType = NotificationType.fromInt(notfTypeInt) getOrElse {
        return Bad(s"Bad notf type: $notfTypeInt")
      }
      val notfEmailStatusInt = readInt(jsObj, "emailStatus")
      val notfEmailStatus =  NotfEmailStatus.fromInt(notfEmailStatusInt) getOrElse {
        return Bad(s"Bad not email status: $notfEmailStatusInt")
      }
      Good(Notification.NewPost(
        notfType,
        id = notfId,
        createdAt = readDateMs(jsObj, "createdAtMs"),
        uniquePostId = readInt(jsObj, "postId"),
        byUserId = readInt(jsObj, "byUserId"),
        toUserId = readInt(jsObj, "toUserId"),
        emailId = readOptString(jsObj, "emailId"), // OOPS, FK :- (
        emailStatus = notfEmailStatus,
        seenAt = readOptDateMs(jsObj, "seenAt")))
    }
    catch {
      case ex: IllegalArgumentException =>
        Bad(s"Bad json for Notification: ${ex.getMessage}")
    }
  }


  def readPageOrBad(jsValue: JsValue, isE2eTest: Boolean): PageMeta Or ErrorMessage = {
    val jsObj = jsValue match {
      case x: JsObject => x
      case bad =>
        return Bad(s"Not a json object, but a: " + classNameOf(bad))
    }

    val id = try readString(jsObj, "id") catch {
      case ex: IllegalArgumentException =>
        return Bad(s"Invalid page id: " + ex.getMessage)
    }
    if (!id.isOkVariableName && id.toIntOption.isEmpty) {
      return Bad(s"Invalid page id '$id': not a number and not an ok variable name [TyE2ABD04]")
    }

    val frequentPosterIds =
      try {
        (jsValue \ "frequentPosterIds").asOpt[Seq[JsNumber]].getOrElse(Nil).map(_.value.toInt)
      }
      catch {
        case ex: Exception =>
          return Bad(s"On page id $id, invalid frequentPosterIds: " + ex.getMessage)
      }

    val layout: PageLayout =
      PageLayout.fromInt(readInt(jsObj, "layout", default = Some(PageLayout.Default.toInt)))
        .getOrElse(PageLayout.Default)

    try {
      Good(PageMeta(
        pageId = id,
        extImpId = readOptString(jsObj, "extId") orElse readOptString(jsObj, "extImpId"),
        pageType = PageType.fromInt(readInt(jsObj, "pageType", "role")).getOrThrowBadJson("pageType"),
        version = readInt(jsObj, "version"),
        createdAt = readDateMs(jsObj, "createdAtMs"),
        updatedAt = readDateMs(jsObj, "updatedAtMs"),
        publishedAt = readOptDateMs(jsObj, "publishedAtMs"),
        bumpedAt = readOptDateMs(jsObj, "bumpedAtMs"),
        lastApprovedReplyAt = readOptDateMs(jsObj, "lastApprovedReplyAt"),
        lastApprovedReplyById = readOptInt(jsObj, "lastApprovedReplyById"),
        categoryId = readOptInt(jsObj, "categoryId"),
        embeddingPageUrl = readOptString(jsObj, "embeddingPageUrl"),
        authorId = readInt(jsObj, "authorId"),
        frequentPosterIds = frequentPosterIds,
        layout = layout,
        pinOrder = readOptInt(jsObj, "pinOrder"),
        pinWhere = readOptInt(jsObj, "pinWhere").flatMap(PinPageWhere.fromInt),
        numLikes = readInt(jsObj, "numLikes", default = Some(0)),
        numWrongs = readInt(jsObj, "numWrongs", default = Some(0)),
        numBurys = readInt(jsObj, "numBurys", default = Some(0)),
        numUnwanteds = readInt(jsObj, "numUnwanteds", default = Some(0)),
        numRepliesVisible = readInt(jsObj, "numRepliesVisible", default = Some(0)),
        numRepliesTotal = readInt(jsObj, "numRepliesTotal", default = Some(0)),
        numPostsTotal = readInt(jsObj, "numPostsTotal", default = Some(0)),
        numOrigPostLikeVotes = readInt(jsObj, "numOrigPostLikeVotes", default = Some(0)),
        numOrigPostWrongVotes = readInt(jsObj, "numOrigPostWrongVotes", default = Some(0)),
        numOrigPostBuryVotes = readInt(jsObj, "numOrigPostBuryVotes", default = Some(0)),
        numOrigPostUnwantedVotes = readInt(jsObj, "numOrigPostUnwantedVotes", default = Some(0)),
        numOrigPostRepliesVisible = readInt(jsObj, "numOrigPostRepliesVisible", default = Some(0)),
        answeredAt = readOptDateMs(jsObj, "answeredAt"),
        answerPostId = readOptInt(jsObj, "answerPostId"),
        plannedAt = readOptDateMs(jsObj, "plannedAt"),
        startedAt = readOptDateMs(jsObj, "startedAt"),
        doneAt = readOptDateMs(jsObj, "doneAt"),
        closedAt = readOptDateMs(jsObj, "closedAt"),
        lockedAt = readOptDateMs(jsObj, "lockedAt"),
        frozenAt = readOptDateMs(jsObj, "frozenAt"),
        //unwantedAt = readOptDateMs(jsObj, "unwantedAt"),
        hiddenAt = readOptWhen(jsObj, "hiddenAt"),
        deletedAt = readOptDateMs(jsObj, "deletedAt"),
        htmlTagCssClasses = readOptString(jsObj, "htmlTagCssClasses").getOrElse(""),
        htmlHeadTitle = readOptString(jsObj, "htmlHeadTitle").getOrElse(""),
        htmlHeadDescription = readOptString(jsObj, "htmlHeadDescription").getOrElse("")))
    }
    catch {
      case ex: IllegalArgumentException =>
        Bad(s"Bad json for page id '$id': ${ex.getMessage}")
    }
  }


  def readSimplePagePatchOrBad(jsValue: JsValue): SimplePagePatch Or ErrorMessage = {
    val jsObj = jsValue match {
      case x: JsObject => x
      case bad =>
        return Bad(s"Not a SimplePagePatch json object, but a: " + classNameOf(bad))
    }

    // Try to not reject the request. [0REJREQ]
    // E.g. truncate the title to MaxTitleLength instead of replying Error.
    // Because the software (and people) that calls this API, generally expects it
    // to do "as best it can", and wouldn't understand any server response error codes.
    //
    // ... Unless an upsertOptions is { strict: true }  (unimplemented).

    try {
      val extId = readString(jsObj, "extId")
      val pageType = readOptInt(jsObj, "pageType") map { value =>
        PageType.fromInt(value).getOrThrowBadJson("pageType")
      }

      val pageMemberRefs = readJsArray(jsValue, "pageMemberRefs", optional = true).value.map {
        case JsString(ref) =>
          parseRef(ref, allowParticipantRef = true) getOrIfBad { problem =>
            return Bad(s"Bad page participant ref: '$ref', problem: $problem [TyE306WMTR6")
          }
        case v => return Bad(s"Page extId '$extId' has bad page member ref: $v  [TyE406KSTJ3]")
      }.toVector

      // Dupl code [02956KTU]
      val bodyMarkupLang = readOptString(jsObj, "bodyMarkupLang") map { langName =>
        MarkupLang.fromString(langName) getOrElse {
          return Bad(s"Unknown markup language: $langName  [TyE205AUTD3]")
        }
      }

      Good(SimplePagePatch(
        extId = extId,
        pageType = pageType,
        categoryRef = Some(readString(jsObj, "categoryRef")),
        // Better require an author name — hard to *start* requiring it in the future,
        // but easy to *stop* requiring it.
        authorRef = Some(readString(jsObj, "authorRef")),
        pageMemberRefs = pageMemberRefs,
        title = readString(jsObj, "title").take(MaxTitleLength),
        bodySource = readString(jsObj, "body"),
        bodyMarkupLang = bodyMarkupLang))
    }
    catch {
      case ex: IllegalArgumentException =>
        Bad(s"Bad SimplePagePatch json: ${ex.getMessage}")
    }
  }


  def readPagePathOrBad(jsValue: JsValue, isE2eTest: Boolean): PagePathWithId Or ErrorMessage = {
    val jsObj = jsValue match {
      case x: JsObject => x
      case bad =>
        return Bad(s"Not a json object, but a: " + classNameOf(bad))
    }

    try {
      Good(PagePathWithId(
        folder = readString(jsObj, "folder"),
        pageId = readString(jsObj, "pageId"),
        showId = readBoolean(jsObj, "showId"),
        pageSlug = readString(jsObj, "slug"),
        canonical = readBoolean(jsObj, "canonical")))
    }
    catch {
      case ex: IllegalArgumentException =>
        Bad(s"Bad page path json: ${ex.getMessage}")
    }
  }


  def readCategoryOrBad(jsValue: JsValue, mustBePatch: Boolean, isE2eTest: Boolean)
        : Either[Category, CategoryPatch] Or ErrorMessage = {
    import collection.immutable.Seq

    val jsObj = jsValue match {
      case x: JsObject => x
      case bad =>
        return Bad(s"Not a json object, but a: " + classNameOf(bad))
    }

    lazy val theId = try readInt(jsObj, "id") catch {
      case ex: IllegalArgumentException =>
        return Bad(s"Invalid category id: " + ex.getMessage)
    }

    try {
      // For now, if there's nothing but an id and an ext id, then require the id
      // to be a temp import id, and later when upserting into the db [3953KSH],
      // load the old category with that external id — not for modifying it,
      // but so we know which real category to upsert things into.
      // (But if mustBePatch, then we're in  /-/v0/upsert-simple and the fields
      // descrbe how to update/create the category.)
      if (mustBePatch || jsObj.fields.length == 2) {
        val id = readOptInt(jsObj, "id")
        val extId = readOptString(jsObj, "extId")
        val parentRef = readOptString(jsObj, "parentRef")
        val name = readOptString(jsObj, "name")
        val position = readOptInt(jsObj, "position")
        val slug = readOptString(jsObj, "slug")
        val description = readOptString(jsObj, "description")
        return Good(Right(CategoryPatch(
          id, extImpId = extId, parentRef = parentRef, name = name, slug = slug,
          description = description, position = position)))
      }

      val includeInSummariesInt = readOptInt(jsObj, "includeInSummaries")
          .getOrElse(IncludeInSummaries.Default.IntVal)
      val includeInSummaries = IncludeInSummaries.fromInt(includeInSummariesInt) getOrElse {
        return Bad(s"Invalid includeInSummaries: $includeInSummariesInt")
      }

      // ---- Remove this once only CategoryPatch above is used: [05970KF5] -----
      // (dupl code, will disappear when replacing CategoryToSave with CategoryPatch)

      require(theId != NoCategoryId, "EdE5LKAW0")

      val extId = readOptString(jsObj, "extId") orElse readOptString(jsObj, "extImpId")
      extId.flatMap(Validation.findExtIdProblem) foreach { problem =>
        return Bad(problem)
      }

      val name =  readString(jsObj, "name")
      Validation.findCategoryNameProblem(name) foreach { problem =>
        return Bad(problem)
      }

      val slug = readString(jsObj, "slug")
      Validation.findCategorySlugProblem(slug) foreach { problem =>
        return Bad(problem)
      }
      // ------------------------------------------------------------------------

      val defaultTopicType = (jsObj \ "defaultTopicType").asOpt[Int] flatMap PageType.fromInt

      Good(Left(Category(
        id = theId,
        extImpId = extId,
        sectionPageId = readString(jsObj, "sectionPageId"), // opt, use the one and only section
        parentId = readOptInt(jsObj, "parentId"),
        defaultSubCatId = readOptInt(jsObj, "defaultSubCatId", "defaultCategoryId"), // RENAME to ...SubCat...
        name = name,
        slug = slug,
        position = readOptInt(jsObj, "position") getOrElse Category.DefaultPosition,
        description = readOptString(jsObj, "description"),
        newTopicTypes = defaultTopicType.toVector, // [962MRYPG]
        unlistCategory = readOptBool(jsObj, "unlistCategory").getOrElse(false),
        unlistTopics = readOptBool(jsObj, "unlistTopics").getOrElse(false),
        includeInSummaries = includeInSummaries,
        createdAt = readDateMs(jsObj, "createdAtMs"),
        updatedAt = readDateMs(jsObj, "updatedAtMs"),
        lockedAt = readOptDateMs(jsObj, "lockedAtMs"),
        frozenAt = readOptDateMs(jsObj, "frozenAtMs"),
        deletedAt = readOptDateMs(jsObj, "deletedAtMs"))))
    }
    catch {
      case ex: IllegalArgumentException =>
        Bad(s"Bad json for page id '$theId': ${ex.getMessage}")
    }
  }


  def readDraftOrBad(jsValue: JsValue, now: Option[When] = None): Draft Or ErrorMessage = {
    val jsObj = jsValue match {
      case x: JsObject => x
      case bad =>
        return Bad(s"Not a json object, but a: " + classNameOf(bad))
    }

    val draftNr =
      try {
        (jsObj \ "draftNr").asOpt[DraftNr].getOrElse(NoDraftNr)
      }
      catch {
        case ex: IllegalArgumentException =>
          return Bad(s"Invalid draft nr: " + ex.getMessage)
      }

    val draft: Draft = try {
      val locatorJson = (jsObj \ "forWhat").asOpt[JsObject] getOrElse {
        return Bad("No draft locator: forWhat missing [TyE4AKBP250]")
      }

      val draftTypeInt = readInt(locatorJson, "draftType")
      val draftType = DraftType.fromInt(draftTypeInt) getOrElse {
        return Bad(s"Draft type not specified: ${locatorJson.toString} [TyE4AKBP2GK2]")
      }

      // This currently rejects drafts for the very first comment, on an embedded comments page
      // — because the page hasn't yet been created, so there's no page id, so no locator can
      // be constructed. UX SHOULD save draft also for this 1st blog post comment.  [BLGCMNT1]
      val draftLocator = Try(
        DraftLocator(
          draftType,
          categoryId = readOptInt(locatorJson, "categoryId"),
          toUserId = readOptInt(locatorJson, "toUserId"),
          postId = readOptInt(locatorJson, "postId"),
          pageId = readOptString(locatorJson, "pageId"),
          postNr = readOptInt(locatorJson, "postNr"))) getOrIfFailure { ex =>
        return Bad(s"Bad DraftLocator json: ${ex.getMessage} [TyE603KUTDGJ]")
      }

      Draft(
        byUserId = readInt(jsObj, "byUserId",
          // For now, because currently not always incl when upserting from editor.
          // Gets filled in by the server anyway [602KDGRE20]
          default = Some(NoUserId)),
        draftNr = draftNr,
        forWhat = draftLocator,
        createdAt =
          now getOrElse readOptWhen(jsObj, "createdAt").getOrElse(globals.now()),
        lastEditedAt =
          // However, createdAt will be used, by the db, if overwriting [5AKJWX0]
          now orElse readOptWhen(jsObj, "lastEditedAt"),
        deletedAt = readOptWhen(jsObj, "deletedAt"),
        topicType = readOptInt(jsObj, "topicType").flatMap(PageType.fromInt),
        postType = readOptInt(jsObj, "postType").flatMap(PostType.fromInt),
        title = readOptString(jsObj, "title").map(_.trim).getOrElse(""),
        text = readString(jsObj, "text").trim())
    }
    catch {
      case ex: IllegalArgumentException =>
        return Bad(s"Bad json for Draft nr '$draftNr': ${ex.getMessage}")
    }

    if (draft.text.isEmpty && draft.title.isEmpty)
      return Bad("Draft empty. Delete it instead [TyE4RBK02R9]")

    Good(draft)
  }


  def readPostOrBad(jsValue: JsValue, isE2eTest: Boolean): Post Or ErrorMessage = {
    val jsObj = jsValue match {
      case x: JsObject => x
      case bad =>
        return Bad(s"Not a json object, but a: " + classNameOf(bad))
    }

    val id = try readInt(jsObj, "id") catch {
      case ex: IllegalArgumentException =>
        return Bad(s"Invalid post id: " + ex.getMessage)
    }

    val postTypeDefaultNormal =
      PostType.fromInt(readOptInt(jsObj, "postType", "type").getOrElse(PostType.Normal.toInt))
          .getOrThrowBadJson("type")

    val deletedStatusDefaultOpen =
      new DeletedStatus(readOptInt(jsObj, "deletedStatus").getOrElse(
        DeletedStatus.NotDeleted.underlying))

    val closedStatusDefaultOpen =
      new ClosedStatus(readOptInt(jsObj, "closedStatus").getOrElse(
        ClosedStatus.Open.underlying))

    val collapsedStatusDefaultOpen =
      new CollapsedStatus(readOptInt(jsObj, "collapsedStatus").getOrElse(
        CollapsedStatus.Open.underlying))

    try {
      Good(Post(
        id = id,
        extImpId = readOptString(jsObj, "extId") orElse readOptString(jsObj, "extImpId"),
        pageId = readString(jsObj, "pageId"),
        nr = readInt(jsObj, "nr"),
        parentNr = readOptInt(jsObj, "parentNr"),
        multireplyPostNrs = Set.empty, // later
        tyype = postTypeDefaultNormal,
        createdAt = readDateMs(jsObj, "createdAtMs"),
        createdById = readInt(jsObj, "createdById"),
        currentRevisionById = readInt(jsObj, "currRevById"),
        currentRevStaredAt = readDateMs(jsObj, "currRevStartedAtMs"),
        currentRevLastEditedAt = readOptDateMs(jsObj, "currRevLastEditedAtMs"),
        currentRevSourcePatch = readOptString(jsObj, "currRevSourcePatch"),
        currentRevisionNr = readInt(jsObj, "currRevNr"),
        previousRevisionNr = readOptInt(jsObj, "prevRevNr"),
        lastApprovedEditAt = readOptDateMs(jsObj, "lastApprovedEditAtMs"),
        lastApprovedEditById = readOptInt(jsObj, "lastApprovedEditById"),
        numDistinctEditors = readInt(jsObj, "numDistinctEditors", default = Some(1)),
        safeRevisionNr = readOptInt(jsObj, "safeRevNr"),
        approvedSource = readOptString(jsObj, "approvedSource"),
        approvedHtmlSanitized = readOptString(jsObj, "approvedHtmlSanitized"),
        approvedAt = readOptDateMs(jsObj, "approvedAtMs"),
        approvedById = readOptInt(jsObj, "approvedById"),
        approvedRevisionNr = readOptInt(jsObj, "approvedRevNr"),
        collapsedStatus = collapsedStatusDefaultOpen,
        collapsedAt = readOptDateMs(jsObj, "collapsedAtMs"),
        collapsedById = readOptInt(jsObj, "collapsedById"),
        closedStatus = closedStatusDefaultOpen,
        closedAt = readOptDateMs(jsObj, "closedAtMs"),
        closedById = readOptInt(jsObj, "closedById"),
        bodyHiddenAt = readOptDateMs(jsObj, "hiddenAtMs"),
        bodyHiddenById = readOptInt(jsObj, "hiddenById"),
        bodyHiddenReason = readOptString(jsObj, "hiddenReason"),
        deletedStatus = deletedStatusDefaultOpen,
        deletedAt = readOptDateMs(jsObj, "deletedAtMs"),
        deletedById = readOptInt(jsObj, "deletedById"),
        pinnedPosition = readOptInt(jsObj, "pinnedPosition"),
        branchSideways = readOptByte(jsObj, "branchSideways"),
        numPendingFlags = readOptInt(jsObj, "numPendingFlags").getOrElse(0),
        numHandledFlags = readOptInt(jsObj, "numHandledFlags").getOrElse(0),
        numPendingEditSuggestions = readOptInt(jsObj, "numEditSuggestions").getOrElse(0),
        numLikeVotes = readOptInt(jsObj, "numLikeVotes").getOrElse(0),
        numWrongVotes = readOptInt(jsObj, "numWrongVotes").getOrElse(0)  ,
        numBuryVotes = readOptInt(jsObj, "numBuryVotes").getOrElse(0),
        numUnwantedVotes = readOptInt(jsObj, "numUnwantedVotes").getOrElse(0)  ,
        numTimesRead = readOptInt(jsObj, "numTimesRead").getOrElse(0)))
    }
    catch {
      case ex: IllegalArgumentException =>
        Bad(s"Bad json for post id '$id': ${ex.getMessage}")
    }
  }


  def readSimplePostPatchOrBad(jsValue: JsValue): SimplePostPatch Or ErrorMessage = {
    val jsObj = jsValue match {
      case x: JsObject => x
      case bad =>
        return Bad(s"Not a json object, but a: " + classNameOf(bad))
    }

    val extId = try readString(jsObj, "extId") catch {
      case ex: IllegalArgumentException =>
        return Bad(s"Invalid post extId: " + ex.getMessage)
    }

    // Try to not reject the request. [0REJREQ]

    try {
      val anyPostTypeInt = readOptInt(jsObj, "postType")
      val postType: PostType = anyPostTypeInt.flatMap(PostType.fromInt) getOrElse PostType.Normal
      // Dupl code [02956KTU]
      val markupLang = readOptString(jsObj, "bodyMarkupLang") map { langName =>
        MarkupLang.fromString(langName) getOrElse {
          return Bad(s"Unknown markup language: $langName  [TyE502RKDHL6]")
        }
      }
      Good(SimplePostPatch(
        extId = extId,
        postType = postType,
        pageRef = readParsedRef(jsObj, "pageRef", allowParticipantRef = false),
        parentNr = readOptInt(jsObj, "parentNr"),
        authorRef = readParsedRef(jsObj, "authorRef", allowParticipantRef = true),
        bodySource = readString(jsObj, "body"),
        bodyMarkupLang = markupLang))
    }
    catch {
      case ex: IllegalArgumentException =>
        Bad(s"Bad json for SimplePostPatch with extId '$extId': ${ex.getMessage}")
    }
  }


  def readPostActionOrBad(jsValue: JsValue, isE2eTest: Boolean): PostAction Or ErrorMessage = {
    val jsObj = jsValue match {
      case x: JsObject => x
      case bad =>
        return Bad(s"Not a json object, but a: " + classNameOf(bad))
    }

    val postId = try readInt(jsObj, "postId") catch {
      case ex: IllegalArgumentException =>
        return Bad(s"Invalid PostAction post id: " + ex.getMessage)
    }

    try {
      val actionTypeInt  = readInt(jsObj, "actionType")
      val actionType  = PostsSiteDaoMixin.fromActionTypeInt(actionTypeInt)
      Good(PostAction(
        postId,
        pageId = readString(jsObj, "pageId"),
        postNr = readInt(jsObj, "postNr"),
        doerId = readInt(jsObj, "doerId"),
        doneAt = readWhen(jsObj, "doneAt"),
        actionType))
    }
    catch {
      case ex: IllegalArgumentException =>
        Bad(s"Bad json for post action for post id '$postId': ${ex.getMessage}")
    }
  }


  def readPermsOnPageOrBad(jsValue: JsValue, isE2eTest: Boolean): PermsOnPages Or ErrorMessage = {
    val jsObj = jsValue match {
      case x: JsObject => x
      case bad =>
        return Bad(s"Not a json object, but a: " + classNameOf(bad))
    }

    try {
      Good(PermsOnPages(
        id = readInt(jsObj, "id"),
        forPeopleId = readInt(jsObj, "forPeopleId"),
        onWholeSite = readOptBool(jsObj, "onWholeSite"),
        onCategoryId = readOptInt(jsObj, "onCategoryId"),
        onPageId = readOptString(jsObj, "onPageId"),
        onPostId = readOptInt(jsObj, "onPostId"),
        onTagId = readOptInt(jsObj, "onTagId"),
        mayEditPage = readOptBool(jsObj, "mayEditPage"),
        mayEditComment = readOptBool(jsObj, "mayEditComment"),
        mayEditWiki = readOptBool(jsObj, "mayEditWiki"),
        mayEditOwn = readOptBool(jsObj, "mayEditOwn"),
        mayDeletePage = readOptBool(jsObj, "mayDeletePage"),
        mayDeleteComment = readOptBool(jsObj, "mayDeleteComment"),
        mayCreatePage = readOptBool(jsObj, "mayCreatePage"),
        mayPostComment = readOptBool(jsObj, "mayPostComment"),
        maySee = readOptBool(jsObj, "maySee"),
        maySeeOwn = readOptBool(jsObj, "maySeeOwn")))
    }
    catch {
      case ex: IllegalArgumentException =>
        Bad(s"Bad page path json: ${ex.getMessage}")
    }
  }


  def readEmailNotfsPref(jsObj: JsObject): Option[EmailNotfPrefs] =
    readOptInt(jsObj, "emailNotfPrefs").flatMap(EmailNotfPrefs.fromInt)


  def readReivewTaskOrBad(jsValue: JsValue, isE2eTest: Boolean): ReviewTask Or ErrorMessage = {
    val jsObj = jsValue match {
      case x: JsObject => x
      case bad =>
        return Bad(s"ReviewTask json is not an object, but a: " + classNameOf(bad))
    }
    val id = try readInt(jsObj, "id") catch {
      case ex: IllegalArgumentException =>
        return Bad(s"Invalid ReviewTask id: " + ex.getMessage)
    }
    try {
      val reviewReasonsLong = readLong(jsObj, "reasonsLong")
      val reviewReasons = ReviewReason.fromLong(reviewReasonsLong)
      val reviewDecisionInt = readOptInt(jsObj, "decision")
      val reviewDecision = reviewDecisionInt.map(value =>
        ReviewDecision.fromInt(value) getOrElse {
          return Bad(s"Bad ReviewTask decision int: $value")
        })

      Good(ReviewTask(
        id = id,
        reasons = reviewReasons,
        createdById = readInt(jsObj, "createdById"),
        createdAt = readDateMs(jsObj, "createdAtMs"),
        createdAtRevNr = readOptInt(jsObj, "createdAtRevNr"),
        moreReasonsAt = readOptDateMs(jsObj, "moreReasonsAt"),
        //moreReasonsAtRevNr: Option[ju.Date] = None,
        decidedAt = readOptDateMs(jsObj, "decidedAt"),
        completedAt = readOptDateMs(jsObj, "completedAt"),
        decidedAtRevNr = readOptInt(jsObj, "decidedAtRevNr"),
        decidedById = readOptInt(jsObj, "decidedById"),
        invalidatedAt = readOptDateMs(jsObj, "invalidatedAt"),
        decision = reviewDecision,
        maybeBadUserId = readInt(jsObj, "maybeBadUserId"),
        pageId = readOptString(jsObj, "pageId"),
        postId = readOptInt(jsObj, "postId"),
        postNr = readOptInt(jsObj, "postNr")))
    }
    catch {
      case ex: IllegalArgumentException =>
        Bad(s"Bad json for ReviewTask id $id: ${ex.getMessage}")
    }
  }


  /* Later: Need to handle file uploads / streaming, so can import e.g. images.
  def importSite(siteId: SiteId) = PostFilesAction(RateLimits.NoRateLimits, maxBytes = 9999) {
        request =>

    SEC URITY ; MU ST // auth. Disable unless e2e.

    val multipartFormData = request.body match {
      case Left(maxExceeded: mvc.MaxSizeExceeded) =>
        throwForbidden("EsE4JU21", o"""File too large: I got ${maxExceeded.length} bytes,
          but size limit is ??? bytes""")
      case Right(data) =>
        data
    }

    val numFilesUploaded = multipartFormData.files.length
    if (numFilesUploaded != 1)
      throwBadRequest("EsE2PUG4", s"Upload exactly one file — I got $numFilesUploaded files")

    val files = multipartFormData.files.filter(_.key == "data")
    if (files.length != 1)
      throwBadRequest("EdE7UYMF3", s"Use the key name 'file' please")

    val file = files.head
  } */


  implicit class GetOrThrowBadJson[A](val underlying: Option[A]) {
    def getOrThrowBadJson(field: String): A =
      underlying.getOrElse(throw new ju.NoSuchElementException(s"Field missing: '$field'"))
  }

}

