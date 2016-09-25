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
/// <reference path="../slim-bundle.d.ts" />
/// <reference path="user-details-actions.more.ts" />

//------------------------------------------------------------------------------
   module debiki2.users {
//------------------------------------------------------------------------------

var r = React.DOM;
var Nav = rb.Nav;
var NavItem = rb.NavItem;

var ReactRouter = window['ReactRouter'];
var Route = reactCreateFactory(ReactRouter.Route);
var IndexRoute = reactCreateFactory(ReactRouter.IndexRoute);
var Redirect = reactCreateFactory(ReactRouter.Redirect);
var DefaultRoute = reactCreateFactory(ReactRouter.DefaultRoute);


// Make the components async? So works also if more-bundle.js not yet loaded? [4WP7GU5]
export function routes() {
  return (
    Route({ path: '/-/users/', component: UsersHomeComponent },
      IndexRoute({ component: DefaultComponent }),
      // [delete] Remove the two 'id/:userId...' links in Jan 2017, they're no longer in use.
      Redirect({ from: 'id/:userId', to: ':userId/activity' }),   // delete later
      Redirect({ from: 'id/:userId/', to: ':userId/activity' }),  // delete later
      Redirect({ from: ':usernameOrId', to: ':usernameOrId/activity' }),
      Redirect({ from: ':usernameOrId/', to: ':usernameOrId/activity' }),
      Route({ path: ':usernameOrId', component: UserPageComponent },
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
      var usernameOrId = this.props.params.usernameOrId;
      dieIf(/[^0-9]/.test(usernameOrId), 'Not a user id [EsE5YK0P2]');
      var toUserId = parseInt(usernameOrId);
      var myUserId = ReactStore.getMe().userId;
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
      loggedInUser: debiki2.ReactStore.getMe(),
      user: null,
    };
  },

  onChange: function() {
    if (this.state.loggedInUser === debiki2.ReactStore.getMe())
      return;

    // Also reload the user we're showing, because now we might/might-no-longer have access
    // to data about him/her.
    this.setState({ loggedInUser: debiki2.ReactStore.getMe(), });
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
    this.willUnmount = true;
  },

  transitionToRouteName: function(routeName) {
    this.context.router.push('/-/users/' + this.props.params.usernameOrId + '/' + routeName);
  },

  loadCompleteUser: function() {
    var usernameOrId = this.props.params.usernameOrId;
    Server.loadCompleteUser(usernameOrId, (user) => {
      if (this.willUnmount) return;
      this.setState({ user: user });
      // 1) In case the user has changed his/her username, and userIdOrUsername is his/her *old*
      // name, user.username will be the current name — then show the current name in the url.
      // Also 2) if user id specified, and the user is a member (they have usernames) show
      // username instead,
      if (user.username && user.username !== usernameOrId) {
        this.context.router.replace('/-/users/' + user.username);
      }
    }, () => {
      if (this.willUnmount) return;
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
      r.div({ className: 'container esUP' },
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
    die('EsE_MORE_UNIMPL'); /*
    editor.openToWriteMessage(this.props.user.id);
    */
  },

  render: function() {
    var loggedInUser: Myself = this.props.loggedInUser;
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

    var sendMessageButton = me_maySendDirectMessageTo(loggedInUser, user)
        ? PrimaryButton({ onClick: this.sendMessage }, "Send Message")
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
    Server.loadEditorEtcScriptsAndLater(this.createUploadAvatarButton);
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
    var me: Myself = this.props.loggedInUser;
    var suspendedInfo;
    if (user.suspendedAtEpoch) {
      var whatAndUntilWhen = user.suspendedTillEpoch === 'Forever'
          ? 'banned'
          : 'suspended until ' + moment(user.suspendedTillEpoch).format('YYYY-MM-DD HH:mm') + ' UTC';
      suspendedInfo = r.div({},
          'This user is ' + whatAndUntilWhen, r.br(),
          'Reason: ' + user.suspendedReason);
    }

    var isMe = me.userId === user.id;
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

    var avatar = user.mediumAvatarUrl
        ? r.img({ src: user.mediumAvatarUrl })
        : debiki2.avatar.Avatar({ user: user, large: true, ignoreClicks: true });

    var uploadAvatarBtnText = user.mediumAvatarUrl ? "Change photo" : "Upload photo";
    var avatarMissingClass = user.mediumAvatarUrl ? '' : ' esMedAvtr-missing';

    var anyUploadPhotoBtn = (isMe || isStaff(me)) && !isGuest(user)
      ? r.div({},
          // File inputs are ugly, so we hide the file input (size 0 x 0) and activate
          // it by clicking a beautiful button instead:
          PrimaryButton({ id: 'e2eChooseAvatarInput', className: 'esMedAvtr_uplBtn',
              onClick: this.selectAndUploadAvatar }, uploadAvatarBtnText),
          r.input({ name: 'files', type: 'file', multiple: false, // dupl code [2UK503]
             ref: 'chooseAvatarInput', style: { width: 0, height: 0 }}))
      : null;

    return (
      r.div({ className: 'user-info' },
        r.div({ className: 'user-info-col' },
          r.div({ className: 'esMedAvtr' + avatarMissingClass },
            avatar,
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
    var user: BriefUser = this.props.user;
    var me: Myself = this.props.loggedInUser;
    var viewNotfsNavItem = isStaff(me) || me.id === user.id
        ? NavItem({ eventKey: 'notifications' }, 'Notifications')
        : null;
    return (
      r.div({ className: 'dw-user-nav' },
        Nav({ bsStyle: 'pills', activeKey: this.props.activeRouteName,
            onSelect: this.props.transitionTo, className: 'dw-sub-nav nav-stacked' },
          NavItem({ eventKey: 'activity' }, 'Activity'),
          NavItem({ eventKey: 'topics' }, 'Topics'),
          NavItem({ eventKey: 'posts' }, 'Posts'),
          NavItem({ eventKey: 'likes-given' }, 'Likes Given'),
          NavItem({ eventKey: 'likes-received' }, 'Likes Received'),
          viewNotfsNavItem,
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
