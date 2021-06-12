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
import scala.collection.mutable.ArrayBuffer
import scala.concurrent.Promise
import talkyard.server.TyLogger


object MailerActor {

  private val logger = TyLogger("Mailer")

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

    // Dupl [305926XFG24]
    def getBoolOr(confValueName: String, default: Boolean): Boolean =
      config.getOptional[Boolean](confValueName) getOrElse default
    def getStringNoneIfBlank[A](confName: String): Option[String] =
      config.getOptional[String](confName).noneIfBlank
    // ----- Read in config

    val anySmtpServerName = getStringNoneIfBlank("talkyard.smtp.host").orElse(
      getStringNoneIfBlank("talkyard.smtp.server")) // old deprecated name

    val anySmtpPort = config.getOptional[Int]("talkyard.smtp.port")
    val anySmtpTlsPort = config.getOptional[Int]("talkyard.smtp.tlsPort") orElse {
      // Depreacted name, because SSL is insecure and in fact disabled. [NOSSL]
      config.getOptional[Int]("talkyard.smtp.sslPort")
    }
    val anySmtpUserName = getStringNoneIfBlank("talkyard.smtp.user")
    val anySmtpPassword = getStringNoneIfBlank("talkyard.smtp.password")
    val anyFromAddress = getStringNoneIfBlank("talkyard.smtp.fromAddress")
    val anyBounceAddress = getStringNoneIfBlank("talkyard.smtp.bounceAddress")
    val debug = getBoolOr("talkyard.smtp.debug", default = false)

    // About STARTTLS and TLS/SSL and ports 25, 587, 465:
    // https://www.fastmail.com/help/technical/ssltlsstarttls.html
    // Current situation:
    // - STARTTLS on port 587 seems to be recommended (with plaintext to TLS upgrade required).
    // - But many clients connect via TLS/SSL directly, on port 465, so all servers support that too.
    // - And outgoing port 25 often blocked, because of hacked servers that send spam.

    // This will use & require STARTTLS = starts in unencrypted plaintext on the smtp port
    // (typically 587, or, in the past, 25) and upgrades to TLS.
    val requireStartTls = getBoolOr("talkyard.smtp.requireStartTls", default = false)

    val enableStartTls = getBoolOr("talkyard.smtp.enableStartTls", default = true)

    // This with instead start with TLS directly on the tls/ssl port (typically 465).
    val connectWithTls = config.getOptional[Boolean]("talkyard.smtp.connectWithTls") orElse {
      // Deprecated name, because SSL is insecure and in fact disabled. [NOSSL]
      config.getOptional[Boolean]("talkyard.smtp.useSslOrTls")
    } getOrElse !requireStartTls

    val checkServerIdentity =
      getBoolOr("talkyard.smtp.checkServerIdentity", enableStartTls || connectWithTls)

    val insecureTrustAllHosts =
      getBoolOr("talkyard.smtp.insecureTrustAllHosts", default = false)

    // ----- Config makes sense?

    var errorMessage = ""
    if (anySmtpServerName.isEmpty) errorMessage += " No talkyard.smtp.host configured."
    if (anyFromAddress.isEmpty) errorMessage += " No talkyard.smtp.fromAddress configured."

    if (anySmtpUserName.isDefined && anySmtpPassword.isEmpty) {
      errorMessage += " A user name, but no talkyard.smtp.password, configured."
    }
    if (anySmtpPassword.isDefined && anySmtpUserName.isEmpty) {
      errorMessage += " A password, but no talkyard.smtp.user, configured."
    }

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
        if (isProd) logger.error(logMessage)
        else logger.info(logMessage)
        actorSystem.actorOf(
          Props(new MailerActor(
            daoFactory, now, serverName = "", port = None,
            tlsPort = None, connectWithTls = false, enableStartTls = false, requireStartTls = false,
            checkServerIdentity = false, insecureTrustAllHosts = false,
            userName = None, password = None,
            fromAddress = anyFromAddress.getOrElse(""), debug = debug,
            bounceAddress = None, broken = true, isProd = isProd)),
          name = s"BrokenMailerActor-$testInstanceCounter")
      }
      else {
        val serverName = anySmtpServerName getOrDie "TyE3KPD78"
        val userName = anySmtpUserName
        val fromAddress = anyFromAddress getOrDie "TyE2QKJ93"
        logger.info(o"""Will use email server: $serverName as user $userName,
            smtp port: $anySmtpPort,
            smtp tls port: $anySmtpTlsPort,
            require STARTTLS: $requireStartTls,
            enable STARTTLS: $enableStartTls,
            connect with TLS: $connectWithTls,
            check server identity: $checkServerIdentity,
            insecureTrustAllHosts: $insecureTrustAllHosts,
            from addr: $fromAddress [TyMEMAILCONF]""")
        if (requireStartTls && connectWithTls) {
          logger.warn(o"""Weird email config: both require-STARTTLS and
          connect-directly-with-TLS have been configured, but I can do only *one*
          of those things. I'll try STARTTLS. but won't connect directly over TLS.
          — In play-framework.conf, please comment out one of:
          talkyard.smtp.requireStartTls and talkyard.smtp.connectWithTls.
          (You can keep talkyard.smtp.enableStartTls though.) [TyEDBLMAILCONF]""")  // [DBLMAILCONF]
        }
        actorSystem.actorOf(
          Props(new MailerActor(
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
            password = anySmtpPassword,
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



case class ForgetEndToEndTestEmails(siteIds: Set[SiteId])
case class GetEndToEndTestEmail(siteIdColonEmailAddress: String)
case class NumEndToEndTestEmailsSent(siteId: SiteId)



/** Sends emails via SMTP. Does not handle any incoming mail. If broken, however,
  * then only logs emails to the console. It'll be broken e.g. if you run on localhost
  * with no SMTP settings configured — it'll still work for E2E tests though.
  *
  * In the past I was using Amazon AWS SES API, but now plain SMTP
  * is used instead. I removed the SES code in commit
  * 0489d88e on 2014-07-11: "Send emails via SMTP, not Amazon AWS' SES API."
  */
class MailerActor(
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
  val userName: Option[String],
  val password: Option[String],
  val fromAddress: String,
  val bounceAddress: Option[String],
  val debug: Boolean,
  val broken: Boolean,
  val isProd: Boolean) extends Actor {

  private val logger = TyLogger("app.mailer")

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

    case NumEndToEndTestEmailsSent(siteId: SiteId) =>
      val addresses = ArrayBuffer[Email]()
      e2eTestEmails.foreach { case (siteIdColonEmailAddr: String, emailsPromise) =>
        if (siteIdColonEmailAddr.startsWith(siteId + ":")) {
          if (emailsPromise.isCompleted) {
            val moreAddrs = emailsPromise.future.value.get.get
            if (moreAddrs.exists(email => !Email.isE2eTestEmailAddress(email.sentTo))) {
              // Someone attempts to read addresses from a non-e2e tests site? Seems suspicious.
              // Just ignore, maybe should log sth though?
              SECURITY; SHOULD_LOG_STH
              sender() ! Nil
              return
            }

            addresses.appendAll(moreAddrs) // see clean_up below
          }
        }
      }
      // Sort by sent-when, ascending.
      sender() ! addresses.sortBy(_.sentOn.map(_.getTime).getOrElse(Long.MaxValue)).map(_.sentTo).toVector

    case GetEndToEndTestEmail(siteIdColonEmailAddress: String) =>
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

    case ForgetEndToEndTestEmails(siteIds: Set[SiteId]) =>
      e2eTestEmails retain { case (siteIdColonEmailAddr: String, emailsPromise) =>
        !siteIds.exists({ siteId =>
          siteIdColonEmailAddr.startsWith(s"$siteId:")
        })
      }

    /*
    case Bounce/Rejection/Complaint/Other =>
     */
  }
  catch {
    case ex: Exception =>
      // Akka would otherwise discard this actor and create another one, but then
      // its state, incl num emails sent counter, gets lost.
      logger.error("Error in Mailer actor [TyE2RDH4F]", ex)
  }


  private def sendEmail(emailMaybeWrongAddr: Email, siteId: SiteId): Unit = {

    val siteDao = daoFactory.newSiteDao(siteId)

    // Reload the user and hens email address in case the address was changed recently.
    // — Unless this is a new email address verification email. Then we want to email
    // that specific address.
    // COULD rename 'sentTo'? Maybe to 'sendTo' instead? since hasn't been sent yet.
    // And set to None, when we re-lookup the participant's email anyway and won't use it? [305RMDG2]
    val sendToAddress =
      if (emailMaybeWrongAddr.tyype == EmailType.VerifyAddress) {
        emailMaybeWrongAddr.sentTo
      }
      else {
        val anyPp = emailMaybeWrongAddr.toUserId.flatMap(siteDao.getParticipant)
        anyPp.map(_.email) getOrElse emailMaybeWrongAddr.sentTo
      }

    val emailToSend = emailMaybeWrongAddr.copy(
      sentTo = sendToAddress, sentOn = Some(now().toJavaDate), providerEmailId = None)

    // I often use @example.com, or simply @ex.com, when posting test comments
    // — don't send those emails, to keep down the bounce rate.
    val isTestAddress =
      emailToSend.sentTo.endsWith("@example.com") ||
      emailToSend.sentTo.endsWith(".example.com") ||
      emailToSend.sentTo.endsWith("@ex.com") ||
      emailToSend.sentTo.endsWith("@x.co")

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

    val fakeSend = broken || (isProd && (isTestAddress || isE2eAddress))

    val fromAddrMaybeEmailId =
          if (fromAddress.contains("+EMAIL_ID@"))
            fromAddress.replaceAllLiterally("+EMAIL_ID@", s"+${emailToSend.id}@")
          else
            fromAddress

    if (isE2eAddress)
      rememberE2eTestEmail(emailToSend, fromAddrMaybeEmailId, siteDao)

    logger.debug(s"s$siteId: ${if (fakeSend) "Fake e" else "E"}mailing ${sendToAddress
          }, from ${fromAddrMaybeEmailId.noneIfEmpty getOrElse "''"
          }, email id '${emailToSend.id}' ${
          if (fakeSend) "[TyMEMLFAKING]" else "[TyMEMLSENDNG]"}:\n    $emailToSend")


    val emailSent = {
      if (fakeSend) {
        emailToSend
      }
      else try {
        val apacheCommonsEmail = makeApacheCommonsEmail(
              emailToSend, fromAddr = fromAddrMaybeEmailId)
        apacheCommonsEmail.send()
        logger.debug(s"s$siteId: Sent email '${emailToSend.id}'. [TyMEMLSENT].")
        emailToSend
      }
      catch {
        case ex: acm.EmailException =>
          val message = stringifyExceptionAndCauses(ex)
          val badEmail = emailToSend.copy(failureText = Some(message))
          logger.warn(s"s$siteId: Error sending email '${emailToSend.id
                }' [TyEEMLERR]: $badEmail")
          badEmail
      }
    }

    siteDao.updateSentEmail(emailSent)
  }


  private def makeApacheCommonsEmail(email: Email, fromAddr: St): acm.HtmlEmail = {
    val apacheCommonsEmail = new acm.HtmlEmail()
    apacheCommonsEmail.setDebug(debug)
    apacheCommonsEmail.setHostName(serverName)
    apacheCommonsEmail.setCharset("utf8")

    // Authentication not always required — SMTP servers are sometimes configured to
    // just trust the email sender's IP address instead.
    if (userName.nonEmpty) {
      apacheCommonsEmail.setAuthentication(userName.get, password.getOrElse(""))
    }

    port foreach apacheCommonsEmail.setSmtpPort
    tlsPort foreach (p => apacheCommonsEmail.setSslSmtpPort(p.toString))

    // 1. Apache Commons Email uses "SSL" in the name, although smtp servers accept
    // TLS and we use TLS only (we've disabled SSL [NOSSL]).
    // 2. If STARTTLS also configured, let it have priority? "Require" sounds important?
    // However, we do log a warning about this ambiguous config:  [DBLMAILCONF].
    apacheCommonsEmail.setSSLOnConnect(!requireStartTls && connectWithTls)

    apacheCommonsEmail.setStartTLSEnabled(requireStartTls || enableStartTls)

    // If the smtp server doesn't support STARTTLS, or STARTTLS fails, the connection fails
    // (the email won't get sent).
    apacheCommonsEmail.setStartTLSRequired(requireStartTls)

    apacheCommonsEmail.setSSLCheckServerIdentity(checkServerIdentity)

    apacheCommonsEmail.addTo(email.sentTo)
    apacheCommonsEmail.setFrom(fromAddr)
    bounceAddress foreach apacheCommonsEmail.setBounceAddress

    apacheCommonsEmail.setSubject(email.subject)
    apacheCommonsEmail.setHtmlMsg(email.bodyHtmlText)

    // This applies all props set above; calling more setNnn(..) below, in most cases will do nothing?
    // (but some setNnn() still works – look at the getMailSession() and buildMimeMessage() source)
    val session = apacheCommonsEmail.getMailSession

    if (userName.isEmpty) {
      session.getProperties.put("mail.smtp.auth", "false")
    }

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


  def rememberE2eTestEmail(email: EmailOut, fromAddr: St, siteDao: SiteDao): U = {
    val siteIdColonEmailAddress = s"${siteDao.siteId}:${email.sentTo}"
    val siteIdColToColFrom = s"$siteIdColonEmailAddress:$fromAddr"
    e2eTestEmails.get(siteIdColonEmailAddress) match {
      case Some(promise) =>
        if (promise.isCompleted) {
          logger.debug(
              s"Appending e2e test email to: ${email.sentTo}, subject: ${email.subject} [DwM2PK3]")
          val oldEmails = promise.future.value.get.toOption getOrDie "EdE4FSBBK2"
          val moreEmails = oldEmails :+ email
          val last15 = moreEmails.takeRight(15)  // [R2AB067]
          e2eTestEmails.put(siteIdColonEmailAddress, Promise.successful(last15))
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
