/**
 * Copyright (C) 2015 Kaj Magnus Lindberg
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
import com.google.{common => guava}
import guava.net.InetAddresses
import java.{sql => js, util => ju}
import java.net.InetAddress
import scala.collection.{mutable, immutable}
import scala.collection.mutable.ArrayBuffer
import Rdb._
import RdbUtil._


/** Manages blocks (i.e. bans) of ip addresses, browser id cookies etc.
  */
trait BlocksSiteDaoMixin extends SiteTransaction {
  self: RdbSiteTransaction =>


  override def insertBlock(block: Block) {
    require(block.ip.isDefined || block.browserIdCookie.isDefined, "TyE2UPKGJ7")

    val statement = s"""
      insert into blocks3(
        site_id,
        threat_level,
        blocked_at,
        blocked_till,
        blocked_by_id,
        ip,
        browser_id_cookie)
      values (
        ?, ?,
        ? at time zone 'UTC',
        ? at time zone 'UTC',
        ?, ?::inet, ?)
      """
    val values = List[AnyRef](
      siteId.asAnyRef,
      block.threatLevel.toInt.asAnyRef,
      block.blockedAt.asTimestamp,
      block.blockedTill.orNullTimestamp,
      block.blockedById.asAnyRef,
      block.ip.map(_.getHostAddress).orNullVarchar,
      block.browserIdCookie.orNullVarchar)
    runUpdateSingleRow(statement, values)
  }


  def unblockIp(ip: InetAddress) {
    deleteBlock("ip = ?::inet", ip.getHostAddress)
  }


  def unblockBrowser(browserIdCookie: String) {
    deleteBlock("browser_id_cookie = ? and ip is null", browserIdCookie)
  }


  private def deleteBlock(whereTest: String, value: String) {
    val statement = s"""
     delete from blocks3
     where site_id = ? and $whereTest
     """
    runUpdateSingleRow(statement, List(siteId.asAnyRef, value))
  }


  override def loadBlocks(ip: String, browserIdCookie: Option[String]): immutable.Seq[Block] = {
    val values = ArrayBuffer(siteId.asAnyRef, ip)
    val orCookieTest = browserIdCookie match {
      case None => ""
      case Some(browserId) =>
        values.append(browserId)
        "or browser_id_cookie = ?"
    }
    val query = s"""
      select
        threat_level,
        blocked_at,
        blocked_till,
        blocked_by_id,
        ip,
        browser_id_cookie
      from blocks3
      where
        site_id = ? and (ip = ?::inet $orCookieTest)
      """
    runQueryFindMany(query, values.toList, rs => {
      getBlock(rs)
    })
  }


  private def getBlock(rs: js.ResultSet) = {
    var threatLevelInt = rs.getInt("threat_level")
    if (threatLevelInt <= ThreatLevel.HopefullySafe.toInt) {
      // The db constraints allow 1 and 2, but remap them to 3 because there's no enum for 1 or 2.
      threatLevelInt = ThreatLevel.HopefullySafe.toInt
    }
    Block(
      threatLevel = ThreatLevel.fromInt(threatLevelInt) getOrDie "EsE8PY24",
      ip = Option(rs.getString("ip")).map(InetAddresses.forString),
      browserIdCookie = Option(rs.getString("browser_id_cookie")),
      blockedById = rs.getInt("blocked_by_id"),
      blockedAt = getDate(rs, "blocked_at"),
      blockedTill = getOptionalDate(rs, "blocked_till"))
  }

}
