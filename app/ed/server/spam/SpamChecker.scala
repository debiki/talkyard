/**
 * Copyright (c) 2015-2016, 2019 Kaj Magnus Lindberg
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

package ed.server.spam

import com.debiki.core._
import com.debiki.core.Prelude._
import debiki.{AllSettings, Config, TextAndHtml, TextAndHtmlMaker}
import debiki.EdHttp.throwForbidden
import debiki.JsonUtils.readOptString
import java.{net => jn}
import java.net.UnknownHostException
import play.{api => p}
import play.api.libs.ws._
import play.api.libs.json.{JsArray, JsObject, JsString, Json}
import scala.collection.mutable.ArrayBuffer
import scala.collection.immutable
import scala.concurrent.duration._
import scala.concurrent.{ExecutionContext, Future, Promise}
import scala.concurrent.Future.successful
import scala.util.Success



object ApiKeyInvalidException extends QuickException
object CouldNotVerifyApiKeyException extends QuickException
object BadSpamCheckResponseException extends QuickException



/** Currently uses Google Safe Browsing API and Akismet and Spamhaus and uribl and StopForumSpam.
  * Could break out the various services to different classes — but not right now, first find out
  * these spam checks seem to work or not.
  * Or break out to plugins.  [plugin]
  *
  * Test like so:
  * - Google Safe Browsing: Post a link to http://malware.tes ting.google.test/testing/malware/
  *    (without the space in "testing")
  *   see: https://groups.google.com/forum/#!topic/google-safe-browsing-api/_jiN19nWwC8
  * - Akismet: Post a title or page or comment with: '--viagra-test-123--' anywhere
  * - Spamhaus: Link to 'dbltest.com', see:
  * - uribl: Link to 'test.uribl.com' or 2.0.0.127, see: http://uribl.com/about.shtml
  * - StopForumSpam: sign up with email test@test.com
  * - Without any third party stuff, include in a comment or email addr: {{{__ed_spam _test_123__}}}
  *   but _without the space in the middle_.
  *
  * Which domain block lists to use? Have a look here:
  *   https://www.intra2net.com/en/support/antispam/index.php_sort=accuracy_order=desc.html
  * the URIBL entries only ("uri block list", rather than e.g. email sender's ip address).
  *
  * Todo:
  *  Could send only new users' posts to Akistmet
  *  Read: https://meta.discourse.org/t/some-ideas-for-spam-control/10393/4
  *  SECURITY SHOULD Periodically test if we're being blocked by the domain block lists or Akismet,
  *  and, if so, log a warning, so we'll know that the spam checks don't work.
  *
  * More to test / use:
  * http://blogspam.net/faq/
  * https://www.mollom.com/pricing
  * https://cleantalk.org/price
  * http://sblam.com/ -- no, doesn't seem to support https
  * -- For IPs: (when signing up)
  * http :// www.spamhaus.org / lookup / 4
  * http :// www.spamcop.net / bl.shtml3
  * http :// www.projecthoneypot.org / search_ip.php4
  * http :// torstatus.blutmagie.de / tor_exit_query.php2
  *
  * Jeff Atwood @ Discourse's list of block lists:
  *   https://meta.discourse.org/t/questionable-account-checks-at-the-time-of-signup/19068/7
  *
  * Deal w new user *profile* spam: [PROFLSPM]
  *   https://meta.discourse.org/t/lots-of-spam-new-user-registrations/38925/17
  *
  * And Discourse's built in spam control:
  * https://meta.discourse.org/t/some-ideas-for-spam-control/10393/4?u=kajmagnus
  * ----- (this text between --- is licensed under a Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License, (c) Jeff Atwood)-----
  *   So far here is what we have:
  *
  *   new users are sandboxed in a few ways, notably they cannot post images, and can only have 2 URLs in any given post.
  *
  *   posting the same root URL over and over as a new user will lead to auto-hiding of all their posts with that URL, block of future posts with the same root URL, and a PM generated to them
  *
  *   if (x) new user posts are flagged by (y) unique users, all their posts are hidden, a PM generated to them, and they are prevented from posting
  *
  *   if an individual post reaches the community flagging threshold, it is hidden and a PM generated to the user. An edit will un-hide the post. Read more about flagging.
  *
  *   if the moderator deletes the spam user via the "delete spammer" button available from clicking "flag, spam" on one of their posts, both the email address and IP address are blacklisted and will not be accepted for new accounts again.
  *
  *   if a topic is started by a new user, and a different new user with the same IP address replies to that topic, both posts are automatically flagged as spam
  *
  *   accounts created in the last 24 hours can only create a maximum of 5 topics and 10 replies.
  *
  *   accounts created in the last 24 hours can only create new topics every 60 seconds and new replies every 30 seconds.
  *
  *   deleted spammers automatically blacklist the email and IP used. Emails are fuzzy matched.
  *
  *   you can temporarily disable all new account registration as needed via allow_user_registrations.
  *
  *   Trust level 3 users can hide spam with a single flag, versus the three (default setting) flags that are usually required. Read more about user trust levels.
  *-----------
  *
  * Thread safe.
  */
class SpamChecker(
  config: Config,
  isDevTest: Boolean,
  originOfSiteId: Function[SiteId, Option[String]],
  settingsBySiteId: Function[SiteId, AllSettings],
  executionContext: ExecutionContext,
  playConf: play.api.Configuration,
  wsClient: WSClient,
  textAndHtmlMaker: TextAndHtmlMaker) {

  private implicit val execCtx: ExecutionContext = executionContext

  /*
  val request: dispatch.Req = dispatch.url("https://api.hostip.info/country.php").GET
  ... https://ipinfo.io/developers
  */

  private val talkyardVersion = generatedcode.BuildInfo.dockerTag
  private val TimeoutMs = 5000
  private val UserAgent = s"Talkyard/$talkyardVersion | Built-In/0.0.0"
  private val ContentType = "application/x-www-form-urlencoded"

  // Should be a by-site-id map? [MANYAKISMET]
  private val akismetKeyIsValidPromise: Promise[Boolean] = Promise()

  private def encode(text: String) = jn.URLEncoder.encode(text, "UTF-8")

  private val anyAkismetKey: Option[String] = config.akismetApiKey

  // See https://akismet.com/development/api/#comment-check
  val AkismetAlwaysSpamName = "viagra-test-123"
  val AkismetAlwaysSpamEmail = "akismet-guaranteed-spam@example.com"

  // Type the text '--viagra-test-123--' in a comment or title and it should be reported as
  // spam, always.
  val AlwaysSpamMagicText = "--viagra-test-123--"

  // Break up the string so if someone copy-pastes this code snippet into ED,
  // it won't be reported as spam.
  val TalkyardSpamMagicText: String = "talkyard_spam" + "_test_1234"

  // All types: https://blog.akismet.com/2012/06/19/pro-tip-tell-us-your-comment_type/
  object AkismetSpamType {
    val Comment = "comment"
    val Reply = "reply"
    val Pingback = "pingback"
    val Trackback = "trackback"
    val ForumPost = "forum-post" // forum posts and replies
    val BlogPost = "blog-post"
    val ContactForm = "contact-form" // contact forms, inquiry forms and the like
    val Signup = "signup" // account signup, registration or activation
    val Tweet = "tweet" // twitter messages
    val Message = "message"
  }

  val SpamChecksEnabledConfValName = "talkyard.spamChecks.enabled"

  val spamChecksEnabled: Boolean = {
    val enabled = playConf.getOptional[Boolean](SpamChecksEnabledConfValName) getOrElse true
    if (!enabled) {
      play.api.Logger.info(s"Spam checks disabled; conf val $SpamChecksEnabledConfValName = false")
    }
    enabled
  }

  val GoogleApiKeyName = "talkyard.googleApiKey"

  val anyGoogleApiKey: Option[String] =
    playConf.getOptional[String](GoogleApiKeyName).noneIfBlank

  private val stopForumSpamEnabled: Boolean =
    spamChecksEnabled &&
      playConf.getOptional[Boolean]("talkyard.stopforumspam.enabled").getOrElse(true)

  private val akismetEnabled: Boolean =
    spamChecksEnabled && anyAkismetKey.nonEmpty


  def start() {
    verifyAkismetApiKey()
  }


  private def verifyAkismetApiKey() {
    if (!akismetEnabled) {
      akismetKeyIsValidPromise.success(false)
      return
    }

    // apparently port number not okay, -> invalid, and http://localhost -> invalid, too.
    val postData = "key=" + encode(anyAkismetKey.get) +
      "&blog=" + encode("http://localhost")  // Not 'localhost'? should do once per site? [MANYAKISMET]

    // Without (some of) these headers, Akismet says the api key is invalid.
    val request: WSRequest =
      wsClient.url("https://rest.akismet.com/1.1/verify-key").withHttpHeaders(
        play.api.http.HeaderNames.CONTENT_TYPE -> ContentType,
        play.api.http.HeaderNames.USER_AGENT -> UserAgent,
        play.api.http.HeaderNames.CONTENT_LENGTH -> postData.length.toString)
        .withRequestTimeout(7.seconds)

    request.post(postData).map({ response: WSResponse =>
      val body = response.body
      val isValid = body.trim == "valid"
      if (!isValid) {
        val debugHelp = response.header("X-akismet-debug-help")
        p.Logger.error(o"""Akismet key is not valid [DwE4PKW0], response: '$body', debug help:
            $debugHelp""")
      }
      else {
        p.Logger.info(s"Akismet key is valid [DwM2KWS4]")
      }
      akismetKeyIsValidPromise.success(isValid)
    }).recover({
      case ex: Exception =>
        p.Logger.error("Error verifying Akismet API key [TyE2AKB5R0]", ex)
        akismetKeyIsValidPromise.success(false)
    })
  }


  def detectRegistrationSpam(spamCheckTask: SpamCheckTask): Future[SpamCheckResults] = {
    require(spamCheckTask.postToSpamCheck.isEmpty, "TyE53RWE8")

    if (!spamChecksEnabled)
      return Future.successful(Nil)

    val siteSettings: AllSettings = settingsBySiteId(spamCheckTask.siteId)

    val spamTestFutures: Vector[Future[SpamCheckResult]] =
      if (spamCheckTask.requestStuff.userName contains TalkyardSpamMagicText) {
        Vector(Future.successful(SpamCheckResult.SpamFound(
          spamCheckerDomain = "localhost",
          humanReadableMessage =
            s"Name contains test spam text: '$TalkyardSpamMagicText' [EdM5KSWU7]")))
      }
      else if (spamCheckTask.requestStuff.userEmail.exists(_ contains TalkyardSpamMagicText)) {
        Vector(Future.successful(SpamCheckResult.SpamFound(
          spamCheckerDomain = "localhost",
          humanReadableMessage =
            s"Email contains test spam text: '$TalkyardSpamMagicText' [EdM5KSWU7]")))
      }
      else {
        val stopForumSpamFuture: Option[Future[SpamCheckResult]] =
          if (!stopForumSpamEnabled || !siteSettings.enableStopForumSpam) None
          else {
            Some(checkViaStopForumSpam(spamCheckTask))
          }

        val akismetFuture: Option[Future[SpamCheckResult]] =
          None
          /* Disable for now — I've read Akismet sometimes blocks too many people, during
          registration, and then there might be no way for them to tell the forum staff
          about this, since they couldn't join the forum (and that might be The way
          to get in touch with the organization). Wait until Akismet comment spam
          has been in use for a while so I better know how well it works.
          And, instead of blocking profiles before they're even saved — do allow
          *creation* of profiles, but restrict them afterwards, instead, if they're
          likely spammers — set the threat level to Moderate Threat? And staff
          can optionally contact them and ask, if unsure (spammers typically don't
          have any sensible on-topic replies if staff says "who are you why did you join?").
          Also submit their About profile text to a spam check service at the
          same time. [PROFLSPM]
          if (!akismetEnabled || !siteSettings.enableAkismet) None
          else {
            makeAkismetRequestBody(spamCheckTask) map checkViaAkismet
          } */

        stopForumSpamFuture.toVector ++ akismetFuture.toVector
      }

    // Some dupl code (5HK0XC4W2)
    Future.sequence(spamTestFutures) map { results: Vector[SpamCheckResult] =>
      val spamFoundResults = results.collect { case r: SpamCheckResult.SpamFound => r }

      SHOULD // insert into audit log (or some spam log?), gather stats

      if (spamFoundResults.nonEmpty) {
        p.Logger.info(i"""Registration spam detected: [EdM4FK0W2]
            | $spamCheckTask
            |""")
        spamFoundResults foreach { spamReason =>
          p.Logger.info(s"Spam reason [EdM5GKP0R]: $spamReason")
        }
      }
      results
    }
  }


  def detectPostSpam(spamCheckTask: SpamCheckTask): Future[SpamCheckResults] = {
    if (!spamChecksEnabled)
      return Future.successful(Nil)

    val postToSpamCheck = spamCheckTask.postToSpamCheck getOrElse {
      return Future.successful(Nil)
    }

    val siteSettings: AllSettings = settingsBySiteId(spamCheckTask.siteId)

    val textAndHtml = textAndHtmlMaker.forHtmlAlready(postToSpamCheck.htmlToSpamCheck)

    val spamTestFutures: Vector[Future[SpamCheckResult]] =
      if (textAndHtml.text contains TalkyardSpamMagicText) {
        Vector(Future.successful(SpamCheckResult.SpamFound(
          spamCheckerDomain = "localhost",
          humanReadableMessage =
            s"Text contains test spam text: '$TalkyardSpamMagicText' [EdM4DKF03]")))
      }
      else {
        val urlsAndDomainsFutures =
          checkUrlsViaGoogleSafeBrowsingApi(spamCheckTask, textAndHtml).toVector ++
            checkDomainBlockLists(spamCheckTask, textAndHtml)

        // COULD postpone the Akismet check until after the domain check has been done? [5KGUF2]
        // So won't have to pay for Akismet requests, if the site is commercial.
        // Currently the Spamhaus test happens synchronously already though.

        // Don't send the whole text, because of privacy issues. Send the links only. [4KTF0WCR]
        // Or yes do that?  dupl question [7KECW2]
        val userIsNotNew = spamCheckTask.requestStuff.userTrustLevel.exists(
          _.toInt >= TrustLevel.FullMember.toInt)

        val akismetFuture: Option[Future[SpamCheckResult]] =
          if (userIsNotNew || !akismetEnabled || !siteSettings.enableAkismet) {
            None
          }
          else {
            originOfSiteId(spamCheckTask.siteId) match {
              case None =>
                p.Logger.warn(s"Site not found: ${spamCheckTask.siteId} [TyE5KA2Y8]")
                None
              case Some(siteOrigin) =>
                makeAkismetRequestBody(spamCheckTask) flatMap checkViaAkismet
            }
          }

        urlsAndDomainsFutures ++ akismetFuture.toVector
      }

    // Some dupl code (5HK0XC4W2)
    Future.sequence(spamTestFutures) map { results: Vector[SpamCheckResult] =>
      val spamFoundResults = results.collect { case r: SpamCheckResult.SpamFound => r }

      SHOULD // insert into audit log (or some spam log?), gather stats
      // Auto blocking happens here: [PENDNSPM].

      if (spamFoundResults.nonEmpty) {
        p.Logger.debug(i"""Text spam detected [TyM8YKF0]:
            | - who: ${spamCheckTask.who}
            | - post: $postToSpamCheck
            | - req: ${spamCheckTask.requestStuff}
            | - siteId: ${spamCheckTask.siteId}
            |--- text: --------------
            |${textAndHtml.text.trim}
            |--- spam reasons: ------
            |${spamFoundResults.map(_.toString).mkString("\n").trim}
            |------------------------
            | """)
      }
      results
    }
  }


  val StopForumSpamDomain = "www.stopforumspam.com"

  def checkViaStopForumSpam(spamCheckTask: SpamCheckTask): Future[SpamCheckResult] = {
    // StopForumSpam doesn't support ipv6.
    // See: https://www.stopforumspam.com/forum/viewtopic.php?id=6392
    val ipAddr = spamCheckTask.who.ip
    val anyIpParam =
      if (ipAddr.startsWith("[") || ipAddr.contains(":")) ""
      else  "&ip=" + encode(ipAddr)
    val encodedEmail = encode(spamCheckTask.requestStuff.userEmail getOrElse "")
    wsClient.url(s"https://$StopForumSpamDomain/api?email=$encodedEmail$anyIpParam&f=json")
      .withRequestTimeout(7.seconds)
      .get()
      .map(handleStopForumSpamResponse)
      .recover({
        case ex: Exception =>
          // COULD rate limit requests to stopforumspam, seems as if otherwise it rejects connections?
          // Got this:  java.net.ConnectException  when running lots of e2e tests at the same time.
          p.Logger.warn(s"Error querying stopforumspam.com [TyE2PWC7]", ex)
          SpamCheckResult.Error(StopForumSpamDomain)
      })
  }


  def handleStopForumSpamResponse(response: WSResponse): SpamCheckResult = {
    // Ask: https://api.stopforumspam.org/api?ip=91.186.18.61&email=g2fsehis5e@mail.ru&f=json
    // Response:
    //    {"success":1,"email":{"frequency":0,"appears":0},"ip":{"frequency":0,"appears":0}}

    def prettyJson = s"\n--------\n${response.body}\n--------"
    val json =
      try Json.parse(response.body)
      catch {
        case ex: Exception =>
          p.Logger.warn(s"Bad JSON from api.stopforumspam.org: $prettyJson", ex)
          return SpamCheckResult.Error(StopForumSpamDomain)
      }

    if ((json \ "success").asOpt[Int] isNot 1) {
      p.Logger.warn(s"api.stopforumspam.org returned success != 1: $prettyJson")
      return SpamCheckResult.NoSpam(StopForumSpamDomain)
    }

    val ipJson = json \ "ip"
    (ipJson \ "frequency").asOpt[Int] match {
      case None =>
        p.Logger.warn(s"api.stopforumspam.org didn't send back any ip.frequency: $prettyJson")
      case Some(frequency) =>
        if (frequency >= 1)
          return SpamCheckResult.SpamFound(
            spamCheckerDomain = StopForumSpamDomain,
            humanReadableMessage =
              o"""Stop Forum Spam thinks a spammer lives at your ip address
              (frequency = $frequency). You can instead try from another location,
              e.g. another apartment or house, so that you'll get a different
              ip address [DwE7JYK2]""")
    }

    val emailJson = json \ "email"
    (emailJson \ "frequency").asOpt[Int] match {
      case None =>
        p.Logger.warn(s"api.stopforumspam.org didn't send back any email.frequency: $prettyJson")
      case Some(frequency) =>
        if (frequency >= 1)
          return SpamCheckResult.SpamFound(
            spamCheckerDomain = StopForumSpamDomain,
            humanReadableMessage =
              o"""Stop Forum Spam thinks the person with that email address is a spammer
              (frequency = $frequency). Do you want to try with a different address? [DwE5KGP2]""")
    }

    SpamCheckResult.NoSpam(StopForumSpamDomain)
  }


  val GoogleSafeBrowsingApiDomain = "safebrowsing.googleapis.com"

  private def checkUrlsViaGoogleSafeBrowsingApi(spamCheckTask: SpamCheckTask, textAndHtml: TextAndHtml)
        : Option[Future[SpamCheckResult]] = {
    // API: https://developers.google.com/safe-browsing/lookup_guide#HTTPPOSTRequest
    val apiKey = anyGoogleApiKey getOrElse {
      return None
    }

    def whichTask = spamCheckTask.sitePostIdRevOrUser

    // ".*" tells the url validator to consider all domains valid, even if it doesn't
    // recognize the top level domain.
    import org.apache.commons.validator.routines.{UrlValidator, RegexValidator}
    val urlValidator = new UrlValidator(new RegexValidator(".*"), UrlValidator.ALLOW_2_SLASHES)
    val validUrls = textAndHtml.links.filter(urlValidator.isValid)
    if (validUrls.isEmpty)
      return None

    val safeBrowsingApiUrl =
      s"https://$GoogleSafeBrowsingApiDomain/v4/threatMatches:find?key=$apiKey"

    // https://developers.google.com/safe-browsing/v4/lookup-api#checking-urls
    // https://developers.google.com/safe-browsing/v4/reference/rest/v4/ThreatType

    val requestJson = Json.obj(
      "client" -> Json.obj(
        "clientId" -> "Talkyard",
        "clientVersion" -> talkyardVersion),
      "threatInfo" -> Json.obj(
        "threatTypes" -> Json.arr(
          "THREAT_TYPE_UNSPECIFIED",
          "MALWARE",
          "SOCIAL_ENGINEERING",
          "UNWANTED_SOFTWARE",
          "POTENTIALLY_HARMFUL_APPLICATION"),
        "platformTypes" -> Json.arr("ANY_PLATFORM"),
        "threatEntryTypes" -> Json.arr("URL"),
        "threatEntries" -> JsArray(validUrls map { url =>
          Json.obj("url" -> url)
        })))
    /*
    Example, from Google's docs: (2019-04-15)
    (https://developers.google.com/safe-browsing/v4/lookup-api#checking-urls)
        {
          "client": {
            "clientId":      "yourcompanyname",
            "clientVersion": "1.5.2"
          },
          "threatInfo": {
            "threatTypes":      ["MALWARE", "SOCIAL_ENGINEERING"],
            "platformTypes":    ["WINDOWS"],
            "threatEntryTypes": ["URL"],
            "threatEntries": [
              {"url": "http://www.urltocheck1.org/"},
              {"url": "http://www.urltocheck2.org/"},
              {"url": "http://www.urltocheck3.com/"}
            ]
          }
        }  */

    val requestBody = requestJson.toString

    val request: WSRequest =
      wsClient.url(safeBrowsingApiUrl).withHttpHeaders(
        play.api.http.HeaderNames.CONTENT_LENGTH -> requestBody.length.toString)
        .withRequestTimeout(7.seconds)

    /*
    Google's response is like: (2019-04-15)
      {
        "matches": [{
          "threatType":      "MALWARE",
          "platformType":    "WINDOWS",
          "threatEntryType": "URL",
          "threat":          {"url": "http://www.urltocheck1.org/"},
          "threatEntryMetadata": {
            "entries": [{
              "key": "malware_threat_type",
              "value": "landing"
           }]
          },
          "cacheDuration": "300.000s"
        },
        ...]
      }  */

    Some(request.post(requestBody).map({ response: WSResponse =>
      try { response.status match {
        case 200 =>
          val json = Json.parse(response.body)
          (json \ "matches").asOpt[JsArray] match {
            case None =>
              // All urls seem ok, Google thinks.
              SpamCheckResult.NoSpam(GoogleSafeBrowsingApiDomain)
            case Some(array) if array.value.isEmpty =>
              // Don't think Google sends this response? Anyway, apparently all urls are fine.
              SpamCheckResult.NoSpam(GoogleSafeBrowsingApiDomain)
            case Some(array) if array.value.nonEmpty =>
              // One or more bad urls found.
              val threatLines = ArrayBuffer[String]()
              var error = false
              for (threatMatchObj <- array.value ; if !error) {
                val threatType: String =
                  readOptString(threatMatchObj, "threatType") getOrElse "(Unknown threat type)"
                val platformType: String =
                  readOptString(threatMatchObj, "platformType") getOrElse "(Unknown platform)"
                (threatMatchObj \ "threat").asOpt[JsObject] match {
                  case Some(threatObj) =>
                    readOptString(threatObj, "url") match {
                      case Some(badUrl) =>
                        threatLines += s"$threatType for $platformType:  $badUrl"
                      case None =>
                        error = true
                        p.Logger.warn(
                          s"$whichTask: Unexpected JSON from Google Safe Browsing API [TyGSAFEAPIJSN01]" +
                          s"\nReponse body:\n" + response.body)
                    }
                  case None =>
                    error = true
                    p.Logger.warn(
                      s"$whichTask: Unexpected JSON from Google Safe Browsing API [TyGSAFEAPIJSN02]" +
                      s"\nReponse body:\n" + response.body)
                }
              }
              SpamCheckResult.SpamFound(  // also if error == true
                staffMayUnhide = false,
                spamCheckerDomain = GoogleSafeBrowsingApiDomain,
                humanReadableMessage =
                  "Google Safe Browsing API v4 thinks these links are bad:\n\n" +
                  threatLines.mkString("\n"))
          }
        case weirdStatusCode =>
          // More status codes: https://developers.google.com/safe-browsing/v4/status-codes
          p.Logger.warn(
            s"$whichTask: Error querying Google Safe Browsing API, " +
              "status: $weirdStatusCode [TyEGSAFEAPISTS]" +
              "\nResponse body:\n" + response.body)
          SpamCheckResult.Error(GoogleSafeBrowsingApiDomain)
          /*
          // Google says we shall include the "read more" and "provided by Google"
          // and "perhaps all this is wrong" texts below, see:
          // https://developers.google.com/safe-browsing/lookup_guide#AcceptableUsage
          // However, we're sending this message back to the person who *posted*
          // the evil urls — and s/he likely knows already what s/he is doing?
          // Still, a friendly message makes sense, because in some rare cases a good
          // site might have been compromised and the link poster has good intentions.
          val prettyEvilStuff = evilUrlsAndVerdics.map(urlAndVerdict => {
            // This results in e.g.:  "malware: https://evil.kingdom/malware"
            urlAndVerdict._2 + ": " + urlAndVerdict._1
          }).mkString("\n")
          Some(i"""
            |
            |${evilUrlsAndVerdics.length} possibly evil URLs found:
            |-----------------------------
            |
            |$prettyEvilStuff
            |
            |The above URLs might be pishing pages, or might harm your computer (any "malware:" rows
            |above), or might contain harmful programs (any "unwanted:" rows above).
            |
            |Read more here:
            |https://www.antiphishing.org/ — for phishing warnings
            |https://www.stopbadware.org/ — for malware warnings
            |https://www.google.com/about/company/unwanted-software-policy.html
            |                           — for unwanted software warnings
            |
            |This advisory was provided by Google.
            |See: https://code.google.com/apis/safebrowsing/safebrowsing_faq.html#whyAdvisory
            |
            |Google works to provide the most accurate and up-to-date phishing, malware,
            |and unwanted software information. However, Google cannot guarantee that
            |its information is comprehensive and error-free: some risky sites
            |may not be identified, and some safe sites may be identified in error.
            |
            |""")
        case weird =>
          p.Logger.warn(s"Google Safe Browsing API replied with an unexpected status code: $weird")
          None
          */
      }}
      catch {
        case ex: Exception =>
          p.Logger.warn(s"$whichTask: Error handling Google Safe Browsing API response [TyE5KMRD025]", ex)
          SpamCheckResult.Error(GoogleSafeBrowsingApiDomain)
      }
    })
      .recover({
        case ex: Exception =>
          p.Logger.warn(s"$whichTask: Error querying Google Safe Browsing API [TyE4DRRETV20]", ex)
          SpamCheckResult.Error(GoogleSafeBrowsingApiDomain)
      }))
  }


  def checkDomainBlockLists(spamCheckTask: SpamCheckTask, textAndHtml: TextAndHtml)
        : Vector[Future[SpamCheckResult]] = {
    /* WHY
    scala> java.net.InetAddress.getAllByName("dbltest.com.dbl.spamhaus.org");  <-- fails the frist time
    java.net.UnknownHostException: dbltest.com.dbl.spamhaus.org: unknown error

    scala> java.net.InetAddress.getAllByName("dbltest.com.dbl.spamhaus.org");   <-- then works
    res9: Array[java.net.InetAddress] = Array(dbltest.com.dbl.spamhaus.org/127.0.1.2)
    asked here:
    https://stackoverflow.com/questions/32983129/why-does-inetaddress-getallbyname-fail-once-then-succeed
    */

    // Consider this spam if there's any link with a raw ip address.
    textAndHtml.linkIpAddresses.headOption foreach { ipAddress =>
      return Vector(successful(SpamCheckResult.SpamFound(
        spamCheckerDomain = "localhost",
        humanReadableMessage =
          o"""You have typed a link with this raw IP address: $ipAddress.
          Please remove it; currently I am afraid that links with IP addresses tend
          to be spam. [TyE4PUM2]""")))
    }

    val domainsToCheck = textAndHtml.linkDomains // TODO: scrubDomains(textAndHtml.linkDomains)...
      // (Skip example.com, so can be used in e2e tests without the tests failing because of
      // "spam" detected here.)
      .filterNot(d => d.endsWith(".example.com") || d == "example.com")
    // ...unless removing hostnames and sub domains, the block list lookup might fail —
    // block lists tend to expect requests with sub domains stripped.
    // Read here; http://www.surbl.org/guidelines  about how to extract the base (registered)
    // domain from an uri.

    if (domainsToCheck.isEmpty) Vector.empty
    else {
      val spamhausFuture = queryDomainBlockList("dbl.spamhaus.org", "Spamhaus", domainsToCheck)
      val uriblFuture = queryDomainBlockList("multi.uribl.com", "uribl.com", domainsToCheck)
      Vector(spamhausFuture, uriblFuture)
    }
  }


  def queryDomainBlockList(blockListDomain: String, blockListName: String,
        domainsToCheck: Set[String]): Future[SpamCheckResult] = {
    // We ask the list if a domain is spam, by querying the DNS system: prefix the
    // suspect domain, reversed, to Spamhaus (e.g. 'dbl.spamhaus.org'), and if any ip
    // is returned, then the domain is in the block list.
    domainsToCheck foreach { domain =>
      val query = s"$domain.$blockListDomain"
      try {
        // COULD do this asynchronously instead, or use Scala's blocking { ... } ?
        val addresses = java.net.InetAddress.getAllByName(query)
        if (addresses.isEmpty) {
          // Weird, an exception should have been thrown? Whatever.
        }
        else if (addresses.length == 1 && addresses.head.getHostAddress == "127.0.0.1") {
          // The *DNS lookup* was blocked, so we don't know if the address is blocked or not.
          // At least uribl.com uses 127.0.0.1 to indicate that it blocked the lookup.
          // It blocks public DNS servers because of excessive queries. This happens if you
          // use Google's DNS servers (ip 8.8.8.8). Then anything.multi.uribl.com resolves
          // to 127.0.0.1 always.
          // For more details, see e.g.: http://uribl.com/refused.shtml
          // and this thread;
          //   http://vamsoft.com/forum/topic/205/surbl-uriblcom-blacklisting-almost-everything
        }
        else {
          return successful(SpamCheckResult.SpamFound(
            spamCheckerDomain = blockListDomain,
            humanReadableMessage = o"""$blockListName thinks links to this domain are spam:
             '$domain'. And you have typed a link to that domain. You could 1) remove the link,
             or 2) change it to plain text and insert spaces in the domain name — then
             it won't be a real link. [DwE5GKF2]
             """))
        }
      }
      catch {
        case ex: UnknownHostException =>
        // Fine, not in the block list.
      }
    }
    successful(SpamCheckResult.NoSpam(blockListDomain))
  }


  def checkViaAkismet(requestBody: String): Option[Future[SpamCheckResult]] = {
    val promise = Promise[(Boolean, Boolean)]()  // (is-spam?, Akismet-is-certain?)
    akismetKeyIsValidPromise.future onComplete {
      case Success(true) =>
        sendAkismetCheckSpamRequest(apiKey = anyAkismetKey.get, payload = requestBody, promise)
      case _ =>
        // Cannot do spam check — API key broken / missing.
        return None
    }
    Some(promise.future.map({ case (isSpam, akismetIsCertain) =>
      if (!isSpam)
        SpamCheckResult.NoSpam(AkismetDomain)
      else
        SpamCheckResult.SpamFound(
          spamCheckerDomain = AkismetDomain,
          isCertain = akismetIsCertain,
          staffMayUnhide = !akismetIsCertain,
          humanReadableMessage = s"Akismet thinks this is spam. Is certain: $akismetIsCertain")
    })
    .recover({
      case ex: Exception =>
        p.Logger.warn(s"Error querying $AkismetDomain [TyE8KWBG2], requestBody:\n$requestBody", ex)
        SpamCheckResult.Error(AkismetDomain)
    }))
  }


  val AkismetDomain = "akismet.com"


  private def sendAkismetRequest(apiKey: String, what: String, payload: String): Future[WSResponse] = {
    val request: WSRequest =
      wsClient.url(s"https://$apiKey.rest.$AkismetDomain/1.1/$what").withHttpHeaders(
        play.api.http.HeaderNames.CONTENT_TYPE -> ContentType,
        play.api.http.HeaderNames.USER_AGENT -> UserAgent,
        play.api.http.HeaderNames.CONTENT_LENGTH -> payload.length.toString)
        .withRequestTimeout(7.seconds)
    request.post(payload)
  }


  private def sendAkismetCheckSpamRequest(apiKey: String, payload: String,
        promise: Promise[(Boolean, Boolean)]) {
    p.Logger.debug("Sending Akismet spam check request...")  // replace with tracing instead [TRACING]
    sendAkismetRequest(apiKey, what = "comment-check", payload = payload).map({ response: WSResponse =>
      val body = response.body
      body.trim match {
        case "true" =>
          val proTip = response.header("X-akismet-pro-tip")
          val akismetIsCertain = proTip is "discard"
          SECURITY // COULD remember ip and email, check manually? block?
          p.Logger.debug(s"Akismet found spam: $payload, is totally certain: $akismetIsCertain")
          promise.success((true, akismetIsCertain))
        case "false" =>
          p.Logger.debug(s"Akismet says not spam: $payload")
          promise.success((false, false))
        case badResponse =>
          val debugHelp = response.header("X-akismet-debug-help")
          p.Logger.error(o"""Akismet error: Weird spam check response: '$badResponse',
               debug help: $debugHelp""")
          promise.failure(BadSpamCheckResponseException)
      }
    })
    .recover({
      case ex: Exception =>
        p.Logger.warn(s"Error querying $AkismetDomain [TyE2AKBP0], payload:\n$payload", ex)
        promise.failure(ex)
    })
  }


  private def makeAkismetRequestBody(spamCheckTask: SpamCheckTask): Option[String] = {
    val akismetContentType =
      spamCheckTask.postToSpamCheck match {
        case None => AkismetSpamType.Signup
        case Some(postToSpamCheck) =>
          val pageType = postToSpamCheck.pageType
          if (pageType.isPrivateGroupTalk) AkismetSpamType.Message
          else if (PageParts.isArticleOrTitlePostNr(postToSpamCheck.postNr)) {
            if (pageType == PageType.Blog) AkismetSpamType.BlogPost
            else AkismetSpamType.ForumPost
          }
          else if (pageType == PageType.EmbeddedComments) AkismetSpamType.Comment
          else if (pageType == PageType.Form) AkismetSpamType.ContactForm
          else AkismetSpamType.Reply
      }

    val body = new StringBuilder()
    val siteOrigin = originOfSiteId(spamCheckTask.siteId) getOrElse {
      p.Logger.warn(s"Cannot do spam check, site ${spamCheckTask.siteId} not found [Ty6MBR25]")
      return None
    }

    // Documentation: https://akismet.com/development/api/#comment-check
    // Akismet want all fields to be the same, later when reporting classification mistakes, [AKISMET]
    // as when constructing the initial comment-check request.

    // (required) The front page or home URL of the instance making the request.
    // For a blog or wiki this would be the front page. Note: Must be
    // a full URI, including http://.
    body.append("blog=" + encode(siteOrigin))

    // (required) IP address of the comment submitter.
    body.append("&user_ip=" + encode(spamCheckTask.who.ip))

    // (required) User agent string of the web browser submitting the comment - typically
    // the HTTP_USER_AGENT cgi variable. Not to be confused with the user agent
    // of your Akismet library.
    val browserUserAgent = spamCheckTask.requestStuff.userAgent getOrElse "Unknown"
    body.append("&user_agent=" + encode(browserUserAgent))

    // The content of the HTTP_REFERER header should be sent here.
    spamCheckTask.requestStuff.referer foreach { referer =>
      // Should be 2 'r' in "referrer" below,
      // see: https://akismet.com/development/api/#comment-check
      body.append("&referrer=" + encode(referer))
    }

    // The permanent location of the entry the comment was submitted to.
    spamCheckTask.postToSpamCheck foreach { postToCheck =>
      body.append("&permalink=" + encode(s"$siteOrigin/-${postToCheck.pageId}"))
    }

    // May be blank, comment, trackback, pingback, or a made up value like "registration".
    // It's important to send an appropriate value, and this is further explained here.
    body.append("&comment_type=" + akismetContentType)

    val anyTextToCheck = spamCheckTask.postToSpamCheck.map(_.htmlToSpamCheck)

    // Name submitted with the comment.
    val authorName =
      if (anyTextToCheck.exists(_ contains AlwaysSpamMagicText)) {
        Some(AkismetAlwaysSpamName)
      }
      else {
        spamCheckTask.requestStuff.userName
      }

    authorName foreach { theName =>
      body.append("&comment_author=" + encode(theName))
    }

    // Email address submitted with the comment.
    spamCheckTask.requestStuff.userEmail foreach { theEmail =>
      body.append("&comment_author_email=" + encode(theEmail)) // COULD email inclusion configurable
    }

    // URL submitted with comment.
    //comment_author_url (not supported)

    // The content that was submitted.
    anyTextToCheck foreach { t =>
      if (t.nonEmpty)
        body.append("&comment_content=" + encode(t))  // COULD: htmlLinksOnePerLine [4KTF0WCR]
    }

    // The UTC timestamp of the creation of the comment, in ISO 8601 format. May be
    // omitted if the comment is sent to the API at the time it is created.
    //comment_date_gmt (omitted)

    // The UTC timestamp of the publication time for the post, page or thread
    // on which the comment was posted.
    //comment_post_modified_gmt  -- COULD include, need to load page

    // Indicates the language(s) in use on the blog or site, in ISO 639-1 format,
    // comma-separated. A site with articles in English and French might use "en, fr_ca".
    //blog_lang

    // The character encoding for the form values included in comment_* parameters,
    // such as "UTF-8" or "ISO-8859-1".
    body.append("&blog_charset=UTF-8")

    // The user role of the user who submitted the comment. This is an optional parameter.
    // If you set it to "administrator", Akismet will always return false.
    //user_role

    // Optional. If submitting test queries to Akismet.
    val isTest = isDevTest || siteOrigin.contains("://" + Hostname.E2eTestPrefix)
    if (isTest) {
      body.append("&is_test=true")
    }

    Some(body.toString())
  }


  /** Returns (num false positives, num false negatives) reported.
    *
    * (A false positive = a spam check service incorrectly classified sth as spam.)
    */
  def reportClassificationMistake(spamCheckTask: SpamCheckTask): Future[(Int, Int)] = {
    val promise = Promise[(Int, Int)]()
    val origin = originOfSiteId(spamCheckTask.siteId) getOrElse {
      promise.success((0, 0))
      return promise.future
    }

    val humanSaysIsSpam = spamCheckTask.humanSaysIsSpam getOrDie "TyE205MKAS2"
    val resultJson = spamCheckTask.resultsJson getOrDie "TyE306SK2"

    val akismetResultJson = (resultJson \ AkismetDomain).asOpt[JsObject]
    val akismetSaysIsSpam: Option[Boolean] = akismetResultJson map { json =>
      (json \ "isSpam").asOpt[Boolean] getOrElse {  // written here [02MRHL2]
        p.Logger.warn("isSpam field missing [TyE58MK3RT2]")
        promise.success((0, 0))
        return promise.future
      }
    }

    val siteId = spamCheckTask.siteId
    val postId = spamCheckTask.postToSpamCheck.map(_.postId) getOrElse NoPostId

    if (akismetResultJson.isEmpty || akismetSaysIsSpam.is(humanSaysIsSpam)) {
      // We didn't use Akismet, or the human reviewer agrees with Akismet's result.
      // Meaning, a spam check service other than Akismet misclassified this — and
      // it doesn't accept feedback about mistakes (only Akismet does). Nothing to do.
      promise.success((0, 0))
    }
    else {
      // Akismet misclassified this. Now call API endpoints:
      // - https://your-api-key.rest.akismet.com/1.1/submit-spam
      // - https://your-api-key.rest.akismet.com/1.1/submit-ham
      // Find the docs here:
      // - https://akismet.com/development/api/#submit-spam
      // - https://akismet.com/development/api/#submit-ham
      akismetKeyIsValidPromise.future onComplete {
        case Success(true) =>
          val doWhat = spamCheckTask.humanSaysIsSpam.is(true) ? "submit-spam" | "submit-ham"
          makeAkismetRequestBody(spamCheckTask) match {
            case None =>
              // Weird. Couldn't construct request. Warning logged already.
              promise.success((0, 0))
            case Some(requestBody) =>
              p.Logger.debug(s"Sending Akismet correction to: $doWhat")  // replace w tracing [TRACING]
              sendAkismetRequest(anyAkismetKey.get, what = doWhat, payload = requestBody).map({
                    response: WSResponse =>
                val responseBody = response.body
                if (response.status == 200) {
                  if (responseBody != "Thanks for making the web a better place.") {
                    p.Logger.warn(s"Unexpected Akismet response: $responseBody [TyE702M5BZW]")
                  }
                  p.Logger.debug(s"s$siteId: Reported $doWhat to Akismet, post id $postId [TyM602MBWT]")
                  promise.success(
                    // Return (a, b) where a = num false positives, i.e. Akismet thought
                    // "It's spam", when it wasn't, and b = num false negatives.
                    akismetSaysIsSpam.is(true) ? (1, 0) | (0, 1))
                }
                else {
                  p.Logger.warn("Non-200 response from Akismet to misclassification request [TyE5M70J2],"
                    + s"\nstatus: ${response.status}"
                    + s"\nrequest body:\n$requestBody"
                    + s"\nresponse body:\n$responseBody")
                  promise.success((0, 0))
                }
              })
                .recover({
                  case ex: Exception =>
                    p.Logger.warn("Error sending misclassification request to Akismet [TyE702MR84TD], " +
                      s"requestBody:\n$requestBody", ex)
                    promise.success((0, 0))
                })
          }
        case _ =>
          // No Akismet API key, but still we have a result from Akismet. Could be that the
          // key just expired? In between the comment-check and the submit-spam/ham requests.
          // We have logged any [API key is invalid] log message already.
          promise.success((0, 0))
      }
    }

    promise.future
  }

}


object SpamChecker {

  def throwForbiddenIfSpam(spamCheckResults: SpamCheckResults, errorCode: String) {
    val spamFoundResults = spamCheckResults.collect { case r: SpamCheckResult.SpamFound => r }
    if (spamFoundResults.isEmpty)
      return

    throwForbidden(errorCode,
      "Sorry, our spam detection system thinks this is spam. Details:\n\n" +
        spamFoundResults.map(r => i"""
          |${r.spamCheckerDomain}:
          |
          |${r.humanReadableMessage}
          |""").mkString("\n\n------------------\n") + "\n\n")
  }

  def shallCheckSpamFor(userAndLevels: UserAndLevels): Boolean = {
    shallCheckSpamFor(userAndLevels.user)
  }

  SECURITY; COULD // always check links with Google Safe Browsing API, also for staff?
  def shallCheckSpamFor(participant: Participant): Boolean = {
    if (participant.isStaff) return false
    val hasHighTrustLevel = participant.effectiveTrustLevel.toInt >= TrustLevel.TrustedMember.toInt
    val isGuestOrThreat = participant match {
      case m: User => m.effectiveThreatLevel.toInt >= ThreatLevel.MildThreat.toInt
      case _: Guest => true
      case _: Group => false
    }
    isGuestOrThreat || !hasHighTrustLevel
  }
}

