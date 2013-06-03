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
import play.api.Play
import play.api.Play.current
import com.debiki.v0.QuotaConsumers


object Debiki extends Debiki


class Debiki {

  private val dbDaoFactory = new RelDbDaoFactory({

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

    new RelDb(
      server = configStr("debiki.pgsql.server"),
      port = configStr("debiki.pgsql.port"),
      database = configStr("debiki.pgsql.database"),
      user = user,
      password = password)
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

}


// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqn list ft=scala

