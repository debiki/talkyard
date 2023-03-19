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
import com.zaxxer.hikari.{HikariDataSource, HikariConfig}
import play.{api => p}
import talkyard.server.TyLogger


// COULD rename / move, to what, where?
object Debiki {

  private val logger = TyLogger("Debiki")

  def createPostgresHikariDataSource(readOnly: Boolean, conf: p.Configuration, isTest: Boolean)
        : HikariDataSource = {

    def configStr(path: String): String =
      conf.getOptional[String](path).getOrDie("TyE93KI2", "Config value missing: "+ path)

    // I've hardcoded credentials to the test database here, so that it
    // cannot possibly happen, that you accidentally connect to the prod
    // database. (You'll never name the prod schema "talkyard_test",
    // with "auto-deleted" as password?)
    def user =
      if (isTest) "talkyard_test"
      else configStr("talkyard.postgresql.user")

    def password =
      if (isTest) "public"
      else sys.env.get("TALKYARD_POSTGRESQL_PASSWORD").orElse(sys.env.get("ED_POSTGRESQL_PASSWORD"))
          .getOrElse(configStr("talkyard.postgresql.password"))

    def database =
      if (isTest) "talkyard_test"
      else configStr("talkyard.postgresql.database")

    val server = configStr("talkyard.postgresql.host")
    val port = configStr("talkyard.postgresql.port").toInt

    val readOrWrite = readOnly ? "read only" | "read-write"

    val connectionTimeoutMs =
          conf.getOptional[Int]("talkyard.postgresql.connectionTimeoutMs") getOrElse 7500

    val socketTimeoutSeconds =
          conf.getOptional[Int]("talkyard.postgresql.socketTimeoutSecs") getOrElse 35

    logger.info(o"""Connecting to database: $server:$port/$database as user $user, $readOrWrite,
         connection timeout: $connectionTimeoutMs ms,
         socket timeout: $socketTimeoutSeconds s""")

    // Weird now with Hikari I can no longer call setReadOnly or setTransactionIsolation. [5JKF2]
    val config = new HikariConfig()
    config.setDataSourceClassName("org.postgresql.ds.PGSimpleDataSource")
    config.setUsername(user)
    config.setPassword(password)
    config.addDataSourceProperty("serverName", server)
    config.addDataSourceProperty("portNumber", port)
    config.addDataSourceProperty("databaseName", database)

    // Using too-many-connections temp hack  [7YKG25P]
    if (readOnly) {
      // If these many connections are in use already (the max), calls to
      // getConnection() block and time out after $connectionTimeoutMs millis.
      config.setMaximumPoolSize(20)
      // Hikari keeps these many active + idle connections (in total) in the connection pool.
      config.setMinimumIdle(20)
    }
    else {
      // But what are the defaults? Looking in the source, it's -1, maybe means unlimited?
    }
    config.setAutoCommit(false)
    config.setConnectionTimeout(connectionTimeoutMs)
    // The validation timeout must be less than the connection timeout.
    config.setValidationTimeout(connectionTimeoutMs - 1000)
    config.setIsolateInternalQueries(true)

    // Set these to a little bit more than Hikari's connection timeout, so by default
    // Hikari will complain rather than the driver (Hikari works better I guess).
    // "How long to wait for establishment of a database connection", in seconds.
    config.addDataSourceProperty("loginTimeout", connectionTimeoutMs / 1000 + 2) // seconds

    // "The timeout value used for socket connect operations"
    // "If connecting ... takes longer than this value, the connection is broken." Seconds.
    // config.addDataSourceProperty("connectTimeout", _) --> Property connectTimeout does not exist
    //                              on target class org.postgresql.ds.PGSimpleDataSource
    // "If reading from the server takes longer than this value, the connection is closed".
    // "can be used as both a brute force global query timeout and a method of detecting
    // network problems". Seconds.
    //
    // If too small, the initial migration might fail, like so:
    //    org.postgresql.util.PSQLException: An I/O error occurred while sending to the backend.
    //        ...
    //        at com.zaxxer.hikari.pool.HikariProxyStatement.execute(HikariProxyStatement.java)
    //        ...
    //        at org.flywaydb.core.internal.command.DbMigrate.doMigrate(DbMigrate.java:352)
    //    Caused by: java.net.SocketTimeoutException: Read timed out
    //        ...
    // and this is hard to troubleshoot, because might happen only on computers with a little bit
    // slower hardware. 5 seconds is too small, and for some infrequent bigger migrations,
    // even 15 is too small.
    //
    config.addDataSourceProperty("socketTimeout", socketTimeoutSeconds)


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

    // Slow logging: Configure in PostgreSQL instead.

    val dataSource =
      try new HikariDataSource(config)
      catch {
        case ex: Exception =>
          logger.error(s"Error connecting to database, for ${config.getPoolName} [EsE7JK4]", ex)
          throw ex
      }

    logger.info("Connected to database. [EsM2KP40]")

    // Currently I'm sometimes using > 1 connection per http request (will fix later),
    // so in order to avoid out-of-connection deadlocks, set a large pool size.
    // Better size: https://github.com/brettwooldridge/HikariCP/wiki/About-Pool-Sizing
    // connections = ((core_count * 2) + effective_spindle_count)
    // — let's assume 8 cores and a few disks --> say 20 connections.
    //
    CLEAN_UP; REMOVE // This is *after* setting to 20 above already, and having
    // connected to the database — this has no effect. So remove, later, but
    // test a bit first.  (Move the above comment to setMaximumPoolSize(..) above.)
    config.setMaximumPoolSize(100) // did I fix the bug everywhere? then change to 20

    dataSource
  }

}


// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqn list ft=scala

