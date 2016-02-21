/*
 * Copyright (c) 2015 Kaj Magnus Lindberg
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
/// <reference path="../plain-old-javascript.d.ts" />

//------------------------------------------------------------------------------
   module debiki2.utils {
//------------------------------------------------------------------------------

var d = { i: debiki.internal, u: debiki.v0.util };
var r = React.DOM;


export var PatternInput = createClassAndFactory({
  getInitialState: function() {
    return {
      showErrors: (this.props || {}).showErrors,
      value: this.props.defaultValue || "",
    };
  },

  getValue: function() {
    return this.state.value;
  },

  onChange: function(event) {
    this.setState({ value: event.target.value });
    var anyError = this.findAnyError(event.target.value);
    this.props.onChange(event.target.value, !anyError);
  },

  showErrors: function() {
    this.setState({ showErrors: true });
  },

  findAnyError: function(value: string) {
    return this.findPatternError(value) || this.props.error;
  },

  findPatternError: function(value) {
    if (this.props.required === false && _.isEmpty(value))
      return null;

    var lengthError = this.checkLength(value);
    if (this.props.testLengthFirst && lengthError)
      return lengthError;

    if (this.props.regex && !this.props.regex.test(value))
      return this.props.message;

    if (this.props.notRegex && this.props.notRegex.test(value))
      return this.props.notMessage;

    if (this.props.regexTwo && !this.props.regexTwo.test(value))
      return this.props.messageTwo;

    if (this.props.notRegexTwo && this.props.notRegexTwo.test(value))
      return this.props.notMessageTwo;

    if (this.props.regexThree && !this.props.regexThree.test(value))
      return this.props.messageThree;

    if (this.props.notRegexThree && this.props.notRegexThree.test(value))
      return this.props.notMessageThree;

    if (this.props.regexFour && !this.props.regexFour.test(value))
      return this.props.messageFour;

    if (this.props.notRegexFour && this.props.notRegexFour.test(value))
      return this.props.notMessageFour;

    if (lengthError)
      return lengthError;

    return null;
  },

  checkLength: function(value: string) {
    if (this.props.minLength && value.length < this.props.minLength)
      return 'Should be at least ' + this.props.minLength + ' characters';

    if (this.props.maxLength && value.length > this.props.maxLength)
      return 'Too long. Should be at most ' + this.props.maxLength + ' characters';

    return null;
  },

  render: function() {
    var anyError;
    if (this.state.showErrors || this.props.error) {
      var anyError = this.findAnyError(this.state.value);
      if (anyError) {
        anyError = r.b({ style: { color: 'red' }}, anyError);
      }
    }
    return (
      r.div({ className: 'form-group' + (anyError ? ' has-error' : '') },
        r.label({ htmlFor: this.props.id }, this.props.label),
        r.br(),
        r.input({ type: 'text', id: this.props.id, className: 'form-control',
            placeholder: this.props.placeholder, onChange: this.onChange,
            disabled: this.props.disabled, value: this.state.value, onFocus: this.showErrors }),
        r.p({ className: 'help-block' }, this.props.help),
        anyError));
  }
});


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
