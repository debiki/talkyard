/**
 * Copyright (C) 2016 Kaj Magnus Lindberg
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

package ed.server.spam

import akka.actor._
import com.debiki.core._
import com.debiki.core.Prelude._
import debiki.dao.SystemDao
import play.{api => p}
import scala.concurrent.duration._
import scala.concurrent.ExecutionContext.Implicits.global
import debiki.Globals
import org.postgresql.util.PSQLException



/** Periodically looks at the spam check queue, checks for spam, and deletes from the queue.
  */
object SpamCheckActor {

  def startNewActor(postBatchSize: Int, intervalSeconds: Int, actorSystem: ActorSystem,
        systemDao: SystemDao): ActorRef = {
    val actorRef = actorSystem.actorOf(Props(
      new SpamCheckActor(postBatchSize, systemDao)), name = s"SpamCheckActor")
    actorSystem.scheduler.schedule(
        initialDelay = intervalSeconds seconds, intervalSeconds seconds, actorRef, CheckForSpam)
    actorRef
  }

}



case object CheckForSpam


class SpamCheckActor(
  private val batchSize: Int,
  private val systemDao: SystemDao) extends Actor {

  val spamTasksDone = new java.util.concurrent.ConcurrentLinkedQueue[SpamCheckTask]


  def receive = {
    case CheckForSpam =>
      deleteAlreadyCheckedPostsFromQueue()
      checkMorePostsForSpam()
    case PoisonPill =>
      deleteAlreadyCheckedPostsFromQueue()
  }


  private def checkMorePostsForSpam() {
    val stuff = systemDao.loadStuffToSpamCheck(limit = batchSize)
    stuff.spamCheckTasks.foreach(checkForSpam(_, stuff))
  }


  private def checkForSpam(spamCheckTask: SpamCheckTask, stuffToSpamCheck: StuffToSpamCheck) {
    Globals.spamChecker.detectPostSpam(spamCheckTask, stuffToSpamCheck) map { anyIsSpamReason =>
      anyIsSpamReason foreach { isSpamReason =>
        systemDao.dealWithSpam(spamCheckTask, isSpamReason)
      }
      // Which thread is this? If it's not the actor's thread, updating the spam check queue
      // from here tend to result in PostgreSQL serialization errors. For now, instead add
      // to spamTasksDone.
      spamTasksDone.add(spamCheckTask)
    }
  }


  private def deleteAlreadyCheckedPostsFromQueue() {
    var tasksToDelete = Vector[SpamCheckTask]()
    while (!spamTasksDone.isEmpty) {
      tasksToDelete +:= spamTasksDone.remove()
    }
    COULD_OPTIMIZE // batch delete all in one statement
    tasksToDelete foreach { task =>
      try systemDao.deleteFromSpamCheckQueue(task)
      catch {
        case ex: PSQLException if ex.getSQLState == "40001" =>
          p.Logger.error(o"""PostgreSQL serialization error when deleting
                siteId:postId: $task from spam check queue [EdE40001SCQ]""", ex)
        case ex: Exception =>
          p.Logger.error(
            s"error when deleting siteId:postId: $task from spam check queue [EdE8DUM3]", ex)
      }
    }
  }

}

