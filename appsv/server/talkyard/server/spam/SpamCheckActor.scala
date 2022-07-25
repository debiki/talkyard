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

package talkyard.server.spam

import akka.actor._
import com.debiki.core._
import com.debiki.core.Prelude._
import com.github.benmanes.caffeine
import debiki.dao.SystemDao
import play.{api => p}
import scala.concurrent.duration._
import debiki.Globals
import scala.concurrent.{ExecutionContext, Future}
import talkyard.server.TyLogger
import talkyard.server.jobs.BackgroundJobsActor



/** Periodically looks at the spam check queue, checks for spam, and deletes from the queue.
  */
object SpamCheckActor {

  def startNewActor(postBatchSize: Int, intervalSeconds: Int, actorSystem: ActorSystem,
        executionContext: ExecutionContext, systemDao: SystemDao): ActorRef = {
    implicit val execCtx = executionContext
    val actorRef = actorSystem.actorOf(Props(
      new SpamCheckActor(postBatchSize, systemDao)), name = s"SpamCheckActor")
    actorSystem.scheduler.scheduleWithFixedDelay(
        initialDelay = intervalSeconds seconds, intervalSeconds seconds, actorRef, CheckForSpam)
    actorRef
  }

}



case object CheckForSpam

/** For e2e tests, so cache items from earlier tests, won't interfere with later tests. */
case class ClearCheckingSpamNowCache(siteIds: Set[SiteId])


class SpamCheckActor(
  private val batchSize: i32,
  private val systemDao: SystemDao) extends BackgroundJobsActor("SpamCheckActor") {


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

  def tryReceive(message: Any, paused: Bo): U = if (!paused) message match {
    case CheckForSpam =>
      checkMorePostsForSpam()
    case ClearCheckingSpamNowCache(siteIds) =>
      COULD_OPTIMIZE // remove items only for siteIds — no need to clear
      // the whole queue, if running smoke tests against a live production server.
      checkingNowCache.invalidateAll()
  }


  private def checkMorePostsForSpam(): Unit = {
    val spamCheckTasks = systemDao.loadStuffToSpamCheck(limit = batchSize)
    if (spamCheckTasks.isEmpty)
      return

    logger.debug(s"Checking ${spamCheckTasks.length} spam check tasks ... [TyM70295MA4]")

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
    // at least if the server restarts, and there're lots of pending spam checks
    // that would get handled all at once together.
    runFuturesSequentially(manyFutureResults) { case (spamCheckTask, futureResults) =>
      futureResults.map({ spamCheckResults =>
        handleResults(spamCheckTask, spamCheckResults)
      })(execCtx).recover({
        case throwable: Throwable =>
          // Noop. We'll retry later after the checkingNowCache item has expired. [205FKPJ096]
          // (Or could do exponential backoff? Skip this spam check forever after X attempts?)
          logger.warn(
              s"Error executing this spam check task: $spamCheckTask [TyE306MWDNF2]", throwable)
      }) (execCtx)
    } (execCtx)
  }

  private val DummyObject = new Object


  private def handleResults(spamCheckTask: SpamCheckTask, spamCheckResults: SpamCheckResults): Unit = {
      // We're not inside receive() any longer, so its try..catch is of no use now.
      try {
        systemDao.handleSpamCheckResults(spamCheckTask, spamCheckResults)
      }
      catch {
        case ex: Exception =>
          logger.error(
              s"Error dealing with spam, post: ${spamCheckTask.postToSpamCheckShort} [EdE7GSB4]", ex)
      }
  }

}

