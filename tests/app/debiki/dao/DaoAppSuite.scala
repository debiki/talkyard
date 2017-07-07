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
import debiki.{Globals, TextAndHtml}
import org.scalatest._
import org.scalatestplus.play.guice.GuiceOneAppPerSuite
import play.api.test.FakeApplication


class DaoAppSuite(
  disableScripts: Boolean = true,
  disableBackgroundJobs: Boolean = true,
  maxSitesTotal: Option[Int] = None)
  extends FreeSpec with MustMatchers with GuiceOneAppPerSuite {

  private val extraConfig: Map[String, String] = {
    var config = Map[String, String](
      "isTestShallEmptyDatabase" -> "true",
      "isTestDisableScripts" -> (disableScripts ? "true" | "false"),
      "isTestDisableBackgroundJobs" -> (disableBackgroundJobs ? "true" | "false"))
    import debiki.Config._
    maxSitesTotal foreach { max =>
      config = config.updated(s"$CreateSitePath.maxSitesTotal", max.toString)
    }
    config
  }

  implicit override lazy val app = FakeApplication(additionalConfiguration = extraConfig)

  def browserIdData = BrowserIdData("1.2.3.4", idCookie = "dummy_id_cookie", fingerprint = 334455)

  def dummySpamRelReqStuff = SpamRelReqStuff(userAgent = None, referer = None, uri = "/dummy")


  /** If the test start time is less than a year after 1970, the popularity stats will
    * subtract a year and create a negative Unix-millis-time —> an assertion fails. So start
    * at least a year after 1970 — let's say 1157 days, to get a nice looking number: 100...000.
    */
  val OneAndZeros1157DaysInMillis = 100000000000L // divide by (24*3600*1000) —> 1157.4 days

  def startTime: When = When.fromMillis(10 * 1000 + OneAndZeros1157DaysInMillis)

  private var _currentTime: When = _
  def currentTime: When = _currentTime

  def setTime(when: When) {
    _currentTime = when
    Globals.test.setTime(when)
  }
  setTime(startTime)

  def playTime(millis: Long) {
    _currentTime = _currentTime plusMillis millis
    Globals.test.setTime(_currentTime)
  }


  def createSite(hostname: String): Site = {
    val siteName = "site-" + hostname.replaceAllLiterally(".", "")
    Globals.systemDao.createSite(
      siteName, status = SiteStatus.Active, hostname = hostname,
      embeddingSiteUrl = None, organizationName = s"Site $hostname Organization Name",
      creatorEmailAddress = s"admin@$hostname.co", creatorId = UnknownUserId, browserIdData,
      isTestSiteOkayToDelete = true, skipMaxSitesCheck = true,
      deleteOldSite = false, pricePlan = "Unknown", createdFromSiteId = None)
  }


  def createPasswordOwner(password: String, dao: SiteDao,
        createdAt: Option[When] = None, firstSeenAt: Option[When] = None): Member = {
    createPasswordAdminOrOwner(password: String, dao: SiteDao, createdAt = createdAt,
        firstSeenAt = firstSeenAt, isOwner = true)
  }

  /** Its name will be "Admin $password", username "admin_$password" and email
    * "admin-$password@x.co",
    */
  def createPasswordAdmin(password: String, dao: SiteDao, createdAt: Option[When] = None,
        firstSeenAt: Option[When] = None): Member = {
    createPasswordAdminOrOwner(password: String, dao: SiteDao, createdAt = createdAt,
      firstSeenAt = firstSeenAt, isOwner = false)
  }

  private def createPasswordAdminOrOwner(password: String, dao: SiteDao, isOwner: Boolean,
      createdAt: Option[When], firstSeenAt: Option[When] = None): Member = {
    dao.createPasswordUserCheckPasswordStrong(NewPasswordUserData.create(
      name = Some(s"Admin $password"), username = s"admin_$password",
      email = s"admin-$password@x.co", password = s"public-$password",
      createdAt = createdAt.getOrElse(Globals.now()),
      isAdmin = true, isOwner = isOwner).get)
  }


  def createPasswordModerator(password: String, dao: SiteDao, createdAt: Option[When] = None)
        : Member = {
    dao.createPasswordUserCheckPasswordStrong(NewPasswordUserData.create(
      name = Some(s"Mod $password"), username = s"mod_$password", email = s"mod-$password@x.co",
      password = s"public-$password", createdAt = createdAt.getOrElse(Globals.now()),
      isAdmin = false, isModerator = true, isOwner = false).get)
  }


  /** Its name will be "User $password", username "user_$password" and email "user-$password@x.c",
    */
  def createPasswordUser(password: String, dao: SiteDao,
        trustLevel: TrustLevel = TrustLevel.NewMember,
        threatLevel: ThreatLevel = ThreatLevel.HopefullySafe,
        createdAt: Option[When] = None): Member = {
    dao.createPasswordUserCheckPasswordStrong(NewPasswordUserData.create(
      name = Some(s"User $password"), username = s"user_$password", email = s"user-$password@x.c",
      password = s"public-$password", createdAt = createdAt.getOrElse(Globals.now()),
      isAdmin = false, isOwner = false, trustLevel = trustLevel, threatLevel = threatLevel).get)
  }


  def updateMemberPreferences(dao: SiteDao, memberId: UserId,
        fn: Function1[MemberPreferences, MemberPreferences]) {
    val member = dao.loadTheMemberInclDetailsById(memberId)
    dao.saveMemberPreferences(fn(member.preferences), Who(memberId, browserIdData))
  }


  def updateGroupPreferences(dao: SiteDao, groupId: UserId,
        fn: Function1[GroupPreferences, GroupPreferences]) {
    val group = dao.loadGroupInclDetailsById(groupId) getOrDie "EdE1FWVKA0"
    dao.saveGroupPreferences(fn(group.preferences), Who(groupId, browserIdData))
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


  def createPage(pageRole: PageRole, titleTextAndHtml: TextAndHtml,
        bodyTextAndHtml: TextAndHtml, authorId: UserId, browserIdData: BrowserIdData,
        dao: SiteDao, anyCategoryId: Option[CategoryId] = None): PageId = {
    dao.createPage(pageRole, PageStatus.Published, anyCategoryId = anyCategoryId,
      anyFolder = Some("/"), anySlug = Some(""),
      titleTextAndHtml = titleTextAndHtml, bodyTextAndHtml = bodyTextAndHtml,
      showId = true, Who(authorId, browserIdData), dummySpamRelReqStuff).thePageId
  }


  def reply(memberId: UserId, pageId: PageId, text: String, parentNr: Option[PostNr] = None)(
        dao: SiteDao): Post = {
    dao.insertReply(TextAndHtml.testBody(text), pageId,
      replyToPostNrs = Set(parentNr getOrElse PageParts.BodyNr), PostType.Normal,
      Who(memberId, browserIdData), dummySpamRelReqStuff).post
  }


  def chat(memberId: UserId, pageId: PageId, text: String)(dao: SiteDao): Post = {
    dao.insertChatMessage(TextAndHtml.testBody(text), pageId,
      Who(memberId, browserIdData), dummySpamRelReqStuff).post
  }


  def edit(post: Post, editorId: UserId, newText: String)(dao: SiteDao) {
    dao.editPostIfAuth(post.pageId, post.nr, Who(editorId, browserIdData), dummySpamRelReqStuff,
        TextAndHtml.testBody(newText))
  }



  def loadUserStats(userId: UserId)(dao: SiteDao): UserStats = {
    dao.readOnlyTransaction { transaction =>
      transaction.loadUserStats(userId) getOrDie "EdE4GPW945"
    }
  }


  def loadTheMemberAndStats(userId: UserId)(dao: SiteDao): (Member, UserStats) = {
    dao.readOnlyTransaction { transaction =>
      val member = transaction.loadTheMember(userId)
      val stats = transaction.loadUserStats(userId) getOrDie "EdE2FK4GS"
      (member, stats)
    }
  }

}
