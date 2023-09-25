/**
 * Copyright (c) 2015 Kaj Magnus Lindberg
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

package debiki.dao

import com.debiki.core._
import com.debiki.core.Prelude._
import debiki.EdHttp.{throwForbidden, throwForbiddenIf}
import talkyard.server.pubsub
import debiki.{TextAndHtml, TitleSourceAndHtml}


trait MessagesDao {
  self: SiteDao =>


  /** COULD perhaps this method be used to create OpenChat pages too? So that the creator
    * gets auto added to the page? [5KTE02Z]
    */
  def startGroupTalk(title: TitleSourceAndHtml, body: TextAndHtml, pageRole: PageType,
        // RENAME toMemIds to toMemberIds, and  MemId  to MembId
        toMemIds: Set[MemId], sentByWho: Who, spamRelReqStuff: SpamRelReqStuff,
        deleteDraftNr: Option[DraftNr]): PagePathWithId = {

    if (!pageRole.isPrivateGroupTalk)
      throwForbidden("EsE5FKU02", s"Not a private group talk page role: $pageRole")

    // The system user can send (internally, from within the server), but not receive, messages.
    if (toMemIds.contains(SystemUserId))
      throwForbidden("EsE2WUY0", "Cannot send messages to the System user")

    // Can actually make sense to send priv msgs to anonyms — why not? Why not talk privately
    // with someone who wrote something interesting, even if hen is anonymous?  On online
    // forums, you typically don't know who the people are anyway, even if you see their
    // online names.  [anon_priv_msgs]
    if (toMemIds.exists(_ <= MaxGuestOrAnonId))
      throwForbidden("EsE6UPY2", "Cannot send messages to guests or anonyms")

    val sentById = sentByWho.id
    if (sentByWho.isAnon)  // [anon_priv_msgs]
      throwForbidden("TyE0ANONMSG", s"Anonymous private messages not yet implemented")

    if (sentByWho.isGuest)
      throwForbidden("EsE5JGKU9", "Guests cannot send private messages")

    dieIf(sentById <= MaxGuestOrAnonId, "TyE5267JGKU9",
          s"Bad sentById: $sentById, it's <= $MaxGuestOrAnonId")

    // One cannot message oneself. However:
    // Sending anon messages to one's real user — yes can make sense. [anon_priv_msgs]
    // Let's say you're a group manager. You want to report something anonymously
    // to the other group managers. Then, if you couldn't message yourself (as one of
    // the others), you might need to list the other group managers, but exclude yourself
    //  — Then the others might guess that your anonym is actually you (when they see
    // that the anonym has messaged all managers except for one).
    // So, don't compare with trueId — it's fine for an anon to message hens true id.
    if (toMemIds.contains(sentById))
      throwForbidden("EsE6GK0I2", o"""Cannot send a message to yourself. You are: ${
            sentByWho.id}, sending to: ${ toMemIds.mkString(", ") }""")

    throwForbiddenIf(toMemIds.exists(id => Group.EveryoneId <= id && id <= Group.FullMembersId),
          "TyEMSGMANY", o"""Cannot direct-message groups Everyone, Basic and Full Members.
          But you can post a forum topic instead?""")

    quickCheckIfSpamThenThrow(sentByWho, body, spamRelReqStuff)

    // ----- Database

    val (pagePath, notfs, sender, toMemsInclGroupMems: Set[Member]) = writeTx { (tx, staleStuff) =>
      val sender = loadUserAndLevels(sentByWho, tx)
      val toMembers = tx.loadParticipants(toMemIds).map(_.toMemberOrThrowCode("DM-MEMB"))

      // 1) Don't let unpolite users start private-messaging other well behaved users.
      // But do let them talk with staff, e.g. ask "why am I not allowed to ...".
      // 2) TrustLevle.New members haven't spent much time at the site, and it's a bit risky to
      // let them start sending PMs directly.
      if ((sender.threatLevel.toInt >= ThreatLevel.ModerateThreat.toInt ||
          sender.trustLevel.isStrangerOrNewMember) && !sender.isStaff) {
        if (toMembers.exists(!_.isStaff))
          throwForbidden("EsE8GY2F4_", "You may send direct messages to staff only")
      }

      TESTS_MISSING // [server_blocks_dms]  — No, now impl? Here:
      // Tests:
      //  - block-dir-msgs.2br.d  TyTBLOCKDIRMSGS
      val mayNotMessage = toMembers.filter(!sender.user.mayMessage(_))
      throwForbiddenIf(mayNotMessage.nonEmpty, "EsEMAY0MSG",
            s"You cannot send direct messages to: ${
            mayNotMessage.map(_.atUsernameOrFullName).mkString(", ")}")

      val toGroups: ImmSeq[Group] = toMembers collect { case g: Group => g }
      // [sub_groups] Would load sub group members, recursively?
      val toUsersViaGroups: ImmSeq[Member] = toGroups.map(_.id) flatMap tx.loadGroupMembers
      val toUsersDirectly: ImmSeq[User] = toMembers collect { case u: User => u }
      val toMemsInclGroupMems: Set[Member] =
            toUsersDirectly.toSet ++ toUsersViaGroups.toSet ++ toGroups.toSet

      // This generates no review task — staff aren't asked to review and approve
      // direct messages; such messages can be semi private.
      val (pagePath, bodyPost, _) = createPageImpl(
            pageRole, PageStatus.Published, anyCategoryId = None, withTags = Nil,
            anyFolder = None, anySlug = None, showId = true,
            title = title, body = body,
            byWho = sentByWho, spamRelReqStuff = Some(spamRelReqStuff),
            )(tx, staleStuff)

      // If this is a private topic, they'll get notified about all posts,
      // by default, although no notf pref configured here. [PRIVCHATNOTFS]
      // Some of toMemIds might be groups — then, the group members can see
      // the private topic, and get notified about replies.
      (toMemIds + sentById) foreach { memId =>
        tx.insertMessageMember(pagePath.pageId, memId, addedById = sentById)
      }

      AUDIT_LOG // missing

      val notifications =
        if (pageRole.isChat) {
          unimplementedIf(toMemIds.nonEmpty, "EsE7PKW02")
          Notifications.None
        }
        else {
          // This skips users who have blocked DM:s.
          COULD_OPTIMIZE // Somehow reuse toMemsInclGroupMems?
          notfGenerator(tx).generateForMessage(sender.user, bodyPost, toMemIds)
        }

      deleteDraftNr.foreach(nr => tx.deleteDraft(sentByWho.id, nr))

      tx.saveDeleteNotifications(notifications)
      (pagePath, notifications, sender, toMemsInclGroupMems)
    }

    // ----- Watchbar

    // Update watchbars for those who got added to this new dir msg, including
    // those added indirectly via groups.  But not those who have disabled
    // DM:s from this sender [filter_dms] (e.g. admins in large forums who are short
    // of time, and don't want to get notified just becaus someone messages Staff).
    RACE // [WATCHBRACE]

    // 1/2: We know that the sender is online currently — hen should start watching
    // the page immediately.
    {
      val senderAuthzCtx = getAuthzCtxOnPagesForPat(sender.user)
      var watchbar: BareWatchbar = getOrCreateWatchbar(senderAuthzCtx)
      watchbar = watchbar.addPage(pagePath.pageId, pageRole, hasSeenIt = true)
      // [pseudonyms_later] Should update the true user's watchbar, trueId.
      saveWatchbar(sender.id, watchbar)
      logger.debug(s"s$siteId: Telling PubSubActor: ${
            sender.nameHashId} created & starts watching page ${pagePath.pageId} [TyM50AKTG3]")
      // Later, if anon private message: Send  trueId,  and announce
      // the precense of the anonym / pseudonym (but not the true user, if it's
      // anonymous!).  And send websocket messages to the true user.  [anon_priv_msgs]
      pubSub.userWatchesPages(siteId, sentById, watchbar.watchedPageIds)
    }

    // 2/2: Others might not even have visited the site before, and might not yet have
    // any watchbar to update. Then, nothing to do here. This new private message will
    // get lazy-added to their watchbar on creation. [lazy_watchbar]
    for {
      member: Member <- toMemsInclGroupMems
      // The sender might have messaged a group hen is in, so member might be == sender.
      if member.id != sender.id
      if !member.isGroup && !member.isBuiltIn
    } {
      getAnyWatchbar(member.id) foreach { watchbar =>
        val watchbarAfter = watchbar.addPage(pagePath.pageId, pageRole, hasSeenIt = false)
        saveWatchbar(member.id, watchbarAfter)
      }
    }

    // (Tested here: [TyTPAGENOTF])
    pubSub.publish(
          pubsub.NewPageMessage(siteId, notfs), byId = sentById)

    pagePath
  }


  def getAnyPrivateGroupTalkMembers(pageMeta: PageMeta): Set[UserId] = {
    if (!pageMeta.pageType.isPrivateGroupTalk)
      return Set.empty
    COULD_OPTIMIZE // could cache page members.
    readOnlyTransaction(_.loadMessageMembers(pageMeta.pageId))
  }

}

