/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package debiki

import com.debiki.v0._
import com.debiki.v0.Prelude._
import debiki._
import play.api._
import play.api.mvc._


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

}


// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqn list ft=scala

