/**
 * Copyright (c) 2011-2016 Kaj Magnus Lindberg
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
import com.debiki.core.Prelude.dieIf


/** Constructs per site data access objects, and one global.
  */
class RdbDaoFactory(
  val db: Rdb,
  val migrations: ScalaBasedDatabaseMigrations,
  val getCurrentTime: () => When,
  val cdnOrigin: Option[String],
  val isTest: Boolean = false) extends DbDaoFactory {


  override def newSiteTransaction(siteId: SiteId, readOnly: Bo, mustBeSerializable: Bo)
      : SiteTx = {
    val tx = new RdbSiteTransaction(siteId, this, getCurrentTime())
    tx.createTheOneAndOnlyConnection(readOnly, mustBeSerializable = mustBeSerializable)
    tx
  }


  override def newSystemTransaction(readOnly: Bo, allSitesWriteLocked: Bo): SysTx = {
    dieIf(readOnly && allSitesWriteLocked, "TyE603MRP23")
    val tx = new RdbSystemTransaction(
          this, getCurrentTime(), allSitesWriteLocked = allSitesWriteLocked)
    tx.createTheOneAndOnlyConnection(readOnly = readOnly)
    tx
  }

}


