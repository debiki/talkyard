/**
 * Copyright (c) 2023 Kaj Magnus Lindberg
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
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

package talkyard.server.logging

import akka.actor.{Actor, ActorRef, Props}
import com.debiki.core._
import com.debiki.core.Prelude._
import debiki.{DatabaseUtils, Globals}
import scala.collection.{mutable => mut}
import scala.concurrent.duration._
import scala.concurrent.ExecutionContext
import talkyard.server.TyLogger
import LastErrsActor._


/** Error = 25, warning = 35?   See blog-comments.ts  [ty_log_levels]
  */
case class LogMsg(msg: St, level: i32)  // [Scala_3] Opaque log level class?


/** Remembers the most recent error and warning log messages, to show for
  * server admins on a web interface.  Or for any monitoring tools that poll
  * the Talkyard server (can be simpler than adding log collection agents and
  * configure them to forward the messages to elsewhere).
  */
object LastErrsActor {

  def startNewActor(globals: Globals): ActorRef = {
    implicit val execCtx: ExecutionContext = globals.executionContext

    val actorRef = globals.actorSystem.actorOf(
      Props(new LastErrsActor(globals)), name = "LastErrsActor")

    // For now, email any errors after startup, then every 15 minutes.
    globals.actorSystem.scheduler.scheduleWithFixedDelay(
        initialDelay = 5*60 seconds, 15*60 seconds, actorRef, EmailErrorsToOnCalls)

    actorRef
  }

  case class RememberLogMsg(msg: LogMsg)
  object GetRecentMsgs
  object EmailErrorsToOnCalls

  case class RecentMsgs(list: Vec[LogMsg])
}


class LastErrsActor(val globals: Globals) extends Actor {

  private val actorName = "LastErrsActor"

  // Don't use TyLogger — it'd make this actor sends messages to itself about bugs
  // (error messages) in itself, circular silliness.
  private val logger: org.slf4j.Logger =
    org.slf4j.LoggerFactory.getLogger(s"tysvapp.$actorName")

  // ArrayDeque doesn't exist until scala 2.13 or [Scala_3] but we're on 2.12.
  private val lastErrsBuf = mut.Queue[LogMsg]()

  private var curSize = 0
  private val maxSize = 100

  // For now, so won't be some bug that results in 9999 emails getting sent.
  private var numEmailsSent = 0
  private val tooManyEmailsSent = 500


  override def receive: Receive = { case message =>
    try message match {
      case RememberLogMsg(msg) =>
        if (curSize == maxSize) lastErrsBuf.dequeue()
        else curSize += 1
        lastErrsBuf.enqueue(msg)

      case GetRecentMsgs =>
        // Send back an immutable structure.
        sender ! RecentMsgs(lastErrsBuf.to[Vec])

      case EmailErrorsToOnCalls =>
        if (globals.onCallEmailAddresses.isDefined  // it's not, not implemented
              && numEmailsSent < tooManyEmailsSent) {
          numEmailsSent += 1
          // globals.sendEmail()  ... later ...
        }

      case x =>
        logger.warn(s"Unexpected message, type ${classNameOf(message)
              } sent to $actorName  [TyELASTERRSUNEX]")
    }
    catch {
      case thr: Throwable =>
        logger.error(s"Error in actor $actorName when handling a ${classNameOf(message)
              } message [TyELASTERRSACTR]", thr)
      // If this actor doesn't work, we might as well terminate it, by rethrowing?
      // It's just for troubleshooting anyway.
      throw thr
    }
  }

}
