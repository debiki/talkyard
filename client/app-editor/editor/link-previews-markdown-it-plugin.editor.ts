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

// Later: [[wiki style]] links and later #[tags]?  Check out TiddlyWiki?  [wiki_links]

//------------------------------------------------------------------------------
   (function() {
//------------------------------------------------------------------------------

// Relevant docs:
// - How Markdown-it works
//   https://github.com/markdown-it/markdown-it/blob/master/docs/architecture.md
// - How to replace part of text token with link?
//   https://github.com/markdown-it/markdown-it/blob/master/docs/development.md#how-to-replace-part-of-text-token-with-link
// - A simple way to replace link text: Example 2
//   https://github.com/markdown-it/markdown-it-for-inline
// - Replacing link attributes (but we replace the whole link / link text instead)
//   https://github.com/markdown-it/markdown-it/blob/master/docs/architecture.md#renderer,
//   see e.g. the "how to add target="_blank" to all links:" example.


interface Token {  // why won't tsconfig types: "markdown-it" work?
  type: St;
  // attrs[ix][0 = AtrNameIx] is the name of attr nr ix, and attrs[ix][1 = AtrValIx]
  // is its value.
  attrs: [St, St][] | Nl;
  attrIndex: (atrName: St) => Nr;
  attrPush: (atrNameAndValue: [St, St]) => U;
  content;
  markup?: St;
  tag?: St;
  map;
  nesting: Nr;
  level: Nr;
  children;
  info?: St;
  meta;
  block: Bo;
  hidden: Bo;
}


interface BlockLinkPreviewToken extends Token {
  link: St;
  level: Nr;
}


// In Markdown-it, an attribute is a two elems array: [attr-name, attr-value].
const AtrNameIx = 0;
const AtrValIx = 1;


// We replace the link-open fn, to show inline link previews.
let origLinkOpenRenderFn: (tokens: Token[], idx: Nr, options, env, self) => St;


function renderLinkOpen(tokens: Token[], idx: Nr, options, env, self): St {
  //console.debug('TOKENS: ' + JSON.stringify(tokens, undefined, 4));

  // See the docs: https://github.com/markdown-it/markdown-it-for-inline#use
  // example 2, to see how one can replace the text in a link
  // — the approach taken below.

  // The link-open will get rendered as: <a herf=... >.
  const linkOpenToken: Token = tokens[idx];
  const classAtrIx = linkOpenToken.attrIndex('class');
  const linkHrefAtrIx: Nr = linkOpenToken.attrIndex('href');
  const hrefAtr = linkHrefAtrIx >= 0 && linkOpenToken.attrs[linkHrefAtrIx];
  const linkUrl = hrefAtr && hrefAtr[AtrValIx];

  // The text to show in the <a> tag — typically tne same as the href attr.
  // But we want to replace it with the title of the linked page.
  const textToken: Token | U = tokens[idx + 1];

  // Will appear as: </a>.
  const linkCloseToken: Token | U = tokens[idx + 2];

  // We'll generate previews only for links that don't already have a title
  // explicitly specified. E.g.:  "https://site/some/thing" or "www.example.com",
  // but not:  "[link title](https://url")  and not:  "<a href=... >Link Title</a>"
  // (title already specified).
  // Apparently Markdown-it sets Token.markup to 'linkify', for such auto-detected
  // links (the Markdown-it plugin Linkify-it does this?).
  const isAutoLink = linkOpenToken.markup === 'linkify';

  if (isAutoLink && linkUrl && textToken?.type === 'text' &&
        linkCloseToken?.type === 'link_close') {
    const serverRenderer = debiki.internal.serverSideLinkPreviewRenderer;
    if (serverRenderer) {
      // We're server side. In case the string is a Nashorn ConsString,
      // which won't work now when calling back out to Scala/Java code
      // — change to a Java string:
      const linkJavaSt = String(linkUrl);
      const resultJsonSt = serverRenderer.renderAndSanitizeInlineLinkPreview( // [js_scala_interop]
              linkJavaSt);
      // There were annoying runtime errors when trying to invoke a Scala
      // class instance method, so let's just use JSON instead (for now at least).
      const result: InlineLinkPreview = JSON.parse(resultJsonSt);
      if (result.safeTitleCont) {
        textToken.content = result.safeTitleCont;
      }
      if (result.classAtr) {
        if (classAtrIx >= 0) {
          const curClass = linkOpenToken.attrs[classAtrIx][AtrValIx];
          const newClass = (curClass ? curClass + ' ' : '') + result.classAtr;
          linkOpenToken.attrs[classAtrIx][AtrValIx] = newClass;
        }
        else {
          linkOpenToken.attrPush(['class', result.classAtr]);
        }
      }
    }
    else {
      const randomClass = 'c_LnPv-' + Math.random().toString(36).slice(2);  // [js_rand_val]
      const loadingClasses = `icon icon-loading ${randomClass}`;
      if (classAtrIx >= 0) {
        const curClass = linkOpenToken.attrs[classAtrIx][AtrValIx];
        linkOpenToken.attrs[classAtrIx][AtrValIx] = `${curClass} ${loadingClasses}`;
      } else {
        linkOpenToken.attrPush(['class', loadingClasses]);
      }

      // console.log(`Fetching page title for: ${linkUrl}`)

      debiki2.Server.fetchLinkPreview(linkUrl, true /*inline*/,
              function(preview: LinkPreviewResp | Nl) {
        const placeholders = debiki2.$all('.' + randomClass);
        // The placeholders might have disappeared, if the editor was closed or the
        // text deleted, for example.
        _.each(placeholders, function(ph: HElm) {
          debiki2.$h.removeClasses(ph, loadingClasses);
          if (preview) {
            if (preview.classAtr) {
              debiki2.$h.addClasses(ph, preview.classAtr);
            }
            if (preview.safeTitleCont) {
              ph.innerText = preview.safeTitleCont;
            }
          }
        });
      });
    }

    //console.log('3 tokens: ' +
    //      JSON.stringify([linkOpenToken, textToken, linkCloseToken], undefined, 3));
  }

  return origLinkOpenRenderFn(tokens, idx, options, env, self);
};

const pluginId = 'LnPvRndr';  // means LinkPreviewRenderer


/**
 * Converts a paragraph consisting of an unindented link to e.g. a YouTube snippet
 * or a Wikipedia article excerpt, depending on the link.
 * Differs from Discourse's onebox in that links have to be in separate paragraphs.
 */
debiki.internal.LinkPreviewMarkdownItPlugin = function(md) {
  md.block.ruler.before('paragraph', pluginId, tryParseLink);
  md.renderer.rules[pluginId] = renderLinkPreviewBlock;


  origLinkOpenRenderFn = md.renderer.rules.link_open ||
        function(tokens: Token[], idx: Nr, options, env, self): St {
          return self.renderToken(tokens, idx, options);
        }
  md.renderer.rules.link_open = renderLinkOpen;
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

  var token = state.push(pluginId, '') as BlockLinkPreviewToken;
  token.link = link;
  token.level = state.level;
  return true;
}


function renderLinkPreviewBlock(tokens: BlockLinkPreviewToken[], index: Nr,
        options, env, renderer_unused) {
  var token = tokens[index];
  var previewHtml;
  var serverRenderer = debiki.internal.serverSideLinkPreviewRenderer;
  if (serverRenderer) {
    // We're server side. In case the string is a Nashorn ConsString,
    // which won't work now when calling back out to Scala/Java code:
    const linkJavaSt = String(token.link);
    previewHtml = serverRenderer.renderAndSanitizeBlockLinkPreview( // [js_scala_interop]
          linkJavaSt);
  }
  else {
    var randomClass = 'c_LnPv-' + Math.random().toString(36).slice(2);  // [js_rand_val]
    debiki2.Server.fetchLinkPreview(token.link, false /*inline*/,
            function(preview: LinkPreviewResp | Nl) {
      const Bliss: Ay = window['Bliss'];

      function makeReplacement() {
        let repl;
        if (preview && preview.safeHtml) {
          repl = debiki2.$h.parseHtml(preview.safeHtml)[0];
        }
        else {
          // No link preview available; show a plain <a href=...> link instead.
          // (rel=nofollow gets added here: [rel_nofollow] for no-preview-attempted
          // links.)
          // Sync w server side code [0PVLN] [brkn_int_ln_pv].
          const clazz = 'c_LnPvNone' + (!preview?.errCode ? '' : '-' + preview.errCode);
          const link = Bliss.create('a', {
            href: token.link,
            class: clazz,
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


//------------------------------------------------------------------------------
   })();
//------------------------------------------------------------------------------

// vim: fdm=marker et ts=2 sw=2 tw=0 fo=tcqwn list
