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

package debiki.onebox   // RENAME to talkyard.server.links

import com.debiki.core._
import com.debiki.core.Prelude._
import debiki.{Globals, TextAndHtml}
import debiki.TextAndHtml.safeEncodeForHtml



object LinkPreviewHtml {


  def safeAside(safeHtml: String, extraLnPvCssClasses: String,
        unsafeUrl: String, unsafeProviderName: Option[String],
        addViewAtLink: Boolean): String = {

    require(safeEncodeForHtml(extraLnPvCssClasses) == extraLnPvCssClasses, "TyE06RKTDH2")

    // 'noopener' stops [reverse_tabnabbing], prevents the new browser tab from
    // redirecting the current browser tab to, say, a phishing site.
    // 'ugc' means User-generated-content. There's also  "sponsored", which must
    // be used for paid links (or "nofollow" is also ok, but not "ugc" — search
    // engines can penalize that).
    // rel=nofollow also added here: [rel_nofollow].
    val relAttrs = "nofollow noopener ugc"

    <aside class={s"onebox s_LnPv $extraLnPvCssClasses clearfix"}>{
        // The html should have been sanitized already (that's why the param
        // name is *safe*Html).
        scala.xml.Unparsed(safeHtml)
      }{ if (!addViewAtLink) xml.Null else {
        <div class="s_LnPv_ViewAt"
          ><a href={unsafeUrl} target="_blank" rel={relAttrs}>{
            "View at " + unsafeProviderName.getOrElse(unsafeUrl)  // I18N
            } <span class="icon-link-ext"></span></a
        ></div>
    }}</aside>.toString
  }


  def safeProblem(unsafeProblem: String, unsafeUrl: String, errorCode: String): String = {
    require(safeEncodeForHtml(errorCode) == errorCode, "TyE906MRTD25")

    val safeProblem = TextAndHtml.safeEncodeForHtmlContentOnly(unsafeProblem)
    val safeUrl = safeEncodeForHtml(unsafeUrl)
    val safeLinkTag =
          s"""<a href="$safeUrl" class="s_LnPv_L s_LnPv_L-Err" """ +
              s"""target="_blank" rel="nofollow noopener">""" +
              s"""$safeUrl <span class="icon-link-ext"></span></a>"""
    val errInBrackets = if (errorCode.isEmpty) "" else s" <code>[$errorCode]</code>"
    val safeHtml =
          s"""<div>$safeProblem $safeLinkTag$errInBrackets</div>"""

    // Need not sanitize here, do anyway just in case.
    TextAndHtml.sanitizeAllowLinksAndBlocks(safeHtml)
  }


  def sandboxedIframe(unsafeHtml: String): String = {

    // Iframe sandbox permissions. [IFRMSNDBX]
    val permissions = (
      // Most? oEmbeds execute Javascript to render themselves — ok, in a sandbox.
      "allow-scripts " +

        // This makes:  <a href=.. target=_blank>  work — opens in new browser tab.
        "allow-popups " +

        // Makes a popup / new-tab opened from the iframe work properly;
        // it won't inherit the iframe sandbox restrictions.
        "allow-popups-to-escape-sandbox " +

        // allow-same-origin lets the iframe access cookies and stuff *from its
        // own domain*, e.g. to know if one is logged in, so they can show one's avatar
        // or other things relevant to oneself in the iframe.
        //
        // Unfortunately, many / most? oEmbed:s break (e.g. fail to render properly),
        // if they cannot access document.cookie or localStorage etc.  [buggy_oembed]
        //
        // See:
        //   - https://www.html5rocks.com/en/tutorials/security/sandboxed-iframes/
        //   - https://stackoverflow.com/questions/31184505/sandboxing-iframe-and-allow-same-origin
        //   - https://html.spec.whatwg.org/multipage/iframe-embed-object.html#attr-iframe-srcdoc
        //
        // allow-same-origin  plus  allow-scripts, would be unsafe if served by
        // Talkyard on the Talkyard site's domain itself — it could then have
        // removed the sandbox attribute.
        // https://developer.mozilla.org/en-US/docs/Web/HTML/Element/iframe#attr-sandbox
        // Also:
        // https://stackoverflow.com/questions/31184505/sandboxing-iframe-and-allow-same-origin
        //
        // However! Together with srcdoc=..., seems the iframe *does* get the same
        // origin as the parent window, i.e. Talkyard itself, letting the
        // iframe escape the sandbox? So skip  allow-same-origin  for now
        // — let previews that require same-origin be broken.
        //
        // And, for some trusted oEmbed providers (which ones can be an admin setting?)
        // inline the oEmbed html directly instead (don't sandbox it)?
        //
        // The Whatwg docs:
        // > Setting both the allow-scripts and allow-same-origin keywords together
        // > when the embedded page has the same origin as the page containing
        // > the iframe allows the embedded page to simply remove the sandbox
        // > attribute and then reload itself, effectively breaking out of the
        // > sandbox altogether.
        // https://html.spec.whatwg.org/multipage/iframe-embed-object.html#the-iframe-element
        //
        // "allow-same-origin " +   // no, see above

        // This makes links work, but only if the user actually clicks the links.
        // Javascript in the iframe cannot change the top win location when
        // the user is inactive — that would have made phishing attacks possible:
        // the iframe could silently have replaced the whole page with [a similar
        // looking page but on the attacker's domain].
        "allow-top-navigation-by-user-activation")

    val safeHtmlInAttr = TextAndHtml.safeEncodeForHtmlAttrOnly(
      unsafeHtml + adjustIframeHeightScript)

    var safeHtml = s"""<iframe sandbox="$permissions" srcdoc="$safeHtmlInAttr"></iframe>"""

    // Not needed but anyway:
    safeHtml = TextAndHtml.sanitizeAllowIframeOnly(safeHtml)
    dieIf(!safeHtml.contains(s""" sandbox="$permissions" """), "TyE402KG467")

    safeHtml
  }


  /** The embedding parent window doesn't know how tall this iframe with oEmbed
    * stuff inside wants to be — so let's tell it, by loading Ty's ext-iframe
    * script that tells the parent frame how tall it (the iframe) is.
    */
  private def adjustIframeHeightScript: String = i"""
        |<script src="/-/assets/ext-iframe$min.js"></script>
        """

  private def min = Globals.isDevOrTest ? "" | ".min"

}
