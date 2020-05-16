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


sealed abstract class WatchbarSection(val IntVal: Int) { def toInt: Int = IntVal }
object WatchbarSection {
  case object SubCommunities extends WatchbarSection(1)
  case object RecentTopics extends WatchbarSection(2)
  case object ChatChannels extends WatchbarSection(3)
  case object DirectMessages extends WatchbarSection(4)

  def fromInt(value: Int): Option[WatchbarSection] = Some(value match {
    case SubCommunities.IntVal => SubCommunities
    case RecentTopics.IntVal => RecentTopics
    case ChatChannels.IntVal => ChatChannels
    case DirectMessages.IntVal => DirectMessages
    case _ => return None
  })
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

  def subCommunities: immutable.Seq[WatchbarTopic]
  def recentTopics: immutable.Seq[WatchbarTopic]
  def chatChannels: immutable.Seq[WatchbarTopic]
  def directMessages: immutable.Seq[WatchbarTopic]

  lazy val watchedPageIds: Set[PageId] = {
    (subCommunities.map(_.pageId) ++ recentTopics.map(_.pageId) ++
      chatChannels.map(_.pageId) ++ directMessages.map(_.pageId)).toSet
  }

  /** Creates a string like: "12:1,34:1,56abc,de:2|..."
    */
  def toCompactBareWatchbarString: String = {
    val sb = StringBuilder.newBuilder
    def append(topics: immutable.Seq[WatchbarTopic]): Unit = {
      for (topic <- topics) {
        if (sb.nonEmpty && sb.last != '|') sb.append(",")
        sb.append(topic.pageId)
        if (topic.unread) sb.append(":1")
      }
    }
    append(subCommunities)
    sb.append('|')
    append(recentTopics)
    sb.append('|')
    append(chatChannels)
    sb.append('|')
    append(directMessages)
    sb.toString()
  }
}



case class WatchbarWithTitles(
  subCommunities: immutable.Seq[WatchbarTopic],
  recentTopics: immutable.Seq[WatchbarTopic],
  chatChannels: immutable.Seq[WatchbarTopic],
  directMessages: immutable.Seq[WatchbarTopic],
  titlesEtcById: Map[PageId, PageTitleRole]) extends Watchbar {


  def toJsonWithTitles: JsValue = {
    Json.obj(
      "1" -> subCommunities.map(topicToJsonWithTitleEtc),
      "2" -> recentTopics.map(topicToJsonWithTitleEtc),
      "3" -> chatChannels.map(topicToJsonWithTitleEtc),
      "4" -> directMessages.map(topicToJsonWithTitleEtc))
  }


  private def topicToJsonWithTitleEtc(topic: WatchbarTopic): JsValue = {
    val titleEtc = titlesEtcById.getOrElse(topic.pageId, NoTitleEtc)
    Json.obj(
      "pageId" -> topic.pageId,
      "title" ->  titleEtc.title,
      "type" -> titleEtc.role.toInt,
      "private" -> false,
      "numMembers" -> 0,
      "unread" -> topic.unread)
  }


  /** Used if a page has been deleted or made private, so that title etc is no longer available */
  private def NoTitleEtc = new PageTitleRole {
    def title = "(page gone, DwM5YKW24)"
    def role: PageType = PageType.Discussion
  }
}



case class BareWatchbar(
  subCommunities: immutable.Seq[WatchbarTopic],
  recentTopics: immutable.Seq[WatchbarTopic],
  chatChannels: immutable.Seq[WatchbarTopic],
  directMessages: immutable.Seq[WatchbarTopic]) extends Watchbar {


  def addTitlesEtc(titlesEtcById: Map[PageId, PageTitleRole]) = WatchbarWithTitles(
    subCommunities, recentTopics, chatChannels, directMessages, titlesEtcById)


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
      // The very first time one visits a sub community, auto add it to the communities
      // section. When one leaves it, it gets moved to the recent section. So,
      // if a forum = sub community is in the recent section, that means we've left it.  [5JKW20Z]
      // Then don't add it back to the communities section (until the user re-joins it explicitly).
      else if (pageMeta.pageType == PageType.Forum && !isInRecentSection(pageMeta.pageId)) {
        copy(subCommunities = placeFirstMarkSeen(pageMeta, subCommunities))
      }
      else if (isInOtherThanRecentSection(pageMeta.pageId)) {
        // Then it'll be shown in that other section only. Don't place it first in the Recent
        // section — that might remove something else from that section (because max topics limit).
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


  private def isInRecentSection(pageId: PageId): Boolean = {
    recentTopics.exists(_.pageId == pageId)
  }


  private def isInOtherThanRecentSection(pageId: PageId): Boolean = {
    // (skip subCommunities)
    if (chatChannels.exists(_.pageId == pageId)) return true
    if (directMessages.exists(_.pageId == pageId)) return true
    false
  }


  def addPage(pageMeta: PageMeta, hasSeenIt: Boolean): BareWatchbar =
    addPage(pageMeta.pageId, pageMeta.pageType, hasSeenIt)


  def addPage(pageId: PageId, pageRole: PageType, hasSeenIt: Boolean): BareWatchbar = {
    if (pageRole == PageType.Forum) {
      addSubCommunity(pageId, hasSeenIt)
    }
    else if (pageRole.isChat) {
      addChatChannel(pageId, hasSeenIt)
    }
    else if (pageRole.isPrivateGroupTalk) {
      addDirectMessage(pageId, hasSeenIt)
    }
    else {
      // Add to recent list? Or do what? (This cannot happen right now.)
      die(s"Unexpected page type: $pageRole", "EsE3PK04W")
    }
  }


  private def addSubCommunity(pageId: PageId, hasSeenIt: Boolean): BareWatchbar = {
    // Dupl code (2KRW0B5), hard to break out function, because of copy(field = ...) below?
    if (subCommunities.exists(_.pageId == pageId)) {
      if (hasSeenIt) markPageAsSeen(pageId)
      else this
    }
    else {
      copy(
        subCommunities = WatchbarTopic(pageId, unread = !hasSeenIt) +: subCommunities,
        recentTopics = recentTopics.filter(_.pageId != pageId))
    }
  }


  private def addChatChannel(pageId: PageId, hasSeenIt: Boolean): BareWatchbar = {
    // Dupl code (2KRW0B5)
    if (chatChannels.exists(_.pageId == pageId)) {
      if (hasSeenIt) markPageAsSeen(pageId)
      else this
    }
    else {
      copy(
        chatChannels = WatchbarTopic(pageId, unread = !hasSeenIt) +: chatChannels,
        recentTopics = recentTopics.filter(_.pageId != pageId))
    }
  }


  private def addDirectMessage(pageId: PageId, hasSeenIt: Boolean): BareWatchbar = {
    // Dupl code (2KRW0B5)
    if (directMessages.exists(_.pageId == pageId)) {
      if (hasSeenIt) markPageAsSeen(pageId)
      else this
    }
    else {
      copy(
        directMessages = WatchbarTopic(pageId, unread = !hasSeenIt) +: directMessages,
        // These are never placed in the recent section? Remove anyway, just in case.
        recentTopics = recentTopics.filter(_.pageId != pageId))
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
      subCommunities = subCommunities.filter(_.pageId != pageMeta.pageId),
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
      subCommunities = subCommunities.map(mark),
      recentTopics = recentTopics.map(mark),
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

  val MaxRecentTopics = 9

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
    val subCommunitiesJson = (json \ WatchbarSection.SubCommunities.toInt.toString).as[JsArray]
    val subCommunities = subCommunitiesJson.as[immutable.Seq[WatchbarTopic]]
    val recentTopicsJson = (json \ WatchbarSection.RecentTopics.toInt.toString).as[JsArray]
    val recentTopics = recentTopicsJson.as[immutable.Seq[WatchbarTopic]]
    // (The rest are filled in by looking at joined-chats and recent-direct-messages in the database.)
    BareWatchbar(subCommunities = subCommunities, recentTopics = recentTopics, Nil, Nil)
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
        subCommunities = if (parts.length >= 1) toTopics(parts(0)) else Nil,
        recentTopics = if (parts.length >= 2) toTopics(parts(1)) else Nil,
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
