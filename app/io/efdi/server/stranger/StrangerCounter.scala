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
    actorSystem.scheduler.schedule(10 seconds, 20 seconds, actorRef, DeleteOldStrangers)
    new StrangerCounterApi(actorRef)
  }

}



class StrangerCounterApi(private val actorRef: ActorRef) {

  private val timeout = 10 seconds


  def tellStrangerSeen(siteId: SiteId, browserIdData: BrowserIdData) {
    actorRef ! StrangerSeen(siteId, browserIdData)
  }


  def strangerLoggedIn(siteId: SiteId, browserIdData: BrowserIdData) {
    actorRef ! StrangerLoggedIn(siteId, browserIdData)
  }


  def countStrangers(siteId: SiteId): Future[Int] = {
    val response: Future[Any] = (actorRef ? CountStrangers(siteId))(timeout)
    response.map(_.asInstanceOf[Int])
  }
}


private case class StrangerSeen(siteId: SiteId, browserIdData: BrowserIdData)
private case class StrangerLoggedIn(siteId: SiteId, browserIdData: BrowserIdData)
private case class CountStrangers(siteId: SiteId)
private case object DeleteOldStrangers



/** Counts how many not-logged-in users have viewed any page the latest ten minutes.
  */
class StrangerCounterActor extends Actor {

  val TenMinutesInMillis = 10 * OneMinuteInMillis

  // Could consider browser id cookie too (instead of just ip), but then take care
  // to avoid DoS attacks if someone generates 9^99 unique ids and requests.
  private val lastSeenByBrowserBySite =
    mutable.HashMap[SiteId, mutable.LinkedHashMap[IpAddress, When]]()

  def getLastSeenByBrowser(siteId: SiteId) =
    lastSeenByBrowserBySite.getOrElseUpdate(siteId,
      // Use a LinkedHashMap because iteration order = insertion order.
      mutable.LinkedHashMap[IpAddress, When]())


  def receive = {
    case StrangerSeen(siteId, browserIdData) =>
      addStranger(siteId, browserIdData)
    case StrangerLoggedIn(siteId, browserIdData) =>
      removeStranger(siteId, browserIdData)
    case CountStrangers(siteId) =>
      sender ! countStrangers(siteId)
    case DeleteOldStrangers =>
      deleteOldStrangers()
  }


  private def addStranger(siteId: SiteId, browserIdData: BrowserIdData) {
    val lastSeenByBrowser = getLastSeenByBrowser(siteId)
    // Remove and add back this ip, so it'll appear last during iteration.
    lastSeenByBrowser.remove(browserIdData.ip)
    lastSeenByBrowser.put(browserIdData.ip, When.now())
  }


  private def removeStranger(siteId: SiteId, browserIdData: BrowserIdData) {
    val lastSeenByBrowser = getLastSeenByBrowser(siteId)
    lastSeenByBrowser.remove(browserIdData.ip)
  }


  private def countStrangers(siteId: SiteId): Int = {
    val lastSeenByBrowser = lastSeenByBrowserBySite.getOrElse(siteId, {
      return 0
    })
    lastSeenByBrowser.size
  }


  private def deleteOldStrangers() {
    val now = When.now()
    for (lastSeenByBrowser <- lastSeenByBrowserBySite.values) {
      // LinkedHashMap iteration order = insertion order, so we'll find all old entries directly.
      // COULD implement `removeWhile` [removewhile]
      while (true) {
        val ((ip, lastSeenAt)) = lastSeenByBrowser.headOption getOrElse {
          return
        }
        if (now.millisSince(lastSeenAt) < TenMinutesInMillis)
          return

        lastSeenByBrowser.remove(ip)
      }
    }
  }
}
