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

/*
package com.debiki.tck.dao.specs

import com.debiki.core._
import com.debiki.core.Prelude._
import com.debiki.tck.dao._
import com.debiki.tck.dao.code._
import java.{util => ju}
import org.scalatest._


class UserPreferencesSpec(daoFactory: DbDaoFactory) extends DbDaoSpec(daoFactory) {

  lazy val utils = new TestUtils(daoFactory)
  lazy val site = utils.createFirstSite()
  lazy val siteUtils = new SiteTestUtils(site, daoFactory)
  def dao = siteUtils.dao


  "UserPreferencesSpec can" - {

    var passwordRole: User = null
    var passwordLoginGrant: LoginGrant = null
    var superfluousRole: User = null

    def superfluousRolesPrefs = UserPreferences(
      userId = superfluousRole.id,
      fullName = superfluousRole.displayName,
      username = superfluousRole.username,
      emailAddress = superfluousRole.email,
      url = superfluousRole.website,
      emailForEveryNewPost = false)

    "create two password roles" in {
      passwordRole = siteUtils.createPasswordRole()
      passwordLoginGrant = siteUtils.login(passwordRole)
      // Create another role to make sure we load prefs for the right one.
      superfluousRole = siteUtils.createPasswordRole("Name2")
    }

    "find user prefs" in {
      dao.loadRolePreferences(passwordRole.id) mustBe Some(UserPreferences(
        userId = passwordRole.id,
        fullName = passwordRole.displayName,
        username = passwordRole.username,
        emailAddress = passwordRole.email,
        url = passwordRole.website,
        emailForEveryNewPost = false))
      dao.loadRolePreferences(superfluousRole.id) mustBe Some(superfluousRolesPrefs)
    }

    "find no prefs non-existing user" in {
      dao.loadRolePreferences(roleId = "dummy") mustBe None
    }

    "clear prefs, find empty" in {
      val emptyPrefs = UserPreferences(
        userId = passwordRole.id,
        fullName = "",
        username = None,
        emailAddress = "",
        url = "",
        emailForEveryNewPost = false)
      dao.saveRolePreferences(emptyPrefs)
      dao.loadRolePreferences(roleId = passwordRole.id) mustBe Some(emptyPrefs)
    }

    "set prefs, find specified" in {
      val modifiedPrefs = UserPreferences(
        userId = passwordRole.id,
        fullName = "Modified Name",
        username = Some("modified_username"),
        emailAddress = "modified-email@example.com",
        url = "http://example.com",
        emailForEveryNewPost = true)
      dao.saveRolePreferences(modifiedPrefs)
      dao.loadRolePreferences(roleId = passwordRole.id) mustBe Some(modifiedPrefs)
    }

    "find other user's prefs unmodified" in {
      dao.loadRolePreferences(superfluousRole.id) mustBe Some(superfluousRolesPrefs)
    }
  }

}
*/
