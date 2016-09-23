/*
 * Copyright (c) 2016 Kaj Magnus Lindberg
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

//------------------------------------------------------------------------------
   module debiki2.superadmin {
//------------------------------------------------------------------------------

var r = React.DOM;
var reactCreateFactory = React['createFactory'];

var ReactBootstrap: any = window['ReactBootstrap'];
var Nav = reactCreateFactory(ReactBootstrap.Nav);
var NavItem = reactCreateFactory(ReactBootstrap.NavItem);
var TabbedArea = reactCreateFactory(ReactBootstrap.TabbedArea);
var TabPane = reactCreateFactory(ReactBootstrap.TabPane);
var Alert = reactCreateFactory(ReactBootstrap.Alert);

var ReactRouter = window['ReactRouter'];
var Route = reactCreateFactory(ReactRouter.Route);
var Redirect = reactCreateFactory(ReactRouter.Redirect);


var SuperAdminRoot = '/-/superadmin/';

export function routes() {
  return [
    Redirect({ key: 'redir', from: SuperAdminRoot, to: SuperAdminRoot + '/dashboard' }),
    Route({ key: 'routes', path: SuperAdminRoot, component: AdminAppComponent },
      Route({ path: 'dashboard', component: DashboardPanelComponent }))];
}



var AdminAppComponent = React.createClass(<any> {
  mixins: [debiki2.StoreListenerMixin],

  contextTypes: {
    router: React.PropTypes.object.isRequired
  },

  getInitialState: function() {
    return {
      store: debiki2.ReactStore.allData(),
    };
  },

  componentWillMount: function() {
    Server.listSites();
  },

  onChange: function() {
    this.setState({
      store: debiki2.ReactStore.allData(),
    });
  },

  render: function() {
    return (
      r.div({ className: "container esSA" },
        React.cloneElement(this.props.children, { store: this.state.store })));
  }
});


var DashboardPanelComponent = React.createClass(<any> {
  render: function() {
    var store: Store = this.props.store;
    var stuff: SuperAdminStuff = store.superadmin;
    if (!stuff)
      return r.p({}, "Loading ...");

    var sites = stuff.sites.map(site => SiteTableRow({ site: site, superAdminStuff: stuff }));

    return (
      r.div({},
        r.h2({}, "All sites"),
        r.table({ className: "table" },
          r.thead({},
            r.tr({},
              r.th({}, "ID"),
              r.th({}, "Status"),
              r.th({}, "Address"),
              r.th({}, "Name"),
              r.th({}, "Created At"))),
          r.tbody({},
            sites))));
  }
});


var SiteTableRow = createComponent({
  changeStatus: function(newStatus: SiteStatus) {
    var site: SASite = _.clone(this.props.site);
    site.status = newStatus;
    Server.updateSites([site]);
  },

  loginAtSite: function() {
    var site: SASite = this.props.site;
    Server.makeImpersionateUserAtOtherSiteUrl(site.id, SystemUserId, (url) => {
      location.assign(url);
    });
  },

  render: function() {
    var stuff: SuperAdminStuff = this.props.superAdminStuff;
    var site: SASite = this.props.site;
    var newStatusButtonStatus: SiteStatus;
    var newStatusButtonText: string;
    if (site.status <= SiteStatus.Active) {
      newStatusButtonStatus = SiteStatus.HiddenUnlessStaff;
      newStatusButtonText = "Hide unless staff";
    }
    else {
      newStatusButtonStatus = SiteStatus.Active;
      newStatusButtonText = "Activate again";
    }
    var hostname = site.canonicalHostname;
    if (!hostname && site.id === FirstSiteId) {
      hostname = stuff.firstSiteHostname;
    }

    // (Don't show a login button for the superadmin site itself, because already logged in.)
    var loginButton = site.id === debiki.siteId
        ? r.span({ className: 'esSA_ThisSite' }, "(this site)")
        : Button({ className: 'esSA_LoginB', onClick: this.loginAtSite }, "Super admin");

    return (
      r.tr({},
        r.td({},
          r.a({ href: '//site-' + site.id + '.' + stuff.baseDomain }, site.id)),
        r.td({},
          siteStatusToString(site.status),
          Button({ className: 'esSA_StatusB',
              onClick: () => this.changeStatus(newStatusButtonStatus) },
            newStatusButtonText)),
        r.td({},
          r.a({ href: '//' + hostname }, hostname),
          loginButton),
        r.td({},
          site.name),
        r.td({},
          moment(site.createdAtMs).toISOString().replace('T', ' '))));
  }
});

//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
