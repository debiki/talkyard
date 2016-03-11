/**
 * Copyright (c) 2016 Kaj Magnus Lindberg
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
import scala.collection.immutable
import ReactJson._
import debiki.DebikiHttp.throwBadRequest



trait AllSettings {
  self =>

  def title: String
  def description: String
  def userMustBeAuthenticated: Boolean
  def userMustBeApproved: Boolean
  def allowGuestLogin: Boolean
  def numFirstPostsToReview: Int
  def numFirstPostsToApprove: Int
  def numFirstPostsToAllow: Int
  def headStylesHtml: String
  def headScriptsHtml: String
  def endOfBodyHtml: String
  def headerHtml: String
  def footerHtml: String
  def showForumCategories: Boolean
  def horizontalComments: Boolean
  def socialLinksHtml: String
  def logoUrlOrHtml: String
  def companyDomain: String
  def companyFullName: String
  def companyShortName: String
  def googleUniversalAnalyticsTrackingId: String
  def showComplicatedStuff: Boolean

  def toJson = Settings2.settingsToJson(toEditedSettings)

  def toEditedSettings = EditedSettings(
    title = Some(self.title),
    description = Some(self.description),
    userMustBeAuthenticated = Some(self.userMustBeAuthenticated),
    userMustBeApproved = Some(self.userMustBeApproved),
    allowGuestLogin = Some(self.allowGuestLogin),
    numFirstPostsToReview = Some(self.numFirstPostsToReview),
    numFirstPostsToApprove = Some(self.numFirstPostsToApprove),
    numFirstPostsToAllow = Some(self.numFirstPostsToAllow),
    headStylesHtml = Some(self.headStylesHtml),
    headScriptsHtml = Some(self.headScriptsHtml),
    endOfBodyHtml = Some(self.endOfBodyHtml),
    headerHtml = Some(self.headerHtml),
    footerHtml = Some(self.footerHtml),
    showForumCategories = Some(self.showForumCategories),
    horizontalComments = Some(self.horizontalComments),
    socialLinksHtml = Some(self.socialLinksHtml),
    logoUrlOrHtml = Some(self.logoUrlOrHtml),
    companyDomain = Some(self.companyDomain),
    companyFullName = Some(self.companyFullName),
    companyShortName = Some(self.companyShortName),
    googleUniversalAnalyticsTrackingId = Some(self.googleUniversalAnalyticsTrackingId),
    showComplicatedStuff = Some(self.showComplicatedStuff))
}


object AllSettings {

  /** I read somewhere on Discourse's forum that very few people edit their posts 5 hours
    * after they've been created. So 5 hours will result in very few edits to review
    * — and hopefully catch all/most malicious edits.
    */
  val PostRecentlyCreatedLimitMs = 5 * 3600 * 1000

  val Default = new AllSettings {
    val title = ""
    val description = ""
    val userMustBeAuthenticated = false
    val userMustBeApproved = false
    val allowGuestLogin = false
    val numFirstPostsToReview = 1
    val numFirstPostsToApprove = 0
    val numFirstPostsToAllow = 0
    val headStylesHtml = ""
    val headScriptsHtml = ""
    val endOfBodyHtml = ""
    val headerHtml = ""
    val footerHtml = ""
    val showForumCategories = false
    val horizontalComments = false
    val socialLinksHtml = ""
    val logoUrlOrHtml = ""
    val companyDomain = "www.example.com"
    val companyFullName = "Unnamed Company Full Name"
    val companyShortName = "Unnamed Company"
    val googleUniversalAnalyticsTrackingId = ""
    val showComplicatedStuff = false
  }
}


case class EffectiveSettings(
  editedSettingsChain: immutable.Seq[EditedSettings],
  default: AllSettings)
  extends AllSettings {

  def firstInChain[V](getField: (EditedSettings) => Option[V]): Option[V] = {
    for (editedSettings <- editedSettingsChain) {
      val anyValue = getField(editedSettings)
      if (anyValue.isDefined)
        return anyValue
    }
    None
  }

  def title: String = firstInChain(_.title) getOrElse default.title
  def description: String = firstInChain(_.description) getOrElse default.description
  def userMustBeAuthenticated: Boolean = firstInChain(_.userMustBeAuthenticated) getOrElse default.userMustBeAuthenticated
  def userMustBeApproved: Boolean = firstInChain(_.userMustBeApproved) getOrElse default.userMustBeApproved
  def allowGuestLogin: Boolean = firstInChain(_.allowGuestLogin) getOrElse default.allowGuestLogin
  def numFirstPostsToReview: Int = firstInChain(_.numFirstPostsToReview) getOrElse default.numFirstPostsToReview
  def numFirstPostsToApprove: Int = firstInChain(_.numFirstPostsToApprove) getOrElse default.numFirstPostsToApprove
  def numFirstPostsToAllow: Int = firstInChain(_.numFirstPostsToAllow) getOrElse default.numFirstPostsToAllow
  def headStylesHtml: String = firstInChain(_.headStylesHtml) getOrElse default.headStylesHtml
  def headScriptsHtml: String = firstInChain(_.headScriptsHtml) getOrElse default.headScriptsHtml
  def endOfBodyHtml: String = firstInChain(_.endOfBodyHtml) getOrElse default.endOfBodyHtml
  def headerHtml: String = firstInChain(_.headerHtml) getOrElse default.headerHtml
  def footerHtml: String = firstInChain(_.footerHtml) getOrElse default.footerHtml
  def showForumCategories: Boolean = firstInChain(_.showForumCategories) getOrElse default.showForumCategories
  def horizontalComments: Boolean = firstInChain(_.horizontalComments) getOrElse default.horizontalComments
  def socialLinksHtml: String = firstInChain(_.socialLinksHtml) getOrElse default.socialLinksHtml
  def logoUrlOrHtml: String = firstInChain(_.logoUrlOrHtml) getOrElse default.logoUrlOrHtml
  def companyDomain: String = firstInChain(_.companyDomain) getOrElse default.companyDomain
  def companyFullName: String = firstInChain(_.companyFullName) getOrElse default.companyFullName
  def companyShortName: String = firstInChain(_.companyShortName) getOrElse default.companyShortName
  def googleUniversalAnalyticsTrackingId: String = firstInChain(_.googleUniversalAnalyticsTrackingId) getOrElse default.googleUniversalAnalyticsTrackingId
  def showComplicatedStuff: Boolean = firstInChain(_.showComplicatedStuff) getOrElse default.showComplicatedStuff

  def isGuestLoginAllowed =
    allowGuestLogin && !userMustBeAuthenticated && !userMustBeApproved

}


object Settings2 {

  def settingsToJson(editedSettings2: EditedSettings) = {
    val s = editedSettings2
    Json.obj(
      "title" -> JsStringOrNull(s.title),
      "description" -> JsStringOrNull(s.description),
      "userMustBeAuthenticated" -> JsBooleanOrNull(s.userMustBeAuthenticated),
      "userMustBeApproved" -> JsBooleanOrNull(s.userMustBeApproved),
      "allowGuestLogin" -> JsBooleanOrNull(s.allowGuestLogin),
      "numFirstPostsToReview" -> JsNumberOrNull(s.numFirstPostsToReview),
      "numFirstPostsToApprove" -> JsNumberOrNull(s.numFirstPostsToApprove),
      "numFirstPostsToAllow" -> JsNumberOrNull(s.numFirstPostsToAllow),
      "headStylesHtml" -> JsStringOrNull(s.headStylesHtml),
      "headScriptsHtml" -> JsStringOrNull(s.headScriptsHtml),
      "endOfBodyHtml" -> JsStringOrNull(s.endOfBodyHtml),
      "headerHtml" -> JsStringOrNull(s.headerHtml),
      "footerHtml" -> JsStringOrNull(s.footerHtml),
      "showForumCategories" -> JsBooleanOrNull(s.showForumCategories),
      "horizontalComments" -> JsBooleanOrNull(s.horizontalComments),
      "socialLinksHtml" -> JsStringOrNull(s.socialLinksHtml),
      "logoUrlOrHtml" -> JsStringOrNull(s.logoUrlOrHtml),
      "companyDomain" -> JsStringOrNull(s.companyDomain),
      "companyFullName" -> JsStringOrNull(s.companyFullName),
      "companyShortName" -> JsStringOrNull(s.companyShortName),
      "googleUniversalAnalyticsTrackingId" -> JsStringOrNull(s.googleUniversalAnalyticsTrackingId),
      "showComplicatedStuff" -> JsBooleanOrNull(s.showComplicatedStuff))
  }


  def d = AllSettings.Default

  def settingsToSaveFromJson(json: JsValue) = new SettingsToSave(
    title = anyString(json, "title", d.title),
    description = anyString(json, "description", d.description),
    userMustBeAuthenticated = anyBool(json, "userMustBeAuthenticated", d.userMustBeAuthenticated),
    userMustBeApproved = anyBool(json, "userMustBeApproved", d.userMustBeApproved),
    allowGuestLogin = anyBool(json, "allowGuestLogin", d.allowGuestLogin),
    numFirstPostsToReview = anyInt(json, "numFirstPostsToReview", d.numFirstPostsToReview),
    numFirstPostsToApprove = anyInt(json, "numFirstPostsToApprove", d.numFirstPostsToApprove),
    numFirstPostsToAllow = anyInt(json, "numFirstPostsToAllow", d.numFirstPostsToAllow),
    headStylesHtml = anyString(json, "headStylesHtml", d.headStylesHtml),
    headScriptsHtml = anyString(json, "headScriptsHtml", d.headScriptsHtml),
    endOfBodyHtml = anyString(json, "endOfBodyHtml", d.endOfBodyHtml),
    headerHtml = anyString(json, "headerHtml", d.headerHtml),
    footerHtml = anyString(json, "footerHtml", d.footerHtml),
    showForumCategories = anyBool(json, "showForumCategories", d.showForumCategories),
    horizontalComments = anyBool(json, "horizontalComments", d.horizontalComments),
    socialLinksHtml = anyString(json, "socialLinksHtml", d.socialLinksHtml),
    logoUrlOrHtml = anyString(json, "logoUrlOrHtml", d.logoUrlOrHtml),
    companyDomain = anyString(json, "companyDomain", d.companyDomain),
    companyFullName = anyString(json, "companyFullName", d.companyFullName),
    companyShortName = anyString(json, "companyShortName", d.companyShortName),
    googleUniversalAnalyticsTrackingId =
      anyString(json, "googleUniversalAnalyticsTrackingId", d.googleUniversalAnalyticsTrackingId),
    showComplicatedStuff = anyBool(json, "showComplicatedStuff", d.showComplicatedStuff))


  private def anyString(json: JsValue, field: String, default: String): Option[Option[String]] =
    (json \ field).toOption.map(_ match {
      case s: JsString =>
        if (s.value == default) None else Some(s.value)
      case JsNull =>
        None
      case bad =>
        throwBadRequest("EsE5J4K02", s"'$field' is not a JsString, but a ${classNameOf(bad)}")
    })

  private def anyBool(json: JsValue, field: String, default: Boolean): Option[Option[Boolean]] =
    (json \ field).toOption.map(_ match {
      case b: JsBoolean =>
        if (b.value == default) None else Some(b.value)
      case JsNull =>
        None
      case bad =>
        throwBadRequest("EsE5J4K02", s"'$field' is not a JsBoolean, but a ${classNameOf(bad)}")
    })

  private def anyInt(json: JsValue, field: String, default: Int): Option[Option[Int]] =
    (json \ field).toOption.map(_ match {
      case n: JsNumber =>
        val value = n.value.toInt
        if (value == default) None else Some(value)
      case JsNull =>
        None
      case bad =>
        throwBadRequest("EsE5J4K02", s"'$field' is not a JsNumber, but a ${classNameOf(bad)}")
    })
}
