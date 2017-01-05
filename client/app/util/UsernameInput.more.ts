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

/// <reference path="../../typedefs/react/react.d.ts" />
/// <reference path="../utils/PatternInput.more.ts" />

//------------------------------------------------------------------------------
   namespace debiki2.util {
//------------------------------------------------------------------------------

var r = React.DOM;

// SHOULD reuse in create-user-dialog.more.ts [76KWU02]
export var UsernameInput = createClassAndFactory({
  getValue: function() {
    return this.refs.patternInput.getValue();
  },

  focus: function() {
    this.refs.patternInput.focus();
  },

  findPatternError: function(value) {
    return this.refs.patternInput.findPatternError(value);
  },

  render: function() {
    let extraHelp = this.props.help ? r.span({}, r.br(), this.props.help) : undefined;
    return (
      utils.PatternInput({ label: this.props.label, ref: 'patternInput', id: this.props.id,
        className: this.props.className,
        style: this.props.style,
        tabIndex: this.props.tabIndex,
        required: true,
        disabled: this.props.disabled,
        addonBefore: '@',
        minLength: 3, maxLength: 20,
        notRegex: / /, notMessage: "No spaces please",
        notRegexTwo: /-/, notMessageTwo: "No hypens (-) please",
        notRegexThree: /@/, notMessageThree: "Don't include the @",
        notRegexFour: /[^a-zA-Z0-9_]/,
        notMessageFour: "Only letters a-z A-Z and 0-9 and _",
        onChange: this.props.onChangeValueOk,
        onBlur: this.props.onBlur,
        defaultValue: this.props.defaultValue,
        help: r.span({}, "Your ", r.code({}, "@username"), ", unique and short", extraHelp) }));
  }
});


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
