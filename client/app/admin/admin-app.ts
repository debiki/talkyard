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
/// <reference path="../utils/PageUnloadAlerter.ts" />
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

var ReactRouter = window['ReactRouter'];
var Route = reactCreateFactory(ReactRouter.Route);
var Redirect = reactCreateFactory(ReactRouter.Redirect);
var PageUnloadAlerter = utils.PageUnloadAlerter;


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

  contextTypes: {
    router: React.PropTypes.object.isRequired
  },

  getInitialState: function() {
    return {
      loggedInUser: debiki2.ReactStore.getUser(),
      activeRoute: this.props.routes[1].path,  // try to remove?
    };
  },

  onChange: function() {
    this.setState({
      loggedInUser: debiki2.ReactStore.getUser()
    });
  },

  handleSelect: function(newRoute) {
    this.setState({ activeRoute: newRoute });
    this.context.router.push(AdminRoot + newRoute);
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
        React.cloneElement(this.props.children, { loggedInUser: this.state.loggedInUser }))));
  }
});



var SettingsPanelComponent = React.createClass(<any> {
  mixins: [SaveSettingMixin, PageUnloadAlerter.AlertIfLeavingRouteMixin],

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
          help: r.span({}, "Require authentication to read content. Users must then login " +
            "with password or via ", r.i({}, "for example "), "Google or Facebook, but anonymous " +
            "access is disabled.)") }),

        Setting({ setting: settings.userMustBeApproved, onSave: saveSetting, label: 'Approve users',
          help: 'Staff must approve all new user accounts before they are allowed to access the site.' }),
          // help text above copyright Discourse

        Setting({ setting: settings.title, onSave: saveSetting, label: 'Title',
          help: 'The site title, will be used in the title tag and elsewhere.' }),

        Setting({ setting: settings.description, onSave: saveSetting,
          label: 'Description', help: 'A one sentence description of the website. ' +
              'Will be used in the meta description tag.' }),

        Setting({ setting: settings.numFirstPostsToReview, onSave: saveSetting,
          label: "Num first posts to review",
          help: "How many of a new member's first posts the staff will be notified about " +
              "so they can review them. The posts will become visible directly, before " +
              "they've been reviewed. " }),

        Setting({ setting: settings.numFirstPostsToApprove, onSave: saveSetting,
          label: "Num first posts to approve",
          help: "How many of a new member's first posts need to be approved by staff, " +
              "before they'll be shown. By default they'll be hidden, until approved. " +
              "Set to 0 to disable." }),

        Setting({ setting: settings.numFirstPostsToAllow, onSave: saveSetting,
          label: "Num first posts to allow",
          help: "How many posts a new member may post, before s/he has to wait until the " +
          "very first ones has been approved by staff." }),

        Setting({ setting: settings.googleUniversalAnalyticsTrackingId,
          onSave: saveSetting, label: 'Google Universal Analytics tracking ID',
          help: r.span({}, 'Any Google Universal Analytics tracking ID, e.g. ',
              r.samp({}, 'UA-12345678-9'), ', see http://google.com/analytics.') }),

        Setting({ setting: settings.companyFullName, onSave: saveSetting,
          label: 'company_full_name', help: r.span({}, "The full name of the company " +
              "or organization that runs this site. Used in legal documents " +
              "like the ", termsOfUseLink, " page."),
          placeholder: "Company Full Name" }),

        Setting({ setting: settings.companyShortName, onSave: saveSetting,
          label: 'company_short_name', help: r.span({}, "The short name of the company " +
              "or organization that runs this site. Used in legal documents " +
              "like the ", termsOfUseLink, " page."),
          placeholder: "Short Name" }),

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
                "(see below) so you can just leave this as is.") }),

        /* Hide this. It's a bad idea to allow each site to use its own jurisdiction?
        SpecialContent({ contentId: '_tou_jurisdiction',
            label: 'Terms of Use: Jurisdiction',
            help: r.span({}, "Please clarify which country's laws you want to abide by, " +
                "and where any legal issues should be resolved. This text is inserted " +
                "into the Jurisdiction section of your ", termsOfUseLink, " page.") })));
        */

        Setting({ setting: settings.showComplicatedStuff, onSave: saveSetting, label: "Experimental",
          help: "Enables some currently not-well-tested features " +
          "like Wiki MindMaps and custom HTML pages." }),

        Setting({ setting: settings.allowGuestLogin, onSave: saveSetting, label: "Allow guest login",
          help: "Lets people post comments and create topics, without specifying any " +
          "email address. They wouldn't be notified about replies, and " +
          "you cannot contact them. Not recommended."})));
  }
});



var CustomizePanelComponent = React.createClass(<any> {
  mixins: [SaveSettingMixin, PageUnloadAlerter.AlertIfLeavingRouteMixin],

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
        Alert({ bsStyle: 'info' },
          r.p({}, r.b({}, "Ignore everything below,"), " if you don't know HTML and CSS."),
          r.p({}, "We'll try to build something for you that's easier to use, later.")),

        Setting({ setting: settings.showForumCategories, onSave: saveSetting,
          label: 'Show Forum Categories', help: "Shall a forum main page list " +
            "all forum categories, instead of the latest topics?" }),

        /* A tester checked this without any idea about what it does.
          Remove for now, perhaps later show in some Advanced section?
        Setting({ setting: settings.horizontalComments, onSave: saveSetting,
          label: '2D Tree Layout', help: "Shall comments be laid out in a two " +
            "dimensional tree? By default, they're shown in a single column instead." }),
         */

        Setting({ setting: settings.headerHtml, onSave: saveSetting, label: 'Header HTML',
          multiline: true, help: "Any header, will be shown at the top of the page. " +
            "Currently you need to know HTML and CSS to be able to use this, unfortunately.",
          placeholder: "<div class=\"...\">...</div>"}),

        Setting({ setting: settings.footerHtml, onSave: saveSetting, label: 'Footer HTML',
          multiline: true, help: "Any footer, shown at the bottom of the page.",
          placeholder: "<footer class=\"...\">...</footer>"}),

        Setting({ setting: settings.headStylesHtml, onSave: saveSetting, label: 'Styles HTML',
          multiline: true, help: 'Stylesheet link tags that will be inserted after ' +
              "other stylesheet tags in the <head> tag.",
          placeholder: "<link rel=\"stylesheet\" href=\"...\"/>" }),

        Setting({ setting: settings.headScriptsHtml, onSave: saveSetting, label: 'Scripts HTML',
          multiline: true, help: 'Script tags that will be inserted after other ' +
              "scripts in the <head> tag.",
          placeholder: "<script>...</script>" }),

        Setting({ setting: settings.endOfBodyHtml, onSave: saveSetting, label: '</body> HTML',
          multiline: true, help: 'Tags that will be inserted just before ' +
              'the end of the <body> tag.' }),

        // Skip for now; don't want to clarify for people how this works. Needs a <script> too :-P
        // But enable on www.effectivediscussions.org — it already uses this.
        !IsEffectiveDiscussionsDotOrg ? null : Setting({ setting: settings.socialLinksHtml,
          onSave: saveSetting, label: "Social links HTML", multiline: true,
          help: "Google+, Facebook, Twitter like and share buttons. Don't forget " +
              "to include a script too, e.g. in the <i>Scripts HTML</i> config value. " +
              "— Perhaps I'll remove this config value in the future, so you might " +
              "be better off not using it." }),

        SpecialContent({ contentId: '_stylesheet', label: 'Stylesheet',
            help: "CSS for this site. CSS means Cascading Style Sheets and " +
                "you use it to describe the look and formatting of this site.",
            placeholder: ".selector { color: something }" })));
  }
});


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
