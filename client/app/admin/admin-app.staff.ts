/*
 * Copyright (c) 2015-2016 Kaj Magnus Lindberg
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
/// <reference path="../more-bundle-already-loaded.d.ts" />
/// <reference path="review.staff.ts" />
/// <reference path="review-all.staff.ts" />
/// <reference path="review-posts.staff.ts" />
/// <reference path="users.staff.ts" />
/// <reference path="users-one.staff.ts" />

//------------------------------------------------------------------------------
   module debiki2.admin {
//------------------------------------------------------------------------------

var r = React.DOM;
var ReactBootstrap: any = window['ReactBootstrap'];
var Nav = reactCreateFactory(ReactBootstrap.Nav);
var NavItem = reactCreateFactory(ReactBootstrap.NavItem);
var TabbedArea = reactCreateFactory(ReactBootstrap.TabbedArea);
var TabPane = reactCreateFactory(ReactBootstrap.TabPane);
var Alert = reactCreateFactory(ReactBootstrap.Alert);

var ReactRouter = window['ReactRouter'];
var Route = reactCreateFactory(ReactRouter.Route);
var Redirect = reactCreateFactory(ReactRouter.Redirect);
var PageUnloadAlerter = utils.PageUnloadAlerter;


var AdminRoot = '/-/admin/';

// Make the components async? So works also if more-bundle.js hasn't yet been loaded? [4WP7GU5]
export function routes() {
  return [
    Redirect({ key: 'redir', from: AdminRoot, to: AdminRoot + 'settings' }), // later: --> /dashboard
    Route({ key: 'routes', path: AdminRoot, component: AdminAppComponent },
      Redirect({ from: 'users', to: AdminRoot + 'users/enabled' }),
      Redirect({ from: 'review', to: AdminRoot + 'review/all' }),
      Redirect({ from: 'settings', to: AdminRoot + 'settings/legal' }),
      Route({ path: 'settings', component: SettingsPanelComponent },
        Route({ path: 'legal', component: LegalSettingsComponent }),
        Route({ path: 'login', component: LoginSettingsComponent }),
        Route({ path: 'moderation', component: ModerationSettingsComponent }),
        Route({ path: 'spam-flags', component: SpamFlagsSettingsComponent }),
        Route({ path: 'analytics', component: AnalyticsSettingsComponent }),
        Route({ path: 'advanced', component: AdvancedSettingsComponent }),
        Route({ path: 'experimental', component: ExperimentalSettingsComponent })),
      Route({ path: 'users', component: UsersTabComponent },
        Route({ path: 'enabled', component: ActiveUsersPanelComponent }),
        Route({ path: 'new', component: NewUsersPanelComponent }),
        Route({ path: 'invited', component: InvitedUsersPanelComponent }),
        Route({ path: 'staff', component: NotYetImplementedComponent }),
        Route({ path: 'suspended', component: NotYetImplementedComponent }),
        Route({ path: 'threats', component: NotYetImplementedComponent }),
        Route({ path: 'id/:userId', component: AdminUserPageComponent })),
      Route({ path: 'customize', component: CustomizePanelComponent }),
      Route({ path: 'review', component: ReviewPanelComponent },
        Route({ path: 'all', component: ReviewAllPanelComponent })))];
}



var NotYetImplementedComponent = React.createClass(<any> {
  displayName: 'NotYetImplementedComponent',
  render: function() {
    return (
      r.p({}, 'Not yet implemented. [EsM4GPY72]'));
  }
});



var AdminAppComponent = React.createClass(<any> {
  mixins: [debiki2.StoreListenerMixin],
  // mixins: [PageUnloadAlerter.AlertIfLeavingRouteMixin], SHOULD make Alert... work again

  contextTypes: {
    router: React.PropTypes.object.isRequired
  },

  getInitialState: function() {
    return {
      loggedInUser: debiki2.ReactStore.getUser(),
      activeRoute: this.props.routes[1].path,  // try to remove?
      defaultSettings: null,
      currentSettings: null,
      editedSettings: null,
    };
  },

  onChange: function() {
    this.setState({
      loggedInUser: debiki2.ReactStore.getUser()
    });
  },

  selectNewTab: function(newRoute) {
    this.setState({ activeRoute: newRoute });
    this.context.router.push(AdminRoot + newRoute);
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
    var loggedInUser = this.state.loggedInUser;
    if (!loggedInUser)
      return r.p({}, 'Not logged in');

    var settings = loggedInUser.isAdmin ?
        NavItem({ eventKey: 'settings' }, 'Settings') : null;

    var customize = loggedInUser.isAdmin ?
        NavItem({ eventKey: 'customize' }, 'Customize') : null;

    var saveBar = _.isEmpty(this.state.editedSettings) ? null :
      r.div({ className: 'esA_SaveBar' },
        r.div({ className: 'container' },
          PrimaryButton({ onClick: this.saveSettings,
            className: 'esA_SaveBar_SaveAllB' }, "Save all changes" ),
          Button({ onClick: this.undoSettings,
            className: 'esA_SaveBar_UndoAllB' }, "Undo all changes" )));

    return (
      r.div({ className: 'esAdminArea' },
        reactelements.TopBar({ customTitle: "Admin Area", showBackToSite: true, extraMargin: true }),
        r.div({ className: 'container' },
        Nav({ bsStyle: 'pills', activeKey: this.state.activeRoute, onSelect: this.selectNewTab,
            className: 'dw-main-nav' },
          settings,
          NavItem({ eventKey: 'users' }, 'Users'),
          customize,
          NavItem({ eventKey: 'review' }, 'Review')),
        React.cloneElement(this.props.children, {
          loggedInUser: this.state.loggedInUser,
          loadAllSettingsIfNeeded: this.loadAllSettingsIfNeeded,
          defaultSettings: this.state.defaultSettings,
          currentSettings: this.state.currentSettings,
          editedSettings: this.state.editedSettings,
          hosts: this.state.hosts,
          removeUnchangedSettings: this.removeUnchangedSettings,
          setEditedSettings: this.setEditedSettings,
        }),

        saveBar)));
  }
});



var SettingsPanelComponent = React.createClass(<any> {
  componentDidMount: function() {
    this.props.loadAllSettingsIfNeeded();
  },

  render: function() {
    var props = this.props;
    if (!props.currentSettings)
      return r.p({}, 'Loading...');

    return (
      r.div({ className: 'esA_Ss' },
        r.ul({ className: 'esAdmin_settings_nav col-sm-2 nav nav-pills nav-stacked' },
          NavLink({ to: AdminRoot + 'settings/legal', id: 'e2eAA_Ss_LegalL' }, "Legal"),
          NavLink({ to: AdminRoot + 'settings/login', id: 'e2eAA_Ss_LoginL' }, "Login"),
          NavLink({ to: AdminRoot + 'settings/moderation', id: 'e2eAA_Ss_ModL'  }, "Moderation"),
          NavLink({ to: AdminRoot + 'settings/spam-flags', id: 'e2eAA_Ss_SpamFlagsL'  }, "Spam & flags"),
          NavLink({ to: AdminRoot + 'settings/analytics', id: 'e2eAA_Ss_AnalyticsL' }, "Analytics"),
          NavLink({ to: AdminRoot + 'settings/advanced', id: 'e2eAA_Ss_AdvancedL' }, "Advanced"),
          NavLink({ to: AdminRoot + 'settings/experimental', id: 'e2eAA_Ss_ExpL' }, "Experimental")),
        r.div({ className: 'form-horizontal esAdmin_settings col-sm-10' },
          React.cloneElement(this.props.children, this.props))));
  }
});



var LoginSettingsComponent = React.createClass(<any> {
  render: function() {
    var props = this.props;
    var currentSettings: Settings = props.currentSettings;
    var editedSettings: Settings = props.editedSettings;

    var valueOf = (getter: (s: Settings) => any) =>
      firstDefinedOf(getter(editedSettings), getter(currentSettings));

    var canEnableGuestLogin =
      !valueOf(s => s.userMustBeApproved) && !valueOf(s => s.userMustBeAuthenticated) &&
        valueOf(s => s.allowSignup);  // && !invite-only (6KWU20)

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
            }
          }
        }),

        Setting2(props, { type: 'checkbox', label: "Approve users", id: 'e2eApproveUsersCB',
          className: 'e_A_Ss_S-ApproveUsersCB',
          help: "New user need to be approved by staff before they can access the site.",
          getter: (s: Settings) => s.userMustBeApproved,
          update: (newSettings: Settings, target) => {
            newSettings.userMustBeApproved = target.checked;
            if (target.checked && valueOf(s => s.allowGuestLogin)) {
              newSettings.allowGuestLogin = false;
            }
          }
        }),

        /* Not yet implemented: (saved to db but won't have any effect)

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



var ModerationSettingsComponent = React.createClass(<any> {
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



var SpamFlagsSettingsComponent = React.createClass(<any> {
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



var AnalyticsSettingsComponent = React.createClass(<any> {
  render: function() {
    var props = this.props;
    return (
      r.div({},
        Setting2(props, { type: 'text', label: "Google Universal Analytics tracking ID",
          help: r.span({}, "Any Google Universal Analytics tracking ID, e.g. ",
            r.samp({}, "UA-12345678-9"), ", see http://google.com/analytics."),
          getter: (s: Settings) => s.googleUniversalAnalyticsTrackingId,
          update: (newSettings: Settings, target) => {
            newSettings.googleUniversalAnalyticsTrackingId = target.value;
          }
        })));
  }
});



var AdvancedSettingsComponent = React.createClass(<any> {
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
    var host = _.find(this.props.hosts, (host: Host) => host.role == HostRole.Canonical);
    return host ? host.hostname : null;
  },

  render: function() {
    var props = this.props;
    var hosts: Host[] = props.hosts;
    var canonicalHostname = this.getCanonicalHostname();
    if (!canonicalHostname)
      return (
        r.p({},
          "No canonical host [EsM4KP0FYK2].", r.br(),
          "All hosts: " + JSON.stringify(hosts)));

    var RedirectButtonTitle = "Redirect old hostnames"; // dupl [5KFU2R0]
    var canonicalHostnameSamp = r.samp({}, canonicalHostname);
    var isDuplicate = location.hostname !== canonicalHostname;

    var duplicateHostnames =
      _.filter(hosts, (h: Host) => h.role == HostRole.Duplicate).map((h: Host) => h.hostname);
    var redirectingHostnames =
      _.filter(hosts, (h: Host) => h.role == HostRole.Redirect).map((h: Host) => h.hostname);

    var changeHostnameFormGroup =
      r.div({ className: 'form-group' },
        r.label({ className: 'control-label col-sm-3' }, "Hostname"),
        r.div({ className: 'col-sm-9 esA_Ss_S esAdmin_settings_setting' },
          location.protocol + "//", r.code({ className: 'esA_Ss_S_Hostname' }, canonicalHostname),
          r.div({ className: 'help-block' },
            "This is the address people type in the browser address bar to go to this forum."),
          Button({ onClick: openHostnameEditor }, "Change hostname ...")));

    var duplicatingHostsFormGroup = duplicateHostnames.length === 0 ? null :
      r.div({ className: 'form-group has-error' },
        r.label({ className: 'control-label col-sm-3' }, "Duplicating hostnames"),
        r.div({ className: 'col-sm-9 esA_Ss_S-Hostnames esAdmin_settings_setting' },
          r.pre({}, duplicateHostnames.join('\n')),
          r.span({ className: 'help-block' },
            "This forum is still accessible at the old hostnames listed above. " +
            "Search engines (like Google, Baidu, and Yandex) don't like that — they want your " +
            "forum to be accessible via ", r.i({}, "one"), " hostname only. You should " +
            "therefore ", r.i({}, "redirect"), " all the old hostnames to ",
            canonicalHostnameSamp, ':'),
          isDuplicate
            ? r.p({}, "Go to ",
                r.a({ href: linkToAdminPageAdvancedSettings(canonicalHostname), target: '_blank' },
                  canonicalHostname, r.span({ className: 'icon-link-ext' })),
                ", login, and click ", r.b({}, RedirectButtonTitle))
            : Button({ onClick: this.redirectExtraHostnames }, RedirectButtonTitle)));

    var redirectingHostsFormGroup = redirectingHostnames.length === 0 ? null :
      r.div({ className: 'form-group' },
        r.label({ className: 'control-label col-sm-3' }, "Redirecting hostnames"),
        r.div({ className: 'col-sm-9 esA_Ss_S-Hostnames esAdmin_settings_setting' },
          r.span({ className: 'help-block' }, "These old hostnames redirect to ",
            canonicalHostnameSamp, " (with status 302 Found):"),
          r.pre({}, redirectingHostnames.join('\n'))));

    return (
      r.div({},
        changeHostnameFormGroup,
        duplicatingHostsFormGroup,
        redirectingHostsFormGroup));

  }
});



var LegalSettingsComponent = React.createClass(<any> {
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



var ExperimentalSettingsComponent = React.createClass(<any> {
  render: function() {
    var props = this.props;
    return (
      r.div({},
        Setting2(props, { type: 'checkbox', label: "Experimental",
          help: "Enables some currently not-well-tested features " +
          "like Wiki MindMaps and custom HTML pages.",
          getter: (s: Settings) => s.showComplicatedStuff,
          update: (newSettings: Settings, target) => {
            newSettings.showComplicatedStuff = target.checked;
          }
        })));
  }
});



var CustomizePanelComponent = React.createClass(<any> {
  componentDidMount: function() {
    this.props.loadAllSettingsIfNeeded();
  },

  render: function() {
    var props = this.props;
    if (!props.currentSettings)
      return r.p({}, 'Loading...');

    return (
      r.div({ className: 'form-horizontal esAdmin_customize' },
        Alert({ bsStyle: 'info' },
          r.p({}, r.b({}, "Ignore everything below,"), " especially if you don't know HTML and CSS."),
          r.p({}, "We'll try to build something for you that's easier to use, later.")),

        /* People seem to not understand what this one does, so better reomve it.
            Make it an in-the-forum setting instead?
        Setting2(props, { type: 'checkbox', label: "Show Forum Categories",
          help: "Shall a forum main page list " +
            "all forum categories, instead of the latest topics?",
          getter: (s: Settings) => s.showForumCategories,
          update: (newSettings: Settings, target) => {
            newSettings.showForumCategories = target.checked;
          }
        }), */
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
        }),

        SpecialContent({ contentId: '_stylesheet', label: 'Stylesheet',
            help: "CSS for this site. CSS means Cascading Style Sheets and " +
                "you use it to describe the look and formatting of this site.",
            placeholder: ".selector { color: something }" })));
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
  props.wrapperClassName = 'col-sm-9 esAdmin_settings_setting';
  if (isDefined2(editedValue)) {
    props.wrapperClassName += ' esAdmin_settings_setting-unsaved'
  }
  if (props.disabled) {
    props.wrapperClassName += ' disabled';
  }
  if (props.type === 'checkbox') {
    // No separate label, so indent.
    props.wrapperClassName += ' col-xs-offset-3 esAdmin_settings_setting-checkbox';
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
    undoChangesButton = Button({ className: 'col-xs-offset-3 esAdmin_settings_setting_btn',
      disabled: props.disabled, onClick: () => {
        event.target[field] = currentValue;
        props.onChange(event);
      }}, "Undo changes");
  }

  // Show the Reset button only if there's no Undo button — both at the same time looks confusing.
  var resetToDefaultButton;
  var defaultValue = props.getter(defaultSettings);
  if (!undoChangesButton && valueOf(props.getter) !== defaultValue && props.canReset !== false) {
    resetToDefaultButton = Button({ className: 'col-xs-offset-3 esAdmin_settings_setting_btn',
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
