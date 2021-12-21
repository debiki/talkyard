/**
 * Copyright (C) 2013 Kaj Magnus Lindberg (born 1979)
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

package com.debiki.dao.rdb

import com.debiki.core._
import com.debiki.core.Prelude._
import _root_.java.{sql => js}
import Rdb._
import com.debiki.core.DbDao.{SiteAlreadyExistsException, TooManySitesCreatedByYouException, TooManySitesCreatedInTotalException}
import scala.collection.mutable.ArrayBuffer


trait CreateSiteSystemDaoMixin extends SystemTransaction {  // RENAME to SystemSiteRdbMixin
  self: RdbSystemTransaction =>


  private val LocalhostAddress = "127.0.0.1"


  def createSite(id: Option[SiteId], pubId: PubSiteId,
    name: String, status: SiteStatus, creatorIp: String,
    quotaLimitMegabytes: Option[Int], maxSitesPerIp: Int, maxSitesTotal: Int,
    isTestSiteOkayToDelete: Boolean, createdAt: When): Site = {

    // Unless apparently testing from localhost, don't allow someone to create
    // very many sites.
    if (creatorIp != LocalhostAddress) {
      val websiteCount = countWebsites(
        createdFromIp = creatorIp, creatorEmailAddress = None,
        testSites = isTestSiteOkayToDelete)
      if (websiteCount >= maxSitesPerIp)
        throw TooManySitesCreatedByYouException(creatorIp)

      val numSitesTotal = countWebsitesTotal(isTestSiteOkayToDelete)
      if (numSitesTotal >= maxSitesTotal)
        throw TooManySitesCreatedInTotalException
    }

    // Ought to move this id generation stuff to the caller instead, i.e. CreateSiteDao.  Hmm?
    val theId = id getOrElse {
      if (isTestSiteOkayToDelete) Site.GenerateTestSiteMagicId
      else NoSiteId
    }

    val newSiteNoId = Site(theId, pubId = pubId, status, name = name,
          createdAt = createdAt, creatorIp = creatorIp, featureFlags = "",
          hostnames = Vector.empty,
          readLimitsMultiplier = None,
          logLimitsMultiplier = None,
          createLimitsMultiplier = None)

    val newSite =
      try insertSite(newSiteNoId, quotaLimitMegabytes)
      catch {
        case ex: js.SQLException =>
          if (!isUniqueConstrViolation(ex)) throw ex
          throw SiteAlreadyExistsException(newSiteNoId, ex.getMessage)
      }

    newSite
  }


  def countWebsites(createdFromIp: String, creatorEmailAddress: Option[String], testSites: Boolean)
        : Int = {
    val values = ArrayBuffer[AnyRef](createdFromIp)
    val smallerOrGreaterThan = if (testSites) "<=" else ">"
    val orEmailAddrIsSth = creatorEmailAddress match {
      case None => ""
      case Some(addr) =>
        values.append(addr)
        " or CREATOR_EMAIL_ADDRESS = ?"
    }
    val query = s"""
        select count(*) WEBSITE_COUNT from sites3
        where (CREATOR_IP = ? $orEmailAddrIsSth)
          and id $smallerOrGreaterThan $MaxTestSiteId
        """
    runQueryFindExactlyOne(query, values.toList, rs => {
      rs.getInt("WEBSITE_COUNT")
    })
  }


  def countWebsitesTotal(testSites: Boolean): Int = {
    val smallerOrGreaterThan = if (testSites) "<=" else ">"
    val query =
      s"select count(*) site_count from sites3 where id $smallerOrGreaterThan $MaxTestSiteId"
    runQueryFindExactlyOne(query, Nil, rs => {
      rs.getInt("site_count")
    })
  }


  private def insertSite(siteNoId: Site, quotaLimitMegabytes: Option[Int])
        : Site = {
    // For now
    val databaseQuotaMiB = quotaLimitMegabytes
    val fileSysQuotaMiB = quotaLimitMegabytes

    val newId = siteNoId.id match {
      case NoSiteId =>
        db.nextSeqNo("DW1_TENANTS_ID")(theOneAndOnlyConnection).toInt
      case Site.GenerateTestSiteMagicId =>
        // Let's start on -11 and continue counting downwards. (Test site ids are negative.)
        runQueryFindExactlyOne("select least(-10, min(id)) - 1 next_test_site_id from sites3",
          Nil, _.getInt("next_test_site_id"))
      case _ =>
        siteNoId.id
    }

    val site = siteNoId.copy(id = newId)
    runUpdateSingleRow("""
        insert into sites3 (
          ID, publ_id, status, NAME, ctime, CREATOR_IP,
          rdb_quota_mibs_c, file_quota_mibs_c)
        values (?, ?, ?, ?, ?, ?, ?, ?)""",
      List[AnyRef](site.id.asAnyRef, site.pubId, site.status.toInt.asAnyRef, site.name,
        site.createdAt.asTimestamp, site.creatorIp,
        databaseQuotaMiB.orNullInt,
        fileSysQuotaMiB.orNullInt))
    site
  }


  def deleteAnyHostname(hostname: String): Boolean = {
    // For now, safety check. Remove if needed.
    require(Hostname.isE2eTestHostname(hostname), "EdE5GPQ0V")
    val sql = """
      delete from hosts3 where host = ?
      """
    runUpdateSingleRow(sql, List(hostname))
  }


  def insertSiteHost(siteId: SiteId, host: Hostname) {
    val cncl = host.role match {
      case Hostname.RoleCanonical => "C"
      case Hostname.RoleRedirect => "R"
      case Hostname.RoleLink => "L"
      case Hostname.RoleDuplicate => "D"
      case Hostname.RoleDeleted => "X"
    }
    val sql = """
      insert into hosts3 (SITE_ID, HOST, CANONICAL, ctime, mtime)
      values (?, ?, ?, ?, ?)
      """
    val values = List(siteId.asAnyRef, host.hostname, cncl, now.asTimestamp, now.asTimestamp)
    val inserted =
      try runUpdateSingleRow(sql, values)
      catch {
        case ex: js.SQLException =>
          if (Rdb.isUniqueConstrViolation(ex) &&
              Rdb.uniqueConstrViolatedIs("dw1_tnthsts_host__u", ex))
            throw DuplicateHostnameException(host.hostname)
          else
            throw ex
      }
    dieIf(!inserted, "EdE4KEWW2")
  }


  def deleteSiteById(siteId: SiteId, mayDeleteRealSite: Bo, keepHostname: Bo): Bo = {
    require(mayDeleteRealSite || siteId <= MaxTestSiteId,
      s"Trying to delete real site $siteId, but may delete test sites only [TyEDELREALID]")

    runUpdate("set constraints all deferred")

    // Dupl code [7KUW0ZT2]
    val statements = (s"""
      delete from audit_log3 where site_id = ?
      delete from index_queue3 where site_id = ?
      delete from spam_check_queue3 where site_id = ?
      delete from tags_t where site_id_c = ?
      delete from tagtypes_t where site_id_c = ?
      delete from links_t where site_id_c = ?
      delete from link_previews_t where site_id_c = ?
      delete from review_tasks3 where site_id = ?
      delete from perms_on_pages3 where site_id = ?
      delete from settings3 where site_id = ?
      delete from drafts3 where site_id = ?
      delete from post_read_stats3 where site_id = ?
      delete from notifications3 where site_id = ?
      delete from notices_t where site_id_c = ?
      delete from emails_out3 where site_id = ?
      delete from upload_refs3 where site_id = ?""" +
      // skip: uploads3, not per-site. But... latent BUG: should update upload ref counts,
      // since we deleted a site & emptied upload_refs3.
      s"""
      delete from page_users3 where site_id = ?
      delete from disc_notf_prefs_t where site_id = ?
      delete from disc_prefs_t where site_id_c = ?
      delete from tag_notf_levels3 where site_id = ?
      delete from post_tags3 where site_id = ?
      delete from post_actions3 where site_id = ?
      delete from post_revisions3 where site_id = ?
      delete from posts3 where site_id = ?
      delete from page_popularity_scores3 where site_id =?
      delete from page_paths3 where site_id = ?
      delete from page_html3 where site_id = ?
      delete from alt_page_ids3 where site_id = ?
      delete from pages3 where site_id = ?
      delete from categories3 where site_id = ?
      delete from blocks3 where site_id = ?
      delete from guest_prefs3 where site_id = ?
      delete from identities3 where site_id = ?
      delete from idps_t where site_id_c = ?
      delete from invites3 where site_id = ?
      delete from api_secrets3 where site_id = ?
      delete from user_visit_stats3 where site_id = ?
      delete from user_stats3 where site_id = ?
      delete from usernames3 where site_id = ?
      delete from user_emails3 where site_id = ?
      delete from group_participants3 where site_id = ?
      delete from sessions_t where site_id_c = ?
      delete from users3 where site_id = ?
      """).trim.split("\n").toBuffer

    if (keepHostname) {
      // Mark hostnames as deleted, but don't forget them.
      statements.append("update hosts3 set canonical = 'X' where site_id = ?")
    }
    else {
      statements.append("delete from hosts3 where site_id = ?")
    }

    var foundAnything = false
    statements foreach { statement =>
      val numRowsChanged = runUpdate(statement, List(siteId.asAnyRef))
      foundAnything ||= numRowsChanged > 0
    }

    // Now all tables are empty, but there's still an entry for the site itself in sites3.
    // If we're able to delete it, then the site is really gone (otherwise, it never existed).
    // But if we'll remember the hostnames, just mark it as purged.
    val isSiteGone = {
      if (keepHostname) {
        runUpdateSingleRow(s"""
              update sites3 set
                  status = ${SiteStatus.Purged.toInt},
                  purged_at_c = ?
              where id = ? """,
              List(now.asTimestamp, siteId.asAnyRef))
      }
      else {
        runUpdateSingleRow(
              "delete from sites3 where id = ?", List(siteId.asAnyRef))
      }
    }

    runUpdate("set constraints all immediate")
    isSiteGone
  }

}


