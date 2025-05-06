/*
 * Copyright (C) 2016 Kaj Magnus Lindberg
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


//------------------------------------------------------------------------------
   namespace ed.editor.CdnLinkifyer {
//------------------------------------------------------------------------------

// SECURITY regex & evil input
// COULD match any origin too: (and (?:...) is a non capturing group)
//    (?:(?:https?:)\/\/[^\/]+)?
var uploadsLinkRegex = /\/-\/(u|uploads\/public)\/([a-zA-Z0-9\/\._-]+)/;

// SECURITY regex & evil input
// A tiny tiny bit buggy: matches this:
//   <a weird="<tag-in-attr" href="/-/u/....">
// although I don't want it to match if there're 2 '<' like that.
// Barely matters though; works fine in real life.
var uploadsRegexInTag = /(\<[^\<\>]+\s[a-z]+=['"])\/-\/(u|uploads\/public)\/([a-zA-Z0-9\/\._-]+['"][^\<\>]*\>)/;


export function replaceLinks(md: any): void {
  // (Don't exit here if !eds.uploadsUrlPrefixCommonmark, because it changes "suddenly"
  // when rendering server side. [5YKF02])

  // (There's always a rules.image.)
  md.renderer.rules.image = makeMarkdownUrlReplacerRule('src', md.renderer.rules.image);

  md.renderer.rules.link_open =
    makeMarkdownUrlReplacerRule('href', md.renderer.rules.link_open || defaultInlineRule);

  md.renderer.rules.html_inline =
    makeHtmlUrlReplacerRule(md, md.renderer.rules.html_inline);

  // This might in some rare cases also transforms html tag text contents that
  // matches /-/u/... to cdn-origin/-/u/...,
  // COULD use an HTML parser to ensure only tag attributes are considered, instead.
  // Not so very important though — we sanitize the resulting html anyway.
  md.renderer.rules.html_block =
    makeHtmlUrlReplacerRule(md, md.renderer.rules.html_block);
}


function defaultInlineRule(tokens, idx, options, env, self) {
  return self.renderToken(tokens, idx, options);
}


function makeMarkdownUrlReplacerRule(attrName: string, defaultRule) {
  return function(tokens, idx, options, env, self) {
    // (Don't test this earlier, because eds.uploadsUrlPrefixCommonmark changes "suddenly"
    // when rendering server side. [5YKF02])
    // Later: What? How could there ever *not* be any uploads url prefix? This is probably an old
    // if-test, before site pub-id incl in the uploads url path? Always false now? Can be removed?
    if (!eds.uploadsUrlPrefixCommonmark)
      return defaultRule(tokens, idx, options, env, self);

    const token = tokens[idx];
    const attrIndex = token.attrIndex(attrName);
    if (attrIndex !== -1) {
      const attrNameValue = token.attrs[attrIndex];
      const matches = attrNameValue[1].match(uploadsLinkRegex);
      if (matches) {
        attrNameValue[1] = eds.uploadsUrlPrefixCommonmark + matches[2];
      }
    }
    return defaultRule(tokens, idx, options, env, self);
  };
}


function makeHtmlUrlReplacerRule(md, defaultInlineRule) {
  return function(tokens, idx, options, env, self) {
    // (Don't test this earlier, because eds.uploadsUrlPrefixCommonmark changes "suddenly"
    // when rendering server side. [5YKF02])
    if (!eds.uploadsUrlPrefixCommonmark)
      return defaultInlineRule(tokens, idx, options, env, self);

    // Inside an html tag, replace any /-/u/... (uploads) match with the CDN or UGC address.
    const token = tokens[idx];
    const content = token.content;
    token.content = content.replace(uploadsRegexInTag, '$1' + eds.uploadsUrlPrefixCommonmark + '$3');
    return defaultInlineRule(tokens, idx, options, env, self);
  };
}

//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
