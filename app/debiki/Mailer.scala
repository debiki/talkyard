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


object Mailer {

  def startNewActor(dao: Dao): ActorRef = {
    val actorRef = Akka.system.actorOf(Props(
       new Mailer(dao)), name = "EmailActor")
    Akka.system.scheduler.schedule(0 seconds, 20 seconds, actorRef, "SendMail")
    actorRef
  }

}


class Mailer(val dao: Dao) extends Actor {


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
        dao.loadNotfsToMailOut(delayInMinutes = 0, numToLoad = 11)
      logger.debug("Loaded "+ notfsToMail.notfsByTenant.size +
         " notfs, to "+ notfsToMail.usersByTenantAndId.size +" users.")
      _sendEmailNotfs(notfsToMail)

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
  def _sendEmailNotfs(notfsToMail: NotfsToMail) {

    for {
      (tenantId, tenantNotfs) <- notfsToMail.notfsByTenant
      notfsByUserId: Map[String, Seq[NotfOfPageAction]] =
         tenantNotfs.groupBy(_.recipientUserId)
      (userId, userNotfs) <- notfsByUserId
    }{
      logger.debug("Considering "+ userNotfs.size +" notfs to user "+ userId)

      val userOpt = notfsToMail.usersByTenantAndId.get(tenantId -> userId)
      if (userOpt.map(_.emailNotfPrefs) == Some(EmailNotfPrefs.Receive)) {
        // Save the email in the db, before sending it, so even if the server
        // crashes it'll always be found, should the receiver attempt to
        // unsubscribe. (But if you first send it, then save it, the server
        // might crash inbetween and it wouldn't be possible to unsubscribe.)
        val (awsSendReq, emailToSend) = _constructEmail(userOpt.get, userNotfs)
        dao.saveUnsentEmailConnectToNotfs(tenantId, emailToSend, userNotfs)
        logger.debug("Sending email to "+ emailToSend.sentTo)
        val emailSentOrFailed = _sendEmail(awsSendReq, emailToSend)
        logger.trace("Email sent or failed: "+ emailSentOrFailed)
        dao.updateSentEmail(tenantId, emailSentOrFailed)
      }
      else {
        val debug = (userOpt.isEmpty
          ? "Email skipped: User not found."
          | "Email skipped: User declines emails.")
        logger.debug("Skipping email to "+ userOpt +": "+ debug)
        dao.skipEmailForNotfs(tenantId, userNotfs, debug = debug)
      }

      //val emailSendAttempt = _mailSingleUser
      //dao.saveEmailUpdateNotfs(tenantId, emailSendAttempt, userNotfs)
      /*
      mailResult match {
        case Right(email: EmailSent) =>
          // Log something?
        case Left(failure: EmailFailureImmediate) =>
          // Should *sometmies* not try again!!? with these notfs.
          // Something like:
          //   notfsFailed = userNotfs.map(_.copy(... = ???))
          //   dao.markNotfsAsMailed(
          //      tenantId, emailSent = None, notfs = notfsFailed)
          // Should *sometimes* abort processing completely!
      }
      */
    }
  }


  def _constructEmail(user: User, notfs: Seq[NotfOfPageAction])
        : (SendEmailRequest, EmailSent) = {

    val rcptEmailAddr =
      if (user.email == "kajmagnus@debiki.se"
       || user.email == "support@debiki.se"
       || user.email == "non-existing-address@debiki.se"
       || user.email == "kajmagnus79@gmail.com"
       || user.email == "kajmagnus79d@gmail.com") {
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
      // For now, hardcode server addr, and don't bother about the
      // redirect from "/-pageId" to the actual page path.
      val pageUrl = "http://www.debiki.se/-"+ notf.pageId
      val eventUrl = pageUrl +"#"+ notf.eventActionId
      <div>
        On page <a href={pageUrl}>{notf.pageTitle}</a>,<br/>
        <a href={eventUrl}>{notf.eventUserDispName} has replied to you.</a>
      </div>
    }

    val htmlContent = (new Content).withData({
      <div>
        Dear {user.displayName},<br/>
        <br/>
        { notfs.map(notfToHtml _): xml.NodeSeq }
        <br/>
        <br/>
        Kind regards,<br/>
        Debiki<br/>
        <br/>
        <br/>
        <small>
          <a href={"http://www.debiki.se/?unsubscribe&email-id="+
             emailId}>Unsubscribe</a>
        </small>
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
