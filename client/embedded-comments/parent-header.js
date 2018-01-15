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

// This file is prefixed to embedded-comments.js by gulpfile.js.
// See readme.txt.


window.eds = {};
window.debiki = { internal: {}, v0: { util: {} } };

// Finds Debiki server origin, by extracting origin of the debiki-embedded-comments.js script.
// We need it when loading the <iframe>s with embedded comments and the editor.
debiki.internal.commentsServerOrigin =
    window.talkyardCommentsServerUrl ||
    window.edCommentsServerUrl || // old name [2EBG05]
    (function() {
  var origin;
  var scripts = document.getElementsByTagName('script');
  for (var i = 0; i < scripts.length; ++i) {
    script = scripts[i];
    var srcAttr = script.src;
    // Old name? [2EBG05]
    var isEmbeddedCommentsScript = srcAttr.search(/\/-\/ed-comments.(min\.)?js/) !== -1;
    // New name?
    if (!isEmbeddedCommentsScript) {
      isEmbeddedCommentsScript = srcAttr.search(/\/-\/talkyard-comments.(min\.)?js/) !== -1;
    }
    if (isEmbeddedCommentsScript) {
      origin = srcAttr.match(/^[^/]*\/\/[^/]+/)[0];
    }
  }
  if (!origin && console.error) {
    console.error("Error extracting Effective Discussions embedded comments server origin, " +
      "is there no '/-/talkyard-comments.min.js' script?");
  }
  return origin;
})();


// Wrap all js in this script bundle in a function, so variables and functions won't become global.
// We'll add `})();` later in parent-footer.js.
(function() {


// vim: et sw=2 ts=2 tw=0 list
