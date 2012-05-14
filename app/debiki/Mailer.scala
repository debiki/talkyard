/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package debiki

import akka.actor._
import akka.actor.Actor._
import akka.util.duration._
import com.amazonaws.AmazonClientException
import com.amazonaws.auth.BasicAWSCredentials
import com.amazonaws.services.simpleemail._
import com.amazonaws.services.simpleemail.model._
import com.debiki.v0._
import java.{util => ju}
import play.api._
import play.api.libs.iteratee._
import play.api.libs.concurrent._
import play.api.Play.current
import Prelude._


/**
 * Starts a single email sending actor.
 *
 * BUG: SHOULD terminate it before shutdown, in a manner that
 * doesn't accidentally forget forever to send some emails.
 */
object Mailer {

  def startNewActor(daoFactory: DaoFactory): ActorRef = {
    val actorRef = Akka.system.actorOf(Props(
       new Mailer(daoFactory)), name = "EmailActor")
    Akka.system.scheduler.schedule(0 seconds, 20 seconds, actorRef, "SendMail")
    actorRef
  }

}


/**
 * Loads notifications with emails pending from the database,
 * constructs and sends those emails.
 *
 * Updates the notfs so no one else also attempts to construct and send
 * the same emails. Saves the sent emails in the database, together with
 * Amazon Web Service's (AWS) Simple Email Service (SES) message id.
 * The message id identifies the email in bounce/rejection/complaint emails
 * from e.g. the recipient's email system.
 *
 * As of right now, only sends emails. Does not handle incoming mail (there is
 * no incoming mail, instead such mail ends up in a certain Google Domains
 * account instead, namely support at debiki dot se (as of today 2012-03-30).
 *
 * Thread safe.
 */
class Mailer(val daoFactory: DaoFactory) extends Actor {


  val logger = play.api.Logger("app.mailer")


  private val _awsClient = {
    val accessKeyId = "AKIAJ4OCRAEOPEWEYTNQ"
    val secretKey = "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"
    new AmazonSimpleEmailServiceClient(
       new BasicAWSCredentials(accessKeyId, secretKey))
  }


  def receive = {
    case "SendMail" =>
      val notfsToMail =
        daoFactory.systemDao.loadNotfsToMailOut(
           delayInMinutes = 0, numToLoad = 11)
      logger.trace("Loaded "+ notfsToMail.notfsByTenant.size +
         " notfs, to "+ notfsToMail.usersByTenantAndId.size +" users.")
      _trySendEmailNotfs(notfsToMail)

    /*
    case Bounce/Rejection/Complaint/Other =>
     */
  }


  /**
   * Sends email notifications, for all tenants and notifications specified.
   *
   * Perhaps good reading:
   * http://colinmackay.co.uk/blog/2011/11/18/handling-bounces-on-amazon-ses/
   */
  def _trySendEmailNotfs(notfsToMail: NotfsToMail) {

    for {
      (tenantId, tenantNotfs) <- notfsToMail.notfsByTenant
      notfsByUserId: Map[String, Seq[NotfOfPageAction]] =
         tenantNotfs.groupBy(_.recipientUserId)
      (userId, userNotfs) <- notfsByUserId
    }{
      logger.debug("Considering "+ userNotfs.size +" notfs to user "+ userId)

      val tenantDao = daoFactory.buildTenantDao(
         QuotaConsumers(tenantId = tenantId))
      val tenant = tenantDao.loadTenant()
      val userOpt = notfsToMail.usersByTenantAndId.get(tenantId -> userId)

      // Send email, or remember why we didn't.
      val problemOpt = (tenant.chost, userOpt.map(_.emailNotfPrefs)) match {
        case (Some(chost), Some(EmailNotfPrefs.Receive)) =>
          _constructAndSendEmail(tenantDao, chost, userOpt.get, userNotfs)
          None
        case (None, _) =>
          val problem = "No chost for tenant id: "+ tenantId
          logger.warn("Skipping email to user id "+ userId +": "+ problem)
          Some(problem)
        case (_, None) =>
          val problem = "User not found"
          logger.warn("Skipping email to user id "+ userId +": "+ problem)
          Some(problem)
        case (_, Some(_)) =>
          Some("User declines emails")
      }

      // If we decided not to send the email, remember not to try again.
      problemOpt foreach { problem =>
        tenantDao.skipEmailForNotfs(userNotfs,
           debug = "Email skipped: "+ problem)
      }
    }
  }


  def _constructAndSendEmail(tenantDao: TenantDao, chost: TenantHost,
        user: User, userNotfs: Seq[NotfOfPageAction]) {
    // Save the email in the db, before sending it, so even if the server
    // crashes it'll always be found, should the receiver attempt to
    // unsubscribe. (But if you first send it, then save it, the server
    // might crash inbetween and it wouldn't be possible to unsubscribe.)
    val origin =
      (chost.https.required ? "https://" | "http://") + chost.address
    val (awsSendReq, emailToSend) = _constructEmail(origin, user, userNotfs)
    tenantDao.saveUnsentEmailConnectToNotfs(emailToSend, userNotfs)
    logger.debug("Sending email to "+ emailToSend.sentTo)
    val emailSentOrFailed = _sendEmail(awsSendReq, emailToSend)
    logger.trace("Email sent or failed: "+ emailSentOrFailed)
    tenantDao.updateSentEmail(emailSentOrFailed)
  }


  def _constructEmail(origin: String, user: User,
        notfs: Seq[NotfOfPageAction]): (SendEmailRequest, EmailSent) = {

    val rcptEmailAddr =
      if (user.email == "kajmagnus@debiki.se"
       || user.email == "support@debiki.se"
       || user.email == "non-existing-address@debiki.se"
       || user.email == "kajmagnus79@gmail.com"
       || user.email == "kajmagnus79d@gmail.com"
       || user.email == "kaj.lindberg@telia.com") {
      // These addresses are AWS SES verified addresses.
      user.email
    } else {
      // Direct all email to this verified address, for now.
      "kajmagnus@debiki.se"
    }

    // The email id should be a random value, so it cannot be guessed,
    // because it's a key in unsubscribe URLs.
    val emailId = nextRandomString() take 8

    val toAddresses = new ju.ArrayList[String]
    toAddresses.add(rcptEmailAddr)
    val dest = (new Destination).withToAddresses(toAddresses)

    val notfCount = notfs.size

    val subjContent = (new Content).withData(
       (notfCount > 0)
        ? "You have a reply, to one of your comments"
        | "You have replies, to comments of yours" )

    def notfToHtml(notf: NotfOfPageAction): xml.Node = {
      // For now, don't bother about the
      // redirect from "/-pageId" to the actual page path.
      val pageUrl = origin +"/-"+ notf.pageId
      // Currently eventActionId is always a post (because
      // Notification.calcFrom currently only generates notfs for replies).
      if (notf.eventType != NotfOfPageAction.Type.PersonalReply) {
        logger.warn("Unsupported notification type: "+ notf.eventType)
      }
      val eventUrl = pageUrl +"#post-"+ notf.eventActionId
      // Include only one link per notification, or people will (I guess)
      // not click the link to the actual reply (that link also highlights
      // the reply :-)). I'd guess they instead would click the
      // visually *largest* link, e.g. to the page, and then not find the new
      // reply, and feel annoyed.
      <div>
        You have a reply, <a href={eventUrl}>here</a>,<br/>
        on page {notf.pageTitle},<br/>
        written by {notf.eventUserDispName}.
      </div>
    }

    val htmlContent = (new Content).withData({
      <div>
        <p>Dear {user.displayName},</p>
        { notfs.map(notfToHtml _): xml.NodeSeq }
        <p>
          Kind regards,<br/>
          Debiki
        </p>
        <p style='font-size: 80%; opacity: 0.65; margin-top: 2em;'>
          <a href={origin +"/?unsubscribe&email-id="+ emailId}>Unsubscribe</a>
        </p>
      </div>.toString
    })

    val body = (new Body).withHtml(htmlContent)
    val mess = (new Message).withSubject(subjContent).withBody(body)

    val awsSendReq = (new SendEmailRequest)
       .withSource("support@debiki.se")
       .withDestination(dest)
       .withMessage(mess)

    val emailToSend = EmailSent(  // shouldn't be named Email*Sent* though
      id = emailId,
      sentTo = rcptEmailAddr,
      sentOn = None,
      subject = subjContent.getData,
      bodyHtmlText = htmlContent.getData,
      providerEmailId = None)

    (awsSendReq, emailToSend)
  }

  /**
   * Calls Amazon SES to send the message.
   */
  def _sendEmail(awsSendReq: SendEmailRequest, emailToSend: EmailSent)
        : EmailSent = {

    // Amazon SES automatically intercepts all bounces and complaints,
    // and then forwards them to you.
    //   http://aws.amazon.com/ses/faqs/#38

    // When using sendEmail(), Amazon SES sends feedback to the email
    // address in the ReturnPath parameter. If not specified, then
    // feedback is sent to the email address in the Source parameter.
    //  http://aws.amazon.com/ses/faqs/#39

    val timestamp = new ju.Date

    try {
      // The AWS request blocks until completed.
      val result: SendEmailResult = _awsClient.sendEmail(awsSendReq)
      val messageId: String = result.getMessageId
      logger.debug("Email sent, AWS SES message id: "+ messageId)
      emailToSend.copy(sentOn = Some(timestamp),
         providerEmailId = Some(messageId))
    }
    catch  {
      //case ex: ThrottlingException =>
      // We're sending too much email, or sending at too fast a rate.
      //case ex: MessageRejectedException
      //case ex: AmazonClientException =>
      //case ex: AmazonServiceException
      // Unexpected errors:
      case ex: Exception =>
        logger.warn("AWS SES sendEmail() failure: "+
           classNameOf(ex) +": "+ ex.toString)
        logger.trace("Uninteresting stack trace: "+ ex.printStackTrace);
        emailToSend.copy(
           sentOn = Some(timestamp),
           // Could shorten the subject and body, the exact text doesn't
           // matter?? only the text length could possibly be related
           // to the failure?? (Well unless AWS censors "ugly" or spam
           // like words?)
           //subject = "("+ subjContent.getData.length +" chars)",
           //bodyHtmlText = "("+ htmlContent.getData.length +" chars)",
           providerEmailId = None,
           failureText = Some(ex.toString))  // for now
    }
  }

}
