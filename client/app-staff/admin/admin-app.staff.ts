/*
 * Copyright (C) 2015-2017 Kaj Magnus Lindberg
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

/// <reference path="../staff-prelude.staff.ts" />
/// <reference path="review-all.staff.ts" />
/// <reference path="api-panel.staff.ts" />
/// <reference path="users.staff.ts" />
/// <reference path="contents-panel.staff.ts" />
/// <reference path="backup-panel.staff.ts" />
/// <reference path="users-one.staff.ts" />
/// <reference path="hostname-editor.staff.ts" />

declare const _me: Myself;  // [7UKWBA2]


//------------------------------------------------------------------------------
   namespace debiki2.admin {
//------------------------------------------------------------------------------

const r = ReactDOMFactories;
const Alert = rb.Alert;

const PageUnloadAlerter = utils.PageUnloadAlerter;

const SsoTestPath = '/-/sso-test';


function showAll() {
  return location.hash.indexOf('&showAll') >= 0;
}


export function staffRoutes() {
  // Only admins may currently access the settings tab. Moderators are instead supposed to review.
  // (Moderators actually do load the settings though [5KBRQT2].)
  // If may load the admin page, then logged in for sure, either admin or moderator.
  const isAdmin = _me && _me.isAdmin;
  const section = isAdmin ? 'settings' : 'review/all';   // [8ABKS2]
  return Switch({},
      Redirect({ from: AdminRoot, to: AdminRoot + section, exact: true }),
      Route({ path: SsoTestPath, component: SsoTestComponent }),
      Route({ path: AdminRoot, component: AdminAppComponent }));
}



export const NotYetImplementedComponent = createReactClass(<any> {
  displayName: 'NotYetImplementedComponent',
  render: function() {
    return (
      r.p({}, 'Not yet implemented. [EsM4GPY72]'));
  }
});


const SsoTestComponent = createReactClass(<any> {
  displayName: 'SsoTestComponent',
  mixins: [debiki2.StoreListenerMixin],

  getInitialState: function() {
    return {
      store: debiki2.ReactStore.allData(),
    };
  },

  onChange: function() {
    this.setState({
      store: debiki2.ReactStore.allData(),
    });
  },

  render: function() {
    const store: Store = this.state.store;
    const settings = store.settings;
    const me: Myself = store.me;
    const ssoUrl = login.makeSsoUrl(
            store, window.location.toString(), true /* forTySsoTest */);

    const noSsoUrlInfo = ssoUrl ? null :
      rFragment({},
        r.p({},
          r.b({}, "You have not configured any Single Sign-On URL.")),
        r.p({},
          "Nothing to do, nothing to test."));

    const alreadyLoggedInInfo = !me.isLoggedIn ? null :
      rFragment({},
        r.p({},
          r.b({ className: 'e_SsoTstLgdIn' }, "You are already logged in"),
          ", as ", r.samp({ className: 'e_LgdInAs' }, '@' + me.username),
          ". You need to be logged out, to test SSO. (Or did you just login via SSO?)"),
        r.p({},
          "So, open another browser, or an Incognito window in this browser: " +
          "click CTRL + SHIFT + N, typically.", r.br(),
          "And then try out SSO: Go to this same page, in that other browser or window, " +
          "and follow the instructions that will then appear (when you're logged out)."));

    const testInfoAndLink = me.isLoggedIn ? null :
      rFragment({},
        r.p({},
          "Here you can test Single Sign-On. You're not logged in " +
          "— let's see if you can log in via SSO?"),
        r.p({},
          "The SSO URL you've specified is, before replacing variables like ",
            r.samp({}, '${talkyardPathQueryEscHash}'), " with your current URL path:"),
        r.p({},
          r.samp({ className: 'e_SsoSettingsUrl' }, settings.ssoUrl)),
        r.p({},
          "And as a clickable link, after replacing variables:"),
        r.p({},
          r.a({ href: ssoUrl, className: 'e_SsoTstLgiLnk' }, ssoUrl)),
        r.p({},
          "To test SSO, read the rest of this page, and then click that link. " +
          "It'll redirect you to your own login page at your website, " +
          "and that's where people will get sent, when they " +
          "are not logged in, and click things like Reply or Log In."),
        r.p({},
          "After you have logged in at your website, your server should " +
          "send an API request to:", r.br(),
          r.samp({}, location.origin + '/-/v0/sso-upsert-user-generate-login-secret'), r.br(),
          "to synchronize your user account with Talkyard's user database, " +
          "and get a login secret. " +
          "Then your server should redirect you to: ", r.br(),
          r.samp({}, location.origin +
              '/-/v0/login-with-secret?oneTimeSecret=nnnnn&thenGoTo=/-/sso-test'), r.br(),
          "which will log you in here (at Talkyard), and redirect you back to this page again " +
          "— and then you'll be logged in."));

    return (
      r.div({ className: 'esAdminArea' },
        r.div({ className: 'container' },
          r.h1({}, "Single Sign-On Test"),
          r.br(),
          r.br(),
          noSsoUrlInfo || alreadyLoggedInInfo || testInfoAndLink,
          r.br(),
          r.p({},
            r.a({ href: linkToAdminPageLoginSettings(), className: 'e_BkToStngs' },
              "Back to login settings"),
            r.br(),
            r.br(),
            r.a({ href: '/' }, "Home"))
          )));
  }
});

const AdminAppComponent = createReactClass(<any> {
  displayName: 'AdminAppComponent',
  mixins: [debiki2.StoreListenerMixin],
  // mixins: [PageUnloadAlerter.AlertIfLeavingRouteMixin], SHOULD make Alert... work again

  getInitialState: function() {
    return {
      store: debiki2.ReactStore.allData(),
      defaultSettings: null,
      currentSettings: null,
      editedSettings: null,
    };
  },

  onChange: function() {
    this.setState({
      store: debiki2.ReactStore.allData(),
    });
  },

  componentDidMount: function() {
    this.loadAllSettingsIfNeeded();
  },

  componentWillUnmount: function() {
    this.isGone = true;
  },

  loadAllSettingsIfNeeded: function() {
    if (this.state.currentSettings || this.isLoading)
      return;
    this.isLoading = true;
    Server.loadSiteSettings(currentAndDefaultSettings => {
      if (this.isGone) return;
      this.isLoading = false;
      this.setState({
        defaultSettings: currentAndDefaultSettings.defaultSettings,
        currentSettings: currentAndDefaultSettings.effectiveSettings,
        baseDomain: currentAndDefaultSettings.baseDomain,
        // COULD Actually make use of this addr, here: [CONFADDRS]
        dnsCnameTargetHost: currentAndDefaultSettings.dnsCnameTargetHost,
        hosts: currentAndDefaultSettings.hosts,
        editedSettings: {},
      });

      // Top tab pane unmount bug workaround. [5QKBRQ].
      // With React 16.4 and React-Router 4.3.1, the Switch(..) router contents get unmounted &
      // remounted once, after the review tasks have loaded and setState(whatever) happens — if
      // the component is located in *another file* than this file (weird!).
      // Work around this, by triggering a rerender directly.
      // Otherwise, if it suddenly unmounts, some Review page buttons fail to update properly
      // Didn't happened, with Chrome Dev Tools' React.js plugin installed — so, to reproduce,
      // open an incognito browser window (then, dev tools React plugin shouldn't load).
      if (location.pathname.indexOf('/review') >= 0) {
        setTimeout(() => {
          if (this.isGone) return;
          console.debug("Unmount issue workaround [TyD4WKQR2]");
          // This triggers an unmount of the current tab contents, unless it's been unmounted
          // already (e.g. switching to another tab).
          this.setState({});
        }, 600);
      }
    });
  },

  // Quick hack that makes the settings area smaller so the savebar won't occlude its lower part.
  // Later: Use Redux, then the is-savebar-visible state will be accessible to whatever so it
  // can adjust the .esPageColumn in the React.js way.
  // Disable for now, because now position; static, not fixed. [5GK3FW0]
  /*
  componentDidUpdate: function() {
    if (this.hasUnsavedSettings()) {
      $('#esPageColumn').css('bottom', $('.esA_SaveBar').outerHeight());
    }
    else {
      $('#esPageColumn').css('bottom', 0);
    }
  }, */

  hasUnsavedSettings: function() {
    return !_.isEmpty(this.state.editedSettings);
  },

  removeUnchangedSettings: function(settings: PartialSettings) {
    _.each(settings, (value, name) => {
      const currentValue = this.state.currentSettings[name];
      if (currentValue === value) {
        delete settings[name];
      }
    });
  },

  setEditedSettings: function(newSettings) {
    this.setState({ editedSettings: newSettings });
  },

  saveSettings: function() {
    Server.saveSiteSettings(this.state.editedSettings, (result) => {
      if (this.isGone) return;
      this.setState({
        currentSettings: result.effectiveSettings,
        editedSettings: {},
      });
    });
  },

  undoSettings: function() {
    this.setState({ editedSettings: {} });
  },

  render: function() {
    const store: Store = this.state.store;
    const currentSettings: Settings = this.state.currentSettings;
    const me = store.me;
    if (!me)
      return r.p({}, "Not logged in");

    if (!currentSettings)
      return r.p({}, "Loading ...");

    const ar = AdminRoot;

    const dashboardLink = me.isAdmin ?
        LiNavLink({ to: ar + 'dashboard', className: 'e_DashbB' }, "Dashboard") : null;

    const settingsLink = me.isAdmin ?
        LiNavLink({ to: ar + 'settings', className: 'e_StngsB' }, "Settings") : null;

    const contentsLink = me.isAdmin && currentSettings.showExperimental ?
        LiNavLink({ to: ar + 'contents', className: 'e_ContB' }, "Contents") : null;

    const customizeLink = me.isAdmin ?
        LiNavLink({ to: ar + 'customize', className: 'e_LnFB' }, "Look and feel") : null;

    const backupLink = me.isAdmin && currentSettings.showExperimental ?
        LiNavLink({ to: ar + 'backup', className: 'e_BkpB' }, "Backup") : null;

    const apiLink = me.isAdmin && currentSettings.enableApi ?
      LiNavLink({ to: ar + 'api', className: 'e_ApiB' }, "API") : null;

    const saveBar = _.isEmpty(this.state.editedSettings) ? null :
      r.div({ className: 'esA_SaveBar' },
        r.div({ className: 'container' },
          PrimaryButton({ onClick: this.saveSettings,
            // UX BUG: Not visilbe, on emb comments settings page,
            // if has choose Gatsby — because those instructions are tall,
            // and pushes this button below the window,
            //   ... so people won't see it? might not click it?
            className: 'esA_SaveBar_SaveAllB' }, "Save all changes" ),
          Button({ onClick: this.undoSettings,
            className: 'esA_SaveBar_UndoAllB' }, "Undo all changes" )));

    const childProps: AdminPanelProps = {
      store: store,
      loadAllSettingsIfNeeded: this.loadAllSettingsIfNeeded,
      defaultSettings: this.state.defaultSettings,
      currentSettings: this.state.currentSettings,
      editedSettings: this.state.editedSettings,
      hosts: this.state.hosts,
      removeUnchangedSettings: this.removeUnchangedSettings,
      setEditedSettings: this.setEditedSettings,
    };

    // Make it simpler for people to find the blog comments settings,  [5RKTF29]
    // if the site is for blog comments.
    const defaultSettingsPath = isBlogCommentsSite() ? '/embedded-comments' : '/legal';

    // [React_Router_v51] skip render(), use hooks and useParams instead.
    const childRoutes = Switch({},
        RedirAppend({ path: ar + 'users', append: '/enabled' }),
        RedirAppend({ path: ar + 'review', append: '/all' }),
        RedirAppend({ path: ar + 'settings', append: defaultSettingsPath }),
        RedirAppend({ path: ar + 'customize', append: '/basic' }),
        Route({ path: ar + 'dashboard', render: () => DashboardPanel(childProps) }),
        Route({ path: ar + 'settings', render: () => SettingsPanel(childProps) }),
        Route({ path: ar + 'users', render: () => UsersTab(childProps) }),
        Route({ path: ar + 'contents', render: () => ContentsPanel(childProps) }),
        Route({ path: ar + 'customize', render: () => CustomizePanel(childProps) }),
        Route({ path: ar + 'backup', render: () => BackupPanel(childProps) }),
        Route({ path: ar + 'api', render: () => ApiPanel(childProps) }),
        Route({ path: ar + 'review', render: () => ReviewAllPanel(childProps) }));

    return (
      r.div({ className: 'esAdminArea' },
        topbar.TopBar({ customTitle: "Admin Area", showBackToSite: true, extraMargin: true,
            location: this.props.location }),
        debiki2.help.getServerAnnouncements(store),
        r.div({ className: 'container' },
          r.ul({ className: 'dw-main-nav nav nav-pills' },
            dashboardLink,
            settingsLink,
            LiNavLink({ to: ar + 'users', className: 'e_UsrsB' }, "Users"),
            contentsLink,
            customizeLink,
            backupLink,
            apiLink,
            LiNavLink({ to: ar + 'review', className: 'e_RvwB' }, "Moderation")),
          childRoutes,
          saveBar)));
  }
});



/*  Old groups tab

// Keep this for now. Can copy-paste these descriptions into built-in groups'
// about texts?
// (Thereafter, delete the whole BuiltInGroupsPanel.)

function BuiltInGroupsPanel(childProps) {
  const currentSettings: Settings = childProps.currentSettings;
  return (
    r.div({},
      r.h2({}, "Built-in trust level groups"),
      r.p({}, "Members of your community start with trust level New Member, " +
        "in the All Members group. " +
        "Then, when they spend more and more time in this community, and write things others like, " +
        "they advance to higher trust levels: first to Basic Member, then to Full Member, " +
        "Trusted Member, and so on."),
      r.p({}, "Lower trust levels are a bit restricted in what they're allowed to do. " +
        "For example, new members may not post so many posts per day. These restrictions " +
        "are lifted, for a member, when s/he advances to higher trust levels."),
      r.p({}, "The groups below listed first, e.g. All Members and Full Members, include " +
        "the groups listed further below. For example, the Basic Members " +
        "group includes people in the Full Members and Trusted Members groups, too."
        /*
        "So, if you configure category notifciation preferences for Basic Members, " +
        "that affects, among others, members of the Full Members and Trusted Members groups, " +
        "and all other groups below, too."* / ),
      r.br(),
      r.ul({},
        r.li({},
          r.a({ href: '/-/users/new_members' }, "All members"),
          r.p({}, "Everyone with a user account here." + (
            currentSettings.allowGuestLogin
                ? " (Not guests though; guests don't have real accounts.)"
                : ''))),
        r.li({},
          r.a({ href: '/-/users/basic_members' }, "Basic members"),  // [TLVLBSC]
          r.p({}, "People who have spent a minimum amount of time, about ten minutes, " +
              "reading different topics here.")),
        r.li({},
          r.a({ href: '/-/users/full_members' }, "Full members"),
          r.p({},
            "People who have posted something that another member liked; " +
            "liked something themselves; and " +
            "have spent one hour reading."))),
      r.p({}, "Currently, there's no automatic promotion to these higher trust levels:"),
      r.ul({},
        r.li({},
          r.a({ href: '/-/users/trusted_members', className: 'e_TrstdMbsL' }, "Trusted members"),
          r.p({}, "People who have posted many things others like, over a long period of time, " +
            "like, half a year. And haven't done anything bad.")),
        r.li({},
          r.a({ href: '/-/users/regular_members' }, "Trusted regulars"),
          r.p({}, "Trusted members who visit often, like, many times per week. To some degree, " +
            "you can rely on them to find and report inappropriate things new members might post.")),
        r.li({},
          r.a({ href: '/-/users/core_members' }, "Core members"),
          r.p({}, "Manually appointed by admins. They, together with the staff, can shape the nature " +
            "of the community, via Like and Unwanted votes. " +
            "Will have limited moderation capabilities.")),
        r.li({},
          r.a({ href: '/-/users/moderators' }, "Staff"),
          r.p({}, "Moderators and admins. Moderators can moderate posts and help people " +
            "configure their settings properly. (But they cannot edit admin users' settings.)")),
        r.li({},
          r.a({ href: '/-/users/admins' }, "Admins"),
          r.p({}, "Can do anything, including edit site settings, " +
            "and add more admins and moderators.")),
        )));
} */


function OnlyForAdmins() {
  return r.p({},
      "Only for admins. You can review other people's posts, though, ",
      r.a({ href: linkToAdminPage() }, " go here."));
}



const DashboardPanel = React.createFactory<any>(function(props) {
  const [dashboardData, setDashboardData] = React.useState<AdminDashboard | null>(null);

  React.useEffect(() => {
    loadDashboard();
  }, []);

  function loadDashboard() {
    Server.loadAdminDashboard(setDashboardData);
  }

  if (!dashboardData)
    return r.p({}, "Loading ...");

  const ps = admin.prettyStats(dashboardData.siteStats);

  const megabytesDiskUsed =
        `${prettyNum(ps.fsMb)} MB` + (
              !ps.fsMaxMb ? '' : ` = ${ps.fsPercentStr}% of ${ps.fsMaxMb} MB`);

  return (
    r.div({ class: 's_A_Db' },
      r.h2({}, "Site size"),
      r.p({},
        r.b({}, "Num members: "), r.span({}, dashboardData.siteStats.numParticipants), r.br(),
        r.b({}, "Num pages: "), r.span({}, dashboardData.siteStats.numPages), r.br(),
        r.b({}, "Num posts: "), r.span({}, dashboardData.siteStats.numPosts), r.br(),
        ),
      //r.pre({}, JSON.stringify(dashboardData.siteStats, undefined, 4)),
      r.h2({}, "Disk usage"),

      // kB = kilobytes, 1000 bytes.  1 KiB (uppercase K) = 1 kibi =1024 bytes.
      // MB = 1000 * 1000 byte. MiB = 1024 * 1024 bytes.
      r.p({ class: 's_A_Db_Storage',
            // Don't show this — there'll be a fair use policy instead. In practice
            // should mean unlimited, as long as it's people's discussons, and
            // not auto generated text like 9999 GB log data.
            style: { display: 'none' }},
        `Database storage used: `,
        r.code({}, `${prettyNum(ps.dbMb)} MB = ${
                ps.dbPercentStr}% of ${ps.dbMaxMb} MB`)),

      r.p({ class: 's_A_Db_Storage' },
        r.span({}, `Uploaded files storage used: `),
        r.code({}, megabytesDiskUsed),
        r.span({}, ", in " + dashboardData.siteStats.numUploads + " files."),
        r.br(),
        r.span({}, "(E.g. images and attachments.)")),

      /* This not relevant — with fair use policy instead.
      r.br(),
      r.p({}, "(We try to over estimate the database storage used, so that " +
          "later when we make the estimates more accurate, the numbers will go down.)"),
        */

      // Later: Render w https://github.com/FormidableLabs/victory  ?
      // Looks nice:
      //   https://formidable.com/open-source/victory/about/#showcase
      // Backed by a small biz, FormidableLabs.
      // Found here:
      //   https://dev.to/giteden/top-5-react-chart-libraries-for-2020-1amb
      //
      // Hmm doesn't look nice yet, so display-none:
      r.pre({ style: { display: 'none' }}, JSON.stringify(dashboardData, undefined, 4))));
});



const SettingsPanel = createFactory({
  displayName: 'SettingsPanel',

  componentDidMount: function() {
    this.props.loadAllSettingsIfNeeded();
  },

  render: function() {
    const props = this.props;
    const currentSettings: Settings = props.currentSettings;
    if (!currentSettings)
      return r.p({}, 'Loading...');

    const store: Store = this.props.store;
    const me: Myself = store.me;

    if (!me.isAdmin)
      return OnlyForAdmins();

    const sr = AdminRoot + 'settings/';
    const ps = this.props;

    return (
      r.div({ className: 'esA_Ss' },
        r.ul({ className: 'esAdmin_settings_nav col-sm-2 nav nav-pills nav-stacked' },
          LiNavLink({ to: sr + 'legal', id: 'e2eAA_Ss_LegalL' }, "Legal"),
          LiNavLink({ to: sr + 'login', id: 'e2eAA_Ss_LoginL' }, "Signup and Login"),
          LiNavLink({ to: sr + 'moderation', id: 'e2eAA_Ss_ModL'  }, "Moderation"),
          LiNavLink({ to: sr + 'spam-flags', id: 'e2eAA_Ss_SpamFlagsL'  }, "Spam & flags"),
          LiNavLink({ to: sr + 'features', id: 'e_A_Ss_Features' }, "Features"),
          LiNavLink({ to: sr + 'embedded-comments', id: 'e2eAA_Ss_EmbCmtsL' }, "Embedded Comments"),
          LiNavLink({ to: sr + 'language', id: 'e_AA_Ss_Lang' }, "Language"),
          //LiNavLink({ to: sr + 'email', id: 'e_AA_Ss_Email' }, "Email"),
          LiNavLink({ to: sr + 'site', id: 'e2eAA_Ss_AdvancedL' }, "Site")),
        r.div({ className: 'form-horizontal esAdmin_settings col-sm-10' },
          Switch({},
            // [React_Router_v51] skip render(), use hooks and useParams instead.
            Route({ path: sr + 'legal', render: () => LegalSettings(ps) }),
            Route({ path: sr + 'login', render: () => LoginAndSignupSettings(ps) }),
            Route({ path: sr + 'moderation', render: () => ModerationSettings(ps) }),
            Route({ path: sr + 'spam-flags', render: () => SpamFlagsSettings(ps) }),
            Route({ path: sr + 'features', render: () => FeatureSettings(ps) }),
            Route({ path: sr + 'embedded-comments', render: () => EmbeddedCommentsSettings(ps) }), // [8UP4QX0]
            Route({ path: sr + 'language', render: () => LanguageSettings(ps) }),
            //Route({ path: sr + 'email', render: () => EmailSettings(ps) }),
            Route({ path: sr + 'site', render: () => AdvancedSettings(ps) })))));
  }
});



const LoginAndSignupSettings = createFactory({
  displayName: 'LoginAndSignupSettings',

  getInitialState: function() {
    return {};
  },

  componentDidMount: function() {
    Server.loadIdentityProviders(idps => {
      this.setState({ idps, idpsConfigJsonText: JSON.stringify(idps, undefined, 2) });
    })
  },

  render: function() {
    const props = this.props;
    const currentSettings: Settings = props.currentSettings;
    const editedSettings: Settings = props.editedSettings;
    const defaultSettings: Settings = props.defaultSettings;

    const valueOf = (getter: (s: Settings) => any) =>
      firstDefinedOf(getter(editedSettings), getter(currentSettings));

    const enableCustomIdps = valueOf(s => s.enableCustomIdps);
    const useOnlyCustomIdps = valueOf(s => s.useOnlyCustomIdps);
    const enableTySso = valueOf(s => s.enableSso);
    const enableTySsoOrOnlyCustIdps = enableTySso || useOnlyCustomIdps;
    const loginRequired = valueOf(s => s.userMustBeAuthenticated);
    const allowSignup = valueOf(s => s.allowSignup);
    const requireVerifiedEmail = valueOf(s => s.requireVerifiedEmail);
    const mayComposeBeforeSignup = valueOf(s => s.mayComposeBeforeSignup);
    const featureFlags = valueOf(s => s.featureFlags);
    const allowEmbeddingFrom = valueOf(s => s.allowEmbeddingFrom);

    const canEnableGuestLogin =
            !valueOf(s => s.userMustBeApproved) && !loginRequired &&
              valueOf(s => s.allowSignup) && !requireVerifiedEmail &&
              !enableTySsoOrOnlyCustIdps;  // && !invite-only (6KWU20)

    const missingServerSiteHint = (isConfiguredOnServer: boolean) => isConfiguredOnServer ? '' :
        " Cannot be enabled, because has not been configured server side, " +
        "in /opt/talkyard/conf/play-framework.conf.";

    const ssoTestPageLink =
            r.a({ href: '/-/sso-test', className: 'e_SsoTestL' }, "/-/sso-test");
    const adminLoginLink =
            r.a({ href: '/-/admin-login', className: 'e_AdmLgiL' }, "/-/admin-login");

    // COULD show this warning also in the embedded commenst tab.
    // But maybe better spend the time adding another permission setting:
    // May embed pages, although forum is Login Required. [emb_login_req]
    const cannotCombineLoginReqWithEmbCmts =
            " Error: Cannot combine Login Required with Embedded Comments [TyE592RKD] ";
    const [embCommentsBroken1, embCommentsBroken2] =
            !loginRequired || !allowEmbeddingFrom ? [null, null] : [
                r.div({ className: 'col-sm-offset-3 s_A_Ss_Err'},
                    cannotCombineLoginReqWithEmbCmts),
                r.span({ className: 's_A_Ss_S_Err'},
                    cannotCombineLoginReqWithEmbCmts)];

    return (
      r.div({},
        enableTySso ? null : Setting2(props, {
          type: 'checkbox', label: "Allow signup", id: 'e_AllowSignup',
          help: "Uncheck to prevent people from creating new accounts.",
          getter: (s: Settings) => s.allowSignup,
          update: (newSettings: Settings, target) => {
            newSettings.allowSignup = target.checked;
            // Other signup settings have no effect, if new signups are prevented.
            // But, instead of setting all those other settings to false, or disabling them
            // — hide them. Then 1) the admins won't need to wonder what it means, that
            // one of those settings is checked, but disabled. And 2) won't have all their
            // current signup settings auto-changed to false, and forget to reenable some of
            // them later when allowing signup again.
          }
        }),

        /*
        enableTySsoOrOnlyCustIdps || !allowSignup ? null : Setting2(props, {
          type: 'checkbox', label: "Invite only", id: 'e_InviteOnly',
          help: r.span({}, "No one may join, unless they're invited by staff " +
            "(to invite someone, click Users above, then Invite)."),
          getter: (s: Settings) => s.inviteOnly,
          update: (newSettings: Settings, target) => {
            newSettings.inviteOnly = target.checked;
            }
          }
          ... later ... and enable  (6KWU20) above.
        }), */

        embCommentsBroken1,

        Setting2(props, { type: 'checkbox', label: "Login required", id: 'e2eLoginRequiredCB',
          className: 'e_A_Ss_S-LoginRequiredCB',
          // Won't work with blog comments !
          // Maybe new category access permission? Visible to strangers,
          // if embedded? + error if not
          help: r.span({}, "Require authentication to read content. Users must then login " +
            "with ", r.i({}, "for example"), " password, or Google or Facebook or Single Sing-On " +
            "— but anonymous access is disabled.",
             embCommentsBroken2),
          getter: (s: Settings) => s.userMustBeAuthenticated,
          update: (newSettings: Settings, target) => {
            newSettings.userMustBeAuthenticated = target.checked;
            if (target.checked && valueOf(s => s.allowGuestLogin)) {
              newSettings.allowGuestLogin = false;
              // Don't set 'requireVerifiedEmail' to true though, because one might authenticate
              // via Twitter or Facebook, which doesn't always make any email address available.
            }
          }
        }),

        Setting2(props, { type: 'checkbox', label: "Approve users", id: 'e_ApproveUsersCB',
          className: 'e_A_Ss_S-ApproveUsersCB',
          help: "New users need to be approved by staff before they can do anything more " +
              "than just reading.",  // docs BUG: currently won't get access at all [2KZMQ5]
          getter: (s: Settings) => s.userMustBeApproved,
          update: (newSettings: Settings, target) => {
            newSettings.userMustBeApproved = target.checked;
            if (target.checked && valueOf(s => s.allowGuestLogin)) {
              newSettings.allowGuestLogin = false;
              // Don't set userMustBeAuthenticated to true: it's fine to *not* require auth
              // to *read* content, and *do* require auth and approval to contribute content.
            }
          }
        }),

        // If SSO enabled, email addresses must always have been verified, by the external
        // login provider.
        enableTySsoOrOnlyCustIdps || !allowSignup ? null : Setting2(props, {
          type: 'checkbox', label: "Require verified email",
          className: 'e_A_Ss_S-RequireVerifiedEmailCB',
          help: "New users must specify an email address, and click an email verification link " +
              "(unless verified already via e.g. Gmail or Facebook). Recommended, because you'll " +
              "have a way to contact everyone. And we can send password reset emails.",
          getter: (s: Settings) => s.requireVerifiedEmail,
          update: (newSettings: Settings, target) => {
            newSettings.requireVerifiedEmail = target.checked;
            if (target.checked) {
              // Compose-before-signup *and* requiring-verified-email-addresses, would require
              // us to upload the post, save it server side, and not showing it, until the user
              // has verified hen's email. Not implemented. So, for now:  [SIGNUPDRAFT]
              newSettings.mayComposeBeforeSignup = false;
              // This is always incompatible with 'requireVerifiedEmail':
              newSettings.mayPostBeforeEmailVerified = false;
              newSettings.allowGuestLogin = false;
            }
          }
        }),

        // With SSO, too complicated to let people start typing, and then redir to external site.
        enableTySsoOrOnlyCustIdps || !allowSignup ? null : Setting2(props, {
          type: 'checkbox', label: "May compose before signup",
          className: 'e_A_Ss_S-MayComposeBeforeSignup',
          help: "People may start writing posts before they have signed up. When they try to " +
              "submit their post, they are asked to sign up. Good, because might result in more " +
              "people signing up — because once they've written something already, " +
              "they'll want to signup so they can submit it.",
          disabled: requireVerifiedEmail, // see [SIGNUPDRAFT] above
          getter: (s: Settings) => s.mayComposeBeforeSignup,
          update: (newSettings: Settings, target) => {
            newSettings.mayComposeBeforeSignup = target.checked;
            if (target.checked) {
              // Verifying email after composing & clicking Submit = not implemented. [SIGNUPDRAFT]
              // So need to log the new user in, before email verified: (so can POST & publish post)
              newSettings.mayPostBeforeEmailVerified = true;
            }
          }
        }),

        // With SSO, email must always be verified, when logging in and continuing.
        enableTySsoOrOnlyCustIdps ? null : Setting2(props, {
          type: 'checkbox', label: "May post before email verified",
          className: 'e_A_Ss_S-MayPostBeforeEmailVerifiedCB',
          help: "New users may login and post messages, before they have clicked an email " +
              "verification link. Good, because then people won't need to check their " +
              "email, during the signup process. Bad, because we won't know for sure " +
              "if people's email addresses work. Also means there can be many user accounts " +
              "with the same email address.",
          disabled: requireVerifiedEmail || mayComposeBeforeSignup, // see  [SIGNUPDRAFT] above
          getter: (s: Settings) => s.mayPostBeforeEmailVerified,
          update: (newSettings: Settings, target) => {
            newSettings.mayPostBeforeEmailVerified = target.checked;
          }
        }),

        Setting2(props, { type: 'number', min: 5, max: 60 * 24 * 365 * 999,
          label: "Logout idle user after minutes", className: 'e_LgoIdlAftMins',
          help: "After how long a user who is away, gets logged out. " +
            "Default: one year (525600 minutes). " +
            "This currently does log out also *active* users. " + // [EXPIREIDLE]
            "Will fix this later (so only users who are away get logged out).",
          getter: (s: Settings) => s.expireIdleAfterMins,
          update: (newSettings: Settings, target) => {
            let num = parseInt(target.value);
            if (num < 1) num = 1;
            newSettings.expireIdleAfterMins = num;
          }
        }),

        /* Not yet implemented: (saved to db but won't have any effect)

        doubleTypeEmailAddress: Option[Boolean]
        doubleTypePassword: Option[Boolean]
        begForEmailAddress */


        // ---- Ways to sign up

        r.h2({ className: 'col-sm-offset-3 s_A_Ss_S_Ttl'},
          "Ways to sign up"),


        // ---- Ways to sign up: OpenID Connect

        !enableTySso || !allowSignup ? null : r.p({ className: 'col-sm-offset-3'},
          r.b({}, "Custom OIDC or OAuth2: "),
          "Cannot use when Talkyard's Single Sign-On API enabled, see below."),

        enableTySso || !allowSignup ? null : Setting2(props, {
          type: 'checkbox', label: rFragment({},
              "Custom OIDC", r.br(), "or OAuth2"),
          className: 'e_A_Ss_S-OidcCB',
          help: "Log in via your custom OpenID Connect (OIDC) or OAuth2 " +
              "Identity Provider (IDP), " +
              "e.g. KeyCloak, Azure AD, or GitHub Enterprise. " +
              "You can combine this with social login (Gmail, Facebook etc) " +
              "and local username and password accounts.",
          disabled: !valueOf(s => s.allowSignup),
          getter: (s: Settings) => s.enableCustomIdps,
          update: (newSettings: Settings, target) => {
            newSettings.enableCustomIdps = target.checked;
            if (useOnlyCustomIdps) {
              newSettings.useOnlyCustomIdps = false;
            }
          }
        }),

        enableTySso || !allowSignup || !this.state.idps?.length ? null : rFr({},
          r.label({ className: 'col-sm-3 control-label' },
            "Configure OIDC or OAuth2:"),
          r.div({ className: 's_A_Ss_S s_A_Ss_S-CuIdpsL col-sm-offset-3'},
            enableCustomIdps ? null :
                r.p({},
                  r.b({}, "Disabled"), " — you need to check the ",
                  r.b({}, "OIDC or OAuth2"), " checkbox above"),
            r.ol({ className: ' s_CuIdpsL' +
                        (enableCustomIdps ? '' : ' s_CuIdpsL-Dis') },
              this.state.idps?.map((idp: IdentityProviderSecretConf) => {
                const name = idp.displayName || idp.alias || "No name [TyE702RSG5]";
                const protoAlias = `${idp.protocol}/${idp.alias}`;
                const testLoginUrl = location.origin  + UrlPaths.AuthnRoot +
                        protoAlias + '?returnToUrl=/&nonce=dummyTestLogin'
                return r.li({ className: 's_CuIdpsL_It' },
                  r.div({},
                    r.span({ className: 's_CuIdpsL_It_Name' },
                      name + ': '),
                    r.span({  className: 's_CuIdpsL_It_Host' },
                      url_getHost(idp.oauAuthorizationUrl)),
                    ' ',
                    r.span({  className: 's_CuIdpsL_It_ProtoAlias' },
                      protoAlias)),
                  r.div({ className: 's_CuIdpsL_It_TstLn' },
                    "Login test link: ", r.code({},
                        r.a({ className: 's_CuIdpsL_It_TstLn_Ln', href: testLoginUrl },
                          testLoginUrl)),
                    r.br(),
                    "You can open an incognito window (Ctrl+Shift+N in Chrome), " +
                    "and paste that link, and try to login"));
                })),
            r.pre({},
              JSON.stringify(this.state.idps, undefined, 2)),
            )),

        enableTySso || !allowSignup || !enableCustomIdps || this.state.showOidcConfig ? null :
            Button({ onClick: () => this.setState({ showOidcConfig: true }),
                  className: 'col-sm-offset-3 e_ConfIdpsB' },
              "Configure Identity Providers (IDPs) ..."),

        enableTySso || !allowSignup || !enableCustomIdps ? null : Setting2(props, {
          type: 'checkbox',
          label: rFr({}, r.b({}, "Only"), " your OIDC or OAuth2"),
          className: 'e_A_Ss_S-OnlyOidcCB',
          help: rFr({},
              "Disables all ways to sign up, " +
              "except for your custom OIDC or OAuth2 Identity Providers (IDPs). ",
              r.i({}, "(If you've enabled exactly one custom IDP, " +
              "this means Single Sign-On via that IDP.)"), r.br(),
              "You should be logged in via your custom IDP already, " +
              "otherwise you might lock yourself out?", r.br(),
              r.span({ style: { fontWeight: useOnlyCustomIdps ? 'bold' : undefined }},
                "If you lock yourself out, go here: ",
                r.a({ href: location.origin + UrlPaths.AdminLogin },
                  UrlPaths.AdminLogin))),
          // disabled: // later: disable unless currently logged in via oidc?
          getter: (s: Settings) => s.useOnlyCustomIdps,
          update: (newSettings: Settings, target) => {
            newSettings.useOnlyCustomIdps = target.checked;
          }
        }),

        // CLEAN_UP REFACTOR use Setting2 instead, the  anyChildren param. [nice_oidc_conf_ux]
        enableTySso || !allowSignup || !enableCustomIdps || !this.state.showOidcConfig ? null :
            r.div({ className: 's_A_Ss_S s_CuIdpsEdr' },
              Input({ type: 'textarea', label: rFr({},
                  "ODIC or OAuth2 config", r.br(),
                  "(in JSON, for now)"),
                labelClassName: 'col-sm-3 s_A_Ss_S s_A_Ss_S-Textarea',
                wrapperClassName: 'col-sm-9 esAdmin_settings_setting',
                value: this.state.idpsConfigJsonText,
                onChange: (event) => this.setState({
                  savingOidc: null,
                  idpsConfigJsonText: event.target.value
                }),
                help: undefined }),
              !!this.state.idpConfErr && r.p({ className: 'col-sm-offset-3' },
                  this.state.idpConfErr),
              !!this.state.savingOidc && r.p({ className: 'col-sm-offset-3' },
                  this.state.savingOidc),
              PrimaryButton({
                  className: 'col-sm-offset-3',
                  onClick: () => {
                    let json;
                    try {
                      json = JSON.parse(this.state.idpsConfigJsonText);
                      this.setState({ savingOidc: "Saving ..." });
                      Server.upsertIdentityProvider(json, () => {
                        this.setState({ savingOidc: "Done, saved.", idpConfErr: null });
                        //this.setState({ showOidcConfig: false });
                      }, error => {
                        this.setState({ savingOidc: null, idpConfErr: error });
                      });
                    }
                    catch (ex) {
                      this.setState({ idpConfErr: `Bad JSON: ${ex.toString()}` });
                    }
                  } },
                "Save")),


        // ---- Ways to sign up: Password, Guest

        enableTySsoOrOnlyCustIdps || !allowSignup ? null : Setting2(props, {
          type: 'checkbox', label: "Allow creating local accounts",
          className: 'e_A_Ss_S-AllowLoalSignupCB',
          help: "Uncheck to prevent people from creating email + password accounts at this site.",
          disabled: !valueOf(s => s.allowSignup),
          getter: (s: Settings) => s.allowLocalSignup,
          update: (newSettings: Settings, target) => {
            newSettings.allowLocalSignup = target.checked;
          }
        }),

        enableTySsoOrOnlyCustIdps || !allowSignup ? null : Setting2(props, {
          type: 'checkbox', label: "Allow anonymous \"login\"", id: 'e2eAllowGuestsCB',
          className: 'e_A_Ss_S-AllowGuestsCB',
          help: "Lets people post comments and create topics, without creating real accounts " +
            "with username and password. Instead, they just type a name and email address. " +
            "This can be good for embedded comments sites, so people won't skip posting a comment, " +
            "just because they think it's too cumbersome to create a real account.",
          disabled: !canEnableGuestLogin,
          getter: (s: Settings) => s.allowGuestLogin,
          update: (newSettings: Settings, target) => {
            newSettings.allowGuestLogin = target.checked;
          }
        }),


        // ---- Ways to sign up: OpenAuth

        enableTySsoOrOnlyCustIdps || !allowSignup ? null : Setting2(props, {
          type: 'checkbox', label: "Enable Google signup", id: 'e_EnableGoogleLogin',
          className: 'e_A_Ss_S-EnableGoogleCB',
          help: "Lets people sign up and login with their Gmail account." +
              missingServerSiteHint(defaultSettings.enableGoogleLogin),
          mustBeConfiguredOnServer: true,
          getter: (s: Settings) => s.enableGoogleLogin,
          update: (newSettings: Settings, target) => {
            newSettings.enableGoogleLogin = target.checked;
          }
        }),

        enableTySsoOrOnlyCustIdps || !allowSignup ? null : Setting2(props, {
          type: 'checkbox', label: "Enable Facebook signup",
          className: 'e_A_Ss_S-EnableFacebookCB',
          help: "Lets people sign up and login with their Facebook account." +
              missingServerSiteHint(defaultSettings.enableFacebookLogin),
          mustBeConfiguredOnServer: true,
          getter: (s: Settings) => s.enableFacebookLogin,
          update: (newSettings: Settings, target) => {
            newSettings.enableFacebookLogin = target.checked;
          }
        }),

        enableTySsoOrOnlyCustIdps || !allowSignup ? null : Setting2(props, {
          type: 'checkbox', label: "Enable Twitter signup",
          className: 'e_A_Ss_S-EnableTwitterCB',
          help: "Lets people sign up and login with their Twitter account." +
              missingServerSiteHint(defaultSettings.enableTwitterLogin),
          mustBeConfiguredOnServer: true,
          getter: (s: Settings) => s.enableTwitterLogin,
          update: (newSettings: Settings, target) => {
            newSettings.enableTwitterLogin = target.checked;
          }
        }),

        enableTySsoOrOnlyCustIdps || !allowSignup ? null : Setting2(props, {
          type: 'checkbox', label: "Enable GitHub signup",
          className: 'e_A_Ss_S-EnableGitHubCB',
          help: "Lets people sign up and login with their GitHub account." +
              missingServerSiteHint(defaultSettings.enableGitHubLogin),
          mustBeConfiguredOnServer: true,
          getter: (s: Settings) => s.enableGitHubLogin,
          update: (newSettings: Settings, target) => {
            newSettings.enableGitHubLogin = target.checked;
          }
        }),

        enableTySsoOrOnlyCustIdps || !allowSignup ? null : Setting2(props, {
          type: 'checkbox', label: "Enable LinkedIn signup",
          className: 'e_A_Ss_S-EnableLinkedInCB',
          help: "Lets people sign up and login with their LinkedIn account." +
              missingServerSiteHint(defaultSettings.enableLinkedInLogin),
          mustBeConfiguredOnServer: true,
          getter: (s: Settings) => s.enableLinkedInLogin,
          update: (newSettings: Settings, target) => {
            newSettings.enableLinkedInLogin = target.checked;
          }
        }),


        // ---- Email domain allowlist and blocklist

        // Hide, if SSO enabled or only custom OIDC / OAuth2 allowed
        // — then, the SSO system determines if allowed or not.  [alwd_eml_doms]

        enableTySsoOrOnlyCustIdps || !allowSignup ? null : rFr({},
        r.h2({ className: 'col-sm-offset-3 s_A_Ss_S_Ttl'},
          "Who may sign up?"),

        Setting2(props, {
          type: 'textarea', label: "Email domain allowlist", className: 'e_EmailWhitelist',
          help: rFr({},
            "People may ", r.i({}, "only "),
            "sign up with emails from these domains. One domain per row. " +
            "Lines starting with '#' are ignored (so you can add comments)."),
          getter: (s: Settings) => s.emailDomainWhitelist,
          update: (newSettings: Settings, target) => {
            newSettings.emailDomainWhitelist = target.value;
          }
        }),

        Setting2(props, {
          type: 'textarea', label: "Email domain blocklist", className: 'e_EmailBlacklist',
          help: rFr({},
            "People may ", r.i({}, "not "),
            "sign up with emails from these domains. One domain per row. " +
            "Lines starting with '#' are ignored (so you can add comments)."),
          getter: (s: Settings) => s.emailDomainBlacklist,
          update: (newSettings: Settings, target) => {
            newSettings.emailDomainBlacklist = target.value;
          }
        }),
        ),


        // ---- Talyard's Single Sign-On

        // Hide, if only custom OIDC / OAuth2 is to be used. But if both enabled
        // then show both  (that'd be a bug & impossible — there's a database
        // constraint: settings_c_custom_idps_xor_sso).

        enableCustomIdps && !enableTySso ? null : rFr({},

        r.h2({ className: 'col-sm-offset-3 s_A_Ss_S_Ttl'},
          "Single Sign-On, Talkyard's Own"),

        r.p({ className: 'col-sm-offset-3 s_A_Ss_Expl'},
          "This is Talkyard's custom Single Sign-On protocol. We think it's simpler to" +
          "understand and integrate with, than OIDC (OpenID Connect). " +
          "However if your software supports OIDC (being an ID provider), " +
          "then we think it's better if you use OIDC " +
          "— see the OIDC config section above."),

        Setting2(props, {
          type: 'text', label: "Single Sign-On URL",
          className: 'e_SsoUrl',
          help: rFragment({},
            r.p({},
              "Where at your website (if any) to redirect a user, for SSO signup or login. Example: "),
            r.p({},
              r.samp({}, "https://www.your-website.com/login?returnTo=${talkyardPathQueryEscHash}")),
            r.p({},
              "To start using SSO, fill in this SSO URL field, but do ", r.i({}, "not "),
              "enable SSO below. Save the settings, and go here: ",
              ssoTestPageLink,
              ", to test if your SSO settings work. " +
              "Especially see if you can login as admin — give that a try ",
              r.i({}, "in a different browser"), " where you are logged out for sure."),
            r.p({},
              "Later, when all works fine, and you've verified that you can logout, " +
              "and login as admin via Single Sign-On, then set Enable SSO (below) to true.")),
          // + "If you want the full URL, use r.samp({}, "${talkyardUrlInclOrigin}") instead —
          // maybe you have different forums and want to know to which one, to redirect.
          // However be careful so you don't redirect to a phishing site."
          getter: (s: Settings) => s.ssoUrl,
          update: (newSettings: Settings, target) => {
            newSettings.ssoUrl = target.value;
            if (!target.value || !target.value.trim()) {
              newSettings.enableSso = false;
            }
          }
        }),

        // Ignored, without SSO and login-required-to-read. [350RKDDF5]
        !enableTySso || !loginRequired ? null : Setting2(props, {
          type: 'text', label: "SSO After Logout URL",
          className: 'e_SsoAftLgoUrl',
          help: rFragment({},
            r.p({},
              "Where to send a user after they have logged out. " +
              "Also, if specified, a *not*-logged-in user will get redirected directly " +
              "to your SSO login page, without having to click any login button.")),
          getter: (s: Settings) => s.ssoLoginRequiredLogoutUrl,
          update: (newSettings: Settings, target) => {
            newSettings.ssoLoginRequiredLogoutUrl = target.value;
          }
        }),

        Setting2(props, {
          type: 'checkbox', label: "Enable Single Sign-On (SSO)",
          disabled: !valueOf(s => s.ssoUrl && s.ssoUrl.trim()),
          className: 'e_EnblSso',
          help: rFragment({},
            r.p({},
              "Lets people use their accounts at your website (if any), to login " +
              "to this Talkyard community. Before you enable SSO, go to the SSO test page: ",
              ssoTestPageLink,
              " and test that you can actually login via SSO."),
            r.p({},
              "If you enable SSO and something goes wrong, so you cannot login as admin " +
              "— then go here: ",
              adminLoginLink,
              " and you'll get an email with a one time admin login link.")),
          getter: (s: Settings) => s.enableSso,
          update: (newSettings: Settings, target) => {
            newSettings.enableSso = target.checked;
          }
        }),
        )
        ));
  }
});



const ModerationSettings = createFactory({
  displayName: 'ModerationSettings',

  render: function() {
    const props = this.props;
    const currentSettings: Settings = props.currentSettings;
    const editedSettings: Settings = props.editedSettings;

    const valueOf = (getter: (s: Settings) => any) =>
      firstDefinedOf(getter(editedSettings), getter(currentSettings));

    // Makes a number smaller than MaxNumFirstPosts — and keeps the last typed digit,
    // otherwise people get totally confused. (So if it's 4, and you type 5, it'll become 5.)
    function makeSmall(value: number) {
      dieIf(MaxNumFirstPosts !== 10, 'EsE5YKYW2');
      return value % 10;  // [6KG2W57]
    }

    return (
      r.div({},

        r.h2({ className: 'col-sm-offset-3 s_A_Ss_S_Ttl'},
          "Require approval before"),

        r.p({ className: 'col-sm-offset-3 s_A_Ss_Expl'},
          // "Spammers are somewhat often real humans, who get paid a cent to solve CAPTCHAS " +
          // "and post spam manually. So, when a new member joins, " +
          "When a new member joins, it's good if you manually reivew and approve hens " +
          "first few posts, before the posts get published and others can see them."),

        r.p({ className: 'col-sm-offset-3 s_A_Ss_Expl'},
          r.i({}, `"You"`), ` below refers to admins and moderators in this forum.`,
          r.br(),
          r.strong({}, `"Hen"`), ` means "he or she", `, r.strong({}, `"hens"`),
          ` means "his or her" (new English words).`),

        Setting2(props, { type: 'number', min: 0, max: MaxNumFirstPosts,
          label: "Require approval of new members' first posts", className: 'e_NumFstAprBef',
          help: "How many of a new member's first posts will need to be approved " +
            "by you (admins and moderators) before others can see them. " +
            "Thereafter, hens (his or her) posts will get published " +
            "(made visible to others) directly. " +
            "Set to 0 to disable. Max is " + MaxNumFirstPosts + ".",
          getter: (s: Settings) => s.numFirstPostsToApprove,
          update: (newSettings: Settings, target) => {
            let num = parseInt(target.value);
            if (_.isNaN(num)) num = currentSettings.numFirstPostsToApprove;
            if (num < 0) num = 0;
            if (num > MaxNumFirstPosts) num = makeSmall(num);
            newSettings.numFirstPostsToApprove = num;
            if (valueOf(s => s.maxPostsPendApprBefore) < num) {
              newSettings.maxPostsPendApprBefore = num;
            }
          },
        }),

        // Break out Trust Level setting? Dupl code [693SKDL406]
        Setting2(props, { type: 'number', min: 0, max: TrustLevel.Max,
          label: "Always require approval trust level", className: 'e_AprBefTrLvl',
          help: r.span({},
              "Don't publish posts by users with this trust level or below, " +
              "until you've approved the posts.  From 0 to 6:", r.br(),
              "0 = Strangers (e.g. anonymous blog commenters), " +
              "1 = New members, 2 = Basic members, 3 = Full memers, " +
              "4 = Long time trusted members, 5 = Trusted members who visit often, " +
              "6 = Core members"),
          getter: (s: Settings) => s.requireApprovalIfTrustLte,
          update: (newSettings: Settings, target) => {
            let num = parseInt(target.value);
            if (_.isNaN(num)) num = currentSettings.requireApprovalIfTrustLte;
            if (num < 0) num = 0;
            if (num > TrustLevel.Max) num = TrustLevel.Max;
            newSettings.requireApprovalIfTrustLte = num;
            // Make it possible to have at least one post waiting for staff to
            // approve it — otherwise, cannot post anything.
            if (valueOf(s => s.maxPostsPendApprBefore) < 1) {
              newSettings.maxPostsPendApprBefore = 1;
            }
          }
        }),

        Setting2(props, { type: 'number', min: 0, max: MaxNumFirstPosts,
          label: "Max posts pending approval", className: 'e_MxPndApr',
          help: "How many of a member's posts can be waiting for you to approve them. " +
              "Hen then cannot post more posts, until you've approved hens earlier posts.",
          getter: (s: Settings) => s.maxPostsPendApprBefore,
          update: (newSettings: Settings, target) => {
            let num = parseInt(target.value);
            if (_.isNaN(num)) num = currentSettings.maxPostsPendApprBefore;
            if (num < 0) num = 0;  // 0 disables — but usually cannot type 0,
                                   // because of the constraints below.
            if (num > MaxNumFirstPosts) num = makeSmall(num);
            if (valueOf(s => s.numFirstPostsToApprove) > num) {
              num = newSettings.numFirstPostsToApprove;
            }
            if (_.isNumber(valueOf(s => s.requireApprovalIfTrustLte)) && num < 1) {
              num = 1;
            }
            newSettings.maxPostsPendApprBefore = num;
          }
        }),


        r.h2({ className: 'col-sm-offset-3 s_A_Ss_S_Ttl'},
          "Review after published"),

        r.p({ className: 'col-sm-offset-3 s_A_Ss_Expl'},
          "After you've approved a new member's first few posts, " +
          "hens subsequent posts get published directly " +
          "— then, can be good if you review a few of those next posts, " +
          "just to be sure hen won't start typing weird things, " +
          "when hen notices that hens posts now are published directly."),

        Setting2(props, { type: 'number', min: 0, max: MaxNumFirstPosts,
          label: "Review new members' posts afterwards", className: 'e_NumFstRvwAft',
          help: "How many of a new member's first posts you'll be notified about, " +
            "so you can review them. The posts get published directly, before " +
            "review. Max " + MaxNumFirstPosts + ".",
          getter: (s: Settings) => s.numFirstPostsToReview,
          update: (newSettings: Settings, target) => {
            let num = parseInt(target.value);
            if (_.isNaN(num)) num = currentSettings.numFirstPostsToReview;
            if (num < 0) num = 0;
            if (num > MaxNumFirstPosts) num = makeSmall(num);
            newSettings.numFirstPostsToReview = num;
          }
        }),

        // Break out Trust Level setting? Dupl code [693SKDL406]
        Setting2(props, { type: 'number', min: 0, max: TrustLevel.Max,
          label: "Always review trust level", className: 'e_RvwAftTrLvl',
          help: "You'll always review posts by users with this trust level or below. " +
              "The posts get published directly.  0 to 6.",
          getter: (s: Settings) => s.reviewAfterIfTrustLte,
          update: (newSettings: Settings, target) => {
            let num = parseInt(target.value);
            if (_.isNaN(num)) num = currentSettings.reviewAfterIfTrustLte;
            if (num < 0) num = 0;
            if (num > TrustLevel.Max) num = TrustLevel.Max;
            newSettings.reviewAfterIfTrustLte = num;
          }
        }),

        Setting2(props, { type: 'number', min: 0, max: MaxNumFirstPosts,
          label: "Max posts pending review", className: 'e_MxPndRvw',
          help: "How many of a member's posts can be waiting for you to revew them, before " +
              "hen needs to wait with posting more, until you're done reviewing. " +
              "0 disables.",
          getter: (s: Settings) => s.maxPostsPendRevwAftr,
          update: (newSettings: Settings, target) => {
            let num = parseInt(target.value);
            if (_.isNaN(num)) num = currentSettings.maxPostsPendRevwAftr;
            if (num < 0) num = 0;
            if (num > MaxNumFirstPosts) num = makeSmall(num);
            newSettings.maxPostsPendRevwAftr = num;
          }
        }),

        ));
  }
});



const SpamFlagsSettings = createFactory({
  displayName: 'SpamFlagsSettings',

  render: function() {
    const props = this.props;
    const currentSettings: Settings = props.currentSettings;
    const editedSettings: Settings = props.editedSettings;

    const valueOf = (getter: (s: Settings) => any) =>
      firstDefinedOf(getter(editedSettings), getter(currentSettings));

    const LargeNumber = 9999;

    return (
      r.div({},
        !currentSettings.akismetApiKey ? null :  // currently, needs server side key
        Setting2(props, {
          type: 'checkbox', label: "Enable Akismet", id: 'e_EnableAkismet',
          help: "Akismet is a spam filter service. Uncheck to disable.",
          getter: (s: Settings) => s.enableAkismet,
          update: (newSettings: Settings, target) => {
            newSettings.enableAkismet = target.checked;
          }
        }),

        Setting2(props, { type: 'number', min: 0, max: LargeNumber,
          label: "Num flags to hide post",
          help: "If a post gets these many flags, it'll get hidden, automatically.",
          getter: (s: Settings) => s.numFlagsToHidePost,
          update: (newSettings: Settings, target) => {
            let num = parseInt(target.value);
            if (_.isNaN(num)) num = currentSettings.numFlagsToHidePost;
            if (num < 0) num = 0;
            if (num > LargeNumber) num = LargeNumber;
            newSettings.numFlagsToHidePost = num;
          }
        }),

        Setting2(props, { type: 'number', min: 0, max: LargeNumber,
          label: "Num minutes to calm down",
          help: "If someone gets his/her post hidden because of flags, s/he might get angry. " +
              "S/he must therefore wait this many minutes before being allowed to edit the post, " +
              "so s/he won't just insert even more bad stuff.",
          getter: (s: Settings) => s.cooldownMinutesAfterFlaggedHidden,
          update: (newSettings: Settings, target) => {
            let num = parseInt(target.value);
            if (_.isNaN(num)) num = currentSettings.cooldownMinutesAfterFlaggedHidden;
            if (num < 0) num = 0;
            if (num > LargeNumber) num = LargeNumber;
            newSettings.cooldownMinutesAfterFlaggedHidden = num;
          }
        }),

        Setting2(props, { type: 'number', min: 0, max: LargeNumber, indent: true,
          label: "Num flags to block new user",
          help: r.span({},
            "If a new user is flagged these many times by ",
            r.b({}, r.i({}, "num flaggers to block new user ")),
            "different users, all his/her posts will get hidden, " +
            "and s/he won't be allowed to post more posts, until staff has had a look."),
          getter: (s: Settings) => s.numFlagsToBlockNewUser,
          update: (newSettings: Settings, target) => {
            let num = parseInt(target.value);
            if (_.isNaN(num)) num = currentSettings.numFlagsToBlockNewUser;
            if (num < 0) num = 0;
            if (num > LargeNumber) num = LargeNumber;
            newSettings.numFlagsToBlockNewUser = num;
          }
        }),

        Setting2(props, { type: 'number', min: 0, max: LargeNumber, indent: true,
          label: "Num flaggers to block new user",
          help: r.span({},
            "If a new user is flagged ", r.b({}, r.i({}, "num flags to block new users ")),
            "times by this many different users, all his/her posts will get hidden, " +
            "and s/he won't be allowed to post more posts, until staff has had a look."),
          getter: (s: Settings) => s.numFlaggersToBlockNewUser,
          update: (newSettings: Settings, target) => {
            let num = parseInt(target.value);
            if (_.isNaN(num)) num = currentSettings.numFlaggersToBlockNewUser;
            if (num < 0) num = 0;
            if (num > LargeNumber) num = LargeNumber;
            newSettings.numFlaggersToBlockNewUser = num;
          }
        }),

        Setting2(props, { type: 'checkbox', indent: true,
          label: "Notify staff if new user blocked",
          help:
            "Shall an email be sent to staff, if a new users get blocked? So staff can have " +
            "a look sooner rather than later",
          getter: (s: Settings) => s.notifyModsIfUserBlocked,
          update: (newSettings: Settings, target) => {
            newSettings.notifyModsIfUserBlocked = target.checked;
          }
        }),

        Setting2(props, { type: 'number', min: 0, max: LargeNumber, indent: true,
          label: "Trusted member flag weight",
          help: r.span({},
            "How much more should I care about flags from members who visit " +
            "often and behave well? In comparison to people who visit " +
            "less frequently, or have been a bit troublesome. E.g. 2 means one flag would count " +
            "as two flags from two different users"),
          getter: (s: Settings) => s.regularMemberFlagWeight,
          update: (newSettings: Settings, target) => {
            let num = parseFloat(target.value);
            if (_.isNaN(num)) num = currentSettings.regularMemberFlagWeight;
            if (num < 0) num = 0;
            if (num > LargeNumber) num = LargeNumber;
            newSettings.regularMemberFlagWeight = num;
          }
        }),

        Setting2(props, { type: 'number', min: 0, max: LargeNumber, indent: true,
          label: "Core member flag weight",
          help: r.span({},
            "How much more should I care about flags from core members and staff?"),
          getter: (s: Settings) => s.coreMemberFlagWeight,
          update: (newSettings: Settings, target) => {
            let num = parseFloat(target.value);
            if (_.isNaN(num)) num = currentSettings.coreMemberFlagWeight;
            if (num < 0) num = 0;
            if (num > LargeNumber) num = LargeNumber;
            newSettings.coreMemberFlagWeight = num;
          }
        })
      ));
  }
});



const FeatureSettings = createFactory({
  displayName: 'FeatureSettings',

  render: function() {
    const props = this.props;
    const currentSettings: Settings = props.currentSettings;
    const editedSettings: Settings = props.editedSettings;

    const valueOf = (getter: (s: Settings) => any) =>
      firstDefinedOf(getter(editedSettings), getter(currentSettings));

    const isForumEnabled = valueOf(s => s.enableForum);
    const isApiEnabled = valueOf(s => s.enableApi);
    const isApiAndCorsEnabled = isApiEnabled && valueOf(s => s.enableCors);

    return (
      r.div({},
        Setting2(props, { type: 'checkbox',
          label: "Enable discussion forum",
          help: "If disabled, this site is for embedded blog comments only. " +
            "Once forum features are enabled, then, cannot be disabled.",
          // If forum features enabled, then, if disabling, any forum categories and topics
          // might "break" or become unaccessible? So disallow disabling this.
          disabled: currentSettings.enableForum,
          getter: (s: Settings) => s.enableForum,
          update: (newSettings: Settings, target) => {
            newSettings.enableForum = target.checked;
            // These should get disabled, if enableForum gets disabled (can be edited,
            // before saving). And nice to enable by default, if one enables forum features.
            newSettings.showCategories = newSettings.enableForum;
            newSettings.enableChat = newSettings.enableForum;
            newSettings.enableDirectMessages = newSettings.enableForum;
            newSettings.enableSimilarTopics = newSettings.enableForum;
            newSettings.showTopicFilterButton = newSettings.enableForum;
            newSettings.showTopicTypes = newSettings.enableForum;
            newSettings.selectTopicType = newSettings.enableForum;
          }
        }),

        Setting2(props, { type: 'checkbox', id: 'te_EnblApi',
          label: "Enable API",
          help: "Lets you generate API secrets and do things via HTTP API requests, " +
            "e.g. Single Sign-On.",
          getter: (s: Settings) => s.enableApi,
          update: (newSettings: Settings, target) => {
            newSettings.enableApi = target.checked;
          }
        }),

        !isApiEnabled ? null :
              TipsLink({ to: linkToAdminApi() }, "Jump to API settings page ..."),

        // Maybe let people enable CORS without enabling API secrets?
        // In case they'd need to access public data only.
        Setting2(props, {
          type: 'checkbox', className: 'e_EnbCors',
          label: "Enable Cross-Origin Resource Sharing (CORS)",
          help: rFr({},
            "Lets other websites of yours send API requests to this Talkyard site. ",
            (isApiEnabled ? '' : rFr({},
                "Currently ", r.b({}, "you need to enalbe the API"), " (above)"))),
          // Dont' hide completely — then people asks for help about how to enable it.
          disabled: !isApiEnabled,
          getter: (s: Settings) => s.enableCors,
          update: (newSettings: Settings, target) => {
            newSettings.enableCors = target.checked;
          }
        }),

        !isApiAndCorsEnabled ? null : Setting2(props, {
          type: 'textarea', label: "Allow CORS requests from",
          className: 's_A_Ss_AlwCrsFrm e_CorsFrm',
          help: r.span({}, "Lets Javascript in browsers at these origins (one per line) " +
            "send API requests to this Talkyard site, and read the responses. " +
            "Example:  https://www.your-website.com (note: no trailing '/'). " +
            "Lines starting with '#' are ignored."),
          placeholder: "https://www.your-website.com",
          getter: (s: Settings) => s.allowCorsFrom,
          update: (newSettings: Settings, target) => {
            newSettings.allowCorsFrom = target.value;
          }
        }),

        /* Not yet impl/tested, server side. The server would reply Frobidden. [CORSCREDSUNIMPL]
        !isApiAndCorsEnabled ? null : Setting2(props, {
          type: 'checkbox',
          label: "Allow CORS credentials",
          help: "Includes cookies in CORS requests, so the reuests happens as " +
              "the Talkayrd user one is logged in as, if any.",
          getter: (s: Settings) => s.allowCorsCreds,
          update: (newSettings: Settings, target) => {
            newSettings.allowCorsCreds = target.checked;
          }
        }), */

        !isForumEnabled ? null : Setting2(props, {
          type: 'checkbox', label: "Enable categories",
          className: 'e_A_Ss_S-ShowCatsCB',
          help: "Unckeck to disable categories and hide category related buttons and columns " +
          "— can make sense if your community is small and you don't need different categories.",
          getter: (s: Settings) => s.showCategories,
          update: (newSettings: Settings, target) => {
            newSettings.showCategories = target.checked;
          }
        }),

        // Later enableTags

        !isForumEnabled ? null : Setting2(props, {
          type: 'checkbox', label: "Enable chat",
          help: "Lets people create and join chat topics, and shows joined chats in the left sidebar. " +
            "If everyone uses another team chat tool already, like Slack, " +
            "then you might want to disable chat, here.",
          getter: (s: Settings) => s.enableChat,
          update: (newSettings: Settings, target) => {
            newSettings.enableChat = target.checked;
          }
        }),

        !isForumEnabled ? null : Setting2(props, {
          type: 'checkbox',
          label: "Enable direct messages",
          help: "Lets people send direct messages to each other, and shows one's direct message " +
            "topics in the left sidebar. " +
            "If everyone uses another direct messaging tool already, like Slack, " +
            "then you might want to disable direct messages here.",
          getter: (s: Settings) => s.enableDirectMessages,
          update: (newSettings: Settings, target) => {
            newSettings.enableDirectMessages = target.checked;
          }
        }),

        !isForumEnabled ? null : Setting2(props, {
          type: 'checkbox',
          label: "Enable similar topics",
          help: "When people types new questions / topics, show them a list of similar topics, " +
            "so they find answers, without having to repeat old questions.",
          getter: (s: Settings) => s.enableSimilarTopics,
          update: (newSettings: Settings, target) => {
            newSettings.enableSimilarTopics = target.checked;
          }
        }),

        /*  Not so well tested: 404 Not Found errors. Disable for now. Add e2e tests later.
        Also need pages that shows new topics from all sub communities, and the ones one
        has joined only.

        Setting2(props, { type: 'checkbox',
          label: "Enable sub communities",
          help: rFragment({},
            "Lets admins create sub communities. You probably don't want this. " +
            "A sub community is a separate forum with its own categories and topic lists. " +
            "A bit like a subreddit, if you know about the website called Reddit. " +
            "Also lets site members search for and join sub communities. ",
            r.i({}, "Reload"), " this page, open the left sidebar and look in the upper ",
            "left corner, to see the sub communities section, if you enable this."),
          getter: (s: Settings) => s.showSubCommunities,
          update: (newSettings: Settings, target) => {
            newSettings.showSubCommunities = target.checked;
          }
        }), */

        Setting2(props, {
          type: 'checkbox', label: "Experimental",
          help: "Enables complicated and less well tested features, " +
            "like custom HTML pages.",
          getter: (s: Settings) => s.showExperimental,
          update: (newSettings: Settings, target) => {
            newSettings.showExperimental = target.checked;
          }
        }),

        /*
        // Don't do this. Use JSON instead? Then, can include feature flag values too.
        // Reuse the UI settings approach? [6KXTEI]
        Setting2(props, { type: 'textarea', label: "Feature flags", id: 'e_FeatFlags',
          help: r.span({}, "Enables or disables new features. Ignore, unless you know what " +
              "you're doing."),
          getter: (s: Settings) =>
            // Replace spaces with newlines, otherwise hard to read.  What? Why? No stop doing that.
            _.isUndefined(s.featureFlags) ? undefined : s.featureFlags.replace(/\s+/g, '\n'),
          update: (newSettings: Settings, target) => {
            // Change back from \n to space — browsers want spaces in allow-from.
            newSettings.featureFlags = target.value.replace(/\n+/g, ' ');
          }
        }), */
      ));
  }
});



const EmbeddedCommentsSettings = createFactory({
  displayName: 'EmbeddedCommentsSettings',

  getInitialState: function() {
    return {
      selectedBlog: getFromLocalStorage('adminAppSelectedBlog'),
    };
  },

  componentDidMount: function() {
    if (isBlogCommentsSite()) {
      const store: Store = this.props.store;
      utils.maybeRunTour(staffTours.adminAreaIntroForBlogComments(store.me));
    }
  },

  render: function() {
    const props = this.props;
    const currentSettings: Settings = props.currentSettings;
    const editedSettings: Settings = props.editedSettings;
    const embeddingUrl = currentSettings.allowEmbeddingFrom.trim();
    let dotMin = '.min';
    // @ifdef DEBUG
    dotMin = '';
    // @endif

    const valueOf = (getter: (s: Settings) => any) =>
      firstDefinedOf(getter(editedSettings), getter(currentSettings));

    const enableForum = valueOf(s => s.enableForum);

    const urlSeemsValid = /https?:\/\/.+/.test(embeddingUrl);   // 'http://localhost' is ok

    const selectedBlog = this.state.selectedBlog;

    const makeWhichBlogInput = (blogName: string, e2eClass: string) => {
      const isSelected = selectedBlog === blogName;
      return Input({ type: 'radio', name: 'whichBlog', label: blogName,
        checked: isSelected,
        className: (isSelected ? 'active ' : '') + e2eClass,
        onChange: () => {
          putInLocalStorage('adminAppSelectedBlog', blogName);
          this.setState({ selectedBlog: blogName })
        } });
    }

    const whichBlogQuestion= !urlSeemsValid ? null :
        r.div({ className: 's_A_Ss_S-WhichBlog col-sm-offset-3 col-sm-9' },
          r.h2({}, "Which blog do you use? Or static site generator?"),
          r.div({},
            makeWhichBlogInput("Ghost", 'e_GhostB'),
            makeWhichBlogInput("Hugo", 'e_HugoB'),
            makeWhichBlogInput("Gatsby", 'e_GatsbyB'),
            makeWhichBlogInput("Jekyll", 'e_JekyllB'),
            makeWhichBlogInput("Hexo", 'e_HexoB'),
            makeWhichBlogInput("Zola", 'e_ZolaB'),
            r.br(),
            makeWhichBlogInput("Something Else", 'e_SthElseB')));

    let discussionId = '';
    const blogInstrProps = {
      talkyardServerUrl: location.origin,
      commentsScriptSrc: `${eds.cdnOrServerOrigin}/-/talkyard-comments${dotMin}.js`,
    };

    let stepByStepInstructions;
    switch (selectedBlog) {
      case "Ghost":
        stepByStepInstructions = GhostInstructions(blogInstrProps);
        break;
      case "Hugo":
        stepByStepInstructions = HugoInstructions(blogInstrProps);
        break;
      case "Gatsby":
        stepByStepInstructions = GatsbyInstructions(blogInstrProps);
        break;
      case "Jekyll":
        stepByStepInstructions = JekyllInstructions(blogInstrProps);
        break;
      case "Hexo":
        stepByStepInstructions = HexoInstructions(blogInstrProps);
        break;
      case "Zola":
        stepByStepInstructions = ZolaInstructions(blogInstrProps);
        break;
      default:
        stepByStepInstructions = SomethingElseInstructions(blogInstrProps);
    }

    const anyInstructions = !urlSeemsValid || !selectedBlog ? null :
        r.div({ className: 's_A_Ss_EmbCmts col-sm-offset-3 col-sm-9' },
          r.h2({}, "Instructions for ", r.b({}, selectedBlog), ':'),
          stepByStepInstructions,
          r.p({},
            "You can ask for help in ",
            r.a({ href: 'https://www.talkyard.io/forum' },
              "Talkyard's support forum",
              r.span({ className: 'icon-link-ext' })), '.'),
            /*
            Maybe show links to Hugo, Jekyll etc example blogs? Or not?
          r.p({ className: 's_A_Ss_EmbCmts_Plugins' },
            r.b({}, "However"),
            " if you use any of these (below), have a look at their specific instructions:"),
          r.ul({},
            r.li({},
              r.b({}, "Hugo"), " — see ",
              r.a({ href: 'https://hugo-demo.talkyard.io/posts/demo-and-instructions/' },
                "these instructions"), '.'),
            r.li({},
              r.b({}, "Gatsby"), " — use ",
              r.a({ href: 'https://www.npmjs.com/package/@debiki/gatsby-plugin-talkyard' },
                "this plugin"), '.'),
            r.li({},
              r.b({}, "Jekyll"), " — see ",
              r.a({ href: 'https://jekyll-demo.talkyard.io/2018/01/09/installation-instructions.html' },
                "these instructions"), '.'),
            r.li({},
              r.b({}, "Hexo"), " — see ",
              r.a({ href: 'https://hexo-demo.talkyard.io/2018/01/04/demo-and-instructions/' },
                "these instructions"), '.'),
                */);

    return (
      r.div({},
        // This setting should be for an Embedded Comments category, with
        // ext id 'embedded_comments'. And maybe the 1st domain, can be considered
        // the primary domain, used in all generated links? (e.g. a link to a comment
        // in a reply notification email, or in some acitvity summary email.)
        //
        // Later on: Let ppl create other categories with different extId:s and
        // different canonical embedding domains.
        // This could be a "Multiblog" feature? which, if enabled, lets one
        // map different categories w ext ids like "comments_for_blog_one" and "...blog_two"
        // to different embedding domains. [COMCATS]
        // And the embedding code, would have an attr like:
        //    <div ... data-category-ref="extid:comments_for_blog_one">
        // resulting in emb disc topics getting created in that category — and
        // links in reply notf emails would point to the correct embdding origin.
        Setting2(props, { type: 'textarea', label: "Allow embedding from", id: 'e_AllowEmbFrom',
          className: 's_A_Ss_EmbOrig',
          help: r.span({}, "Lets another website (your website) show embedded contents. " +
            "You can add many websites, one per line. Lines starting with # are ignored."),
            // Accessing via a blog running on localhost, is always allowed. [5RTCN2]
          placeholder: "https://www.your-blog.com",
          getter: (s: Settings) => s.allowEmbeddingFrom,
          update: (newSettings: Settings, target) => {
            newSettings.allowEmbeddingFrom = target.value;
          }
        }),

        /*  [emb_mcts_cat]
        !urlSeemsValid || !enableForum ? null : Setting2(props, {
          label: "Embedded comments category",
          help: "In which categoy to place embedded blog comments discussions. " +
              "Default: 'extid:embedded_comments'",  // ??
              No! Instead: Cat id + foreign key.
          getter: (s: Settings) => s.embCommentsCatRef,  no! yes:  s.embeddedCommentsCategoryId
          update: (newSettings: Settings, target) => {
            newSettings.embCommentsCatRef = target.value;
          }

          + You can also add a html tag attribute  data-category="... "
          for each blog post or documentation page, and in that way
          place discusions from different blog post in different categories.
        }),  */

        whichBlogQuestion,
        anyInstructions));
  }
});


interface BlogInstrProps {
  talkyardServerUrl: string;
  commentsScriptSrc: string;
};


function GhostInstructions(props: BlogInstrProps) {
  // Don't prefix the id with "ghost-", althoug Ghost's default theme, Casper, does
  // this — because then, if importing old discussions from Disqus or WordPress,
  // those discussions won't be found, since they lack the "ghost-" prefix.
  // Ghost's docs: https://ghost.org/docs/api/v2/handlebars-themes/context/post/#comment-id >
  // Casper (don't do what Casper does):
  //   https://github.com/TryGhost/Casper/blob/d92dda3523c27d68fa78088cd1138300b96bc7c8/post.hbs#L83
  const tagParams: BlogTagProps = { ...props, discussionId: '{{comment_id}}' };
  return rFragment({},
      r.div({},
        "In your Ghost blog's theme, insert the below HTML, " +
        "where you want comments to appear. Typically into ", r.code({}, "post.hbs"),
        ", e.g. ", r.code({}, "content/themes/casper/post.hbs"),
        ", inside the section ", r.code({}, '<section class="post-full-comments">'), '.'),
      BlogCommentsHtmlTags(tagParams),
      ThenRestart());
}

/* Test Ghost instructions like so:
====================================

Create a docker-compose.yml file:
------------------------------------
# From:  https://hub.docker.com/_/ghost/
# By default, the Ghost image will use SQLite (and thus requires no separate database container)
# we have used MySQL here merely for demonstration purposes (especially
# environment-variable-based configuration)
version: '3.7'
services:
  ghost:
    image: ghost:2.14.0-alpine
    #restart: never
    ports:
      - 2368:2368
------------------------------------
Then:
sudo docker-compose up
sudo docker-compose exec ghost bash
vi content/themes/casper/post.hbs  # add the HTML from the instructions
sudo docker-compose restart ghost
*/


function HugoInstructions(props: BlogInstrProps) {
  const tagParams: BlogTagProps = {
    talkyardServerUrl: '{{ .Site.Params.talkyardServerUrl }}',
    commentsScriptSrc: `{{ .Site.Params.talkyardScriptUrl }}`,
    discussionId: '{{ .Params.discussionId }}',
  };
  return rFragment({},
    r.ol({},
      r.li({},
        r.p({}, "Add this to ", r.code({}, "config.toml"), " in the ", r.code({}, "params"), " section:"),
        r.pre({},
          '[params]\n' +
          `talkyardServerUrl = "${props.talkyardServerUrl}"\n` +
          `talkyardScriptUrl = "${props.commentsScriptSrc}"`)),
      r.li({},
        r.p({},
          "In your Hugo blog's theme, insert the below HTML, " +
          "where you want comments to appear. For example, into ",
          r.code({}, "./themes/YOUR_THEME_NAME/layouts/_default/single.html"),
          ", in a new ", r.code({}, "<section>"),
          ", after the blog post ", r.code({}, '{{- .Content -}}'), ' section:'),
        BlogCommentsHtmlTags(tagParams))),
    r.p({},
      "Thereafter, ", r.b({}, "restart Hugo"), ", and a comments section should appear."),
    ToSupportChangingUrls(rFragment({},
        "add a frontmatter ", r.code({}, "discussionId: per-discussion-id"),
        " to each blog post. Like so:")),
    r.pre({},
      '---\n' +
      'title: "My First Post"\n' +
      'date: 2019-03-29T12:17:24+01:00\n' +
      'discussionId: 2019-03-my-first-post       <—— Add this\n' +
      '---\n' +
      '\n' +
      'Blog post text, text, text...'),
    r.p({},
      "Thereafter, ", r.b({}, "restart Hugo"),
      ", post a comment, and then change the URL to the blog post, and reload it — " +
      "the comments should still be there. ",
      r.i({}, "However"), " any test comment you posted ",
      r.i({}, "before"), " you added the discussion id, will be gone."));
}

/* Test the Hugo instructions like so:
====================================

Install Hugo: https://gohugo.io/getting-started/installing, e.g.:
  cd ~/app/
  wget https://github.com/gohugoio/hugo/releases/download/v0.54.0/hugo_0.54.0_Linux-64bit.tar.gz
  mkdir hugo-v0.54
  cd hugo-v0.54/
  tar -xf ../hugo_0.54.0_Linux-64bit.tar.gz
  cd ..
  ln -s hugo-v0.54/hugo ./hugo

Generate a blog:
  ~/app/hugo new site quickstart
  cd quickstart

Add a theme:
  git init
  git submodule add https://github.com/budparr/gohugo-theme-ananke.git themes/ananke
  echo 'theme = "ananke"' >> config.toml

Add a post:
  ~/app/hugo new posts/my-first-post.md
  vi content/posts/my-first-post.md

Start a server, show draft posts:
  ~/app/hugo server -D

Then follow the Talkyard instructions.
*/


function JekyllInstructions(props: BlogInstrProps) {
  const jekyllDocsLink = 'https://jekyllrb.com/docs/themes/#overriding-theme-defaults';
  const tagParams: BlogTagProps = {
    prefix: 'TEST001\n\n{% if site.talkyard_server_url %}\n',
    talkyardServerUrl: '{{ site.talkyard_server_url }}',
    commentsScriptSrc: '{{ site.talkyard_script_url }}',
    discussionId: '{{ page.discussion_id }}',
    postfix: '\n{% endif %}',
  };
  return r.ol({},
      r.li({},
        r.p({}, "In your Jekyll site configuration, i.e.", r.code({}, "_config.yml"), "add this:"),
        r.pre({},
          `talkyard_server_url: ${props.talkyardServerUrl}\n` +
          `talkyard_script_url: ${props.commentsScriptSrc}`)),
      r.li({},
        r.p({},
          "Create a file ",
          r.code({}, "_includes/talkyard-comments.html"),
          " with the following contents: (TEST001 is intentional)"),
        BlogCommentsHtmlTags(tagParams)),
      r.li({},
        r.p({},
          "Add the following to your post template, typically ", r.code({}, "_layouts/post.html"),
          ", where you want comments to appear:"),
        r.pre({},
          `{% include talkyard-comments.html %}`),
        r.p({},
          "Note: If you don’t have a ", r.code({}, "_layout/posts.html"),
          " file, that's because Jekyll hides it. Read more here: ",
          r.a({ href: jekyllDocsLink }, jekyllDocsLink),
          ". You need to find it and copy it to your directory. Something like this:"),
        r.ol({ style: { listStyleType: 'lower-alpha' }},
          r.li({},
            r.p({},
              "Find the theme file directory: " +
              "(look in ", r.code({}, "_config.yml"), " to find your theme name)"),
            r.pre({}, "bundle show minima   # replace 'minima' with your theme's name")),
          r.li({},
            r.p({},
              "Copy probably the ", r.code({}, "_layouts/post.html"),
              " file into your blog directory. Could be like this: "),
            r.pre({},
              "mkdir _layouts\n" +
              "# remove 'echo' on the next line\n" +
              "echo  cp $(bundle show minima)/_layouts/post.html _layouts/")
              ))),
      r.p({},
        "Now, ", r.b({}, "restart Jekyll"),
        " and reload a blog post in the browser. Do you see a comments section now? " +
        "If so, remove TEST001 above. If not — do you see TEST001? " +
        "If you do see TEST001 but not the comments, you can ask for help, see below. " +
        "(Or maybe you didn't restart Jekyll?) " +
        "If you don’t see TEST001, you added the comments code at the wrong place, " +
        "or you’re looking at the wrong page."),
      ToSupportChangingUrls(rFragment({},
        "add a frontmatter ", r.code({}, "discussion_id: per-discussion-id"),
        " to each blog post. Like so:")),
      r.pre({},
        `---\n` +
        `layout: post\n` +
        `title:  "Welcome to Jekyll!"\n` +
        `date:   2019-03-29 17:02:39 +0000\n` +
        `categories: jekyll update\n` +
        `discussion_id: 2019-03-welcome      <———— add this\n` +
        `---\n` +
        `\n` +
        `Blog post text text text ...`),
      r.p({},
        "Thereafter, ", r.b({}, "restart Jekyll"),
        ", post a comment, and then change the URL to the blog post, and reload it — " +
        "the comments should still be there. ",
        r.i({}, "However"), " any test comment you posted ",
        r.i({}, "before"), " you added the discussion id, will be gone."));
}

/* Test the Jekyll instructions like so:
====================================

There's a Jekyll docker-compose repo you can use:

  git clone https://github.com/debiki/ed-jekyll-comments-demo.git jekyll-blog-test
  cd jekyll-blog-test
  sudo docker-compose up -d
  sudo docker-compose exec ruby bash   # after 2 mins when Ruby image done building
  bundle install
  gem install jekyll bundler   # seems to install the latest version of Jekyll
  bundle exec jekyll _3.8.5_ new blog385    # or another version number
  cd blog385
  bundle exec jekyll serve --host 0.0.0.0 --port 4000
  # Now visit localhost:4000, will be a "Welcome to Jekyll!" blog post.

Proceed with following the Talkyard Jekyll instructions.

*/

function GatsbyInstructions(props: BlogInstrProps) {
  return rFragment({},
    r.ol({},
      r.li({},
        r.p({}, "Install the Talkyard plugin:"),
        r.pre({},
          `npm install --save @debiki/gatsby-plugin-talkyard  # with npm\n` +
          `yarn add @debiki/gatsby-plugin-talkyard            # with yarn`)),
      r.li({},
        r.p({}, "Configure the plugin. In ", r.code({}, 'gatsby-config.js'), ":"),
        r.pre({},
`plugins: [
 {
   resolve: '@debiki/gatsby-plugin-talkyard',
   options: {
     talkyardServerUrl: '${props.talkyardServerUrl}'
   }
 },`)),
      r.li({},
        r.p({},
          "In your blog post template (maybe ", r.code({}, 'src/templates/blog-post.js'),
          "?), add this:"),
        r.pre({},
          `import TalkyardCommentsIframe from '@debiki/gatsby-plugin-talkyard';\n` +
          `\n` +
          `// And where the comments shall appear:\n` +
          `<TalkyardCommentsIframe />`))),
    r.p({},
      "Thereafter, ", r.b({}, "Restart Gatsby"),
      ". Now, a comments section should appear below the blog posts."),
    ToSupportChangingUrls(),
    r.ol({ start: 4 },
      r.li({},
        r.p({},
          "Add a frontmatter ", r.code({}, "discussionId: per-discussion-id"),
          " to your blog posts. At the top of each blog post:"),
          r.pre({},
`---
title: Blog post title
author: ...
date: ...
description: ...
discussionId: "2019-01-01-page-slug"   <—— Add this. Type whatever,
                                           but no weird chars
---

Blog post text ...`)),
      r.li({},
        r.p({},
          "Also have React include the discussion id in the props. " +
          "In the GraphQL query at the bottom of the blog post template " +
          "(is it ", r.code({}, 'src/templates/blog-post.js'), "?), add ",
          r.code({}, "discussionId"), ':'),
        r.pre({},
`export const pageQuery = graphql\`
  query BlogPostBySlug($slug: String!) {
    site {
      siteMetadata {
        title
        author
      }
    }
    markdownRemark(fields: { slug: { eq: $slug } }) {
      id
      html
      frontmatter {
        title
        date ...
        discussionId         <—— Add this
      }
    }
  }
\``)),
      r.li({},
        r.p({},
          "And change from: ", r.code({}, "<TalkyardCommentsIframe />"), " to:"),
          r.pre({},
            "<TalkyardCommentsIframe discussionId={post.frontmatter.discussionId}/>"))),
    r.p({},
      r.b({}, "Restart Gatsby. "), "Thereafter, if you post a comment, and " +
      "later change the URL to the blog post, the comment should still be there."));
}

/* Test the Gatsby instructions like so:
====================================

Based on https://www.gatsbyjs.org/docs/quick-start, no, instead,
https://daveceddia.com/start-blog-gatsby-netlify/: (simpler to follow)

  cd ~/app/
  yarn add gatsby-cli
  ln -s ./node_modules/.bin/gatsby ./
  ./gatsby -v
  cd ~/dev/test/
  ~/app/gatsby new gatsby-test-blog https://github.com/gatsbyjs/gatsby-starter-blog
  cd gatsby-test-blog/
  ~/app/gatsby develop

Then follow the Talkyard instructions.

*/


function HexoInstructions(props: BlogInstrProps) {
  const tagParams: BlogTagProps = {
    prefix:
`TEST001

<% if (!index && post.comments && config.talkyard_server_url){ %>
<section id="comments">
`,
    talkyardServerUrl: '<%= config.talkyard_server_url %>',
    commentsScriptSrc: `<%= config.talkyard_script_url || '${props.commentsScriptSrc}' %>`,
    discussionId: '<%= post.discussion_id || post.slug %>',
    postfix: `
</section>
<% } %>`,
  };
  return rFragment({},
    r.ol({},
      r.li({},
        r.p({}, "Add this to ", r.code({}, "_config.yml"), ":"),
        r.pre({},
          `talkyard_server_url: ${props.talkyardServerUrl}\n` +
          `talkyard_script_url: ${props.commentsScriptSrc}`)),
      r.li({},
        r.p({},
          "Add this where you want the comments to appear: (TEST001 is intentional)"),
        BlogCommentsHtmlTags(tagParams),
        r.p({},
          "For example, in ", r.code({}, "themes/landscape/layout/_partial/article.ejs"),
          ", just after ", r.code({}, '</article>'), '.'))),
    r.p({},
      r.b({}, "Restart Hexo"),
      " and reload a blog post in the browser. Do you see a comments section now? " +
      "If so, remove TEST001 above. If not — do you see TEST001? " +
      "If you do see TEST001 but not the comments, you can ask for help, see below. " +
      "Or maybe you didn't restart Hexo? — " +
      "If you don’t see TEST001, you added the comments code at the wrong place, " +
      "or you’re looking at the wrong page."),
    ToSupportChangingUrls(rFragment({},
      "add a frontmatter ", r.code({}, "discussion_id: per-discussion-id"),
      " to your blog posts. Like so:")),
    r.pre({},
      "---\n" +
      "title: Hello World\n" +
      "discussion_id: 2019-03-hello-world      <——— Add this\n" +
      "---\n" +
      "\n" +
      "Blog post text text text ...\n"),
    r.p({},
      "Now, if you post a new comment, change the URL to the blog post, " +
      "and reload — the comment will still be there."));
}

/* Testing the Hexo instructions
====================================

From https://hexo.io/:
  cd ~/app/
  yarn add hexo-cli
  ln -s node_modules/.bin/hexo ./
  ./hexo -v
  cd ~/dev/test
  ~/app/hexo init hexo-test-blog
  cd hexo-test-blog/
  yarn
  ~/app/hexo server

 And follow the Talkyard instructions.

*/


function ZolaInstructions(props: BlogInstrProps) {
  const tagParams: BlogTagProps = {
    prefix: 'TEST001\n\n',
    talkyardServerUrl: '{{ config.extra.talkyard_server_url | safe }}',
    commentsScriptSrc: '{{ config.extra.talkyard_script_url }}',
    discussionId: '{% if page.extra.discussion_id %}{{ page.extra.discussion_id }}{% endif %}',
  };
  return rFragment({},
    r.ol({},
      r.li({},
        r.p({},
          "Add this to ", r.code({}, "config.toml"),
          ", at the end, in the ", r.code({}, "[extra]"), " section:"),
        r.pre({},
          `[extra]       <——— note\n` +
          `talkyard_server_url = "${props.talkyardServerUrl}"\n` +
          `talkyard_script_url = "${props.commentsScriptSrc}"`)),
      r.li({},
        r.p({},
          "Add this where you want the comments to appear: (TEST001 is intentional)"),
        BlogCommentsHtmlTags(tagParams),
        r.p({},
          "Could be in ", r.code({}, "themes/THEME_NAME/templates/page.html"),
          ", just before ", r.code({}, '{% endblock content %}'), '.'))),
    r.p({},
      r.b({}, "Restart Zola"),
      " and reload a blog post in the browser. Do you see a comments section now? " +
      "If so, remove TEST001 above."),
    ToSupportChangingUrls(rFragment({},
      "add a frontmatter ", r.code({}, 'discussion_id: "per-discussion-id"'),
      " to your blog posts. Like so:")),
    r.pre({}, `
+++
title = "What is Zola"
date = 2017-09-24
[extra]                                <——— in the [extra] section ...
discussion_id = "2017-what-is-zola"    <——— ...add something like this
+++

Blog post text text text, ...`),
    r.p({},
      "Now, if you post a new comment, change the URL to the blog post, " +
      "and reload — the comment will still be there."));
}


/* Testing the Zola instructions
====================================

linux-bash#  sudo snap install --edge zola
linux-bash#  zola init zolatest
linux-bash#  cd zolatest/
linux-bash#  cd themes/
linux-bash#  git clone https://github.com/getzola/hyde.git
linux-bash#  cd ..
linux-bash#  vi config.toml  # add line:  theme = "hyde"
linux-bash#  cd content/
linux-bash#  cp ../themes/hyde/content/* ./  # adds sample blog posts
linux-bash#  cd ..

And then follow the Talkyard instructions for Zola.

*/



function SomethingElseInstructions(props: BlogInstrProps) {
  return rFragment({},
      r.p({}, "On your blog" + // i.e. ", r.code({}, embeddingUrl),
        ", paste the following HTML in a blog page template, or web page, " +
        "where you want comments to appear:"),
      BlogCommentsHtmlTags(props),
      ThenRestart(),
      r.h3({}, "Moving blog posts to new URLs"),
      r.p({},
        "You can set the ", r.code({}, "data-discussion-id"), " attribute " +
        "(see the HTML code snippet above) to a per blog post ID, " +
        "to tell Talkyard which blog post is being shown, " +
        "regardless of the URL in the browser address bar. " +
        "This would be an ID provided by ", r.i({}, "you"), " — e.g. a never changing " +
        "database ID for the blog post page."),
      r.p({},
        "Later, if you move the blog post to a new URL, then, Talkyard " +
        "will know it's the same blog post — and can show the same comments. " +
        "Otherwise, Talkyard would think the blog post, when at the new URL, " +
        "is a different blog post, and won't load the comments — " +
        "the comments would seem to be gone."));
}


interface BlogTagProps { prefix?: string, talkyardServerUrl: string,
      commentsScriptSrc: string, discussionId?: string, postfix?: string };
function BlogCommentsHtmlTags(props: BlogTagProps) {
  return r.pre({ id: 'e_EmbCmtsHtml' },
(props.prefix || '') +
`<script>talkyardServerUrl='${props.talkyardServerUrl}';</script>
<script async defer src="${props.commentsScriptSrc}"></script>
<!-- You can specify a per page discussion id on the next line, if your URLs might change. -->
<div class="talkyard-comments" data-discussion-id="${props.discussionId || ''}" style="margin-top: 45px;">
<noscript>Please enable Javascript to view comments.</noscript>
<p style="margin-top: 25px; opacity: 0.9; font-size: 96%">Comments powered by
<a href="https://www.talkyard.io">Talkyard</a>.</p>
</div>` + (props.postfix || ''));
}


function ToSupportChangingUrls(doWhat: string = "do as follows.") {
  return rFragment({},
    r.h3({}, "Supporting changing URLs"),
    r.p({}, "To make it possible to change the URL to a blog post, " +
        "without the embedded discussion disappearing, ", doWhat));
}


function ThenRestart() {
  return r.p({},
      "Thereafter, restart your blog, reload a blog post, and try posting a comment.");
}


const LanguageSettings = createFactory({
  displayName: 'LanguageSettings',

  render: function() {
    const props = this.props;
    const defaultSettings: Settings = props.defaultSettings;
    const currentSettings: Settings = props.currentSettings;
    const editedSettings: Settings = props.editedSettings;

    const valueOf = (getter: (s: Settings) => any) =>
      firstDefinedOf(getter(editedSettings), getter(currentSettings));

    // Sync this list with the language files in /translations/ and the server scripts bundle. [5JUKQR2].
    const languageOptions = [{
      // Don't mention this is en-US, people might then want -GB too and -AU (for the UK and Australia)?
      value: 'en_US', label: "English"
    }, {
      value: 'es_CL', label: "Spanish (Chile)"
    }, {
      value: 'de_DE', label: "German"
    }, {
      value: 'he_IL', label: "Hebrew"
    }, {
      value: 'lv_LV', label: "Latvian"
    }, {
      value: 'nl_NL', label: "Dutch"
    }, {
      value: 'pl_PL', label: "Polish"
    }, {
      value: 'pt_BR', label: "Portuguese (Brazilian)"
    }, {
      value: 'ru_RU', label: "Russian"
    }, {
      value: 'sv_SE', label: "Swedish"
    }, {
      value: 'uk_UA', label: "Ukrainian"
    }];

    const selectedLangCode = firstDefinedOf(editedSettings.languageCode, currentSettings.languageCode);
    const selectedLangOpt = _.find(languageOptions, (opt) => opt.value === selectedLangCode);

    const setLangCode = (code) => {
      // A bit dupl code. [7UKWBP32]
      const newSettings = _.clone(editedSettings);
      newSettings.languageCode = code;
      props.removeUnchangedSettings(newSettings);
      props.setEditedSettings(newSettings);
    };

    return (
      r.div({},
        Setting2(props, { type: 'custom', label: "Language",
            getter: (s: Settings) => s.languageCode,
            undo: () => setLangCode(currentSettings.languageCode),
            reset: () => setLangCode(defaultSettings.languageCode) },
          rFragment({},
            rb.ReactSelect({ multi: false, clearable: false,
                value: selectedLangOpt, options: languageOptions,
                onChange: (langCodeAndName) => {
                  setLangCode(langCodeAndName.value);
                } }),
            rb.HelpBlock({}, "The language for the user interface, e.g. button titles. " +
              "(But the admin area — where you are now — is always in English.)"))),
      ));
  }
});



const EmailSettings = createFactory({
  displayName: 'EmailSettings',

  render: function() {
    const props = this.props;
    //const currentSettings: Settings = props.currentSettings;
    //const editedSettings: Settings = props.editedSettings;
    //const defaultSettings: Settings = props.defaultSettings;

    const enableCustomEmailServer =
        Setting2(props, {
          type: 'checkbox', label: "Use your own email service",
          className: 'e_A_Ss_S-OwnEmlCB',
          help: "Send emails from your server, so people see your sender address.",
          getter: (s: Settings) => s.enableOwnEmailServer,
          update: (newSettings: Settings, target) => {
            newSettings.enableOwnEmailServer = target.checked;
          }
        });

    const customEmailServerConfig =
        Setting2(props, { type: 'textarea', label: "Email server config",
          help: "Not yet implemented.",
          placeholder: "??",
          getter: (s: Settings) => s.ownEmailServerConfig,
          update: (newSettings: Settings, target) => {
            newSettings.ownEmailServerConfig = target.value;
          }
        });

    return (
      r.div({},
        enableCustomEmailServer,
        customEmailServerConfig));
  },
});



const AdvancedSettings = createFactory({
  displayName: 'AdvancedSettings',

  redirectExtraHostnames: function() {
    Server.redirectExtraHostnames(() => {
      util.openDefaultStupidDialog({
        small: true,
        // COULD move state to here and update it, so no need to reload.
        body: r.span({}, "Done. All old hostnames now redirect to here, i.e. to ",
          r.samp({}, this.getCanonicalHostname()), ". **Reload** this page please"),
      });
    });
  },

  getCanonicalHostname: function() {
    const host = _.find(this.props.hosts, (host: Host) => host.role == HostRole.Canonical);
    return host ? host.hostname : null;
  },

  render: function() {
    const props = this.props;
    const store: Store = this.props.store;
    const me: Myself = store.me;
    const currentSettings: Settings = props.currentSettings;

    // If this site is for blog comments, and forum features not yet enabled,
    // then we'll soft-hide settings for changing the address to the site (which
    // people do but then HTTPS won't work unless also configured — so their site breaks).
    // To test, try this e2e test?:  <<which?>>
    const isBlogCommentsOnly =
        isBlogCommentsSite() &&
        !currentSettings.enableForum;
    const hideForumStuff =
        isBlogCommentsOnly &&
        // If self hosted, one needs to be able to change the adress.
        !seemsSelfHosted() &&
        !showAll();

    const hosts: Host[] = props.hosts;
    const noCanonicalHostSpecifiedString = " (no address specified)";
    const canonicalHostname = this.getCanonicalHostname() || noCanonicalHostSpecifiedString;

    const RedirectButtonTitle = "Redirect old addresses"; // dupl [5KFU2R0]
    const canonicalHostnameSamp = r.samp({}, canonicalHostname);
    const isDuplicate = location.hostname !== canonicalHostname &&
        canonicalHostname !== noCanonicalHostSpecifiedString;

    const duplicateHostnames =
      _.filter(hosts, (h: Host) => h.role == HostRole.Duplicate).map((h: Host) => h.hostname);
    const redirectingHostnames =
      _.filter(hosts, (h: Host) => h.role == HostRole.Redirect).map((h: Host) => h.hostname);

    const changeHostnameFormGroup = hideForumStuff ? null :
      r.div({ className: 'form-group' },
        r.label({ className: 'control-label col-sm-3' }, "Site address"),
        r.div({ className: 'col-sm-9 esA_Ss_S esAdmin_settings_setting' },
          location.protocol + "//", r.code({ className: 'esA_Ss_S_Hostname' }, canonicalHostname),
          r.div({ className: 'help-block' },
            "This is the address people type in the browser address bar to go to this forum."),
          Button({ onClick: openHostnameEditor, className: 'e_ChAdrB' }, "Change address ...")));

    const duplicatingHostsFormGroup = duplicateHostnames.length === 0 ? null :
      r.div({ className: 'form-group has-error' },
        r.label({ className: 'control-label col-sm-3' }, "Duplicate addresses"),
        r.div({ className: 'col-sm-9 s_A_Ss_S-Hostnames s_A_Ss_S-Hostnames-Dupl esAdmin_settings_setting' },
          r.pre({}, duplicateHostnames.join('\n')),
          r.span({ className: 'help-block' },
            "This forum is still accessible at the old addresses listed above. " +
            "Search engines (like Google, Baidu, and Yandex) don't like that — they want your " +
            "forum to be accessible via ", r.i({}, "one"), " addresses only. You should " +
            "therefore ", r.i({}, "redirect"), " all the old addresses to ",
            canonicalHostnameSamp, ':'),
          isDuplicate
            ? r.p({}, "Go to ",
                r.a({ href: linkToAdminPageAdvancedSettings(canonicalHostname), target: '_blank' },
                  canonicalHostname, r.span({ className: 'icon-link-ext' })),
                ", login, and click ", r.b({}, RedirectButtonTitle))
            : Button({ onClick: this.redirectExtraHostnames, className: 'e_RedirOldAddrB' },
                RedirectButtonTitle)));

    const redirectingHostsFormGroup = redirectingHostnames.length === 0 ? null :
      r.div({ className: 'form-group' },
        r.label({ className: 'control-label col-sm-3' }, "Redirecting addresses"),
        r.div({ className: 'col-sm-9 s_A_Ss_S-Hostnames s_A_Ss_S-Hostnames-Redr esAdmin_settings_setting' },
          r.span({ className: 'help-block' }, "These old addresses redirect to ",
            canonicalHostnameSamp, " (with status 302 Found):"),
          r.pre({}, redirectingHostnames.join('\n'))));

    const googleAnalyticsId =
        Setting2(props, { type: 'text', label: "Google Universal Analytics tracking ID",
          help: r.span({}, "Any Google Universal Analytics tracking ID, e.g. ",
            r.samp({}, "UA-12345678-9"), ", see http://google.com/analytics."),
          getter: (s: Settings) => s.googleUniversalAnalyticsTrackingId,
          update: (newSettings: Settings, target) => {
            newSettings.googleUniversalAnalyticsTrackingId = target.value;
          }
        });

    // If there's just one site, self hosted — then, cannot delete it.
    // (Instead, one would shut down the Talkard server.)
    const hideDangerZone = seemsSelfHosted(); // later:  || !ppt_isOwner(me);

    const dangerZoneTitle = hideDangerZone ? null :
        r.h2({ className: 'col-sm-offset-3 s_A_Ss_S_Ttl'}, "Danger zone");

    const deleteSiteFormGroup = hideDangerZone ? null :
      r.div({ className: 'form-group' },
        r.label({ className: 'control-label col-sm-3' }, "Delete site"),
        r.div({ className: 'col-sm-9 esAdmin_settings_setting' },
          r.p({},
            "You can delete your site, by emailing ",
            r.samp({}, 'support@talkyard.io'),
            " from your admin email address. Later, there'll be a " +
            "button here so you can delete the site yourself directly.")));

    return (
      r.div({},
        googleAnalyticsId,
        changeHostnameFormGroup,
        duplicatingHostsFormGroup,
        redirectingHostsFormGroup,
        dangerZoneTitle,
        deleteSiteFormGroup));

  }
});



const LegalSettings = createFactory({
  displayName: 'LegalSettings',

  componentDidMount: function() {
    if (isCommunitySite()) {
      const store: Store = this.props.store;
      utils.maybeRunTour(staffTours.adminAreaIntroForCommunity(store.me));
    }
  },

  render: function() {
    const props = this.props;
    const currentSettings: Settings = props.currentSettings;
    const editedSettings: Settings = props.editedSettings;

    const valueOf = (getter: (s: Settings) => any) =>
      firstDefinedOf(getter(editedSettings), getter(currentSettings));

    const termsOfUseLink = r.a({ href: '/-/terms-of-use', target: '_blank' },
      'Terms of Use');

    const userContentTermsLink = r.a({ href: '/-/terms-of-use#3', target: '_blank' },
      "section about user contributions on your Terms of Use");

    const hasCustomToU = valueOf(s => s.termsOfUseUrl).length;

    return (
      r.div({},
        Setting2(props, { type: 'text', label: "Organization name", id: 'e2eAA_Ss_OrgNameTI',
          help: r.span({}, "The full name of the company or organization that runs this site. " +
            "Used on your ", termsOfUseLink, " page. You can use your " +
            "own name if there is no organization."),
          canReset: false,
          getter: (s: Settings) => s.companyFullName,
          update: (newSettings: Settings, target) => {
            newSettings.companyFullName = target.value;
          }
        }),

        Setting2(props, { type: 'text', label: "Organization name, short",
          id: 'e2eAA_Ss_OrgNameShortTI',
          help: r.span({}, "An optional short name of the company or organization that " +
            "runs this site — can make your Terms of Use easier to read, if the complete name " +
            "is rather long."),
          getter: (s: Settings) => s.companyShortName,
          update: (newSettings: Settings, target) => {
            newSettings.companyShortName = target.value;
          }
        }),

        Setting2(props, { type: 'text', label: "Custom Terms of Use URL",
          id: 'e_ToUUrl',
          help: r.span({}, "A URL to any Terms of Use page of yours that you want to use " +
            "instead of the built-in default."),
          getter: (s: Settings) => s.termsOfUseUrl,
          update: (newSettings: Settings, target) => {
            newSettings.termsOfUseUrl = target.value;
          }
        }),

        Setting2(props, { type: 'text', label: "Custom Privacy Policy URL",
          id: 'e_PrivacyUrl',
          help: r.span({}, "A URL to any Privacy Policy page of yours that you want to use " +
            "instead of the built-in default."),
          getter: (s: Settings) => s.privacyUrl,
          update: (newSettings: Settings, target) => {
            newSettings.privacyUrl = target.value;
          }
        }),

        /* This setting isn't needed? Remove?  [3PU85J7]
        Setting2(props, { type: 'text', label: "company_domain",
          help: r.span({}, "The domain name owned by the company " +
            "that runs this site. Used in legal documents like the ", termsOfUseLink, "."),
          getter: (s: Settings) => s.companyDomain,
          update: (newSettings: Settings, target) => {
            newSettings.companyDomain = target.value;
          }
        }), */

        hasCustomToU ? null : Setting2(props, {
          type: 'select', label: "Contributors agreement",
          help: r.span({}, "Which rights should people grant to you on material they create " +
              "and post to this community? (This setting affects your ", userContentTermsLink,
            " page.)"),
          getter: (s: Settings) => s.contribAgreement,
          update: (newSettings: Settings, target) => {
            newSettings.contribAgreement = parseInt(target.value);
            if (newSettings.contribAgreement === ContribAgreement.UseOnThisSiteOnly) {
              newSettings.contentLicense = ContentLicense.AllRightsReserved;
            }
          }}, [
          /* Disable for now, because problematic if people change to MIT & CC-BY later and also
             change the Content License from All Rights Reserved to some CC-BY license. [6UK2F4X]
          r.option({ key: 1, value: ContribAgreement.UseOnThisSiteOnly },
            "They should let us use it on this website only"),
           Can add other ContribAgreement.* types later too. But for now, only:
           */
          r.option({ key: 2, value: ContribAgreement.CcBy3And4 },
            "Dual license under CC-BY 3.0 and 4.0"),
        ]),

        hasCustomToU ? null : Setting2(props, {
          type: 'select', label: "Content license",
          help: r.span({},
            "Under which ",
            r.a({ href: 'https://creativecommons.org/licenses/', target: '_blank' },
                "Creative Commons license"),
            " is the content in this community available? (This setting affects your ",
            userContentTermsLink, " page.)"),
          disabled: valueOf(s => s.contribAgreement) === ContribAgreement.UseOnThisSiteOnly,
          getter: (s: Settings) => s.contentLicense,
          update: (newSettings: Settings, target) => {
            newSettings.contentLicense = parseInt(target.value);
          }}, [
          r.option({ key: 1, value: ContentLicense.CcBy4 },
            "Attribution 4.0 International (CC BY 4.0)"),
          r.option({ key: 2, value: ContentLicense.CcBySa4 },
            "Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)"),
          r.option({ key: 3, value: ContentLicense.CcByNcSa4 },
            "Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0)"),
          r.option({ key: 4, value: ContentLicense.AllRightsReserved },
            "None. All Rights Reserved"),
        ])));
  }
});



const CustomizePanel = createFactory({
  displayName: 'CustomizePanel',

  componentDidMount: function() {
    this.props.loadAllSettingsIfNeeded();
  },

  render: function() {
    let props = this.props;
    if (!props.currentSettings)
      return r.p({}, "Loading...");

    const store: Store = this.props.store;
    const me: Myself = store.me;

    if (!me.isAdmin)
      return OnlyForAdmins();

    const childProps = this.props;
    const bp = AdminRoot + 'customize/'; // base path
    return (
      r.div({ className: 'esA_Ss s_A_Ss-LaF' },
        r.ul({ className: 'esAdmin_settings_nav col-sm-2 nav nav-pills nav-stacked' },
          LiNavLink({ to: bp + 'basic', id: 'e_A_Ss-LaF_Basic' }, "Basic"),
          LiNavLink({ to: bp + 'html', id: 'e_A_Ss-LaF_Html' }, "HTML"),
          LiNavLink({ to: bp + 'css-js', id: 'e_A_Ss-LaF_CssJs' }, "CSS and JS")),
        r.div({ className: 'form-horizontal esAdmin_settings col-sm-10' },
          Switch({},
            // [React_Router_v51] skip render(), use hooks and useParams instead.
            Route({ path: bp + 'basic', render: () => CustomizeBasicPanel(childProps) }),
            Route({ path: bp + 'html', render: () => CustomizeHtmlPanel(childProps) }),
            Route({ path: bp + 'css-js', render: () => CustomizeCssJsPanel(childProps) })),
            )));
  }
});



const CustomizeBasicPanel = createFactory({
  displayName: 'CustomizeBasicPanel',

  render: function() {
    const props = this.props;
    const currentSettings: Settings = props.currentSettings;
    const editedSettings: Settings = props.editedSettings;

    const valueOf = (getter: (s: Settings) => any) =>
      firstDefinedOf(getter(editedSettings), getter(currentSettings));

    const faviconUrl = valueOf(s => s.faviconUrl);
    const enableForum = valueOf(s => s.enableForum);
    const enableEmbedded = !!valueOf(s => s.allowEmbeddingFrom);

    return (
      r.div({},
        !enableForum ? null :
        Setting2(props, { type: 'text', label: "Favicon URL",
          placeholder: "https://example.com/your/favicon.ico",
          help: rFragment({},
            "Web browsers show the favicon in browser tabs, bookmarks, navigation history, etc.", r.br(),
            "Your icon: ",
            !faviconUrl ? "(none)" :
                r.img({ src: faviconUrl, style: { display: 'inline-block', margin: '5px 0 0 12px' }})),
          getter: (s: Settings) => s.faviconUrl,
          update: (newSettings: Settings, target) => {
            newSettings.faviconUrl = target.value;
          }
        }),

        !valueOf(s => s.showCategories) ? null :
        Setting2(props, { type: 'text', label: "Forum main view",
          className: 'e_A_Ss_S-ForumMainViewTI',
          help: "Set to 'categories' to show all categories on the homepage, instead " +
              "of showing the latest topics (which is the default).",
          getter: (s: Settings) => s.forumMainView,
          update: (newSettings: Settings, target) => {
            newSettings.forumMainView = target.value;
          }
        }),

        /*
        r.p({}, "Here you can ", r.i({}, "remove"), " features from your forum " +
          "to make it simpler. Uncheck a checkbox to remove a feature."),
          */

        !enableForum ? null :
        Setting2(props, { type: 'checkbox', label: "Show topic filter button",
          className: 'e_A_Ss_S-ShowTopicFilterCB',
          help: r.span({}, "Uncheck to hide the ", r.i({}, "All Topics"), " / ",
            r.i({}, "Only Waiting"), " topics filter button"),
          getter: (s: Settings) => s.showTopicFilterButton,
          update: (newSettings: Settings, target) => {
            newSettings.showTopicFilterButton = target.checked;
          }
        }),

        !enableForum ? null :
        Setting2(props, { type: 'checkbox', label: "Show topic type icons",
          className: 'e_A_Ss_S-ShowTopicTypesCB',
          help: "Uncheck to hide topic type icons in the forum topic list",
          getter: (s: Settings) => s.showTopicTypes,
          update: (newSettings: Settings, target) => {
            newSettings.showTopicTypes = target.checked;
          }
        }),

        !enableForum ? null :
        Setting2(props, { type: 'checkbox', label: "Choose topic type",
          className: 'e_A_Ss_S-SelectTopicTypeCB',
          help: "Uncheck to hide choose-and-change topic type buttons",
          getter: (s: Settings) => s.selectTopicType,
          update: (newSettings: Settings, target) => {
            newSettings.selectTopicType = target.checked;
          }
        }),

        !enableForum ? null :
        Setting2(props, { type: 'checkbox', label: "Sidebar open by default",
          help: "Uncheck to hide the left sidebar for new users. " +
            "They'll then need to open it " +
            "themselves. (The right hand sidebar is always closed, by default.)",
          getter: (s: Settings) => s.watchbarStartsOpen,
          update: (newSettings: Settings, target) => {
            newSettings.watchbarStartsOpen = target.checked;
          }
        }),

        Setting2(props, { type: 'number', min: 1, max: 3, label: "Author name style",
          help: rFragment({},
            "How to display post author names. One of these numbers:",
            r.br(),
            "1: Username only, example: ",
            r.span({ className: 'esP_By_F', style: { marginLeft: '8px' } }, "jane"),
            r.br(),
            "2: Username, then any full name: ",
            r.span({},
              r.span({ className: 'esP_By_F', style: { marginLeft: '8px' } }, "jane"),
              r.span({ className: 'esP_By_U' }, " Jane Doe")),
            r.br(),
            "3: Full name, then username: ",
            r.span({},
              r.span({ className: 'esP_By_F', style: { marginLeft: '8px' } }, "Jane Doe"), " ",
              r.span({ className: 'esP_By_U' },
                r.span({ className: 'esP_By_U_at'}, '@'), "jane"))),
          getter: (s: Settings) => s.showAuthorHow,
          update: (newSettings: Settings, target) => {
            let num = parseInt(target.value);
            if (_.isNaN(num)) num = 3;
            if (num >= 10) num = num % 10; // pick the last digit = the one the user just typed
            if (num < 1) num = 1;
            if (num > 3) num = 3;
            newSettings.showAuthorHow = num;
          }
        }),

        Setting2(props, { type: 'checkbox', label: "Enable 'Disagree' votes",
          help: "Un-tick to disable and remove all Disagree votes; " +
              "tick again to re-enable Disagree votes and get them back.",
          getter: (s: Settings) => s.enableDisagreeVote,
          update: (newSettings: Settings, target) => {
            newSettings.enableDisagreeVote = target.checked;
          }
        }),


        // ---- Discussion and Progress sections

        !enableForum ? null : rFr({},

          r.h2({ className: 'col-sm-offset-3 s_A_Ss_S_Ttl e_DscPrgSct'},
            "Discussion and Progress topic sections"),

          // Later, break out this to a separate settings3 table row,
          // for PageType != EmeddedComments ?  [PAGETYPESETTNG]  [POSTSORDR]
          Setting2(props, { type: 'number', min: 1, max: 3,
            className: 'e_FrmSrtOdr',
            label: "Sort order of replies",
            help: rFr({},
              "How should replies be ordered? One of these numbers:",
              r.br(),
              "0: The default: Oldest First, same as 3.",
              r.br(),
              "1: Best (popular) first.",
              r.br(),
              "2: Newest first.",
              r.br(),
              "3: Oldest first."
              ),
            getter: (s: Settings) => s.discPostSortOrder,
            update: (newSettings: Settings, target) => {
              let num = parseInt(target.value);
              if (num < 0) num = 0;
              if (num > 3) num = 3;
              newSettings.discPostSortOrder = num;
            }
          }),

          r.p({ className: 'col-sm-offset-3' },
            "Talkyard's topics can have two sections: " +
            "A Discussion section, where you " +
            "post answers and discuss ideas, problems, news. " +
            "And a \"Progress\" or \"Timeline\" section, where you see " +
            "the step by step progress of making the idea happen, " +
            "or solving the problem."),
          r.p({ className: 'col-sm-offset-3' },
            "However, the Progress section can confuse people, " +
            "and you might want to disable it, until we've " +
            "made it simpler to understand."),

          Setting2(props, { type: 'number', min: 1, max: 3,
            label: "Progress section layout",
            help: rFragment({},
              "How shall the Progress section look? One of these numbers:",
              r.br(),
              "0: Default, currently same as Enabled.",
              r.br(),
              "1: Enabled.",
              r.br(),
              "2: Mostly disabled. Hides the ", r.i({}, "Add Progress Note"), "  button.",
              ),
            getter: (s: Settings) => s.progressLayout,
            update: (newSettings: Settings, target) => {
              let num = parseInt(target.value);
              if (num < 0) num = 0;
              if (num > 2) num = 2;
              newSettings.progressLayout = num;
            }
          }),

        ),


        // ---- Blog comments

        // Skip this title, if forum features disabled — because then all
        // settings are for blog comments only.
        !enableForum ? null :
          r.h2({ className: 'col-sm-offset-3 s_A_Ss_S_Ttl'},
            "Blog comments"),

        enableEmbedded ? null :
          r.p({ className: 'col-sm-offset-3' },
            "To show these settings, first specify an ",
            r.i({}, "Allow Embedding From"), " domain.", r.br(),
            "Go here: ",
            Link({ to: linkToAdminPageEmbeddedSettings() },
              "Embedded comments settings ...")),

        // Later, break out this to a separate settings3 table row,
        // for PageType.EmeddedComments.  [PAGETYPESETTNG]
        !enableEmbedded ? null : Setting2(props, { type: 'text',
          className: 'e_AddCmtBtnTtl',
          label: rFragment({}, "Title of the ", r.i({}, "Add Comment"), " button"),
          help: rFragment({},
            "Leave empty to use the default button title, which is \"" +
            t.AddComment + "\" (if you use English)."),
          getter: (s: Settings) => s.origPostReplyBtnTitle,
          update: (newSettings: Settings, target) => {
            // Don't trim() here — that'd make it hard to type a space.
            newSettings.origPostReplyBtnTitle = target.value;
          }
        }),

        // Later, break out this to a separate settings3 table row,
        // for PageType.EmeddedComments.  [PAGETYPESETTNG]
        !enableEmbedded ? null : Setting2(props, { type: 'number', min: 1, max: 3,
          className: 'e_BlgPstVts',
          label: "Blog post votes",
          help: rFragment({},
            "May blog readers Like or Disagree vote on the blog post itself? " +
            "Type one of these numbers:",
            r.br(),
            "0: The default, currently means Like votes only (same as 2).",
            r.br(),
            "1: No votes. People can vote on blog ", r.i({}, "comments"), ", " +
              "but not the blog post itself.",
            r.br(),
            "2: Like votes only.",
            //r.br(),
            //"3: Like and Disagree votes."  — skip for now [OPDOWNV].
            ),
          getter: (s: Settings) => s.origPostVotes,
          update: (newSettings: Settings, target) => {
            let num = parseInt(target.value);
            if (num < 0) num = 0;
            if (num > 2) num = 2;  // [OPDOWNV]
            newSettings.origPostVotes = num;
          }
        }),

        // Later, break out this to a separate settings3 table row,
        // for PageType.EmeddedComments.  [PAGETYPESETTNG]
        // — Until then, this whole site setting, is only used for
        // embedded blog comments. [POSTSORDR]
        !enableEmbedded ? null : Setting2(props, { type: 'number', min: 1, max: 3,
          className: 'e_BlgSrtOdr',
          label: "Blog comments sort order",
          help: rFragment({},
            "How should blog comments be ordered? One of these numbers:",
            r.br(),
            "0: The default, Popular First (same as 1).",
            r.br(),
            "1: Best (popular) first.",
            r.br(),
            "2: Newest first.",
            r.br(),
            "3: Oldest first."
            ),
          getter: (s: Settings) => s.embComSortOrder,
          update: (newSettings: Settings, target) => {
            let num = parseInt(target.value);
            if (num < 0) num = 0;
            if (num > 3) num = 3;
            newSettings.embComSortOrder = num;
          }
        }),
      ));
  }
});



const CustomizeHtmlPanel = createFactory({
  displayName: 'CustomizeHtmlPanel',

  render: function() {
    const props = this.props;
    const currentSettings: Settings = props.currentSettings;
    let navConfJsonExeption;

    return (
      r.div({ className: 'form-horizontal esAdmin_customize' },

        // Add back this: [2ABKR05L]  once this has been implemented.
        Alert({ bsStyle: 'info' },
          r.p({}, r.b({}, "Ignore everything below,"), " especially if you don't know HTML."),
          r.p({}, "We'll try to build something for you that's easier to use, later.")),

        /* A tester checked this without any idea about what it does.
          Remove for now, perhaps later show in some Advanced section?
        Setting({ setting: settings.horizontalComments, onSave: saveSetting,
          label: '2D Tree Layout', help: "Shall comments be laid out in a two " +
            "dimensional tree? By default, they're shown in a single column instead." }),
         */

        Setting2(props, { type: 'textarea', label: "Header HTML",
          help: "Any header, will be shown at the top of the page. " +
              "Currently you need to know HTML and CSS to be able to use this, unfortunately.",
          placeholder: "<div class=\"...\">...</div>",
          getter: (s: Settings) => s.headerHtml,
          update: (newSettings: Settings, target) => {
            newSettings.headerHtml = target.value;
          }
        }),

        currentSettings.showExperimental &&
        Setting2(props, { type: 'textarea', label: "Top nav HTML",
          help: "Top navigation bar configuration (will be a GUI later)",
          placeholder: "",
          error: navConfJsonExeption,
          getter: (s: Settings) => JSON.stringify(s.navConf, undefined, 2),
          update: (newSettings: Settings, target) => {
            try {
              const json = JSON.parse(target.value);
              newSettings.navConf = json;
              navConfJsonExeption = null;
            }
            catch (ex) {
              navConfJsonExeption = '' + ex;
            }
          }
        }),

        Setting2(props, { type: 'textarea', label: "Footer HTML",
          help: "Any footer, shown at the bottom of the page.",
          placeholder: "<footer class=\"...\">...</footer>",
          getter: (s: Settings) => s.footerHtml,
          update: (newSettings: Settings, target) => {
            newSettings.footerHtml = target.value;
          }
        }),

        Setting2(props, { type: 'textarea', label: "Styles HTML",
          help: "Stylesheet link tags that will be inserted after " +
              "other stylesheet tags in the <head> tag.",
          placeholder: "<link rel=\"stylesheet\" href=\"...\"/>",
          getter: (s: Settings) => s.headStylesHtml,
          update: (newSettings: Settings, target) => {
            newSettings.headStylesHtml = target.value;
          }
        }),

        Setting2(props, { type: 'textarea', label: "Scripts HTML",
          help: "Script tags that will be inserted after other " +
              "scripts in the <head> tag.",
          placeholder: "<script>...</script>",
          getter: (s: Settings) => s.headScriptsHtml,
          update: (newSettings: Settings, target) => {
            newSettings.headScriptsHtml= target.value;
          }
        }),

        Setting2(props, { type: 'textarea', label: "<body> HTML",
          help: "Tags to insert into the <body> tag, at the top.",
          getter: (s: Settings) => s.startOfBodyHtml,
          update: (newSettings: Settings, target) => {
            newSettings.startOfBodyHtml = target.value;
          }
        }),

        Setting2(props, { type: 'textarea', label: "</body> HTML",
          help: "Tags to insert just before the end of the <body> tag.",
          getter: (s: Settings) => s.endOfBodyHtml,
          update: (newSettings: Settings, target) => {
            newSettings.endOfBodyHtml = target.value;
          }
        }),

        // Skip for now; don't want to clarify for people how this works. Needs a <script> too :-P
        // But enable on www.talkyard.io — it already uses this.
        // CLEAN_UP REMOVE this, no longer in use on www.talkyard.io either, right?
        /*
        Setting2(props, { type: 'textarea', label: "Social links HTML",
          help: "Google+, Facebook, Twitter like and share buttons. Don't forget " +
            "to include a script too, e.g. in the <i>Scripts HTML</i> config value. " +
            "— Perhaps I'll remove this config value in the future, so you might " +
            "be better off not using it.",
          getter: (s: Settings) => s.socialLinksHtml,
          update: (newSettings: Settings, target) => {
            newSettings.socialLinksHtml= target.value;
          }
        })*/
        ));
  }
});



const CustomizeCssJsPanel = createFactory({
  displayName: 'CustomizeCssJsPanel',

  render: function() {
    return (
      r.div({ className: 'form-horizontal esAdmin_customize' },
        Alert({ bsStyle: 'info' },
          r.p({}, r.b({}, "Ignore everything below,"), " especially if you don't know CSS and JS."),
          r.p({}, "We'll give you a simpler way to choose colors, later.")),

        SpecialContent({ contentId: '_stylesheet', label: 'Stylesheet',
          help: "CSS for this site. CSS means Cascading Style Sheets and " +
            "you use it to describe the look and formatting of this site.",
          placeholder: ".selector { color: something }" }),

        // SECURITY hide with display: none? Or if Experimental not enabled?
        SpecialContent({ contentId: '_javascript', label: 'Javascript',
          help: "Javascript for this site. Be careful because with Javascript you can break " +
            "everything and add security bugs.",
          placeholder: "alert('hello world');" })));
  }
});


/**
 * For select-option inputs, see ReactSelect above and type = 'custom'.
 * If needed more than once, break out some reusable thing?
 */
function Setting2(panelProps, props, anyChildren?) {
  const editedSettings = panelProps.editedSettings;
  const currentSettings = panelProps.currentSettings;
  const defaultSettings = panelProps.defaultSettings;

  let editedValue = props.getter(editedSettings);
  let currentValue = props.getter(currentSettings);
  const defaultValue = props.getter(defaultSettings);

  let disabled = props.disabled;

  // If the setting has been removed (= disabled) server side, or never added,
  // show it as disabled here client side too.
  const isMissingOnServer = props.mustBeConfiguredOnServer && !defaultValue;
  if (isMissingOnServer) {
    editedValue = undefined;
    currentValue = defaultValue;
    disabled = true;
  }

  const effectiveValue = firstDefinedOf(editedValue, currentValue);

  dieIf(props.onChange, 'EsE3GUK02');
  dieIf(props.value, 'EsE6JY2F4');
  if (props.type === 'custom') {
    dieIf(!props.undo, 'TyE7UKBW2');
    dieIf(!props.reset, 'TyE7UKBW8');
  }
  else {
    dieIf(!props.update, 'EsE22PYK5');
  }

  props.value = firstDefinedOf(editedValue, currentValue);
  props.className = props.className || '';
  props.className += ' s_A_Ss_S';
  if (props.type === 'textarea') props.className += ' s_A_Ss_S-Textarea';
  props.wrapperClassName = 'col-sm-9 esAdmin_settings_setting';

  if (isDefined2(editedValue)) props.wrapperClassName += ' esAdmin_settings_setting-unsaved';
  if (disabled) props.wrapperClassName += ' disabled';

  if (props.type === 'checkbox') {
    props.labelFirst = true;
    props.labelClassName = 'col-sm-3';
    props.checked = props.value;
    delete props.value;
  }
  else {
    props.labelClassName = 'col-sm-3';
  }

  if (!disabled) props.onChange = (event) => {
    // A bit dupl code. [7UKWBP32]
    const newSettings = _.clone(editedSettings);
    props.update(newSettings, event.target);
    panelProps.removeUnchangedSettings(newSettings);
    panelProps.setEditedSettings(newSettings);
  };

  // ----- Reset and undo buttons

  const field = props.type === 'checkbox' ? 'checked' : 'value';
  const event = { target: {} };

  let undoChangesButton;
  if (isDefined2(editedValue)) {
    undoChangesButton = Button({ className: 'col-sm-offset-3 esAdmin_settings_setting_btn',
      disabled, onClick: props.undo || (() => {
        event.target[field] = currentValue;
        props.onChange(event);
      })}, "Undo changes");
  }

  // Show the Reset button only if there's no Undo button — both at the same time looks confusing.
  let resetToDefaultButton;
  if (!undoChangesButton && effectiveValue !== defaultValue && props.canReset !== false) {
    resetToDefaultButton = Button({ className: 'col-sm-offset-3 esAdmin_settings_setting_btn',
      disabled, onClick: props.reset || (() => {
        event.target[field] = defaultValue;
        props.onChange(event);
      })}, "Reset to default");
  }

  return (
    r.div({},
      Input({ ...props, disabled }, anyChildren),
      props.error && r.div({ style: { color: 'red' }}, props.error),
      resetToDefaultButton,
      undoChangesButton));
}


function TipsLink(props: { to: string }, text: string) {
  return Link({ to: props.to, className: 'col-sm-offset-3 col-sm-9 s_A_Ss_TipsL' },
      text);
}


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
