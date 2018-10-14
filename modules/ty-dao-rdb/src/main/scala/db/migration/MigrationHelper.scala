package db.migration

import com.debiki.core.ScalaBasedDatabaseMigrations
import com.debiki.dao.rdb.RdbSystemTransaction

object MigrationHelper {

  var scalaBasedMigrations: ScalaBasedDatabaseMigrations = _

  /** Makes a SystemDbDao available to Flyway Java migrations (well, Scala not Java). */
  var systemDbDao: RdbSystemTransaction = _

}
