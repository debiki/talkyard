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
/// <reference path="../page-dialogs/about-user-dialog.more.ts" />

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
    return { intives: null };
  },

  componentDidMount: function() {
    this.loadInvites(this.props.user.id);
  },

  componentWillReceiveProps: function(nextProps) {
    if (this.props.user.id === nextProps.user.id &&
        this.props.store.me.id === nextProps.store.me.id)
      return;

    this.loadInvites(nextProps.user.id);
  },

  loadInvites: function(userId: UserId) {
    this.setState({ invites: null });
    let me: Myself = this.props.store.me;
    var maySeeInvites = me.id === userId || isStaff(me);
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
    let store: Store = this.props.store;
    var me: Myself = store.me;
    var user: MemberInclDetails = this.props.user;

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
    if (user.id === me.id && mayInvite.yes) {
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

    // REFACTOR COULD break out rendering code to separate module — also used in admin. [8HRAE3V]
    var now = Date.now();
    var inviteRows = this.state.invites.map(function(invite) {
      return InviteRow({ invite: invite, store: store, now: now,
          // Invited-email + inviter-id is unique. [5GPJ4A0]
          key: invite.invitedEmailAddress + ' ' + invite.createdById });
    });

    return (
      r.div({ className: 's_UP_Inv' },
        introText,
        inviteButton,
        // Dupl table headers [3GK0YU2]
        r.table({ className: 'dw-invites-table' },
          r.thead({},
            r.tr({},
              r.th({}, "Invited email"),
              r.th({}, "Member who accepted"),
              r.th({}, "Invitation accepted"),
              r.th({}, "Invitation sent"))),
            // Later on: Seen, Topics Viewed, Posts Read, Read Time, Days Visited, Trust Level, Threat Level
          r.tbody({ className: 's_InvsL'},
            inviteRows))));
  }
});


// REFACTOR COULD break out to separate module, because also used in the admin area. [8HRAE3V]
export var InviteRow = createComponent({
  onInvitedUserClick: function(event) {
    event.preventDefault();
    var invite: Invite = this.props.invite;
    pagedialogs.getAboutUserDialog().openForUserIdOrUsername(invite.userId);
  },

  onInviterClick: function(event) {
    event.preventDefault();
    var invite: Invite = this.props.invite;
    pagedialogs.getAboutUserDialog().openForUserIdOrUsername(invite.createdById);
  },

  render: function() {
    let store = this.props.store;
    var invite: Invite = this.props.invite;
    var invitedEmail;
    var invitedUser;
    var acceptedAt = "Not yet";
    if (invite.userId) {
      let user: BriefUser = store_getUserOrMissing(store, invite.userId);
      invitedUser = UserName({ user: user, makeLink: true, onClick: this.onInvitedUserClick });
      invitedEmail = r.samp({}, invite.invitedEmailAddress);
      acceptedAt = moment(invite.acceptedAtEpoch).from(this.props.now);
    }
    else {
      invitedEmail = invite.invitedEmailAddress;
    }

    let sentBy;
    if (this.props.showSender) {
      let sender: BriefUser = store_getUserOrMissing(store, invite.createdById);
      sentBy = r.td({}, UserName({ user: sender, makeLink: true, onClick: this.onInviterClick }));
    }

    return (
      r.tr({},
        r.td({}, invitedEmail),
        r.td({}, invitedUser),
        r.td({}, acceptedAt),
        r.td({}, moment(invite.createdAtEpoch).from(this.props.now)),
        sentBy));
  }
});


var inviteSomeoneDialog;

export function openInviteSomeoneDialog(addInvite) {
  if (!inviteSomeoneDialog) {
    inviteSomeoneDialog = ReactDOM.render(InviteDialog(), utils.makeMountNode());
  }
  inviteSomeoneDialog.open(addInvite);
}


var InviteDialog = createComponent({  // COULD break out to debiki2.invite module [8HRAE3V]
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
      util.openDefaultStupidDialog({ body: "Done. I'll send him/her an email." });
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
