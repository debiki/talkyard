/**
 * Copyright (C) 2014-2015 Kaj Magnus Lindberg (born 1979)
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

package ed.server.notf

import com.debiki.core.Prelude._
import com.debiki.core._
import debiki.{Nashorn, TextAndHtml}
import debiki.EdHttp.{throwForbidden, throwForbiddenIf}
import ed.server.notf.NotificationGenerator._
import scala.collection.{immutable, mutable}
import scala.util.matching.Regex


/** A user's notification settings for something more specific, e.g. for a specific page,
  * overrides more general notification settings, e.g. notification prefs for new topics
  * in a category.
  *
  * Example: A user gets notifications about every post in a category Bugs, because
  * hen is member of the Developers group. However hen mutes a topic The-Bug-Of-All-Bugs,
  * and this topic specific notf pref, overrides the group notf pref
  * — that is, hen won't get notified any more about The-Bug-Of-All-Bugs.
  */
sealed abstract class PageNotfSpecificity(val IntVal: Int) { def toInt: Int = IntVal }
object PageNotfSpecificity {
  case object Page extends PageNotfSpecificity(1)
  //case object CategoryAndTag extends NotfSpecificity(2)
  case object Category extends PageNotfSpecificity(3)
  //case object Tag extends NotfSpecificity(4)
  case object WholeSite extends PageNotfSpecificity(5)
  case object Default extends PageNotfSpecificity(6)
}



/** Finds out what notifications to send when e.g. a new post is created.
  * Also finds out what not-yet-sent notifications to delete if a post is deleted, or if
  * the post is edited and a @mention removed.
  */
case class NotificationGenerator(tx: SiteTransaction, nashorn: Nashorn, config: debiki.Config) {

  private var notfsToCreate = mutable.ArrayBuffer[Notification]()
  private var notfsToDelete = mutable.ArrayBuffer[NotificationToDelete]()
  private var sentToUserIds = new mutable.HashSet[UserId]()
  private var nextNotfId: Option[NotificationId] = None
  private var anyAuthor: Option[User] = None
  private def author: User = anyAuthor getOrDie "TyE5RK2WAG8"
  private def siteId = tx.siteId

  private def generatedNotifications =
    Notifications(
      toCreate = notfsToCreate.toSeq,
      toDelete = notfsToDelete.toSeq)


  def generateForNewPost(page: Page, newPost: Post, anyNewTextAndHtml: Option[TextAndHtml],
        skipMentions: Boolean = false): Notifications = {

    require(page.id == newPost.pageId, "TyE74KEW9")

    val approverId = newPost.approvedById getOrElse {
      // Don't generate notifications until later when the post gets approved and becomes visible.
      return Notifications.None
    }

    anyAuthor = Some(tx.loadTheUser(newPost.createdById))

    anyNewTextAndHtml foreach { textAndHtml =>
      require(newPost.approvedSource is textAndHtml.text,
        s"approvedSource: ${newPost.approvedSource}, textAndHtml.text: ${textAndHtml.text} [TyE3WASC2]")
      require(newPost.approvedHtmlSanitized is textAndHtml.safeHtml,
        s"appr.HtmlSan.: ${newPost.approvedHtmlSanitized}, safeHtml: ${textAndHtml.safeHtml} [TyE9FJB0]")
    }

    // Direct reply notification.
    for {
      replyingToPost <- newPost.parent(page.parts)
      if replyingToPost.createdById != newPost.createdById // not replying to oneself
      if approverId != replyingToPost.createdById // the approver has already read newPost
      replyingToUser <- tx.loadUser(replyingToPost.createdById)
    } {
      // (If the replying-to-post is by a group (currently cannot happen), and someone in the group
      // replies to that group, then hen might get a notf about hens own reply. Fine, not much to
      // do about that.)
      makeNewPostNotf(
          NotificationType.DirectReply, newPost, page.categoryId, replyingToUser,
          PageNotfSpecificity.Default)
    }

    // Later: Indirect rely notifications.
    NotfLevel.Normal // = notifies about replies in one's sub threads (not implemented)
    NotfLevel.Hushed // = notifies only about direct replies

    def notfCreatedAlreadyTo(userId: UserId) =
      generatedNotifications.toCreate.map(_.toUserId).contains(userId)

    lazy val pageMemberIds: Set[UserId] = tx.loadMessageMembers(newPost.pageId)

    // Mentions
    BUG // harmless. If a mention is removed, and added back, a new notf is sent. TyT2ABKS057
    // Probably don't want that?
    if (!skipMentions) {
      val mentionedUsernames = anyNewTextAndHtml.map(_.usernameMentions) getOrElse findMentions(
        newPost.approvedSource getOrDie "DwE82FK4", nashorn)

      var mentionedPeoples: Set[User] = mentionedUsernames.flatMap(tx.loadMemberOrGroupByUsername)

      // [MENTIONALIAS] can create more mention aliases, like @new-members (= trust levels new & basic),
      // and @guests and @here-now and @everyone (= all members)
      val allMentioned = mentionsAllInChannel(mentionedUsernames)
      if (allMentioned) {
        if (mayMentionGroups(author)) {
          // ((If user U is a page member, and also mentioned via group G,
          // then, removing G.id here, won't remove U from moreToAdd.
          // Instead, U is added to moreToAdd, and will be @channel mentioned,
          // instead of @group_name mentioned. Doesn't matter?))
          val moreToAdd: Set[UserId] = pageMemberIds -- mentionedPeoples.map(_.id)
          mentionedPeoples ++= tx.loadMembersAsMap(moreToAdd).values.toSet
        }
      }

      for {
        memberOrGroup <- mentionedPeoples
        // Right now ignore self-mentions. Later, allow? Could work like a personal to-do item?
        // Then would have to remove a db constraint. Could do later. Right now feels best
        // to keep it so it'll catch bugs.
        // If mentioning a group that one is a member of, one shouldn't and won't be notified (5ABKRW2).
        if memberOrGroup.id != newPost.createdById  // poster mentions him/herself?
        if !notfCreatedAlreadyTo(memberOrGroup.id)
      } {
        makeNewPostNotf(
            NotificationType.Mention, newPost, page.categoryId, memberOrGroup,
            PageNotfSpecificity.Default)
      }
    }

    // People watching this topic or category

    val minNotfLevel =
      if (newPost.isOrigPost) {
        // Everyone with a notf level for this page / category / whole-site, at or above
        // WatchingFirst, want to know about this.
        NotfLevel.WatchingFirst
        // Later: NotificationType = new topic
      }
      // Later:
      // else if is Answer, NotificationType.Solved ... or if is Progress,
      // NotificationType.Progress, post ... or status change ...
      // or if closed, NotificationType.TopicClosed
      // etc
      else {
        // Just an ordinary reply. Only people with this high notf level, want to know about it.
        NotfLevel.WatchingAll
      }

    var idsWatchingPage: Set[UserId] = tx.loadPeopleIdsWatchingPage(page.id, minNotfLevel)

    // Direct message? Notify everyone in the topic. For now, they're always watching.
    if (page.role == PageRole.FormalMessage) {
      idsWatchingPage ++= pageMemberIds
      // Later: change NotificationType to Message, mail envelope icon
    }

    val idsWatchingCat = page.categoryId.map(
      c => tx.loadPeopleIdsWatchingCategory(c, minNotfLevel)) getOrElse Set.empty

    val idsWatchingSite = tx.loadPeopleIdsWatchingWholeSite(minNotfLevel)

    val moreIds: Set[UserId] = idsWatchingPage ++ idsWatchingCat ++ idsWatchingSite

    for {
      peopleId <- moreIds
      if peopleId != newPost.createdById
      if !notfCreatedAlreadyTo(peopleId)
      userOrGroup <- tx.loadUser(peopleId)
    } {
      val specificity =
        if (idsWatchingPage contains peopleId) PageNotfSpecificity.Page
        else if (idsWatchingCat contains peopleId) PageNotfSpecificity.Category
        else if (idsWatchingSite contains peopleId) PageNotfSpecificity.WholeSite
        else die("TyE3@KABS05")
      makeNewPostNotf(
          NotificationType.NewPost, newPost, page.categoryId, userOrGroup,
          specificity, minNotfLevel)
    }

    // Later:
    // moreIdsViaTags ++= tx.loadPeopleIdsWatchingTagsMaybeInCategory(minNotfLevel, postTags, categoryId)
    //makeNewPostNotf(
    //  NotificationType.PostTagged, newPost, page.categoryId, userOrGroup)

    generatedNotifications
  }


  /*
  def generateForDeletedPost(page: Page, post: Post, skipMentions: Boolean): Notifications = {
    dieIf(!skipMentions, "EsE6YKG567", "Unimplemented: deleting mentions")
    anyAuthor = Some(tx.loadTheUser(post.createdById))
    Notifications(
      toDelete = Seq(NotificationToDelete.NewPostToDelete(tx.siteId, post.uniqueId)))
  }*/


  /** Private messages are sent to all toUserIds, but not to any user mentioned in the
    * message.
    */
  def generateForMessage(sender: User, pageBody: Post, toUserIds: Set[UserId])
        : Notifications = {
    unimplementedIf(pageBody.approvedById.isEmpty, "Unapproved private message? [EsE7MKB3]")
    anyAuthor = Some(tx.loadTheUser(pageBody.createdById))
    tx.loadUsers(toUserIds) foreach { user =>
      makeNewPostNotf(
          NotificationType.Message, pageBody, categoryId = None, user, PageNotfSpecificity.Default)
    }
    generatedNotifications
  }


  private def makeNewPostNotf(notfType: NotificationType, newPost: Post,
        categoryId: Option[CategoryId], toUserMaybeGroup: User,
        pageNotfSpecificity: PageNotfSpecificity,
        minNotfLevel: NotfLevel = NotfLevel.Hushed) {
    if (sentToUserIds.contains(toUserMaybeGroup.id))
      return

    if (toUserMaybeGroup.isGuest) {
      if (toUserMaybeGroup.emailNotfPrefs == EmailNotfPrefs.DontReceive ||
          toUserMaybeGroup.emailNotfPrefs == EmailNotfPrefs.ForbiddenForever ||
          toUserMaybeGroup.email.isEmpty) {
        return
      }
    }

    val (toUserIds: Set[UserId], moreExactNotfType) =
      if (!toUserMaybeGroup.isGroup) {
        (Set(toUserMaybeGroup.id), notfType)
      }
      else {
        val isMention = notfType == NotificationType.Mention
        val groupId = toUserMaybeGroup.id

        throwForbiddenIf(isMention && groupId == Group.EveryoneId,
          "TyEBDGRPMT01", s"May not mention ${toUserMaybeGroup.idSpaceName}")

        // Later, when there're custom groups, allow other ids (> AdminsId). [custom-groups]
        if (isMention) throwForbiddenIf(
          groupId < Group.EveryoneId || Group.AdminsId < groupId,
          "TyEBDGRPMT02", s"Weird group mention: ${toUserMaybeGroup.idSpaceName}")

        if (isMention && !mayMentionGroups(author)) {
          // For now, may still mention core members, staff and admins, so can ask how the site works.
          throwForbiddenIf(
            groupId < Group.CoreMembersId || Group.AdminsId < groupId,
              "TyEM0MNTNGRPS", s"You may not metion groups: ${toUserMaybeGroup.idSpaceName}")
        }

        // Generate a notf to the group, so will appear in its user profile.
        if (!sentToUserIds.contains(groupId)) {
          sentToUserIds += groupId
          notfsToCreate += Notification.NewPost(
            notfType,
            siteId = tx.siteId,
            id = bumpAndGetNextNotfId(),
            createdAt = newPost.createdAt,
            uniquePostId = newPost.id,
            byUserId = newPost.createdById,
            toUserId = groupId)
        }

        // Find ids of group members to notify, and excl the sender henself:  (5ABKRW2)

        var groupMembers = tx.loadGroupMembers(groupId).filter(_.id != newPost.createdById)

        dieIf(groupMembers.exists(_.isGuest), "TyE7ABK402")

        // If loading e.g. the AllMembers group, all higher trust level groups get loaded too,
        // because they're members of the AllMembers group, hmm, maybe shouldn't be?
        groupMembers = groupMembers.filterNot(_.isGroup)
        // Alternatively:
        /*
        groupMembers.find(_.isGroup).foreach(group =>
          throwForbidden("TyERECGRPMNT", o"""s$siteId: Notifications to groups in groups not implemented:
              user ${group.idSpaceName} is a group."""))
         */

        UX; COULD // add text: "@the_mention (not notified: too many people in group)"; throw no error.
        val maxMentions = config.maxGroupMentionNotfs
        throwForbiddenIf(isMention && groupMembers.size > maxMentions, "TyEMNYMBRS",
          s"${groupMembers.size} group members — but may not group-mention more than $maxMentions")

        val memberIds = groupMembers.map(_.id).toSet

        // UX SHOULD use a group notf type instead, it'll look a bit different: look less important.
        (memberIds, notfType)
      }

    for {
      toUserId <- toUserIds
      if toUserId >= User.LowestNormalMemberId
      if !sentToUserIds.contains(toUserId)
    } {
      // Generate notifications, regardless of email settings, so they can be shown in the user's inbox.
      // We won't send any *email* though, if the user has unsubscribed from such emails.

      //------------------------
      // Look at the user's notf level, and ancestor group notf levels,
      // and find out if the notf should really be sent, or if it's
      // muted / too-low-notf-level, somehow.

      // Hmm, this is more tricky than what it seems.
      // The most specific notf settings should be considered, and, tricky:
      // A group's notf level, is more specific, if it's for a particular page,
      // whilst a group member's setting is for the category or the whole site?
      // So need to know, if a group notf, is because of a page, category,
      // tag, or whole site PageNotfPref.

      // And if one mutes the whole site,
      // but a group one is in, EveryPost-subscribes to a topic,
      // then one will get notified? Because is every post, via group.
      // Or not? Because one muted the whole site.

      // Or maybe this could be a group priority?  > 0  = overrides a member's settings,
      // if the group's thing is more specific than the member's thing,
      // (e.g. group has notf pref for a page, but member for the whole site).
      // < 0, then the member's setting overrides the group settings, even if group is for the
      // more specific thing (e.g. grop notf pref = for page, member's = for site)
      // For now, as long as Muted works, all is probably mostly okay.

      // By default, group settings should override, if for more specific thing.
      // And one can leave the group, if don't want to be notified via the group. ?

      // For now.
      // Should also consider the type of notf: is it a direct message? (then send also
      // if >= Hushed) or a subthread indirect reply? (then send only if >= Normal).
      val notfLevels = tx.loadPageNotfLevels(toUserId, newPost.pageId, categoryId)
      val usersMoreSpecificLevel =
        // If this notification is being generated because the user, or a group it is in,
        // has configured notfs for every post, the whole site — but the user
        // has also configured a more specific and more silent notification level —
        // then don't notify.
        if (pageNotfSpecificity.toInt >= PageNotfSpecificity.WholeSite.toInt) {
          notfLevels.forPage.orElse(notfLevels.forCategory).orElse(notfLevels.forWholeSite)
        }
        // If this notification is because the user, or a group hen is in, has subscribed
        // to a category — but the user has configured a more specific and more silent
        // notification level henself, then don't notify.
        else if (pageNotfSpecificity.toInt >= PageNotfSpecificity.Category.toInt) {
          notfLevels.forPage.orElse(notfLevels.forCategory)
        }
        // If this notification is because a group the user is in, follows
        // a page, but the user has Hushed or Muted that page, then don't notify.
        else if (pageNotfSpecificity.toInt >= PageNotfSpecificity.Page.toInt) {
          notfLevels.forPage
        }
        else None
      val shallNotify = !usersMoreSpecificLevel.exists(_.toInt < minNotfLevel.toInt)
      //------------------------

      if (shallNotify) {
        sentToUserIds += toUserId
        notfsToCreate += Notification.NewPost(
          notfType,
          siteId = tx.siteId,
          id = bumpAndGetNextNotfId(),
          createdAt = newPost.createdAt,
          uniquePostId = newPost.id,
          byUserId = newPost.createdById,
          toUserId = toUserId)
      }
    }
  }


  /** Creates and deletes mentions, if '@username's are added/removed by this edit.
    */
  def generateForEdits(oldPost: Post, newPost: Post, anyNewTextAndHtml: Option[TextAndHtml])
        : Notifications = {

    BUG; SHOULD; REFACTOR // [5BKR03] Load users already mentioned — from the database, not
    // the old post text. Someone might have changed hens username, so looking at the old post text,
    // won't work. Then find current (after edits) people group mentioned, and mentioned directly.
    // Those mentioned directly now, but not before:
    //   Delete any previous group mentions. create direct mentions.
    //   (Repl group mentions, because direct mentions are (will be) shown with higher priority.)
    // Those mentioned directly now, and also before:
    //   Fine, needn't do anything.
    // Those group mentioned now:
    //   If mentioned directly, or group mentioned before: Fine, do nothing.
    //   Else, create a group mention.
    // Those no longer mentioned:
    //   Delete any old mention.

    require(oldPost.pagePostNr == newPost.pagePostNr, "TyE2WKA5LG")

    if (!newPost.isCurrentVersionApproved) {
      // Wait until the edits get approved and become visible.
      return Notifications.None
    }

    anyAuthor = Some(tx.loadTheUser(newPost.createdById))

    anyNewTextAndHtml foreach { textAndHtml =>
      require(newPost.approvedSource is textAndHtml.text,
        s"approvedSource: ${newPost.approvedSource}, textAndHtml.text: ${textAndHtml.text} [TyE4WKB7Z]")
      require(newPost.approvedHtmlSanitized is textAndHtml.safeHtml,
        s"appr.HtmlSan.: ${newPost.approvedHtmlSanitized}, safeHtml: ${textAndHtml.safeHtml} [TyE4WB78]")
    }

    val oldMentions: Set[String] = findMentions(oldPost.approvedSource getOrDie "TyE0YKW3", nashorn)
    val newMentions: Set[String] = anyNewTextAndHtml.map(_.usernameMentions) getOrElse findMentions(
        newPost.approvedSource getOrDie "DwE2BF81", nashorn)

    val deletedMentions = oldMentions -- newMentions
    val createdMentions = newMentions -- oldMentions

    var mentionsDeletedForUsers = deletedMentions.flatMap(tx.loadMemberOrGroupByUsername)
    var mentionsCreatedForUsers = createdMentions.flatMap(tx.loadMemberOrGroupByUsername)

    val newMentionsIncludesAll = mentionsAllInChannel(newMentions)
    val oldMentionsIncludesAll = mentionsAllInChannel(oldMentions)

    lazy val mayAddGroup =
      mayMentionGroups(author)

    val mentionsForAllCreated = newMentionsIncludesAll && !oldMentionsIncludesAll && mayAddGroup
    val mentionsForAllDeleted = oldMentionsIncludesAll && !newMentionsIncludesAll
    dieIf(mentionsForAllCreated && mentionsForAllDeleted, "EdE2WK4Q0")

    lazy val previouslyMentionedUserIds: Set[UserId] =
      tx.loadMentionsOfPeopleInPost(newPost.id).map(_.toUserId).toSet

    if (mentionsForAllDeleted) {
      // CLEAN_UP COULD simplify this whole function — needn't load mentionsDeletedForUsers above.
      val usersMentionedAfter = newMentions.flatMap(tx.loadMemberByPrimaryEmailOrUsername)
      val toDelete: Set[UserId] = previouslyMentionedUserIds -- usersMentionedAfter.map(_.id)
      // (COULD_OPTIMIZE: needn't load anything here — we have the user ids already.)
      mentionsDeletedForUsers = tx.loadMembersAsMap(toDelete).values.toSet
    }

    if (mentionsForAllCreated) {
      val pageMemberIds: Set[UserId] = tx.loadMessageMembers(newPost.pageId)
      mentionsDeletedForUsers = mentionsDeletedForUsers.filterNot(u => pageMemberIds.contains(u.id))
      BUG; REFACTOR // [5BKR03] in rare cases, people might get two notfs: if they're a page member,
      // and also if they're in a group that gets @group_mentioned now, when editing.
      val moreToAdd: Set[UserId] =
        pageMemberIds -- previouslyMentionedUserIds -- mentionsCreatedForUsers.map(_.id)
      mentionsCreatedForUsers ++= tx.loadMembersAsMap(moreToAdd).values.toSet
    }

    // Delete mentions.
    for (user <- mentionsDeletedForUsers) {
      notfsToDelete += NotificationToDelete.MentionToDelete(
        siteId = tx.siteId,
        uniquePostId = newPost.id,
        toUserId = user.id)
    }

    val pageMeta = tx.loadPageMeta(newPost.pageId)

    // Create mentions.
    for {
      user <- mentionsCreatedForUsers
      if user.id != newPost.createdById
    } {
      BUG // harmless. might mention people again, if previously mentioned directly,
      // and now again via a @group_mention. See REFACTOR above.
      makeNewPostNotf(
          NotificationType.Mention, newPost, categoryId = pageMeta.flatMap(_.categoryId), user,
          PageNotfSpecificity.Default)
    }

    generatedNotifications
  }


  def generateForTags(post: Post, tagsAdded: Set[TagLabel]): Notifications = {
    val userIdsWatching = tx.listUsersWatchingTags(tagsAdded)
    val userIdsNotified = tx.listUsersNotifiedAboutPost(post.id)
    val userIdsToNotify = userIdsWatching -- userIdsNotified
    val usersToNotify = tx.loadUsers(userIdsToNotify.to[immutable.Seq])
    val pageMeta = tx.loadPageMeta(post.pageId)
    anyAuthor = Some(tx.loadTheUser(post.createdById))
    for {
      user <- usersToNotify
      if user.id != post.createdById
    } {
      makeNewPostNotf(
          NotificationType.PostTagged, post, categoryId = pageMeta.flatMap(_.categoryId), user,
          PageNotfSpecificity.Default)
    }
    generatedNotifications
  }


  private def bumpAndGetNextNotfId(): NotificationId = {
    nextNotfId match {
      case None =>
        nextNotfId = Some(tx.nextNotificationId())
      case Some(id) =>
        nextNotfId = Some(id + 1)
    }
    nextNotfId getOrDie "EsE5GUY2"
  }

}


object NotificationGenerator {

  def mentionsAllInChannel(mentions: Set[String]): Boolean =
    mentions.contains("all") || mentions.contains("channel")


  def mayMentionGroups(user: User): Boolean = {
    user.isStaffOrMinTrustNotThreat(TrustLevel.BasicMember)
  }

  // Keep this regex in sync with mentions-markdown-it-plugin.js, the mentionsRegex [4LKBG782].
  // COULD replace [^a-zA-Z0-9_] with some Unicode regex for Unicode whitespace,
  // however apparently Java whitespace regex doesn't work:
  // https://stackoverflow.com/a/4731164/694469
  // — cannot deal with all Unicode whitespace. So just do [^a-z...] for now, so we for sure
  // allow *more* than the Js code. At least this should exclude email addresses.
  // (?s) makes '.' match newlines.
  private val MaybeMentionsRegex: Regex =
    "(?s)^(.*[^a-zA-Z0-9_])?@[a-zA-Z0-9_][a-zA-Z0-9_.-]*[a-zA-Z0-9].*".r  // [UNPUNCT]


  def findMentions(text: String, nashorn: Nashorn): Set[String] = {
    // Try to avoid rendering Commonmark source via Nashorn, if cannot possibly be any mentions:
    if (!MaybeMentionsRegex.matches(text))
      return Set.empty

    val result = nashorn.renderAndSanitizeCommonMark(
      text, pubSiteId = "dummy", allowClassIdDataAttrs = false, followLinks = false)

    result.mentions
  }

}
