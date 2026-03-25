package com.debiki.dao.rdb

import com.debiki.core._
import com.debiki.core.Prelude._
import scala.util.matching.Regex
import sys.process._


object Migrator {


  // This is what sqlx outputs, if editing a migration script although it's
  // been applied already. (Fine if is testing, bad++ if prod.)
  private val _PreviouslyAppliedRegex: Regex =
    "error: migration [0-9]+ was previously applied but has been modified".r


  /** Finds all pending migration scripts in images/app/migrations/ and applies them.
    */
  def migrateDatabase(dbUrl: PostgresDbUrl, isTest: Bo): Opt[ErrMsgCode] = {
    var output: St = ""
    val outputHandler = sys.process.ProcessLogger((allOutput: St) => {
      output = allOutput
    })

   val PostgresDbUrl(urlWithPwd, urlPwdRedacted, dbAdr) = dbUrl

    // The url looks like:  "postgres://db_user:passwd@rdb/database_name"
    SHOULD // Group all pending migrations together in the same transaction, so if
    // upgrading from version 3 to version 8, migrations 4,5,6,7,8 will either succeed
    // or fail all of them. This means that if there's any error, we'll be back at
    // version 3 again — rather than some other unknown version for which we don't
    // immediately know which *software* version to use.
    // GitHub --group feature discussion:  https://github.com/launchbadge/sqlx/discussions/3770
    //
    val migrCmdWithPwd = s"""/usr/local/bin/sqlx migrate run --database-url "$urlWithPwd" """

    System.out.println(
          if (isTest) s"Migrating test database $urlWithPwd:"  // test, ok show pwd
          else s"Migrating database $urlPwdRedacted:")         // password redacted
    val exitCode = migrCmdWithPwd.!(outputHandler)
    if (exitCode == 0) {
      System.out.println(s"Done migrating database $dbAdr, output:\n\n$output\n")
      None // no error
    }
    else if (isTest && _PreviouslyAppliedRegex.matches(output)) {
      // Recreate test database. This'll apply all migrations, too.
      System.out.println(o"""Migration files have been edited. Recreating test database $dbAdr,
             then migrating ... [TyMSQLXRESET]""")

      // Double check it's a test database.
      dieIf(!urlWithPwd.endsWith("@rdb:5432/talkyard_test"),
            "TyETESTDBNAME", s"Test database has unexpected name: $dbAdr, not resetting it")

      val resetCmdWithPwd =
            s"""/usr/local/bin/sqlx database reset -y --database-url "$urlWithPwd" """
      val exitCode = resetCmdWithPwd.!(outputHandler)

      if (exitCode == 0) {
        System.out.println(s"Recreated & migrated database $dbAdr, output:\n\n$output\n")
        None // no error
      }
      else {
        System.err.println(s"Error recreating database $dbAdr:\n\n$output\n")
        Some(ErrMsgCode(output, "TyESQLXRESET"))
      }
    }
    else {
      System.err.println(s"Error code $exitCode when migrating database $dbAdr:\n\n$output\n")
      Some(ErrMsgCode(output, "TyESQLXMIGR"))
    }

    // Later: Could run Scala based migrations here, if need to migrate database content rather
    // than table structures. Did once, long ago when using Flyway, see:
    // - class db.migration.y2015.v14__migrate_posts
    // - class db.migration.MigrationHelper
    // - class talkyard.server.migrations.ScalaBasedMigrations
    // - file appsv/server/talkyard/server/migrations/Migration14.scala
    // But usually better to do that as background jobs, using the job_queue_t table,
    // a little bit at a time, if the db is huge.
  }

}
