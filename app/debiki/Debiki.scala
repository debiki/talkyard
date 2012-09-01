/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package debiki

import com.debiki.v0._
import com.debiki.v0.Prelude._
import controllers.{DebikiRequest, PageRequest}
import play.api.Play
import play.api.Play.current


object Debiki {

  lazy val TemplateEngine = new TemplateEngine(PageCache)

  lazy val PageCache = new PageCache

  val QuotaManager = new QuotaManager

  val DaoFactory = new CachingDaoFactory(new RelDbDaoSpiFactory( {
    def configStr(path: String) =
      Play.configuration.getString(path) getOrElse
         runErr("DwE93KI2", "Config value missing: "+ path)
    new RelDb(
      server = configStr("debiki.pgsql.server"),
      port = configStr("debiki.pgsql.port"),
      database = configStr("debiki.pgsql.database"),
      user = configStr("debiki.pgsql.user"),
      password = configStr("debiki.pgsql.password"))
  }), QuotaManager.QuotaChargerImpl)

  QuotaManager.setDao(DaoFactory.systemDao)
  QuotaManager.scheduleCleanups()

  val MailerActorRef = Mailer.startNewActor(DaoFactory)

  def SystemDao = DaoFactory.systemDao


  def tenantDao(tenantId: String, ip: String, roleId: Option[String] = None)
        : TenantDao =
    DaoFactory.buildTenantDao(QuotaConsumers(ip = Some(ip),
       tenantId = tenantId, roleId = roleId))


  /**
   * Saves page actions and refreshes caches and places messages in
   * users' inboxes, as needed.
   */
  def savePageActions(pageReq: PageRequest[_], actions: List[Action]) {
    savePageActions(pageReq, pageReq.page_!, actions)
  }


  def savePageActions(request: DebikiRequest[_], page: Debate,
        actions: List[Action]) {

    if (actions isEmpty)
      return

    import request.{dao, user_!}
    val actionsWithId = dao.savePageActions(page.id, actions)

    // Possible optimization: Examine all actions, and refresh cache only
    // if there are e.g. EditApp:s or Replie:s (but ignore Edit:s -- if
    // not applied).
    PageCache.refreshLater(tenantId = request.tenantId, pageId = page.id,
       host = request.host)

    // Would it be okay to simply overwrite the in mem cache with this
    // updated page?
    //val pageWithNewActions =
    // page_! ++ actionsWithId ++ pageReq.login_! ++ pageReq.user_!

    // In the future, also refresh page index cache, and cached page titles?
    // (I.e. a cache for DW1_PAGE_PATHS.)

    // Notify users whose actions were affected.
    // BUG: notification lost if server restarted here.
    // COULD rewrite Dao so the seeds can be saved in the same transaction:
    val seeds = Notification.calcFrom(user_!, adding = actionsWithId, to = page)
    dao.saveNotfs(seeds)
  }

}


// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqn list ft=scala

