/**
 * Copyright (c) 2021 Kaj Magnus Lindberg
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
import Rdb._
import RdbUtil._
import java.sql.{ResultSet => j_ResultSet, SQLException => j_SQLException}
import collection.{mutable => mut}



/** Manages user sessions. But why are sessions stored in Postgres, not Redis?
  * For security reasons. It's good to be able to:
  * - Look up all current sessions by a certain user.
  * - Look up all sessions by ip addr.
  * - List sessions by time and user / ip.
  * - Remember if a session's ip address changes (could be suspicious — is there
  *   enough time for the person to travel to the new location?).
  * - Delete some or all of a user's session, and remember who did this and when.
  * - Delete all posts made by a session — in case someone got pwned.
  *
  * All that would be doable in Redis, but it's simpler, in Postgres. And,
  * combined with an app server in-process mem cache, this approach can also be made
  * faster than Redis (which is an out of process mem cache, slower).
  *
  * Maybe some time later, sessions will need to be temporarily buffered in Redis
  * or elsewhere somehow, and only written to Postgres every once in a while
  * (except for when logging out — that'd get persisted immediately).
  * Or even some other type of storage.  But that's in the distant future.
  */
trait SessionsRdbMixin extends SiteTransaction {
  self: RdbSiteTransaction =>


    /// This loads also sessions that have expired, but whose expired_at_c
    /// column hasn't been updated yet. — That's why there's "Maybe" in the
    /// val name — sessions that are *maybe* still active.
    private val AndMaybeActiveOnlySql =
      "and deleted_at_c is null and expired_at_c is null"

  def loadSession(part1Maybe2Or3: Opt[St] = None, part4HttpOnly: Opt[St] = None,
        maybeActiveOnly: Bo = false)
        : Opt[TySessionInDbMaybeBad] = {
    dieIf(part1Maybe2Or3.isDefined == part4HttpOnly.isDefined, "TyE50MG24SMP")
    val part1OrHash4 = part4HttpOnly.map(hashSha512FirstHalf32Bytes) getOrElse {
      // Compare with part 1 only (not 2 or 3).
      part1Maybe2Or3.getOrDie("TyE603MWEG657") take TySession.SidLengthCharsPart1
    }

    val andMaybeActiveOnlySql =
          if (maybeActiveOnly) AndMaybeActiveOnlySql else ""

    // Test, part 4: sso-test  TyT4ABKRW0268.TyTESESS123GONE
    // Test, part 1: All the time, whenever logged in.

    val colName = if (part1Maybe2Or3.isDefined) "part_1_comp_id_c" else "hash_4_http_only_c"
    val query = s"""
          select * from sessions_t
          where site_id_c = ?
            and $colName = ?
            $andMaybeActiveOnlySql """
    runQueryFindOneOrNone(query, List(siteId.asAnyRef, part1OrHash4), parseSession)
  }


  def loadOneOrTwoSessions(part1Maybe2Or3: Opt[St], part4HttpOnly: Opt[St],
        maybeActiveOnly: Bo = false): ImmSeq[TySessionInDbMaybeBad] = {
    if (part1Maybe2Or3.isEmpty && part4HttpOnly.isEmpty)
      return Vec.empty

    val values = MutArrBuf[AnyRef]()
    values.append(siteId.asAnyRef)

    val partOneEq = part1Maybe2Or3 map { part1Etc =>
      // Skip part 2 and 3.
      values.append(part1Etc take TySession.SidLengthCharsPart1)
      "part_1_comp_id_c = ?"
    } getOrElse ""

    val or =
          if (part1Maybe2Or3.isEmpty || part4HttpOnly.isEmpty) ""
          else "or"

    val partFourEq = part4HttpOnly map { part4 =>
      values.append(hashSha512FirstHalf32Bytes(part4))
      "hash_4_http_only_c = ?"
    } getOrElse ""

    val andMaybeActiveOnlySql =
          if (maybeActiveOnly) AndMaybeActiveOnlySql else ""

    val query = s"""
          select * from sessions_t
          where site_id_c = ? and ($partOneEq $or $partFourEq) $andMaybeActiveOnlySql"""

    runQueryFindMany(query, values.toList, parseSession)
  }


  def loadActiveSessions(patId: PatId): ImmSeq[TySessionInDbMaybeBad] = {
    val query = s"""
          -- ix: sessions_i_patid_createdat_active
          select * from sessions_t
          where site_id_c = ?
            and pat_id_c = ?
            and deleted_at_c is null
            and expired_at_c is null
          order by created_at_c desc  """
    runQueryFindMany(query, List(siteId.asAnyRef, patId.asAnyRef), parseSession)
  }


  def insertValidSession(session: TySession): U = {
    dieIf(session.part1CompId == TySession.ApiSecretPart1, "TyE7P02MRED1")
    dieIf(session.part2Hash sameElements TySession.DummyHashPart2, "TyE7P02MRED2")

    val statement = s"""
          insert into sessions_t (
              site_id_c,
              pat_id_c,
              created_at_c,
              deleted_at_c,
              expired_at_c,
              version_c,
              start_ip_c,
              start_headers_c,
              start_browser_id_c,
              part_1_comp_id_c,
              hash_2_for_embg_storage_c,
              hash_3_for_dir_js_c,
              hash_4_http_only_c,
              hash_5_strict_c)
          values (?, ?, ?, null, null, ?, ?::inet, ?, ?, ?, ?, ?, ?, ?)  """

    val values = List(
          siteId.asAnyRef,
          session.patId.asAnyRef,
          session.createdAt.asTimestamp,
          session.version.asAnyRef,
          session.startIp.orNullVarchar,
          session.startHeaders.orNullIfEmpty,
          session.startBrowserId.orNullVarchar,
          session.part1CompId,
          session.part2Hash,
          session.part3Hash,
          session.part4Hash,
          session.part5Hash)

    runUpdateSingleRow(statement, values)
  }


  def upsertSession(session: TySessionInDbMaybeBad): U = {
    dieIf(session.part1CompId == TySession.ApiSecretPart1, "TyE7P02MRED3")
    dieIf(session.part2HashForEmbgStorage sameElements TySession.DummyHashPart2, "TyE7P02MRED4")

    // Inserting expired sessions can be useful if restoring from a backup.
    val statement = """
          insert into sessions_t (
              site_id_c,
              pat_id_c,
              created_at_c,
              deleted_at_c,
              expired_at_c,
              version_c,
              start_ip_c,
              start_headers_c,
              start_browser_id_c,
              part_1_comp_id_c,
              hash_2_for_embg_storage_c,
              hash_3_for_dir_js_c,
              hash_4_http_only_c,
              hash_5_strict_c)
          values (?, ?, ?, ?, ?, ?, ?::inet, ?, ?, ?, ?, ?, ?, ?)
          on conflict (site_id_c, pat_id_c, created_at_c)   -- pk
          do update set
              deleted_at_c = least(sessions_t.deleted_at_c, excluded.deleted_at_c),
              expired_at_c = least(sessions_t.expired_at_c, excluded.expired_at_c)  """

    val values = List(
          siteId.asAnyRef,
          session.patId.asAnyRef,
          session.createdAt.asTimestamp,
          session.deletedAt.orNullTimestamp,
          session.expiredAt.orNullTimestamp,
          session.version.asAnyRef,
          session.startIp.orNullVarchar,
          session.startHeaders.orNullIfEmpty,
          session.startBrowserId.noneIfBlank.orNullVarchar,
          session.part1CompId,
          session.part2HashForEmbgStorage,
          session.part3HashForDirJs,
          session.part4HashHttpOnly,
          session.part5HashStrict)

    runUpdateSingleRow(statement, values)
  }


  private def parseSession(rs: j_ResultSet): TySessionInDbMaybeBad = {
    TySessionInDbMaybeBad(
          patId =  getInt32(rs, "pat_id_c"),
          createdAt = getWhen(rs, "created_at_c"),
          deletedAt = getOptWhen(rs, "deleted_at_c"),
          expiredAt = getOptWhen(rs, "expired_at_c"),
          version = getInt(rs, "version_c"),
          startIp = getOptString(rs, "start_ip_c"),
          startHeaders = getOptJsObject(rs, "start_headers_c") getOrElse JsEmptyObj2,
          startBrowserId = getOptString(rs, "start_browser_id_c"),
          part1CompId = getString(rs, "part_1_comp_id_c"),
          part2HashForEmbgStorage = getByteArray(rs, "hash_2_for_embg_storage_c"),
          part3HashForDirJs = getByteArray(rs, "hash_3_for_dir_js_c"),
          part4HashHttpOnly = getByteArray(rs, "hash_4_http_only_c"),
          part5HashStrict = getByteArray(rs, "hash_5_strict_c"))
  }

}
