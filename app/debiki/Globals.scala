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

import com.debiki.core._
import com.debiki.core.Prelude._
import com.debiki.core.QuotaConsumers
import com.debiki.dao.rdb.{RelDbDaoFactory, RelDb}
import debiki.dao.{SystemDao, TenantDao, CachingTenantDaoFactory, CachingSystemDao}
//import com.twitter.ostrich.stats.Stats
//import com.twitter.ostrich.{admin => toa}
import play.api._
import play.api.mvc._
import play.{api => p}
import play.api.Play
import play.api.Play.current


object Globals extends Globals


/** App server startup and shutdown hooks, plus global stuff like
  * the systemDao and tenantDao:s and an email actor.
  *
  * It's a class, so it can be tweaked during unit testing.
  */
class Globals {


  private val dbDaoFactory = new RelDbDaoFactory({
    //val dataSourceName = if (Play.isTest) "test" else "default"
    //val dataSource = p.db.DB.getDataSource(dataSourceName)
    val dataSource = Debiki.getPostgreSqlDataSource()
    val db = new RelDb(dataSource)

    // Log which database we've connected to.
    //val boneDataSource = dataSource.asInstanceOf[com.jolbox.bonecp.BoneCPDataSource]
    //p.Logger.info(o"""Connected to database:
    //  ${boneDataSource.getJdbcUrl} as user ${boneDataSource.getUsername}.""")

    db
  }, play.api.libs.concurrent.Akka.system)


  def systemDao: SystemDao = new CachingSystemDao(dbDaoFactory.systemDbDao)


  // Don't run out of quota when running e2e tests.
  // COULD change to config value (when not test, i.e. make 1.0 configable, not 1000.0).
  protected def freeDollarsToEachNewSite: Float = if (Play.isTest) 1000.0f else 1.0f


  private val quotaManager = new QuotaManager(systemDao, freeDollarsToEachNewSite)
  quotaManager.scheduleCleanups()


  private val tenantDaoFactory = new CachingTenantDaoFactory(dbDaoFactory,
    quotaManager.QuotaChargerImpl /*, cache-config */)


  def tenantDao(tenantId: String, ip: String, roleId: Option[String] = None): TenantDao =
    tenantDaoFactory.newTenantDao(
      QuotaConsumers(ip = Some(ip), tenantId = tenantId, roleId = roleId))


  private val mailerActorRef = Mailer.startNewActor(tenantDaoFactory)


  private val notifierActorRef =
    Notifier.startNewActor(systemDao, tenantDaoFactory)


  def sendEmail(email: Email, websiteId: String) {
    mailerActorRef ! (email, websiteId)
  }


  /** The Twitter Ostrich admin service, listens on port 9100. */
  /*
  private val _ostrichAdminService = new toa.AdminHttpService(9100, 20, Stats,
    new toa.RuntimeEnvironment(getClass))
   */


  def onServerStartup(app: Application) {
    //Debiki.SystemDao

    // For now, disable in dev mode — because of the port conflict that
    // causes an error on reload and restart, see below (search for "conflict").
    /*
    _ostrichAdminService.start()
    Logger.info("Twitter Ostrich listening on port "+
       _ostrichAdminService.address.getPort)
     */
  }


  def onServerShutdown(app: Application) {
    Logger.info("Shutting down, gracefully...")
    dbDaoFactory.shutdown()

    //_ostrichAdminService.shutdown()

    // COULD stop Twitter Ostrich on reload too -- currently there's a
    // port conflict on reload.
    // See: <https://groups.google.com/
    //    forum/?fromgroups#!topic/play-framework/g6uixxX2BVw>
    // "There is an Actor system reserved for the application code that is
    // automatically shutdown when the application restart. You can access it
    // in:  play.api.libs.Akka.system"

  }

}

