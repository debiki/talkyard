/**
 * Copyright (c) 2021 Kaj Magnus Lindberg
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

package talkyard.server.emails.in

import com.debiki.core._
import com.debiki.core.Prelude._
import debiki.EdHttp._
import debiki.JsonUtils._
import debiki.ParseText
import debiki.RateLimits
import debiki.dao.SiteDao
import debiki.Globals.isDevOrTest
import talkyard.server.{TyContext, TyController}
import javax.inject.Inject
import play.api.libs.json._
import play.api.mvc.{Action, ControllerComponents}
import play.mvc.Http.{HeaderNames => play_HeaderNames}
import talkyard.server.TyLogging
import org.scalactic.{Good, Or, Bad}
import talkyard.server.notf.NotfHtmlRenderer


class EmailsInController @Inject()(cc: ControllerComponents, edContext: TyContext)
  extends TyController(cc, edContext) with TyLogging {

  import context.safeActions.ExceptionAction

  // '(?s)' makes '.' match newlines too.
  private val EmailIdRegex = """(?s).*Ty_email_id=([a-zA-Z0-9_]+-[a-zA-Z0-9_]+).*""".r

  def handleIncomingEmail(debug: Bo): Action[JsValue] =
        PostJsonAction(RateLimits.PostReply,
            maxBytes = 200*1000, allowAnyone = true) { request =>

    throwForbiddenIf(!request.isViaApiSecret,
          "TyE8F03MSEJ46", "Must call emails-in webhook via API secret")
    // But can't any site w their per-site sysbot secret call this?  [2_super_sysbot]

    val debugResponse = StringBuilder.newBuilder
    def logAndDebug(message: St): U = {
      debugResponse.append(message).append("\n\n")
      logger.debug(message)
    }

    // Can remove, see  invokeBlockAuthViaApiSecret()  in PlainApiActions.scala.
    val authHeader: Opt[St] = request.headers.get(play_HeaderNames.AUTHORIZATION)
    logAndDebug(s"Got any ${play_HeaderNames.AUTHORIZATION} header?: '$authHeader''")
    authHeader foreach { authHeaderValue =>
      try {
        val usernamePasswordBase64Encoded = authHeaderValue.replaceFirst("Basic ", "")
        import org.apache.commons.codec.{binary => acb}
        val decodedBytes: Array[i8] = acb.Base64.decodeBase64(usernamePasswordBase64Encoded)
        val usernameColonPassword = new String(decodedBytes, "UTF-8")
        logAndDebug(s"Found username:pwd in Basic Auth header: ${usernameColonPassword}")
      }
      catch {
        case ex: Ex =>
          debugResponse.append(s"Error parsing Basic Auth header: " + ex.toString)
          logger.debug(s"Error parsing Basic Auth header", ex)
      }
    }

    val jsonString = Json.stringify(request.body)
    logger.debug(s"Got an email: $jsonString")

    tryParse(parseIncomingEmail(request.body)) match {
      case Good(parsedEmail) =>
        // We include the (pub-site-id)-(email-id) in the From address and also
        // in a gray <small> text in the email body, to know which email
        // someone is trying to reply to.
        val emailIdInAddr: Opt[St] = parsedEmail.mailboxHash
        val emailIdInBody: Opt[St] =
              EmailIdRegex.findGroupInAny(
                  parsedEmail.htmlBody.orElse(parsedEmail.textBody))

        logAndDebug(s"Could parse email, has id in addr hash: ${emailIdInAddr.isDefined
              }, in body: ${emailIdInBody.isDefined}")
        logger.trace(s"The parsed email: $parsedEmail")

        var anyEmailId: Opt[St] = emailIdInAddr orElse emailIdInBody
        emailIdInAddr foreach { idInAddr =>
          if (emailIdInBody.isSomethingButNot(idInAddr)) {
            logAndDebug(s"Email id in email addr differs from id in body, ignoring")
            anyEmailId = None
          }
        }

        anyEmailId match {
          case None =>
            logAndDebug(s"No email id, don't know what this incoming email replies to")
          case Some(siteEmailId: St) =>
            val parts: Array[St] = siteEmailId.split('-')  // [em_in_hash]
            if (parts.length != 2) {
              logAndDebug(s"Bad site and email id, ${parts.length
                    } parts: '$siteEmailId'")
            }
            else {
              val pubSiteId = parts(0)
              val emailId = parts(1)
              val anySite = context.globals.systemDao.getSiteByPubId(pubSiteId)
              anySite match {
                case None =>
                  logAndDebug(s"Bad hash: No site with pub id '$pubSiteId'")
                case Some(site: Site) =>
                  logAndDebug(s"Email id '$siteEmailId' maps to site ${site.id
                        }, hostname ${site.canonicalHostnameStr}")
                  maybeSendCannotReplyToEmailsInfoEmail(
                        parsedEmail, emailId, context.globals.siteDao(site.id),
                        debugResponse)
              }
            }
        }
      case Bad(errMsg) =>
        logAndDebug(s"Error parsing email: $errMsg")
    }

    if (debug) Ok(debugResponse.toString + "\n\nDEBUG") as TEXT
    else  Ok(debugResponse.toString) as TEXT
  }


  /** [pars_em_in] */
  private def parseIncomingEmail(email: JsValue): ParsedReplyEmail = {
    var seemsLikeSpam: Opt[Bo] = None
    var spamScore: Opt[f32] = None

    val headers = parseJsArray(email, "Headers", optional = true)
    headers foreach { header: JsValue =>
      val headerName = parseSt(header, "Name")
      val headerValue: St = parseSt(header, "Value")
      headerName match {
        case "X-Spam-Status" =>
          seemsLikeSpam = Some(headerValue != "No")
        case "X-Spam-Score" =>
          spamScore = Some(ParseText.parseFloat64(headerValue, "Value").toFloat)
        case _ => ()
      }
    }

    ParsedReplyEmail(
           messageId = parseSt(email, "MessageID"),
           dateText = parseSt(email, "Date"),
           mailboxHash = parseOptSt(email, "MailboxHash").noneIfBlank,
           sentToAddr = parseSt(email, "To"),
           //sentToName: St,
           //sentToHash: St,
           sentFromAddr = parseSt(email, "From"),
           //sentFromName: St,
           //sentFromHash: St,
           replyTo = parseSt(email, "ReplyTo"),
           subject = parseSt(email, "Subject"),
           htmlBody = parseOptSt(email, "HtmlBody").noneIfBlank,
           textBody = parseOptSt(email, "TextBody").noneIfBlank,
           strippedReplyText = parseOptSt(email, "StrippedTextReply").noneIfBlank,
           seemsLikeSpam = seemsLikeSpam,
           spamScore = spamScore,
           attachments = Nil,
           )
  }


  private def maybeSendCannotReplyToEmailsInfoEmail(emailIn: ParsedReplyEmail,
          emailId: EmailOutId, siteDao: SiteDao, debugResponse: StringBuilder): U = {

    val siteId = siteDao.siteId
    def logAndDebug(message: St): U = {
      debugResponse.append(message).append("\n\n")
      logger.debug(message)
    }

    val emailInDb = siteDao.loadEmailByIdOrErr(emailId) getOrIfBad { err =>
      logAndDebug(s"s$siteId: Error looking up outbound email by id: $err")
      return ()
    }

    val replyNr = addUpToMaxInt16(emailInDb.numRepliesBack getOrElse 0, 1)

    // Update db, before sending a cannot-reply email reply to the reply, so we
    // for sure won't try to reply to the reply more than once.
    siteDao.updateSentEmail(
          emailInDb.copy(numRepliesBack = Some(replyNr)))

    val notf = siteDao.loadNotificationByEmailId(emailInDb.id) getOrElse {
      logAndDebug(o"""s$siteId: Not replying to incoming email reply to
            outgoing email id ${emailInDb.id} — cannot find any related notification""")
      return
    }

    if (replyNr == 1) {
      val ffName = "ffSendCannotReplyViaEmail"
      if (context.globals.config.featureFlags.contains(ffName) || isDevOrTest) {
        logAndDebug(s"s$siteId: Sending cannot-reply-via-email once to ${
              emailIn.sentFromAddr}")
        val emailToSend = makeCannotReplyViaEmailEmail(
              emailIn, emailInDb, notf, siteDao) getOrIfBad { problem =>
          logAndDebug(s"s$siteId: Won't send a cannot-reply-via-email to ${
                emailIn.sentFromAddr} who replied to email id ${emailInDb.id
                }, because: $problem")
          return
        }
        siteDao.globals.sendEmail(emailToSend, siteId)
        // But don't save this email in the db — that could create an eternal
        // email loop between Ty and an external email service that auto
        // replies to Ty.
      }
      else {
        logAndDebug(s"s$siteId: Won't send a cannot-reply-via-email once to ${
              emailIn.sentFromAddr}, because feature flag '$ffName' not enabled.")
      }
    }
    else {
      logAndDebug(o"""s$siteId: Ignoring email reply nr $replyNr to email '$emailId'
            from ${emailIn.sentFromAddr}.""")
    }
  }


  private def makeCannotReplyViaEmailEmail(
        emailIn: ParsedReplyEmail, origEmailOut: EmailOut,
        notfAny: Notification, dao: SiteDao): EmailOut Or ErrMsg = {
    val (siteName, origin) = dao.theSiteNameAndOrigin()
    val htmlSt: St =
          if (notfAny.tyype.isAboutNewApprovedPost) {
            val notf = notfAny match {
              case n: Notification.NewPost => n
            }
            makeCannotReplyEmailText(siteName, origin, notf, dao) getOrIfBad { probl =>
              return Bad(probl)
            }
          }
          else {
            makeCannotReplyEverEmailText(siteName, origin)
          }

    // Reuse the original email out From: address, so the cannot-reply email ends up
    // in the same email thread as the notification email pat replied to. So that
    // pat can just scroll up a bit in that email thread, and find the notf email.
    // (But don't reuse the original email id — that'd make us overwrite that email
    // in the database>)
    Good(Email.createGenId(
          EmailType.YouCannotReply,
          createdAt = dao.globals.now(),
          sendTo = emailIn.sentFromAddr,
          sendFrom = origEmailOut.sentFrom,
          toUserId = origEmailOut.toUserId,
          subject = s"[$siteName] New notifications",   // I18N
          bodyHtml = htmlSt))
  }


  private def makeCannotReplyEmailText(siteName: St, origin: St,
        notf: Notification.NewPost, dao: SiteDao): St Or ErrMsg = {
    import dao.siteId

    val post = dao.loadPostByUniqueId(notf.uniquePostId) getOrElse {
      return Bad(s"s$siteId: Post ${notf.uniquePostId} missing for AboutPost notf ${notf.id}")
    }

    val pageMeta = dao.getPageMeta(post.pageId) getOrElse {
      return Bad(s"s$siteId: Page ${post.pageId} missing for AboutPost notf ${notf.id}")
    }

    val anyAuthor = dao.getParticipant(post.createdById)
    val byAuthorName = anyAuthor map { a => s"by ${a.usernameOrGuestName}," } getOrElse ""
    val notfRenderer = NotfHtmlRenderer(dao, Some(origin))
    val url = notfRenderer.postUrl(pageMeta, post)

    val htmlSt: St =
        <div class="e_CantReViaEmail">
          <p>Hi there,</p>
          <p>It seems you tried to reply to a notification email
            about a new post {byAuthorName} at {siteName}.
            {/*
            Maybe better skip the site link — they've already demonstrated
            that they don't look at the emails carefully, and another link
            is likely a bad idea?
            So, don't:  <a href={origin}>{siteName}</a>   */}
          </p>
          <p>
            Unfortunately, our system doesn't support replying via email.
          </p>
          <p>Instead, click this blue Reply link:
          (or the one in the original notification email; it's the same)
          </p>
          <p>
            <a href={url} style={NotfHtmlRenderer.replyBtnStyles
                } class="e_EmReB2" >Reply</a>
          </p>
          <p>(This is an automated message; you cannot reply to this either.)</p>
          <p>Kind regards.</p>
        </div>.toString

    Good(htmlSt)
  }


  private def makeCannotReplyEverEmailText(siteName: St, origin: St): St = {
    <div>
      <p>Hi there,</p>
      <p>You tried to reply to a notification email from <samp>{siteName}</samp>.
        Unfortunately, you cannot reply to that type of notifications.</p>
      <p>But you can go here and check your notifications:</p>
      <p><a href={origin}>{origin}</a></p>
      <p>(You might need to log in.)</p>
      <p>Kind regards.</p>
    </div>.toString
  }
}
