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


/// <reference path="../more-prelude.more.ts" />
/// <reference path="../util/UsernameInput.more.ts" />
/// <reference path="../util/stupid-dialog.more.ts" />
/// <reference path="./ActivitySummaryEmailsInterval.more.ts" />

//------------------------------------------------------------------------------
   namespace debiki2.users {
//------------------------------------------------------------------------------

const r = ReactDOMFactories;
const SlashPrefsSlash = '/preferences/';

import EmailInput = debiki2.util.EmailInput;
const aboutPathSeg = 'about';
const notfsPathSeg = 'notifications';
const privacyPathSeg = 'privacy';
const securityPathSeg = 'security';
const uiPathSeg = 'ui';
const accountPathSeg = 'account';  // [4JKT28TS]


export const UserPreferences = createFactory({
 displayName: 'UserPreferences',

  render: function() {
    const user: UserInclDetails = this.props.user;
    const prefsPathSlash = pathTo(user) + SlashPrefsSlash;
    const aboutPath = prefsPathSlash + aboutPathSeg;
    const privacyPath = prefsPathSlash + privacyPathSeg;
    const securityPath = prefsPathSlash + securityPathSeg;
    const uiPath = prefsPathSlash + uiPathSeg;
    const emailsLoginsPath = prefsPathSlash + accountPathSeg;
    const location = this.props.location;
    const store: Store = this.props.store;
    const me: Myself = store.me;

    const mayViewPrefs = isStaff(me) || (me.isAuthenticated && me.id === user.id);
    if (!mayViewPrefs)
      return null;

    const childProps = {
      store,
      user, // CLEAN_UP remove — use `member` instead, because can be a group
      member: user,
      reloadUser: this.props.reloadUser,
      updatePat: this.props.updatePat,
      emailsLoginsPath,
    };

    const childRoute = Switch({},
      // [React_Router_v51] skip render(), use hooks and useParams instead.
      Route({ path: prefsPathSlash, exact: true, render: () =>
          Redirect({ to: aboutPath + location.search + location.hash })}),
      Route({ path: '(.*)/' + aboutPathSeg, exact: true, render: () => AboutTab(childProps) }),
      Route({ path: '(.*)/' + notfsPathSeg, exact: true, render: () => NotfPrefsTab(childProps) }),
      Route({ path: '(.*)/' + privacyPathSeg, exact: true, render: () => PrivacyPrefsTab(childProps) }),
      Route({ path: '(.*)/' + securityPathSeg, exact: true, render: () => SecurityPrefsTab(childProps) }),
      Route({ path: '(.*)/' + accountPathSeg, exact: true, render: (ps) =>
          user.isGroup
            ? AccountTabForGroup({ ...childProps, ...ps })
            : AccountTab({ ...childProps, ...ps }) }),
      Route({ path: '(.*)/' + uiPathSeg, exact: true, render: () => UiPrefsTab(childProps) }),
          );

    const isGuest = user_isGuest(user);
    const isNormalMember = user.id >= LowestNormalMemberId;
    const isBuiltInUser = user.id < LowestAuthenticatedUserId;
    const isGuestOrBuiltIn = isGuest || isBuiltInUser;
    const isGroupGuestOrBuiltIn = user.isGroup || isGuestOrBuiltIn;

    return (
      // Without table-layout: fixed, the table can become 5000 px wide, because otherwise the
      // default layout is width = as wide as the widest cell wants to be.
      r.div({ style: { display: 'table', width: '100%', tableLayout: 'fixed' }},
        r.div({ style: { display: 'table-row' }},
          r.div({ className: 's_UP_Act_Nav' },
            r.ul({ className: 'dw-sub-nav nav nav-pills nav-stacked' },
              LiNavLink({ to: aboutPath, className: 's_UP_Prf_Nav_AbtL' }, t.upp.About),
              !isNormalMember ? null: LiNavLink({
                  to: prefsPathSlash + notfsPathSeg, className: 's_UP_Prf_Nav_NtfsL' }, t.Notifications),
              isGroupGuestOrBuiltIn ? null : LiNavLink({
                  to: privacyPath, className: 'e_UP_Prf_Nav_PrivL' }, t.upp.Privacy),
              isGroupGuestOrBuiltIn ? null : LiNavLink({
                  to: securityPath, className: 'e_UP_Prf_Nav_SecL' }, t.upp.Security),
              isGuestOrBuiltIn ? null : LiNavLink({
                  to: emailsLoginsPath, className: 's_UP_Prf_Nav_EmLgL' }, t.upp.Account),
              !isNormalMember ? null : LiNavLink({
                  to: uiPath, className: 'e_UP_Prf_Nav_UiL' }, t.upp.Interface))),
         r.div({ className: 's_UP_Act_List' },
           childRoute))));
  }
});



export const AboutTab = createFactory({
  displayName: 'AboutTab',

  render: function() {
    const store: Store = this.props.store;
    const me: Myself = store.me;
    const user: UserInclDetails = this.props.user;
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
        ? AboutGuest({ guest: user, updatePat: this.props.updatePat })
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
    // Dupl code [save_pat_pref].
    Server.saveGuest(prefs, (r: { patNoStatsNoGroupIds: PatVb }) => {
      if (this.isGone) return;
      this.props.updatePat(r.patNoStatsNoGroupIds);
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
          !guest.email
            ? r.div({}, "None")   // I18N upp.NoEmail field?
            : rFr({},
                r.div({}, r.samp({}, guest.email)),
                r.p({ className: 'help-block' }, t.upp.NotShownCannotChange))),

        InputTypeSubmit({ id: 'e2eUP_Prefs_SaveB', value: t.Save }),
        savingInfo));
  }
});



const AboutMember = createComponent({
  displayName: 'AboutMember',

  getInitialState: function() {
    let user: UserInclDetails = this.props.user;
    return {
      fullName: user.fullName,
      username: user.username,
      // These fields included only if the current user is admin or the member henself.
      // [pat_prof_fields]
      emailPref: user.emailNotfPrefs,
      sendSummaryEmails:
          !!user.summaryEmailIntervalMins &&
              user.summaryEmailIntervalMins !== DisableSummaryEmails,
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
    const user: UserInclDetails = this.props.user;
    const question = user.hasPassword ? t.upp.ChangePwdQ : t.upp.CreatePwdQ;
    // BUG only works if email addr specified and verified  [7B4W20]
    util.openDefaultStupidDialog({  // import what?
      body: question + ' ' + t.upp.WillGetPwdRstEml,
      primaryButtonTitle: t.YesDoThat,
      secondaryButonTitle: t.NoCancel,
      onCloseOk: function(whichButton) {
        if (whichButton === 1)
          Server.sendResetPasswordEmail(user, () => {
            // Continue also if this.isGone.
            util.openDefaultStupidDialog({
              body: t.EmailSentD,
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
    const user: UserInclDetails = this.props.user;
    const prefs = {
      userId: user.id,
      fullName: this.state.fullName,
      username: this.state.username,
      emailAddress: firstDefinedOf(this._email, user.email),
      // shouldn't be here: [REFACTORNOTFS] -------
      emailPref: this.state.emailPref,
      // BUG SHOULD not save these, if the user didn't change them and they're still the
      // default values.
      summaryEmailIntervalMins: summaryEmailIntervalMins,
      summaryEmailIfActive: this.state.summaryEmailIfActive,
      // ------------------------------------------
      about: firstDefinedOf(this._about, user.bio),
      url: firstDefinedOf(this._url, user.websiteUrl),
    };
    // UX BUG minor: Won't update one's name in the name-login-button component.
    // Dupl code [save_pat_pref].
    Server.saveAboutPatPrefs(prefs, user.isGroup, (r: { patNoStatsNoGroupIds: PatVb }) => {
      if (this.isGone) return;
      this.setState({
        savingStatus: 'Saved',
        showUsernameInput: false,
      });
      this.props.updatePat(r.patNoStatsNoGroupIds);
      setTimeout(() => {
        if (this.isGone) return;
        this.setState({ savingStatus: '' });
      }, 2000);
    });
    this.setState({ savingStatus: 'Saving' });
  },

  render: function() {
    const store: Store = this.props.store;
    const me: Myself = store.me;
    const user: UserInclDetails = this.props.user;
    const username = user.username || t.upp.notSpecified;

    // These ids = hardcoded users & groups, e.g. System and Everyone.
    const isBuiltInUser = user.id < LowestAuthenticatedUserId;
    const isBuiltInOrGroup = isBuiltInUser || user.isGroup;
    const isSystemUser = pat_isSys(user);

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

    const patPlusChanges = { ...user, emailNotfPrefs: this.state.emailPref };

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

    // Summary emails can be configured for groups (in particular,
    // the Everyone group = default settings).  But not for the System user.
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

        isBuiltInOrGroup ? null : rFr({},
          r.div({ className: 'form-group' },
            r.label({}, t.EmailAddress),
            r.div({},
              r.samp({}, user.email),
              NavLink({ to: this.props.emailsLoginsPath,
                  className: 'btn s_UP_Prefs_ChangeEmailB' }, t.ChangeDots)),
            r.p({ className: 'help-block' }, t.upp.NotShown)),
          r.div({ className: 'form-group' },
            r.label({}, "Get emails: "),  // I18N
            Button({ className: 's_UP_Ab_EmPfB', onClick: (event: MouseEvent) => {
                // TESTS_MISSING  TyTE2E693RTMPG
                const atRect = cloneEventTargetRect(event);
                notification.openEmailNotfPrefs({ atRect,
                    pat: patPlusChanges,
                    saveFn: (emailPref: EmailNotfPrefs) => {
                      this.setState({ emailPref });
                    } });
              }},
              emailPref_title(patPlusChanges.emailNotfPrefs), ' ',
                    r.span({ className: 'caret' }))),
          ),

        // [oidc_missing] SHOULD hide this, if SSO or only-custom-IDP since then
        // there's no pwd login anyway.
        //
        // UX COULD later incl this change-pwd also on the Account tab, it fits better there maybe?
        // However people might not think about looking there? So incl both here and there?
        isBuiltInOrGroup ? null : r.div({ className: 'form-group' },    // + also on  Account tab.
          r.label({}, t.pwd.PasswordC),
          r.span({}, ' ' + (user.hasPassword ? t.Yes : t.upp.PwdNone) + '.'),
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

        // (Bio not yet saved server side, for groups.)
        isBuiltInOrGroup ? null : r.div({ className: 'form-group' },
          r.label({ htmlFor: 't_UP_AboutMe' }, t.upp.AboutYou),
          r.textarea({ className: 'form-control', id: 't_UP_Prefs_AboutMeTA',
              onChange: (event) => { this._about = event.target.value },
              defaultValue: user.bio || '' })),

        // Later: Verify is really an URL
        isBuiltInOrGroup ? null : r.div({ className: 'form-group' },
          r.label({ htmlFor: 'url' }, 'Website URL'),  // I18N
          r.input({ className: 'form-control', id: 'url',
              onChange: (event) => { this._url = event.target.value },
              defaultValue: user.websiteUrl }),
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
    const member: UserInclDetails = this.props.member;
    Server.loadCatsTagsSiteNotfPrefs(member.id, (response: PageNotfPrefsResponse) => {
      if (this.isGone) return;
      const membersPrefs: PageNotfPrefsResponse = response;
      const memberNow: UserInclDetails = this.props.member;
      const ppsById: { [userId: number]: Participant } = groupByKeepOne(membersPrefs.groups, g => g.id);
      if (membersPrefs.id === memberNow.id) {
        this.setState({ membersPrefs, ppsById });
      }
      else {
        // The data we got from the server, is old: we have since updated the UI
        // to show info about a different member, apparently. Fine.
        logM("Race condition. [TyM52C80BX]");
      }
    });
  },

  render: function() {
    const store: Store = this.props.store;
    const me: Myself = store.me;
    const member: UserInclDetails = this.props.member;
    const membersPrefs: PageNotfPrefsResponse = this.state.membersPrefs;
    const isOkMember = member.id >= Groups.EveryoneId;
    const isMe = me.id === member.id;
    const ppsById = this.state.ppsById;

    if (!membersPrefs)
      return r.p({}, t.Loading);

    if (!isOkMember)
      return r.p({}, 'Built-in special user, or guest. [TyE2PKT0684]');

    // It makes no sense to configure all members both via the Everyone group,
    // and via the All Members group — which are essentially both the same,
    // for all members.  Also, there's a server side  unimplementedIf,
    // if trying to load Everyone members. [502RKGWT50]
    if (member.id === Groups.EveryoneId &&
        // So admins who might have configured "weird" Everyone notfs can undo that:
        location.hash.indexOf('configEveryone=true') === -1)
      return r.p({},
        r.span({ className: 's_ConfAllMemInst' },
          "Go ", Link({ to: linkToMembersNotfPrefs(Groups.AllMembersId) }, "here"),
          " instead,"),
        " and configure notifications for the All Members group.");


    // ----- Whole site

    const forWho = isMe ? '' :
        rFr({}, `, ${t.upp.forWho} `, r.b({}, member.username));

    const notfPrefsWholeSite =
        r.div({},
          r.span({}, t.upp.DefNotfsSiteWide, forWho, ':'),
          notfs.PageNotfPrefButton({ target: { wholeSite: true }, store,
              className: 'e_SiteNfLvB',
              ownPrefs: membersPrefs, ppsById,
              saveFn: (notfLevel: PageNotfLevel) =>
                saveAndReload({ wholeSite: true }, notfLevel) }));


    // ----- Topics replied to

    const youHave = isMe ? "you have" :   // I18N
        rFr({}, r.b({}, member.username), " has");

    // Show as admin help text?
    // A good default is to configure All Members to get notified about
    // Every Post in a topic where one has replied — otherwise people sometimes
    // get surprised when they thought they replied to someone, but that person
    // in fact wasn't notified and never replied back.
    // And large communities with big 100 comments long discussions,
    // like at HackerNews, might want to change this default, so people get
    // notified only about replies in sub threads they started themselves.

    const notfPrefForTopicsRepliedIn =
        r.div({},
          r.span({}, `Default notifications for topics `, youHave, ` replied in:`),
          notfs.PageNotfPrefButton({ target: { pagesPatRepliedTo: true }, store,
              className: 'e_ReToNfLvB',
              ownPrefs: membersPrefs, ppsById,
              saveFn: (notfLevel: PageNotfLevel) =>
                saveAndReload({ pagesPatRepliedTo: true }, notfLevel) }));


    // ----- Categories

    // Why list all categories, and notf levels per category?
    //
    // Instead of listing all categories, and a notf level dropdown per category,
    // *Discourse* lists all notification levels, and shows a list of
    // categories that one has subscribed to with the respective notification level.
    //
    // However, that's the wrong approach for Talkyard? Because Talkyard
    // has notification settings inheritance: you inherit settings from
    // groups you're in, and also a sub category inherits settings from
    // its parent category.
    //
    // And to make it easy to see from where a notification level
    // got inhereited, it's simpler / better to list all categories,
    // and notification settings per category?
    // Then there's space for adding text like "Inherited from <group name>"
    // next to a category name and notf level. So it'll be clear
    // to people why their notf settings might be different from
    // the defaults.
    //
    // Also, this list-categories-first approch is more user friendly?
    // (Instead of notf levels first.)
    // Because then, if the staff wants to subscribe a group or a user
    // to a category, they need to just click the per category notf
    // settings dropdown. Rather than (the Discourse approach) remembering
    // and starting typing the category name in a multi select. ...
    //
    // (...Later: In the rare cases when a site has surprisingly many
    // categories, then, can add a filter-categories-by-name filter. Or if
    // many sub categories, collapse/open them.)

    const categories: Category[] = membersPrefs.categoriesMaySee;
    const catsTree = categories_sortTree(categories);

    const makeCatNotfPrefs = (category: CatsTreeCat, depth: Nr) => {
      if (depth > CategoryDepth.SubSubCatDepth) {
        // @ifdef DEBUG
        die("Sub sub sub cats not supported. Category cycle? [TyE4056MWK3]");
        // @endif
        return false;
      }

      const target: PageNotfPrefTarget = { pagesInCategoryId: category.id };
      const effPref = pageNotfPrefTarget_findEffPref(target, store, membersPrefs);
      const isUsingInheritedLevel = !effPref.notfLevel;
      const inheritedWhy = !isUsingInheritedLevel ? null :
          makeWhyNotfLvlInheritedExpl(effPref, ppsById);

      let subCatPrefs;
      if (category.subCats) {
        subCatPrefs = r.ol({ className: 's_UP_Prfs_Ntfs_Cs_C_SubCs'},
            category.subCats.map(c => makeCatNotfPrefs(c, depth + 1)));
      }

      return r.li({ key: category.id, className: 's_UP_Prfs_Ntfs_Cs_C e_CId-' + category.id },
        r.span({ className: 's_UP_Prfs_Ntfs_Cs_C_Name' }, category.name + ':'),
        notfs.PageNotfPrefButton({ store, target, ppsById, ownPrefs: membersPrefs,
            saveFn: (notfLevel: PageNotfLevel) => {
              saveAndReload(target, notfLevel);
            }}),
        r.span({}, inheritedWhy),
        subCatPrefs);
    };

    const perCategoryNotfLevels =
        r.ul({},
          catsTree.baseCats.map(c => makeCatNotfPrefs(c, CategoryDepth.BaseCatDepth)));

    const what = member.isGroup ? "group" : "user";
    const categoriesMayNotSee: Category[] = membersPrefs.categoriesMayNotSee;
    const categoriesMayNotSeeInfo = !categoriesMayNotSee.length ? null :
        r.div({ className: 's_UP_Prfs_Ntfs_NotSeeCats' },
          r.p({}, `This ${what} cannot see these categories, but you can:`),
          r.ul({},
            categoriesMayNotSee.map(c => r.li({ key: c.id }, c.name))));

    const saveAndReload = (target, notfLevel) => {
      Server.savePageNotfPrefUpdStoreIfSelf(member.id, target, notfLevel, () => {
        if (this.isGone) return;
        this.loadNotfPrefs();
      });
    };

    return (
      r.div({ className: 's_UP_Prfs_Ntfs' },

        notfPrefsWholeSite,

        r.br(),
        notfPrefForTopicsRepliedIn,

        r.h3({}, t.Categories),
        r.p({}, "You can configure notifications, per category:"),  // I18N

        perCategoryNotfLevels,

        categoriesMayNotSeeInfo,

        // @ifdef DEBUG
        r.br(),
        r.br(),
        r.pre({}, "(In debug builds only) membersPrefs:\n" +
            JSON.stringify(membersPrefs, undefined, 2)),
        // @endif
        null,
        ));

      // +  [ ] Send me email notifications, also when I'm here and reading already
      //    By default, we don't, to avoid double notifying you, both via the browser and via emails.
      // [notf-email-if-active]

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
    const user: UserInclDetails = this.props.user;
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
    const user: UserInclDetails = this.props.user;
    const prefs = {
      userId: user.id,
      seeActivityMinTrustLevel: seeActivityMinTrustLevel,
    };
    // Dupl code [save_pat_pref].
    Server.saveMemberPrivacyPrefs(prefs, (r: { patNoStatsNoGroupIds: PatVb }) => {
      if (this.isGone) return;
      this.setState({
        savingStatus: 'Saved',
      });
      this.props.updatePat(r.patNoStatsNoGroupIds);
    });
    this.setState({ savingStatus: 'Saving' });
  },

  render: function() {
    const state = this.state;
    const me: Myself = this.props.store.me;
    const user: UserInclDetails = this.props.user;

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

        // If in the future, adding options for being a bit invisible and not receiving
        // messages from others — then, stop publishing presence here: [PRESPRIV].

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



const SecurityPrefsTab = React.createFactory<any>(function(props: {
        user: UserInclDetails, store: Store }) {

  const store = props.store;
  const user = props.user;

  const [sessionsOrNull, setSessions] = React.useState<Session[] | N>(null);

  // Break out hook? [my_cur_id]
  const me = store.me;
  const myIdRef = React.useRef(me.id);

  React.useEffect(() => {
    myIdRef.current = me.id;
    listPatsSessions();
    return () => myIdRef.current = null;
  }, []);//, [me.id, user.id]);

  function listPatsSessions() {
    // If one is admin, then, `me` can be !== `user`.
    Server.listSessions(user.id, (resp: ListSessionsResponse) => {
      if (myIdRef.current !== me.id) return;
      // Show most recent first.
      const sessionsByTime = [...resp.sessions].sort(
              function(a,b ) { return b.createdAt - a.createdAt; });
      setSessions(sessionsByTime);
    });
  }

  if (!sessionsOrNull)
    return r.p({}, t.Loading);

  const sessions: Session[] = sessionsOrNull;
  let numActive = 0;

  const sessionItems = sessions.map((session: Session) => {
    if (!session.deletedAt && !session.expiredAt) numActive += 1;
    return r.li({ key: session.createdAt },
        SessionInfo(session, endSession, me));
  });

  function endSession(ps: { session?: Session, all?: true }) {
    const sessionsStartedAt = ps.session && [ps.session.createdAt];
    Server.terminateSessions({ forPatId: user.id, sessionsStartedAt, all: ps.all },
            (resp: TerminateSessionsResponse) => {
      if (myIdRef.current !== me.id) return;
      // Is sorted by time already, see sort(..) above.
      const sessionsAfter = arr_replaceMany(sessions,
              resp.terminatedSessions, (s: Session) => s.createdAt);
      setSessions(sessionsAfter);
    });
  }

  const isMyOnlySession = me.id === user.id && numActive === 1;

  const logOutEverywhereBtn = !numActive || isMyOnlySession ? null :
      Button({ className: 'c_SessL_EndAllB', onClick: () => endSession({ all: true })},
          "Log out everywhere (but not here)");   // I18N

  return (
    r.div({},
      // Later: "You're logged in on these devices:"
      // Or: "You are logged in on these devices, or were recently:"
      // Or: "Active or recently active devices:"  ?
      r.h2({}, "Active sessions:"),  // I18N
      r.ol({ className: 'c_SessL' }, sessionItems),
      sessionItems.length ? null : r.p({}, "None"), // I18N
      logOutEverywhereBtn,
      ));
});


function SessionInfo(session: Session, endSessionFn: (ps: { session: Session }) => V, me: Me) {
  const createdAt: St = new Date(session.createdAt).toISOString();
  let activeOrEnded: St;

  let deletedAt = session.deletedAt;
  let expiredAt = session.expiredAt;
  if (deletedAt && expiredAt) {
    if (deletedAt <= expiredAt) expiredAt = null;
    else deletedAt = null;
  }

  const isCurrent = me.mySidPart1 !== session.part1 ? '' :
          " — this session, here";

  let terminateBtn: RElm | U;
  let activeOrEndedClass = 'c_SessL_Sess-Ended';

  if (deletedAt) {
    activeOrEnded = " — got deleted at " + new Date(deletedAt).toISOString();
  }
  else if (expiredAt) {
    activeOrEnded = " — expired at " + new Date(expiredAt).toISOString();
  }
  else {
    activeOrEnded = isCurrent ? '' : " — currently active";
    activeOrEndedClass = 'c_SessL_Sess-Active';

    // Skip logout button for the current session. It's better if one stays logged
    // in and can see that the relevant sessions got terminated properly. And
    // thereafter click Log Out in one's username menu. (Or?)
    terminateBtn = me.mySidPart1 === session.part1 ? null :
          Button({ className: 'c_SessL_Sess_EndB',
              onClick: () => endSessionFn({ session }) }, "Log out");  // I18N
  }

  let debugJson = null;
  // @ifdef DEBUG
  debugJson = r.pre({}, JSON.stringify(session, undefined, 3));
  // @endif

  return r.div({ className: 'c_SessL_Sess ' + activeOrEndedClass },
      r.span({}, "Session started at " + createdAt + isCurrent + activeOrEnded),
      debugJson,
      terminateBtn);
}



const AccountTabForGroup = React.createFactory<any>(function(props: { member: Group, store: Store }) {
  const me: Myself = props.store.me;
  const group: Group = props.member;

  function deleteGroup() {
    util.openDefaultStupidDialog({  // dupl code [DELYESNO]
      body: `Delete group '${group.fullName || group.username}'? Cannot be undone.`,
      primaryButtonTitle: t.Cancel,
      secondaryButonTitle: t.upp.YesDelete,  // UX red color (still keep Cancel = blue primary color)
      onCloseOk: (number) => {
        if (!number || number === 1) {
          // Click outside dialog, or on primary button = cancel, do nothing.
        }
        else {
          dieIf(number !== 2, 'TyE6UKBA');
          Server.deleteGroup(group.id, () => location.assign(GroupsRoot));
        }
      },
    });
  }

  const dangerZone = !me.isAdmin ? null : (
    rFragment({},
      r.h3({ style: { marginBottom: '1.3em' }}, t.upp.DangerZone),
      Button({ onClick: deleteGroup, className: 'e_DlAct' }, t.gpp.DeleteGroup)));

  return (
    r.div({ className: 's_UP_EmLg' },
      dangerZone,
    ));
});


const AccountTab = createFactory<any, any>({
  displayName: 'AccountTab',

  getInitialState: function() {
    return {
      verifEmailsSent: {},
    };
  },

  componentDidMount: function() {
    const user: UserInclDetails = this.props.user;
    this.loadEmailsLogins(user.id);
  },

  componentWillUnmount: function() {
    this.isGone = true;
  },

  UNSAFE_componentWillReceiveProps: function(nextProps) {
    // a bit dupl code [5AWS2E9]
    const me: Myself = this.props.store.me;
    const user: UserInclDetails = this.props.user;
    const nextMe: Myself = nextProps.store.me;
    const nextUser: UserInclDetails = nextProps.user;
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
    const user: UserInclDetails = this.props.user;
    Server.addEmailAddresses(user.id, this.state.newEmailAddr, (response: UserAccountResponse) => {
      if (this.isGone) return;
      this.setState({ isAddingEmail: false, doneAddingEmail: true });
      this.setState(response);
    });
  },

  resendEmailAddrVerifEmail: function(emailAddress: string) {
    const user: UserInclDetails = this.props.user;
    Server.resendEmailAddrVerifEmail(user.id, emailAddress);
    this.state.verifEmailsSent[emailAddress] = true; // modifying in place, oh well [redux]
    this.setState({ verifEmailsSent: this.state.verifEmailsSent });
  },

  removeEmailAddress: function(emailAddress: string) {
    const user: UserInclDetails = this.props.user;
    Server.removeEmailAddresses(user.id, emailAddress, (response: UserAccountResponse) => {
      if (this.isGone) return;
      // Remove the check-your-inbox message, in case the user remoed the email just added.
      this.setState({ doneAddingEmail: undefined, ...response });
    });
  },

  setPrimary: function(emailAddress: string) {
    const user: UserInclDetails = this.props.user;
    Server.setPrimaryEmailAddresses(user.id, emailAddress, (response: UserAccountResponse) => {
      if (this.isGone) return;
      this.setState(response);
      this.props.reloadUser();
    });
  },

  downloadMyContent: function() {
    const user: UserInclDetails = this.props.user;
    window.open(Server.makeDownloadMyContentUrl(user.id), '_blank');
  },

  downloadPersonalData: function() {
    const user: UserInclDetails = this.props.user;
    window.open(Server.makeDownloadPersonalDataUrl(user.id), '_blank');
  },

  deleteUser: function() {
    const me: Myself = this.props.store.me;
    const user: UserInclDetails = this.props.user;
    const isMe = me.id === user.id;
    util.openDefaultStupidDialog({  // dupl code [DELYESNO]
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
    const user: UserInclDetails = this.props.user;
    const isMe = me.id === user.id;

    if (!this.state.emailAddresses)
      return r.p({}, t.Loading);

    const emailAddrs: UserAccountEmailAddr[] = this.state.emailAddresses;
    const loginMethods: UserAccountLoginMethod[] = this.state.loginMethods;

    const emailAddressesList =
      r.ul({ className: 's_UP_EmLg_EmL' },
        emailAddrs.map((addr: UserAccountEmailAddr) => {
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
          _.each(loginMethods, (method: UserAccountLoginMethod) => {
            if (method.idpEmailAddr === addr.emailAddress) {
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
          const maybeIdpUserId = !method.idpUserId || !me.isAdmin ? null :
                rFr({}, r.br(), "IDP user id: ", r.code({}, method.idpUserId));

          const maybeIdpAuthUrl = !method.idpAuthUrl || !me.isAdmin ? null :
                rFr({}, r.br(), "IDP auth url: ", r.code({}, method.idpAuthUrl));

          const comma = method.idpUsername && method.idpEmailAddr ? ', ' : '';

          return r.li({ className: 's_UP_EmLg_LgL_It',
                      key: `${method.provider}:${method.idpUserId}` },
            r.span({ className: 's_UP_EmLg_LgL_It_How' }, method.provider),
            t.upp.commaAs,
            r.span({ className: 's_UP_EmLg_LgL_It_Un' }, method.idpUsername),
            comma,
            r.span({ className: 's_UP_EmLg_LgL_It_Em' }, method.idpEmailAddr),
            maybeIdpUserId,
            maybeIdpAuthUrl)
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
        Button({ onClick: this.deleteUser, className: 'e_DlAct' }, t.upp.DeleteAccount)));

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




const UiPrefsTab = React.createFactory(
      function (props: { store: Store, user: UserInclDetails }) {

  const me: Myself = props.store.me;
  const user: UserInclDetails = props.user;

  const myId = React.useRef(me.id);  // COULD break out this + useEffect to  useMyId ? Hmm
  React.useEffect(() => {
    myId.current = me.id;
    return () => myId.current = null;
  }, [me.id]);

  if (user_isGuest(user))
    return r.p({}, "Cannot set UI preferences for guests.");

  const [prefsText, setPrefsText] = React.useState(JSON.stringify(user.uiPrefs));
  const [jsonError, setBadJsonError] = React.useState(false);

  // Dupl Saving... code [7UKBQT2]
  const [savingStatus, setSavingStatus] = React.useState(0);
  let savingInfo = null;
  if (savingStatus === 1) {
    savingInfo = r.i({}, ' ' + t.SavingDots);
  }
  else if (savingStatus === 2) {
    savingInfo = r.i({ className: 'e_Saved' }, ' ' + t.SavedDot);
  }

  function saveUiPrefs(event) {
    event.preventDefault();
    let prefsJson;
    try {
      prefsJson = JSON.parse(prefsText)
      setSavingStatus(1);
      Server.saveUiPrefs(user.id, prefsJson, () => {
        if (myId.current !== me.id) return;
        setSavingStatus(2);
      });
    }
    catch (ex) {
      setBadJsonError(true);
    }
  }

  return r.div({},
    r.p({}, "User interface (UI) preferences:"),    // [6KXTEI]
    r.form({ role: 'form', onSubmit: saveUiPrefs },
      Input({ type: 'textarea',
          label: "JSON config (ignore this for now; we'll add nice buttons later)",
          onChange: (event) => {
            setBadJsonError(false);
            setPrefsText(event.target.value);
          },
          value: prefsText }),

      jsonError ?
          r.p({ style: { color: 'red', fontWeight: 'bold' }}, "ERROR: Bad JSON") : null,

      InputTypeSubmit({ className: 'e_SaveUiPrefs', style: { marginTop: '11px' }, value: t.Save }),
      savingInfo));
});


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
