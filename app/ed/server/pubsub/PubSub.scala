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
import akka.stream.scaladsl.SourceQueueWithComplete
import com.debiki.core.Prelude._
import com.debiki.core._
import debiki.dao.RedisCache
import debiki.{Globals, JsonMaker}
import play.api.libs.json.{JsNull, JsString, JsValue, Json}
import play.api.libs.ws.{WSClient, WSResponse}
import redis.RedisClient
import scala.collection.mutable
import scala.collection.immutable
import scala.concurrent.{ExecutionContext, Future}
import scala.concurrent.duration._
import talkyard.server.JsX.JsUser
import talkyard.server.TyLogger


sealed trait Message {
  def siteId: SiteId
  def toJson: JsValue
  def notifications: Notifications
}


case class NewPageMessage(
  siteId: SiteId,
  notifications: Notifications) extends Message {

  def toJson: JsValue = JsNull
}


case class StorePatchMessage(
  siteId: SiteId,
  toUsersViewingPage: PageId,
  json: JsValue,
  notifications: Notifications) extends Message {

  def toJson: JsValue = JsNull
}


case class PubSubState(
  subscribersBySite: Map[SiteId, Map[UserId, WebSocketClient]],
  watcherIdsByPageSiteId: Map[SiteId, Map[PageId, Set[UserId]]])



object PubSub {

  // Not thread safe; only needed in integration tests.
  var testInstanceCounter = 1

  /** Starts a PubSub actor (only one is needed in the whole app).
    */
  def startNewActor(globals: Globals, nginxHost: String)
        : (PubSubApi, ActorRef, StrangerCounterApi) = {
    implicit val execCtx: ExecutionContext = globals.executionContext
    val actorRef = globals.actorSystem.actorOf(Props(
      new PubSubActor(nginxHost, globals)), name = s"PubSub-$testInstanceCounter")
    globals.actorSystem.scheduler.scheduleWithFixedDelay(60.seconds, 10.seconds, actorRef, DeleteInactiveSubscriptions)
    testInstanceCounter += 1
    (new PubSubApi(actorRef), actorRef, new StrangerCounterApi(actorRef))
  }

}



class PubSubApi(private val actorRef: ActorRef) {

  private val timeout = 10.seconds

  SHOULD; PRIVACY // change from site id to publ site id [5UKFBQW2].

  def userSubscribed(whoSubscribed: UserSubscribed) {
    actorRef ! whoSubscribed
  }

  def unsubscribeUser(siteId: SiteId, user: Participant, browserIdData: BrowserIdData) {
    actorRef ! UnsubscribeUser(siteId, user, browserIdData)
  }

  def userWatchesPages(siteId: SiteId, userId: UserId, pageIds: Set[PageId]) {
    actorRef ! UserWatchesPages(siteId, userId, pageIds)
  }

  def userIsActive(siteId: SiteId, user: Participant, browserIdData: BrowserIdData) {
    actorRef ! UserIsActive(siteId, user, browserIdData)
  }

  /** Assumes user byId knows about this already; won't publish to him/her. */
  def publish(message: Message, byId: UserId) {
    actorRef ! PublishMessage(message, byId)
  }

  def closeWebSocketConnections() {
    actorRef ! CloseWebSocketConnections
  }

  def debugGetSubscribers(siteId: SiteId): Future[PubSubState] = {
    actorRef ! DebugGetSubscribers(siteId)
    val futureReply: Future[Any] =
      actorRef.ask(DebugGetSubscribers(siteId))(akka.util.Timeout(timeout))
    futureReply.asInstanceOf[Future[PubSubState]]
  }
}


class StrangerCounterApi(private val actorRef: ActorRef) {

  def strangerSeen(siteId: SiteId, browserIdData: BrowserIdData) {
    actorRef ! StrangerSeen(siteId, browserIdData)
  }
}


private case class PublishMessage(message: Message, byId: UserId)

private case class UserWatchesPages(
  siteId: SiteId, userId: UserId, pageIds: Set[PageId])

private case class UserIsActive(
  siteId: SiteId, user: Participant, browserIdData: BrowserIdData)

case class UserSubscribed(
  siteId: SiteId,
  user: Participant,
  browserIdData: BrowserIdData,
  watchedPageIds: Set[PageId],
  wsOut: SourceQueueWithComplete[JsValue])

private case class UnsubscribeUser(
  siteId: SiteId, user: Participant, browserIdData: BrowserIdData)

private case object DeleteInactiveSubscriptions

private case class DebugGetSubscribers(siteId: SiteId)

private case class StrangerSeen(siteId: SiteId, browserIdData: BrowserIdData)

private case object CloseWebSocketConnections



/** Keeps track of what pages this user should get notified about, and
  * when hen connected, and idle time / last activity time.
  *
  * Plus the WebSocket send-messages channel.
  */
case class WebSocketClient(
  user: Participant,
  connectedAt: When,
  activeAt: When,
  watchingPageIds: Set[PageId],
  wsOut: SourceQueueWithComplete[JsValue]) {

  override def toString: String =
    o"""${user.nameHashId},
        connected: ${toIso8601T(connectedAt.toJavaDate)},
        active: ${toIso8601T(activeAt.toJavaDate)},
        watches: [${watchingPageIds.mkString(", ")}]"""
}



/** Publishes events via WebSocket.
  */
class PubSubActor(val nginxHost: String, val globals: Globals) extends Actor {

  private val logger = TyLogger("PubSubActor")

  def wsClient: WSClient = globals.wsClient
  def redisClient: RedisClient = globals.redisClient

  private implicit val execCtx: ExecutionContext = globals.executionContext


  /** Users connected via WebSocket, sorted by perhaps-*in*active first.
    */
  private val clientsByUserIdBySiteId =
    mutable.HashMap[SiteId, mutable.LinkedHashMap[UserId, WebSocketClient]]()
  // Sync ---^  with --v
  private val clientsBySiteUserIdOldestFirst =
    mutable.LinkedHashMap[SiteUserId, WebSocketClient]()


  // Includes all pages in the user's watchbar, so we should be pushing updates  [8YDVP2A]
  // to all pages in the user's React store, also those other than the one currently displayed.
  private val watcherIdsByPageIdBySiteId =
    mutable.HashMap[SiteId, mutable.HashMap[PageId, mutable.Set[UserId]]]()

  private def clientsByUserIdForSite(siteId: SiteId) =
    // Use a LinkedHashMap because sort order = insertion order.
    clientsByUserIdBySiteId.getOrElseUpdate(
        siteId, mutable.LinkedHashMap[UserId, WebSocketClient]())

  private def perSiteWatchers(siteId: SiteId) =
    watcherIdsByPageIdBySiteId.getOrElseUpdate(siteId, mutable.HashMap[PageId, mutable.Set[UserId]]())

  // Could check what is Nchan's long-polling inactive timeout, if any?
  private val DeleteAfterInactiveMillis = 10 * OneMinuteInMillis

  private def redisCacheForAllSites =
    RedisCache.forAllSites(redisClient, () => globals.now())

  private def redisCacheForSite(siteId: SiteId) =
    RedisCache.forSite(siteId, redisClient, () => globals.now())


  def receive: PartialFunction[Any, Unit] = {
    case x => dontRestartIfException(x)
  }


  private def dontRestartIfException(message: Any): Unit = try message match {
    case UserWatchesPages(siteId, userId, pageIds) =>
      val user = globals.siteDao(siteId).getParticipant(userId) getOrElse { return }
      updateWatchedPages(siteId, userId, pageIds)
      publishPresenceIfChanged(siteId, Some(user), Presence.Active)
      redisCacheForSite(siteId).markUserOnline(user.id)
    case UserIsActive(siteId, user, browserIdData) =>
      publishPresenceIfChanged(siteId, Some(user), Presence.Active)
      redisCacheForSite(siteId).markUserOnlineRemoveStranger(user.id, browserIdData)
    case UserSubscribed(siteId, user, browserIdData, watchedPageIds, wsOut) =>
      // If the user is subscribed already, delete the old WebSocket connection
      // and use this new one instead. [ONEWSCON]
      // (If the user is subscribed already — that indicates hen has Ty open in different
      // browsers? Because each browser should need just one connection: the service
      // worker's connection. — Keeping DoS attacks in mind, better allow just one
      // connection per user, for now at least? )

      // .... wip ....

      // Mark as subscribed, even if this has been done already, to bump it's timestamp.
      val oldPageIds = addOrUpdateSubscriber(siteId, user, watchedPageIds, wsOut)
      updateWatcherIdsByPageId(siteId, user.id,
        oldPageIds = oldPageIds, watchedPageIds)
      // delete any old ws

      // Don't mark user as online in Redis, and don't publish presence — because these
      // subscription requests are automatic. And, after app server restart, the app server's
      // caches are empty, so it'll seem as if the user just connected (even though hen might
      // have been connected but inactive, for long).
    case UnsubscribeUser(siteId, user, browserIdData) =>
      val oldPageIds = removeSubscriber(siteId, user)
      updateWatcherIdsByPageId(siteId, user.id, oldPageIds = oldPageIds, Set.empty)
      // delete any old ws
      // This, though, (in comparison to UserSubscribed) means the user logged out. So publ presence.
      redisCacheForSite(siteId).markUserOffline(user.id)
      publishPresenceAlways(siteId, Some(user), Presence.Away)
    case PublishMessage(message: Message, byId: UserId) =>
      publishStorePatchAndNotfs(message, byId)
    case DeleteInactiveSubscriptions =>
      deleteInactiveSubscriptions()
      removeInactiveUserFromRedisPublishAwayPresence()
    case DebugGetSubscribers(siteId) =>
      val state: PubSubState = debugMakeState(siteId)
      sender ! state
    case StrangerSeen(siteId, browserIdData) =>
      redisCacheForSite(siteId).markStrangerOnline(browserIdData)
    case CloseWebSocketConnections =>
      // In dev and test, unless closing all WebSockets, they can linger
      // across Play app reload — confusing.
      clientsBySiteUserIdOldestFirst.valuesIterator foreach { client =>
        client.wsOut.complete()
      }
  }
  catch {
    case ex: Exception =>
      // Akka would otherwise discard this actor and create another one, but then
      // its state (which is probably fine) gets lost.
      logger.error("Error in PubSub actor [TyEPUBCATCH]", ex)
  }


  private def updateWatchedPages(siteId: SiteId, userId: UserId, newPageIds: Set[PageId]) {
    val clientsById = clientsByUserIdForSite(siteId)
    val oldEntry: WebSocketClient = clientsById.getOrElse(userId, {
      // Not yet subscribed. Do nothing, right now. Soon the browser js should subscribe to
      // events, and *then* We'll remember the set-of-watched-pages. (No point in
      // remembering watched pages, before user has subscribed and it's time to send events.)
      return
    })
    val updatedEntry = oldEntry.copy(watchingPageIds = newPageIds)

    // Woud want to sort again?
    clientsById.put(userId, updatedEntry)
    clientsBySiteUserIdOldestFirst.put(SiteUserId(siteId, userId), updatedEntry)

    updateWatcherIdsByPageId(siteId, userId, oldPageIds = oldEntry.watchingPageIds, newPageIds)
  }


  /** Returns any previously watched pages.
    */
  private def addOrUpdateSubscriber(siteId: SiteId, user: Participant,
        watchedPageIds: Set[PageId], wsOut: SourceQueueWithComplete[JsValue])
        : Set[PageId] = {
    traceLog(siteId, s"Adding/updating subscriber ${user.nameHashId} [TyDADUPSUBSC]")

    val subscribersById = clientsByUserIdForSite(siteId)
    val now = globals.now()

    // Remove and reinsert, so inactive users will be the first ones found when iterating.
    val oldEntry = subscribersById.remove(user.id)
    clientsBySiteUserIdOldestFirst.remove(SiteUserId(siteId, user.id))

    // At most one WebSocket connection per user, for now. A browser needs just one,
    // from its service worker (if available).

    // BUT does the browser understand to reconnect after this!

    val (connectedSince, oldPageIds: Set[PageId]) = oldEntry map { entry =>
      traceLog(siteId,
          s"Closing old WebSocket connection to ${user.nameHashId} [TyDWSCLOSEOLD]")
      entry.wsOut.offer(JsString("Please reconnect"))
      entry.wsOut.complete()
      (entry.connectedAt, entry.watchingPageIds)
    } getOrElse (now, immutable.Set.empty)

    val newEntry = WebSocketClient(user, connectedSince, activeAt = now, watchedPageIds, wsOut)

    subscribersById.put(user.id, newEntry)
    clientsBySiteUserIdOldestFirst.put(SiteUserId(siteId, user.id), newEntry)

    oldPageIds
  }


  private def removeSubscriber(siteId: SiteId, user: Participant): Set[PageId] = {
    // COULD tell Nchan about this too
    traceLog(siteId, s"Removing subscriber ${user.nameHashId} [TyDRMSUBSC]")
    clientsBySiteUserIdOldestFirst.remove(SiteUserId(siteId, user.id))
    val oldEntry = clientsByUserIdForSite(siteId).remove(user.id)
    oldEntry.map(_.watchingPageIds) getOrElse Set.empty
  }


  private def publishPresenceIfChanged(siteId: SiteId, users: Iterable[Participant], newPresence: Presence) {
    COULD_OPTIMIZE // send just 1 request, list many users. (5JKWQU01)
    users foreach { user =>
      val isActive = redisCacheForSite(siteId).isUserActive(user.id)
      if (isActive && newPresence != Presence.Active || !isActive && newPresence != Presence.Away) {
        publishPresenceImpl(siteId, user, newPresence)
      }
    }
  }


  private def publishPresenceAlways(siteId: SiteId, users: Iterable[Participant], newPresence: Presence) {
    COULD_OPTIMIZE // send just 1 request, list many users. (5JKWQU01)
    users foreach { user =>
      publishPresenceImpl(siteId, user, newPresence)
    }
  }


  private def publishPresenceImpl(siteId: SiteId, user: Participant, presence: Presence) {
    // Don't send num-online-strangers. Instead, let it be a little bit inexact so that
    // other people won't know if a user that logged out, stays online or not.
    // No. *Do* send num-strangers-online. Otherwise I get confused and think here's some bug :-/.
    // Do later...
    val clientsByUserId = clientsByUserIdForSite(siteId)
    val toUserIds = clientsByUserId.keySet - user.id
    traceLog(siteId, s"Pupl presence ${user.nameHashId}: $presence [TyDPRESCNS]")

    sendPublishRequest(siteId, toUserIds, "presence", Json.obj(
      "user" -> JsUser(user),
      "presence" -> presence.toInt))
  }


  private def publishStorePatchAndNotfs(message: Message, byId: UserId) {
    val siteDao = globals.siteDao(message.siteId)

    COULD // publish notifications.toDelete too (e.g. an accidental mention that gets edited out).
    val notfsReceiverIsOnline = message.notifications.toCreate filter { notf =>
      isUserOnline(message.siteId, notf.toUserId) &&
        // The browser doesn't want review task notifications; they're for sending emails only.
        // UX COULD send an updated num-pending-review-tasks counter, though?
        !notf.tyype.isAboutReviewTask
    }
    notfsReceiverIsOnline foreach { notf =>
      COULD_OPTIMIZE // later: do only 1 call to siteDao, for all notfs.
      val notfsJson = siteDao.readOnlyTransaction { transaction =>
        JsonMaker.notificationsToJson(Seq(notf), transaction).notfsJson
      }

      def lazyMessage = s"Publ notifications to $lazyPrettyUser [TyDPUBLNTFS]"
      def lazyPrettyUser = anyPrettyUser(siteDao.getParticipant(notf.toUserId), notf.toUserId)
      traceLog(message.siteId, lazyMessage)

      sendPublishRequest(message.siteId, Set(notf.toUserId), "notifications", notfsJson)
    }

    message match {
      case patchMessage: StorePatchMessage =>
        val userIds = usersWatchingPage(
          patchMessage.siteId, pageId = patchMessage.toUsersViewingPage).filter(_ != byId)
        userIds.foreach(siteDao.markPageAsUnreadInWatchbar(_, patchMessage.toUsersViewingPage))

        def lazyMessage = s"Publ storePatch to ${lazyPrettyUsers.mkString(", ")} [TyDPUBLPTCH]"
        def lazyPrettyUsers: Iterable[String] = userIds.map(id => anyPrettyUser(siteDao.getParticipant(id), id))
        traceLog(message.siteId, lazyMessage)

        sendPublishRequest(patchMessage.siteId, userIds, "storePatch", patchMessage.json)

      case newPageMessage: NewPageMessage =>
        COULD // send a patch to everyone looking at the topic list, so they'll
        // notice this new topic. (Unless it's private.)
        // Exclude private page members though — they got notified above,
        // via the notifications list.
      case x =>
        unimplemented(s"Publishing ${classNameOf(x)} [TyEPUBWHAT]")
    }
  }


  private def updateWatcherIdsByPageId(siteId: SiteId, userId: UserId, oldPageIds: Set[PageId],
        newPageIds: Set[PageId]) {
    val watcherIdsByPageId = perSiteWatchers(siteId)
    val pageIdsAdded = newPageIds -- oldPageIds
    val pageIdsRemoved = oldPageIds -- newPageIds

    def lazyPrettyUser: String = anyPrettyUser(globals.siteDao(siteId).getParticipant(userId), userId)
    traceLog(siteId,
        s"$lazyPrettyUser starts watching pages: $pageIdsAdded, stopped: $pageIdsRemoved [TyDWTCHPGS]")

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

    val usersById: collection.Map[UserId, WebSocketClient] =
      clientsByUserIdBySiteId.getOrElse(siteId, Map.empty)

    toUserIds foreach { userId =>
      usersById.get(userId) match {
        case None =>
        case Some(wsClient) =>
          val message = Json.obj(
            "type" -> tyype,
            "data" -> json)
          wsClient.wsOut.offer(message)
      }
    }
  }


  private def isUserOnline(siteId: SiteId, userId: UserId): Boolean =
    clientsBySiteUserIdOldestFirst.contains(SiteUserId(siteId, userId))


  /** BUG when user comes back and resubscribes, there might be some/many posts that hen didn't
    * get, whils being un-subscribed for inactivity.
    *
    * Need to cache them. But not for too long. [WSMSGQ]
    */
  private def deleteInactiveSubscriptions() {
    // Later:
    // If > X in total, delete the inactive ones older than day?
    // Thereafter, for each site:
    // Delete the oldest ones, until at most X active?
    // Sth like that...

    // If a client disconnects, no need to remember messages for that
    // client for longer than it's give-up timeout.  [5AR20ZJ]

    // For now:

    val numToRemove = clientsBySiteUserIdOldestFirst.size - 200

    clientsBySiteUserIdOldestFirst.removeAtMostWhile(numToRemove, {
          case (siteUserId, client) =>

      val siteId = siteUserId.siteId
      val user = client.user
      traceLog(siteId, o"""Closing WS for ${user.nameHashId}, was connected
          since: ${client.connectedAt}, last active: ${client.activeAt} [TyMUNSUB]""")
      client.wsOut.complete()

      clientsByUserIdBySiteId.get(siteId).map(_.remove(siteUserId.userId))
      updateWatcherIdsByPageId(
        siteId, user.id, oldPageIds = client.watchingPageIds, newPageIds = Set.empty)

      // For now, remove all numToRemove. Later, maybe allow at most N per site?
      true
    })

    /*
    val now = globals.now()

    for ((siteId, subscribersById) <- clientsByUserIdBySiteId) {
      // LinkedHashMap sort order = perhaps-inactive first.
      subscribersById removeWhileValue { userWhenPages =>
        if (now.millisSince(userWhenPages.activeAt) < DeleteAfterInactiveMillis) false
        else {
          val user = userWhenPages.user
          traceLog(siteId, s"Unsubscribing inactive ${user.nameHashId} [TyDUNSUBINACTV]")
          updateWatcherIdsByPageId(
              siteId, user.id, oldPageIds = userWhenPages.watchingPageIds, newPageIds = Set.empty)
          clientsBySiteUserIdOldestFirst.remove(SiteUserId(siteId, user.id))
          true
        }
      }
    } */
  }


  /** Marks the user as inactive. However the user might still be connected via WebSocket or
    * Long Polling. It's just that apparently hen is doing something else right now.
    */
  private def removeInactiveUserFromRedisPublishAwayPresence() {
    val inactiveUserIdsBySite = redisCacheForAllSites.removeNoLongerOnlineUserIds()
    for ((siteId, userIds) <- inactiveUserIdsBySite ; if userIds.nonEmpty) {
      val users = globals.siteDao(siteId).getUsersAsSeq(userIds)
      // Not publishPresenceIfChanged(_), because we know it was just changed.
      publishPresenceAlways(siteId, users, Presence.Away)
    }
  }


  def debugMakeState(siteId: SiteId): PubSubState = {
    val subscribersById =
          Map[UserId, WebSocketClient](
            clientsByUserIdBySiteId.getOrElse(siteId, Map.empty).toSeq: _*)

    val pagesAndWatchers = watcherIdsByPageIdBySiteId.getOrElse(siteId, Map.empty) map {
      watcherIdsByPageId: (PageId, mutable.Set[UserId]) =>
      watcherIdsByPageId._1 -> Set(watcherIdsByPageId._2.toSeq: _*)
    }

    val watcherIdsByPageId =
          Map[PageId, Set[UserId]](pagesAndWatchers.toSeq: _*)

    PubSubState(
        subscribersBySite =
          Map[SiteId, Map[UserId, WebSocketClient]](siteId -> subscribersById),
        watcherIdsByPageSiteId =
          Map[SiteId, Map[PageId, Set[UserId]]](siteId -> watcherIdsByPageId))
  }


  def traceLog(siteId: SiteId, message: => String): Unit =
    logger.trace(s"s$siteId: PubSub: $message")

  private def anyPrettyUser(anyUser: Option[Participant], userId: UserId) = anyUser match {
    case Some(user) => user.nameHashId
    case None => s"missing user #$userId"
  }

}
