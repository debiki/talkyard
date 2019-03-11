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
/// <reference path="review-posts.staff.ts" />

//------------------------------------------------------------------------------
   namespace debiki2.admin {
//------------------------------------------------------------------------------

const r = ReactDOMFactories;


export const UsersTab = createFactory({
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
            LiNavLink({ to: bp + 'invited', className: 'e_InvitedUsB' }, "Invite"))),
        r.div({ className: 's_A_Us' },
          Switch({},
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


const InvitedUsersPanel = createFactory({
  displayName: 'InvitedUsersPanel',

  getInitialState: function() {
    return {
      invites: null
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
      this.setState({ invites: [...this.state.invites, ...invites] });
    });
  },

  render: function() {
    const store: Store = this.props.store;
    const settings: SettingsVisibleClientSide = store.settings;
    const disableInvites = settings.ssoUrl;
    const invites: Invite[] = this.state.invites;
    let introText;
    let listOfInvites;
    if (!_.isArray(invites)) {
      introText = "Loading ...";
    }
    else {
      introText = _.isEmpty(invites) ?
          "No invites sent." : "People who have been invited to this site:";
      const nowMs = Date.now();
      listOfInvites = invites.map((invite: Invite) => users.InviteRowWithKey(
          { invite, store, nowMs, showSender: true }));
    }

    const tableBodyIfLoaded = !listOfInvites ? null :
      r.tbody({ className: 's_InvsL'}, listOfInvites);

    // Could break out rendering code to separate module — also used in user profile. [8HRAE3V]
    return (
      r.div({},
        Button({ onClick: this.sendInvites, className: 's_AA_Us_Inv_SendB', disabled: disableInvites },
          "Invite people" + (disableInvites ? " — disabled, SSO in use" : '')),
        r.div({ className: 'esAdminSectionIntro' },
          r.p({}, introText)),
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


const UserList = createFactory({
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
    console.log("Unmounting UserList [TyD4FKQW2]"); // [5QKBRQ]
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


const UserRow = createFactory({
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

    let actions;
    if (this.props.whichUsers !== 'WaitingUsers') {
      // Don't show any actions.
    }
    else if (this.state.wasJustApproved || this.state.wasJustRejected) {
      actions = rFragment({},
        this.state.wasJustApproved ? "Approved. " : "Rejected. ",
        Button({ onClick: this.undoApproveOrReject, className: 'e_UndoApprRjctB' }, "Undo"));
    }
    else {
      actions = rFragment({},
          Button({ onClick: this.approveUser, className: 'e_ApproveUserB' }, "Approve"),
          Button({ onClick: this.rejectUser, className: 'e_RejectUserB'  }, "Reject"));
    }

    const actionsCell = actions
        ? r.td({}, actions)
        : null;

    const usernameElem = r.span({ className: 'dw-username' }, user.username);
    let fullNameElem;
    if (user.fullName) {
      fullNameElem = r.span({ className: 'dw-fullname' }, ' (' + user.fullName + ')');
    }

    const threatLevel = user_threatLevel(user);
    const isDeactivated = !!user.deactivatedAt;
    const isDeleted = !!user.deletedAt;

    const modifiers = rFragment({},
        user.isApproved !== false ? null :
            r.span({ className: 's_A_Us_UsL_U_Modif' }, " — rejected"),
        !isStaff(user) ? null :
            r.span({ className: 's_A_Us_UsL_U_Modif' }, user.isAdmin ? " — admin" : " — moderator"),
        !threatLevel || threatLevel < ThreatLevel.MildThreat ? null :
            r.span({ className: 's_A_Us_UsL_U_Modif' },
              threatLevel === ThreatLevel.MildThreat ? " — mild threat" : " — moderate threat"),
        !user_isSuspended(user, nowMs) ? null :
            r.span({ className: 's_A_Us_UsL_U_Modif' }, " — suspended"),
        !isDeactivated || isDeleted ? null :
            r.span({ className: 's_A_Us_UsL_U_Modif' }, " — deactivated"),
        !isDeleted ? null :
          r.span({ className: 's_A_Us_UsL_U_Modif' }, " — deleted"));

    const emailNotVerified = !user.email || user.emailVerifiedAtMs ? null :
      r.span({ className: 's_A_Us_UsL_U_Modif e_EmNotVerfd' }, " — not verified");

    let lastSeen;
    let topicsViewed;
    let timeSpentReading;
    let numPosts;

    if (user.anyUserStats) {
      const s = user.anyUserStats;
      lastSeen = debiki.prettyLetterDuration(s.lastSeenAt, nowMs);
      topicsViewed = s.numChatTopicsEntered + s.numDiscourseTopicsEntered;
      timeSpentReading = debiki.prettyLetterDuration(s.numSecondsReading * 1000);
      numPosts =
          s.numChatMessagesPosted + s.numChatTopicsCreated +
          s.numDiscourseRepliesPosted + s.numDiscourseTopicsCreated;
    }

    const createdAt = debiki.prettyLetterDuration(user.createdAtEpoch, nowMs);

    return (
      r.tr({},
        r.td({}, Link({ to: linkToUserInAdminArea(user.id) }, usernameElem, fullNameElem), modifiers),
        r.td({}, user.email, emailNotVerified),
        actionsCell,
        r.td({}, lastSeen),
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
