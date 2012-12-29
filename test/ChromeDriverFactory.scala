/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package test

import java.{io => jio}
import org.openqa.selenium.chrome.ChromeDriverService
import org.openqa.selenium.remote.DesiredCapabilities
import org.openqa.selenium.remote.RemoteWebDriver
import org.openqa.selenium.WebDriver


/**
 * Starts the Chrome browser, that is, knows where the ChromeDriver
 * is located, starts it and creates a WebDriver.
 */
object ChromeDriverFactory {

  // This driver executable controls the Chrome browser.
  // For more information, see http://code.google.com/p/selenium/wiki/ChromeDriver.
  // Download the the driver here: http://code.google.com/p/chromedriver/downloads/list
  // For now:
  private val ChromeDriverPath = "/mnt/tmp/dev/chromedriver_linux64_23.0.1240.0"
  // COULD assume it's located in ./tmp/? And have the caller use a Firefox driver
  // if not available, and an IE driver if both Chrome and FF absent?

  private lazy val service: ChromeDriverService = {
    val service = new ChromeDriverService.Builder()
      .usingDriverExecutable(new jio.File(ChromeDriverPath))
      .usingAnyFreePort()
      .build()
    service
  }

  def start() {
    service.start()
  }

  def stop() {
    service.stop()
  }

  def createDriver(): WebDriver = new RemoteWebDriver(
    service.getUrl(), DesiredCapabilities.chrome())

  // Where call `driver.quit()`? @After in Google's example:
  //   http://code.google.com/p/selenium/wiki/ChromeDriver

}

