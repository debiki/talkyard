/* Markdown conversion and sanitization functions.
 * Copyright (C) 2012-2015 Kaj Magnus Lindberg
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

/// <reference path="CdnLinkifyer.ts" />

//------------------------------------------------------------------------------
   namespace debiki2.editor {
//------------------------------------------------------------------------------

const d = { i: debiki.internal, u: debiki.v0.util };


// Converts markdown to sanitized html.
export function markdownToSafeHtml(markdownSrc, hostAndPort?, sanitizerOptions?) {
  const htmlTextUnsafe = markdownToUnsafeHtml(markdownSrc, hostAndPort);
  const htmlTextSafe = sanitizeHtml(htmlTextUnsafe, sanitizerOptions);
  return htmlTextSafe;
}


function markdownToUnsafeHtml(commonmarkSource, hostAndPort) {
  // SHOULD convert from 'https?:///' to 'https?://servername/', but this
  // no longer works since I'm using Markdown-it + CommonMark now:
  // Fix this server side too, [DK48vPe9]
  /*
  var converter = new Markdown.Converter();
  // Duplicated hook. See client/compiledjs/PagedownJavaInterface.js.
  // (This hook is for the browser. The duplicate is for the JVM.)
  converter.hooks.chain('postConversion', function(text) {
    return text.replace(/(https?:\/\/)\//g, '$1'+ hostAndPort +'/');
  });
  var htmlTextUnsafe = converter.makeHtml(markdownSrc, hostAndPort);
   */

  const md = window['markdownit']({ html: true, linkify: true, breaks: true });
  md.use(d.i.MentionsMarkdownItPlugin());
  md.use(d.i.oneboxMarkdownItPlugin);
  // SKIP client side? Only do when saving server side. So uploads won't get sent to the CDN,
  // unless one saves on's post & actually starts using the uploaded file.
  ed.editor.CdnLinkifyer.replaceLinks(md);  // broken? ... Shouldn't do here anyway?  [5UKBWQ2]
  let htmlTextUnsafe = md.render(commonmarkSource);
  htmlTextUnsafe = htmlTextUnsafe.replace(
      /\/-\/u\//g, `/-/u/${eds.pubSiteId}/`); // ... instead, for now. [7UKWQ24]
  return htmlTextUnsafe;
}


/**
 * Calls Google Caja JsHtmlSanitizer to sanitize the html.
 *
 * options.allowClassAndIdAttr = true/false
 * options.allowDataAttribs = true/false
 */
export function sanitizeHtml(htmlTextUnsafe, options) {
  options = options || {};
  const htmlTextSafe = d.i.googleCajaSanitizeHtml(
      htmlTextUnsafe, options.allowClassAndIdAttr, options.allowDataAttr);
  return htmlTextSafe;
}

//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
