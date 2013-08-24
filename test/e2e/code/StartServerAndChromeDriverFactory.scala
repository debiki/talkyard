/**
 * Copyright (C) 2013 Kaj Magnus Lindberg (born 1979)
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

package test.e2e.code

import org.scalatest._
import play.api.{test => pt}
import play.api.test.Helpers.testServerPort


/** Starts a Debiki server and a certain Google Chrome Driver Service
  * and empties the database.
  */
trait StartServerAndChromeDriverFactory extends BeforeAndAfterAll {
  self: Suite =>

  lazy val testServer = pt.TestServer(testServerPort, pt.FakeApplication())

  protected def emptyDatabaseBeforeAll = true


  override def beforeAll() {
    ChromeDriverFactory.start()
    testServer.start()
    if (emptyDatabaseBeforeAll)
      debiki.Globals.systemDao.emptyDatabase()
  }


  override def afterAll() {
    testServer.stop()
    ChromeDriverFactory.stop()
  }

}

