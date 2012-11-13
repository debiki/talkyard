/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package debiki

import com.debiki.v0._
import com.debiki.v0.Prelude._
import controllers.{DebikiRequest, PageRequest}
import play.api.Play
import play.api.Play.current
import xml.NodeSeq
import controllers.PageRequest
import com.debiki.v0.QuotaConsumers


object Debiki {

  lazy val PageCache = new PageCache


  private val _DaoSpiFactory = new RelDbDaoFactory({
    def configStr(path: String) =
      Play.configuration.getString(path) getOrElse
         runErr("DwE93KI2", "Config value missing: "+ path)
    new RelDb(
      server = configStr("debiki.pgsql.server"),
      port = configStr("debiki.pgsql.port"),
      database = configStr("debiki.pgsql.database"),
      user = configStr("debiki.pgsql.user"),
      password = configStr("debiki.pgsql.password"))
  })


  val QuotaManager = new QuotaManager(SystemDao)
  QuotaManager.scheduleCleanups()


  def SystemDao = _DaoSpiFactory.systemDbDao


  val RichDaoFactory = new CachingDaoFactory(_DaoSpiFactory,
    QuotaManager.QuotaChargerImpl /*, cache-config */)


  private val _MailerActorRef = Mailer.startNewActor(RichDaoFactory)
  private val _NotifierActorRef = Notifier.startNewActor(RichDaoFactory)


  def tenantDao(tenantId: String, ip: String, roleId: Option[String] = None)
        : TenantDao =
    RichDaoFactory.newTenantDao(QuotaConsumers(ip = Some(ip),
       tenantId = tenantId, roleId = roleId))


  def sendEmail(email: Email, websiteId: String) {
    _MailerActorRef ! (email, websiteId)
  }

}


// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqn list ft=scala

