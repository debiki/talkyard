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

import com.debiki.core.Prelude._
import org.scalatest._
import play.api.{test => pt}
import play.api.test.Helpers.testServerPort
import play.{api => p}
import play.api.Play


/** Starts a Debiki server and a certain Google Chrome Driver Service
  * and empties the database.
  *
  * What about using a FireFox driver if no path to the chrome driver has been
  * specified? And an IE driver if both Chrome and FF absent?
  */
trait StartServerAndChromeDriverFactory extends BeforeAndAfterAll {
  self: Suite =>

  val DriverConfigValueName = "test.e2e.chrome.driverPath"

  lazy val testServer = pt.TestServer(testServerPort, pt.FakeApplication())

  protected def emptyDatabaseBeforeAll = true


  private def getChromeDriverPath(app: p.Application): String =
    Play.configuration(app).getString(DriverConfigValueName) getOrElse sys.error(i"""
      |Path to Chrome Driver not configured.
      |***********************************************************************
      |Please download ChromeDriver from here:
      |  https://code.google.com/p/chromedriver/downloads/list
      |and unzip the binary and place it somewhere.
      |
      |Then update conf/local/dev-test.conf, add this line:
      |$DriverConfigValueName: <path-to-the-chrome-driver-you-just-unzipped>
      |
      |Read more about what the Chrome Driver is and why you need it here:
      |  https://code.google.com/p/selenium/wiki/ChromeDriver
      |(You need it to run End-to-End tests in Chrome: the driver talks to
      |Chrome and tells Chrome what to do next.)
      |
      |*Tips*: You probably need to restart SBT/Play, or there'll be some
      |ElasticSearch port-already-in-use error, because the test suite died
      |abruptly whilst the server was already running, and then the server
      |never got time to close ElasticSearch and release the HTTP port.
      |***********************************************************************
      |""")


  override def beforeAll() {
    testServer.start()
    val chromeDriverPath = getChromeDriverPath(testServer.application)
    ChromeDriverFactory.start(chromeDriverPath)
    if (emptyDatabaseBeforeAll)
      debiki.Globals.systemDao.emptyDatabase()
  }


  override def afterAll() {
    testServer.stop()
    ChromeDriverFactory.stop()
  }

}

