/* Markdown conversion and sanitization functions.
 * Copyright (C) 2012-2012 Kaj Magnus Lindberg (born 1979)
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


(function() {

var d = { i: debiki.internal, u: debiki.v0.util };
var $ = d.i.$;


// Converts markdown to sanitized html.
d.i.markdownToSafeHtml = function(markdownSrc, hostAndPort, sanitizerOptions) {
  var htmlTextUnsafe = markdownToUnsafeHtml(markdownSrc, hostAndPort);
  var htmlTextSafe = d.i.sanitizeHtml(htmlTextUnsafe, sanitizerOptions);
  return htmlTextSafe;
};


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

  var md = window.markdownit({ html: true, linkify: true });
  md.use(d.i.MentionsMarkdownItPlugin());
  md.use(d.i.oneboxMarkdownItPlugin);
  var htmlTextUnsafe = md.render(commonmarkSource);
  return htmlTextUnsafe;
};


/**
 * Calls Google Caja JsHtmlSanitizer to sanitize the html.
 *
 * options.allowClassAndIdAttr = true/false
 * options.allowDataAttribs = true/false
 */
d.i.sanitizeHtml = function(htmlTextUnsafe, options) {
  options = options || {};
  var htmlTextSafe = d.i.googleCajaSanitizeHtml(
      htmlTextUnsafe, options.allowClassAndIdAttr, options.allowDataAttr);
  return htmlTextSafe;
};


d.i.sanitizerOptsForPost = function($post) {
  return {
    allowClassAndIdAttr: $post.dwIsArticlePost(),
    allowDataAttr: $post.dwIsArticlePost()
  };
};


})();

// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
