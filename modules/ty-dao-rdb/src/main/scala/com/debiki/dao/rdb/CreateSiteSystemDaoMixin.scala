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


  def createSite(id: Option[SiteId], pubId: PublSiteId,
    name: String, status: SiteStatus, creatorIp: String,
    quotaLimitMegabytes: Option[Int], maxSitesPerIp: Int, maxSitesTotal: Int,
    isTestSiteOkayToDelete: Boolean, pricePlan: PricePlan, createdAt: When): Site = {

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

    val newSiteNoId = Site(theId, pubId = pubId, status, name = name, createdAt = createdAt,
      creatorIp = creatorIp, hosts = Nil)

    val newSite =
      try insertSite(newSiteNoId, quotaLimitMegabytes, pricePlan)
      catch {
        case ex: js.SQLException =>
          if (!isUniqueConstrViolation(ex)) throw ex
          throw SiteAlreadyExistsException(newSiteNoId)
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


  private def insertSite(siteNoId: Site, quotaLimitMegabytes: Option[Int], pricePlan: PricePlan)
        : Site = {
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
          ID, publ_id, status, NAME, CREATOR_IP,
          QUOTA_LIMIT_MBS, price_plan)
        values (?, ?, ?, ?, ?, ?, ?)""",
      List[AnyRef](site.id.asAnyRef, site.pubId, site.status.toInt.asAnyRef, site.name,
        site.creatorIp, quotaLimitMegabytes.orNullInt, pricePlan))
    site
  }


  def deleteAnyHostname(hostname: String): Boolean = {
    // For now, safety check. Remove if needed.
    require(SiteHost.isE2eTestHostname(hostname), "EdE5GPQ0V")
    val sql = """
      delete from hosts3 where host = ?
      """
    runUpdateSingleRow(sql, List(hostname))
  }


  def insertSiteHost(siteId: SiteId, host: SiteHost) {
    val cncl = host.role match {
      case SiteHost.RoleCanonical => "C"
      case SiteHost.RoleRedirect => "R"
      case SiteHost.RoleLink => "L"
      case SiteHost.RoleDuplicate => "D"
    }
    val sql = """
      insert into hosts3 (SITE_ID, HOST, CANONICAL)
      values (?, ?, ?)
      """
    val inserted =
      try runUpdateSingleRow(sql, List(siteId.asAnyRef, host.hostname, cncl))
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


  def loadSiteByName(name: String): Option[Site] = {
    loadSites().find(_.name == name)
  }

  def deleteSiteByName(name: String): Option[Site] = {
    require(SiteHost.isE2eTestHostname(name), "Can delete test sites only [EdE4PF0Y4]")
    val site = loadSites().find(_.name == name) getOrElse {
      return None
    }
    deleteSiteById(site.id)
    Some(site)
  }


  def deleteSiteById(siteId: SiteId): Boolean = {
    require(siteId <= MaxTestSiteId, "Can delete test sites only [EdE6FK02]")

    runUpdate("set constraints all deferred")

    // Dupl code [7KUW0ZT2]
    val statements = (s"""
      delete from index_queue3 where site_id = ?
      delete from spam_check_queue3 where site_id = ?
      delete from audit_log3 where site_id = ?
      delete from review_tasks3 where site_id = ?
      delete from perms_on_pages3 where site_id = ?
      delete from settings3 where site_id = ?
      delete from drafts3 where site_id = ?
      delete from post_read_stats3 where site_id = ?
      delete from notifications3 where site_id = ?
      delete from emails_out3 where site_id = ?
      delete from upload_refs3 where site_id = ?""" +
      // skip: uploads3, not per-site. But... latent BUG: should update upload ref counts,
      // since we deleted a site & emptied upload_refs3.
      s"""
      delete from page_users3 where site_id = ?
      delete from page_notf_prefs3 where site_id = ?
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
      delete from invites3 where site_id = ?
      delete from api_secrets3 where site_id = ?
      delete from user_visit_stats3 where site_id = ?
      delete from user_stats3 where site_id = ?
      delete from usernames3 where site_id = ?
      delete from user_emails3 where site_id = ?
      delete from users3 where site_id = ?
      delete from hosts3 where site_id = ?
      """).trim.split("\n")

    statements foreach { statement =>
      runUpdate(statement, List(siteId.asAnyRef))
    }

    // Now all tables are empty, but there's still an entry for the site itself in sites3.
    // If we're able to delete it, then the site is really gone (otherwise, it never existed).
    val isSiteGone = runUpdateSingleRow("delete from sites3 where id = ?", List(siteId.asAnyRef))

    runUpdate("set constraints all immediate")
    isSiteGone
  }

}


