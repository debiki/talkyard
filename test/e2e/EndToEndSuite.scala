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

package test.e2e

import org.scalatest.{Suite, Suites, BeforeAndAfterAll}
import play.api.{test => pt}
import pt.Helpers.testServerPort
import com.debiki.v0._
import com.debiki.v0.Prelude._


/**
 * Starts a Debiki server and Google Chrome and empties the database.
 */
trait ChromeSuiteMixin extends BeforeAndAfterAll {
  self: Suite =>

  lazy val testServer = pt.TestServer(testServerPort, pt.FakeApplication())

  protected def emptyDatabaseBeforeAll = true


  override def beforeAll() {
    ChromeDriverFactory.start()
    testServer.start()
    if (emptyDatabaseBeforeAll)
      debiki.Debiki.systemDao.emptyDatabase()
  }


  override def afterAll() {
    testServer.stop()
    ChromeDriverFactory.stop()
  }

}


/**
 * Runs all end to end tests. Empties the database and restarts the browser
 * before each specification.
 */
class EndToEndSuite extends Suites(
  new CreateSiteSpec {},
  new AdminDashboardSpec {},
  new AnonLoginSpec {},
  new ForumSpec {},
  new StyleSiteSpecSpec {})
  with ChromeSuiteMixin

