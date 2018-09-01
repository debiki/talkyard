/**
 * Copyright (C) 2017 Kaj Magnus Lindberg
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

package ed.server.auth

import com.debiki.core._
import debiki.AllSettings
import debiki.EdHttp.ResultException
import debiki.dao._
import java.{util => ju}


// Dupl test code, oh well [5WKBAS2]
class SignupAppSpecDefaultSettings extends DaoAppSuite() {
  var dao: SiteDao = _

  val tooShortPassword: String = "p4s5w0rd!234" take (AllSettings.MinPasswordLengthHardcodedDefault - 1)

  "People cannot do bad things when signing up, default settings" - {
    val now = new ju.Date()

    "prepare" in {
      globals.systemDao.getOrCreateFirstSite()
      dao = globals.siteDao(Site.FirstSiteId)
    }

    "the owner cannot sign up with a bad password" in {
      val ex = intercept[ResultException] {
        dao.createPasswordUserCheckPasswordStrong(NewPasswordUserData.create(
          name = Some("Obelix Owner"), username = "obleix",
          email = s"obelix@x.co", password = tooShortPassword,
          createdAt = globals.now(),
          isAdmin = true, isOwner = true).get, browserIdData)
      }
      ex.getMessage must include("TyEADMPWMIN_")

      // Could check some more things, like not username in password.
    }

    var owner: Member = null

    "the owner signs up with an ok password" in {
      owner = createPasswordOwner("lg_adm", dao)
    }

    "cannot change to a too short" in {
      val ex = intercept[ResultException] {
        dao.changePasswordCheckStrongEnough(owner.id, tooShortPassword)
      }
      ex.getMessage must include("TyEADMPWMIN_")
    }

    "other people also cannot sign up with too short passwords" in {
      val ex = intercept[ResultException] {
        dao.createPasswordUserCheckPasswordStrong(NewPasswordUserData.create(
          name = Some("Mia Member"), username = "mia",
          email = s"mia@x.co", password = tooShortPassword.take(AllSettings.HardMinPasswordLength - 1),
          createdAt = globals.now(),
          isAdmin = false, isOwner = false).get, browserIdData)
      }
      ex.getMessage must include("TyEPWMIN_")

      // Could check some more things, like not username in password.
    }

  }
}


object CustomSettings {
 val MinPasswordLength = 8
}

// Dupl test code, oh well [5WKBAS2]
class SignupAppSpecCustomSettings extends DaoAppSuite(
  minPasswordLength = Some(CustomSettings.MinPasswordLength)) {

  var dao: SiteDao = _

  val tooShortPassword: String = "p4s5w0rd!234" take (CustomSettings.MinPasswordLength - 1)

  "People cannot do bad things when signing up, with custom settings" - {
    val now = new ju.Date()

    "prepare" in {
      globals.systemDao.getOrCreateFirstSite()
      dao = globals.siteDao(Site.FirstSiteId)
    }

    "the owner cannot sign up with a bad password" in {
      val ex = intercept[ResultException] {
        dao.createPasswordUserCheckPasswordStrong(NewPasswordUserData.create(
          name = Some("Obelix Owner"), username = "obleix",
          email = s"obelix@x.co", password = tooShortPassword,
          createdAt = globals.now(),
          isAdmin = true, isOwner = true).get, browserIdData)
      }
      ex.getMessage must include("TyEADMPWMIN_")

      // Could check some more things, like not username in password.
    }

    var owner: Member = null

    "the owner signs up with an ok password" in {
      owner = createPasswordOwner("lg_adm", dao)
    }

    "cannot change to a too short" in {
      val ex = intercept[ResultException] {
        dao.changePasswordCheckStrongEnough(owner.id, tooShortPassword)
      }
      ex.getMessage must include("TyEADMPWMIN_")
    }

  }
}
