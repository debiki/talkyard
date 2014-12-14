/*
 * Copyright (C) 2014 Kaj Magnus Lindberg (born 1979)
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
/// <reference path="../../shared/plain-old-javascript.d.ts" />

//------------------------------------------------------------------------------
   module debiki2.dashbar {
//------------------------------------------------------------------------------

var r = React.DOM;
var d = { i: debiki.internal };


export var Dashbar = createComponent({
  mixins: [debiki2.StoreListenerMixin],

  getInitialState: function() {
    return debiki2.ReactStore.allData();
  },

  onChange: function() {
    this.setState(debiki2.ReactStore.allData());
  },

  render: function() {
    var user = this.state.user;

    if (!user.isAuthenticated)
      return null;

    return (
      r.div({ id: 'debiki-dashbar' },
        DebikiDashbarLogo()));
  }
});


export var DebikiDashbarLogo = createComponent({
  render: function() {
    return (
      r.a({ className: 'debiki-dashbar-logo',
          href: d.i.serverOrigin + '/-/admin/?returnTo=' + location.pathname },
        r.img({ src: d.i.serverOrigin + '/-/img/logo-128x120.png' })));
  }
});

//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
