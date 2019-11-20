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
import debiki.{JsonMaker, Settings2}
import ed.server._
import play.api.libs.json._
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
      // settings = ... ?
      // how convert to SettingsToSave?   [06RKGF5]
      // or change to EditedSettings?
      // Maybe remove EditedSettings, and use only SettingsToSave instead,
      // with all inner Options being Some?  So that:
      //   EditedSettings = SettingsToSave[Option[Some[...]]]

      val guests: Seq[Guest] = tx.loadAllGuests().filter(!_.isBuiltIn).sortBy(_.id)
      val guestEmailNotfPrefs: Map[String, EmailNotfPrefs] = tx.loadAllGuestEmailNotfPrefsByEmailAddr()

      val users = tx.loadAllUsersInclDetails().filter(!_.isBuiltIn).sortBy(_.id)

      val pptStats = tx.loadAllUserStats()

      val pageMetas = tx.loadAllPageMetas().sortBy(_.pageId)

      val pagePaths = tx.loadAllPagePaths().sortBy(_.pageId)

      val categories = tx.loadCategoryMap().values.toVector.sortBy(_.id)

      val permsOnPages = tx.loadPermsOnPages()

      val posts = tx.loadAllPosts().sortBy(_.id)

      val postActions: Seq[PostAction] = tx.loadAllPostActions()

      SiteBackup.empty.copy(
        site = Some(site),
        // settings = settings,
        groups = tx.loadAllGroupsAsSeq().sortBy(_.id),
        users = users,
        pptStats = pptStats,
        guests = guests,
        guestEmailNotfPrefs = guestEmailNotfPrefs,
        categories = categories,
        pages = pageMetas,
        pagePaths = pagePaths,
        pageIdsByAltIds = tx.loadAllAltPageIds(),
        permsOnPages = permsOnPages,
        posts = posts,
        postActions = postActions)
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
  def createPostgresqlJsonBackup(anyDump: Option[SiteBackup] = None,  // RENAME makeSiteJsonDump?
        anyTx: Option[SiteTransaction] = None, simpleFormat: Boolean): JsObject = {

    require(anyDump.isDefined != anyTx.isDefined, "TyE0627KTLFRU")

    val fields = mutable.HashMap.empty[String, JsValue]
    def tx = anyTx getOrDie "TyE06RKDJFD"

      val anySite: Option[SiteInclDetails] =
        anyDump.map(_.site) getOrElse Some(tx.loadSiteInclDetails().getOrDie("TyE2S6WKDL"))
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

      // guestEmailNotfPrefs missing?
      // fields("guestEmailPrefs") =  ...

      val groups: Seq[Group] =
        anyDump.map(_.groups) getOrElse tx.loadAllGroupsAsSeq()
      fields("groups") = JsArray(
        groups.map(JsGroupInclDetails(_, inclEmail = true)))

      val groupPps: Seq[GroupParticipant] =
        anyDump.map(_.groupPps) getOrElse tx.loadGroupParticipantsAllCustomGroups()
      fields("groupPps") = JsArray(groupPps.map(JsGroupParticipant))

      val users: Seq[UserInclDetails] =
        anyDump.map(_.users) getOrElse tx.loadAllUsersInclDetails().filter(!_.isBuiltIn)
      fields("members") = JsArray(   // [dump] [exp] RENAME to "users', upd e2e tests
        users.map(JsUserInclDetails(
          _, groups = Nil, usersById = Map.empty, callerIsAdmin = true, inclPasswordHash = true)))

      val pptStats: Seq[UserStats] = anyDump.map(_.pptStats) getOrElse tx.loadAllUserStats()
      fields("ppStats") = JsArray(pptStats.map(JsUserStats(_, isStaffOrSelf = true)))

      val pptVisitStats: Seq[UserVisitStats] =
        anyDump.map(_.pptVisitStats) getOrElse tx.loadAllUserVisitStats()
      fields("ppVisitStats") = JsArray(pptVisitStats.map(JsUserVisitStats))

      val usernameUsages: Seq[UsernameUsage] =
        anyDump.map(_.usernameUsages) getOrElse tx.loadAllUsernameUsages()
      fields("usernameUsages") = JsArray(usernameUsages.map(JsUsernameUsage))

      val identities: Seq[Identity] =
        anyDump.map(_.identities) getOrElse tx.loadAllIdentities()
      fields("identities") = JsArray(
        // Skip OpenID, they're defunct anyway. And skip email identities,
        // maybe even remove them later? They're a bit weird. Instead,
        // a new table with email login secrets? [EMLLGISCRT]
        identities.filter(_.isInstanceOf[OpenAuthIdentity]).map(JsIdentity))

      val invites: Seq[Invite] = anyDump.map(_.invites) getOrElse tx.loadAllInvites(limit = 99999)
      fields("invites") = JsArray(invites.map(JsInvite(_, shallHideEmailLocalPart = false)))

      val notifications: Seq[Notification] =
        anyDump.map(_.notifications) getOrElse tx.loadAllNotifications()
      fields("notifications") = JsArray(notifications.map(JsNotf))

      val emailAddresses: Seq[UserEmailAddress] =
        anyDump.map(_.memberEmailAddrs) getOrElse tx.loadUserEmailAddressesForAllUsers()
      fields("memberEmailAddresses") = JsArray(emailAddresses map JsMemberEmailAddress)

      val pageNotfPrefs: Seq[PageNotfPref] =
        anyDump.map(_.pageNotfPrefs) getOrElse tx.loadAllPageNotfPrefs()
      fields("pageNotfPrefs") = JsArray(pageNotfPrefs.map(JsPageNotfPref))

      val pagePaths: Seq[PagePathWithId] =
        anyDump.map(_.pagePaths) getOrElse tx.loadAllPagePaths()
      fields("pagePaths") = JsArray(
        pagePaths.map(JsPagePathWithId))

      val pageMetas: Seq[PageMeta] =
        anyDump.map(_.pages) getOrElse tx.loadAllPageMetas()
      fields("pages") = JsArray(
        pageMetas.map(pageMeta => {
          var json = JsPageMeta(pageMeta)
          if (simpleFormat) {
            val canonicalPath = pagePaths.find(p =>
              p.pageId == pageMeta.pageId && p.canonical) getOrDie "TyE6WKSJ02X4"
            json += "urlPath" -> JsString(canonicalPath.value)
          }
          json
        }))

      val pageIdsByAltId: Map[AltPageId, PageId] =
        anyDump.map(_.pageIdsByAltIds) getOrElse tx.loadAllAltPageIds()
      fields("pageIdsByAltIds") = JsObject(
        pageIdsByAltId.map(
          (kv: (AltPageId, PageId)) => kv._1.toString -> JsString(kv._2)))

      val categories: Seq[Category] =
        anyDump.map(_.categories) getOrElse tx.loadCategoryMap().values.toSeq
      fields("categories") = JsArray(
        categories.map(category => {
          var json = JsCategoryInclDetails(category)
          if (simpleFormat) {
            // We always include the section page path, added here: [8R392PFP0],
            // and canonical: [602WKDJD2]
            val sectionPagePath = pagePaths.find(p =>
              p.pageId == category.sectionPageId && p.canonical) getOrDie "TyE05WKTSDHSR"
            val basePath = sectionPagePath.value
            val basePathSlash = basePath.dropRightWhile(_ == '/') + '/'
            json +=
              "urlPaths" -> Json.obj(
                // COULD rename latest/ to active/?  [394SMDLW20]
                "activeTopics" -> JsString(basePathSlash + "latest/" + category.slug),
                "topTopics" -> JsString(basePathSlash + "top/" + category.slug),
                "newTopics" -> JsString(basePathSlash + "new/" + category.slug))
          }
          json
        }))

      val permsOnPages: Seq[PermsOnPages] =
        anyDump.map(_.permsOnPages) getOrElse tx.loadPermsOnPages()
      fields("permsOnPages") = JsArray(
        permsOnPages map JsonMaker.permissionToJson)

      val posts: Seq[Post] =
        anyDump.map(_.posts) getOrElse tx.loadAllPosts()
      fields("posts") = JsArray(
        posts map JsPostInclDetails)

      val postsActions: Seq[PostAction] =
        anyDump.map(_.postActions) getOrElse tx.loadAllPostActions()
      fields("postActions") = JsArray(
        postsActions map JsPostAction)

      val reviewTasks: Seq[ReviewTask] =
        anyDump.map(_.reviewTasks) getOrElse tx.loadAllReviewTasks()
      fields("reviewTasks") = JsArray(reviewTasks.map(JsReviewTask))

    JsObject(fields.toSeq)
  }

}

