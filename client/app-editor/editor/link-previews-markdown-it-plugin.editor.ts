/*
 * Copyright (C) 2015, 2020 Kaj Magnus Lindberg
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

// NEXT seems ok simple to create an IntLnRndr for internal link titles?
// And [[wiki style]] links and later #[tags]?  Check out TiddlyWiki?


const pluginId = 'LnPvRndr';  // means LinkPreviewRenderer


/**
 * Converts a paragraph consisting of an unindented link to e.g. a YouTube snippet
 * or a Wikipedia article excerpt, depending on the link.
 * Differs from Discourse's onebox in that links have to be in separate paragraphs.
 */
debiki.internal.LinkPreviewMarkdownItPlugin = function(md) {
  md.block.ruler.before('paragraph', pluginId, tryParseLink);
  md.renderer.rules[pluginId] = renderLinkPreview;
};


function tryParseLink(state, startLineIndex, endLineIndex, whatIsThis) {
  var startLine = state.getLines(startLineIndex, startLineIndex + 1, state.blkIndent, false);

  // Ooops! cancels if 1st line not the link.
  if (startLine[0] !== 'h' || startLine[1] !== 't' || startLine[2] !== 't')
    return false;

  // Ooops! cancels if >= 2 lines in para.
  var nextLine = state.getLines(startLineIndex + 1, startLineIndex + 2, state.blkIndent, false);
  if (nextLine)
    return false;

  // SHOULD require only its own line, not its own paragraph! (Otherwise,
  // people don't "discover" the link preview functionality).
  if (state.parentType !== 'root' &&     // works with markdown-it 7
      state.parentType !== 'paragraph')  // works with markdown-it 8
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
}


function renderLinkPreview(tokens, index, options, env, renderer_unused) {
  var token = tokens[index];
  var previewHtml;
  var serverRenderer = debiki.internal.serverSideLinkPreviewRenderer;
  if (serverRenderer) {
    // We're server side. In case the string is a Nashorn ConsString,
    // which won't work now when calling back out to Scala/Java code:
    var linkAsJavaString = String(token.link);
    previewHtml =
          serverRenderer.renderAndSanitizeOnebox(linkAsJavaString); // [js_scala_interop]
  }
  else {
    var randomClass = 'c_LnPv-' + Math.random().toString(36).slice(2);  // [js_rand_val]
    debiki2.Server.loadOneboxSafeHtml(token.link, function(safeHtml) {
      const Bliss: Ay = window['Bliss'];

      function makeReplacement() {
        let repl;
        if (safeHtml) {
          repl = debiki2.$h.parseHtml(safeHtml)[0];
        }
        else {
          // No link preview available; show a plain <a href=...> link instead.
          // (rel=nofollow gets added here: [rel_nofollow] for no-preview-attempted
          // links.)
          // Sync w server side code [0PVLN].
          const link = Bliss.create('a', {
            href: token.link,
            // target: _blank — don't add! without also adding noopener on the next line:
            rel: 'nofollow',   // + ' noopener' — for [reverse_tabnabbing].
            text: token.link,
          });
          repl = Bliss.create('p', { around: link });
        }
        return repl;
      }

      var placeholders = debiki2.$all('.' + randomClass);
      // The placeholders might have disappeared, if the editor was closed or the
      // text deleted, for example.
      _.each(placeholders, function(ph) {
        Bliss.after(makeReplacement(), ph);
        ph.remove();
      });
    });
    var safeLink = debiki2.editor.sanitizeHtml(token.link);
    // The sanitizer must allow the id and class, see [6Q8KEF2] in
    // client/third-party/html-css-sanitizer-bundle.js.
    previewHtml =
          `<p class="${randomClass}"><a class="icon icon-loading">${safeLink}</a></p>`;
  }
  return previewHtml;
}


// vim: fdm=marker et ts=2 sw=2 tw=0 fo=tcqwn list
