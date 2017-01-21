/**
 * Copyright (C) 2014-2016 Kaj Magnus Lindberg
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
/// <reference path="user-invites.more.ts" />
/// <reference path="user-notifications.more.ts" />
/// <reference path="user-preferences.more.ts" />
/// <reference path="user-activity.more.ts" />

//------------------------------------------------------------------------------
   namespace debiki2.users {
//------------------------------------------------------------------------------

var r = React.DOM;
var Nav = rb.Nav;
var NavItem = rb.NavItem;

var UsersRoot = '/-/users/';
var ReactRouter = window['ReactRouter'];
var Route = reactCreateFactory(ReactRouter.Route);
var IndexRoute = reactCreateFactory(ReactRouter.IndexRoute);
var Redirect = reactCreateFactory(ReactRouter.Redirect);
var DefaultRoute = reactCreateFactory(ReactRouter.DefaultRoute);


// Make the components async? So works also if more-bundle.js not yet loaded? [4WP7GU5]
export function routes() {
  return (
    Route({ path: UsersRoot, component: UsersHomeComponent },
      IndexRoute({ component: DefaultComponent }),
      Redirect({ from: ':usernameOrId', to: ':usernameOrId/activity' }),
      Redirect({ from: ':usernameOrId/', to: ':usernameOrId/activity' }),
      Route({ path: ':usernameOrId', component: UserPageComponent },
        Redirect({ from: 'activity', to: 'activity/posts' }),
        Route({ path: 'activity', component: UsersActivityComponent },
          Route({ path: 'posts', component: PostsComponent  }),
          Route({ path: 'topics', component: TopicsComponent })
          // mentions? Flarum includes mentions *of* the user, but wouldn't it make more sense
          // to include mentions *by* the user? Discourse shows: (but -received in the notfs tab)
          //Route({ path: 'likes-given', component: LikesGivenComponent }),
          //Route({ path: 'likes-received', component: LikesReceivedComponent })
          ),
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
      var myUserId = ReactStore.getMe().id;
      dieIf(toUserId === myUserId, 'EsE7UMKW2');
      dieIf(userId_isGuest(toUserId), 'EsE6JKY20');
      editor.openToWriteMessage(toUserId);
    }
  },

  render: function() {
    return (
      r.div({},
        reactelements.TopBar({ customTitle: "About User",
            backToSiteButtonTitle: "Back from user profile", extraMargin: true }),
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
      store: debiki2.ReactStore.allData(),
      myId: null,
      user: null,
    };
  },

  onChange: function() {
    let myOldId = this.state.myId;
    let store: Store = debiki2.ReactStore.allData();
    this.setState({
      store: store,
      myId: store.me.id,
    });
    if (myOldId !== store.me.id) {
      // Now we might have access to more/less data about the user, so refresh.
      this.loadCompleteUser();
    }
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

  transitionTo: function(subPath) {
    this.context.router.push('/-/users/' + this.props.params.usernameOrId + '/' + subPath);
  },

  loadCompleteUser: function(redirectToCorrectUsername) {
    var usernameOrId = this.props.params.usernameOrId;
    Server.loadCompleteUser(usernameOrId, (user) => {
      if (this.willUnmount) return;
      this.setState({ user: user });
      // 1) In case the user has changed his/her username, and userIdOrUsername is his/her *old*
      // name, user.username will be the current name — then show current name in the url [8KFU24R].
      // Also 2) if user id specified, and the user is a member (they have usernames) show
      // username instead,
      if (user.username && user.username !== usernameOrId && redirectToCorrectUsername !== false) {
        this.context.router.replace('/-/users/' + user.username);
      }
    }, () => {
      if (this.willUnmount) return;
      // Error. We might not be allowed to see this user, so null it even if it was shown before.
      this.setState({ user: null });
    });
  },

  render: function() {
    let store: Store = this.state.store;
    let me: Myself = store.me;
    let user: MemberInclDetails = this.state.user;
    if (!user || !me)
      return r.p({}, 'Loading...');

    dieIf(!this.props.routes || !this.props.routes[2] || !this.props.routes[2].path, 'EsE5GKUW2');

    let showPrivateStuff = isStaff(me) || (me.isAuthenticated && me.id === user.id);

    let activityNavItem =
      NavItem({ eventKey: 'activity', className: 'e_UP_ActivityB' }, "Activity");

    let notificationsNavItem = !showPrivateStuff ? null :
      NavItem({ eventKey: 'notifications', className: 'e_UP_NotfsB' }, "Notifications");

    let preferencesNavItem = !showPrivateStuff ? null :
      NavItem({ eventKey: 'preferences', id: 'e2eUP_PrefsB' }, "Preferences");

    let invitesNavItem = !showPrivateStuff || !maySendInvites(user).value ? null :
      NavItem({ eventKey: 'invites', id: 'e2eUP_InvitesB' }, "Invites");

    var childProps = {
      store: store,
      me: me, // try to remove, incl already in `store`
      user: user,
      reloadUser: this.loadCompleteUser,
      transitionTo: this.transitionTo
    };

    let activeRouteName = this.props.routes[2].path;

    return (
      r.div({ className: 'container esUP' },
        r.div({ className: 'dw-user-bar clearfix' },
          AvatarAboutAndButtons(childProps)),
        Nav({ bsStyle: 'pills', activeKey: activeRouteName,
            onSelect: this.transitionTo, className: 'dw-sub-nav' },
          activityNavItem,
          notificationsNavItem,
          invitesNavItem,
          preferencesNavItem),
        React.cloneElement(this.props.children, childProps)));
  }
});



var AvatarAboutAndButtons = createComponent({
  getInitialState: function() {
    return {
      isUploadingProfilePic: false,
    };
  },

  componentDidMount: function() {
    Server.loadEditorAndMoreBundles(this.createUploadAvatarButton);
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
          url: '/-/upload-avatar?userId=' + this.props.user.id,
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

  sendMessage: function() {
    editor.openToWriteMessage(this.props.user.id);
  },

  render: function() {
    var user: MemberInclDetails = this.props.user;
    var me: Myself = this.props.me;
    var suspendedInfo;
    if (user.suspendedAtEpoch) {
      var whatAndUntilWhen = (<number | string> user.suspendedTillEpoch) === 'Forever'
          ? 'banned'
          : 'suspended until ' + moment(user.suspendedTillEpoch).format('YYYY-MM-DD HH:mm') + ' UTC';
      suspendedInfo = r.div({},
          'This user is ' + whatAndUntilWhen, r.br(),
          'Reason: ' + user.suspendedReason);
    }

    var isMe = me.id === user.id;
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


    var adminButton = !isStaff(me) ? null :
        LinkButton({ href: linkToUserInAdminArea(user.id), className: 's_UP_AdminB' },
          "View in Admin Area");

    var sendMessageButton = !me_maySendDirectMessageTo(me, user) ? null :
        PrimaryButton({ onClick: this.sendMessage, className: 's_UP_SendMsgB' },
          "Send Message");

    return (
      // This + display: table-row makes the avatar image take less space,
      // and the name + about text get more space, if the avatar is narrow.
      r.div({ className: 's_UP_AvtrAboutBtns' },
        r.div({ className: 's_UP_Avtr' },
          r.div({ className: 'esMedAvtr' + avatarMissingClass },
            avatar,
            anyUploadPhotoBtn)),
        r.div({ className: 's_UP_AboutBtns' },
          sendMessageButton,
          adminButton,
          r.h1({ className: 'esUP_Un' }, user.username, thatIsYou),
          r.h2({ className: 'esUP_FN' }, user.fullName, isGuestInfo),
          r.div({ className: 's_UP_About' }, user.about),
          suspendedInfo)));
  }
});


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
