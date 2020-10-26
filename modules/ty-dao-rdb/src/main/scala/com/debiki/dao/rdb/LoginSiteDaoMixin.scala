/**
 * Copyright (c) 2013 Kaj Magnus Lindberg
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

package com.debiki.dao.rdb

import com.debiki.core._
import com.debiki.core.DbDao._
import com.debiki.core.Prelude._
import com.debiki.core.Participant.MaxCustomGuestId
import java.{sql => js, util => ju}
import Rdb._
import RdbUtil._
import org.scalactic.{Bad, Good}



object LoginSiteDaoMixin {

}



trait LoginSiteDaoMixin extends SiteTransaction {
  self: RdbSiteTransaction with UserSiteDaoMixin =>


  override def tryLoginAsMember(loginAttempt: MemberLoginAttempt, requireVerifiedEmail: Boolean)
        : Hopefully[MemberLoginGrant] = {
    CLEAN_UP; REFACTOR // Later: Have the fns below return a Hopefully, instead of throwing.
    // And remove the try-catch here.
    val loginGrant: MemberLoginGrant = try { loginAttempt match {
      case x: PasswordLoginAttempt => loginWithPassword(x, requireVerifiedEmail)
      case x: EmailLoginAttempt => loginWithEmailId(x)
      case x: OpenAuthLoginAttempt => loginOpenAuth(x)  // SHOULD check requireVerifiedEmail
    }}
    catch {
      case ex: Exception =>
        return Bad(Problem(ex, siteId))  // ([6036KEJ5] either excepiton, or Good below.)
    }
    Good(loginGrant)
  }


  override def loginAsGuest(loginAttempt: GuestLoginAttempt): GuestLoginResult = {
      var userId = 0
      var extImpId: Option[ExtId] = None
      var emailNotfsStr = ""
      var createdAt: Option[When] = None
      var isNewGuest = false
      for (i <- 1 to 2 if userId == 0) {
        runQuery("""
          select u.user_id, u.ext_id, u.created_at, gp.email_notfs from users3 u
            left join guest_prefs3 gp
                   on u.site_id = gp.site_id
                  and u.guest_email_addr = gp.email
                  and gp.version = 'C'
          where u.site_id = ?
            and u.full_name = ?
            and u.guest_email_addr = ?
            -- Users imported from e.g. Disqus have no browser id, and one shouldn't
            -- be able to login as them. [494AYDNR]
            and u.guest_browser_id is not null
            and u.guest_browser_id = ?
          """,
          List(siteId.asAnyRef, e2d(loginAttempt.name), e2d(loginAttempt.email), loginAttempt.guestBrowserId),
          rs => {
            if (rs.next) {
              userId = rs.getInt("USER_ID")
              extImpId = getOptString(rs, "ext_id")
              createdAt = Some(getWhen(rs, "created_at"))
              emailNotfsStr = rs.getString("EMAIL_NOTFS")
            }
          })

        if (userId == 0) {
          // We need to create a new guest user.
          // There is a unique constraint on SITE_ID, NAME, EMAIL, LOCATION, URL,
          // so this insert might fail (if another thread does
          // the insert, just before). Should it fail, the above `select'
          // is run again and finds the row inserted by the other thread.
          // Could avoid logging any error though!
          isNewGuest = true
          runUpdate(i"""
            insert into users3(
              site_id, user_id, created_at, full_name, guest_email_addr, guest_browser_id)
            select
              ?, least(min(user_id) - 1, $MaxCustomGuestId), ?, ?, ?, ?
            from
              users3 where site_id = ?
            """,
            List(siteId.asAnyRef, now.asTimestamp,
              loginAttempt.name.trim, e2d(loginAttempt.email),
              loginAttempt.guestBrowserId, siteId.asAnyRef))
          // (Could fix: `returning ID into ?`, saves 1 roundtrip.)
          // Loop one more lap to read ID.
        }
      }
      dieIf(userId == 0, "DwE3kRhk20")

      val user = Guest(
        id = userId,
        extId = extImpId,
        createdAt = createdAt.getOrElse(now),
        guestName = loginAttempt.name,
        guestBrowserId = Some(loginAttempt.guestBrowserId),
        email = loginAttempt.email,
        emailNotfPrefs = _toEmailNotfs(emailNotfsStr),
        country = None)

      GuestLoginResult(user, isNewGuest)
  }


  private def loginWithPassword(loginAttempt: PasswordLoginAttempt, requireVerifiedEmail: Boolean)
        : MemberLoginGrant = {
    val anyUser = loadUserByPrimaryEmailOrUsername(loginAttempt.emailOrUsername)
    val user = anyUser getOrElse {
      throw NoSuchEmailOrUsernameException
    }
    if (user.isDeleted) {
      throw DbDao.UserDeletedException
    }
    // Don't let anyone login by specifying an email address that hasn't been verified — we
    // wouldn't know if two different people typed the same email address, maybe to hack
    // the other person's account, or a typo. [2PSK5W0R]
    if (user.emailVerifiedAt.isEmpty && (requireVerifiedEmail || loginAttempt.isByEmail)) {
      throw DbDao.EmailNotVerifiedException
    }
    val correctHash = user.passwordHash getOrElse {
      throw MemberHasNoPasswordException
    }
    val okPassword = checkPassword(loginAttempt.password, hash = correctHash)
    if (!okPassword)
      throw BadPasswordException

    MemberLoginGrant(identity = None, user, isNewIdentity = false, isNewMember = false)
  }


  private def loginWithEmailId(loginAttempt: EmailLoginAttempt): MemberLoginGrant = {
    val emailId = loginAttempt.emailId
    val email: Email = loadEmailById(emailId = emailId) getOrElse {
      throw EmailNotFoundException(emailId)
    }

    REFACTOR // don't do this via LoginAttempt:s. Load the email directly from UserDao instead [306AS13].
    // Move the logic below, to there. And remove this function.

    REFACTOR //  return:  Hopefully[MemberLoginGrant]  instead; don't throw anything

    if (email.toUserId.isEmpty)
      throw BadEmailTypeException(emailId)

    if (!email.tyype.canLogin)
      throw new QuickMessageException(s"Cannot login via email type ${email.tyype} [TyE0LGIEML]")

    if (email.canLoginAgain is false)
      throw new QuickMessageException("This reset password link has already been used [TyEPWRSTUSD_]")

    email.sentOn match {
      case None =>
        throw new QuickMessageException("Email hasn't been sent [TyEPWRST0SNT]")
      case Some(emailSentDate) =>
        val expMins = 30 // [exp_emails_time]
        if (emailSentDate.getTime + expMins * MillisPerMinute < loginAttempt.date.getTime)
          throw new QuickMessageException(
                s"Reset password link expired (after $expMins minutes) [TyEPWRSTEXP_]")
    }

    val user = loadUser(email.toUserId.get) getOrElse {
      die("TyEZ2XKW5", o"""s$siteId: User `${email.toUserId}"' not found
           when logging in with email id `$emailId'.""")
    }

    if (user.email != email.sentTo)
      throw EmailAddressChangedException(email, user)


    if (!loginAttempt.mayLoginAgain)
      updateSentEmail(email.copy(canLoginAgain = Some(false)))

    val idtyWithId = IdentityEmailId(id = emailId, userId = user.id, emailSent = Some(email))
    MemberLoginGrant(Some(idtyWithId), user, isNewIdentity = false, isNewMember = false)
  }


  private def loginOpenAuth(loginAttempt: OpenAuthLoginAttempt): MemberLoginGrant = {
    loginOpenAuthImpl(loginAttempt)
  }


  private def loginOpenAuthImpl(loginAttempt: OpenAuthLoginAttempt): MemberLoginGrant = {

    val identityInDb = loadOpenAuthIdentity(loginAttempt.profileProviderAndKey) getOrElse {
      throw IdentityNotFoundException
    }

    val user: User = loadUser(identityInDb.userId) getOrElse {
      // There's a foreign key, so this cannot happen.
      die(o"""s$siteId: User ${identityInDb.userId} missing for OpenAuth
          identity ${identityInDb.id}""", "TyE4WKBQR")
    }

    val identity =
      if (loginAttempt.openAuthDetails == identityInDb.openAuthDetails) identityInDb
      else {
        val updatedIdentity = OpenAuthIdentity(
          identityInDb.id, userId = user.id, loginAttempt.openAuthDetails)
        updateOpenAuthIdentity(updatedIdentity)
        updatedIdentity
      }

    MemberLoginGrant(Some(identity), user, isNewIdentity = false, isNewMember = false)
  }

}
