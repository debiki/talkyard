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
import debiki.dao._
import java.{util => ju}


class LoginAppSpec extends DaoAppSuite() {
  var dao: SiteDao = _

  val Member1PasswordEnd = "lg_mb1"
  val Member1Password: String = "public-" + Member1PasswordEnd

  lazy val moderator: Member = createPasswordModerator("lg_mod", dao)
  lazy val member1: Member = createPasswordUser(Member1PasswordEnd, dao)
  lazy val wrongMember: Member = createPasswordUser("lg_wr_mb", dao)


  "Members can login with password" - {
    val now = new ju.Date()

    "prepare" in {
      globals.systemDao.getOrCreateFirstSite()
      dao = globals.siteDao(Site.FirstSiteId)
      createPasswordOwner("lg_adm", dao)
    }

    "non-existing members cannot login" in {
      intercept[DbDao.NoMemberWithThatEmailException.type] {
        dao.tryLoginAsMember(PasswordLoginAttempt(
          ip = "1.2.3.4", globals.now().toJavaDate, "the-wrong-email@x.co", "pwd"))
      }
    }

    SECURITY // add test that verifies email login is prevented, also if email verification isn't enabled,
    // before the email has been verified. [2PSK5W0R]
    "cannot login before email verified" in {
      intercept[DbDao.EmailNotVerifiedException.type] {
        dao.tryLoginAsMember(PasswordLoginAttempt(
          ip = "1.2.3.4", globals.now().toJavaDate, member1.email, Member1Password))
      }
    }

    "the email gets verified" in {
      dao.verifyPrimaryEmailAddress(member1.id, globals.now().toJavaDate)
    }

    "cannot login with the wrong password" in {
      intercept[DbDao.BadPasswordException.type] {
        dao.tryLoginAsMember(PasswordLoginAttempt(
          ip = "1.2.3.4", globals.now().toJavaDate, member1.email, "wrong_password"))
      }
    }

    "can login with the correct password" in {
      val loginGrant = dao.tryLoginAsMember(PasswordLoginAttempt(
        ip = "1.2.3.4", globals.now().toJavaDate, member1.email, Member1Password))
      loginGrant.user.id mustBe member1.id
    }

  }
}
