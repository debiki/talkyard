/*
 * Copyright (C) 2015 Kaj Magnus Lindberg
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
/// <reference path="../ReactStore.ts" />
/// <reference path="../Server.ts" />

//------------------------------------------------------------------------------
   module debiki2.login {
//------------------------------------------------------------------------------

var d = { i: debiki.internal, u: debiki.v0.util };
var r = React.DOM;
var reactCreateFactory = React['createFactory'];
var ReactBootstrap: any = window['ReactBootstrap'];
var Input = reactCreateFactory(ReactBootstrap.Input);

// zxcvbn's strongest level is 4.
var MinPasswordStrength = 4;

var HalfACenturyInSeconds = 50*365*24*3600;


export var NewPasswordInput = createClassAndFactory({
  getInitialState: function() {
    return {
      zxcvbnLoaded: false,
      passwordWeakReason: 'too short',
      passwordCrackTimeText: 'instant',
      passwordStrength: 0,
    };
  },

  componentWillMount: function() {
     this.checkPasswordStrength = _.throttle(this.checkPasswordStrength, 250);
  },

  componentDidMount: function() {
    // The password strength test library is large, because it contains lists of all words.
    window['yepnope']({
      load:  debiki.internal.assetsUrlPathStart + 'zxcvbn.js',
      complete: () => {
        this.setState({ zxcvbnLoaded: true });
      }
    });
  },

  getValue: function() {
    return this.refs.passwordInput.getValue();
  },

  checkPasswordStrength: function() {
    if (!this.state.zxcvbnLoaded)
      return;

    var data = this.props.newPasswordData;
    var password = this.getValue();
    var forbiddenWords = [data.email, data.username, 'debiki'];
    var allNameParts = data.fullName.split(/\s+/);
    forbiddenWords = forbiddenWords.concat(allNameParts);
    var passwordStrength = window['zxcvbn'](password, forbiddenWords);

    console.debug(
        'Password entropy: ' + passwordStrength.entropy +
        ', crack_time: ' + passwordStrength.crack_time +
        ' = ' + passwordStrength.crack_time_display +
        ', score: ' + passwordStrength.score);

    // Don't blindly trust zxcvbn — do some basic tests of our own as well.
    var problem = null;
    if (password.length < 8) {
      problem = 'too short, should be at least 8 characters';
    }
    else if (!password.match(/[0-9!@#$%^&*()_+`=;:{}[\]\\]+/)) {
      problem = 'no digit or special character';
    }
    else if (passwordStrength.score < 4 || passwordStrength.crack_time < HalfACenturyInSeconds) {
      problem = 'too weak';
    }
    this.setState({
      passwordWeakReason: problem,
      passwordCrackTimeText: passwordStrength.crack_time_display,
      passwordStrength: passwordStrength.score,
    });
    this.props.setPasswordOk(!problem);
  },

  render: function() {
    var passwordWarning;
    if (this.state.passwordWeakReason) {
      // 100 computers in the message below? Well, zxcvbn assumes 10ms per guess and 100 cores.
      // My scrypt settings are more like 100-200 ms per guess. So, say 100 ms,
      // and 1 000 cores = 100 computers  -->  can use zxcvbn's default crack time.
      passwordWarning = r.span({ style: { color: 'red' }}, r.span({},
          "Bad password: " + this.state.passwordWeakReason,
          r.br(), "Crack time: " + this.state.passwordCrackTimeText +
          ", with 100 computers and the scrypt hash"));
    }
    return (
      Input({ type: 'password', label: "Password:", name: 'newPassword', ref: 'passwordInput',
          id: 'e2ePassword', onChange: this.checkPasswordStrength, help: passwordWarning }));
  }
});


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
