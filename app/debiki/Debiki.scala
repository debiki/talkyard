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
import com.zaxxer.hikari.{HikariDataSource, HikariConfig}
import play.{api => p}
import play.api.Play
import play.api.Play.current


// COULD rename / move, to what, where?
object Debiki {


  def createPostgresHikariDataSource(readOnly: Boolean): HikariDataSource = {

    def configStr(path: String) =
      Play.configuration.getString(path).orElse({
        val oldPath = path.replaceFirst("ed\\.", "debiki.")
        Play.configuration.getString(oldPath)
      }) getOrElse
        runErr("DwE93KI2", "Config value missing: "+ path)

    // I've hardcoded credentials to the test database here, so that it
    // cannot possibly happen, that you accidentally connect to the prod
    // database. (You'll never name the prod schema "ed_test",
    // with "auto-deleted" as password?)
    def user =
      if (Play.isTest) "ed_test"
      else configStr("ed.postgresql.user")

    def password =
      if (Play.isTest) "public"
      else sys.env.get("ED_POSTGRESQL_PASSWORD").orElse(sys.env.get("DEBIKI_POSTGRESQL_PASSWORD"))
          .getOrElse(configStr("ed.postgresql.password"))

    def database =
      if (Play.isTest) "ed_test"
      else configStr("ed.postgresql.database")

    val server = Play.configuration.getString("ed.postgresql.host").getOrElse(
      configStr("ed.postgresql.server"))  // deprecated name
    val port = configStr("ed.postgresql.port").toInt

    val readOrWrite = readOnly ? "read only" | "read-write"
    play.Logger.info(s"Connecting to database: $server:$port/$database as user $user, $readOrWrite")

    // Weird now with Hikari I can no longer call setReadOnly or setTransactionIsolation. [5JKF2]
    val config = new HikariConfig()
    config.setDataSourceClassName("org.postgresql.ds.PGSimpleDataSource")
    config.setUsername(user)
    config.setPassword(password)
    config.addDataSourceProperty("serverName", server)
    config.addDataSourceProperty("portNumber", port)
    config.addDataSourceProperty("databaseName", database)

    val WaitForConnectionMillis = 3000

    // Using too-many-connections temp hack  [7YKG25P]
    if (readOnly) {
      config.setMaximumPoolSize(20)
      config.setMinimumIdle(20)
    }
    config.setAutoCommit(false)
    config.setConnectionTimeout(WaitForConnectionMillis)
    // The validation timeout must be less than the connection timeout.
    config.setValidationTimeout(WaitForConnectionMillis - 1000)
    config.setIsolateInternalQueries(true)

    // Set these to a little bit more than Hikari's connection timeout, so by default
    // Hikari will complain rather than the driver (Hikari works better I guess).
    // "How long to wait for establishment of a database connection", in seconds.
    config.addDataSourceProperty("loginTimeout", WaitForConnectionMillis / 1000 + 2) // seconds

    // "The timeout value used for socket connect operations"
    // "If connecting ... takes longer than this value, the connection is broken." Seconds.
    // config.addDataSourceProperty("connectTimeout", _) --> Property connectTimeout does not exist
    //                              on target class org.postgresql.ds.PGSimpleDataSource
    // "If reading from the server takes longer than this value, the connection is closed".
    // "can be used as both a brute force global query timeout and a method of detecting
    // network problems". Seconds.
    //
    // If too small (5 seconds is too small), the initial migration might fail, like so:
    //    org.postgresql.util.PSQLException: An I/O error occurred while sending to the backend.
    //        ...
    //        at com.zaxxer.hikari.pool.HikariProxyStatement.execute(HikariProxyStatement.java)
    //        ...
    //        at org.flywaydb.core.internal.command.DbMigrate.doMigrate(DbMigrate.java:352)
    //    Caused by: java.net.SocketTimeoutException: Read timed out
    //        ...
    // and this is hard to troubleshoot, because might happen only on computers with a little bit
    // slower hardware.
    config.addDataSourceProperty("socketTimeout", 15) // seconds

    config.setReadOnly(readOnly)
    config.setTransactionIsolation("TRANSACTION_SERIALIZABLE")

    // Weird:
    // https://github.com/brettwooldridge/HikariCP#initialization:
    // "We strongly recommend setting this value" — ok, but to what?
    // "at least 30 seconds less than any database-level connection timeout" — don't they mean
    // "more" not "less"? setConnectionTimeout(2*1000) above is just 2 seconds.
    // config.setMaxLifetime(???)

    // Start even if the database is not accessible, and show a friendly please-start-the-database
    // error page. — Hmm, no, Flyway needs an okay connection.
    // config.setInitializationFailFast(false)

    // Caching prepared statements = anti pattern, see:
    // https://github.com/brettwooldridge/HikariCP#statement-cache — better let the drivers
    // + the database cache (instead of per connection in the pool) because then just 1 cache
    // for all connections. (If I understood correctly?)

    // Slow loggin: Configure in PostgreSQL instead.

    val dataSource =
      try new HikariDataSource(config)
      catch {
        case ex: Exception =>
          p.Logger.error(s"Error connecting to database, for ${config.getPoolName} [EsE7JK4]", ex)
          throw ex
      }

    p.Logger.info("Connected to database. [EsM2KP40]")

    // Currently I'm sometimes using > 1 connection per http request (will fix later),
    // so in order to avoid out-of-connection deadlocks, set a large pool size.
    // Better size: https://github.com/brettwooldridge/HikariCP/wiki/About-Pool-Sizing
    // connections = ((core_count * 2) + effective_spindle_count)
    // — let's assume 8 cores and a few disks --> say 20 connections.
    config.setMaximumPoolSize(100) // did I fix the bug everywhere? then change to 20

    dataSource
  }

}


// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqn list ft=scala

