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
import Prelude._
import play.api.libs.json.JsObject


sealed abstract class ContribAgreement(protected val IntVal: Int) { def toInt: Int = IntVal }
object ContribAgreement {
  case object CcBy3And4 extends ContribAgreement(10)
  case object CcBySa3And4 extends ContribAgreement(40)
  case object CcByNcSa3And4 extends ContribAgreement(70)
  case object UseOnThisSiteOnly extends ContribAgreement(100)

  def fromInt(value: Int): Option[ContribAgreement] = Some(value match {
    case CcBy3And4.IntVal => CcBy3And4
    case CcBySa3And4.IntVal => CcBySa3And4
    case CcByNcSa3And4.IntVal => CcByNcSa3And4
    case UseOnThisSiteOnly.IntVal => UseOnThisSiteOnly
    case _ => return None
  })
}


sealed abstract class ContentLicense(protected val IntVal: Int) { def toInt: Int = IntVal }
object ContentLicense {
  case object CcBy4 extends ContentLicense(10)
  case object CcBySa4 extends ContentLicense(40)
  case object CcByNcSa4 extends ContentLicense(70)
  case object AllRightsReserved extends ContentLicense(100)

  def fromInt(value: Int): Option[ContentLicense] = Some(value match {
    case CcBy4.IntVal => CcBy4
    case CcBySa4.IntVal => CcBySa4
    case CcByNcSa4.IntVal => CcByNcSa4
    case AllRightsReserved.IntVal => AllRightsReserved
    case _ => return None
  })
}


/** Contains only settings that have been edited — they are Some(value), others are None.
  * Because only edited settings need to be saved to the database.
  */
case class EditedSettings(
  userMustBeAuthenticated: Option[Boolean],
  userMustBeApproved: Option[Boolean],
  expireIdleAfterMins: Option[Int],
  inviteOnly: Option[Boolean],
  allowSignup: Option[Boolean],
  enableCustomIdps: Option[Boolean],
  useOnlyCustomIdps: Option[Boolean],
  allowLocalSignup: Option[Boolean],
  allowGuestLogin: Option[Boolean],
  enableGoogleLogin: Option[Boolean],
  enableFacebookLogin: Option[Boolean],
  enableTwitterLogin: Option[Boolean],
  enableGitHubLogin: Option[Boolean],
  enableGitLabLogin: Option[Boolean],
  enableLinkedInLogin: Option[Boolean],
  enableVkLogin: Option[Boolean],
  enableInstagramLogin: Option[Boolean],
  requireVerifiedEmail: Option[Boolean],
  emailDomainBlacklist: Option[String],
  emailDomainWhitelist: Option[String],
  mayComposeBeforeSignup: Option[Boolean],
  mayPostBeforeEmailVerified: Option[Boolean],
  doubleTypeEmailAddress: Option[Boolean],
  doubleTypePassword: Option[Boolean],
  minPasswordLength: Option[Int],
  begForEmailAddress: Option[Boolean],
  enableSso: Option[Boolean],
  ssoUrl: Option[String],
  ssoNotApprovedUrl: Option[String],
  ssoLoginRequiredLogoutUrl: Option[String],
  ssoLogoutRedirUrl: Opt[St],
  ssoShowEmbAuthnBtns: Opt[i32],
  ssoPasetoV2LocalSecret: Opt[St],
  ssoPasetoV2PublicKey: Opt[St],
  ssoRefreshAuthnTokenUrl: Opt[St],
  rememberEmbSess: Opt[Bo],
  expireIdleEmbSessAfterMins: Opt[i32],
  forumMainView: Option[String],
  forumTopicsSortButtons: Option[String],
  forumCategoryLinks: Option[String],
  forumTopicsLayout: Option[TopicListLayout],
  forumCategoriesLayout: Option[CategoriesLayout],
  showCategories: Option[Boolean],
  showTopicFilterButton: Option[Boolean],
  showTopicTypes: Option[Boolean],
  selectTopicType: Option[Boolean],
  showAuthorHow: Option[ShowAuthorHow],
  watchbarStartsOpen: Option[Boolean],
  discussionLayout: Option[DiscussionLayout],
  discPostSortOrder: Option[PostSortOrder],
  discPostNesting: Option[NestingDepth],
  progressLayout: Option[ProgressLayout],
  embComSortOrder: Option[PostSortOrder],
  embComNesting: Option[NestingDepth],
  origPostReplyBtnTitle: Option[String],
  origPostVotes: Option[OrigPostVotes],
  enableDisagreeVote: Option[Bo],
  requireApprovalIfTrustLte: Option[TrustLevel],
  reviewAfterIfTrustLte: Option[TrustLevel],
  numFirstPostsToReview: Option[Int],
  numFirstPostsToApprove: Option[Int],
  maxPostsPendApprBefore: Option[Int],
  maxPostsPendRevwAftr: Option[Int],
  enableStopForumSpam: Option[Boolean],
  enableAkismet: Option[Boolean],
  akismetApiKey: Option[String],
  sendEmailToAkismet: Option[Boolean],
  faviconUrl: Option[String],
  headStylesHtml: Option[String],
  headScriptsHtml: Option[String],
  startOfBodyHtml: Option[String],
  endOfBodyHtml: Option[String],
  headerHtml: Option[String],
  navConf: Option[JsObject],
  footerHtml: Option[String],
  horizontalComments: Option[Boolean],
  socialLinksHtml: Option[String],
  logoUrlOrHtml: Option[String],
  orgDomain: Option[String],
  orgFullName: Option[String],
  orgShortName: Option[String],
  outboundEmailsFromName: Opt[St],
  outboundEmailsFromAddr: Opt[St],
  outboundEmailsReplyTo: Opt[St],
  outboundEmailsSmtpConf: Opt[JsObject],
  termsOfUseUrl: Option[String],
  privacyUrl: Option[String],
  rulesUrl: Option[String],
  contactEmailAddr: Option[String],
  contactUrl: Option[String],
  contribAgreement: Option[ContribAgreement],
  contentLicense: Option[ContentLicense],
  languageCode: Option[String],
  googleUniversalAnalyticsTrackingId: Option[String],
  enableForum: Option[Boolean],
  enableApi: Option[Boolean],
  enableTags: Option[Boolean],
  enableChat: Option[Boolean],
  enableDirectMessages: Option[Boolean],
  enableSimilarTopics: Option[Boolean],
  enableCors: Option[Boolean],
  allowCorsFrom: Option[String],
  allowCorsCreds: Option[Boolean],
  showSubCommunities: Option[Boolean],
  showExperimental: Option[Boolean],
  featureFlags: Option[String],
  allowEmbeddingFrom: Option[String],
  embeddedCommentsCategoryId: Option[CategoryId],
  htmlTagCssClasses: Option[String],
  numFlagsToHidePost: Option[Int],
  cooldownMinutesAfterFlaggedHidden: Option[Int],
  numFlagsToBlockNewUser: Option[Int],
  numFlaggersToBlockNewUser: Option[Int],
  notifyModsIfUserBlocked: Option[Boolean],
  regularMemberFlagWeight: Option[Float],
  coreMemberFlagWeight: Option[Float]) {

  numFirstPostsToApprove foreach { num =>
    require(0 <= num && num <= MaxNumFirstPosts, "TyE6JK250")
    if (num >= 1) maxPostsPendApprBefore foreach { maxPend =>
      // Db constraint: settings3_numfirst_allow_ge_approve.
      // Maybe instead just >= 1, default maybe 3?
      require(maxPend >= num, "TyEJ2GHF87")
    }
  }

  maxPostsPendApprBefore foreach { num =>
    require(0 <= num && num <= MaxNumFirstPosts, "TyE4GUK20M")
  }

  numFirstPostsToReview foreach { num =>
    require(0 <= num && num <= MaxNumFirstPosts, "TyE8WK2G3A")
    // No, skip, 0 disables:
    // if (num >= 1) maxPostsPendRevwAftr foreach { maxPend =>
    //   require(maxPend >= 1, "TyE305RKDJ5")
    // }
    // Maybe add constraint >= 1, default maybe 3?
  }

  maxPostsPendRevwAftr foreach { num =>
    require(0 <= num && num <= MaxNumFirstPosts, "TyE05RKD245")
  }
}


object EditedSettings {

  // Sync with Typescript [6KG2W57]
  val MaxNumFirstPosts = 10

  val empty: EditedSettings = EditedSettings(
    userMustBeAuthenticated = None,
    userMustBeApproved = None,
    expireIdleAfterMins = None,
    inviteOnly = None,
    allowSignup = None,
    enableCustomIdps = None,
    useOnlyCustomIdps = None,
    allowLocalSignup = None,
    allowGuestLogin = None,
    enableGoogleLogin = None,
    enableFacebookLogin = None,
    enableTwitterLogin = None,
    enableGitHubLogin = None,
    enableGitLabLogin = None,
    enableLinkedInLogin = None,
    enableVkLogin = None,
    enableInstagramLogin = None,
    requireVerifiedEmail = None,
    emailDomainBlacklist = None,
    emailDomainWhitelist = None,
    mayComposeBeforeSignup = None,
    mayPostBeforeEmailVerified = None,
    doubleTypeEmailAddress = None,
    doubleTypePassword = None,
    minPasswordLength = None,
    begForEmailAddress = None,
    enableSso = None,
    ssoUrl = None,
    ssoNotApprovedUrl = None,
    ssoLoginRequiredLogoutUrl = None,
    ssoLogoutRedirUrl = None,
    ssoShowEmbAuthnBtns = None,
    ssoPasetoV2LocalSecret = None,
    ssoPasetoV2PublicKey = None,
    ssoRefreshAuthnTokenUrl = None,
    rememberEmbSess = None,
    expireIdleEmbSessAfterMins = None,
    forumMainView = None,
    forumTopicsSortButtons = None,
    forumCategoryLinks = None,
    forumTopicsLayout = None,
    forumCategoriesLayout = None,
    showCategories = None,
    showTopicFilterButton = None,
    showTopicTypes = None,
    selectTopicType = None,
    showAuthorHow = None,
    watchbarStartsOpen = None,
    discussionLayout = None,
    discPostSortOrder = None,
    discPostNesting = None,
    progressLayout = None,
    embComSortOrder = None,
    embComNesting = None,
    origPostReplyBtnTitle = None,
    origPostVotes = None,
    enableDisagreeVote = None,
    requireApprovalIfTrustLte = None,
    reviewAfterIfTrustLte = None,
    numFirstPostsToReview = None,
    numFirstPostsToApprove = None,
    maxPostsPendApprBefore = None,
    maxPostsPendRevwAftr = None,
    enableStopForumSpam = None,
    enableAkismet = None,
    akismetApiKey = None,
    sendEmailToAkismet = None,
    faviconUrl = None,
    headStylesHtml = None,
    headScriptsHtml = None,
    startOfBodyHtml = None,
    endOfBodyHtml = None,
    headerHtml = None,
    navConf = None,
    footerHtml = None,
    horizontalComments = None,
    socialLinksHtml = None,
    logoUrlOrHtml = None,
    orgDomain = None,
    orgFullName = None,
    orgShortName = None,
    outboundEmailsFromName = None,
    outboundEmailsFromAddr = None,
    outboundEmailsReplyTo = None,
    outboundEmailsSmtpConf = None,
    termsOfUseUrl = None,
    privacyUrl = None,
    rulesUrl = None,
    contactEmailAddr = None,
    contactUrl = None,
    contribAgreement = None,
    contentLicense = None,
    languageCode = None,
    googleUniversalAnalyticsTrackingId = None,
    enableForum = None,
    enableApi = None,
    enableTags = None,
    enableChat = None,
    enableDirectMessages = None,
    enableSimilarTopics = None,
    enableCors = None,
    allowCorsFrom = None,
    allowCorsCreds = None,
    showSubCommunities = None,
    showExperimental = None,
    featureFlags = None,
    allowEmbeddingFrom = None,
    embeddedCommentsCategoryId = None,
    htmlTagCssClasses = None,
    numFlagsToHidePost = None,
    cooldownMinutesAfterFlaggedHidden = None,
    numFlagsToBlockNewUser = None,
    numFlaggersToBlockNewUser = None,
    notifyModsIfUserBlocked = None,
    regularMemberFlagWeight = None,
    coreMemberFlagWeight = None)

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
  expireIdleAfterMins: Option[Option[Int]] = None,
  inviteOnly: Option[Option[Boolean]] = None,
  allowSignup: Option[Option[Boolean]] = None,
  enableCustomIdps: Option[Option[Boolean]] = None,
  useOnlyCustomIdps: Option[Option[Boolean]] = None,
  allowLocalSignup: Option[Option[Boolean]] = None,
  allowGuestLogin: Option[Option[Boolean]] = None,
  enableGoogleLogin: Option[Option[Boolean]] = None,
  enableFacebookLogin: Option[Option[Boolean]] = None,
  enableTwitterLogin: Option[Option[Boolean]] = None,
  enableGitHubLogin: Option[Option[Boolean]] = None,
  enableGitLabLogin: Option[Option[Boolean]] = None,
  enableLinkedInLogin: Option[Option[Boolean]] = None,
  enableVkLogin: Option[Option[Boolean]] = None,
  enableInstagramLogin: Option[Option[Boolean]] = None,
  requireVerifiedEmail: Option[Option[Boolean]] = None,
  emailDomainBlacklist: Option[Option[String]] = None,
  emailDomainWhitelist: Option[Option[String]] = None,
  mayComposeBeforeSignup: Option[Option[Boolean]] = None,
  mayPostBeforeEmailVerified: Option[Option[Boolean]] = None,
  doubleTypeEmailAddress: Option[Option[Boolean]] = None,
  doubleTypePassword: Option[Option[Boolean]] = None,
  minPasswordLength: Option[Option[Int]] = None,
  begForEmailAddress: Option[Option[Boolean]] = None,
  enableSso: Option[Option[Boolean]] = None,
  ssoUrl: Option[Option[String]] = None,
  ssoNotApprovedUrl: Option[Option[String]] = None,
  ssoLoginRequiredLogoutUrl: Option[Option[String]] = None,
  ssoLogoutRedirUrl: Opt[Opt[St]] = None,
  ssoShowEmbAuthnBtns: Opt[Opt[i32]] = None,
  ssoPasetoV2LocalSecret: Opt[Opt[St]] = None,
  ssoPasetoV2PublicKey: Opt[Opt[St]] = None,
  ssoRefreshAuthnTokenUrl: Opt[Opt[St]] = None,
  rememberEmbSess: Opt[Opt[Bo]] = None,
  expireIdleEmbSessAfterMins: Opt[Opt[i32]] = None,
  forumMainView: Option[Option[String]] = None,
  forumTopicsSortButtons: Option[Option[String]] = None,
  forumCategoryLinks: Option[Option[String]] = None,
  forumTopicsLayout: Option[Option[TopicListLayout]] = None,
  forumCategoriesLayout: Option[Option[CategoriesLayout]] = None,
  showCategories: Option[Option[Boolean]] = None,
  showTopicFilterButton: Option[Option[Boolean]] = None,
  showTopicTypes: Option[Option[Boolean]] = None,
  selectTopicType: Option[Option[Boolean]] = None,
  showAuthorHow: Option[Option[ShowAuthorHow]] = None,
  watchbarStartsOpen: Option[Option[Boolean]] = None,
  discussionLayout: Option[Option[DiscussionLayout]] = None,
  discPostSortOrder: Option[Option[PostSortOrder]] = None,
  discPostNesting: Option[Option[NestingDepth]] = None,
  progressLayout: Option[Option[ProgressLayout]] = None,
  embComSortOrder: Option[Option[PostSortOrder]] = None,
  embComNesting: Option[Option[NestingDepth]] = None,
  origPostReplyBtnTitle: Option[Option[String]] = None,
  origPostVotes: Option[Option[OrigPostVotes]] = None,
  enableDisagreeVote: Option[Option[Bo]] = None,
  requireApprovalIfTrustLte: Option[Option[TrustLevel]] = None,
  reviewAfterIfTrustLte: Option[Option[TrustLevel]] = None,
  numFirstPostsToReview: Option[Option[Int]] = None,
  numFirstPostsToApprove: Option[Option[Int]] = None,
  maxPostsPendApprBefore: Option[Option[Int]] = None,
  maxPostsPendRevwAftr: Option[Option[Int]] = None,
  enableStopForumSpam: Option[Option[Boolean]] = None,
  enableAkismet: Option[Option[Boolean]] = None,
  akismetApiKey: Option[Option[String]] = None,
  sendEmailToAkismet: Option[Option[Boolean]] = None,
  faviconUrl: Option[Option[String]] = None,
  headStylesHtml: Option[Option[String]] = None,
  headScriptsHtml: Option[Option[String]] = None,
  startOfBodyHtml: Option[Option[String]] = None,
  endOfBodyHtml: Option[Option[String]] = None,
  headerHtml: Option[Option[String]] = None,
  navConf: Option[Option[JsObject]] = None,
  footerHtml: Option[Option[String]] = None,
  horizontalComments: Option[Option[Boolean]] = None,
  socialLinksHtml: Option[Option[String]] = None,
  logoUrlOrHtml: Option[Option[String]] = None,
  orgDomain: Option[Option[String]] = None,
  orgFullName: Option[Option[String]] = None,
  orgShortName: Option[Option[String]] = None,
  outboundEmailsFromName: Opt[Opt[St]] = None,
  outboundEmailsFromAddr: Opt[Opt[St]] = None,
  outboundEmailsReplyTo: Opt[Opt[St]] = None,
  outboundEmailsSmtpConf: Opt[Opt[JsObject]] = None,
  termsOfUseUrl: Option[Option[String]] = None,
  privacyUrl: Option[Option[String]] = None,
  rulesUrl: Option[Option[String]] = None,
  contactEmailAddr: Option[Option[String]] = None,
  contactUrl: Option[Option[String]] = None,
  contribAgreement: Option[Option[ContribAgreement]] = None,
  contentLicense: Option[Option[ContentLicense]] = None,
  languageCode: Option[Option[String]] = None,
  googleUniversalAnalyticsTrackingId: Option[Option[String]] = None,
  enableForum: Option[Option[Boolean]] = None,
  enableApi: Option[Option[Boolean]] = None,
  enableTags: Option[Option[Boolean]] = None,
  enableChat: Option[Option[Boolean]] = None,
  enableDirectMessages: Option[Option[Boolean]] = None,
  enableSimilarTopics: Option[Option[Boolean]] = None,
  enableCors: Option[Option[Boolean]] = None,
  allowCorsFrom: Option[Option[String]] = None,
  allowCorsCreds: Option[Option[Boolean]] = None,
  showSubCommunities: Option[Option[Boolean]] = None,
  showExperimental: Option[Option[Boolean]] = None,
  featureFlags: Option[Option[String]] = None,
  allowEmbeddingFrom: Option[Option[String]] = None,
  embeddedCommentsCategoryId: Option[Option[CategoryId]] = None,
  htmlTagCssClasses: Option[Option[String]] = None,
  numFlagsToHidePost: Option[Option[Int]] = None,
  cooldownMinutesAfterFlaggedHidden: Option[Option[Int]] = None,
  numFlagsToBlockNewUser: Option[Option[Int]] = None,
  numFlaggersToBlockNewUser: Option[Option[Int]] = None,
  notifyModsIfUserBlocked: Option[Option[Boolean]] = None,
  regularMemberFlagWeight: Option[Option[Float]] = None,
  coreMemberFlagWeight: Option[Option[Float]] = None) {

  // The language code must be like en_US.
  require(languageCode.forall(_.forall(_.isAToZUnderscoreOnly)), "Weird lang code [TyE2WKBYF]")
  require(languageCode.forall(_.forall(_.length < 10)), "Too long language code [TyE2WKBP5]")

  // useOnlyCustomIdps and enableCustomIdps: See SettingsDao, [onl_cust_idp].

  if (contribAgreement.contains(Some(ContribAgreement.UseOnThisSiteOnly)) &&
      contentLicense.isDefined) {
    require(contentLicense.get.contains(ContentLicense.AllRightsReserved), "EsE8YKF2")
  }

  // For now, disable license-to-us-for-use-on-this-site-only, see [6UK2F4X] in admin-app.ts(?).
  if (contribAgreement.contains(Some(ContribAgreement.UseOnThisSiteOnly))) {
    unimplemented("UseOnThisSiteOnly not yet supported because of tricky legal stuff [EsE4YKW21]")
  }

  for (anyName <- outboundEmailsFromName; name <- anyName) {
    Validation.findEmailNameProblem(name) foreach { problem =>
      throwBadReq3("TyE5MW2Z8", s"Weird email From name: $problem, the From name: '$name'")
    }
  }
}


