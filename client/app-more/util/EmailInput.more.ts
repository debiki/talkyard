/*
 * Copyright (c) 2016 Kaj Magnus Lindberg
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


export var EmailInput = createClassAndFactory({
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
    const defaultValue = this.props.defaultValue ? this.props.defaultValue.toLowerCase() : undefined;
    return (
      utils.PatternInput({ label: this.props.label, ref: 'patternInput', id: this.props.id,
        className: this.props.className, placeholder: this.props.placeholder,
        required: this.props.required, style: this.props.style,
        help: this.props.help, tabIndex: this.props.tabIndex,
        lowercase: true,
        regex: /.+/, message: t.inp.EmReq, // "Email required"
        trim: true,
        notRegex: /\s/, notMessage: t.inp.NoSpcs,
        regexTwo: /^[^@]+@[^-@\.][^@\.]*\.[^@]+[^-@\.]$/, messageTwo: t.inp.InvldAddr, // "Not valid addr"
        notRegexThree: /['"`\/\\\#\?\!,%\^\$\&\*\[\]\(\)\{\}\:]$/,
        notMessageThree: t.inp.NoBadChrs, // "No weird characters please"
        error: this.props.error,
        onChange: this.props.onChangeValueOk, disabled: this.props.disabled,
        defaultValue }));
  }
});


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
