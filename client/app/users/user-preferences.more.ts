/**
 * Copyright (C) 2014-2015 Kaj Magnus Lindberg
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
/// <reference path="../util/UsernameInput.more.ts" />

//------------------------------------------------------------------------------
   namespace debiki2.users {
//------------------------------------------------------------------------------

var d = { i: debiki.internal, u: debiki.v0.util };
var $: JQueryStatic = d.i.$;
var r = React.DOM;


export var UserPreferencesComponent = React.createClass({
  render: function() {
    var me: Myself = this.props.me;
    var user: MemberInclDetails = this.props.user;

    var mayViewPrefs = isStaff(me) || (me.isAuthenticated && me.id === user.id);

    if (!mayViewPrefs)
      return r.p({}, "Forbidden");

    var anyNotYourPrefsInfo = null;
    if (me.id !== user.id) {
      anyNotYourPrefsInfo =
        r.p({}, "You are editing ", r.b({}, 'another '),
          "user's preferences. You can do that, because you're an administrator.");
    }

    var preferences = isGuest(user)
        ? GuestPreferences({ guest: user })
        : MemberPreferences({ user: user, me: me, reloadUser: this.props.reloadUser });

    return (
      r.div({ className: 's_UP_Prefs' },
        anyNotYourPrefsInfo,
        preferences));
  }
});


var GuestPreferences = createComponent({
  getInitialState: function() {
    return {};
  },

  savePrefs: function(event) {
    event.preventDefault();
    var form = $(event.target);
    var prefs = {
      guestId: this.props.guest.id,
      name: form.find('#fullName').val(),
    };
    Server.saveGuest(prefs, () => {
      this.setState({ savingStatus: 'Saved' });
    });
    this.setState({ savingStatus: 'Saving' });
  },

  render: function() {
    var guest: Guest = this.props.guest;

    var savingInfo = null;
    if (this.state.savingStatus === 'Saving') {
      savingInfo = r.i({}, ' Saving...');
    }
    else if (this.state.savingStatus === 'Saved') {
      savingInfo = r.i({}, ' Saved.');
    }

    return (
      r.form({ role: 'form', onSubmit: this.savePrefs },

        r.div({ className: 'form-group' },
          r.label({ htmlFor: 'fullName' }, 'Name'),
          r.input({ className: 'form-control', id: 'fullName',
              defaultValue: guest.fullName })),

        r.div({ className: 'form-group' },
          r.label({ htmlFor: 'emailAddress' }, 'Email address'),
          r.input({ type: 'email', className: 'form-control', id: 'emailAddress',
              defaultValue: guest.email, disabled: true }),
          r.p({ className: 'help-block' }, 'Not shown publicly. Cannot be changed.')),

        InputTypeSubmit({ id: 'e2eUP_Prefs_SaveB', value: "Save" }),
        savingInfo));
  }
});


var MemberPreferences = createComponent({
  getInitialState: function() {
    let user: MemberInclDetails = this.props.user;
    return {
      fullName: user.fullName,
      username: user.username,
    };
  },

  componentDidUnmount: function() {
    this.isGone = true;
  },

  updateFullNameOk: function(newFullName: string, isOk: boolean) {
    this.setState({
      fullName: newFullName,
      isFullNameBad: !isOk,
    });
  },

  updateUsernameOk: function(newUsername: string, isOk: boolean) {
    this.setState({
      username: newUsername,
      isUsernameBad: !isOk,
    });
  },

  tryChangeUsername: function() {
      util.openDefaultStupidDialog({
        body: r.div({},
          r.p({}, "You may change your username only a few times."),
          r.p({}, "Changing it too often can make others confused — " +
                    "they won't know how to @mention you.")) });
      this.setState({ showUsernameInput: true });
  },

  badPrefs: function() {
    return this.state.isUsernameBad || this.state.isFullNameBad;
  },

  savePrefs: function(event) {
    event.preventDefault();
    var form = $(event.target);
    var prefs = {
      userId: this.props.user.id,
      fullName: this.state.fullName,
      username: this.state.username,
      emailAddress: form.find('#emailAddress').val(),
      about: form.find('#t_UP_Prefs_AboutMeTA').val(),
      url: form.find('#url').val(),
      emailForEveryNewPost: form.find('#emailForEveryNewPost').is(':checked')
    };
    // This won't update the name in the name-login-button component. But will
    // be automatically fixed when I've ported everything to React and use
    // some global React state instead of cookies to remember the user name.
    Server.saveUserPreferences(prefs, () => {
      if (this.isGone) return;
      this.setState({
        savingStatus: 'Saved',
        showUsernameInput: false,
      });
      this.props.reloadUser(false);
    });
    this.setState({ savingStatus: 'Saving' });
  },

  render: function() {
    var me: Myself = this.props.me;
    var user: MemberInclDetails = this.props.user;
    var username = user.username || '(not specified)';

    var savingInfo = null;
    if (this.state.savingStatus === 'Saving') {
      savingInfo = r.i({}, ' Saving...');
    }
    else if (this.state.savingStatus === 'Saved') {
      savingInfo = r.i({}, ' Saved.');
    }

    let usernameStuff;
    if (!this.state.showUsernameInput) {
      usernameStuff =
        r.div({ className: 'form-group' },
          r.label({}, 'Username'),
          r.div({},
            r.samp({}, username),
            r.button({ className: 'btn btn-default s_UP_Prefs_ChangeUNB',
              onClick: this.tryChangeUsername }, "Change ...")));
    }
    else {
      usernameStuff =
        util.UsernameInput({ label: "Username", defaultValue: username, className: 's_UP_Prefs_UN',
            onChangeValueOk: (value, isOk) => this.updateUsernameOk(value, isOk),
            help: r.b({ className: 's_UP_Prefs_UN_Help' },
              "You may change it only a few times.") });
    }

    return (
      r.form({ role: 'form', onSubmit: this.savePrefs },

        util.FullNameInput({ label: "Name (optional)", defaultValue: user.fullName,
            className: 'e_UP_Prefs_FN',
            onChangeValueOk: (newName, isOk) => this.updateFullNameOk(newName, isOk) }),

        usernameStuff,

        // Disable the email input — I've not implemented confirmation-emails-to-new-address
        // or any double-check-password-before-changing-email.
        r.div({ className: 'form-group' },
          r.label({ htmlFor: 'emailAddress' }, 'Email address'),
          r.input({ type: 'email', className: 'form-control', id: 'emailAddress',
              defaultValue: user.email, disabled: true }),
          r.p({ className: 'help-block' }, 'Not shown publicly.')),

        r.div({ className: 'form-group' },
          r.label({ htmlFor: 't_UP_AboutMe' }, "About you"),
          r.textarea({ className: 'form-control', id: 't_UP_Prefs_AboutMeTA',
              defaultValue: user.about || '' })),

        // Later: Verify is really an URL
        r.div({ className: 'form-group' },
          r.label({ htmlFor: 'url' }, 'URL'),
          r.input({ className: 'form-control', id: 'url',
              defaultValue: user.url }),
          r.p({ className: 'help-block' }, 'Any website or page of yours.')),

        // Later: + Location

        (!isStaff(me) ? null :  // currently for staff only [EsE7YKF24]
        r.div({ className: 'form-group' },
          r.div({ className: 'checkbox' },
            r.label({},
              r.input({ type: 'checkbox', id: 'emailForEveryNewPost',
                defaultChecked: user.emailForEveryNewPost }),
              "Be notified about every new post (unless you mute the topic or category)")))),

        InputTypeSubmit({ id: 'e2eUP_Prefs_SaveB', value: "Save", disabled: this.badPrefs() }),
        savingInfo));

    /* Discoruse's email options:
    'When you do not visit the site, send an email digest of what is new:'
    'daily/weekly/every two weeks'
    'Receive an email when someone sends you a private message'
    'Receive an email when someone quotes you, replies to your post, or mentions your @username'
    'Do not suppress email notifications when I am active on the site'
    */
  }
});


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
