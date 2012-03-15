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
import play.api._
import play.api.libs.iteratee._
import play.api.libs.concurrent._
import play.api.Play.current
import Prelude._


object Mailer {

  def startNewActor(dao: Dao): ActorRef = {
    val actorRef = Akka.system.actorOf(Props(
       new Mailer(dao)), name = "EmailActor")
    //Akka.system.scheduler.schedule(0 seconds, 1 minutes, actorRef, "SendMail")
    actorRef
  }

}


class Mailer(val dao: Dao) extends Actor {


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
      val notfEmailsSent = _sendEmailNotfs(notfsToMail)
      dao.markNotfsAsMailed(notfEmailsSent)

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
  def _sendEmailNotfs(notfsToMail: NotfsToMail)
        : Map[String, Seq[(NotfOfPageAction, EmailSent)]] = {
    var emailsSent = Map[String, Seq[(NotfOfPageAction, EmailSent)]]()

    for {
      (tenantId, tenantNotfs) <- notfsToMail.notfsByTenant
      notfsByUserId: Map[String, Seq[NotfOfPageAction]] =
         tenantNotfs.groupBy(_.recipientUserId)
      (userId, userNotfs) <- notfsByUserId
      userOpt = notfsToMail.usersByTenantAndId.get(tenantId -> userId)
      user <- userOpt
      if user.emailNotfPrefs == EmailNotfPrefs.Receive
    }{
      _sendEmailNotf(user, userNotfs)
      // TODO add to emailsSent
    }

    emailsSent   // TODO also mark as old those that should *not* be sent.
  }

  class IfTrue[A](b: => Boolean, t: => A) { def |(f: => A) = if (b) t else f }
  class MakeIfTrue(b: => Boolean) { def ?[A](t: => A) = new IfTrue[A](b,t) }
  implicit def autoMakeIfTrue(b: => Boolean) = new MakeIfTrue(b)


  def _sendEmailNotf(user: User, notfs: Seq[NotfOfPageAction])
        : Either[Throwable, EmailSent] = {

    // ----- Construct email

    val toAddresses = new java.util.ArrayList[String]
    toAddresses.add("kajmagnus@debiki.se")  // user.email
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
          <a href='http://www.debiki.se/?unsubscribe'>Unsubscribe</a>
        </small>
      </div>.toString
    })

    val textContent = (new Content)
       .withData("Hello - I hope you're having a good day.")

    val body = (new Body).withHtml(htmlContent).withText(textContent)
    val mess = (new Message).withSubject(subjContent).withBody(body)

    val request = (new SendEmailRequest)
       .withSource("support@debiki.se")
       .withDestination(dest)
       .withMessage(mess)


    // ----- Sen email Call Amazon SES to send the message.

    // Amazon SES automatically intercepts all bounces and complaints,
    // and then forwards them to you.
    //   http://aws.amazon.com/ses/faqs/#38

    // When using sendEmail(), Amazon SES sends feedback to the email
    // address in the ReturnPath parameter. If not specified, then
    // feedback is sent to the email address in the Source parameter.
    //  http://aws.amazon.com/ses/faqs/#39

    try {
      // This blocks until the AWS request has been completed.
      val result: SendEmailResult = _awsClient.sendEmail(request)
      val messageId: String = result.getMessageId
      println("Got message id: "+ messageId)
    } catch  {
      //case ex: ThrottlingException =>
      // We're sending too much email, or sending at too fast a rate.
      //case ex: MessageRejectedException
      //case ex: AmazonClientException =>
      //case ex: AmazonServiceException
      case ex: Exception =>
        Logger.warn(classNameOf(ex) +": "+ ex.toString +"\n"+ ex)
        Logger.debug("Uninteresting stack trace: "+ ex.printStackTrace);
    }

    unimplemented
  }

}
