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

package talkyard.server.backup

import com.debiki.core.Prelude._
import com.debiki.core._
import debiki.JsonUtils._
import debiki._
import debiki.EdHttp._
import debiki.dao.PagePartsDao
import ed.server._
import java.{util => ju}
import javax.inject.Inject
import org.scalactic._
import play.api._
import play.api.libs.json._
import play.api.mvc.{Action, ControllerComponents}
import scala.collection.mutable
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
case class SiteBackupReader(context: EdContext) {

  import context.globals
  import context.security
  import context.safeActions.ExceptionAction

  val MaxBytes = 1001000


  def parseDumpJsonMaybeThrowBadRequest(siteId: Option[SiteId], bodyJson: JsValue, simpleFormat: Boolean,
          isE2eTest: Boolean): SiteBackup = {
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


  private def parseSimpleSitePatch(siteId: SiteId, bodyJson: JsValue): SiteBackup = {
    val categoriesJson =
      try { // (this extra try...catch is for better error messages)
        // Only categories.
        // Right now, all people have asked for [SITE121], is to upsert categories
        // (via /-/v0/upsert-simple ).
        readJsArray(bodyJson, "categories", optional = true)
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

    val simplePatch = SimpleSitePatch(categoryPatches = categoryPatches)

    val oldCats = context.globals.siteDao(siteId).getAllCategories()
    // For now, pick the first random root category. Sub communities currently disabled. [4GWRQA28]
    val rootCategory = context.globals.siteDao(siteId).getRootCategories().headOption.getOrElse {
      // This means the site is currently empty, but we need something to insert the new contents into.
      throwForbidden("TyE6PKWTY4", "No root category has been created")
    }
    val completePatch = simplePatch.makeComplete(oldCats, globals.now()) match {
      case Good(p) => p
      case Bad(errorMessage) =>
        throwBadRequest("TyE05JKRVHP8", s"Error interpreting patch: $errorMessage")
    }
    completePatch
  }


  def parseSiteJson(bodyJson: JsValue, isE2eTest: Boolean): SiteBackup = {

    // When importing API secrets has been impl, then upd this test:
    // sso-all-ways-to-login.2browsers.test.ts  [5ABKR2038]  so it imports
    // an API secret (then, get to test the import-secrets code, + the test gets faster).

    val (siteMetaJson, settingsJson, guestsJson, anyGuestEmailPrefsJson, groupsJson, membersJson,
        permsOnPagesJson, pagesJson, pathsJson, pageIdsByAltIdsJson,
        categoriesJson, postsJson) =
      try {
        (readOptJsObject(bodyJson, "meta"),
          readOptJsObject(bodyJson, "settings"),
          // + API secrets [5ABKR2038]
          readJsArray(bodyJson, "guests", optional = true),
          readOptJsObject(bodyJson, "guestEmailPrefs"),
          readJsArray(bodyJson, "groups", optional = true),
          readJsArray(bodyJson, "members", optional = true),   // RENAME to "users"
          readJsArray(bodyJson, "permsOnPages", optional = true),
          readJsArray(bodyJson, "pages", optional = true),
          readJsArray(bodyJson, "pagePaths", optional = true),
          readOptJsObject(bodyJson, "pageIdsByAltIds") getOrElse JsObject(Nil),
          readJsArray(bodyJson, "categories", optional = true),
          readJsArray(bodyJson, "posts", optional = true))
      }
      catch {
        case ex: IllegalArgumentException =>
          throwBadRequest("EsE6UJM2", s"Invalid json: ${ex.getMessage}")
      }

    val siteToSave: Option[SiteInclDetails] =
      try siteMetaJson.map(readSiteMeta)
      catch {
        case ex: IllegalArgumentException =>
          throwBadRequest("EsE6UJM2", s"Invalid 'site' object json: ${ex.getMessage}")
      }

    val settings = settingsJson.map(Settings2.settingsToSaveFromJson(_, globals))

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

    val guests: Seq[Guest] = guestsJson.value.zipWithIndex map { case (json, index) =>
      readGuestOrBad(json, guestEmailPrefs, isE2eTest).getOrIfBad(errorMessage =>
        throwBadReq(
          "EsE0GY72", o"""Invalid guest json at index $index in the 'guests' list: $errorMessage,
                json: $json"""))
    }

    HACK // just loading Everyone's summary email interval. [7FKB4Q1]
    var summaryEmailIntervalMins = SummaryEmails.DoNotSend
    var summaryEmailIfActive = false
    groupsJson.value.zipWithIndex foreach { case (json, index) =>
      val groupId = readInt(json, "id")
      if (groupId == Group.EveryoneId) {
        (json \ "summaryEmailIntervalMins").asOpt[Int] foreach { mins =>
          summaryEmailIntervalMins = mins
        }
        (json \ "summaryEmailIfActive").asOpt[Boolean] foreach { value =>
          summaryEmailIfActive = value
        }
      }
    }

    val groups = Vector.empty  // groupsJson, later

    val users: Seq[UserInclDetails] = membersJson.value.zipWithIndex map { case (json, index) =>
      readUserOrBad(json, isE2eTest).getOrIfBad(errorMessage =>
          throwBadReq(
            "EsE0GY72", o"""Invalid user json at index $index in the 'users' list: $errorMessage,
                json: $json"""))
    }

    val pages: Seq[PageMeta] = pagesJson.value.zipWithIndex map { case (json, index) =>
      readPageOrBad(json, isE2eTest).getOrIfBad(errorMessage =>
        throwBadReq(
          "EsE2GKB0", o"""Invalid page json at index $index in the 'pages' list: $errorMessage
              json: $json"""))
    }

    val paths: Seq[PagePathWithId] = pathsJson.value.zipWithIndex map { case (json, index) =>
      readPagePathOrBad(json, isE2eTest).getOrIfBad(error =>
        throwBadReq(
          "Ese55GP1", o"""Invalid page path json at index $index in the 'pagePaths' list: $error,
              json: $json"""))
    }

    val pageIdsByAltIds: Map[AltPageId, PageId] = Map(pageIdsByAltIdsJson.fields map {
      case (altId, pageIdJs) =>
        pageIdJs match {
          case JsString(value) =>
            SECURITY; SHOULD // verify id and value are ok, no weird chars or blanks?
            // Review this for all imported things b.t.w.
            altId -> value
          case x => throwBadRequest(
            "TyE406TNW2", s"For alt page id '$altId', the page id is invalid: '$x'")
        }
    }: _*)

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

    val posts: Seq[Post] = postsJson.value.zipWithIndex map { case (json, index) =>
      readPostOrBad(json, isE2eTest).getOrIfBad(error =>
        throwBadReq(
          "EsE4KGU0", o"""Invalid post json at index $index in the 'posts' list: $error,
              json: $json"""))
    }

    val permsOnPages: Seq[PermsOnPages] = permsOnPagesJson.value.zipWithIndex map {
          case (json, index) =>
      readPermsOnPageOrBad(json, isE2eTest).getOrIfBad(error =>
        throwBadReq(
          "EsE5JGLRK01", o"""Invalid PermsOnPage json at index $index in the 'permsOnPage' list:
              $error, json: $json"""))
    }

    SiteBackup(siteToSave, settings,
      summaryEmailIntervalMins = summaryEmailIntervalMins,
      summaryEmailIfActive = summaryEmailIfActive,
      guests, guestEmailPrefs, groups, users, categoryPatches.toVector, categories.toVector,
      pages, paths, pageIdsByAltIds = pageIdsByAltIds, posts, permsOnPages)
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
      val passwordHash = readOptString(jsObj, "passwordHash")
      passwordHash.foreach(security.throwIfBadPassword(_, isE2eTest))
      val email = readString(jsObj, "emailAddress").trim
      Good(Guest(
        id = id,
        extImpId = readOptString(jsObj, "extImpId"),
        createdAt = readWhen(jsObj, "createdAtMs"),
        guestName = readOptString(jsObj, "fullName").getOrElse(""),  // RENAME? to  guestName?
        guestBrowserId = readOptString(jsObj, "guestBrowserId"),
        email = email,
        // Any value here, would get ignored. Instead, when finding a guest's email notf pref,
        // we load guests' email notf prefs from another json object [GSTPRFS] and the
        // guest_prefs3 db table — which works also if a human returns later and gets
        // a different guest user account. (stored in guest_prefs3).
        emailNotfPrefs = EmailNotfPrefs.Unspecified,
        country = readOptString(jsObj, "country"),
        lockedThreatLevel = readOptInt(jsObj, "lockedThreatLevel").flatMap(ThreatLevel.fromInt)))
    }
    catch {
      case ex: IllegalArgumentException =>
        Bad(s"Bad json for guest id $id: ${ex.getMessage}")
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
        externalId = readOptString(jsObj, "externalId"),  // RENAME to "ssoId"
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
        extImpId = readOptString(jsObj, "extImpId"),
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
      // but so we know which real category to upsert things inot.
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

          // ?? Where check slug, name, extId etc are valid (not too long, no weird chars) ?? [05970KF5]
      }

      val includeInSummariesInt = readOptInt(jsObj, "includeInSummaries")
          .getOrElse(IncludeInSummaries.Default.IntVal)
      val includeInSummaries = IncludeInSummaries.fromInt(includeInSummariesInt) getOrElse {
        return Bad(s"Invalid includeInSummaries: $includeInSummariesInt")
      }
      Good(Left(Category(
        id = theId,
        extImpId = readOptString(jsObj, "extImpId"),
        sectionPageId = readString(jsObj, "sectionPageId"), // opt, use the one and only section
        parentId = readOptInt(jsObj, "parentId"),
        defaultSubCatId = readOptInt(jsObj, "defaultSubCatId", "defaultCategoryId"), // RENAME to ...SubCat...
        name = readString(jsObj, "name"),
        slug = readString(jsObj, "slug"),
        position = readOptInt(jsObj, "position") getOrElse Category.DefaultPosition,
        description = readOptString(jsObj, "description"),
        newTopicTypes = Nil, // fix later [readlater]
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
        extImpId = readOptString(jsObj, "extImpId"),
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

