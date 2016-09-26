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

//------------------------------------------------------------------------------
   module debiki2.tags {
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


var TagsRoot = '/-/tags/';

export function routes() {
  return [
    Redirect({ key: 'redir', from: TagsRoot, to: TagsRoot + '/all' }),
    Route({ key: 'routes', path: TagsRoot, component: TagsAppComponent },
      Route({ path: 'all', component: AllTagsPanelComponent }))];
}



var TagsAppComponent = React.createClass(<any> {
  mixins: [debiki2.StoreListenerMixin],

  contextTypes: {
    router: React.PropTypes.object.isRequired
  },

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
    return (
      r.div({ className: "container esSA" },
        React.cloneElement(this.props.children, { store: this.state.store })));
  }
});



var AllTagsPanelComponent = React.createClass(<any> {
  componentWillMount: function() {
    Server.loadTagsAndStats();
    Server.loadMyTagNotfLevels();
  },

  render: function() {
    var store: Store = this.props.store;
    var me: Myself = store.me;
    var tagsStuff: TagsStuff = store.tagsStuff || {};
    var tagsAndStats = tagsStuff.tagsAndStats;
    var myTagNotfLevels = tagsStuff.myTagNotfLevels;
    if (!tagsAndStats)
      return r.p({}, "Loading ...");

    var subscribersColumn = isStaff(me) ? r.th({}, "Subscribers") : null;
    var mutedColumn = isStaff(me) ? r.th({}, "Muted") : null;

    var tagTableRows = tagsAndStats.map(tagAndStats =>
        TagTableRow({ store: store, tagAndStats: tagAndStats, myTagNotfLevels: myTagNotfLevels }));

    return (
      r.div({},
        r.h2({}, "All tags"),
        r.table({ className: "table" },
          r.thead({},
            r.tr({},
              r.th({}, "Name"),
              r.th({}, "Num usages"),
              r.th({}, "Num pages"),
              subscribersColumn,
              mutedColumn,
              r.th({}, "Notifications to you"))),
          r.tbody({},
            tagTableRows))));
  }
});


var TagTableRow = createComponent({
  render: function() {
    var store: Store = this.props.store;
    var me: Myself = store.me;
    var tagAndStats: TagAndStats = this.props.tagAndStats;
    var myTagNotfLevels = this.props.myTagNotfLevels;
    var tagNotfLevel = (myTagNotfLevels || {})[tagAndStats.label] || NotfLevel.Normal;
    var subscribersColumn = isStaff(me) ? r.td({}, tagAndStats.numSubscribers) : null;
    var mutedColumn = isStaff(me) ? r.td({}, tagAndStats.numMuted) : null;
    return (
      r.tr({},
        r.td({},
          r.a({ className: 'esTg' }, tagAndStats.label)),
        r.td({},
          tagAndStats.numTotal),
        r.td({},
          tagAndStats.numPages),
        subscribersColumn,
        mutedColumn,
        r.td({},
          notification.NotfLevelButton({ subject: { tagLabel: tagAndStats.label },
              notfLevel: tagNotfLevel }))));
  }
});

//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
