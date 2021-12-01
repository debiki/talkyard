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


interface UserProfileAdminViewProps {
  store: Store;
  settings: Settings;
  match: ReactRouterMatch;
}


interface UserProfileAdminViewState {
  user?: UserDetailsStatsGroups | N;
  myId?: PatId;
}


export const UserProfileAdminView = createFactory({
  displayName: 'UserProfileAdminView',

  getInitialState: function() {
    return {};
  },

  componentDidMount: function() {
    this.maybeLoadPatVvb();
  },

  componentDidUpdate: function() {
    this.maybeLoadPatVvb();
  },

  componentWillUnmount: function() {
    this.isGone = true;
  },

  maybeLoadPatVvb: function(always?: 'Alw') {
    if (this.isGone) return;

    const stateBef: UserProfileAdminViewState = this.state;
    const propsBef: UserProfileAdminViewProps = this.props;
    const meBef: Me = propsBef.store.me;
    const params = propsBef.match.params;
    {
      // The props changes first, before the state gets updated (later in this fn).
      const isSameMe = meBef.id === stateBef.myId;

      const prevPat: Pat | U = stateBef.user;
      const isSamePat = prevPat && (
              ('' + prevPat.id) === params.userId || prevPat.username === params.userId);

      // If !isSameMe, reload pat, even if loaded — maybe we are/aren't now mods and
      // can see more/less info about hen. (Actually cannot happen — this component would
      // get unmounted first.)
      const loadPat = !isSamePat || !isSameMe || always === 'Alw';
      if (!loadPat)
        return;

      if (prevPat || !isSameMe) {
        this.setState({ user: null, myId: meBef.id });
      }

      if (this.nowLoading === params.userId) return;
      this.nowLoading = params.userId;
    }

    Server.loadPatVvbPatchStore(params.userId, (resp: LoadPatVvbResponse) => {
      this.nowLoading = null; // (or only if correct id)
      if (this.isGone) return;
      const propsAft: UserProfileAdminViewProps = this.props;
      const meAft = propsAft.store.me;
      const isSameMeLater = meAft.id === meBef.id;

      // Maybe we started loading another pat instead — then ignore the response
      // about the old pat.
      const pat: PatVvb = resp.user;
      const paramsAft = propsAft.match.params;
      const rightPat = ('' + pat.id) === paramsAft.userId || pat.username === paramsAft.userId;
      if (!rightPat || !isSameMeLater)
        return;

      this.setState({ user: pat });
    });
  },

  publicProfileLink: function() {
    return linkToUserProfilePage(this.state.user);
  },

  editMember: function(doWhat: EditMemberAction) {
    Server.editMember(this.state.user.id, doWhat, this.reloadUser);
  },

  resendEmailAddrVerifEmail: function() {
    const user: UserInclDetails = this.state.user;
    Server.resendEmailAddrVerifEmail(user.id, user.email);
  },

  toggleIsAdmin: function() {
    const user: UserInclDetails = this.state.user;
    const doWhat = user.isAdmin ? EditMemberAction.SetNotAdmin : EditMemberAction.SetIsAdmin;
    Server.editMember(user.id, doWhat, this.reloadUser);
  },

  toggleIsModerator: function() {
    const user: UserInclDetails = this.state.user;
    const doWhat = user.isModerator ? EditMemberAction.SetNotModerator : EditMemberAction.SetIsModerator;
    Server.editMember(user.id, doWhat, this.reloadUser);
  },

  unsuspendUser: function() {
    const user: UserInclDetails = this.state.user;
    Server.unsuspendUser(user.id, this.reloadUser);
  },

  reloadUser: function() {
    // COULD_OPTIMIZE incl the pat in the Server.editMember() etc responses instead.
    this.maybeLoadPatVvb('Alw');
  },

  render: function() {
    const props: UserProfileAdminViewProps = this.props;
    const store: Store = props.store;
    const settings: Settings = props.settings;
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

    const makeRow = (what: St, value: St | RElm, controls, alsoForGroups?: Bo) => {
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
        rFr({}, user.email, (user.emailVerifiedAtMs ? '' : r.b({}, " — not verified"))),
        rFr({},

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
          Button({ onClick: () => openSuspendUserDialog(user, this.reloadUser),
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
        ? r.span({ className: 'e_TruLvLkd' },
            "Locked at: ", r.b({}, trustLevel_toString(user.lockedTrustLevel)),
            '.', r.br(),
            "Would otherwise have been: ", trustLevel_toString(user.trustLevel))
        : r.span({ className: 'e_TruLv0Lkd' },
            trustLevel_toString(user.trustLevel)));

    const trustButton = user.isGroup ? null :
        Button({ onClick: () => openTrustLevelDialog(user, this.reloadUser),
            className: 'e_TruLvB' }, "Change");

    // UX SHOULD not be able to mark admins as threats. Is confusing, and has no effect (?) anyway.
    const threatLevelText = user.isGroup ? null : (
        user.lockedThreatLevel
        ? r.span({ className: 'e_ThreatLvlIsLkd' },
            "Locked at: ", threatLevel_toElem(user.lockedThreatLevel), '.', r.br(),
            "Would otherwise have been: ", threatLevel_toElem(user.threatLevel))
        : r.span({ className: 'e_ThreatLvlNotLkd' },
            threatLevel_toElem(user.threatLevel)));

    const threatButton = user.isGroup ? null :
        Button({ onClick: () => openThreatLevelDialog(user, this.reloadUser),
            className: 'e_TrtLvB' }, "Change");

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

// Break out fn, reuse here: [693SKDL406]
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

  componentWillUnmount: function() {
    this.isGone = true;
  },

  open: function(user: UserInclDetails, refreshCallback) {
    this.setState({ isOpen: true, user: user, refreshCallback: refreshCallback });
  },

  close: function() {
    this.setState({ isOpen: false, user: null, refreshCallback: null });
  },

  lockTrustLevelAt: function(trustLevel: TrustLevel) {
    Server.lockTrustLevel(this.state.user.id, trustLevel, () => {
      this.state.refreshCallback?.(trustLevel);
      if (this.isGone) return;
      this.close();
    })
  },

  render: function() {
    if (!this.state.isOpen)
      return null;

    const user: UserInclDetails = this.state.user;

    const currentTrustLevelText = r.p({}, user.lockedTrustLevel
      ? rFr({},
          "Trust level locked at: ", trustLevel_toString(user.lockedTrustLevel),
          '.', r.br(),
          "Would otherwise have been: ", trustLevel_toString(user.trustLevel))
      : rFr({},
          "Current trust level: ", trustLevel_toString(user.trustLevel)));

    const changeTo = user.lockedThreatLevel ? null :
        r.p({}, "Change to:");

    const mkLiBtn = (level: TrustLevel) =>
        r.li({},
          Button({ onClick: () => this.lockTrustLevelAt(level),
              className: `e_TruLv-${level}` },
            trustLevel_toString(level)));

    const actionContent = user.lockedTrustLevel
      ? Button({ onClick: () => this.lockTrustLevelAt(null),
          className: 'e_UnlkTruLvB',
          help: "Clears the manually assigned trust level." }, "Unlock")
      : r.ol({},
          mkLiBtn(TrustLevel.New),
          mkLiBtn(TrustLevel.Basic),
          mkLiBtn(TrustLevel.FullMember),
          mkLiBtn(TrustLevel.Trusted),
          mkLiBtn(TrustLevel.Regular),
          mkLiBtn(TrustLevel.CoreMember));

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

  componentWillUnmount: function() {
    this.isGone = true;
  },

  open: function(user: UserInclDetails, refreshCallback) {
    this.setState({ isOpen: true, user: user, refreshCallback: refreshCallback });
  },

  close: function() {
    this.setState({ isOpen: false, user: null, refreshCallback: null });
  },

  lockThreatLevelAt: function(threatLevel: ThreatLevel) {
    Server.lockThreatLevel(this.state.user.id, threatLevel, () => {
      this.state.refreshCallback?.(threatLevel);
      if (this.isGone) return;
      this.close();
    })
  },

  render: function() {
    if (!this.state.isOpen)
      return null;

    const user: UserInclDetails = this.state.user;

    const currentThreatLevelText = r.p({}, user.lockedThreatLevel
      ? rFr({},
          "Threat level locked at: ", threatLevel_toElem(user.lockedThreatLevel),
          '.', r.br(),
          "Would otherwise have been: ", threatLevel_toElem(user.threatLevel))
      : rFr({},
          "Current threat level: ", threatLevel_toElem(user.threatLevel)));

    const mkBtn = (level: ThreatLevel | Nl, className: St, help: St, title?: St) =>
        rFr({},
          Button({ onClick: () => this.lockThreatLevelAt(level),
              className: `${className} e_ThrLv-${level}` },
            title || threatLevel_toElem(level)),
          r.div({ className: 'help-block' },
            help));

    const actionContent = user.lockedThreatLevel
        ? r.div({},
            mkBtn(null, 'e_UnlockThreatB',
              "Clears the manually assigned threat level.",
              "Unlock"))
        : r.div({},
            // Tests: flag-member-block-agree.2browsers  TyTE2EFLGMEMBLK.TyTE2ETHRLVDEF
            mkBtn(ThreatLevel.HopefullySafe, 'e_HopfSafB',
              "The default level — has no effect; doesn't do anything special."),
            mkBtn(ThreatLevel.MildThreat, 'e_MildThreatB',
              "Marks this user as a mild threat, which means that new posts " +
              "by him/her get added to the review list. " +
              "But they'll be visible directly for other members."),
            mkBtn(ThreatLevel.ModerateThreat, 'e_ModerateThreatB',
              "Marks this user as a moderate threat, which means that new posts " +
              "by him/her get hidden until approved by staff."));

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
