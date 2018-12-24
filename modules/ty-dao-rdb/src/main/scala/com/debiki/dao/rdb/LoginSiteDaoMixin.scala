/**
 * Copyright (C) 2013 Kaj Magnus Lindberg (born 1979)
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



object LoginSiteDaoMixin {

}



trait LoginSiteDaoMixin extends SiteTransaction {
  self: RdbSiteTransaction with UserSiteDaoMixin =>


  override def tryLoginAsMember(loginAttempt: MemberLoginAttempt, requireVerifiedEmail: Boolean)
        : MemberLoginGrant = {
    val loginGrant = loginAttempt match {
      case x: PasswordLoginAttempt => loginWithPassword(x, requireVerifiedEmail)
      case x: EmailLoginAttempt => loginWithEmailId(x)
      case x: OpenIdLoginAttempt => loginOpenId(x)      // SHOULD check requireVerifiedEmail
      case x: OpenAuthLoginAttempt => loginOpenAuth(x)  // SHOULD check requireVerifiedEmail
    }
    loginGrant
  }


  override def loginAsGuest(loginAttempt: GuestLoginAttempt): GuestLoginResult = {
      var userId = 0
      var emailNotfsStr = ""
      var isNewGuest = false
      for (i <- 1 to 2 if userId == 0) {
        runQuery("""
          select u.USER_ID, g.EMAIL_NOTFS from users3 u
            left join guest_prefs3 g
                   on u.site_id = g.site_id
                  and u.guest_email_addr = g.EMAIL
                  and g.VERSION = 'C'
          where u.SITE_ID = ?
            and u.full_name = ?
            and u.guest_email_addr = ?
            and u.guest_browser_id = ?
          """,
          List(siteId.asAnyRef, e2d(loginAttempt.name), e2d(loginAttempt.email), loginAttempt.guestBrowserId),
          rs => {
            if (rs.next) {
              userId = rs.getInt("USER_ID")
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
              ?, least(min(user_id) - 1, $MaxCustomGuestId), now_utc(), ?, ?, ?
            from
              users3 where site_id = ?
            """,
            List(siteId.asAnyRef, loginAttempt.name.trim, e2d(loginAttempt.email),
              loginAttempt.guestBrowserId, siteId.asAnyRef))
          // (Could fix: `returning ID into ?`, saves 1 roundtrip.)
          // Loop one more lap to read ID.
        }
      }
      dieIf(userId == 0, "DwE3kRhk20")

      val user = Guest(
        id = userId,
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

    if (email.toUserId.isEmpty)
      throw BadEmailTypeException(emailId)

    val user = loadUser(email.toUserId.get) getOrElse {
      die("TyEZ2XKW5", o"""s$siteId: User `${email.toUserId}"' not found
           when logging in with email id `$emailId'.""")
    }

    if (user.email != email.sentTo)
      throw EmailAddressChangedException(email, user)

    val idtyWithId = IdentityEmailId(id = emailId, userId = user.id, emailSent = Some(email))
    MemberLoginGrant(Some(idtyWithId), user, isNewIdentity = false, isNewMember = false)
  }


  private def loginOpenId(loginAttempt: OpenIdLoginAttempt): MemberLoginGrant = {
    die("EsE6UYKJ2", "Unimpl") /*
    transactionCheckQuota { implicit connection =>

    // Load any matching Identity and the related User.
      val (identityInDb: Option[Identity], userInDb: Option[User]) =
        _loadIdtyDetailsAndUser(forOpenIdDetails = loginAttempt.openIdDetails)

      // Create user if absent.
      val user = userInDb match {
        case Some(u) => u
        case None =>
          ??? /* Don't create a new user from here
          val details = loginAttempt.openIdDetails
          val userNoId =  User(
            id = "?",
            displayName = details.firstName,
            email = details.email getOrElse "",
            emailNotfPrefs = EmailNotfPrefs.Unspecified,
            country = details.country,
            website = "",
            isAdmin = false,
            isOwner = false)

          val userWithId = _insertUser(siteId, userNoId)
          userWithId
          */
      }

      // Create or update the OpenID identity.
      //
      // (It's absent, if this is the first time the user logs in.
      // It needs to be updated, if the user has changed e.g. her
      // OpenID name or email.)
      //
      // (Concerning simultaneous inserts/updates by different threads or
      // server nodes: This insert might result in a unique key violation
      // error. Simply let the error propagate and the login fail.
      // This login was supposedly initiated by a human, and there is
      // no point in allowing exactly simultaneous logins by one
      // single human.)

      val identity = identityInDb match {
        case None =>
          ??? /* Don't create a new identity from here
          val identityNoId = IdentityOpenId(id = "?", userId = user.id, loginAttempt.openIdDetails)
          insertOpenIdIdentity(siteId, identityNoId)(connection)
          */
        case Some(old: IdentityOpenId) =>
          val nev = IdentityOpenId(id = old.id, userId = user.id, loginAttempt.openIdDetails)
          if (nev != old) {
            dieIf(nev.openIdDetails.oidClaimedId != old.openIdDetails.oidClaimedId, "DwE73YQ2")
            _updateIdentity(nev)
          }
          nev
        case x => throwBadDatabaseData("DwE26DFW0", s"A non-OpenID identity found in database: $x")
      }

      LoginGrant(Some(identity), user, isNewIdentity = identityInDb.isEmpty,
        isNewRole = userInDb.isEmpty)
    }
    */
  }


  private def loginOpenAuth(loginAttempt: OpenAuthLoginAttempt): MemberLoginGrant = {
    transactionCheckQuota { connection =>
      loginOpenAuthImpl(loginAttempt)(connection)
    }
  }


  private def loginOpenAuthImpl(loginAttempt: OpenAuthLoginAttempt)
        (connection: js.Connection): MemberLoginGrant = {

    val identityInDb = loadOpenAuthIdentity(loginAttempt.profileProviderAndKey) getOrElse {
      throw IdentityNotFoundException
    }

    val user: User = loadUser(identityInDb.userId) getOrElse {
      // There's a foreign key, so this cannot happen.
      die(o"""s$siteId: User ${identityInDb.userId} missing for OpenAuth
          identity ${identityInDb.id}""", "TyE4WKBQR")
    }

    // (For some unimportant comments, see the corresponding comment in loginOpenId() above.)

    val identity =
      if (loginAttempt.openAuthDetails == identityInDb.openAuthDetails) identityInDb
      else {
        val updatedIdentity = OpenAuthIdentity(
          identityInDb.id, userId = user.id, loginAttempt.openAuthDetails)
        updateOpenAuthIdentity(updatedIdentity)(connection)
        updatedIdentity
      }

    MemberLoginGrant(Some(identity), user, isNewIdentity = false, isNewMember = false)
  }

}
