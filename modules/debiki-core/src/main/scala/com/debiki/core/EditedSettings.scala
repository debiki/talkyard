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
  companyDomain: Option[String],
  companyFullName: Option[String],
  companyShortName: Option[String],
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
    companyDomain = None,
    companyFullName = None,
    companyShortName = None,
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
  userMustBeAuthenticated: Option[Option[Boolean]],
  userMustBeApproved: Option[Option[Boolean]],
  allowGuestLogin: Option[Option[Boolean]],
  numFirstPostsToReview: Option[Option[Int]],
  numFirstPostsToApprove: Option[Option[Int]],
  numFirstPostsToAllow: Option[Option[Int]],
  headStylesHtml: Option[Option[String]],
  headScriptsHtml: Option[Option[String]],
  endOfBodyHtml: Option[Option[String]],
  headerHtml: Option[Option[String]],
  footerHtml: Option[Option[String]],
  showForumCategories: Option[Option[Boolean]],
  horizontalComments: Option[Option[Boolean]],
  socialLinksHtml: Option[Option[String]],
  logoUrlOrHtml: Option[Option[String]],
  companyDomain: Option[Option[String]],
  companyFullName: Option[Option[String]],
  companyShortName: Option[Option[String]],
  googleUniversalAnalyticsTrackingId: Option[Option[String]],
  showComplicatedStuff: Option[Option[Boolean]],
  htmlTagCssClasses: Option[Option[String]])


