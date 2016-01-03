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
import debiki.{ReactJson, Globals}
import play.api.libs.json.{JsNull, JsValue}
import play.{api => p}
import play.api.libs.json.Json
import play.api.libs.ws.{WSResponse, WS}
import play.api.Play.current
import scala.collection.{mutable, immutable}
import scala.concurrent.ExecutionContext.Implicits.global
import scala.concurrent.duration._


sealed trait Message {
  def siteId: SiteId
  def toUserIds: Set[UserId]
  def toJson: JsValue
  def notifications: Notifications
}


case class NewPageMessage(
  siteId: SiteId,
  toUserIds: immutable.Set[UserId],
  pageId: PageId,
  pageRole: PageRole,
  notifications: Notifications) extends Message {

  def toJson = JsNull
}


case class NewPostMessage(
  siteId: SiteId,
  toUserIds: immutable.Set[UserId],
  pageId: PageId,
  postJson: JsValue,
  notifications: Notifications) extends Message {

  def toJson = JsNull
}


object PubSub {

  // Not thread safe; only needed in integration tests.
  var testInstanceCounter = 1


  /** Starts a PubSub actor (only one is needed in the whole app).
    */
  def startNewActor(actorSystem: ActorSystem): PubSubApi = {
    val actorRef = actorSystem.actorOf(Props(
      new PubSub()), name = s"PubSub-$testInstanceCounter")
    testInstanceCounter += 1
    new PubSubApi(actorRef)
  }

}



class PubSubApi(private val actorRef: ActorRef) {
  def onUserSubscribed(siteId: SiteId, userId: UserId) {
    actorRef ! UserSubscribed(SiteUserId(siteId, userId))
  }

  def publish(message: Message) {
    actorRef ! PublishMessage(message)
  }
}

private case class PublishMessage(message: Message)
private case class UserSubscribed(siteUserId: SiteUserId)



/** Publishes events to browsers via e.g. long polling or WebSocket. Reqiures nginx and nchan.
  * Assumes an nginx-nchan publish endpoint is available at: 127.0.0.1:80/-/pubsub/publish/
  * (and nginx should have been configured to allow access from localhost only).
  *
  * Later:? Poll nchan each minute? to find out which users have disconnected?
  * ((Could add an nchan feature that tells the appserver about this, push not poll?))
  */
class PubSub extends Actor {

  /** Tells when subscriber site-user-id subscribed. Sorted by insertion order.
    * We'll push messages only to users who have subscribed (i.e. are online and have
    * connected to the server via e.g. WebSocket).
    */
  private val subscribers = mutable.LinkedHashMap[SiteUserId, When]()


  def receive = {
    case UserSubscribed(siteUserId) =>
      subscribers.put(siteUserId, now)
      println("Subscribed: " + siteUserId)
    case PublishMessage(message: Message) =>
      println("Publishing: " + message)
      publish(message)
  }


  def publish(message: Message) {
    SHOULD // only publish to connected users

    val siteDao = Globals.siteDao(message.siteId)
    val site = siteDao.loadSite()
    val canonicalHost = site.canonicalHost.getOrDie(
      "EsE7UKFW2", s"Site lacks canonical host: $site")

    message.notifications.toCreate foreach { notf =>
      COULD_OPTIMIZE // later: do only 1 call to siteDao, for all notfs.
      val notfsJson = siteDao.readOnlyTransaction { transaction =>
        ReactJson.notificationsToJson(Seq(notf), transaction).notfsJson
      }
      WS.url(s"http://localhost/-/pubsub/publish/${notf.toUserId}")
        .withVirtualHost(canonicalHost.hostname)
        .post(Json.obj(
          "type" -> "notifications",
          "data" -> notfsJson).toString)
        .map(handlePublishResponse)
        .recover({
          case ex: Exception =>
            p.Logger.warn(s"Error publishing to browsers [EsE0KPU31]", ex)
        })
    }

    // Currently nchan doesn't support publishing to many channels with one single request.
    // (See the Channel Multiplexing section here: https://nchan.slact.net/
    // it says: "Publishing to multiple channels from one location is not supported")
    COULD // create an issue about supporting that? What about each post data text line = a channel,
    // and a blank line separates channels from the message that will be sent to all these channels?
    message.toUserIds foreach { userId =>
      WS.url(s"http://localhost/-/pubsub/publish/$userId")
        .withVirtualHost(canonicalHost.hostname)
        .post(message.toJson)
        .map(handlePublishResponse)
        .recover({
          case ex: Exception =>
            p.Logger.warn(s"Error publishing to browsers [EsE5JYUW2]", ex)
        })
    }
  }

  def handlePublishResponse(response: WSResponse) {
    if (response.status < 200 || 299 < response.status) {
      p.Logger.warn(o"""Bad nchan status code after sending publish request [EsE9UKJ2]:
        ${response.status} ${response.statusText} — see the nginx error log for details?
        Response body: '${response.body}""")
    }
  }
}
