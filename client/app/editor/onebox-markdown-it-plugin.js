/*
 * Copyright (C) 2015 Kaj Magnus Lindberg
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


var pluginId = 'Onebox';


/**
 * Converts a paragraph consisting of an unindened link to e.g. a YouTube snippet
 * or a Wikipedia article excerpt, depending on the link.
 * Differs from Discourse's onebox in that links have to be in separate paragraphs.
 */
debiki.internal.oneboxMarkdownItPlugin = function(md) {
  md.block.ruler.before('paragraph', pluginId, parseOnebox);
  md.renderer.rules[pluginId] = renderOnebox;
}


function parseOnebox(state, startLineIndex, endLineIndex, whatIsThis) {
  var startLine = state.getLines(startLineIndex, startLineIndex + 1, state.blkIndent, false);
  if (startLine[0] !== 'h' || startLine[1] !== 't' || startLine[2] !== 't')
    return false;

  var nextLine = state.getLines(startLineIndex + 1, startLineIndex + 2, state.blkIndent, false);
  if (nextLine)
    return false;

  if (state.parentType !== 'root')
    return false; // not a top level block

  var match = startLine.match(/^https?:\/\/[^\s]+\s*$/);
  if (!match)
    return false;

  if (whatIsThis) {
    console.warn('whatIsThis is not false, it is: ' + whatIsThis);
  }

  var link = match[0];
  state.line += 1;

  var token = state.push(pluginId, '');
  token.link = link;
  token.level = state.level;
  return true;
};


function renderOnebox(tokens, index, options, env, renderer) {
  var token = tokens[index];
  var oneboxHtml;
  var renderer = debiki.internal.oneboxMarkdownItPlugin.instantRenderer;
  if (renderer) {
    // We're running server side then? In case the string is a Nashorn ConsString,
    // which won't work now when calling back out to Scala/Java code:
    var linkAsJavaString = String(token.link);
    oneboxHtml = renderer.renderOnebox(linkAsJavaString);
  }
  else {
    console.log('Loading onebox from server...');
    var randomId = 'onebox-' + Math.random().toString(36).slice(2);
    debiki2.Server.loadOneboxUnsafeHtml(token.link, function(html) {
      var replacement;
      if (html) {
        replacement = sanitizeOneboxHtml(html);
      }
      else {
        // The link couldn't be oneboxed.
        replacement = $('<a>').attr('href', token.link).text(token.link);
      }
      $('#' + randomId).replaceWith(replacement);
    });
    var safeLink = debiki.internal.sanitizeHtml(token.link)
    oneboxHtml  ='<div id="' + randomId + '" class="icon icon-loading"><a>' + safeLink + '</a></div>';
  }
  return sanitizeOneboxHtml(oneboxHtml);
};


function sanitizeOneboxHtml(html) {
  // googleCajaSanitizeHtml below is present both server side and client side. Allow
  // custom ids and classes because the server adds certain onebox–.. classes, and
  // also the id is used to identify onebox placeholders that get replaced later when
  // the related http request to the server has completed.
  var allowClassAndIdAttr = true;
  var safeHtml = googleCajaSanitizeHtml(html, allowClassAndIdAttr, false);
  // Don't link to any HTTP resources from safe HTTPS pages, e.g. don't link
  // to <img src="http://...">, change to https instead even if the image then breaks.
  // COULD leave <a href=...> HTTP links as is so they won't break. And also leave
  // plain text as is. But for now, this is safe and simple and stupid: (?)
  if (debiki.secure) {
    safeHtml = safeHtml.replace(/http:/g, 'https:');
  }
  return safeHtml;
}

// vim: fdm=marker et ts=2 sw=2 tw=0 fo=tcqwn list
