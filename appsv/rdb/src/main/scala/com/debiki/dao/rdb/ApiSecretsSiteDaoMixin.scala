/**
 * Copyright (c) 2018 Kaj Magnus Lindberg
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

import collection.immutable
import com.debiki.core._
import java.{sql => js}
import Rdb._


/** Loads and saves API secrets.
  */
trait ApiSecretsSiteDaoMixin extends SiteTransaction {
  self: RdbSiteTransaction =>


  override def nextApiSecretNr(): DraftNr = {
    val query = """
      -- can use pk index
      select max(secret_nr) max_nr from api_secrets3 where site_id = ?
      """
    runQueryFindExactlyOne(query, List(siteId.asAnyRef), rs => {
      val maxNr = rs.getInt("max_nr") // null becomes 0, fine
      maxNr + 1
    })
  }


  override def insertApiSecret(secret: ApiSecret) {
    val statement = s"""
      insert into api_secrets3 (
        site_id, secret_nr, user_id,
        created_at, deleted_at, is_deleted,
        secret_key)
      values (?, ?, ?, ?, ?, ?, ?)
      """
    runUpdateSingleRow(statement, List(
      siteId.asAnyRef,
      secret.nr.asAnyRef,
      secret.userId.orNullInt,
      secret.createdAt.asTimestamp,
      secret.deletedAt.orNullTimestamp,
      secret.isDeleted.asAnyRef,
      secret.secretKey))
  }


  override def setApiSecretDeleted(secretNr: ApiSecretNr, when: When): Boolean = {
    val statement = s"""
      update api_secrets3
      set deleted_at = ?,
          is_deleted = true
      where site_id = ? and secret_nr = ?
      """
    runUpdateSingleRow(statement, List(when.asTimestamp, siteId.asAnyRef, secretNr.asAnyRef))
  }


  override def loadApiSecretBySecretKey(secretKey: String): Option[ApiSecret] = {
    val query = s"""
      select * from api_secrets3
      where site_id = ?
        and secret_key = ?
        and not is_deleted
      """
    runQueryFindOneOrNone(query, List(siteId.asAnyRef, secretKey), readApiSecret)
  }


  override def listApiSecretsRecentlyCreatedFirst(limit: Int): immutable.Seq[ApiSecret] = {
    val query = s"""
      select * from api_secrets3 where site_id = ?
      order by created_at desc
      limit $limit
      """
    runQueryFindMany(query, List(siteId.asAnyRef), readApiSecret)
  }


  private def readApiSecret(rs: js.ResultSet): ApiSecret = {
    ApiSecret(
      nr = getInt(rs, "secret_nr"),
      userId = getOptInt(rs, "user_id"),
      createdAt = getWhen(rs, "created_at"),
      deletedAt = getOptWhen(rs, "deleted_at"),
      isDeleted = getBool(rs, "is_deleted"),
      secretKey = getString(rs, "secret_key"))
  }

}
