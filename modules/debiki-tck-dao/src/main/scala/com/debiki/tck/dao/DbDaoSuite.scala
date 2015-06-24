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

import com.debiki.core.DbDaoFactory
import org.scalatest._
/*

/** All tests in ./specs/ should be listed here, or they won't be picked up
  * by database access object modules that are tested by debiki-tck-dao.
  */
class DbDaoSuite(daoFactory: DbDaoFactory) extends Suites(
  new specs.UserInfoSpec(daoFactory)) with BeforeAndAfterAll {

  override def afterAll() {
    daoFactory.shutdown()
  }

}
*/
