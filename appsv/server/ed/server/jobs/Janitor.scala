/**
 * Copyright (c) 2018 Kaj Magnus Lindberg
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

package ed.server.jobs

import akka.actor.{Actor, ActorRef, Props}
import com.debiki.core._
import com.debiki.core.Prelude._
import debiki.{DatabaseUtils, Globals}
import play.{api => p}
import scala.concurrent.duration._
import Janitor._
import scala.concurrent.ExecutionContext
import talkyard.server.TyLogger



/** Runs various background tasks:
  *
  * - Deletes old data, e.g. uploads no longer in use, and ip addresses and other
  * a bit personal data from the audit log.
  *
  * - Carries out review decisions [5YMBWQT] — they're delayed maybe 10 seconds,
  * so the staff can click Undo, if they accidentally clicked the wrong button. [REVIEWUNDO]
  *
  * These things are done by a single actor / background thread, to reduce the risk
  * for database serialization problems (if different threads happen to update the same
  * parts of the database, in a fine & okay way, but that happen to cause serialization
  * errors and rollbacks. This is not the same thing as database deadlocks = bugs (usually).)
  */
object Janitor {

  def startNewActor(globals: Globals): ActorRef = {
    implicit val execCtx: ExecutionContext = globals.executionContext
    import globals.isOrWasTest

    val actorRef = globals.actorSystem.actorOf(
      Props(new JanitorActor(globals)), name = "JanitorActor")

    // Sync the is-test intervals below with the test suites. [2YPBJ6L]
    val delayIfTest = 250.millis

    globals.actorSystem.scheduler.scheduleWithFixedDelay(
          isOrWasTest ? 2.seconds | 60.seconds,
          isOrWasTest ? delayIfTest | 10.seconds, actorRef, DeleteOldStuff)

    globals.actorSystem.scheduler.scheduleWithFixedDelay(
          Globals.isDevOrTest ? 10.seconds | 5.minutes,
          isOrWasTest ? delayIfTest | (Globals.isDevOrTest ? 10.seconds | 8.hours),
          actorRef, PurgeOldDeletedSites)

    globals.actorSystem.scheduler.scheduleWithFixedDelay(
          isOrWasTest ? 2.seconds | 13.seconds,
          isOrWasTest ? delayIfTest | 3.seconds, actorRef, ExecuteReviewTasks)

    actorRef
  }

  object DeleteOldStuff
  object PurgeOldDeletedSites
  object ExecuteReviewTasks
}



class JanitorActor(val globals: Globals) extends Actor {

  private val logger = TyLogger("JanitorActor")

  def execCtx: ExecutionContext = globals.executionContext


  override def receive: Receive = {
    case message =>
      def errorPrefix: St = s"Error in janitor when handling ${classNameOf(message)}"
      try receiveImpl(message)
      catch {
        case ex: java.sql.SQLException if DatabaseUtils.isConnectionClosed(ex) =>
          logger.warn(s"$errorPrefix: Database connection closed [TyEJANCON]")
        case throwable: Throwable =>
          logger.error(s"$errorPrefix [TyEJANTHR]", throwable)
      }
  }


  private def receiveImpl(message: Any): U = {
    message match {
      case DeleteOldStuff =>
        findAndDeleteOldStuff()
      case PurgeOldDeletedSites =>
        val dao = globals.systemDao
        dao.purgeOldDeletedSites()
      case ExecuteReviewTasks =>
        executePendingReviewTasks()
    }
  }


  private def findAndDeleteOldStuff(): Unit = {
    val dao = globals.systemDao
    dao.deletePersonalDataFromOldSessions()
    dao.deletePersonalDataFromOldAuditLogEntries()
    dao.deletePersonalDataFromOldSpamCheckTasks()
    dao.deleteOldUnusedUploads()
  }


  private def executePendingReviewTasks(): Unit = {
    val dao = globals.systemDao
    dao.executePendingReviewTasks()
    dao.reportSpamClassificationMistakesBackToSpamCheckServices()
  }

}
