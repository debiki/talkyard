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
/// <reference path="review.staff.ts" />
/// <reference path="review-all.staff.ts" />
/// <reference path="review-posts.staff.ts" />
/// <reference path="users.staff.ts" />
/// <reference path="users-one.staff.ts" />
/// <reference path="hostname-editor.staff.ts" />

//------------------------------------------------------------------------------
   namespace debiki2.admin {
//------------------------------------------------------------------------------

const r = ReactDOMFactories;
const Alert = rb.Alert;

const PageUnloadAlerter = utils.PageUnloadAlerter;


const AdminRoot = '/-/admin/';

export function routes() {
  return Switch({},
    Redirect({ from: AdminRoot, to: AdminRoot + 'settings', exact: true }),
    Route({ path: AdminRoot, component: AdminAppComponent }));
}



export var NotYetImplementedComponent = createReactClass(<any> {
  displayName: 'NotYetImplementedComponent',
  render: function() {
    return (
      r.p({}, 'Not yet implemented. [EsM4GPY72]'));
  }
});



var AdminAppComponent = createReactClass(<any> {
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

  loadAllSettingsIfNeeded: function() {
    if (this.state.currentSettings)
      return;
    Server.loadSiteSettings(currentAndDefaultSettings => {
      this.setState({
        defaultSettings: currentAndDefaultSettings.defaultSettings,
        currentSettings: currentAndDefaultSettings.effectiveSettings,
        baseDomain: currentAndDefaultSettings.baseDomain,
        cnameTargetHost: currentAndDefaultSettings.cnameTargetHost,
        hosts: currentAndDefaultSettings.hosts,
        editedSettings: {},
      });
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
      var currentValue = this.state.currentSettings[name];
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
      this.setState({ currentSettings: result.effectiveSettings, editedSettings: {} });
    });
  },

  undoSettings: function() {
    this.setState({ editedSettings: {} });
  },

  render: function() {
    var store: Store = this.state.store;
    var me = store.me;
    if (!me)
      return r.p({}, 'Not logged in');

    const ar = AdminRoot;

    var settings = me.isAdmin ?
        LiNavLink({ to: ar + 'settings' }, "Settings") : null;

    var customize = me.isAdmin ?
        LiNavLink({ to: ar + 'customize' }, "Look and feel") : null;

    var saveBar = _.isEmpty(this.state.editedSettings) ? null :
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
        Route({ path: ar + 'review', render: () => ReviewPanel(childProps) }));

    return (
      r.div({ className: 'esAdminArea' },
        topbar.TopBar({ customTitle: "Admin Area", showBackToSite: true, extraMargin: true }),
        r.div({ className: 'container' },
        r.ul({ className: 'dw-main-nav nav nav-pills' },
          settings,
          LiNavLink({ to: ar + 'users' }, "Users"),
          customize,
          LiNavLink({ to: ar + 'review' }, "Review")),
        childRoutes,
        saveBar)));
  }
});



const SettingsPanel = createFactory({
  displayName: 'SettingsPanel',

  componentDidMount: function() {
    this.props.loadAllSettingsIfNeeded();
  },

  render: function() {
    const props = this.props;
    if (!props.currentSettings)
      return r.p({}, 'Loading...');

    const sr = AdminRoot + 'settings/';
    const ps = this.props;

    return (
      r.div({ className: 'esA_Ss' },
        r.ul({ className: 'esAdmin_settings_nav col-sm-2 nav nav-pills nav-stacked' },
          LiNavLink({ to: sr + 'legal', id: 'e2eAA_Ss_LegalL' }, "Legal"),
          LiNavLink({ to: sr + 'login', id: 'e2eAA_Ss_LoginL' }, "Signup and Login"),
          LiNavLink({ to: sr + 'moderation', id: 'e2eAA_Ss_ModL'  }, "Moderation"),
          LiNavLink({ to: sr + 'spam-flags', id: 'e2eAA_Ss_SpamFlagsL'  }, "Spam & flags"),
          LiNavLink({ to: sr + 'embedded-comments', id: 'e2eAA_Ss_EmbCmtsL' }, "Embedded Comments"),
          LiNavLink({ to: sr + 'advanced', id: 'e2eAA_Ss_AdvancedL' }, "Advanced")),
        r.div({ className: 'form-horizontal esAdmin_settings col-sm-10' },
          Switch({},
            Route({ path: sr + 'legal', render: () => LegalSettings(ps) }),
            Route({ path: sr + 'login', render: () => LoginAndSignupSettings(ps) }),
            Route({ path: sr + 'moderation', render: () => ModerationSettings(ps) }),
            Route({ path: sr + 'spam-flags', render: () => SpamFlagsSettings(ps) }),
            Route({ path: sr + 'embedded-comments', render: () => EmbeddedCommentsSettings(ps) }), // [8UP4QX0]
            Route({ path: sr + 'advanced', render: () => AdvancedSettings(ps) })))));
  }
});



const LoginAndSignupSettings = createFactory({
  displayName: 'LoginAndSignupSettings',

  render: function() {
    const props = this.props;
    const currentSettings: Settings = props.currentSettings;
    const editedSettings: Settings = props.editedSettings;

    const valueOf = (getter: (s: Settings) => any) =>
      firstDefinedOf(getter(editedSettings), getter(currentSettings));

    const requireVerifiedEmail = valueOf(s => s.requireVerifiedEmail);
    const mayComposeBeforeSignup = valueOf(s => s.mayComposeBeforeSignup);

    const canEnableGuestLogin =
      !valueOf(s => s.userMustBeApproved) && !valueOf(s => s.userMustBeAuthenticated) &&
        valueOf(s => s.allowSignup) && !requireVerifiedEmail;  // && !invite-only (6KWU20)

    return (
      r.div({},
        Setting2(props, { type: 'checkbox', label: "Login required", id: 'e2eLoginRequiredCB',
          className: 'e_A_Ss_S-LoginRequiredCB',
          help: r.span({}, "Require authentication to read content. Users must then login " +
            "with ", r.i({}, "for example"), " password, or Google or Facebook — but " +
            "anonymous access is disabled."),
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

        Setting2(props, { type: 'checkbox', label: "Approve users", id: 'e2eApproveUsersCB',
          className: 'e_A_Ss_S-ApproveUsersCB',
          help: "New users need to be approved by staff before they can access the site.",
          getter: (s: Settings) => s.userMustBeApproved,
          update: (newSettings: Settings, target) => {
            newSettings.userMustBeApproved = target.checked;
            if (target.checked && valueOf(s => s.allowGuestLogin)) {
              newSettings.allowGuestLogin = false;
            }
          }
        }),

        Setting2(props, { type: 'checkbox', label: "Require verified email",
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

        Setting2(props, { type: 'checkbox', label: "May compose before sign up",
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

        Setting2(props, { type: 'checkbox', label: "May post before email verified",
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
        begForEmailAddress

        Setting2(props, { type: 'checkbox', label: "Invite only",
         className: 'e_A_Ss_S-InviteOnlyCB',
         help: "People can join only after having been invited by other members or staff",
          ... later ... and enable  (6KWU20) above.
        });

        Setting2(props, { type: 'checkbox', label: "Allow new registrations",
          className: 'e_A_Ss_S-AllowSignupCB',
          help: "Uncheck to prevent people from creating new accounts and join this site.",
          getter: (s: Settings) => s.allowSignup,
          update: (newSettings: Settings, target) => {
            newSettings.allowSignup = target.checked;
            if (!target.checked) {
              if (valueOf(s => s.allowLocalSignup)) {
                newSettings.allowLocalSignup = false;
              }
              if (valueOf(s => s.allowGuestLogin)) {
                newSettings.allowGuestLogin = false;
              }
            }
          }
        }),

        Setting2(props, { type: 'checkbox', label: "Allow local registrations",
          className: 'e_A_Ss_S-AllowLoalSignupCB',
          help: "Uncheck to prevent people from createing email + password accounts at this site.",
          disabled: !valueOf(s => s.allowSignup),
          getter: (s: Settings) => s.allowLocalSignup,
          update: (newSettings: Settings, target) => {
            newSettings.allowLocalSignup = target.checked;
          }
        }), */

        Setting2(props, { type: 'checkbox', label: "Allow guest login", id: 'e2eAllowGuestsCB',
          className: 'e_A_Ss_S-AllowGuestsCB',
          help: "Lets people post comments and create topics, without specifying any " +
            "email address. They wouldn't be notified about replies, and " +
            "you cannot contact them. Usually not recommended.",
          disabled: !canEnableGuestLogin,
          getter: (s: Settings) => s.allowGuestLogin,
          update: (newSettings: Settings, target) => {
            newSettings.allowGuestLogin = target.checked;
          }
        })));
  }
});



const ModerationSettings = createFactory({
  displayName: 'ModerationSettings',

  render: function() {
    var props = this.props;
    var currentSettings: Settings = props.currentSettings;
    var editedSettings: Settings = props.editedSettings;

    var valueOf = (getter: (s: Settings) => any) =>
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
            var num = parseInt(target.value);
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
            var num = parseInt(target.value);
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
            var num = parseInt(target.value);
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
    var props = this.props;
    var currentSettings: Settings = props.currentSettings;
    var editedSettings: Settings = props.editedSettings;

    var valueOf = (getter: (s: Settings) => any) =>
      firstDefinedOf(getter(editedSettings), getter(currentSettings));

    var LargeNumber = 9999;

    return (
      r.div({},
        Setting2(props, { type: 'number', min: 0, max: LargeNumber,
          label: "Num flags to hide post",
          help: "If a post gets these many flags, it'll get hidden, automatically.",
          getter: (s: Settings) => s.numFlagsToHidePost,
          update: (newSettings: Settings, target) => {
            var num = parseInt(target.value);
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
            var num = parseInt(target.value);
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
            var num = parseInt(target.value);
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
            var num = parseInt(target.value);
            if (_.isNaN(num)) num = currentSettings.numFlaggersToBlockNewUser;
            if (num < 0) num = 0;
            if (num > LargeNumber) num = LargeNumber;
            newSettings.numFlaggersToBlockNewUser = num;
          }
        }),

        Setting2(props, { type: 'checkbox', min: 0, max: LargeNumber, indent: true,
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
            var num = parseFloat(target.value);
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
            var num = parseFloat(target.value);
            if (_.isNaN(num)) num = currentSettings.coreMemberFlagWeight;
            if (num < 0) num = 0;
            if (num > LargeNumber) num = LargeNumber;
            newSettings.coreMemberFlagWeight = num;
          }
        })
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
`<script>edCommentsServerUrl='${location.origin}';</script>
<script async defer src="${assetsOrigin()}/-/ed-comments.v0${dotMin}.js"></script>
<!-- You can specify a per page discussion id on the next line, if your URLs might change. -->
<div class="ed-comments" data-discussion-id="" style="margin-top: 45px;">
<noscript>Please enable Javascript to view comments.</noscript>
<p style="margin-top: 25px; opacity: 0.9; font-size: 96%">Comments powered by
<a href="https://www.effectivediscussions.org">Effective Discussions</a>.</p>
</div>`),
          r.p({ className: 's_A_Ss_EmbCmts_Plugins' },
            "Or, if you use ", r.b({}, "Gatsby"), " (a static website generator), there's ",
            r.a({ href: 'https://www.npmjs.com/package/gatsby-plugin-ed-comments' },
              "this plugin for you.")),
          r.p({}, "Thereafter, try adding a comment, over at your website — should work now."));

    return (
      r.div({},
        Setting2(props, { type: 'text', label: "Allow embedding from", id: 'e_AllowEmbFrom',
          help: r.span({}, "Lets another website (your website) show embedded contents. " +
            "You can add many domains — separate them with spaces."),
          placeholder: "https://www.yourblog.com",
          getter: (s: Settings) => s.allowEmbeddingFrom,
          update: (newSettings: Settings, target) => {
            newSettings.allowEmbeddingFrom = target.value;
          }
        }),
        anyInstructions));
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
          Button({ onClick: openHostnameEditor }, "Change address ...")));

    const duplicatingHostsFormGroup = duplicateHostnames.length === 0 ? null :
      r.div({ className: 'form-group has-error' },
        r.label({ className: 'control-label col-sm-3' }, "Duplicate addresses"),
        r.div({ className: 'col-sm-9 esA_Ss_S-Hostnames esAdmin_settings_setting' },
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
            : Button({ onClick: this.redirectExtraHostnames }, RedirectButtonTitle)));

    const redirectingHostsFormGroup = redirectingHostnames.length === 0 ? null :
      r.div({ className: 'form-group' },
        r.label({ className: 'control-label col-sm-3' }, "Redirecting addresses"),
        r.div({ className: 'col-sm-9 esA_Ss_S-Hostnames esAdmin_settings_setting' },
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

        r.hr(),
        changeHostnameFormGroup,
        duplicatingHostsFormGroup,
        redirectingHostsFormGroup));

  }
});



const LegalSettings = createFactory({
  displayName: 'LegalSettings',

  render: function() {
    var props = this.props;
    var currentSettings: Settings = props.currentSettings;
    var editedSettings: Settings = props.editedSettings;

    var valueOf = (getter: (s: Settings) => any) =>
      firstDefinedOf(getter(editedSettings), getter(currentSettings));

    var termsOfUseLink = r.a({ href: '/-/terms-of-use', target: '_blank' },
      'Terms of Use');

    var userContentTermsLink = r.a({ href: '/-/terms-of-use#3', target: '_blank' },
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
    let props = this.props;
    return (
      r.div({},
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
        })));
  }
});



const CustomizeHtmlPanel = createFactory({
  displayName: 'CustomizeHtmlPanel',

  render: function() {
    const props = this.props;
    return (
      r.div({ className: 'form-horizontal esAdmin_customize' },
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
        // But enable on www.effectivediscussions.org — it already uses this.
        Setting2(props, { type: 'textarea', label: "Social links HTML",
          help: "Google+, Facebook, Twitter like and share buttons. Don't forget " +
            "to include a script too, e.g. in the <i>Scripts HTML</i> config value. " +
            "— Perhaps I'll remove this config value in the future, so you might " +
            "be better off not using it.",
          getter: (s: Settings) => s.socialLinksHtml,
          update: (newSettings: Settings, target) => {
            newSettings.socialLinksHtml= target.value;
          }
        })));
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


function Setting2(panelProps, props, anyChildren?) {
  var editedSettings = panelProps.editedSettings;
  var currentSettings = panelProps.currentSettings;
  var defaultSettings = panelProps.defaultSettings;

  var editedValue = props.getter(editedSettings);
  var currentValue = props.getter(currentSettings);

  dieIf(props.onChange, 'EsE3GUK02');
  dieIf(!props.update, 'EsE22PYK5');
  dieIf(props.value, 'EsE6JY2F4');

  var valueOf = (getter: (s: Settings) => any) =>
    firstDefinedOf(getter(editedSettings), getter(currentSettings));

  props.value = firstDefinedOf(editedValue, currentValue);
  props.className = props.className || '';
  props.className += ' s_A_Ss_S';
  props.wrapperClassName = 'col-sm-9 esAdmin_settings_setting';

  if (isDefined2(editedValue)) props.wrapperClassName += ' esAdmin_settings_setting-unsaved';
  if (props.disabled) props.wrapperClassName += ' disabled';

  if (props.type === 'checkbox') {
    props.labelFirst = true;
    props.labelClassName = 'col-sm-3';
    props.checked = props.value;
    delete props.value;
  }
  else {
    props.labelClassName = 'col-sm-3';
  }

  props.onChange = (event) => {
    var newSettings = _.clone(editedSettings);
    props.update(newSettings, event.target);
    panelProps.removeUnchangedSettings(newSettings);
    panelProps.setEditedSettings(newSettings);
  };

  // ----- Reset and undo buttons

  var field = props.type === 'checkbox' ? 'checked' : 'value';
  var event = { target: {} };

  var undoChangesButton;
  if (isDefined2(editedValue)) {
    undoChangesButton = Button({ className: 'col-sm-offset-3 esAdmin_settings_setting_btn',
      disabled: props.disabled, onClick: () => {
        event.target[field] = currentValue;
        props.onChange(event);
      }}, "Undo changes");
  }

  // Show the Reset button only if there's no Undo button — both at the same time looks confusing.
  var resetToDefaultButton;
  var defaultValue = props.getter(defaultSettings);
  if (!undoChangesButton && valueOf(props.getter) !== defaultValue && props.canReset !== false) {
    resetToDefaultButton = Button({ className: 'col-sm-offset-3 esAdmin_settings_setting_btn',
      disabled: props.disabled, onClick: () => {
        event.target[field] = defaultValue;
        props.onChange(event);
      }}, "Reset to default");
  }

  return (
    r.div({},
      Input(props, anyChildren),
      resetToDefaultButton,
      undoChangesButton));
}


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
