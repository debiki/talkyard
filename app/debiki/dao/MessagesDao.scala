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
import io.efdi.server.notf.NotificationGenerator
import io.efdi.server.pubsub
import debiki.DebikiHttp.throwForbidden
import debiki.TextAndHtml


trait MessagesDao {
  self: SiteDao =>


  /** COULD perhaps this method be used to create OpenChat pages too? So that the creator
    * gets auto added to the page? [5KTE02Z]
    */
  def startGroupTalk(title: TextAndHtml, body: TextAndHtml, pageRole: PageRole,
        toUserIds: Set[UserId], sentByWho: Who, spamRelReqStuff: SpamRelReqStuff): PagePath = {

    if (!pageRole.isPrivateGroupTalk)
      throwForbidden("EsE5FKU02", s"Not a private group talk page role: $pageRole")

    // The system user can send (internally, from within the server), but not receive, messages.
    if (toUserIds.contains(SystemUserId))
      throwForbidden("EsE2WUY0", "Cannot send messages to the System user")

    if (toUserIds.exists(_ <= MaxGuestId))
      throwForbidden("EsE6UPY2", "Cannot send messages to guests")

    val sentById = sentByWho.id
    if (sentById <= MaxGuestId)
      throwForbidden("EsE5JGKU9", "Guests cannot send messages")

    if (toUserIds.contains(sentById))
      throwForbidden("EsE6GK0I2", o"""Cannot send a message to yourself. You are: $sentById,
          sending to: ${ toUserIds.mkString(", ") }""")

    quickCheckIfSpamThenThrow(sentByWho, body, spamRelReqStuff)

    val (pagePath, notfs) = readWriteTransaction { transaction =>
      val sender = loadUserAndLevels(sentByWho, transaction)

      // 1) Don't let unpolite users start private-messaging other well behaved users.
      // But do let them talk with staff, e.g. ask "why am I not allowed to ...".
      // 2) TrustLevle.New members haven't spent much time at the site, and it's a bit risky to
      // let them start sending PMs directly.
      if ((sender.threatLevel.toInt >= ThreatLevel.ModerateThreat.toInt ||
          sender.trustLevel == TrustLevel.New) && !sender.isStaff) {
        val toUsers = transaction.loadUsers(toUserIds)
        if (toUsers.exists(!_.isStaff))
          throwForbidden("EsE8GY2F4_", "You may send direct messages to staff only")
      }

      val (pagePath, bodyPost) = createPageImpl2(pageRole, title, body,
        byWho = sentByWho, spamRelReqStuff = Some(spamRelReqStuff), transaction = transaction)

      (toUserIds + sentById) foreach { userId =>
        transaction.insertMessageMember(pagePath.pageId.getOrDie("EsE6JMUY2"), userId,
          addedById = sentById)
      }

      val notifications =
        if (pageRole.isChat) {
          unimplementedIf(toUserIds.nonEmpty, "EsE7PKW02")
          Notifications.None
        }
        else {
          NotificationGenerator(transaction).generateForMessage(
            sender.user, bodyPost, toUserIds)
        }

      transaction.saveDeleteNotifications(notifications)
      (pagePath, notifications)
    }

    (toUserIds + sentById) foreach { userId =>
      // BUG. Race condition.
      var watchbar: BareWatchbar = getOrCreateWatchbar(userId)
      val hasSeenIt = userId == sentByWho.id
      watchbar = watchbar.addPage(pagePath.thePageId, pageRole, hasSeenIt)
      saveWatchbar(userId, watchbar)

      // We know that the sender is online currently, so s/he should start watching the
      // page immediately. Other page members, however, might be offline. Ignore them.
      if (userId == sentById) {
        pubSub.userWatchesPages(siteId, sentById, watchbar.watchedPageIds) ;RACE
      }
    }

    pubSub.publish(
      // pagePath.thePageId is pointless (since the page is new) — send the forum page id instead?
      pubsub.NewPageMessage(siteId, pagePath.thePageId, pageRole, notfs), byId = sentById)

    pagePath
  }


  def loadMessageMembers(pageId: PageId): Set[UserId] = {
    readOnlyTransaction(_.loadMessageMembers(pageId))
  }

}

