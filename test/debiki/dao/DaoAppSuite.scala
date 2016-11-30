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
import debiki.TextAndHtml
import org.scalatest._
import org.scalatestplus.play.OneAppPerSuite
import play.api.test.FakeApplication


class DaoAppSuite(
  disableScripts: Boolean = true,
  disableBackgroundJobs: Boolean = true,
  maxSitesTotal: Option[Int] = None)
  extends FreeSpec with MustMatchers with OneAppPerSuite {

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


  def createPasswordOwner(password: String, dao: SiteDao): User = {
    createPasswordAdminOrOwner(password: String, dao: SiteDao, isOwner = true)
  }

  /** Its name will be "Admin $password", username "admin_$password" and email
    * "admin-$password@x.co",
    */
  def createPasswordAdmin(password: String, dao: SiteDao): User = {
    createPasswordAdminOrOwner(password: String, dao: SiteDao, isOwner = false)
  }

  private def createPasswordAdminOrOwner(password: String, dao: SiteDao, isOwner: Boolean): User = {
    dao.createPasswordUserCheckPasswordStrong(NewPasswordUserData.create(
      name = Some(s"Admin $password"), username = s"admin_$password",
      email = s"admin-$password@x.co", password = s"public-$password",
      isAdmin = true, isOwner = isOwner).get)
  }


  def createPasswordModerator(password: String, dao: SiteDao): User = {
    dao.createPasswordUserCheckPasswordStrong(NewPasswordUserData.create(
      name = Some(s"Mod $password"), username = s"mod_$password", email = s"mod-$password@x.co",
      password = s"public-$password", isAdmin = false, isModerator = true, isOwner = false).get)
  }


  /** Its name will be "User $password", username "user_$password" and email "user-$password@x.c",
    */
  def createPasswordUser(password: String, dao: SiteDao,
        trustLevel: TrustLevel = TrustLevel.New,
        threatLevel: ThreatLevel = ThreatLevel.HopefullySafe): Member = {
    dao.createPasswordUserCheckPasswordStrong(NewPasswordUserData.create(
      name = Some(s"User $password"), username = s"user_$password", email = s"user-$password@x.c",
      password = s"public-$password", isAdmin = false, isOwner = false,
      trustLevel = trustLevel, threatLevel = threatLevel).get)
  }


  def createPage(pageRole: PageRole, titleTextAndHtml: TextAndHtml,
        bodyTextAndHtml: TextAndHtml, authorId: UserId, browserIdData: BrowserIdData,
        dao: SiteDao, anyCategoryId: Option[CategoryId] = None): PageId = {
    dao.createPage(pageRole, PageStatus.Published, anyCategoryId = anyCategoryId,
      anyFolder = Some("/"), anySlug = Some(""),
      titleTextAndHtml = titleTextAndHtml, bodyTextAndHtml = bodyTextAndHtml,
      showId = true, Who(authorId, browserIdData), dummySpamRelReqStuff).thePageId
  }

}
