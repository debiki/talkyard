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


class LoginAppSpec extends DaoAppSuite(
      // So emails sent, and Member2's address gets used.
      disableScripts = false) {
  var dao: SiteDao = _

  var owner: User = _
  var ownerWho: Who = _

  var createForumResult: CreateForumResult = _
  var categoryId: CatId = _

  val Member1Username = "lg_mb1"
  val Member2Username = "lg_mb2"
  val Member1Password: String = "public-" + Member1Username
  val Member2Password: String = "public-" + Member2Username

  lazy val moderator: User = createPasswordModerator("lg_mod", dao)
  lazy val member1: User = createPasswordUser(Member1Username, dao, password = Some(Member1Password))
  lazy val member2: User = createPasswordUser(Member2Username, dao, password = Some(Member2Password))
  lazy val wrongMember: User = createPasswordUser("lg_wr_mb", dao)


  "Members can login with password" - {
    val now = new ju.Date()

    "prepare" in {
      globals.systemDao.getOrCreateFirstSite()
      dao = globals.siteDao(Site.FirstSiteId)
      owner = createPasswordOwner("lg_adm", dao)
      ownerWho = Who(owner.id, browserIdData)
      createForumResult = dao.createForum("Forum", "/lgi-tst/", byWho = ownerWho).get
      categoryId = createForumResult.defaultCategoryId
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

      // TEST BROKEN   oops
      "or anonNNN email" in {
        //val result = dao.tryLoginAsMember(PasswordLoginAttempt(
        //      ip = "1.2.3.4", globals.now().toJavaDate,
        //      anonNNN.primaryEmailAddress, "whatever_password"))
        //result.swap.get.theException_forTests mustBe a[DbDao.UserDeletedException.type]

        // Instead: Verify new email is  ""  — wasn't used, so no anon email generated.
        anonNNN.primaryEmailAddress mustBe ""
      }
    }

    TESTS_MISSING // Finish this test: Send a notf, so adr gets used, then verify
    // changed to  anonNNN @ example.com, and donesn't work for logging in.
    /*
    "Prepare Member2, so email addr gets used" - {
      "Member2's email gets verified" in {
        dao.verifyPrimaryEmailAddress(member2.id, globals.now().toJavaDate)
      }

      "Member2 gets an email notification, when the forum admin @mentions han" in {
        createPage(PageType.Discussion,
              textAndHtmlMaker.testTitle("MentionMember2"),
              textAndHtmlMaker.testBody(
                    "Hello @" + member2.theUsername, mentions = Set(member2.theUsername)),
              owner.id, browserIdData, dao, Some(categoryId))
      }
      "notified" in {
        // countTotalNumNotfs() mustBe 1  // hmm
        // listUsersNotifiedAbout(post2.id) mustBe Set(   the page above
        //     member5NotInAnyChat.id, member6NotInAnyChat.id, member7NotInAnyChat.id)
      }
    }

    "Member2 can login via email" - {
      "via email" in {
        val loginGrant = dao.tryLoginAsMember(PasswordLoginAttempt(
            ip = "1.2.3.4", globals.now().toJavaDate, member2.email, Member2Password)).get
        loginGrant.user.id mustBe member2.id
      }
      "and via username" in {
        val loginGrant = dao.tryLoginAsMember(PasswordLoginAttempt(
          ip = "1.2.3.4", globals.now().toJavaDate, member2.theUsername, Member2Password)).get
        loginGrant.user.id mustBe member2.id
      }
    }

    //  Annoying, no email sent!
    "Delete Member2, can't login via anonNNN email" - {
      var user: Pat = null
      var anon2: UserInclDetails = null

      "delete user" in {  // EdT5WKBWQ2
        playTimeSeconds(30)
        anon2 = dao.deleteUser(member2.id, Who.System)
      }

      "mem cache now says user *is* deleted" in {
        user = dao.getTheParticipant(member2.id)
        user.isDeleted mustBe true
      }

      "the email addr was set to  anonNNNN" in {
        user.email.startsWith("anon") mustBe true
        user.email.matches("^anon\\d+$") mustBe true
      }

      "now cannot login with the old email addr" in {
        val result = dao.tryLoginAsMember(PasswordLoginAttempt(
              ip = "1.2.3.4", globals.now().toJavaDate, member2.email, "whatever_password"))
        result.swap.get.theException_forTests mustBe a[DbDao.NoSuchEmailOrUsernameException.type]
      }

      "or the old username" in {
        val result = dao.tryLoginAsMember(PasswordLoginAttempt(
          ip = "1.2.3.4", globals.now().toJavaDate,
          member2.theUsername, "whatever_password"))
        result.swap.get.theException_forTests mustBe a[DbDao.NoSuchEmailOrUsernameException.type]
      }

      "and also cannot login with the new anon2 username" in {
        val result = dao.tryLoginAsMember(PasswordLoginAttempt(
          ip = "1.2.3.4", globals.now().toJavaDate,
          anon2.username, "whatever_password"))
        result.swap.get.theException_forTests mustBe a[DbDao.UserDeletedException.type]
      }

      "or anon2 email" in {
        val result = dao.tryLoginAsMember(PasswordLoginAttempt(
              ip = "1.2.3.4", globals.now().toJavaDate,
              anon2.primaryEmailAddress, "whatever_password"))
        result.swap.get.theException_forTests mustBe a[DbDao.UserDeletedException.type]
      }
    } */

  }
}
