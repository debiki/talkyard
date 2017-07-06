/**
 * Copyright (C) 2014-2017 Kaj Magnus Lindberg
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
/// <reference path="./ActivitySummaryEmailsInterval.more.ts" />

//------------------------------------------------------------------------------
   namespace debiki2.users {
//------------------------------------------------------------------------------

const d = { i: debiki.internal, u: debiki.v0.util };
const $: JQueryStatic = d.i.$;
const r = React.DOM;


export const UserPreferencesComponent = React.createClass({
  render: function() {
    const me: Myself = this.props.me;
    const user: MemberInclDetails = this.props.user;

    const mayViewPrefs = isStaff(me) || (me.isAuthenticated && me.id === user.id);

    if (!mayViewPrefs)
      return r.p({}, "Forbidden");

    let anyNotYourPrefsInfo;
    if (me.id !== user.id) {
      const prefsAndCanBecause = " preferences. You can do that, because you're an administrator.";
      anyNotYourPrefsInfo = user.isGroup
        ? r.p({}, "You are editing a ", r.b({}, "group's"), prefsAndCanBecause)
        : r.p({}, "You are editing ", r.b({}, "another"), " user's" + prefsAndCanBecause);
    }

    const preferences = isGuest(user)
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
      sendSummaryEmails: user.summaryEmailIntervalMins !== DisableSummaryEmails,
      summaryEmailIntervalMins: user.summaryEmailIntervalMins,
      summaryEmailIfActive: user.summaryEmailIfActive,
    };
  },

  componentWillUnmount: function() {
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

  enableSummaryEmails: function(event) {
    const shallSend = event.target.checked;
    const summaryEmailIntervalMins =
        shallSend && this.state.summaryEmailIntervalMins === DisableSummaryEmails ?
          7 * 24 * 60 : this.state.summaryEmailIntervalMins; // default to one week
    this.setState({
      sendSummaryEmails: shallSend,
      summaryEmailIntervalMins: summaryEmailIntervalMins,
    });
  },

  badPrefs: function() {
    return this.state.isUsernameBad || this.state.isFullNameBad;
  },

  savePrefs: function(event) {
    event.preventDefault();
    var form = $(event.target);  // :- (
    const summaryEmailIntervalMins = this.state.sendSummaryEmails ?
        this.state.summaryEmailIntervalMins : DisableSummaryEmails;
    const prefs = {
      userId: this.props.user.id,
      fullName: this.state.fullName,
      username: this.state.username,
      emailAddress: form.find('#emailAddress').val(),
      summaryEmailIntervalMins: summaryEmailIntervalMins,
      summaryEmailIfActive: this.state.summaryEmailIfActive,
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
    const me: Myself = this.props.me;
    const user: MemberInclDetails = this.props.user;
    const username = user.username || '(not specified)';

    // These ids = hardcoded users & groups, e.g. System and Everyone.
    const isBuiltInUser = user.id < LowestAuthenticatedUserId;

    let savingInfo = null;
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
            isBuiltInUser ? null : r.button({ className: 'btn btn-default s_UP_Prefs_ChangeUNB',
              onClick: this.tryChangeUsername }, "Change ...")));
    }
    else {
      usernameStuff =
        util.UsernameInput({ label: "Username", defaultValue: username, className: 's_UP_Prefs_UN',
            onChangeValueOk: (value, isOk) => this.updateUsernameOk(value, isOk),
            help: r.b({ className: 's_UP_Prefs_UN_Help' },
              "You may change it only a few times.") });
    }

    const sendSummaryEmails = this.state.sendSummaryEmails;

    const summariesText = " summaries of popular topics and other stuff.";
    const activitySummaryDescr = user.isGroup
        ? "When members of this group don't visit here, then, by default, email them" + summariesText
        : "When I don't visit here, email me" + summariesText;

    const emailIfVisitRegularly = (user.isGroup ? "Email me also if I" : "Email them also if they") +
        " visit here regularly.";

    const howOftenSend = user.isGroup ? "How often shall we send" : "How often do you want";
    const activitySummaryStuff =
      r.div({ className: 'form-group', style: { margin: '22px 0 25px' } },
        r.label({}, "Activity summary emails"),  // more like a mini title
        r.div({ className: 'checkbox' },  // [7PK4WY1]
          r.label({},
            r.input({ type: 'checkbox', id: 'sendSummaryEmails',
              checked: this.state.sendSummaryEmails, onChange: this.enableSummaryEmails }),
            activitySummaryDescr)),
        r.div({ className: 'checkbox' },
          r.label({},
            r.input({ type: 'checkbox', id: 'summaryEmailIfActive',
              checked: this.state.summaryEmailIfActive, disabled: !sendSummaryEmails,
              onChange: (event) => this.setState({ summaryEmailIfActive: event.target.checked })}),
            emailIfVisitRegularly)),
        r.p({ style: { marginBottom: 5 } }, howOftenSend + " these emails?"),
        ActivitySummaryEmailsIntervalDropdown({ onSelect: (frequencyMins) => {
          this.setState({ summaryEmailIntervalMins: frequencyMins });
        }, intervalMins: this.state.summaryEmailIntervalMins, disabled: !sendSummaryEmails }));


    return (
      r.form({ role: 'form', onSubmit: this.savePrefs },

        util.FullNameInput({ label: "Name (optional)", defaultValue: user.fullName,
            className: 'e_UP_Prefs_FN', disabled: isBuiltInUser,
            onChangeValueOk: (newName, isOk) => this.updateFullNameOk(newName, isOk) }),

        usernameStuff,

        // Disable the email input — I've not implemented confirmation-emails-to-new-address
        // or any double-check-password-before-changing-email.
        isBuiltInUser ? null : r.div({ className: 'form-group' },
          r.label({ htmlFor: 'emailAddress' }, "Email address"),
          r.input({ type: 'email', className: 'form-control', id: 'emailAddress',
              defaultValue: user.email, disabled: true }),
          r.p({ className: 'help-block' }, "Not shown publicly.")),

        activitySummaryStuff,

        isBuiltInUser ? null : r.div({ className: 'form-group' },
          r.label({ htmlFor: 't_UP_AboutMe' }, "About you"),
          r.textarea({ className: 'form-control', id: 't_UP_Prefs_AboutMeTA',
              defaultValue: user.about || '' })),

        // Later: Verify is really an URL
        isBuiltInUser ? null : r.div({ className: 'form-group' },
          r.label({ htmlFor: 'url' }, 'URL'),
          r.input({ className: 'form-control', id: 'url',
              defaultValue: user.url }),
          r.p({ className: 'help-block' }, 'Any website or page of yours.')),

        // Later: + Location

        (isBuiltInUser || !isStaff(me) ? null :  // currently for staff only [EsE7YKF24]
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
