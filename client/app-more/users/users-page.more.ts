/**
 * Copyright (c) 2014-2018 Kaj Magnus Lindberg
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

/// <reference path="../../../node_modules/moment/moment.d.ts" />
/// <reference path="../more-prelude.more.ts" />
/// <reference path="user-invites.more.ts" />
/// <reference path="user-notifications.more.ts" />
/// <reference path="user-drafts-etc.more.ts" />
/// <reference path="user-preferences.more.ts" />
/// <reference path="user-activity.more.ts" />
/// <reference path="user-tasks.more.ts" />
/// <reference path="groups-page.more.ts" />

//------------------------------------------------------------------------------
   namespace debiki2.users {
//------------------------------------------------------------------------------

const r = ReactDOMFactories;



export const UsersHomeComponent = createReactClass(<any> {
  displayName: 'UsersHomeComponent',

  render: function() {
    return rFr({},
        // COULD show server announcements, but then need to load `store` here,
        // and then maybe should pass it to the children? Let's think about later.
        r.div({ className: 'c_SrvAnns' },
          debiki2.help.anyMaintMsg()),
        Switch({},
          // Users
          Route({ path: UsersRoot, component: BadUrlComponent, exact: true }),
          RedirPath({ path: UsersRoot + ':usernameOrId', exact: true,
            to: (params) => UsersRoot + params.usernameOrId + '/activity' }),
          Route({ path: UsersRoot + ':usernameOrId/:section?/:subsection?',
              component: UserPageComponent }),
          // Groups
          Route({ path: GroupsRoot, component: ListGroupsComponent, exact: true }),
          RedirPath({ path: GroupsRoot + ':usernameOrId', exact: true,
            to: (params) => GroupsRoot + params.usernameOrId + '/members' }),
          Route({ path: GroupsRoot + ':usernameOrId/:section?/:subsection?',
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
    this.hasAutoOpenedEditorFor = {};
    const store = debiki2.ReactStore.allData();
    return {
      store,
      myId: store.me.id,
      user: null,
    };
  },

  onChange: function() {
    const myOldId = this.state.myId;
    const store: Store = debiki2.ReactStore.allData();
    const iAmSbdElse = myOldId !== store.me.id;
    this.setState({
      store: store,
      myId: store.me.id,
      // If we've logged in as admin or the pat henself, the config pat prefs
      // code assumes we have access to pat's private fields. [pat_prof_fields]
      // So, until reloaded with those fields included, don't show any pat at all.
      user: iAmSbdElse ? null : this.state.user,
    });
    if (iAmSbdElse) {
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

    const newUsernameOrId: string = this.props.match.params.usernameOrId;
    const maybeOldUser: UserInclDetails | NU = this.state.user;
    const isSameUser = maybeOldUser && (
        '' + maybeOldUser.id === newUsernameOrId || maybeOldUser.username === newUsernameOrId);
    if (!isSameUser) {
      this.loadUserAnyDetails();
    }
  },

  componentWillUnmount: function() {
    this.isGone = true;
  },

  loadUserAnyDetails: function(redirectToCorrectUsername?: false) {
    const location: RouteLocation = this.props.location;
    const params = this.props.match.params;
    const usernameOrId: string | number = params.usernameOrId;

    if (this.nowLoading === usernameOrId) return;
    this.nowLoading = usernameOrId;

    const shallComposeMessage =
      this.props.location.hash.indexOf(FragActionHashComposeMessage) >= 0;

    // We might be showing the wrong user currently, causing e2e tests to
    // see the wrong UI state for fractions of a second, and toggle, say,
    // a checkbox in the wrong way.
    // Set pat to null until new pat fetched, so the e2e tests will have to
    // wait until the new UI state for the correct user appears.
    this.setState({ user: null });

    Server.loadPatVvbPatchStore(usernameOrId,
          // CLEAN_UP don't merge objs server side and pick apart here
          // — just send them as separate fields from the start. [load_pat_stats_grps]
          ({ user, groupsMaySee }: LoadPatVvbResponse) => {
      const stats: UserStats | undefined = user.anyUserStats;
      this.nowLoading = null;
      if (this.isGone) return;
      // This setState will trigger a rerender immediately, because we're not in a React event handler.
      // But when rerendering here, the url might still show a user id, not a username. (5GKWS20)
      this.setState({ user, stats, groupsMaySee });
      // 1) In case the user has changed his/her username, and userIdOrUsername is his/her *old*
      // name, user.username will be the current name — then show current name in the url [8KFU24R].
      // Also 2) if user id specified, and the user is a member (they have usernames) show
      // username instead, And 3) redir from /-/users/ to /-/groups/ if the member is a group
      // not a user, and vice versa.
      const isNotLowercase = _.isString(usernameOrId) && usernameOrId !== usernameOrId.toLowerCase();
      const correctRoot = user.isGroup ? GroupsRoot : UsersRoot;
      const isCorrectRoot = location.pathname.indexOf(correctRoot) === 0;
      if ((user.username && (user.username.toLowerCase() !== usernameOrId || isNotLowercase) &&
          redirectToCorrectUsername !== false) || !isCorrectRoot) {
        let newUrl = correctRoot + user.username.toLowerCase();
        if (params.section) newUrl += '/' + params.section;
        if (params.subsection) newUrl += '/' + params.subsection;
        newUrl += this.props.location.search + this.props.location.hash;
        this.props.history.replace(newUrl);
      }
      if (shallComposeMessage) {
        this.maybeOpenMessageEditor(user.id);
      }
    }, () => {
      // Error. We might not be allowed to see the user — we've set state.user
      // to null above already. So, need not:
      //if (this.isGone) return;
      //this.setState({ user: null });
    });
  },

  updatePat: function(pat: PatVb) {
    // Keep groupIdsMaySee (but not  anyUserStats), although maybe shouldn't
    // incl at all?   [load_pat_stats_grps]
    const oldUser = this.state.user;
    this.setState({ user: { ...pat, groupIdsMaySee: oldUser.groupIdsMaySee } });
  },

  maybeOpenMessageEditor: function(userId: number) {  // [4JABRF0]
    // Cannot message system user or guests.
    if (userId <= SystemUserId)
      return;

    // It's annoying if the editor pops up again, if browser-navigating back to this user's profile.
    if (this.hasAutoOpenedEditorFor[userId])
      return;

    const myUserId = ReactStore.getMe().id;
    if (userId === myUserId)
      return;

    this.hasAutoOpenedEditorFor[userId] = true;
    editor.openToWriteMessage(userId);
  },

  render: function() {
    const props = this.props;
    const state = this.state;
    const store: Store = state.store;
    const me: Myself = store.me;
    const user: UserDetailsStatsGroups = state.user;  // ParticipantAnyDetails = better class?
    const usernameOrId = props.match.params.usernameOrId;

    // Wait until url updated to show username, instead of id, to avoid mounting & unmounting
    // sub comoponents, which could result in duplicated load-data requests.  (5GKWS20)
    if (!user || !me || (user.username && isDigitsOnly(usernameOrId)))
      return r.p({ className: 'container e_LdngUP' }, t.Loading);

    const imStaff = isStaff(me);
    const userGone = user_isGone(user);
    const pathToUser = pathTo(user);

    const showSelfAdmins = me.isAdmin || (!userGone && me.isAuthenticated && me.id === user.id);
    const showSelfMods = showSelfAdmins || imStaff;
    const showSelfTrusted = showSelfMods || user_trustLevel(me) >= TrustLevel.Trusted;
    const linkStart = pathToUser + '/';

    const membersNavItem = !user.isGroup ? null :
      LiNavLink({ to: linkStart + 'members', className: 'e_UP_MbrsB' }, t.Members);

    const activityNavItem = user.isGroup ? null :
      LiNavLink({ to: linkStart + 'activity', className: 'e_UP_ActivityB' }, t.Activity);

    const notificationsNavItem = !showSelfMods || user.isGroup ? null :
      LiNavLink({ to: linkStart + 'notifications', className: 'e_UP_NotfsB' }, t.Notifications);

    const draftsEtcNavItem = !showSelfAdmins || user.isGroup ? null :
      LiNavLink({ to: linkStart + 'drafts-etc', className: 'e_UP_DrftsB' }, t.upp.DraftsEtc);

    const tasksNavItem = !showSelfTrusted || user.isGroup ? null :
      LiNavLink({ to: linkStart + 'tasks', className: 'e_UP_TsksB' }, "Tasks"); // I18N

    // If included or not, tested here:
    //      - may-see-email-adrs.2br.d  TyTSEEEMLADRS01.TyT0ACSPREFS01
    const preferencesNavItem = !showSelfMods && !user.email ? null :
      LiNavLink({ to: linkStart + 'preferences', id: 'e2eUP_PrefsB' }, t.upp.Preferences);

    const invitesNavItem = !showSelfMods || !store_maySendInvites(store, user).value ? null :
      LiNavLink({ to: linkStart + 'invites', className: 'e_InvTabB' }, t.upp.Invites);

    // Tests:
    //      - may-see-email-adrs.2br.d  TyTSEEEMLADRS01.TyT0ACCESSPERMS04
    const patPermsNavItem = !user.isGroup || !imStaff ? null :
        LiNavLink({ to: linkStart + 'permissions', className: 'e_PermsTabB' },
          "Permissions"); // I18N

    const childProps: PatTopPanelProps & PatStatsPanelProps = {
      store: store,
      me: me, // CLEAN_UP try to remove, incl already in `store`
      user: user,
      groupsMaySee: state.groupsMaySee,
      stats: state.stats,
      reloadUser: this.loadUserAnyDetails,
    };

    const u = (user.isGroup ? GroupsRoot : UsersRoot) + ':usernameOrId/';

    const childRoutes = Switch({},
      // [React_Router_v51] skip render(), use hooks and useParams instead.
      Route({ path: u + 'activity', exact: true, render: () => {
        const hash = this.props.location.hash;
        return Redirect({ to: pathToUser + '/activity/posts' + hash });
      }}),

      !membersNavItem ? null :
      Route({ path: u + 'members', render: (ps) => GroupMembers({ ...childProps, ...ps }) }),

      !activityNavItem ? null :
      Route({ path: u + 'activity', render: (ps) => UsersActivity({ ...childProps, ...ps }) }),

      !notificationsNavItem ? null :
      Route({ path: u + 'notifications', render: () => UserNotifications(childProps) }),

      !draftsEtcNavItem ? null :
      Route({ path: u + 'drafts-etc', render: () => UserDrafts(childProps) }),

      !tasksNavItem ? null :
      Route({ path: u + 'tasks', render: (ps) => UserTasks({ ...childProps, ...ps }) }),

      !preferencesNavItem ? null :
      Route({ path: u + 'preferences', render: (ps) => {
        return UserPreferences({ ...childProps, updatePat: this.updatePat, ...ps });
      } }),

      !invitesNavItem ? null :
      Route({ path: u + 'invites', render: () => {
        return UserInvites(childProps);
      } }),

      !patPermsNavItem ? null :
      Route({ path: u + 'permissions', render: (ps) => {
        return PatPerms({ user: user as GroupVb, store, updatePat: this.updatePat });
      } }),

      Route({ path: u + '*', render: () => {
        return r.p({ className: 'c_BadRoute' },
              `You're at: `, r.samp({}, props.location.pathname),  // I18N
              ` — nothing here to see.`);
      } }),
      );

    return (
      r.div({ className: 'container esUP' },
        PatTopPanel(childProps),
        r.ul({ className: 'dw-sub-nav nav nav-pills' },
          membersNavItem,
          activityNavItem,
          notificationsNavItem,
          draftsEtcNavItem,
          tasksNavItem,
          invitesNavItem,
          preferencesNavItem,
          patPermsNavItem),
        childRoutes));
  }
});



interface PatTopPanelState {
  isUploadingProfilePic?: Bo;
  uploadCancelled?: Bo;
}


const PatTopPanel = createComponent({
  displayName: 'PatTopPanel',

  getInitialState: function() {
    return {};
  },

  componentDidMount: function() {
    Server.loadEditorAndMoreBundles(this.createUploadAvatarButton);
  },

  selectAndUploadAvatar: function() {
    this.refs.chooseAvatarInput.click();
  },

  createUploadAvatarButton: function() {
    const props: PatTopPanelProps = this.props;
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
          url: '/-/upload-avatar?userId=' + props.user.id,
          headers: { 'X-XSRF-TOKEN': getXsrfCookie() },
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
            const state: PatTopPanelState = this.state;
            if (!state.isUploadingProfilePic) {
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
            const state: PatTopPanelState = this.state;
            if (error && !state.uploadCancelled) {
              pagedialogs.getServerErrorDialog().open(xhr);
            }
            // Reload in any case — perhaps the error happened after the whole image had been
            // uploaded already.
            props.reloadUser();
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
    const props: PatTopPanelProps = this.props;
    editor.openToWriteMessage(props.user.id);
  },

  render: function() {
    const props: PatTopPanelProps = this.props;
    const state: PatTopPanelState = this.state;

    const store: Store = props.store;
    const user: UserDetailsStatsGroups = props.user;
    const groupsMaySee: Group[] = props.groupsMaySee;
    const stats: UserStats | NU = props.stats;
    const me: Myself = props.me;
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
      r.p({ className: 'e_ActDd' }, t.upp.DeactOrDeld);

    const isMe = me.id === user.id;

    let isAGroup;
    if (user.isGroup) {
      isAGroup = t.upp.isGroup;
    }

    let isWhatInfo: St | N = null;
    if (user.isAnon) {
      isWhatInfo = anonStatus_toStr(user.anonStatus);
    }
    else if (isGuest(user)) {
      isWhatInfo = t.upp.isGuest;
    }
    else if (user.isModerator) {
      isWhatInfo = t.upp.isMod;
    }
    else if (user.isAdmin) {
      isWhatInfo = t.upp.isAdmin;
    }

    if (isWhatInfo) {
      isWhatInfo = r.span({ className: 'dw-is-what' }, isWhatInfo);
    }

    const thatIsYou = !isMe ? null :
      r.span({ className: 'esProfile_isYou' }, t.upp.you);

    // COULD_OPTIMIZE Incl the updated pat in the response,
    // maybe via a store patch, and listen via [useStoreEvent]().
    const pubTags = TagListLive({ forPat: user, store, onChanged: props.reloadUser });

    const bio = !!user.bio &&
        r.div({ className: 's_UP_Ab_Bio' }, user.bio);

    const websteUrl = !!user.websiteUrl &&
        r.div({ className: 's_UP_Ab_Webs' },
          r.span({ className: 's_UP_Ab_Webs_Tl' }, "Website: "), // I18N
          // Use plain text, not a link — reduces phishing risk.
          // (Maybe later use clickable links on Full or Trusted member profiles.)
          r.span({ className: 's_UP_Ab_Webs_Ln' }, user.websiteUrl));

    const location = !!user.location &&
        r.div({ className: 's_UP_Ab_Loc' },
          r.span({ className: 's_UP_Ab_Loc_Tl' }, "Location: "),   // I18N
          r.span({ className: 's_UP_Ab_Loc_Tx' }, user.location));

    const avatar = user.avatarMediumHashPath
        ? r.img({ src: linkToUpload(store, user.avatarMediumHashPath) })
        : debiki2.avatar.Avatar({ user: user, origins: store,
              size: AvatarSize.Medium, ignoreClicks: true });

    const uploadAvatarBtnText = user.avatarMediumHashPath ? t.upp.ChangePhoto : t.upp.UploadPhoto;
    const avatarMissingClass = user.avatarMediumHashPath ? '' : ' esMedAvtr-missing';

    const anyUploadPhotoBtn =
        isGone || user.isGroup || isGuest(user) || !isMe && !isStaff(me) ? null :
        r.div({},
          // File inputs are ugly, so we hide the file input (size 0 x 0) and activate
          // it by clicking a beautiful button instead:
          PrimaryButton({ id: 'e2eChooseAvatarInput', className: 'esMedAvtr_uplBtn',
              onClick: this.selectAndUploadAvatar }, uploadAvatarBtnText),
          r.input({ name: 'files', type: 'file', multiple: false, // dupl code [2UK503]
              ref: 'chooseAvatarInput',
              style: { width: 0, height: 0, position: 'absolute', left: -999 }}));

    const adminButton = !isStaff(me) || isGuest(user) ? null :
        LinkButton({ href: linkToUserInAdminArea(user), className: 's_UP_AdminB' },
          "View in Admin Area");

    const sendMessageButton = store_maySendDirectMessageTo(store, user)
        ? PrimaryButton({ onClick: this.sendMessage, className: 's_UP_SendMsgB' },
              t.SendMsg)
        : r.span({ className: 'e_CantDirMsg' });

    const groupList = GroupList(
        user, groupsMaySee, 's_UP_Ab_Stats_Stat_Groups_Group');

    const totNumPosts: Nr | N = user.isGroup ? null : userStats_totalNumPosts(stats);

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
          pubTags,
          bio,
          websteUrl,
          location,
          suspendedInfo,
          deletedInfo)),
        !stats ? null : r.div({ className: 's_UP_Ab_Stats' },
          !stats.firstSeenAt ? null : r.div({ className: 's_UP_Ab_Stats_Stat' },
            t.upp.JoinedC + moment(stats.firstSeenAt).fromNow()),

          !totNumPosts ? null : r.div({ className: 's_UP_Ab_Stats_Stat' },
            t.upp.PostsMadeC + totNumPosts),

          !stats.lastPostedAt ? null : r.div({ className: 's_UP_Ab_Stats_Stat' },
            t.upp.LastPostC + moment(stats.lastPostedAt).fromNow()),

          !stats.lastSeenAt ? null : r.div({ className: 's_UP_Ab_Stats_Stat' },
            t.upp.LastSeenC + moment(stats.lastSeenAt).fromNow()),

          r.div({ className: 's_UP_Ab_Stats_Stat' },
            t.GroupsC,
            r.ul({ className: 's_UP_Ab_Stats_Stat_Groups' },
              groupList)),
          ));
        // Need not show trust level — one will know what the trust level is,
        // by looking at the groups; the first group shows one's trust level's auto group.
        // So, don't need this any more:
        //   r.div({ className: 's_UP_Ab_Stats_Stat' },
        //     t.upp.TrustLevelC + trustLevel_toString(user.effectiveTrustLevel))));
  }
});


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
