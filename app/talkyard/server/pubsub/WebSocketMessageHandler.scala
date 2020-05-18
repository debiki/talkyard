/**
 * Copyright (c) 2020 Kaj Magnus Lindberg
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

package talkyard.server.pubsub

import akka.Done
import akka.stream.OverflowStrategy
import akka.stream.scaladsl.{Flow, Sink, Source, SourceQueueWithComplete}
import com.debiki.core._
import com.debiki.core.Prelude._
import debiki._
import ed.server.pubsub.UserConnected
import ed.server.security.XsrfOk
import play.{api => p}
import p.libs.json.{JsString, JsValue}
import scala.concurrent.Future
import scala.util.{Failure, Success, Try}


object WebSocketMessageHandler {
  private val logger = talkyard.server.newLogger(getClass)
}


class WebSocketMessageHandler(
  private val site: SiteBrief,
  private val requester: Participant,
  private val rateLimiter: RateLimiter,
  private val theBrowserIdData: BrowserIdData,
  private val globals: Globals,
  private val xsrfToken: XsrfOk,
) {

  import WebSocketMessageHandler.logger

  @volatile
  private var authenticatedViaWebSocket = false

  @volatile
  private var anyWebSocketClient: Option[UserConnected] = None

  private def siteId = site.id


  val flow: Flow[JsValue, JsValue, _] = createFlow()


  private def createFlow(): Flow[JsValue, JsValue, _] = {

    // Use Sink and Source directly.
    // Could have used this Actor thing:
    // play.api.libs.streams.ActorFlow

    // However, seems it'd use more memory and resources (creates an unneeded
    // actor), and is more complicated: 1) Needs to wait until an Actor
    // onStart() overridable fn has been called, to get an ActorrRef.
    // And 2) seems the Actor does some buffering of outgoing messages, but
    // I want to do that myself, to be able to re-send if the user disconnects
    // and reconnects shortly thereafter — but if the messages were buffered
    // in a per WebSocket actor, they'd be lost?
    // And 3) there's a memory retention leak bug risk? From the docs (May 2020):
    // """Note that terminating the actor without first completing it, either
    // with a success or a failure, will prevent the actor triggering downstream
    // completion and the stream will continue* to run even though
    // the source actor is dead. Therefore you should **not** attempt to
    // manually terminate the actor such as with a [[akka.actor.PoisonPill]]
    // """
    // — having to think about that is just unnecessary? No need for extra
    // actors in Talkyard's case anyway.

    //val inSink: Sink[JsValue, _] = Flow[JsValue].alsoTo(onCompleteSink).to(foreachSink)
    val foreachSink = Sink.foreach[JsValue](onMessage)
    val inSink: Sink[JsValue, _] = foreachSink

    val outSource: Source[JsValue, SourceQueueWithComplete[JsValue]] =
          Source
            .queue[JsValue](bufferSize = 50, OverflowStrategy.fail)
    ///       .queue[Int](bufferSize = 100, akka.stream.OverflowStrategy.backpressure)
    ///       // .throttle(elementsToProcess, 3.second)

    type SourceQueue = SourceQueueWithComplete[JsValue]

    var flow: Flow[JsValue, JsValue, Unit] =
      Flow.fromSinkAndSourceMat(inSink,  outSource) { (_, outboundMat: SourceQueue) =>
        // The WebSocket is now active. Wait for the client to send its
        // session id — because checking the cookie and Origin header, might
        // not be enough, if the client is weird.

        anyWebSocketClient = Some(
          UserConnected(
            site.id, requester, theBrowserIdData, Set.empty, outboundMat))

        logger.debug(s"s$siteId: WS conn: ${requester.nameParaId} [TyMWSCON]")
      }

    // https://stackoverflow.com/a/54137778/694469
    flow = flow.watchTermination() { (_, doneFuture: Future[Done]) =>
      doneFuture.onComplete(onConnectionClosed)(globals.executionContext)
    }

    flow
  }


  private def onMessage(jsValue: JsValue): Unit = {
          val client: UserConnected = anyWebSocketClient getOrElse {
            logger.error(s"WS: Got message but no ws client [TyEWSMSG0CLNT]: $jsValue")
            return
          }

          val prefix = s"s$siteId: WS:"
          val who = requester.nameParaId
          if (!authenticatedViaWebSocket) {
            // This should be an xsrf token.
            jsValue match {
              case JsString(value) =>
                if (value != xsrfToken.value) {
                  // Close — bad xsrf token. [WSXSRF]
                  logger.debug(s"$prefix $who sent bad xsrf token: '$value' [TyEWSXSRF]")
                  client.wsOut.offer(JsString(
                      s"Bad xsrf token: '$value'. Bye. [TyEWSXSRF]"))
                  client.wsOut.complete()
                }
                else {
                  // Let's talk.
                  client.wsOut.offer(JsString(s"OkHi @${requester.usernameOrGuestName}"))
                  authenticatedViaWebSocket = true

                  RACE // [WATCHBRACE]
                  // What if the client has opened another page, during this handshake?
                  // Then the watchbar might not include that page. Fairly harmless.
                  val dao = globals.siteDao(site.id)
                  val watchbar = dao.getOrCreateWatchbar(requester.id)
                  val clientWithPages = client.copy(watchedPageIds = watchbar.watchedPageIds)

                  logger.debug(o"""$prefix $who connected, telling PubSubActor, it'll
                      watch page ids: ${clientWithPages.watchedPageIds}  [TyMWSCONN]""")

                  globals.pubSub.userSubscribed(clientWithPages)
                }
              case other =>
                // Close — got no xsrf token.
                logger.debug(s"$prefix $who skipped xsrf token [TyEWS0XSRFTKN]")
                client.wsOut.offer(JsString("Send xsrf token. Bye. [TyEWS0XSRFTKN]"))
                client.wsOut.complete()
            }
          }
          else {
            logger.trace(s"$prefix $who sent: $jsValue [TyEWSGOTMSG]")

            val rateLimitData = SomethingToRateLimitImpl(
              siteId = site.id,
              user = Some(requester),
              ip = theBrowserIdData.ip,
              ctime = globals.now().toJavaDate,
              shallSkipRateLimitsBecauseIsTest = false,  // for now
              hasOkE2eTestPassword = false)  // for now

            // New connections are also rate limited, see: RateLimits.ConnectWebSocket
            rateLimiter.rateLimit(
                  RateLimits.SendWebSocketMessage, rateLimitData)

            // ? maybe use:
            //   https://github.com/circe/circe
            //     val decodedFoo = decode[Foo](json)
            //     no runtime reflection
            //     Wow! It's like 3-4x faster than Play, for parsing? and 2-10x for writing?
            //     https://github.com/circe/circe-benchmarks
            //     Argonaut, Json4s, Play, Spray are all slower.
            //     https://github.com/circe/circe-derivation
            //       macro-supported derivation of circe's type class instances

            //   https://github.com/tototoshi/play-json4s — from Lift (don't like)
            //     "Case classes can be used to extract values from parsed JSON"
            //     json.extract[Person]
            //     Apparently uses reflection — so avoid.
            //       https://stackoverflow.com/a/41333676/694469
            //       jon4s: "you provide a Scala Manifest for it". Because Manifest
            //       is a Scala trait used for reflection"

            // globals.pubSub.onMessage( ... )  ?
            // — no. Instead, dispatch the message as if it was a normal http request?
            // it's just that now we know already who the user is, no authentication needed
            // (only authorization).

            // And, if the message means the human was active:
            // globals.pubSub.userIsActive(
            //     client.siteId, client.user, client.browserIdData)
            // — but that'd be done by the message/request handler.
          }
  }



  private def onConnectionClosed(result: Try[Done]): Unit = {
        val who = requester.nameParaId
        var nothingToDo = ""

        if (globals.isInitialized) {
          globals.pubSub.unsubscribeUser(site.id, requester, theBrowserIdData)
        }
        else {
          // We're debugging and reloading the app?
          nothingToDo = " — but no Globals.state, nothing to do"
        }

        result match {
          case Success(_) =>
            logger.debug(s"WS closed: $who [TyMWSEND]$nothingToDo")
          case Failure(throwable) =>
            logger.warn(s"WS failed: $who [TyMWSFAIL]$nothingToDo, error: ${
                throwable.getMessage}")
        }
  }

}

