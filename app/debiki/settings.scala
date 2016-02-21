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

package debiki

import com.debiki.core._
import com.debiki.core.Prelude._
import play.api.libs.json._



case class AnySetting(
  name: String,
  assignedValue: Option[Any],
  default: Any,
  section: Option[SettingsTarget]) {

  def value: Any = assignedValue getOrElse default
  def valueAsBoolean: Boolean = value == "T" || value == true
  def asBoolean: Boolean = value == "T" || value == true
  def valueAsString: String = "" + value
  def asString: String = "" + value
}



/** If rawSettings is e.g. List(X, Y, Z), then settings in
  * X override settings in Y, Z, and settings in Y override Z,
  * Example: X is a sub forum, Y is a forum and Z is the website settings.
  */
case class SettingsChain(rawSettings: Seq[RawSettings]) {

  def deriveSetting(name: String, default: Any): AnySetting = {
    var anyAssignedValue: Option[Any] = None
    var anySection: Option[SettingsTarget] = None
    var i = 0
    while (i < rawSettings.size) {
      val settings = rawSettings(i)
      i += 1
      val anyValue: Option[Any] = settings.valuesBySettingName.get(name)
      anyValue foreach { value =>
        anyAssignedValue = Some(value)
        anySection = Some(settings.target)
        i = 999999 // break loop, value found
      }
    }
    new AnySetting(name, anyAssignedValue, default = default, anySection)
  }


  /** Simply remaps Some("T"/"F") to Some(true/false).
    */
  def deriveBoolSetting(name: String, default: Boolean): AnySetting = {
    val anySetting = deriveSetting(name, default)
    val boolSetting = anySetting.assignedValue match {
      case None => anySetting
      case Some(true) => anySetting
      case Some(false) => anySetting
      case Some("T") => anySetting.copy(assignedValue = Some(true))
      case Some("F") => anySetting.copy(assignedValue = Some(false))
      case Some(bad) =>
        assErr("DwE77GHF4", s"Bad bool setting value: `$bad', for setting: `$name'")
    }
    boolSetting
  }

}



case class Settings(settingsChain: SettingsChain) {

  val title = derive("title", "")
  val description = derive("description", "")

  val userMustBeAuthenticated = derive("userMustBeAuthenticated", false)
  val userMustBeApproved = derive("userMustBeApproved", false)
  val allowGuestLogin = derive("allowGuestLogin", false)

  val showForumCategories = derive("showForumCategories", false)
  val horizontalComments = derive("horizontalComments", false)

  val headStylesHtml = derive("headStylesHtml", "")
  val headScriptsHtml = derive("headScriptsHtml", "")
  val endOfBodyHtml = derive("endOfBodyHtml", "")

  val headerHtml = derive("headerHtml", "")
  val footerHtml = derive("footerHtml", "")

  val socialLinksHtml = derive("socialLinksHtml", "")
  val logoUrlOrHtml = derive("logoUrlOrHtml", "")

  val companyDomain = derive("companyDomain", "www.example.com")
  val companyFullName = derive("companyFullName", "Unnamed Company Full Name")
  val companyShortName = derive("companyShortName", "Unnamed Company")

  val googleUniversalAnalyticsTrackingId = derive("googleUniversalAnalyticsTrackingId", "")

  val showComplicatedStuff = derive("showComplicatedStuff", false)

  def isGuestLoginAllowed =
    allowGuestLogin.asBoolean &&
    !userMustBeAuthenticated.asBoolean &&
    !userMustBeApproved.asBoolean


  private def derive(settingName: String, default: Any) =
    settingsChain.deriveSetting(settingName, default)


  def toJson =
    Json.obj(
      "userMustBeAuthenticated" -> jsonFor(userMustBeAuthenticated),
      "userMustBeApproved" -> jsonFor(userMustBeApproved),
      "allowGuestLogin" -> jsonFor(allowGuestLogin),
      "title" -> jsonFor(title),
      "description" -> jsonFor(description),
      "headStylesHtml" -> jsonFor(headStylesHtml),
      "headScriptsHtml" -> jsonFor(headScriptsHtml),
      "endOfBodyHtml" -> jsonFor(endOfBodyHtml),
      "headerHtml" -> jsonFor(headerHtml),
      "footerHtml" -> jsonFor(footerHtml),
      "showForumCategories" -> jsonFor(showForumCategories),
      "horizontalComments" -> jsonFor(horizontalComments),
      "socialLinksHtml" -> jsonFor(socialLinksHtml),
      "logoUrlOrHtml" -> jsonFor(logoUrlOrHtml),
      "companyDomain" -> jsonFor(companyDomain),
      "companyFullName" -> jsonFor(companyFullName),
      "companyShortName" -> jsonFor(companyShortName),
      "googleUniversalAnalyticsTrackingId" -> jsonFor(googleUniversalAnalyticsTrackingId),
      "showComplicatedStuff" -> jsonFor(showComplicatedStuff))


  private def jsonFor(setting: AnySetting): JsObject = {
    var jsObject = Json.obj(
      "name" -> JsString(setting.name),
      "defaultValue" -> anyToJsValue(setting.default))
    setting.assignedValue foreach { value =>
      jsObject += "anyAssignedValue" -> anyToJsValue(value)
    }
    jsObject
  }


  private def anyToJsValue(value: Any): JsValue = value match {
    case x: String => JsString(x)
    case x: Int => JsNumber(x)
    case x: Long => JsNumber(x)
    case x: Float => JsNumber(x)
    case x: Double => JsNumber(x)
    case x: Boolean => JsBoolean(x)
  }

}


object Settings {

  /** I read somewhere on Discourse's forum that very few people edit their posts 5 hours
    * after they've been created. So 5 hours will result in very few edits to review
    * — and hopefully catch all/most malicious edits.
    */
  val PostRecentlyCreatedLimitMs = 5 * 3600 * 1000

  /** The first few posts by a new user are enqueued for review (because spammers
    * likely post spam directly or almost directly).
    */
  val NumFirstUserPostsToReview = 2

}
