/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package test

import org.scalatest.{Suites, BeforeAndAfterAll}
import play.api.{test => pt}
import pt.Helpers.testServerPort
import com.debiki.v0.Prelude._


class BrowserSpec extends Suites(
  new AnonLoginSpec {})
  with BeforeAndAfterAll {

  lazy val testServer = pt.TestServer(testServerPort, pt.FakeApplication())


  override def beforeAll() {
    ChromeDriverFactory.start()
    testServer.start()
  }


  override def afterAll() {
    testServer.stop()
    ChromeDriverFactory.stop()
  }

}

