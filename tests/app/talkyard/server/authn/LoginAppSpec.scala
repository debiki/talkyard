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

package talkyard.server.authn

import com.debiki.core._
import debiki.dao._
import java.{util => ju}


class LoginAppSpec extends DaoAppSuite() {
  var dao: SiteDao = _

  val Member1Username = "lg_mb1"
  val Member1Password: String = "public-" + Member1Username

  lazy val moderator: User = createPasswordModerator("lg_mod", dao)
  lazy val member1: User = createPasswordUser(Member1Username, dao, password = Some(Member1Password))
  lazy val wrongMember: User = createPasswordUser("lg_wr_mb", dao)


  "Members can login with password" - {
    val now = new ju.Date()

    "prepare" in {
      globals.systemDao.getOrCreateFirstSite()
      dao = globals.siteDao(Site.FirstSiteId)
      createPasswordOwner("lg_adm", dao)
    }

    "non-existing members cannot login" in {
      val result = dao.tryLoginAsMember(PasswordLoginAttempt(
            ip = "1.2.3.4", globals.now().toJavaDate, "the-wrong-email@x.co", "pwd"))
      result.swap.get.theException_forTests mustBe a[DbDao.NoSuchEmailOrUsernameException.type]
    }

    SECURITY // add test that verifies email login is prevented, also if email verification isn't enabled,
    // before the email has been verified. [2PSK5W0R]
    "cannot login before email verified" in {
      val result = dao.tryLoginAsMember(PasswordLoginAttempt(
            ip = "1.2.3.4", globals.now().toJavaDate, member1.email, Member1Password))
      result.swap.get.theException_forTests mustBe a[DbDao.EmailNotVerifiedException.type]
    }

    "the email gets verified" in {
      dao.verifyPrimaryEmailAddress(member1.id, globals.now().toJavaDate)
    }

    "cannot login with the wrong password" in {
      val result = dao.tryLoginAsMember(PasswordLoginAttempt(
            ip = "1.2.3.4", globals.now().toJavaDate, member1.email, "wrong_password"))
      result.swap.get.theException_forTests mustBe a[DbDao.BadPasswordException.type]
    }

    "can login with the correct password" - {
      "via email" in {
        val loginGrant = dao.tryLoginAsMember(PasswordLoginAttempt(
          ip = "1.2.3.4", globals.now().toJavaDate, member1.email, Member1Password)).get
        loginGrant.user.id mustBe member1.id
      }
      "and via username" in {
        val loginGrant = dao.tryLoginAsMember(PasswordLoginAttempt(
          ip = "1.2.3.4", globals.now().toJavaDate, member1.theUsername, Member1Password)).get
        loginGrant.user.id mustBe member1.id
      }
    }

    "cannot login after account deleted" - {
      var anonNNN: UserInclDetails = null

      "mem cache says user *not* deleted" in {
        val user = dao.getTheParticipant(member1.id)
        user.isDeleted mustBe false
      }

      "delete user" in {  // EdT5WKBWQ2
        // Pretend the username was in use for a while, because different constraints require this.
        // If was never in use — then better delete it from the database instead.
        playTimeSeconds(30)
        anonNNN = dao.deleteUser(member1.id, Who.System)
      }

      "mem cache now says user *is* deleted" in {
        val user = dao.getTheParticipant(member1.id)
        user.isDeleted mustBe true
      }

      "now cannot login with the old email addr" in {
        val result = dao.tryLoginAsMember(PasswordLoginAttempt(
              ip = "1.2.3.4", globals.now().toJavaDate, member1.email, "whatever_password"))
        result.swap.get.theException_forTests mustBe a[DbDao.NoSuchEmailOrUsernameException.type]
      }

      "or the old username" in {
        val result = dao.tryLoginAsMember(PasswordLoginAttempt(
              ip = "1.2.3.4", globals.now().toJavaDate,
              member1.theUsername, "whatever_password"))
        result.swap.get.theException_forTests mustBe a[DbDao.NoSuchEmailOrUsernameException.type]
      }

      "and also cannot login with the new anonNNN username" in {
        val result = dao.tryLoginAsMember(PasswordLoginAttempt(
              ip = "1.2.3.4", globals.now().toJavaDate,
              anonNNN.username, "whatever_password"))
        result.swap.get.theException_forTests mustBe a[DbDao.UserDeletedException.type]
      }

      "or anonNNN email" in {
        val result = dao.tryLoginAsMember(PasswordLoginAttempt(
              ip = "1.2.3.4", globals.now().toJavaDate,
              anonNNN.primaryEmailAddress, "whatever_password"))
        result.swap.get.theException_forTests mustBe a[DbDao.UserDeletedException.type]
      }
    }

  }
}
