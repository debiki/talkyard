/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package debiki

import com.debiki.v0._
import com.debiki.v0.Prelude._
import controllers.Actions.PageRequest
import net.liftweb.common.{Box, Full, Empty, Failure}


object Debiki {

  lazy val TemplateEngine = new TemplateEngine(PageCache, Dao)

  lazy val PageCache = new PageCache(Dao)

  val Dao = new CachingDao(new RelDbDaoSpi(new RelDb(
    /*
    // ssh tunnel to www.debiki.se prod db
    server = System.getProperty("debiki.pgsql.servername", "127.0.0.1"),
    port = System.getProperty("debiki.pgsql.port", "55432"),
    database = System.getProperty("debiki.pgsql.database", "debiki_prod"),
    user = System.getProperty("debiki.pgsql.user", "debiki_prod"),
    password = System.getProperty("debiki.pgsql.password", "..."))))
    */
    // local db
    server = System.getProperty("debiki.pgsql.servername", "192.168.0.123"),
    port = System.getProperty("debiki.pgsql.port", "5432"),
    database = System.getProperty("debiki.pgsql.database", "debiki"),
    user = System.getProperty("debiki.pgsql.user", "debiki_dev_0_0_2"),
    password = System.getProperty("debiki.pgsql.password", "apabanan454"))))
    //*/


  /**
   * Saves page actions and refreshes caches and places messages in
   * users' inboxes, as needed.
   */
  def savePageActions(pageReq: PageRequest[_], actions: List[Action]) {
    if (actions isEmpty)
      return

    import pageReq.{tenantId, pageId, page_!, user}
    val Full(actionsWithId) = Dao.savePageActions(tenantId, pageId, actions)

    // Possible optimization: Examine all actions, and refresh cache only
    // if there are e.g. EditApp:s or Replie:s (but ignore Edit:s -- if
    // not applied).
    PageCache.refreshLater(pageReq)

    // In the future, also refresh page index cache, and cached page titles?
    // (I.e. a cache for DW1_PAGE_PATHS.)

    // Notify users whose actions were affected.
    // BUG: notification lost if server restarted here.
    // COULD rewrite Dao so the seeds can be saved in the same transaction:
    val seeds = Inbox.calcSeedsFrom(user, adding = actionsWithId, to = page_!)
    Dao.saveInboxSeeds(tenantId, seeds)
  }

}


// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqn list ft=scala

