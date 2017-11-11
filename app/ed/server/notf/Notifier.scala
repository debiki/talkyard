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

package ed.server.notf

import akka.actor._
import com.debiki.core.Prelude._
import com.debiki.core._
import debiki.DatabaseUtils.isConnectionClosedBecauseTestsDone
import debiki.dao.{SiteDao, SiteDaoFactory, SystemDao}
import ed.server.notf.Notifier._
import org.owasp.encoder.Encode
import play.{api => p}
import scala.collection.{immutable, mutable}
import scala.concurrent.ExecutionContext
import scala.concurrent.duration._



object Notifier {

  val MaxNotificationsPerEmail = 5
  val MaxEmailBodyLength = 3000

  /** Hacks, for Usability Testing Exchange (UTX). [plugin] */
  val UtxSiteId = 94
  val UtxTestQueueCategoryId = 5

  /**
   * Starts a single notifier actor.
   *
   * BUG: SHOULD terminate it before shutdown, in a manner that
   * doesn't accidentally forget forever to send some notifications.
   * (Also se object Mailer.)
   */
  def startNewActor(executionContext: ExecutionContext, actorSystem: ActorSystem,
        systemDao: SystemDao, siteDaoFactory: SiteDaoFactory)
        : ActorRef = {
    implicit val execCtx = executionContext
    val actorRef = actorSystem.actorOf(Props(
      new Notifier(systemDao, siteDaoFactory)),
      name = s"NotifierActor-$testInstanceCounter")
    // For now, check for emails more often, so e2e tests won't have to wait for them to
    // get sent. SHOULD wait at least for the ninja edit interval before sending any notf email.
    // But how make that work, with tests?
    actorSystem.scheduler.schedule(4 seconds, 2 seconds, actorRef, "SendNotfs")  // [5KF0WU2T4]
    actorSystem.scheduler.schedule(3 seconds, 2 seconds, actorRef, "SendSummaries")
    actorSystem.scheduler.schedule(10 seconds, 1 hour, actorRef, "SendUtxReminders")
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

  import systemDao.globals

  val logger = play.api.Logger("app.notifier")


  def receive: PartialFunction[Any, Unit] = {
    case whatever: String if globals.isInitialized =>
      try {
        whatever match {
          case "SendNotfs" =>
            loadAndSendNotifications()
          case "SendSummaries" =>
            createAndSendSummaryEmails()
          case "SendUtxReminders" =>
            createAndSendUtxReminderEmails()  // [plugin]
        }
      }
      catch {
        case ex: java.sql.SQLException =>
          if (!isConnectionClosedBecauseTestsDone(ex, globals)) {
            p.Logger.error("SQL error when sending notfs or summaries [EdE2WPFR1]", ex)
            throw ex
          }
        case throwable: Throwable =>
          p.Logger.error("Error when sending notfs or summaries [EdE2WPFR2]", throwable)
          throw throwable
      }
  }


  private def createAndSendSummaryEmails() {
    val now = globals.now()
    val siteIdsAndStats: Map[SiteId, immutable.Seq[UserStats]] =
      systemDao.loadStatsForUsersToMaybeEmailSummariesTo(now, limit = 100)
    for ((siteId, userStats) <- siteIdsAndStats) {
      val siteDao = siteDaoFactory.newSiteDao(siteId)
      val emails = siteDao.makeActivitySummaryEmails(userStats, now)
      emails foreach { case (email, _) =>
        globals.sendEmail(email, siteId)
      }
    }
  }


  CLEAN_UP; REFACTOR // break out to ed.server.utx.SomeNewClass? Later...  UtxDao maybe?
  private def createAndSendUtxReminderEmails() {  // [plugin]
    val now = globals.now()
    val aDayAgo = now.minusDays(1)
    val aWeekAgo = now.minusDays(7)
    val dao = siteDaoFactory.newSiteDao(UtxSiteId)
    var usersById: Map[UserId, User] = null
    val userIdsNoReminder = dao.readOnlyTransaction { tx =>
      val topics: Seq[PagePathAndMeta] =
        tx.loadPagesInCategories(
          Seq(UtxTestQueueCategoryId),
          PageQuery(
            PageOrderOffset.ByCreatedAt(Some(aDayAgo.toJavaDate)),
            PageFilter.ShowWaiting,
            includeAboutCategoryPages = false),
          limit = 100)
      val createdByUserIds = topics.map(_.meta.authorId).toSet
      usersById = tx.loadUsersAsMap(createdByUserIds)
      val emailsSentToAuthors: Map[UserId, Seq[Email]] = tx.loadEmailsSentTo(
        createdByUserIds, after = aWeekAgo, emailType = EmailType.HelpExchangeReminder)
      createdByUserIds filterNot { userId =>
        emailsSentToAuthors.get(userId).exists(_.exists(_.tyype == EmailType.HelpExchangeReminder))
      }
    }

    for (userId <- userIdsNoReminder ; user <- usersById.get(userId) ; if user.email.nonEmpty ;
          userName <- user.anyName orElse user.anyUsername ;
          if userId <= 101 || globals.conf.getBoolean("utx.reminders.enabled").is(true)) { HACK; SHOULD // remove when done testing live
      val UtxTestQueueCategoryId = 5

      val email = Email.newWithId(
        Email.generateRandomId(),
        EmailType.HelpExchangeReminder,
        createdAt = now,
        sendTo = user.email,
        toUserId = Some(userId),
        subject = s"[usability.testing.exchange] Reminder about giving feedback",
        bodyHtmlText = i"""
          |<p>Hi $userName,</p>
          |
          |<p>You'll get more feedback about the website you submitted to Usability Testing Exchange, if you give more feedback to others. If you haven't already, you can <a href="https://usability.testing.exchange/give-me-a-task">go here and give feedback to others</a>.
          |</p>
          |
          |<p>We're glad you submitted your site. Please feel welcomed. Note: When you give feedback about something that is broken or doesn't look so great: be specific. Don't just say "I don't like it" — then the other person won't know what you have in mind, or what to change and improve. Instead, say e.g. "I don't understand what (something) is", or "I think that picture doesn't fit here".
          |</p>
          |
          |<p>Please try to be friendly and also mention things you like. Don't say that something looks terrible and such things. We want people to stay happy and feel encouraged to continue learning and experimenting — especially if they are new to design and usability, and do mistakes.
          |</p>
          |
          |<p>We hope you like looking at other people's websites & giving feedback :-) and that you'll learn from it, e.g. avoiding mistakes you see others make.
          |</p>
          |
          |<p>So, when you have time:
          |<a href="https://usability.testing.exchange/give-me-a-task">
          |go here, and continue helping others</a>.
          |</p>
          |
          |<p>Kind regards.</p>
          |
          |<p><small>PS. If you want to create a forum & community for your website,<br>
          |check out <a href="https://www.effectivediscussions.org">Effective Discussions</a>.</small>
          |</p>
          |""")
      dao.readWriteTransaction { tx =>
        tx.saveUnsentEmail(email)
      }
      globals.sendEmail(email, dao.siteId)
      dao.readWriteTransaction { tx =>
        tx.updateSentEmail(
          email.copy(sentOn = Some(globals.now().toJavaDate)))
      }
    }
  }


  private def loadAndSendNotifications() {
    // COULD use ninjaEdit ninja edit timeout/delay setting here instead (that is, num minutes
    // one is allowed to edit a post directly after having posted it, without the edits appearing
    // in the version history. Usually a few minutes. Google for "Discourse ninja edit")
    val delay = sys.props.get("ed.notifier.delayInMinutes").map(_.toInt) getOrElse 0
    val notfsBySiteId: Map[SiteId, Seq[Notification]] =
      systemDao.loadNotificationsToMailOut(delayInMinutes = delay, numToLoad = 11)
    if (notfsBySiteId.nonEmpty) {
      logger.trace(s"Found notifications for ${notfsBySiteId.size} sites.")
    }
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

      val siteDao = siteDaoFactory.newSiteDao(siteId)

      /* COULD batch load all users at once via systemDao.loadUsers().
      val userIdsBySiteId: Map[String, List[SiteId]] =
        notfsBySiteId.mapValues(_.map(_.recipientUserId))
      val usersBySiteAndId: Map[(SiteId, UserId), User] = loadUsers(userIdsBySiteId) */
      val anyUser = siteDao.getUser(userId)

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

    val site = siteDao.theSite()
    constructAndSendEmail(siteDao, site, user, notfs.take(MaxNotificationsPerEmail))
    None
  }


  private def constructAndSendEmail(siteDao: SiteDao, site: Site,
        user: User, userNotfs: Seq[Notification]) {
    // Save the email in the db, before sending it, so even if the server
    // crashes it'll always be found, should the receiver attempt to
    // unsubscribe. (But if you first send it, then save it, the server
    // might crash inbetween and it wouldn't be possible to unsubscribe.)

    val anyOrigin = globals.originOf(site)

    val email = constructEmail(siteDao, anyOrigin, user, userNotfs) getOrElse {
      logger.debug(o"""Not sending any email to ${user.usernameOrGuestName} because the page
        or the comment is gone or not approved or something like that.""")
      return
    }
    siteDao.saveUnsentEmailConnectToNotfs(email, userNotfs)

    logger.debug("About to send email to "+ email.sentTo)
    globals.sendEmail(email, siteDao.siteId)
  }


  private def constructEmail(dao: SiteDao, anyOrigin: Option[String], user: User,
        notfs: Seq[Notification]): Option[Email] = {

    val (siteName, origin) = dao.theSiteNameAndOrigin()

    // Always use the same subject line, even if only 1 comment, so will end up in the same
    // email thread. Include site name, so simpler for people to find the email.
    val subject: String = s"[$siteName] You have replies to posts of yours"

    val email = Email(EmailType.Notification, createdAt = globals.now(),
      sendTo = user.email, toUserId = Some(user.id),
      subject = subject, bodyHtmlText = (emailId: String) => "?")

    val contents = NotfHtmlRenderer(dao, anyOrigin).render(notfs)
    if (contents isEmpty)
      return None

    // If this is an embedded discussion, there is no Debiki canonical host address to use.
    // So use the site-by-id origin, e.g. https://site-123.debiki.com, which always works.
    val unsubscriptionUrl =
      origin + controllers.routes.UnsubscriptionController.showForm(email.id).url

    def makeBoringLink(title: String, url: String) =
      <a href={url} style="text-decoration: none !important; color: #333 !important;">{title}</a>

    def makeUnderlinedLink(title: String, url: String) =
      <a href={url} style="color: #333 !important;">{title}</a>

    val htmlContent =
      <div>
        <p>Dear {user.usernameOrGuestName},</p>
        {contents}
        <p>
          Kind regards,<br/>
          { makeBoringLink(siteName, url = origin) }
        </p>
        <p style='font-size: 85%; opacity: 0.68; margin-top: 2em;'>
          { makeUnderlinedLink("Unsubscribe", url = unsubscriptionUrl) }
        </p>
        <p style='font-size: 85%; opacity: 0.68;'>
          Powered by {
            makeBoringLink("EffectiveDiscussions", url = "https://www.effectivediscussions.org") }
        </p>
      </div>.toString

    Some(email.copy(bodyHtmlText = htmlContent))
  }

}

