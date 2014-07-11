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

package debiki

import akka.actor._
import akka.actor.Actor._
import org.apache.commons.{mail => acm}
import com.debiki.core._
import debiki.dao.SiteDao
import debiki.dao.SiteDaoFactory
import java.{util => ju}
import play.{api => p}
import play.api.Play.current
import Prelude._



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
    val anySmtpServerName = config.getString("debiki.smtp.server")
    val anySmtpPort = config.getInt("debiki.smtp.port")
    val anySmtpUserName = config.getString("debiki.smtp.user")
    val anySmtpPassword = config.getString("debiki.smtp.password")
    val anyUseSslOrTls = config.getBoolean("debiki.smtp.useSslOrTls")
    val anyFromAddress = config.getString("debiki.smtp.fromAddress")

    val anyAccessKeyId = p.Play.configuration.getString("aws.accessKeyId")
    val anySecretKey = p.Play.configuration.getString("aws.secretKey")

    val actorRef =
        (anySmtpServerName, anySmtpPort, anySmtpUserName, anySmtpPassword, anyFromAddress) match {
      case (Some(serverName), Some(port), Some(userName), Some(password), Some(fromAddress)) =>
        val useSslOrTls = anyUseSslOrTls getOrElse {
          p.Logger.info(o"""Email config value debiki.smtp.useSslOrTls not configured,
            defaulting to true.""")
          true
        }
        actorSystem.actorOf(
          Props(new Mailer(
            daoFactory,
            serverName = serverName,
            port = port,
            useSslOrTls = useSslOrTls,
            userName = userName,
            password = password,
            fromAddress = fromAddress)),
          name = s"MailerActor-$testInstanceCounter")
      case _ =>
        var message = "I won't send emails, because:"
        if (anySmtpServerName.isEmpty) message += " No debiki.smtp.server configured."
        if (anySmtpPort.isEmpty) message += " No debiki.smtp.port configured."
        if (anySmtpUserName.isEmpty) message += " No debiki.smtp.user configured."
        if (anySmtpPassword.isEmpty) message += " No debiki.smtp.password configured."
        if (anyFromAddress.isEmpty) message += " No debiki.smtp.fromAddress configured."
        p.Logger.info(message)
        actorSystem.actorOf(
          Props(new ConsoleMailer(daoFactory)),
          name = s"ConsoleMailerActor-$testInstanceCounter")
    }

    testInstanceCounter += 1
    actorRef
  }

  // Not thread safe; only needed in integration tests.
  private var testInstanceCounter = 1


  object EndToEndTest {

    /** The most recent email sent to an @example.com address,
      * made available her for end to end tests.
      */
    @volatile
    var mostRecentEmailSent: Option[Email] = None

    /** Returns the most recent email sent, and then forgets it, so it won't
      * mess up subsequent E2E tests that shouldn't try to reuse it.
      */
    def getAndForgetMostRecentEmail(): Option[Email] = {
      val email = mostRecentEmailSent
      mostRecentEmailSent = None
      email
    }
  }

}



/** Sends emails via SMTP. Does not handle any incoming mail.
  */
class Mailer(
  val daoFactory: SiteDaoFactory,
  val serverName: String,
  val port: Int,
  val useSslOrTls: Boolean,
  val userName: String,
  val password: String,
  val fromAddress: String) extends Actor {


  val logger = play.api.Logger("app.mailer")


  /**
   * Accepts an (Email, tenant-id), and then sends that email on behalf of
   * the tenant. The caller should already have saved the email to the
   * database (because Mailer doesn't know exactly how to save it, e.g.
   * if any other tables should also be updated).
   */
  def receive = {
    case (email: Email, tenantId: String) =>
      sendEmail(email, tenantId)
    /*
    case Bounce/Rejection/Complaint/Other =>
     */
  }


  private def sendEmail(emailToSend: Email, tenantId: String) {

    val tenantDao = daoFactory.newSiteDao(QuotaConsumers(tenantId = tenantId))
    val now = Some(new ju.Date)

    // I often use @example.com, or simply @ex.com, when posting test comments
    // — don't send those emails, to keep down the bounce rate.
    if (emailToSend.sentTo.endsWith("example.com") ||
        emailToSend.sentTo.endsWith("ex.com")) {
      ConsoleMailer.fakeSendAndWriteToConsole(emailToSend, tenantDao)
      return
    }

    logger.debug(s"Sending email: $emailToSend")

    val apacheCommonsEmail  = makeApacheCommonsEmail(emailToSend)
    val emailSentOrFailed =
      try {
        apacheCommonsEmail.send()
        // Nowadays not using Amazon's SES api, so no provider email id is available.
        val email = emailToSend.copy(sentOn = now, providerEmailId = None)
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
    apacheCommonsEmail.setAuthenticator(new acm.DefaultAuthenticator(userName, password))
    apacheCommonsEmail.setSSLOnConnect(useSslOrTls)

    apacheCommonsEmail.addTo(email.sentTo)
    apacheCommonsEmail.setFrom(fromAddress)

    apacheCommonsEmail.setSubject(email.subject)
    apacheCommonsEmail.setHtmlMsg(email.bodyHtmlText)
    apacheCommonsEmail
  }

}



/** Writes emails to the console, does not actually send them anywhere.
  * Used if no email settings have been configured.
  */
class ConsoleMailer(val daoFactory: SiteDaoFactory) extends Actor {

  def receive = {
    case (email: Email, siteId: String) =>
      val siteDao = daoFactory.newSiteDao(QuotaConsumers(tenantId = siteId))
      ConsoleMailer.fakeSendAndWriteToConsole(email, siteDao)
  }

}



object ConsoleMailer {

  /** Pretends the email has been sent and makes it available for end-to-end tests.
    */
  def fakeSendAndWriteToConsole(email: Email, siteDao: SiteDao) {
    play.api.Logger.debug(i"""
      |Fake-sending email (only logging it to the console):
      |  $email
      |""")
    val emailSent = email.copy(sentOn = Some(new ju.Date))
    siteDao.updateSentEmail(emailSent)
    Mailer.EndToEndTest.mostRecentEmailSent = Some(emailSent)
  }

}
