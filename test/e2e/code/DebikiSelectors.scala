package test.e2e.code

import org.scalatest.selenium.WebBrowser


trait DebikiSelectors extends WebBrowser {

  def AnyLoginLink = cssSelector(".dw-a-login")
  def AnyLogoutLink = cssSelector(".dw-a-logout")

}
