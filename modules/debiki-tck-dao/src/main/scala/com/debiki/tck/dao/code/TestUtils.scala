/**
 * Copyright (C) 2014 Kaj Magnus Lindberg (born 1979)
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


package com.debiki.tck.dao.code

import com.debiki.core._
import com.debiki.core.Prelude._
import java.{util => ju}


class TestUtils(val daoFactory: DbDaoFactory) {

  def createFirstSite(): Site = {
    // Nowadays it exists already, so:
    Site(
      Site.FirstSiteId,
      name = "First Site",
      createdAt = When.fromMillis(1234567890),
      creatorIp = "0.0.0.0",
      creatorEmailAddress = "unknown@example.com",
      embeddingSiteUrl = None,
      hosts = Nil)
  }

}

