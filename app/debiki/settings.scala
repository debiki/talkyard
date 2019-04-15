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
import debiki.EdHttp.throwBadRequest
import scala.collection.mutable.ArrayBuffer
import scala.util.matching.Regex
import talkyard.server.JsX._



trait AllSettings {
  self =>

  def userMustBeAuthenticated: Boolean  ; RENAME // to mustLoginToRead ?
  def userMustBeApproved: Boolean       ; RENAME // to mustLoginToContribute?
      // Need to change how it works too: in the db, set mustBeAuthenticatedToRead = true  [2KZMQ5]
      // if must-be-approved = true.

  def expireIdleAfterMins: Int
  // def approveInvitesHow: HowApproveInvites.BeforeTheyAreSent/AfterSignup/AlwaysAllow
  def inviteOnly: Boolean
  def allowSignup: Boolean
  def allowLocalSignup: Boolean
  def allowGuestLogin: Boolean
  def enableGoogleLogin: Boolean
  def enableFacebookLogin: Boolean
  def enableTwitterLogin: Boolean
  def enableGitHubLogin: Boolean
  def enableGitLabLogin: Boolean
  def enableLinkedInLogin: Boolean
  def enableVkLogin: Boolean
  def enableInstagramLogin: Boolean
  def requireVerifiedEmail: Boolean
  def emailDomainBlacklist: String
  def emailDomainWhitelist: String
  def mayComposeBeforeSignup: Boolean
  def mayPostBeforeEmailVerified: Boolean

  /** When signing up and specifying an email address, one needs to type it twice, so we can
    * check for typos. Not yet implemented (currently never need to double type).
    */
  def doubleTypeEmailAddress: Boolean

  /** See 'doubleTypeEmailAddress' above. Also not yet implemented. */
  def doubleTypePassword: Boolean

  /** Cannot edit (right now at least), except for via server conf val. */
  def minPasswordLength: Int

  /** When someone signs up, if hen doesn't specify an email address, tell hen that then we
    * cannot send hen notifications about new replies. And show buttons:
    *  [Specify email address] [No, skip]
    */
  def begForEmailAddress: Boolean

  // Single Sign-On
  def enableSso: Boolean
  def ssoUrl: String
  //  If a user logs in via SSO, but admin approval of new users is required, and the user's
  // account hasn't been approved (or has been rejected), then the user is sent to this page.
  def ssoNotApprovedUrl: String

  REFACTOR // ----- These could be moved to per member uiPrefs fields. ------------
  def forumMainView: String
  def forumTopicsSortButtons: String
  def forumCategoryLinks: String
  def forumTopicsLayout: TopicListLayout
  def forumCategoriesLayout: CategoriesLayout
  def showCategories: Boolean
  def showTopicFilterButton: Boolean
  def showTopicTypes: Boolean
  def selectTopicType: Boolean
  def showAuthorHow: ShowAuthorHow
  def watchbarStartsOpen: Boolean
  // -------------------------------------------------------------------------------

  def numFirstPostsToReview: Int
  def numFirstPostsToApprove: Int
  def numFirstPostsToAllow: Int
  def faviconUrl: String
  def headStylesHtml: String
  def headScriptsHtml: String
  def endOfBodyHtml: String
  def headerHtml: String
  def footerHtml: String
  def horizontalComments: Boolean
  def socialLinksHtml: String
  def logoUrlOrHtml: String
  def orgDomain: String
  def orgFullName: String
  def orgShortName: String
  def termsOfUseUrl: String
  def privacyUrl: String
  def rulesUrl: String
  def contactEmailAddr: String
  def contactUrl: String
  def contribAgreement: ContribAgreement
  def contentLicense: ContentLicense
  def languageCode: String
  def googleUniversalAnalyticsTrackingId: String

  /** If !enableForum, then the site is used for embedded comments only. */
  def enableForum: Boolean
  def enableApi: Boolean
  def enableTags: Boolean
  /** There will (maybe) later be allow-chat and allow-direct-messages *group permissions* too.
    * So, if direct messages and chat are enabled, still maybe not everyone will be
    * allowed to post direct messages, or create chat channels. For example, if a site
    * is primarily intended for question-answers, and one doesn't want new users to start direct-
    * messaging others or chatting.
    */
  def enableChat: Boolean
  def enableDirectMessages: Boolean

  def showSubCommunities: Boolean  // RENAME to enableSubCommunities? Why "show"?
  def showExperimental: Boolean
  def featureFlags: String

  def allowEmbeddingFrom: String
  def embeddedCommentsCategoryId: CategoryId
  def htmlTagCssClasses: String

  def numFlagsToHidePost: Int
  def cooldownMinutesAfterFlaggedHidden: Int

  def numFlagsToBlockNewUser: Int
  def numFlaggersToBlockNewUser: Int
  def notifyModsIfUserBlocked: Boolean

  def regularMemberFlagWeight: Float
  def coreMemberFlagWeight: Float

  def toJson: JsObject = Settings2.settingsToJson(toEditedSettings)

  // Pretend all settings have been edited, so they all will be included in the json.
  private def toEditedSettings = EditedSettings(
    userMustBeAuthenticated = Some(self.userMustBeAuthenticated),
    userMustBeApproved = Some(self.userMustBeApproved),
    expireIdleAfterMins = Some(self.expireIdleAfterMins),
    inviteOnly = Some(self.inviteOnly),
    allowSignup = Some(self.allowSignup),
    allowLocalSignup = Some(self.allowLocalSignup),
    allowGuestLogin = Some(self.allowGuestLogin),
    enableGoogleLogin = Some(self.enableGoogleLogin),
    enableFacebookLogin = Some(self.enableFacebookLogin),
    enableTwitterLogin = Some(self.enableTwitterLogin),
    enableGitHubLogin = Some(self.enableGitHubLogin),
    enableGitLabLogin = Some(self.enableGitLabLogin),
    enableLinkedInLogin = Some(self.enableLinkedInLogin),
    enableVkLogin = Some(self.enableVkLogin),
    enableInstagramLogin = Some(self.enableInstagramLogin),
    requireVerifiedEmail = Some(self.requireVerifiedEmail),
    emailDomainBlacklist = Some(self.emailDomainBlacklist),
    emailDomainWhitelist = Some(self.emailDomainWhitelist),
    mayComposeBeforeSignup = Some(self.mayComposeBeforeSignup),
    mayPostBeforeEmailVerified = Some(self.mayPostBeforeEmailVerified),
    doubleTypeEmailAddress = Some(self.doubleTypeEmailAddress),
    doubleTypePassword = Some(self.doubleTypePassword),
    minPasswordLength = Some(self.minPasswordLength),
    begForEmailAddress = Some(self.begForEmailAddress),
    enableSso = Some(self.enableSso),
    ssoUrl = Some(self.ssoUrl),
    ssoNotApprovedUrl = Some(self.ssoNotApprovedUrl),
    forumMainView = Some(self.forumMainView),
    forumTopicsSortButtons = Some(self.forumTopicsSortButtons),
    forumCategoryLinks = Some(self.forumCategoryLinks),
    forumTopicsLayout = Some(self.forumTopicsLayout),
    forumCategoriesLayout = Some(self.forumCategoriesLayout),
    showCategories = Some(self.showCategories),
    showTopicFilterButton = Some(self.showTopicFilterButton),
    showTopicTypes = Some(self.showTopicTypes),
    selectTopicType = Some(self.selectTopicType),
    showAuthorHow = Some(self.showAuthorHow),
    watchbarStartsOpen = Some(self.watchbarStartsOpen),
    numFirstPostsToReview = Some(self.numFirstPostsToReview),
    numFirstPostsToApprove = Some(self.numFirstPostsToApprove),
    numFirstPostsToAllow = Some(self.numFirstPostsToAllow),
    faviconUrl = Some(self.faviconUrl),
    headStylesHtml = Some(self.headStylesHtml),
    headScriptsHtml = Some(self.headScriptsHtml),
    endOfBodyHtml = Some(self.endOfBodyHtml),
    headerHtml = Some(self.headerHtml),
    footerHtml = Some(self.footerHtml),
    horizontalComments = Some(self.horizontalComments),
    socialLinksHtml = Some(self.socialLinksHtml),
    logoUrlOrHtml = Some(self.logoUrlOrHtml),
    orgDomain = Some(self.orgDomain),
    orgFullName = Some(self.orgFullName),
    orgShortName = Some(self.orgShortName),
    termsOfUseUrl = Some(self.termsOfUseUrl),
    privacyUrl = Some(self.privacyUrl),
    rulesUrl = Some(self.rulesUrl),
    contactEmailAddr = Some(self.contactEmailAddr),
    contactUrl = Some(self.contactUrl),
    contribAgreement = Some(self.contribAgreement),
    contentLicense = Some(self.contentLicense),
    languageCode = Some(self.languageCode),
    googleUniversalAnalyticsTrackingId = Some(self.googleUniversalAnalyticsTrackingId),
    enableForum = Some(self.enableForum),
    enableApi = Some(self.enableApi),
    enableTags = Some(self.enableTags),
    enableChat = Some(self.enableChat),
    enableDirectMessages = Some(self.enableDirectMessages),
    showSubCommunities = Some(self.showSubCommunities),
    showExperimental = Some(self.showExperimental),
    featureFlags = Some(self.featureFlags),
    allowEmbeddingFrom = Some(self.allowEmbeddingFrom),
    embeddedCommentsCategoryId = Some(self.embeddedCommentsCategoryId),
    htmlTagCssClasses = Some(self.htmlTagCssClasses),
    numFlagsToHidePost = Some(self.numFlagsToHidePost),
    cooldownMinutesAfterFlaggedHidden = Some(self.cooldownMinutesAfterFlaggedHidden),
    numFlagsToBlockNewUser = Some(self.numFlagsToBlockNewUser),
    numFlaggersToBlockNewUser = Some(self.numFlaggersToBlockNewUser),
    notifyModsIfUserBlocked = Some(self.notifyModsIfUserBlocked),
    regularMemberFlagWeight = Some(self.regularMemberFlagWeight),
    coreMemberFlagWeight = Some(self.coreMemberFlagWeight))
}


object AllSettings {

  /** I read somewhere on Discourse's forum that very few people edit their posts 5 hours
    * after they've been created. So 5 hours will result in very few edits to review
    * — and hopefully catch all/most malicious edits.
    */
  val PostRecentlyCreatedLimitMs: Int = 5 * 3600 * 1000

  val MinPasswordLengthHardcodedDefault = 10
  val HardMinPasswordLength = 8

  val MaxPendingMaybeSpamPostsNewMember = 3  // sync with e2e test [TyT029ASL45]
  val MaxPendingMaybeSpamPostsFullMember = 6

  def makeDefault(globals: Globals): AllSettings = new AllSettings {  // [8L4KWU02]
    val userMustBeAuthenticated = false
    val userMustBeApproved = false
    // One year. Like Gmail and Facebook (well, they have forever, instead). A Talkyard
    // community admin says his members tend to think their accounts have been hacked,
    // if they've suddenly been logged out.
    val expireIdleAfterMins: Int = 60 * 24 * 365  // [7AKR04]
    val inviteOnly = false
    val allowSignup = true
    val allowLocalSignup = true
    val allowGuestLogin = false
    val enableGoogleLogin: Boolean = globals.socialLogin.googleOAuthSettings.isGood
    val enableFacebookLogin: Boolean = globals.socialLogin.facebookOAuthSettings.isGood
    val enableTwitterLogin: Boolean = globals.socialLogin.twitterOAuthSettings.isGood
    val enableGitHubLogin: Boolean = globals.socialLogin.githubOAuthSettings.isGood
    val enableGitLabLogin: Boolean = globals.socialLogin.gitlabOAuthSettings.isGood
    val enableLinkedInLogin: Boolean = globals.socialLogin.linkedInOAuthSettings.isGood
    val enableVkLogin: Boolean = globals.socialLogin.vkOAuthSettings.isGood
    val enableInstagramLogin: Boolean = globals.socialLogin.instagramOAuthSettings.isGood
    val requireVerifiedEmail = true
    val emailDomainBlacklist = ""
    val emailDomainWhitelist = ""
    val mayComposeBeforeSignup = false
    val mayPostBeforeEmailVerified = false
    val doubleTypeEmailAddress = false
    val doubleTypePassword = false
    val minPasswordLength: Int = globals.minPasswordLengthAllSites
    val begForEmailAddress = false
    val enableSso = false
    val ssoUrl = ""
    val ssoNotApprovedUrl = ""
    val forumMainView = "latest"
    val forumTopicsSortButtons = "latest|top"
    val forumCategoryLinks = "categories"
    val forumTopicsLayout: TopicListLayout = TopicListLayout.Default
    val forumCategoriesLayout: CategoriesLayout = CategoriesLayout.Default
    val showCategories = true
    val showTopicFilterButton = true
    val showTopicTypes = true
    val selectTopicType = true
    val showAuthorHow: ShowAuthorHow = ShowAuthorHow.FullNameThenUsername
    val watchbarStartsOpen = true
    val numFirstPostsToReview = 1
    val numFirstPostsToApprove = 0
    val numFirstPostsToAllow = 0
    val faviconUrl = ""
    val headStylesHtml = ""
    val headScriptsHtml = ""
    val endOfBodyHtml = ""
    val headerHtml = ""
    val footerHtml = /* default CSS here: [5UK62W] */ o"""
      <footer><p>
        <a href="/-/terms-of-use" rel="nofollow">Terms of use</a>
        <a href="/-/privacy-policy" rel="nofollow">Privacy policy</a>
      </p></footer>"""
    val horizontalComments = false
    val socialLinksHtml = ""
    val logoUrlOrHtml = ""
    val orgDomain = ""
    val orgFullName = ""
    val orgShortName = ""
    val termsOfUseUrl = ""
    val privacyUrl = ""
    val rulesUrl = ""
    val contactEmailAddr = ""
    val contactUrl = ""
    val contribAgreement: ContribAgreement = ContribAgreement.CcBy3And4
    val contentLicense: ContentLicense = ContentLicense.CcBySa4
    val languageCode = "en_US"
    val googleUniversalAnalyticsTrackingId = ""
    val enableForum = true
    // People who install Talkyard themselves are a bit advanced, so starting with
    // these features enabled, makes sense?  [DEFFEAT]
    val enableApi = true
    val enableTags = true
    val enableChat = true
    val enableDirectMessages = true
    val showSubCommunities = false
    val showExperimental = false
    val featureFlags = ""
    val allowEmbeddingFrom = ""
    val embeddedCommentsCategoryId: CategoryId = NoCategoryId
    val htmlTagCssClasses = ""
    val numFlagsToHidePost = 3
    val cooldownMinutesAfterFlaggedHidden = 10
    val numFlagsToBlockNewUser = 3
    val numFlaggersToBlockNewUser = 3
    val notifyModsIfUserBlocked = true
    val regularMemberFlagWeight = 1.5f
    val coreMemberFlagWeight = 2.0f
  }
}


case class EffectiveSettings(
  editedSettingsChain: immutable.Seq[EditedSettings],
  default: AllSettings)
  extends AllSettings {

  def firstInChain[V](getField: EditedSettings => Option[V]): Option[V] = {
    for (editedSettings <- editedSettingsChain) {
      val anyValue = getField(editedSettings)
      if (anyValue.isDefined)
        return anyValue
    }
    None
  }

  def userMustBeAuthenticated: Boolean = firstInChain(_.userMustBeAuthenticated) getOrElse default.userMustBeAuthenticated
  def userMustBeApproved: Boolean = firstInChain(_.userMustBeApproved) getOrElse default.userMustBeApproved
  def expireIdleAfterMins: Int = firstInChain(_.expireIdleAfterMins) getOrElse default.expireIdleAfterMins
  def inviteOnly: Boolean = firstInChain(_.inviteOnly) getOrElse default.inviteOnly
  def allowSignup: Boolean = firstInChain(_.allowSignup) getOrElse default.allowSignup
  def allowLocalSignup: Boolean = firstInChain(_.allowLocalSignup) getOrElse default.allowLocalSignup
  def allowGuestLogin: Boolean = firstInChain(_.allowGuestLogin) getOrElse default.allowGuestLogin
  def enableGoogleLogin: Boolean = firstInChain(_.enableGoogleLogin) getOrElse default.enableGoogleLogin
  def enableFacebookLogin: Boolean = firstInChain(_.enableFacebookLogin) getOrElse default.enableFacebookLogin
  def enableTwitterLogin: Boolean = firstInChain(_.enableTwitterLogin) getOrElse default.enableTwitterLogin
  def enableGitHubLogin: Boolean = firstInChain(_.enableGitHubLogin) getOrElse default.enableGitHubLogin
  def enableGitLabLogin: Boolean = firstInChain(_.enableGitLabLogin) getOrElse default.enableGitLabLogin
  def enableLinkedInLogin: Boolean = firstInChain(_.enableLinkedInLogin) getOrElse default.enableLinkedInLogin
  def enableVkLogin: Boolean = firstInChain(_.enableVkLogin) getOrElse default.enableVkLogin
  def enableInstagramLogin: Boolean = firstInChain(_.enableInstagramLogin) getOrElse default.enableInstagramLogin
  def requireVerifiedEmail: Boolean = firstInChain(_.requireVerifiedEmail) getOrElse default.requireVerifiedEmail
  def emailDomainBlacklist: String = firstInChain(_.emailDomainBlacklist) getOrElse default.emailDomainBlacklist
  def emailDomainWhitelist: String = firstInChain(_.emailDomainWhitelist) getOrElse default.emailDomainWhitelist
  def mayComposeBeforeSignup: Boolean = firstInChain(_.mayComposeBeforeSignup) getOrElse default.mayComposeBeforeSignup
  def mayPostBeforeEmailVerified: Boolean = firstInChain(_.mayPostBeforeEmailVerified) getOrElse default.mayPostBeforeEmailVerified
  def doubleTypeEmailAddress: Boolean = firstInChain(_.doubleTypeEmailAddress) getOrElse default.doubleTypeEmailAddress
  def doubleTypePassword: Boolean = firstInChain(_.doubleTypePassword) getOrElse default.doubleTypePassword
  def minPasswordLength: Int = default.minPasswordLength // cannot change per site, right now
  def begForEmailAddress: Boolean = firstInChain(_.begForEmailAddress) getOrElse default.begForEmailAddress
  def enableSso: Boolean = firstInChain(_.enableSso) getOrElse default.enableSso
  def ssoUrl: String = firstInChain(_.ssoUrl) getOrElse default.ssoUrl
  def ssoNotApprovedUrl: String = firstInChain(_.ssoNotApprovedUrl) getOrElse default.ssoNotApprovedUrl
  def forumMainView: String = firstInChain(_.forumMainView) getOrElse default.forumMainView
  def forumTopicsSortButtons: String = firstInChain(_.forumTopicsSortButtons) getOrElse default.forumTopicsSortButtons
  def forumCategoryLinks: String = firstInChain(_.forumCategoryLinks) getOrElse default.forumCategoryLinks
  def forumTopicsLayout: TopicListLayout = firstInChain(_.forumTopicsLayout) getOrElse default.forumTopicsLayout
  def forumCategoriesLayout: CategoriesLayout = firstInChain(_.forumCategoriesLayout) getOrElse default.forumCategoriesLayout
  def showCategories: Boolean = firstInChain(_.showCategories) getOrElse default.showCategories
  def showTopicFilterButton: Boolean = firstInChain(_.showTopicFilterButton) getOrElse default.showTopicFilterButton
  def showTopicTypes: Boolean = firstInChain(_.showTopicTypes) getOrElse default.showTopicTypes
  def selectTopicType: Boolean = firstInChain(_.selectTopicType) getOrElse default.selectTopicType
  def showAuthorHow: ShowAuthorHow = firstInChain(_.showAuthorHow) getOrElse default.showAuthorHow
  def watchbarStartsOpen: Boolean = firstInChain(_.watchbarStartsOpen) getOrElse default.watchbarStartsOpen
  def numFirstPostsToReview: Int = firstInChain(_.numFirstPostsToReview) getOrElse default.numFirstPostsToReview
  def numFirstPostsToApprove: Int = firstInChain(_.numFirstPostsToApprove) getOrElse default.numFirstPostsToApprove
  def numFirstPostsToAllow: Int = firstInChain(_.numFirstPostsToAllow) getOrElse default.numFirstPostsToAllow
  def faviconUrl: String = firstInChain(_.faviconUrl) getOrElse default.faviconUrl
  def headStylesHtml: String = firstInChain(_.headStylesHtml) getOrElse default.headStylesHtml
  def headScriptsHtml: String = firstInChain(_.headScriptsHtml) getOrElse default.headScriptsHtml
  def endOfBodyHtml: String = firstInChain(_.endOfBodyHtml) getOrElse default.endOfBodyHtml
  def headerHtml: String = firstInChain(_.headerHtml) getOrElse default.headerHtml
  def footerHtml: String = firstInChain(_.footerHtml) getOrElse default.footerHtml
  def horizontalComments: Boolean = firstInChain(_.horizontalComments) getOrElse default.horizontalComments
  def socialLinksHtml: String = firstInChain(_.socialLinksHtml) getOrElse default.socialLinksHtml
  def logoUrlOrHtml: String = firstInChain(_.logoUrlOrHtml) getOrElse default.logoUrlOrHtml
  def orgDomain: String = firstInChain(_.orgDomain) getOrElse default.orgDomain
  def orgFullName: String = firstInChain(_.orgFullName) getOrElse default.orgFullName
  def orgShortName: String = firstInChain(_.orgShortName) getOrElse default.orgShortName
  def termsOfUseUrl: String = firstInChain(_.termsOfUseUrl) getOrElse default.termsOfUseUrl
  def privacyUrl: String = firstInChain(_.privacyUrl) getOrElse default.privacyUrl
  def rulesUrl: String = firstInChain(_.rulesUrl) getOrElse default.rulesUrl
  def contactEmailAddr: String = firstInChain(_.contactEmailAddr) getOrElse default.contactEmailAddr
  def contactUrl: String = firstInChain(_.contactUrl) getOrElse default.contactUrl
  def contribAgreement: ContribAgreement = firstInChain(_.contribAgreement) getOrElse default.contribAgreement
  def contentLicense: ContentLicense = firstInChain(_.contentLicense) getOrElse default.contentLicense
  def languageCode: String = firstInChain(_.languageCode) getOrElse default.languageCode
  def googleUniversalAnalyticsTrackingId: String = firstInChain(_.googleUniversalAnalyticsTrackingId) getOrElse default.googleUniversalAnalyticsTrackingId
  def enableForum: Boolean = firstInChain(_.enableForum) getOrElse default.enableForum
  def enableApi: Boolean = firstInChain(_.enableApi) getOrElse default.enableApi
  def enableTags: Boolean = firstInChain(_.enableTags) getOrElse default.enableTags
  def enableChat: Boolean = firstInChain(_.enableChat) getOrElse default.enableChat
  def enableDirectMessages: Boolean = firstInChain(_.enableDirectMessages) getOrElse default.enableDirectMessages
  def showSubCommunities: Boolean = firstInChain(_.showSubCommunities) getOrElse default.showSubCommunities
  def showExperimental: Boolean = firstInChain(_.showExperimental) getOrElse default.showExperimental
  def featureFlags: String = firstInChain(_.featureFlags) getOrElse default.featureFlags
  def allowEmbeddingFrom: String = firstInChain(_.allowEmbeddingFrom) getOrElse default.allowEmbeddingFrom
  def embeddedCommentsCategoryId: CategoryId = firstInChain(_.embeddedCommentsCategoryId) getOrElse default.embeddedCommentsCategoryId
  def htmlTagCssClasses: String = firstInChain(_.htmlTagCssClasses) getOrElse default.htmlTagCssClasses

  def numFlagsToHidePost: Int = firstInChain(_.numFlagsToHidePost) getOrElse default.numFlagsToHidePost
  def cooldownMinutesAfterFlaggedHidden: Int = firstInChain(_.cooldownMinutesAfterFlaggedHidden) getOrElse default.cooldownMinutesAfterFlaggedHidden

  def numFlagsToBlockNewUser: Int = firstInChain(_.numFlagsToBlockNewUser) getOrElse default.numFlagsToBlockNewUser
  def numFlaggersToBlockNewUser: Int = firstInChain(_.numFlaggersToBlockNewUser) getOrElse default.numFlaggersToBlockNewUser
  def notifyModsIfUserBlocked: Boolean = firstInChain(_.notifyModsIfUserBlocked) getOrElse default.notifyModsIfUserBlocked

  def regularMemberFlagWeight: Float = firstInChain(_.regularMemberFlagWeight) getOrElse default.regularMemberFlagWeight
  def coreMemberFlagWeight: Float = firstInChain(_.coreMemberFlagWeight) getOrElse default.coreMemberFlagWeight

  def loginRequired: Boolean = userMustBeAuthenticated || userMustBeApproved // [2KZMQ5] and then remove, use only userMustBeAuthenticated but rename to mustLoginToRead

  /** The allowEmbeddingFrom field, but with any url path removed (if included, iframe won't
    * load at all in Chrome — url path not allowed? Weird, should be allowed:
    *    https://www.w3.org/TR/CSP2/#frame_ancestors, but this different docs says it's *not* allowed?:
    *    https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy/frame-ancestors
    *   — is CSP2 (the first link above) something newer & that supports /a/path/too/  ? )
    * and http:// origins duplicated to https://, so https works too.
    */
  lazy val allowEmbeddingFromBetter: Seq[String] =
    EffectiveSettings.improveAllowEmbeddingFrom(allowEmbeddingFrom)

  def anyMainEmbeddingDomain: Option[String] =
    allowEmbeddingFromBetter.find(!_.contains("localhost")) orElse
      allowEmbeddingFromBetter.headOption

  def isGuestLoginAllowed: Boolean =
    allowGuestLogin && !userMustBeAuthenticated && !userMustBeApproved &&
      !inviteOnly && allowSignup && !enableSso

  def isEmailAddressAllowed(address: String): Boolean =
    // If SSO enabled, the remote SSO system determines what's allowed and what's not. [7AKBR25]
    if (enableSso) true
    else EffectiveSettings.isEmailAddressAllowed(
      address, whiteListText = emailDomainWhitelist, blackListText = emailDomainBlacklist)

  /** Finds any invalid setting value, or invalid settings configurations. */
  def findAnyError: Option[String] = {
    // Hmm ...
    None
  }

}



object EffectiveSettings {
  val UrlPathRegex: Regex = """^(https?:\/\/)?([^\/]+)(\/.*)?$""".r

  /** Removes comment '#' lines, removes URL paths (Chrome doesn't like), adds https
    * if only http specified. Returns a list of allowed embedding origins.
    */
  def improveAllowEmbeddingFrom(allowEmbeddingFrom: String): Seq[String] = {
    val okSources = ArrayBuffer[String]()

    val ancestorSourcesMaybePath =
      allowEmbeddingFrom.split("\n").map(_.trim).filterNot(
        line => line.isEmpty || line.startsWith("#"))
        // Previously, origins were separated by ' ' instead of '\n', so split on ' ' too.
        .flatMap(_.split(" "))
        .filterNot(word => word.isEmpty)

    // Exclude the url path = $3.
    val sourcesNoPath = ancestorSourcesMaybePath.map(UrlPathRegex.replaceAllIn(_, "$1$2"))
    sourcesNoPath foreach { source =>
      if (!okSources.contains(source)) {
        okSources.append(source)
      }
      // Add https:// if http: only...
      if (source startsWith "http:") {
        val sourceWithHttps = source.replaceFirst("http:", "https:")
        if (!sourcesNoPath.exists(_.contains(sourceWithHttps)) &&
            !okSources.exists(_.contains(sourceWithHttps))) {  // ... and not added already
          okSources.append(sourceWithHttps)
        }
      }
    }

    okSources.toSeq
  }

  def isEmailAddressAllowed(address: String, whiteListText: String, blackListText: String)
        : Boolean = {
    def canBeDomain(line: String) = line.nonEmpty && line.headOption.isNot('#')
    val whiteDomainsIterator = whiteListText.lines.map(_.trim).filter(canBeDomain)
    val blackDomainsIterator = blackListText.lines.map(_.trim).filter(canBeDomain)
    def addrEndsWith(domain: String) =
      if (domain.contains("@") && domain.head != '@') {
        // Is an email address, not a domain. Fine — let people specify full addresses. And
        // then require an exact match, so another.jane.doe@ex.com won't match jane.doe@ex.com.
        address == domain
      }
      else if (domain.head == '@') {
        // The admin prepended an '@' although not needed.
        address.endsWith(domain)
      }
      else {
        // Match only on domain boundaries = '.'. E.g.  let hacker.bad.com match bad.com,
        // but don't let  someone.goodbad.com match bad.com.
        // For now, don't allow sub domains — maybe somehow that could be a security risk
        // So, don't:  address.endsWith(s".$domain") ||  instead, only:
        address.endsWith(s"@$domain")
      }
    for (blackDomain <- blackDomainsIterator) {
      if (addrEndsWith(blackDomain))
        return false
    }
    if (whiteDomainsIterator.isEmpty)
      return true
    for (whiteDomain <- whiteDomainsIterator) {
      if (addrEndsWith(whiteDomain))
        return true
    }
    false
  }
}



object Settings2 {

  def settingsToJson(editedSettings2: EditedSettings): JsObject = {
    val s = editedSettings2
    Json.obj(
      "userMustBeAuthenticated" -> JsBooleanOrNull(s.userMustBeAuthenticated),
      "userMustBeApproved" -> JsBooleanOrNull(s.userMustBeApproved),
      "expireIdleAfterMins" -> JsNumberOrNull(s.expireIdleAfterMins),
      "inviteOnly" -> JsBooleanOrNull(s.inviteOnly),
      "allowSignup" -> JsBooleanOrNull(s.allowSignup),
      "allowLocalSignup" -> JsBooleanOrNull(s.allowLocalSignup),
      "allowGuestLogin" -> JsBooleanOrNull(s.allowGuestLogin),
      "enableGoogleLogin" -> JsBooleanOrNull(s.enableGoogleLogin),
      "enableFacebookLogin" -> JsBooleanOrNull(s.enableFacebookLogin),
      "enableTwitterLogin" -> JsBooleanOrNull(s.enableTwitterLogin),
      "enableGitHubLogin" -> JsBooleanOrNull(s.enableGitHubLogin),
      "enableGitLabLogin" -> JsBooleanOrNull(s.enableGitLabLogin),
      "enableLinkedInLogin" -> JsBooleanOrNull(s.enableLinkedInLogin),
      "enableVkLogin" -> JsBooleanOrNull(s.enableVkLogin),
      "enableInstagramLogin" -> JsBooleanOrNull(s.enableInstagramLogin),
      "requireVerifiedEmail" -> JsBooleanOrNull(s.requireVerifiedEmail),
      "emailDomainBlacklist" -> JsStringOrNull(s.emailDomainBlacklist),
      "emailDomainWhitelist" -> JsStringOrNull(s.emailDomainWhitelist),
      "mayComposeBeforeSignup" -> JsBooleanOrNull(s.mayComposeBeforeSignup),
      "mayPostBeforeEmailVerified" -> JsBooleanOrNull(s.mayPostBeforeEmailVerified),
      "doubleTypeEmailAddress" -> JsBooleanOrNull(s.doubleTypeEmailAddress),
      "doubleTypePassword" -> JsBooleanOrNull(s.doubleTypePassword),
      "minPasswordLength" -> JsNumberOrNull(s.minPasswordLength),
      "begForEmailAddress" -> JsBooleanOrNull(s.begForEmailAddress),
      "enableSso" -> JsBooleanOrNull(s.enableSso),
      "ssoUrl" -> JsStringOrNull(s.ssoUrl),
      "ssoNotApprovedUrl" -> JsStringOrNull(s.ssoNotApprovedUrl),
      "forumMainView" -> JsStringOrNull(s.forumMainView),
      "forumTopicsSortButtons" -> JsStringOrNull(s.forumTopicsSortButtons),
      "forumCategoryLinks" -> JsStringOrNull(s.forumCategoryLinks),
      "forumTopicsLayout" -> JsNumberOrNull(s.forumTopicsLayout.map(_.toInt)),
      "forumCategoriesLayout" -> JsNumberOrNull(s.forumCategoriesLayout.map(_.toInt)),
      "showCategories" -> JsBooleanOrNull(s.showCategories),
      "showTopicFilterButton" -> JsBooleanOrNull(s.showTopicFilterButton),
      "showTopicTypes" -> JsBooleanOrNull(s.showTopicTypes),
      "selectTopicType" -> JsBooleanOrNull(s.selectTopicType),
      "showAuthorHow" -> JsNumberOrNull(s.showAuthorHow.map(_.toInt)),
      "watchbarStartsOpen" -> JsBooleanOrNull(s.watchbarStartsOpen),
      "numFirstPostsToReview" -> JsNumberOrNull(s.numFirstPostsToReview),
      "numFirstPostsToApprove" -> JsNumberOrNull(s.numFirstPostsToApprove),
      "numFirstPostsToAllow" -> JsNumberOrNull(s.numFirstPostsToAllow),
      "faviconUrl" -> JsStringOrNull(s.faviconUrl),
      "headStylesHtml" -> JsStringOrNull(s.headStylesHtml),
      "headScriptsHtml" -> JsStringOrNull(s.headScriptsHtml),
      "endOfBodyHtml" -> JsStringOrNull(s.endOfBodyHtml),
      "headerHtml" -> JsStringOrNull(s.headerHtml),
      "footerHtml" -> JsStringOrNull(s.footerHtml),
      "horizontalComments" -> JsBooleanOrNull(s.horizontalComments),
      "socialLinksHtml" -> JsStringOrNull(s.socialLinksHtml),
      "logoUrlOrHtml" -> JsStringOrNull(s.logoUrlOrHtml),
      "companyDomain" -> JsStringOrNull(s.orgDomain),
      "companyFullName" -> JsStringOrNull(s.orgFullName),
      "companyShortName" -> JsStringOrNull(s.orgShortName),
      "termsOfUseUrl" -> JsStringOrNull(s.termsOfUseUrl),
      "privacyUrl" -> JsStringOrNull(s.privacyUrl),
      "rulesUrl" -> JsStringOrNull(s.rulesUrl),
      "contactEmailAddr" -> JsStringOrNull(s.contactEmailAddr),
      "contactUrl" -> JsStringOrNull(s.contactUrl),
      "contribAgreement" -> JsNumberOrNull(s.contribAgreement.map(_.toInt)),
      "contentLicense" -> JsNumberOrNull(s.contentLicense.map(_.toInt)),
      "languageCode" -> JsStringOrNull(s.languageCode),
      "googleUniversalAnalyticsTrackingId" -> JsStringOrNull(s.googleUniversalAnalyticsTrackingId),
      "enableForum" -> JsBooleanOrNull(s.enableForum),
      "enableApi" -> JsBooleanOrNull(s.enableApi),
      "enableTags" -> JsBooleanOrNull(s.enableTags),
      "enableChat" -> JsBooleanOrNull(s.enableChat),
      "enableDirectMessages" -> JsBooleanOrNull(s.enableDirectMessages),
      "showSubCommunities" -> JsBooleanOrNull(s.showSubCommunities),
      "showExperimental" -> JsBooleanOrNull(s.showExperimental),
      "featureFlags" -> JsStringOrNull(s.featureFlags),
      "allowEmbeddingFrom" -> JsStringOrNull(s.allowEmbeddingFrom),
      "embeddedCommentsCategoryId" -> JsNumberOrNull(s.embeddedCommentsCategoryId),
      "htmlTagCssClasses" -> JsStringOrNull(s.htmlTagCssClasses),
      "numFlagsToHidePost" -> JsNumberOrNull(s.numFlagsToHidePost),
      "cooldownMinutesAfterFlaggedHidden" -> JsNumberOrNull(s.cooldownMinutesAfterFlaggedHidden),
      "numFlagsToBlockNewUser" -> JsNumberOrNull(s.numFlagsToBlockNewUser),
      "numFlaggersToBlockNewUser" -> JsNumberOrNull(s.numFlaggersToBlockNewUser),
      "notifyModsIfUserBlocked" -> JsBooleanOrNull(s.notifyModsIfUserBlocked),
      "regularMemberFlagWeight" -> JsFloatOrNull(s.regularMemberFlagWeight),
      "coreMemberFlagWeight" -> JsFloatOrNull(s.coreMemberFlagWeight))
  }


  def settingsToSaveFromJson(json: JsValue, globals: Globals): SettingsToSave = {
    val d = AllSettings.makeDefault(globals)
    SettingsToSave(
    userMustBeAuthenticated = anyBool(json, "userMustBeAuthenticated", d.userMustBeAuthenticated),
    userMustBeApproved = anyBool(json, "userMustBeApproved", d.userMustBeApproved),
    expireIdleAfterMins = anyInt(json, "expireIdleAfterMins", d.expireIdleAfterMins),
    inviteOnly = anyBool(json, "inviteOnly", d.inviteOnly),
    allowSignup = anyBool(json, "allowSignup", d.allowSignup),
    allowLocalSignup = anyBool(json, "allowLocalSignup", d.allowLocalSignup),
    allowGuestLogin = anyBool(json, "allowGuestLogin", d.allowGuestLogin),
    enableGoogleLogin = anyBool(json, "enableGoogleLogin", d.enableGoogleLogin),
    enableFacebookLogin = anyBool(json, "enableFacebookLogin", d.enableFacebookLogin),
    enableTwitterLogin = anyBool(json, "enableTwitterLogin", d.enableTwitterLogin),
    enableGitHubLogin = anyBool(json, "enableGitHubLogin", d.enableGitHubLogin),
    enableGitLabLogin = anyBool(json, "enableGitLabLogin", d.enableGitLabLogin),
    enableLinkedInLogin = anyBool(json, "enableLinkedInLogin", d.enableLinkedInLogin),
    enableVkLogin = anyBool(json, "enableVkLogin", d.enableVkLogin),
    enableInstagramLogin = anyBool(json, "enableInstagramLogin", d.enableInstagramLogin),
    requireVerifiedEmail = anyBool(json, "requireVerifiedEmail", d.requireVerifiedEmail),
    emailDomainBlacklist = anyString(json, "emailDomainBlacklist", d.emailDomainBlacklist),
    emailDomainWhitelist = anyString(json, "emailDomainWhitelist", d.emailDomainWhitelist),
    mayComposeBeforeSignup = anyBool(json, "mayComposeBeforeSignup", d.mayComposeBeforeSignup),
    mayPostBeforeEmailVerified = anyBool(json, "mayPostBeforeEmailVerified", d.mayPostBeforeEmailVerified),
    doubleTypeEmailAddress = anyBool(json, "doubleTypeEmailAddress", d.doubleTypeEmailAddress),
    doubleTypePassword = anyBool(json, "doubleTypePassword", d.doubleTypePassword),
    minPasswordLength = None, // cannot edit right now
    begForEmailAddress = anyBool(json, "begForEmailAddress", d.begForEmailAddress),
    enableSso = anyBool(json, "enableSso", d.enableSso),
    ssoUrl = anyString(json, "ssoUrl", d.ssoUrl),
    ssoNotApprovedUrl = anyString(json, "ssoNotApprovedUrl", d.ssoNotApprovedUrl),
    forumMainView = anyString(json, "forumMainView", d.forumMainView),
    forumTopicsSortButtons = anyString(json, "forumTopicsSortButtons", d.forumTopicsSortButtons),
    forumCategoryLinks = anyString(json, "forumCategoryLinks", d.forumCategoryLinks),
    forumTopicsLayout = anyInt(json, "forumTopicsLayout", d.forumTopicsLayout.toInt).map(_.flatMap(TopicListLayout.fromInt)),
    forumCategoriesLayout = anyInt(json, "forumCategoriesLayout", d.forumCategoriesLayout.toInt).map(_.flatMap(CategoriesLayout.fromInt)),
    showCategories = anyBool(json, "showCategories", d.showCategories),
    showTopicFilterButton = anyBool(json, "showTopicFilterButton", d.showTopicFilterButton),
    showTopicTypes = anyBool(json, "showTopicTypes", d.showTopicTypes),
    selectTopicType = anyBool(json, "selectTopicType", d.selectTopicType),
    showAuthorHow = anyInt(json, "showAuthorHow", d.showAuthorHow.toInt).map(_.flatMap(ShowAuthorHow.fromInt)),
    watchbarStartsOpen = anyBool(json, "watchbarStartsOpen", d.watchbarStartsOpen),
    numFirstPostsToReview = anyInt(json, "numFirstPostsToReview", d.numFirstPostsToReview),
    numFirstPostsToApprove = anyInt(json, "numFirstPostsToApprove", d.numFirstPostsToApprove),
    numFirstPostsToAllow = anyInt(json, "numFirstPostsToAllow", d.numFirstPostsToAllow),
    faviconUrl = anyString(json, "faviconUrl", d.faviconUrl),
    headStylesHtml = anyString(json, "headStylesHtml", d.headStylesHtml),
    headScriptsHtml = anyString(json, "headScriptsHtml", d.headScriptsHtml),
    endOfBodyHtml = anyString(json, "endOfBodyHtml", d.endOfBodyHtml),
    headerHtml = anyString(json, "headerHtml", d.headerHtml),
    footerHtml = anyString(json, "footerHtml", d.footerHtml),
    horizontalComments = anyBool(json, "horizontalComments", d.horizontalComments),
    socialLinksHtml = anyString(json, "socialLinksHtml", d.socialLinksHtml),
    logoUrlOrHtml = anyString(json, "logoUrlOrHtml", d.logoUrlOrHtml),
    orgDomain = anyString(json, "companyDomain", d.orgDomain),
    orgFullName = anyString(json, "companyFullName", d.orgFullName),
    orgShortName = anyString(json, "companyShortName", d.orgShortName),
    termsOfUseUrl = anyString(json, "termsOfUseUrl", d.termsOfUseUrl),
    privacyUrl = anyString(json, "privacyUrl", d.privacyUrl),
    rulesUrl = anyString(json, "rulesUrl", d.rulesUrl),
    contactEmailAddr = anyString(json, "contactEmailAddr", d.contactEmailAddr),
    contactUrl = anyString(json, "contactUrl", d.contactUrl),
    contribAgreement = anyInt(json, "contribAgreement", d.contribAgreement.toInt).map(_.map(
      ContribAgreement.fromInt(_) getOrElse throwBadRequest(
        "EsE5YK28", "Invalid contributors agreement"))),
    contentLicense = anyInt(json, "contentLicense", d.contentLicense.toInt).map(_.map(
      ContentLicense.fromInt(_) getOrElse throwBadRequest("EsE5YK28", "Invalid content license"))),
    languageCode = anyString(json, "languageCode", d.languageCode),
    googleUniversalAnalyticsTrackingId =
      anyString(json, "googleUniversalAnalyticsTrackingId", d.googleUniversalAnalyticsTrackingId),
    enableForum = anyBool(json, "enableForum", d.enableForum),
    enableApi = anyBool(json, "enableApi", d.enableApi),
    enableTags = anyBool(json, "enableTags", d.enableTags),
    enableChat = anyBool(json, "enableChat", d.enableChat),
    enableDirectMessages = anyBool(json, "enableDirectMessages", d.enableDirectMessages),
    showSubCommunities = anyBool(json, "showSubCommunities", d.showSubCommunities),
    showExperimental = anyBool(json, "showExperimental", d.showExperimental),
    featureFlags = anyString(json, "featureFlags", d.featureFlags),
    allowEmbeddingFrom = anyString(json, "allowEmbeddingFrom", d.allowEmbeddingFrom),
    embeddedCommentsCategoryId = anyInt(json, "embeddedCommentsCategoryId", d.embeddedCommentsCategoryId),
    htmlTagCssClasses = anyString(json, "htmlTagCssClasses", d.htmlTagCssClasses),
    numFlagsToHidePost = anyInt(json, "numFlagsToHidePost", d.numFlagsToHidePost),
    cooldownMinutesAfterFlaggedHidden = anyInt(json, "cooldownMinutesAfterFlaggedHidden", d.cooldownMinutesAfterFlaggedHidden  ),
    numFlagsToBlockNewUser = anyInt(json, "numFlagsToBlockNewUser", d.numFlagsToBlockNewUser  ),
    numFlaggersToBlockNewUser = anyInt(json, "numFlaggersToBlockNewUser", d.numFlaggersToBlockNewUser  ),
    notifyModsIfUserBlocked = anyBool(json, "notifyModsIfUserBlocked", d.notifyModsIfUserBlocked  ),
    regularMemberFlagWeight = anyFloat(json, "regularMemberFlagWeight", d.regularMemberFlagWeight  ),
    coreMemberFlagWeight = anyFloat(json, "coreMemberFlagWeight", d.coreMemberFlagWeight))
  }


  private def anyString(json: JsValue, field: String, default: String)
        : Option[Option[String]] =
    (json \ field).toOption.map {
      case s: JsString =>
        val value: String = s.value.trim
        if (value == default) None else Some(value)
      case JsNull =>
        None
      case bad =>
        throwBadRequest("EsE5J4K02", s"'$field' is not a JsString, but a ${classNameOf(bad)}")
    }

  private def anyBool(json: JsValue, field: String, default: Boolean): Option[Option[Boolean]] =
    (json \ field).toOption.map {
      case b: JsBoolean =>
        if (b.value == default) None else Some(b.value)
      case JsNull =>
        None
      case bad =>
        throwBadRequest("EsE5J4K02", s"'$field' is not a JsBoolean, but a ${classNameOf(bad)}")
    }

  private def anyInt(json: JsValue, field: String, default: Int): Option[Option[Int]] =
    (json \ field).toOption.map {
      case n: JsNumber =>
        val value = n.value.toInt
        if (value == default) None else Some(value)
      case JsNull =>
        None
      case bad =>
        throwBadRequest("EsE5J4K02", s"'$field' is not a JsNumber, but a ${classNameOf(bad)}")
    }

  private def anyFloat(json: JsValue, field: String, default: Float): Option[Option[Float]] =
    (json \ field).toOption.map {
      case n: JsNumber =>
        val value = n.value.toFloat
        if (value == default) None else Some(value)
      case JsNull =>
        None
      case bad =>
        throwBadRequest("EdE7GK2Z8", s"'$field' is not a JsNumber, but a ${classNameOf(bad)}")
    }
}
