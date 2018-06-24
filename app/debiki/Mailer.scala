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
import org.apache.commons.{mail => acm}
import com.debiki.core._
import com.debiki.core.Prelude._
import debiki.dao.SiteDao
import debiki.dao.SiteDaoFactory
import play.{api => p}
import scala.collection.mutable
import scala.concurrent.Promise


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
  def startNewActor(actorSystem: ActorSystem, daoFactory: SiteDaoFactory, config: p.Configuration,
        now: () => When, isProd: Boolean): ActorRef = {

    // ----- Read in config

    val anySmtpServerName = config.getString("talkyard.smtp.host").orElse(
      config.getString("talkyard.smtp.server")).noneIfBlank // old deprecated name

    val anySmtpPort = config.getInt("talkyard.smtp.port")
    val anySmtpTlsPort = config.getInt("talkyard.smtp.tlsPort") orElse {
      // Depreacted name, because SSL is insecure and in fact disabled. [NOSSL]
      config.getInt("talkyard.smtp.sslPort")
    }
    val anySmtpUserName = config.getString("talkyard.smtp.user").noneIfBlank
    val anySmtpPassword = config.getString("talkyard.smtp.password").noneIfBlank
    val anyFromAddress = config.getString("talkyard.smtp.fromAddress").noneIfBlank
    val anyBounceAddress = config.getString("talkyard.smtp.bounceAddress").noneIfBlank
    val debug = config.getBoolean("talkyard.smtp.debug") getOrElse false

    // About STARTTLS and TLS/SSL and ports 25, 587, 465:
    // https://www.fastmail.com/help/technical/ssltlsstarttls.html
    // Current situation:
    // - STARTTLS on port 587 seems to be recommended (with plaintext to TLS upgrade required).
    // - But many clients connect via TLS/SSL directly, on port 465, so all servers support that too.
    // - And outgoing port 25 often blocked, because of hacked servers that send spam.

    // This will use & require STARTTLS = starts in unencrypted plaintext on the smtp port
    // (typically 587, or, in the past, 25) and upgrades to TLS.
    val requireStartTls = config.getBoolean("talkyard.smtp.requireStartTls") getOrElse false

    val enableStartTls = config.getBoolean("talkyard.smtp.enableStartTls") getOrElse true

    // This with instead start with TLS directly on the tls/ssl port (typically 465).
    val connectWithTls = config.getBoolean("talkyard.smtp.connectWithTls") orElse {
      // Deprecated name, because SSL is insecure and in fact disabled. [NOSSL]
      config.getBoolean("talkyard.smtp.useSslOrTls")
    } getOrElse !requireStartTls

    val checkServerIdentity =
      config.getBoolean("talkyard.smtp.checkServerIdentity").getOrElse(enableStartTls || connectWithTls)

    val insecureTrustAllHosts =
      config.getBoolean("talkyard.smtp.insecureTrustAllHosts") getOrElse false

    // ----- Config makes sense?

    var errorMessage = ""
    if (anySmtpServerName.isEmpty) errorMessage += " No talkyard.smtp.host configured."
    if (anySmtpUserName.isEmpty) errorMessage += " No talkyard.smtp.user configured."
    if (anySmtpPassword.isEmpty) errorMessage += " No talkyard.smtp.password configured."
    if (anyFromAddress.isEmpty) errorMessage += " No talkyard.smtp.fromAddress configured."

    if (requireStartTls && !enableStartTls)
      errorMessage += " talkyard.smtp.requireStartTls is true but enableStartTls is false."

    if (anySmtpPort.isEmpty) {
      if (requireStartTls) {
        errorMessage += " No talkyard.smtp.port configured, although talkyard.smtp.requireStartTls=true."
      }
      else if (!connectWithTls) {
        errorMessage += " No talkyard.smtp.port configured."
      }
      else if (anySmtpTlsPort.isEmpty) {
        errorMessage += " No talkyard.smtp.port or talkyard.smtp.tlsPort configured."
      }
      else {
        // Fine, use TLS on port 465 typically, but not STARTTLS.
      }
    }

    // ----- Create email actor

    val actorRef =
      if (errorMessage.nonEmpty) {
        val logMessage = s"I won't send emails, because: $errorMessage [TyEEMAILCONF]"
        if (isProd) p.Logger.error(logMessage)
        else p.Logger.info(logMessage)
        actorSystem.actorOf(
          Props(new Mailer(
            daoFactory, now, serverName = "", port = None,
            tlsPort = None, connectWithTls = false, enableStartTls = false, requireStartTls = false,
            checkServerIdentity = false, insecureTrustAllHosts = false,
            userName = "", password = "", fromAddress = "", debug = debug,
            bounceAddress = None, broken = true, isProd = isProd)),
          name = s"BrokenMailerActor-$testInstanceCounter")
      }
      else {
        val serverName = anySmtpServerName getOrDie "TyE3KPD78"
        val userName = anySmtpUserName getOrDie "TyE6KTQ20"
        val fromAddress = anyFromAddress getOrDie "TyE2QKJ93"
        p.Logger.info(o"""Will use email server: $serverName as user $userName,
            smtp port: $anySmtpPort,
            smtp tls port: $anySmtpTlsPort,
            require STARTTLS: $requireStartTls,
            enable STARTTLS: $enableStartTls,
            connect with TLS: $connectWithTls,
            check server identity: $checkServerIdentity,
            insecureTrustAllHosts: $insecureTrustAllHosts,
            from addr: $fromAddress [TyMEMAILCONF]""")
        actorSystem.actorOf(
          Props(new Mailer(
            daoFactory,
            now,
            serverName = anySmtpServerName getOrDie "TyE3KPD78",
            port = anySmtpPort,
            tlsPort = anySmtpTlsPort,
            connectWithTls = connectWithTls,
            enableStartTls = enableStartTls,
            requireStartTls = requireStartTls,
            checkServerIdentity = checkServerIdentity,
            insecureTrustAllHosts = insecureTrustAllHosts,
            userName = userName,
            password = anySmtpPassword getOrDie "TyE8UKTQ2",
            fromAddress = fromAddress,
            debug = debug,
            bounceAddress = anyBounceAddress,
            broken = false,
            isProd = isProd)),
          name = s"MailerActor-$testInstanceCounter")
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
  val now: () => When,
  val serverName: String,
  val port: Option[Int],
  val tlsPort: Option[Int],
  val connectWithTls: Boolean,
  val enableStartTls: Boolean,
  val requireStartTls: Boolean,
  val checkServerIdentity: Boolean,
  val insecureTrustAllHosts: Boolean,
  val userName: String,
  val password: String,
  val fromAddress: String,
  val bounceAddress: Option[String],
  val debug: Boolean,
  val broken: Boolean,
  val isProd: Boolean) extends Actor {

  private val logger = play.api.Logger("app.mailer")

  private val e2eTestEmails = mutable.HashMap[String, Promise[Vector[Email]]]()

  // Rate limit outgoing emails, to prevent Denial-of-Money attacks. SECURITY FIXED
  // For example Amazon SES charges $0.10 per 1000 emails, and someone writing a script
  // that clicks a send-email-verification-email-again every second, from 100 different
  // computers — that'd cost almost $1k per day.
  // A more realistic for-now limit could be 10k emails per day = $1 = $30 per month,
  // and for now, just a quick fix: The server gets upgraded once a month? Every 2nd month?
  // So just set an upper limit at 100k emails ~= $10  (100k = really a lot, right)
  SHOULD // use RateLimiter instead, and rate limit per site (and also across all sites, like now).
         // Will need to add a new RateLimiter fn, for calling internally.
  private var numEmailsSent = 0
  private val MaxEmails = 100 * 1000


  def receive: PartialFunction[Any, Unit] = {
    case x => dontRestartIfException(x)
  }

  /**
   * Accepts an (Email, site-id), and then sends that email on behalf of
   * the site. The caller should already have saved the email to the
   * database (because Mailer doesn't know exactly how to save it, e.g.
   * if any other tables should also be updated).
   */
  private def dontRestartIfException(message: Any): Unit = try message match {
    case (email: Email, siteId: SiteId) =>
      if (numEmailsSent > MaxEmails) {
        logger.error(o"""Has sent more than $MaxEmails emails, not sending more emails. Restart
            server to reset counter. (This protects against money-DoS attacks) [TyETOOMANYEMLS],
            not sending: $email""")
      }
      else {
        if (numEmailsSent > MaxEmails / 2) {
          logger.warn(o"""Soon reaching the max emails money attack limit:
              $numEmailsSent / $MaxEmails [TyMMANYEMLS]""")
        }
        else if (numEmailsSent % 100 == 0) {
          logger.info(s"Has sent $numEmailsSent emails since server started. [TyMNUMEMLS]")
        }
        sendEmail(email, siteId)
        numEmailsSent += 1
      }
    case ("GetEndToEndTestEmail", siteIdColonEmailAddress: String) =>
      e2eTestEmails.get(siteIdColonEmailAddress) match {
        case Some(promise) =>
          sender() ! promise.future
        case None =>
          SECURITY // DoS attack: don't add infinitely many promises in prod mode
          CLEAN_UP // could stop using promises — let the e2e tests poll the server instead? (7KUDQY00) DONE now, on the next line. So dooo clean up.
          val newPromise = Promise[Vector[Email]]()
          newPromise.success(Vector.empty)
          e2eTestEmails.put(siteIdColonEmailAddress, newPromise)
          sender() ! newPromise.future
      }
    /*
    case Bounce/Rejection/Complaint/Other =>
     */
  }
  catch {
    case ex: Exception =>
      // Akka would otherwise discard this actor and create another one, but then
      // its state, incl num emails sent counter, gets lost.
      p.Logger.error("Error in Mailer actor [TyE2RDH4F]", ex)
  }


  private def sendEmail(emailToSend: Email, siteId: SiteId) {

    val siteDao = daoFactory.newSiteDao(siteId)

    // I often use @example.com, or simply @ex.com, when posting test comments
    // — don't send those emails, to keep down the bounce rate.
    val isTestAddress =
      emailToSend.sentTo.endsWith("example.com") ||
      emailToSend.sentTo.endsWith("ex.com") ||
      emailToSend.sentTo.endsWith("x.co")

    val isE2eAddress = Email.isE2eTestEmailAddress(emailToSend.sentTo)

    // Table about when to log email to console but not send it (fake send),
    // and when to send for real (real send), and when to remember it for the e2e tests:
    // (for the two if blocks just below)
    //
    // rs = real send
    // fs = fake send
    // e2e = add to e2e sent emails list
    //
    // test-works  = test mode, connected to test smtp server (that doesn't send emails for real)
    // test-broken = test mode, email config broken, not connected to smtp server
    // dev-works   = like test-works, but dev mode
    // dev-broken  = like test-broken, but dev mode
    // prod-works  = prod mode, connected to real email server that emails to real people
    // prod-broken = prod mode, email not configured (yet)
    //
    //             test-works  test-broken   dev-works  dev-broken   prod-works  prod-broken
    // normal addr rs          fs            rs         fs           rs          fs
    // test addr   rs          fs            rs         fs           fs          fs
    // e2e addr    rs e2e      fs e2e        rs e2e     fs e2e       fs e2e      fs e2e

    if (isE2eAddress)
      rememberE2eTestEmail(emailToSend, siteDao)

    if (broken || (isProd && (isTestAddress || isE2eAddress))) {
      fakeSend(emailToSend, siteDao)
      return
    }

    logger.debug(s"s$siteId: Sending email [TyMEMLSENDNG]: $emailToSend")

    // Reload the user and his/her email address in case it's been changed recently.
    val address = emailToSend.toUserId.flatMap(siteDao.getUser).map(_.email) getOrElse
      emailToSend.sentTo

    val emailWithAddress = emailToSend.copy(
      sentTo = address, sentOn = Some(now().toJavaDate), providerEmailId = None)
    val apacheCommonsEmail  = makeApacheCommonsEmail(emailWithAddress)
    val emailAfter =
      try {
        apacheCommonsEmail.send()
        // Nowadays not using Amazon's SES api, so no provider email id is available.
        logger.trace(s"s$siteId: Email sent [TyMEMLSENT]: "+ emailWithAddress)
        emailWithAddress
      }
      catch {
        case ex: acm.EmailException =>
          var message = stringifyExceptionAndCauses(ex)
          val badEmail = emailWithAddress.copy(failureText = Some(message))
          logger.warn(s"s$siteId: Error sending email [TyEEMLERR]: $badEmail")
          badEmail
      }

    siteDao.updateSentEmail(emailAfter)
  }


  private def makeApacheCommonsEmail(email: Email): acm.HtmlEmail = {
    val apacheCommonsEmail = new acm.HtmlEmail()
    apacheCommonsEmail.setDebug(debug)
    apacheCommonsEmail.setHostName(serverName)
    apacheCommonsEmail.setCharset("utf8")

    apacheCommonsEmail.setAuthenticator(new acm.DefaultAuthenticator(userName, password))

    port foreach apacheCommonsEmail.setSmtpPort
    tlsPort foreach (p => apacheCommonsEmail.setSslSmtpPort(p.toString))

    // 1. Apache Commons Email uses "SSL" in the name, although smtp servers accept
    // TLS and we use TLS only (we've disabled SSL [NOSSL]).
    // 2. If STARTTLS also configured, let it have priority? "Require" sounds important?
    apacheCommonsEmail.setSSLOnConnect(!requireStartTls && connectWithTls)

    apacheCommonsEmail.setStartTLSEnabled(requireStartTls || enableStartTls)

    // If the smtp server doesn't support STARTTLS, or STARTTLS fails, the connection fails
    // (the email won't get sent).
    apacheCommonsEmail.setStartTLSRequired(requireStartTls)

    apacheCommonsEmail.setSSLCheckServerIdentity(checkServerIdentity)

    apacheCommonsEmail.addTo(email.sentTo)
    apacheCommonsEmail.setFrom(fromAddress)
    bounceAddress foreach apacheCommonsEmail.setBounceAddress

    apacheCommonsEmail.setSubject(email.subject)
    apacheCommonsEmail.setHtmlMsg(email.bodyHtmlText)

    // This applies all props set above; calling more setNnn(..) below, in most cases will do nothing?
    // (but some setNnn() still works – look at the getMailSession() and buildMimeMessage() source)
    val session = apacheCommonsEmail.getMailSession

    // From https://stackoverflow.com/a/47720397/694469:
    // and https://github.com/square/okhttp/blob/6c3a1607b06cf129c017aa28e6aa3baee1a66745/okhttp/src/main/java/okhttp3/TlsVersion.java#L26:
    SECURITY; DO_AFTER // year 2020: Enable TLSv1.3? TLSv1.3 is still a draft, now 2018. [PROTOCONF]
    // Space separated list of protocols, says
    //   https://javaee.github.io/javamail/docs/api/com/sun/mail/smtp/package-summary.html
    session.getProperties.put("mail.smtp.ssl.protocols", "TLSv1.1 TLSv1.2")

    // This accepts self signed smtp server certs?? Could be useful during testing and development.
    // (Without: The TLS cert needs to be valid or added to the Java cert store, like here: [26UKWD2])
    if (insecureTrustAllHosts) {
      session.getProperties.put("mail.smtp.ssl.trust", "*")
    }

    apacheCommonsEmail
  }


  /** Updates the database so it looks as if the email has been sent, plus makes the
    * email accessible to end-to-end tests.
    */
  def fakeSend(email: Email, siteDao: SiteDao) {
    play.api.Logger.debug(i"""
      |Fake-sending email, logging to console only: [TyM123FAKEMAIL]
      |————————————————————————————————————————————————————————————
      |$email
      |————————————————————————————————————————————————————————————
      |""")
    val emailSent = email.copy(sentOn = Some(now().toJavaDate))
    siteDao.updateSentEmail(emailSent)
  }


  def rememberE2eTestEmail(email: Email, siteDao: SiteDao) {
    val siteIdColonEmailAddress = s"${siteDao.siteId}:${email.sentTo}"
    e2eTestEmails.get(siteIdColonEmailAddress) match {
      case Some(promise) =>
        if (promise.isCompleted) {
          p.Logger.debug(
              s"Appending e2e test email to: ${email.sentTo}, subject: ${email.subject} [DwM2PK3]")
          val oldEmails = promise.future.value.get.toOption getOrDie "EdE4FSBBK2"
          val moreEmails = oldEmails :+ email
          val lastTen = moreEmails.takeRight(10)
          e2eTestEmails.put(siteIdColonEmailAddress, Promise.successful(lastTen))
        }
        else {
          promise.success(Vector(email))
        }
      case None =>
        SECURITY // DoS attack: don't remember infinitely many addresses in prod mode
        // Solution:  (7KUDQY00) ?
        e2eTestEmails.put(siteIdColonEmailAddress, Promise.successful(Vector(email)))
    }
  }

}
