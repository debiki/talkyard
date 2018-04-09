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
import OldStuffDeleter._
import scala.concurrent.ExecutionContext



/** Deletes old data, e.g. uploads no longer in use, and ip addresses and other
  * a bit personal data from the audit log.
  */
object OldStuffDeleter {

  def startNewActor(globals: Globals): ActorRef = {
    implicit val execCtx: ExecutionContext = globals.executionContext
    val actorRef = globals.actorSystem.actorOf(
      Props(new OldStuffDeleterActor(globals)), name = "OldStuffDeleterActor")
    globals.actorSystem.scheduler.schedule(60 seconds, 10 seconds, actorRef, DeleteOldStuff)
    actorRef
  }

  object DeleteOldStuff
}



class OldStuffDeleterActor(val globals: Globals) extends Actor {

  def execCtx: ExecutionContext = globals.executionContext

  override def receive: Receive = {
    case DeleteOldStuff =>
      try findAndDeleteOldStuff()
      catch {
        case ex: java.sql.SQLException if DatabaseUtils.isConnectionClosed(ex) =>
          p.Logger.warn("Cannot delete old stuff, database connection closed [TyE2FKQS4]")
        case throwable: Throwable =>
          if (!globals.isOrWasTest)
            p.Logger.error("Error deleting old stuff [TyE52QBU04]", throwable)
      }
  }


  private def findAndDeleteOldStuff() {
    val dao = globals.systemDao
    dao.deletePersonalDataFromOldAuditLogEntries()
    dao.deleteOldUnusedUploads()
  }

}
