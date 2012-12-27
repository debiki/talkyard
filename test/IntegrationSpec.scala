/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package test

import org.openqa.selenium.WebDriver
import org.scalatest.{FreeSpec, BeforeAndAfterAll}
import org.scalatest.matchers.ShouldMatchers
import org.scalatest.selenium.WebBrowser
import org.scalatest.concurrent.{Eventually, ScaledTimeSpans}
import org.scalatest.time.{Span, Seconds, Millis}
import play.api.{test => pt}
import pt.Helpers.testServerPort


class BrowserSpec extends FreeSpec
  with WebBrowser
  with BeforeAndAfterAll with ShouldMatchers
  with Eventually with ScaledTimeSpans {


  lazy val testServer = pt.TestServer(testServerPort, pt.FakeApplication())
  implicit val webDriver: WebDriver = ChromeDriverFactory.createDriver()


  override def beforeAll() {
    testServer.start()
  }


  override def afterAll() {
    testServer.stop()
    //webDriver.quit() // quit browser
    ChromeDriverFactory.stop()
  }


  implicit override val patienceConfig = PatienceConfig(
    timeout = scaled(Span(8, Seconds)),
    interval = scaled(Span(100, Millis)))


  lazy val testPage = new Page {
    val url = s"localhost:$testServerPort/-3nnb9-new-page"
  }


  val replyText = "BrowserSpec reply to article."


  "A browser can" - {

    "open a test page" in {
      go to testPage
    }

    "click Reply" in {
      Thread.sleep(3 * 1000)
      eventually {
        click on linkText("Reply")
      }
    }

    "write a reply" in {
      eventually {
        click on "dw-fi-reply-text_sno-1"
        enter(replyText)
        textArea("dw-fi-reply-text_sno-1").value should be === replyText
      }
    }

    "click Post as ..." in {
      eventually {
        click on cssSelector(".dw-fi-submit")
      }
    }

    "click Submit (be satisfied with the default name)" in {
      eventually {
        click on "dw-f-lgi-spl-submit"
      }
    }

    "click OK to acknowledge 'You have been logged in' message" in {
      eventually {
        click on "dw-dlg-rsp-ok"
      }
    }

    "specify no email address" in {
      eventually {
        click on cssSelector("label[for='dw-fi-eml-prf-rcv-no']")
      }
    }

    // But if I *do* specify an email address, theres' a bad XSRF token error!
  }

}


