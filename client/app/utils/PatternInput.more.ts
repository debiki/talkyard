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
/// <reference path="../react-bootstrap-old/Input.more.ts" />

//------------------------------------------------------------------------------
   module debiki2.utils {
//------------------------------------------------------------------------------

var r = React.DOM;


export var PatternInput = createClassAndFactory({
  getInitialState: function() {
    return {
      showErrors: (this.props || {}).showErrors,
      value: this.props.defaultValue || "",
    };
  },

  focus: function() {
    this.refs.theInput.getInputDOMNode().focus();
  },

  getValue: function() {
    return this.state.value;
  },

  onChange: function(event) {
    var anyError = this.findAnyError(event.target.value);
    this.setState({ value: event.target.value, hasError: !!anyError });
    var onChangeValuOk = this.props.onChangeValueOk || this.props.onChange;
    if (onChangeValuOk) {
      onChangeValuOk(event.target.value, !anyError);
    }
  },

  componentDidUpdate: function() {
    var hasError = !!this.findAnyError(this.state.value);
    if (hasError !== this.state.hasError) {
      this.setState({ hasError: hasError });
      // We got new props (perhaps this.props.error?) and now we're okay or broken, instead.
      var onChangeValuOk = this.props.onChangeValueOk || this.props.onChange;
      if (onChangeValuOk) {
        onChangeValuOk(this.state.value, !hasError);
      }
    }
  },

  componentWillUnmount: function() {
    this.hasUnmounted = true;
  },

  showErrorsSoon: function() {
    clearTimeout(this.showErrorsTimeoutHandle);
    this.showErrorsTimeoutHandle = setTimeout(() => {
      if (this.hasUnmounted) return;
      this.showErrors();
    }, 3000);
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

    if (this.props.lastRegex && !this.props.lastRegex.test(value))
      return this.props.lastMessage;

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
      if (anyError && _.isString(anyError)) {
        anyError = r.b({ style: { color: 'red' }}, anyError);
      }
    }
    return (
      r.div({ style: this.props.style },
        Input({ type: 'text', id: this.props.id, className: 'form-control', ref: 'theInput',
          // wrapperClassName: anyError ? ' has-error' : '', — no don't, makes the input lose focus
          label: this.props.label,
          addonBefore: this.props.addonBefore,
          placeholder: this.props.placeholder, onChange: this.onChange,
          tabIndex: this.props.tabIndex, onBlur: () => {
            this.showErrors();
            if (this.props.onBlur) this.props.onBlur();
          },
          disabled: this.props.disabled, value: this.state.value, onFocus: this.showErrorsSoon,
          help: this.props.help }),
        anyError));
  }
});


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
