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

package talkyard.server.notf

import akka.actor._
import com.debiki.core.Prelude._
import com.debiki.core._
import debiki.MaxLimits
import debiki.dao.{SiteDao, SiteDaoFactory, SystemDao}
import talkyard.server.notf.NotifierActor._
import scala.collection.{immutable, mutable}
import scala.collection.mutable.ArrayBuffer
import scala.concurrent.ExecutionContext
import scala.concurrent.duration._
import talkyard.server.TyLogger
import talkyard.server.jobs.BackgroundJobsActor



object NotifierActor {

  val MaxNotificationsPerEmail = 5

  // There's a db constraint, emailsout_c_bodyhtml_len, that limits the length of the emails.
  val MaxEmailBodyLength = 15000

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
      new NotifierActor(systemDao, siteDaoFactory)),
      name = s"NotifierActor-$testInstanceCounter")
    // For now, check for emails more often, so e2e tests won't have to wait for them to
    // get sent. SHOULD wait at least for the ninja edit interval before sending any notf email.
    // But how make that work, with tests?
    actorSystem.scheduler.scheduleWithFixedDelay(4 seconds, 2 seconds, actorRef, "SendNotfs")  // [5KF0WU2T4]
    actorSystem.scheduler.scheduleWithFixedDelay(3 seconds, 2 seconds, actorRef, "SendSummaries")
    actorSystem.scheduler.scheduleWithFixedDelay(10 seconds, 1 hour, actorRef, "SendUtxReminders")
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
class NotifierActor (val systemDao: SystemDao, val siteDaoFactory: SiteDaoFactory)
  extends BackgroundJobsActor("NotifierActor") {

  val globals: debiki.Globals = systemDao.globals


  def tryReceiveUnlessJobsPaused(message: Any): U = message match {
    case whatever: St =>
        whatever match {
          case "SendNotfs" =>
            loadAndSendNotifications()
          case "SendSummaries" =>
            createAndSendSummaryEmails()
          case "SendUtxReminders" =>
            createAndSendUtxReminderEmails()  // [plugin]
        }
  }


  private def createAndSendSummaryEmails(): Unit = {
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


  CLEAN_UP; REFACTOR // break out to talkyard.server.utx.SomeNewClass? Later...  UtxDao maybe?
  // Answer: This can instead be an external bot / server [bot_api], which once a day
  // looks at new signups (queries Ty's API) and sends emails.
  private def createAndSendUtxReminderEmails(): Unit = {  // [plugin]
    val now = globals.now()
    val aDayAgo = now.minusDays(1)
    val aWeekAgo = now.minusDays(7)
    val dao = siteDaoFactory.newSiteDao(UtxSiteId)
    var usersById: Map[UserId, ParticipantInclDetails] = null
    val userIdsNoReminder = dao.readOnlyTransaction { tx =>
      val topics: Seq[PagePathAndMeta] =
        tx.loadPagesInCategories(
          Seq(UtxTestQueueCategoryId),
          PageQuery(
            PageOrderOffset.ByCreatedAt(Some(aDayAgo.toJavaDate)),
            PageFilter(PageFilterType.WaitingTopics, includeDeleted = false),
            includeAboutCategoryPages = false),
          limit = 100)
      val createdByUserIds = topics.map(_.meta.authorId).toSet
      usersById = tx.loadParticipantsInclDetailsByIdsAsMap_wrongGuestEmailNotfPerf(createdByUserIds)
      val emailsSentToAuthors: Map[UserId, Seq[Email]] = tx.loadEmailsSentTo(
        createdByUserIds, after = aWeekAgo, emailType = EmailType.HelpExchangeReminder)
      createdByUserIds filterNot { userId =>
        emailsSentToAuthors.get(userId).exists(_.exists(_.tyype == EmailType.HelpExchangeReminder))
      }
    }

    for {
      userId <- userIdsNoReminder
      userWithDetails: ParticipantInclDetails <- usersById.get(userId)
      // Completely stop sending reminders soon, so people won't flag as spam.
      if now.daysSince(userWithDetails.createdAt) < 21
      user = userWithDetails.noDetails  // weird. Maybe copy fns to InclDetails class too? Oh well
      if user.email.nonEmpty
      userName <- user.anyName orElse user.anyUsername
      if userId <= 101 || globals.conf.getOptional[Boolean]("utx.reminders.enabled").is(true)
    } { HACK; SHOULD // remove when done testing live
      val UtxTestQueueCategoryId = 5

      val email = Email.newWithId(
        Email.generateRandomId(),
        EmailType.HelpExchangeReminder,
        createdAt = now,
        sendTo = user.email,
        toUserId = Some(userId),
        aboutWhat = None,
        subject = s"[usability.testing.exchange] Reminder about giving feedback",
        bodyHtmlText = i"""
          |<p>Hi $userName,</p>
          |
          |<p>Welcome to Usability Testing Exchange; we're glad you submitted your site.
          |</p>
          |
          |<p>You'll get more feedback yourself, if you give more feedback to others. If you haven't already, you can <a href="https://usability.testing.exchange/give-me-a-task">go here and give feedback</a>.
          |</p>
          |
          |<p>When giving feedback:</p>
          |
          |<ul>
          |<li>Please be friendly and maybe mention things you like. Don't say that something looks terrible. We want people to feel encouraged to continue learning and experimenting -- especially if they are new to design and usability, and do mistakes.
          |</li>
          |<li>Be specific. Don't just say "I don't like it" -- then the other person won't know what to change and improve. Instead, say e.g. "I don't understand this text: ...", or "I think that picture doesn't fit here".
          |</li>
          |</ul>
          |
          |<p>We hope you like looking at other people's websites & giving feedback :- ) and that you'll learn from it, e.g. avoiding mistakes you see others make.
          |</p>
          |
          |<p>So, when you have time and want to,
          |<a href="https://usability.testing.exchange/give-me-a-task">
          |go here, and give feedback</a>.
          |</p>
          |
          |<p>Kind regards.</p>
          |
          |<p>(PS. Want a community for your own website? Where people can get questions answered,
          |suggest ideas, and give feedback to you?
          |Check out <b><a href="https://www.talkyard.io?ref=utxWelcEmail">Talkyard</a></b><br>
          |-- the open source software that powers Usability Testing Exchange.)
          |</p>
          |""")

      dao.writeTx { (tx, _) =>
        tx.saveUnsentEmail(email)
      }
      globals.sendEmail(email, dao.siteId)
      dao.writeTx { (tx, _) =>
        tx.updateSentEmail(
          email.copy(sentOn = Some(globals.now().toJavaDate)))
      }
    }
  }


  private def loadAndSendNotifications(): Unit = {
    // COULD use ninjaEdit ninja edit timeout/delay setting here instead (that is, num minutes
    // one is allowed to edit a post directly after having posted it, without the edits appearing
    // in the version history. Usually a few minutes. Google for "Discourse ninja edit")
    val delay = sys.props.get("talkyard.notifier.delayInMinutes").map(_.toInt) getOrElse 0
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
  private def trySendEmailNotfs(notfsBySiteId: Map[SiteId, Seq[Notification]]): Unit = {

    for {
      (siteId, siteNotfs) <- notfsBySiteId
      notfsByUserId: Map[UserId, Seq[Notification]] = siteNotfs.groupBy(_.toUserId)
      (userId, userNotfsMaybeInclSeen) <- notfsByUserId
    }{
      logger.debug(
        s"s$siteId: Sending up to ${userNotfsMaybeInclSeen.size} notifications to user $userId...")

      val siteDao = siteDaoFactory.newSiteDao(siteId)

      // Look up the user to be notified. But if han is an anonym or pseudonym (`anyAlias`
      // below), look up the true user (`anyUser`) instead and notify that one:

      /* COULD batch load all users at once via systemDao.loadUsers().
      val userIdsBySiteId: Map[String, List[SiteId]] =
        notfsBySiteId.mapValues(_.map(_.recipientUserId))
      val usersBySiteAndId: Map[(SiteId, UserId), User] = loadUsers(userIdsBySiteId) */
      val (anyUser: Opt[Pat],
            anyStats: Opt[UserStats],
            anyAlias: Opt[Pat],
            anyAliasStats: Opt[UserStats]) = siteDao.readTx { tx =>
        val (anyPat, anyStats) = tx.loadParticipantAndStats(userId)
        anyPat match {
          case None => (None, None, None, None)
          case Some(pat) =>
            if (!pat.isAlias) {
              (Some(pat), anyStats, None, None)
            }
            else {
              val (anyTruePat, anyTrueStats) = tx.loadParticipantAndStats(pat.trueId2.trueId)
              (anyTruePat, anyTrueStats, Some(pat), anyStats)
            }
        }
      }

      // If it's a pseudonym, and it's snoozing, that must mean the true user
      // don't want notifications related to that pseudonym, for the moment.
      val isSnoozingNow =
            anyAliasStats.exists(_.isSnoozing(globals.now())) ||
            anyStats.exists(_.isSnoozing(globals.now()))

      // Maybe the user just changed hens settings and no longer wants to get notified
      // about posts hen has read already?
      val skipSeen = anyUser.exists(_.emailNotfPrefs != EmailNotfPrefs.ReceiveAlways)
      val (notfsToSkip, notfsToSend) = userNotfsMaybeInclSeen.span { notf =>
        UX; SHOULD // remember which notfs was skipped, because snoozing,
        // and send a Snoozed-notfs summary email, when un-snoozing.
        isSnoozingNow ||
            notf.seenAt.isDefined && skipSeen
      }

      siteDao.updateNotificationSkipEmail(notfsToSkip)

      // Send email, or remember why we didn't and don't try again.
      trySendToSingleUser(userId, anyUser, anyAlias = anyAlias, notfsToSend, siteDao)
    }
  }


  /** Tries to send an email with one or many notifications to a single user.
    * If error, logs a message and updates the notification, sets email status to
    * NotfEmailStatus.Skipped.
    */
  private def trySendToSingleUser(userId: UserId, anyUser: Opt[Pat], anyAlias: Opt[Pat],
        notfs: Seq[Notification], siteDao: SiteDao): U = {
    val siteId = siteDao.siteId

    // This can happen if snoozing.
    if (notfs.isEmpty)
      return

    def skipBecause(msg: St, warn: Bo = true): U = {
      val logMsg = s"s$siteId: Skipping email to user id $userId: $msg  [TyMSKIPEML]"
      if (warn) logger.warn(logMsg)
      else logger.debug(logMsg)
      siteDao.updateNotificationSkipEmail(notfs)
    }

    val user = anyUser getOrElse {
      skipBecause("user not found")
      return
    }

    // Maybe let people configure separate addresses for pseudonyms?  [pseudonyms_later]
    if (user.email.isEmpty) {
      // If the user getting notified is a pseudonym / anonym, we won't notice until here
      // that the true user doesn't have any email address. [true_has_no_email]
      // (Could detect earlier, but we need to update the database in any case (to
      // remember that the email has been processed) so doesn't matter.)
      skipBecause("User has no email address", warn = anyAlias.isEmpty)
      return
    }

    // If email notfs prefs have been configured for a pseudonym, use those.
    val emailNotfPrefs: EmailNotfPrefs =
          if (anyAlias.exists(_.emailNotfPrefs != EmailNotfPrefs.Unspecified))
            anyAlias.get.emailNotfPrefs
          else
            user.emailNotfPrefs

    // If email notification preferences haven't been specified, assume the user
    // wants to be notified of replies. I think most people want that? And if they
    // don't, there's an unsubscription link in the email.
    if (emailNotfPrefs != EmailNotfPrefs.Receive &&
        emailNotfPrefs != EmailNotfPrefs.ReceiveAlways &&
        emailNotfPrefs != EmailNotfPrefs.Unspecified) {
      // Or maybe just debug log level, here? — A harmless race can trigger this?
      skipBecause("User declines emails")
      return
    }

    val site = siteDao.theSite()

    // Should have been sorted already. [older_notfs_emails]
    val notfsSorted = notfs.sortBy(_.id)
    warnDevDieIf(notfsSorted.map(_.id) != notfs.map(_.id), "TyE502RKGL5",
          s"s$siteId: Notfs sort order appears random")

    // Currently sending [one_email_at_a_time], for threaded emails.
    COULD // group by page id, and send one email for all notfs about post on one page?
    val notfsToSendNow = notfsSorted.take(MaxNotificationsPerEmail)
    for (notf <- notfsToSendNow) {
      try constructAndSendEmail(siteDao, site, user, Seq(notf))
      catch {
        case ex: java.sql.SQLException =>
          logger.error(s"s${site.id} SQL error when saving email about notf: $notf")
          siteDao.updateNotificationSkipEmail(Seq(notf))
      }
    }
  }


  private def constructAndSendEmail(siteDao: SiteDao, site: Site,
        user: Participant, userNotfs: Seq[Notification]): Unit = {
    // Save the email in the db, before sending it, so even if the server
    // crashes it'll always be found, should the receiver attempt to
    // unsubscribe. (But if you first send it, then save it, the server
    // might crash inbetween and it wouldn't be possible to unsubscribe.)

    val anyOrigin = globals.originOf(site)

    // Note that, since notfs are sorted chronologically, when we generate this email,
    // then, emails about earlier posts (if any) on the same page have already been
    // generated, and we know their SMTP Message-ID:s,  [older_notfs_emails]
    // so we can include those ids in the 'In-Reply-To' and 'References' headers.
    val email = constructEmail(siteDao, anyOrigin, user, userNotfs) getOrElse {
      logger.debug(o"""Not sending any email to ${user.usernameOrGuestName} because the page
        or the comment is gone or not approved or something like that.""")
      return
    }

    siteDao.saveUnsentEmailConnectToNotfs(email, userNotfs)

    logger.debug("About to send email to "+ email.sentTo)
    globals.sendEmail(email, siteDao.siteId)
  }


  private def constructEmail(dao: SiteDao, anyOrigin: Option[String], user: Participant,
        notfs: Seq[Notification]): Option[Email] = {

    val (siteName, origin) = dao.theSiteNameAndOrigin()

    val notfRenderResult = NotfHtmlRenderer(dao, anyOrigin).renderNotfs(notfs)
    if (notfRenderResult.html.isEmpty)
      return None

    // Always use the same subject line, even if only 1 comment, so ends up in the same
    // email thread. Include site name, so simpler for people to find the email.
    var subject = ""

    // The following creates different and more specific email titles — but results
    // in email clients creating many different email threads, making people annoyed
    // about a noisy email inbox.
    // Keep this, commented out, anyway — maybe for low traffic sites (like,
    // a blog with 1 new topic per month), more specific titles can be nice?
    /*
    val subject: String = {
        val newWhat = ArrayBuffer[String]()
        if (notfRenderResult.newModTasks) {
          newWhat.append("posts to moderate")
        }
        if (notfRenderResult.newMessagesToYou) {
          newWhat.append("direct messages")
        }
        if (notfRenderResult.newRepliesOrMentions) {
          newWhat.append("replies")
        }
        if (notfRenderResult.newLikeVotes) {
          newWhat.append("Like votes")
        }
        if (notfRenderResult.newTopics) {
          newWhat.append("topics")
        }
        if (notfRenderResult.newPosts) {
          if (newWhat.nonEmpty) newWhat.append("and other ")
          newWhat.append("posts")
        }
        if (newWhat.isEmpty) {
          newWhat.append("stuff")
        }
        val subjText = StringBuilder.newBuilder
        val (commaSep, andLast) =
              if (newWhat.length >= 2) newWhat.splitAt(newWhat.length - 1)
              else (newWhat, ArrayBuffer.empty)
        subjText ++= s"[$siteName] New "
        subjText ++= commaSep.mkString("", ", ", "")
        andLast foreach { subjText ++= ", and " + _ }
        subjText.toString
      } */

    // This helps email clients create an email thread per Talkyard discussion page.
    // Later on, even comment sub threads so Mutt will work well.
    val (aboutWhat: Opt[EmailAbout], thisMsgId: Opt[SmtpMsgId],
         inReplyToMsgId: Opt[SmtpMsgId], refsMsgIds: ImmSeq[SmtpMsgId]) = {
      if (notfs.length != 1) {
        // If many notfs, then, what should the SMTP Message-ID be?  But this cannot
        // happen currently — we send [one_email_at_a_time], nowadays (Nov 2022).
        (None, None, None, Nil)
      }
      else notfs.head match {
        case notf: Notification.NewPost =>
          // Incl page title in subject line.
          val anyPost = dao.loadPostByUniqueId(notf.uniquePostId)
          val anyPageStuff = anyPost.flatMap(post => dao.getOnePageStuffById(post.pageId))

          val (aboutWhat: Opt[EmailAbout], referencesMsgIds: ImmSeq[SmtpMsgId])
                  = anyPageStuff match {
            case None => (None, Nil)
            case Some(page) =>
              subject = s"[$siteName] ${page.title}"
              val post = anyPost getOrDie "TyE603MRSKD64"

              warnDevDieIf(notf.toTheTrueId != user.id, "TyE40wGKS", s"s${dao.siteId
                    }: notf.toTheTrueId: ${notf.toTheTrueId}, user.trueId2: ${user.trueId2}")

              val earlierEmailsSamePage: ImmSeq[EmailOut] = dao.loadEmailsToPatAboutThread(
                    toPatId = notf.toTheTrueId, pageId = page.pageId,
                    parentPostNr = post.parentNr, limit = 30)

              val aboutWhat = EmailAbout.Post(
                    postId = post.id,
                    pageId = page.pageId,
                    postNr = post.nr,
                    parentNr = post.parentNr,
                    catId = page.categoryId)

              (Some(aboutWhat), earlierEmailsSamePage.flatMap(_.smtpMsgId))
          }

          // For now. Some day, could try to reply to the closest ancestor post instead
          // (since Ty is threaded).
          val inReplyToMsgId: Opt[SmtpMsgId] = referencesMsgIds.lastOption

          val host = origin.dropWhile(_ != ':').drop(3)  // removes "http(s)://"
          val thisMsgId: Opt[SmtpMsgId] = notf.makeSmtpMsgId(host)

          (aboutWhat, thisMsgId, inReplyToMsgId, referencesMsgIds)

        case _ =>
          (None, None, Nil, Nil)
      }
    }

    if (subject.isEmpty)
      subject = s"[$siteName] New notifications"   // I18N

    subject = subject.take(MaxLimits.MaXEmailSubjectLength_200)

    val email = Email.createGenId(EmailType.Notification, createdAt = globals.now(),
          sendTo = user.email, toUserId = Some(user.id),
          aboutWhat = aboutWhat, subject = subject, bodyHtml = "?",
          smtpMsgId = thisMsgId, inReplyToSmtpMsgId = inReplyToMsgId,
          referencesSmtpMsgIds = refsMsgIds)

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
        {notfRenderResult.html}
        <p>
          Kind regards,<br/>
          { makeBoringLink(siteName, url = origin) }
        </p>
        <p style='font-size: 92%; opacity: 0.67; margin-top: 2em;'>
          { makeUnderlinedLink("Unsubscribe", url = unsubscriptionUrl) }<br/>
          <small style='opacity: 0.67'>Ty_email_id={dao.thePubSiteId() + '-' + email.id}</small>
        </p>
        <p style='font-size: 92%; opacity: 0.77; margin-top: 1.5em;'>
          Powered by {
            makeUnderlinedLink("Talkyard", url = "https://www.talkyard.io") }
        </p>
      </div>.toString

    Some(email.copy(
          // It's "impossible" to exceed the max length — 20 000 chars —
          // since we include just an excerpt of one post at a time (theaded emails).
          bodyHtmlText = htmlContent.take(MaxLimits.MaXEmailBodyLength_20k)))
  }

}

