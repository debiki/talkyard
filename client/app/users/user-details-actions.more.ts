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
/// <reference path="../../typedefs/moment/moment.d.ts" />

/* Is this broken user-summary component useful? Start using later again?


//------------------------------------------------------------------------------
   module debiki2.users {
//------------------------------------------------------------------------------

var d = { i: debiki.internal, u: debiki.v0.util };
var r = React.DOM;
var reactCreateFactory = React['createFactory'];
var ReactBootstrap: any = window['ReactBootstrap'];
var Button = reactCreateFactory(ReactBootstrap.Button);
var RouterState = window['ReactRouter'].State;
var RouterNavigation = window['ReactRouter'].Navigation;
import UserInfo = debiki2.users.UserInfo;


export var UserDetailsAndActionsComponent = React.createClass({
  mixins: [RouterState, RouterNavigation, debiki2.StoreListenerMixin],

  getInitialState: function() {
    return {
      loggedInUser: debiki2.ReactStore.getUser()
    };
  },

  onChange: function() {
    this.state.loggedInUser = debiki2.ReactStore.getUser();
    this.setState(this.state);
  },

  onPreferencesClick: function() {
    this.transitionTo('/id/' + this.getParams().userId + '/preferences');
  },

  render: function() {
    var params = this.getParams();
    var isNewUrl = this.state.userId !== params.userId;
    if (isNewUrl) {
      Server.loadUserInfo(params.userId, (anyUserInfo: UserInfo) => {
        this.state.userId = params.userId;
        this.state.userInfo = anyUserInfo;
        this.state.userActions = [];
        this.setState(this.state);
        // Race condition, in case the browser quickly quickly navigates to  another user
        // url, but the below reply arrives later. Unlikely to happen though, ignore it.
        Server.loadUserActions(params.userId, (actions: ActionListItem[]) => {
          this.state.userActions = actions;
          this.setState(this.state);
        });
      });
      return r.p({}, 'Loading...');
    }

    if (!this.state.userInfo)
      return r.p({}, 'User not found');

    return r.div({ className: 'users-page' },
      UserDetails({ userInfo: this.state.userInfo }),
      r.h2({}, 'History:'),
      UserActions({ userActions: this.state.userActions }));
  }
});


var UserDetails = createComponent({
  render: function() {
    var info: UserInfo = this.props.userInfo;
    return r.div({},
      r.h1({}, 'User Details'),
      r.p({}, 'Name: ', info.displayName),
      r.p({}, 'Username: ', info.username),
      r.p({},
        'Pages created: ', info.numPages, r.br({}),
        'Posts posted: ', info.numPosts, r.br({}),
        'Replies received: ', info.numReplies, r.br({}),
        'Likes given: ', info.numLikesGiven, r.br({}),
        'Likes received: ', '(not implemented)', r.br({}), // numLikesReceived
        'Wrongs given: ', info.numWrongsGiven, r.br({}),
        'Wrongs received: ', '(not implemented)', r.br({}), // numWrongsReceived
        'Off-topics given: ', info.numOffTopicsGiven, r.br({}),
        'Off-topics received: ', '(not implemented)', r.br({}))); // numOffTopicsReceived
  }
});


var UserActions = createComponent({
  render: function() {
    var actions: ActionListItem[] = this.props.userActions;
    if (!actions)
      return r.div({}, 'Error loading actions');

    return r.ol({ className: 'action-list' },
      actions.map((action) => {
        return SingleAction({ action: action });
      }));
  }
});


var SingleAction = createComponent({
  render: function() {
    var action: ActionListItem = this.props.action;

    var pageLink = r.a({ href: action.pageUrl }, action.pageTitle);

    var actingUserLink =
        r.a({ href: '/-/users/' + action.actingUserId }, action.actingUserDisplayName);

    var didWhat = 'did something with';
    if (action.repliedToPostId) {
      didWhat = 'replied to';
    }
    else if (action.editedPostId) {
      didWhat = 'edited';
    }
    else if (action.approved) {
      didWhat = 'approved';
    }
    else if (action.deleted) {
      didWhat = 'deleted';
    }
    else if (action.pinned) {
      didWhat = 'pinned';
    }
    else if (action.collapsed) {
      didWhat = 'collapsed';
    }
    else if (action.closed) {
      didWhat = 'closed';
    }
    else if (action.votedLike > 0) {
      didWhat = 'liked';
    }
    else if (action.votedWrong > 0) {
      didWhat = 'marked as wrong';
    }
    else if (action.votedOffTopic > 0) {
      didWhat = 'marked as off-topic';
    }

    var postLink =
        r.a({ href: action.pageUrl + '#post-' + action.postId }, 'post #' + action.postId);

    var targetUserName =
        r.a({ href: '/-/users/' + action.targetUserId }, action.targetUserDisplayName);

    var timeAgo = moment(action.createdAt).fromNow();

    return r.li({},
      'On page ', pageLink, ', ', actingUserLink, ' ', didWhat, ' ', postLink, ' ',
      'by ', targetUserName, ', ', timeAgo,
      r.p({}, 'Excerpt: ', r.i({}, action.excerpt)));
  }
});


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
*/
