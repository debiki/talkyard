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
import io.efdi.server.{Who, pubsub}
import debiki.DebikiHttp.throwForbidden
import debiki.TextAndHtml


trait MessagesDao {
  self: SiteDao =>


  def sendMessage(title: TextAndHtml, body: TextAndHtml, toUserIds: Set[UserId],
        sentByWho: Who): PagePath = {

    if (toUserIds.contains(SystemUserId))
      throwForbidden("EsE2WUY0", "Cannot send messages to the System user")

    if (toUserIds.exists(_ <= MaxGuestId))
      throwForbidden("EsE6UPY2", "Cannot send messages to guests")

    val sentById = sentByWho.id
    if (sentById <= MaxGuestId)
      throwForbidden("EsE5JGKU9", "Guests cannot send messages")

    val (pagePath, notfs) = readWriteTransaction { transaction =>
      val sender = loadUserAndLevels(sentByWho, transaction)

      if (sender.threatLevel == ThreatLevel.ModerateThreat) {
        // Don't let unpolite users start private-messaging other well behaved users.
        // But do let them talk with staff, e.g. ask "why am I not allowed to ...".
        // COULD hide send-message button in the UI too.
        val toUsers = transaction.loadUsers(toUserIds)
        if (toUsers.exists(!_.isStaff))
          throwForbidden("EsE8GY2F4_", "You may send direct messages to staff only")
      }

      val (pagePath, bodyPost) = createPageImpl2(PageRole.Message, title, body,
        byWho = sentByWho, transaction = transaction)

      (toUserIds + sentById) foreach { userId =>
        transaction.insertMessageMember(pagePath.pageId.getOrDie("EsE6JMUY2"), userId,
          addedById = sentById)
      }

      val notifications = NotificationGenerator(transaction).generateForMessage(
        sender.user, bodyPost, toUserIds)

      transaction.saveDeleteNotifications(notifications)
      (pagePath, notifications)
    }

    pubSub.publish(
      // pagePath.thePageId is pointless (since the page is new) — send the forum page id instead?
      pubsub.NewPageMessage(siteId, pagePath.thePageId, PageRole.Message, notfs), byId = sentById)

    pagePath
  }


  def loadMessageMembers(pageId: PageId): Set[UserId] = {
    readOnlyTransaction(_.loadMessageMembers(pageId))
  }

}

