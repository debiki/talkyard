/**
 * Copyright (C) 2011-2012 Kaj Magnus Lindberg (born 1979)
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

package com.debiki.core

import java.{util => ju}


trait PeopleTestUtils {

  def makePerson(idBase: String): (User, Identity, Login) = {
    val user = User(idBase + "id", idBase + " name", "em@a.il",
      EmailNotfPrefs.Receive)
    val idty = IdentitySimple(idBase + "Idty",
      userId = user.id, name = user.displayName)
    val login = Login(idBase + "Login",
      None, "1.2.3.4", new ju.Date(11000), idty.id)
    (user, idty, login)
  }

}


object PeopleTestUtils extends PeopleTestUtils

