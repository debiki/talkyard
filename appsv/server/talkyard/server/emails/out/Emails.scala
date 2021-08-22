/**
 * Copyright (c) 2021 Kaj Magnus Lindberg
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
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

package talkyard.server.emails.out

import com.debiki.core._
import debiki.SiteTpi
// import play.twirl.api.HtmlFormat.{Appendable => p_TwirlHtml}



// RENAME emails.out.Emails to templates.Templates.inLanguage(...)
// or texts.Texts.inLanguge(..)? [not_an_email]
object Emails {
  def inLanguage(lang: St): EmailsOneLangDefaultEnglish = {
    lang match {
      case "de_DE" => EmailsInGerman
      case "pl_PL" => EmailsInPolish
      case _ => EmailsInEnglish
    }
  }
}



trait EmailsOneLangDefaultEnglish {
  import debiki.Globals

  // Would want to avoid repeating all param names, and instead just reference
  // views.html.invite.inviteEmail.apply directly? But couldn't get that
  // working (obscure compilation errors). See "won't compile" below, oh well.
  //
  def inviteEmail(inviterName: St, siteHostname: St, probablyUsername: St,
        secretKey: St, globals: debiki.Globals): St =
    // Won't compile: views.html.invite.inviteEmail.apply _
    // even if returns p_TwirlHtml instead of St.
    views.html.invite.inviteEmail(
          inviterName = inviterName, siteHostname = siteHostname,
          probablyUsername = probablyUsername, secretKey = secretKey, globals).body

  def inviteAcceptedEmail(siteHostname: St, invitedEmailAddress: St): St =
    views.html.invite.inviteAcceptedEmail(
          siteHostname = siteHostname, invitedEmailAddress = invitedEmailAddress).body

  def welcomeSetPasswordEmail(siteHostname: St, setPasswordUrl: St, username: St,
        globals: debiki.Globals): St =
    views.html.invite.welcomeSetPasswordEmail(
          siteHostname = siteHostname, setPasswordUrl = setPasswordUrl,
          username = username, globals).body

  def accountAlreadyExistsEmail(emailAddress: St, siteAddress: St,
        globals: Globals): St =
    views.html.createaccount.accountAlreadyExistsEmail(
          emailAddress = emailAddress,
          siteAddress = siteAddress,
          globals).body

  def accountApprovedEmail(newMember: UserInclDetails, siteHostname: St,
        siteOrigin: St): St =
    views.html.createaccount.accountApprovedEmail(
        newMember,
        siteHostname = siteHostname,
        siteOrigin = siteOrigin).body

  def confirmOneMoreEmailAddressEmail(siteAddress: St, username: St, emailAddress: St,
        isNewAddr: Bo, safeVerificationUrl: St, expirationTimeInHours: i32,
        globals: Globals): St =
    views.html.confirmOneMoreEmailAddressEmail(
          siteAddress = siteAddress,
          username = username,
          emailAddress = emailAddress,
          isNewAddr = isNewAddr,
          safeVerificationUrl = safeVerificationUrl,
          expirationTimeInHours = expirationTimeInHours,
          globals).body

  def createAccountLinkEmail(siteAddress: St, username: St, safeVerificationUrl: St,
        expirationTimeInHours: i32, globals: Globals): St =
    views.html.createaccount.createAccountLinkEmail(
          siteAddress = siteAddress,
          username = username,
          safeVerificationUrl = safeVerificationUrl,
          expirationTimeInHours = expirationTimeInHours,
          globals).body

  def newMemberToApproveEmail(user: UserInclDetails, siteOrigin: St): St  =
    views.html.createaccount.newMemberToApproveEmail(
          user, siteOrigin = siteOrigin).body

  def oneTimeLoginLinkEmail(siteAddress: St, url: St, member: User,
          expiresInMinutes: i32): St =
    views.html.adminlogin.oneTimeLoginLinkEmail(
          siteAddress = siteAddress,
          url = url,
          member = member,
          expiresInMinutes = expiresInMinutes).body

  def resetPasswordEmail(siteAddress: St, secret: St, userName: St,
          expiresInMinutes: i32, globals: Globals): St =
    views.html.resetpassword.resetPasswordEmail(
          siteAddress = siteAddress,
          secret = secret,
          userName = userName,
          expiresInMinutes = expiresInMinutes,
          globals).body

  def verifyYourEmailAddrEmail(name: St, siteAddr: St, emailVerifUrl: St): St =
    views.html.login.verifyYourEmailAddrEmail(
          name = name,
          siteAddr = siteAddr,
          emailVerifUrl = emailVerifUrl).body

  // Not in use
  //def welcomeEmail(site: com.debiki.core.Tenant, userName: St): St

  // Hmm, this is a page, not an email. Rename things, [not_an_email].
  def welcomePage(tpi: SiteTpi, returnToUrl: Opt[St])
          : play.twirl.api.HtmlFormat.Appendable =
    views.html.createaccount.welcomePage(tpi, returnToUrl = returnToUrl)

  // [not_an_email].
  def youHaveBeenUnsubscribed(): St =
    views.html.unsubscribe.youHaveBeenUnsubscribed().body

}



object EmailsInEnglish extends EmailsOneLangDefaultEnglish {
  // Use the defaults, is in English.
}



object EmailsInGerman extends EmailsOneLangDefaultEnglish {
  import debiki.Globals
  import talkyard.server.emails.transl.de_DE.html

  override def inviteEmail(inviterName: St, siteHostname: St, probablyUsername: St,
        secretKey: St, globals: debiki.Globals): St =
    html.inviteEmail(
          inviterName = inviterName, siteHostname = siteHostname,
          probablyUsername = probablyUsername, secretKey = secretKey, globals).body

  override def inviteAcceptedEmail(siteHostname: St, invitedEmailAddress: St): St =
    html.inviteAcceptedEmail(
          siteHostname = siteHostname, invitedEmailAddress = invitedEmailAddress).body

  override def welcomeSetPasswordEmail(siteHostname: St, setPasswordUrl: St, username: St,
        globals: debiki.Globals): St =
    html.welcomeSetPasswordEmail(
          siteHostname = siteHostname, setPasswordUrl = setPasswordUrl,
          username = username, globals).body

  override def accountAlreadyExistsEmail(emailAddress: St, siteAddress: St,
          globals: Globals): St =
    html.accountAlreadyExistsEmail(
          emailAddress = emailAddress,
          siteAddress = siteAddress,
          globals).body

  override def accountApprovedEmail(newMember: UserInclDetails, siteHostname: St,
          siteOrigin: St): St =
    html.accountApprovedEmail(
          newMember,
          siteHostname = siteHostname,
          siteOrigin = siteOrigin).body

  override def confirmOneMoreEmailAddressEmail(siteAddress: St, username: St, emailAddress: St,
          isNewAddr: Bo, safeVerificationUrl: St, expirationTimeInHours: i32,
          globals: Globals): St =
    html.confirmOneMoreEmailAddressEmail(
          siteAddress = siteAddress,
          username = username,
          emailAddress = emailAddress,
          isNewAddr = isNewAddr,
          safeVerificationUrl = safeVerificationUrl,
          expirationTimeInHours = expirationTimeInHours,
          globals).body

  override def createAccountLinkEmail(siteAddress: St, username: St, safeVerificationUrl: St,
          expirationTimeInHours: i32, globals: Globals): St =
    html.createAccountLinkEmail(
          siteAddress = siteAddress,
          username = username,
          safeVerificationUrl = safeVerificationUrl,
          expirationTimeInHours = expirationTimeInHours,
          globals).body

  override def newMemberToApproveEmail(user: UserInclDetails, siteOrigin: St): St =
    html.newMemberToApproveEmail(
          user, siteOrigin = siteOrigin).body

  override def oneTimeLoginLinkEmail(siteAddress: St, url: St, member: User,
          expiresInMinutes: i32): St =
    html.oneTimeLoginLinkEmail(
          siteAddress = siteAddress,
          url = url,
          member = member,
          expiresInMinutes = expiresInMinutes).body

  override def resetPasswordEmail(siteAddress: St, secret: St, userName: St,
          expiresInMinutes: i32, globals: Globals): St =
    html.resetPasswordEmail(
          siteAddress = siteAddress,
          secret = secret,
          userName = userName,
          expiresInMinutes = expiresInMinutes,
          globals = globals).body

  override def verifyYourEmailAddrEmail(name: St, siteAddr: St, emailVerifUrl: St): St =
    html.verifyYourEmailAddrEmail(
          name = name,
          siteAddr = siteAddr,
          emailVerifUrl = emailVerifUrl).body

  /* Oops, not in use  [welc_em_0used]
  override def welcomeEmail(site: com.debiki.core.Tenant, userName: St): Opt[St] = None
  */

  override def welcomePage(tpi: debiki.SiteTpi, returnToUrl: Opt[St])
          : play.twirl.api.HtmlFormat.Appendable =
    html.welcomePage(tpi, returnToUrl = returnToUrl)

  override def youHaveBeenUnsubscribed(): St =
    html.youHaveBeenUnsubscribed().body

}



object EmailsInPolish extends EmailsOneLangDefaultEnglish {
  // Would want to just import or return the package instead of
  // having to redeclare all fns. Maybe will work in [Scala_3]?
  // If packages work as interfaces for all classes and fns therein?
  // At least should be doable with [Scala_3] macros?

  import talkyard.server.emails.transl.pl_PL.html

  override def inviteEmail(inviterName: St, siteHostname: St, probablyUsername: St,
        secretKey: St, globals: debiki.Globals): St =
    html.inviteEmail(
          inviterName = inviterName, siteHostname = siteHostname,
          probablyUsername = probablyUsername, secretKey = secretKey, globals).body

  override def inviteAcceptedEmail(siteHostname: St, invitedEmailAddress: St): St =
    html.inviteAcceptedEmail(
          siteHostname = siteHostname, invitedEmailAddress = invitedEmailAddress).body

  override def welcomeSetPasswordEmail(siteHostname: St, setPasswordUrl: St, username: St,
        globals: debiki.Globals): St =
    html.welcomeSetPasswordEmail(
          siteHostname = siteHostname, setPasswordUrl = setPasswordUrl,
          username = username, globals).body

}
