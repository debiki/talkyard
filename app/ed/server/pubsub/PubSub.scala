/**
 * Copyright (c) 2015, 2020 Kaj Magnus Lindberg
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
import debiki.dao.{RedisCache, RedisCacheAllSites}
import debiki.{Globals, JsonMaker}
import org.scalactic.ErrorMessage
import play.api.libs.json.{JsNull, JsValue, Json}
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
  toUsersViewingPageId: PageId,
  json: JsValue,
  notifications: Notifications) extends Message {

  def toJson: JsValue = JsNull
}


case class PubSubState(
  clientsByUserIdBySiteId: Map[SiteId, Map[UserId, WebSocketClient]],
  watcherIdsByPageIdBySiteId: Map[SiteId, Map[PageId, Set[UserId]]])

case class ClientsAllSites(
  clientsInactiveFirst: immutable.Seq[(SiteUserId, WebSocketClient)])



object PubSub {

  // Not thread safe; only needed in integration tests.
  var testInstanceCounter = 1

  /** Starts a PubSub actor (only one is needed in the whole app).
    */
  def startNewActor(globals: Globals): (PubSubApi, ActorRef, StrangerCounterApi) = {
    implicit val execCtx: ExecutionContext = globals.executionContext

    val actorRef = globals.actorSystem.actorOf(Props(
            new PubSubActor(globals)), name = s"PubSub-$testInstanceCounter")

    globals.actorSystem.scheduler.scheduleWithFixedDelay(
            60.seconds, 10.seconds, actorRef, DeleteInactiveSubscriptions)

    testInstanceCounter += 1

    (new PubSubApi(actorRef), actorRef, new StrangerCounterApi(actorRef))
  }

}



class PubSubApi(private val actorRef: ActorRef) {

  private val timeout = 10.seconds

  SHOULD; PRIVACY // change from site id to publ site id [5UKFBQW2].

  def mayConnectClient(siteUserId: SiteUserId): Future[AnyProblem] = {
    val futureReply: Future[Any] =
          actorRef.ask(MayConnect(siteUserId))(akka.util.Timeout(timeout))
    futureReply.asInstanceOf[Future[AnyProblem]]
  }

  def userSubscribed(who: UserConnected): Unit = {
    actorRef ! who
  }

  def unsubscribeUser(siteId: SiteId, user: Participant, browserIdData: BrowserIdData): Unit = {
    actorRef ! DisconnectUser(siteId, user, browserIdData)
  }

  def userWatchesPages(siteId: SiteId, userId: UserId, pageIds: Set[PageId]): Unit = {
    actorRef ! UserWatchesPages(siteId, userId, pageIds)
  }

  def userIsActive(siteId: SiteId, user: Participant, browserIdData: BrowserIdData): Unit = {
    actorRef ! UserIsActive(siteId, user, browserIdData)
  }

  /** Assumes user byId knows about this already; won't publish to him/her. */
  def publish(message: Message, byId: UserId): Unit = {
    actorRef ! PublishMessage(message, byId)
  }

  def closeWebSocketConnections(): Unit = {
    actorRef ! CloseWebSocketConnections
  }

  def debugGetSubscribers(siteId: SiteId): Future[PubSubState] = {
    val futureReply: Future[Any] =
          actorRef.ask(DebugGetSubscribers(siteId))(akka.util.Timeout(timeout))
    futureReply.asInstanceOf[Future[PubSubState]]
  }

  def debugGetClientsAllSites(): Future[ClientsAllSites] = {
    val futureReply: Future[Any] =
          actorRef.ask(DebugGetClientsAllSites)(akka.util.Timeout(timeout))
    futureReply.asInstanceOf[Future[ClientsAllSites]]
  }
}


class StrangerCounterApi(private val actorRef: ActorRef) {

  def strangerSeen(siteId: SiteId, browserIdData: BrowserIdData): Unit = {
    actorRef ! StrangerSeen(siteId, browserIdData)
  }
}


private case class MayConnect(siteUserId: SiteUserId)

private case class PublishMessage(message: Message, byId: UserId)

private case class UserWatchesPages(
  siteId: SiteId, userId: UserId, pageIds: Set[PageId])

private case class UserIsActive(
  siteId: SiteId, user: Participant, browserIdData: BrowserIdData)

case class UserConnected(
  siteId: SiteId,
  user: Participant,
  browserIdData: BrowserIdData,
  watchedPageIds: Set[PageId],
  wsOut: SourceQueueWithComplete[JsValue])

private case class DisconnectUser(
  siteId: SiteId, user: Participant, browserIdData: BrowserIdData)

private case object DeleteInactiveSubscriptions

private case class DebugGetSubscribers(siteId: SiteId)

private case object DebugGetClientsAllSites

private case class StrangerSeen(siteId: SiteId, browserIdData: BrowserIdData)

private case object CloseWebSocketConnections



/** Keeps track of what pages this user should get notified about, and
  * when hen connected, and idle time / last activity time.
  *
  * Plus the WebSocket send-messages channel.
  */
case class WebSocketClient(
  user: Participant,
  firstConnectedAt: When,
  connectedAt: When,
  humanActiveAt: When,
  watchingPageIds: Set[PageId],
  wsOut: SourceQueueWithComplete[JsValue]) {

  override def toString: String =
    o"""${user.nameHashId},
        first connected: ${toIso8601T(firstConnectedAt.toJavaDate)},
        connected: ${toIso8601T(connectedAt.toJavaDate)},
        active: ${toIso8601T(humanActiveAt.toJavaDate)},
        watches: [${watchingPageIds.mkString(", ")}]"""

  def toStringPadded: String =
    user.anyUsername.getOrElse("").padTo(Participant.MaxUsernameLength, ' ') +
      " #" + user.id.toString.padTo(5, ' ') + ' ' + o"""
        first connected: ${toIso8601T(firstConnectedAt.toJavaDate)},
        connected: ${toIso8601T(connectedAt.toJavaDate)},
        active: ${toIso8601T(humanActiveAt.toJavaDate)},
        watches: [${watchingPageIds.mkString(", ")}]"""
}



/** Publishes events via WebSocket.
  */
class PubSubActor(val globals: Globals) extends Actor {

  private val logger = TyLogger("PubSubActor")

  def redisClient: RedisClient = globals.redisClient

  private implicit val execCtx: ExecutionContext = globals.executionContext


  /** Users connected via WebSocket.
    *
    * Sorted by perhaps-*in*active first, because LinkedHashMap:
    * """The iterator and all traversal methods of this class visit elements
    * in the order they were inserted."""
    *
    */
  private val clientsByUserIdBySiteId =
    mutable.HashMap[SiteId, mutable.LinkedHashMap[UserId, WebSocketClient]]()
  // Sync ---^  with --v
  private val clientsBySiteUserIdInactiveFirst =
    mutable.LinkedHashMap[SiteUserId, WebSocketClient]()


  // Includes pages in the user's watchbar (the left hand sidebar). A page in the  [8YDVP2A]
  // whatchbar gets highlighted, when there's a new post on that page, and the user
  // doesn't currently have that page open in the browser.
  private val watcherIdsByPageIdBySiteId =
    mutable.HashMap[SiteId, mutable.HashMap[PageId, mutable.Set[UserId]]]()

  private def clientsByUserIdForSite(siteId: SiteId) =
    clientsByUserIdBySiteId.getOrElseUpdate(
          siteId, mutable.LinkedHashMap[UserId, WebSocketClient]())

  private def watcherIdsByPageIdForSite(siteId: SiteId) =
    watcherIdsByPageIdBySiteId.getOrElseUpdate(
          siteId, mutable.HashMap[PageId, mutable.Set[UserId]]())

  private def redisCacheForAllSites: RedisCacheAllSites =
    RedisCache.forAllSites(redisClient, () => globals.now())

  private def redisCacheForSite(siteId: SiteId): RedisCache =
    RedisCache.forSite(siteId, redisClient, () => globals.now())


  def receive: PartialFunction[Any, Unit] = {
    case x => dontRestartIfException(x)
  }


  private def dontRestartIfException(message: Any): Unit = try message match {
    case MayConnect(siteUserId) =>
      val numConnected = clientsBySiteUserIdInactiveFirst.size
      val maxTotal = globals.config.maxWebSocketConnectionsAllSitesTotal
      val anyProblem =
            if (numConnected < maxTotal) Fine
            else {
              QUOTA // Later: Max N per site?  More for large sites?
              val message = "Too many WebSocket clients connected already [TyEREJCTWS]"
              val howMany = s"$numConnected connected"
              logger.warn(s"$message: $howMany")
              Problem(message, siteId = siteUserId.siteId, adminInfo = howMany)
            }
      sender ! anyProblem

    case UserWatchesPages(siteId, userId, pageIds) =>
      val user = globals.siteDao(siteId).getParticipant(userId) getOrElse {
        logger.warn(s"s$siteId: Cannot find user $userId  [TyE60KH8S4[")
        return
      }
      updateWatchedPages(siteId, userId, watchingPageIdsNow = Some(pageIds))

      // Break out fn (305KTSS)
      publishPresenceIfChanged(siteId, Some(user), Presence.Active)
      redisCacheForSite(siteId).markUserOnline(user.id)

    case UserIsActive(siteId, user, browserIdData) =>
      COULD_OPTIMIZE // group incoming activity messages in batches of 10 seconds,
      // and apply them all at once — so won't need to send one WebSocket
      // message per user and activity and receiver. Instead, one per 10 seconds
      // and per receiver? (5JKWQU01)

      // Break out fn (305KTSS) for the rest of this 'case'.

      publishPresenceIfChanged(siteId, Some(user), Presence.Active)
      redisCacheForSite(siteId).markUserOnlineRemoveStranger(user.id, browserIdData)

      // If there's a WebSocket connection, then, move this client
      // to last in the queue, so it'll be the last one found
      // when iterating to remove inactive clients.

      // Remove:
      val clientsById = clientsByUserIdForSite(siteId)
      val anyClientA: Option[WebSocketClient] = clientsById.remove(user.id)
      val anyClientB: Option[WebSocketClient] =
            clientsBySiteUserIdInactiveFirst.remove(SiteUserId(siteId, user.id))

      // Place last: (if possible)
      if (anyClientA.isDefined != anyClientB.isDefined) {
        logger.error(o"""Bug: Per-user-id-per-site-id or per-site-user-id
              client missing: $anyClientA, $anyClientB [TyE603KRSTD4]""")
      }
      else if (anyClientA.isEmpty) {
        // This happens after sever restart — then, the browser continues
        // sending activity messages, but hasn't yet connected to the newly started
        // server. (Maybe happens in other cases too.)
        logger.debug(o"""s$siteId: Got ${user.nameHashId} activity message, but
              there is no such WebSocket client [TyM502RDJ5]""")
      }
      else {
        val clientA = anyClientA.get
        val clientB = anyClientB.get
        if (clientA ne clientB) {
          logger.error(o"""Bug: Different per-user-id-per-site-id and
                per-site-user-id clients: $clientA  and $clientB [TyE50KTD5X7]""")
        }
        // Lastly, place last, by reinserting.
        clientsById.put(user.id, clientA)
        clientsBySiteUserIdInactiveFirst.put(SiteUserId(siteId, user.id), clientB)
      }

    case newClient: UserConnected =>
      // If the user is subscribed already, delete the old WebSocket connection
      // and use this new one instead. [ONEWSCON]
      // (If the user is subscribed already — that indicates hen has Ty open in different
      // browsers? Because each browser should need just one connection: the service
      // worker's connection.  Keeping DoS attacks in mind, let's allow just one
      // connection per user, for now at least? )
      val oldPageIds = connectOrReconnect(newClient)
      updateWatcherIdsByPageId(
            newClient.siteId, newClient.user.id, oldPageIds = oldPageIds,
            newPageIds = newClient.watchedPageIds)

      // Skip:  publishPresence...()  also, don't mark user as online in Redis
      // — because these subscription requests are automatic; can happen also if
      // the human is away. And, after app server restart, the app server's
      // caches are empty, so it'll seem as if the user just connected (even though
      // the human might be away — can be just a browser tab that was left open).

    case DisconnectUser(siteId, user, _ /*browserIdData*/) =>
      val watchedPageIds = disconnect(siteId, user)
      updateWatcherIdsByPageId(
            siteId, user.id, oldPageIds = watchedPageIds, newPageIds = Set.empty)
      redisCacheForSite(siteId).markUserOffline(user.id)
      publishPresenceAlways(siteId, Some(user), Presence.Away)

    case PublishMessage(message: Message, byId: UserId) =>
      publishStorePatchAndNotfs(message, byId)

    case DeleteInactiveSubscriptions =>
      disconnectInactiveWebSockets()
      removeInactiveUserFromRedisPublishAwayPresence()

    case DebugGetSubscribers(siteId) =>
      val state: PubSubState = debugMakeState(siteId)
      sender ! state

    case DebugGetClientsAllSites =>
      sender ! debugMakeStateAllSites()

    case StrangerSeen(siteId, browserIdData) =>
      redisCacheForSite(siteId).markStrangerOnline(browserIdData)

    case CloseWebSocketConnections =>
      // In dev and test, unless closing all WebSockets, they can linger
      // across Play app reload — that can be confusing.
      clientsBySiteUserIdInactiveFirst.valuesIterator foreach { client =>
        client.wsOut.complete() // disconnects
      }
  }
  catch {
    case ex: Exception =>
      // Akka would otherwise discard this actor and create another one, but then
      // its state (which is probably fine) gets lost.
      logger.error("Error in PubSub actor [TyEPUBCATCH]", ex)
  }


  private def updateWatchedPages(siteId: SiteId, userId: UserId,
        watchingPageIdsNow: Option[Set[PageId]] = None,
        stoppedWatchingPageId: Option[PageId] = None): Unit = {

    dieIf(watchingPageIdsNow.isDefined && stoppedWatchingPageId.isDefined, "TyE703RKDHF24")

    // ----- Update WebSocketClient

    val clientsById = clientsByUserIdForSite(siteId)
    val clientBefore: WebSocketClient = clientsById.getOrElse(userId, {
      // Do nothing, not yet any WebSocket. Soon the browser should WebSocket-connect —
      // *thereafter* we'll remember watched pages, and send events.
      logger.debug(
          s"s$siteId: Not updating watched pages for $userId: No WebSocket [TyM503RSKD]")
      return
    })

    val newPageIds = watchingPageIdsNow.getOrElse(
          clientBefore.watchingPageIds - stoppedWatchingPageId.getOrDie("TyE05KTS5JI"))

    val updatedClient = clientBefore.copy(
          watchingPageIds = newPageIds,
          humanActiveAt = globals.now())

    clientsById.put(userId, updatedClient)
    clientsBySiteUserIdInactiveFirst.put(SiteUserId(siteId, userId), updatedClient)

    // ----- Update watchers per page

    updateWatcherIdsByPageId(
        siteId, userId, oldPageIds = clientBefore.watchingPageIds, newPageIds)
  }


  /** Returns any previously watched pages.
    */
  private def connectOrReconnect(newClientData: UserConnected): Set[PageId] = {
    val UserConnected(
          siteId, user, _ /*browserIdData*/, watchedPageIds, wsOut) = newClientData

    val now = globals.now()

    // Disconnect any old WebSocket:

    // At most one WebSocket connection per user, for now. A browser needs just one,
    // from its service worker, if available.

    // (Don't remove() the clients from the LinkedHashMap:s though: We don't
    // want them reinserted and placed last, because reconnecting doesn't
    // necessarily mean the human was active.)

    val clientsByUserId = clientsByUserIdForSite(siteId)
    val anyOldClient = clientsByUserId.get(user.id)

    val (firstConnectedAt, humanActiveAt: When, oldPageIds: Set[PageId]) =
          anyOldClient map { oldClient =>
      traceLog(siteId, s"Closing WebSocket: ${user.nameHashId}, will reconnect [TyMWSXOLD]")
      oldClient.wsOut.complete() // disconnects
      (oldClient.firstConnectedAt, oldClient.humanActiveAt, oldClient.watchingPageIds)
    } getOrElse (
        now, now, immutable.Set.empty)

    // Connect:

    val message =
      if (anyOldClient.isDefined) s"Reconnecting WebSocket: ${user.nameHashId} [TyMWSRECON]"
      else  s"New WebSocket: ${user.nameHashId} [TyMWSNEWCON]"
    traceLog(siteId, message)

    val newClient = WebSocketClient(
          user, firstConnectedAt = firstConnectedAt, connectedAt = now,
          humanActiveAt = humanActiveAt,
          watchedPageIds, wsOut)

    // If client already present, this won't change it's place in the LinkedHashMap.
    clientsByUserId.put(user.id, newClient)
    clientsBySiteUserIdInactiveFirst.put(SiteUserId(siteId, user.id), newClient)

    oldPageIds
  }


  /** Returns the page ids the user was watching.
    */
  private def disconnect(siteId: SiteId, user: Participant): Set[PageId] = {
    val anyClientA = clientsBySiteUserIdInactiveFirst.remove(SiteUserId(siteId, user.id))
    val anyClientB = clientsByUserIdForSite(siteId).remove(user.id)

    if (anyClientA.isDefined != anyClientB.isDefined) {
      logger.error(o"""Bug: Per-user-id-per-site-id or per-site-user-id
            client missing: $anyClientA, $anyClientB [TyE502KTDH4]""")
    }

    if (anyClientA.isEmpty) {
      traceLog(siteId, s"No WebSocket for ${user.nameHashId} to disconnect [TyM05RKDH2]")
      return Set.empty
    }

    val clientA = anyClientA.get
    val clientB = anyClientB.get
    if (clientA ne clientB) {
      logger.error(o"""Bug: Different per-user-id-per-site-id and
            per-site-user-id clients: $clientA  and $clientB [TyE703KDW4]""")
    }

    traceLog(siteId, s"Disconnecting WebSocket for ${user.nameHashId} [TyMRMSUBSC]")
    clientA.wsOut.complete() // disconnects
    clientA.watchingPageIds
  }


  private def publishPresenceIfChanged(siteId: SiteId, users: Iterable[Participant],
        newPresence: Presence): Unit = {
    COULD_OPTIMIZE // send just 1 WebSocket message, list many users. (5JKWQU01)
    users foreach { user =>
      val isActive = redisCacheForSite(siteId).isUserActive(user.id)
      if (isActive && newPresence != Presence.Active ||
          !isActive && newPresence != Presence.Away) {
        publishPresenceImpl(siteId, user, newPresence)
      }
    }
  }


  private def publishPresenceAlways(siteId: SiteId, users: Iterable[Participant], newPresence: Presence): Unit = {
    COULD_OPTIMIZE // send just 1 WebSocket message, list many users. (5JKWQU01)
    users foreach { user =>
      publishPresenceImpl(siteId, user, newPresence)
    }
  }


  private def publishPresenceImpl(siteId: SiteId, user: Participant, presence: Presence): Unit = {
    // Don't send num-online-strangers. Instead, let it be a little bit inexact so that
    // other people won't know if a user that logged out, stays online or not.
    // No. *Do* send num-strangers-online. Otherwise I get confused and think here's some bug :-/.
    // Do later...
    val clientsByUserId = clientsByUserIdForSite(siteId)
    val toUserIds = clientsByUserId.keySet - user.id
    traceLog(siteId, s"Pupl presence ${user.nameHashId}: $presence [TyDPRESCNS]")

    // If some time later, users can be "invisible", stop publishing their
    // presence here.  [PRESPRIV]
    // Compare with pages one may not see: [WATCHSEC].

    sendWebSocketMessage(siteId, toUserIds, "presence", Json.obj(
          "user" -> JsUser(user),
          "presence" -> presence.toInt))
  }


  private def publishStorePatchAndNotfs(message: Message, byId: UserId): Unit = {
    val siteDao = globals.siteDao(message.siteId)

    // ----- Notifications

    // This messages people who got a reply or got @mentioned or sth like that,
    // intended precisely for them.

    COULD // publish notifications.toDelete too (e.g. an accidental mention got edited out).

    val notfsToSend = message.notifications.toCreate filter { notf =>
      // Don't send review task notifications — they're sent via email only, currently.
      // UX COULD send an updated num-pending-review-tasks counter, though?
      !notf.tyype.isAboutReviewTask && isWebSocketConnected(message.siteId, notf.toUserId)
    }

    notfsToSend foreach { notf =>
      COULD_OPTIMIZE // later: do only 1 call to siteDao, for all notfs.
      val notfsJson = siteDao.readOnlyTransaction { tx =>
        JsonMaker.notificationsToJson(Seq(notf), tx).notfsJson
      }

      def lazyMessage = s"Publ notifications to $lazyPrettyUser [TyDPUBLNTFS]"
      def lazyPrettyUser = anyPrettyUser(siteDao.getParticipant(notf.toUserId), notf.toUserId)
      traceLog(message.siteId, lazyMessage)

      sendWebSocketMessage(
            message.siteId, Set(notf.toUserId), "notifications", notfsJson)
    }

    // ----- Page watchers

    // This 1) highlights pages with new posts, in the watchbar (the left sidebar).
    // And 2) ... well that's all, right now.

    message match {
      case patchMessage: StorePatchMessage =>
        val pageId = patchMessage.toUsersViewingPageId
        val userIdsWatching = usersWatchingPage(
              patchMessage.siteId, pageId = pageId).filter(_ != byId)

        // Access control.
        val usersMayMaybeSee = userIdsWatching.flatMap(siteDao.getUser)
        // (Shouldn't be any non-existing users — deleting database row not implemented.)
        val (usersWhoMaySeePage, usersMayNot) = usersMayMaybeSee partition { user =>
          siteDao.getPageMeta(pageId) match {
            case None =>
              // Cannot see a non-existing page.
              false
            case Some(pageMeta) =>
              SEC_TESTS_MISSING  // [WATCHSEC]
              val (maySee, _) = siteDao.maySeePageUseCache(pageMeta, Some(user))
              maySee
          }
        }

        // Remove [user who may no longer see the page] from the page watchers list.
        // (They had access to the page in the past, and started watching it — but now,
        // they may not see it any longer. Apparently, access was revoked.)
        usersMayNot foreach { user =>
          logger.debug(o"""Removing ${user.nameHashId} from page $pageId watchers,
                may not see page [TyM405WKTD2]""")
          updateWatchedPages(message.siteId, user.id, stoppedWatchingPageId = Some(pageId))
        }

        usersWhoMaySeePage foreach { user =>
          siteDao.markPageAsUnreadInWatchbar(user.id, pageId = pageId)
        }

        def lazyMessage = s"Sending page $pageId 'storePatch' to: [${
              usersWhoMaySeePage.map(_.nameHashId).mkString(", ")}]  [TyDPUBLPTCH]"
        traceLog(message.siteId, lazyMessage)

        // Note: Only to usersWhoMaySeePage.
        sendWebSocketMessage(
              patchMessage.siteId, usersWhoMaySeePage.map(_.id), "storePatch", patchMessage.json)

      case _: NewPageMessage =>
        NEXT; COULD // send a patch to everyone looking at the topic list, so they'll
        // notice this new topic. (Unless it's private.)
        // Exclude private page members though — they got notified above,
        // via the notifications list.

        // sendPublishRequest( .... )
        //  — but excl users who may not access the category, see [WATCHSEC] above.

      case x =>
        unimplemented(s"Publishing ${classNameOf(x)} [TyEPUBWHAT]")
    }
  }


  private def updateWatcherIdsByPageId(siteId: SiteId, userId: UserId, oldPageIds: Set[PageId],
        newPageIds: Set[PageId]): Unit = {
    val watcherIdsByPageId = watcherIdsByPageIdForSite(siteId)
    val pageIdsAdded = newPageIds -- oldPageIds
    val pageIdsRemoved = oldPageIds -- newPageIds

    def lazyPrettyUser: String = anyPrettyUser(globals.siteDao(siteId).getParticipant(userId), userId)
    traceLog(siteId, o"""$lazyPrettyUser starts watching pages: $pageIdsAdded,
        stopped: $pageIdsRemoved [TyDWTCHPGS]""")

    pageIdsRemoved foreach { pageId =>
      // If not yet any by-page-id mutable.Set, we do Not insert one: getOrElse(),
      // but not getOrElseUpdate().
      val watcherIds = watcherIdsByPageId.getOrElse(pageId, mutable.Set.empty)
      watcherIds.remove(userId)
      if (watcherIds.isEmpty) {
        watcherIdsByPageId.remove(pageId)
      }
    }
    pageIdsAdded foreach { pageId =>
      // If not yet any by-page-id mutable.Set, we insert one: getOrElseUpdate().
      val watcherIds = watcherIdsByPageId.getOrElseUpdate(pageId, mutable.Set.empty)
      watcherIds.add(userId)
    }
  }


  private def usersWatchingPage(siteId: SiteId, pageId: PageId): Iterable[UserId] = {
    val watcherIdsByPageId = watcherIdsByPageIdForSite(siteId)
    watcherIdsByPageId.getOrElse(pageId, Nil)
  }


  private def sendWebSocketMessage(siteId: SiteId, toUserIds: Iterable[UserId],
        tyype: String, json: JsValue): Unit = {
    dieIf(siteId == NoSiteId, "EsE7UW7Y2", "Cannot send requests to NoSiteId")

    val clientsById: collection.Map[UserId, WebSocketClient] =
      clientsByUserIdBySiteId.getOrElse(siteId, Map.empty)

    toUserIds foreach { userId =>
      clientsById.get(userId) match {
        case None =>
          logger.debug(o"""s$siteId: Cannot WebSocket-message user $userId:
                User not found [TyE4B402RKT4]""")
        case Some(client) =>
          val message = Json.obj(
            "type" -> tyype,
            "data" -> json)
          client.wsOut.offer(message)
      }
    }
  }


  private def isWebSocketConnected(siteId: SiteId, userId: UserId): Boolean =
    clientsBySiteUserIdInactiveFirst.contains(SiteUserId(siteId, userId))


  /** BUG when user comes back and resubscribes, there might be some/many posts that hen didn't
    * get, whils being un-subscribed for inactivity.
    *
    * Need to cache them. But not for too long. [WSMSGQ]
    */
  private def disconnectInactiveWebSockets(): Unit = {
    // Later:
    // If > X in total, delete the inactive ones older than day?
    // Thereafter, for each site:
    // Delete the oldest ones, until at most X active?
    // Sth like that...

    // If a client disconnects, no need to remember messages for that
    // client for longer than it's give-up timeout.  [5AR20ZJ]

    // For now:

    // Trim down to 90% of max, so new WebSocket clients will be accepted, but they'll
    // cause the inactive-for-longest clients to get disconnected.
    val maxTotal = globals.config.maxWebSocketConnectionsAllSitesTotal
    val _90percentOfMax = maxTotal * 90 / 100
    val numToRemove = clientsBySiteUserIdInactiveFirst.size - _90percentOfMax

    clientsBySiteUserIdInactiveFirst.removeAtMostWhile(numToRemove, {
          case (siteUserId, client: WebSocketClient) =>

      val siteId = siteUserId.siteId
      val user = client.user
      traceLog(siteId, o"""Closing WebSocket for ${user.nameHashId}, first connected:
          ${client.firstConnectedAt}, human last active: ${client.humanActiveAt}
          [TyMUNSUB]""")

      client.wsOut.complete() // disconnects

      val clientsByUserId = clientsByUserIdBySiteId.get(siteId)
      val anySameClient = clientsByUserId.flatMap(_.remove(siteUserId.userId))
      if (anySameClient isNotEq client) {
        logger.error(o"""Bug: Different per-user-id-per-site-id and per-site-user-id
              clients: $client  and $anySameClient [TyE603RKHNS4]""")
      }

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
        // (this used to be 10 minutes, *really* short !?)
        if (now.millisSince(userWhenPages.activeAt) < DeleteAfterInactiveMillis) false
        else {
          val user = userWhenPages.user
          traceLog(siteId, s"Unsubscribing inactive ${user.nameHashId} [TyDUNSUBINACTV]")
          updateWatcherIdsByPageId(
              siteId, user.id, oldPageIds = userWhenPages.watchingPageIds, newPageIds = Set.empty)
          clientsBySiteUserIdInactiveFirst.remove(SiteUserId(siteId, user.id))
          true
        }
      }
    } */
  }


  /** Marks the user as inactive. However the user might still be connected via WebSocket or
    * Long Polling. It's just that apparently hen is doing something else right now.
    */
  private def removeInactiveUserFromRedisPublishAwayPresence(): Unit = {
    val inactiveUserIdsBySite = redisCacheForAllSites.removeNoLongerOnlineUserIds()
    for ((siteId, userIds) <- inactiveUserIdsBySite ; if userIds.nonEmpty) {
      val users = globals.siteDao(siteId).getUsersAsSeq(userIds)
      // Not publishPresenceIfChanged(_), because we know it was just changed.
      publishPresenceAlways(siteId, users, Presence.Away)
    }
  }


  /** Returns clients for on site only.
    */
  def debugMakeState(siteId: SiteId): PubSubState = {
    // Convert to immutable structures:

    val clientsByUserId =
          Map[UserId, WebSocketClient](
            clientsByUserIdBySiteId.getOrElse(siteId, Map.empty).toSeq: _*)

    val pagesAndWatchers = watcherIdsByPageIdBySiteId.getOrElse(siteId, Map.empty) map {
          watcherIdsByPageId: (PageId, mutable.Set[UserId]) =>
      watcherIdsByPageId._1 -> Set(watcherIdsByPageId._2.toSeq: _*)
    }

    val watcherIdsByPageId =
          Map[PageId, Set[UserId]](pagesAndWatchers.toSeq: _*)

    PubSubState(
        clientsByUserIdBySiteId =
          Map[SiteId, Map[UserId, WebSocketClient]](siteId -> clientsByUserId),
        watcherIdsByPageIdBySiteId =
          Map[SiteId, Map[PageId, Set[UserId]]](siteId -> watcherIdsByPageId))
  }


  /** Returns clients for all sites — but no per site watchers, only clients by
    * recent-active-last.
    */
  def debugMakeStateAllSites(): ClientsAllSites = {
    ClientsAllSites(
        clientsInactiveFirst = clientsBySiteUserIdInactiveFirst.to[Vector])
  }


  def traceLog(siteId: SiteId, message: => String): Unit =
    logger.trace(s"s$siteId: PubSub: $message")

  private def anyPrettyUser(anyUser: Option[Participant], userId: UserId) = anyUser match {
    case Some(user) => user.nameHashId
    case None => s"missing user #$userId"
  }

}
