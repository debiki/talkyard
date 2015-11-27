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
/// <reference path="../../typedefs/moment/moment.d.ts" />
/// <reference path="../plain-old-javascript.d.ts" />
/// <reference path="../ReactStore.ts" />
/// <reference path="../Server.ts" />
/// <reference path="review-all.ts" />
/// <reference path="review-posts.ts" />

//------------------------------------------------------------------------------
   module debiki2.admin {
//------------------------------------------------------------------------------

var d = { i: debiki.internal, u: debiki.v0.util };
var r = React.DOM;
var reactCreateFactory = React['createFactory'];
var ReactBootstrap: any = window['ReactBootstrap'];
var Nav = reactCreateFactory(ReactBootstrap.Nav);
var NavItem = reactCreateFactory(ReactBootstrap.NavItem);

var ReactRouter = window['ReactRouter'];
var RouteHandler = reactCreateFactory(ReactRouter.RouteHandler);
var RouterNavigationMixin = ReactRouter.Navigation;
var RouterStateMixin = ReactRouter.State;


export var ReviewPanelComponent = React.createClass({
  mixins: [RouterNavigationMixin, RouterStateMixin],

  getInitialState: function() {
    return {
      activeRoute: this.getRoutes()[2].name
    };
  },

  handleSelect: function(newRoute) {
    this.setState({ activeRoute: newRoute });
    this.transitionTo(newRoute);
  },

  render: function() {
    return (
        r.div({},
            Nav({ bsStyle: 'pills', activeKey: this.state.activeRoute, onSelect: this.handleSelect,
                className: 'dw-sub-nav' },
              NavItem({ eventKey: 'review-posts' }, 'Posts')),
            r.div({ className: 'dw-admin-panel' },
              RouteHandler({}))));
  }
});


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
