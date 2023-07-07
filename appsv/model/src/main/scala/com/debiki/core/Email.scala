/**
 * Copyright (C) 2012 Kaj Magnus Lindberg (born 1979)
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
import Prelude._


sealed abstract class SecretStatus(val IntVal: i32, val isOrWillBeValid: Bo = false) {
  def toInt: i32 = IntVal
}

object SecretStatus {
  case object NotYetValid extends SecretStatus(1, isOrWillBeValid = true)
  case object Valid extends SecretStatus(2, isOrWillBeValid = true)
  case object DeletedCanUndo extends SecretStatus(3)
  case object DeletedNoUndo extends SecretStatus(4)
  case object Consumed extends SecretStatus(5)
  case object Expired extends SecretStatus(6)

  def fromInt(value: i32): Opt[SecretStatus] = Some(value match {
    case NotYetValid.IntVal => NotYetValid
    case Valid.IntVal => Valid
    case Consumed.IntVal => Consumed
    case DeletedCanUndo.IntVal => DeletedCanUndo
    case DeletedNoUndo.IntVal => DeletedNoUndo
    case Expired.IntVal => Expired
    case _ => return None
  })
}


/** For grouping emails about the same thing, in the same email thread.
  */
sealed abstract class EmailAbout

object EmailAbout {
  /* Later:
   case class Pat(patId: PatId)
   case class Cat(catId: CatId)
   case class Tag(tagId: TagId)
   */

  /** An email about a page (orig post) or comment.
    *
    * @param pageId — the page id, as of when the email was sent (comments
    *   might get moved to other pages later).
    * @param postId — stays the same also if post moved to another page.
    * @param postNr — the post nr, as of when the email was sent (might change,
    *   if moved to another page)
    * @param parentNr — as of when the email was sent. None, for Orig Posts.
    * @param catId — as of when the email was sent.
    */
  case class Post(
    pageId: PageId,
    postId: PostId,
    postNr: PostNr,
    parentNr: Opt[PostNr],
    catId: Opt[CatId]) extends EmailAbout
}


object Email {   RENAME // to EmailOut?


  def newWithId(
    emailId: String,
    tyype: EmailType,
    createdAt: When,
    sendTo: String,
    sendFrom: Opt[St] = None,
    toUserId: Option[UserId],
    subject: String,
    bodyHtmlText: String,
    aboutWhat: Opt[EmailAbout] = None,
    smtpMsgId: Opt[SmtpMsgId] = None,
    inReplyToSmtpMsgId: Opt[SmtpMsgId] = None,
    referencesSmtpMsgIds: ImmSeq[SmtpMsgId] = Nil,
    secretValue: Opt[St] = None,
    ): Email = {

    Email(
          id = emailId,
          tyype = tyype,
          sentTo = sendTo,
          sentFrom = sendFrom,
          toUserId = toUserId,
          sentOn = None,
          createdAt = createdAt.toJavaDate,
          subject = subject,
          bodyHtmlText = bodyHtmlText,
          aboutWhat = aboutWhat,
          smtpMsgId = smtpMsgId,
          inReplyToSmtpMsgId = inReplyToSmtpMsgId,
          referencesSmtpMsgIds = referencesSmtpMsgIds,
          providerEmailId = None,
          failureText = None,
          secretValue = secretValue,
          secretStatus = secretValue.map(_ => SecretStatus.Valid))
  }


  def createGenId(
        tyype: EmailType,
        createdAt: When,
        sendTo: String,
        sendFrom: Opt[St] = None,
        toUserId: Option[UserId],
        subject: String,
        bodyHtml: St,
        aboutWhat: Opt[EmailAbout] = None,
        smtpMsgId: Opt[SmtpMsgId] = None,
        inReplyToSmtpMsgId: Opt[SmtpMsgId] = None,
        referencesSmtpMsgIds: ImmSeq[SmtpMsgId] = Nil,
        ): Email = {
    val emailId = generateRandomId()
    newWithId(
          emailId,
          tyype,
          createdAt,
          sendTo = sendTo,
          sendFrom = sendFrom,
          toUserId = toUserId,
          subject = subject,
          bodyHtmlText = bodyHtml,
          aboutWhat = aboutWhat,
          smtpMsgId = smtpMsgId,
          inReplyToSmtpMsgId = inReplyToSmtpMsgId,
          referencesSmtpMsgIds = referencesSmtpMsgIds)
  }


  def createGenIdAndSecret(
        tyype: EmailType,
        createdAt: When,
        sendTo: St,
        toUserId: Opt[UserId],
        subject: St,
        bodyHtmlWithSecret: St => St,
        aboutWhat: Opt[EmailAbout] = None,
        ): Email = {
    val emailId = generateRandomId()
    val secretValue = generateSecret()
    newWithId(
          emailId,
          tyype,
          createdAt,
          sendTo = sendTo,
          toUserId = toUserId,
          subject = subject,
          bodyHtmlText = bodyHtmlWithSecret(secretValue),
          aboutWhat = aboutWhat,
          secretValue = Some(secretValue),
          // These not needed outside discussions, at least not now:
          smtpMsgId = None,
          inReplyToSmtpMsgId = None,
          referencesSmtpMsgIds = Nil)
  }


  def isE2eTestEmailAddress(address: St): Bo =
    address.startsWith("e2e-test-") ||
        address.startsWith("e2e.test.") ||
        address.startsWith("e2e_test_") ||
        address.startsWith("debiki.tester") ||
        // Facebook test account addresses:
        address.startsWith("facebook_") && address.endsWith("@tfbnw.net")


  /** Used in the From SMTP header, and in unsubscription urls.
    */
  def generateRandomId(): String = nextRandomString() take 16

  /** Used in reset password emails, email verification urls, link accounts urls..
    */
  def generateSecret(): St = nextRandomString() take 20
}



case class Email(
  id: String,
  tyype: EmailType,
  sentTo: EmailAdr,  // sometimes not used [305RMDG2]
  toUserId: Option[UserId],
  sentFrom: Opt[St],
  sentOn: Option[ju.Date],
  createdAt: ju.Date,
  aboutWhat: Opt[EmailAbout],
  subject: String,
  bodyHtmlText: String,
  smtpMsgId: Opt[SmtpMsgId],
  inReplyToSmtpMsgId: Opt[SmtpMsgId],
  referencesSmtpMsgIds: ImmSeq[SmtpMsgId],
  providerEmailId: Option[String],
  failureText: Option[String] = None,
  secretValue: Opt[St] = None,
  secretStatus: Opt[SecretStatus] = None,
  // Migrate: false,true —> secretStatus = Consumed, and email id —> secret value.
  canLoginAgain: Option[Boolean] = None,
  numRepliesBack: Opt[i32] = None) {

  dieIf(sentTo.isEmpty, "EdENOEMLADR")
  dieIf(!sentTo.contains("@"), "EdEBADEMLADR")
  if (tyype == EmailType.VerifyAddress || tyype == EmailType.ResetPassword ||
      tyype == EmailType.InvitePassword || tyype == EmailType.InviteAccepted) {
    dieIf(toUserId.isEmpty, "DwE44BPK6", s"Email '$id' lacks toUserId")
  }

  dieIf(sentFrom.exists(_.isEmpty), "TyE306MSEG34")
  // (sentFrom.isEmpty and sentOn.isDefined is ok, for backw compat.)

  dieIf(secretValue.exists(v => v.length < 20 || 50 < v.length), "TyE5MIRF26")
  dieIf(secretValue.exists(!_.isAlNum), "TyE7S45MIRF9")

  dieIf(secretValue.isDefined && secretStatus.isEmpty, "TyE7L3MSEGJ3")
  // (However, a secret status without a value, is fine, for backw compat
  // with old emails where the email *id* was the secret  (fine, lots of entropy).)
}



// Email isn't a secure storage medium, for example, maybe someone's laptop
// and email inbox gets hacked, and the attacker finds old emails —
// then it's better that the links have expired.
//
sealed abstract class EmailType(
  val IntVal: i32,
  val canLogin: Bo = false,
  val secretsExpireHours: i32 = 24 * 2,
  val canReuseSecret: Bo = false,
) {
  def toInt: i32 = IntVal
}


object EmailType {
  case object Notification extends EmailType(1)
  case object ActivitySummary extends EmailType(2)
  case object Invite extends EmailType(11)
  case object InviteAccepted extends EmailType(12)
  case object InvitePassword extends EmailType(13, canLogin = true)

  case object VerifyAddress extends EmailType(21,
    // An e2e tests assumes > 25 h.  [e2e_eml_exp_hs]
    secretsExpireHours = 24 * 2,
    // People sometimes click email verification links many times, for example,
    // click-open in new tab, accidentally close that tab, click the link
    // again.  This won't auto log them in though. [reuse_verif_ln]
    canReuseSecret = true)

  case object ResetPassword extends EmailType(22, secretsExpireHours = 1, canLogin = true)
  case object OneTimeLoginLink extends EmailType(23) // doesn't use loginWithEmailId
  case object LinkAccounts extends EmailType(24, secretsExpireHours = 1)
  case object SiteCreatedSuperAdminNotf extends EmailType(41)
  case object HelpExchangeReminder extends EmailType(31)  // [plugin]? Change to 101? but db constraints

  case object NewMemberToApprove extends EmailType(51)
  case object YourAccountApproved extends EmailType(52)
  case object NewMemberJoined extends EmailType(55)

  //case object MaybePromote extends EmailType(63)
  //case object MemberPromoted extends EmailType(65)

  case object YouCannotReply extends EmailType(91)

  case object FormFilledIn extends EmailType(411)

  // 501-999 could be available for plugins? — There's also an EmailOutSubType [1, 999]
  // for each plugin to use.

  def fromInt(value: Int): Option[EmailType] = Some(value match {
    case Notification.IntVal      => Notification
    case ActivitySummary.IntVal   => ActivitySummary
    case Invite.IntVal            => Invite
    case InviteAccepted.IntVal    => InviteAccepted
    case InvitePassword.IntVal    => InvitePassword
    case VerifyAddress.IntVal     => VerifyAddress
    case ResetPassword.IntVal     => ResetPassword
    case OneTimeLoginLink.IntVal  => OneTimeLoginLink
    case LinkAccounts.IntVal      => LinkAccounts
    case SiteCreatedSuperAdminNotf.IntVal => SiteCreatedSuperAdminNotf
    case HelpExchangeReminder.IntVal => HelpExchangeReminder
    case NewMemberToApprove.IntVal => NewMemberToApprove
    case YourAccountApproved.IntVal => YourAccountApproved
    case NewMemberJoined.IntVal => NewMemberJoined
    case YouCannotReply.IntVal => YouCannotReply
    case FormFilledIn.IntVal => FormFilledIn
    case _ =>
      return None
  })
}


