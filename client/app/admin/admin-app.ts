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
/// <reference path="../plain-old-javascript.d.ts" />
/// <reference path="../ReactStore.ts" />
/// <reference path="../Server.ts" />
/// <reference path="../topbar/topbar.ts" />
/// <reference path="../utils/PageUnloadAlerter.ts" />
/// <reference path="../utils/PatternInput.ts" />
/// <reference path="settings.ts" />
/// <reference path="review.ts" />
/// <reference path="review-all.ts" />
/// <reference path="review-posts.ts" />
/// <reference path="users.ts" />
/// <reference path="users-one.ts" />

//------------------------------------------------------------------------------
   module debiki2.admin {
//------------------------------------------------------------------------------

var d = { i: debiki.internal, u: debiki.v0.util };
var r = React.DOM;
var reactCreateFactory = React['createFactory'];

var ReactBootstrap: any = window['ReactBootstrap'];
var Nav = reactCreateFactory(ReactBootstrap.Nav);
var NavItem = reactCreateFactory(ReactBootstrap.NavItem);
var TabbedArea = reactCreateFactory(ReactBootstrap.TabbedArea);
var TabPane = reactCreateFactory(ReactBootstrap.TabPane);
var Button = reactCreateFactory(ReactBootstrap.Button);
var Alert = reactCreateFactory(ReactBootstrap.Alert);
var Input = reactCreateFactory(ReactBootstrap.Input);

var ReactRouter = window['ReactRouter'];
var Route = reactCreateFactory(ReactRouter.Route);
var Redirect = reactCreateFactory(ReactRouter.Redirect);
var PageUnloadAlerter = utils.PageUnloadAlerter;
var PatternInput = utils.PatternInput;


var AdminRoot = '/-/admin/';

export function routes() {
  return [
    Redirect({ key: 'redir', from: AdminRoot, to: AdminRoot + 'settings' }), // later: --> /dashboard
    Route({ key: 'routes', path: AdminRoot, component: AdminAppComponent },
      Redirect({ from: 'users', to: AdminRoot + 'users/active' }),
      Redirect({ from: 'review', to: AdminRoot + 'review/all' }),
      Route({ path: 'settings', component: SettingsPanelComponent }),
      Route({ path: 'users', component: UsersTabComponent },
        Route({ path: 'active', component: ActiveUsersPanelComponent }),
        Route({ path: 'new', component: NewUsersPanelComponent }),
        Route({ path: 'invited', component: InvitedUsersPanelComponent }),
        Route({ path: 'staff', component: NotYetImplementedComponent }),
        Route({ path: 'suspended', component: NotYetImplementedComponent }),
        Route({ path: 'threads', component: NotYetImplementedComponent }),
        Route({ path: 'id/:userId', component: AdminUserPageComponent })),
      Route({ path: 'customize', component: CustomizePanelComponent }),
      Route({ path: 'review', component: ReviewPanelComponent },
        Route({ path: 'all', component: ReviewAllPanelComponent }),
        // Remove later:
        Route({ path: 'posts', component: ReviewPostsPanelComponent })))];
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
        editedSettings: {},
      });
    });
  },

  // Quick hack that makes the settings area smaller so the savebar won't occlude its lower part.
  // Later: Use Redux, then the is-savebar-visible state will be accessible to whatever so it
  // can adjust the .esPageColumn in the React.js way.
  componentDidUpdate: function() {
    if (this.hasUnsavedSettings()) {
      $('#esPageColumn').css('bottom', $('.esAdmin_savebar').outerHeight());
    }
    else {
      $('#esPageColumn').css('bottom', 0);
    }
  },

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
      r.div({ className: 'esAdmin_savebar' },
        r.div({ className: 'container' },
          Button({ onClick: this.saveSettings, bsStyle: 'primary',
            className: 'esAdmin_savebar_saveBtn' }, "Save changes" ),
          Button({ onClick: this.undoSettings,
            className: 'esAdmin_savebar_undoBtn' }, "Undo changes" )));

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

    var currentSettings: Settings = props.currentSettings;
    var editedSettings: Settings = props.editedSettings;
    var termsOfUseLink = r.a({ href: '/-/terms-of-use', target: '_blank' },
        'Terms of Use');

    var valueOf = (getter: (s: Settings) => any) =>
      firstDefinedOf(getter(editedSettings), getter(currentSettings));

    var canEnableGuestLogin =
      !valueOf(s => s.userMustBeApproved) && !valueOf(s => s.userMustBeAuthenticated);

    return (
      r.div({ className: 'form-horizontal esAdmin_settings' },
        Setting2(props, { type: 'checkbox', label: 'Login required',
          help: r.span({}, "Require authentication to read content. Users must then login " +
            "with password or via ", r.i({}, "for example "), "Google or Facebook, but " +
            "anonymous access is disabled.)"),
          getter: (s: Settings) => s.userMustBeAuthenticated,
          update: (newSettings: Settings, target) => {
            newSettings.userMustBeAuthenticated = target.checked;
            if (target.checked && valueOf(s => s.allowGuestLogin)) {
              newSettings.allowGuestLogin = false;
            }
          }
        }),

        Setting2(props, { type: 'checkbox', label: "Approve users",
          help: "New user need to be approved by staff before they can access the site.",
          getter: (s: Settings) => s.userMustBeApproved,
          update: (newSettings: Settings, target) => {
            newSettings.userMustBeApproved = target.checked;
            if (target.checked && valueOf(s => s.allowGuestLogin)) {
              newSettings.allowGuestLogin = false;
            }
          }
        }),

        Setting2(props, { type: 'checkbox', label: "Allow guest login",
          help: "Lets people post comments and create topics, without specifying any " +
            "email address. They wouldn't be notified about replies, and " +
            "you cannot contact them. Not recommended.",
          disabled: !canEnableGuestLogin,
          getter: (s: Settings) => s.allowGuestLogin,
          update: (newSettings: Settings, target) => {
            newSettings.allowGuestLogin = target.checked;
          }
        }),

        Setting2(props, { type: 'number', label: "Num first posts to review",
          help: "How many of a new member's first posts the staff will be notified about " +
            "so they can review them. The posts will become visible directly, before " +
            "they've been reviewed.",
          getter: (s: Settings) => s.numFirstPostsToReview,
          update: (newSettings: Settings, target) => {
            var num = parseInt(target.value);
            if (_.isNaN(num)) num = currentSettings.numFirstPostsToReview;
            if (num < 0) num = 0;
            if (num > MaxNumFirstPosts) num = MaxNumFirstPosts;
            newSettings.numFirstPostsToReview = num;
          }
        }),

        Setting2(props, { type: 'number', label: "Num first posts to approve",
          help: "How many of a new member's first posts need to be approved by staff, " +
            "before they'll be shown. By default they'll be hidden, until approved. " +
            "Set to 0 to disable. Max is 10.",
          getter: (s: Settings) => s.numFirstPostsToApprove,
          update: (newSettings: Settings, target) => {
            var num = parseInt(target.value);
            if (_.isNaN(num)) num = currentSettings.numFirstPostsToApprove;
            if (num < 0) num = 0;
            if (num > MaxNumFirstPosts) num = MaxNumFirstPosts;
            newSettings.numFirstPostsToApprove = num;
            if (valueOf(s => s.numFirstPostsToAllow) < num) {
              newSettings.numFirstPostsToAllow = num;
            }
          },
        }),

        Setting2(props, { type: 'number', label: "Num first posts to allow",
          help: "How many posts a new member may post, before s/he has to wait until the " +
              "very first ones has been approved by staff.",
          getter: (s: Settings) => s.numFirstPostsToAllow,
          update: (newSettings: Settings, target) => {
            var num = parseInt(target.value);
            if (_.isNaN(num)) num = currentSettings.numFirstPostsToAllow;
            if (num < 0) num = 0;
            if (num > MaxNumFirstPosts) num = MaxNumFirstPosts;
            newSettings.numFirstPostsToAllow = num;
            if (valueOf(s => s.numFirstPostsToApprove) > num) {
              newSettings.numFirstPostsToApprove = num;
            }
          },
        }),

        Setting2(props, { type: 'text', label: "Google Universal Analytics tracking ID",
          help: r.span({}, "Any Google Universal Analytics tracking ID, e.g. ",
            r.samp({}, "UA-12345678-9"), ", see http://google.com/analytics."),
          getter: (s: Settings) => s.googleUniversalAnalyticsTrackingId,
          update: (newSettings: Settings, target) => {
            newSettings.googleUniversalAnalyticsTrackingId = target.value;
          }
        }),

        Setting2(props, { type: 'text', label: "company_full_name",
          help: r.span({}, "The full name of the company " +
            "or organization that runs this site. Used in legal documents " +
            "like the ", termsOfUseLink, " page."),
          getter: (s: Settings) => s.companyFullName,
          update: (newSettings: Settings, target) => {
            newSettings.companyFullName = target.value;
          }
        }),

        Setting2(props, { type: 'text', label: "company_short_name",
          help: r.span({}, "The short name of the company " +
            "or organization that runs this site. Used in legal documents " +
            "like the ", termsOfUseLink, " page."),
          getter: (s: Settings) => s.companyShortName,
          update: (newSettings: Settings, target) => {
            newSettings.companyShortName = target.value;
          }
        }),

        Setting2(props, { type: 'text', label: "company_domain",
          help: r.span({}, "The domain name owned by the company " +
            "that runs this site. Used in legal documents like the ", termsOfUseLink, "."),
          getter: (s: Settings) => s.companyDomain,
          update: (newSettings: Settings, target) => {
            newSettings.companyDomain = target.value;
          }
        }),

        SpecialContent({ contentId: '_tou_content_license',
            label: 'Terms of Use: Content License',
            help: r.span({}, "Please clarify under which license other people may reuse " +
                "the contents of the website. This text will be inserted into " +
                "the Content License section of your ", termsOfUseLink, " page. " +
                "By default, content is licensed under a Creative Commonts license " +
                "(see below) so you can just leave this as is.") }),

        /* Hide this. It's a bad idea to allow each site to use its own jurisdiction?
        SpecialContent({ contentId: '_tou_jurisdiction',
            label: 'Terms of Use: Jurisdiction',
            help: r.span({}, "Please clarify which country's laws you want to abide by, " +
                "and where any legal issues should be resolved. This text is inserted " +
                "into the Jurisdiction section of your ", termsOfUseLink, " page.") })));
       */

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
          r.p({}, r.b({}, "Ignore everything below,"), " if you don't know HTML and CSS."),
          r.p({}, "We'll try to build something for you that's easier to use, later.")),

        Setting2(props, { type: 'checkbox', label: "Show Forum Categories",
          help: "Shall a forum main page list " +
            "all forum categories, instead of the latest topics?",
          getter: (s: Settings) => s.showForumCategories,
          update: (newSettings: Settings, target) => {
            newSettings.showForumCategories = target.checked;
          }
        }),
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



function Setting2(panelProps, settingProps) {
  var editedSettings = panelProps.editedSettings;
  var currentSettings = panelProps.currentSettings;
  var defaultSettings = panelProps.defaultSettings;

  var editedValue = settingProps.getter(editedSettings);
  var currentValue = settingProps.getter(currentSettings);

  dieIf(settingProps.onChange, 'EsE3GUK02');
  dieIf(!settingProps.update, 'EsE22PYK5');
  dieIf(settingProps.value, 'EsE6JY2F4');

  var valueOf = (getter: (s: Settings) => any) =>
    firstDefinedOf(getter(editedSettings), getter(currentSettings));

  settingProps.value = firstDefinedOf(editedValue, currentValue);
  settingProps.wrapperClassName = 'col-sm-7 esAdmin_settings_setting';
  if (isDefined2(editedValue)) {
    settingProps.wrapperClassName += ' esAdmin_settings_setting-unsaved'
  }
  if (settingProps.disabled) {
    settingProps.wrapperClassName += ' disabled';
  }
  if (settingProps.type === 'checkbox') {
    // No separate label, so indent.
    settingProps.wrapperClassName += ' col-xs-offset-2 esAdmin_settings_setting-checkbox';
    settingProps.checked = settingProps.value;
    delete settingProps.value;
  }
  else {
    settingProps.labelClassName = 'col-sm-2';
  }
  settingProps.onChange = (event) => {
    var newSettings = _.clone(editedSettings);
    settingProps.update(newSettings, event.target);
    panelProps.removeUnchangedSettings(newSettings);
    panelProps.setEditedSettings(newSettings);
  };

  // ----- Reset and undo buttons

  var field = settingProps.type === 'checkbox' ? 'checked' : 'value';
  var event = { target: {} };

  var undoChangesButton;
  if (isDefined2(editedValue)) {
    undoChangesButton = Button({ className: 'col-xs-offset-2 esAdmin_settings_setting_btn',
      onClick: () => {
        event.target[field] = currentValue;
        settingProps.onChange(event);
      }}, "Undo changes");
  }

  // Show the Reset button only if there's no Undo button — both at the same time looks confusing.
  var resetToDefaultButton;
  var defaultValue = settingProps.getter(defaultSettings);
  if (!undoChangesButton && valueOf(settingProps.getter) !== defaultValue) {
    resetToDefaultButton = Button({ className: 'col-xs-offset-2 esAdmin_settings_setting_btn',
      onClick: () => {
        event.target[field] = defaultValue;
        settingProps.onChange(event);
      }}, "Reset to default");
  }

  return (
    r.div({},
      Input(settingProps),
      resetToDefaultButton,
      undoChangesButton));
}


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
