/*
 * Copyright (C) 2017 Kaj Magnus Lindberg
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

/// <reference path="../utils/PatternInput.more.ts" />

//------------------------------------------------------------------------------
   namespace debiki2.util {
//------------------------------------------------------------------------------

const r = ReactDOMFactories;

export const UsernameInput = createClassAndFactory({
  displayName: 'UsernameInput',

  getInitialState: function() {
    return { username: '' };
  },

  getValue: function() {
    return this.state.username;
  },

  focus: function() {
    this.refs.patternInput.focus();
  },

  findPatternError: function(value) {
    return this.refs.patternInput.findPatternError(value);
  },

  render: function() {
    const extraHelp = this.props.help ? r.span({}, r.br(), this.props.help) : undefined;
    const username = this.state.username;

    // For now, avoid dots and hyphens in usernames. [CANONUN]
    let defaultValue = this.props.defaultValue;
    if (defaultValue) {
      defaultValue = defaultValue.replace(/[ _.-]+/g, '_');
    }

    const maxLength = username.substr(0, 5) === '__sx_' ? 30 : 20; // [2QWGRC8P]
    return (
      utils.PatternInput({ label: this.props.label, ref: 'patternInput', id: this.props.id,
        className: this.props.className,
        style: this.props.style,
        tabIndex: this.props.tabIndex,
        required: true,
        disabled: this.props.disabled,
        addonBefore: '@', // [7RFWUQ2]
        trim: true,
        minLength: 3,  // [6KKAQDD0]
        maxLength,
        notRegex: / /, notMessage: t.inp.NoSpcs,               // "No spaces please"
        notRegexTwo: /-/, notMessageTwo: t.inp.NoDash,         // "No dashes please" [CANONUN] allow later
        notRegexThree: /@/, notMessageThree: t.inp.DontInclAt, // "Don't include the @"

        // '_' also ok as 1st char, but needn't tell them about that? Hmm no wait a bit [ALWUNDS1]
        regexFour: /^[a-zA-Z0-9].*[a-zA-Z0-9]$/,
        messageFour: t.inp.StartEndLtrDgt,  // "Start and end with a letter or a digit"

        // At this time, don't mention that '.' and '-' are also allowed — better if people only
        // use '_', until canonical usernames has been implemented (so they won't need to remember
        // which one of [_.-] to use — always '_' instead, for now).  [CANONUN]
        // Actually, because of: [UNPUNCT], currently cannot change *to* a username with [.-], only '_'.
        notRegexFour: /[^a-zA-Z0-9_.-]/,
        notMessageFour: t.inp.OnlLtrNumEtc,  // "Only letters (a-z, A-Z) and ..."

        onChange: (value, ok) => {
          this.setState({ username: value });
          this.props.onChangeValueOk(value, ok);
        },
        onBlur: this.props.onBlur,
        defaultValue,
        help: r.span({},
          // "Your @username, unique and short"
          t.inp.UnUnqShrt_1, r.code({}, t.inp.UnUnqShrt_2), t.inp.UnUnqShrt_3, extraHelp) }));
  }
});


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
