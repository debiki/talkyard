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

//xx <reference path="../../typedefs/moment/moment.d.ts" /> — disappeared
declare var moment: any;
/// <reference path="../slim-bundle.d.ts" />
/// <reference path="../more-bundle-already-loaded.d.ts" />
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
            LiNavLink({ to: bp + 'enabled' }, "Enabled"),
            showWaiting ? LiNavLink({ to: bp + 'waiting' }, "Waiting") : null,
            LiNavLink({ to: bp + 'new' }, "New"),
            LiNavLink({ to: bp + 'staff' }, "Staff"),
            LiNavLink({ to: bp + 'suspended' }, "Suspended"),
            //LiNavLink({ to: bp + 'silenced' }, "Silenced"), — not yet impl
            // The internal name, "Threats", would sound a bit worrisome? "Under surveillance"
            // or just "Watching" sounds better?
            LiNavLink({ to: bp + 'watching' }, "Watching"),
            LiNavLink({ to: bp + 'invited' }, "Invite"))),
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


export const EnabledUsersPanel = createFactory({
  displayName: 'EnabledUsersPanel',
  render: function() {
    return UserList({ whichUsers: 'EnabledUsers', intro: r.p({},
      "Enabled user accounts: (sorted by sign-up date, recent first)") });
  }
});

export const WaitingUsersPanel = createFactory({
  displayName: 'WaitingUsersPanel',
  render: function() {
    return UserList({ whichUsers: 'WaitingUsers', intro: r.p({},
        "Users who have signed up to join this site, and are waiting for you to approve them:") });
  }
});

function NewUsersPanel(props) {
  return UserList({ whichUsers: 'NewUsers',
      intro: r.p({},
        "Users who signed up recently:") });
}

function StaffUsersPanel(props) {
  return UserList({ whichUsers: 'StaffUsers',
      intro: r.p({},
        "Administrators and moderators:") });
}

function SuspendedUsersPanel(props) {
  return UserList({ whichUsers: 'SuspendedUsers',
      intro: r.p({},
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
    intro: r.p({},
      r.b({}, "Mild"), " threat users: You'll be notified about all their posts.", r.br(),
      r.b({}, "Moderate"), " threat users: Their posts won't be visible until " +
        "the posts have been approved by staff.") });
}


export const InvitedUsersPanel = createFactory({
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
    this.isGOne = true;
  },

  sendInvites: function() {
    // Don't leave the Admin Area and go to the user's page, to send the invite
    // — usability testing shows that this makes people confused.
    // Instead open the dialog here, in the admin area.
    users.openInviteSomeoneDialog((invite) => {
      if (this.isGone) return;
      this.setState({ invites: this.state.invites.concat(invite) });
    });
  },

  render: function() {
    let store: Store = this.props.store;
    let invites: Invite[] = this.state.invites;
    let introText;
    let listOfInvites;
    if (!_.isArray(invites)) {
      introText = "Loading ...";
    }
    else if (_.isEmpty(invites)) {
      introText = "No invites sent.";
    }
    else {
      introText = "People who have been invited to this site:";
      const nowMs = Date.now();
      listOfInvites = invites.map((invite: Invite) => users.InviteRowWithKey(
          { invite, store, nowMs, showSender: true }));
    }

    // Could break out rendering code to separate module — also used in user profile. [8HRAE3V]
    return (
      r.div({},
        Button({ onClick: this.sendInvites, className: 's_AA_Us_Inv_SendB' }, "Send Invites"),
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
          r.tbody({ className: 's_InvsL'},
            listOfInvites))));
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

  loadUsers: function(prevProps) {
    Server.listCompleteUsers(this.props.whichUsers, users => {
      this.setState({ users });
    });
  },

  render: function() {
    if (!this.state || !this.state.users)
      return r.p({}, 'Loading...');

    const now = new Date().getTime();
    let userRows = this.state.users.map((user: MemberInclDetailsWithStats) => {
      return UserRow({ user: user, now: now, key: user.id, whichUsers: this.props.whichUsers });
    });

    if (!this.state.users.length)
      userRows = r.tr({}, r.td({}, "No such users."));

    const actionHeader = this.props.whichUsers === 'WaitingUsers'
        ? r.th({}, "Actions")
        : null;

    return (r.div({},
      r.div({ className: 'esAdminSectionIntro' }, this.props.intro),
      r.div({ className: 'dw-users-to-review' },
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
    Server.approveRejectUser(this.props.user, 'Approve', () => {
      this.setState({ wasJustApproved: true });
    });
  },

  rejectUser: function() {
    Server.approveRejectUser(this.props.user, 'Reject', () => {
      this.setState({ wasJustRejected: true });
    });
  },

  undoApproveOrReject: function() {
    Server.approveRejectUser(this.props.user, 'Undo', () => {
      this.setState({ wasJustRejected: false, wasJustApproved: false });
    });
  },

  render: function() {
    const user: MemberInclDetailsWithStats= this.props.user;
    const nowMs: WhenMs = this.props.now;

    let actions;
    if (this.props.whichUsers !== 'WaitingUsers') {
      // Don't show any actions.
    }
    else if (this.state.wasJustApproved) {
      actions = r.span({},
        'Approved.',
         Button({ onClick: this.undoApproveOrReject }, 'Undo'));
    }
    else if (this.state.wasJustRejected) {
      actions = r.span({},
        'Rejected.',
         Button({ onClick: this.undoApproveOrReject }, 'Undo'));
    }
    else {
      actions = r.span({},
          Button({ onClick: this.approveUser }, 'Approve'),
          Button({ onClick: this.rejectUser }, 'Reject'));
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
        !isStaff(user) ? null :
            r.span({ className: 's_A_Us_UsL_U_Modif' }, user.isAdmin ? " — admin" : " — moderator"),
        !threatLevel || threatLevel < ThreatLevel.MildThreat ? null :
            r.span({ className: 's_A_Us_UsL_U_Modif' },
              user.threatLevel === ThreatLevel.MildThreat ? " — mild threat" : " — moderate threat"),
        !user_isSuspended(user, nowMs) ? null :
            r.span({ className: 's_A_Us_UsL_U_Modif' }, " — suspended"),
        !isDeactivated || isDeleted ? null :
            r.span({ className: 's_A_Us_UsL_U_Modif' }, " — deactivated"),
        !isDeleted ? null :
          r.span({ className: 's_A_Us_UsL_U_Modif' }, " — deleted"));

    const notVerified = !user.email || user.emailVerifiedAtMs ? null :
      r.span({ className: 's_A_Us_UsL_U_Modif' }, " — not verified");

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
        r.td({}, user.email, notVerified),
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
