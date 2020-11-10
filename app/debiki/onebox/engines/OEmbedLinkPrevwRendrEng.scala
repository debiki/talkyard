/**
 * Copyright (c) 2020 Kaj Magnus Lindberg
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

package debiki.onebox.engines

import com.debiki.core._
import com.debiki.core.Prelude._
import debiki.Globals
import debiki.onebox._
import org.scalactic.{Bad, Good, Or}
import play.api.libs.json.JsObject
import play.api.libs.ws.WSRequest
import scala.concurrent.Future



/* Example oEmbed response json, this from Twitter:
  {
    "url": "https://twitter.com/Interior/status/507185938620219395",
    "author_name": "US Dept of Interior",
    "author_url": "https://twitter.com/Interior",
    "html": "<blockquote class="twitter-tweet"><p lang="en" dir="ltr">
         Happy 50th anniversary to the Wilderness Act! ...</blockquote>
         <script async src="//platform.twitter.com/widgets.js" charset="utf-8"></script>",
    "width": 550,
    "height": null,
    "type": "rich",
    "cache_age": "3153600000", <—— later: save in  link_previews_t.cache_max_secs_c
    "provider_name": "Twitter",
    "provider_url": "https://twitter.com",
    "version": "1.0"
  }
*/


/** Fetches oEmbed html, renders in a sandboxed iframe, or (later) inlines
  * the oEmbed html & scripts if the provider is trusted.
  *
  * Later, to do:
  *
  *   - Specify maxwidth based on device width?
  *     and the site's language?  oEmbed standard params.
  *
  *   - Add more well-known oEmbed providers.
  *
  *   - Unknown domain? E.g. https://unknown.org/a/link. Then, fetch linked page,
  *     - use any oEmbed api url tag,
  *     - use any OpenGraph tags,
  *     - use any html < title> and < description> tags
  *     (and then maybe rename this class, OEmbedLinkPrevwRendrEng,
  *     to sth else? or include it in a parent class with all that extra
  *     functionality)
  *
  *   - Safelist some providers that Talkyard considers okay safe
  *     — admins can let their html & script can run in Talkyard's pages.
  *     But by default, they're all sandboxed and/or sanitized.
  *
  *   - Let admins allowlist a subset of those safelisted providers,
  *     to let those providers' scripts run in Ty's pages.
  *
  *   - Let admins optionally allow *all* safelisted providers,
  *     combined with a blocklist, if there're a few providers the admins
  *     don't trust.
  *
  * Add oEmbed & OpenGraph support to Ty  [ty_oemb_og].
  *
  * Other oEmbed impls:
  * Discourse: https://meta.discourse.org/t/rich-link-previews-with-onebox/98088
  * Javascript: https://github.com/itteco/iframely
  * Java: https://github.com/michael-simons/java-oembed
  * Java: https://github.com/vnesek/nmote-oembed
  */
abstract class OEmbedLinkPrevwRendrEng(
      globals: Globals, siteId: SiteId, mayHttpFetch: Boolean)
  extends ExternalFetchLinkPrevwRendrEng(
        globals, siteId = siteId, mayHttpFetch = mayHttpFetch) {

  val extraLnPvCssClasses: String = "s_LnPv-oEmb " + providerLnPvCssClassName

  def providerName: Option[String]

  def widgetName: String

  def providerLnPvCssClassName: String

  def providerEndpoint: String

  // Later: Could adjust, based on device width.
  def queryParamsEndAmp = "maxwidth=600&"

  def moreQueryParamsEndAmp = ""

  override def sandboxInIframe = true


  def loadAndRender(params: RenderPreviewParams): Future[String Or LinkPreviewProblem] = {
    val unsafeUrl: String = params.unsafeUrl

    def provdrOrUnk = providerName getOrElse "oEmbed provider"  // I18N
    def providerWidget = s"$provdrOrUnk $widgetName"

    // This'll look like e.g. "Twitter tweet not found: ... url ...".  I18N
    def notFoundError = s"$providerWidget not found: "
    def networkError = s"Error getting a $providerWidget preview: Got no response, url: "
    def rateLimitedError = s"Rate limited by $provdrOrUnk, cannot show: "
    def weirdStatusError(x: Int) = s"Unexpected $provdrOrUnk http status code: $x, url: "
    def noHtmlInOEmbed = s"No html in $providerWidget API response, url: "


    // ----- Cached in database?

    val downloadUrl =
          s"$providerEndpoint?$queryParamsEndAmp${moreQueryParamsEndAmp}url=$unsafeUrl"

    params.loadPreviewFromDb(downloadUrl) foreach { cachedPreview =>
      SECURITY; SHOULD // rate limit each user, and each site, + max db table rows per site?
      // There's already:  RateLimits.FetchLinkPreview
      cachedPreview.statusCode match {
        case 200 => // ok
        case 404 =>
          return FutBad(LinkPreviewProblem(
                notFoundError, unsafeUrl = unsafeUrl, errorCode = "TyELNPV404"))
        case 429 =>
          return FutBad(LinkPreviewProblem(
                rateLimitedError, unsafeUrl = unsafeUrl, errorCode = "TyELNPV429"))
        case 0 =>
          // Currently won't happen, [ln_pv_netw_err].
          return FutBad(LinkPreviewProblem(
                networkError, unsafeUrl = unsafeUrl, errorCode = "TyELNPVNETW0"))
        case x =>
          return FutBad(LinkPreviewProblem(
                weirdStatusError(x), unsafeUrl = unsafeUrl, errorCode = "TyELNPVWUNK"))
      }

      val unsafeHtml = (cachedPreview.contentJson \ "html").asOpt[String] getOrElse {
        return FutBad(LinkPreviewProblem(
                  noHtmlInOEmbed, unsafeUrl = unsafeUrl, errorCode = "TyELNPV0HTML"))
      }

      return FutGood(unsafeHtml)
    }


    // ----- Remote fetch

    if (!params.mayHttpFetch) {
      // This can happen if one types and saves a new post really fast, before
      // preview data has been http-fetched? (so not yet found in cache above)
      return FutBad(LinkPreviewProblem(
            s"No preview for $providerWidget: ",
            unsafeUrl = unsafeUrl, errorCode = "TyE0LNPV"))
    }

    val request: WSRequest = globals.wsClient.url(downloadUrl)
    val futureResponse: Future[play.api.libs.ws.WSResponse] = request.get()


    // ----- Handle response

    futureResponse.map({ response: request.Response =>
      // These can be problems with the provider, rather than Talkyard? E.g. if
      // a Twitter tweet is gone, it's nice to see a "Tweet not found" message?
      var problem = response.status match {
        case 404 => notFoundError
        case 429 => rateLimitedError
        case 200 => "" // continue below
        case x => weirdStatusError(x)
      }

      // There has to be a max-json-length restriction. There's a db constraint:
      val dbJsonMaxLength = 27*1000 // [oEmb_json_len]
      if (problem.isEmpty && response.bodyAsBytes.length > (dbJsonMaxLength - 2000)) {
        problem = s"Too large $provdrOrUnk oEmbed response: ${
              response.bodyAsBytes.length} bytes json"
      }

      val unsafeJsObj: JsObject = if (problem.nonEmpty) JsObject(Nil) else {
        try {
          // What does response.json do if response not json? (harmless — there's try-catch)
          response.json match {
            case jo: JsObject => jo
            case _ =>
              problem = s"Got $provdrOrUnk json but it's not a json obj, request url: "
              JsObject(Nil)
          }
        }
        catch {
          case ex: Exception =>
            problem = s"$provdrOrUnk response not json, request url: "
            JsObject(Nil)
        }
      }

      val anyUnsafeHtml: Option[String] =
            if (problem.isEmpty) (unsafeJsObj \ "html").asOpt[String].trimNoneIfBlank
            else None

      if (problem.isEmpty && anyUnsafeHtml.isEmpty) {
        problem = noHtmlInOEmbed
      }

      val result: String Or LinkPreviewProblem = {
        if (problem.nonEmpty) {
          // Make the response.body visible to site/server admins? [admin_log]
          // But don't include in the reply — e.g. Reddit returned a 38k large
          // <html> doc, for a broken Reddit link — would waste space in Ty's
          // database, and 38k <htmL> as plain text could confuse people?
          // Log level Info, since probably not a problem with Ty but with the
          // link preview provider?
          logger.info(s"Link preview error: " + problem + s"\n$provdrOrUnk says: "
              + response.body)
          Bad(LinkPreviewProblem(unsafeProblem = problem,
                unsafeUrl = unsafeUrl, errorCode = "TyELNPVRSP"))
        }
        else {
          SECURITY; QUOTA // incl in quota? num preview links * X  [lnpv_quota]
          val preview = LinkPreview(
                linkUrl = unsafeUrl,
                fetchedFromUrl = downloadUrl,
                fetchedAt = globals.now(),
                // cache_max_secs_c — skip for now
                statusCode = response.status,
                previewType = LinkPreviewTypes.OEmbed,
                firstLinkedById = params.requesterId,
                contentJson = unsafeJsObj)
          params.savePreviewInDb(preview)

          Good(anyUnsafeHtml getOrDie "TyE6986SK")
        }
      }

      result

    })(globals.executionContext).recover({
      case ex: Exception =>
        // Maybe save with status code 0? But, better to just
        // cache in Redis for a short while?  [ln_pv_netw_err]
        logger.warn("Error creating oEmbed link preview [TyEOEMB897235]", ex)
        Bad(LinkPreviewProblem(
              ex.getMessage, unsafeUrl = unsafeUrl, errorCode = "TyE0EMBNETW"))
    })(globals.executionContext)
  }
}

