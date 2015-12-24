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
  mixins: [RouterStateMixin],

  componentDidMount: function() {
    if (_.isString(this.getQuery().writeMessage)) {
      var toUserId = parseInt(this.getParams().userId);
      var myUserId = ReactStore.getUser().userId;
      dieIf(toUserId === myUserId, 'EsE7UMKW2');
      editor.openToWriteMessage(toUserId);
    }
  },

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
      loggedInUser: debiki2.ReactStore.getUser(),
      user: null,
    };
  },

  onChange: function() {
    if (this.state.loggedInUser === debiki2.ReactStore.getUser())
      return;

    // Also reload the user we're showing, because now we might/might-no-longer have access
    // to data about him/her.
    this.setState({
      loggedInUser: debiki2.ReactStore.getUser(),
      user: null,
    });
    this.loadCompleteUser();
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
      reloadUser: this.loadCompleteUser,
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
  componentDidMount: function() {
    Server.loadEditorEtceteraScripts().then(this.createUploadAvatarButton);
  },

  selectAndUploadAvatar: function() {
    $(this.refs.chooseAvatarInput.getDOMNode()).click();
  },

  createUploadAvatarButton: function() {
    var inputElem = this.refs.chooseAvatarInput.getDOMNode();
    var FileAPI = window['FileAPI'];
    FileAPI.event.on(inputElem, 'change', (evt) => {
      var files = FileAPI.getFiles(evt);
      if (!files.length)
        return; // file dialog cancelled?

      // Perhaps there's some better way to test if the file is ok than using filter(). Oh well.
      FileAPI.filterFiles(files, (file, info) => {
        if( /^image/.test(file.type) ){
          var largeEnough = info.width >= 100 && info.height >= 100;
          dieIf(!largeEnough, "Image too small: should be at least 100 x 100 [EsE8PYM21]");
        }
        else {
          die("Not an image [EsE5GPU3]");
        }
        return true;
      }, (files, rejected) => {
        dieIf(files.length !== 1, 'DwE5UPM2');
        // We can skip any upload progress bar I think. Small files, around 20k, done in no time.
        FileAPI.upload({
          url: '/-/upload-avatar',
          headers: { 'X-XSRF-TOKEN': window['$'].cookie('XSRF-TOKEN') },
          files: { images: files },
          imageOriginal: false,
          imageTransform: {
            'tiny': { width: 25, height: 25, type: 'image/jpeg', quality: 0.95 },
            'small': { width: 48, height: 48, type: 'image/jpeg', quality: 0.95 },
            'medium': { maxWidth: 350, maxHeight: 350, type: 'image/jpeg', quality: 0.8 },
          },
          complete: (error, xhr) => {
            if (error) {
              pagedialogs.getServerErrorDialog().open(xhr);
            }
            else {
              this.props.reloadUser();
            }
          },
        });
      });
    });
  },

  render: function() {
    var user = this.props.user;
    var loggedInUser = this.props.loggedInUser;
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

    var uploadAvatarBtnText = user.mediumAvatarUrl ? "Change photo" : "Upload photo";
    var avatarMissingClass = user.mediumAvatarUrl ? '' : ' esMedAvtr-missing';

    var anyUploadPhotoBtn = (loggedInUser.userId === user.id || isStaff(loggedInUser))
      ? r.div({},
          // File inputs are ugly, so we hide the file input (size 0 x 0) and activate
          // it by clicking a beautiful button instead:
          Button({ id: 'e2eChooseAvatarInput', className: 'esMedAvtr_uplBtn',
              onClick: this.selectAndUploadAvatar }, uploadAvatarBtnText),
          r.input({ name: 'files', type: 'file', multiple: false,
             ref: 'chooseAvatarInput', style: { width: 0, height: 0 }}))
      : null;

    return (
      r.div({ className: 'user-info' },
        r.div({ className: 'user-info-col' },
          r.div({ className: 'esMedAvtr' + avatarMissingClass },
            r.img({ src: user.mediumAvatarUrl }),
            anyUploadPhotoBtn)),
        r.div({ className: 'user-info-col' },
          r.div({ style: { display: 'table-cell' }},
            r.h1({}, user.username),
            r.h2({}, user.fullName, isGuestInfo),
            suspendedInfo))));
  }
});


var UserNav = createComponent({
  render: function() {
    var messages = null;
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
