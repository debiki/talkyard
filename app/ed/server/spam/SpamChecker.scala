/**
 * Copyright (C) 2015-2016 Kaj Magnus Lindberg
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
import debiki.TextAndHtml
import debiki.DebikiHttp.throwForbidden
import io.efdi.server.http.DebikiRequest
import java.{net => jn}
import java.net.UnknownHostException
import play.{api => p}
import play.api.Play.current
import play.api.libs.ws._
import play.api.libs.json.Json
import scala.concurrent.ExecutionContext.Implicits.global
import scala.concurrent.{Future, Promise}
import scala.concurrent.Future.successful
import scala.util.{Success, Failure}



sealed abstract class SpamCheckResult { def isSpam: Boolean }
object SpamCheckResult {
  case object IsSpam extends SpamCheckResult { def isSpam = true }
  case object NotSpam extends SpamCheckResult { def isSpam = false }
}


object ApiKeyInvalidException extends QuickException
object CouldNotVerifyApiKeyException extends QuickException
object BadSpamCheckResponseException extends QuickException
object NoApiKeyException extends QuickException



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
class SpamChecker {

  /*
  val request: dispatch.Req = dispatch.url("http://api.hostip.info/country.php").GET
  ... http://ipinfo.io/developers
  */

  private val TimeoutMs = 5000
  private val UserAgent = "Debiki/0.00.00 | Built-In/0.00.00"
  private val ContentType = "application/x-www-form-urlencoded"

  private val akismetKeyIsValidPromise: Promise[Boolean] = Promise()

  private def encode(text: String) = jn.URLEncoder.encode(text, "UTF-8")

  // One key only, for now. Later on, one per site? + 1 global for non-commercial
  // low traffic newly created sites? + 1 global for commercial low traffic sites?
  // (and one per site for high traffic sites)
  private val anyAkismetKey: Option[String] =
    p.Play.configuration.getString("ed.akismetApiKey").noneIfBlank

  val AkismetAlwaysSpamName = "viagra-test-123"

  // Type the text '--viagra-test-123--' in a comment or title and it should be reported as
  // spam, always.
  val AlwaysSpamMagicText = "--viagra-test-123--"

  // Break up the string so if someone copy-pastes this code snippet into ED,
  // it won't be reported as spam.
  val EdSpamMagicText = "__ed_spam" + "_test_123__"

  // All types: http://blog.akismet.com/2012/06/19/pro-tip-tell-us-your-comment_type/
  object AkismetSpamType {
    val Comment = "comment"
    val Pingback = "pingback"
    val Trackback = "trackback"
    val ForumPost = "forum-post" // forum posts and replies
    val BlogPost = "blog-post"
    val ContactForm = "contact-form" // contact forms, inquiry forms and the like
    val Signup = "signup" // account signup, registration or activation
    val Tweet = "tweet" // twitter messages
  }

  val GoogleApiKeyName = "ed.security.googleApiKey"
  val anyGoogleApiKey = p.Play.configuration.getString(GoogleApiKeyName)


  def start() {
    verifyAkismetApiKey()
  }


  private def verifyAkismetApiKey() {
    if (anyAkismetKey.isEmpty) {
      akismetKeyIsValidPromise.failure(NoApiKeyException)
      return
    }

    // apparently port number not okay, -> invalid, and http://localhost -> invalid, too.
    val postData = "key=" + encode(anyAkismetKey.get) +
      "&blog=" + encode("http://localhost")

    // Without (some of) these headers, Akismet says the api key is invalid.
    val request: WSRequest =
      WS.url("https://rest.akismet.com/1.1/verify-key").withHeaders(
        play.api.http.HeaderNames.CONTENT_TYPE -> ContentType,
        play.api.http.HeaderNames.USER_AGENT -> UserAgent,
        play.api.http.HeaderNames.CONTENT_LENGTH -> postData.length.toString)

    request.post(postData) map { response: WSResponse =>
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
    }
  }


  def detectRegistrationSpam(request: DebikiRequest[_], name: String, email: String)
        : Future[Option[String]] = {

    val spamTestFutures =
      if (name contains EdSpamMagicText) {
        Seq(Future.successful(Some(
          s"Name contains test spam text: '$EdSpamMagicText' [EdM5KSWU7]")))
      }
      else if (email contains EdSpamMagicText) {
        Seq(Future.successful(Some(
          s"Email contains test spam text: '$EdSpamMagicText' [EdM5KSWU7]")))
      }
      else {
        val stopForumSpamFuture = checkViaStopForumSpam(request, name, email)

        val akismetBody = makeAkismetRequestBody(AkismetSpamType.Signup, request.spamRelatedStuff,
          user = None, anyName = Some(name), anyEmail = Some(email))
        val akismetFuture = checkViaAkismet(akismetBody)

        Seq(stopForumSpamFuture, akismetFuture)
      }

    // Some dupl code (5HK0XC4W2)
    Future.sequence(spamTestFutures) map { results: Seq[Option[String]] =>
      val spamResults: Seq[String] = results.filter(_.isDefined).map(_.get)
      SHOULD // insert into audit log (or some spam log?), gather stats, auto block.
      if (spamResults.nonEmpty) {
        p.Logger.info(i"""Registration spam detected: [EdM4FK0W2]
            | - client ip: ${request.ip}
            | - user/guest name: $name
            | - user email: $email
            | - request uri: ${request.uri}
            | - site: ${request.siteId} == ${request.domain}
            |""")
        spamResults foreach { spamReason =>
          p.Logger.info(s"Spam reason [EdM5GKP0R]: $spamReason")
        }
      }
      spamResults.headOption
    }
  }


  def detectPostSpam(spamCheckTask: SpamCheckTask, stuffToSpamCheck: StuffToSpamCheck)
        : Future[Option[String]] = {

    val post = stuffToSpamCheck.getPost(spamCheckTask.sitePostId) getOrElse {
      // Apparently the post was hard deleted?
      return Future.successful(None)
    }

    val user = stuffToSpamCheck.getUser(spamCheckTask.siteUserId) getOrElse {
      // There's a foreign key + not-null constraint, so this is weird.
      p.Logger.warn(s"User ${spamCheckTask.siteUserId} not found, skipping spam check [EdE3FK6YG1]")
      return Future.successful(None)
    }

    val textAndHtml = TextAndHtml(post.currentSource, isTitle = false)

    val spamTestFutures =
      if (textAndHtml.text contains EdSpamMagicText) {
        Seq(Future.successful(Some(
          s"Text contains test spam text: '$EdSpamMagicText' [EdM4DKF03]")))
      }
      else {
        val urlsAndDomainsFutures = checkUrlsAndDomains(textAndHtml)
        // COULD postpone the Akismet check until after the domain check has been done? [5KGUF2]
        // So won't have to pay for Akismet requests, if the site is commercial.
        // Currently the Spamhaus test happens synchronously already though.

        // Don't send the whole text, because of privacy issues. Send the links only. [4KTF0WCR]
        // Or yes do that?  dupl question [7KECW2]
        val userIsABitTrusted = user.isStaff
        val akismetFuture =
          if (userIsABitTrusted) Future.successful(None)
          else {
            val payload = makeAkismetRequestBody(AkismetSpamType.ForumPost,
              spamCheckTask.requestStuff,
              text = Some(textAndHtml.safeHtml), // COULD: htmlLinksOnePerLine [4KTF0WCR]
              user = Some(user))
            checkViaAkismet(payload)
          }

        urlsAndDomainsFutures :+ akismetFuture
      }

    // Some dupl code (5HK0XC4W2)
    Future.sequence(spamTestFutures) map { results: Seq[Option[String]] =>
      val spamResults: Seq[String] = results.filter(_.isDefined).map(_.get)
      SHOULD // insert into audit log (or some spam log?), gather stats, auto block.
      if (spamResults.nonEmpty) {
        p.Logger.info(i"""Text spam detected [EdM8YKF0]:
            | - client ip: ${spamCheckTask.who.ip}
            | - user/guest name: ${user.usernameOrGuestName}
            | - user email: ${user.email}
            | - user id: ${user.id}
            | - request uri: ${spamCheckTask.requestStuff.uri}
            | - siteId: ${spamCheckTask.siteId}
            |--- text: ---------------------------------------------------------
            |${textAndHtml.text}
            |--- /end text -----------------------------------------------------""")
        spamResults foreach { spamReason =>
          p.Logger.info(s"Spam reason [EdM2KPF8]: $spamReason")
        }
      }
      spamResults.headOption
    }
  }


  def checkViaStopForumSpam(request: DebikiRequest[_], name: String, email: String)
        : Future[Option[String]] = {
    // StopForumSpam doesn't support ipv6.
    // See: https://www.stopforumspam.com/forum/viewtopic.php?id=6392
    val anyIpParam =
      if (request.ip.startsWith("[") || request.ip.contains(":")) ""
      else  "&ip=" + encode(request.ip)
    val encodedEmail = encode(email)
    // StopForumSpam has a self signed https cert, and Java then dies with a
    // java.security.cert.CertificateException. So use http for now — later, add the self
    // signed cert to the Java cert store?
    // See: https://www.playframework.com/documentation/2.4.x/WSQuickStart
    // Or just wait for a while:
    //   "I've got the .com and .org certs now and will get them plumbed in shortly."
    // (the forum thread above, June 2015)
    // Hmm supposedly already https:
    //  "it took some time but the site, including the API, is now available with fully signed SSL"
    //   http://www.stopforumspam.com/forum/viewtopic.php?id=6345
    // a few days ago. I'm still getting a cert error though. Works in Chrome, not Java,
    // I suppose Java's cert store is old and out of date somehow?
    // Use http for now:
    WS.url(s"http://www.stopforumspam.com/api?email=$encodedEmail$anyIpParam&f=json").get()
      .map(handleStopForumSpamResponse)
      .recover({
        case ex: Exception =>
          p.Logger.warn(s"Error querying api.stopforumspam.org [DwE2PWC7]", ex)
          None
      })
  }


  def handleStopForumSpamResponse(response: WSResponse): Option[String] = {
    // Ask: https://api.stopforumspam.org/api?ip=91.186.18.61&email=g2fsehis5e@mail.ru&f=json
    // Response:
    //    {"success":1,"email":{"frequency":0,"appears":0},"ip":{"frequency":0,"appears":0}}

    def prettyJson = s"\n--------\n${response.body}\n--------"
    val json =
      try Json.parse(response.body)
      catch {
        case ex: Exception =>
          p.Logger.warn(s"Bad JSON from api.stopforumspam.org: $prettyJson", ex)
          return None
      }

    if ((json \ "success").asOpt[Int] != Some(1)) {
      p.Logger.warn(s"api.stopforumspam.org returned success != 1: $prettyJson")
      return None
    }

    val ipJson = json \ "ip"
    (ipJson \ "frequency").asOpt[Int] match {
      case None =>
        p.Logger.warn(s"api.stopforumspam.org didn't send back any ip.frequency: $prettyJson")
      case Some(frequency) =>
        if (frequency >= 1)
          return Some(o"""Stop Forum Spam thinks a spammer lives at your ip address
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
          return Some(o"""Stop Forum Spam thinks the person with that email address is a spammer
              (frequency = $frequency). Do you want to try with a different address? [DwE5KGP2]""")
    }

    None
  }


  def checkUrlsAndDomains(textAndHtml: TextAndHtml): Seq[Future[Option[String]]] =
    checkUrlsViaGoogleSafeBrowsingApi(textAndHtml) +:
      checkDomainBlockLists(textAndHtml)


  def checkUrlsViaGoogleSafeBrowsingApi(textAndHtml: TextAndHtml): Future[Option[String]] = {
    // API: https://developers.google.com/safe-browsing/lookup_guide#HTTPPOSTRequest
    val apiKey = anyGoogleApiKey getOrElse {
      return Future.successful(None)
    }

    // ".*" tells the url validator to consider all domains valid, even if it doesn't
    // recognize the top level domain.
    import org.apache.commons.validator.routines.{UrlValidator, RegexValidator}
    val urlValidator = new UrlValidator(new RegexValidator(".*"), UrlValidator.ALLOW_2_SLASHES)
    val validUrls = textAndHtml.links.filter(urlValidator.isValid)
    if (validUrls.isEmpty)
      return Future.successful(None)

    val SafeBrowsingApiEndpoint = "https://sb-ssl.google.com/safebrowsing/api/lookup"
    val clientName = "EffectiveDiscussions"
    val protocolVersion = "3.1"
    val applicationVersion = debiki.Globals.applicationVersion // COULD use version in build.sbt?

    val requestBody = validUrls.length + "\n" + validUrls.mkString("\n")
    val url = SafeBrowsingApiEndpoint +
      s"?client=$clientName" +
      s"&key=$apiKey" +
      s"&appver=$applicationVersion" +
      s"&pver=$protocolVersion"

    val NoEvilUrlsStatusCode = 204
    val AtLeastOneEvilUrlStatusCode = 200
    val SafeUrlVerdict = "ok"

    val request: WSRequest =
      WS.url(url).withHeaders(
        play.api.http.HeaderNames.CONTENT_LENGTH -> requestBody.length.toString)

    request.post(requestBody) map { response: WSResponse =>
      response.status match {
        case NoEvilUrlsStatusCode =>
          None
        case 400 =>
          p.Logger.warn("I sent a malformed Google Safe Browsing API request")
          None
        case 401 =>
          p.Logger.warn(o"""Google Safe Browsing API key is not authorized, i.e. the key in
              this config value is invalid: $GoogleApiKeyName""")
          None
        case 503 =>
          // Google is broken, *or* we're sending too many requests and are being throttled.
          // I think a userIp url param can be included and then Google will throttle per
          // browser ip. But we already do per ip rate limiting.
          p.Logger.warn("Google Safe Browsing API is broken or throttles us")
          None
        case AtLeastOneEvilUrlStatusCode =>
          val urlsAndVerdicts: Seq[(String, String)] =
            validUrls.zip(response.body.split("\n").toSeq)
          val evilUrlsAndVerdics = urlsAndVerdicts filter { linkAndResult =>
            linkAndResult._2 != SafeUrlVerdict
          }
          // Google says we shall include the "read more" and "provided by Google"
          // and "perhaps all this is wrong" texts below, see:
          // https://developers.google.com/safe-browsing/lookup_guide#AcceptableUsage
          // However, we're sending this message back to the person who *posted*
          // the evil urls — and s/he likely knows already what s/he is doing?
          // Still, a friendly message makes sense, because in some rare cases a good
          // site might have been compromised and the link poster has good intentions.
          val prettyEvilStuff = evilUrlsAndVerdics.map(urlAndVerdict => {
            // This results in e.g.:  "malware: http://evil.kingdom/malware"
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
            |http://www.antiphishing.org/ — for phishing warnings
            |http://www.stopbadware.org/ — for malware warnings
            |https://www.google.com/about/company/unwanted-software-policy.html
            |                           — for unwanted software warnings
            |
            |This advisory was provided by Google.
            |See: http://code.google.com/apis/safebrowsing/safebrowsing_faq.html#whyAdvisory
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
      }
    }
  }


  def checkDomainBlockLists(textAndHtml: TextAndHtml): Seq[Future[Option[String]]] = {
    /* WHY
    scala> java.net.InetAddress.getAllByName("dbltest.com.dbl.spamhaus.org");  <-- fails the frist time
    java.net.UnknownHostException: dbltest.com.dbl.spamhaus.org: unknown error

    scala> java.net.InetAddress.getAllByName("dbltest.com.dbl.spamhaus.org");   <-- then works
    res9: Array[java.net.InetAddress] = Array(dbltest.com.dbl.spamhaus.org/127.0.1.2)
    asked here:
    http://stackoverflow.com/questions/32983129/why-does-inetaddress-getallbyname-fail-once-then-succeed
    */

    // Consider this spam if there's any link with a raw ip address.
    textAndHtml.linkAddresses.headOption foreach { address =>
      return Seq(successful(Some(o"""You have typed a link with this raw IP number: $address.
          Please remove it; currently I am afraid that links with IP numbers tend
          to be spam. [DwE4PUM2]""")))
    }

    val domainsToCheck = textAndHtml.linkDomains // TODO: scrubDomains(textAndHtml.linkDomains)...
    // ...unless removing hostnames and sub domains, the block list lookup might fail —
    // block lists tend to expect requests with sub domains stripped.
    // Read here; http://www.surbl.org/guidelines  about how to extract the base (registered)
    // domain from an uri.

    val spamhausFuture = queryDomainBlockList("dbl.spamhaus.org", "Spamhaus", domainsToCheck)
    val uriblFuture = queryDomainBlockList("multi.uribl.com", "uribl.com", domainsToCheck)
    Seq(spamhausFuture, uriblFuture)
  }


  def queryDomainBlockList(blockListDomain: String, blockListName: String,
        domainsToCheck: Set[String]): Future[Option[String]] = {
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
          return successful(Some(o"""$blockListName thinks links to this domain are spam:
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
    successful(None)
  }


  def checkViaAkismet(requestBody: String): Future[Option[String]] = {
    return successful(None)
    val promise = Promise[Boolean]()
    akismetKeyIsValidPromise.future onComplete {
      case Success(true) =>
        sendCheckIsSpamRequest(apiKey = anyAkismetKey.get, payload = requestBody, promise)
      /*
      case Success(false) =>
        promise.failure(ApiKeyInvalidException) ? Or just ignore the spam check, for now
      */
      case _ =>
        // Skip the spam check. We've logged an error already about the invalid key.
        promise.success(false)
    }
    promise.future map { isSpam =>
      if (isSpam) Some("Akismet thinks this is spam [DwE7JUK2]")
      else None
    }
  }


  private def sendCheckIsSpamRequest(apiKey: String, payload: String, promise: Promise[Boolean]) {
    val request: WSRequest =
      WS.url(s"https://$apiKey.rest.akismet.com/1.1/comment-check").withHeaders(
        play.api.http.HeaderNames.CONTENT_TYPE -> ContentType,
        play.api.http.HeaderNames.USER_AGENT -> UserAgent,
        play.api.http.HeaderNames.CONTENT_LENGTH -> payload.length.toString)

    request.post(payload) map { response: WSResponse =>
      val body = response.body
      body.trim match {
        case "true" =>
          SECURITY // COULD remember ip and email, check manually? block?
          p.Logger.debug(s"Akismet found spam: $payload")
          promise.success(true)
        case "false" =>
          p.Logger.debug(s"Akismet says not spam: $payload")
          promise.success(false)
        case badResponse =>
          val debugHelp = response.header("X-akismet-debug-help")
          p.Logger.error(o"""Akismet error: Weird spam check response: '$badResponse',
               debug help: $debugHelp""")
          promise.failure(BadSpamCheckResponseException)
      }
    }
  }


  private def makeAkismetRequestBody(tyype: String, spamRelatedStuff: SpamRelReqStuff,
      pageId: Option[PageId] = None, text: Option[String] = None, user: Option[User],
      anyName: Option[String] = None, anyEmail: Option[String] = None): String = {

    // Either 1) the user is known, or 2) we're creating a new site or user — then
    // only name & email known.
    dieIf(anyEmail.isDefined != anyName.isDefined, "EdE6GTB20")
    dieIf(anyEmail.isDefined == user.isDefined, "EdE2PW2U4")
    def theUser = user getOrDie "EdE5PDRA"

    if (anyAkismetKey.isEmpty)
      return "No Akismet API key configured [DwM4GLU8]"

    val body = new StringBuilder()

    // Documentation: http://akismet.com/development/api/#comment-check

    // (required) The front page or home URL of the instance making the request.
    // For a blog or wiki this would be the front page. Note: Must be
    // a full URI, including http://.
    body.append("blog=" + encode("http://localhost")) // debikiRequest.origin))

    // (required) IP address of the comment submitter.
    body.append("&user_ip=" + encode("1.22.26.83"))//debikiRequest.ip))

    // (required) User agent string of the web browser submitting the comment - typically
    // the HTTP_USER_AGENT cgi variable. Not to be confused with the user agent
    // of your Akismet library.
    val browserUserAgent = spamRelatedStuff.userAgent getOrElse "Unknown"
    body.append("&user_agent=" + encode(browserUserAgent))

    // The content of the HTTP_REFERER header should be sent here.
    spamRelatedStuff.referer foreach { referer =>
      // Should be 2 'r' in "referrer" below,
      // see: https://akismet.com/development/api/#comment-check
      body.append("&referrer=" + encode(referer))
    }

    /*
    // The permanent location of the entry the comment was submitted to.
    pageId foreach { id =>
      body.append("&permalink=" + encode(request.origin + "/-" + id))
    } */

    // May be blank, comment, trackback, pingback, or a made up value like "registration".
    // It's important to send an appropriate value, and this is further explained here.
    body.append("&comment_type=" + tyype)

    // Name submitted with the comment.
    val theName =
      if (text.exists(_ contains AlwaysSpamMagicText)) {
        AkismetAlwaysSpamName
      }
      else anyName getOrElse {
        // Check both the username and the full name, by combining them.
        theUser.anyUsername.map(_ + " ").getOrElse("") + theUser.anyName
      }
    body.append("&comment_author=" + encode(theName))

    // Email address submitted with the comment.
    val theEmail = anyEmail getOrElse theUser.email
    body.append("&comment_author_email=" + encode(theEmail)) // TODO email inclusion configurable

    // The content that was submitted.
    text foreach { t =>
      if (t.nonEmpty)
        body.append("&comment_content=" + encode(t))
    }

    // URL submitted with comment.
    //comment_author_url (not supported)

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

    // This is an optional parameter. You can use it when submitting test queries to Akismet.
    body.append("&is_test" + true) // for now, later:  (if (p.Play.isProd) false else true))

    body.toString()
  }
}


object SpamChecker {

  def throwForbiddenIfSpam(isSpamReason: Option[String], errorCode: String) {
    isSpamReason foreach { reason =>
      throwForbidden(
        errorCode, "Sorry but our spam detection system thinks this is spam. Details: " + reason)
    }
  }

}

