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

/// <reference path="../slim-bundle.d.ts" />
/// <reference path="../more-bundle-already-loaded.d.ts" />
/// <reference path="review-all.staff.ts" />
/// <reference path="review-posts.staff.ts" />
/// <reference path="api-panel.staff.ts" />
/// <reference path="users.staff.ts" />
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
const AdminRoot = '/-/admin/';

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
    const ssoUrl = login.makeSsoUrl(store, window.location.toString());

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
        cnameTargetHost: currentAndDefaultSettings.cnameTargetHost,
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
      if (location.pathname.search('/review') >= 0) {
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

  removeUnchangedSettings: function(settings: Settings) {
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
    const me = store.me;
    if (!me)
      return r.p({}, "Not logged in");

    if (!this.state.currentSettings)
      return r.p({}, "Loading ...");

    const ar = AdminRoot;

    const settingsLink = me.isAdmin ?
        LiNavLink({ to: ar + 'settings', className: 'e_StngsB' }, "Settings") : null;

    const customizeLink = me.isAdmin ?
        LiNavLink({ to: ar + 'customize', className: 'e_LnFB' }, "Look and feel") : null;

    const apiLink = me.isAdmin ?
      LiNavLink({ to: ar + 'api', className: 'e_ApiB' }, "API") : null;

    const saveBar = _.isEmpty(this.state.editedSettings) ? null :
      r.div({ className: 'esA_SaveBar' },
        r.div({ className: 'container' },
          PrimaryButton({ onClick: this.saveSettings,
            className: 'esA_SaveBar_SaveAllB' }, "Save all changes" ),
          Button({ onClick: this.undoSettings,
            className: 'esA_SaveBar_UndoAllB' }, "Undo all changes" )));

    const childProps = {
      store: store,
      loadAllSettingsIfNeeded: this.loadAllSettingsIfNeeded,
      defaultSettings: this.state.defaultSettings,
      currentSettings: this.state.currentSettings,
      editedSettings: this.state.editedSettings,
      hosts: this.state.hosts,
      removeUnchangedSettings: this.removeUnchangedSettings,
      setEditedSettings: this.setEditedSettings,
    };

    const childRoutes = Switch({},
        RedirAppend({ path: ar + 'users', append: '/enabled' }),
        RedirAppend({ path: ar + 'review', append: '/all' }),
        RedirAppend({ path: ar + 'settings', append: '/legal' }),
        RedirAppend({ path: ar + 'customize', append: '/basic' }),
        Route({ path: ar + 'settings', render: () => SettingsPanel(childProps) }),
        Route({ path: ar + 'users', render: () => UsersTab(childProps) }),
        Route({ path: ar + 'customize', render: () => CustomizePanel(childProps) }),
        Route({ path: ar + 'api', render: () => ApiPanel(childProps) }),
        Route({ path: ar + 'review', render: () => ReviewAllPanel(childProps) }));

    return (
      r.div({ className: 'esAdminArea' },
        topbar.TopBar({ customTitle: "Admin Area", showBackToSite: true, extraMargin: true }),
        r.div({ className: 'container' },
          r.ul({ className: 'dw-main-nav nav nav-pills' },
            settingsLink,
            LiNavLink({ to: ar + 'users', className: 'e_UsrsB' }, "Users"),
            customizeLink,
            apiLink,
            LiNavLink({ to: ar + 'review', className: 'e_RvwB' }, "Review")),
          childRoutes,
          saveBar)));
  }
});



function OnlyForAdmins() {
  return r.p({},
      "Only for admins. You can review other people's posts, though, ",
      r.a({ href: linkToAdminPage() }, " go here."));
}



const SettingsPanel = createFactory({
  displayName: 'SettingsPanel',

  componentDidMount: function() {
    this.props.loadAllSettingsIfNeeded();
  },

  render: function() {
    const props = this.props;
    if (!props.currentSettings)
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
          LiNavLink({ to: sr + 'advanced', id: 'e2eAA_Ss_AdvancedL' }, "Advanced")),
        r.div({ className: 'form-horizontal esAdmin_settings col-sm-10' },
          Switch({},
            Route({ path: sr + 'legal', render: () => LegalSettings(ps) }),
            Route({ path: sr + 'login', render: () => LoginAndSignupSettings(ps) }),
            Route({ path: sr + 'moderation', render: () => ModerationSettings(ps) }),
            Route({ path: sr + 'spam-flags', render: () => SpamFlagsSettings(ps) }),
            Route({ path: sr + 'features', render: () => FeatureSettings(ps) }),
            Route({ path: sr + 'embedded-comments', render: () => EmbeddedCommentsSettings(ps) }), // [8UP4QX0]
            Route({ path: sr + 'language', render: () => LanguageSettings(ps) }),
            Route({ path: sr + 'advanced', render: () => AdvancedSettings(ps) })))));
  }
});



const LoginAndSignupSettings = createFactory({
  displayName: 'LoginAndSignupSettings',

  render: function() {
    const props = this.props;
    const currentSettings: Settings = props.currentSettings;
    const editedSettings: Settings = props.editedSettings;
    const defaultSettings: Settings = props.defaultSettings;

    const valueOf = (getter: (s: Settings) => any) =>
      firstDefinedOf(getter(editedSettings), getter(currentSettings));

    const enableSso = valueOf(s => s.enableSso);
    const allowSignup = valueOf(s => s.allowSignup);
    const requireVerifiedEmail = valueOf(s => s.requireVerifiedEmail);
    const mayComposeBeforeSignup = valueOf(s => s.mayComposeBeforeSignup);
    const featureFlags = valueOf(s => s.featureFlags);

    const canEnableGuestLogin =
      !valueOf(s => s.userMustBeApproved) && !valueOf(s => s.userMustBeAuthenticated) &&
        valueOf(s => s.allowSignup) && !requireVerifiedEmail && !enableSso;  // && !invite-only (6KWU20)

    const missingServerSiteHint = (isConfiguredOnServer: boolean) => isConfiguredOnServer ? '' :
        " Cannot be enabled, because has not been configured server side, " +
        "in /opt/talkyard/conf/app/play.conf.";

    const ssoTestPageLink = r.a({ href: '/-/sso-test', className: 'e_SsoTestL' }, "/-/sso-test");
    const adminLoginLink = r.a({ href: '/-/admin-login', className: 'e_AdmLgiL' }, "/-/admin-login");

    return (
      r.div({},
        enableSso ? null : Setting2(props, {
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
        enableSso || !allowSignup ? null : Setting2(props, {
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

        Setting2(props, { type: 'checkbox', label: "Login required", id: 'e2eLoginRequiredCB',
          className: 'e_A_Ss_S-LoginRequiredCB',
          help: r.span({}, "Require authentication to read content. Users must then login " +
            "with ", r.i({}, "for example"), " password, or Google or Facebook or Single Sing-On " +
            "— but anonymous access is disabled."),
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
        enableSso || !allowSignup ? null : Setting2(props, {
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
        enableSso || !allowSignup ? null : Setting2(props, {
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
        enableSso ? null : Setting2(props, {
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

        /* Not yet implemented: (saved to db but won't have any effect)

        doubleTypeEmailAddress: Option[Boolean]
        doubleTypePassword: Option[Boolean]
        begForEmailAddress */

        enableSso || !allowSignup ? null : Setting2(props, {
          type: 'checkbox', label: "Allow creating local accounts",
          className: 'e_A_Ss_S-AllowLoalSignupCB',
          help: "Uncheck to prevent people from creating email + password accounts at this site.",
          disabled: !valueOf(s => s.allowSignup),
          getter: (s: Settings) => s.allowLocalSignup,
          update: (newSettings: Settings, target) => {
            newSettings.allowLocalSignup = target.checked;
          }
        }),

        enableSso || !allowSignup ? null : Setting2(props, {
          type: 'checkbox', label: "Allow guest login", id: 'e2eAllowGuestsCB',
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

        // ---- OpenAuth login

        enableSso || !allowSignup ? null : Setting2(props, {
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

        enableSso || !allowSignup ? null : Setting2(props, {
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

        enableSso || !allowSignup ? null : Setting2(props, {
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

        enableSso || !allowSignup ? null : Setting2(props, {
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

        Setting2(props, {
          type: 'text', label: "Single Sign-On URL",
          className: 'e_SsoUrl',
          help: rFragment({},
            r.p({},
              "Where at your website (if any) to redirect a user, for SSO signup or login. Example: "),
            r.p({},
              r.samp({}, "https://www.your-website.com/login?returnTo=${talkyardPathQueryEscHash}")),
            r.p({},
              "To start using SSO, fill in only this SSO URL field (but do ", r.i({}, "not "),
              "enable SSO below), save the settings, and go here: ",
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


        // ---- Email domain blacklist

        /* Not impl server side. And UX? Should whitelist domains be shown client side?

        enableSso || !allowSignup ? null : Setting2(props, {
          type: 'textarea', label: "Email domain blacklist", id: 'e_EmailBlacklist',
          help: "People may not sign up with emails from these domains. One domain per row. " +
          "Lines starting with '#' are ignored (so you can add comments).",
          getter: (s: Settings) => s.emailDomainBlacklist,
          update: (newSettings: Settings, target) => {
            newSettings.emailDomainBlacklist = target.value;
          }
        }),

        enableSso || !allowSignup ? null : Setting2(props, {
          type: 'textarea', label: "Email domain whitelist", id: 'e_EmailWhitelist',
          help: "People may only sign up with emails from these domains. One domain per row. " +
            "Lines starting with '#' are ignored (so you can add comments).",
          getter: (s: Settings) => s.emailDomainWhitelist,
          update: (newSettings: Settings, target) => {
            newSettings.emailDomainWhitelist = target.value;
          }
        }),  */
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
        Setting2(props, { type: 'number', min: 0, max: MaxNumFirstPosts,
          label: "Num first posts to review",
          help: "How many of a new member's first posts the staff will be notified about " +
            "so they can review them. The posts will become visible directly, before " +
            "they've been reviewed. Max " + MaxNumFirstPosts + ".",
          getter: (s: Settings) => s.numFirstPostsToReview,
          update: (newSettings: Settings, target) => {
            let num = parseInt(target.value);
            if (_.isNaN(num)) num = currentSettings.numFirstPostsToReview;
            if (num < 0) num = 0;
            if (num > MaxNumFirstPosts) num = makeSmall(num);
            newSettings.numFirstPostsToReview = num;
          }
        }),

        Setting2(props, { type: 'number', min: 0, max: MaxNumFirstPosts,
          label: "Num first posts to approve",
          help: "How many of a new member's first posts need to be approved by staff, " +
            "before they'll be shown. They'll be hidden, until approved. " +
            "Set to 0 to disable. Max is " + MaxNumFirstPosts + ".",
          getter: (s: Settings) => s.numFirstPostsToApprove,
          update: (newSettings: Settings, target) => {
            let num = parseInt(target.value);
            if (_.isNaN(num)) num = currentSettings.numFirstPostsToApprove;
            if (num < 0) num = 0;
            if (num > MaxNumFirstPosts) num = makeSmall(num);
            newSettings.numFirstPostsToApprove = num;
            if (valueOf(s => s.numFirstPostsToAllow) < num) {
              newSettings.numFirstPostsToAllow = num;
            }
          },
        }),

        Setting2(props, { type: 'number', min: 0, max: MaxNumFirstPosts,
          label: "Num first posts to allow",
          help: "How many posts a new member may post, before s/he has to wait with " +
              "posting anything more, until the first posts have been approved by staff.",
          getter: (s: Settings) => s.numFirstPostsToAllow,
          update: (newSettings: Settings, target) => {
            let num = parseInt(target.value);
            if (_.isNaN(num)) num = currentSettings.numFirstPostsToAllow;
            if (num < 0) num = 0;
            if (num > MaxNumFirstPosts) num = makeSmall(num);
            newSettings.numFirstPostsToAllow = num;
            if (valueOf(s => s.numFirstPostsToApprove) > num) {
              newSettings.numFirstPostsToApprove = num;
            }
          },
        })));
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
          label: "Regular member flag weight",
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

    return (
      r.div({},
        Setting2(props, { type: 'checkbox',
          label: "Enable chat",
          help: "Lets people create and join chat topics, and shows joined chats in the left sidebar. " +
            "If everyone uses another team chat tool already, like Slack, " +
            "then you might want to disable chat, here.",
          getter: (s: Settings) => s.enableChat,
          update: (newSettings: Settings, target) => {
            newSettings.enableChat = target.checked;
          }
        }),

        Setting2(props, { type: 'checkbox',
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
      ));
  }
});



const EmbeddedCommentsSettings = createFactory({
  displayName: 'EmbeddedCommentsSettings',

  render: function() {
    const props = this.props;
    const settings: Settings = props.currentSettings;
    const embeddingUrl = settings.allowEmbeddingFrom.trim();
    let dotMin = '.min';
    // @ifdef DEBUG
    dotMin = '';
    // @endif

    const urlSeemsValid = /https?:\/\/.+/.test(embeddingUrl);   // 'http://localhost' is ok
    const anyInstructions = !urlSeemsValid ? null :
        r.div({ className: 's_A_Ss_EmbCmts col-sm-offset-3 col-sm-9' },
          r.h2({}, "Instructions"),
          r.p({}, "On your website, i.e. ", r.code({}, embeddingUrl),
            ", paste the following HTML in a web page or site template, " +
            "where you want comments to appear:"),
          r.pre({ id: 'e_EmbCmtsHtml' },
            // script url defined here: [2WPGKS04]
            // this code is dupl in e2e test [2JKWTQ0].
`<script>talkyardServerUrl='${location.origin}';</script>
<script async defer src="${eds.cdnOrServerOrigin}/-/talkyard-comments${dotMin}.js"></script>
<!-- You can specify a per page discussion id on the next line, if your URLs might change. -->
<div class="talkyard-comments" data-discussion-id="" style="margin-top: 45px;">
<noscript>Please enable Javascript to view comments.</noscript>
<p style="margin-top: 25px; opacity: 0.9; font-size: 96%">Comments powered by
<a href="https://www.talkyard.io">Talkyard</a>.</p>
</div>`),
          r.p({},
            "Thereafter, try adding a comment, over at your website — should work now."),
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
              r.a({ href: 'https://hexo-comments.demo.ed.community/2018/01/04/demo-and-instructions/' },
                "these instructions"), '.'),
            ));

    return (
      r.div({},
        Setting2(props, { type: 'textarea', label: "Allow embedding from", id: 'e_AllowEmbFrom',
          help: r.span({}, "Lets another website (your website) show embedded contents. " +
            "You can add many domains — separate them with spaces or newlines."),
          placeholder: "https://www.yourblog.com",

          // Dupl repl-space-w-newlines code (7KABW92)
          getter: (s: Settings) =>
            // Replace spaces with newlines, otherwise hard to read.
            _.isUndefined(s.allowEmbeddingFrom) ? undefined : s.allowEmbeddingFrom.replace(/\s+/g, '\n'),
          update: (newSettings: Settings, target) => {
            // Change back from \n to space — browsers want spaces in allow-from.
            newSettings.allowEmbeddingFrom = target.value.replace(/\n+/g, ' ');
          }
        }),
        anyInstructions));
  }
});



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
      value: 'pl_PL', label: "Polish"
    }, {
      value: 'pt_BR', label: "Portuguese (Brazilian)"
    }, {
      value: 'sv_SE', label: "Swedish"
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

    const changeHostnameFormGroup =
      r.div({ className: 'form-group' },
        r.label({ className: 'control-label col-sm-3' }, "Address"),
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

    return (
      r.div({},
        Setting2(props, { type: 'text', label: "Google Universal Analytics tracking ID",
          help: r.span({}, "Any Google Universal Analytics tracking ID, e.g. ",
            r.samp({}, "UA-12345678-9"), ", see http://google.com/analytics."),
          getter: (s: Settings) => s.googleUniversalAnalyticsTrackingId,
          update: (newSettings: Settings, target) => {
            newSettings.googleUniversalAnalyticsTrackingId = target.value;
          }
        }),

        Setting2(props, {
          type: 'checkbox', label: "Experimental",
          help: "Enables some currently not-well-tested features " +
          "like Wiki MindMaps and custom HTML pages.",
          getter: (s: Settings) => s.showExperimental,
          update: (newSettings: Settings, target) => {
            newSettings.showExperimental = target.checked;
          }
        }),

        /*
        Setting2(props, { type: 'textarea', label: "Feature flags", id: 'e_FeatFlags',
          help: r.span({}, "Enables or disables new features. Ignore, unless you know what " +
              "you're doing."),

          // Dupl repl-space-w-newlines code (7KABW92)
          getter: (s: Settings) =>
            // Replace spaces with newlines, otherwise hard to read.  What? Why? No stop doing that.
            _.isUndefined(s.featureFlags) ? undefined : s.featureFlags.replace(/\s+/g, '\n'),
          update: (newSettings: Settings, target) => {
            // Change back from \n to space — browsers want spaces in allow-from.
            newSettings.featureFlags = target.value.replace(/\n+/g, ' ');
          }
        }), */

        r.hr(),
        changeHostnameFormGroup,
        duplicatingHostsFormGroup,
        redirectingHostsFormGroup));

  }
});



const LegalSettings = createFactory({
  displayName: 'LegalSettings',

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

        /* This setting isn't needed? Remove?  [3PU85J7]
        Setting2(props, { type: 'text', label: "company_domain",
          help: r.span({}, "The domain name owned by the company " +
            "that runs this site. Used in legal documents like the ", termsOfUseLink, "."),
          getter: (s: Settings) => s.companyDomain,
          update: (newSettings: Settings, target) => {
            newSettings.companyDomain = target.value;
          }
        }), */

        Setting2(props, { type: 'select', label: "Contributors agreement",
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

        Setting2(props, { type: 'select', label: "Content license",
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

    return (
      r.div({},
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

        Setting2(props, { type: 'checkbox', label: "Use categories",
          className: 'e_A_Ss_S-ShowCatsCB',
          help: "Unckeck to disable categories and hide category related buttons and columns. " +
          "Suitable for small forums where you don't need different categories.",
          getter: (s: Settings) => s.showCategories,
          update: (newSettings: Settings, target) => {
            newSettings.showCategories = target.checked;
          }
        }),

        Setting2(props, { type: 'checkbox', label: "Show topic filter button",
          className: 'e_A_Ss_S-ShowTopicFilterCB',
          help: r.span({}, "Uncheck to hide the ", r.i({}, "All Topics"), " / ",
            r.i({}, "Only Waiting"), " topics filter button"),
          getter: (s: Settings) => s.showTopicFilterButton,
          update: (newSettings: Settings, target) => {
            newSettings.showTopicFilterButton = target.checked;
          }
        }),

        Setting2(props, { type: 'checkbox', label: "Show topic type icons",
          className: 'e_A_Ss_S-ShowTopicTypesCB',
          help: "Uncheck to hide topic type icons in the forum topic list",
          getter: (s: Settings) => s.showTopicTypes,
          update: (newSettings: Settings, target) => {
            newSettings.showTopicTypes = target.checked;
          }
        }),

        Setting2(props, { type: 'checkbox', label: "Choose topic type",
          className: 'e_A_Ss_S-SelectTopicTypeCB',
          help: "Uncheck to hide choose-and-change topic type buttons",
          getter: (s: Settings) => s.selectTopicType,
          update: (newSettings: Settings, target) => {
            newSettings.selectTopicType = target.checked;
          }
        }),

        Setting2(props, { type: 'checkbox', label: "Sidebar open by default",
          help: "Uncheck to hide the left sidebar for new users. They'll then need to open it " +
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
      ));
  }
});



const CustomizeHtmlPanel = createFactory({
  displayName: 'CustomizeHtmlPanel',

  render: function() {
    const props = this.props;
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

        Setting2(props, { type: 'textarea', label: "</body> HTML",
          help: "Tags that will be inserted just before " +
              'the end of the <body> tag.',
          getter: (s: Settings) => s.endOfBodyHtml,
          update: (newSettings: Settings, target) => {
            newSettings.endOfBodyHtml= target.value;
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
      resetToDefaultButton,
      undoChangesButton));
}


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
