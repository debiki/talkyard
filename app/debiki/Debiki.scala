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

import com.debiki.v0._
import com.debiki.v0.Prelude._
import play.{api => p}
import play.api.Play
import play.api.Play.current
import com.debiki.v0.QuotaConsumers


object Debiki extends Debiki


class Debiki {

  private val dbDaoFactory = new RelDbDaoFactory({
    //val dataSourceName = if (Play.isTest) "test" else "default"
    //val dataSource = p.db.DB.getDataSource(dataSourceName)
    val dataSource = getPostgreSqlDataSource()
    val db = new RelDb(dataSource)

    // Log which database we've connected to.
    //val boneDataSource = dataSource.asInstanceOf[com.jolbox.bonecp.BoneCPDataSource]
    //p.Logger.info(o"""Connected to database:
    //  ${boneDataSource.getJdbcUrl} as user ${boneDataSource.getUsername}.""")

    db
  })


  def systemDao = new CachingSystemDao(dbDaoFactory.systemDbDao)


  // Don't run out of quota when running e2e tests.
  protected def freeDollarsToEachNewSite: Float = if (Play.isTest) 1000.0f else 1.0f


  private val quotaManager = new QuotaManager(systemDao, freeDollarsToEachNewSite)
  quotaManager.scheduleCleanups()


  private val tenantDaoFactory = new CachingTenantDaoFactory(dbDaoFactory,
    quotaManager.QuotaChargerImpl /*, cache-config */)


  def tenantDao(tenantId: String, ip: String, roleId: Option[String] = None)
        : TenantDao =
    tenantDaoFactory.newTenantDao(QuotaConsumers(ip = Some(ip),
      tenantId = tenantId, roleId = roleId))


  private val mailerActorRef = Mailer.startNewActor(tenantDaoFactory)


  private val notifierActorRef =
    Notifier.startNewActor(systemDao, tenantDaoFactory)


  def sendEmail(email: Email, websiteId: String) {
    mailerActorRef ! (email, websiteId)
  }


  // Play's BoneCP v.0.7.1 is broken and unusable, and SBT refuses to use version 0.8 RC1
  // which supposedly has fixed the problem. Use Postgres connection pool instead.
  // The problem is:
  //    java.sql.SQLException: Timed out waiting for a free available connection.
  //    at com.jolbox.bonecp.BoneCP.getConnection(BoneCP.java:503)
  //                                  ~[com.jolbox.bonecp-0.7.1.RELEASE.jar:0.7.1.RELEASE
  // See: http://stackoverflow.com/questions/15480506/
  //                        heroku-play-bonecp-connection-issues/15500442#15500442
  private def getPostgreSqlDataSource(): javax.sql.DataSource = {

    def configPrefix = if (Play.isTest) "test." else ""

    def configStr(path: String) =
      Play.configuration.getString(configPrefix + path) getOrElse
        runErr("DwE93KI2", "Config value missing: "+ path)

    // I've hardcoded credentials to the test database here, so that it
    // cannot possibly happen, that you accidentally connect to the prod
    // database. (You'll never name the prod schema "debiki_test_0_0_2_empty",
    // with "auto-dropped" as password?)
    def user =
      if (Play.isTest) "debiki_test_0_0_2_empty"
      else configStr("debiki.pgsql.user")

    def password =
      if (Play.isTest) "auto-dropped"
      else configStr("debiki.pgsql.password")

    val ds = new org.postgresql.ds.PGPoolingDataSource()
    ds.setDataSourceName("DebikiPostgreConnCache"+ math.random)
    val server = configStr("debiki.pgsql.server")
    val port = configStr("debiki.pgsql.port").toInt
    val dbName = configStr("debiki.pgsql.database")
    ds.setServerName(server)
    ds.setPortNumber(port)
    ds.setDatabaseName(dbName)
    ds.setUser(user)
    ds.setPassword(password)
    ds.setInitialConnections(2)
    ds.setMaxConnections(10)
    ds.setPrepareThreshold(3)

    play.Logger.info(s"""Connected to database: $server:$port/$dbName as $user""")
    ds
  }

}


// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqn list ft=scala

