/**
 * Copyright (C) 2015 Kaj Magnus Lindberg (born 1979)
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

package com.debiki.core


/** A database data access object (DAO). It gives you serializable transactions,
  * either read only, or read-write, and either for a single site, or for the whole
  * system (no particular site).
  */
class DbDao2(val dbDaoFactory: DbDaoFactory) {


  def readOnlySiteTransaction[R](siteId: SiteId, mustBeSerializable: Boolean)(
        fn: (SiteTransaction) => R): R = {
    val transaction = dbDaoFactory.newSiteTransaction(siteId, readOnly = true,
      mustBeSerializable = mustBeSerializable)
    try {
      fn(transaction)
    }
    finally {
      transaction.rollback()
    }
  }


  /** Throws OverQuotaException if we insert/edit stuff in the database so that the
    * site uses too much disk space.
    */
  def readWriteSiteTransaction[R](siteId: SiteId, allowOverQuota: Boolean = false)(
        fn: SiteTransaction => R): R = {
    val transaction = dbDaoFactory.newSiteTransaction(siteId, readOnly = false,
      mustBeSerializable = true)
    var committed = false

    def tryCheckQuotaAndCommit(): Unit = {
      if (transaction.hasBeenRolledBack)
        return
      if (!allowOverQuota) {
        val resourceUsage = transaction.loadResourceUsage()
        resourceUsage.databaseStorageLimitBytes foreach { limitBytes =>
          val quotaExceededBytes = resourceUsage.estimatedDbBytesUsed - limitBytes
          if (quotaExceededBytes > 0)
            throw OverQuotaException(siteId, resourceUsage)
        }
      }
      transaction.commit()
      committed = true
    }

    try {
      val result =
        try fn(transaction)
        catch {
          case controlThrowable: scala.runtime.NonLocalReturnControl[_] =>
            // Is thrown by a 'return' in the middle of 'fn()', which is fine.
            tryCheckQuotaAndCommit()
            throw controlThrowable
        }
      tryCheckQuotaAndCommit()
      result
    }
    finally {
      if (!committed && !transaction.hasBeenRolledBack) {
        transaction.rollback()
      }
    }
  }


  def readOnlySystemTransaction[R](fn: SysTx => R): R = {
    val tx = dbDaoFactory.newSystemTransaction(
          readOnly = true, allSitesWriteLocked = false)
    try {
      fn(tx)
    }
    finally {
      tx.rollback()
    }
  }


  /** Unlike readWriteSiteTransaction, this one doesn't throw OverQuotaException.
    */
  def readWriteSystemTransaction[R](fn: SysTx => R, allSitesWriteLocked: Bo): R = {
    val tx = dbDaoFactory.newSystemTransaction(
          readOnly = false, allSitesWriteLocked = allSitesWriteLocked)
    var committed = false
    try {
      val result = fn(tx)
      tx.commit()
      committed = true
      result
    }
    finally {
      if (!committed) {
        tx.rollback()
      }
    }
  }

}
