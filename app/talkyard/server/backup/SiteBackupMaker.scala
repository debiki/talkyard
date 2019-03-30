/**
 * Copyright (c) 2019 Kaj Magnus Lindberg
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

import com.debiki.core._
import com.debiki.core.Prelude._
import controllers.ForumController
import debiki.{EffectiveSettings, JsonMaker, Settings2}
import ed.server._
import play.api.libs.json.{JsArray, JsObject, JsValue}
import scala.collection.mutable
import talkyard.server.JsX._



/** Creates json and .tar individual site backup files.
  *
  * Search for [readlater] for stuff ignored right now.
  */
case class SiteBackupMaker(context: EdContext) {

  import context.globals

  private val AllForNow: Int = 100*1000

  def createPostgresqlJsonBackup(siteId: SiteId): JsObject = {
    val fields = mutable.HashMap.empty[String, JsValue]
    globals.siteDao(siteId).readOnlyTransaction { tx =>
      val site: SiteInclDetails = tx.loadSiteInclDetails().getOrDie("TyE2RKKP85")
      fields("meta") =
        JsSiteInclDetails(site)

      val anyEditeSiteSettings = tx.loadSiteSettings()
      fields("settings") =
        anyEditeSiteSettings.map(Settings2.settingsToJson) getOrElse JsEmptyObj

      val guests: Seq[Guest] = tx.loadAllGuests().filter(!_.isBuiltIn)
      fields("guests") = JsArray(
        guests.map(JsGuestInclDetails(_, inclEmail = true)))

      val groups = tx.loadAllGroupsAsSeq()
      fields("groups") = JsArray(
        groups.map(JsGroupInclDetails(_, inclEmail = true)))

      val users = tx.loadAllUsersInclDetails().filter(!_.isBuiltIn)
      fields("members") = JsArray(   // [dump] [exp] RENAME to "users', upd e2e tests
        users.map(JsUserInclDetails(_, groups = Nil, usersById = Map.empty, callerIsAdmin = true)))

      val emailAddresses: Seq[UserEmailAddress] = tx.loadUserEmailAddressesForAllUsers()
      fields("memberEmailAddresses") = JsArray(
        emailAddresses map JsMemberEmailAddress)

      val invites: Seq[Invite] = tx.loadAllInvites(limit = AllForNow)
      fields("invites") = JsArray(
        invites.map(JsInvite(_, shallHideEmailLocalPart = false)))

      val pageMetas = tx.loadAllPageMetas()
      fields("pages") = JsArray(
        pageMetas.map(JsPageMeta))

      val pagePaths = tx.loadAllPagePaths()
      fields("pagePaths") = JsArray(
        pagePaths.map(JsPagePathWithId))

      val categories = tx.loadCategoryMap().values.toSeq
      fields("categories") = JsArray(
        categories.map(JsCategoryInclDetails))

      val permsOnPages = tx.loadPermsOnPages()
      fields("permsOnPages") = JsArray(
        permsOnPages map JsonMaker.permissionToJson)

      val posts = tx.loadAllPosts()
      fields("posts") = JsArray(
        posts map JsPostInclDetails)
    }

    JsObject(fields.toSeq)
  }

}

