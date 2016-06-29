/**
 * Copyright (C) 2014 Kaj Magnus Lindberg (born 1979)
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


package com.debiki.tck.dao

import com.debiki.core._
import org.scalatest._


/** A database test spec. Empties the database once before the tests are run
  * (not before each test, only once before all tests in the spec).
  */
class DbDaoSpec(
  val daoFactory: DbDaoFactory,
  private val emptySearchEngineDatabase: Boolean = false)
  extends FreeSpec with MustMatchers with BeforeAndAfterAll {


  def newSiteDao(siteId: SiteId) =
    ??? // daoFactory.newSiteDbDao(siteId)


  def systemDao = ??? //daoFactory.systemDbDao


  override def beforeAll() {
    ??? /*
    systemDao.emptyDatabase()
    if (emptySearchEngineDatabase) {
      daoFactory.debugDeleteRecreateSearchEngineIndexes()
    }
    */
  }

}


trait DbDaoSpecShutdown extends BeforeAndAfterAll {
  self: DbDaoSpec =>

  override def afterAll() {
    super.afterAll()
    //self.daoFactory.shutdown()
  }
}
