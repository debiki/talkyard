/*
 * Copyright (c) 2015, 2017 Kaj Magnus Lindberg
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

/// <reference path="../react-bootstrap-old/Input.more.ts" />

//------------------------------------------------------------------------------
   namespace debiki2.utils {
//------------------------------------------------------------------------------

const r = ReactDOMFactories;


export const PatternInput = createClassAndFactory({  // I18N search for all usages, I've forgotten e.g. UsernameInput
  getInitialState: function() {
    return {
      showErrors: (this.props || <any> {}).showErrors,
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
    // (If should trim value, don't trim the value displayed in the input —
    // feels as if the keyboard is broken, if typing a space and nothing happens.
    // Just trim the leading & trailing spaces, in the value that actually gets used.)
    const valueNotTrimmed = event.target.value;
    const valueMaybeTrimmed = this.props.trim ? valueNotTrimmed.trim() : valueNotTrimmed;
    const anyError = this.findAnyError(valueMaybeTrimmed);
    this.setState({ value: valueNotTrimmed, hasError: !!anyError });
    const onChangeValuOk = this.props.onChangeValueOk || this.props.onChange;
    if (onChangeValuOk) {
      onChangeValuOk(valueMaybeTrimmed, !anyError);
    }
  },

  componentDidUpdate: function() {
    const valueMaybeTrimmed = this.props.trim ? this.state.value.trim() : this.state.value;
    const hasError = !!this.findAnyError(valueMaybeTrimmed);
    if (hasError !== this.state.hasError) {
      this.setState({ hasError: hasError });
      // We got new props (perhaps this.props.error?) and now we're okay or broken, instead.
      const onChangeValuOk = this.props.onChangeValueOk || this.props.onChange;
      if (onChangeValuOk) {
        onChangeValuOk(valueMaybeTrimmed, !hasError);
      }
    }
  },

  componentWillUnmount: function() {
    this.isGone = true;
  },

  showErrorsSoon: function() {
    clearTimeout(this.showErrorsTimeoutHandle);
    this.showErrorsTimeoutHandle = setTimeout(() => {
      if (this.isGone) return;
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

    const lengthError = this.checkLength(value);
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
      return t.inp.TooShort(this.props.minLength);

    if (this.props.maxLength && value.length > this.props.maxLength)
      return t.inp.TooLong(this.props.minLength);

    return null;
  },

  render: function() {
    let anyError;
    if (this.state.showErrors || this.props.error) {
      anyError = this.findAnyError(this.props.trim ? this.state.value.trim() : this.state.value);
      if (anyError && _.isString(anyError)) {
        anyError = r.b({ style: { color: 'red' }}, anyError);
      }
    }
    return (
      r.div({ style: this.props.style },
        Input({ type: 'text', id: this.props.id, className: this.props.className, ref: 'theInput',
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
