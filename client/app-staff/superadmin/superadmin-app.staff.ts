/*
 * Copyright (c) 2016-2018 Kaj Magnus Lindberg
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
//xx <reference path="../../typedefs/moment/moment.d.ts" /> — disappeared
declare var moment: any;

//------------------------------------------------------------------------------
   namespace debiki2.superadmin {
//------------------------------------------------------------------------------

const r = ReactDOMFactories;
const SuperAdminRoot = '/-/superadmin/';


export function routes() {
  return r.div({},
    Route({ path: SuperAdminRoot, component: AdminAppComponent }));
}



const AdminAppComponent = createReactClass(<any> {
  displayName: 'AdminAppComponent',
  mixins: [debiki2.StoreListenerMixin],

  getInitialState: function() {
    return {
      store: debiki2.ReactStore.allData(),
    };
  },

  componentDidMount: function() {
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
        Route({ path: SuperAdminRoot, render: () => DashboardPanel({ store }) })));
  }
});


const DashboardPanel = createFactory({
  displayName: 'DashboardPanel',

  render: function() {
    const store: Store = this.props.store;
    const stuff: SuperAdminStuff = store.superadmin;
    if (!stuff)
      return r.p({}, "Loading ...");

    const sites = stuff.sites.map((site: SASite) =>
        SiteTableRow({ key: site.id, site: site, superAdminStuff: stuff }));

    return (
      r.div({},
        r.h2({}, "All sites"),
        r.table({ className: 'table' },
          r.thead({},
            r.tr({},
              r.th({}, "ID"),
              r.th({}, "Status"),
              r.th({}, "Address, admins, etc"))),
          r.tbody({},
            sites))));
  }
});


const SiteTableRow = createComponent({
  displayName: 'SiteTableRow',

  changeStatus: function(newStatus: SiteStatus) {
    const site: SASite = _.clone(this.props.site);
    site.status = newStatus;
    Server.updateSites([site]);
  },

  render: function() {
    const stuff: SuperAdminStuff = this.props.superAdminStuff;
    const site: SASite = this.props.site;

    const makeButton = (className: string, title: string, newStatus: SiteStatus,
            opts: { disabled?: boolean } = {}) =>
      Button({ ...opts, className: className + ' s_SA_StatusB',
          onClick: () => opts.disabled ? undefined : this.changeStatus(newStatus) },
        title);

    const hideButton = site.status > SiteStatus.Active ? null :
        makeButton('s_SA_StatusB-Hide', "Hide unless staff", SiteStatus.HiddenUnlessStaff);

    const reactivateButton = site.status !== SiteStatus.HiddenUnlessStaff ? null :
        makeButton('', "Activate again", SiteStatus.Active);

    const deleteButton = site.status !== SiteStatus.HiddenUnlessStaff ? null :
        makeButton('', "Delete (can undo)", SiteStatus.Deleted);

    const undeleteButton = site.status !== SiteStatus.Deleted ? null :
        makeButton('', "Undelete", SiteStatus.HiddenUnlessStaff);

    const purgeButton = site.status !== SiteStatus.Deleted ? null :
        makeButton('', "Purge (can NOT undo)", SiteStatus.Purged, { disabled: true });

    let canonHostname = site.canonicalHostname;
    if (!canonHostname && site.id === FirstSiteId) {
      canonHostname = stuff.firstSiteHostname;
    }

    // (Don't show a login button for the superadmin site itself, because already logged in.)
    const loginButton = site.id === eds.siteId
        ? r.span({ className: 'esSA_ThisSite' }, "(this site)")
        : LinkButton({ className: 'esSA_LoginB',
            // Stop using the System user? It should only do things based on Talkyard's source code,
            // never be controlled by a human.  But use which other user, instead?  [SYS0LGI]
              href: Server.makeImpersonateAtOtherSiteUrl(site.id, SystemUserId) },
            "Super admin");

    const createdAtStr = moment(site.createdAtMs).toISOString().replace('T', ' ');

    const oldHostnames = _.filter(site.hostnames, h => h != canonHostname);
    const anyOldHostnames = !oldHostnames.length ? null :
        r.div({},
          r.p({}, "Old hostnames:"),
          r.ul({},
            oldHostnames.map(h => r.li({ key: h }, h))));

    const staffUsers = !site.staffUsers.length ? null :
        r.div({},
          r.ul({},
            site.staffUsers.map(staffUser => {
              const admOrMod = staffUser.isAdmin ? 'admin' : 'moderator';
              return r.li({ key: staffUser.username },
                `${admOrMod} @${staffUser.username}, ${staffUser.email}, ${staffUser.fullName}`)
            })));

    return (
      r.tr({},
        r.td({},
          r.a({ href: '//site-' + site.id + '.' + stuff.baseDomain }, site.id)),
        r.td({},
          siteStatusToString(site.status),
          hideButton,
          reactivateButton,
          deleteButton,
          undeleteButton,
          purgeButton),
        r.td({},
          r.div({},
            r.a({ href: '//' + canonHostname }, canonHostname),
            loginButton,
            createdAtStr),
          anyOldHostnames,
          staffUsers)));
  }
});

//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
