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

package debiki.dao

import com.debiki.core._
import com.debiki.core.Prelude._
import java.{util => ju}


/** Saves audit log entries. In the future, perhaps looks up countries by IP and
  * updates audit log entries with country information.
  */
trait AuditDao {
  self: SiteDao =>

  protected def insertAuditLogEntry(entry: AuditLogEntry, transaction: SiteTransaction): Unit = {
    AuditDao.insertAuditLogEntry(entry, transaction)
  }

}



object AuditDao {

  def insertAuditLogEntry(entry: AuditLogEntry, transaction: SiteTransaction): Unit = {
    require(entry.siteId == transaction.siteId, "EsE5GMKW2")
    val (entryId, batchId) = transaction.nextAuditLogEntryId()
    val entryWithId = entry.copy(id = entryId, batchId = batchId)
    transaction.insertAuditLogEntry(entryWithId)
  }

}
