/**
 * Copyright (c) 2016 Kaj Magnus Lindberg
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

package io.efdi.server.stranger

import akka.actor._
import akka.pattern.ask
import com.debiki.core._
import scala.collection.mutable
import scala.concurrent.ExecutionContext.Implicits.global
import scala.concurrent.Future
import scala.concurrent.duration._



object StrangerCounter {

  // Not thread safe; only needed in integration tests.
  var testInstanceCounter = 1


  /** Starts a StrangerCounterActor (only one is needed in the whole app).
    */
  def startNewActor(actorSystem: ActorSystem): StrangerCounterApi = {
    val actorRef = actorSystem.actorOf(Props(
      new StrangerCounterActor()), name = s"StrangerCounter-$testInstanceCounter")
    testInstanceCounter += 1
    new StrangerCounterApi(actorRef)
  }

}



class StrangerCounterApi(private val actorRef: ActorRef) {

  private val timeout = 10 seconds


  def tellStrangerSeen(siteId: SiteId, browserIdData: BrowserIdData) {
    actorRef ! StrangerSeen(siteId, browserIdData)
  }


  def countStrangers(siteId: SiteId): Future[Int] = {
    val response: Future[Any] = (actorRef ? CountStrangers(siteId))(timeout)
    response.map(_.asInstanceOf[Int])
  }
}


private case class StrangerSeen(siteId: SiteId, browserIdData: BrowserIdData)
private case class CountStrangers(siteId: SiteId)



/** Counts how many not-logged-in users have viewed any page the latest ten minutes.
  */
class StrangerCounterActor extends Actor {


  // Could consider browser id cookie too (instead of just ip), but then take care
  // to avoid DoS attacks if someone generates 9^99 unique ids and requests.
  private val strangersBySite =
    mutable.HashMap[SiteId, mutable.LinkedHashMap[IpAddress, When]]()


  def receive = {
    case StrangerSeen(siteId, browserIdData) =>
      addStranger(siteId, browserIdData)
    case CountStrangers(siteId) =>
      sender ! countStrangers(siteId)
    // SHOULD [onlinelist] case DeleteOldStrangers =>
  }


  def addStranger(siteId: SiteId, browserIdData: BrowserIdData) {
    val lastSeenByBrowser = strangersBySite.getOrElseUpdate(siteId,
      mutable.LinkedHashMap[IpAddress, When]())

    lastSeenByBrowser.put(browserIdData.ip, now)
  }


  def countStrangers(siteId: SiteId): Int = {
    val lastSeenByBrowser = strangersBySite.get(siteId) getOrElse {
      return 0
    }
    // SHOULD [onlinelist] deleteOldStrangers(lastSeenByBrowser)
    lastSeenByBrowser.size
  }

}
