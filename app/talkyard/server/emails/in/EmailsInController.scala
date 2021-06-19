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
import ed.server.{EdContext, EdController}
import javax.inject.Inject
import play.api.libs.json._
import play.api.mvc.{Action, ControllerComponents}
import play.mvc.Http.{HeaderNames => play_HeaderNames}
import talkyard.server.TyLogging
import org.scalactic.{Good, Bad}


class EmailsInController @Inject()(cc: ControllerComponents, edContext: EdContext)
  extends EdController(cc, edContext) with TyLogging {

  import context.safeActions.ExceptionAction


  def handleIncomingEmail(debug: Bo): Action[JsValue] =
        PostJsonAction(RateLimits.PostReply,
            maxBytes = 200*1000, allowAnyone = true) { request =>

    throwForbiddenIf(!request.isViaApiSecret,
          "TyE8F03MSEJ46", "Must call emails-in webhook via API secret")

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
        logAndDebug(s"Could parse email: $parsedEmail")
        parsedEmail.mailboxHash match {
          case None =>
            logAndDebug(s"No hash, don't know what this incoming email replies to")
          case Some(hash: St) =>
            val parts: Array[St] = hash.split('-')  // [em_in_hash]
            if (parts.length != 2) {
              logAndDebug(s"Bad site and email id hash, ${parts.length} parts: '$hash'")
            }
            else {
              val pubSiteId = parts(0)
              val emailId = parts(1)
              val anySite = context.globals.systemDao.getSiteByPubId(pubSiteId)
              anySite match {
                case None =>
                  logAndDebug(s"Bad hash: No site with pub id '$pubSiteId'")
                case Some(site: Site) =>
                  logAndDebug(s"MailboxHash '$hash' maps to site ${site.id}, hostname ${
                        site.canonicalHostnameStr}")
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
           mailboxHash = parseOptSt(email, "MailboxHash"),
           sentToAddr = parseSt(email, "To"),
           //sentToName: St,
           //sentToHash: St,
           sentFromAddr = parseSt(email, "From"),
           //sentFromName: St,
           //sentFromHash: St,
           replyTo = parseSt(email, "ReplyTo"),
           subject = parseSt(email, "Subject"),
           htmlBody = parseOptSt(email, "HtmlBody"),
           textBody = parseOptSt(email, "TextBody"),
           strippedReplyText = parseOptSt(email, "StrippedTextReply"),
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

    // Update db, before sending a cannot-reply email reply to the reply, so we
    // for sure won't try to reply to the reply more than once.
    siteDao.updateSentEmail(emailInDb.copy(numRepliesBack =
          emailInDb.numRepliesBack.map(
              addUpToMaxInt16(_, 1)).orElse(Some(1))))

    val replyNr = (emailInDb.numRepliesBack getOrElse 0) + 1
    if (replyNr == 1) {
      val ffName = "ffSendCannotReplyViaEmail"
      if (context.globals.config.featureFlags.contains(ffName) || isDevOrTest) {
        logAndDebug(s"s$siteId: Sending cannot-reply-via-email once to ${
              emailIn.sentFromAddr}")
        val emailToSend = makeCannotReplyViaEmailEmail(
              emailIn, emailInDb, siteDao)
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
        emailIn: ParsedReplyEmail, origEmailOut: EmailOut, dao: SiteDao): EmailOut = {
    val (siteName, origin) = dao.theSiteNameAndOrigin()
    val htmlSt: St =
          <div>
            <p>You cannot reply via email. Instead, go here:</p>
            <p><a href={origin}>{origin}</a></p>
            <p>and check your reply notifications. You might need to log in.</p>
            <p>Kind regards.</p>
          </div>.toString

    Email.createGenId(
          EmailType.YouCannotReply,
          createdAt = dao.globals.now(),
          sendTo = emailIn.sentFromAddr,
          toUserId = origEmailOut.toUserId,
          subject = s"[$siteName] You cannot reply via email",   // I18N
          bodyHtml = htmlSt)
  }
}
