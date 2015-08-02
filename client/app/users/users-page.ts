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
var Route = reactCreateFactory(ReactRouter.Route);
var Redirect = reactCreateFactory(ReactRouter.Redirect);
var DefaultRoute = reactCreateFactory(ReactRouter.DefaultRoute);
var NotFoundRoute = reactCreateFactory(ReactRouter.NotFoundRoute);
var RouteHandler = reactCreateFactory(ReactRouter.RouteHandler);
var RouterNavigationMixin = ReactRouter.Navigation;
var RouterStateMixin = ReactRouter.State;


export function routes() {
  return Route({ path: '/', handler: UsersHomeComponent },
    DefaultRoute({ handler: DefaultComponent }),
    NotFoundRoute({ handler: NotFoundComponent }),
    Route({ path: '/id/:userId', handler: UserPageComponent },
      DefaultRoute({ handler: debiki2.users.UserDetailsAndActionsComponent }),
      Route({ name: 'user-all', path: 'all', handler: UserAllComponent }),
      Route({ name: 'user-topics', path: 'topics', handler: UserTopicsComponent }),
      Route({ name: 'user-posts', path: 'posts', handler: UserPostsComponent }),
      Route({ name: 'user-likes-given', path: 'likes-given', handler: UserLikesGivenComponent }),
      Route({ name: 'user-likes-received', path: 'likes-received', handler: UserLikesReceivedComponent }),
      Route({ name: 'user-notifications', path: 'notifications', handler: UserNotificationsComponent }),
      Route({ name: 'user-preferences', path: 'preferences', handler: debiki2.users.UserPreferencesComponent }),
      Route({ name: 'user-invites', path: 'invites', handler: debiki2.users.UserInvitesComponent })));
}


var UsersHomeComponent = React.createClass({
  render: function() {
    return (
      r.div({ className: 'container' },
        debiki2.reactelements.TopBar({}),
        RouteHandler({})));
  }
});


var DefaultComponent = React.createClass({
  render: function() {
    return r.div({}, 'Unexpected URL [DwE7E1W31]');
  }
});


var NotFoundComponent = React.createClass({
  render: function() {
    return r.h1({}, 'Not found [DwE8YK4P5]');
  }
});


var UserPageComponent = React.createClass({
  mixins: [RouterStateMixin, RouterNavigationMixin, debiki2.StoreListenerMixin],

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


var UserBar = createComponent({
  render: function() {
    var loggedInUser = this.props.loggedInUser;
    var user = this.props.user;

    var showPrivateStuff = isStaff(loggedInUser) || (
        loggedInUser.isAuthenticated && loggedInUser.userId === user.id);

    var invitesNavItem = null;
    var preferencesNavItem = null;
    if (showPrivateStuff) {
      preferencesNavItem = NavItem({ eventKey: 'user-preferences' }, 'Preferences');
      if (!isGuest(user)) {
        invitesNavItem = NavItem({ eventKey: 'user-invites' }, 'Invites');
      }
    }

    var adminButton = isStaff(loggedInUser)
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

    var isGuestInfo = null;
    if (isGuest(user)) {
      isGuestInfo = ' — a guest user, could be anyone';
    }
    if (user.isModerator) {
      isGuestInfo = ' – moderator';
    }
    if (user.isAdmin) {
      isGuestInfo = ' – administrator';
    }
    if (isGuestInfo) {
      isGuestInfo = r.span({ className: 'dw-is-what' }, isGuestInfo);
    }

    return (
      r.div({ className: 'user-info' },
        r.h1({}, user.username),
        r.h2({}, user.fullName, isGuestInfo),
        suspendedInfo));
  }
});


var UserNav = createComponent({
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


var UserContent = createComponent({
  render: function() {
    return (
      r.div({ className: 'dw-user-content' },
        RouteHandler(this.props)));
  }
});


var UserAllComponent = React.createClass({
  render: function() {
    return (
      r.p({}, 'UserAll'));
  }
});


var UserTopicsComponent = React.createClass({
  render: function() {
    return (
      r.p({}, 'UserTopics'));
  }
});


var UserPostsComponent = React.createClass({
  render: function() {
    return (
      r.p({}, 'UserPosts'));
  }
});


var UserLikesGivenComponent = React.createClass({
  render: function() {
    return (
      r.p({}, 'UserLikesGiven'));
  }
});


var UserLikesReceivedComponent = React.createClass({
  render: function() {
    return (
      r.p({}, 'UserLikesReceived'));
  }
});


var UserNotificationsComponent = React.createClass({
  render: function() {
    return (
      r.p({}, 'UserNotifications'));
  }
});



//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
