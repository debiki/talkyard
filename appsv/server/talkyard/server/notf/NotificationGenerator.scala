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

package talkyard.server.notf

import com.debiki.core
import com.debiki.core.Prelude._
import com.debiki.core._
import debiki._
import debiki.Globals.isDevOrTest
import debiki.EdHttp.throwForbiddenIf
import talkyard.server.notf.NotificationGenerator._
import talkyard.server.rendr.NashornParams

import scala.collection.{immutable, mutable}
import scala.util.matching.Regex


case class PageNotfPrefAndWhy(
  why: St,
  notfPref: PageNotfPref,
) {
  def peopleId: UserId = notfPref.peopleId
  def notfLevel: NotfLevel = notfPref.notfLevel
  def pageId: Opt[PageId] = notfPref.pageId
  def pagesPatCreated: Bo = notfPref.pagesPatCreated
  def pagesPatRepliedTo: Bo = notfPref.pagesPatRepliedTo
  def pagesInCategoryId: Opt[CategoryId] = notfPref.pagesInCategoryId
  def wholeSite: Bo = notfPref.wholeSite
}



/** Finds out what notifications to send when e.g. a new post is created.
  * Also finds out what not-yet-sent notifications to delete if a post is deleted, or if
  * the post is edited and a @mention removed.
  */
case class NotificationGenerator(
  // This is a bit weird: getting both a tx and a dao. Maybe instead NotificationGenerator
  // should be part of the dao it too? — But needs a tx, so can run in the same tx
  // as SitePatcher and gen notfs for changes it did (in the same tx).
  tx: SiteTransaction,
  dao: debiki.dao.SiteDao,
  nashorn: Nashorn,
  config: debiki.Config) extends talkyard.server.TyLogging {

  dieIf(Globals.isDevOrTest && tx.siteId != dao.siteId, "TyE603RSKHAN3")

  private val notfsToCreate = mutable.ArrayBuffer[Notification]()
  private val notfsToDelete = mutable.ArrayBuffer[NotificationToDelete]()

  BUG // currently harmless. Should remember sent-to by post id too — in case [REMBSENTTO]
  // needs to generate many notfs to the same user, for different posts.
  //
  // Remembers what true ids we've generated notifications to — so no one gets
  // double notifications: one to any alias of theirs, and another to themselves
  // (if they've subscribed to a page as themselves, and commented anonymously
  // on that page, for example).
  private val sentToTrueIds = new mutable.HashSet[UserId]()

  // One post can trigger more than one notification to the same person,
  // e.g. a staff user getting notified first about a new post to moderate,
  // and thereafter, once it's been approved, if the post was, say, a reply
  // to that staff user henself, then hen will get a reply notification too.
  // However, this should not generate more than one email — because after
  // having reviewed the post, the staff user has read it already.
  //
  // But it's good to generate a reply notf to the staff user (and not only
  // a mod task notf), so the post appears in hens notification list, in case
  // hen wants to find it again some time later (since it was a reply to hen).
  //
  private val avoidDuplEmailsToTrueIds = new mutable.HashSet[UserId]()

  private var nextNotfId: Option[NotificationId] = None

  REFACTOR // Pass to the constructor? Probably the doer is always known by
  // the caller — the caller has done access control, and would have
  // loaded both the doer and any true doer  (if the doer is an alias)?  [notf_pass_doer]
  //
  RENAME // to anyDoer and theDoer? — Not just authoring new posts, but also
  // editing old,  assigning sbd to a task,  mentioning sbd, adding to private chat,
  // promoting/demoting — so, "author" not always correct, "doer" better?
  //
  // Might be an alias (anonym or pseudonym).
  private var anyAuthor: Option[Participant] = None
  private def author: Participant = anyAuthor getOrDie "TyE5RK2WAG8"

  // The true user behind any anonym or pseudonym.  Pass to ctor too?
  //private val anyTrueDoer: Opt[Pat] = None
  //private def trueDoer: Pat = anyTrueDoer getOrDie "TyE0TRUEEDTR"

  private def siteId = tx.siteId
  override def anySiteId = Some(tx.siteId)
  private lazy val site: SiteIdHostnames = dao.theSite()

  def generatedNotifications: Notifications =
    Notifications(
      toCreate = notfsToCreate.toVector,
      toDelete = notfsToDelete.toVector)

  /**
    * @param page — ANNOYING, BUG risk: Should this PageDao include newPost, or not?
    *   Currently sometimes does, sometimes doesn't — different callers do it
    *   differently. [notf_new_post_dao]
    * @param newPost
    * @param sourceAndHtml
    * @param anyNewModTask
    * @param doingModTasks
    * @param skipMentions
    * @param postAuthor — If this is a new anonym's first post, the db tx inserting the anonym,
    *    is still ongoing — then, it's good to get the author.
    * @return
    */
  def generateForNewPost(page: Page, newPost: Post, sourceAndHtml: Opt[SourceAndHtml],
        anyNewModTask: Opt[ModTask], doingModTasks: Seq[ModTask] = Nil,
        skipMentions: Bo = false,
        postAuthor: Opt[Pat] = None, trueAuthor: Opt[Pat] = None): Notifications = {

    require(page.id == newPost.pageId, "TyE74KEW9")
    require(anyNewModTask.isEmpty || doingModTasks.isEmpty, "TyE056KWH5")
    require(postAuthor.forall(_.id == newPost.createdById),
          o"""s$siteId: Wrong postAuthor id: ${postAuthor.map(_.id)}, but
          newPost.createdById is ${newPost.createdById}) [TyEAUTID69256]""")
    _abortIfBadPost(newPost)

    if (newPost.isTitle)
      return generatedNotifications  // [no_title_notfs]

    val anyNewTextAndHtml: Option[TextAndHtml] = sourceAndHtml.map({
      case t: TextAndHtml => t
      case _ =>
        dieIf(Globals.isDevOrTest, "TyE305KTUDP3", "Got a TitleSourceAndHtml")
        return generatedNotifications
    })

    val theAuthor = postAuthor getOrElse tx.loadTheParticipant(newPost.createdById)
    anyAuthor = Some(theAuthor)

    if (core.isDevOrTest) postAuthor foreach { postAuthorArg =>
      val postAuthorInDb = tx.loadTheParticipant(newPost.createdById)
      dieIf(postAuthorArg != postAuthorInDb, "TyEAUTHORARGTX", o"""
           postAuthorArg: $postAuthorArg  !=  postAuthorInDb: $postAuthorInDb""")
    }

    // A new embedded discussions page shouldn't generate a notification, [new_emb_pg_notf]
    // because those pages are lazy auto created – and uninteresting event.
    // Instead, *the first reply* generates a new page notification.
    // (Embedded pages are also auto-created e.g. if there's a Like vote — maybe
    // there'll never be any reply.)
    if (page.meta.pageType == PageType.EmbeddedComments && newPost.isOrigPost)
      return generatedNotifications

    if (anyNewModTask.isDefined) {
      COULD // Move this to a new fn  generateForReviewTask()  instead? [revw_task_notfs]

      // Generate notifications to staff members, so they can review this post. Don't
      // notify others until later, when the post has been approved and is visible.

      val staffUsers: Seq[User] = tx.loadStaffUsers()
      for (staffUser <- staffUsers) {
        _genOneNotfMaybe(
              NotificationType.NewPostReviewTask,
              to = staffUser,
              from = theAuthor,
              about = newPost,
              isAboutModTask = true)
      }
    }

    val approverId = newPost.approvedById getOrElse {
      // This post hasn't yet been approved and isn't visible. Don't notify people
      // until later, when staff has reviewed it and made it visible.
      // We've notified staff already, above, so they can take a look.
      dieIf(anyNewModTask.isEmpty, "TyE0REVTSK")  // [703RK2]
      return generatedNotifications
    }

    val theApprover = tx.loadParticipant(approverId) getOrElse {
      bugWarn("TyENTF0APRVR", s"Approver $approverId missing")
      return generatedNotifications
    }

    // Approving comments anonymously or using a pseudonym, isn't supported. [approver_0_alias]
    bugWarnIf(theApprover.isAlias,
          "TyEAPRISALI", s"s${siteId}: Approver $approverId is an alias")

    // Don't send emails twice to the staff — they've gotten a post-to-review notf already about
    // this post (see above). Do however create notfs — it's nice to have any notification
    // about e.g. a @mention of oneself, in the mentions list, also if one approved
    // that post, oneself.
    val oldNotfsToStaff = tx.loadNotificationsAboutPost(
          newPost.id, NotificationType.NewPostReviewTask)
    avoidDuplEmailsToTrueIds ++= oldNotfsToStaff.map(n => n.toTrueId getOrElse n.toUserId)

    anyNewTextAndHtml foreach { textAndHtml =>
      require(newPost.approvedSource is textAndHtml.text,
        s"approvedSource: ${newPost.approvedSource}, textAndHtml.text: ${textAndHtml.text} [TyE3WASC2]")
      require(newPost.approvedHtmlSanitized is textAndHtml.safeHtml,
        s"appr.HtmlSan.: ${newPost.approvedHtmlSanitized}, safeHtml: ${textAndHtml.safeHtml} [TyE9FJB0]")
    }

    val ancestorsParentFirst = page.parts.ancestorsParentFirstOf(newPost)
    val anyParentPost = ancestorsParentFirst.headOption
    dieIf(isDevOrTest && anyParentPost != page.parts.parentOf(newPost), "TyE395RSKT")

    // For direct and indirect reply notifications.
    def maybeGenReplyNotf(notfType: NotificationType, ancestorsCloseFirst: Seq[Post])
          : Unit = {
      for {
        replyingToPost <- ancestorsCloseFirst

        // Not replying to oneself
        if replyingToPost.createdById != theAuthor.id

        // 1/2: The approver has already read newPost. So if the author-of-the-replyingToPost
        // is the same as the approver (of newPost), then, skip that author.
        // UX BUG?:  Wouldn't it be nice to have a reply notificatoin link, in one's
        // list of notifications, also if one is a moderator?   [do_notify_mod]
        // So, proceed also if same? (2/2 below too?)  But don't send two emails to such
        // a mod, though (about the same reply).
        if replyingToPost.createdById != theApprover.id

        // COULD_OPTIMIZE: Load authors of all ancestor posts in one query (possibly
        // filtered by not-author-id, not notifying oneself).
        replyingToUser <- tx.loadParticipant(replyingToPost.createdById)

        // 2/2: If the author-of-the-replyingToPost is an alias, compare with the true user too.
        // (Could skip the first `if` (1/2) above?)
        // (The approver can't be an alias, so can compare with `id`. [approver_0_alias])
        if replyingToUser.trueId2.trueId != theApprover.id
      } {
        // (If the replying-to-post is by a group (currently cannot happen), and someone in the group
        // replies to that group, then hen might get a notf about hens own reply. Fine, not much to
        // do about that.)
        _makeAboutPostNotfs(
              notfType, about = newPost, inCategoryId = page.categoryId, replyingToUser,
              sentFrom = theAuthor)
      }
    }

    // Direct replies.
    // These notifications have highest precedence. Let's say there's a direct reply,
    // which also @mentions the one it replies to — then we'll generate a direct
    // reply notf only, no @mention notf.
    maybeGenReplyNotf(NotificationType.DirectReply, anyParentPost.toSeq)

    val pageMemberIds: Set[UserId] = tx.loadMessageMembers(newPost.pageId)

    // Mentions
    BUG // harmless. If a mention is removed, and added back, a new notf is sent. TyT2ABKS057
    // Probably don't want that?
    if (!skipMentions) {
      val mentionedUsernames: Set[Username] =
            anyNewTextAndHtml.map(_.usernameMentions) getOrElse findMentions(  // [nashorn_in_tx] [save_post_lns_mentions]
                newPost.approvedSource getOrDie "DwE82FK4", site, nashorn)

      var mentionedMembers: Set[MemberVb] =
            tx.loadMembersVbByUsername(mentionedUsernames).toSet

      // Can create more mention aliases, like @new-members (= trust levels new & basic only),
      // and @guests and @here-now and @everyone (= all members)
      val allMentioned = mentionsAllInChannel(mentionedUsernames)
      if (allMentioned) {
        if (mayMentionGroups(author)) {  // [who_may_mention_all]
          // Notify all page members including members of [groups that are page members],
          // except for anyone who is also mentioned directly via hens @username — hen
          // will be @username-mentioned only.
          // ((If user U is a page member, and also mentioned via group G,
          // that is, U is mentioned indirectly both via '@all' and via '@group_name',
          // then, removing G.id here, won't remove U from moreIds.
          // Instead, U is added to moreIds, and will be @channel mentioned,
          // instead of @group_name mentioned. Doesn't matter?))
          val moreIds: Set[UserId] = pageMemberIds -- mentionedMembers.map(_.id)
          val moreMentions: ImmSeq[MemberVb] = tx.loadMembersVbById(moreIds)
          mentionedMembers ++= moreMentions
        }
      }

      for {
        userOrGroup: MembVb <- mentionedMembers
        // Ignore self-mentions. Maybe could allow, to create a personal to-do item? But
        // probably it's better to use bookmarks, for that? (Adding a to-do bookmark.)
        // If mentioning a group that one is a member of, one shouldn't and won't be notified (5ABKRW2).
        if userOrGroup.id != theAuthor.id  // poster mentions henself?
        if !sentToTrueIds.contains(userOrGroup.trueId2.trueId)
        // Authz checks that we won't notify people outside a private chat
        // about any mentions (because they cannot see the chat). [PRIVCHATNOTFS]
      } {
        _makeAboutPostNotfs(
              NotificationType.Mention,
              about = newPost,
              inCategoryId = page.categoryId,
              sendTo = userOrGroup,
              sentFrom = author)
      }
    }

    // Indirect replies.
    // If the post @mentions some of those indirectly replied to, then we've won't
    // generate any indirect reply notfs to them — they'll get a Mention
    // notf only (generated above).
    maybeGenReplyNotf(
          NotificationType.IndirectReply, ancestorsParentFirst drop 1)

    // People watching this topic or category
    _genWatchingSomethingNotfs(
          NotfType.NewPost, page.meta, about = newPost, pageMemberIds, sentFrom = author)

    generatedNotifications
  }


  // COULD_OPTIMIZE: Use just a PageMeta, .no_PageDao.
  private def _genWatchingSomethingNotfs(notfType: NotfType, pageMeta: PageMeta,
          about: Post, pageMemberIds: Set[UserId], sentFrom: Pat): U = {

    _abortIfBadPost(about)

    val newPost = about

    val isEmbDiscFirstReply =
          notfType.isAboutNewApprovedPost &&
          pageMeta.pageType == PageType.EmbeddedComments &&
          newPost.isOrigPostReply && newPost.isVisible &&
          // Currently, pageMeta doesn't take `newPost` into account.  [notf_new_post_dao]
          // So, if num visible is 0, `newPost` is the first visible reply
          // (and pageMeta will soon be updated in the database).
          // (There might be other earlier replies but if so, they haven't yet been
          // approved or sth like that.)
          pageMeta.numRepliesVisible == 0  // then `newPost` is the first

    val minNotfLevel =
      if (isEmbDiscFirstReply) {
        // This is the first reply in an auto-created embedded discussion — time
        // to create the new page notification.  [new_emb_pg_notf]
        // (We didn't do that when the page got lazy-auto-created — that could have
        // been just someone configuring page notf prefs; then, a page id is needed,
        // but we don't want to get notified about that.)
        NotfLevel.WatchingFirst
      }
      else if (newPost.isOrigPost) {
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

    // Page or category subscriptions.
    //
    // Notf prefs for more specific things, content structure wise, have precedence.
    // So, we first look at all notf settings for specific pages, and generate (or skip) notfs,
    // as specified by those page specific notf prefs. And then, we look at categories,
    // and generate notifications, as specified by the for-pages-in-this-category notf prefs.
    // Then (not impl) tags. And lastly, whole site notf prefs settings.
    // (Categories are more specific than tags? Because a page can be in only one category,
    // but it can have many tags. So, tags are more promiscuous, less specific.)
    //
    // Within the same content structure level, a user's own prefs, has precedence, over
    // preferences for groups hen is a member of. If, however,
    // hen hasn't configured any prefs, then the most talkative/chatty pref, of all groups hen
    // is in, wins. [CHATTYPREFS]  Rationale: This is discussion software, so when in doubt,
    // better notify people that a discussion is going on. Talking is ... sort of the whole point?
    // Also, one can just mute the topic or category. Or leave the group with too "noisy" settings.
    // If, however, the most *silent* setting "won", so *no* notfs were sent, then one wouldn't
    // have the chance to realize that there're conflicting notf prefs (because one didn't
    // get any notfs).

    val memberIdsHandled = mutable.HashSet[UserId]()

    def addWhy(notfPrefs: Seq[PageNotfPref], why: St): Seq[PageNotfPrefAndWhy] =
          notfPrefs.map(PageNotfPrefAndWhy(why, _))


    // ----- Page subscribers

    val notfPrefsOnPage = addWhy(
          tx.loadPageNotfPrefsOnPage(pageMeta.pageId),
          why = "You have subscribed to this topic")

    // ----- Page members

    // Add default NotfLevel.WatchingAll for private topic members [PRIVCHATNOTFS]
    // — unless they've configured another notf pref.
    // (This wouldn't be needed if [page_pps_t] instead.)
    val privTopicPrefsOnPage: Set[PageNotfPrefAndWhy] =
      if (!pageMeta.pageType.isPrivateGroupTalk) Set.empty
      else pageMemberIds flatMap { id: UserId =>
        if (notfPrefsOnPage.exists(_.peopleId == id)) None  // [On2]
        else Some(PageNotfPrefAndWhy(
                why = "You're a member of this topic",
                PageNotfPref(
                      peopleId = id,
                      NotfLevel.WatchingAll,
                      pageId = Some(pageMeta.pageId))))
      }

    // ----- Page repliers

    // Tests:  notf-prefs-pages-replied-to.2br  TyTE2E402SM53

    // People who have replied on the page, can get notifications about subsequent
    // replies by others, anywhere on that page.

    // If the default notf pref for pages one has replied to, is >= minNotfLevel,
    // and one hasn't configured the notf level for this specific page,
    // then add a PageNotfPref so this poster gets notified.
    //
    val pageRepliersPrefsOnPage: Set[PageNotfPrefAndWhy] = {  // [interact_notf_pref]
      if (pageMeta.pageType.isChat) {
        // Chats tend to be chatty? Maybe better let the pages_pat_replied_to_c
        // setting skip chats. And not impossible it'd be bad for performance
        // to notify / email hundreds of people in a chat "all the time"?
        Set.empty
      }
      else {
        val repliers: Seq[User] = tx.loadPageRepliers(newPost.pageId, usersOnly = true)
        repliers flatMap { replier: User =>
          COULD_OPTIMIZE // load this for all repliers in just one db request.
          val replierAndGroupIds = tx.loadGroupIdsMemberIdFirst(replier)

          val ownPageNotfPref = notfPrefsOnPage.find(_.peopleId == replier.id) // [On2]
          if (ownPageNotfPref.isDefined) {
            // The replier has manually configured the notf level for this page
            // — then, ignore any interacted-with default notf pref.
            None
          }
          else {
            COULD_OPTIMIZE // load this in just one request, not one per replier.
            val replToPrefs = tx.loadNotfPrefsAboutPagesRepliedTo(replierAndGroupIds)

            val (ownPrefs, groupPrefs) = replToPrefs.partition(_.peopleId == replier.id)
            val anyPref: Opt[PageNotfPref] =
                  ownPrefs.find({ prf =>
                    // This (the user's own prefs) overrides any group notf prefs.
                    prf.pagesPatRepliedTo
                  }).orElse {
                    groupPrefs.find({ prf =>
                      prf.pagesPatRepliedTo && prf.notfLevel.toInt >= minNotfLevel.toInt
                    })
                  }
            anyPref.filter(_.notfLevel.toInt >= minNotfLevel.toInt)
                  .map(notfPref =>
                        PageNotfPrefAndWhy(
                          why = "You have replied in this topic",
                          PageNotfPref(
                              peopleId = replier.id,
                              notfLevel = notfPref.notfLevel,
                              pageId = Some(pageMeta.pageId))))
          }
        }
      }.toSet
    }

    val allPrefsOnPage =
          notfPrefsOnPage ++
          privTopicPrefsOnPage ++
          pageRepliersPrefsOnPage

    val wantSilencePatIds = MutHashSet[PatId]()

    _makePostSubscrNotfFor(
          allPrefsOnPage, notfType, newPost, isEmbDiscFirstReply, minNotfLevel,
          memberIdsHandled, wantSilencePatIds,
          sentFrom = sentFrom)

    // If private page, skip cat & whole site notf prefs
    // — only page members and people (like moderators) who explicitly follow
    // this page, get notified. — So, forum admins won't get notified about
    // new private group chats for example (unless they get added).
    if (pageMeta.pageType.isPrivateGroupTalk)
      return ()

    // ----- Ancestor categories [subcats]

    val ancCats = tx.loadCategoryPathRootLast(pageMeta.categoryId, inclSelfFirst = true)
    for (ancCat <- ancCats ; if !ancCat.isRoot) {
      val notfPrefsOnCategory: Seq[PageNotfPref] = tx.loadPageNotfPrefsOnCategory(ancCat.id)
      _makePostSubscrNotfFor(
            addWhy(notfPrefsOnCategory,
                  s"You're subscribed to category '${ancCat.name}'"),
            notfType, newPost, isEmbDiscFirstReply, minNotfLevel, memberIdsHandled,
            wantSilencePatIds,
            sentFrom = sentFrom)
    }

    // ----- Tags

    // notPrefsOnTags = ... (later)
    //_makePostSubscrNotfFor(
    //     addWhy(notPrefsOnTags, "why"),
    //     NotfType.PostTagged — no? just notfType insead?, newPost, isEmbCommFirstReply,
    //     // Categories are more specific than tags, so if a category is muted,
    //     // then, still don't gen any notfs because of subscribed to any tag.
    //     wantSilencePatIds, ...)

    // ----- Whole site

    val notfPrefsOnSite = tx.loadPageNotfPrefsOnSite()
    _makePostSubscrNotfFor(
          addWhy(notfPrefsOnSite, "You've subscribed to the whole site"),
          notfType, newPost, isEmbDiscFirstReply, minNotfLevel, memberIdsHandled,
          wantSilencePatIds,
          sentFrom = sentFrom)
  }


  /*
  def generateForDeletedPost(deleter: Pat, page: Page, post: Post, skipMentions: Bo)
          : Notifications = {
    dieIf(!skipMentions, "EsE6YKG567", "Unimplemented: deleting mentions")
    anyAuthor = Some(tx.loadTheUser(post.createdById))
    Notifications(
      toDelete = Seq(NotificationToDelete.NewPostToDelete(tx.siteId, post.uniqueId)))
  }*/


  /** Direct messages are sent to all toUserIds, but not to any user mentioned in the
    * message.
    */
  def generateForMessage(sender: Pat, pageBody: Post, toUserIds: Set[UserId])
        : Notifications = {

    warnDevDieIf(sender.id != pageBody.createdById, "TyESENDR0AUTR", o"""Priv msg sender
          != pageBody author: sender.trueId2: ${sender.trueId2},
          pageBody.createdById: ${pageBody.createdById}""")

    unimplementedIf(pageBody.approvedById.isEmpty, "Unapproved private message? [EsE7MKB3]")

    anyAuthor = Some(sender)

    val patIdsToLoad = toUserIds.filter(id =>
          // Quick check 1 — normally enough (most forums don't have
          // many anonyms or pseudonyms).
          id != sender.id)
          // Quick check 2: If the sender is an anonym, but the recipient is not.
          // id != sender.trueId2.trueId)
    val patsToMaybeNotify = tx.loadParticipants(patIdsToLoad)
    patsToMaybeNotify foreach { user =>
      _makeAboutPostNotfs(
            // But what if is 2 ppl chat?  [private_chats]  Then would want to incl the 1st
            // message instead?  The Orig Post is just an auto gen "this is a chat"?
            NotificationType.Message, about = pageBody, inCategoryId = None, sendTo = user,
                    sentFrom = sender)
    }
    generatedNotifications
  }


  private def _makeAboutPostNotfs(
        notfType: NotificationType,
        about: Post,
        inCategoryId: Opt[CatId],
        sendTo: Pat,
        sentFrom: Pat,
        minNotfLevel: NotfLevel = NotfLevel.Hushed): Unit = {

    val aboutPost = about

    // Don't gen notfs e.g. if sbd assigns a task to themself,  [notfs_trueid_check]
    // or if someone replies to their own alias.
    if (sentFrom.trueId2.trueId == sendTo.trueId2.trueId) {
      avoidDuplEmailsToTrueIds += sendTo.trueId2.trueId
      return
    }

    // legacy variable names CLEAN_UP but not now
    val toUserMaybeGroup = sendTo
    val toTruePat = sendTo match {
      case a: Anonym =>
        tx.loadParticipant(a.anonForPatId) getOrElse {
          bugWarn("TyE0TRUE037", s"True user gone? Anon: $a")
          return
        }
      case o => o
    }

    if (sentToTrueIds.contains(toUserMaybeGroup.trueId2.trueId))
      return

    if (toUserMaybeGroup.isGuest) {
      if (toUserMaybeGroup.emailNotfPrefs == EmailNotfPrefs.DontReceive ||
          toUserMaybeGroup.emailNotfPrefs == EmailNotfPrefs.ForbiddenForever ||
          toUserMaybeGroup.email.isEmpty) {
        return
      }
    }

    val isMention = notfType == NotificationType.Mention
    val isDirMsg = notfType == NotificationType.Message

    // [filter_mentions] Could be better to do this when saving a post, so that the author
    // will know for sure that the people hen could mention when composing the post,
    // will get mentioned. But the way things work now, if a mentioned person changes hens
    // priv prefs before the post gets approved, then, the mention might get removed here.
    //
    // Better [not_use_true_users] to not leak one's identity?
    //
    if (isMention && !author.mayMention(toUserMaybeGroup))
      return

    // [filter_dms]
    // Better [not_use_true_users] to not leak one's identity?
    if (isDirMsg && !author.mayMessage(toUserMaybeGroup)) {
      bugWarn("TyEBADMSG39546", s"Message sent although wasn't allowed to? From: ${
            author.trueId2}, to: ${toUserMaybeGroup.trueId2}.")
      return
    }

    // (What about may-Notify-About-Votes? Might anyone ever want to suppress Like vote
    // notifications but only from certain people or groups?  Let's wait. I guess a
    // bach-vote-notfs setting is enough almost always, more granular settings not needed.)

    // Access control.
    // Sync w [2069RSK25]. Test: [2069RSK25-A]
    // (If this is a group and it may not see the post, then don't generate any
    // notfs on behalf of this group, even if there're individual group *members*
    // who may see the post (because of other groups they're in). [5AKTG7374])
    //
    // If toUserMaybeGroup is a pseudonym, can be better to [not_use_true_users],
    // so as not to let the new post author guess who the recipient is, based on
    // whether or not they could read the message?
    // But this depends! [pseudonym_types] [pseudonyms_later]
    //
    // However if toUserMaybeGroup is an *anonym*, then, since anons are per page,
    // it's fine to use the access permissions of the underlying true user.
    //
    val (maySeePost, whyNot) = dao.maySeePost(
          aboutPost, Some(toTruePat), maySeeUnlistedPages = true)(tx)
    if (!maySeePost.may)
      return

    val (toPats: Vec[Pat], moreExactNotfType) =
      if (!toUserMaybeGroup.isGroup) {
        (Vec(toUserMaybeGroup), notfType)
      }
      else {
        // Is a group mention / a reply to a post by a group.

        val toGroup = toUserMaybeGroup
        val groupId = toGroup.id

        throwForbiddenIf(isMention && groupId == Group.EveryoneId,
          "TyEBDGRPMT01", s"May not mention ${toGroup.idSpaceName}")

        CLEAN_UP; REMOVE // this later? There's another check above [filter_mentions].
        if (isMention && !mayMentionGroups(author)) {
          // For now, may still mention core members, staff and admins, so can ask how the site works.
          throwForbiddenIf(
            groupId < Group.CoreMembersId || Group.AdminsId < groupId,
              "TyEM0MNTNGRPS", s"You may not mention groups: ${toGroup.idSpaceName}")
        }

        // Generate a notf to the group, so will appear in its user profile.
        _genOneNotfMaybe(
              notfType,
              to = toGroup,
              from = sentFrom,
              about = aboutPost)

        // Find ids of group members to notify, and excl the sender henself:  (5ABKRW2)

        var groupMembers = tx.loadGroupMembers(groupId).filter(m => m.id != sentFrom.id)

        // Only users, pseudonyms and groups can be gruop members.
        dieIf(groupMembers.exists(_.isGuestOrAnon), "TyE7ABK402")

        // If loading e.g. the AllMembers group, all higher trust level groups get loaded too,
        // because they're members of the AllMembers group. But later, if [sub_groups] supported,
        // then, recursively expand any group tree?
        groupMembers = groupMembers.filter(!_.isGroup)
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

        // Could filter away group members who the author may not mention,
        // here instead?  [.move_may]

        // UX SHOULD use a group notf type instead, it'll look a bit different: look less important.
        (groupMembers, notfType)
      }

    for {
      toPat <- toPats
      toUserId = toPat.id
      // Later: Could recursively expand [sub_groups], notify everyone in a "group tree".
      if toUserId <= Pat.MaxGuestOrAnonId || Pat.LowestNormalMemberId <= toUserId
      if !sentToTrueIds.contains(toPat.trueId2.trueId)

      // Move these may-mention and may-message tests to the  toUserMaybeGroup.isGroup
      // if branch above? No need to be done here again if is not-a-group? [.move_may]
      // -------
      // Maybe better [not_use_true_users], so can't guess who is who depending
      // on if you can mention them or not.
      // (If sendTo is a group, and author may mention that group, but author may not
      // mention group member toPat, then what? For now, skip such mentions.
      // Maybe depends: sometimes, if pat is an overworked admin, hen wants no notification.
      // But maybe if hen is in a Support group, then, hen might want to get notified
      // — but maybe only via the group, might not want to get mentioned individually.
      // Later, this could be a per user and group setting. [inherit_group_priv_prefs])
      if !isMention || author.mayMention(toPat) // [filter_mentions] here too
      if !isDirMsg || author.mayMessage(toPat)  // [filter_dms]
      // -------
    } {
      // Generate notifications, regardless of email settings, so shown in the user's inbox.
      // We won't send any *email* though, if the user has unsubscribed from such emails.

      // Look at the user's notf level, to find out if hen has muted notifications,
      // on the current page / category / whole site.
      BUG; SHOULD // also consider ancestor group notf levels — maybe a group hen is in,
      // has muted the topic? Then, should generate no notf (unless the user henself has
      // un-muted the topic).
      // Or the user has muted the category, but a group hen is in, has unmuted this topic?
      // (Then, since topics are more specific, structure wise, we should generate a notf.)

      COULD; NotfLevel.Hushed // Also consider the type of notf: is it a direct message? Then send
      // if >= Hushed. If is a subthread indirect reply? Then don't send if == Hushed.

      BUG // Pretty harmless: Shouldn't we look at true id? [pub_or_true_id_notf_prefs]
      val notfLevels = tx.loadPageNotfLevels(toUserId, aboutPost.pageId, inCategoryId)
      val usersMoreSpecificLevel =
        notfLevels.forPage.orElse(notfLevels.forCategory).orElse(notfLevels.forWholeSite)
      val skipBecauseMuted = usersMoreSpecificLevel is NotfLevel.Muted
      val skipBecauseHushed = (usersMoreSpecificLevel is NotfLevel.Hushed) &&
              notfType == NotificationType.IndirectReply
      if (!skipBecauseMuted && !skipBecauseHushed) {
        _genOneNotfMaybe(
              notfType,
              to = toPat,
              from = sentFrom,
              about = aboutPost)
      }
    }
  }


  /** Generates notfs for one content structure level. E.g. users or groups who have
    * subscribed to 1) a *page*. Or those who have subscribed to pages in 2) a *category*.
    * Or to 3) pages tagged with some certain tag(s). Or 4) *the whole site*.
    */
  private def _makePostSubscrNotfFor(
        notfPrefs: Seq[PageNotfPrefAndWhy], notfType: NotfType, aboutPost: Post,
        isEmbDiscFirstReply: Bo, minNotfLevel: NotfLevel,
        memberIdsHandled: MutSet[PatId], wantSilencePatIds: MutSet[PatId],
        sentFrom: Pat): U = {

    _abortIfBadPost(aboutPost)

    val membersById = tx.loadParticipantsAsMap(notfPrefs.map(_.peopleId))
    val memberIdsHandlingNow = mutable.HashSet[MemberId]()
    val wantSilenceHereafterPatIds = mutable.HashSet[MemberId]()

    // Sync w [2069RSK25].  Test: [2069RSK25-B]
    val pageMeta = tx.loadPageMeta(aboutPost.pageId) getOrDie "TyE05WKSJF2"
    def maySeePost(ppt: Participant): Bo = {
      val (maySee, whyNot) = dao.maySeePost(
          aboutPost, Some(ppt), maySeeUnlistedPages = true)(tx)
      maySee.may
    }

    // Later, [private_pats]: Load privacy settings for `sentFrom` (incl for hens
    // groups), so we'll know if hens name should be included in the notification
    // texts or not. — Do elsewhere in this file too, not just here.

    // Individual users' preferences override group preferences, on the same
    // specificity level (prefs per page,  or per category,  or whole site).
    for {
      notfPref: PageNotfPrefAndWhy <- notfPrefs
      member <- membersById.get(notfPref.peopleId)
      if !wantSilencePatIds.contains(member.id)
      maySee = maySeePost(member)
      if maySee
    } {
      if (debiki.Globals.isDevOrTest) {
        // A member can have only one notf pref per page or category or whole site.
        // (The pagenotfprefs_pageid_people_u and pagenotfprefs_category_people_u constraints.)
        val numPrefsThisMember = notfPrefs.count(_.peopleId == member.id)
        assert(numPrefsThisMember == 1,
            s"s$siteId: Bad num notf prefs: $numPrefsThisMember, member: $member")
      }
      maybeMakeNotfs(member, notfPref)
    }

    memberIdsHandled ++= memberIdsHandlingNow  // was updated by maybeMakeNotfs()

    for {
      notfPref: PageNotfPrefAndWhy <- notfPrefs
      maybeGroup <- membersById.get(notfPref.peopleId)
      if maybeGroup.isGroup
      group = maybeGroup
      groupMaySee = maySeePost(group)
      if groupMaySee  // or ...
      groupMembers = tx.loadGroupMembers(group.id)

      // Skip unwanted DMs. [filter_dms] If this is a DM sent to a group, some
      // group members might not want DM:s from this sender — for example, an admin
      // who is short of time, and wants hents other co-workers to answer questions
      // from new members sent to @staff,
      // However, in some cases one might want to get notified via a group but not
      // directly — e.g. if one is in a @support group, but don't want to be messaged
      // about support privately (only via the group). This can be a group membership
      // setting. [inherit_group_priv_prefs]
      member <- groupMembers
      isDirMsg = pageMeta.pageType.isPrivateGroupTalk
      if !isDirMsg || sentFrom.mayMessage(member)
      // Later, maybe:  sentFrom.mayMessage(member, viaGroup = group)
      // and then the member's group membership settings matter too.
      //
      // But no need to:
      //   if !isDirMsg || sentFrom.mayMessage(group)
      // because the group itself is already explicitly subscribed to notifications.

      // ... or what if a group has enabled site wide notfs, and cannot see category C,
      // but user U is in that group *can* see C (because of other group hen is in)
      // — then, should U get notified about topics in C or not?
      // For now: No. Let group notf settings affect only categories the group itself
      // can see (rather than what the group members can see,
      // — which might be more than what the group can see). I think it'd be a bit
      // unexpected if changing a group's notf settings, affects categories that
      // are listed as cannot-see on the group's page?
      // So skip this: [5AKTG7374]
      //   memberMaySee = maySeePost(member)
      //   if groupMaySee || memberMaySee
      if !wantSilencePatIds.contains(member.id)
    } {
      maybeMakeNotfs(member, notfPref)
    }

    def maybeMakeNotfs(member: Participant, notfPref: PageNotfPrefAndWhy): U = {
      // If the member has already been considered, at a more specific content structure specificity,
      // then skip it here. For example, if it has configured a per page notf pref, then, skip it,
      // when considering categories and tags — because per page prefs are more specific.
      // However, do consider the member, if it occurs again, for different notf prefs, at the
      // same structure specificity. For example, if one category notf pref, from one group, says
      // Muted, and another category notf pref from another group, says EveryPost — then the
      // more chatty setting (EveryPost), wins. [CHATTYPREFS]
      if (memberIdsHandled.contains(member.id))
        return ()

      memberIdsHandlingNow += member.id

      if (notfPref.notfLevel.toInt < minNotfLevel.toInt) {
        // Remember that `member` doesn't want notifications for less specific
        // things, content structure wise.
        // Example 1: Member Memah has muted sub category S, but she's a member
        // of a group who gets notifications about Every Post in the parent
        // category P.  Now, someone posts a reply in a topic in sub cat S — then,
        // Memah should normally get a notification, since she is in that group
        // (which gets notified about Every Post in P, which includes S).
        // But sub category S is more specific than parent category P,
        // and here we remember that, later when handling notification prefs
        // for parent cat P and the group, Memah should Not get notified
        // (she wants silence).
        TESTS_MISSING
        wantSilenceHereafterPatIds.add(member.id)
        return ()
      }

      // If the person who is changing assignees, is watching the category (or a page or
      // whole site), then don't notify han about the changes (han already knows).
      if (notfType.isAboutAssignees && sentFrom.id == member.id)
        return ()

      // If replying to oneself? — But then the `if` just above isn't needed.
      if (member.id == sentFrom.id)
        return ()

      UX; COULD // NotificationType.NewPage instead? Especially if: isEmbDiscFirstReply.
      _genOneNotfMaybe(
            notfType,
            from = sentFrom,
            to = member,
            about = aboutPost,
            generatedWhy = notfPref.why)
    }

    memberIdsHandled ++= memberIdsHandlingNow
    wantSilencePatIds ++= wantSilenceHereafterPatIds
  }


  /** Creates and deletes mentions, if '@username's are added/removed by this edit.
    */
  def generateForEdits(editor: Pat, oldPost: Post, editedPost: Post,
        anyNewSourceAndHtml: Opt[SourceAndHtml])
        : Notifications = {

    _abortIfBadPost(oldPost)

    anyAuthor = Some(editor)
    BUG // Harmless: Don't notify the approver. [dont_notify]

    val newPost = editedPost ; RENAME

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

    val anyNewTextAndHtml: Option[TextAndHtml] = anyNewSourceAndHtml map {
      case t: TextAndHtml => t
      case _: TitleSourceAndHtml =>
        // Currently titles cannot mention people, and editing it generates no notfs.
        // However, maybe later staff wants to get notified if titles of "important"
        // pages somehow get changed. For now, do nothing though. [no_title_notfs]
        return Notifications.None  // or: return generatedNotifications? the same?
    }

    /* Later, if  newPost.lastApprovedEditById is empty: {  [upd_last_apr_editor]
      warnDevDie("TyE4GKF0B2", s"""s$siteId: lastApprovedEditById is None although
            there's an approved edit. Post id ${newPost.id}""")
      return Notifications.None
    } */

    anyNewTextAndHtml foreach { textAndHtml =>
      require(newPost.approvedSource is textAndHtml.text,
        s"approvedSource: ${newPost.approvedSource}, textAndHtml.text: ${textAndHtml.text} [TyE4WKB7Z]")
      require(newPost.approvedHtmlSanitized is textAndHtml.safeHtml,
        s"appr.HtmlSan.: ${newPost.approvedHtmlSanitized}, safeHtml: ${textAndHtml.safeHtml} [TyE4WB78]")
    }

    val oldMentions: Set[Username] =
          findMentions(oldPost.approvedSource getOrDie "TyE0YKW3", site, nashorn)  // [nashorn_in_tx]

    val newMentions: Set[Username] =
          anyNewTextAndHtml.map(_.usernameMentions) getOrElse findMentions(  // [nashorn_in_tx]
                newPost.approvedSource getOrDie "DwE2BF81", site, nashorn)

    val deletedMentions: Set[Username] = oldMentions -- newMentions
    val createdMentions: Set[Username] = newMentions -- oldMentions

    var mentionsDeletedForUsers: Set[MemberVb] =
          tx.loadMembersVbByUsername(deletedMentions).toSet

    var mentionsCreatedForUsers: Set[MemberVb] =
          tx.loadMembersVbByUsername(createdMentions).toSet

    val newMentionsIncludesAll: Bo = mentionsAllInChannel(newMentions)
    val oldMentionsIncludesAll: Bo = mentionsAllInChannel(oldMentions)

    // Could use `trueDoer` instead, but is that risky? What if only admins may mention groups,
    // and there's just one admin.  [not_use_true_users]
    lazy val mayAddGroup: Bo =
      mayMentionGroups(author)

    val mentionsForAllCreated: Bo = newMentionsIncludesAll && !oldMentionsIncludesAll && mayAddGroup
    val mentionsForAllDeleted: Bo = oldMentionsIncludesAll && !newMentionsIncludesAll
    dieIf(mentionsForAllCreated && mentionsForAllDeleted, "EdE2WK4Q0")

    lazy val previouslyMentionedUserIds: Set[UserId] =
          tx.loadNotificationsAboutPost(newPost.id, NotificationType.Mention
                                          ).map(_.toUserId).toSet

    if (mentionsForAllDeleted) {
      // CLEAN_UP COULD simplify this whole function — needn't load mentionsDeletedForUsers above.
      val usersMentionedAfter = tx.loadMembersVbByUsername(newMentions).toSet
      val toDelete: Set[UserId] = previouslyMentionedUserIds -- usersMentionedAfter.map(_.id)
      // (COULD_OPTIMIZE: needn't load anything here — we have the user ids already.)
      // But better skip loading above instead, see CLEAN_UP above.
      mentionsDeletedForUsers = tx.loadMembersVbById(toDelete).toSet
    }

    if (mentionsForAllCreated) {
      val pageMemberIds: Set[UserId] = tx.loadMessageMembers(newPost.pageId)
      mentionsDeletedForUsers = mentionsDeletedForUsers.filterNot(u => pageMemberIds.contains(u.id))
      BUG; REFACTOR // [5BKR03] in rare cases, people might get two notfs: if they're a page member,
      // and also if they're in a group that gets @group_mentioned now, when editing.
      val moreIds: Set[UserId] =
            pageMemberIds -- previouslyMentionedUserIds -- mentionsCreatedForUsers.map(_.id)
      mentionsCreatedForUsers ++= tx.loadMembersVbById(moreIds)
    }

    // Delete mentions.
    for (user <- mentionsDeletedForUsers) {
      notfsToDelete += NotificationToDelete.ToOneMember(
            siteId = tx.siteId,
            uniquePostId = newPost.id,
            toUserId = user.id,
            NotificationType.Mention)
    }

    val pageMeta = tx.loadPageMeta(newPost.pageId)

    // Create mentions.
    for {
      mentionedMember <- mentionsCreatedForUsers
      // (Might still be a self-mention via a group one is a member of.)
      if mentionedMember.id != author.id
    } {
      BUG // harmless. might mention people again, if previously mentioned directly,
      // and now again via a @group_mention. See REFACTOR above.
      BUG // harmless:  Notf.NewPost.createdAt should be the date of the edit,
      // not the post creation date
      _makeAboutPostNotfs(
            NotificationType.Mention,
            about = newPost,
            inCategoryId = pageMeta.flatMap(_.categoryId),
            sendTo = mentionedMember,
            // We don't want to show their true id
            sentFrom = author)
    }

    generatedNotifications
  }


  def generateForLikeVote(post: Post, upvotedPostAuthor: Participant,
          voter: Participant, inCategoryId: Option[CategoryId]): Notifications = {
    _abortIfBadPost(post)

    if (upvotedPostAuthor.isGone || upvotedPostAuthor.isBuiltIn)
      return generatedNotifications

    if (upvotedPostAuthor.isGroup) {
      // Not implemented. What'd make sense to do? Notify everyone in the group,
      // or would that be too noisy?
      return generatedNotifications
    }

    _makeAboutPostNotfs(
          NotificationType.OneLikeVote, about = post, inCategoryId = inCategoryId,
          sendTo = upvotedPostAuthor, sentFrom = voter)

    generatedNotifications
  }


  def generateForTags(post: Post, postAuthor: Pat, tagsAdded: Set[TagLabel]): Notifications = {
    _abortIfBadPost(post)
    val userIdsWatching = tx.listUsersWatchingTags(tagsAdded)
    val userIdsNotified = tx.listUsersNotifiedAboutPost(post.id)
    val userIdsToNotify = userIdsWatching -- userIdsNotified
    val usersToNotify = tx.loadParticipants(userIdsToNotify.to[immutable.Seq])
    val pageMeta = tx.loadPageMeta(post.pageId)
    anyAuthor = Some(postAuthor)
    for {
      user <- usersToNotify
      if user.id != postAuthor.id
    } {
      // This is about the new (from the notf recipient's point of view) post,
      // so the notf is from the post author, not from the one who added the tag
      // (unless hen is the author).
      // [notf_from_who] Or mention both the author *and* the person adding the tag?
      //
      BUG // harmless: We should skip the tagger — han knows aobut the new tag. [dont_notify]
      _makeAboutPostNotfs(
            NotificationType.PostTagged, about = post,
            inCategoryId = pageMeta.flatMap(_.categoryId),
            sendTo = user,
            sentFrom = postAuthor)
    }
    generatedNotifications
  }


  def generateForAssignees(
          assigneesAdded: Iterable[Pat], assigneesRemoved: Iterable[Pat], postBef: Post,
          changedBy: Pat): Notifications = {
    _abortIfBadPost(postBef)

    val pageMeta = tx.loadThePageMeta(postBef.pageId)
    val postAuthor = tx.loadTheParticipant(postBef.createdById) // [post_authors]
    val anyCatId = pageMeta.categoryId

    for (pat <- assigneesAdded) {
      _makeAboutPostNotfs(
            NotfType.Assigned, about = postBef, inCategoryId = anyCatId,
            sendTo = pat, sentFrom = changedBy)
    }

    for (pat <- assigneesRemoved) {
      _makeAboutPostNotfs(
            NotfType.Unassigned, about = postBef, inCategoryId = anyCatId,
            sendTo = pat, sentFrom = changedBy)
    }

    // Notify the post author.  (_makeAboutPostNotfs() won't send dupl notfs,
    // and won't notify people who can (no longer) see the page.)
    _makeAboutPostNotfs(
          NotfType.AssigneesChanged, about = postBef, inCategoryId = anyCatId,
          sendTo = postAuthor, sentFrom = changedBy)

    // Does it make sense to notify the previous assignees, about more assignees
    // now having been added or removed? Let's wait, not important — not often
    // more than one person is assigned.  [notf_assignees_about_another]

    // Notify page/category subscribers and page members.
    val pageMemberIds: Set[PatId] = tx.loadMessageMembers(postBef.pageId)
    _genWatchingSomethingNotfs(
          NotfType.AssigneesChanged, pageMeta, about = postBef,
          pageMemberIds = pageMemberIds, sentFrom = changedBy)

    generatedNotifications
  }


  /**
    * @param from — From who. Default is ${about.createdById}.
    */
  private def _genOneNotfMaybe(
        notfType: NotfType,
        to: Pat,
        from: Pat,
        about: Post,
        // generatedAt: Opt[When] = None,
        generatedWhy: St = "",
        isAboutModTask: Bo = false,
        isPrivMsgFromStaff: Bo = false, // fix later
        ): U = {

    // If forgotten elsewhere.
    _abortIfBadPost(about)

    val aboutPost = about
    val toPat = to
    val fromPat = from

    if (toPat.id == fromPat.id) {
      bugWarn("TyE4S602MRD5", s"Notf to self, id: ${toPat.trueId2}, about post ${aboutPost.id}")
      return ()
    }

    // If the notification is to or from an alias (anonym or pseudonym), the alias
    // might be the sender's own alias.  Then, don't generate any notf.  [notfs_trueid_check]
    if (toPat.trueId2.trueId == fromPat.trueId2.trueId) {
      avoidDuplEmailsToTrueIds += toPat.trueId2.trueId
      return ()
    }

    // One cannot talk with deactivated or deleted pats, or System or Sysbot.
    // (But one can mention e.g. @admins or @core_members — built-in pats.)
    if (toPat.isGone || toPat.isSystemOrSysbot)
      return ()

    if (toPat.isSuspendedAt(tx.now) && !isPrivMsgFromStaff)
      return ()

    val emailStatus: NotfEmailStatus =
          if (avoidDuplEmailsToTrueIds.contains(toPat.trueId2.trueId))
            NotfEmailStatus.Skipped
          else
            NotfEmailStatus.Undecided

    if (isAboutModTask) {
      // Don't update `sentToTrueIds`. We still want to generate e.g. any reply notification
      // to the moderator that approves a new comment — so the moderator later on can
      // find the comment in their notifications list.  But the mod probably doesn't
      // want more than one *email* about such a new comment, so:
      avoidDuplEmailsToTrueIds += toPat.trueId2.trueId
    }
    else {
      if (sentToTrueIds.contains(toPat.trueId2.trueId))
        return ()

      sentToTrueIds += toPat.trueId2.trueId
    }

    val newNotfId = bumpAndGetNextNotfId()

    notfsToCreate += Notification.NewPost(
          notfType,
          id = newNotfId,
          // It's nice to see what notifications a pseudonym of one's own has gotten, ...
          toUserId = toPat.id,
          // ... And also nice to see all one's notifications — to one's true user,
          // and all pseudonyms and anonyms, at once.
          toTrueId = toPat.trueId2.anyTrueId,
          // TESTS_MISSING  ANON_UNIMPL  TyTNOTFFROMANON
          byUserId = fromPat.id,
          byTrueId = fromPat.trueId2.anyTrueId,

          createdAt = aboutPost.createdAt,
          uniquePostId = aboutPost.id,
          smtpMsgIdPrefix = aboutPost.smtpMsgIdPrefix.map(_ + s".${toPat.id}.$newNotfId"),
          emailStatus = emailStatus)
  }


  private def bumpAndGetNextNotfId(): NotificationId = {
    nextNotfId match {
      case None =>
        // Generate random 64 bit number instead?  Or a timestamp.  [avoid_glob_seq_nrs]
        // And have a look in the db so there's no collision.
        nextNotfId = Some(tx.nextNotificationId())
      case Some(id) =>
        nextNotfId = Some(id + 1)
    }
    nextNotfId getOrDie "EsE5GUY2"
  }


  private def _abortIfBadPost(post: Post): U = {
    require(post.tyype != PostType.Bookmark,  // [0_bokm_notfs]
          "Can't generate notifications about bookmarks [TyEBOKMNOTF]")
    require(post.tyype != PostType.MetaMessage,
          "Shouldn't generate notifications for meta posts?  [TyEMETAPONOTF]")
    unimplIf(post.tyype == PostType.Flag_later, "Notifications about PostType.Flag_later")
    unimplIf(post.isPrivate, "Notifications about private comments") // [priv_comts]
  }

}


object NotificationGenerator {

  def mentionsAllInChannel(mentions: Set[String]): Boolean =
    mentions.contains("all") || mentions.contains("channel")


  def mayMentionGroups(user: Participant): Boolean = {
    REMOVE // Using the permission system instead: pats_t.may_mention_me_tr_lv_c.
    // But how is that going to work for "virtual" groups like @all and @here? [who_may_mention_all]
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


  // Try to remove? Save mentions in posts_t instead, see:  approved_html_sanitized_c.
  private def findMentions(text: St, site: SiteIdHostnames, nashorn: Nashorn): Set[St] = {
    // Try to avoid rendering Commonmark source via Nashorn, if cannot possibly be any mentions:
    if (!MaybeMentionsRegex.matches(text))
      return Set.empty

    // Do twice? First to find all mentions, then, find out which ones one may not mention,
    // then, do again but color @someone_one_may_not_mention in gray not blue? [filter_mentions]
    val result = nashorn.renderAndSanitizeCommonMark(
      // BUG? COULD incl origin here, so links won't be interpreted relative any
      // web browser client's address? — Right now, no images incl in reply notf emails
      // anyway, so need not fix now.
      text, NashornParams(site, embeddedOriginOrEmpty = "",
            allowClassIdDataAttrs = false, followLinks = false,
            mayMention = _ => Map.empty.withDefaultValue(true)))

    result.mentions
  }

}
