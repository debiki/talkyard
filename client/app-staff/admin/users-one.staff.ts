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

/// <reference path="../staff-prelude.staff.ts" />
declare var moment;

//------------------------------------------------------------------------------
   namespace debiki2.admin {
//------------------------------------------------------------------------------

const r = ReactDOMFactories;
const Modal = rb.Modal;
const ModalHeader = rb.ModalHeader;
const ModalTitle = rb.ModalTitle;
const ModalBody = rb.ModalBody;
const ModalFooter = rb.ModalFooter;


export const UserProfileAdminView = createFactory({
  displayName: 'UserProfileAdminView',

  getInitialState: function() {
    return {
      user: null
    };
  },

  componentDidMount: function() {
    this.loadCompleteUser();
  },

  componentWillUnmount: function() {
    this.isGone = true;
  },

  UNSAFE_componentWillReceiveProps: function(nextProps) {
    this.loadCompleteUser();
  },

  loadCompleteUser: function() {
    if (this.isGone) return;
    this.setState({ user: null });
    const params = this.props.match.params;
    Server.loadUserAnyDetails(params.userId, (user: UserDetailsStatsGroups) => {
      if (this.isGone) return;
      this.setState({ user });
    });
  },

  publicProfileLink: function() {
    return linkToUserProfilePage(this.state.user);
  },

  editMember: function(doWhat: EditMemberAction) {
    Server.editMember(this.state.user.id, doWhat, this.loadCompleteUser);
  },

  resendEmailAddrVerifEmail: function() {
    const user: UserInclDetails = this.state.user;
    Server.resendEmailAddrVerifEmail(user.id, user.email);
  },

  toggleIsAdmin: function() {
    const user: UserInclDetails = this.state.user;
    const doWhat = user.isAdmin ? EditMemberAction.SetNotAdmin : EditMemberAction.SetIsAdmin;
    Server.editMember(user.id, doWhat, this.loadCompleteUser);
  },

  toggleIsModerator: function() {
    const user: UserInclDetails = this.state.user;
    const doWhat = user.isModerator ? EditMemberAction.SetNotModerator : EditMemberAction.SetIsModerator;
    Server.editMember(user.id, doWhat, this.loadCompleteUser);
  },

  unsuspendUser: function() {
    const user: UserInclDetails = this.state.user;
    Server.unsuspendUser(user.id, this.loadCompleteUser);
  },

  reloadUser: function() {
    this.loadCompleteUser();
  },

  render: function() {
    const store: Store = this.props.store;
    const settings: Settings = this.props.settings;
    const user: UserInclDetails = this.state.user;
    const me: Myself = store.me;
    if (!user)
      return r.p({}, "Loading...");

    const isMe = user.id === me.id;
    const showPublProfileButton =
        ExtLinkButton({ href: this.publicProfileLink(), className: 'e_VwPblPrfB' },
          "View Public Profile");

    if (user.isGroup)
      return rFragment({},
        r.div({ className: 'pull-right' },
          showPublProfileButton),
        r.p({ style: { clear: 'both' }},
          "A group: ",
          r.b({}, user.fullName + ' @' + user.username)));

    const makeRow = (what: string, value, controls, alsoForGroups?: boolean) => {
      if (!alsoForGroups && user.isGroup) return null;
      return r.div({ className: 'esA_Us_U_Rows_Row' },
        r.div({ className: 'col-sm-2' }, r.b({}, what)),
        r.div({ className: 'col-sm-3' }, prettify(value)),
        r.div({ className: 'col-sm-6' }, controls));
    };

    const thatIsYou = user.id === me.id ? " — that's you" : '';

    const usernameAndFullName = rFragment({},
      r.span({ className: 'e_A_Us_U_Username' }, user.username),
      user.fullName ? r.span({}, ' (' + user.fullName + ')') : null,
      thatIsYou);

    // ----- Enabled?

    let enabled = true;
    let notEnabledBecauseEmailUnverified;
    let notEnabledBecauseWaitingToBeApproved;
    let notEnabledBecauseRejected;
    let notEnabledBecauseBanned;

    if (settings.requireVerifiedEmail && !user.emailVerifiedAtMs) {
      enabled = false;
      notEnabledBecauseEmailUnverified =
          r.span({ className: 'e_Enabled-No_EmNotVer' }, " Hasn't clicked email verification link.");
    }
    else if (settings.userMustBeApproved) {
      if (!user.approvedAtMs) {
        enabled = false;
        notEnabledBecauseWaitingToBeApproved =
            r.span({ className: 'e_Enabled-No_WaitingAppr' }, " Waiting for you to approve him/her.");
      }
      else if (!user.isApproved) {
        enabled = false;
        notEnabledBecauseRejected =
            r.span({ className: 'e_Enabled-No_Rjctd' }, " Was not approved to join.");
      }
    }

    if ((<number | string> user.suspendedTillEpoch) === 'Forever') {
      enabled = false;
      notEnabledBecauseBanned =
          r.span({ className: 'e_Banned' }, " User banned.");
    }

    const enabledInfo = rFragment({},
       r.span({ className: enabled ? 'e_Enabled-Yes' : 'e_Enabled-No' }, prettify(enabled) + '.'),
      notEnabledBecauseEmailUnverified,
      notEnabledBecauseWaitingToBeApproved,
      notEnabledBecauseRejected,
      notEnabledBecauseBanned);

    // ----- /Enabled?

    const makeEditFn = (action: EditMemberAction) => {
      return () => this.editMember(action);
    };

    // Don't let staff unverify their email, and in that way prevent themselves from logging in.
    // UX maybe there're in rare cases reasons for doing this? (rather than just a bad luck click)
    // COULD pop up a "Do you really want to..." dialog?
    // TESTS_MISSING [5AEWBN0]
    const hideSetUnverifiedButton = isMe && user.emailVerifiedAtMs;

    // Admins shouldn't be able to uanpprove themselves? That's just confusing?
    // And to unapprove an admin, first demote hen, so is no longer admin.
    // UX COULD write "Cannot unapprove an admin" info message?
    // TESTS_MISSING [5AEWBN0]
    const hideUnapproveButtons = user.isAdmin;

    const emailAddrRow = makeRow(
        "Email: ",
        user.email + (user.emailVerifiedAtMs ? '' : " — not verified"),
        rFragment({},

          user.emailVerifiedAtMs ? null :
              Button({ onClick: this.resendEmailAddrVerifEmail, className: 's_SendEmVerifEmB' },
                "Send verification email"),

          hideSetUnverifiedButton ? null :
            Button({ onClick: makeEditFn(user.emailVerifiedAtMs ?
                EditMemberAction.SetEmailUnverified : EditMemberAction.SetEmailVerified),
                className: user.emailVerifiedAtMs ? 'e_SetEmNotVerifB' : 'e_SetEmVerifB' },
              user.emailVerifiedAtMs ?
                "Set to Not verified" : "Set to Verified"),
          /* This sounds complicated. Maybe better skip? Also, fairly obvious anyway?
          And actually *incorrect*, if the site conf val email-verif-required = false.
          user.emailVerifiedAtMs ?
              r.span({ style: { marginLeft: '1em' }},
                "(will then need to re-verify his/her email) ") : null, */
          r.a({ className: 's_A_Us_U_Rows_Row_EmlManage', href: linkToUsersEmailAddrs(user.username) },
            "Manage ...")));

    const externalIdRow = !user.externalId ? null : makeRow(
        "External ID: ", user.externalId, null);

    const isApprovedRow = user.isGroup || !settings.userMustBeApproved ?
                              r.span({ className: 'e_Appr_Info-Absent' }) : makeRow(
        "Approved: ",
        user.approvedAtMs ? (
            user.isApproved
              ? r.span({ className: 'e_Appr_Yes' }, "Yes")
              : r.span({ className: 'e_Appr_No' }, "No, rejected"))
          : r.span({ className: 'e_Appr_Undecided' }, "Undecided"),
        user.approvedAtMs
            ? (hideUnapproveButtons ? null :
                Button({ onClick: makeEditFn(EditMemberAction.ClearApproved), className: 'e_Appr_UndoB' },
                  "Undo"))
            : rFragment({},
                Button({ onClick: makeEditFn(EditMemberAction.SetApproved), className: 'e_Appr_ApprB' },
                  "Approve"),
              (hideUnapproveButtons ? null :
                Button({ onClick: makeEditFn(EditMemberAction.SetUnapproved), className: 'e_Appr_RejB' },
                  "Reject"))));


    const suspendedText = user.suspendedTillEpoch
        ? "from " + moment(user.suspendedAtEpoch).format('YYYY-MM-DD') +
            " to " + moment(user.suspendedTillEpoch).format('YYYY-MM-DD HH:mm') +
            ", reason: " + user.suspendedReason
        : "No";

    let whyCannotSuspend;
    if (thatIsYou) {
      whyCannotSuspend = r.span({}, "(you cannot suspend yourself)");
    }
    else if (user.isAdmin) {
      whyCannotSuspend = r.span({}, "(cannot suspend admins)");
    }
    let suspendButton;
    let userSuspendedNow = user.suspendedTillEpoch && Date.now() <= user.suspendedTillEpoch;
    if (userSuspendedNow) {
      suspendButton =
          Button({ onClick: this.unsuspendUser, className: 'e_Unuspend' }, "Unsuspend");
    }
    else if (whyCannotSuspend) {
      suspendButton = whyCannotSuspend;
    }
    else {
      suspendButton =
          Button({ onClick: () => openSuspendUserDialog(user, this.loadCompleteUser),
              className: 'e_Suspend' },
            "Suspend");
    }

    const isAdminText =
        r.span({ className: user.isAdmin ? 'e_Adm-Yes' : 'e_Adm-No' },
          prettify(user.isAdmin));

    const isModeratorText =
        r.span({ className: user.isModerator ? 'e_Mod-Yes' : 'e_Mod-No' },
            prettify(user.isModerator));

    let toggleAdminButton;
    let toggleModeratorButton;
    if (me.isAdmin && !thatIsYou && !userSuspendedNow && !user.isGroup) {
      toggleAdminButton =
          Button({ onClick: this.toggleIsAdmin, className: 'e_ToggleAdminB' },
            user.isAdmin ? "Revoke Admin" : "Grant Admin");
      // Need to first revoke is-admin, before can change to moderator.
      toggleModeratorButton = user.isAdmin ? null :
          Button({ onClick: this.toggleIsModerator, className: 'e_ToggleModB' },
            user.isModerator ? "Revoke Moderator" : "Grant Moderator");
    }

    const trustLevelText = user.isGroup ? null : (
        user.lockedTrustLevel
        ? r.span({ className: 'e_TrustLvlIsLkd' },
            "Locked at: " + trustLevel_toString(user.lockedTrustLevel) + ", " +
            "would otherwise have been: " + trustLevel_toString(user.trustLevel))
        : r.span({ className: 'e_TrustLvlNotLkd' },
            trustLevel_toString(user.trustLevel)));

    const trustButton = user.isGroup ? null :
        Button({ onClick: () => openTrustLevelDialog(user, this.reloadUser),
            className: 'e_TrustLvlB' }, "Change");

    // UX SHOULD not be able to mark admins as threats. Is confusing, and has no effect (?) anyway.
    const threatLevelText = user.isGroup ? null : (
        user.lockedThreatLevel
        ? r.span({ className: 'e_ThreatLvlIsLkd' },
            "Locked at: " + threatLevel_toString(user.lockedThreatLevel) +
            ", would otherwise have been: " + threatLevel_toString(user.threatLevel))
        : r.span({ className: 'e_ThreatLvlNotLkd' },
            threatLevel_toString(user.threatLevel)));

    const threatButton = user.isGroup ? null :
        Button({ onClick: () => openThreatLevelDialog(user, this.reloadUser),
            className: 'e_ThreatLvlB' }, "Change");

    const impersonateButton = !me.isAdmin ? null :
        Button({ onClick: () => Server.impersonateGoToHomepage(user.id),
            id: 'e2eA_Us_U_ImpersonateB' }, "Impersonate");

    return rFragment({},
      r.div({ className: 'pull-right' },
        showPublProfileButton),

      r.div({ className: 'esA_Us_U_Rows'},
        makeRow("Username: ", usernameAndFullName, null),
        user.isGroup ? r.p({}, "Is a group.") : null,
        makeRow("Enabled: ", enabledInfo, null),
        emailAddrRow,
        externalIdRow,
        isApprovedRow,
        makeRow("Admin: ", isAdminText, toggleAdminButton),
        makeRow("Moderator: ", isModeratorText, toggleModeratorButton),
        makeRow("Suspended: ", suspendedText, suspendButton),
        makeRow("Trust level: ", trustLevelText, trustButton),
        makeRow("Threat level: ", threatLevelText, threatButton)),

      impersonateButton);
  }
});


function prettify(value) {
  return value === true ? "Yes" : (value === false ? "No" : value);
}

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
      alert("Please enter a number");
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
        ModalHeader({},
          ModalTitle({}, "Suspend User")),
        ModalBody({},
          Input({ type: 'number', label: "Suspend for how many days?", ref: 'daysInput',
              className: 'e_SuspDays' }),
          Input({ type: 'text', label: "Why suspend this user?", className: 'e_SuspReason',
              help: "This will be visible to everyone, " +
              "on the user's public profile, and shown to the user when s/he tries to login. " +
              "Keep it short.", ref: 'reasonInput' })),
        ModalFooter({},
          Button({ onClick: this.doSuspend, className: 'e_DoSuspendB' }, "Suspend"),
          Button({ onClick: this.close }, "Cancel"))));
  }
});



let trustLevelDialog;

function openTrustLevelDialog(user: UserInclDetails, refreshCallback) {
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

  open: function(user: UserInclDetails, refreshCallback) {
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

    const user: UserInclDetails = this.state.user;

    const currentTrustLevelText = r.p({}, user.lockedTrustLevel
      ? "Trust level locked at: " + trustLevel_toString(user.lockedTrustLevel) +
          ", would otherwise have been: " + trustLevel_toString(user.trustLevel)
      : "Current trust level: " + trustLevel_toString(user.trustLevel));

    const changeTo = user.lockedThreatLevel ? null :
      r.p({}, "Change to:");

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
            Button({ onClick: () => this.lockTrustLevelAt(TrustLevel.FullMember) },
              "Full member")),
          r.li({},
            Button({ onClick: () => this.lockTrustLevelAt(TrustLevel.Trusted) },
              "Trusted member")),
          r.li({},
            Button({ onClick: () => this.lockTrustLevelAt(TrustLevel.Regular) },
              "Trusted regular")),
          r.li({},
            Button({ onClick: () => this.lockTrustLevelAt(TrustLevel.CoreMember), },
              "Core member")));

    return (
      Modal({ show: this.state.isOpen, onHide: this.close },
        ModalHeader({},
          ModalTitle({}, "Change trust level")),
        ModalBody({},
          currentTrustLevelText,
          changeTo,
          actionContent),
        ModalFooter({},
          Button({ onClick: this.close }, "Cancel"))));
  }
});



let threatLevelDialog;

function openThreatLevelDialog(user: UserInclDetails, refreshCallback) {
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

  open: function(user: UserInclDetails, refreshCallback) {
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

    const user: UserInclDetails = this.state.user;

    const currentThreatLevelText = r.p({}, user.lockedThreatLevel
      ? "Threat level locked at: " + threatLevel_toString(user.lockedThreatLevel) +
          ", would otherwise have been: " + threatLevel_toString(user.threatLevel)
      : "Current threat level: " + threatLevel_toString(user.threatLevel));

    const actionContent = user.lockedThreatLevel
        ? r.div({},
            Button({ onClick: () => this.lockThreatLevelAt(null), className: 'e_UnlockThreatB' },
              "Unlock"),
            r.div({ className: 'help-block' },
              "Clears the manually assigned threat level."))
        : r.div({},
            Button({ onClick: () => this.lockThreatLevelAt(ThreatLevel.MildThreat),
                className: 'e_MildThreatB' },
              "Mild threat"),
            r.div({ className: 'help-block' },
              "Marks this user as a mild threat, which means all comments s/he post " +
              "will be added to the review list. But they'll be shown directly to other " +
              "users."),
            Button({ onClick: () => this.lockThreatLevelAt(ThreatLevel.ModerateThreat),
                className: 'e_ModerateThreatB' },
              "Moderate threat"),
            r.div({ className: 'help-block' },
              "Marks this user as a moderate threat, which means that all comments " +
              "s/he post won't be visible until they've been approved by the staff."));

    return (
      Modal({ show: this.state.isOpen, onHide: this.close },
        ModalHeader({},
          ModalTitle({}, "Change threat level")),
        ModalBody({},
          currentThreatLevelText,
          actionContent),
        ModalFooter({},
          Button({ onClick: this.close }, "Cancel"))));
  }
});


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
