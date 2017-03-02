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
import ed.server.http.throwForbidden2
import CreateSiteDao._



/** Creates new sites, via this site. That is, a user accesses server-adress/-/create-site
  * on this site, and creates another site.
  */
trait CreateSiteDao {
  self: SiteDao =>


  def createSite(name: String, status: SiteStatus, hostname: String,
        embeddingSiteUrl: Option[String], organizationName: String,
        creatorEmailAddress: String, creatorId: UserId, browserIdData: BrowserIdData,
        isTestSiteOkayToDelete: Boolean, skipMaxSitesCheck: Boolean,
        deleteOldSite: Boolean, pricePlan: PricePlan)
        : Site = {

    if (!Site.isOkayName(name))
      throwForbidden2("EsE7UZF2_", s"Bad site name: '$name'")

    dieIf(hostname contains ":", "DwE3KWFE7")
    val maxSitesPerIp = skipMaxSitesCheck ? 999999 | config.createSite.maxSitesPerPerson
    val maxSitesTotal = skipMaxSitesCheck ? 999999 | {
      // Allow a little bit more than maxSitesTotal sites, in case Alice starts creating
      // a site, then Bo and Bob finish creating theirs so that the total limit is reached
      // — then it'd be annoying if Alice gets an error message.
      config.createSite.maxSitesTotal + 5
    }

    readWriteTransaction { transaction =>
      if (deleteOldSite) {
        dieUnless(hostname.startsWith(SiteHost.E2eTestPrefix), "EdE7PK5W8")
        dieUnless(name.startsWith(SiteHost.E2eTestPrefix), "EdE50K5W4")
        transaction.asSystem.deleteAnyHostname(hostname)
        transaction.asSystem.deleteSiteByName(name)
        // Should add this CreateSiteDao to SystemDao instead? This is a bit weird:
        debiki.Globals.systemDao.forgetHostname(hostname)
      }

      val newSite = transaction.asSystem.createSite(id = None, name = name, status,
        embeddingSiteUrl, creatorIp = browserIdData.ip, creatorEmailAddress = creatorEmailAddress,
        quotaLimitMegabytes = config.createSite.quotaLimitMegabytes,
        maxSitesPerIp = maxSitesPerIp, maxSitesTotal = maxSitesTotal,
        isTestSiteOkayToDelete = isTestSiteOkayToDelete, pricePlan = pricePlan, transaction.now)

      insertAuditLogEntry(AuditLogEntry(
        siteId = this.siteId,
        id = AuditLogEntry.UnassignedId,
        didWhat = AuditLogEntryType.CreateSite,
        doerId = creatorId,
        doneAt = transaction.now.toJavaDate,
        emailAddress = Some(creatorEmailAddress),
        browserIdData = browserIdData,
        browserLocation = None,
        targetSiteId = Some(newSite.id)), transaction)

      transaction.setSiteId(newSite.id)
      transaction.startAuditLogBatch()

      transaction.upsertSiteSettings(SettingsToSave(
        orgFullName = Some(Some(organizationName))))

      val newSiteHost = SiteHost(hostname, SiteHost.RoleCanonical)
      try transaction.insertSiteHost(newSiteHost)
      catch {
        case _: DuplicateHostnameException =>
          throwForbidden2(
            "EdE7FKW20", o"""There's already a site with hostname '${newSiteHost.hostname}'. Add
            the URL param deleteOldSite=true to delete it (works for e2e tests only)""")
      }

      createSystemUser(transaction)
      createUnknownUser(transaction)
      createDefaultGroupsAndPermissions(transaction)

      insertAuditLogEntry(AuditLogEntry(
        siteId = newSite.id,
        id = AuditLogEntry.UnassignedId,
        didWhat = AuditLogEntryType.ThisSiteCreated,
        doerId = SystemUserId, // no admin account yet created
        doneAt = transaction.now.toJavaDate,
        emailAddress = Some(creatorEmailAddress),
        browserIdData = browserIdData,
        browserLocation = None,
        targetSiteId = Some(this.siteId)), transaction)

      newSite.copy(hosts = List(newSiteHost))
    }
  }
}


object CreateSiteDao {

  def createSystemUser(transaction: SiteTransaction) {
    val systemUser = MemberInclDetails(
      id = SystemUserId,
      fullName = Some(SystemUserFullName),
      username = SystemUserUsername,
      createdAt = transaction.now.toJavaDate,
      isApproved = None,
      approvedAt = None,
      approvedById = None,
      emailAddress = "",
      emailNotfPrefs = EmailNotfPrefs.DontReceive,
      emailVerifiedAt = None)
    transaction.insertMember(systemUser)
    transaction.upsertUserStats(UserStats.forNewUser(
      SystemUserId, firstSeenAt = transaction.now, emailedAt = None))
    transaction.insertUsernameUsage(UsernameUsage(
      username = systemUser.username, inUseFrom = transaction.now, userId = systemUser.id))
  }


  def createUnknownUser(transaction: SiteTransaction) {
    transaction.createUnknownUser()
    transaction.upsertUserStats(UserStats.forNewUser(
      UnknownUserId, firstSeenAt = transaction.now, emailedAt = None))
  }


  def createDefaultGroupsAndPermissions(tx: SiteTransaction) {
    import Group._

    val Everyone = Group(
      EveryoneId, "everyone", "Everyone", grantsTrustLevel = None)
    val New = Group(
      NewMembersId, "new_members", "New Members", grantsTrustLevel = Some(TrustLevel.New))
    val Basic = Group(
      BasicMembersId, "basic_members", "Basic Members", grantsTrustLevel = Some(TrustLevel.Basic))
    val Full = Group(
      FullMembersId, "full_members", "Full Members", grantsTrustLevel = Some(TrustLevel.FullMember))
    val Trusted = Group(
      TrustedId, "trusted_members", "Trusted Members", grantsTrustLevel = Some(TrustLevel.Helper))
    val Regular = Group(
      RegularsId, "regular_members", "Regular Members", grantsTrustLevel = Some(TrustLevel.Regular))
    val Core = Group(
      CoreMembersId, "core_members", "Core Members", grantsTrustLevel = Some(TrustLevel.CoreMember))
    val Staff = Group(
      StaffId, "staff", "Staff", grantsTrustLevel = None)
    val Moderators = Group(
      ModeratorsId, "moderators", "Moderators", grantsTrustLevel = None)
    val Admins = Group(
      AdminsId, "admins", "Admins", grantsTrustLevel = None)

    insertGroupAndUsernameUsage(Everyone, tx)
    insertGroupAndUsernameUsage(New, tx)
    insertGroupAndUsernameUsage(Basic, tx)
    insertGroupAndUsernameUsage(Full, tx)
    insertGroupAndUsernameUsage(Trusted, tx)
    insertGroupAndUsernameUsage(Regular, tx)
    insertGroupAndUsernameUsage(Core, tx)
    insertGroupAndUsernameUsage(Staff, tx)
    insertGroupAndUsernameUsage(Moderators, tx)
    insertGroupAndUsernameUsage(Admins, tx)
  }


  private def insertGroupAndUsernameUsage(group: Group, tx: SiteTransaction) {
    tx.insertGroup(group)
    tx.insertUsernameUsage(UsernameUsage(username = group.theUsername, tx.now, userId = group.id))
  }

}

