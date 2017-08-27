/**
 * Copyright (C) 2015 Kaj Magnus Lindberg
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

package debiki

import java.lang.management.{ThreadInfo, ManagementFactory}
import java.util.concurrent.Executors
import java.{util => ju}
import play.{api => p}
import scala.collection.mutable


/** Detects and logs warnings about deadlocks.
  *
  * You'll find all deadlock related log messages in the log files by
  * searching for "DwEDEADLOCK".
  */
object DeadlockDetector {

  private val IntervalSeconds = 60 // if (Play.isProd) 60 else 10

  private val threadMxBean = ManagementFactory.getThreadMXBean

  private val oldDeadlockedThreadIds = mutable.HashSet[Long]()

  @volatile private var scheduled = false


  def ensureStarted() {
    if (!scheduled) {
      scheduleDeadlockDetection()
      scheduled = true
    }
  }


  private def scheduleDeadlockDetection() {
    val scheduledExecutor = Executors.newSingleThreadScheduledExecutor()
    scheduledExecutor.scheduleAtFixedRate(new Runnable { def run() = detectAndLogDeadlocks() },
      IntervalSeconds, IntervalSeconds, ju.concurrent.TimeUnit.SECONDS)
  }


  private def detectAndLogDeadlocks() {
    val threadIds: Array[Long] = threadMxBean.findDeadlockedThreads()
    if ((threadIds eq null) || threadIds.isEmpty) {
      if (oldDeadlockedThreadIds.size > 0) {
        p.Logger.info("All deadlocks gone [DwEDEADLOCK0]")
        oldDeadlockedThreadIds.clear()
      }
    }
    else {
      for (threadId <- threadIds) {
        if (oldDeadlockedThreadIds.contains(threadId)) {
          p.Logger.warn(s"Thread still deadlocked, id: $threadId [DwEDEADLOCKC]")
        }
        else {
          oldDeadlockedThreadIds.add(threadId)
          val threadInfo = threadMxBean.getThreadInfo(threadId, Int.MaxValue)
          if (threadInfo eq null) {
            p.Logger.warn(s"Got null ThreadInfo for deadlocked thread id $threadId [DwEDEADLOCKX]")
          }
          else {
            val stackTrace: Array[StackTraceElement] = threadInfo.getStackTrace
            val stackTraceMessage =
              if (stackTrace.length > 0) "stack trace:"
              else "no stack trace available"
            p.Logger.warn(
              s"Deadlock detected, thread id: $threadId, $stackTraceMessage [DwEDEADLOCKN]" +
                stackTraceToString(stackTrace))
          }
        }
      }
    }
  }


  def stackTraceToString(stackTrace: Array[StackTraceElement]): String = {
    val result = StringBuilder.newBuilder
    for (elem <- stackTrace) {
      result.append("\n  ").append(elem.toString)
    }
    result.toString()
  }


  def createDebugTestDeadlock() {
    val lockOne = new Object
    val lockTwo = new Object
    p.Logger.warn("Intentionally deadlocking two new threads... [DwEDEADLOCKI]")

    new Thread(new Runnable() {
      override def run() {
        lockOne.synchronized {
          p.Logger.warn("First thread got lock 1")
          Thread.sleep(1000)
          lockTwo.synchronized {
            p.Logger.warn("First thread got lock 2")
          }
        }
      }
    }).start()

    new Thread(new Runnable() {
      override def run() {
        // Let's make the stack trace a bit deeper so we'll see how it looks in the logs.
        // Then deadlock.
        makeStackTraceDeeper(7)
      }
      def makeStackTraceDeeper(depth: Int) {
        if (depth > 0) {
          makeStackTraceDeeper(depth - 1)
        }
        else {
          lockTwo.synchronized {
            p.Logger.warn("Second thread got lock 2")
            lockOne.synchronized {
              p.Logger.warn("Second thread got lock 1")
            }
          }
        }
      }
    }).start()
  }
}

