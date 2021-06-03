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
import debiki.EdHttp._
import debiki.JsonUtils._
import debiki.ParseText
import debiki.RateLimits
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

    var debugResponse = ""
    def logAndDebug(message: St): U = {
      debugResponse += message
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
          debugResponse += s"Error parsing Basic Auth header: " + ex.toString
          logger.debug(s"Error parsing Basic Auth header", ex)
      }
    }

    val jsonString = Json.stringify(request.body)
    logger.debug(s"Got an email: $jsonString")

    tryParse(parseIncomingEmail(request.body)) match {
      case Good(parsedEmail) =>
        logAndDebug(s"Could parse email: $parsedEmail")
      case Bad(errMsg) =>
        logAndDebug(s"Error parsing email: $errMsg")
    }

    if (debug) Ok(debugResponse + "\n\nDEBUG") as TEXT
    else  Ok(debugResponse) as TEXT
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
           mailboxHash = parseSt(email, "MailboxHash"),
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

}
