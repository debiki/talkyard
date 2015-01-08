/**
 * Copyright (C) 2014 Kaj Magnus Lindberg (born 1979)
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
/// <reference path="../../typedefs/moment/moment.d.ts" />
/// <reference path="../Server.ts" />


//------------------------------------------------------------------------------
   module debiki2.users {
//------------------------------------------------------------------------------

var d = { i: debiki.internal, u: debiki.v0.util };
var $: JQueryStatic = d.i.$;
var r = React.DOM;
var reactCreateFactory = React['createFactory'];
var ReactBootstrap: any = window['ReactBootstrap'];
var Button = reactCreateFactory(ReactBootstrap.Button);
var RouterState = window['ReactRouter'].State;
var RouterNavigation = window['ReactRouter'].Navigation;
import UserPreferences = debiki2.users.UserPreferences;


export var UserPreferencesComponent = React.createClass({
  mixins: [RouterState, RouterNavigation, debiki2.StoreListenerMixin],

  getInitialState: function() {
    return {
      loggedInUser: debiki2.ReactStore.getUser()
    };
  },

  onChange: function() {
    this.state.loggedInUser = debiki2.ReactStore.getUser();
    this.setState(this.state);
  },

  onBackBtnClick: function() {
    this.goBack();
  },

  render: function() {
    var params = this.getParams();
    var isNewUrl = this.state.userId !== params.userId;
    if (isNewUrl) {
      // Should do this from componentWillReceiveProps() or componentDidMount() instead?
      Server.loadUserPreferences(params.userId, (prefs: UserPreferences) => {
        this.state.userId = params.userId;
        this.state.userPreferences = prefs;
        this.setState(this.state);
      });
      return r.p({}, 'Loading...');
    }

    if (!this.state.userPreferences)
      return r.p({}, 'User not found');

    var loggedInUser = this.state.loggedInUser;
    var mayViewPrefs = loggedInUser && loggedInUser.isAuthenticated && (
        loggedInUser.isAdmin || loggedInUser.userId === params.userId);

    if (!mayViewPrefs)
      return r.p({}, 'Forbidden');

    var anyNotYourPrefsInfo = null;
    if (loggedInUser.userId !== params.userId) {
      anyNotYourPrefsInfo =
        r.p({}, "You are editing ", r.b({}, 'another'),
          "user's preferences. You can do that, because you're an administrator.");
    }

    return (
      r.div({ className: 'users-page' },
        Button({ onClick: this.onBackBtnClick, className: 'pull-right' }, 'Back'),
        r.h1({}, 'Preferences'),
        anyNotYourPrefsInfo,
        ShowAndEditPreferences({ userPreferences: this.state.userPreferences })));
  }
});


var ShowAndEditPreferences = React.createClass({
  mixins: [RouterState],

  getInitialState: function() {
    return {};
  },

  savePrefs: function(event) {
    event.preventDefault();
    var form = $(event.target);
    var prefs = {
      userId: this.getParams().userId,
      fullName: form.find('#fullName').val(),
      username: this.props.userPreferences.username,
      emailAddress: form.find('#emailAddress').val(),
      url: form.find('#url').val(),
      emailForEveryNewPost: form.find('#emailForEveryNewPost').is(':checked')
    };
    // This won't update the name in the name-login-button component. But will
    // be automatically fixed when I've ported everything to React and use
    // some global React state instead of cookies to remember the user name.
    Server.saveUserPreferences(prefs, () => {
      this.setState({ savingStatus: 'Saved' });
    });
    this.setState({ savingStatus: 'Saving' });
  },

  render: function() {
    var prefs: UserPreferences = this.props.userPreferences;
    var username = prefs.username || '(not specified)';

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
          r.label({ htmlFor: 'fullName' }, 'Name (optional)'),
          r.input({ className: 'form-control', id: 'fullName',
              defaultValue: prefs.fullName })),

        // Don't allow changing one's username right now. In the future, one should
        // be allowed to change it but infrequently only.
        r.div({ className: 'form-group' },
          r.label({}, 'Username'),
          r.p({}, username )),

        // Disable the email input — I've not implemented confirmation-emails-to-new-address
        // or any double-check-password-before-changing-email.
        r.div({ className: 'form-group' },
          r.label({ htmlFor: 'emailAddress' }, 'Email address'),
          r.input({ type: 'email', className: 'form-control', id: 'emailAddress',
              defaultValue: prefs.emailAddress, disabled: true }),
          r.p({ className: 'help-block' }, 'Not shown publicly.')),

        r.div({ className: 'form-group' },
          r.label({ htmlFor: 'url' }, 'URL'),
          r.input({ className: 'form-control', id: 'url',
              defaultValue: prefs.url }),
          r.p({ className: 'help-block' }, 'Any website or page of yours.')),

        r.div({ className: 'form-group' },
          r.div({ className: 'checkbox' },
            r.label({},
              r.input({ type: 'checkbox', id: 'emailForEveryNewPost',
                defaultChecked: prefs.emailForEveryNewPost },
                'Receive an email for every new post (unless you mute the topic or category)')))),

        Button({ type: 'submit' }, 'Save'),
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