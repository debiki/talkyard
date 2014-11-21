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
import com.debiki.core._
import com.debiki.core.Prelude._
import debiki.dao.{SystemDao, SiteDao, SiteDaoFactory}
import java.{util => ju}
import play.api.libs.concurrent._
import scala.concurrent.duration._
import scala.concurrent.ExecutionContext.Implicits.global



object Notifier {

  /**
   * Starts a single notifier actor.
   *
   * BUG: SHOULD terminate it before shutdown, in a manner that
   * doesn't accidentally forget forever to send some notifications.
   * (Also se object Mailer.)
   */
  def startNewActor(actorSystem: ActorSystem, systemDao: SystemDao, siteDaoFactory: SiteDaoFactory)
        : ActorRef = {
    val actorRef = actorSystem.actorOf(Props(
      new Notifier(systemDao, siteDaoFactory)),
      name = s"NotifierActor-$testInstanceCounter")
    actorSystem.scheduler.schedule(0 seconds, 20 seconds, actorRef, "SendNotfs")
    testInstanceCounter += 1
    actorRef
  }

  // Not thread safe; only needed in integration tests.
  var testInstanceCounter = 1

}



/**
 * Loads pending notifications from the database, and asks
 * Mailer to send those notifications. (For example, asks Mailer to notify
 * someone of a reply to his/her comment.)
 *
 * Updates the notfs so no one else also attempts to construct and send
 * the same emails.
 *
 * Thread safe.
 */
class Notifier(val systemDao: SystemDao, val siteDaoFactory: SiteDaoFactory)
  extends Actor {


  val logger = play.api.Logger("app.notifier")


  def receive = {
    case "SendNotfs" =>
      val delay = sys.props.get("debiki.notifier.delayInMinutes").map(_.toInt) getOrElse 5
      val notfsBySiteId: Map[SiteId, Seq[Notification]] =
        systemDao.loadNotificationsToMailOut(delayInMinutes = delay, numToLoad = 11)
      logger.trace(s"Found notifications for ${notfsBySiteId.size} sites.")
      trySendEmailNotfs(notfsBySiteId)
  }


  /**
   * Sends notifications, for all tenants and notifications specified.
   */
  private def trySendEmailNotfs(notfsBySiteId: Map[SiteId, Seq[Notification]]) {

    for {
      (siteId, siteNotfs) <- notfsBySiteId
      notfsByUserId: Map[UserId, Seq[Notification]] = siteNotfs.groupBy(_.toUserId)
      (userId, userNotfs) <- notfsByUserId
    }{
      logger.debug(s"Sending ${userNotfs.size} notifications to user $userId, site $siteId...")

      val siteDao = siteDaoFactory.newSiteDao(QuotaConsumers(tenantId = siteId))

      /* COULD batch load all users at once via systemDao.loadUsers().
      val userIdsBySiteId: Map[String, List[SiteId]] =
        notfsBySiteId.mapValues(_.map(_.recipientUserId))
      val usersBySiteAndId: Map[(SiteId, UserId), User] = loadUsers(userIdsBySiteId) */
      val anyUser = systemDao.loadUser(siteId, userId = userId)

      // Send email, or remember why we didn't and don't try again.
      val anyProblem = trySendToSingleUser(userId, anyUser, userNotfs, siteDao)

      anyProblem foreach { problem =>
        siteDao.updateNotificationSkipEmail(userNotfs)
      }
    }
  }


  /** Tries to send an email with one or many notifications to a single user.
    * Returns any issue that prevented the email from being sent.
    */
  private def trySendToSingleUser(userId: UserId, anyUser: Option[User],
        notfs: Seq[Notification], siteDao: SiteDao): Option[String] = {

    def logWarning(message: String) =
      logger.warn(s"Skipping email to user id `$userId', site `${siteDao.siteId}': $message")

    val user = anyUser getOrElse {
      logWarning("user not found")
      return Some("User not found")
    }

    // If email notification preferences haven't been specified, assume the user
    // wants to be notified of replies. I think most people want that? And if they
    // don't, there's an unsubscription link in the email.
    if (user.emailNotfPrefs != EmailNotfPrefs.Receive &&
        user.emailNotfPrefs != EmailNotfPrefs.Unspecified) {
      return Some("User declines emails")
    }

    if (user.email.isEmpty) {
      return Some("User has no email address")
    }

    val site = siteDao.loadSite()
    if (site.chost.isEmpty && site.embeddingSiteUrl.isEmpty) {
      val problem = "neither chost nor embedding site url specified"
      logWarning(problem)
      return Some(problem)
    }

    constructAndSendEmail(siteDao, site, user, notfs)
    None
  }


  private def constructAndSendEmail(siteDao: SiteDao, site: Tenant,
        user: User, userNotfs: Seq[Notification]) {
    // Save the email in the db, before sending it, so even if the server
    // crashes it'll always be found, should the receiver attempt to
    // unsubscribe. (But if you first send it, then save it, the server
    // might crash inbetween and it wouldn't be possible to unsubscribe.)

    val anyOrigin = site.chost map { chost =>
      (chost.https.required ? "https://" | "http://") + chost.address
    }

    val email = constructEmail(siteDao, anyOrigin, user, userNotfs) getOrElse {
      logger.debug(o"""Not sending any email to ${user.displayName} because the page
        or the comment is gone or not approved or something like that.""")
      return
    }
    siteDao.saveUnsentEmailConnectToNotfs(email, userNotfs)

    logger.debug("About to send email to "+ email.sentTo)
    Globals.sendEmail(email, siteDao.siteId)
  }


  private def constructEmail(dao: SiteDao, anyOrigin: Option[String], user: User,
        notfs: Seq[Notification]): Option[Email] = {

    val subject: String =
      if (notfs.size == 1) "You have a reply, to one of your comments"
      else "You have replies, to comments of yours"

    val email = Email(EmailType.Notification, sendTo = user.email, toUserId = Some(user.id),
      subject = subject, bodyHtmlText = (emailId: String) => "?")

    val contents = views.NotfHtmlRenderer(dao, anyOrigin).render(notfs)
    if (contents isEmpty)
      return None

    // If this is an embedded discussion, there is no Debiki canonical host address to use.
    // So use the site-by-id origin, e.g. http://site-123.debiki.com, which always works.
    val unsubscriptionUrl =
      s"${Globals.siteByIdOrigin(dao.siteId)}/?unsubscribe&email-id=${email.id}"

    val htmlContent =
      <div>
        <p>Dear {user.displayName},</p>
        { contents }
        <p>
          Kind regards,<br/>
          <a href="http://www.debiki.com">Debiki</a>
        </p>
        <p style='font-size: 80%; opacity: 0.65; margin-top: 2em;'>
          <a href={unsubscriptionUrl}>Unsubscribe</a>
        </p>
      </div>.toString

    Some(email.copy(bodyHtmlText = htmlContent))
  }

}

