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
import com.github.benmanes.caffeine
import debiki.dao.SystemDao
import play.{api => p}
import scala.concurrent.duration._
import debiki.Globals
import scala.concurrent.{ExecutionContext, Future}



/** Periodically looks at the spam check queue, checks for spam, and deletes from the queue.
  */
object SpamCheckActor {

  def startNewActor(postBatchSize: Int, intervalSeconds: Int, actorSystem: ActorSystem,
        executionContext: ExecutionContext, systemDao: SystemDao): ActorRef = {
    implicit val execCtx = executionContext
    val actorRef = actorSystem.actorOf(Props(
      new SpamCheckActor(postBatchSize, systemDao)), name = s"SpamCheckActor")
    actorSystem.scheduler.schedule(
        initialDelay = intervalSeconds seconds, intervalSeconds seconds, actorRef, CheckForSpam)
    actorRef
  }

}



case object CheckForSpam

/** For e2e tests, so cache items from earlier tests, won't interfere with later tests. */
case object ClearCheckingSpamNowCache


class SpamCheckActor(
  private val batchSize: Int,
  private val systemDao: SystemDao) extends Actor {

  // Here we remember which spam check tasks we've started checking — so we won't
  // re-check the same things many times (if a request is still in-flight, when
  // we do another check-tasks run). Expire tasks from this memory, after a while,
  // so we'll re-try, if the first attempt somehow failed —
  // the spam check is just a HTTP roundtrip, so a minute is a lot?
  private val checkingNowCache = caffeine.cache.Caffeine.newBuilder()
    .maximumSize(20*1000)  // derive based on free mem? [ADJMEMUSG]
    .expireAfterWrite(2, java.util.concurrent.TimeUnit.MINUTES)
    .build()
    .asInstanceOf[caffeine.cache.Cache[SpamCheckTask.Key, Object]]

  def globals: Globals = systemDao.globals

  private val execCtx: ExecutionContext = globals.executionContext

  def receive: PartialFunction[Any, Unit] = {
    case CheckForSpam =>
      try {
        checkMorePostsForSpam()
      }
      catch {
        case ex: Exception =>
          p.Logger.error(s"Error processing spam check queue [EdE5GPKS2]", ex)
      }
    case ClearCheckingSpamNowCache =>
      checkingNowCache.invalidateAll()
  }


  private def checkMorePostsForSpam() {
    val spamCheckTasks = systemDao.loadStuffToSpamCheck(limit = batchSize)
    p.Logger.debug(s"Checking ${spamCheckTasks.length} spam check tasks ... [TyM70295MA4]")

    val manyFutureResults: Seq[(SpamCheckTask, Future[SpamCheckResults])] = spamCheckTasks flatMap {
        task =>
      val key = task.key
      if (checkingNowCache.getIfPresent(key) ne null) None   // [205FKPJ096]
      else {
        checkingNowCache.put(key, DummyObject)
        val futureSpamCheckResults = globals.spamChecker.detectPostSpam(task)  // errors handled below
        Some(task -> futureSpamCheckResults)
      }
    }

    // Handle the spam check results one at a time, although they're typically for different
    // sites and we synchronize on site id — otherwise, tends to run into:
    //   """PSQLException: ERROR:
    //       could not serialize access due to read/write dependencies among transactions""".
    runFuturesSequentially(manyFutureResults) { case (spamCheckTask, futureResults) =>
      futureResults.map({ spamCheckResults =>
        handleResults(spamCheckTask, spamCheckResults)
      })(execCtx).recover({
        case throwable: Throwable =>
          // Noop. We'll retry later after the checkingNowCache item has expired. [205FKPJ096]
          p.Logger.warn(s"Error executing spam check task [TyE306MWDNF2]", throwable)
      }) (execCtx)
    } (execCtx)
  }

  private val DummyObject = new Object


  private def handleResults(spamCheckTask: SpamCheckTask, spamCheckResults: SpamCheckResults) {
      // We're not inside receive() any longer, so its try..catch is of no use now.
      try {
        systemDao.handleSpamCheckResults(spamCheckTask, spamCheckResults)
      }
      catch {
        case ex: Exception =>
          p.Logger.error(
              s"Error dealing with spam, post: ${spamCheckTask.postToSpamCheckShort} [EdE7GSB4]", ex)
      }
  }

}

