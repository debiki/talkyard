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
/// <reference path="../links.ts" />

//------------------------------------------------------------------------------
   module debiki2.admin {
//------------------------------------------------------------------------------

var d = { i: debiki.internal, u: debiki.v0.util };
var r = React.DOM;
var reactCreateFactory = React['createFactory'];

var ReactBootstrap: any = window['ReactBootstrap'];
var Button = reactCreateFactory(ReactBootstrap.Button);
var Modal = reactCreateFactory(ReactBootstrap.Modal);
var ModalTitle = reactCreateFactory(ReactBootstrap.ModalTitle);
var ModalBody = reactCreateFactory(ReactBootstrap.ModalBody);
var ModalFooter = reactCreateFactory(ReactBootstrap.ModalFooter);
var Input = reactCreateFactory(ReactBootstrap.Input);

var ReactRouter = window['ReactRouter'];
var RouterNavigation = ReactRouter.Navigation;
var RouterState = ReactRouter.State;


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
    Server.loadCompleteUser(params.userId, (user) => {
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

  render: function() {
    var user: CompleteUser = this.state.user;
    var loggedInUser: Myself = this.props.loggedInUser;
    if (!user)
      return r.p({}, 'Loading...');

    var showPublProfileButton = Button({ href: this.publicProfileLink() }, 'Show Public Profile');

    var usernameAndFullName = user.username;
    if (user.fullName) {
      usernameAndFullName += ' (' + user.fullName + ')';
    }

    var thatIsYou = user.id === loggedInUser.userId ? " — that's you" : null;

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
    if (loggedInUser.isAdmin && !thatIsYou && !userSuspendedNow) {
      toggleAdminButton = Button({ onClick: this.toggleIsAdmin },
          user.isAdmin ? 'Revoke Admin' : 'Grant Admin');
      toggleModeratorButton = Button({ onClick: this.toggleIsModerator },
          user.isModerator ? 'Revoke Moderator' : 'Grant Moderator');
    }

    var moderatorInfo = user.isAdmin
        ? null  // then moderator settings have no effect
        : r.p({}, 'Moderator: ' + user.isModerator, ' ', toggleModeratorButton);

    return (
      r.div({},
        r.div({ className: 'pull-right' },
          showPublProfileButton),

        r.p({}, 'Username: ' + usernameAndFullName, thatIsYou),
        r.p({}, 'Admin: ' + user.isAdmin, ' ', toggleAdminButton),
        moderatorInfo,
        r.p({}, 'Suspended: ' + suspendedText, ' ', suspendButton)));
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


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
