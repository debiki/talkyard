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

package debiki.onebox.engines   // RENAME to  talkyard.server.linkpreview

import com.debiki.core._
import com.debiki.core.Prelude._
import debiki.{Globals, TextAndHtml}
import debiki.onebox.{InstantLinkPrevwRendrEng, LinkPreviewProblem}
import org.scalactic.{Bad, Good, Or}
import scala.util.matching.Regex


// These oEmbed engines are sorted alphabetically, index:
//   - Facebook posts
//   - Facebook videos
//   - Instagram
//   - Reddit
//   - Telegram
//   - TikTok
//   - Twitter
//   - YouTube



// ====== Facebook posts


object FacebookPostPrevwRendrEng {

  // Facebook posts and photos URL scheme, from https://oembed.com:
  //
  // API endpoint: https://www.facebook.com/plugins/post/oembed.json
  // for urls like:
  // >  https://www.facebook.com/*/posts/*
  // >  https://www.facebook.com/photos/*
  // >  https://www.facebook.com/*/photos/*
  // >  https://www.facebook.com/photo.php*
  // >  https://www.facebook.com/photo.php
  // >  https://www.facebook.com/*/activity/*
  // >  https://www.facebook.com/permalink.php
  // >  https://www.facebook.com/media/set?set=*
  // >  https://www.facebook.com/questions/*
  // >  https://www.facebook.com/notes/*/*/*
  //
  // From  https://developers.facebook.com/docs/plugins/oembed-endpoints/:
  //   https://www.facebook.com/{page-name}/posts/{post-id}
  //   https://www.facebook.com/{username}/posts/{post-id}
  //   https://www.facebook.com/{username}/activity/{activity-id}
  //   https://www.facebook.com/photo.php?fbid={photo-id}
  //   https://www.facebook.com/photos/{photo-id}
  //   https://www.facebook.com/permalink.php?story_fbid={post-id}
  //   https://www.facebook.com/media/set?set={set-id}
  //   https://www.facebook.com/questions/{question-id}
  //   https://www.facebook.com/notes/{username}/{note-url}/{note-id}

  def handles(url: String): Boolean = {
    if (!url.startsWith("https://www.facebook.com/"))
      return false

    val path = url.replaceAllLiterally("https://www.facebook.com", "")

    if (path.startsWith("/photos") ||
        path.startsWith("/photo.php?") ||      // folowed by ?query=params
        path.startsWith("/permalink.php?") ||  // ?story_fbid=...
        path.startsWith("/media/set?set=") ||
        path.startsWith("/questions/") ||
        path.startsWith("/notes/"))
      return true

    // This is good enough?
    if (path.contains("/posts/") ||
        path.contains("/photos/") ||
        path.contains("/activity/"))
      return true

    false
  }
}


class FacebookPostPrevwRendrEng(globals: Globals, siteId: SiteId, mayHttpFetch: Boolean)
  extends OEmbedLinkPrevwRendrEng(
    globals, siteId = siteId, mayHttpFetch = mayHttpFetch) {

  def providerName = Some("Facebook")
  def widgetName = "post"
  def providerLnPvCssClassName = "s_LnPv-FbPost"
  def providerEndpoint = "https://www.facebook.com/plugins/post/oembed.json"
  // override def sandboxInIframe = false
  override def handles(url: String): Boolean = FacebookPostPrevwRendrEng.handles(url)
}



// ====== Facebook videos


object FacebookVideoPrevwRendrEng {

  // Facebook videos URL scheme, from https://oembed.com:
  //
  // API endpoint: https://www.facebook.com/plugins/video/oembed.json
  // for urls like:
  // >  https://www.facebook.com/*/videos/*
  // >  https://www.facebook.com/video.php
  //
  // Videos, from https://developers.facebook.com/docs/plugins/oembed-endpoints/:
  //   https://www.facebook.com/{page-name}/videos/{video-id}/
  //   https://www.facebook.com/{username}/videos/{video-id}/
  //   https://www.facebook.com/video.php?id={video-id}
  //   https://www.facebook.com/video.php?v={video-id}
  //
  // FB's response looks like:
  //   {
  //     "author_name": "Facebook",
  //     "author_url": "https://www.facebook.com/facebook/",
  //     "provider_url": "https://www.facebook.com",
  //     "provider_name": "Facebook",
  //     "success": true,
  //     "height": null,
  //     "html": "<div id=\"fb-root\"></div>\n<script>...</script>
  //               <div class=\"fb-video\" data-href=\"https://www.facebook.com/...">...
  //               <blockquote ...",
  //     "type": "video",
  //     "version": "1.0",
  //     "url": "https://www.facebook.com/facebook/videos/10153231379946729/",
  //     "width": "100%"
  //   }

  def handles(url: String): Boolean = {
    if (!url.startsWith("https://www.facebook.com/"))
      return false

    val path = url.replaceAllLiterally("https://www.facebook.com", "")

    if (path.startsWith("/video.php?")) // folowed by ?query=params
      return true

    // Good enough?
    if (path.contains("/videos/"))
      return true

    false
  }

}


class FacebookVideoPrevwRendrEng(globals: Globals, siteId: SiteId, mayHttpFetch: Boolean)
  extends OEmbedLinkPrevwRendrEng(
    globals, siteId = siteId, mayHttpFetch = mayHttpFetch) {

  def providerName = Some("Facebook")
  def widgetName = "video"
  def providerLnPvCssClassName = "s_LnPv-FbVideo"
  def providerEndpoint = "https://www.facebook.com/plugins/video/oembed.json"
  override def handles(url: String): Boolean = FacebookVideoPrevwRendrEng.handles(url)
}



// ====== Instagram


object InstagramPrevwRendrEng {

  // Instagram URL scheme, from https://oembed.com:
  //
  //  API:  https://api.instagram.com/oembed  (only json)
  //
  // > http://instagram.com/*/p/*,
  // > http://www.instagram.com/*/p/*,
  // > https://instagram.com/*/p/*,
  // > https://www.instagram.com/*/p/*,
  // > http://instagram.com/p/*
  // > http://instagr.am/p/*
  // > http://www.instagram.com/p/*
  // > http://www.instagr.am/p/*
  // > https://instagram.com/p/*
  // > https://instagr.am/p/*
  // > https://www.instagram.com/p/*
  // > https://www.instagr.am/p/*
  // > http://instagram.com/tv/*
  // > http://instagr.am/tv/*
  // > http://www.instagram.com/tv/*
  // > http://www.instagr.am/tv/*
  // > https://instagram.com/tv/*
  // > https://instagr.am/tv/*
  // > https://www.instagram.com/tv/*
  // > https://www.instagr.am/tv/*

  val regex: Regex =
    """^https?://(www\.)?(instagram\.com|instagr\.am)/([^/]+/)?(p|tv)/.*$""".r
}

class InstagramPrevwRendrEng(globals: Globals, siteId: SiteId, mayHttpFetch: Boolean)
  extends OEmbedLinkPrevwRendrEng(
    globals, siteId = siteId, mayHttpFetch = mayHttpFetch) {

  def providerName = Some("Instagram")
  def widgetName = "post"
  def providerLnPvCssClassName = "s_LnPv-Instagram"
  def providerEndpoint = "https://api.instagram.com/oembed"
  override def regex: Regex = InstagramPrevwRendrEng.regex
}



// ====== Internal links

// Talkayrd internal links, i.e. to other pages within the same site.

class InternalLinkPrevwRendrEng(globals: Globals, siteId: SiteId) // TESTS_MISSING TyTINTLNPRVW
                                  // add tests later, when implementing inline links?
  extends InstantLinkPrevwRendrEng(globals) {

  def providerLnPvCssClassName: String = "s_LnPv-Int"

  override def providerName: Option[String] = None
  override def alreadySanitized = true
  override def addViewAtLink = false


  override def handles(url: String): Boolean = {
    val uri = new java.net.URI(url)
    val domainOrAddress: String = uri.getHost  // can be null, fine

    // If no hostname, then it's a local link (right?).
    if (domainOrAddress eq null)
      return true

    val site = globals.siteDao(siteId).getSite() getOrElse {
      return false // weird
    }

    site.allHostnames.contains(domainOrAddress)  // [find_int_links]
  }


  protected def renderInstantly(unsafeUrl: String): Good[String] = {
    COULD_OPTIMIZE // have handles(url) above pass back the URI and pass on to this fn,
    // so ned not parse the url again? — Don't use any state, better stay thread safe.
    val uri = new java.net.URI(unsafeUrl)

    val urlPath = uri.getPathEmptyNotNull

    // If the link is broken, let's use the link url as the visible text — that's
    // a [good enough hint for the person looking at the edits preview] that
    // the link doesn't work? (when a linked page preview won't appear)
    var unsafeTitle = unsafeUrl
    var unsafeExcerpt = ""

    val dao = globals.siteDao(siteId)
    dao.getPagePathForUrlPath(urlPath) match {
      case None =>
      case Some(pagePath) =>
        dao.getOnePageStuffById(pagePath.pageId) match {
          case None =>
          case Some(pageStuff) =>
            unsafeTitle = pageStuff.title
            val inline = false  // for now
            if (!inline) {
              unsafeExcerpt = pageStuff.bodyExcerpt.getOrElse("").trim
            }
        }
    }

    val safeUrlAttr = TextAndHtml.safeEncodeForHtmlAttrOnly(unsafeUrl)
    val safeTitle = TextAndHtml.safeEncodeForHtmlContentOnly(unsafeTitle)
    val safeLink = s"""<a href="$safeUrlAttr">$safeTitle</a>"""
    var safePreview: String =
          if (unsafeExcerpt.isEmpty) {
            // This is either an inline link inside a paragraph — then just
            // show the title. Or a link to a page that apparently is empty,
            // no excerpt — weird.
            safeLink
          }
          else {
            // This'll get wrapped in an <aside>.  [lnpv_aside]
            val safeExcerpt = TextAndHtml.safeEncodeForHtmlContentOnly(unsafeExcerpt)
            s"""<div>$safeLink</div><blockquote>$safeExcerpt</blockquote>"""
          }

    // Not needed, do anyway:
    safePreview = TextAndHtml.sanitizeInternalLinksAndQuotes(safePreview)

    Good(safePreview)
  }

}



// ====== Reddit


// Reddit's embedding script is buggy [buggy_oembed]: it breaks in Talkyard's sandboxed
// iframe, when it cannot access document.cookie. It won't render any link preview
// — *however*, reddit comment replies use another Reddit script,
// which works (not buggy).
//
// Unfortunately,  allow-same-origin  apparently sets an <iframe srcdoc=...>'s
// domain to the same as its parent, so we cannot allow-same-origin
// (then the provider's scripts could look at Talkyard cookies, and other things).

// Reddit's stack trace:
//     platform.js:7 Uncaught SecurityError: Failed to read the 'cookie' property from
//       'Document': The document is sandboxed and lacks the 'allow-same-origin' flag.
//     get @ platform.js:7
//       h.getUID @ platform.js:8
//     ...
//     platform.js:7 Uncaught DOMException: Failed to read the 'cookie' property from
//         'Document': The document is sandboxed and lacks the 'allow-same-origin' flag.
//     at Object.get (https://embed.redditmedia.com/widgets/platform.js:7:8209)
//
// Reddit comments script, which works fine, is instead:
// https://www.redditstatic.com/comment-embed.js   not  /widgets/platform.js.

// From https://oembed.com:
// API endpoint: https://www.reddit.com/oembed
// URLs patterns:
//  - https://reddit.com/r/*/comments/*/*
//  - https://www.reddit.com/r/*/comments/*/*

object RedditPrevwRendrEng {

  val regex: Regex = """^https://(www\.)?reddit\.com/r/[^/]+/comments/[^/]+/.*$""".r

}

class RedditPrevwRendrEng(globals: Globals, siteId: SiteId, mayHttpFetch: Boolean)
  extends OEmbedLinkPrevwRendrEng(
    globals, siteId = siteId, mayHttpFetch = mayHttpFetch) {

  def providerName = Some("Reddit")
  def widgetName = "post"
  def providerLnPvCssClassName = "s_LnPv-Reddit"
  def providerEndpoint = "https://www.reddit.com/oembed"
  override def regex: Regex = RedditPrevwRendrEng.regex
}



// ====== Telegram


object TelegramPrevwRendrEng {
  val regex: Regex = """^https://t\.me/([a-zA-Z0-9]+/[0-9]+)$""".r
}

class TelegramPrevwRendrEng(globals: Globals) extends InstantLinkPrevwRendrEng(globals) {

  override def regex: Regex =
    TelegramPrevwRendrEng.regex

  def providerLnPvCssClassName = "s_LnPv-Telegram"

  override def alreadySanitized = true


  def renderInstantly(unsafeUrl: String): String Or LinkPreviewProblem = {
    val messageId = (regex findGroupIn unsafeUrl) getOrElse {
      return Bad(LinkPreviewProblem(
            "Couldn't find message id in Telegram link",
            unsafeUrl = unsafeUrl, "TyE0TLGRMID"))
    }

    //"durov/68" "telegram/83"

    val safeMessageId = TextAndHtml.safeEncodeForHtmlAttrOnly(messageId)

    // Look at the regex — messageId should be safe already.
    dieIf(safeMessageId != messageId, "TyE50SKDGJ5")

    // This is what Telegram's docs says we should embed: ...
    /*
    val unsafeScriptWithMessageId =
          """<script async src="https://telegram.org/js/telegram-widget.js?9" """ +
            s"""data-telegram-post="$safeMessageId" data-width="100%"></script>"""

    val safeHtml = sandboxedLinkPreviewIframeHtml(
          unsafeUrl = unsafeUrl, unsafeHtml = unsafeScriptWithMessageId,
          unsafeProviderName = Some("Telegram"),
          extraLnPvCssClasses = extraLnPvCssClasses)

    return Good(safeHtml)   */

    // ... HOWEVER then Telegram refuses to show that contents — because
    // Telegram creates an iframe that refuses to appear when nested in
    // Talkyard's sandboxed iframe.  [buggy_oembed]
    // There's this error:
    //   68:1 Access to XMLHttpRequest at 'https://t.me/durov/68?embed=1' from
    //   origin 'null' has been blocked by CORS policy: No 'Access-Control-Allow-Origin'
    //   header is present on the requested resource.
    // Happens in Telegram's  'initWidget',
    //   https://telegram.org/js/telegram-widget.js?9   line 199:
    //       widgetEl.parentNode.insertBefore(iframe, widgetEl);
    // apparently Telegram loads its own iframe, but that won't work, because
    // Talkyard's sandboxed iframe is at cross-origin domain "null",
    // and becasue (?) Telegram's iframe request has:
    //    Sec-Fetch-Site: cross-site
    // but Telegram's response lacks any Access-Control-Allow-Origin header.

    // Instead, let's load the Telegram iframe ourselves instead;
    // this seems to work:

    // Iframe sandbox permissions. [IFRMSNDBX]
    val permissions =
          "allow-popups " +
          "allow-popups-to-escape-sandbox " +
          "allow-top-navigation-by-user-activation"

    // So let's copy-paste Telegram's iframe code to here, and sandbox it.
    // This'll be slightly fragile, in that it'll break if Telegram makes "major"
    // change to their iframe and its url & params.
    val safeIframeUrlAttr =
          TextAndHtml.safeEncodeForHtmlAttrOnly(s"$unsafeUrl?embed=1")

    val safeSandboxedIframe =
          s"""<iframe sandbox="$permissions" src="$safeIframeUrlAttr"></iframe>"""
    // Telegarm's script would add: (I suppose the height is via API?)
    //  width="100%" height="" frameborder="0" scrolling="no"
    //  style="border: none; overflow: hidden; min-width: 320px; height: 96px;">

    // Unfortunately, now Telegram's iframe tends to become a bit too tall. [TELEGRIFR]

    Good(safeSandboxedIframe)
  }

}



// ====== TikTok


// TikTok's embed script (they include in the oEmbed html field) is buggy  [buggy_oembed]
// — it breaks when it cannot access localStorage in Talkyard's sandboxed iframe:
//
//   > VM170 embed_v0.0.6.js:1 Uncaught DOMException: Failed to read the 'localStorage'
//   >      property from 'Window': The document is sandboxed and lacks the
//   >      'allow-same-origin' flag.
//   >   at Module.3177845424933048caec (https://s16.tiktokcdn.com/tiktok/
//   >                                      falcon/embed/embed_v0.0.6.js:1:20719)
//   >   at r (https://s16.tiktokcdn.com/tiktok/falcon/embed/embed_v0.0.6.js:1:106)
//
// So no video or image loads — only some text and links.

object TikTokPrevwRendrEng {
  val regex: Regex =
    """^https://www.tiktok.com/@[^/]+/video/[0-9]+$""".r
}

class TikTokPrevwRendrEng(globals: Globals, siteId: SiteId, mayHttpFetch: Boolean)
  extends OEmbedLinkPrevwRendrEng(
    globals, siteId = siteId, mayHttpFetch = mayHttpFetch) {

  def providerName = Some("TikTok")
  def widgetName = "video"
  def providerLnPvCssClassName = "s_LnPv-TikTok"

  // Example:
  // https://www.tiktok.com/oembed
  //    ?url=https://www.tiktok.com/@scout2015/video/6718335390845095173
  // Docs: https://developers.tiktok.com/doc/Embed
  //
  def providerEndpoint = "https://www.tiktok.com/oembed"
  override def regex: Regex = TikTokPrevwRendrEng.regex
}



// ====== Twitter


// What about Twitter Moments?
// https://developer.twitter.com/en/docs/twitter-for-websites/moments/guides/oembed-api
// Links look like:
//   https://twitter.com/i/moments/650667182356082688

// And Timelines?
// https://developer.twitter.com/en/docs/twitter-for-websites/timelines/guides/oembed-api
// Links look like:
//   https://twitter.com/TwitterDev

object TwitterPrevwRendrEng {
  // URL scheme, from https://oembed.com:
  // >  https://twitter.com/*/status/*
  // >  https://*.twitter.com/*/status/*
  val regex: Regex = """^https://(.*\.)?twitter\.com/.*/status/.*$""".r
}

class TwitterPrevwRendrEng(globals: Globals, siteId: SiteId, mayHttpFetch: Boolean)
  extends OEmbedLinkPrevwRendrEng(
        globals, siteId = siteId, mayHttpFetch = mayHttpFetch) {

  def providerName = Some("Twitter")
  def widgetName = "tweet"
  def providerLnPvCssClassName = "s_LnPv-Twitter"
  def providerEndpoint = "https://publish.twitter.com/oembed"

  override def regex: Regex = TwitterPrevwRendrEng.regex

  // Twitter tweets are 598 px over at Twitter.com
  // omit_script=1  ?
  // theme  = {light, dark}
  // link_color  =   [ty_themes]
  // lang="en" ... 1st 2 letters in Ty's lang code — except for Chinese:  zh-cn  zh-tw
  // see:
  // https://developer.twitter.com/en/docs/twitter-for-websites/twitter-for-websites-supported-languages/overview
  // dnt  ?
  // Wants:  theme: light / dark.  Primary color / link color.
  // And device:  mobile / tablet / laptop ?  for maxwidth.
  override def moreQueryParamsEndAmp = "align=center&"

}



// ====== YouTube


// From oembed.com:
// URL scheme: https://*.youtube.com/watch*
// URL scheme: https://*.youtube.com/v/*
// URL scheme: https://youtu.be/*
// API endpoint: https://www.youtube.com/oembed
//
object YouTubePrevwRendrEngOEmbed {
  val youtuDotBeStart = "https://youtu.be/"
  val youtubeComRegex: Regex = """^https://[^.]+\.youtube\.com/(watch|v/).+$""".r

  def handles(url: String): Boolean = {
    if (url.startsWith(youtuDotBeStart)) return true
    youtubeComRegex matches url
  }
}

/* Doesn't work, just gets 404 Not Found oEmbed responses. Use instead:
    YouTubePrevwRendrEng extends InstantLinkPrevwRendrEng

class YouTubePrevwRendrEng(globals: Globals, siteId: SiteId, mayHttpFetch: Boolean)
  extends OEmbedPrevwRendrEng(
    globals, siteId = siteId, mayHttpFetch = mayHttpFetch) {

  def providerName = Some("YouTube")
  def widgetName = "video"
  def providerLnPvCssClassName = "s_LnPv-YouTube"
  def providerEndpoint = "https://www.youtube.com/oembed"
  override def handles(url: String): Boolean = {
    YouTubePrevwRendrEng.handles(url)
  }

}  */
