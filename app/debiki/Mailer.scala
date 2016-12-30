/**
 * Copyright (C) 2012, 2014 Kaj Magnus Lindberg (born 1979)
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

package debiki

import akka.actor._
import akka.actor.Actor._
import org.apache.commons.{mail => acm}
import com.debiki.core._
import com.debiki.core.Prelude._
import debiki.dao.SiteDao
import debiki.dao.SiteDaoFactory
import java.{util => ju}
import play.{api => p}
import play.api.Play.current
import scala.collection.mutable
import scala.concurrent.{Future, Promise}


object Mailer {


  /** Starts a single email sending actor.
    *
    * If no email settings have been configured, uses an actor that doesn't send any
    * emails but instead logs them to the console.
    *
    * BUG: SHOULD terminate it before shutdown, in a manner that
    * doesn't accidentally forget forever to send some emails.
    * (Also se Notifier.scala)
    */
  def startNewActor(actorSystem: ActorSystem, daoFactory: SiteDaoFactory): ActorRef = {
    val config = p.Play.configuration
    val anySmtpServerName = config.getString("ed.smtp.host").orElse(
      config.getString("ed.smtp.server")).noneIfBlank // old deprecated name
    val anySmtpPort = config.getInt("ed.smtp.port")
    val anySmtpSslPort = config.getInt("ed.smtp.sslPort")
    val anySmtpUserName = config.getString("ed.smtp.user").noneIfBlank
    val anySmtpPassword = config.getString("ed.smtp.password").noneIfBlank
    val anyUseSslOrTls = config.getBoolean("ed.smtp.useSslOrTls")
    val anyFromAddress = config.getString("ed.smtp.fromAddress").noneIfBlank

    val actorRef =
        (anySmtpServerName, anySmtpPort, anySmtpSslPort, anySmtpUserName, anySmtpPassword, anyFromAddress) match {
      case (Some(serverName), Some(port), Some(sslPort), Some(userName), Some(password), Some(fromAddress)) =>
        val useSslOrTls = anyUseSslOrTls getOrElse {
          p.Logger.info(o"""Email config value ed.smtp.useSslOrTls not configured,
            defaulting to true.""")
          true
        }
        actorSystem.actorOf(
          Props(new Mailer(
            daoFactory,
            serverName = serverName,
            port = port,
            sslPort = sslPort,
            useSslOrTls = useSslOrTls,
            userName = userName,
            password = password,
            fromAddress = fromAddress,
            broken = false)),
          name = s"MailerActor-$testInstanceCounter")
      case _ =>
        var message = "I won't send emails, because:"
        if (anySmtpServerName.isEmpty) message += " No ed.smtp.host configured."
        if (anySmtpPort.isEmpty) message += " No ed.smtp.port configured."
        if (anySmtpSslPort.isEmpty) message += " No ed.smtp.sslPort configured."
        if (anySmtpUserName.isEmpty) message += " No ed.smtp.user configured."
        if (anySmtpPassword.isEmpty) message += " No ed.smtp.password configured."
        if (anyFromAddress.isEmpty) message += " No ed.smtp.fromAddress configured."
        p.Logger.info(message)
        actorSystem.actorOf(
          Props(new Mailer(
            daoFactory, serverName = "", port = -1, sslPort = -1, useSslOrTls = false,
            userName = "", password = "", fromAddress = "", broken = true)),
          name = s"BrokenMailerActor-$testInstanceCounter")
    }

    testInstanceCounter += 1
    actorRef
  }

  // Not thread safe; only needed in integration tests.
  private var testInstanceCounter = 1

}



/** Sends emails via SMTP. Does not handle any incoming mail. If broken, however,
  * then only logs emails to the console. It'll be broken e.g. if you run on localhost
  * with no SMTP settings configured — it'll still work for E2E tests though.
  *
  * In the past I was using Amazon AWS SES API, but now plain SMTP
  * is used instead. I removed the SES code in commit
  * 0489d88e on 2014-07-11: "Send emails via SMTP, not Amazon AWS' SES API."
  */
class Mailer(
  val daoFactory: SiteDaoFactory,
  val serverName: String,
  val port: Int,
  val sslPort: Int,
  val useSslOrTls: Boolean,
  val userName: String,
  val password: String,
  val fromAddress: String,
  val broken: Boolean) extends Actor {


  val logger = play.api.Logger("app.mailer")

  private val e2eTestEmails = mutable.HashMap[String, Promise[Email]]()

  /**
   * Accepts an (Email, tenant-id), and then sends that email on behalf of
   * the tenant. The caller should already have saved the email to the
   * database (because Mailer doesn't know exactly how to save it, e.g.
   * if any other tables should also be updated).
   */
  def receive = {
    case (email: Email, tenantId: String) =>
      sendEmail(email, tenantId)
    case ("GetEndToEndTestEmail", siteIdColonEmailAddress: String) =>
      e2eTestEmails.get(siteIdColonEmailAddress) match {
        case Some(promise) =>
          sender() ! promise.future
        case None =>
          SECURITY // DoS attack: don't add infinitely many promises in prod mode
          val newPromise = Promise[Email]()
          e2eTestEmails.put(siteIdColonEmailAddress, newPromise)
          sender() ! newPromise.future
      }
    /*
    case Bounce/Rejection/Complaint/Other =>
     */
  }


  private def sendEmail(emailToSend: Email, tenantId: String) {

    val tenantDao = daoFactory.newSiteDao(tenantId)
    val now = Some(new ju.Date)

    // I often use @example.com, or simply @ex.com, when posting test comments
    // — don't send those emails, to keep down the bounce rate.
    if (broken || emailToSend.sentTo.endsWith("example.com") ||
        emailToSend.sentTo.endsWith("ex.com") ||
        emailToSend.sentTo.endsWith("x.co")) {
      fakeSendAndRememberForE2eTests(emailToSend, tenantDao)
      return
    }

    logger.debug(s"Sending email: $emailToSend")

    // Reload the user and his/her email address in case it's been changed recently.
    val address = emailToSend.toUserId.flatMap(tenantDao.getUser).map(_.email) getOrElse
      emailToSend.sentTo

    val email = emailToSend.copy(sentTo = address, sentOn = now, providerEmailId = None)
    val apacheCommonsEmail  = makeApacheCommonsEmail(email)
    val emailSentOrFailed =
      try {
        apacheCommonsEmail.send()
        // Nowadays not using Amazon's SES api, so no provider email id is available.
        logger.trace("Email sent: "+ email)
        email
      }
      catch {
        case ex: acm.EmailException =>
          var message = ex.getMessage
          if (ex.getCause ne null) {
            message += "\nCaused by: " + ex.getCause.getMessage
          }
          val email = emailToSend.copy(sentOn = now, failureText = Some(message))
          logger.warn("Error sending email: "+ email)
          email
      }

    tenantDao.updateSentEmail(emailSentOrFailed)
  }


  private def makeApacheCommonsEmail(email: Email): acm.HtmlEmail = {
    val apacheCommonsEmail = new acm.HtmlEmail()
    apacheCommonsEmail.setHostName(serverName)
    apacheCommonsEmail.setSmtpPort(port)
    apacheCommonsEmail.setSslSmtpPort(sslPort.toString)
    apacheCommonsEmail.setAuthenticator(new acm.DefaultAuthenticator(userName, password))
    apacheCommonsEmail.setSSLOnConnect(useSslOrTls)

    apacheCommonsEmail.addTo(email.sentTo)
    apacheCommonsEmail.setFrom(fromAddress)

    apacheCommonsEmail.setSubject(email.subject)
    apacheCommonsEmail.setHtmlMsg(email.bodyHtmlText)
    apacheCommonsEmail
  }


  /** Updates the database so it looks as if the email has been sent, plus makes the
    * email accessible to end-to-end tests.
    */
  def fakeSendAndRememberForE2eTests(email: Email, siteDao: SiteDao) {
    play.api.Logger.debug(i"""
      |Fake-sending email (only logging it to the console): [EsM6LK4J2]
      |————————————————————————————————————————————————————————————
      |$email
      |————————————————————————————————————————————————————————————
      |""")
    val emailSent = email.copy(sentOn = Some(new ju.Date))
    siteDao.updateSentEmail(emailSent)
    if (Email.isE2eTestEmailAddress(email.sentTo)) {
      rememberE2eTestEmail(email, siteDao)
    }
  }


  def rememberE2eTestEmail(email: Email, siteDao: SiteDao) {
    val siteIdColonEmailAddress = s"${siteDao.siteId}:${email.sentTo}"
    e2eTestEmails.get(siteIdColonEmailAddress) match {
      case Some(promise: Promise[Email]) =>
        if (promise.isCompleted) {
          p.Logger.debug("Promise already completed, why? [DwM2PK3] Any email: " +
            promise.future.value.get.toOption)
        }
        else {
          promise.success(email)
        }
      case None =>
        SECURITY // DoS attack: don't remember infinitely many addresses in prod mode
        e2eTestEmails.put(siteIdColonEmailAddress, Promise.successful(email))
    }
  }

}
