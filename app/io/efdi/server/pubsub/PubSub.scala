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

package io.efdi.server.pubsub

import akka.actor._
import com.debiki.core.Prelude._
import com.debiki.core._
import debiki.dao.RedisCache
import debiki.{ReactJson, Globals}
import play.api.libs.json.{JsNull, JsValue}
import play.{api => p}
import play.api.libs.json.Json
import play.api.libs.ws.{WSResponse, WS}
import play.api.Play.current
import redis.RedisClient
import scala.collection.{mutable, immutable}
import scala.concurrent.ExecutionContext.Implicits.global
import scala.concurrent.duration._
import ReactJson.JsUser
import PubSubActor._


sealed trait Message {
  def siteId: SiteId
  def toJson: JsValue
  def notifications: Notifications
}


// Remove? Use StorePatchMessage instead?
case class NewPageMessage(
  siteId: SiteId,
  pageId: PageId,
  pageRole: PageRole,
  notifications: Notifications) extends Message {

  def toJson = JsNull
}


case class StorePatchMessage(
  siteId: SiteId,
  toUsersViewingPage: PageId,
  json: JsValue,
  notifications: Notifications) extends Message {

  def toJson = JsNull
}


object PubSub {

  // Not thread safe; only needed in integration tests.
  var testInstanceCounter = 1

  val NchanPublishPort = 81  // [47BKFG2] in docker/dev-nginx/nginx.conf

  /** Starts a PubSub actor (only one is needed in the whole app).
    */
  def startNewActor(actorSystem: ActorSystem, nginxHost: String, redisClient: RedisClient)
        : (PubSubApi, StrangerCounterApi) = {
    val actorRef = actorSystem.actorOf(Props(
      new PubSubActor(nginxHost, redisClient)), name = s"PubSub-$testInstanceCounter")
    actorSystem.scheduler.schedule(60 seconds, 10 seconds, actorRef, DeleteInactiveSubscriptions)
    testInstanceCounter += 1
    (new PubSubApi(actorRef), new StrangerCounterApi(actorRef))
  }

}



class PubSubApi(private val actorRef: ActorRef) {

  private val timeout = 10 seconds

  def userSubscribed(siteId: SiteId, user: User, browserIdData: BrowserIdData) {
    actorRef ! UserSubscribed(siteId, user, browserIdData)
  }

  def unsubscribeUser(siteId: SiteId, user: User, browserIdData: BrowserIdData) {
    actorRef ! UnsubscribeUser(siteId, user, browserIdData)
  }

  def userWatchesPages(siteId: SiteId, userId: UserId, pageIds: Set[PageId]) {
    actorRef ! UserWatchesPages(siteId, userId, pageIds)
  }

  /** Assumes user byId knows about this already; won't publish to him/her. */
  def publish(message: Message, byId: UserId) {
    actorRef ! PublishMessage(message, byId)
  }
}


class StrangerCounterApi(private val actorRef: ActorRef) {

  private val timeout = 10 seconds

  def strangerSeen(siteId: SiteId, browserIdData: BrowserIdData) {
    actorRef ! StrangerSeen(siteId, browserIdData)
  }
}


private case class PublishMessage(message: Message, byId: UserId)
private case class UserWatchesPages(siteId: SiteId, userId: UserId, pageIds: Set[PageId])
private case class UserSubscribed(siteId: SiteId, user: User, browserIdData: BrowserIdData)
private case class UnsubscribeUser(siteId: SiteId, user: User, browserIdData: BrowserIdData)
private case object DeleteInactiveSubscriptions

private case class StrangerSeen(siteId: SiteId, browserIdData: BrowserIdData)


object PubSubActor {

  private class UserWhenPages(val user: User, val when: When, var watchingPageIds: Set[PageId])

}


/** Publishes events to browsers via e.g. long polling or WebSocket. Reqiures nginx and nchan.
  * Assumes an nginx-nchan publish endpoint is available at:
  *   [debiki.nginx.host]:80/-/pubsub/publish/
  *
  * Later:? Poll nchan each minute? to find out which users have disconnected?
  * ((Could add an nchan feature that tells the appserver about this, push not poll?))
  */
class PubSubActor(val nginxHost: String, val redisClient: RedisClient) extends Actor {

  /** Tells when subscriber subscribed. Subscribers are sorted by perhaps-inactive first.
    * We'll push messages only to users who have subscribed (i.e. are online and have
    * connected to the server via e.g. WebSocket).
    */
  private val subscribersBySite =
    mutable.HashMap[SiteId, mutable.LinkedHashMap[UserId, UserWhenPages]]()

  private val watcherIdsByPageSiteId =
    mutable.HashMap[SiteId, mutable.HashMap[PageId, mutable.Set[UserId]]]()

  private def perSiteSubscribers(siteId: SiteId) =
    // Use a LinkedHashMap because sort order = insertion order.
    subscribersBySite.getOrElseUpdate(siteId, mutable.LinkedHashMap[UserId, UserWhenPages]())

  private def perSiteWatchers(siteId: SiteId) =
    watcherIdsByPageSiteId.getOrElseUpdate(siteId, mutable.HashMap[PageId, mutable.Set[UserId]]())

  // Could check what is Nchan's long-polling inactive timeout, if any?
  private val DeleteAfterInactiveMillis = 10 * OneMinuteInMillis


  def receive = {
    case x => dontRestartIfException(x)
  }


  def dontRestartIfException(message: Any) = try message match {
    case UserWatchesPages(siteId, userId, pageIds) =>
      updateWatchedPages(siteId, userId, pageIds)
    case UserSubscribed(siteId, user, browserIdData) =>
      // Mark as online even if this has been done already, to bump it's timestamp.
      RedisCache.forSite(siteId, redisClient).markUserOnlineRemoveStranger(user.id, browserIdData)
      publishUserPresence(siteId, user, Presence.Active)
      subscribeUser(siteId, user)
    case UnsubscribeUser(siteId, user, browserIdData) =>
      RedisCache.forSite(siteId, redisClient).markUserOffline(user.id)
      unsubscribeUser(siteId, user)
      publishUserPresence(siteId, user, Presence.Away)
    case PublishMessage(message: Message, byId: UserId) =>
      publishStorePatchAndNotfs(message, byId)
    case DeleteInactiveSubscriptions =>
      deleteInactiveSubscriptions()
    case StrangerSeen(siteId, browserIdData) =>
      RedisCache.forSite(siteId, redisClient).markStrangerOnline(browserIdData)
  }
  catch {
    case ex: Exception =>
      // Akka would otherwise discard this actor and create another one, but then
      // its state (which is probably fine) gets lost.
      play.api.Logger.error("Error in PubSub actor, not killing it though", ex)
  }


  private def subscribeUser(siteId: SiteId, user: User) {
    val userAndWhenMap = perSiteSubscribers(siteId)
    // Remove and reinsert, so inactive users will be the first ones found when iterating.
    val anyOld = userAndWhenMap.remove(user.id)
    userAndWhenMap.put(user.id, new UserWhenPages(
      user, When.now(), anyOld.map(_.watchingPageIds) getOrElse Set.empty))
  }


  private def unsubscribeUser(siteId: SiteId, user: User) {
    // COULD tell Nchan about this too
    perSiteSubscribers(siteId).remove(user.id)
    updateWatchedPages(siteId, user.id, Set.empty)
  }


  private def publishUserPresence(siteId: SiteId, user: User, presence: Presence) {
    val userAndWhenById = perSiteSubscribers(siteId)
    if (userAndWhenById.contains(user.id))
      return

    // Don't send num-online-strangers. Instead, let it be a little bit inexact so that
    // other people won't know if a user that logged out, stays online or not.
    val toUserIds = userAndWhenById.values.map(_.user.id).toSet - user.id
    sendPublishRequest(siteId, toUserIds, "presence", Json.obj(
      "user" -> JsUser(user),
      "presence" -> presence.toInt))
  }


  private def publishStorePatchAndNotfs(message: Message, byId: UserId) {
    val siteDao = Globals.siteDao(message.siteId)

    COULD // publish notifications.toDelete too (e.g. an accidental mention that gets edited out).
    val notfsReceiverIsOnline = message.notifications.toCreate filter { notf =>
      isUserOnline(message.siteId, notf.toUserId)
    }
    notfsReceiverIsOnline foreach { notf =>
      COULD_OPTIMIZE // later: do only 1 call to siteDao, for all notfs.
      val notfsJson = siteDao.readOnlyTransaction { transaction =>
        ReactJson.notificationsToJson(Seq(notf), transaction).notfsJson
      }
      sendPublishRequest(message.siteId, Set(notf.toUserId), "notifications", notfsJson)
    }

    message match {
      case patchMessage: StorePatchMessage =>
        val userIds = usersWatchingPage(
          patchMessage.siteId, pageId = patchMessage.toUsersViewingPage).filter(_ != byId)
        userIds.foreach(siteDao.markPageAsUnreadInWatchbar(_, patchMessage.toUsersViewingPage))
        sendPublishRequest(patchMessage.siteId, userIds, "storePatch", patchMessage.json)
      case x =>
        unimplemented(s"Publishing ${classNameOf(x)} [EsE4GPYU2]")
    }
  }


  private def updateWatchedPages(siteId: SiteId, userId: UserId, pageIds: Set[PageId]) {
    val watcherIdsByPageId = perSiteWatchers(siteId)
    val oldPageIds =
      perSiteSubscribers(siteId).get(userId).map(_.watchingPageIds) getOrElse Set.empty
    val pageIdsAdded = pageIds -- oldPageIds
    val pageIdsRemoved = oldPageIds -- pageIds
    pageIdsRemoved foreach { pageId =>
      val watcherIds = watcherIdsByPageId.getOrElse(pageId, mutable.Set.empty)
      watcherIds.remove(userId)
      if (watcherIds.isEmpty) {
        watcherIdsByPageId.remove(pageId)
      }
    }
    pageIdsAdded foreach { pageId =>
      val watcherIds = watcherIdsByPageId.getOrElseUpdate(pageId, mutable.Set.empty)
      watcherIds.add(userId)
    }
  }


  private def usersWatchingPage(siteId: SiteId, pageId: PageId): Iterable[UserId] = {
    val watcherIdsByPageId = perSiteWatchers(siteId)
    watcherIdsByPageId.getOrElse(pageId, Nil)
  }


  private def sendPublishRequest(siteId: SiteId, toUserIds: Iterable[UserId], tyype: String,
        json: JsValue) {
    dieIf(siteId contains '.', "EsE7UWY0", "Site id looks like a hostname")
    // Nchan supports publishing to at most 255 channels in one single request, so split in
    // groups of 255 channels. However, for now, split in groups of only 3 channels,
    // to find out if all this seems to work (255 channels -> would never be split, there
    // aren't that many concurrent users right now).
    // (Docs: https://nchan.slact.net/#channel-multiplexing )
    toUserIds.grouped(3 /* later: 255 */) foreach { userIds =>
      // All channels are in the same namespace (regardless of in which Nginx server {..} block
      // the subscription endpoints were declared), therefore we pefix them with the site id,
      // so we won't send any messages to browsers connected to the wrong site. [7YGK082]
      val channelIds = userIds.map(id => s"$siteId-$id")
      val channelsString = channelIds.mkString(",")
      WS.url(s"http://$nginxHost:${PubSub.NchanPublishPort}/-/pubsub/publish/$channelsString")
        .post(Json.obj("type" -> tyype, "data" -> json).toString)
        .map(handlePublishResponse)
        .recover({
          case ex: Exception =>
            p.Logger.warn(s"Error publishing to browsers [EsE0KPU31]", ex)
        })
    }
  }


  private def handlePublishResponse(response: WSResponse) {
    if (response.status < 200 || 299 < response.status) {
      p.Logger.warn(o"""Bad nchan status code after sending publish request [EsE9UKJ2]:
        ${response.status} ${response.statusText} — see the nginx error log for details?
        Response body: '${response.body}""")
    }
  }


  private def isUserOnline(siteId: SiteId, userId: UserId): Boolean =
    perSiteSubscribers(siteId).contains(userId)


  private def deleteInactiveSubscriptions() {
    val now = When.now()
    for ((siteId, userWhenPagesMap) <- subscribersBySite) {
      // LinkedHashMap sort order = perhaps-inactive first.
      userWhenPagesMap removeWhileValue { userWhenPages =>
        if (now.millisSince(userWhenPages.when) < DeleteAfterInactiveMillis) false
        else {
          updateWatchedPages(siteId, userWhenPages.user.id, Set.empty)
          true
        }
      }
    }
  }

}
