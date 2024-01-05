/**
 * Copyright (c) 2016, 2021 Kaj Magnus Lindberg
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

package talkyard.server

import com.debiki.core._
import Prelude.{castToInt32, IfBadDie}
import debiki.Globals
import play.api.libs.json._
import play.api.{MarkerContext => p_MarkerContext}
import java.util.concurrent.atomic.{AtomicInteger => j_AtomicInteger}
import akka.actor.ActorRef


trait NumSince {
  def lastAtUnixMinute(): Opt[i32]
  def numSinceStart(): i32
}

private class NumSinceImpl extends NumSince {
  def lastAtUnixMinute(): Opt[i32] = {
    val atMin = _lastAtUnixMinute.get()
    if (atMin == 0) None
    else Some(atMin)
  }

  def numSinceStart(): i32 = _numSinceStart.get()

  val _lastAtUnixMinute = new j_AtomicInteger(0)
  val _numSinceStart = new j_AtomicInteger(0)
}


package object logging {

  // Hmm, COULD make this part of the server state [use_state] (i.e. Globals
  // although those are no longer globals, just an object instance).
  // But then how would erors about creating the server state get logged? — Could
  // use Play's/Java's log fns directly, when starting the server, until state created.
  private val _numErrors = new NumSinceImpl()
  private val _numWarnings = new NumSinceImpl()

  def numErrors: NumSince = _numErrors
  def numWarnings: NumSince = _numWarnings

  // For now
  @volatile
  var _anyLastErrsActorRef: Opt[ActorRef] = None

  def setLastErrsActorRef(ref: ActorRef): U =
    _anyLastErrsActorRef = Some(ref)

  def clearLastErrsActorRef(): U =
    _anyLastErrsActorRef = None


  // "tysvapp":  "ty" = Talkyard, "sv" = server, "app" = application.
  // (Later, more logging?:  tysvweb = web server logs,
  // tybrapp = browser app logs, tyanapp = android app, tyioapp = iOS app logs)
  //
  def TyLogger(name: St, anySiteId: Opt[SiteId] = None): play.api.Logger = {
    val slf4jLogger = org.slf4j.LoggerFactory.getLogger("tysvapp." + name)
    new CountingLogger(slf4jLogger)
  }


  private class CountingLogger(logger: org.slf4j.Logger) extends play.api.Logger(logger) {
    override def warn(msg: => St)(implicit mc: p_MarkerContext): U = {
      if (isWarnEnabled) {
        increment(_numWarnings)
        super.warn(msg)(mc)
        // 35? See:  [ty_log_levels]
        _anyLastErrsActorRef.foreach(_ ! LastErrsActor.RememberLogMsg(LogMsg(msg, 35)))
      }
    }

    override def warn(msg: => St, err: => Throwable)(implicit mc: p_MarkerContext): U = {
      if (isWarnEnabled) {
        increment(_numWarnings)
        super.warn(msg, err)(mc)
        _anyLastErrsActorRef.foreach(_ ! LastErrsActor.RememberLogMsg(LogMsg(msg, 35)))
      }
    }

    override def error(msg: => St)(implicit mc: p_MarkerContext): U = {
      if (isErrorEnabled) {
        increment(_numErrors)
        super.error(msg)(mc)
        // 25? See:  [ty_log_levels]
        _anyLastErrsActorRef.foreach(_ ! LastErrsActor.RememberLogMsg(LogMsg(msg, 25)))
      }
    }

    override def error(msg: => St, err: => Throwable)(implicit mc: p_MarkerContext): U = {
      if (isErrorEnabled) {
        increment(_numErrors)
        super.error(msg, err)(mc)
        _anyLastErrsActorRef.foreach(_ ! LastErrsActor.RememberLogMsg(LogMsg(msg, 25)))
      }
    }
  }


  private def increment(numSince: NumSinceImpl): U = {
    numSince._numSinceStart.incrementAndGet()
    COULD // use Globals.now() instead  [use_state]
    // Dupl code [now_mins].
    val nowMillis = System.currentTimeMillis()
    val nowMins_i64 = nowMillis / MillisPerMinute
    val nowMins = castToInt32(nowMins_i64, IfBadDie)
    // A race, fine, doesn't need to be exact.
    numSince._lastAtUnixMinute.set(nowMins)
  }


  trait TyLogging {
    protected val logger: play.api.Logger = newLogger(getClass)

    protected def anySiteId: Opt[SiteId] = None

    protected def anySiteIdPrefix: St = {
      val id = anySiteId getOrElse {
        return ""
      }
      s"${id}: "
    }

    protected def bugWarnIf(condition: Boolean, errorCode: String,
          problem: => String = ""): Boolean = {
      bugWarnDieIfThen(condition, errorCode, problem, thenDo = null)
    }

    protected def bugWarnDieIfThen(condition: Boolean, errorCode: String,
          problem: => String = "", thenDo: () => Unit): Boolean = {
      if (!condition)
        return false
      bugWarn(errorCode, problem)
      if (thenDo ne null) {
        thenDo()
      }
      true
    }

    protected def bugWarn(errorCode: String, problem: => String = "") {
      Prelude.dieIf(Globals.isDevOrTest, errorCode, problem)
      val message = Prelude.formatErrorMessage(errorCode, problem)
      logger.warn(anySiteIdPrefix + s"BUG: $message")
    }


    implicit class GetOrBugWarn[V](val underlying: Option[V]) {
      def getOrBugWarn(errorCode: String, message: => String = "")(block: V => Unit): Unit =
        underlying match {
          case None =>
            bugWarn(errorCode, message)
          case Some(value: V) =>
            block(value)
        }
    }
  }


  def newLogger(clazz: Class[_], anySiteId: Opt[SiteId] = None): play.api.Logger =
    TyLogger(clazz.getName.stripSuffix("$"))

}
