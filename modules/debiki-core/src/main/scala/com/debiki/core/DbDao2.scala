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


/** A database data access object (DAO).
  */
class DbDao2(val dbDaoFactory: DbDaoFactory) {


  def readOnlySiteTransaction(siteId: SiteId)(fn: (SiteTransaction) => Unit): Unit = {
    val transaction = dbDaoFactory.newSiteTransaction(siteId, readOnly = true)
    try {
      fn(transaction)
    }
    finally {
      transaction.rollback()
    }
  }


  def readWriteSiteTransaction(siteId: SiteId, allowOverQuota: Boolean)(
        fn: (SiteTransaction) => Unit) {
    val transaction = dbDaoFactory.newSiteTransaction(siteId, readOnly = false)
    var committed = false
    try {
      fn(transaction)
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
    }
    finally {
      if (!committed) {
        transaction.rollback()
      }
    }
  }


  /*
  def readOnlySystemTransaction(fn: (SystemTransaction) => Unit) {
  }


  def readWriteSystemTransaction(fn: (SystemTransaction) => Unit) {
  }
  */

}
