/*
 * Copyright (c) 2015-2016 Kaj Magnus Lindberg
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
/// <reference path="../staff-prelude.staff.ts" />

//------------------------------------------------------------------------------
   namespace debiki2.admin {
//------------------------------------------------------------------------------

const r = ReactDOMFactories;


export const UsersTab = createFactory<any>({
  displayName: 'UsersTab',

  getInitialState: function() {
    return {};
  },

  render: function() {
    const settings: Settings = this.props.currentSettings;
    const childProps = { store: this.props.store, settings };
    const bp = '/-/admin/users/';  // users base path

    const showWaiting = settings.userMustBeApproved;

    return (
      r.div({},
        r.div({ className: 'dw-sub-nav' },
          r.ul({ className: 'nav nav-pills' },
            LiNavLink({ to: bp + 'invited', className: 'e_InvitedUsB' }, "Invite"),
            LiNavLink({ to: bp + 'enabled', className: 'e_EnabledUsB' }, "Enabled"),
            showWaiting ? LiNavLink({ to: bp + 'waiting', className: 'e_WaitingUsB' }, "Waiting") : null,
            LiNavLink({ to: bp + 'new', className: 'e_NewUsB' }, "New"),
            LiNavLink({ to: bp + 'staff', className: 'e_StaffUsB' }, "Staff"),
            LiNavLink({ to: bp + 'suspended', className: 'e_SuspendedUsB' }, "Suspended"),
            //LiNavLink({ to: bp + 'silenced' }, "Silenced"), — not yet impl
            //Or: Stopped? = Banned or Suspended or Silenced or Shadowbanned
            // The internal name, "Threats", would sound a bit worrisome? "Under surveillance"
            // or just "Watching" sounds better?
            LiNavLink({ to: bp + 'watching', className: 'e_WatchingUsB' }, "Watching"),
            LiExtLink({ href: '/-/groups/', className: 'e_GrpsB' }, "Groups ",
                r.span({ className: 'icon-link-ext' })))),
        r.div({ className: 's_A_Us' },
          Switch({},
            // [React_Router_v51] skip render(), use hooks and useParams instead.
            //
            Route({ path: bp + 'enabled', render: () => EnabledUsersPanel(childProps) }),
            showWaiting ? Route({ path: bp + 'waiting', render: () => WaitingUsersPanel(childProps) }) : null,
            Route({ path: bp + 'new', render: () => NewUsersPanel(childProps) }),
            Route({ path: bp + 'staff', render: () => StaffUsersPanel(childProps) }),
            Route({ path: bp + 'suspended', render: () => SuspendedUsersPanel(childProps) }),
            //Route({ path: bp + 'silenced', render: () => SilencedUsersPanel(childProps) }),
            Route({ path: bp + 'watching', render: () => ThreatsUsersPanel(childProps) }),
            Route({ path: bp + 'invited', render: () => InvitedUsersPanel(childProps) }),
            Route({ path: bp + 'id/:userId', render: (ps) => UserProfileAdminView({ ...childProps, ...ps }) }),
            ))));
  }
});


function EnabledUsersPanel(props) {
  return UserList({ whichUsers: 'EnabledUsers',
      intro: r.p({ className: 'e_EnabledUsersIntro' },
        "Enabled user accounts: (sorted by sign-up date, recent first)") });
}

function WaitingUsersPanel(props) {
  return UserList({ whichUsers: 'WaitingUsers',
      intro: r.p({ className: 'e_WaitingUsersIntro' },
        "Users who have signed up to join this site, and are waiting for you to approve them:") });
}

function NewUsersPanel(props) {
  return UserList({ whichUsers: 'NewUsers',
      intro: r.p({ className: 'e_NewUsersIntro' },
        "Users who signed up recently:") });
}

function StaffUsersPanel(props) {
  return UserList({ whichUsers: 'StaffUsers',
      intro: r.p({ className: 'e_StaffUsersIntro' },
        "Administrators and moderators:") });
}

function SuspendedUsersPanel(props) {
  return UserList({ whichUsers: 'SuspendedUsers',
      intro: r.p({ className: 'e_SuspendedUsersIntro' },
        "These users are suspended; they cannot login:") });
}

/*function SilencedUsersPanel(props) {
  return UserList({ whichUsers: 'SilencedUsers',
      intro: r.p({},
        "These users can login, but cannot do anything except for reading, and replying to " +
        "direct messages from staff (so you can talk with them about why they got silenced)") });
}*/

function ThreatsUsersPanel(props) {
  return UserList({ whichUsers: 'ThreatUsers',
      intro: r.p({ className: 'e_ThreatsUsersIntro' },
        r.b({}, "Mild"), " threat users: You'll be notified about all their posts.", r.br(),
        r.b({}, "Moderate"), " threat users: Their posts won't be visible until " +
          "the posts have been approved by staff.") });
}



// COULD break out and reuse in  user-invites.more.ts ?  [3GK0YU2]
//
const InvitedUsersPanel = createFactory<any>({
  displayName: 'InvitedUsersPanel',

  getInitialState: function() {
    return {
      invites: null,
      onlyPending: false,
      onlyOnePerPerson: true,
    };
  },

  componentDidMount: function() {
    Server.loadAllInvites(invites => {
      this.setState({ invites: invites });
    });
  },

  componentWillUnmount: function() {
    this.isGone = true;
  },

  sendInvites: function() {
    // Don't leave the Admin Area and go to the user's page, to send the invite
    // — usability testing shows that this makes people confused.
    // Instead open the dialog here, in the admin area.
    users.openInviteDialog((invites: Invite[]) => {
      if (this.isGone) return;
      // Invites sent at the same time, are sorted by email address. [inv_sort_odr]
      const invitesSorted = [...invites];
      arr_sortAlphaInPlace(invitesSorted, inv => inv.invitedEmailAddress);
      this.setState({ invites: [...invites, ...this.state.invites] });
    });
  },

  render: function() {
    const store: Store = this.props.store;
    const settings: SettingsVisibleClientSide = store.settings;
    const disableInvites = settings.ssoUrl;
    const invites: Invite[] = this.state.invites;
    const onlyPending = this.state.onlyPending;
    const onlyOnePerPerson = this.state.onlyOnePerPerson;
    let introText;
    let listOfInvites;
    if (!_.isArray(invites)) {
      introText = "Loading ...";
    }
    else {
      introText = _.isEmpty(invites) ?
          "No invites sent." : "People who have been invited to this site:";
      const nowMs = Date.now();
      const idsDone = {};
      const invitesFiltered = _.filter(invites, (invite: Invite) => {
        if (onlyOnePerPerson) {
          // Show any accepted invite first, or if none accepted,
          // then show the most recent sent. Already sorted by time, right.
          // (Harmless bug: Will show two invites, if the user accepted an old
          // invite, after a new was sent.)
          if (idsDone[invite.invitedEmailAddress] && !invite.acceptedAtEpoch)
            return false;
          idsDone[invite.invitedEmailAddress] = true;
        }

        if (onlyPending) {
          if (invite.acceptedAtEpoch || invite.invalidatedAtEpoch)
            return false;
        }
        return true;
      });

      listOfInvites = invitesFiltered.map((invite: Invite) => users.InviteRowWithKey(
          { invite, store, nowMs, showSender: true }));
    }

    const tableBodyIfLoaded = !listOfInvites ? null :
      r.tbody({ className: 's_InvsL'}, listOfInvites);

    // Could break out rendering code to separate module — also used in user profile. [8HRAE3V]
    return (
      r.div({ className: 's_AA_Us_Inv' },
        Button({ onClick: this.sendInvites, className: 's_AA_Us_Inv_SendB', disabled: disableInvites },
          "Invite people" + (disableInvites ? " — disabled, SSO in use" : '')),
        r.div({ className: 'esAdminSectionIntro' },
          r.h3({}, introText)),

        Input({ type: 'checkbox', className: 'e_OnlPend',
            label: "Hide old invites, show only pending",
            checked: onlyPending,
            onChange: () => this.setState({ onlyPending: !onlyPending }) }),

        Input({ type: 'checkbox', className: 'e_OnePerP',
            label: "Show most recent invite only, per person",
            checked: onlyOnePerPerson,
            onChange: () => this.setState({ onlyOnePerPerson: !onlyOnePerPerson }) }),

        // Dupl table headers [3GK0YU2]
        r.table({ className: 'dw-invites-table' },
          r.thead({},
            r.tr({},
              r.th({}, "Invited email"),
              r.th({}, "Member who accepted"),
              r.th({}, "Invitation accepted"),
              r.th({}, "Invitation sent"),
              r.th({}, "Sent by"))),
          tableBodyIfLoaded)));
  }
});


const UserList = createFactory<any>({
  displayName: 'UserList',

  componentDidMount: function() {
    this.loadUsers();
  },

  componentDidUpdate: function(prevProps) {
    if (prevProps.whichUsers !== this.props.whichUsers) {
      this.setState({ users: null });
      this.loadUsers();
    }
  },

  componentWillUnmount: function() {
    logD("Unmounting UserList [TyD4FKQW2]"); // [5QKBRQ]
    this.isGone = true;
  },

  loadUsers: function(prevProps) {
    Server.listCompleteUsers(this.props.whichUsers, users => {
      if (this.isGone) return;
      this.setState({ users });
    });
  },

  render: function() {
    if (!this.state || !this.state.users)
      return r.p({}, "Loading...");

    const now = new Date().getTime();
    let userRows = this.state.users.map((user: UserInclDetailsWithStats) => {
      return UserRow({ user: user, now: now, key: user.id, whichUsers: this.props.whichUsers });
    });

    if (!this.state.users.length)
      userRows = r.tr({}, r.td({ className: 'e_NoSuchUsers' }, "No such users."));

    const actionHeader = this.props.whichUsers === 'WaitingUsers'
        ? r.th({}, "Actions")
        : null;

    return (r.div({},
      r.div({ className: 'esAdminSectionIntro' }, this.props.intro),
      r.div({ className: 'dw-users-to-review e_AdminUsersList' },
        r.table({ className: 'table' },
          r.thead({},
            r.tr({},
              r.th({}, "Username (Full Name)"),
              r.th({}, "Email"),
              actionHeader,
              r.th({}, "Last seen"),
              r.th({}, "Last posted"),
              r.th({}, "Topics viewed"),
              r.th({}, "Time spent reading"),
              r.th({}, "Num posts"),
              //r.th({}, "Country"),
              //r.th({}, "URL"),
              r.th({}, "Created"))),
          r.tbody({},
            userRows)))));
  }
});


const UserRow = createFactory<any>({
  displayName: 'UserRow',

  getInitialState: function() {
    return {};
  },

  approveUser: function() {
    const user: UserInclDetailsWithStats = this.props.user;
    Server.editMember(user.id, EditMemberAction.SetApproved, () => {
      this.setState({ wasJustApproved: true });
    });
  },

  rejectUser: function() {
    const user: UserInclDetailsWithStats = this.props.user;
    Server.editMember(user.id, EditMemberAction.SetUnapproved, () => {
      this.setState({ wasJustRejected: true });
    });
  },

  undoApproveOrReject: function() {
    const user: UserInclDetailsWithStats = this.props.user;
    Server.editMember(user.id, EditMemberAction.ClearApproved, () => {
      this.setState({ wasJustRejected: false, wasJustApproved: false });
    });
  },

  render: function() {
    const user: UserInclDetailsWithStats = this.props.user;
    const nowMs: WhenMs = this.props.now;

    let actions: RElm | U;
    if (this.props.whichUsers !== 'WaitingUsers') {
      // Don't show any actions.
    }
    else if (this.state.wasJustApproved || this.state.wasJustRejected) {
      actions = rFr({},
        this.state.wasJustApproved ? "Approved. " : "Rejected. ",
        Button({ onClick: this.undoApproveOrReject, className: 'e_UndoApprRjctB' }, "Undo"));
    }
    else {
      actions = rFr({},
          Button({ onClick: this.approveUser, className: 'e_ApproveUserB' }, "Approve"),
          Button({ onClick: this.rejectUser, className: 'e_RejectUserB'  }, "Reject"));
    }

    const actionsCell = actions
        ? r.td({}, actions)
        : null;

    const usernameElem = r.span({ className: 'dw-username' }, user.username);
    let fullNameElem: RElm | U;
    if (user.fullName) {
      fullNameElem = r.span({ className: 'dw-fullname' }, ' (' + user.fullName + ')');
    }

    const threatLevel = user_threatLevel(user);
    const isDeactivated = !!user.deactivatedAt;
    const isDeleted = !!user.deletedAt;

    const modifiers = rFr({},
        user.isApproved !== false ? null :
            r.span({ className: 's_A_Us_UsL_U_Modif' }, " — rejected"),
        !isStaff(user) ? null :
            r.span({ className: 's_A_Us_UsL_U_Modif' }, user.isAdmin ? " — admin" : " — moderator"),
        !threatLevel || threatLevel < ThreatLevel.MildThreat ? null :
            r.span({ className: 's_A_Us_UsL_U_Modif' },
              threatLevel === ThreatLevel.MildThreat ? " — mild threat" : " — moderate threat"),
        !user_isSuspended(user, nowMs) ? null :
            r.span({ className: 's_A_Us_UsL_U_Modif' }, pat_isBanned(user) ? " — banned" : " — suspended"),
        !isDeactivated || isDeleted ? null :
            r.span({ className: 's_A_Us_UsL_U_Modif' }, " — deactivated"),
        !isDeleted ? null :
          r.span({ className: 's_A_Us_UsL_U_Modif' }, " — deleted"));


    const emailNotVerified = !user.email || user.emailVerifiedAtMs ? null :
      r.span({ className: 's_A_Us_UsL_U_Modif e_EmNotVerfd' }, " — not verified");

    let lastSeen: St | NU;
    let lastPostedAt: St | NU;
    let topicsViewed: Nr | U;
    let timeSpentReading: St | NU;
    let numPosts: Nr | U;

    if (user.anyUserStats) {
      // If presence disabled (!Settings.enablePresence), most info here is excluded.
      // Sometimes it'd be good, though, if [admins_see_presence].  And sometimes we'd want to
      // hide presence info up to when presence got (re)enabled. [see_presence_start_date]
      const s = user.anyUserStats;
      lastSeen = !s.lastSeenAt ? null : debiki.prettyLetterDuration(s.lastSeenAt, nowMs);
      lastPostedAt = !s.lastPostedAt ? null : debiki.prettyLetterDuration(s.lastPostedAt, nowMs);
      // (Should be enough to check just one, when adding. Either none or all should be set.)
      topicsViewed = !isVal(s.numChatTopicsEntered) ? null :
                            s.numChatTopicsEntered + s.numDiscourseTopicsEntered;
      timeSpentReading = !isVal(s.numSecondsReading) ? null :
                            debiki.prettyLetterDuration(s.numSecondsReading * 1000);
      numPosts = !isVal(s.numChatMessagesPosted) ? null :
          s.numChatMessagesPosted + s.numChatTopicsCreated +
          s.numDiscourseRepliesPosted + s.numDiscourseTopicsCreated;
    }

    const createdAt = !user.createdAtEpoch ? null :
                            debiki.prettyLetterDuration(user.createdAtEpoch, nowMs);

    return (
      r.tr({},
        r.td({}, Link({ to: linkToUserInAdminArea(user) }, usernameElem, fullNameElem), modifiers),
        r.td({}, user.email, emailNotVerified),
        actionsCell,
        r.td({}, lastSeen),
        r.td({}, lastPostedAt),
        r.td({}, topicsViewed),
        r.td({}, timeSpentReading),
        r.td({}, numPosts),
        //r.td({}, user.country), — usually empty, or inconsistent
        //r.td({}, user.url),
        r.td({}, createdAt)));
  }
});


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
