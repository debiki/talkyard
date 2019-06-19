/**
 * Copyright (C) 2011-2013, 2017 Kaj Magnus Lindberg
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
import com.debiki.core.EmailNotfPrefs.EmailNotfPrefs
import com.debiki.core.Prelude._
import com.debiki.core.Participant.isGuestId
import java.{sql => js, util => ju}
import scala.collection.immutable
import Rdb._
import com.debiki.dao.rdb.PostsSiteDaoMixin.fromActionTypeInt


object RdbUtil {


  /**
   * I've included too many chars, I think, to play safe.
   * E.g. `=` and "` and `'` and '`' are no regex chars?
   */
  val MagicRegexChars = """!"#$%&'()*+,.:;<=>?@[\]^`{|}~"""


  /**
   * Use like so: "select ... where X in ("+ makeInListFor(xs) +")"
   */
  def makeInListFor(values: Seq[_]): String =
    values.map((x: Any) => "?").mkString(",")

  def makeInListFor(values: Iterable[_]): String = {
    // makeInListFor(Seq[_]), when given an Iterable, appended only one single "?"
    // instead of many, why? Anyway, instead:
    dieIf(values.isEmpty, "TyESQL0INL")
    var result = "?"
    if (values.size >= 2) {
      result += ",?" * (values.size - 1)
    }
    result
  }

  /** In PostgreSQL, one can order by id like so:
    *   select ... from ... where (id in (3, 4, 1, 2))
    *   order by id=3 desc, id=4 desc, id=1 desc
    * see http://stackoverflow.com/a/9475755/694469
    *
    * Returns "id=? desc, id=? desc, ...",
    * and simply "<field>" if `ids` is empty.
    */
  def makeOrderByListFor(field: String, ids: Seq[_]): String = {
    if (ids.isEmpty)
      return field

    val sb = StringBuilder.newBuilder
    for (id <- ids) {
      if (sb.nonEmpty) sb.append(", ")
      sb.append(s"$field = ? desc")
    }
    sb.toString
  }

  def descOrAsc(orderBy: OrderBy): String = orderBy match {
    case OrderBy.MostRecentFirst => "desc"
    case OrderBy.OldestFirst => "asc"
  }

  /** `rs.getInt` returns 0 instead of null.
   */
  @deprecated("use getOptionalInt instead", "now")
  def getOptionalIntNoneNot0(rs: js.ResultSet, column: String): Option[Int] = {
    val i = rs.getInt(column)
    if (rs.wasNull()) None
    else Some(i)
  }

  /** `rs.getBoolean` returns false instead of null.
    */
  def getOptBoolean(rs: js.ResultSet, column: String): Option[Boolean] =
    getOptionalBoolean(rs, column)

  def getOptionalBoolean(rs: js.ResultSet, column: String): Option[Boolean] = {
    val b = rs.getBoolean(column)
    if (rs.wasNull()) None
    else Some(b)
  }


  def getSiteInclDetails(rs: js.ResultSet, hostnames: immutable.Seq[HostnameInclDetails])
        : SiteInclDetails = {
    SiteInclDetails(
      id = rs.getInt("id"),
      pubId = rs.getString("publ_id"),
      name = rs.getString("name"),
      createdAt = getWhen(rs, "ctime"),
      createdFromIp = getOptString(rs, "creator_ip"),
      nextPageId = rs.getInt("next_page_id"),
      creatorEmailAddress = getOptString(rs, "creator_email_address"),
      quotaLimitMbs = getOptInt(rs, "quota_limit_mbs"),
      numGuests = rs.getInt("num_guests"),
      numIdentities = rs.getInt("num_identities"),
      numParticipants = rs.getInt("num_roles"),
      numPageUsers = rs.getInt("num_role_settings"),
      numPages = rs.getInt("num_pages"),
      numPosts = rs.getInt("num_posts"),
      numPostTextBytes = rs.getInt("num_post_text_bytes"),
      numPostsRead = rs.getInt("num_posts_read"),
      numActions = rs.getInt("num_actions"),
      numNotfs = rs.getInt("num_notfs"),
      numEmailsSent = rs.getInt("num_emails_sent"),
      numAuditRows = rs.getInt("num_audit_rows"),
      numUploads = rs.getInt("num_uploads"),
      numUploadBytes = rs.getLong("num_upload_bytes"),
      version = rs.getInt("version"),
      numPostRevisions = rs.getInt("num_post_revisions"),
      numPostRevBytes = rs.getLong("num_post_rev_bytes"),
      status = SiteStatus.fromInt(rs.getInt("status")).getOrElse(SiteStatus.Deleted),
      hostnames = hostnames)
  }


  val InviteSelectListItems = i"""
      |site_id,
      |secret_key,
      |email_address,
      |created_by_id,
      |created_at,
      |accepted_at,
      |user_id,
      |deleted_at,
      |deleted_by_id,
      |invalidated_at
      |"""


  def getInvite(rs: js.ResultSet) = Invite(
    emailAddress = rs.getString("email_address"),
    secretKey = rs.getString("secret_key"),
    createdById = rs.getInt("created_by_id"),
    createdAt = getDate(rs, "created_at"),
    acceptedAt = getOptionalDate(rs, "accepted_at"),
    userId = getOptionalIntNoneNot0(rs, "user_id"),
    deletedAt = getOptionalDate(rs, "deleted_at"),
    deletedById = getOptionalIntNoneNot0(rs, "deleted_by_id"),
    invalidatedAt = getOptionalDate(rs, "invalidated_at"))


  val GroupSelectListItems = o"""
      user_id,
      ext_imp_id,
      created_at,
      full_name,
      username,
      locked_trust_level,
      primary_email_addr,
      summary_email_interval_mins,
      summary_email_if_active,
      avatar_tiny_base_url,
      avatar_tiny_hash_path,
      avatar_small_base_url,
      avatar_small_hash_path,
      ui_prefs
      """


  val UserSelectListItemsNoGuests: String =
    s"""u.USER_ID u_id,
      |u.ext_imp_id u_ext_imp_id,
      |u.is_group u_is_group,
      |u.created_at u_created_at,
      |u.full_name u_full_name,
      |u.USERNAME u_username,
      |u.external_id u_external_id,
      |u.IS_APPROVED u_is_approved,
      |u.APPROVED_AT u_approved_at,
      |u.APPROVED_BY_ID u_approved_by_id,
      |u.SUSPENDED_TILL u_suspended_till,
      |u.trust_level u_trust_level,
      |u.locked_trust_level u_locked_trust_level,
      |u.threat_level u_threat_level,
      |u.locked_threat_level u_locked_threat_level,
      |u.primary_email_addr u_primary_email_addr,
      |u.EMAIL_NOTFS u_email_notfs,
      |u.EMAIL_VERIFIED_AT u_email_verified_at,
      |u.PASSWORD_HASH u_password_hash,
      |u.COUNTRY u_country,
      |u.WEBSITE u_website,
      |u.avatar_tiny_base_url,
      |u.avatar_tiny_hash_path,
      |u.avatar_small_base_url,
      |u.avatar_small_hash_path,
      |u.ui_prefs, ${"" /* WOULD exclude here, if had time to micro optimize */}
      |u.is_owner u_is_owner,
      |u.is_admin u_is_admin,
      |u.is_moderator u_is_moderator,
      |u.deactivated_at is not null u_is_deactivated,
      |u.deleted_at is not null u_is_deleted
      |""".stripMargin


  val UserSelectListItemsWithGuests: String =
    s"""$UserSelectListItemsNoGuests,
     |u.guest_email_addr u_guest_email_addr,
     |u.guest_browser_id u_guest_browser_id,
     |e.email_notfs g_email_notfs""".stripMargin


  def getUser(rs: js.ResultSet): User =
    getParticipant(rs).toUserOrThrow


  def getParticipant(rs: js.ResultSet): Participant = {
    // A bit dupl code. (703KWH4)

    val userId = rs.getInt("u_id")
    val extImpId = getOptString(rs, "u_ext_imp_id")
    val isGroup = rs.getBoolean("u_is_group")
    def createdAt = getWhen(rs, "u_created_at")
    val emailNotfPrefs = {
      if (isGuestId(userId))
        _toEmailNotfs(rs.getString("g_email_notfs"))
      else
        _toEmailNotfs(rs.getString("u_email_notfs"))
    }
    val lockedThreatLevel = getOptInt(rs, "u_locked_threat_level").flatMap(ThreatLevel.fromInt)
    def theUsername = rs.getString("u_username")
    val name = Option(rs.getString("u_full_name"))
    def tinyAvatar = getAnyUploadRef(rs, "avatar_tiny_base_url", "avatar_tiny_hash_path")
    def smallAvatar = getAnyUploadRef(rs, "avatar_small_base_url", "avatar_small_hash_path")
    val anyTrustLevel = TrustLevel.fromInt(rs.getInt("u_trust_level"))
      // Use dn2e not n2e. ((So works if joined w/ DW1_IDS_SIMPLE, which
      // uses '-' instead of null to indicate absence of email address etc.
      // See usage of this function in RdbSystemTransaction.loadUsers(). ))
    if (isGuestId(userId))
      Guest(
        id = userId,
        extImpId = extImpId,
        createdAt = createdAt,
        guestName = dn2e(name.orNull),
        guestBrowserId = Option(rs.getString("u_guest_browser_id")),
        email = dn2e(rs.getString("u_guest_email_addr")),
        emailNotfPrefs = emailNotfPrefs,
        country = dn2e(rs.getString("u_country")).trimNoneIfEmpty,
        lockedThreatLevel = lockedThreatLevel)
    else if (isGroup)
      Group(
        id = userId,
        extImpId = extImpId,
        createdAt = createdAt,
        theUsername = theUsername,
        name = name,
        tinyAvatar = tinyAvatar,
        smallAvatar = smallAvatar,
        uiPrefs = getOptJsObject(rs, "ui_prefs"),
        summaryEmailIntervalMins = None,
        summaryEmailIfActive = None,
        grantsTrustLevel = None)
    else User(
      id = userId,
      fullName = name,
      theUsername = theUsername,
      email = dn2e(rs.getString("u_primary_email_addr")),
      emailNotfPrefs = emailNotfPrefs,
      emailVerifiedAt = getOptionalDate(rs, "u_email_verified_at"),
      passwordHash = Option(rs.getString("u_password_hash")),
      tinyAvatar = tinyAvatar,
      smallAvatar = smallAvatar,
      isApproved = getOptBool(rs, "u_is_approved"),
      suspendedTill = getOptionalDate(rs, "u_suspended_till"),
      trustLevel = anyTrustLevel.getOrDie("EsE7YK24"),
      lockedTrustLevel = getOptInt(rs, "u_locked_trust_level").flatMap(TrustLevel.fromInt),
      threatLevel = ThreatLevel.fromInt(rs.getInt("u_threat_level")).getOrDie("EsE0PW4V2"),
      lockedThreatLevel = lockedThreatLevel,
      isOwner = rs.getBoolean("u_is_owner"),
      isAdmin = rs.getBoolean("u_is_admin"),
      isModerator = rs.getBoolean("u_is_moderator"),
      isDeactivated = rs.getBoolean("u_is_deactivated"),
      isDeleted = rs.getBoolean("u_is_deleted"))
  }


  def getGroup(rs: js.ResultSet): Group = {
    Group(
      id = rs.getInt("user_id"),
      createdAt = getWhen(rs, "created_at"),
      theUsername = rs.getString("username"),
      name = getOptString(rs, "full_name"),
      tinyAvatar = getAnyUploadRef(rs, "avatar_tiny_base_url", "avatar_tiny_hash_path"),
      smallAvatar = getAnyUploadRef(rs, "avatar_small_base_url", "avatar_small_hash_path"),
      uiPrefs = getOptJsObject(rs, "ui_prefs"),
      summaryEmailIntervalMins = getOptInt(rs, "summary_email_interval_mins"),
      summaryEmailIfActive = getOptBool(rs, "summary_email_if_active"),
      grantsTrustLevel = getOptInt(rs, "locked_trust_level").flatMap(TrustLevel.fromInt))
  }


  val CompleteUserSelectListItemsNoUserId = i"""
    |ext_imp_id,
    |is_group,
    |created_at,
    |external_id,
    |full_name,
    |primary_email_addr,
    |guest_email_addr,
    |guest_browser_id,
    |about,
    |country,
    |website,
    |email_notfs,
    |summary_email_interval_mins,
    |summary_email_if_active,
    |is_owner,
    |is_admin,
    |is_moderator,
    |deactivated_at,
    |deleted_at,
    |username,
    |email_verified_at,
    |password_hash,
    |email_for_every_new_post,
    |see_activity_min_trust_level,
    |avatar_tiny_base_url,
    |avatar_tiny_hash_path,
    |avatar_small_base_url,
    |avatar_small_hash_path,
    |avatar_medium_base_url,
    |avatar_medium_hash_path,
    |ui_prefs,
    |is_approved,
    |approved_at,
    |approved_by_id,
    |suspended_at,
    |suspended_till,
    |suspended_by_id,
    |suspended_reason,
    |trust_level,
    |locked_trust_level,
    |threat_level,
    |locked_threat_level
    """

  val CompleteUserSelectListItemsWithUserId =
    s"user_id, $CompleteUserSelectListItemsNoUserId"


  def getParticipantInclDetails(rs: js.ResultSet): ParticipantInclDetails = {
    UNTESTED
    val participantId = rs.getInt("user_id")
    if (participantId <= MaxGuestId) {
      getGuestInclDetails(rs, participantId)
    }
    else {
      getMemberInclDetails(rs, Some(participantId))
    }
  }


  def getUserInclDetails(rs: js.ResultSet): UserInclDetails = {
    getMemberInclDetails(rs) match {
      case m: UserInclDetails => m
      case g: Group => throw GotAGroupException(g.id)
    }
  }


  def getMemberInclDetails(rs: js.ResultSet, userId: Option[UserId] = None): MemberInclDetails = {
    val theUserId = userId getOrElse rs.getInt("user_id")
    dieIf(Participant.isGuestId(theUserId), "DwE6P4K3")

    val isGroup = rs.getBoolean("is_group")
    if (isGroup) getGroup(rs)
    else getUserInclDetails(rs, theUserId)
  }


  /** Currently there's no GuestInclDetails, just a Guest and it includes everything. */
  private def getGuestInclDetails(rs: js.ResultSet, theGuestId: UserId): Guest = {
    // A bit dupl code. (703KWH4)
    val name = Option(rs.getString("full_name"))
    Guest(
      id = theGuestId,
      extImpId = getOptString(rs, "ext_imp_id"),
      createdAt = getWhen(rs, "created_at"),
      guestName = dn2e(name.orNull),
      guestBrowserId = Option(rs.getString("guest_browser_id")),
      email = dn2e(rs.getString("guest_email_addr")),
      emailNotfPrefs = _toEmailNotfs(rs.getString("email_notfs")),
      country = dn2e(rs.getString("country")).trimNoneIfEmpty,
      lockedThreatLevel = getOptInt(rs, "locked_threat_level").flatMap(ThreatLevel.fromInt))
  }


  private def getUserInclDetails(rs: js.ResultSet, theUserId: UserId): UserInclDetails = {
    // A bit dupl code. (703KWH4)
    UserInclDetails(
      id = theUserId,
      extImpId = getOptString(rs, "ext_imp_id"),
      externalId = getOptString(rs, "external_id"),
      fullName = Option(rs.getString("full_name")),
      username = rs.getString("username"),
      createdAt = getWhen(rs, "created_at"),
      primaryEmailAddress = dn2e(rs.getString("primary_email_addr")),
      emailNotfPrefs = _toEmailNotfs(rs.getString("email_notfs")),
      emailVerifiedAt = getOptionalDate(rs, "email_verified_at"),
      mailingListMode = false, //rs.getBoolean("email_for_every_new_post"),  // rename column, later
      summaryEmailIntervalMins = getOptInt(rs, "summary_email_interval_mins"),
      summaryEmailIfActive = getOptBool(rs, "summary_email_if_active"),
      passwordHash = Option(rs.getString("password_hash")),
      tinyAvatar = getAnyUploadRef(rs, "avatar_tiny_base_url", "avatar_tiny_hash_path"),
      smallAvatar = getAnyUploadRef(rs, "avatar_small_base_url", "avatar_small_hash_path"),
      mediumAvatar = getAnyUploadRef(rs, "avatar_medium_base_url", "avatar_medium_hash_path"),
      uiPrefs = getOptJsObject(rs, "ui_prefs"),
      country = getOptString(rs, "country"),
      website = getOptString(rs, "website"),
      about = getOptString(rs, "about"),
      seeActivityMinTrustLevel = getOptInt(rs, "see_activity_min_trust_level").flatMap(TrustLevel.fromInt),
      isApproved = getOptionalBoolean(rs, "is_approved"),
      reviewedAt = getOptionalDate(rs, "approved_at"),
      reviewedById = getOptInt(rs, "approved_by_id"),
      suspendedAt = getOptionalDate(rs, "suspended_at"),
      suspendedTill = getOptionalDate(rs, "suspended_till"),
      suspendedById = getOptInt(rs, "suspended_by_id"),
      suspendedReason = Option(rs.getString("suspended_reason")),
      trustLevel = TrustLevel.fromInt(rs.getInt("trust_level")).getOrDie("TyE205WR4", s"User id $theUserId"),
      lockedTrustLevel = getOptInt(rs, "locked_trust_level").flatMap(TrustLevel.fromInt),
      threatLevel = ThreatLevel.fromInt(rs.getInt("threat_level")).getOrDie("EsE22IU60C"),
      lockedThreatLevel = getOptInt(rs, "locked_threat_level").flatMap(ThreatLevel.fromInt),
      isOwner = rs.getBoolean("is_owner"),
      isAdmin = rs.getBoolean("is_admin"),
      isModerator = rs.getBoolean("is_moderator"),
      deactivatedAt = getOptWhen(rs, "deactivated_at"),
      deletedAt = getOptWhen(rs, "deleted_at"))
  }

  val UserStatsSelectListItems: String = i"""
    |last_seen_at,
    |last_posted_at,
    |last_emailed_at,
    |last_summary_email_at,
    |next_summary_maybe_at,
    |email_bounce_sum,
    |first_seen_at,
    |first_new_topic_at,
    |first_discourse_reply_at,
    |first_chat_message_at,
    |topics_new_since,
    |notfs_new_since_id,
    |num_days_visited,
    |num_seconds_reading,
    |num_discourse_replies_read,
    |num_discourse_replies_posted,
    |num_discourse_topics_entered,
    |num_discourse_topics_replied_in,
    |num_discourse_topics_created,
    |num_chat_messages_read,
    |num_chat_messages_posted,
    |num_chat_topics_entered,
    |num_chat_topics_replied_in,
    |num_chat_topics_created,
    |num_likes_given,
    |num_likes_received,
    |num_solutions_provided,
    |tour_tips_seen"""


  def getUserStats(rs: js.ResultSet): UserStats = {
    UserStats(
      userId = rs.getInt("user_id"),
      lastSeenAt = getWhen(rs, "last_seen_at"),
      lastPostedAt = getOptWhen(rs, "last_posted_at"),
      lastEmailedAt = getOptWhen(rs, "last_emailed_at"),
      lastSummaryEmailAt = getOptWhen(rs, "last_summary_email_at"),
      nextSummaryEmailAt = getOptWhen(rs, "next_summary_maybe_at"),
      emailBounceSum = rs.getFloat("email_bounce_sum"),
      firstSeenAtOr0 = getWhen(rs, "first_seen_at"),
      firstNewTopicAt = getOptWhen(rs, "first_new_topic_at"),
      firstDiscourseReplyAt = getOptWhen(rs, "first_discourse_reply_at"),
      firstChatMessageAt = getOptWhen(rs, "first_chat_message_at"),
      topicsNewSince = getWhen(rs, "topics_new_since"),
      notfsNewSinceId = rs.getInt("notfs_new_since_id"),
      numDaysVisited = rs.getInt("num_days_visited"),
      numSecondsReading = rs.getInt("num_seconds_reading"),
      numDiscourseRepliesRead = rs.getInt("num_discourse_replies_read"),
      numDiscourseRepliesPosted = rs.getInt("num_discourse_replies_posted"),
      numDiscourseTopicsEntered = rs.getInt("num_discourse_topics_entered"),
      numDiscourseTopicsRepliedIn = rs.getInt("num_discourse_topics_replied_in"),
      numDiscourseTopicsCreated = rs.getInt("num_discourse_topics_created"),
      numChatMessagesRead = rs.getInt("num_chat_messages_read"),
      numChatMessagesPosted = rs.getInt("num_chat_messages_posted"),
      numChatTopicsEntered = rs.getInt("num_chat_topics_entered"),
      numChatTopicsRepliedIn = rs.getInt("num_chat_topics_replied_in"),
      numChatTopicsCreated = rs.getInt("num_chat_topics_created"),
      numLikesGiven = rs.getInt("num_likes_given"),
      numLikesReceived = rs.getInt("num_likes_received"),
      numSolutionsProvided = rs.getInt("num_solutions_provided"),
      tourTipsSeen = getOptArrayOfStrings(rs, "tour_tips_seen"))
  }


  def getSpamCheckTask(rs: js.ResultSet): SpamCheckTask = {
    val anyPostId = getOptInt(rs, "post_id")
    val anyPostToCheck = anyPostId map { postId =>
      PostToSpamCheck(
        postId = postId,
        postNr = rs.getInt("post_nr"),
        postRevNr = rs.getInt("post_rev_nr"),
        pageId = rs.getString("page_id"),
        pageType = PageType.fromInt(rs.getInt("page_type")).getOrElse(PageType.Discussion),
        pageAvailableAt = getWhen(rs, "page_available_at"),
        htmlToSpamCheck = getString(rs, "html_to_spam_check"),
        language = getString(rs, "language"))
    }

    // Dupl data, can be derived from the other fields. Included for simpler queries.
    val anyIsMisclassified = getOptBool(rs, "is_misclassified")

    val result = SpamCheckTask(
      siteId = rs.getInt("site_id"),
      createdAt = getWhen(rs, "created_at"),
      postToSpamCheck = anyPostToCheck,
      who = Who(
        id = rs.getInt("author_id"),
        BrowserIdData(
          ip = rs.getString("req_ip"),
          idCookie = getOptString(rs, "browser_id_cookie"),
          fingerprint = rs.getInt("browser_fingerprint"))),
      requestStuff = SpamRelReqStuff(
        userAgent = getOptString(rs, "req_user_agent"),
        referer = getOptString(rs, "req_referer"),
        uri = rs.getString("req_uri"),
        userName = getOptString(rs, "author_name"),
        userEmail = getOptString(rs, "author_email_addr"),
        userUrl = getOptString(rs, "author_url"),
        userTrustLevel = getOptInt(rs, "author_trust_level").flatMap(TrustLevel.fromInt)),
      resultsAt = getOptWhen(rs, "results_at"),
      resultsJson = getOptJsObject(rs, "results_json"),
      resultsText = getOptString(rs, "results_text"),
      numIsSpamResults = getOptInt(rs, "num_is_spam_results"),
      numNotSpamResults = getOptInt(rs, "num_not_spam_results"),
      humanSaysIsSpam = getOptBool(rs, "human_says_is_spam"),
      misclassificationsReportedAt = getOptWhen(rs, "misclassifications_reported_at"))

    dieIf(result.isMisclassified != anyIsMisclassified, "TyE068TDGW2")
    result
  }


  def getNotification(rs: js.ResultSet): Notification = {
    val siteId = rs.getInt("site_id")
    val notfId = rs.getInt("notf_id")
    val notfTypeInt = rs.getInt("notf_type")
    val createdAt = getDate(rs, "created_at")
    val uniquePostId = rs.getInt("unique_post_id")
    val pageId = rs.getString("page_id")
    val actionType = getOptionalInt(rs, "action_type").map(fromActionTypeInt)
    val actionSubId = getOptionalInt(rs, "action_sub_id")
    val byUserId = rs.getInt("by_user_id")
    val toUserId = rs.getInt("to_user_id")
    val emailId = Option(rs.getString("email_id"))
    val emailStatusInt = rs.getInt("email_status")
    val emailStatus = NotfEmailStatus.fromInt(emailStatusInt).getOrDie(
      "EsE7UKW2", s"Bad notf email status: $emailStatusInt")
    val seenAt = getOptionalDate(rs, "seen_at")

    val notfType = NotificationType.fromInt(notfTypeInt).getOrDie(
      "EsE6GMUK2", s"Bad notf type: $notfTypeInt")

    notfType match {
      case NotificationType.NewPostReviewTask |
           NotificationType.DirectReply | NotificationType.Mention | NotificationType.Message |
           NotificationType.NewPost | NotificationType.PostTagged =>
        Notification.NewPost(
          siteId = siteId,
          id = notfId,
          notfType = notfType,
          createdAt = createdAt,
          uniquePostId = uniquePostId,
          byUserId = byUserId,
          toUserId = toUserId,
          emailId = emailId,
          emailStatus = emailStatus,
          seenAt = seenAt)
    }
  }


  def getAnyUploadRef(rs: js.ResultSet, basePathColumn: String, hashPathSuffixColumn: String)
        : Option[UploadRef] = {
    val basePath = Option(rs.getString(basePathColumn))
    val hashPathSuffix = Option(rs.getString(hashPathSuffixColumn))
    if (basePath.isEmpty && hashPathSuffix.isEmpty) {
      None
    }
    else if (basePath.isDefined && hashPathSuffix.isDefined) {
      Some(UploadRef(basePath.get, hashPathSuffix.get))
    }
    else {
      die("EdE03WMY3")
    }
  }


  def getPagePathWithId(resultSet: js.ResultSet, pageId: Option[String] = None) =
    PagePathWithId(
      folder = resultSet.getString("parent_folder"),
      pageId = pageId getOrElse resultSet.getString("page_id"),
      showId = resultSet.getString("show_id") == "T",
      pageSlug = d2e(resultSet.getString("page_slug")),
      canonical = resultSet.getString("canonical") == "C")


  def _PagePath(resultSet: js.ResultSet, siteId: SiteId,
        pageId: Option[Option[String]] = None) =
    PagePath(
      siteId = siteId,
      folder = resultSet.getString("PARENT_FOLDER"),
      pageId = pageId getOrElse Some(resultSet.getString("PAGE_ID")),
      showId = resultSet.getString("SHOW_ID") == "T",
      pageSlug = d2e(resultSet.getString("PAGE_SLUG")))


  val _PageMetaSelectListItems = i"""
      |g.ext_imp_id,
      |g.version,
      |g.CREATED_AT,
      |g.UPDATED_AT,
      |g.PUBLISHED_AT,
      |g.BUMPED_AT,
      |g.LAST_REPLY_AT,
      |g.last_reply_by_id,
      |g.AUTHOR_ID,
      |g.frequent_poster_1_id,
      |g.frequent_poster_2_id,
      |g.frequent_poster_3_id,
      |g.layout,
      |g.PIN_ORDER,
      |g.PIN_WHERE,
      |g.PAGE_ROLE,
      |g.category_id,
      |g.EMBEDDING_PAGE_URL,
      |g.NUM_LIKES,
      |g.NUM_WRONGS,
      |g.NUM_BURY_VOTES,
      |g.NUM_UNWANTED_VOTES,
      |g.NUM_REPLIES_VISIBLE,
      |g.NUM_REPLIES_TOTAL,
      |g.num_posts_total,
      |g.NUM_OP_LIKE_VOTES,
      |g.NUM_OP_WRONG_VOTES,
      |g.NUM_OP_BURY_VOTES,
      |g.NUM_OP_UNWANTED_VOTES,
      |g.NUM_OP_REPLIES_VISIBLE,
      |g.answered_at,
      |g.ANSWER_POST_ID,
      |g.PLANNED_AT,
      |g.started_at,
      |g.DONE_AT,
      |g.CLOSED_AT,
      |g.LOCKED_AT,
      |g.FROZEN_AT,
      |g.hidden_at,
      |g.deleted_at,
      |g.html_tag_css_classes,
      |g.html_head_title,
      |g.html_head_description,
      |g.NUM_CHILD_PAGES
      |"""


  def _PageMeta(resultSet: js.ResultSet, pageId: String = null): PageMeta = {
    // We always write to bumped_at so order by queries work, but if in fact the page
    // hasn't been modified since it was created or published, it has not been bumped.
    var bumpedAt: Option[ju.Date] = Some(getDate(resultSet, "BUMPED_AT"))
    val createdAt = getDate(resultSet, "CREATED_AT")
    val publishedAt = getOptionalDate(resultSet, "PUBLISHED_AT")
    if (bumpedAt.get.getTime == createdAt.getTime ||
        publishedAt.exists(_.getTime == bumpedAt.get.getTime)) {
      bumpedAt = None
    }

    // 3 will do, don't need all 4.
    val frequentPoster1Id = getOptionalInt(resultSet, "frequent_poster_1_id")
    val frequentPoster2Id = getOptionalInt(resultSet, "frequent_poster_2_id")
    val frequentPoster3Id = getOptionalInt(resultSet, "frequent_poster_3_id")
    val frequentPosterIds = (frequentPoster1Id.toSeq ++ frequentPoster2Id.toSeq ++
      frequentPoster3Id.toSeq).to[immutable.Seq]

    PageMeta(
      pageId = if (pageId ne null) pageId else resultSet.getString("PAGE_ID"),
      extImpId = getOptString(resultSet, "ext_imp_id"),
      pageType = PageType.fromInt(resultSet.getInt("PAGE_ROLE")) getOrElse PageType.Discussion,
      version = resultSet.getInt("version"),
      categoryId = getOptionalIntNoneNot0(resultSet, "category_id"),
      embeddingPageUrl = Option(resultSet.getString("EMBEDDING_PAGE_URL")),
      createdAt = createdAt,
      updatedAt = getDate(resultSet, "UPDATED_AT"),
      publishedAt = publishedAt,
      bumpedAt = bumpedAt,
      lastApprovedReplyAt = getOptionalDate(resultSet, "LAST_REPLY_AT"),
      lastApprovedReplyById = getOptionalInt(resultSet, "last_reply_by_id"),
      authorId = resultSet.getInt("AUTHOR_ID"),
      frequentPosterIds = frequentPosterIds,
      layout = PageLayout.fromInt(resultSet.getInt("layout")) getOrElse PageLayout.Default,
      pinOrder = getOptionalIntNoneNot0(resultSet, "PIN_ORDER"),
      pinWhere = getOptionalIntNoneNot0(resultSet, "PIN_WHERE").map(int =>
        PinPageWhere.fromInt(int).getOrElse(PinPageWhere.InCategory)),
      numLikes = n20(resultSet.getInt("NUM_LIKES")),
      numWrongs = n20(resultSet.getInt("NUM_WRONGS")),
      numBurys = n20(resultSet.getInt("NUM_BURY_VOTES")),
      numUnwanteds = n20(resultSet.getInt("NUM_UNWANTED_VOTES")),
      numRepliesVisible = n20(resultSet.getInt("NUM_REPLIES_VISIBLE")),
      numRepliesTotal = n20(resultSet.getInt("NUM_REPLIES_TOTAL")),
      numPostsTotal = n20(resultSet.getInt("num_posts_total")),
      numOrigPostLikeVotes = resultSet.getInt("num_op_like_votes"),
      numOrigPostWrongVotes = resultSet.getInt("num_op_wrong_votes"),
      numOrigPostBuryVotes = resultSet.getInt("num_op_bury_votes"),
      numOrigPostUnwantedVotes = resultSet.getInt("num_op_unwanted_votes"),
      numOrigPostRepliesVisible = resultSet.getInt("num_op_replies_visible"),
      answeredAt = getOptionalDate(resultSet, "answered_at"),
      answerPostId = getOptionalIntNoneNot0(resultSet, "answer_post_id"),
      plannedAt = getOptionalDate(resultSet, "planned_at"),
      startedAt = getOptionalDate(resultSet, "started_at"),
      doneAt = getOptionalDate(resultSet, "done_at"),
      closedAt = getOptionalDate(resultSet, "closed_at"),
      lockedAt = getOptionalDate(resultSet, "locked_at"),
      frozenAt = getOptionalDate(resultSet, "frozen_at"),
      hiddenAt = getOptWhen(resultSet, "hidden_at"),
      deletedAt = getOptionalDate(resultSet, "deleted_at"),
      htmlTagCssClasses = getStringOrEmpty(resultSet, "html_tag_css_classes"),
      htmlHeadTitle = getStringOrEmpty(resultSet, "html_head_title"),
      htmlHeadDescription = getStringOrEmpty(resultSet, "html_head_description"),
      numChildPages = resultSet.getInt("NUM_CHILD_PAGES"))
  }


  def _toTenantHostRole(roleStr: String): Hostname.Role = roleStr match {
    case "C" => Hostname.RoleCanonical
    case "R" => Hostname.RoleRedirect
    case "L" => Hostname.RoleLink
    case "D" => Hostname.RoleDuplicate
  }


  def toDbMultireply(postNrs: Set[PostNr]) = {
    if (postNrs.isEmpty) NullVarchar
    else postNrs.mkString(",")
  }

  def fromDbMultireply(postNrsCommaSeparated: String): Set[PostNr] = {
    if (postNrsCommaSeparated == null) Set[PostNr]()
    else postNrsCommaSeparated.split(',').map(_.toInt).toSet
  }

  def _toPageStatus(pageStatusStr: String): PageStatus = pageStatusStr match {
    case "D" => PageStatus.Draft
    case "P" => PageStatus.Published
    case "X" => PageStatus.Deleted
    case x =>
      warnDbgDie("Bad page status: "+ safed(x) +" [error DwE0395k7]")
      PageStatus.Draft  // make it visible to admins only
  }

  def _toFlag(pageStatus: PageStatus): String = pageStatus match {
    case PageStatus.Draft => "D"
    case PageStatus.Published => "P"
    case PageStatus.Deleted => "X"
    case x =>
      warnDbgDie("Bad PageStatus: "+ safed(x) +" [error DwE5k2eI5]")
      "D"  // make it visible to admins only
  }


  def _toFlag(prefs: EmailNotfPrefs): AnyRef = prefs match {
    case EmailNotfPrefs.Unspecified => NullVarchar
    case EmailNotfPrefs.Receive => "R"
    case EmailNotfPrefs.DontReceive => "N"
    case EmailNotfPrefs.ForbiddenForever => "F"
    case x =>
      warnDbgDie("Bad EmailNotfPrefs value: "+ safed(x) +
          " [error DwE0EH43k8]")
      NullVarchar // fallback to Unspecified
  }


  def _toEmailNotfs(flag: String): EmailNotfPrefs = flag match {
    case null => EmailNotfPrefs.Unspecified
    case "R" => EmailNotfPrefs.Receive
    case "N" => EmailNotfPrefs.DontReceive
    case "F" => EmailNotfPrefs.ForbiddenForever
    case x =>
      warnDbgDie("Bad EMAIL_NOTFS: "+ safed(x) +" [error DwE6ie53k011]")
      EmailNotfPrefs.Unspecified
  }


  /**
   * Returns e.g.:
   * ( "(PARENT_FOLDER = ?) or (PARENT_FOLDER like ?)", List(/some/, /paths/) )
   */
  def _pageRangeToSql(pageRange: PathRanges, columnPrefix: String = "")
        : (String, List[String]) = {
    var sql = new StringBuilder
    var values = List[String]()

    for (folder <- pageRange.folders) {
      if (sql nonEmpty) sql append " or "
      sql.append("("+ columnPrefix + "PARENT_FOLDER = ?)")
      values ::= folder
    }

    for (folder <- pageRange.trees) {
      if (sql nonEmpty) sql append " or "
      sql.append("("+ columnPrefix + "PARENT_FOLDER like ?)")
      values ::= folder +"%"
    }

    (sql.toString, values)
  }


  def getCachedPageVersion(rs: js.ResultSet) = CachedPageVersion(
    siteVersion = rs.getInt("site_version"),
    pageVersion = rs.getInt("page_version"),
    appVersion = rs.getString("app_version"),
    renderParams = PageRenderParams(
      widthLayout = WidthLayout.fromInt(rs.getInt("width_layout")),
      isEmbedded = rs.getBoolean("is_embedded"),
      origin = rs.getString("origin"),
      anyCdnOrigin = getOptString(rs, "cdn_origin"),
      // Requests with custom page root or page query, aren't cached. [5V7ZTL2]
      anyPageRoot = None,
      anyPageQuery = None),
    reactStoreJsonHash = rs.getString("react_store_json_hash"))


  // COULD do this:
  /*
  From http://www.exampledepot.com/egs/java.sql/GetSqlWarnings.html:

    // Get warnings on Connection object
    SQLWarning warning = connection.getWarnings();
    while (warning != null) {
        // Process connection warning
        // For information on these values, see Handling a SQL Exception
        String message = warning.getMessage();
        String sqlState = warning.getSQLState();
        int errorCode = warning.getErrorCode();
        warning = warning.getNextWarning();
    }

    // After a statement has been used:
    // Get warnings on Statement object
    warning = stmt.getWarnings();
    if (warning != null) {
        // Process statement warnings...
    }

  From http://www.exampledepot.com/egs/java.sql/GetSqlException.html:

    try {
        // Execute SQL statements...
    } catch (SQLException e) {
        while (e != null) {
            // Retrieve a human-readable message identifying the reason
            // for the exception
            String message = e.getMessage();

            // This vendor-independent string contains a code that identifies
            // the reason for the exception.
            // The code follows the Open Group SQL conventions.
            String sqlState = e.getSQLState();

            // Retrieve a vendor-specific code identifying the reason for
            // the  exception.
            int errorCode = e.getErrorCode();

            // If it is necessary to execute code based on this error code,
            // you should ensure that the expected driver is being
            // used before using the error code.

            // Get driver name
            String driverName = connection.getMetaData().getDriverName();
            if (driverName.equals("Oracle JDBC Driver") && errorCode == 123) {
                // Process error...
            }

            // The exception may have been chained; process the next
            // chained exception
            e = e.getNextException();
        }
    }
   */
}

