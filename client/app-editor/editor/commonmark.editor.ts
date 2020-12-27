/* Markdown conversion and sanitization functions.
 * Copyright (c) 2012-2018 Kaj Magnus Lindberg
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

/// <reference path="../editor-prelude.editor.ts" />

//------------------------------------------------------------------------------
   namespace debiki2.editor {
//------------------------------------------------------------------------------

const d = { i: debiki.internal, u: debiki.v0.util };


export interface SanitizeOpts {
  allowClassAndIdAttr?: Bo;
  allowDataAttr?: Bo;
}


// Converts markdown to sanitized html.
export function markdownToSafeHtml(markdownSrc: St, hostAndPort?: St,
        sanitizerOptions?: SanitizeOpts): St {
  const htmlTextUnsafe = markdownToUnsafeHtml(markdownSrc, hostAndPort);
  const htmlTextSafe = sanitizeHtml(htmlTextUnsafe, sanitizerOptions);
  return htmlTextSafe;
}


function markdownToUnsafeHtml(commonmarkSource, hostAndPort) {
  const md = window['markdownit']({ html: true, linkify: true, breaks: true });
  md.use(d.i.MentionsMarkdownItPlugin());
  md.use(d.i.oneboxMarkdownItPlugin);
  // COULD: Client side, don't CDNify links — only do that server side, when the text that
  // references the upload, has been saved. This prevents uploads from getting sent
  // to the CDN, before one knows for sure that they will actually be used.
  ed.editor.CdnLinkifyer.replaceLinks(md);
  let htmlTextUnsafe = md.render(commonmarkSource);
  return htmlTextUnsafe;
}


/**
 * Calls Google Caja JsHtmlSanitizer to sanitize the html.
 *
 * options.allowClassAndIdAttr = true/false
 * options.allowDataAttribs = true/false
 */
export function sanitizeHtml(htmlTextUnsafe, options: SanitizeOpts = {}) {
  const htmlTextSafe = d.i.googleCajaSanitizeHtml(
      htmlTextUnsafe, options.allowClassAndIdAttr, options.allowDataAttr);
  return htmlTextSafe;
}

//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
