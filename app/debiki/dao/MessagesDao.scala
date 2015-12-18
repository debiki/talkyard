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
import debiki.DebikiHttp.{throwNotFound, throwForbidden}
import java.{util => ju}
import debiki.{NotificationGenerator, TextAndHtml}

import scala.collection.mutable.ArrayBuffer
import scala.collection.{mutable, immutable}


trait MessagesDao {
  self: SiteDao =>


  def sendMessage(title: TextAndHtml, body: TextAndHtml, toUserIds: Set[UserId],
        sentById: UserId, browserIdData: BrowserIdData): PagePath = {
    readWriteTransaction { transaction =>
      val sender = transaction.loadTheUser(sentById)

      val (pagePath, bodyPost) = createPageImpl2(PageRole.Message, title, body,
        authorId = sentById, browserIdData = browserIdData, transaction = transaction)

      (toUserIds + sentById) foreach { userId =>
        transaction.insertMessageMember(pagePath.pageId.getOrDie("EsE6JMUY2"), userId,
          addedById = sentById)
      }

      val notifications = NotificationGenerator(transaction).generateForMessage(
        sender, bodyPost, toUserIds)

      transaction.saveDeleteNotifications(notifications)
      pagePath
    }
  }

}

