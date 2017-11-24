/**
 * Copyright (C) 2015 Kaj Magnus Lindberg
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

/// <reference path="../slim-bundle.d.ts" />
/// <reference path="../more-bundle-already-loaded.d.ts" />

//------------------------------------------------------------------------------
   namespace debiki2.admin {
//------------------------------------------------------------------------------

const r = ReactDOMFactories;
const Modal = rb.Modal;
const ModalTitle = rb.ModalTitle;
const ModalBody = rb.ModalBody;
const ModalFooter = rb.ModalFooter;


export const AdminUserPage = createFactory({
  displayName: 'AdminUserPage',

  getInitialState: function() {
    return {
      user: null
    };
  },

  componentWillMount: function(nextProps) {
    this.loadCompleteUser();
  },

  componentWillUnmount: function(nextProps) {
    this.isGone = true;
  },

  componentWillReceiveProps: function(nextProps) {
    this.loadCompleteUser();
  },

  loadCompleteUser: function() {
    this.setState({ user: null });
    const params = this.props.match.params;
    Server.loadUserAnyDetails(params.userId, (user: MemberInclDetails, stats: UserStats) => {
      if (this.isGone) return;
      this.setState({
        user: user,
        stats: stats,
      });
    });
  },

  publicProfileLink: function() {
    return linkToUserProfilePage(this.state.user.id);
  },

  toggleIsAdmin: function() {
    const doWhat = this.state.user.isAdmin ? 'RevokeAdmin' : 'GrantAdmin';
    Server.setIsAdminOrModerator(this.state.user.id, doWhat, () => {
      this.loadCompleteUser();
    });
  },

  toggleIsModerator: function() {
    const doWhat = this.state.user.isModerator ? 'RevokeModerator' : 'GrantModerator';
    Server.setIsAdminOrModerator(this.state.user.id, doWhat, () => {
      this.loadCompleteUser();
    });
  },

  unsuspendUser: function() {
    Server.unsuspendUser(this.state.user.id, () => {
      this.loadCompleteUser();
    });
  },

  reloadUser: function() {
    this.loadCompleteUser();
  },

  render: function() {
    let store: Store = this.props.store;
    const user: MemberInclDetails = this.state.user;
    const me: Myself = store.me;
    if (!user)
      return r.p({}, 'Loading...');

    const showPublProfileButton =
        LinkButton({ href: this.publicProfileLink(), id: 'e2eA_Us_U_ShowPublProfB' },
          "Show Public Profile");

    let usernameAndFullName = user.username;
    if (user.fullName) {
      usernameAndFullName += ' (' + user.fullName + ')';
    }

    const thatIsYou = user.id === me.id ? " — that's you" : null;

    const suspendedText = user.suspendedTillEpoch
        ? 'from ' + moment(user.suspendedAtEpoch).format('YYYY-MM-DD') +
            ' to ' + moment(user.suspendedTillEpoch).format('YYYY-MM-DD HH:mm') +
            ', reason: ' + user.suspendedReason
        : 'no';

    let suspendButton;
    let userSuspendedNow = user.suspendedTillEpoch && Date.now() <= user.suspendedTillEpoch;
    if (user.isAdmin || thatIsYou) {
      // Cannot suspend admins or oneself.
    }
    else if (userSuspendedNow) {
      suspendButton =
          Button({ onClick: this.unsuspendUser }, 'Unsuspend');
    }
    else {
      suspendButton =
          Button({ onClick: () => openSuspendUserDialog(user, this.loadCompleteUser) },
            "Suspend");
    }

    let toggleAdminButton;
    let toggleModeratorButton;
    if (me.isAdmin && !thatIsYou && !userSuspendedNow && !user.isGroup) {
      toggleAdminButton = Button({ onClick: this.toggleIsAdmin },
          user.isAdmin ? 'Revoke Admin' : 'Grant Admin');
      toggleModeratorButton = Button({ onClick: this.toggleIsModerator },
          user.isModerator ? 'Revoke Moderator' : 'Grant Moderator');
    }

    const moderatorInfo = user.isAdmin || user.isGroup
        ? null  // then moderator settings have no effect
        : r.p({}, 'Moderator: ' + user.isModerator, ' ', toggleModeratorButton);

    const trustLevelText = user.isGroup ? null : (user.lockedTrustLevel
        ? "Locked at: " + trustLevel_toString(user.lockedTrustLevel) + ", " +
            "would otherwise have been: " + trustLevel_toString(user.trustLevel)
        : trustLevel_toString(user.trustLevel));

    const trustButton = user.isGroup ? null :
        Button({ onClick: () => openTrustLevelDialog(user, this.reloadUser) }, "Change");

    const threatLevelText = user.isGroup ? null : (user.lockedThreatLevel
        ? "Locked at: " + threatLevel_toString(user.lockedThreatLevel) +
            ", would otherwise have been: " + threatLevel_toString(user.threatLevel)
        : threatLevel_toString(user.threatLevel));

    const threatButton = user.isGroup ? null :
        Button({ onClick: () => openThreatLevelDialog(user, this.reloadUser) }, "Change");

    const impersonateButton = !me.isAdmin ? null :
        Button({ onClick: () => Server.impersonateGoToHomepage(user.id),
            id: 'e2eA_Us_U_ImpersonateB' }, "Impersonate");

    return (
      r.div({},
        r.div({ className: 'pull-right' },
          showPublProfileButton),

        r.p({}, "Username: " + usernameAndFullName, thatIsYou),
        user.isGroup ? r.p({}, "Is a group.") : null,
        user.isGroup ? null : r.p({}, "Admin: " + user.isAdmin, ' ', toggleAdminButton),
        moderatorInfo,
        user.isGroup ? null : r.p({}, "Suspended: " + suspendedText, ' ', suspendButton),
        user.isGroup ? null : r.p({}, "Trust level: " + trustLevelText, ' ', trustButton),
        user.isGroup ? null : r.p({}, "Threat level: " + threatLevelText, ' ', threatButton),
        impersonateButton));
  }
});


let suspendUserDialog;

function openSuspendUserDialog(user: BriefUser, refreshCallback) {
  if (!suspendUserDialog) {
    suspendUserDialog = ReactDOM.render(SuspendDialog(), utils.makeMountNode());
  }
  suspendUserDialog.open(user, refreshCallback);
}


const SuspendDialog = createComponent({
  displayName: 'SuspendDialog',

  getInitialState: function() {
    return { isOpen: false };
  },

  open: function(user: BriefUser, refreshCallback) {
    this.setState({ isOpen: true, user: user, refreshCallback: refreshCallback })
  },

  close: function() {
    this.setState({ isOpen: false });
  },

  doSuspend: function() {
    const numDays = parseInt(this.refs.daysInput.getValue());
    if (isNaN(numDays)) {
      alert('Please enter a number');
      return;
    }
    const reason = this.refs.reasonInput.getValue();
    if (!reason) {
      alert("Please clarify why you're suspending this user");
      return;
    }
    if (reason.length > 255) {
      alert("At most 255 characters please");
      return;
    }
    Server.suspendUser(this.state.user.id, numDays, reason, () => {
      this.close();
      this.state.refreshCallback();
    });
  },

  render: function() {
    return (
      Modal({ show: this.state.isOpen, onHide: this.close },
        ModalTitle({}, "Suspend User"),
        ModalBody({},
          Input({ type: 'number', label: 'Suspend for how many days?', ref: 'daysInput' }),
          Input({ type: 'text', label: 'Why suspend this user?',
              help: "This will be visible to everyone, " +
              "on the user's public profile, and shown to the user when s/he tries to login. " +
              "Keep it short.", ref: 'reasonInput' })),
        ModalFooter({},
          Button({ onClick: this.doSuspend }, 'Suspend'),
          Button({ onClick: this.close }, 'Cancel'))));
  }
});



let trustLevelDialog;

function openTrustLevelDialog(user: MemberInclDetails, refreshCallback) {
  if (!trustLevelDialog) {
    trustLevelDialog = ReactDOM.render(MemberTrustLevelDialog(), utils.makeMountNode());
  }
  trustLevelDialog.open(user, refreshCallback);
}


const MemberTrustLevelDialog = createComponent({
  displayName: 'MemberTrustLevelDialog',

  getInitialState: function() {
    return { isOpen: false };
  },

  open: function(user: MemberInclDetails, refreshCallback) {
    this.setState({ isOpen: true, user: user, refreshCallback: refreshCallback });
  },

  close: function() {
    this.setState({ isOpen: false, user: null, refreshCallback: null });
  },

  lockTrustLevelAt: function(trustLevel: TrustLevel) {
    Server.lockTrustLevel(this.state.user.id, trustLevel, () => {
      this.state.refreshCallback(trustLevel);
      this.close();
    })
  },

  render: function() {
    if (!this.state.isOpen)
      return null;

    const user: MemberInclDetails = this.state.user;

    const trustLevelText = user.lockedTrustLevel
      ? "Trust level locked at: " + trustLevel_toString(user.lockedTrustLevel) +
          ", would otherwise have been: " + trustLevel_toString(user.trustLevel)
      : "Current trust level: " + trustLevel_toString(user.trustLevel);

    const actionContent = user.lockedTrustLevel
      ? Button({ onClick: () => this.lockTrustLevelAt(null),
          help: "Clears the manually assigned trust level." }, "Unlock")
      : r.ol({},
          r.li({},
            Button({ onClick: () => this.lockTrustLevelAt(TrustLevel.New) },
              "New member")),
          r.li({},
            Button({ onClick: () => this.lockTrustLevelAt(TrustLevel.Basic) },
              "Basic member")),
          r.li({},
            Button({ onClick: () => this.lockTrustLevelAt(TrustLevel.Member) },
              "Full member")),
          r.li({},
            Button({ onClick: () => this.lockTrustLevelAt(TrustLevel.Helper) },
              "Trusted member")),
          r.li({},
            Button({ onClick: () => this.lockTrustLevelAt(TrustLevel.Regular) },
              "Regular member")),
          r.li({},
            Button({ onClick: () => this.lockTrustLevelAt(TrustLevel.CoreMember), },
              "Core member")));

    return (
      Modal({ show: this.state.isOpen, onHide: this.close },
        ModalTitle({}, "Change trust level"),
        ModalBody({},
          r.div({}, trustLevelText),
          actionContent),
        ModalFooter({},
          Button({ onClick: this.close }, "Cancel"))));
  }
});



let threatLevelDialog;

function openThreatLevelDialog(user: MemberInclDetails, refreshCallback) {
  if (!threatLevelDialog) {
    threatLevelDialog = ReactDOM.render(MemberThreatLevelDialog(), utils.makeMountNode());
  }
  threatLevelDialog.open(user, refreshCallback);
}


const MemberThreatLevelDialog = createComponent({
  displayName: 'MemberThreatLevelDialog',

  getInitialState: function() {
    return { isOpen: false };
  },

  open: function(user: MemberInclDetails, refreshCallback) {
    this.setState({ isOpen: true, user: user, refreshCallback: refreshCallback });
  },

  close: function() {
    this.setState({ isOpen: false, user: null, refreshCallback: null });
  },

  lockThreatLevelAt: function(threatLevel: ThreatLevel) {
    Server.lockThreatLevel(this.state.user.id, threatLevel, () => {
      this.state.refreshCallback(threatLevel);
      this.close();
    })
  },

  render: function() {
    if (!this.state.isOpen)
      return null;

    const user: MemberInclDetails = this.state.user;

    const threatLevelText = user.lockedThreatLevel
      ? "Threat level locked at: " + threatLevel_toString(user.lockedThreatLevel) +
          ", would otherwise have been: " + threatLevel_toString(user.threatLevel)
      : "Current threat level: " + threatLevel_toString(user.threatLevel);

    const actionContent = user.lockedThreatLevel
        ? Button({ onClick: () => this.lockThreatLevelAt(null),
              help: "Clears the manually assigned threat level." }, "Unlock")
        : r.div({},
            Button({ onClick: () => this.lockThreatLevelAt(ThreatLevel.MildThreat),
                help: "Marks this user as a mild threat, which means all comments s/he post " +
                  "will be added to the review list. But they'll be shown directly to other " +
                  "users." },
              "Mild threat"),
            Button({ onClick: () => this.lockThreatLevelAt(ThreatLevel.ModerateThreat),
              help: "Marks this user as a moderate threat, which means that all comments " +
                  "s/he post won't be visible until they've been approved by the staff." },
              "Moderate threat"));

    return (
      Modal({ show: this.state.isOpen, onHide: this.close },
        ModalTitle({}, "Change threat level"),
        ModalBody({},
          r.div({}, threatLevelText),
          actionContent),
        ModalFooter({},
          Button({ onClick: this.close }, "Cancel"))));
  }
});


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
