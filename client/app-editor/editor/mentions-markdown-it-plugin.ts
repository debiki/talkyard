/*
 * Copyright (c) 2014-2023 Kaj Magnus Lindberg
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
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */


// Cannot match '.@(...)' because markdown-it seems to consume all letters,
// it considers them unimportant and won't feed them to the below parse()
// function. It sends only '@...' to parse, not any [a-z] before the '@'.
// So skip the char before the '@', and fetch and check it inside parse()
// instead.
// [.-] are allowed inside the username only (not as first or last chars). [UNPUNCT] [UNAMECHARS]
// None of [_.-] allowed as last char.  Currently min length is 3, but later
// there'll be a site config value that lets one change to 2? So allow 2 here.
const mentionsRegex = /^@[a-zA-Z0-9_][a-zA-Z0-9_.-]*[a-zA-Z0-9]/;   // [4LKBG782]
const whitespaceRegex = /\s/;
const pluginId = 'MentionsMarkdownItPlugin';


function MentionsMarkdownItPlugin(md, options) {
  md.inline.ruler.push(pluginId, parseAnyMentions);
  md.renderer.rules[pluginId] = renderAnyMentions;
};


function parseAnyMentions(state, silent) {
  const nextChars = state.src.slice(state.pos);
  const match = nextChars.match(mentionsRegex);
  if (!match)
    return false;

  // Ensure there's whitespace before the '@'. Otherwise we might be inside a word
  // — could be an email address, but it's not a mention.
  if (state.pos > 0) {
    const prevChar = state.src[state.pos - 1];
    if (!whitespaceRegex.test(prevChar))
      return false;
  }

  // We've found a mention. Advance the cursor.
  state.pos += match[0].length;

  // In silent mode, we shouldn't output anything or push anything to the state.
  if (silent)
    return true;

  const token = state.push(pluginId, '');
  token.level = state.level;
  token.username = nextChars.slice(1, match[0].length);

  return true;
};


function renderAnyMentions(tokens, id, options, env) {
  // The username is [a-zA-Z_0-9] so we don't need to escape it. And besides we sanitize
  // everything later on anyway.
  const username = tokens[id].username;

  // Make @mentions found available server side.
  if (debiki.mentionsServerHelp) {
    debiki.mentionsServerHelp.push(username);
  }

  // In embedded comments discussions, the /-/users/ local links would resolve to
  // https://the.EMBEDDING.site/-/users/ — so in hack.ts [6JKD2A] they're changed
  // to point to the Talkyard server instead. (Also see: [EMBCMTSORIG])
  return '<a class="esMention" href="/-/users/' + username + '">@' + username + '</a>';
};


debiki.internal.MentionsMarkdownItPlugin = MentionsMarkdownItPlugin;


// vim: fdm=marker et ts=2 sw=2 tw=0 fo=tcqwn list
