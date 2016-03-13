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

package com.debiki.core

import EditedSettings._
import Prelude.unimplemented


sealed abstract class ContribAgreement(protected val IntVal: Int) { def toInt = IntVal }
object ContribAgreement {
  case object UseOnThisSiteOnly extends ContribAgreement(1)
  case object MitAndCcBy3And4 extends ContribAgreement(2)

  def fromInt(value: Int): Option[ContribAgreement] = Some(value match {
    case UseOnThisSiteOnly.IntVal => UseOnThisSiteOnly
    case MitAndCcBy3And4.IntVal => MitAndCcBy3And4
    case _ => return None
  })
}


sealed abstract class ContentLicense(protected val IntVal: Int) { def toInt = IntVal }
object ContentLicense {
  case object AllRightsReserved extends ContentLicense(1)
  case object CcBySa4 extends ContentLicense(2)
  case object CcByNcSa4 extends ContentLicense(3)

  def fromInt(value: Int): Option[ContentLicense] = Some(value match {
    case AllRightsReserved.IntVal => AllRightsReserved
    case CcBySa4.IntVal => CcBySa4
    case CcByNcSa4.IntVal => CcByNcSa4
    case _ => return None
  })
}


/** Contains only settings that have been edited — they are Some(value), others are None.
  * Because only edited settings need to be saved to the database.
  */
case class EditedSettings(
  userMustBeAuthenticated: Option[Boolean],
  userMustBeApproved: Option[Boolean],
  allowGuestLogin: Option[Boolean],
  numFirstPostsToReview: Option[Int],
  numFirstPostsToApprove: Option[Int],
  numFirstPostsToAllow: Option[Int],
  headStylesHtml: Option[String],
  headScriptsHtml: Option[String],
  endOfBodyHtml: Option[String],
  headerHtml: Option[String],
  footerHtml: Option[String],
  showForumCategories: Option[Boolean],
  horizontalComments: Option[Boolean],
  socialLinksHtml: Option[String],
  logoUrlOrHtml: Option[String],
  orgDomain: Option[String],
  orgFullName: Option[String],
  orgShortName: Option[String],
  contribAgreement: Option[ContribAgreement],
  contentLicense: Option[ContentLicense],
  googleUniversalAnalyticsTrackingId: Option[String],
  showComplicatedStuff: Option[Boolean],
  htmlTagCssClasses: Option[String]) {

  numFirstPostsToAllow foreach { num =>
    require(num >= 0 && num <= MaxNumFirstPosts, "EsE4GUK20")
  }

  numFirstPostsToApprove foreach { num =>
    require(num >= 0 && num <= MaxNumFirstPosts, "EsE6JK250")
    numFirstPostsToAllow foreach { numToAllow =>
      require(numToAllow >= num, "EsE2GHF8")
    }
  }

  numFirstPostsToReview foreach { num =>
    require(num >= 0 && num <= MaxNumFirstPosts, "EsE8WK2G3")
  }
}


object EditedSettings {

  // Sync with Typescript [6KG2W57]
  val MaxNumFirstPosts = 10

  val empty = EditedSettings(
    userMustBeAuthenticated = None,
    userMustBeApproved = None,
    allowGuestLogin = None,
    numFirstPostsToReview = None,
    numFirstPostsToApprove = None,
    numFirstPostsToAllow = None,
    headStylesHtml = None,
    headScriptsHtml = None,
    endOfBodyHtml = None,
    headerHtml = None,
    footerHtml = None,
    showForumCategories = None,
    horizontalComments = None,
    socialLinksHtml = None,
    logoUrlOrHtml = None,
    orgDomain = None,
    orgFullName = None,
    orgShortName = None,
    contribAgreement = None,
    contentLicense = None,
    googleUniversalAnalyticsTrackingId = None,
    showComplicatedStuff = None,
    htmlTagCssClasses = None)

}


/** E.g. settingsToSave.title.isDefined means that the title should be updated.
  * And settingsToSave.title.get.isEmpty means that its value should be cleared,
  * so that the default will be used instead.
  * And if settingsToSave.title.get.isDefined, then the title will be set to
  * settingsToSave.title.get.get.
  */
case class SettingsToSave(
  userMustBeAuthenticated: Option[Option[Boolean]] = None,
  userMustBeApproved: Option[Option[Boolean]] = None,
  allowGuestLogin: Option[Option[Boolean]] = None,
  numFirstPostsToReview: Option[Option[Int]] = None,
  numFirstPostsToApprove: Option[Option[Int]] = None,
  numFirstPostsToAllow: Option[Option[Int]] = None,
  headStylesHtml: Option[Option[String]] = None,
  headScriptsHtml: Option[Option[String]] = None,
  endOfBodyHtml: Option[Option[String]] = None,
  headerHtml: Option[Option[String]] = None,
  footerHtml: Option[Option[String]] = None,
  showForumCategories: Option[Option[Boolean]] = None,
  horizontalComments: Option[Option[Boolean]] = None,
  socialLinksHtml: Option[Option[String]] = None,
  logoUrlOrHtml: Option[Option[String]] = None,
  orgDomain: Option[Option[String]] = None,
  orgFullName: Option[Option[String]] = None,
  orgShortName: Option[Option[String]] = None,
  contribAgreement: Option[Option[ContribAgreement]] = None,
  contentLicense: Option[Option[ContentLicense]] = None,
  googleUniversalAnalyticsTrackingId: Option[Option[String]] = None,
  showComplicatedStuff: Option[Option[Boolean]] = None,
  htmlTagCssClasses: Option[Option[String]] = None) {

  if (contribAgreement.contains(Some(ContribAgreement.UseOnThisSiteOnly)) &&
      contentLicense.isDefined) {
    require(contentLicense.get.contains(ContentLicense.AllRightsReserved), "EsE5YKF2")
  }

  // For now, disable license-to-us-for-use-on-this-site-only, see [6UK2F4X] in admin-app.ts(?).
  if (contribAgreement.contains(Some(ContribAgreement.UseOnThisSiteOnly))) {
    unimplemented("UseOnThisSiteOnly not yet supported because of tricky legal stuff [EsE4YKW21]")
  }
}


