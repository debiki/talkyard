/**
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
/// <reference path="user-details-actions.ts" />

//------------------------------------------------------------------------------
   module debiki2.users {
//------------------------------------------------------------------------------

var d = { i: debiki.internal, u: debiki.v0.util };
var r = React.DOM;
var ReactRouter = window['ReactRouter'];
var Route = ReactRouter.Route;
var DefaultRoute = ReactRouter.DefaultRoute;
var NotFoundRoute = ReactRouter.NotFoundRoute;
var RouteHandler = ReactRouter.RouteHandler;


export function routes() {
  return Route({ path: '/', handler: UsersHome },
    DefaultRoute({ handler: Default }),
    NotFoundRoute({ handler: NotFound }),
    Route({ path: '/id/:userId', handler: UserPage },
      DefaultRoute({ handler: debiki2.users.UserDetailsAndActionsComponent }),
      Route({ path: 'preferences', handler: debiki2.users.UserPreferencesComponent })));
}


// Hmm, can I remove this empty route?
var UsersHome = React.createClass({
  render: function() {
    return RouteHandler({});
  }
});


var Default = React.createClass({
  render: function() {
    return r.div({}, 'Unexpected URL');
  }
});


var NotFound = React.createClass({
  render: function() {
    return r.h1({}, 'Not found');
  }
});


var UserPage = React.createClass({
  render: function() {
    return RouteHandler({});
  }
});


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list