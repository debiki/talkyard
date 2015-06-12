/*
 * Copyright (C) 2014 Kaj Magnus Lindberg (born 1979)
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


nodejsUtilInherits = function(constructor, superConstructor) {
  constructor.super_ = superConstructor;
  constructor.prototype = Object.create(superConstructor.prototype, {
    constructor: {
      value: constructor,
      enumerable: false,
      writable: true,
      configurable: true
    }
  });
};


nodejsUtilInherits(MentionsRemarkablePlugin, Function);



function MentionsRemarkablePlugin() {
  var plugin = function(remarkable, options) {
    plugin.options = options;
    plugin.init(remarkable);
  };
  plugin.__proto__ = MentionsRemarkablePlugin.prototype;
  // Cannot match '.@(...)' because Remarkable seems to consume all letters,
  // it considers them unimportant and won't feed them to the below parse()
  // function. It sends only '@...' to parse, not any [a-z] before the '@'.
  // So skip the char before the '@', and fetch and check it inside parse()
  // instead.
  plugin.mentionsRegex = /^@[a-zA-Z_]+/;
  plugin.whitespaceRegex = /\s/;
  plugin.id = 'MentionsRemarkablePlugin';
  return plugin;
}


MentionsRemarkablePlugin.prototype.init = function(remarkable) {
  remarkable.inline.ruler.push(this.id, this.parse.bind(this));
  remarkable.renderer.rules[this.id] = this.render.bind(this);
};


MentionsRemarkablePlugin.prototype.parse = function(state, silent) {
  var nextChars = state.src.slice(state.pos);
  var match = nextChars.match(this.mentionsRegex);
  if (!match)
    return false;

  // Ensure there's whitespace before the '@'. Otherwise we might be inside a word
  // — could be an email address, but it's not a mention.
  if (state.pos > 0) {
    var prevChar = state.src[state.pos - 1];
    if (!this.whitespaceRegex.test(prevChar))
      return false;
  }

  // We've found a mention. Advance the cursor.
  state.pos += match[0].length;

  // In silent mode, we shouldn't output anything or push anything to the state.
  if (silent)
    return true;

  var token = state.push('MentionsRemarkablePlugin', '');
  token.level = state.level;
  token.username = nextChars.slice(1, match[0].length);

  return true;
};


MentionsRemarkablePlugin.prototype.render = function(tokens, id, options, env) {
  // The username is [a-zA-Z_] so we don't need to escape it. And besides we sanitize
  // everything later on anyway.
  var username = tokens[id].username;
  var url = '/-/users/#!/username/' + username;
  return '<a class="dw-mention" href="' + url + '">@' + username + '</a>';
};


debiki.internal.MentionsRemarkablePlugin = MentionsRemarkablePlugin;

// vim: fdm=marker et ts=2 sw=2 tw=0 fo=tcqwn list
