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
        fn: (SiteTransaction) => R): R = {
    val transaction = dbDaoFactory.newSiteTransaction(siteId, readOnly = false,
      mustBeSerializable = true)
    var committed = false
    try {
      val result = fn(transaction)
      if (!allowOverQuota) {
        val resourceUsage = transaction.loadResourceUsage()
        resourceUsage.quotaLimitMegabytes foreach { limit =>
          val quotaExceededBytes = resourceUsage.estimatedBytesUsed - limit * 1000L * 1000L
          if (quotaExceededBytes > 0)
            throw OverQuotaException(siteId, resourceUsage)
        }
      }
      transaction.commit()
      committed = true
      result
    }
    finally {
      if (!committed) {
        transaction.rollback()
      }
    }
  }


  def readOnlySystemTransaction[R](fn: (SystemTransaction) => R): R = {
    val transaction = dbDaoFactory.newSystemTransaction(readOnly = true)
    try {
      fn(transaction)
    }
    finally {
      transaction.rollback()
    }
  }


  /** Unlike readWriteSystemTransaction, this one doesn't throw OverQuotaException.
    */
  def readWriteSystemTransaction[R](fn: (SystemTransaction) => R): R = {
    val transaction = dbDaoFactory.newSystemTransaction(readOnly = false)
    var committed = false
    try {
      val result = fn(transaction)
      transaction.commit()
      committed = true
      result
    }
    finally {
      if (!committed) {
        transaction.rollback()
      }
    }
  }

}
