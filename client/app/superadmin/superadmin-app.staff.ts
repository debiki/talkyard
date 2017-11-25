/*
 * Copyright (c) 2016, 2017 Kaj Magnus Lindberg
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

//------------------------------------------------------------------------------
   namespace debiki2.superadmin {
//------------------------------------------------------------------------------

const r = ReactDOMFactories;
const SuperAdminRoot = '/-/superadmin/';


export function routes() {
  return r.div({},
    Route({ path: '/', component: AdminAppComponent }));
}



const AdminAppComponent = createReactClass(<any> {
  displayName: 'AdminAppComponent',
  mixins: [debiki2.StoreListenerMixin],

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
    const store: Store = this.state.store;
    return (
      r.div({ className: 'container esSA' },
        Route({ path: SuperAdminRoot, render: () => DashboardPanelComponent({ store }) })));
  }
});


const DashboardPanelComponent = createFactory({
  displayName: 'DashboardPanelComponent',

  render: function() {
    var store: Store = this.props.store;
    var stuff: SuperAdminStuff = store.superadmin;
    if (!stuff)
      return r.p({}, "Loading ...");

    var sites = stuff.sites.map((site: SASite) =>
        SiteTableRow({ key: site.id, site: site, superAdminStuff: stuff }));

    return (
      r.div({},
        r.h2({}, "All sites"),
        r.table({ className: 'table' },
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
  displayName: 'SiteTableRow',

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
