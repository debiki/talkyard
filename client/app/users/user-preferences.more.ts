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


/// <reference path="../slim-bundle.d.ts" />
/// <reference path="../util/UsernameInput.more.ts" />
/// <reference path="../util/stupid-dialog.more.ts" />
/// <reference path="./ActivitySummaryEmailsInterval.more.ts" />

//------------------------------------------------------------------------------
   namespace debiki2.users {
//------------------------------------------------------------------------------

const r = ReactDOMFactories;
const UsersPathSlash = UsersRoot;
const SlashPrefsSlash = '/preferences/';  // dupl [4GKQST20]

import EmailInput = debiki2.util.EmailInput;
const aboutPathSeg = 'about';
const notfsPathSeg = 'notifications';
const privacyPathSeg = 'privacy';
const accountPathSeg = 'account';  // [4JKT28TS]


export const UserPreferences = createFactory({
 displayName: 'UserPreferences',

  render: function() {
    const prefsPathSlash = UsersPathSlash + this.props.match.params.usernameOrId + SlashPrefsSlash;
    const aboutPath = prefsPathSlash + aboutPathSeg;
    const privacyPath = prefsPathSlash + privacyPathSeg;
    const emailsLoginsPath = prefsPathSlash + accountPathSeg;
    const user: User = this.props.user;
    const location = this.props.location;
    const store: Store = this.props.store;
    const me: Myself = store.me;

    const mayViewPrefs = isStaff(me) || (me.isAuthenticated && me.id === user.id);
    if (!mayViewPrefs)
      return null;

    const childProps = {
      store,
      user,
      reloadUser: this.props.reloadUser,
      emailsLoginsPath,
    };

    const childRoute = Switch({},
      Route({ path: prefsPathSlash, exact: true, render: ({ match }) =>
          Redirect({ to: aboutPath + location.search + location.hash })}),
      Route({ path: '(.*)/' + aboutPathSeg, exact: true, render: () => AboutTab(childProps) }),
      Route({ path: '(.*)/' + notfsPathSeg, exact: true, render: () => NotfPrefsTab(childProps) }),
      Route({ path: '(.*)/' + privacyPathSeg, exact: true, render: () => PrivacyPrefsTab(childProps) }),
      Route({ path: '(.*)/' + accountPathSeg, exact: true, render: (ps) =>
          AccountTab({ ...childProps, ...ps }) }));

    const isGuest = user_isGuest(user);
    const isNormalMember = user.id >= LowestNormalMemberId;
    const isBuiltInUser = user.id < LowestAuthenticatedUserId;

    return (
      // Without table-layout: fixed, the table can become 5000 px wide, because otherwise the
      // default layout is width = as wide as the widest cell wants to be.
      r.div({ style: { display: 'table', width: '100%', tableLayout: 'fixed' }},
        r.div({ style: { display: 'table-row' }},
          r.div({ className: 's_UP_Act_Nav' },
            r.ul({ className: 'dw-sub-nav nav nav-pills nav-stacked' },
              LiNavLink({ to: aboutPath, className: 's_UP_Prf_Nav_AbtL' }, t.upp.About),
              isGuest || !isNormalMember ? null: LiNavLink({
                  to: prefsPathSlash + notfsPathSeg, className: 's_UP_Prf_Nav_NtfsL' }, t.Notifications),
              isGuest || isBuiltInUser ? null : LiNavLink({
                  to: privacyPath, className: 'e_UP_Prf_Nav_PrivL' }, t.upp.Privacy),
              isGuest || isBuiltInUser ? null : LiNavLink({
                  to: emailsLoginsPath, className: 's_UP_Prf_Nav_EmLgL' }, t.upp.Account))),
         r.div({ className: 's_UP_Act_List' },
           childRoute))));
  }
});



export const AboutTab = createFactory({
  displayName: 'AboutTab',

  render: function() {
    const store: Store = this.props.store;
    const me: Myself = store.me;
    const user: MemberInclDetails = this.props.user;
    const isSystemUser = user.id === SystemUserId;

    let anyNotYourPrefsInfo;
    if (me.id !== user.id && !isSystemUser) {
      // (This is for admins, don't translate. [5JKBWS2])
      const prefsAndCanBecause = " preferences. You can do that, because you're an administrator.";
      anyNotYourPrefsInfo = user.isGroup
        ? r.p({}, "You are editing a ", r.b({}, "group's"), prefsAndCanBecause)
        : r.p({}, "You are editing ", r.b({}, "another"), " user's" + prefsAndCanBecause);
    }

    const preferences = isGuest(user)
        ? AboutGuest({ guest: user })
        : AboutMember(this.props);

    return (
      r.div({ className: 's_UP_Prefs' },
        anyNotYourPrefsInfo,
        preferences));
  }
});



const AboutGuest = createComponent({
  displayName: 'AboutGuest',

  getInitialState: function() {
    return {};
  },

  componentWillUnmount: function() {
    this.isGone = true;
  },

  savePrefs: function(event) {
    event.preventDefault();
    const guest: Guest = this.props.guest;
    const prefs = {
      guestId: guest.id,
      name: firstDefinedOf(this._fullName, guest.fullName),
    };
    if (!prefs.name) return;
    Server.saveGuest(prefs, () => {
      if (this.isGone) return;
      this.setState({ savingStatus: 'Saved' });
    });
    this.setState({ savingStatus: 'Saving' });
  },

  render: function() {
    const guest: Guest = this.props.guest;

    // Dupl Saving... code [7UKBQT2
    let savingInfo = null;
    if (this.state.savingStatus === 'Saving') {
      savingInfo = r.i({}, ' ' + t.SavingDots);
    }
    else if (this.state.savingStatus === 'Saved') {
      savingInfo = r.i({}, ' ' + t.SavedDot);
    }

    return (
      r.form({ role: 'form', onSubmit: this.savePrefs },

        r.div({ className: 'form-group' },
          r.label({ htmlFor: 'fullName' }, t.Name),
          r.input({ className: 'form-control', id: 'fullName', defaultValue: guest.fullName,
              onChange: (event) => { this._fullName = event.target.value }, required: true })),

        r.div({ className: 'form-group' },
          r.label({}, t.EmailAddress),
          r.div({}, r.samp({}, guest.email)),
          r.p({ className: 'help-block' }, t.upp.NotShownCannotChange)),

        InputTypeSubmit({ id: 'e2eUP_Prefs_SaveB', value: t.Save }),
        savingInfo));
  }
});



const AboutMember = createComponent({
  displayName: 'AboutMember',

  getInitialState: function() {
    let user: MemberInclDetails = this.props.user;
    return {
      fullName: user.fullName,
      username: user.username,
      sendSummaryEmails:
          !!user.summaryEmailIntervalMins && user.summaryEmailIntervalMins !== DisableSummaryEmails,
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
          r.p({}, t.upp.ChangeUsername_1),
          r.p({}, t.upp.ChangeUsername_2)) });
      this.setState({ showUsernameInput: true });
  },

  maybeChangePassword: function() {
    const user: MemberInclDetails = this.props.user;
    const question = user.hasPassword ? "Change password?" : "Create password?";  // I18N
    // BUG only works if email addr specified and verified  [7B4W20]
    util.openDefaultStupidDialog({  // import what?
      body: question + " You'll get a reset password email.",  // I18N
      primaryButtonTitle: "Yes, do that",  // I18N
      secondaryButonTitle: "No, cancel",
      onCloseOk: function(whichButton) {
        if (whichButton === 1)
          Server.sendResetPasswordEmail(() => {
            // Continue also if this.isGone.
            util.openDefaultStupidDialog({
              body: "Email sent.",  // I18N
              small: true,
            });
          });
      } });
  },

  enableSummaryEmails: function(event) {
    const shallEnable = event.target.checked;
    const newIntervalMins = shallEnable && (
        !this.state.summaryEmailIntervalMins ||
        this.state.summaryEmailIntervalMins === DisableSummaryEmails) ?
          DefaultSummaryIntervalMins : this.state.summaryEmailIntervalMins;
    this.setState({
      sendSummaryEmails: shallEnable,
      summaryEmailIntervalMins: newIntervalMins,
    });
  },

  badPrefs: function() {
    return this.state.isUsernameBad || this.state.isFullNameBad;
  },

  savePrefs: function(event) {
    event.preventDefault();
    const summaryEmailIntervalMins = this.state.sendSummaryEmails ?
        this.state.summaryEmailIntervalMins : DisableSummaryEmails;
    const user: MemberInclDetails = this.props.user;
    const prefs = {
      userId: user.id,
      fullName: this.state.fullName,
      username: this.state.username,
      emailAddress: firstDefinedOf(this._email, user.email),
      // BUG SHOULD not save these, if the user didn't change them and they're still the
      // default values.
      // shouldn't be here: [REFACTORNOTFS] -------
      summaryEmailIntervalMins: summaryEmailIntervalMins,
      summaryEmailIfActive: this.state.summaryEmailIfActive,
      // ------------------------------------------
      about: firstDefinedOf(this._about, user.about),
      url: firstDefinedOf(this._url, user.url),
    };
    // This won't update the name in the name-login-button component. But will
    // be automatically fixed when I've ported everything to React and use
    // some global React state instead of cookies to remember the user name.
    Server.saveAboutUserPrefs(prefs, user.isGroup, () => {
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
    const store: Store = this.props.store;
    const me: Myself = store.me;
    const user: MemberInclDetails = this.props.user;
    const username = user.username || t.upp.notSpecified;

    // These ids = hardcoded users & groups, e.g. System and Everyone.
    const isBuiltInUser = user.id < LowestAuthenticatedUserId;
    const isSystemUser = user.id === SystemUserId;

    // Dupl Saving... code [7UKBQT2]
    let savingInfo = null;
    if (this.state.savingStatus === 'Saving') {
      savingInfo = r.i({}, ' ' + t.SavingDots);
    }
    else if (this.state.savingStatus === 'Saved') {
      savingInfo = r.i({}, ' ' + t.SavedDot);
    }

    let usernameStuff;
    if (!this.state.showUsernameInput) {
      usernameStuff =
        r.div({ className: 'form-group' },
          r.label({}, t.Username),
          r.div({},
            r.samp({}, username),
            isBuiltInUser ? null : r.button({ className: 'btn btn-default s_UP_Prefs_ChangeUNB',
              onClick: this.tryChangeUsername }, t.ChangeDots)));
    }
    else {
      usernameStuff =
        util.UsernameInput({ label: t.Username, defaultValue: username, className: 's_UP_Prefs_UN',
            onChangeValueOk: (value, isOk) => this.updateUsernameOk(value, isOk),
            help: r.b({ className: 's_UP_Prefs_UN_Help' },
              t.upp.MayChangeFewTimes) });
    }

    const sendSummaryEmails = this.state.sendSummaryEmails;

    // Only show setting-is-inherited-from-some-group info for admins, for now, so people
    // won't wonder what "inherited" means.
    const inherited = " (inherited)";
    const summaryIntervalInherited =
        me.isAdmin && user.summaryEmailIntervalMins !== user.summaryEmailIntervalMinsOwn ?
          inherited : '';
    const summaryIfActiveInherited =
        me.isAdmin && user.summaryEmailIfActive !== user.summaryEmailIfActiveOwn ?
          inherited : '';

    const activitySummaryDescr = user.isGroup
        ? t.upp.EmailSummariesToGroup
        : t.upp.EmailSummariesToMe;

    const emailIfVisitRegularly = user.isGroup
        ? t.upp.AlsoIfTheyVisit
        : t.upp.AlsoIfIVisit;

    // Summary emails can be configured for groups (in particular, the Everyone group = default settings).
    // But not for the System user.
    const activitySummaryStuff = isSystemUser ? null :
      r.div({ className: 'form-group', style: { margin: '22px 0 25px' } },
        r.label({}, t.upp.ActivitySummaryEmails),  // more like a mini title
        r.div({ className: 'checkbox' },  // [7PK4WY1]
          r.label({},
            r.input({ type: 'checkbox', id: 'sendSummaryEmails',
              checked: this.state.sendSummaryEmails, onChange: this.enableSummaryEmails }),
            activitySummaryDescr + summaryIntervalInherited)),
        r.div({ className: 'checkbox' },
          r.label({},
            r.input({ type: 'checkbox', id: 'summaryEmailIfActive',
              checked: this.state.summaryEmailIfActive, disabled: !sendSummaryEmails,
              onChange: (event) => this.setState({ summaryEmailIfActive: event.target.checked })}),
            emailIfVisitRegularly + summaryIfActiveInherited)),
        r.p({ style: { marginBottom: 5 } },
          user.isGroup ? t.upp.HowOftenWeSend : t.upp.HowOftenYouWant),
        ActivitySummaryEmailsIntervalDropdown({ onSelect: (frequencyMins) => {
          this.setState({ summaryEmailIntervalMins: frequencyMins });
        }, intervalMins: this.state.summaryEmailIntervalMins, disabled: !sendSummaryEmails }));


    return (
      r.form({ role: 'form', onSubmit: this.savePrefs },

        util.FullNameInput({ label: t.upp.NameOpt, defaultValue: user.fullName,
            className: 'e_UP_Prefs_FN', disabled: isBuiltInUser,
            onChangeValueOk: (newName, isOk) => this.updateFullNameOk(newName, isOk) }),

        usernameStuff,

        isBuiltInUser ? null : r.div({ className: 'form-group' },
          r.label({}, t.EmailAddress),
          r.div({},
            r.samp({}, user.email),
            NavLink({ to: this.props.emailsLoginsPath,
                className: 'btn s_UP_Prefs_ChangeEmailB' }, t.ChangeDots)),
          r.p({ className: 'help-block' }, t.upp.NotShown)),

        // UX COULD later incl this change-pwd also on the Account tab, it fits better there maybe?
        // However people might not think about looking there? So incl both here and there?
        isBuiltInUser ? null : r.div({ className: 'form-group' },    // + also on  Account tab.
          r.label({}, t.pwd.PasswordC),
          r.span({}, user.hasPassword ? " Yes." : " None."),   // I18N
          r.a({
            // UX COULD improve: For now, send a pwd reset email — works only if the user
            // has typed hens email addr :-/
            // Later: link directly to the reset-pwd page, and have the user first type
            // the current pwd, before asking for a new. Only if they've forgotten their pwd,
            // a pwd reset email is needed. (But never let anyone changing pwd, without confirming
            // that hen knows the old, or is the email addr owner.)
            onClick: this.maybeChangePassword,
            className: 'btn s_UP_Prefs_ChangePwB' }, t.ChangeDots)),

        activitySummaryStuff,

        isBuiltInUser ? null : r.div({ className: 'form-group' },
          r.label({ htmlFor: 't_UP_AboutMe' }, t.upp.AboutYou),
          r.textarea({ className: 'form-control', id: 't_UP_Prefs_AboutMeTA',
              onChange: (event) => { this._about = event.target.value },
              defaultValue: user.about || '' })),

        // Later: Verify is really an URL
        isBuiltInUser ? null : r.div({ className: 'form-group' },
          r.label({ htmlFor: 'url' }, 'URL'),
          r.input({ className: 'form-control', id: 'url',
              onChange: (event) => { this._url = event.target.value },
              defaultValue: user.url }),
          r.p({ className: 'help-block' }, t.upp.WebLink)),

        // Later: + Location

        isSystemUser ? null :
          InputTypeSubmit({ id: 'e2eUP_Prefs_SaveB', value: t.Save, disabled: this.badPrefs() }),

        savingInfo));
  }
});



const NotfPrefsTab = createFactory({
  displayName: 'NotfPrefsTab',

  getInitialState: function() {
    return {};
  },

  componentDidMount: function() {
    this.loadNotfPrefs();
  },

  componentWillUnmount: function() {
    this.isGone = true;
  },

  loadNotfPrefs: function() {
    const member: MemberInclDetails = this.props.user;
    Server.loadCatsTagsSiteNotfPrefs(member.id, (response: PageNotfPrefsResponse) => {
      if (this.isGone) return;
      const ownPrefs: OwnPageNotfPrefs = response;
      const memberNow: MemberInclDetails = this.props.user;
      if (ownPrefs.id === memberNow.id) {
        this.setState({ ownPrefs });
      }
      else {
        // The data we got from the server, is old: we have since updated the UI
        // to show info about a different user, apparently.
        console.log("Race condition. [2C80BX]");
      }
    });
  },

  render: function() {
    const store: Store = this.props.store;
    const me: Myself = store.me;
    const user: MemberInclDetails = this.props.user;
    const isOkUser = user.id >= Groups.EveryoneId;
    const ownPrefs = this.state.ownPrefs;

    if (!ownPrefs)
      return r.p({}, t.Loading);

    if (!isOkUser)
      return r.p({}, 'Built-in special user, or guest. [TyE2PKT0684]');

    const forWho = me.id === user.id ? '' : rFragment({}, ", for ", r.b({}, user.username));
    const target = { wholeSite: true };

    return (
      r.div({},

        r.p({}, "Default notifications, site wide", forWho, ':'),   // I18N

        notfs.PageNotfPrefButton({ target, store, ownPrefs, saveFn: (notfLevel: PageNotfLevel) => {
              Server.savePageNotfPrefUpdStore(user.id, target, notfLevel, () => {
                if (this.isGone) return;
                this.loadNotfPrefs();
              });
            } }),

        // @ifdef DEBUG
        r.br(),
        r.br(),
        r.pre({}, "(In debug builds only) ownPrefs:\n" + JSON.stringify(ownPrefs, undefined, 2)),
        // @endif
        null,
        ));

    /* Discoruse's email options:
    'When you do not visit the site, send an email digest of what is new:'
    'daily/weekly/every two weeks'
    'Receive an email when someone sends you a private message'
    'Receive an email when someone quotes you, replies to your post, or mentions your @username'
    'Do not suppress email notifications when I am active on the site'
    */
  }
});



const PrivacyPrefsTab = createFactory({
  displayName: 'PrivacyPrefsTab',

  getInitialState: function() {
    const user: MemberInclDetails = this.props.user;
    return {
      hideActivityForStrangers: user.seeActivityMinTrustLevel >= TrustLevel.FullMember,
      hideActivityForAll: user.seeActivityMinTrustLevel >= TrustLevel.CoreMember,
    };
  },

  componentWillUnmount: function() {
    this.isGone = true;
  },

  savePrivacyPrefs: function(event) {
    event.preventDefault();
    const seeActivityMinTrustLevel = this.state.hideActivityForAll ? TrustLevel.CoreMember : (
        this.state.hideActivityForStrangers ? TrustLevel.FullMember : null);
    const user: MemberInclDetails = this.props.user;
    const prefs = {
      userId: user.id,
      seeActivityMinTrustLevel: seeActivityMinTrustLevel,
    };
    Server.saveMemberPrivacyPrefs(prefs, () => {
      if (this.isGone) return;
      this.setState({
        savingStatus: 'Saved',
      });
      this.props.reloadUser(false);
    });
    this.setState({ savingStatus: 'Saving' });
  },

  render: function() {
    const state = this.state;
    const me: Myself = this.props.store.me;
    const user: MemberInclDetails = this.props.user;

    // Dupl Saving... code [7UKBQT2]
    let savingInfo = null;
    if (this.state.savingStatus === 'Saving') {
      savingInfo = r.i({}, ' ' + t.SavingDots);
    }
    else if (this.state.savingStatus === 'Saved') {
      savingInfo = r.i({ className: 'e_Saved' }, ' ' + t.SavedDot);
    }

    return (
      r.form({ role: 'form', onSubmit: this.savePrivacyPrefs },
        Input({ type: 'checkbox', className: 'e_HideActivityStrangersCB',
            label: rFragment({},
              t.upp.HideActivityStrangers_1, r.br(),
              t.upp.HideActivityStrangers_2),
            checked: state.hideActivityForStrangers,
            onChange: (event: CheckboxEvent) => this.setState({
              hideActivityForStrangers: event.target.checked,
              hideActivityForAll: false,
            }) }),

        Input({ type: 'checkbox', className: 'e_HideActivityAllCB',
            label: rFragment({},
              t.upp.HideActivityAll_1, r.br(),
              t.upp.HideActivityAll_2,),
            checked: state.hideActivityForAll,
            onChange: (event: CheckboxEvent) => this.setState({
              hideActivityForStrangers: event.target.checked || state.hideActivityForStrangers,
              hideActivityForAll: event.target.checked,
            }) }),

        InputTypeSubmit({ className: 'e_SavePrivacy', style: { marginTop: '11px' }, value: t.Save }),
        savingInfo));
  }
});



const AccountTab = createFactory({
  displayName: 'AccountTab',

  getInitialState: function() {
    return {
      verifEmailsSent: {},
    };
  },

  componentDidMount: function() {
    const user: MemberInclDetails = this.props.user;
    this.loadEmailsLogins(user.id);
  },

  componentWillUnmount: function() {
    this.isGone = true;
  },

  componentWillReceiveProps: function(nextProps) {
    // a bit dupl code [5AWS2E9]
    const me: Myself = this.props.store.me;
    const user: MemberInclDetails = this.props.user;
    const nextMe: Myself = nextProps.store.me;
    const nextUser: MemberInclDetails = nextProps.user;
    // If we log in as someone else, what stuff we may see might change.
    if (me.id !== nextMe.id || user.id !== nextUser.id) {
      this.loadEmailsLogins(nextUser.id);
    }
  },

  loadEmailsLogins: function(userId: UserId) {
    Server.loadEmailAddressesAndLoginMethods(userId, (response: UserAccountResponse) => {
      if (this.isGone) return;
      this.setState(response);
    });
  },

  doAddEmail: function() {
    this.setState({ showAddEmailInput: false, isAddingEmail: true });
    const user: MemberInclDetails = this.props.user;
    Server.addEmailAddresses(user.id, this.state.newEmailAddr, (response: UserAccountResponse) => {
      if (this.isGone) return;
      this.setState({ isAddingEmail: false, doneAddingEmail: true });
      this.setState(response);
    });
  },

  resendEmailAddrVerifEmail: function(emailAddress: string) {
    const user: MemberInclDetails = this.props.user;
    Server.resendEmailAddrVerifEmail(user.id, emailAddress);
    this.state.verifEmailsSent[emailAddress] = true; // modifying in place, oh well [redux]
    this.setState({ verifEmailsSent: this.state.verifEmailsSent });
  },

  removeEmailAddress: function(emailAddress: string) {
    const user: MemberInclDetails = this.props.user;
    Server.removeEmailAddresses(user.id, emailAddress, (response: UserAccountResponse) => {
      if (this.isGone) return;
      // Remove the check-your-inbox message, in case the user remoed the email just added.
      this.setState({ doneAddingEmail: undefined, ...response });
    });
  },

  setPrimary: function(emailAddress: string) {
    const user: MemberInclDetails = this.props.user;
    Server.setPrimaryEmailAddresses(user.id, emailAddress, (response: UserAccountResponse) => {
      if (this.isGone) return;
      this.setState(response);
      this.props.reloadUser();
    });
  },

  downloadMyContent: function() {
    const user: MemberInclDetails = this.props.user;
    window.open(Server.makeDownloadMyContentUrl(user.id), '_blank');
  },

  downloadPersonalData: function() {
    const user: MemberInclDetails = this.props.user;
    window.open(Server.makeDownloadPersonalDataUrl(user.id), '_blank');
  },

  deleteUser: function() {
    const me: Myself = this.props.store.me;
    const user: MemberInclDetails = this.props.user;
    const isMe = me.id === user.id;
    util.openDefaultStupidDialog({
      dialogClassName: '',
      body: isMe ? t.upp.DeleteYourAccountQ : t.upp.DeleteUserQ,
      primaryButtonTitle: t.Cancel,
      secondaryButonTitle: t.upp.YesDelete,
      onCloseOk: (number) => {
        if (!number || number === 1) {
          // Click outside dialog, or on primary button = cancel, do nothing.
        }
        else {
          dieIf(number !== 2, 'TyE6UKBA');
          Server.deleteUser(user.id, anonUsername => {
            // If deleted oneself, navigate outside React-Router, so the page will reload
            // and the browser forgets all in-mem things about the current user.
            const newPath = UsersRoot + anonUsername;
            if (isMe || this.isGone) {
              window.location.assign(newPath);
            }
            else {
              this.props.history.push(newPath);
            }
          });
        }
      },
    });
  },

  render: function() {
    const me: Myself = this.props.store.me;
    const user: MemberInclDetails = this.props.user;
    const isMe = me.id === user.id;

    if (!this.state.emailAddresses)
      return r.p({}, t.Loading);

    const emailAddrs: UserEmailAddress[] = this.state.emailAddresses;
    const loginMethods: UserLoginMethods[] = this.state.loginMethods;

    const emailAddressesList =
      r.ul({ className: 's_UP_EmLg_EmL' },
        emailAddrs.map((addr) => {
          let status = '';
          let isVerified = false;

          if (addr.verifiedAt) {
            status += t.upp.VerifiedDot;
            isVerified = true;
          }
          else {
            status += t.upp.NotVerifiedDot;
          }

          let isLoginMethod = false;
          _.each(loginMethods, (method: UserLoginMethods) => {
            if (method.email === addr.emailAddress) {
              isLoginMethod = true;
              status += t.upp.ForLoginWithDot(method.provider);
            }
          });

          const isPrimary = user.email === addr.emailAddress;
          if (isPrimary) {
            status += t.upp.PrimaryDot;
          }

          const testClasses = isVerified ? ' e_EmVerfd' : ' e_EmNotVerfd';

          return r.li({ className: 's_UP_EmLg_EmL_It',  key: addr.emailAddress },
            r.div({ className: 's_UP_EmLg_EmL_It_Em' + testClasses }, addr.emailAddress),
            r.div({}, status),
            r.div({},
              isVerified ? null : (
                  this.state.verifEmailsSent[addr.emailAddress] ? "Verification email sent. " :
                Button({ onClick: () => this.resendEmailAddrVerifEmail(addr.emailAddress),
                    className: 'e_SendVerifEmB' }, t.upp.SendVerifEmail)),
              isPrimary || isLoginMethod ? null :
                Button({ onClick: () => this.removeEmailAddress(addr.emailAddress),
                    className: 'e_RemoveEmB' }, t.Remove),
              isPrimary || !isVerified ? null :
                Button({ onClick: () => this.setPrimary(addr.emailAddress),
                    className: 'e_MakeEmPrimaryB' }, t.upp.MakePrimary)));
        }));

    // Don't show the Add button again after one email added. Then it's harder to see
    // the "check your inbox" message.
    const showAddEmailInputButton = this.state.doneAddingEmail ? null : (
        emailAddrs.length >= MaxEmailsPerUser
          ? r.span({}, t.upp.MaxEmailsInfo(MaxEmailsPerUser))
          : (this.state.showAddEmailInput || this.state.isAddingEmail
              ? null
              : Button({ onClick: () => this.setState({ showAddEmailInput: true }),
                    className: 'e_AddEmail' },
                  t.upp.AddEmail)));

    const addEmailInput = !this.state.showAddEmailInput ? null :
      r.div({},
        EmailInput({ label: t.upp.TypeNewEmailC, placeholder: "your.email@example.com",
          className: 'e_NewEmail',
          onChangeValueOk: (value, ok) => this.setState({ newEmailAddr: value, emailOk: ok }) }),
        PrimaryButton({ onClick: this.doAddEmail, disabled: !this.state.emailOk, className: 'e_SaveEmB' },
          t.Add));

    const isAddingEmailInfo = !this.state.isAddingEmail ? null :
      r.div({}, t.AddingDots);

    const doneAddingEmailInfo = !this.state.doneAddingEmail ? null :
      r.div({ className: 's_UP_EmLg_EmAdded' },
        t.upp.EmailAdded_1, r.b({}, t.upp.EmailAdded_2));

    const loginsList =
      r.ul({ className: 's_UP_EmLg_LgL' },
        loginMethods.map((method: UserAccountLoginMethod) => {
          const withExternalId = !method.externalId || !isStaff(me) ? null :
              r.span({}, " external id: ", method.externalId);
          return r.li({ className: 's_UP_EmLg_LgL_It', key: `${method.provider}:${method.email}` },
            r.span({ className: 's_UP_EmLg_LgL_It_How' }, method.provider),
            t.upp.commaAs,
            r.span({ className: 's_UP_EmLg_LgL_It_Id' }, method.email),
            withExternalId)
            // r.div({}, Button({}, "Remove")))  — fix later
        }));

    const downloadOwnContent = rFragment({},
      r.h3({}, t.upp.YourContent),

      Button({ onClick: this.downloadMyContent }, t.upp.DownloadPosts),
      r.p({ className: 'help-block' }, t.upp.DownloadPostsHelp),

      Button({ onClick: this.downloadPersonalData }, t.upp.DownloadPersData),
      r.p({ className: 'help-block' }, t.upp.DownloadPersDataHelp));

    // Later:
    //const deactivateButton = user.deletedAt ? null : (
    //  Button({}, user.deactivatedAt ? "Activate" : "Deactivate"));
    // + hide Delete button, until deactivated (unless is admin).

    const dangerZone = user.deletedAt || (me.id !== user.id && !me.isAdmin) ? null : (
      rFragment({},
        r.h3({ style: { marginBottom: '1.3em' }}, t.upp.DangerZone),
        Button({ onClick: this.deleteUser }, t.upp.DeleteAccount)));

    return (
      r.div({ className: 's_UP_EmLg' },
        r.h3({}, t.upp.EmailAddresses),
        r.p({ className: 's_UP_EmLg_StatusExpl' }, t.upp.EmailStatusExpl),
        emailAddressesList,
        r.br(),
        showAddEmailInputButton,
        addEmailInput,
        isAddingEmailInfo,
        doneAddingEmailInfo,

        r.h3({}, t.upp.LoginMethods),
        loginsList,
        // Button({}, "Add login method")  — fix later
        downloadOwnContent,
        dangerZone,
      ));
  }
});


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
