package com.debiki.dao.rdb

import com.debiki.core._
import com.debiki.core.Prelude._
import scala.util.matching.Regex


object Migrator {


  // This is what sqlx outputs, if editing a migration script although it's
  // been applied already. (Fine if is testing, bad++ if prod.)
  private val _PreviouslyAppliedRegex: Regex =
    "error: migration [0-9]+ was previously applied but has been modified".r


  /** Finds all pending migration scripts in images/app/migrations/ and applies them.
    */
  def migrateDatabase(databaseUrlAndWoPwd: (St, St), isTest: Bo): Opt[ErrMsgCode] = {
    import sys.process._
    var output: St = ""
    val outputHandler = ProcessLogger((allOutput: St) => {
      output = allOutput
    })

   val (databaseUrl, urlNoPwd) = databaseUrlAndWoPwd

    // The url looks like:  "postgres://db_user:passwd@rdb/database_name"
    val migrCmdWithPwd = s"""/usr/local/bin/sqlx migrate run --database-url "$databaseUrl" """
    val dbAdr = databaseUrl.takeRightWhile(_ != '@') // removes the pwd
    System.out.println(
          if (isTest) s"Migrating test database $databaseUrl:"  // test, ok show pwd
          else s"Migrating database $urlNoPwd:")                // password redacted
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
      dieIf(!databaseUrl.endsWith("@rdb:5432/talkyard_test"),
            "TyETESTDBNAME", s"Test database has unexpected name: $dbAdr, not resetting it")

      val resetCmdWithPwd =
            s"""/usr/local/bin/sqlx database reset -y --database-url "$databaseUrl" """
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
      // Don't show the whole `migrCmdWithPwd` — it includes the db password!
      System.err.println(s"Error code $exitCode when migrating database $dbAdr:\n\n$output\n")
      Some(ErrMsgCode(output, "TyESQLXMIGR"))
    }
  }

}
