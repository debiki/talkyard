/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package debiki

import com.debiki.v0._
import com.debiki.v0.Prelude._
import play.api.Play
import play.api.Play.current
import com.debiki.v0.QuotaConsumers


object Debiki {


  private val _dbDaoFactory = new RelDbDaoFactory({

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


  val SystemDao = new CachingSystemDao(_dbDaoFactory.systemDbDao)
  def systemDao = SystemDao // use instead, shouldn't be uppercase


  val QuotaManager = new QuotaManager(SystemDao)
  QuotaManager.scheduleCleanups()


  private val _tenantDaoFactory = new CachingTenantDaoFactory(_dbDaoFactory,
    QuotaManager.QuotaChargerImpl /*, cache-config */)


  private val _MailerActorRef = Mailer.startNewActor(_tenantDaoFactory)


  private val _NotifierActorRef =
    Notifier.startNewActor(SystemDao, _tenantDaoFactory)


  def tenantDao(tenantId: String, ip: String, roleId: Option[String] = None)
        : TenantDao =
    _tenantDaoFactory.newTenantDao(QuotaConsumers(ip = Some(ip),
       tenantId = tenantId, roleId = roleId))


  def sendEmail(email: Email, websiteId: String) {
    _MailerActorRef ! (email, websiteId)
  }

}


// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqn list ft=scala

