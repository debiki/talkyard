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

package com.debiki.core

import com.debiki.core.Prelude._
import play.api.libs.json._
import scala.collection.immutable
import scala.collection.mutable.ArrayBuffer
import BareWatchbar.MaxRecentTopics


sealed abstract class WatchbarSection(val IntVal: Int) { def toInt = IntVal }
object WatchbarSection {
  case object RecentTopics extends WatchbarSection(1)
  case object Notifications extends WatchbarSection(2)
  case object ChatChannels extends WatchbarSection(3)
  case object DirectMessages extends WatchbarSection(4)
}


case class WatchbarTopic(
  pageId: PageId,
  unread: Boolean)


object WatchbarTopic {

  import play.api.libs.functional.syntax._

  implicit val topicReads: Reads[WatchbarTopic] = (
    (JsPath \ "pageId").read[PageId] and
    (JsPath \ "unread").read[Boolean])(WatchbarTopic.apply _)

  implicit val topicWritesNoTitles: Writes[WatchbarTopic] = (
      (JsPath \ "pageId").write[PageId] and
      (JsPath \ "unread").write[Boolean]
    )(unlift(WatchbarTopic.unapply))

  // load from db or other cache, so as not to dupl state, before sending watchbar to browser:
    //(JsPath \ "numMembers").read[Boolean] and
    //(JsPath \ "url").read[Option[String]] and

  // load from the notfs in the React.js store, in the browser:
    //(JsPath \ "notfsToMe").read[Int] and
    //(JsPath \ "notfsToMany").read[Int])
}


/** Immutable.
  */
sealed trait Watchbar {

  def recentTopics: immutable.Seq[WatchbarTopic]
  def notifications: immutable.Seq[WatchbarTopic]
  def chatChannels: immutable.Seq[WatchbarTopic]
  def directMessages: immutable.Seq[WatchbarTopic]

  lazy val watchedPageIds: Set[PageId] = {
    (recentTopics.map(_.pageId) ++ notifications.map(_.pageId) ++
      chatChannels.map(_.pageId) ++ directMessages.map(_.pageId)).toSet
  }

  /** Creates a string like: "12:1,34:1,56abc,de:2|..."
    */
  def toCompactBareWatchbarString: String = {
    val sb = StringBuilder.newBuilder
    def append(topics: immutable.Seq[WatchbarTopic]) {
      for (topic <- topics) {
        if (sb.nonEmpty && sb.last != '|') sb.append(",")
        sb.append(topic.pageId)
        if (topic.unread) sb.append(":1")
      }
    }
    append(recentTopics)
    sb.append('|')
    append(notifications)
    sb.append('|')
    append(chatChannels)
    sb.append('|')
    append(directMessages)
    sb.toString()
  }
}



case class WatchbarWithTitles(
  recentTopics: immutable.Seq[WatchbarTopic],
  notifications: immutable.Seq[WatchbarTopic],
  chatChannels: immutable.Seq[WatchbarTopic],
  directMessages: immutable.Seq[WatchbarTopic],
  titlesEtcById: Map[PageId, PageTitleRole]) extends Watchbar {


  def toJsonWithTitles: JsValue = {
    Json.obj(
      "1" -> recentTopics.map(topicToJsonWithTitleEtc),
      "2" -> notifications.map(topicToJsonWithTitleEtc),
      "3" -> chatChannels.map(topicToJsonWithTitleEtc),
      "4" -> directMessages.map(topicToJsonWithTitleEtc))
  }


  private def topicToJsonWithTitleEtc(topic: WatchbarTopic): JsValue = {
    val titleEtc = titlesEtcById.getOrElse(topic.pageId, NoTitleEtc)
    Json.obj(
      "pageId" -> topic.pageId,
      "url" -> "", // ?
      "title" ->  titleEtc.title,
      "private" -> false,
      "numMembers" -> 0,
      "unread" -> topic.unread)
  }


  /** Used if a page has been deleted or made private, so that title etc is no longer available */
  private def NoTitleEtc = new PageTitleRole {
    def title = "(page gone, DwM5YKW24)"
    def role = PageRole.Discussion
  }
}



case class BareWatchbar(
  recentTopics: immutable.Seq[WatchbarTopic],
  notifications: immutable.Seq[WatchbarTopic],
  chatChannels: immutable.Seq[WatchbarTopic],
  directMessages: immutable.Seq[WatchbarTopic]) extends Watchbar {


  def addTitlesEtc(titlesEtcById: Map[PageId, PageTitleRole]) = WatchbarWithTitles(
    recentTopics, notifications, chatChannels, directMessages, titlesEtcById)


  /** Returns None, if wasn't changed, or Some(new-watchbar).
    */
  def tryAddRecentTopicMarkSeen(pageMeta: PageMeta): Option[BareWatchbar] = {
    val pageId = pageMeta.pageId
    val watchbarWithTopic =
      if (pageMeta.isPrivateGroupTalk) {
        // Don't add private group talk pages to the recent topics list — they should never be
        // shown in the recent list, because they're private. They are only listed in the
        // Channels and Direct Messages sections.
        // Only try to mark the topic as seen. (Should be in the Channels or Private Messages
        // section already.)
        this
      }
      else {
        copy(recentTopics = placeFirstMarkSeen(pageMeta, recentTopics))
      }
    // The page might be in the Channels or Direct Messages sections, so always do:
    val newWatchbar = watchbarWithTopic.markPageAsSeen(pageId)
    if (newWatchbar != this) Some(newWatchbar)
    else None
  }


  def addPage(pageMeta: PageMeta, hasSeenIt: Boolean): BareWatchbar =
    addPage(pageMeta.pageId, pageMeta.pageRole, hasSeenIt)


  def addPage(pageId: PageId, pageRole: PageRole, hasSeenIt: Boolean): BareWatchbar = {
    if (pageRole.isChat) {
      addChatChannel(pageId, hasSeenIt)
    }
    else if (pageRole.isPrivateGroupTalk) {
      addDirectMessage(pageId, hasSeenIt)
    }
    else {
      // Add to recent list? Or do what? This cannot happen right now.
      unimplemented("EsE3PK04W")
    }
  }


  private def addChatChannel(pageId: PageId, hasSeenIt: Boolean): BareWatchbar = {
    if (chatChannels.exists(_.pageId == pageId)) {
      if (hasSeenIt) markPageAsSeen(pageId)
      else this
    }
    else {
      copy(chatChannels = WatchbarTopic(pageId, unread = !hasSeenIt) +: chatChannels)
    }
  }


  private def addDirectMessage(pageId: PageId, hasSeenIt: Boolean): BareWatchbar = {
    if (directMessages.exists(_.pageId == pageId)) {
      if (hasSeenIt) markPageAsSeen(pageId)
      else this
    }
    else {
      copy(directMessages = WatchbarTopic(pageId, unread = !hasSeenIt) +: directMessages)
    }
  }


  def removePageTryKeepInRecent(pageMeta: PageMeta): BareWatchbar = {
    // Private pages shouldn't be shown in the recent list, because once one has left them,
    // they are no longer accessible (because they're private).
    // COULD keep them in the recent list, if is admin?
    val newRecent =
      if (pageMeta.isPrivateGroupTalk) recentTopics.filter(_.pageId != pageMeta.pageId)
      else placeFirstMarkSeen(pageMeta, recentTopics)
    copy(
      recentTopics = newRecent,
      chatChannels = chatChannels.filter(_.pageId != pageMeta.pageId),
      directMessages = directMessages.filter(_.pageId != pageMeta.pageId))
  }


  def markPageAsSeen(pageId: PageId): BareWatchbar = {
    markSeenUnseen(pageId, seen = true)
  }


  def markPageAsUnread(pageId: PageId): BareWatchbar = {
    markSeenUnseen(pageId, seen = false)
  }


  private def markSeenUnseen(pageId: PageId, seen: Boolean): BareWatchbar = {
    def mark(topic: WatchbarTopic) =
      if (topic.pageId == pageId) topic.copy(unread = !seen)
      else topic
    BareWatchbar(
      recentTopics = recentTopics.map(mark),
      notifications = notifications.map(mark),
      chatChannels = chatChannels.map(mark),
      directMessages = directMessages.map(mark))
  }


  private def placeFirstMarkSeen(pageMeta: PageMeta, recentTopics: immutable.Seq[WatchbarTopic])
        : immutable.Seq[WatchbarTopic] = {
    val recentWithout = recentTopics.filter(_.pageId != pageMeta.pageId)
    val newRecent = WatchbarTopic(pageMeta.pageId, unread = false) +: recentWithout
    newRecent take MaxRecentTopics
  }


  def toJsonNoTitles: JsValue = {
    import WatchbarTopic.topicWritesNoTitles
    Json.obj(
      "1" -> recentTopics,
      "2" -> Nil,
      "3" -> Nil,
      "4" -> Nil)
  }
}


object BareWatchbar {

  val MaxRecentTopics = 7

  val empty = BareWatchbar(Nil, Nil, Nil, Nil)

  def withChatChannelAndDirectMessageIds(channelIds: immutable.Seq[PageId],
        messageIds: immutable.Seq[PageId]) =
    BareWatchbar(Nil, Nil,
      chatChannels = channelIds.map(WatchbarTopic(_, unread = false)),
      directMessages = messageIds.map(WatchbarTopic(_, unread = false)))


  /** The json looks like interface WatchbarTopic in model.ts, for example:
    *
    * {
    *   1: [
    *     { pageId: 111 },
    *     { pageId: 222, unread: true },
    *     { pageId: 333, unread: true, notfsToMe: 1 }]
    *   2: [...]
    *   3: [
    *     { pageId: 111, private: true, notfsToMany: 2 }]
    *   4: [
    *     { pageId: 111, numMembers: 3 }]
    * }
    *
    * (and 1:, 2:, ... are WatchbarSection int values)
    */
  def fromJson(json: JsObject): BareWatchbar = {
    import WatchbarTopic.topicReads
    val recentTopicsJson = (json \ WatchbarSection.RecentTopics.toInt.toString).as[JsArray]
    val recentTopics = recentTopicsJson.as[immutable.Seq[WatchbarTopic]]
    BareWatchbar(recentTopics = recentTopics, Nil, Nil, Nil)
  }


  def fromCompactString(string: String): BareWatchbar = {
    if (string == "|||")
      return BareWatchbar.empty
    def toTopics(topicsString: String): immutable.Seq[WatchbarTopic] = {
      val topics = ArrayBuffer[WatchbarTopic]()
      for (string <- topicsString.split(',') ; if string.nonEmpty) {
        val (pageId, flagsString) = string.span(_ != ':')
        val unread = flagsString == ":1"
        topics.append(WatchbarTopic(pageId, unread = unread))
      }
      topics.toVector
    }
    try {
      val parts = string.split('|')
      BareWatchbar(
        // (String.split(char) is a bit weird in that it discards all trailing empty fragments,
        // hence the if >= X and parts(X-1) here.)
        recentTopics = if (parts.length >= 1) toTopics(parts(0)) else Nil,
        notifications = if (parts.length >= 2) toTopics(parts(1)) else Nil,
        chatChannels = if (parts.length >= 3) toTopics(parts(2)) else Nil,
        directMessages = if (parts.length >= 4) toTopics(parts(3)) else Nil)
    }
    catch {
      case _: Exception =>
        // Oh well, Seems I've changed the serialization format.
        BareWatchbar.empty
    }
  }
}
