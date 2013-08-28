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
import java.{io => jio}
import org.openqa.selenium.chrome.ChromeDriver
import org.openqa.selenium.chrome.ChromeDriverService
import org.openqa.selenium.chrome.ChromeOptions
import org.openqa.selenium.WebDriver


/** The Chrome Driver Service builds Chrome Drivers, which controls the Chrome browser.
  * A certain binary executable file is needed for this to work, namely a program
  * that talks with Chrome browsers.
  * For more information, see http://code.google.com/p/selenium/wiki/ChromeDriver.
  * Download the the driver here: http://code.google.com/p/chromedriver/downloads/list
  */
object ChromeDriverFactory {

  private var anyService: Option[ChromeDriverService] = None


  def start(chromeDriverPath: String) {
    require(anyService.isEmpty, s"${classNameOf(this)} already started")
    anyService = Some(new ChromeDriverService.Builder()
      .usingDriverExecutable(new jio.File(chromeDriverPath))
      .withLogFile(new jio.File("logs/chromedriver.log"))
      .usingAnyFreePort()
      .build())
    anyService foreach { _.start() }
  }


  def stop() {
    anyService foreach { _.stop() }
    anyService = None
  }


  def createDriver(): WebDriver = {
    val service = anyService getOrElse sys.error(s"${classNameOf(this)} has not been started")
    val chromeOptions = new ChromeOptions
    /* This makes Chrome remember breakpoint accross test browser restarts. :-)
    chromeOptions.addArguments(
      "--user-data-dir=/tmp/kajmagnus-chrome-driver-data-dir")
    */
    new ChromeDriver(service, chromeOptions)

  }

}

