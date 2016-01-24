/*
 * Copyright (C) 2015 Kaj Magnus Lindberg
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

var ReactRouter = window['ReactRouter'];
var Route = reactCreateFactory(ReactRouter.Route);
var Redirect = reactCreateFactory(ReactRouter.Redirect);
var DefaultRoute = reactCreateFactory(ReactRouter.DefaultRoute);
var NotFoundRoute = reactCreateFactory(ReactRouter.NotFoundRoute);
var RouteHandler = reactCreateFactory(ReactRouter.RouteHandler);
var RouterNavigationMixin = ReactRouter.Navigation;
var RouterStateMixin = ReactRouter.State;


export function routes() {
  // Later on, when there's a Dashboard tab, could use that one as the default instead.
  var defaultRouteName = debiki2.ReactStore.getUser().isAdmin ? 'settings' : 'review';
  return Route({ path: '/', handler: AdminAppComponent },
    Redirect({ from: '/', to: defaultRouteName }),
    Redirect({ from: '/users', to: 'users-active' }),
    Redirect({ from: '/review', to: 'review-all' }),
    Route({ name: 'settings', path: 'settings', handler: SettingsPanelComponent }),
    Route({ name: 'users', path: 'users', handler: UsersTabComponent },
      Route({ name: 'users-active', path: 'active', handler: ActiveUsersPanelComponent }),
      Route({ name: 'users-new', path: 'new', handler: NewUsersPanelComponent }),
      Route({ name: 'users-staff', path: 'staff', handler: NotYetImplementedComponent }),
      Route({ name: 'users-suspended', path: 'suspended', handler: NotYetImplementedComponent }),
      Route({ name: 'users-threats', path: 'threads', handler: NotYetImplementedComponent }),
      Route({ name: 'users-one', path: 'id/:userId', handler: AdminUserPageComponent })),
    Route({ name: 'customize', path: 'customize', handler: CustomizePanelComponent }),
    Route({ name: 'review', path: 'review', handler: ReviewPanelComponent },
      Route({ name: 'review-all', path: 'all', handler: ReviewAllPanelComponent }),
      // Remove later:
      Route({ name: 'review-posts', path: 'posts', handler: ReviewPostsPanelComponent })));
}



var NotYetImplementedComponent = React.createClass({
  render: function() {
    return (
      r.p({}, 'Not yet implemented.'));
  }
});



var AdminAppComponent = React.createClass({
  mixins: [RouterNavigationMixin, RouterStateMixin, debiki2.StoreListenerMixin],

  getInitialState: function() {
    return {
      loggedInUser: debiki2.ReactStore.getUser(),
      activeRoute: this.getRoutes()[1].name
    };
  },

  onChange: function() {
    this.setState({
      loggedInUser: debiki2.ReactStore.getUser()
    });
  },

  handleSelect: function(newRoute) {
    this.setState({ activeRoute: newRoute });
    this.transitionTo(newRoute);
  },

  render: function() {
    var loggedInUser = this.state.loggedInUser;
    if (!loggedInUser)
      return r.p({}, 'Not logged in');

    var settings = loggedInUser.isAdmin ?
        NavItem({ eventKey: 'settings' }, 'Settings') : null;

    var customize = loggedInUser.isAdmin ?
        NavItem({ eventKey: 'customize' }, 'Customize') : null;

    return (
      r.div({ className: 'esAdminArea' },
        reactelements.TopBar({ customTitle: "Admin Area", showBackToSite: true, extraMargin: true }),
        r.div({ className: 'container' },
        Nav({ bsStyle: 'pills', activeKey: this.state.activeRoute, onSelect: this.handleSelect,
            className: 'dw-main-nav' },
          settings,
          NavItem({ eventKey: 'users' }, 'Users'),
          customize,
          NavItem({ eventKey: 'review' }, 'Review')),
        RouteHandler({ loggedInUser: this.state.loggedInUser }))));
  }
});



var SettingsPanelComponent = React.createClass({
  mixins: [SaveSettingMixin],

  componentDidMount: function() {
    Server.loadSettings('WholeSite', null, settings => {
      this.setState(settings);
    });
  },

  render: function() {
    if (!this.state)
      return r.p({}, 'Loading...');

    var settings = this.state;
    var saveSetting = this.saveSetting;
    var termsOfUseLink = r.a({ href: '/-/terms-of-use', target: '_blank' },
        'Terms of Use');

    return (
      r.div({},
        Setting({ setting: settings.userMustBeAuthenticated, onSave: saveSetting, label: 'Login required',
          help: 'Require authentication to read content. (Users must then login' +
            'with password or via e.g. Google or Facebook, but anonymous ' +
            'access is disabled.)' }),

        Setting({ setting: settings.userMustBeApproved, onSave: saveSetting, label: 'Approve users',
          help: 'Staff must approve all new user accounts before they are allowed to access the site.' }),
          // help text above copyright Discourse

        Setting({ setting: settings.title, onSave: saveSetting, label: 'Title',
          help: 'The site title, will be used in the title tag and elsewhere.' }),

        Setting({ setting: settings.description, onSave: saveSetting,
          label: 'Description', help: 'A one sentence description of the website. ' +
              'Will be used in the meta description tag.' }),

        Setting({ setting: settings.googleUniversalAnalyticsTrackingId,
          onSave: saveSetting, label: 'Google Universal Analytics tracking ID',
          help: r.span({}, 'Any Google Universal Analytics tracking ID, e.g. ',
              r.samp({}, 'UA-12345678-9'), ', see http://google.com/analytics.') }),

        Setting({ setting: settings.companyFullName, onSave: saveSetting,
          label: 'company_full_name', help: r.span({}, "The full name of the company " +
              "or organization that runs this site. Used in legal documents " +
              "like the ", termsOfUseLink, " page."),
          placeholder: "Unnamed Company Full Name" }),

        Setting({ setting: settings.companyShortName, onSave: saveSetting,
          label: 'company_short_name', help: r.span({}, "The short name of the company " +
              "or organization that runs this site. Used in legal documents " +
              "like the ", termsOfUseLink, " page."),
          placeholder: "Unnamed Company" }),

        Setting({ setting: settings.companyDomain, onSave: saveSetting,
          label: 'company_domain', help: r.span({}, "The domain name owned by the company " +
              "that runs this site. Used in legal documents like the ", termsOfUseLink, "."),
          placeholder: "www.example.com" }),

        SpecialContent({ contentId: '_tou_content_license',
            label: 'Terms of Use: Content License',
            help: r.span({}, "Please clarify under which license other people may reuse " +
                "the contents of the website. This text will be inserted into " +
                "the Content License section of your ", termsOfUseLink, " page. " +
                "By default, content is licensed under a Creative Commonts license " +
                "(see below) so you can just leave this as is.") })));

        /* Hide this. It's a bad idea to allow each site to use its own jurisdiction?
        SpecialContent({ contentId: '_tou_jurisdiction',
            label: 'Terms of Use: Jurisdiction',
            help: r.span({}, "Please clarify which country's laws you want to abide by, " +
                "and where any legal issues should be resolved. This text is inserted " +
                "into the Jurisdiction section of your ", termsOfUseLink, " page.") })));
        */
  }
});



var CustomizePanelComponent = React.createClass({
  mixins: [SaveSettingMixin],

  componentDidMount: function() {
    Server.loadSettings('WholeSite', null, settings => {
      this.setState(settings);
    });
  },

  render: function() {
    if (!this.state)
      return r.p({}, 'Loading...');

    var settings = this.state;
    var saveSetting = this.saveSetting;

    return (
      r.div({},
        Setting({ setting: settings.showForumCategories, onSave: saveSetting,
          label: 'Show Forum Categories', help: "Shall a forum main page list " +
            "all forum categories, instead of the latest topics?" }),

        Setting({ setting: settings.horizontalComments, onSave: saveSetting,
          label: '2D Tree Layout', help: "Shall comments be laid out in a two " +
            "dimensional tree? By default, they're shown in a single column instead." }),

        Setting({ setting: settings.headerHtml, onSave: saveSetting, label: 'Header HTML',
          multiline: true, help: 'Any header, will be shown at the top of the page.' }),

        Setting({ setting: settings.footerHtml, onSave: saveSetting, label: 'Footer HTML',
          multiline: true, help: 'Any footer, shown at the bottom of the page.' }),

        Setting({ setting: settings.headStylesHtml, onSave: saveSetting, label: 'Styles HTML',
          multiline: true, help: 'Stylesheet link tags that will be inserted after ' +
              'other stylesheet tags in the <head> tag.' }),

        Setting({ setting: settings.headScriptsHtml, onSave: saveSetting, label: 'Scripts HTML',
          multiline: true, help: 'Script tags that will be inserted after other ' +
              'scripts in the <head> tag.' }),

        Setting({ setting: settings.endOfBodyHtml, onSave: saveSetting, label: '</body> HTML',
          multiline: true, help: 'Tags that will be inserted just before ' +
              'the end of the <body> tag.' }),

        Setting({ setting: settings.socialLinksHtml, onSave: saveSetting,
          label: 'Social links HTML', multiline: true,
          help: "Google+, Facebook, Twitter like and share buttons. Don't forget " +
              "to include a script too, e.g. in the <i>Scripts HTML</i> config value. " +
              "— Perhaps I'll remove this config value in the future, so you might " +
              "be better off not using it." }),

        SpecialContent({ contentId: '_stylesheet', label: 'Stylesheet',
            help: "CSS for this site. CSS means Cascading Style Sheets and " +
                "you use it to describe the look and formatting of this site." })));
  }
});


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
