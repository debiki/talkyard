/**
 * Copyright (C) 2015 Kaj Magnus Lindberg (born 1979)
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

package db.migration.y2015

import db.migration.MigrationHelper
import org.flywaydb.core.api.migration.jdbc.JdbcMigration
import java.{sql => js}


class v14__migrate_posts extends JdbcMigration {

  def migrate(connection: js.Connection) {
    /* This fails because nowadays MigrationHelper.systemDbDao already has a connection already,
      and then setTheOneAndOnlyConnection() throws an error..
      *Need not fix* — the migration has been run already everywhere, and isn't needed in new dbs.
    MigrationHelper.systemDbDao.setTheOneAndOnlyConnection(connection)
    MigrationHelper.scalaBasedMigrations.runMigration14(MigrationHelper.systemDbDao)
     */
  }

}