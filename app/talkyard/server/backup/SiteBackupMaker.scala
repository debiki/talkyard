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
case class SiteBackupMaker(context: EdContext) {  // RENAME to SiteDumpLoader ...Maker?

  import context.globals


  def loadSiteDump(siteId: SiteId): SiteBackup = {
    globals.siteDao(siteId).readOnlyTransaction { tx =>
      val site: SiteInclDetails = tx.loadSiteInclDetails().getOrDie("TyE2RKKP85")

      //val anyEditeSiteSettings = tx.loadSiteSettings()
      // how convert to SettingsToSave?   [06RKGF5]
      // or change to EditedSetings?

      val guests: Seq[Guest] = tx.loadAllGuests().filter(!_.isBuiltIn).sortBy(_.id)
      val guestEmailNotfPrefs: Map[String, EmailNotfPrefs] = tx.loadAllGuestEmailNotfPrefsByEmailAddr()

      val users = tx.loadAllUsersInclDetails().filter(!_.isBuiltIn).sortBy(_.id)

      // memberEmailAddresses: Seq[UserEmailAddress] = tx.loadUserEmailAddressesForAllUsers()

      // invites: Seq[Invite] = tx.loadAllInvites(limit = AllForNow)

      val pageMetas = tx.loadAllPageMetas().sortBy(_.pageId)

      val pagePaths = tx.loadAllPagePaths().sortBy(_.pageId)

      val categories = tx.loadCategoryMap().values.toVector.sortBy(_.id)

      val permsOnPages = tx.loadPermsOnPages()

      val posts = tx.loadAllPosts().sortBy(_.id)

      SiteBackup.empty.copy(
        site = Some(site),
        // groups = tx.loadAllGroupsAsSeq().sortBy(_.id),
        users = users,
        guests = guests,
        guestEmailNotfPrefs = guestEmailNotfPrefs,
        categories = categories,
        pages = pageMetas,
        pagePaths = pagePaths,
        permsOnPages = permsOnPages,
        posts = posts)
    }
  }
}


object SiteBackupMaker {

  private val AllForNow: Int = 100*1000

  /** Serializes (parts of) a site as json. Either loads everything from a database
    * transaction, or wants a SitePatch with the data that is to be exported.
    *
    * (Some time later, for really large sites, might be better to load things directly
    * from a db transaction, rather than creating an intermediate representation.)
    */
  def createPostgresqlJsonBackup(anyDump: Option[SiteBackup] = None,
        anyTx: Option[SiteTransaction] = None): JsObject = {

    require(anyDump.isDefined != anyTx.isDefined, "TyE0627KTLFRU")

    val fields = mutable.HashMap.empty[String, JsValue]
    lazy val tx = anyTx getOrDie "TyE06RKDJFD"

      val anySite: Option[SiteInclDetails] =
        anyDump.map(_.site) getOrElse Some(tx.loadSiteInclDetails().getOrDie("TyE2RKKP85"))
      anySite foreach { site =>
        fields("meta") =
          JsSiteInclDetails(site)
      }

      val anyEditeSiteSettings =
        if (anyDump.isDefined) None // for now, see above [06RKGF5]
        else tx.loadSiteSettings()
      fields("settings") =
        anyEditeSiteSettings.map(Settings2.settingsToJson) getOrElse JsEmptyObj

      val guests: Seq[Guest] =
        anyDump.map(_.guests) getOrElse tx.loadAllGuests().filter(!_.isBuiltIn)
      fields("guests") = JsArray(
        guests.map(JsGuestInclDetails(_, inclEmail = true)))

      val groups =
        anyDump.map(_.groups) getOrElse tx.loadAllGroupsAsSeq()
      fields("groups") = JsArray(
        groups.map(JsGroupInclDetails(_, inclEmail = true)))

      val users =
        anyDump.map(_.users) getOrElse tx.loadAllUsersInclDetails().filter(!_.isBuiltIn)
      fields("members") = JsArray(   // [dump] [exp] RENAME to "users', upd e2e tests
        users.map(JsUserInclDetails(_, groups = Nil, usersById = Map.empty, callerIsAdmin = true)))

      val emailAddresses: Seq[UserEmailAddress] =
        if (anyDump.isDefined) Vector.empty  // for now, not incl in dump
        else tx.loadUserEmailAddressesForAllUsers()
      fields("memberEmailAddresses") = JsArray(
        emailAddresses map JsMemberEmailAddress)

      val invites: Seq[Invite] =
        if (anyDump.isDefined) Vector.empty  // for now, not incl in dump
        else tx.loadAllInvites(limit = AllForNow)
      fields("invites") = JsArray(
        invites.map(JsInvite(_, shallHideEmailLocalPart = false)))

      val pageMetas: Seq[PageMeta] =
        anyDump.map(_.pages) getOrElse tx.loadAllPageMetas()
      fields("pages") = JsArray(
        pageMetas.map(JsPageMeta))

      val pagePaths: Seq[PagePathWithId] =
        anyDump.map(_.pagePaths) getOrElse tx.loadAllPagePaths()
      fields("pagePaths") = JsArray(
        pagePaths.map(JsPagePathWithId))

      val categories: Seq[Category] =
        anyDump.map(_.categories) getOrElse tx.loadCategoryMap().values.toSeq
      fields("categories") = JsArray(
        categories.map(JsCategoryInclDetails))

      val permsOnPages: Seq[PermsOnPages] =
        anyDump.map(_.permsOnPages) getOrElse tx.loadPermsOnPages()
      fields("permsOnPages") = JsArray(
        permsOnPages map JsonMaker.permissionToJson)

      val posts: Seq[Post] =
        anyDump.map(_.posts) getOrElse tx.loadAllPosts()
      fields("posts") = JsArray(
        posts map JsPostInclDetails)


    JsObject(fields.toSeq)
  }

}

