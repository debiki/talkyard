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

/// <reference path="../../typedefs/react/react.d.ts" />
/// <reference path="../slim-bundle.d.ts" />
/// <reference path="../react-bootstrap-old/Input.more.ts" />
/// <reference path="new-password-input.more.ts" />

//------------------------------------------------------------------------------
   namespace debiki2.login {
//------------------------------------------------------------------------------

var r = React.DOM;


export function renderNewPasswordPage(secretKey: string) {
  var data = window['newPasswordData'];
  data.xsrfToken = $['cookie']('XSRF-TOKEN');
  ReactDOM.render(NewPasswordPage(data),
      document.getElementById('dw-react-new-password'));
}


var NewPasswordPage = createClassAndFactory({
  getInitialState: function() {
    return { passwordOk: false };
  },

  setPasswordOk: function(passwordOk: boolean) {
    this.setState({ passwordOk: passwordOk });
  },

  render: function () {
    var oldPasswordInput;
    if (!this.props.secretKey) {
      oldPasswordInput = r.p({}, '__ old pwd here, unimplemented [DwE4KGE30] __');
      // label for="oldPassword">Enter your current password:</label>
      // input type="password" id="oldPassword" name="oldPassword" value="" class="form-control">
    }
    return (
      r.form({ method: 'POST' },
        Input({ type: 'hidden', name: 'dw-fi-xsrf', value: this.props.xsrfToken }),
        Input({ type: 'hidden', name: 'emailId', value: this.props.resetPasswordEmailId }),
        oldPasswordInput,
        NewPasswordInput({ newPasswordData: this.props, setPasswordOk: this.setPasswordOk }),
        InputTypeSubmit({ disabled: !this.state.passwordOk, value: "Submit",
            id: 'e2eSubmit' })));
  }
});


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
