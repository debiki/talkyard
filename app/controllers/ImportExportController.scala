/**
 * Copyright (c) 2015 Kaj Magnus Lindberg
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


/** Imports and exports dumps of websites.
  *
  * Currently: json only. Later: json + files in a .tar.gz.
  * Or msgpack? http://msgpack.org/index.html — but probably no big reason to use it
  * (disk space savings are small, and it makes debugging harder: unreadable files).
  * Don't use bson.
  *
  * Search for [readlater] for stuff ignored right now.
  */
class ImportExportController @Inject()(cc: ControllerComponents, edContext: EdContext)
  extends EdController(cc, edContext) {

  import context.globals
  import context.security
  import context.safeActions.ExceptionAction

  val MaxBytes = 1001000

  def importSiteJson(deleteOldSite: Option[Boolean]): Action[JsValue] =
        PostJsonAction(RateLimits.CreateSite, maxBytes = MaxBytes) { _ =>
    //val deleteOld = deleteOldSite.contains(true)
    //val createdFromSiteId = Some(request.siteId)
    //val response = importSiteImpl(request, request.theBrowserIdData, deleteOld, isTest = false)
    unimplemented("EdE2KWUP0") // check what kind of permission?
  }


  def importTestSite: Action[JsValue] = ExceptionAction(parse.json(maxLength = MaxBytes)) {
        request =>
    globals.testResetTime()
    val (browserId, moreNewCookies) = security.getBrowserIdCreateIfNeeded(request)
    val browserIdData = BrowserIdData(ip = request.remoteAddress, idCookie = browserId.cookieValue,
      fingerprint = 0)
    val response = importSiteImpl(request, browserIdData, deleteOld = true, isTest = true)
    response.withCookies(moreNewCookies: _*)
  }


  private def importSiteImpl(request: mvc.Request[JsValue], browserIdData: BrowserIdData,
        deleteOld: Boolean, isTest: Boolean): mvc.Result = {
    dieIf(deleteOld && !isTest, "EdE5FKWU02")

    val okE2ePassword = security.hasOkE2eTestPassword(request)
    if (!okE2ePassword)
      throwForbidden("EsE5JKU2", "Importing sites is only allowed for e2e testing right now")

    val siteData =
      try parseSiteJson(request.body, isE2eTest = okE2ePassword)
      catch {
        case ex: JsonUtils.BadJsonException =>
          throwBadRequest("EsE4GYM8", "Bad json structure: " + ex.getMessage)
        case ex: IllegalArgumentException =>
          // Some case class constructor failure.
          throwBadRequest("EsE7BJSN4", o"""Error constructing things, probably because of
              invalid value combinations: ${ex.getMessage}""")
      }

    throwForbiddenIf(
      deleteOld && siteData.site.hosts.exists(!_.hostname.startsWith(SiteHost.E2eTestPrefix)),
      "EdE7GPK4F0", s"Can only overwrite hostnames that start with ${SiteHost.E2eTestPrefix}")

    val newSite = doImportSite(siteData, browserIdData, deleteOldSite = deleteOld)

    Ok(Json.obj(
      "id" -> newSite.id,
      "origin" -> (globals.schemeColonSlashSlash + newSite.theCanonicalHost.hostname),
      "siteIdOrigin" -> globals.siteByIdOrigin(newSite.id))) as JSON
  }


  private case class ImportSiteData(
    site: Site,
    settings: SettingsToSave,
    summaryEmailIntervalMins: Int, // for now [7FKB4Q1]
    summaryEmailIfActive: Boolean, // for now [7FKB4Q1]
    users: Seq[MemberInclDetails],
    pages: Seq[PageMeta],
    pagePaths: Seq[PagePathWithId],
    categories: Seq[Category],
    posts: Seq[Post],
    permsOnPages: Seq[PermsOnPages])


  private def parseSiteJson(bodyJson: JsValue, isE2eTest: Boolean): ImportSiteData = {

    val (siteMetaJson, settingsJson, groupsJson, membersJson, permsOnPagesJson, pagesJson, pathsJson,
        categoriesJson, postsJson) =
      try {
        (readJsObject(bodyJson, "meta"),
          readJsObject(bodyJson, "settings"),
          readJsArray(bodyJson, "groups"),
          readJsArray(bodyJson, "members"),
          readJsArray(bodyJson, "permsOnPages"),
          readJsArray(bodyJson, "pages"),
          readJsArray(bodyJson, "pagePaths"),
          readJsArray(bodyJson, "categories"),
          readJsArray(bodyJson, "posts"))
      }
      catch {
        case ex: IllegalArgumentException =>
          throwBadRequest("EsE6UJM2", s"Invalid json: ${ex.getMessage}")
      }

    val siteToSave =
      try readSiteMeta(siteMetaJson)
      catch {
        case ex: IllegalArgumentException =>
          throwBadRequest("EsE6UJM2", s"Invalid 'site' object json: ${ex.getMessage}")
      }

    val settings = Settings2.settingsToSaveFromJson(settingsJson)

    HACK // just loading Everyone's summary email interval. [7FKB4Q1]
    var summaryEmailIntervalMins = SummaryEmails.DoNotSend
    var summaryEmailIfActive = false
    groupsJson.value.zipWithIndex foreach { case (json, index) =>
      val groupId = (json \ "id").as[UserId]
      require(groupId == Group.EveryoneId, "EdE1QK04S")
      summaryEmailIntervalMins = (json \ "summaryEmailIntervalMins").as[Int]
      summaryEmailIfActive = (json \ "summaryEmailIfActive").as[Boolean]
    }

    val users: Seq[MemberInclDetails] = membersJson.value.zipWithIndex map { case (json, index) =>
      readMemberOrBad(json, isE2eTest).getOrIfBad(errorMessage =>
          throwBadReq(
            "EsE0GY72", s"""Invalid user json at index $index in the 'users' list: $errorMessage,
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

    val categories: Seq[Category] = categoriesJson.value.zipWithIndex map { case (json, index) =>
      readCategoryOrBad(json, isE2eTest).getOrIfBad(error =>
        throwBadReq(
          "EsE5PYK2", o"""Invalid category json at index $index in the 'categories' list: $error,
              json: $json"""))
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

    ImportSiteData(siteToSave, settings,
      summaryEmailIntervalMins = summaryEmailIntervalMins,
      summaryEmailIfActive = summaryEmailIfActive,
      users, pages, paths, categories, posts, permsOnPages)
  }


  def doImportSite(siteData: ImportSiteData, browserIdData: BrowserIdData, deleteOldSite: Boolean)
        : Site = {
    for (page <- siteData.pages) {
      val path = siteData.pagePaths.find(_.pageId == page.pageId)
      throwBadRequestIf(path.isEmpty, "EsE5GKY2", o"""No PagePath included for page id
          '${page.pageId}'""")
    }

    def isMissing(what: Option[Option[Any]]) = what.isEmpty || what.get.isEmpty || {
      what.get.get match {
        case s: String => s.trim.isEmpty
        case _ => false
      }
    }

    throwForbiddenIf(isMissing(siteData.settings.orgFullName),
      "EdE7KB4W5", "No organization name specified")

    // COULD do this in the same transaction as the one below — then, would need a function
    // `transaction.continueWithSiteId(zzz)`?
    val siteToSave = siteData.site
    val site = globals.systemDao.createSite(
      siteToSave.name,
      siteToSave.status,
      siteToSave.canonicalHost.getOrDie("EsE2FUPFY7").hostname,
      embeddingSiteUrl = None,
      organizationName = "Dummy organization name [EsM8YKWP3]",  // fix later
      creatorId = SystemUserId,
      browserIdData = browserIdData,
      isTestSiteOkayToDelete = true,
      skipMaxSitesCheck = true,
      deleteOldSite = deleteOldSite,
      pricePlan = "Unknown",  // [4GKU024S]
      createdFromSiteId = None)

    val newDao = globals.siteDao(site.id)

    HACK // not inserting groups, only updating summary email interval. [7FKB4Q1]
    // And in the wrong transaction :-/
    newDao.saveGroupPreferences(GroupPreferences(
      groupId = Group.EveryoneId,
      fullName = Some("Everyone"),
      username = "everyone",
      summaryEmailIntervalMins = Some(siteData.summaryEmailIntervalMins),
      summaryEmailIfActive = Some(siteData.summaryEmailIfActive)), Who.System)

    newDao.readWriteTransaction { transaction =>
      // We might import a forum or a forum category, and then the categories reference the
      // forum page, and the forum page references to the root category.
      transaction.deferConstraints()

      transaction.upsertSiteSettings(siteData.settings)

      siteData.users foreach { user =>
        transaction.insertMember(user)
        // [readlater] export & import username usages, later. For now, create new here.
        transaction.insertUsernameUsage(UsernameUsage(
          usernameLowercase = user.usernameLowercase, inUseFrom = transaction.now, userId = user.id))
        // [readlater] export & import UserStats. For now, create new "empty" here.
        transaction.upsertUserStats(UserStats.forNewUser(user.id, firstSeenAt = transaction.now,
          emailedAt = None))
        newDao.joinGloballyPinnedChats(user.briefUser, transaction)
      }
      siteData.pages foreach { pageMeta =>
        //val newId = transaction.nextPageId()
        transaction.insertPageMetaMarkSectionPageStale(pageMeta)
      }
      siteData.pagePaths foreach { path =>
        transaction.insertPagePath(path)
      }
      siteData.categories foreach { categoryMeta =>
        //val newId = transaction.nextCategoryId()
        transaction.insertCategoryMarkSectionPageStale(categoryMeta)
      }
      siteData.posts foreach { post =>
        //val newId = transaction.nextPostId()
        transaction.insertPost(post)
      }
      siteData.permsOnPages foreach { permission =>
        transaction.insertPermsOnPages(permission)
      }
      // Or will this be a bit slow? Kind of loads everything we just imported.
      siteData.pages foreach { pageMeta =>
        // [readlater] export & import page views too, otherwise page popularity here will be wrong.
        val pagePartsDao = PagePartsDao(pageMeta.pageId, transaction)
        newDao.updatePagePopularity(pagePartsDao, transaction)
        // For now: (e2e tests: page metas imported before posts, and page meta reply counts = wrong)
        val numReplies = pagePartsDao.allPosts.count(_.isReply)
        val correctMeta = pageMeta.copy(numRepliesTotal = numReplies, numRepliesVisible = numReplies)
        transaction.updatePageMeta(correctMeta, oldMeta = pageMeta, markSectionPageStale = true)
      }
    }

    site
  }


  def readSiteMeta(jsObject: JsObject): Site = {
    val name = readString(jsObject, "name")
    val anyFullHostname = readOptString(jsObject, "fullHostname")
    untestedIf(anyFullHostname.isDefined, "EsE5FK02", "fullHostname has never been used before")

    def theLocalHostname = {
      readOptString(jsObject, "localHostname") getOrElse {
        throw new BadJsonException(s"Neither fullHostname nor localHostname specified [EsE2KF4Y8]")
      }
    }

    val siteStatusInt = readInt(jsObject, "status")
    val siteStatus = SiteStatus.fromInt(siteStatusInt) getOrElse {
      throwBadRequest("EsE6YK2W4", s"Bad site status int: $siteStatusInt")
    }

    val createdAtMs = readLong(jsObject, "createdAtMs")
    val fullHostname = anyFullHostname.getOrElse(s"$theLocalHostname.${globals.baseDomainNoPort}")

    Site(
      id = NoSiteId,
      status = siteStatus,
      name = name,
      createdAt = When.fromMillis(createdAtMs),
      creatorIp = "0.0.0.0",
      hosts = List(
        SiteHost(fullHostname, SiteHost.RoleCanonical)))
  }


  def readMemberOrBad(jsValue: JsValue, isE2eTest: Boolean): MemberInclDetails Or ErrorMessage = {
    val jsObj = jsValue match {
      case x: JsObject => x
      case bad =>
        return Bad(s"Not a json object, but a: " + classNameOf(bad))
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
      Good(MemberInclDetails(
        id = id,
        username = username,
        fullName = readOptString(jsObj, "fullName"),
        createdAt = readDateMs(jsObj, "createdAtMs"),
        isApproved = readOptBool(jsObj, "isApproved"),
        approvedAt = readOptDateMs(jsObj, "approvedAtMs"),
        approvedById = readOptInt(jsObj, "approvedById"),
        emailAddress = readString(jsObj, "emailAddress").trim,
        emailNotfPrefs = EmailNotfPrefs.Receive, // [readlater]
        emailVerifiedAt = readOptDateMs(jsObj, "emailVerifiedAtMs"),
        emailForEveryNewPost = readOptBool(jsObj, "emailForEveryNewPost") getOrElse false,
        summaryEmailIntervalMins = readOptInt(jsObj, "summaryEmailIntervalMins"),
        summaryEmailIfActive = readOptBool(jsObj, "summaryEmailIfActive"),
        passwordHash = passwordHash,
        country = readOptString(jsObj, "country"),
        website = readOptString(jsObj, "website"),
        about = readOptString(jsObj, "about"),
        tinyAvatar = None, // [readlater]
        smallAvatar = None, // [readlater]
        mediumAvatar = None, // [readlater]
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
        suspendedReason = readOptString(jsObj, "suspendedReason")))
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

    try {
      Good(PageMeta(
        pageId = id,
        pageRole = PageRole.fromInt(readInt(jsObj, "role")).getOrThrowBadJson("role"),
        version = readInt(jsObj, "version"),
        createdAt = readDateMs(jsObj, "createdAtMs"),
        updatedAt = readDateMs(jsObj, "updatedAtMs"),
        publishedAt = None,
        bumpedAt = None,
        lastReplyAt = None,
        lastReplyById = None,
        categoryId = readOptInt(jsObj, "categoryId"),
        embeddingPageUrl = None,
        authorId = readInt(jsObj, "authorId")
        /* Later:
        frequentPosterIds = Nil,
        pinOrder = None,
        pinWhere = None,
        numLikes: Int = 0,
        numWrongs: Int = 0,
        numBurys: Int = 0,
        numUnwanteds: Int = 0,
        numRepliesVisible: Int = 0,
        numRepliesTotal: Int = 0,
        numOrigPostLikeVotes: Int = 0,
        numOrigPostWrongVotes: Int = 0,
        numOrigPostBuryVotes: Int = 0,
        numOrigPostUnwantedVotes: Int = 0,
        numOrigPostRepliesVisible: Int = 0,
        answeredAt: Option[ju.Date] = None,
        answerPostUniqueId: Option[UniquePostId] = None,
        plannedAt: Option[ju.Date] = None,
        doneAt: Option[ju.Date] = None,
        closedAt: Option[ju.Date] = None,
        lockedAt: Option[ju.Date] = None,
        frozenAt: Option[ju.Date] = None,
        // unwantedAt: Option[ju.Date] = None,
        // deletedAt: Option[ju.Date] = None,
        numChildPages: Int = 0  <-- DoLater: remove, replace with category table
        */
      ))
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
        slug = readString(jsObj, "slug")))
    }
    catch {
      case ex: IllegalArgumentException =>
        Bad(s"Bad page path json: ${ex.getMessage}")
    }
  }


  def readCategoryOrBad(jsValue: JsValue, isE2eTest: Boolean): Category Or ErrorMessage = {
    val jsObj = jsValue match {
      case x: JsObject => x
      case bad =>
        return Bad(s"Not a json object, but a: " + classNameOf(bad))
    }

    val id = try readInt(jsObj, "id") catch {
      case ex: IllegalArgumentException =>
        return Bad(s"Invalid category id: " + ex.getMessage)
    }

    try {
      val includeInSummariesInt = readOptInt(jsObj, "includeInSummaries")
          .getOrElse(IncludeInSummaries.Default.IntVal)
      val includeInSummaries = IncludeInSummaries.fromInt(includeInSummariesInt) getOrElse {
        return Bad(s"Invalid includeInSummaries: $includeInSummariesInt")
      }
      Good(Category(
        id = id,
        sectionPageId = readString(jsObj, "sectionPageId"),
        parentId = readOptInt(jsObj, "parentId"),
        defaultCategoryId = readOptInt(jsObj, "defaultCategoryId"),
        name = readString(jsObj, "name"),
        slug = readString(jsObj, "slug"),
        position = readOptInt(jsObj, "position") getOrElse Category.DefaultPosition,
        description = readOptString(jsObj, "description"),
        newTopicTypes = Nil, // fix later
        unlisted = readOptBool(jsObj, "unlisted").getOrElse(false),
        includeInSummaries = includeInSummaries,
        createdAt = readDateMs(jsObj, "createdAtMs"),
        updatedAt = readDateMs(jsObj, "updatedAtMs"),
        lockedAt = readOptDateMs(jsObj, "lockedAtMs"),
        frozenAt = readOptDateMs(jsObj, "frozenAtMs"),
        deletedAt = readOptDateMs(jsObj, "deletedAtMs")))
    }
    catch {
      case ex: IllegalArgumentException =>
        Bad(s"Bad json for page id '$id': ${ex.getMessage}")
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
      PostType.fromInt(readOptInt(jsObj, "type").getOrElse(PostType.Normal.toInt))
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
        id = readInt(jsObj, "id"),
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
        currentSourcePatch = readOptString(jsObj, "currRevSourcePatch"),
        currentRevisionNr = readInt(jsObj, "currRevNr"),
        previousRevisionNr = readOptInt(jsObj, "prevRevNr"),
        lastApprovedEditAt = readOptDateMs(jsObj, "lastApprovedEditAtMs"),
        lastApprovedEditById = readOptInt(jsObj, "lastApprovedEditById"),
        numDistinctEditors = readInt(jsObj, "numDistinctEditors"),
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

