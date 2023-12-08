/**
 * Copyright (c) 2014, 2017 Kaj Magnus Lindberg
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

// This file is prefixed to the embedded comments script bundle, by gulpfile.js.
// See readme.txt.


// Don't run this script twice, or we'd end up with duplicated state, e.g. authnTried
// (in blog-comments.ts) in two different closures. Then this happened:
// Trying to single-sign-on using a PASETO token, but with a session id in the
// sign-on request, making the server reply Error and an error message popping up
// in the comments iframe.
//
// (Generally, Javascript files are written to execute once only, see:
//   https://stackoverflow.com/questions/70564723/what-happens-when-a-script-source-is-loaded-multiple-times )
//
// Tests:
//   - embcom.dont-load-script-twice.2br.ec  TyTECLOADTWICE
//
if (window['_loadingTalkyardScript']) {
  throw Error(`Talkyard comments script loaded twice [TyEEMBJSLD2]`);
  // Does this make sense to incl in the error text, or is it just confusing, if the
  // problem is sth else (e.g. just accidentally adding two <script> tags):
  //   `Can you use talkyardAddCommentsIframe() or talkyardLoadNewCommentIframes() instead?`
  // — Maybe better with an error code (incl above) or read-more URL.
}
window['_loadingTalkyardScript'] = true;



window.eds = {};  // CLEAN_UP REMOVE  not needed here any more?
window.debiki = { internal: {}, v0: { util: {} } };

// Finds the server origin, by extracting origin of the embedded comments script url.
// We need it when loading the <iframe>s with embedded comments and the editor.
debiki.internal.commentsServerOrigin =
    window.talkyardServerUrl ||
    window.talkyardCommentsServerUrl ||  // old name
    window.edCommentsServerUrl || // old name [2EBG05]
    (function() {
  var origin;
  var scripts = document.getElementsByTagName('script');
  for (var i = 0; i < scripts.length; ++i) {
    script = scripts[i];
    var srcAttr = script.src;
    // CLEAN_UP use indexOf not search()  — but remove regex escapes first
    var isEmbeddedCommentsScript = srcAttr.search(/\/-\/ed-comments.(min\.)?js/) !== -1; // old [2EBG05]
    if (!isEmbeddedCommentsScript) {
      isEmbeddedCommentsScript = srcAttr.search(/\/-\/talkyard-comments.(min\.)?js/) !== -1; // new name
    }
    if (isEmbeddedCommentsScript) {
      origin = srcAttr.match(/^[^/]*\/\/[^/]+/)[0];
    }
  }
  if (!origin && console.error) {
    console.error("Error extracting Talkyard embedded comments server origin, " +
      "is there no '/-/talkyard-comments.min.js' script?");
  }
  return origin;
})();

// Drop any trailing '/', shouldn't be included in origin. (For now, won't be any url path.)
// This wouldn't work in IE11: `new URL(theUrl).origin`
debiki.internal.commentsServerOrigin = debiki.internal.commentsServerOrigin.replace(/\/+\s*$/, '');

// Wrap all js in this script bundle in a function, so variables and functions won't become global.
// We'll add `})();` later in parent-footer.js.
(function() {


// vim: et sw=2 ts=2 tw=0 list
