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

package talkyard.server.emails

import com.debiki.core._
// import play.twirl.api.HtmlFormat.{Appendable => p_TwirlHtml}



object Emails {
  def inLanguage(lang: St): EmailsOneLang = {
    lang match {
      case "pl_PL" => EmailsInPolish
      case _ => EmailsInEnglish
    }
  }
}



trait EmailsOneLang {
  def inviteEmail(inviterName: St, siteHostname: St, probablyUsername: St,
        secretKey: St, globals: debiki.Globals): St

  def inviteAcceptedEmail(siteHostname: St, invitedEmailAddress: St): St

  def welcomeSetPasswordEmail(siteHostname: St, setPasswordUrl: St, username: St,
        globals: debiki.Globals): St
}



object EmailsInEnglish extends EmailsOneLang {

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

}



object EmailsInPolish extends EmailsOneLang {
  // Would want to just import or return the package instead of
  // having to redeclare all fns. Maybe will work in [Scala_3]?
  // If packages work as interfaces for all classes and fns therein?
  // At least should be doable with [Scala_3] macros?

  import talkyard.server.emails.transl.pl_PL.html

  def inviteEmail(inviterName: St, siteHostname: St, probablyUsername: St,
        secretKey: St, globals: debiki.Globals): St =
    html.inviteEmail(
          inviterName = inviterName, siteHostname = siteHostname,
          probablyUsername = probablyUsername, secretKey = secretKey, globals).body

  def inviteAcceptedEmail(siteHostname: St, invitedEmailAddress: St): St =
    html.inviteAcceptedEmail(
          siteHostname = siteHostname, invitedEmailAddress = invitedEmailAddress).body

  def welcomeSetPasswordEmail(siteHostname: St, setPasswordUrl: St, username: St,
        globals: debiki.Globals): St =
    html.welcomeSetPasswordEmail(
          siteHostname = siteHostname, setPasswordUrl = setPasswordUrl,
          username = username, globals).body

}
