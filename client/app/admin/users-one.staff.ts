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

/// <reference path="../../typedefs/react/react.d.ts" />
/// <reference path="../slim-bundle.d.ts" />
/// <reference path="../more-bundle-already-loaded.d.ts" />

//------------------------------------------------------------------------------
   module debiki2.admin {
//------------------------------------------------------------------------------

var r = React.DOM;
var ReactBootstrap: any = window['ReactBootstrap'];
var Modal = reactCreateFactory(ReactBootstrap.Modal);
var ModalTitle = reactCreateFactory(ReactBootstrap.ModalTitle);
var ModalBody = reactCreateFactory(ReactBootstrap.ModalBody);
var ModalFooter = reactCreateFactory(ReactBootstrap.ModalFooter);


export var AdminUserPageComponent = React.createClass(<any> {
  contextTypes: {
    router: React.PropTypes.object.isRequired
  },

  getInitialState: function() {
    return {
      user: null
    };
  },

  componentWillMount: function(nextProps) {
    this.loadCompleteUser();
  },

  componentWillReceiveProps: function(nextProps) {
    this.loadCompleteUser();
  },

  loadCompleteUser: function() {
    this.setState({ user: null });
    var params = this.props.params;
    Server.loadCompleteUser(params.userId, (user: MemberInclDetails) => {
      if (!this.isMounted()) return;
      this.setState({
        user: user
      });
    });
  },

  publicProfileLink: function() {
    return linkToUserProfilePage(this.state.user.id);
  },

  toggleIsAdmin: function() {
    var doWhat = this.state.user.isAdmin ? 'RevokeAdmin' : 'GrantAdmin';
    Server.setIsAdminOrModerator(this.state.user.id, doWhat, () => {
      this.loadCompleteUser();
    });
  },

  toggleIsModerator: function() {
    var doWhat = this.state.user.isModerator ? 'RevokeModerator' : 'GrantModerator';
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
    var user: MemberInclDetails = this.state.user;
    var me: Myself = store.me;
    if (!user)
      return r.p({}, 'Loading...');

    var showPublProfileButton =
        LinkButton({ href: this.publicProfileLink(), id: 'e2eA_Us_U_ShowPublProfB' },
          "Show Public Profile");

    var usernameAndFullName = user.username;
    if (user.fullName) {
      usernameAndFullName += ' (' + user.fullName + ')';
    }

    var thatIsYou = user.id === me.id ? " — that's you" : null;

    var suspendedText = user.suspendedTillEpoch
        ? 'from ' + moment(user.suspendedAtEpoch).format('YYYY-MM-DD') +
            ' to ' + moment(user.suspendedTillEpoch).format('YYYY-MM-DD HH:mm') +
            ', reason: ' + user.suspendedReason
        : 'no';

    var suspendButton;
    var userSuspendedNow = user.suspendedTillEpoch && Date.now() <= user.suspendedTillEpoch;
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

    var toggleAdminButton;
    var toggleModeratorButton;
    if (me.isAdmin && !thatIsYou && !userSuspendedNow) {
      toggleAdminButton = Button({ onClick: this.toggleIsAdmin },
          user.isAdmin ? 'Revoke Admin' : 'Grant Admin');
      toggleModeratorButton = Button({ onClick: this.toggleIsModerator },
          user.isModerator ? 'Revoke Moderator' : 'Grant Moderator');
    }

    var moderatorInfo = user.isAdmin
        ? null  // then moderator settings have no effect
        : r.p({}, 'Moderator: ' + user.isModerator, ' ', toggleModeratorButton);

    var trustLevelText = user.lockedTrustLevel
        ? "Locked at: " + trustLevel_toString(user.lockedTrustLevel) + " member, " +
            "would otherwise have been: " + trustLevel_toString(user.trustLevel) + " member"
        : '' + trustLevel_toString(user.trustLevel) + " member";

    var threatLevelText = user.lockedThreatLevel
        ? "Locked at: " + threatLevel_toString(user.lockedThreatLevel) +
            ", would otherwise have been: " + threatLevel_toString(user.threatLevel)
        : threatLevel_toString(user.threatLevel);

    var threatButton = Button({ onClick: () => openThreatLevelDialog(user, this.reloadUser) },
      "Change");

    var impersonateButton = !me.isAdmin ? null :
        Button({ onClick: () => Server.impersonateGoToHomepage(user.id),
            id: 'e2eA_Us_U_ImpersonateB' }, "Impersonate");

    return (
      r.div({},
        r.div({ className: 'pull-right' },
          showPublProfileButton),

        r.p({}, 'Username: ' + usernameAndFullName, thatIsYou),
        r.p({}, 'Admin: ' + user.isAdmin, ' ', toggleAdminButton),
        moderatorInfo,
        r.p({}, 'Suspended: ' + suspendedText, ' ', suspendButton),
        r.p({}, 'Trust level: ' + trustLevelText),
        r.p({}, 'Threat level: ' + threatLevelText, ' ', threatButton),
        impersonateButton));
  }
});


var suspendUserDialog;

function openSuspendUserDialog(user: BriefUser, refreshCallback) {
  if (!suspendUserDialog) {
    suspendUserDialog = ReactDOM.render(SuspendDialog(), utils.makeMountNode());
  }
  suspendUserDialog.open(user, refreshCallback);
}


var SuspendDialog = createComponent({
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
    var numDays = parseInt(this.refs.daysInput.getValue());
    if (isNaN(numDays)) {
      alert('Please enter a number');
      return;
    }
    var reason = this.refs.reasonInput.getValue();
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



var threatLevelDialog;

function openThreatLevelDialog(user: MemberInclDetails, refreshCallback) {
  if (!threatLevelDialog) {
    threatLevelDialog = ReactDOM.render(MemberThreatLevelDialog(), utils.makeMountNode());
  }
  threatLevelDialog.open(user, refreshCallback);
}


var MemberThreatLevelDialog = createComponent({
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

    var user: MemberInclDetails = this.state.user;

    var threatLevelText = user.lockedThreatLevel
      ? "Threat level locked at: " + threatLevel_toString(user.lockedThreatLevel) +
          ", would otherwise have been: " + threatLevel_toString(user.threatLevel)
      : "Threat level: " + threatLevel_toString(user.threatLevel);

    var actionContent = user.lockedThreatLevel
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
