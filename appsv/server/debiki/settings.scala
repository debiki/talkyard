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
  def enableCustomIdps: Boolean

  /** Can only be enabled, if enableCustomIdps true; there's a db constraint:
    * settings_c_enable_use_only_custom_idps
    */
  def useOnlyCustomIdps: Boolean

  def allowLocalSignup: Boolean  // RENAME? to  enableLocalSignup. Allow/deny for authz instead?
  def allowGuestLogin: Boolean   // RENAME  to  enableGuestLogin.


  // This is a bit annoying — one field and table column per IDP? [oh_so_many_idps]
  // So many columns! Look how many IDPs ScribeJava supports, almost 100?
  //   https://github.com/scribejava/scribejava/tree/master/scribejava-apis/src/main/java/com/github/scribejava/apis
  // What's a more concise way to remember if a site wants to use a specific
  // server global IDP or not?
  // Probably a JSON obj with the WellKnownIdpImpl name
  // as fields, like: { google: true, linkedin: false }  ?
  // Or ScribeJava impl class name? (see the link above)
  // as fields, like: { GoogleApi20: enable, LinkedInApi20: disable }  ?
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

  // "Your" (Single) Sign-On
  def enableSso: Boolean  // RENAME QUICK to enableTySso ?  different from custom IDP SSO
  def ssoUrl: String
  //  If a user logs in via SSO, but admin approval of new users is required, and the user's
  // account hasn't been approved (or has been rejected), then the user is sent to this page.
  def ssoNotApprovedUrl: String

  // If login required and SSO enabled, and one logs out, then both 1 and 2 happen:
  //
  // 1. If one clicks Logout, one gets logged out and thereafter redirected to this URL.
  //
  // 2. I one is *not* logged in, one gets sent directly to the SSO login url.
  // However, doing this without a logout URL, then, if clicking Logout,
  // one would get sent to the SSO url and then maybe automatically logged in over there,
  // and then sent back to Talkyard, now logged in. — So one couldn't log out.
  // Instead, after logout, needs to be sent to somewhere else.
  //
  def ssoLoginRequiredLogoutUrl: St  ; RENAME // to ssoAuthnRequiredTyLogoutRedirUrl
                                      // no?, to: ssoLogoutRedirUrlTyOnlyIfAuthnToRead

  // Like ssoLoginRequiredLogoutUrl, but is for logging out pat from the SSO website
  // too, not just from Talkyard. And always redirects, not only if authn required.
  // (Can be nice with both, in case sometimes one wants to log out from Ty only,
  // but not from the SSO site? Then, we'd send pat to ssoLoginRequiredLogoutUrl,
  // otherwise (to log out from the SSO site too) to ssoLogoutRedirUrl.)
  def ssoLogoutRedirUrl: St

  // 0 = none, 1 = sign up, 2 = log in, 4 = logout, 7 = all
  // Not yet in use — first need to remember the session type.
  def ssoShowEmbAuthnBtns: i32

  def ssoPasetoV2LocalSecret: St;
  def ssoPasetoV2PublicKey: St;
  def ssoRefreshAuthnTokenUrl: St;

  def rememberEmbSess: Bo;
  def expireIdleEmbSessAfterMins: i32;



  // UX settings (could add a UserId column so people can override some (not all) of these?)
  // -----------------------------
  def forumMainView: String
  def forumTopicsSortButtons: String
  def forumCategoryLinks: String
  def forumTopicsLayout: TopicListLayout
  def forumCategoriesLayout: CategoriesLayout
  // def forummKnowledgeBaseLayout: KnowledgeBaseLayout — later
  def showCategories: Boolean
  def showTopicFilterButton: Boolean
  def showTopicTypes: Boolean
  def selectTopicType: Boolean
  def showAuthorHow: ShowAuthorHow
  def watchbarStartsOpen: Boolean

  // ----- Topics — hmm these could / should? be per topic type,
  // or per category —  see cont_sets_t  in  db-refactor.txt.
  def discussionLayout: DiscussionLayout
  def discPostSortOrder: PostSortOrder
  def discPostNesting: NestingDepth
  def progressLayout: ProgressLayout
  def embComSortOrder: PostSortOrder  // later, could add a topic type field instead
  def embComNesting: NestingDepth
  // These are for embedded comments actually, COULD rename:
  def origPostReplyBtnTitle: St
  def origPostVotes: OrigPostVotes
  def enableDisagreeVote: Bo
  // -----------------------------

  def requireApprovalIfTrustLte: TrustLevel
  def reviewAfterIfTrustLte: TrustLevel
  def numFirstPostsToReview: Int   ; RENAME // numFirstPostsReviewAfterShown
  def numFirstPostsToApprove: Int  ; RENAME // numFirstPostsApproveBeforeShown
  def maxPostsPendApprBefore: Int   // [pend_appr]
  def maxPostsPendRevwAftr: Int
  def enableStopForumSpam: Boolean
  // sendEmailToStopForumSpam: in the db, not in use: send_email_to_stop_forum_spam
  def enableAkismet: Boolean
  def akismetApiKey: String
  def sendEmailToAkismet: Boolean
  def faviconUrl: String

  def headStylesHtml: String
  def headScriptsHtml: String
  def startOfBodyHtml: String
  def endOfBodyHtml: String
  def headerHtml: String
  def navConf: JsObject
  def footerHtml: String

  def horizontalComments: Boolean

  def socialLinksHtml: String
  def logoUrlOrHtml: String

  def orgDomain: String
  def orgFullName: String
  def orgShortName: String
  def outboundEmailsFromName: St
  def outboundEmailsFromAddr: St
  def outboundEmailsReplyTo: St
  def outboundEmailsSmtpConf: JsObject
  def termsOfUseUrl: String
  def privacyUrl: String
  def rulesUrl: String
  def contactEmailAddr: String
  def contactUrl: String
  def contribAgreement: ContribAgreement
  def contentLicense: ContentLicense
  def languageCode: String
  def googleUniversalAnalyticsTrackingId: String

  /** If !enableForum, then the site is used for embedded comments only. Doesn't do much,
    * server side — instead, mainly simplifies (hides) things in the UI, browser side. */
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
  def enableSimilarTopics: Boolean

  /** CORS means Cross-Origin Resource Sharing. */
  def enableCors: Boolean
  def allowCorsFrom: String
  def allowCorsCreds: Boolean

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
    enableCustomIdps = Some(self.enableCustomIdps),
    useOnlyCustomIdps = Some(self.useOnlyCustomIdps),
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
    ssoLoginRequiredLogoutUrl = Some(self.ssoLoginRequiredLogoutUrl),
    ssoLogoutRedirUrl = Some(self.ssoLogoutRedirUrl),
    ssoShowEmbAuthnBtns = Some(self.ssoShowEmbAuthnBtns),
    ssoPasetoV2LocalSecret = Some(self.ssoPasetoV2LocalSecret),
    ssoPasetoV2PublicKey = Some(self.ssoPasetoV2PublicKey),
    ssoRefreshAuthnTokenUrl = Some(self.ssoRefreshAuthnTokenUrl),
    rememberEmbSess = Some(self.rememberEmbSess),
    expireIdleEmbSessAfterMins = Some(self.expireIdleEmbSessAfterMins),
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
    discussionLayout = Some(self.discussionLayout),
    discPostSortOrder = Some(self.discPostSortOrder),
    discPostNesting = Some(self.discPostNesting),
    progressLayout = Some(self.progressLayout),
    embComSortOrder = Some(self.embComSortOrder),
    embComNesting = Some(self.embComNesting),
    origPostReplyBtnTitle = Some(self.origPostReplyBtnTitle),
    origPostVotes = Some(self.origPostVotes),
    enableDisagreeVote = Some(self.enableDisagreeVote),
    requireApprovalIfTrustLte = Some(self.requireApprovalIfTrustLte),
    reviewAfterIfTrustLte = Some(self.reviewAfterIfTrustLte),
    numFirstPostsToReview = Some(self.numFirstPostsToReview),
    numFirstPostsToApprove = Some(self.numFirstPostsToApprove),
    maxPostsPendApprBefore = Some(self.maxPostsPendApprBefore),
    maxPostsPendRevwAftr = Some(self.maxPostsPendRevwAftr),
    enableStopForumSpam = Some(self.enableStopForumSpam),
    enableAkismet = Some(self.enableAkismet),
    akismetApiKey = Some(self.akismetApiKey),
    sendEmailToAkismet = Some(self.sendEmailToAkismet),
    faviconUrl = Some(self.faviconUrl),
    headStylesHtml = Some(self.headStylesHtml),
    headScriptsHtml = Some(self.headScriptsHtml),
    startOfBodyHtml = Some(self.startOfBodyHtml),
    endOfBodyHtml = Some(self.endOfBodyHtml),
    headerHtml = Some(self.headerHtml),
    navConf = Some(self.navConf),
    footerHtml = Some(self.footerHtml),
    horizontalComments = Some(self.horizontalComments),
    socialLinksHtml = Some(self.socialLinksHtml),
    logoUrlOrHtml = Some(self.logoUrlOrHtml),
    orgDomain = Some(self.orgDomain),
    orgFullName = Some(self.orgFullName),
    orgShortName = Some(self.orgShortName),
    outboundEmailsFromName = Some(self.outboundEmailsFromName),
    outboundEmailsFromAddr = Some(self.outboundEmailsFromAddr),
    outboundEmailsReplyTo = Some(self.outboundEmailsReplyTo),
    outboundEmailsSmtpConf = Some(self.outboundEmailsSmtpConf),
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
    enableSimilarTopics = Some(self.enableSimilarTopics),
    enableCors = Some(self.enableCors),
    allowCorsFrom = Some(self.allowCorsFrom),
    allowCorsCreds = Some(self.allowCorsCreds),
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

  val InConfigFile = "(in config file)"

  def makeDefault(globals: Globals): AllSettings = new AllSettings {  // [8L4KWU02]
    val userMustBeAuthenticated = false
    val userMustBeApproved = false
    // One year. Like Gmail and Facebook (well, they have forever, instead). A Talkyard
    // community admin says his members tend to think their accounts have been hacked,
    // if they've suddenly been logged out.
    val expireIdleAfterMins: Int = 60 * 24 * 365  // [7AKR04]
    val inviteOnly = false
    val allowSignup = true
    val enableCustomIdps = false
    val useOnlyCustomIdps = false
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
    val ssoLoginRequiredLogoutUrl = ""
    val ssoLogoutRedirUrl = ""
    val ssoShowEmbAuthnBtns = 7  // that's const enum ShowEmbAuthnBtnsBitf.All
    val ssoPasetoV2LocalSecret = ""
    val ssoPasetoV2PublicKey = ""
    val ssoRefreshAuthnTokenUrl = ""
    val rememberEmbSess = true
    val expireIdleEmbSessAfterMins: i32 = -1
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
    val discussionLayout: DiscussionLayout = DiscussionLayout.Default
    val discPostSortOrder: PostSortOrder = PostSortOrder.Default
    val discPostNesting: NestingDepth = PostsOrderNesting.Default.nestingDepth
    val progressLayout: ProgressLayout = ProgressLayout.Default
    val embComSortOrder: PostSortOrder = PostSortOrder.DefaultForEmbComs
    val embComNesting: NestingDepth = PostsOrderNesting.Default.nestingDepth
    val origPostReplyBtnTitle: String = ""  // will then use the i18n field
    val origPostVotes: OrigPostVotes = OrigPostVotes.Default
    val enableDisagreeVote: Bo = true
    val requireApprovalIfTrustLte = TrustLevel.Stranger
    val reviewAfterIfTrustLte = TrustLevel.Stranger
    val numFirstPostsToReview = 1
    val numFirstPostsToApprove = 0
    val maxPostsPendApprBefore = 0
    val maxPostsPendRevwAftr = 0
    val enableStopForumSpam = true
    val enableAkismet = false // later, when more tested:  = globals.config.akismetApiKey.isDefined
    val akismetApiKey: String = if (globals.config.akismetApiKey.isDefined) InConfigFile else ""
    val sendEmailToAkismet = true
    val faviconUrl = ""
    val headStylesHtml = ""
    val headScriptsHtml = ""
    val startOfBodyHtml = ""
    val endOfBodyHtml = ""
    val headerHtml = ""
    val navConf: JsObject = JsEmptyObj
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
    val outboundEmailsFromName = ""
    val outboundEmailsFromAddr = ""
    val outboundEmailsReplyTo = ""
    val outboundEmailsSmtpConf: JsObject = JsEmptyObj
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
    val enableSimilarTopics = true
    val enableCors = false
    val allowCorsFrom = ""
    val allowCorsCreds = false
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
  def enableCustomIdps: Boolean = firstInChain(_.enableCustomIdps) getOrElse default.enableCustomIdps
  def useOnlyCustomIdps: Boolean = firstInChain(_.useOnlyCustomIdps) getOrElse default.useOnlyCustomIdps
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
  def ssoLoginRequiredLogoutUrl: String = firstInChain(_.ssoLoginRequiredLogoutUrl) getOrElse default.ssoLoginRequiredLogoutUrl
  def ssoLogoutRedirUrl: St = firstInChain(_.ssoLogoutRedirUrl) getOrElse default.ssoLogoutRedirUrl
  def ssoShowEmbAuthnBtns: i32 = firstInChain(_.ssoShowEmbAuthnBtns) getOrElse default.ssoShowEmbAuthnBtns
  def ssoPasetoV2LocalSecret: St = firstInChain(_.ssoPasetoV2LocalSecret) getOrElse default.ssoPasetoV2LocalSecret
  def ssoPasetoV2PublicKey: St = firstInChain(_.ssoPasetoV2PublicKey) getOrElse default.ssoPasetoV2PublicKey
  def ssoRefreshAuthnTokenUrl: St = firstInChain(_.ssoRefreshAuthnTokenUrl) getOrElse default.ssoRefreshAuthnTokenUrl
  def rememberEmbSess: Bo = firstInChain(_.rememberEmbSess) getOrElse default.rememberEmbSess
  def expireIdleEmbSessAfterMins: i32 = firstInChain(_.expireIdleEmbSessAfterMins) getOrElse default.expireIdleEmbSessAfterMins
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
  def discussionLayout: DiscussionLayout = firstInChain(_.discussionLayout) getOrElse default.discussionLayout
  def discPostSortOrder: PostSortOrder = firstInChain(_.discPostSortOrder) getOrElse default.discPostSortOrder
  def discPostNesting: NestingDepth =  firstInChain(_.discPostNesting) getOrElse default.discPostNesting
  def progressLayout: ProgressLayout = firstInChain(_.progressLayout) getOrElse default.progressLayout
  def embComSortOrder: PostSortOrder = firstInChain(_.embComSortOrder) getOrElse default.embComSortOrder
  def embComNesting: NestingDepth = firstInChain(_.embComNesting) getOrElse default.embComNesting
  def origPostReplyBtnTitle: String = firstInChain(_.origPostReplyBtnTitle) getOrElse default.origPostReplyBtnTitle
  def origPostVotes: OrigPostVotes = firstInChain(_.origPostVotes) getOrElse default.origPostVotes
  def enableDisagreeVote: Bo = firstInChain(_.enableDisagreeVote) getOrElse default.enableDisagreeVote
  def requireApprovalIfTrustLte: TrustLevel = firstInChain(_.requireApprovalIfTrustLte) getOrElse default.requireApprovalIfTrustLte
  def reviewAfterIfTrustLte: TrustLevel = firstInChain(_.reviewAfterIfTrustLte) getOrElse default.reviewAfterIfTrustLte
  def numFirstPostsToReview: Int = firstInChain(_.numFirstPostsToReview) getOrElse default.numFirstPostsToReview
  def numFirstPostsToApprove: Int = firstInChain(_.numFirstPostsToApprove) getOrElse default.numFirstPostsToApprove
  def maxPostsPendApprBefore: Int = firstInChain(_.maxPostsPendApprBefore) getOrElse default.maxPostsPendApprBefore
  def maxPostsPendRevwAftr: Int = firstInChain(_.maxPostsPendRevwAftr) getOrElse default.maxPostsPendRevwAftr
  def enableStopForumSpam: Boolean = firstInChain(_.enableStopForumSpam) getOrElse default.enableStopForumSpam
  def enableAkismet: Boolean = firstInChain(_.enableAkismet) getOrElse default.enableAkismet
  def akismetApiKey: String = firstInChain(_.akismetApiKey) getOrElse default.akismetApiKey
  def sendEmailToAkismet: Boolean = firstInChain(_.sendEmailToAkismet) getOrElse default.sendEmailToAkismet
  def faviconUrl: String = firstInChain(_.faviconUrl) getOrElse default.faviconUrl
  def headStylesHtml: String = firstInChain(_.headStylesHtml) getOrElse default.headStylesHtml
  def headScriptsHtml: String = firstInChain(_.headScriptsHtml) getOrElse default.headScriptsHtml
  def startOfBodyHtml: String = firstInChain(_.startOfBodyHtml) getOrElse default.startOfBodyHtml
  def endOfBodyHtml: String = firstInChain(_.endOfBodyHtml) getOrElse default.endOfBodyHtml
  def headerHtml: String = firstInChain(_.headerHtml) getOrElse default.headerHtml
  def navConf: JsObject = firstInChain(_.navConf) getOrElse default.navConf
  def footerHtml: String = firstInChain(_.footerHtml) getOrElse default.footerHtml
  def horizontalComments: Boolean = firstInChain(_.horizontalComments) getOrElse default.horizontalComments
  def socialLinksHtml: String = firstInChain(_.socialLinksHtml) getOrElse default.socialLinksHtml
  def logoUrlOrHtml: String = firstInChain(_.logoUrlOrHtml) getOrElse default.logoUrlOrHtml
  def orgDomain: String = firstInChain(_.orgDomain) getOrElse default.orgDomain
  def orgFullName: String = firstInChain(_.orgFullName) getOrElse default.orgFullName
  def orgShortName: String = firstInChain(_.orgShortName) getOrElse default.orgShortName
  def outboundEmailsFromName: St = firstInChain(_.outboundEmailsFromName) getOrElse default.outboundEmailsFromName
  def outboundEmailsFromAddr: St = firstInChain(_.outboundEmailsFromAddr) getOrElse default.outboundEmailsFromAddr
  def outboundEmailsReplyTo: St = firstInChain(_.outboundEmailsReplyTo) getOrElse default.outboundEmailsReplyTo
  def outboundEmailsSmtpConf: JsObject = firstInChain(_.outboundEmailsSmtpConf) getOrElse default.outboundEmailsSmtpConf
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
  def enableSimilarTopics: Boolean = firstInChain(_.enableSimilarTopics) getOrElse default.enableSimilarTopics
  def enableCors: Boolean = firstInChain(_.enableCors) getOrElse default.enableCors
  def allowCorsFrom: String = firstInChain(_.allowCorsFrom) getOrElse default.allowCorsFrom
  def allowCorsCreds: Boolean = firstInChain(_.allowCorsCreds) getOrElse default.allowCorsCreds
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

  def canLoginWithPassword: Bo = !useOnlyCustomIdps && !enableSso
  def canLoginAsGuest: Bo = isGuestLoginAllowed

  def effSsoLogoutFromTyRedirUrlIfAuthnReq: Opt[St] = { // [350RKDDF5]
    COULD // do this also if usingCustomIdpSso
    if (enableSso && userMustBeAuthenticated && ssoLoginRequiredLogoutUrl.nonEmpty)
      Some(ssoLoginRequiredLogoutUrl)
    else
      None
  }

  def effSsoLogoutAllRedirUrl: Opt[St] = {
    if (enableSso && ssoLogoutRedirUrl.nonEmpty)
      Some(ssoLogoutRedirUrl)
    else
      None
  }

  def allowCorsFromParsed: Seq[String] = {
    EffectiveSettings.getLinesNotCommentedOut(allowCorsFrom)
  }

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

  def isGuestLoginAllowed: Boolean =  // RENAME to canLoginAsGuest
    allowGuestLogin && !userMustBeAuthenticated && !userMustBeApproved &&
      !inviteOnly && allowSignup && !enableSso && !useOnlyCustomIdps

  def isEmailAddressAllowed(address: St): Bo = {
    // With SSO, the remote SSO system determines what's allowed and
    // what's not.  [alwd_eml_doms]
    val enableSsoOrOnlyCustIdps = enableSso || useOnlyCustomIdps
    if (enableSsoOrOnlyCustIdps) true
    else EffectiveSettings.isEmailAddressAllowed(
          address, allowListText = emailDomainWhitelist,
          blockListText = emailDomainBlacklist, allowByDefault = true)
  }

  /** Finds any invalid setting value, or invalid settings configurations. */
  def findAnyError: Option[String] = {
    // Hmm ...
    None
  }

}



object EffectiveSettings {
  val UrlPathRegex: Regex = """^(https?:\/\/)?([^\/]+)(\/.*)?$""".r


  def getLinesNotCommentedOut(text: String): Seq[String] = {
    text.split("\n").map(_.trim).filterNot(
          line => line.isEmpty || line.startsWith("#"))
  }


  /** Removes comment '#' lines, removes URL paths (Chrome doesn't like), adds https
    * if only http specified. Returns a list of allowed embedding origins.
    */
  def improveAllowEmbeddingFrom(allowEmbeddingFrom: String): Seq[String] = {
    val okSources = ArrayBuffer[String]()

    CLEAN_UP // use getLinesNotCommentedOut()
    val ancestorSourcesMaybePath =
      allowEmbeddingFrom.split("\n").map(_.trim).filterNot(
        line => line.isEmpty || line.startsWith("#"))
        // Previously, origins were separated by ' ' instead of '\n', so split on ' ' too.
        .flatMap(_.split(" "))
        .filterNot(word => word.isEmpty)

    // Exclude the url path = $3.  [402KSHRJ3]
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

  def isEmailAddressAllowed(address: St, allowListText: St, blockListText: St,
        allowByDefault: Bo): Bo = {

    def canBeDomain(line: St): Bo = line.headOption isSomethingButNot '#'
    val allowedDomains = allowListText.linesIterator.map(_.trim).filter(canBeDomain)
    val blockedDomains = blockListText.linesIterator.map(_.trim).filter(canBeDomain)

    def addrEndsWith(domain: St): Bo = {
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
        // So, don't:  address.endsWith(s".$domain") || endsWith(s"@$domain")
        // Instead, only:
        address.endsWith(s"@$domain")
      }
    }

    for (blockedDomain <- blockedDomains) {
      if (addrEndsWith(blockedDomain))
        return false
    }

    if (allowedDomains.isEmpty)
      return allowByDefault

    for (allowedDomain <- allowedDomains) {
      if (addrEndsWith(allowedDomain))
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
      "enableCustomIdps" -> JsBooleanOrNull(s.enableCustomIdps),
      "useOnlyCustomIdps" -> JsBooleanOrNull(s.useOnlyCustomIdps),
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
      "ssoLoginRequiredLogoutUrl" -> JsStringOrNull(s.ssoLoginRequiredLogoutUrl),
      "ssoLogoutRedirUrl" -> JsStringOrNull(s.ssoLogoutRedirUrl),
      "ssoShowEmbAuthnBtns" -> JsNumberOrNull(s.ssoShowEmbAuthnBtns),
      "ssoPasetoV2LocalSecret" -> JsStringOrNull(s.ssoPasetoV2LocalSecret),
      "ssoPasetoV2PublicKey" -> JsStringOrNull(s.ssoPasetoV2PublicKey),
      "ssoRefreshAuthnTokenUrl" -> JsStringOrNull(s.ssoRefreshAuthnTokenUrl),
      "rememberEmbSess" -> JsBoolOrNull(s.rememberEmbSess),
      "expireIdleEmbSessAfterMins" -> JsNumberOrNull(s.expireIdleEmbSessAfterMins),
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
      "discussionLayout" -> JsNumberOrNull(s.discussionLayout.map(_.toInt)),
      "discPostNesting" -> JsNumberOrNull(s.discPostNesting),
      "discPostSortOrder" -> JsNumberOrNull(s.discPostSortOrder.map(_.toInt)),
      "progressLayout" -> JsNumberOrNull(s.progressLayout.map(_.toInt)),
      "embComSortOrder" -> JsNumberOrNull(s.embComSortOrder.map(_.toInt)),
      "embComNesting" -> JsNumberOrNull(s.embComNesting),
      "origPostReplyBtnTitle" -> JsStringOrNull(s.origPostReplyBtnTitle),
      "origPostVotes" -> JsNumberOrNull(s.origPostVotes.map(_.toInt)),
      "enableDisagreeVote" -> JsBoolOrNull(s.enableDisagreeVote),
      "requireApprovalIfTrustLte" -> JsNumberOrNull(s.requireApprovalIfTrustLte.map(_.toInt)),
      "reviewAfterIfTrustLte" -> JsNumberOrNull(s.reviewAfterIfTrustLte.map(_.toInt)),
      "numFirstPostsToReview" -> JsNumberOrNull(s.numFirstPostsToReview),
      "numFirstPostsToApprove" -> JsNumberOrNull(s.numFirstPostsToApprove),
      "maxPostsPendApprBefore" -> JsNumberOrNull(s.maxPostsPendApprBefore),
      "maxPostsPendRevwAftr" -> JsNumberOrNull(s.maxPostsPendRevwAftr),
      "enableStopForumSpam" -> JsBooleanOrNull(s.enableStopForumSpam),
      "enableAkismet" -> JsBooleanOrNull(s.enableAkismet),
      "akismetApiKey" -> JsStringOrNull(s.akismetApiKey),
      "sendEmailToAkismet" -> JsBooleanOrNull(s.sendEmailToAkismet),
      "faviconUrl" -> JsStringOrNull(s.faviconUrl),
      "headStylesHtml" -> JsStringOrNull(s.headStylesHtml),
      "headScriptsHtml" -> JsStringOrNull(s.headScriptsHtml),
      "startOfBodyHtml" -> JsStringOrNull(s.startOfBodyHtml),
      "endOfBodyHtml" -> JsStringOrNull(s.endOfBodyHtml),
      "headerHtml" -> JsStringOrNull(s.headerHtml),
      "navConf" -> s.navConf.getOrElse(JsNull).as[JsValue],
      "footerHtml" -> JsStringOrNull(s.footerHtml),
      "horizontalComments" -> JsBooleanOrNull(s.horizontalComments),
      "socialLinksHtml" -> JsStringOrNull(s.socialLinksHtml),
      "logoUrlOrHtml" -> JsStringOrNull(s.logoUrlOrHtml),
      "companyDomain" -> JsStringOrNull(s.orgDomain),
      "companyFullName" -> JsStringOrNull(s.orgFullName),
      "companyShortName" -> JsStringOrNull(s.orgShortName),
      "outboundEmailsFromName" -> JsStringOrNull(s.outboundEmailsFromName),
      "outboundEmailsFromAddr" -> JsStringOrNull(s.outboundEmailsFromAddr),
      "outboundEmailsReplyTo" -> JsStringOrNull(s.outboundEmailsReplyTo),
      "outboundEmailsSmtpConf" -> JsObjOrNull(s.outboundEmailsSmtpConf),
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
      "enableSimilarTopics" -> JsBooleanOrNull(s.enableSimilarTopics),
      "enableCors" -> JsBooleanOrNull(s.enableCors),
      "allowCorsFrom" -> JsStringOrNull(s.allowCorsFrom),
      "allowCorsCreds" -> JsBooleanOrNull(s.allowCorsCreds),
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
    enableCustomIdps = anyBool(json, "enableCustomIdps", d.enableCustomIdps),
    useOnlyCustomIdps = anyBool(json, "useOnlyCustomIdps", d.useOnlyCustomIdps),
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
    ssoLoginRequiredLogoutUrl = anyString(json, "ssoLoginRequiredLogoutUrl", d.ssoLoginRequiredLogoutUrl),
    ssoLogoutRedirUrl = anyString(json, "ssoLogoutRedirUrl", d.ssoLogoutRedirUrl),
    ssoShowEmbAuthnBtns = anyInt32(json, "ssoShowEmbAuthnBtns", d.ssoShowEmbAuthnBtns),
    ssoPasetoV2LocalSecret = anyString(json, "ssoPasetoV2LocalSecret", d.ssoPasetoV2LocalSecret),
    ssoPasetoV2PublicKey = anyString(json, "ssoPasetoV2PublicKey", d.ssoPasetoV2PublicKey),
    ssoRefreshAuthnTokenUrl = anyString(json, "ssoRefreshAuthnTokenUrl", d.ssoRefreshAuthnTokenUrl),
    rememberEmbSess = anyBool(json, "rememberEmbSess", d.rememberEmbSess),
    expireIdleEmbSessAfterMins = anyInt32(json, "expireIdleEmbSessAfterMins", d.expireIdleEmbSessAfterMins),
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
    discussionLayout = anyInt(json, "discussionLayout", d.discussionLayout.toInt).map(_.flatMap(DiscussionLayout.fromInt)),
    discPostNesting = anyInt(json, "discPostNesting", d.discPostNesting),
    discPostSortOrder = anyInt(json, "discPostSortOrder", d.discPostSortOrder.toInt).map(_.flatMap(PostSortOrder.fromInt)),
    progressLayout = anyInt(json, "progressLayout", d.progressLayout.toInt).map(_.flatMap(ProgressLayout.fromInt)),
    embComSortOrder = anyInt(json, "embComSortOrder", d.embComSortOrder.toInt).map(_.flatMap(PostSortOrder.fromInt)),
    embComNesting = anyInt(json, "embComNesting", d.embComNesting),
    origPostReplyBtnTitle = anyString(json, "origPostReplyBtnTitle", d.origPostReplyBtnTitle),
    origPostVotes = anyInt(json, "origPostVotes", d.origPostVotes.toInt).map(_.flatMap(OrigPostVotes.fromInt)),
    enableDisagreeVote = anyBool(json, "enableDisagreeVote", d.enableDisagreeVote),
    requireApprovalIfTrustLte = anyInt(json, "requireApprovalIfTrustLte", d.requireApprovalIfTrustLte.toInt).map(_.flatMap(TrustLevel.fromInt)),
    reviewAfterIfTrustLte = anyInt(json, "reviewAfterIfTrustLte", d.reviewAfterIfTrustLte.toInt).map(_.flatMap(TrustLevel.fromInt)),
    numFirstPostsToReview = anyInt(json, "numFirstPostsToReview", d.numFirstPostsToReview),
    numFirstPostsToApprove = anyInt(json, "numFirstPostsToApprove", d.numFirstPostsToApprove),
    maxPostsPendApprBefore = anyInt(json, "maxPostsPendApprBefore", d.maxPostsPendApprBefore),
    maxPostsPendRevwAftr = anyInt(json, "maxPostsPendRevwAftr", d.maxPostsPendRevwAftr),
    enableStopForumSpam = anyBool(json, "enableStopForumSpam", d.enableStopForumSpam),
    enableAkismet = anyBool(json, "enableAkismet", d.enableAkismet),
    akismetApiKey = anyString(json, "akismetApiKey", d.akismetApiKey),
    sendEmailToAkismet = anyBool(json, "sendEmailToAkismet", d.sendEmailToAkismet),
    faviconUrl = anyString(json, "faviconUrl", d.faviconUrl),
    headStylesHtml = anyString(json, "headStylesHtml", d.headStylesHtml),
    headScriptsHtml = anyString(json, "headScriptsHtml", d.headScriptsHtml),
    startOfBodyHtml = anyString(json, "startOfBodyHtml", d.startOfBodyHtml),
    endOfBodyHtml = anyString(json, "endOfBodyHtml", d.endOfBodyHtml),
    headerHtml = anyString(json, "headerHtml", d.headerHtml),
    navConf = anyJsObj(json, "navConf", d.navConf),
    footerHtml = anyString(json, "footerHtml", d.footerHtml),
    horizontalComments = anyBool(json, "horizontalComments", d.horizontalComments),
    socialLinksHtml = anyString(json, "socialLinksHtml", d.socialLinksHtml),
    logoUrlOrHtml = anyString(json, "logoUrlOrHtml", d.logoUrlOrHtml),
    orgDomain = anyString(json, "companyDomain", d.orgDomain),
    orgFullName = anyString(json, "companyFullName", d.orgFullName),
    orgShortName = anyString(json, "companyShortName", d.orgShortName),
    outboundEmailsFromName = anyString(json, "outboundEmailsFromName", d.outboundEmailsFromName),
    outboundEmailsFromAddr = anyString(json, "outboundEmailsFromAddr", d.outboundEmailsFromAddr),
    outboundEmailsReplyTo = anyString(json, "outboundEmailsReplyTo", d.outboundEmailsReplyTo),
    outboundEmailsSmtpConf = anyJsObj(json, "outboundEmailsSmtpConf", d.outboundEmailsSmtpConf),
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
    enableSimilarTopics = anyBool(json, "enableSimilarTopics", d.enableSimilarTopics),
    enableCors = anyBool(json, "enableCors", d.enableCors),
    allowCorsFrom = anyString(json, "allowCorsFrom", d.allowCorsFrom),
    allowCorsCreds = anyBool(json, "allowCorsCreds", d.allowCorsCreds),
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

  private def anyInt(json: JsValue, field: St, default: i32): Opt[Opt[i32]] =
    anyInt32(json, field = field, default = default)

  private def anyInt32(json: JsValue, field: St, default: i32): Opt[Opt[i32]] = {
    anyInt64(json, field, default.toLong) map { anyVal64 =>
      anyVal64 map { val64 =>
        CLEAN_UP; DO_AFTER // 2021-09-01: Always do dieIf, .. or throwForbidden instead?
        // Originally, was just  .toInt  no min/max check.
        if (Globals.isDevOrTest) {
          dieIf(val64 < Integer.MIN_VALUE, "TyE603RMSDL6", val64)
          dieIf(val64 > Integer.MAX_VALUE, "TyE603RMSDL7", val64)
        }
        val64.toInt
      }
    }
  }

  private def anyInt64(json: JsValue, field: St, default: i64): Opt[Opt[i64]] =
    (json \ field).toOption.map {
      case n: JsNumber =>
        val value = n.value.toLong
        if (value == default) None else Some(value)
      case JsNull =>
        None
      case bad =>
        throwBadRequest("TyE5J4K025", s"'$field' is not a JsNumber, but a ${classNameOf(bad)}")
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


  private def anyJsObj(json: JsValue, field: String, default: JsObject)
          : Option[Option[JsObject]] =
    (json \ field).toOption.map {
      case o: JsObject =>
        if (o == default) None else Some(o)
      case JsNull =>
        None
      case bad =>
        throwBadRequest("TyE304KP23", s"'$field' is not a JsObject, but a ${classNameOf(bad)}")
    }
}
