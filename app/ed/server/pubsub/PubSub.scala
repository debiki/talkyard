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

package ed.server.pubsub

import akka.actor._
import akka.pattern.ask
import com.debiki.core.Prelude._
import com.debiki.core._
import debiki.dao.RedisCache
import debiki.{Globals, ReactJson}
import play.api.libs.json.{JsNull, JsValue}
import play.{api => p}
import play.api.libs.json.Json
import play.api.libs.ws.{WS, WSResponse}
import play.api.Play.current
import redis.RedisClient
import scala.collection.mutable
import scala.collection.mutable.ArrayBuffer
import scala.concurrent.ExecutionContext.Implicits.global
import scala.concurrent.Future
import scala.concurrent.duration._
import ReactJson.JsUser


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


case class PubSubState(
  subscribersBySite: Map[SiteId, Map[UserId, UserWhenPages]],
  watcherIdsByPageSiteId: Map[SiteId, Map[PageId, Set[UserId]]])



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

  def userSubscribed(siteId: SiteId, user: User, browserIdData: BrowserIdData,
        watchedPageIds: Set[PageId]) {
    actorRef ! UserSubscribed(siteId, user, browserIdData, watchedPageIds)
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

  def debugGetSubscribers(siteId: SiteId): Future[PubSubState] = {
    actorRef ! DebugGetSubscribers(siteId)
    val futureReply: Future[Any] =
      actorRef.ask(DebugGetSubscribers(siteId))(akka.util.Timeout(timeout))
    futureReply.asInstanceOf[Future[PubSubState]]
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
private case class UserSubscribed(siteId: SiteId, user: User, browserIdData: BrowserIdData,
  watchedPageIds: Set[PageId])
private case class UnsubscribeUser(siteId: SiteId, user: User, browserIdData: BrowserIdData)
private case object DeleteInactiveSubscriptions
private case class DebugGetSubscribers(siteId: SiteId)

private case class StrangerSeen(siteId: SiteId, browserIdData: BrowserIdData)


case class UserWhenPages(user: User, when: When, watchingPageIds: Set[PageId]) {
  override def toString: String =
    o"""(@${user.anyUsername getOrElse "-"}:${user.id} at ${toIso8601T(when.toJavaDate)}
        watches: ${ watchingPageIds.mkString(",") })"""
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
  private val subscribersBySiteUserId =
    mutable.HashMap[SiteId, mutable.LinkedHashMap[UserId, UserWhenPages]]()

  private val pageWatcherIdsBySitePageId =
    mutable.HashMap[SiteId, mutable.HashMap[PageId, mutable.Set[UserId]]]()

  private def subscribersByIdForSite(siteId: SiteId) =
    // Use a LinkedHashMap because sort order = insertion order.
    subscribersBySiteUserId.getOrElseUpdate(siteId, mutable.LinkedHashMap[UserId, UserWhenPages]())

  private def perSiteWatchers(siteId: SiteId) =
    pageWatcherIdsBySitePageId.getOrElseUpdate(siteId, mutable.HashMap[PageId, mutable.Set[UserId]]())

  // Could check what is Nchan's long-polling inactive timeout, if any?
  private val DeleteAfterInactiveMillis = 10 * OneMinuteInMillis


  def receive: PartialFunction[Any, Unit] = {
    case x => dontRestartIfException(x)
  }


  def dontRestartIfException(message: Any): Unit = try message match {
    case UserWatchesPages(siteId, userId, pageIds) =>
      updateWatchedPages(siteId, userId, pageIds)
    case UserSubscribed(siteId, user, browserIdData, watchedPageIds) =>
      // Mark as online even if this has been done already, to bump it's timestamp.
      RedisCache.forSite(siteId, redisClient).markUserOnlineRemoveStranger(user.id, browserIdData)
      publishUserPresence(siteId, Some(user), Presence.Active)
      val oldPageIds = addOrUpdateSubscriber(siteId, user, watchedPageIds)
      updateWatcherIdsByPageId(siteId, user.id, oldPageIds = oldPageIds, watchedPageIds)
    case UnsubscribeUser(siteId, user, browserIdData) =>
      RedisCache.forSite(siteId, redisClient).markUserOffline(user.id)
      val oldPageIds = removeSubscriber(siteId, user)
      updateWatcherIdsByPageId(siteId, user.id, oldPageIds = oldPageIds, Set.empty)
      publishUserPresence(siteId, Some(user), Presence.Away)
    case PublishMessage(message: Message, byId: UserId) =>
      publishStorePatchAndNotfs(message, byId)
    case DeleteInactiveSubscriptions =>
      deleteInactiveSubscriptions()
    case DebugGetSubscribers(siteId) =>
      val state: PubSubState = debugMakeState(siteId)
      sender ! state
    case StrangerSeen(siteId, browserIdData) =>
      RedisCache.forSite(siteId, redisClient).markStrangerOnline(browserIdData)
  }
  catch {
    case ex: Exception =>
      // Akka would otherwise discard this actor and create another one, but then
      // its state (which is probably fine) gets lost.
      play.api.Logger.error("Error in PubSub actor, not killing it though", ex)
  }


  private def updateWatchedPages(siteId: SiteId, userId: UserId, newPageIds: Set[PageId]) {
    val subscribersById = subscribersByIdForSite(siteId)
    val oldEntry: UserWhenPages = subscribersById.getOrElse(userId, {
      // Not yet subscribed. Do nothing, right now. Soon the browser js should subscribe to
      // events, and *then* We'll remember the set-of-watched-pages. (No point in trying to
      // send events, before has subscribed.)
      return
    })
    subscribersById.put(userId, oldEntry.copy(watchingPageIds = newPageIds))
    updateWatcherIdsByPageId(siteId, userId, oldPageIds = oldEntry.watchingPageIds, newPageIds)
  }


  private def addOrUpdateSubscriber(siteId: SiteId, user: User, watchedPageIds: Set[PageId])
        : Set[PageId] = {
    val subscribersById = subscribersByIdForSite(siteId)
    // Remove and reinsert, so inactive users will be the first ones found when iterating.
    val oldEntry = subscribersById.remove(user.id)
    subscribersById.put(user.id, UserWhenPages(user, Globals.now(), watchedPageIds))
    oldEntry.map(_.watchingPageIds) getOrElse Set.empty
  }


  private def removeSubscriber(siteId: SiteId, user: User): Set[PageId] = {
    // COULD tell Nchan about this too
    val oldEntry = subscribersByIdForSite(siteId).remove(user.id)
    oldEntry.map(_.watchingPageIds) getOrElse Set.empty
  }


  private def publishUserPresence(siteId: SiteId, users: Iterable[User], presence: Presence) {
    COULD_OPTIMIZE // send just 1 request, list many users.
    users foreach { user =>
      publishUserPresenceImpl(siteId, user, presence)
    }
  }


  private def publishUserPresenceImpl(siteId: SiteId, user: User, presence: Presence) {
    val userAndWhenById = subscribersByIdForSite(siteId)
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


  private def updateWatcherIdsByPageId(siteId: SiteId, userId: UserId, oldPageIds: Set[PageId],
        newPageIds: Set[PageId]) {
    val watcherIdsByPageId = perSiteWatchers(siteId)
    val pageIdsAdded = newPageIds -- oldPageIds
    val pageIdsRemoved = oldPageIds -- newPageIds
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
    SECURITY; SHOULD // extra check that I won't send messages about pages a user may not access.
    dieIf(siteId == NoSiteId, "EsE7UW7Y2", "Cannot send requests to NoSiteId")
    // Nchan supports publishing to at most 255 channels in one single request, so split in
    // groups of 255 channels. However, for now, split in groups of only 3 channels,
    // to find out if all this seems to work (255 channels -> would never be split, there
    // aren't that many concurrent users right now).
    // (Docs: https://nchan.slact.net/#channel-multiplexing )
    toUserIds.grouped(5 /* later: 255 */) foreach { userIds =>
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
    subscribersByIdForSite(siteId).contains(userId)


  /** BUG when user comes back and resubscribes, there might be some/many posts that hen didn't
    * get, whils being un-subscribed for inactivity.
    */
  private def deleteInactiveSubscriptions() {
    val now = Globals.now()
    for ((siteId, subscribersById) <- subscribersBySiteUserId) {
      val unsubscribedUsers = ArrayBuffer[User]()
      // LinkedHashMap sort order = perhaps-inactive first.
      subscribersById removeWhileValue { userWhenPages =>
        if (now.millisSince(userWhenPages.when) < DeleteAfterInactiveMillis) false
        else {
          val user = userWhenPages.user
          unsubscribedUsers.append(user)
          updateWatcherIdsByPageId(
              siteId, user.id, oldPageIds = userWhenPages.watchingPageIds, newPageIds = Set.empty)
          p.Logger.trace(o"""Unsubscribing inactive user
               @${user.anyUsername getOrElse ""}=$siteId:${user.id} [EdDPS_UNSUBINACTV]""")
          true
        }
      }
      publishUserPresence(siteId, unsubscribedUsers, Presence.Away)
    }
  }


  def debugMakeState(siteId: SiteId): PubSubState = {
    val subscribersById =
      Map[UserId, UserWhenPages](subscribersBySiteUserId.getOrElse(siteId, Map.empty).toSeq: _*)
    val watcherIdsByPageId =
      Map[PageId, Set[UserId]](
        pageWatcherIdsBySitePageId.getOrElse(siteId, Map.empty).map(keyValue => {
         keyValue._1 -> Set(keyValue._2.toSeq: _*)
        }).toSeq: _*)
    PubSubState(
      subscribersBySite = Map[SiteId, Map[UserId, UserWhenPages]](siteId -> subscribersById),
      watcherIdsByPageSiteId = Map[SiteId, Map[PageId, Set[UserId]]](siteId -> watcherIdsByPageId))
  }

}
