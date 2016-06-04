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
/// <reference path="../topbar/topbar.ts" />
/// <reference path="../links.ts" />
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
var IndexRoute = reactCreateFactory(ReactRouter.IndexRoute);
var Redirect = reactCreateFactory(ReactRouter.Redirect);
var DefaultRoute = reactCreateFactory(ReactRouter.DefaultRoute);


export function routes() {
  return (
    Route({ path: '/-/users/', component: UsersHomeComponent },
      IndexRoute({ component: DefaultComponent }),
      Redirect({ from: 'id/:userId', to: 'id/:userId/activity' }),
      Redirect({ from: 'id/:userId/', to: 'id/:userId/activity' }),
      Route({ path: 'id/:userId', component: UserPageComponent },
        Route({ path: 'activity', component: UserAllComponent }),
        Route({ path: 'topics', component: UserTopicsComponent }),
        Route({ path: 'posts', component: UserPostsComponent }),
        Route({ path: 'likes-given', component: UserLikesGivenComponent }),
        Route({ path: 'likes-received', component: UserLikesReceivedComponent }),
        Route({ path: 'notifications', component: UserNotificationsComponent }),
        Route({ path: 'preferences', component: debiki2.users.UserPreferencesComponent }),
        Route({ path: 'invites', component: debiki2.users.UserInvitesComponent }))));
}



var UsersHomeComponent = React.createClass(<any> {
  componentDidMount: function() {
    if (window.location.hash.indexOf('#writeMessage') !== -1) {
      var toUserId = parseInt(this.props.params.userId);
      var myUserId = ReactStore.getUser().userId;
      dieIf(toUserId === myUserId, 'EsE7UMKW2');
      dieIf(userId_isGuest(toUserId), 'EsE6JKY20');
      editor.openToWriteMessage(toUserId);
    }
  },

  render: function() {
    return (
      r.div({},
        reactelements.TopBar({ customTitle: "About User", showBackToSite: true, extraMargin: true }),
        this.props.children));
  }
});


var DefaultComponent = React.createClass(<any> {
  render: function() {
    return r.div({}, 'Unexpected URL [DwE7E1W31]');
  }
});


var UserPageComponent = React.createClass(<any> {
  mixins: [debiki2.StoreListenerMixin],

  contextTypes: {
    router: React.PropTypes.object.isRequired
  },

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
    this.setState({ loggedInUser: debiki2.ReactStore.getUser(), });
    this.loadCompleteUser();
  },

  componentDidMount: function() {
    this.loadCompleteUser();
  },

  componentDidUpdate: function(prevProps) {
    if (this.props.location.pathname !== prevProps.location.pathname) {
      this.loadCompleteUser();
    }
  },

  componentWillUnmount: function() {
    this.ignoreServerResponse = true;
  },

  transitionToRouteName: function(routeName) {
    this.context.router.push('/-/users/id/' + this.props.params.userId + '/' + routeName);
  },

  loadCompleteUser: function() {
    Server.loadCompleteUser(this.props.params.userId, (user) => {
      if (this.ignoreServerResponse) return;
      this.setState({ user: user });
    }, () => {
      if (this.ignoreServerResponse) return;
      // Error. We might not be allowed to see this user, so null it even if it was shown before.
      this.setState({ user: null });
    });
  },

  render: function() {
    if (!this.state.user || !this.state.loggedInUser)
      return r.p({}, 'Loading...');

    dieIf(!this.props.routes || !this.props.routes[2] || !this.props.routes[2].path, 'EsE5GKUW2');
    var childProps = {
      loggedInUser: this.state.loggedInUser,
      user: this.state.user,
      reloadUser: this.loadCompleteUser,
      activeRouteName: this.props.routes[2].path,
      transitionTo: this.transitionToRouteName
    };

    return (
      r.div({ className: 'container' },
        UserBar(childProps),
        r.div({ style: { display: 'table', width: '100%' }},
          r.div({ style: { display: 'table-row' }},
            UserNav(childProps),
            r.div({ className: 'dw-user-content' },
              React.cloneElement(this.props.children, childProps))))));
  }
});


var UserBar = createComponent({
  sendMessage: function() {
    editor.openToWriteMessage(this.props.user.id);
  },

  render: function() {
    var loggedInUser = this.props.loggedInUser;
    var user = this.props.user;
    var isMe = loggedInUser.userId === user.id;

    var showPrivateStuff = isStaff(loggedInUser) || (
        loggedInUser.isAuthenticated && loggedInUser.userId === user.id);

    var invitesNavItem = null;
    var preferencesNavItem = null;
    if (showPrivateStuff) {
      preferencesNavItem = NavItem({ eventKey: 'preferences' }, 'Preferences');
      if (maySendInvites(user).value) {
        invitesNavItem = NavItem({ eventKey: 'invites' }, 'Invites');
      }
    }

    var adminButton = isStaff(loggedInUser)
        ? r.li({}, r.a({ href: linkToUserInAdminArea(user.id) }, "View in Admin Area"))
        : null;

    var sendMessageButton = loggedInUser.isAuthenticated && !isMe && !user_isGuest(user)
        ? Button({ onClick: this.sendMessage, bsStyle: 'primary' }, "Send Message")
        : null;

    return (
      r.div({ className: 'dw-user-bar clearfix' },
        UserInfo(this.props),
        Nav({ bsStyle: 'pills', activeKey: this.props.activeRouteName,
            onSelect: this.props.transitionTo, className: 'dw-sub-nav' },
          sendMessageButton,
          adminButton,
          invitesNavItem,
          preferencesNavItem)));
  }
});


var UserInfo = createComponent({
  getInitialState: function() {
    return {
      isUploadingProfilePic: false,
    };
  },

  componentDidMount: function() {
    Server.loadEditorEtceteraScripts().then(this.createUploadAvatarButton);
  },

  selectAndUploadAvatar: function() {
    $(this.refs.chooseAvatarInput).click();
  },

  createUploadAvatarButton: function() {
    if (!this.refs.chooseAvatarInput)
      return;

    var inputElem = this.refs.chooseAvatarInput;
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
        FileAPI.upload({   // a bit dupl code [2UK503]
          url: '/-/upload-avatar',
          headers: { 'X-XSRF-TOKEN': window['$'].cookie('XSRF-TOKEN') },
          files: { images: files },
          imageOriginal: false,
          imageTransform: {
            'tiny': { width: 25, height: 25, type: 'image/jpeg', quality: 0.95 },
            'small': { width: 48, height: 48, type: 'image/jpeg', quality: 0.95 },
            'medium': { maxWidth: 350, maxHeight: 350, type: 'image/jpeg', quality: 0.8 },
          },
          // This is per file.
          fileprogress: (event, file, xhr, options) => {
            if (!this.state.isUploadingProfilePic) {
              this.setState({ isUploadingProfilePic: true });
              pagedialogs.getProgressBarDialog().open("Uploading...", () => {
                this.setState({ uploadCancelled: true });
                xhr.abort("Intentionally cancelled [EsM2FL54]");
              });
            }
            else {
              var percent = event.loaded / event.total * 100;
              pagedialogs.getProgressBarDialog().setDonePercent(percent);
            }
          },
          // This is when all files have been uploaded — but we're uploading just one.
          complete: (error, xhr) => {
            if (error && !this.state.uploadCancelled) {
              pagedialogs.getServerErrorDialog().open(xhr);
            }
            // Reload in any case — perhaps the error happened after the whole image had been
            // uploaded already.
            this.props.reloadUser();
            pagedialogs.getProgressBarDialog().close();
            this.setState({
              isUploadingProfilePic: false,
              uploadCancelled: false
            });
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

    var isMe = loggedInUser.userId === user.id;
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

    var thatIsYou = !isMe ? null :
      r.span({ className: 'esProfile_isYou' }, "(you)");

    var uploadAvatarBtnText = user.mediumAvatarUrl ? "Change photo" : "Upload photo";
    var avatarMissingClass = user.mediumAvatarUrl ? '' : ' esMedAvtr-missing';

    var anyUploadPhotoBtn = (isMe || isStaff(loggedInUser))
      ? r.div({},
          // File inputs are ugly, so we hide the file input (size 0 x 0) and activate
          // it by clicking a beautiful button instead:
          Button({ id: 'e2eChooseAvatarInput', className: 'esMedAvtr_uplBtn',
              onClick: this.selectAndUploadAvatar }, uploadAvatarBtnText),
          r.input({ name: 'files', type: 'file', multiple: false, // dupl code [2UK503]
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
            r.h1({}, user.username, thatIsYou),
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
          NavItem({ eventKey: 'activity' }, 'Activity'),
          NavItem({ eventKey: 'topics' }, 'Topics'),
          NavItem({ eventKey: 'posts' }, 'Posts'),
          NavItem({ eventKey: 'likes-given' }, 'Likes Given'),
          NavItem({ eventKey: 'likes-received' }, 'Likes Received'),
          NavItem({ eventKey: 'notifications' }, 'Notifications'),
          messages)));
  }
});



var UserAllComponent = React.createClass(<any> {
  render: function() {
    return (
      r.p({}, "Not yet implemented"));
  }
});


var UserTopicsComponent = React.createClass(<any> {
  render: function() {
    return (
      r.p({}, "Not yet implemented"));
  }
});


var UserPostsComponent = React.createClass(<any> {
  render: function() {
    return (
      r.p({}, "Not yet implemented"));
  }
});


var UserLikesGivenComponent = React.createClass(<any> {
  render: function() {
    return (
      r.p({}, "Not yet implemented"));
  }
});


var UserLikesReceivedComponent = React.createClass(<any> {
  render: function() {
    return (
      r.p({}, "Not yet implemented"));
  }
});


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
