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
/// <reference path="../../typedefs/moment/moment.d.ts" />
/// <reference path="../slim-bundle.d.ts" />
/// <reference path="../util/EmailInput.more.ts" />

//------------------------------------------------------------------------------
   namespace debiki2.users {
//------------------------------------------------------------------------------

var r = React.DOM;
var Modal = rb.Modal;
var ModalBody = rb.ModalBody;
var ModalFooter = rb.ModalFooter;
var EmailInput = util.EmailInput;


export var UserInvitesComponent = React.createClass({
  getInitialState: function() {
    this.loadInvites(this.props.user.id);
    return {
        intives: null
    };
  },

  componentWillReceiveProps: function(nextProps) {
    this.setState({
      invites: null
    });
    this.loadInvites(nextProps.user.id);
  },

  loadInvites: function(userId: number) {
    var me: Myself = this.props.me;
    var maySeeInvites = me.userId === userId || isStaff(me);
    if (!maySeeInvites)
      return;

    Server.loadInvitesSentBy(userId, (invites) => {
      this.setState({ invites: invites });
    }, (errorMessage) => {
      this.setState({ errorMessage: errorMessage });
    });
  },

  addInvite: function(invite: Invite) {
    var invites = this.state.invites;
    invites.unshift(invite);
    this.setState({
      invites: invites
    });
  },

  render: function() {
    var user: CompleteUser = this.props.user;
    var me: Myself = this.props.me;

    if (isGuest(me))
      return r.p({}, "You are logge in as a guest. They may not see invites.");

    if (!isMember(me))
      return r.p({}, "You are not logge in.");

    if (this.state.errorMessage)
      return r.p({}, this.state.errorMessage);

    if (!this.state.invites)
      return r.p({}, 'Loading...');

    var inviteButton;
    var mayInvite = maySendInvites(user);
    var introText = r.p({}, 'Here you can invite people to join this site. ' + (
        this.state.invites.length
            ? 'Invites that you have already sent are listed below.'
            : 'You have not invited anyone yet.'));
    if (user.id === me.userId && mayInvite.yes) {
      inviteButton =
          Button({ onClick: () => openInviteSomeoneDialog(this.addInvite) }, "Send an Invite");
    }
    else {
      introText = "Here you can see any invites sent by " + user.username + ".";
      if (mayInvite.no) {
        introText += " He or she may not send any invites though, because: " +
            mayInvite.reason;
      }
      else if (!this.state.invites.length) {
        introText += " He or she has not invited anyone yet.";
      }
      introText = r.p({}, introText);
    }

    if (!this.state.invites.length)
      return (
        r.div({},
          introText,
          inviteButton));

    var now = Date.now();
    var inviteRows = this.state.invites.map(function(invite) {
      return InviteRow({ invite: invite, now: now });
    });

    return (
      r.div({},
        introText,
        inviteButton,
        r.table({ className: 'dw-invites-table' },
          r.thead({},
            r.tr({},
              r.th({}, 'Invited User'),
              r.th({}, 'Invitation Accepted'),
              r.th({}, 'Invitation Created'))),
            // Later on: Seen, Topics Viewed, Posts Read, Read Time, Days Visited, Trust Level, Threat Level
          r.tbody({},
            inviteRows))));
  }
});


var InviteRow = createComponent({
  render: function() {
    var invite: Invite = this.props.invite;
    var userEmailOrLink;
    var acceptedAt = "Not yet";
    if (invite.userId) {
      userEmailOrLink = r.a({ href: '/-/users/' + invite.userId }, invite.invitedEmailAddress);
      acceptedAt = moment(invite.acceptedAtEpoch).from(this.props.now);
    }
    else {
      userEmailOrLink = invite.invitedEmailAddress;
    }
    return (
      r.tr({},
        r.td({},
          userEmailOrLink),

        r.td({},
          acceptedAt),

        r.td({},
          moment(invite.createdAtEpoch).from(this.props.now))));
  }
});


var inviteSomeoneDialog;

export function openInviteSomeoneDialog(addInvite) {
  if (!inviteSomeoneDialog) {
    inviteSomeoneDialog = ReactDOM.render(InviteDialog(), utils.makeMountNode());
  }
  inviteSomeoneDialog.open(addInvite);
}


var InviteDialog = createComponent({  // COULD break out to separate debiki2.invite module
  getInitialState: function() {
    return { isOpen: false };
  },

  open: function(addInvite) {
    this.setState({ isOpen: true, addInvite: addInvite, maySubmit: false, error: null });
  },

  close: function() {
    this.setState({ isOpen: false });
  },

  onEmailChanged: function(value, ok) {
    // `ok` is false if this.state.error, so ignore it.
    this.setState({ error: null, maySubmit: !this.refs.emailInput.findPatternError(value) });
  },

  sendInvite: function() {
    var emailAddress = this.refs.emailInput.getValue();
    Server.sendInvite(emailAddress, (invite: Invite) => {
      this.state.addInvite(invite);
      this.close();
    }, (failedRequest: HttpRequest) => {
      if (hasErrorCode(failedRequest, '_EsE403IUAM_')) {
        this.setState({ error: "He or she has joined this site already" });
      }
      else if (hasErrorCode(failedRequest, '_EsE403IAAC0_')) {
        this.setState({ error: "You have invited him or her already" });
      }
      else {
        return undefined;
      }
      this.setState({ maySubmit: false });
      return IgnoreThisError;
    });
  },

  render: function() {
    var props = _.assign({}, this.props);
    props.title = 'Send an Invite';
    return (
      Modal({ show: this.state.isOpen, onHide: this.close, dialogClassName: 'esUsrDlg' },
        ModalBody({},
          r.p({}, "We'll send your friend a brief email, and he or she then clicks a link " +
              "to join immediately, no login required. " +
              "He or she will become a normal member, not a moderator or admin."),
          EmailInput({ label: 'Email Address', placeholder: 'Enter email',
              ref: 'emailInput', error: this.state.error, onChangeValueOk: this.onEmailChanged })),
        ModalFooter({},
          PrimaryButton({ onClick: this.sendInvite, disabled: !this.state.maySubmit },
            "Send Invite"),
          Button({ onClick: this.close }, "Cancel"))));
  }
});

//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
