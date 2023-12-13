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

package debiki.dao

import com.debiki.core._
import com.debiki.core.Prelude._
import debiki.{Globals, TextAndHtml, TextAndHtmlMaker, TitleSourceAndHtml}
import talkyard.server.{TyAppComponents, TyContext}
import org.scalatest.freespec.AnyFreeSpec
import org.scalatest.matchers.must
import org.scalatestplus.play.{BaseOneAppPerSuite, FakeApplicationFactory}
import DaoAppSuite._
import java.io.File
import play.api.inject.DefaultApplicationLifecycle
import play.api._
import talkyard.server.dao.StaleStuff



object DaoAppSuite {

  /** If the test start time is less than a year after 1970, the popularity stats will
    * subtract a year and create a negative Unix-millis-time —> an assertion fails. So start
    * at least a year after 1970 — let's say 1157 days, to get a nice looking number: 100...000.
    */
  val OneAndZeros1157DaysInMillis = 100000000000L // divide by (24*3600*1000) —> 1157.4 days

  val Jan2020InMillis: i64 = 26300000 * MillisPerMinute  // = 1578000000 * 1000
  val Jan2020: When = When.fromMillis(Jan2020InMillis)
}


class DaoAppSuite(
  val disableScripts: Boolean = true,
  val disableBackgroundJobs: Boolean = true,
  val butEnableJanitor: Boolean = false,
  val maxSitesTotal: Option[Int] = None,
  val minPasswordLength: Option[Int] = None,
  val startTime: When = When.fromMillis(10 * 1000 + OneAndZeros1157DaysInMillis),
  val extraConfig: Map[String, String] = Map.empty)
  extends AnyFreeSpec with must.Matchers with BaseOneAppPerSuite with FakeApplicationFactory {


  /** Adds new ScalaTest syntax:  "test name".inReadTx(dao) { tx => .... }
    */
  implicit class InTxString(val underlying: String) {
    def inReadTx(dao: => SiteDao)(f: SiteTx => Any /* Assertion */): Unit = {
      underlying in dao.readTx(f)
    }
    def inWriteTx(dao: => SiteDao)(f: (SiteTx, StaleStuff) => Any /* Assertion */): Unit = {
      underlying in dao.writeTx(f)
    }
  }


  Globals.setIsProdForever(false)

  private var edAppComponents: TyAppComponents = _

  lazy val context: TyContext = edAppComponents.context
  lazy val globals: Globals = context.globals


  val dummyNoSite: SiteIdHostnames = new SiteIdHostnames {
    val id: SiteId = NoSiteId
    val pubId = "testsiteid"
    val canonicalHostnameStr = Some("forum.example.com")
    val allHostnames: Seq[String] = canonicalHostnameStr.toSeq
    val status = SiteStatus.Active
    val featureFlags = ""
  }

  lazy val textAndHtmlMaker = new TextAndHtmlMaker(dummyNoSite, context.nashorn)


  override def fakeApplication: Application = {
    val env = Environment.simple(new File("."))

    // Done automatically by Play 2.8:?
    // — See Context.create(..., initialSettings = ...) docs.
    // val fileConfig = Configuration.load(env)
    // val totalConfig = fileConfig ++ testConfig

    val appLoaderContext = ApplicationLoader.Context.create(
      environment = env,
      initialSettings = testConfig,
      lifecycle = new DefaultApplicationLifecycle(),
      devContext = None)

    /*  [PLAY28] this still needed?
    LoggerConfigurator(env.classLoader).foreach {
      _.configure(env, totalConfig, optionalProperties = Map.empty)
    } */

    edAppComponents = new TyAppComponents(appLoaderContext)
    setTime(startTime) // now 'globals' is available
    edAppComponents.application
  }


  private def testConfig: Map[String, String] = {
    var configMap = Map[String, String](
      "isTestShallEmptyDatabase" -> "true",
      "isTestDisableScripts" -> (disableScripts ? "true" | "false"),
      "isTestDisableBackgroundJobs" -> (disableBackgroundJobs ? "true" | "false"),
      "isTestEnableJanitor" -> (butEnableJanitor ? "true" | "false"))
    import debiki.Config.CreateSitePath
    maxSitesTotal foreach { max =>
      configMap = configMap.updated(s"$CreateSitePath.maxSitesTotal", max.toString)
    }
    minPasswordLength foreach { min =>
      configMap = configMap.updated("talkyard.minPasswordLength", min.toString)
    }
    extraConfig ++ configMap
  }


  def browserIdData: BrowserIdData =
    BrowserIdData("1.2.3.4", idCookie = Some("dummy_id_cookie"), fingerprint = 334455)

  def dummySpamRelReqStuff: SpamRelReqStuff = SpamRelReqStuff(
          browserIdData,
          userAgent = None, referer = None, uri = "/dummy",
          userName = None, userEmail = None, userUrl = None, userTrustLevel = None)


  private var _currentTime: When = _

  def currentTime: When = _currentTime

  def setTime(when: When) {
    _currentTime = when
    globals.testSetTime(when)
  }

  def playTimeSeconds(seconds: Long): Unit = playTimeMillis(seconds * 1000)

  def playTimeMillis(millis: Long) {
    _currentTime = _currentTime plusMillis millis
    globals.testSetTime(_currentTime)
  }

  def createSite(hostname: String, settings: SettingsToSave = SettingsToSave())
        : (Site, SiteDao) = {
    val siteName = "site-" + hostname.replaceAllLiterally(".", "")
    val pubId = s"e2epubid${siteName.replaceAllLiterally("-", "")}"
    val site = globals.systemDao.createAdditionalSite(
          anySiteId = None,
          pubId = pubId, name = siteName, status = SiteStatus.Active,
          hostname = Some(hostname), featureFlags = "",
          embeddingSiteUrl = None, organizationName = s"Site $hostname Organization Name",
          makePublic = None, creatorId = UnknownUserId, browserIdData,
          isTestSiteOkayToDelete = true, skipMaxSitesCheck = true,
          createdFromSiteId = None)
    val dao = globals.siteDao(site.id)
    if (settings != SettingsToSave()) {
      dao.readWriteTransaction { tx =>
        tx.upsertSiteSettings(settings)
      }
    }
    (site, dao)
  }


  def createPasswordOwner(username: String, dao: SiteDao,
        createdAt: Option[When] = None, firstSeenAt: Option[When] = None,
        emailVerified: Boolean = false): User = {
    createPasswordAdminOrOwner(username, dao, createdAt = createdAt,
        firstSeenAt = firstSeenAt, isOwner = true, emailVerified = emailVerified)
  }

  /** Its name will be "Admin $username", username "admin_$username" and email
    * "admin-$username@x.co",
    */
  def createPasswordAdmin(username: String, dao: SiteDao, createdAt: Option[When] = None,
        firstSeenAt: Option[When] = None, emailVerified: Boolean = false): User = {
    createPasswordAdminOrOwner(username, dao, createdAt = createdAt,
      firstSeenAt = firstSeenAt, isOwner = false, emailVerified = emailVerified)
  }

  private def createPasswordAdminOrOwner(username: String, dao: SiteDao, isOwner: Boolean,
      createdAt: Option[When], firstSeenAt: Option[When] = None, emailVerified: Boolean = false)
      : User = {
    val theCreatedAt = createdAt.getOrElse(globals.now())
    val password = s"pub-${username take 3}020"
    val adm = dao.createPasswordUserCheckPasswordStrong(NewPasswordUserData.create(
      name = Some(s"Admin $username"), username = username,
      email = s"$username@x.co", password = Some(password),
      createdAt = theCreatedAt,
      isAdmin = true, isOwner = isOwner).get, browserIdData)
    if (emailVerified) {
      dao.verifyPrimaryEmailAddress(adm.id, theCreatedAt.toJavaDate)
    }
    adm
  }


  def createPasswordModerator(username: String, dao: SiteDao, createdAt: Option[When] = None,
        emailVerified: Boolean = false): User = {
    val theCreatedAt = createdAt.getOrElse(globals.now())
    val mod = dao.createPasswordUserCheckPasswordStrong(NewPasswordUserData.create(
      name = Some(s"Mod $username"), username = username, email = s"$username@x.co",
      password = Some(s"pub-${username take 3}020"), createdAt = theCreatedAt,
      isAdmin = false, isModerator = true, isOwner = false).get, browserIdData)
    if (emailVerified) {
      dao.verifyPrimaryEmailAddress(mod.id, theCreatedAt.toJavaDate)
    }
    mod
  }


  /** Its name will be "User $username", and email "$username@x.co".
    */
  def createPasswordUser(username: String, dao: SiteDao,
        trustLevel: TrustLevel = TrustLevel.NewMember,
        threatLevel: ThreatLevel = ThreatLevel.HopefullySafe,
        createdAt: Option[When] = None, emailVerified: Boolean = false,
        extId: Option[ExtId] = None, password: Option[String] = None): User = {
    val theCreatedAt = createdAt.getOrElse(globals.now())
    val member = dao.createPasswordUserCheckPasswordStrong(NewPasswordUserData.create(
      name = Some(s"User $username"), username = username, email = s"$username@x.co",
      password = password orElse Some(s"pub-${username take 3}020"), createdAt = theCreatedAt,
      isAdmin = false, isOwner = false, trustLevel = trustLevel, threatLevel = threatLevel,
      extId = extId).get,
      browserIdData)
    if (emailVerified) {
      dao.verifyPrimaryEmailAddress(member.id, theCreatedAt.toJavaDate)
    }
    member
  }


  /** Like createPasswordUser() but returns a memeber with details.
    */
  def createPasswordUserGetDetails(username: String, dao: SiteDao,
        trustLevel: TrustLevel = TrustLevel.NewMember,
        threatLevel: ThreatLevel = ThreatLevel.HopefullySafe,
        createdAt: Option[When] = None, emailVerified: Boolean = false,
        extId: Option[ExtId] = None): UserInclDetails = {
    val user = createPasswordUser(username, dao, trustLevel, threatLevel,
        createdAt = createdAt, emailVerified, extId)
    dao.readOnlyTransaction(_.loadTheUserInclDetails(user.id))
  }


  def createGroup(dao: SiteDao, username: String, fullName: Option[String],
      createdAt: Option[When] = None, firstSeenAt: Option[When] = None): Group = {
    dao.createGroup(username, fullName, Who(SystemUserId, browserIdData)).get
  }


  def updateMemberPreferences(dao: SiteDao, memberId: UserId,
        fn: AboutUserPrefs => AboutUserPrefs) {
    val member = dao.loadTheUserInclDetailsById(memberId)
    dao.saveAboutMemberPrefsIfAuZ(fn(member.preferences_debugTest), Who(memberId, browserIdData))
  }


  def updateGroupPreferences(dao: SiteDao, groupId: UserId, byWho: Who,
        fn: AboutGroupPrefs => AboutGroupPrefs) {
    val group = dao.loadTheGroupInclDetailsById(groupId)
    dao.saveAboutGroupPrefs(fn(group.preferences), byWho)
  }


  def loadTheUserStats(userId: UserId)(dao: SiteDao): UserStats =
    dao.readOnlyTransaction(_.loadUserStats(userId)) getOrDie "EdE5JWGB10"


  def letEveryoneTalkAndStaffModerate(dao: SiteDao) {
    dao.readWriteTransaction { tx =>
      tx.insertPermsOnPages(PermsOnPages(
        id = NoPermissionId,
        forPeopleId = Group.EveryoneId,
        onWholeSite = Some(true),
        mayCreatePage = Some(true),
        mayPostComment = Some(true),
        maySee = Some(true)))

      tx.insertPermsOnPages(PermsOnPages(
        id = NoPermissionId,
        forPeopleId = Group.StaffId,
        onWholeSite = Some(true),
        mayEditPage = Some(true),
        mayEditComment = Some(true),
        mayEditWiki = Some(true),
        mayDeletePage = Some(true),
        mayDeleteComment = Some(true),
        mayCreatePage = Some(true),
        mayPostComment = Some(true),
        maySee = Some(true)))
    }
  }


  def createCategory(slug: String, forumPageId: PageId, parentCategoryId: CategoryId,
        authorId: UserId, browserIdData: BrowserIdData,
        dao: SiteDao, anyCategoryId: Option[CategoryId] = None): CreateCategoryResult = {

    val newCatId = dao.readTx(_.nextCategoryId())

    val categoryData: CategoryToSave = CategoryToSave(
          anyId = Some(newCatId),
          sectionPageId = forumPageId,
          parentId = parentCategoryId,
          name = s"Cat $slug Name",
          slug = slug,
          position = 50,
          newTopicTypes = List(PageType.Discussion),
          defaultSortOrder = None,
          comtOrder = None,
          comtNesting = None,
          comtsStartHidden = None,
          comtsStartAnon = None,
          opStartsAnon = None,
          newAnonStatus = None,
          doVoteStyle = None,
          doVoteInTopicList = None,
          shallBeDefaultCategory = false,
          unlistCategory = false,
          unlistTopics = false,
          includeInSummaries = IncludeInSummaries.Default,
          description = s"Cat $slug Description")

    val permissions = Vector(
          ForumDao.makeEveryonesDefaultCategoryPerms(newCatId),
          ForumDao.makeStaffCategoryPerms(newCatId))

    dao.createCategory(categoryData, permissions, Who(SystemUserId, browserIdData))
  }


  def editCategory(cat: Cat, permissions: ImmSeq[PermsOnPages],
          browserIdData: BrowserIdData, dao: SiteDao,
          newParentId: Opt[CatId] = None,
          newSectPageId: Opt[PageId] = None): Cat = {
    var catToSave = CategoryToSave.initFrom(cat)
    newParentId map { parCatId =>
      catToSave = catToSave.copy(parentId = parCatId)
    }
    newSectPageId map { sectPageId =>
      catToSave = catToSave.copy(sectionPageId = sectPageId)
    }
    dao.editCategory(catToSave, permissions, who = Who.System)
  }


  REMOVE; CLEAN_UP // use createPage2 instead, and rename it to createPage().
  def createPage(pageRole: PageType, titleTextAndHtml: TitleSourceAndHtml,
        bodyTextAndHtml: TextAndHtml, authorId: UserId, browserIdData: BrowserIdData,
        dao: SiteDao, anyCategoryId: Option[CategoryId] = None,
        extId: Option[ExtId] = None, discussionIds: Set[AltPageId] = Set.empty): PageId = {
    createPage2(pageRole, titleTextAndHtml = titleTextAndHtml,
          bodyTextAndHtml = bodyTextAndHtml, authorId = authorId, browserIdData = browserIdData,
          dao = dao, anyCategoryId = anyCategoryId,
          extId = extId, discussionIds = discussionIds).id
  }

  def createPage2(pageRole: PageType, titleTextAndHtml: TitleSourceAndHtml,
        bodyTextAndHtml: TextAndHtml, authorId: UserId, browserIdData: BrowserIdData,
        dao: SiteDao, anyCategoryId: Option[CategoryId] = None,
        doAsAnon: Opt[WhichAnon.NewAnon] = None,
        extId: Option[ExtId] = None, discussionIds: Set[AltPageId] = Set.empty): CreatePageResult = {
    dao.createPage2(
      pageRole, PageStatus.Published, anyCategoryId = anyCategoryId, withTags = Nil,
      anyFolder = Some("/"), anySlug = Some(""),
      title = titleTextAndHtml, bodyTextAndHtml = bodyTextAndHtml,
      showId = true, deleteDraftNr = None, Who(authorId, browserIdData), dummySpamRelReqStuff,
      doAsAnon = doAsAnon,
      discussionIds = discussionIds, extId = extId)
  }


  def reply(memberId: UserId, pageId: PageId, text: String, parentNr: Option[PostNr] = None,
        skipNashorn: Boolean = true)(dao: SiteDao): Post = {
    val textAndHtml =
      if (skipNashorn) textAndHtmlMaker.testBody(text)
      else textAndHtmlMaker.forBodyOrComment(text)
    dao.insertReply(textAndHtml, pageId,
      replyToPostNrs = Set(parentNr getOrElse PageParts.BodyNr), PostType.Normal, deleteDraftNr = None,
      Who(TrueId(memberId), browserIdData), dummySpamRelReqStuff).post
  }


  def chat(memberId: UserId, pageId: PageId, text: String, skipNashorn: Boolean = true)(dao: SiteDao): Post = {
    val textAndHtml =
      if (skipNashorn) textAndHtmlMaker.testBody(text)
      else textAndHtmlMaker.forBodyOrComment(text)
    dao.insertChatMessage(textAndHtml, pageId, deleteDraftNr = None,
        Who(memberId, browserIdData), dummySpamRelReqStuff).post
  }


  def edit(post: Post, editorId: UserId, newText: String, skipNashorn: Boolean = true)(dao: SiteDao) {
    val textAndHtml =
      if (skipNashorn) textAndHtmlMaker.testBody(newText)
      else textAndHtmlMaker.forBodyOrComment(newText)
    dao.editPostIfAuth(post.pageId, post.nr, deleteDraftNr = None,
        Who(editorId, browserIdData), dummySpamRelReqStuff, textAndHtml)
  }



  def loadUserStats(userId: UserId)(dao: SiteDao): UserStats = {
    dao.readOnlyTransaction { transaction =>
      transaction.loadUserStats(userId) getOrDie "EdE4GPW945"
    }
  }


  def loadTheMemberAndStats(userId: UserId)(dao: SiteDao): (User, UserStats) = {
    dao.readOnlyTransaction { transaction =>
      val member = transaction.loadTheUser(userId)
      val stats = transaction.loadUserStats(userId) getOrDie "EdE2FK4GS"
      (member, stats)
    }
  }

}
