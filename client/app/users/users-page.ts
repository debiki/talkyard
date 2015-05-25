/**
 * Copyright (C) 2014-2015 Kaj Magnus Lindberg
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
var reactCreateFactory = React['createFactory'];

var ReactBootstrap: any = window['ReactBootstrap'];
var Button = reactCreateFactory(ReactBootstrap.Button);
var Nav = reactCreateFactory(ReactBootstrap.Nav);
var NavItem = reactCreateFactory(ReactBootstrap.NavItem);

var ReactRouter = window['ReactRouter'];
var Route = ReactRouter.Route;
var DefaultRoute = ReactRouter.DefaultRoute;
var NotFoundRoute = ReactRouter.NotFoundRoute;
var RouteHandler = ReactRouter.RouteHandler;
var RouterNavigation = ReactRouter.Navigation;
var RouterState = ReactRouter.State;


export function routes() {
  return Route({ path: '/', handler: UsersHome },
    DefaultRoute({ handler: Default }),
    NotFoundRoute({ handler: NotFound }),
    Route({ path: '/id/:userId', handler: UserPage },
      DefaultRoute({ handler: debiki2.users.UserDetailsAndActionsComponent }),
      Route({ name: 'user-all', path: 'all', handler: UserAll }),
      Route({ name: 'user-topics', path: 'topics', handler: UserTopics }),
      Route({ name: 'user-posts', path: 'posts', handler: UserPosts }),
      Route({ name: 'user-likes-given', path: 'likes-given', handler: UserLikesGiven }),
      Route({ name: 'user-likes-received', path: 'likes-received', handler: UserLikesReceived }),
      Route({ name: 'user-notifications', path: 'notifications', handler: UserNotifications }),
      Route({ name: 'user-preferences', path: 'preferences', handler: debiki2.users.UserPreferencesComponent }),
      Route({ name: 'user-invites', path: 'invites', handler: debiki2.users.UserInvites })));
}


var UsersHome = React.createClass({
  render: function() {
    return RouteHandler({});
  }
});


var Default = React.createClass({
  render: function() {
    return r.div({}, 'Unexpected URL [DwE7E1W31]');
  }
});


var NotFound = React.createClass({
  render: function() {
    return r.h1({}, 'Not found [DwE8YK4P5]');
  }
});


var UserPage = React.createClass({
  mixins: [RouterState, RouterNavigation, debiki2.StoreListenerMixin],
  
  getInitialState: function() {
    return {
      loggedInUser: debiki2.ReactStore.getUser()
    };
  },

  onChange: function() {
    this.setState({
      loggedInUser: debiki2.ReactStore.getUser()
    });
  },

  componentWillMount: function(nextProps) {
    this.loadCompleteUser();
  },

  componentWillReceiveProps: function(nextProps) {
    this.setState({
      user: null
    });
    this.loadCompleteUser();
  },

  transitionToRouteName: function(routeName) {
    this.transitionTo(routeName, { userId: this.getParams().userId });
  },

  loadCompleteUser: function() {
    var params = this.getParams();
    Server.loadCompleteUser(params.userId, (user) => {
      this.setState({
        user: user
      });
    });
  },

  render: function() {
    if (!this.state.user || !this.state.loggedInUser)
      return r.p({}, 'Loading...');

    var childProps = {
      loggedInUser: this.state.loggedInUser,
      user: this.state.user,
      activeRouteName: this.getRoutes()[2].name,
      transitionTo: this.transitionToRouteName
    };

    return (
      r.div({},
        UserBar(childProps),
        r.div({ style: { display: 'table', width: '100%' }},
          r.div({ style: { display: 'table-row' }},
            UserNav(childProps),
            UserContent(childProps)))));
  }
});


var UserBar = React.createClass({
  render: function() {
    var loggedInUser = this.props.loggedInUser;
    var user = this.props.user;

    var showPrivateStuff = loggedInUser.isAdmin || (
        loggedInUser.isAuthenticated && loggedInUser.userId === user.id);

    var invitesNavItem = null;
    var preferencesNavItem = null;
    if (showPrivateStuff) {
      preferencesNavItem = NavItem({ eventKey: 'user-preferences' }, 'Preferences');
      if (loggedInUser.isAdmin && !isGuest(user)) {
        invitesNavItem = NavItem({ eventKey: 'user-invites' }, 'Invites');
      }
    }

    var adminButton = loggedInUser.isAdmin
        ? r.li({}, r.a({ href: '/-/admin/#/users/id/' + user.id }, 'Admin'))
        : null;

    return (
      r.div({ className: 'dw-user-bar clearfix' },
        UserInfo(this.props),
        Nav({ bsStyle: 'pills', activeKey: this.props.activeRouteName,
            onSelect: this.props.transitionTo, className: 'dw-sub-nav' },
          adminButton,
          invitesNavItem,
          preferencesNavItem)));
  }
});


var UserInfo = createComponent({
  render: function() {
    var user = this.props.user;
    var suspendedInfo;
    if (user.suspendedAtEpoch) {
      var whatAndUntilWhen = user.suspendedTillEpoch === 'Forever'
          ? 'banned'
          : 'suspended until ' + moment(user.suspendedTillEpoch).format('YYYY-MM-DD HH:mm') + ' UTC';
      suspendedInfo = r.div({},
          'This user is ' + whatAndUntilWhen, r.br(),
          'Reason: ' + user.suspendedReason);
    }
    var isGuestInfo = isGuest(user)
        ? r.span({ className: 'dw-is-guest' }, ' — a guest user, could be anyone')
        : null;
    return (
      r.div({ className: 'user-info' },
        r.h1({}, user.username),
        r.h2({}, user.fullName, isGuestInfo),
        suspendedInfo));
  }
});


var UserNav = React.createClass({
  render: function() {
    var messages = null;
    // if (this.props.)
    return (
      r.div({ className: 'dw-user-nav' },
        Nav({ bsStyle: 'pills', activeKey: this.props.activeRouteName,
            onSelect: this.props.transitionTo, className: 'dw-sub-nav nav-stacked' },
          NavItem({ eventKey: 'user-all' }, 'All'),
          NavItem({ eventKey: 'user-topics' }, 'Topics'),
          NavItem({ eventKey: 'user-posts' }, 'Posts'),
          NavItem({ eventKey: 'user-likes-given' }, 'Likes Given'),
          NavItem({ eventKey: 'user-likes-received' }, 'Likes Received'),
          NavItem({ eventKey: 'user-notifications' }, 'Notifications'),
          messages)));
  }
});


var UserContent = React.createClass({
  render: function() {
    return (
      r.div({ className: 'dw-user-content' },
        RouteHandler(this.props)));
  }
});


var UserAll = React.createClass({
  render: function() {
    return (
      r.p({}, 'UserAll'));
  }
});


var UserTopics = React.createClass({
  render: function() {
    return (
      r.p({}, 'UserTopics'));
  }
});


var UserPosts = React.createClass({
  render: function() {
    return (
      r.p({}, 'UserPosts'));
  }
});


var UserLikesGiven = React.createClass({
  render: function() {
    return (
      r.p({}, 'UserLikesGiven'));
  }
});


var UserLikesReceived = React.createClass({
  render: function() {
    return (
      r.p({}, 'UserLikesReceived'));
  }
});


var UserNotifications = React.createClass({
  render: function() {
    return (
      r.p({}, 'UserNotifications'));
  }
});



//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
