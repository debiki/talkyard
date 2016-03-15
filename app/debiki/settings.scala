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
  def orgDomain: String
  def orgFullName: String
  def orgShortName: String
  def contribAgreement: ContribAgreement
  def contentLicense: ContentLicense
  def googleUniversalAnalyticsTrackingId: String
  def showComplicatedStuff: Boolean
  def htmlTagCssClasses: String

  def toJson = Settings2.settingsToJson(toEditedSettings)

  def toEditedSettings = EditedSettings(
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
    orgDomain = Some(self.orgDomain),
    orgFullName = Some(self.orgFullName),
    orgShortName = Some(self.orgShortName),
    contribAgreement = Some(self.contribAgreement),
    contentLicense = Some(self.contentLicense),
    googleUniversalAnalyticsTrackingId = Some(self.googleUniversalAnalyticsTrackingId),
    showComplicatedStuff = Some(self.showComplicatedStuff),
    htmlTagCssClasses = Some(self.htmlTagCssClasses))
}


object AllSettings {

  /** I read somewhere on Discourse's forum that very few people edit their posts 5 hours
    * after they've been created. So 5 hours will result in very few edits to review
    * — and hopefully catch all/most malicious edits.
    */
  val PostRecentlyCreatedLimitMs = 5 * 3600 * 1000

  val Default = new AllSettings {
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
    val orgDomain = ""
    val orgFullName = ""
    val orgShortName = ""
    var contribAgreement = ContribAgreement.CcBy3And4
    var contentLicense = ContentLicense.CcBySa4
    val googleUniversalAnalyticsTrackingId = ""
    val showComplicatedStuff = false
    val htmlTagCssClasses = ""
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
  def orgDomain: String = firstInChain(_.orgDomain) getOrElse default.orgDomain
  def orgFullName: String = firstInChain(_.orgFullName) getOrElse default.orgFullName
  def orgShortName: String = firstInChain(_.orgShortName) getOrElse default.orgShortName
  def contribAgreement: ContribAgreement = firstInChain(_.contribAgreement) getOrElse default.contribAgreement
  def contentLicense: ContentLicense = firstInChain(_.contentLicense) getOrElse default.contentLicense
  def googleUniversalAnalyticsTrackingId: String = firstInChain(_.googleUniversalAnalyticsTrackingId) getOrElse default.googleUniversalAnalyticsTrackingId
  def showComplicatedStuff: Boolean = firstInChain(_.showComplicatedStuff) getOrElse default.showComplicatedStuff
  def htmlTagCssClasses: String = firstInChain(_.htmlTagCssClasses) getOrElse default.htmlTagCssClasses

  def isGuestLoginAllowed =
    allowGuestLogin && !userMustBeAuthenticated && !userMustBeApproved

  /** Finds any invalid setting value, or invalid settings configurations. */
  def findAnyError: Option[String] = {
    // Hmm ...
    None
  }

}


object Settings2 {

  def settingsToJson(editedSettings2: EditedSettings) = {
    val s = editedSettings2
    Json.obj(
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
      "companyDomain" -> JsStringOrNull(s.orgDomain),
      "companyFullName" -> JsStringOrNull(s.orgFullName),
      "companyShortName" -> JsStringOrNull(s.orgShortName),
      "contribAgreement" -> JsNumberOrNull(s.contribAgreement.map(_.toInt)),
      "contentLicense" -> JsNumberOrNull(s.contentLicense.map(_.toInt)),
      "googleUniversalAnalyticsTrackingId" -> JsStringOrNull(s.googleUniversalAnalyticsTrackingId),
      "showComplicatedStuff" -> JsBooleanOrNull(s.showComplicatedStuff),
      "htmlTagCssClasses" -> JsStringOrNull(s.htmlTagCssClasses))
  }


  def d = AllSettings.Default

  def settingsToSaveFromJson(json: JsValue) = new SettingsToSave(
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
    orgDomain = anyString(json, "companyDomain", d.orgDomain),
    orgFullName = anyString(json, "companyFullName", d.orgFullName),
    orgShortName = anyString(json, "companyShortName", d.orgShortName),
    contribAgreement = anyInt(json, "contribAgreement", d.contribAgreement.toInt).map(_.map(
      ContribAgreement.fromInt(_) getOrElse throwBadRequest(
        "EsE5YK28", "Invalid contributors agreement"))),
    contentLicense = anyInt(json, "contentLicense", d.contentLicense.toInt).map(_.map(
      ContentLicense.fromInt(_) getOrElse throwBadRequest("EsE5YK28", "Invalid content license"))),
    googleUniversalAnalyticsTrackingId =
      anyString(json, "googleUniversalAnalyticsTrackingId", d.googleUniversalAnalyticsTrackingId),
    showComplicatedStuff = anyBool(json, "showComplicatedStuff", d.showComplicatedStuff),
    htmlTagCssClasses = anyString(json, "htmlTagCssClasses", d.htmlTagCssClasses))


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
