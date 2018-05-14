/**
 * Copyright (c) 2014-2017 Kaj Magnus Lindberg
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

//xx <reference path="../../typedefs/moment/moment.d.ts" /> — disappeared
declare var moment: any;
/// <reference path="../slim-bundle.d.ts" />
/// <reference path="user-invites.more.ts" />
/// <reference path="user-notifications.more.ts" />
/// <reference path="user-preferences.more.ts" />
/// <reference path="user-activity.more.ts" />
/// <reference path="user-summary.more.ts" />

//------------------------------------------------------------------------------
   namespace debiki2.users {
//------------------------------------------------------------------------------

const r = ReactDOMFactories;
const UsersRootAndIdParamSlash = UsersRoot + ':usernameOrId/';  // dupl [4GKQST20]


export function usersRoute() {
  return (
    // Let's keep this, although just one route — because maybe will move up to an "upper base route".
    Route({ path: UsersRoot, component: UsersHomeComponent }));
}



const UsersHomeComponent = createReactClass(<any> {
  displayName: 'UsersHomeComponent',

  render: function() {
    return (
        Switch({},
          Route({ path: UsersRoot, component: BadUrlComponent, exact: true }),
          Route({ path: UsersRoot + ':usernameOrId', exact: true,
              render: ({ match }) =>
                Redirect({
                  to: UsersRoot + match.params.usernameOrId + '/activity' + this.props.location.hash })}),
          Route({ path: UsersRoot + ':usernameOrId/:section?/:subsection?',
              component: UserPageComponent })));
  }
});



const BadUrlComponent = createReactClass(<any> {
  displayName: 'BadUrlComponent',

  render: function() {
    return r.div({}, 'Unexpected URL [DwE7E1W31]');
  }
});



const UserPageComponent = createReactClass(<any> {
  displayName: 'UserPageComponent',
  mixins: [debiki2.StoreListenerMixin],

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
      this.loadUserAnyDetails();
    }
  },

  componentDidMount: function() {
    this.loadUserAnyDetails();
  },

  componentDidUpdate: function(prevProps) {
    if (this.props.location.pathname === prevProps.location.pathname)
      return;

    const prevUsernameOrId: string = prevProps.match.params.usernameOrId;
    const currentUser: MemberInclDetails = this.state.user;
    const isSameUser = currentUser && (
        '' + currentUser.id === prevUsernameOrId || currentUser.username === prevUsernameOrId);
    if (!isSameUser) {
      this.loadUserAnyDetails();
    }
  },

  componentWillUnmount: function() {
    this.isGone = true;
  },

  loadUserAnyDetails: function(redirectToCorrectUsername) {
    const params = this.props.match.params;
    const usernameOrId: string | number = params.usernameOrId;

    if (this.nowLoading === usernameOrId) return;
    this.nowLoading = usernameOrId;

    Server.loadUserAnyDetails(usernameOrId, (user: MemberInclDetails, stats: UserStats) => {
      this.nowLoading = null;
      if (this.isGone) return;
      // This setState will trigger a rerender immediately, because we're not in a React event handler.
      // But when rerendering here, the url might still show a user id, not a username. (5GKWS20)
      this.setState({ user: user, stats: stats });
      // 1) In case the user has changed his/her username, and userIdOrUsername is his/her *old*
      // name, user.username will be the current name — then show current name in the url [8KFU24R].
      // Also 2) if user id specified, and the user is a member (they have usernames) show
      // username instead,
      const isNotLowercase = _.isString(usernameOrId) && usernameOrId !== usernameOrId.toLowerCase();
      if (user.username && (user.username.toLowerCase() !== usernameOrId || isNotLowercase) &&
          redirectToCorrectUsername !== false) {
        let pathWithUsername = UsersRoot + user.username.toLowerCase();
        if (params.section) pathWithUsername += '/' + params.section;
        if (params.subsection) pathWithUsername += '/' + params.subsection;
        pathWithUsername += this.props.location.hash;
        this.props.history.replace(pathWithUsername);
      }
      this.maybeOpenMessageEditor(user.id);
    }, () => {
      if (this.isGone) return;
      // Error. We might not be allowed to see this user, so null it even if it was shown before.
      this.setState({ user: null });
    });
  },

  maybeOpenMessageEditor: function(userId: number) {
    if (window.location.hash.indexOf('#writeMessage') >= 0 && !this.hasOpenedEditor) {
      this.hasOpenedEditor = true;
      dieIf(userId_isGuest(userId), 'EdE6JKY20');
      const myUserId = ReactStore.getMe().id;
      if (userId !== myUserId) {
        editor.openToWriteMessage(userId);
      }
    }
  },

  render: function() {
    const store: Store = this.state.store;
    const me: Myself = store.me;
    const user: UserAnyDetails = this.state.user;
    const usernameOrId = this.props.match.params.usernameOrId;

    // Wait until url updated to show username, instead of id, to avoid mounting & unmounting
    // sub comoponents, which could result in duplicated load-data requests.  (5GKWS20)
    if (!user || !me || (user.username && parseInt(usernameOrId)))
      return r.p({ className: 'container' }, t.Loading);

    const imStaff = isStaff(me);
    const userGone = user_isGone(user);

    const showPrivateStuff = imStaff || (!userGone && me.isAuthenticated && me.id === user.id);
    const linkStart = UsersRoot + usernameOrId + '/';

    const activityNavItem = user.isGroup ? null :
      LiNavLink({ to: linkStart + 'activity', className: 'e_UP_ActivityB' }, t.Activity);

    const summaryNavItem = user.isGroup ? null :
      LiNavLink({ to: linkStart + 'summary', className: 'e_UP_SummaryB' }, t.Summary);

    const notificationsNavItem = !showPrivateStuff || user.isGroup ? null :
      LiNavLink({ to: linkStart + 'notifications', className: 'e_UP_NotfsB' }, t.upp.Notifications);

    const preferencesNavItem = !showPrivateStuff ? null :
      LiNavLink({ to: linkStart + 'preferences', id: 'e2eUP_PrefsB' }, t.upp.Preferences);

    const invitesNavItem = !showPrivateStuff || !maySendInvites(user).value ? null :
      LiNavLink({ to: linkStart + 'invites', id: 'e2eUP_InvitesB' }, t.upp.Invites);

    const childProps = {
      store: store,
      me: me, // CLEAN_UP try to remove, incl already in `store`
      user: user,
      match: this.props.match,
      stats: this.state.stats,
      reloadUser: this.loadUserAnyDetails,
    };

    const u = UsersRootAndIdParamSlash;

    const childRoutes = Switch({},
      Route({ path: u + 'activity', exact: true, render: ({ match }) => {
        const hash = this.props.location.hash;
        return Redirect({ to: UsersRoot + match.params.usernameOrId + '/activity/posts' + hash });
      }}),
      Route({ path: u + 'activity', render: (ps) => UsersActivity({ ...childProps, ...ps }) }),
      Route({ path: u + 'summary', render: () => UserSummary(childProps) }),
      Route({ path: u + 'notifications', render: () => UserNotifications(childProps) }),
      Route({ path: u + 'preferences', render: (ps) => UserPreferences({ ...childProps, ...ps }) }),
      Route({ path: u + 'invites', render: () => UserInvites(childProps) }));

    return (
      r.div({ className: 'container esUP' },
        AvatarAboutAndButtons(childProps),
        r.ul({ className: 'dw-sub-nav nav nav-pills' },
          activityNavItem,
          summaryNavItem,
          notificationsNavItem,
          invitesNavItem,
          preferencesNavItem),
        childRoutes));
  }
});



const AvatarAboutAndButtons = createComponent({
  displayName: 'AvatarAboutAndButtons',

  getInitialState: function() {
    return {
      isUploadingProfilePic: false,
    };
  },

  componentDidMount: function() {
    Server.loadEditorAndMoreBundles(this.createUploadAvatarButton);
  },

  selectAndUploadAvatar: function() {
    this.refs.chooseAvatarInput.click();
  },

  createUploadAvatarButton: function() {
    if (!this.refs.chooseAvatarInput)
      return;

    const inputElem = this.refs.chooseAvatarInput;
    const FileAPI = window['FileAPI'];
    FileAPI.event.on(inputElem, 'change', (evt) => {
      const files = FileAPI.getFiles(evt);
      if (!files.length)
        return; // file dialog cancelled?

      // Perhaps there's some better way to test if the file is ok than using filter(). Oh well.
      FileAPI.filterFiles(files, (file, info) => {
        if( /^image/.test(file.type) ){
          const largeEnough = info.width >= 100 && info.height >= 100;
          dieIf(!largeEnough, t.upp.ImgTooSmall + ' [EsE8PYM21]');
        }
        else {
          die("Not an image [EsE5GPU3]");
        }
        return true;
      }, (files, rejected) => {
        dieIf(files.length !== 1, 'DwE5UPM2');
        FileAPI.upload({   // a bit dupl code [2UK503]
          url: '/-/upload-avatar?userId=' + this.props.user.id,
          headers: { 'X-XSRF-TOKEN': getSetCookie('XSRF-TOKEN') },
          files: { images: files },
          imageOriginal: false,
          imageTransform: {
            // Sync with $tinyAvatarSize and $smallAvatarSize, so the browser won't
            // need to scale the image. [7UKWQ1]
            'tiny': { width: 28, height: 28, type: 'image/jpeg', quality: 0.95 },
            'small': { width: 50, height: 50, type: 'image/jpeg', quality: 0.95 },// ?? 50 ??
            'medium': { maxWidth: 350, maxHeight: 350, type: 'image/jpeg', quality: 0.8 },
          },
          // This is per file.
          fileprogress: (event, file, xhr, options) => {
            if (!this.state.isUploadingProfilePic) {
              this.setState({ isUploadingProfilePic: true });
              pagedialogs.getProgressBarDialog().open(t.UploadingDots, () => {
                this.setState({ uploadCancelled: true });
                xhr.abort("Intentionally cancelled [EsM2FL54]");
              });
            }
            else {
              const percent = event.loaded / event.total * 100;
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
    const store: Store = this.props.store;
    const user: MemberInclDetails = this.props.user;
    const stats: UserStats = this.props.stats;
    const me: Myself = this.props.me;
    const isGone = user_isGone(user);
    let suspendedInfo;
    if (user.suspendedAtEpoch) {
      const thisUserIsWhat = (<number | string> user.suspendedTillEpoch) === 'Forever'
          ? t.upp.UserBanned
          : t.upp.UserSuspended(moment(user.suspendedTillEpoch).format('YYYY-MM-DD HH:mm'));
      suspendedInfo = r.div({},
        thisUserIsWhat, r.br(),
        t.upp.ReasonC + user.suspendedReason);
    }

    const deletedInfo = !isGone ? null :
      r.p({}, t.upp.DeactOrDeld);

    const isMe = me.id === user.id;

    let isAGroup;
    if (user.isGroup) {
      isAGroup = t.upp.isGroup;
    }

    let isWhatInfo = null;
    if (isGuest(user)) {
      isWhatInfo = t.upp.isGuest;
    }
    if (user.isModerator) {
      isWhatInfo = t.upp.isMod;
    }
    if (user.isAdmin) {
      isWhatInfo = t.upp.isAdmin;
    }
    if (isWhatInfo) {
      isWhatInfo = r.span({ className: 'dw-is-what' }, isWhatInfo);
    }

    const thatIsYou = !isMe ? null :
      r.span({ className: 'esProfile_isYou' }, t.upp.you);

    const avatar = user.avatarMediumHashPath
        ? r.img({ src: eds.uploadsUrlPrefix + user.avatarMediumHashPath })
        : debiki2.avatar.Avatar({ user: user, size: AvatarSize.Medium, ignoreClicks: true });

    const uploadAvatarBtnText = user.avatarMediumHashPath ? t.upp.ChangePhoto : t.upp.UploadPhoto;
    const avatarMissingClass = user.avatarMediumHashPath ? '' : ' esMedAvtr-missing';

    const anyUploadPhotoBtn = isGone || isGuest(user) || !isMe && !isStaff(me) ? null :
        r.div({},
          // File inputs are ugly, so we hide the file input (size 0 x 0) and activate
          // it by clicking a beautiful button instead:
          PrimaryButton({ id: 'e2eChooseAvatarInput', className: 'esMedAvtr_uplBtn',
              onClick: this.selectAndUploadAvatar }, uploadAvatarBtnText),
          r.input({ name: 'files', type: 'file', multiple: false, // dupl code [2UK503]
              ref: 'chooseAvatarInput',
              style: { width: 0, height: 0, position: 'absolute', left: -999 }}));


    const adminButton = !isStaff(me) || isGuest(user) ? null :
        LinkButton({ href: linkToUserInAdminArea(user.id), className: 's_UP_AdminB' },
          "View in Admin Area");

    const sendMessageButton = !store_maySendDirectMessageTo(store, user) ? null :
        PrimaryButton({ onClick: this.sendMessage, className: 's_UP_SendMsgB' },
          t.SendMsg);

    // COULD prefix everything inside with s_UP_Ab(out) instead of just s_UP.
    return r.div({ className: 's_UP_Ab dw-user-bar clearfix' },
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
          r.h1({ className: 'esUP_Un' }, user.username, thatIsYou, isAGroup),
          r.h2({ className: 'esUP_FN' }, user.fullName, isWhatInfo),
          r.div({ className: 's_UP_About' }, user.about),
          suspendedInfo,
          deletedInfo)),
        !stats ? null : r.div({ className: 's_UP_Ab_Stats' },
          r.div({ className: 's_UP_Ab_Stats_Stat' },
            t.upp.JoinedC + moment(stats.firstSeenAt).fromNow()),
          r.div({ className: 's_UP_Ab_Stats_Stat' },user.isGroup ? null :
            t.upp.PostsMadeC + userStats_totalNumPosts(stats)),
          !stats.lastPostedAt ? null : r.div({ className: 's_UP_Ab_Stats_Stat' },
            t.upp.LastPostC + moment(stats.lastPostedAt).fromNow()),
          r.div({ className: 's_UP_Ab_Stats_Stat' },
            t.upp.LastSeenC + moment(stats.lastSeenAt).fromNow()),
          r.div({ className: 's_UP_Ab_Stats_Stat' },
            t.upp.TrustLevelC + trustLevel_toString(user.effectiveTrustLevel))));
  }
});


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
