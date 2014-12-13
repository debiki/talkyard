/**
 * Copyright (C) 2012-2013 Kaj Magnus Lindberg (born 1979)
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

import akka.actor._
import akka.pattern.gracefulStop
import com.debiki.core._
import com.debiki.core.Prelude._
import com.debiki.core.QuotaConsumers
import com.debiki.dao.rdb.{RdbDaoFactory, Rdb}
import debiki.dao.{SystemDao, SiteDao, CachingSiteDaoFactory, CachingSystemDao}
//import com.twitter.ostrich.stats.Stats
//import com.twitter.ostrich.{admin => toa}
import java.{lang => jl}
import play.{api => p}
import play.api.libs.concurrent.Akka
import play.api.Play
import play.api.Play.current
import scala.concurrent.duration._
import scala.concurrent.Await
import scala.util.matching.Regex


object Globals extends Globals



/** App server startup and shutdown hooks, plus global stuff like
  * the systemDao and tenantDao:s and an email actor.
  *
  * It's a class, so it can be tweaked during unit testing.
  */
class Globals {


  private var _state: State = null

  private def state: State = {
    assert(_state ne null, "No Globals.State created, please call onServerStartup()")
    _state
  }


  val applicationSecret =
    Play.configuration.getString("application.secret").getOrDie(
      "application.secret config value missing [DwE75FX0]")


  def systemDao = state.systemDao


  def siteDao(siteId: SiteId, ip: String, roleId: Option[RoleId] = None): SiteDao =
    state.siteDaoFactory.newSiteDao(
      QuotaConsumers(ip = Some(ip), tenantId = siteId, roleId = roleId))


  def sendEmail(email: Email, websiteId: String) {
    state.mailerActorRef ! (email, websiteId)
  }


  def baseDomain: String = state.baseDomain


  /** If a hostname matches this pattern, the site id can be extracted directly from the url.
    */
  def siteByIdHostnameRegex = state.siteByIdHostnameRegex

  def SiteByIdHostnamePrefix = "site-"

  def siteByIdOrigin(siteId: String) = s"http://$SiteByIdHostnamePrefix$siteId.$baseDomain"


  /** The Twitter Ostrich admin service, listens on port 9100. */
  /*
  private val _ostrichAdminService = new toa.AdminHttpService(9100, 20, Stats,
    new toa.RuntimeEnvironment(getClass))
   */


  def onServerStartup(app: p.Application) {
    if (_state ne null)
      throw new jl.IllegalStateException(o"""Server already running, was it not properly
        shut down last time? Please hit CTRL+C to kill it. [DwE83KJ9]""")

    _state = new State
    state.systemDao.applyEvolutions()
    state.quotaManager.scheduleCleanups()

    debiki.ReactRenderer.startCreatingRenderEngines()

    // For now, disable in dev mode — because of the port conflict that
    // causes an error on reload and restart, see below (search for "conflict").
    /*
    _ostrichAdminService.start()
    Logger.info("Twitter Ostrich listening on port "+
       _ostrichAdminService.address.getPort)
     */
  }


  def onServerShutdown(app: p.Application) {
    // Play.start() first calls Play.stop(), so:
    if (_state eq null)
      return

    p.Logger.info("Shutting down, gracefully...")
    // Shutdown the notifier before the mailer, so no notifications are lost
    // because there was no mailer that could send them.
    shutdownActorAndWait(state.notifierActorRef)
    shutdownActorAndWait(state.mailerActorRef)
    state.dbDaoFactory.shutdown()
    _state = null

    //_ostrichAdminService.shutdown()

    // COULD stop Twitter Ostrich on reload too -- currently there's a
    // port conflict on reload.
    // See: <https://groups.google.com/
    //    forum/?fromgroups#!topic/play-framework/g6uixxX2BVw>
    // "There is an Actor system reserved for the application code that is
    // automatically shutdown when the application restart. You can access it
    // in:  play.api.libs.Akka.system"

  }


  private def shutdownActorAndWait(actorRef: ActorRef): Boolean = {
    val future = gracefulStop(actorRef, state.ShutdownTimeout)
    val stopped = Await.result(future, state.ShutdownTimeout)
    stopped
  }


  private class State {

    val ShutdownTimeout = 30 seconds

    val dbDaoFactory = new RdbDaoFactory(
      makeDataSource(), Akka.system, anyFullTextSearchDbPath, Play.isTest,
      fastStartSkipSearch = fastStartSkipSearch)

    val quotaManager = new QuotaManager(Akka.system, systemDao, freeDollarsToEachNewSite)

    val siteDaoFactory = new CachingSiteDaoFactory(dbDaoFactory, quotaManager.QuotaChargerImpl)

    val mailerActorRef = Mailer.startNewActor(Akka.system, siteDaoFactory)

    val notifierActorRef = Notifier.startNewActor(Akka.system, systemDao, siteDaoFactory)

    def systemDao: SystemDao = new CachingSystemDao(dbDaoFactory.systemDbDao)

    private def fastStartSkipSearch =
      Play.configuration.getBoolean("crazyFastStartSkipSearch") getOrElse false

    private def anyFullTextSearchDbPath =
      Play.configuration.getString("fullTextSearchDb.dataPath")

    private def freeDollarsToEachNewSite: Float =
      Play.configuration.getDouble("new.site.freeDollars")map(_.toFloat) getOrElse {
        // Don't run out of quota when running e2e tests.
        if (Play.isTest) 1000.0f else 1.0f
      }

    val baseDomain: String =
      if (Play.isTest) {
        // Not on classpath: play.api.test.Helpers.testServerPort
        // Instead, duplicate its implementation here:
        val testListenPort = System.getProperty("testserver.port", "19001")
        s"localhost:$testListenPort"
      }
      else {
        val listenPort = System.getProperty("http.port", "9000")
        Play.configuration.getString("debiki.baseDomain") getOrElse s"localhost:$listenPort"
      }

    // The hostname must be directly below the base domain, otherwise
    // wildcard HTTPS certificates won't work: they cover 1 level below the
    // base domain only, e.g. host.example.com but not sub.host.example.com,
    // if the cert was issued for *.example.com.
    val siteByIdHostnameRegex: Regex = s"""^$SiteByIdHostnamePrefix(.*)\\.$baseDomain""".r

    private def makeDataSource() = {
      //val dataSourceName = if (Play.isTest) "test" else "default"
      //val dataSource = p.db.DB.getDataSource(dataSourceName)
      val dataSource = Debiki.getPostgreSqlDataSource()
      val db = new Rdb(dataSource)

      // Log which database we've connected to.
      //val boneDataSource = dataSource.asInstanceOf[com.jolbox.bonecp.BoneCPDataSource]
      //p.Logger.info(o"""Connected to database:
      //  ${boneDataSource.getJdbcUrl} as user ${boneDataSource.getUsername}.""")
      db
    }
  }

}

