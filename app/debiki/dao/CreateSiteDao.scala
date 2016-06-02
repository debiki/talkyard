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
import controllers.CreateSiteController
import io.efdi.server.http.throwForbidden2
import play.{api => p}
import play.api.Play.current



/** Creates new sites, via this site. That is, a user accesses server-adress/-/create-site
  * on this site, and creates another site.
  */
trait CreateSiteDao {
  self: SiteDao =>

  def createSite(name: String, hostname: String,
        embeddingSiteUrl: Option[String], organizationName: String,
        creatorEmailAddress: String, creatorId: UserId, browserIdData: BrowserIdData,
        isTestSiteOkayToDelete: Boolean, skipMaxSitesCheck: Boolean) : Site = {

    if (!CreateSiteController.isOkaySiteName(name))
      throwForbidden2("DwE7UKF2", s"Bad site name: '$name'")

    dieIf(hostname contains ":", "DwE3KWFE7")
    val quotaLimitMegabytes = p.Play.configuration.getInt("debiki.newSite.quotaLimitMegabytes")

    readWriteTransaction { transaction =>
      val newSite = transaction.createSite(name = name, hostname = hostname,
        embeddingSiteUrl, creatorIp = browserIdData.ip, creatorEmailAddress = creatorEmailAddress,
        quotaLimitMegabytes = quotaLimitMegabytes,
        isTestSiteOkayToDelete = isTestSiteOkayToDelete, skipMaxSitesCheck = skipMaxSitesCheck)

      insertAuditLogEntry(AuditLogEntry(
        siteId = this.siteId,
        id = AuditLogEntry.UnassignedId,
        didWhat = AuditLogEntryType.CreateSite,
        doerId = creatorId,
        doneAt = transaction.currentTime,
        emailAddress = Some(creatorEmailAddress),
        browserIdData = browserIdData,
        browserLocation = None,
        targetSiteId = Some(newSite.id)), transaction)

      transaction.setSiteId(newSite.id)
      transaction.startAuditLogBatch()

      transaction.upsertSiteSettings(SettingsToSave(
        orgFullName = Some(Some(organizationName))))

      val newSiteHost = SiteHost(hostname, SiteHost.RoleCanonical)
      transaction.insertSiteHost(newSiteHost)

      createSystemUser(transaction)
      transaction.createUnknownUser(transaction.currentTime)

      insertAuditLogEntry(AuditLogEntry(
        siteId = newSite.id,
        id = AuditLogEntry.UnassignedId,
        didWhat = AuditLogEntryType.ThisSiteCreated,
        doerId = SystemUserId, // no admin account yet created
        doneAt = transaction.currentTime,
        emailAddress = Some(creatorEmailAddress),
        browserIdData = browserIdData,
        browserLocation = None,
        targetSiteId = Some(this.siteId)), transaction)

      newSite.copy(hosts = List(newSiteHost))
    }
  }


  private def createSystemUser(transaction: SiteTransaction) {
    transaction.insertAuthenticatedUser(CompleteUser(
      id = SystemUserId,
      fullName = Some(SystemUserFullName),
      username = SystemUserUsername,
      createdAt = transaction.currentTime,
      isApproved = None,
      approvedAt = None,
      approvedById = None,
      emailAddress = "",
      emailNotfPrefs = EmailNotfPrefs.DontReceive,
      emailVerifiedAt = None))
  }

}

