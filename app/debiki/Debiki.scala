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

import com.debiki.core.Prelude._
import play.{api => p}
import play.api.Play
import play.api.Play.current


// COULD rename / move, to what, where?
object Debiki {

  // COULD start using HikariCP, http://brettwooldridge.github.io/HikariCP/,
  // instead. BoneCP mentioned below is dead.
  //
  // Play's BoneCP v.0.7.1 is broken and unusable, and SBT refuses to use version 0.8 RC1
  // which supposedly has fixed the problem. Use Postgres connection pool instead.
  // The problem is:
  //    java.sql.SQLException: Timed out waiting for a free available connection.
  //    at com.jolbox.bonecp.BoneCP.getConnection(BoneCP.java:503)
  //                                  ~[com.jolbox.bonecp-0.7.1.RELEASE.jar:0.7.1.RELEASE
  // See: http://stackoverflow.com/questions/15480506/
  //                        heroku-play-bonecp-connection-issues/15500442#15500442
  def getPostgreSqlDataSource(): javax.sql.DataSource = {

    def configStr(path: String) =
      Play.configuration.getString(path) getOrElse
        runErr("DwE93KI2", "Config value missing: "+ path)

    // I've hardcoded credentials to the test database here, so that it
    // cannot possibly happen, that you accidentally connect to the prod
    // database. (You'll never name the prod schema "debiki_test",
    // with "auto-deleted" as password?)
    def user =
      if (Play.isTest) "debiki_test"
      else configStr("debiki.postgresql.user")

    def password =
      if (Play.isTest) "auto-deleted"
      else sys.env.get("DEBIKI_POSTGRESQL_PASSWORD") getOrElse
        configStr("debiki.postgresql.password")

    def database =
      if (Play.isTest) "debiki_test"
      else configStr("debiki.postgresql.database")

    // COULD start using HikariCP instead, see comment above this function.
    val ds = new org.postgresql.ds.PGPoolingDataSource()
    ds.setDataSourceName("DebikiPostgreConnCache"+ math.random)
    val server = configStr("debiki.postgresql.server")
    val port = configStr("debiki.postgresql.port").toInt
    val dbName = database
    ds.setServerName(server)
    ds.setPortNumber(port)
    ds.setDatabaseName(dbName)
    ds.setUser(user)
    ds.setPassword(password)
    ds.setInitialConnections(2)
    // Currently I'm sometimes using > 1 connection per http request (will fix later),
    // so in order to avoid out-of-connection deadlocks, set a large pool size.
    ds.setMaxConnections(100)
    ds.setPrepareThreshold(3)

    play.Logger.info(s"""Connected to database: $server:$port/$dbName as $user""")
    ds
  }

}


// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqn list ft=scala

