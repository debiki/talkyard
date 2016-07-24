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

/// <reference path="../plain-old-javascript.d.ts" />
/// <reference path="../../typedefs/react/react.d.ts" />

//------------------------------------------------------------------------------
   module ed.editor.CdnLinkifyer {
//------------------------------------------------------------------------------

// COULD match any origin too: (and (?:...) is a non capturing group)
//    (?:(?:https?:)\/\/[^\/]+)?
var uploadsLinkRegex =                  /\/-\/(u|uploads\/public)\/([a-zA-Z0-9\/\._-]+)/;
var uploadsLinkRegexInclEqQuotes = /=['"]\/-\/(u|uploads\/public)\/([a-zA-Z0-9\/\._-]+)['"]/;


export function replaceLinks(md: any) {
  // (Don't exit here if !debiki.uploadsUrlPrefix, because it changes "suddenly"
  // when rendering server side. [5YKF02])

  // (There's always a rules.image.)
  md.renderer.rules.image = makeMarkdownUrlReplacerRule('src', md.renderer.rules.image);

  md.renderer.rules.link_open =
    makeMarkdownUrlReplacerRule('href', md.renderer.rules.link_open || defaultInlineRule);

  md.renderer.rules.html_inline =
    makeHtmlUrlReplacerRule(md, md.renderer.rules.html_inline);
}


function defaultInlineRule(tokens, idx, options, env, self) {
  return self.renderToken(tokens, idx, options);
}


function makeMarkdownUrlReplacerRule(attrName: string, defaultRule) {
  return function(tokens, idx, options, env, self) {
    // (Don't test this earlier, because debiki.uploadsUrlPrefix changes "suddenly"
    // when rendering server side. [5YKF02])
    if (!debiki.uploadsUrlPrefix)
      return defaultRule(tokens, idx, options, env, self);

    var token = tokens[idx];
    var attrIndex = token.attrIndex(attrName);
    if (attrIndex !== -1) {
      var attrNameValue = token.attrs[attrIndex];
      var matches = attrNameValue[1].match(uploadsLinkRegex);
      if (matches) {
        attrNameValue[1] = debiki.uploadsUrlPrefix + matches[2];
      }
    }
    return defaultRule(tokens, idx, options, env, self);
  };
}


function makeHtmlUrlReplacerRule(md, defaultInlineRule) {
  return function(tokens, idx, options, env, self) {
    // (Don't test this earlier, because debiki.uploadsUrlPrefix changes "suddenly"
    // when rendering server side. [5YKF02])
    if (!debiki.uploadsUrlPrefix)
      return defaultInlineRule(tokens, idx, options, env, self);

    // Inside an html tag, replace any /-/u/... (uploads) match with the CDN address.
    var token = tokens[idx];
    var content = token.content;
    token.content = content.replace(
        uploadsLinkRegexInclEqQuotes, '="' + debiki.uploadsUrlPrefix + '$2"');
    return defaultInlineRule(tokens, idx, options, env, self);
  };
}

//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
