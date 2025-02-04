/**
 * Copyright (c) 2014-2020 Kaj Magnus Lindberg
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

package com.debiki.dao.rdb

import com.debiki.core._
import com.debiki.core.Prelude._
import java.sql.ResultSet
import scala.collection.mutable
import Rdb._
import RdbUtil._


/** Creates, updates, deletes and loads settings for e.g. the whole website, a section
  * of the site (e.g. a blog or a forum), a category, single pages.
  */
trait SettingsSiteDaoMixin extends SiteTransaction {
  self: RdbSiteTransaction =>


  override def loadSiteSettings(): Option[EditedSettings] = {
    val query = s"""
      select *
      from settings3
      where site_id = ? and category_id is null and page_id is null
      """
    runQueryFindOneOrNone(query, List(siteId.asAnyRef), readSettingsFromResultSet)
  }


  override def upsertSiteSettings(settings: SettingsToSave): Unit = {
    // Later: use Postgres' built-in upsert (when have upgraded to Postgres 9.5)
    if (loadSiteSettings().isDefined) {
      updateSiteSettings(settings)
    }
    else {
      insertSiteSettings(settings)
    }
  }


  private def insertSiteSettings(editedSettings2: SettingsToSave): Unit = {
    val statement = s"""
      insert into settings3 (
        site_id,
        category_id,
        page_id,
        authn_diag_conf_c,
        user_must_be_auth,
        user_must_be_approved,
        expire_idle_after_mins,
        invite_only,
        allow_signup,
        enable_custom_idps,
        use_only_custom_idps,
        allow_local_signup,
        allow_guest_login,
        enable_google_login,
        enable_facebook_login,
        enable_twitter_login,
        enable_github_login,
        enable_gitlab_login,
        enable_linkedin_login,
        enable_vk_login,
        enable_instagram_login,
        require_verified_email,
        email_domain_blacklist,
        email_domain_whitelist,
        may_compose_before_signup,
        may_login_before_email_verified,
        double_type_email_address,
        double_type_password,
        beg_for_email_address,
        enable_sso,
        sso_url,
        sso_not_approved_url,
        sso_login_required_logout_url,
        sso_logout_redir_url_c,
        sso_show_emb_authn_btns_c,
        sso_paseto_v2_loc_secret_c,
        sso_paseto_v2_pub_pub_key_c,
        sso_refresh_authn_token_url_c,
        remember_emb_sess_c,
        expire_idle_emb_sess_after_mins_c,
        forum_main_view,
        forum_topics_sort_buttons,
        forum_category_links,
        forum_topics_layout,
        forum_categories_layout,
        show_categories,
        show_topic_filter,
        show_topic_types,
        select_topic_type,
        show_author_how,
        watchbar_starts_open,
        discussion_layout,
        disc_post_nesting,
        disc_post_sort_order,
        progress_layout,
        emb_com_sort_order_c,
        emb_com_nesting_c,
        orig_post_reply_btn_title,
        orig_post_votes,
        enable_disagree_vote_c,
        appr_before_if_trust_lte,
        review_after_if_trust_lte,
        num_first_posts_to_review,
        num_first_posts_to_approve,
        max_posts_pend_appr_before,
        max_posts_pend_revw_aftr,
        enable_stop_forum_spam,
        enable_akismet,
        akismet_api_key,
        send_email_to_akismet,
        favicon_url,
        head_styles_html,
        head_scripts_html,
        start_of_body_html,
        end_of_body_html,
        header_html,
        nav_conf,
        footer_html,
        horizontal_comments,
        social_links_html,
        logo_url_or_html,
        org_domain,
        org_full_name,
        org_short_name,
        outbound_emails_from_name_c,
        outbound_emails_from_addr_c,
        outbound_emails_reply_to_c,
        outbound_emails_smtp_conf_c,
        terms_of_use_url,
        privacy_url,
        rules_url,
        contact_email_addr,
        contact_url,
        contrib_agreement,
        content_license,
        language_code,
        google_analytics_id,
        enable_forum,
        enable_api,
        enable_tags,
        enable_chat,
        enable_direct_messages,
        enable_anon_posts_c,
        enable_online_status_c,
        enable_similar_topics,
        enable_cors,
        allow_cors_from,
        allow_cors_creds,
        show_sub_communities,
        experimental,
        feature_flags,
        own_domains_c,
        follow_links_to_c,
        allow_embedding_from,
        embedded_comments_category_id,
        html_tag_css_classes)
      values (?, ?, ?, ?::jsonb, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?::jsonb, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
          ?::jsonb, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      """

    val values = List(
      siteId.asAnyRef,
      NullInt,
      NullVarchar,
      editedSettings2.authnDiagConf.getOrElse(None).orNullJson,
      editedSettings2.userMustBeAuthenticated.getOrElse(None).orNullBoolean,
      editedSettings2.userMustBeApproved.getOrElse(None).orNullBoolean,
      editedSettings2.expireIdleAfterMins.getOrElse(None).orNullInt,
      editedSettings2.inviteOnly.getOrElse(None).orNullBoolean,
      editedSettings2.allowSignup.getOrElse(None).orNullBoolean,
      editedSettings2.enableCustomIdps.getOrElse(None).orNullBoolean,
      editedSettings2.useOnlyCustomIdps.getOrElse(None).orNullBoolean,
      editedSettings2.allowLocalSignup.getOrElse(None).orNullBoolean,
      editedSettings2.allowGuestLogin.getOrElse(None).orNullBoolean,
      editedSettings2.enableGoogleLogin.getOrElse(None).orNullBoolean,
      editedSettings2.enableFacebookLogin.getOrElse(None).orNullBoolean,
      editedSettings2.enableTwitterLogin.getOrElse(None).orNullBoolean,
      editedSettings2.enableGitHubLogin.getOrElse(None).orNullBoolean,
      editedSettings2.enableGitLabLogin.getOrElse(None).orNullBoolean,
      editedSettings2.enableLinkedInLogin.getOrElse(None).orNullBoolean,
      editedSettings2.enableVkLogin.getOrElse(None).orNullBoolean,
      editedSettings2.enableInstagramLogin.getOrElse(None).orNullBoolean,
      editedSettings2.requireVerifiedEmail.getOrElse(None).orNullBoolean,
      editedSettings2.emailDomainBlacklist.getOrElse(None).trimOrNullVarchar,
      editedSettings2.emailDomainWhitelist.getOrElse(None).trimOrNullVarchar,
      editedSettings2.mayComposeBeforeSignup.getOrElse(None).orNullBoolean,
      editedSettings2.mayPostBeforeEmailVerified.getOrElse(None).orNullBoolean,
      editedSettings2.doubleTypeEmailAddress.getOrElse(None).orNullBoolean,
      editedSettings2.doubleTypePassword.getOrElse(None).orNullBoolean,
      editedSettings2.begForEmailAddress.getOrElse(None).orNullBoolean,
      editedSettings2.enableSso.getOrElse(None).orNullBoolean,
      editedSettings2.ssoUrl.getOrElse(None).trimOrNullVarchar,
      editedSettings2.ssoNotApprovedUrl.getOrElse(None).trimOrNullVarchar,
      editedSettings2.ssoLoginRequiredLogoutUrl.getOrElse(None).trimOrNullVarchar,
      editedSettings2.ssoLogoutRedirUrl.getOrElse(None).trimOrNullVarchar,
      editedSettings2.ssoShowEmbAuthnBtns.getOrElse(None).orNullInt,
      editedSettings2.ssoPasetoV2LocalSecret.getOrElse(None).trimOrNullVarchar,
      editedSettings2.ssoPasetoV2PublicKey.getOrElse(None).trimOrNullVarchar,
      editedSettings2.ssoRefreshAuthnTokenUrl.getOrElse(None).trimOrNullVarchar,
      editedSettings2.rememberEmbSess.getOrElse(None).map(_.toZeroOne).orNullInt,
      editedSettings2.expireIdleEmbSessAfterMins.getOrElse(None).orNullInt,
      editedSettings2.forumMainView.getOrElse(None).trimOrNullVarchar,
      editedSettings2.forumTopicsSortButtons.getOrElse(None).trimOrNullVarchar,
      editedSettings2.forumCategoryLinks.getOrElse(None).trimOrNullVarchar,
      editedSettings2.forumTopicsLayout.getOrElse(None).map(_.toInt).orNullInt,
      editedSettings2.forumCategoriesLayout.getOrElse(None).map(_.toInt).orNullInt,
      editedSettings2.showCategories.getOrElse(None).orNullBoolean,
      editedSettings2.showTopicFilterButton.getOrElse(None).orNullBoolean,
      editedSettings2.showTopicTypes.getOrElse(None).orNullBoolean,
      editedSettings2.selectTopicType.getOrElse(None).orNullBoolean,
      editedSettings2.showAuthorHow.getOrElse(None).map(_.toInt).orNullInt,
      editedSettings2.watchbarStartsOpen.getOrElse(None).orNullBoolean,
      editedSettings2.discussionLayout.getOrElse(None).map(_.toInt).orNullInt,
      editedSettings2.discPostNesting.getOrElse(None).orNullInt,
      editedSettings2.discPostSortOrder.getOrElse(None).map(_.toInt).orNullInt,
      editedSettings2.progressLayout.getOrElse(None).map(_.toInt).orNullInt,
      editedSettings2.embComSortOrder.getOrElse(None).map(_.toInt).orNullInt,
      editedSettings2.embComNesting.getOrElse(None).orNullInt,
      editedSettings2.origPostReplyBtnTitle.getOrElse(None).orNullVarchar,
      editedSettings2.origPostVotes.getOrElse(None).map(_.toInt).orNullInt,
      editedSettings2.enableDisagreeVote.getOrElse(None).orNullBo,
      editedSettings2.requireApprovalIfTrustLte.getOrElse(None).map(_.toInt).orNullInt,
      editedSettings2.reviewAfterIfTrustLte.getOrElse(None).map(_.toInt).orNullInt,
      editedSettings2.numFirstPostsToReview.getOrElse(None).orNullInt,
      editedSettings2.numFirstPostsToApprove.getOrElse(None).orNullInt,
      editedSettings2.maxPostsPendApprBefore.getOrElse(None).orNullInt,
      editedSettings2.maxPostsPendRevwAftr.getOrElse(None).orNullInt,
      editedSettings2.enableStopForumSpam.getOrElse(None).orNullBoolean,
      editedSettings2.enableAkismet.getOrElse(None).orNullBoolean,
      editedSettings2.akismetApiKey.getOrElse(None).orNullVarchar,
      editedSettings2.sendEmailToAkismet.getOrElse(None).orNullBoolean,
      editedSettings2.faviconUrl.getOrElse(None).trimOrNullVarchar,
      editedSettings2.headStylesHtml.getOrElse(None).trimOrNullVarchar,
      editedSettings2.headScriptsHtml.getOrElse(None).trimOrNullVarchar,
      editedSettings2.startOfBodyHtml.getOrElse(None).trimOrNullVarchar,
      editedSettings2.endOfBodyHtml.getOrElse(None).trimOrNullVarchar,
      editedSettings2.headerHtml.getOrElse(None).trimOrNullVarchar,
      editedSettings2.navConf.getOrElse(None).orNullJson,
      editedSettings2.footerHtml.getOrElse(None).trimOrNullVarchar,
      editedSettings2.horizontalComments.getOrElse(None).orNullBoolean,
      editedSettings2.socialLinksHtml.getOrElse(None).trimOrNullVarchar,
      editedSettings2.logoUrlOrHtml.getOrElse(None).trimOrNullVarchar,
      editedSettings2.orgDomain.getOrElse(None).trimOrNullVarchar,
      editedSettings2.orgFullName.getOrElse(None).trimOrNullVarchar,
      editedSettings2.orgShortName.getOrElse(None).trimOrNullVarchar,
      editedSettings2.outboundEmailsFromName.getOrElse(None).trimOrNullVarchar,
      editedSettings2.outboundEmailsFromAddr.getOrElse(None).trimOrNullVarchar,
      editedSettings2.outboundEmailsReplyTo.getOrElse(None).trimOrNullVarchar,
      editedSettings2.outboundEmailsSmtpConf.getOrElse(None).orNullJson,
      editedSettings2.termsOfUseUrl.getOrElse(None).trimOrNullVarchar,
      editedSettings2.privacyUrl.getOrElse(None).trimOrNullVarchar,
      editedSettings2.rulesUrl.getOrElse(None).trimOrNullVarchar,
      editedSettings2.contactEmailAddr.getOrElse(None).trimOrNullVarchar,
      editedSettings2.contactUrl.getOrElse(None).trimOrNullVarchar,
      editedSettings2.contribAgreement.getOrElse(None).map(_.toInt).orNullInt,
      editedSettings2.contentLicense.getOrElse(None).map(_.toInt).orNullInt,
      editedSettings2.languageCode.getOrElse(None).trimOrNullVarchar,
      editedSettings2.googleUniversalAnalyticsTrackingId.getOrElse(None).trimOrNullVarchar,
      editedSettings2.enableForum.getOrElse(None).orNullBoolean,
      editedSettings2.enableApi.getOrElse(None).orNullBoolean,
      editedSettings2.enableTags.getOrElse(None).orNullBoolean,
      editedSettings2.enableChat.getOrElse(None).orNullBoolean,
      editedSettings2.enableDirectMessages.getOrElse(None).orNullBoolean,
      editedSettings2.enableAnonSens.getOrElse(None).orNullBoolean,
      editedSettings2.enablePresence.getOrElse(None).orNullBoolean,
      editedSettings2.enableSimilarTopics.getOrElse(None).orNullBoolean,
      editedSettings2.enableCors.getOrElse(None).orNullBoolean,
      editedSettings2.allowCorsFrom.getOrElse(None).trimOrNullVarchar,
      editedSettings2.allowCorsCreds.getOrElse(None).orNullBoolean,
      editedSettings2.showSubCommunities.getOrElse(None).orNullBoolean,
      editedSettings2.showExperimental.getOrElse(None).orNullBoolean,
      editedSettings2.featureFlags.getOrElse(None).trimOrNullVarchar,
      editedSettings2.ownDomains.getOrElse(None).trimOrNullVarchar,
      editedSettings2.followLinksTo.getOrElse(None).trimOrNullVarchar,
      editedSettings2.allowEmbeddingFrom.getOrElse(None).trimOrNullVarchar,
      editedSettings2.embeddedCommentsCategoryId.getOrElse(None).orNullInt,
      editedSettings2.htmlTagCssClasses.getOrElse(None).trimOrNullVarchar)

    runUpdate(statement, values)
  }


  private def updateSiteSettings(editedSettings2: SettingsToSave): Unit = {
    val statement = mutable.StringBuilder.newBuilder.append("update settings3 set ")
    val values = mutable.ArrayBuffer[AnyRef]()
    var somethingToDo = false
    var nothingOrComma = ""

    def maybeSet(column: String, anyValue: Option[AnyRef]): Unit = {
      anyValue foreach { value =>
        somethingToDo = true
        statement.append(s"$nothingOrComma$column = ?")
        nothingOrComma = ", "
        values += value
      }
    }

    val s = editedSettings2
    maybeSet("authn_diag_conf_c", s.authnDiagConf.map(_.orNullJson))
    maybeSet("user_must_be_auth", s.userMustBeAuthenticated.map(_.orNullBoolean))
    maybeSet("user_must_be_approved", s.userMustBeApproved.map(_.orNullBoolean))
    maybeSet("expire_idle_after_mins", s.expireIdleAfterMins.map(_.orNullInt))
    maybeSet("invite_only", s.inviteOnly.map(_.orNullBoolean))
    maybeSet("allow_signup", s.allowSignup.map(_.orNullBoolean))
    maybeSet("enable_custom_idps", s.enableCustomIdps.map(_.orNullBoolean))
    maybeSet("use_only_custom_idps", s.useOnlyCustomIdps.map(_.orNullBoolean))
    maybeSet("allow_local_signup", s.allowLocalSignup.map(_.orNullBoolean))
    maybeSet("allow_guest_login", s.allowGuestLogin.map(_.orNullBoolean))
    maybeSet("enable_google_login", s.enableGoogleLogin.map(_.orNullBoolean))
    maybeSet("enable_facebook_login", s.enableFacebookLogin.map(_.orNullBoolean))
    maybeSet("enable_twitter_login", s.enableTwitterLogin.map(_.orNullBoolean))
    maybeSet("enable_github_login", s.enableGitHubLogin.map(_.orNullBoolean))
    maybeSet("enable_gitlab_login", s.enableGitLabLogin.map(_.orNullBoolean))
    maybeSet("enable_linkedin_login", s.enableLinkedInLogin.map(_.orNullBoolean))
    maybeSet("enable_vk_login", s.enableVkLogin.map(_.orNullBoolean))
    maybeSet("enable_instagram_login", s.enableInstagramLogin.map(_.orNullBoolean))
    maybeSet("require_verified_email", s.requireVerifiedEmail.map(_.orNullBoolean))
    maybeSet("email_domain_blacklist", s.emailDomainBlacklist.map(_.trimOrNullVarchar))
    maybeSet("email_domain_whitelist", s.emailDomainWhitelist.map(_.trimOrNullVarchar))
    maybeSet("may_compose_before_signup", s.mayComposeBeforeSignup.map(_.orNullBoolean))
    maybeSet("may_login_before_email_verified", s.mayPostBeforeEmailVerified.map(_.orNullBoolean))
    maybeSet("double_type_email_address", s.doubleTypeEmailAddress.map(_.orNullBoolean))
    maybeSet("double_type_password", s.doubleTypePassword.map(_.orNullBoolean))
    maybeSet("beg_for_email_address", s.begForEmailAddress.map(_.orNullBoolean))
    maybeSet("enable_sso", s.enableSso.map(_.orNullBoolean))
    maybeSet("sso_url", s.ssoUrl.map(_.trimOrNullVarchar))
    maybeSet("sso_not_approved_url", s.ssoNotApprovedUrl.map(_.trimOrNullVarchar))
    maybeSet("sso_login_required_logout_url", s.ssoLoginRequiredLogoutUrl.map(_.trimOrNullVarchar))
    maybeSet("sso_logout_redir_url_c", s.ssoLogoutRedirUrl.map(_.trimOrNullVarchar))
    maybeSet("sso_show_emb_authn_btns_c", s.ssoShowEmbAuthnBtns.map(_.orNullInt))
    maybeSet("sso_paseto_v2_loc_secret_c", s.ssoPasetoV2LocalSecret.map(_.trimOrNullVarchar))
    maybeSet("sso_paseto_v2_pub_pub_key_c", s.ssoPasetoV2PublicKey.map(_.trimOrNullVarchar))
    maybeSet("sso_refresh_authn_token_url_c", s.ssoRefreshAuthnTokenUrl.map(_.trimOrNullVarchar))
    maybeSet("remember_emb_sess_c", s.rememberEmbSess.map(_.map(_.toZeroOne).orNullInt))
    maybeSet("expire_idle_emb_sess_after_mins_c", s.expireIdleEmbSessAfterMins.map(_.orNullInt))
    maybeSet("forum_main_view", s.forumMainView.map(_.trimOrNullVarchar))
    maybeSet("forum_topics_sort_buttons", s.forumTopicsSortButtons.map(_.trimOrNullVarchar))
    maybeSet("forum_category_links", s.forumCategoryLinks.map(_.trimOrNullVarchar))
    maybeSet("forum_topics_layout", s.forumTopicsLayout.map(_.map(_.toInt).orNullInt))
    maybeSet("forum_categories_layout", s.forumCategoriesLayout.map(_.map(_.toInt).orNullInt))
    maybeSet("show_categories", s.showCategories.map(_.orNullBoolean))
    maybeSet("show_topic_filter", s.showTopicFilterButton.map(_.orNullBoolean))
    maybeSet("show_topic_types", s.showTopicTypes.map(_.orNullBoolean))
    maybeSet("select_topic_type", s.selectTopicType.map(_.orNullBoolean))
    maybeSet("show_author_how", s.showAuthorHow.map(_.map(_.toInt).orNullInt))
    maybeSet("watchbar_starts_open", s.watchbarStartsOpen.map(_.orNullBoolean))
    maybeSet("discussion_layout", s.discussionLayout.map(_.map(_.toInt).orNullInt))
    maybeSet("disc_post_nesting", s.discPostNesting.map(_.orNullInt))
    maybeSet("disc_post_sort_order", s.discPostSortOrder.map(_.map(_.toInt).orNullInt))
    maybeSet("progress_layout", s.progressLayout.map(_.map(_.toInt).orNullInt))
    maybeSet("emb_com_sort_order_c", s.embComSortOrder.map(_.map(_.toInt).orNullInt))
    maybeSet("emb_com_nesting_c", s.embComNesting.map(_.orNullInt))
    maybeSet("orig_post_reply_btn_title", s.origPostReplyBtnTitle.map(_.trimOrNullVarchar))
    maybeSet("orig_post_votes", s.origPostVotes.map(_.map(_.toInt).orNullInt))
    maybeSet("enable_disagree_vote_c", s.enableDisagreeVote.map(_.orNullBo))
    maybeSet("appr_before_if_trust_lte", s.requireApprovalIfTrustLte.map(_.map(_.toInt).orNullInt))
    maybeSet("review_after_if_trust_lte", s.reviewAfterIfTrustLte.map(_.map(_.toInt).orNullInt))
    maybeSet("num_first_posts_to_review", s.numFirstPostsToReview.map(_.orNullInt))
    maybeSet("num_first_posts_to_approve", s.numFirstPostsToApprove.map(_.orNullInt))
    maybeSet("max_posts_pend_appr_before", s.maxPostsPendApprBefore.map(_.orNullInt))
    maybeSet("max_posts_pend_revw_aftr", s.maxPostsPendRevwAftr.map(_.orNullInt))
    maybeSet("enable_stop_forum_spam", s.enableStopForumSpam.map(_.orNullBoolean))
    maybeSet("enable_akismet", s.enableAkismet.map(_.orNullBoolean))
    maybeSet("akismet_api_key", s.akismetApiKey.map(_.trimOrNullVarchar))
    maybeSet("send_email_to_akismet", s.sendEmailToAkismet.map(_.orNullBoolean))
    maybeSet("favicon_url", s.faviconUrl.map(_.trimOrNullVarchar))
    maybeSet("head_styles_html", s.headStylesHtml.map(_.trimOrNullVarchar))
    maybeSet("head_scripts_html", s.headScriptsHtml.map(_.trimOrNullVarchar))
    maybeSet("start_of_body_html", s.startOfBodyHtml.map(_.trimOrNullVarchar))
    maybeSet("end_of_body_html", s.endOfBodyHtml.map(_.trimOrNullVarchar))
    maybeSet("header_html", s.headerHtml.map(_.trimOrNullVarchar))
    maybeSet("nav_conf", s.navConf.map(_.orNullJson))
    maybeSet("footer_html", s.footerHtml.map(_.trimOrNullVarchar))
    maybeSet("horizontal_comments", s.horizontalComments.map(_.orNullBoolean))
    maybeSet("social_links_html", s.socialLinksHtml.map(_.trimOrNullVarchar))
    maybeSet("logo_url_or_html", s.logoUrlOrHtml.map(_.trimOrNullVarchar))
    maybeSet("org_domain", s.orgDomain.map(_.trimOrNullVarchar))
    maybeSet("org_full_name", s.orgFullName.map(_.trimOrNullVarchar))
    maybeSet("org_short_name", s.orgShortName.map(_.trimOrNullVarchar))
    maybeSet("outbound_emails_from_name_c", s.outboundEmailsFromName.map(_.orNullVarchar))
    maybeSet("outbound_emails_from_addr_c", s.outboundEmailsFromAddr.map(_.orNullVarchar))
    maybeSet("outbound_emails_reply_to_c", s.outboundEmailsReplyTo.map(_.orNullVarchar))
    maybeSet("outbound_emails_smtp_conf_c", s.outboundEmailsSmtpConf.map(_.orNullJson))
    maybeSet("terms_of_use_url", s.termsOfUseUrl.map(_.trimOrNullVarchar))
    maybeSet("privacy_url", s.privacyUrl.map(_.trimOrNullVarchar))
    maybeSet("rules_url", s.rulesUrl.map(_.trimOrNullVarchar))
    maybeSet("contact_email_addr", s.contactEmailAddr.map(_.trimOrNullVarchar))
    maybeSet("contact_url", s.contactUrl.map(_.trimOrNullVarchar))
    maybeSet("contrib_agreement", s.contribAgreement.map(_.map(_.toInt).orNullInt))
    maybeSet("content_license", s.contentLicense.map(_.map(_.toInt).orNullInt))
    maybeSet("language_code", s.languageCode.map(_.trimOrNullVarchar))
    maybeSet("google_analytics_id", s.googleUniversalAnalyticsTrackingId.map(_.trimOrNullVarchar))
    maybeSet("enable_forum", s.enableForum.map(_.orNullBoolean))
    maybeSet("enable_api", s.enableApi.map(_.orNullBoolean))
    maybeSet("enable_tags", s.enableTags.map(_.orNullBoolean))
    maybeSet("enable_chat", s.enableChat.map(_.orNullBoolean))
    maybeSet("enable_direct_messages", s.enableDirectMessages.map(_.orNullBoolean))
    maybeSet("enable_anon_posts_c", s.enableAnonSens.map(_.orNullBoolean))
    maybeSet("enable_online_status_c", s.enablePresence.map(_.orNullBoolean))
    maybeSet("enable_similar_topics", s.enableSimilarTopics.map(_.orNullBoolean))
    maybeSet("enable_cors", s.enableCors.map(_.orNullBoolean))
    maybeSet("allow_cors_from", s.allowCorsFrom.map(_.orNullVarchar))
    maybeSet("allow_cors_creds", s.allowCorsCreds.map(_.orNullBoolean))
    maybeSet("show_sub_communities", s.showSubCommunities.map(_.orNullBoolean))
    maybeSet("experimental", s.showExperimental.map(_.orNullBoolean))
    maybeSet("feature_flags", s.featureFlags.map(_.trimOrNullVarchar))
    maybeSet("own_domains_c", s.ownDomains.map(_.trimOrNullVarchar))
    maybeSet("follow_links_to_c", s.followLinksTo.map(_.trimOrNullVarchar))
    maybeSet("allow_embedding_from", s.allowEmbeddingFrom.map(_.trimOrNullVarchar))
    maybeSet("embedded_comments_category_id", s.embeddedCommentsCategoryId.map(_.orNullInt))
    maybeSet("html_tag_css_classes", s.htmlTagCssClasses.map(_.trimOrNullVarchar))
    maybeSet("num_flags_to_hide_post", s.numFlagsToHidePost.map(_.orNullInt))
    maybeSet("cooldown_minutes_after_flagged_hidden",
                s.cooldownMinutesAfterFlaggedHidden.map(_.orNullInt))
    maybeSet("num_flags_to_block_new_user", s.numFlagsToBlockNewUser.map(_.orNullInt))
    maybeSet("num_flaggers_to_block_new_user", s.numFlaggersToBlockNewUser.map(_.orNullInt))
    maybeSet("notify_mods_if_user_blocked", s.notifyModsIfUserBlocked.map(_.orNullBoolean))
    maybeSet("regular_member_flag_weight", s.regularMemberFlagWeight.map(_.orNullFloat))
    maybeSet("core_member_flag_weight", s.coreMemberFlagWeight.map(_.orNullFloat))

    statement.append(" where site_id = ? and category_id is null and page_id is null")
    values.append(siteId.asAnyRef)

    if (somethingToDo) {
      runUpdateExactlyOneRow(statement.toString(), values.toList)
    }
  }


  private def readSettingsFromResultSet(rs: ResultSet): EditedSettings = {
    EditedSettings(
      authnDiagConf = getOptJsObject(rs, "authn_diag_conf_c"),
      userMustBeAuthenticated = getOptBoolean(rs, "user_must_be_auth"),
      userMustBeApproved = getOptBoolean(rs, "user_must_be_approved"),
      expireIdleAfterMins = getOptInt(rs, "expire_idle_after_mins"),
      inviteOnly = getOptBoolean(rs, "invite_only"),
      allowSignup = getOptBoolean(rs, "allow_signup"),
      enableCustomIdps = getOptBoolean(rs, "enable_custom_idps"),
      useOnlyCustomIdps = getOptBoolean(rs, "use_only_custom_idps"),
      allowLocalSignup = getOptBoolean(rs, "allow_local_signup"),
      allowGuestLogin = getOptBoolean(rs, "allow_guest_login"),
      enableGoogleLogin = getOptBoolean(rs, "enable_google_login"),
      enableFacebookLogin = getOptBoolean(rs, "enable_facebook_login"),
      enableTwitterLogin = getOptBoolean(rs, "enable_twitter_login"),
      enableGitHubLogin = getOptBoolean(rs, "enable_github_login"),
      enableGitLabLogin = getOptBoolean(rs, "enable_gitlab_login"),
      enableLinkedInLogin = getOptBoolean(rs, "enable_linkedin_login"),
      enableVkLogin = getOptBoolean(rs, "enable_vk_login"),
      enableInstagramLogin = getOptBoolean(rs, "enable_instagram_login"),
      requireVerifiedEmail = getOptBoolean(rs, "require_verified_email"),
      emailDomainBlacklist = getOptString(rs, "email_domain_blacklist"),
      emailDomainWhitelist = getOptString(rs, "email_domain_whitelist"),
      mayComposeBeforeSignup = getOptBoolean(rs, "may_compose_before_signup"),
      mayPostBeforeEmailVerified = getOptBoolean(rs, "may_login_before_email_verified"),
      doubleTypeEmailAddress = getOptBoolean(rs, "double_type_email_address"),
      doubleTypePassword = getOptBoolean(rs, "double_type_password"),
      minPasswordLength = None,
      begForEmailAddress = getOptBoolean(rs, "beg_for_email_address"),
      enableSso = getOptBoolean(rs, "enable_sso"),
      ssoUrl = getOptString(rs, "sso_url"),
      ssoNotApprovedUrl = getOptString(rs, "sso_not_approved_url"),
      ssoLoginRequiredLogoutUrl = getOptString(rs, "sso_login_required_logout_url"),
      ssoLogoutRedirUrl = getOptString(rs, "sso_logout_redir_url_c"),
      ssoShowEmbAuthnBtns = getOptInt32(rs, "sso_show_emb_authn_btns_c"),
      ssoPasetoV2LocalSecret = getOptString(rs, "sso_paseto_v2_loc_secret_c"),
      ssoPasetoV2PublicKey = getOptString(rs, "sso_paseto_v2_pub_pub_key_c"),
      ssoRefreshAuthnTokenUrl = getOptString(rs, "sso_refresh_authn_token_url_c"),
      rememberEmbSess = getOptInt32(rs, "remember_emb_sess_c").map(_ == 1),
      expireIdleEmbSessAfterMins = getOptInt32(rs, "expire_idle_emb_sess_after_mins_c"),
      forumMainView = getOptString(rs, "forum_main_view"),
      forumTopicsSortButtons = getOptString(rs, "forum_topics_sort_buttons"),
      forumCategoryLinks = getOptString(rs, "forum_category_links"),
      forumTopicsLayout = getOptInt(rs, "forum_topics_layout").flatMap(TopicListLayout.fromInt),
      forumCategoriesLayout = getOptInt(rs, "forum_categories_layout").flatMap(CategoriesLayout.fromInt),
      showCategories = getOptBool(rs, "show_categories"),
      showTopicFilterButton = getOptBool(rs, "show_topic_filter"),
      showTopicTypes = getOptBool(rs, "show_topic_types"),
      selectTopicType = getOptBool(rs, "select_topic_type"),
      showAuthorHow = getOptInt(rs, "show_author_how").flatMap(ShowAuthorHow.fromInt),
      watchbarStartsOpen = getOptBool(rs, "watchbar_starts_open"),
      discussionLayout = getOptInt(rs, "discussion_layout").flatMap(DiscussionLayout.fromInt),
      discPostNesting = getOptInt(rs, "disc_post_nesting"),
      discPostSortOrder = getOptInt(rs, "disc_post_sort_order").flatMap(PostSortOrder.fromInt),
      progressLayout = getOptInt(rs, "progress_layout").flatMap(ProgressLayout.fromInt),
      embComSortOrder = getOptInt(rs, "emb_com_sort_order_c").flatMap(PostSortOrder.fromInt),
      embComNesting = getOptInt(rs, "emb_com_nesting_c"),
      origPostReplyBtnTitle = getOptString(rs, "orig_post_reply_btn_title"),
      origPostVotes = getOptInt(rs, "orig_post_votes").flatMap(OrigPostVotes.fromInt),
      enableDisagreeVote = getOptBo(rs, "enable_disagree_vote_c"),
      requireApprovalIfTrustLte = getOptInt(rs, "appr_before_if_trust_lte").flatMap(TrustLevel.fromInt),
      reviewAfterIfTrustLte = getOptInt(rs, "review_after_if_trust_lte").flatMap(TrustLevel.fromInt),
      numFirstPostsToReview = getOptInt(rs, "num_first_posts_to_review"),
      numFirstPostsToApprove = getOptInt(rs, "num_first_posts_to_approve"),
      maxPostsPendApprBefore = getOptInt(rs, "max_posts_pend_appr_before"),
      maxPostsPendRevwAftr = getOptInt(rs, "max_posts_pend_revw_aftr"),
      enableStopForumSpam = getOptBool(rs, "enable_stop_forum_spam"),
      enableAkismet = getOptBool(rs, "enable_akismet"),
      akismetApiKey = getOptString(rs, "akismet_api_key"),
      sendEmailToAkismet = getOptBool(rs, "send_email_to_akismet"),
      faviconUrl = getOptString(rs, "favicon_url"),
      headStylesHtml = getOptString(rs, "head_styles_html"),
      headScriptsHtml = getOptString(rs, "head_scripts_html"),
      startOfBodyHtml = getOptString(rs, "start_of_body_html"),
      endOfBodyHtml = getOptString(rs, "end_of_body_html"),
      headerHtml = getOptString(rs, "header_html"),
      navConf = getOptJsObject(rs, "nav_conf"),
      footerHtml = getOptString(rs, "footer_html"),
      horizontalComments = getOptBool(rs, "horizontal_comments"),
      socialLinksHtml = getOptString(rs, "social_links_html"),
      logoUrlOrHtml = getOptString(rs, "logo_url_or_html"),
      orgDomain = getOptString(rs, "org_domain"),
      orgFullName = getOptString(rs, "org_full_name"),
      orgShortName = getOptString(rs, "org_short_name"),
      outboundEmailsFromName = getOptString(rs, "outbound_emails_from_name_c"),
      outboundEmailsFromAddr = getOptString(rs, "outbound_emails_from_addr_c"),
      outboundEmailsReplyTo = getOptString(rs, "outbound_emails_reply_to_c"),
      outboundEmailsSmtpConf = getOptJsObject(rs, "outbound_emails_smtp_conf_c"),
      termsOfUseUrl = getOptString(rs, "terms_of_use_url"),
      privacyUrl = getOptString(rs, "privacy_url"),
      rulesUrl = getOptString(rs, "rules_url"),
      contactEmailAddr = getOptString(rs, "contact_email_addr"),
      contactUrl = getOptString(rs, "contact_url"),
      contribAgreement = ContribAgreement.fromInt(rs.getInt("contrib_agreement")), // 0 -> None, ok
      contentLicense = ContentLicense.fromInt(rs.getInt("content_license")), // 0 -> None, ok
      languageCode = getOptString(rs, "language_code"),
      googleUniversalAnalyticsTrackingId = getOptString(rs, "google_analytics_id"),
      enableForum = getOptBool(rs, "enable_forum"),
      enableApi = getOptBool(rs, "enable_api"),
      enableTags = getOptBool(rs, "enable_tags"),
      enableChat = getOptBool(rs, "enable_chat"),
      enableDirectMessages = getOptBool(rs, "enable_direct_messages"),
      enableAnonSens = getOptBool(rs, "enable_anon_posts_c"),
      enablePresence = getOptBool(rs, "enable_online_status_c"),
      enableSimilarTopics = getOptBool(rs, "enable_similar_topics"),
      enableCors = getOptBool(rs, "enable_cors"),
      allowCorsFrom = getOptString(rs, "allow_cors_from"),
      allowCorsCreds = getOptBool(rs, "allow_cors_creds"),
      showSubCommunities = getOptBool(rs, "show_sub_communities"),
      showExperimental = getOptBool(rs, "experimental"),
      featureFlags = getOptString(rs, "feature_flags"),
      ownDomains = getOptString(rs, "own_domains_c"),
      followLinksTo = getOptString(rs, "follow_links_to_c"),
      allowEmbeddingFrom = getOptString(rs, "allow_embedding_from"),
      embeddedCommentsCategoryId = getOptInt(rs, "embedded_comments_category_id"),
      htmlTagCssClasses = getOptString(rs, "html_tag_css_classes"),
      numFlagsToHidePost = getOptInt(rs, "num_flags_to_hide_post"),
      cooldownMinutesAfterFlaggedHidden = getOptInt(rs, "cooldown_minutes_after_flagged_hidden"),
      numFlagsToBlockNewUser = getOptInt(rs, "num_flags_to_block_new_user"),
      numFlaggersToBlockNewUser = getOptInt(rs, "num_flaggers_to_block_new_user"),
      notifyModsIfUserBlocked = getOptBool(rs, "notify_mods_if_user_blocked"),
      regularMemberFlagWeight = getOptFloat(rs, "regular_member_flag_weight"),
      coreMemberFlagWeight = getOptFloat(rs, "core_member_flag_weight"))
  }

}
