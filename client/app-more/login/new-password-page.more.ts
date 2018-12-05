/*
 * Copyright (C) 2015-2016 Kaj Magnus Lindberg
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

/// <reference path="../more-prelude.more.ts" />
/// <reference path="../react-bootstrap-old/Input.more.ts" />
/// <reference path="new-password-input.more.ts" />

//------------------------------------------------------------------------------
   namespace debiki2.login {
//------------------------------------------------------------------------------

const r = ReactDOMFactories;


export function renderNewPasswordPage(secretKey: string) {
  const props = window['newPasswordData'];
  props.xsrfToken = getSetCookie('XSRF-TOKEN');
  ReactDOM.render(NewPasswordPage(props),
      document.getElementById('dw-react-new-password'));
}


const NewPasswordPage = createClassAndFactory({
  getInitialState: function() {
    return { passwordOk: false };
  },

  setPasswordOk: function(passwordOk: boolean) {
    this.setState({ passwordOk: passwordOk });
  },

  render: function () {
    let oldPasswordInput;
    if (!this.props.resetPasswordEmailId) {
      oldPasswordInput = r.p({}, '__ old pwd here, unimplemented [DwE4KGE30] __');
      // label for="oldPassword">Enter your current password:</label>  // I18N
      // input type="password" id="oldPassword" name="oldPassword" value="" class="form-control">
    }
    else {
      oldPasswordInput = r.span({ className: 'e_NoOldPwI' });
    }

    return (
      r.form({ method: 'POST' },
        Input({ type: 'hidden', name: 'dw-fi-xsrf', value: this.props.xsrfToken }),
        Input({ type: 'hidden', name: 'emailId', value: this.props.resetPasswordEmailId }),
        oldPasswordInput,
        NewPasswordInput({ newPasswordData: this.props, minLength: this.props.minLength,
            setPasswordOk: this.setPasswordOk }),
        InputTypeSubmit({ disabled: !this.state.passwordOk, value: "Submit",  // I18N
            className: 'e_SbmNewPwB' })));
  }
});


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
