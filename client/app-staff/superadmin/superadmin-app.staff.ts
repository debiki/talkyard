/*
 * Copyright (c) 2016-2020 Kaj Magnus Lindberg
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
/// <reference path="../admin/oop-method.staff.ts" />
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
        // [React_Router_v51] skip render(), use hooks and useParams instead.
        Route({ path: SuperAdminRoot, render: () => DashboardPanel({ store }) })));
  }
});


const DashboardPanel = createFactory({
  displayName: 'DashboardPanel',

  getInitialState: function() {
    return {
      numRows: 50,
      filter: '',
    };
  },

  render: function() {
    const store: Store = this.props.store;
    const numRows = this.state.numRows;
    const stuff: SuperAdminStuff = store.superadmin;
    if (!stuff)
      return r.p({}, "Loading ...");

    let filteredSites: SASite[] = [];

    const filterText: St = this.state.filter;
    if (filterText && filterText.length >= 2) {
      _.each(stuff.sites, (site: SASite) => {
        let show =
              _.some(site.hostnames, h => h.indexOf(filterText) >= 0) ||
              site.featureFlags.toLowerCase().indexOf(filterText) >= 0;
        show = show || _.some(site.staffUsers, (m: PatVb) =>
            m.email?.toLowerCase().indexOf(filterText) >= 0 ||
            m.username?.toLowerCase().indexOf(filterText) >= 0 ||
            m.fullName?.toLowerCase().indexOf(filterText) >= 0);
        if (show) {
          filteredSites.push(site);
        }
      });
    }
    else {
      filteredSites = stuff.sites;
    }

    const someSites =  _.take(filteredSites, numRows);
    const sitesToShow = someSites.map((site: SASite) =>
        SiteTableRow({ key: site.id, site: site, superAdminStuff: stuff }));

    const showMoreButton = filteredSites.length <= numRows ? null :
        Button({ onClick: () => this.setState({ numRows: numRows + 50 })},
          "Show more ...");

    const showAllButton = !showMoreButton ? null :
        Button({ onClick: () => this.setState({ numRows: 999999999 })},
          "Show all");

    const howMany =
        r.p({}, `There are ${stuff.sites.length} sites in total, incl both real and test.`);

    const filter =
        r.div({ className: 's_SA_Filter' },
          r.div({}, "Filter hostnames, staff names, emails, feature flags: (at least 2 chars)"),
          r.input({
            tabIndex: 1,
            value: this.state.filter,
            onChange: (event) => this.setState({
              filter: event.target.value.toLowerCase(),
            }),
          }));

    return (
      r.div({},
        r.h2({}, "All sites"),
        howMany,
        filter,
        r.table({ className: 'table' },
          r.thead({},
            r.tr({},
              r.th({}, "ID"),
              r.th({}, "Status"),
              r.th({}, "Address, admins, etc"))),
          r.tbody({},
            sitesToShow)),
        r.hr(),
        r.div({},
          howMany,
          showMoreButton,
          showAllButton)));
  }
});


interface SiteTableRowState {
  // Could wrap in SASitePatch object ----
  rdbQuotaMiBs: Nr | Nl;
  fileQuotaMiBs: Nr | Nl;
  readLimsMult: Nr | Nl;
  logLimsMult: Nr | Nl;
  createLimsMult: Nr | Nl;
  newNotes: St;
  newFeatureFlags: St;
  // -------------------------------------
  purgeAfterDaysInpVal: NrV;
}


const SiteTableRow = createComponent({
  displayName: 'SiteTableRow',

  getInitialState: function() {
    const site: SASite = this.props.site;
    const stuff: SuperAdminStuff = this.props.superAdminStuff;
    return {
      rdbQuotaMiBs: site.stats.rdbQuotaMiBs,
      fileQuotaMiBs: site.stats.fileQuotaMiBs,
      readLimsMult: site.readLimsMult,
      logLimsMult: site.logLimsMult,
      createLimsMult: site.createLimsMult,
      newNotes: site.superStaffNotes || '',
      newFeatureFlags: site.featureFlags,
      purgeAfterDaysInpVal: stuff.autoPurgeDelayDays,
    } as SiteTableRowState;
  },

  changeStatus: function(newStatus: SiteStatus) {
    const site: SASite = _.clone(this.props.site);
    site.status = newStatus;
    Server.updateSites([site]);
  },

  saveNotesAndFlags: function() {
    const site: SASite = _.clone(this.props.site);
    const state: SiteTableRowState = this.state;
    site.rdbQuotaMiBs = state.rdbQuotaMiBs;
    site.fileQuotaMiBs = state.fileQuotaMiBs;
    site.readLimsMult = state.readLimsMult;
    site.logLimsMult = state.logLimsMult;
    site.createLimsMult = state.createLimsMult;
    site.superStaffNotes = state.newNotes;
    site.featureFlags = state.newFeatureFlags;
    Server.updateSites([site]);
  },

  render: function() {
    const stuff: SuperAdminStuff = this.props.superAdminStuff;
    const site: SASite = this.props.site;
    const state: SiteTableRowState = this.state;

    const makeButton = (className: St, title: St, newStatus: SiteStatus) =>
      Button({ className: className + ' s_SA_StatusB',
          onClick: () => this.changeStatus(newStatus) },
        title);

    const hideButton = site.status > SiteStatus.Active ? null :
        makeButton('s_SA_StatusB-Hide', "Hide unless staff", SiteStatus.HiddenUnlessStaff);

    const reactivateButton = site.status !== SiteStatus.HiddenUnlessStaff ? null :
        makeButton('', "Activate again", SiteStatus.Active);

    const deleteButton = site.status !== SiteStatus.HiddenUnlessStaff ? null :
        makeButton('', "Delete (can undo)", SiteStatus.Deleted);

    const wasDeletedAt = !site.deletedAtMs ? null :
        r.div({}, "Was deleted at ", whenMsToIsoDate(site.deletedAtMs));

    const undeleteButton = site.status !== SiteStatus.Deleted ? null :
        makeButton('', "Undelete", SiteStatus.HiddenUnlessStaff);

    const autoPurgeAtMs: Nr | Nl =
        site.status === SiteStatus.Deleted ? site.autoPurgeAtMs : null;

    const willAutoPurgeAt = !isNum(autoPurgeAtMs) ? null :
        r.div({}, "Will auto purge at ", whenMsToIsoDate(autoPurgeAtMs));

    const scheduleOrCancelPurge = site.status !== SiteStatus.Deleted ? null : (
        willAutoPurgeAt
          ? Button({ className: ' s_SA_StatusB',
                onClick: () => Server.schedulePurge({
                    purgeAfterDays: null, siteId: site.id }) },
                "Cancel purge")
          : r.div({},
              "Purge after ",
              r.input({ type: 'number', min: '0', step: 'any',
                  value: state.purgeAfterDaysInpVal,
                  onChange: (event) => this.setState({
                      purgeAfterDaysInpVal: parseFloat(event.target.value),
                    } as SiteTableRowState) }),
              " days ",
              Button({ className: ' s_SA_StatusB',
                  disabled: !isNum(state.purgeAfterDaysInpVal),
                  onClick: () => Server.schedulePurge({
                      purgeAfterDays: state.purgeAfterDaysInpVal, siteId: site.id }) },
                  "Schedule")));

    const wasPurgedAt = !site.purgedAtMs ? null :
        r.div({}, "Was purged at ", whenMsToIsoDate(site.purgedAtMs));

    let canonHostname = site.canonicalHostname;
    if (!canonHostname && site.id === FirstSiteId) {
      canonHostname = stuff.firstSiteHostname;
    }

    // (Don't show a login button for the superadmin site itself, because already logged in.)
    const loginButton = site.id === eds.siteId
        ? r.span({ className: 'esSA_ThisSite' }, "(this site)")
        : r.a({ className: 'esSA_LoginB', target: 'blank',
            // Stop using the System user? It should only do things based on Talkyard's source code,
            // never be controlled by a human.  But use which other user, instead?  [SYS0LGI]
              href: Server.makeImpersonateAtOtherSiteUrl(site.id, SystemUserId) },
            "Super admin");

    const createdAtStr = moment(site.createdAtMs).toISOString().replace('T', ' ');

    const oldHostnames = _.filter(site.hostnames, h => h != canonHostname);
    const anyOldHostnames = !oldHostnames.length ? null :
        r.div({},
          r.div({}, "Old hostnames:"),
          r.ul({ className: 's_SA_S_Hostnames' },
            oldHostnames.map(h => r.li({ key: h }, h))));

    const staffUsers = !site.staffUsers.length ? null :
        r.div({},
          r.ul({},
            site.staffUsers.map(staffUser => {
              const admOrMod = staffUser.isAdmin ? 'admin' : 'moderator';
              return r.li({ key: staffUser.username },
                `${admOrMod} @${staffUser.username}, ${staffUser.email}, ${staffUser.fullName}`)
            })));

    const notesClass = !site.superStaffNotes?.length ? ' s_SA_S_Notes_Txt-Empty' : '';
    const notes =
        r.div({},
          r.textarea({ className: 's_SA_S_Notes_Txt' + notesClass,
            onChange: (event) =>
                this.setState({ newNotes: event.target.value, } as SiteTableRowState),
            defaultValue: state.newNotes }));

    // kB = kilobytes, 1000 bytes.  1 KiB (uppercase K) = 1 kibi = 1024 bytes.
    // MB = 1000 * 1000 byte. MiB = 1024 * 1024 bytes.
    const MiB = Sizes.Mebibyte;
    const ps = admin.prettyStats(site.stats);
    const quota = r.div({ className: 's_SA_S_Storage'},
        `db: ${ps.dbMb.toPrecision(2)} MiB = ${ps.dbPercentStr}% of ${ps.dbMaxMb} MiB`,
        r.input({ className: 's_SA_S_Quota', type: 'number', min: '0', step: '1',
            onChange: (event) => this.setState({
              rdbQuotaMiBs: asIntOrNull(event.target.value),
            } as SiteTableRowState),
            defaultValue: site.stats.rdbQuotaMiBs }),
        r.br(),
        `fs: ${ps.fsMb.toPrecision(2)} MiB = ${ps.fsPercentStr}% of ${ps.fsMaxMb} MiB`,
        r.input({ className: 's_SA_S_Quota', type: 'number', min: '0', step: '1',
            onChange: (event) => this.setState({
              fileQuotaMiBs: asIntOrNull(event.target.value),
            } as SiteTableRowState),
            defaultValue: site.stats.fileQuotaMiBs }),
        );

    const limitsMultipliers = r.div({ className: 's_SA_S_LimsMults' },
        "Rd: ",
        r.input({ className: 's_SA_S_LimsMults_It', type: 'number', min: '0', step: '0.5',
            onChange: (event) => this.setState({
                readLimsMult: asFloatOrNull(event.target.value) } as SiteTableRowState),
            defaultValue: site.readLimsMult }),
        "Lg: ",
        r.input({ className: 's_SA_S_LimsMults_It', type: 'number', min: '0', step: '0.5',
            onChange: (event) => this.setState({
                logLimsMult: asFloatOrNull(event.target.value) } as SiteTableRowState),
            defaultValue: site.logLimsMult }),
        "Cr: ",
        r.input({ className: 's_SA_S_LimsMults_It', type: 'number', min: '0', step: '0.5',
            onChange: (event) => this.setState({
                createLimsMult: asFloatOrNull(event.target.value) } as SiteTableRowState),
            defaultValue: site.createLimsMult }),
        );

    const featureFlags =
        r.div({},
          r.input({ className: 's_SA_S_FeatFlgs',
              onChange: (event) => this.setState({
                  newFeatureFlags: event.target.value } as SiteTableRowState),
              defaultValue: site.featureFlags }));

    const saveBtn = (
            state.rdbQuotaMiBs === site.stats.rdbQuotaMiBs
              && state.fileQuotaMiBs === site.stats.fileQuotaMiBs
              && state.readLimsMult === site.readLimsMult
              && state.logLimsMult === site.logLimsMult
              && state.createLimsMult === site.createLimsMult
              && state.newNotes === (site.superStaffNotes || '')
              && state.newFeatureFlags === site.featureFlags) ? null :
        PrimaryButton({ className: 's_SA_S_Notes_SaveB',
            onClick: this.saveNotesAndFlags },
          "Save");

    return (
      r.tr({},
        r.td({},
          r.a({ href: '//site-' + site.id + '.' + stuff.baseDomain }, site.id)),
        r.td({},
          siteStatusToString(site.status),
          hideButton,
          reactivateButton,
          deleteButton,
          wasDeletedAt,
          undeleteButton,
          willAutoPurgeAt,
          scheduleOrCancelPurge,
          wasPurgedAt,
          quota,
          limitsMultipliers,
          featureFlags),
        r.td({},
          r.div({},
            r.a({ href: '//' + canonHostname }, canonHostname),
            loginButton,
            createdAtStr),
          anyOldHostnames,
          staffUsers,
          notes,
          saveBtn)));
  }
});

//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
