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
/// <reference path="../slim-bundle.d.ts" />
/// <reference path="../react-bootstrap-old/Input.more.ts" />

//------------------------------------------------------------------------------
   module debiki2.login {
//------------------------------------------------------------------------------

var r = React.DOM;

// zxcvbn's strongest level is 4, but that makes people confused: they are often
// unable to come up with strong password.
// In fact, level 2 is too high for many people.
var MinPasswordStrength = 1;
var BadPasswordStrength = 3;


export var NewPasswordInput = createClassAndFactory({
  getInitialState: function() {
    return {
      zxcvbnLoaded: false,
      passwordWeakReason: 'too short',
      passwordCrackTimeText: 'instant',
      password: '',
      passwordLength: 0,
      passwordStrength: 0,
      forbiddenWords: [],
      showErrors: false,
    };
  },

  componentWillMount: function() {
     this.checkPasswordStrength = _.throttle(this.checkPasswordStrength, 250);
  },

  componentDidMount: function() {
    // The password strength test library is large, because it contains lists of all words.
    window['yepnope']({
      load:  debiki.internal.assetUrlPrefix + 'zxcvbn.js',
      complete: () => {
        // Check the password afterwards, in case a fast e2e test has already filled it in.
        this.setState({ zxcvbnLoaded: true }, this.checkPasswordStrength);
        dieIf(!window['zxcvbn'], "Error loading the password strength script zxcvbn [EsE7YKW2]");
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
    var password: string = this.getValue();
    var forbiddenWords: string[] = [data.username, 'debiki'];
    var allEmailParts = (data.email || '').split(/[@\._-]+/);
    var allNameParts = (data.fullName || '').split(/\s+/);
    forbiddenWords = forbiddenWords.concat(allEmailParts).concat(allNameParts);
    forbiddenWords = _.filter(forbiddenWords, w => w.length >= 2);
    var passwordStrength = window['zxcvbn'](password, forbiddenWords);

    var crackTimeSecs = passwordStrength.crack_times_seconds.offline_fast_hashing_1e10_per_second;
    var crackTimeText = passwordStrength.crack_times_display.offline_fast_hashing_1e10_per_second;

    console.debug(
        'Password entropy: ' + passwordStrength.entropy +
        ', offline fast crack time: ' + crackTimeSecs + ' = ' + crackTimeText +
        ', score: ' + passwordStrength.score);

    // Don't blindly trust zxcvbn — do some basic tests of our own as well.
    var problem = null;
    if (password.length < 10) {
      problem = 'Too short. Should be at least 10 characters';
    }
    else if (!password.match(/[0-9!@#$%^&*()_\-+`'"=\.,;:{}[\]\\]+/)) {
      problem = 'Please include a digit or special character';
    }
    else if (passwordStrength.score < MinPasswordStrength) {
      problem = 'Too weak';
      if (password.length >= 6) {
        problem += ". Don't use passwords like '12345' or 'abcde'."
      }
    }
    this.setState({
      passwordWeakReason: problem,
      passwordCrackTime: crackTimeSecs,
      passwordCrackTimeText: crackTimeText,
      password: password,
      passwordLength: password.length,
      passwordStrength: passwordStrength.score,
      forbiddenWords: forbiddenWords,
    });
    this.props.setPasswordOk(!problem);
  },

  render: function() {
    var passwordWarning;
    var makeItStrongerSuggestion;
    var tooWeakReason = this.state.passwordWeakReason;
    var badWordWarning;
    var strength: number = this.state.passwordStrength;
    var weakClass = '';
    var length: number = this.state.passwordLength;

    if (this.state.showErrors && length > 0) {
      if (tooWeakReason) {
        passwordWarning = r.b({ style: { color: 'red' } }, tooWeakReason);
      }
      else if (strength <= BadPasswordStrength) {
        // Unfortunately it seems we cannot force people to choose strong passwords,
        // seems they'll just feel annoyed and quit. So this tips will have to do.
        makeItStrongerSuggestion = r.b({ className: 's_Pw_StrongerTips' },
            "Fairly weak.");
      }

      if (strength < MinPasswordStrength) {
        weakClass = 's_Pw_Strength-TooWeak';
      }
      else if (strength < BadPasswordStrength) {
        weakClass = 's_Pw_Strength-FairlyWeak';
      }
      else if (strength == BadPasswordStrength) {
        weakClass = 's_Pw_Strength-OkWeak';
      }

      // People sometimes include their username or full name in their password, or
      // the other way around. Then show a warning.
      let pwdLowercase = this.state.password.toLowerCase();
      let badWord = _.find(this.state.forbiddenWords, (word: string) => {
        return pwdLowercase.indexOf(word.toLowerCase()) !== -1;
      });
      if (badWord) {
        badWordWarning = r.div({ className: 's_Pw_BadWordTips' },
          `Avoid including (parts of) your name or email in the password: "${badWord}"`);
      }

      // 100 computers in the message below? Well, zxcvbn assumes 10ms per guess and 100 cores.
      // My scrypt settings are more like 100-200 ms per guess. So, say 100 ms,
      // and 1 000 cores = 100 computers  -->  can use zxcvbn's default crack time.
          /*  this might be just confusing:
          r.br(), "Offline crack time: " + this.state.passwordCrackTimeText +
          ", with 1e10 attempts per second"); */
    }

    // Strength 4 is max.
    var strengthPercent = 25 * strength;
    if (!strengthPercent && length > 0) {
      // Show some progress, since something has been typed.
      strengthPercent = 10;
    }
    var strengthIndicator = r.div({ className: 's_Pw_Strength ' + weakClass },
      r.span({className: 's_Pw_Strength_Lbl' }, "Strength: ",
        r.div({ className: 's_Pw_Strength_Border' },
          r.div({ className: 's_Pw_Strength_Fill', style: { width: strengthPercent + '%' }}))));

    var passwordHelp = r.div({},
      strengthIndicator,
      passwordWarning, makeItStrongerSuggestion, badWordWarning);

    return (
      r.div({ className: 'form-group s_Pw' + (passwordWarning ? ' has-error' : '') },
        Input({ type: 'password', label: "Password:", name: 'newPassword', ref: 'passwordInput',
            id: 'e2ePassword', onChange: this.checkPasswordStrength, help: passwordHelp,
            tabIndex: this.props.tabIndex,
            onFocus: () => this.setState({ showErrors: true} )})));
  }
});


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
