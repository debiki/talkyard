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

//xx <reference path="../../typedefs/moment/moment.d.ts" /> — disappeared
declare var moment: any;
/// <reference path="../slim-bundle.d.ts" />
/// <reference path="../util/EmailInput.more.ts" />
/// <reference path="../page-dialogs/about-user-dialog.more.ts" />

//------------------------------------------------------------------------------
   namespace debiki2.users {
//------------------------------------------------------------------------------

const r = ReactDOMFactories;
const Modal = rb.Modal;
const ModalBody = rb.ModalBody;
const ModalFooter = rb.ModalFooter;
const EmailInput = util.EmailInput;


export const UserInvites = createFactory({
  displayName: 'UserInvites',

  getInitialState: function() {
    return { intives: null };
  },

  componentDidMount: function() {
    this.loadInvites(this.props.user.id);
  },

  componentWillReceiveProps: function(nextProps: any) {
    const store: Store = this.props.store;
    const nextStore: Store = nextProps.store;
    if (this.props.user.id === nextProps.user.id && store.me.id === nextStore.me.id)
      return;

    this.loadInvites(nextProps.user.id);
  },

  loadInvites: function(userId: UserId) {
    const store: Store = this.props.store;
    this.setState({ invites: null });
    let me: Myself = store.me;
    const maySeeInvites = me.id === userId || isStaff(me);
    if (!maySeeInvites)
      return;

    Server.loadInvitesSentBy(userId, (invites) => {
      this.setState({ invites: invites });
    }, (errorMessage) => {
      this.setState({ errorMessage: errorMessage });
    });
  },

  addInvite: function(invite: Invite) {
    const invites = this.state.invites;
    invites.unshift(invite);
    this.setState({
      invites: invites
    });
  },

  render: function() {
    const store: Store = this.props.store;
    const me: Myself = store.me;
    const user: MemberInclDetails = this.props.user;

    if (isGuest(me))
      return r.p({}, "You are logged in as a guest. They may not see invites.");

    if (!isMember(me))
      return r.p({}, "You are not logged in.");

    if (this.state.errorMessage)
      return r.p({}, this.state.errorMessage);

    if (!this.state.invites)
      return r.p({}, t.Loading);

    let inviteButton;
    const mayInvite = maySendInvites(user);
    let introText: any = r.p({}, t.upp.InvitesIntro + (
        this.state.invites.length
            ? t.upp.InvitesListedBelow
            : t.upp.NoInvites));
    if (user.id === me.id && mayInvite.yes) {
      inviteButton =
          Button({ onClick: () => openInviteSomeoneDialog(this.addInvite) }, t.upp.SendAnInv);
    }
    else {
      // (This is for staff, need not translate. [5JKBWS2])
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
    const nowMs: WhenMs = Date.now();
    const inviteRows = this.state.invites.map(function(invite: Invite) {
      return InviteRowWithKey({ invite, store, nowMs });
    });

    return (
      r.div({ className: 's_UP_Inv' },
        introText,
        inviteButton,
        // Dupl table headers [3GK0YU2]
        r.table({ className: 'dw-invites-table' },
          r.thead({},
            r.tr({},
              r.th({}, t.upp.InvitedEmail),
              r.th({}, t.upp.WhoAccepted),
              r.th({}, t.upp.InvAccepted),
              r.th({}, t.upp.InvSent))),
            // Later on: Seen, Topics Viewed, Posts Read, Read Time, Days Visited, Trust Level, Threat Level
          r.tbody({ className: 's_InvsL'},
            inviteRows))));
  }
});


// REFACTOR COULD break out to separate module, because also used in the admin area. [8HRAE3V]
export function InviteRowWithKey(props: { store: Store, invite: Invite, nowMs: WhenMs, showSender? }) {
    const store: Store = props.store;
    const invite: Invite = props.invite;
    let invitedEmail;
    let invitedUser;
    let acceptedAt = t.NotYet;
    if (invite.userId) {
      const user: BriefUser = store_getUserOrMissing(store, invite.userId);
      invitedUser = UserName({ user, store, makeLink: true });
      invitedEmail = r.samp({}, invite.invitedEmailAddress);
      acceptedAt = moment(invite.acceptedAtEpoch).from(props.nowMs);
    }
    else {
      invitedEmail = invite.invitedEmailAddress;
    }

    let sentBy;
    if (props.showSender) {
      let sender: BriefUser = store_getUserOrMissing(store, invite.createdById);
      sentBy = r.td({}, UserName({ user: sender, store, makeLink: true }));
    }

    // Invited-email + inviter-id is unique. [5GPJ4A0]
    const key = invite.invitedEmailAddress + ' ' + invite.createdById;

    return (
      r.tr({ key },
        r.td({}, invitedEmail),
        r.td({}, invitedUser),
        r.td({}, acceptedAt),
        r.td({}, moment(invite.createdAtEpoch).from(props.nowMs)),
        sentBy));
}


let inviteSomeoneDialog;

export function openInviteSomeoneDialog(addInvite) {
  if (!inviteSomeoneDialog) {
    inviteSomeoneDialog = ReactDOM.render(InviteDialog(), utils.makeMountNode());
  }
  inviteSomeoneDialog.open(addInvite);
}


const InviteDialog = createComponent({  // COULD break out to debiki2.invite module [8HRAE3V]
  displayName: 'InviteDialog',

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
    const emailAddress = this.refs.emailInput.getValue();
    Server.sendInvite(emailAddress, (invite: Invite) => {
      this.state.addInvite(invite);
      this.close();
      util.openDefaultStupidDialog({ body: t.upp.InvDone });
    }, (failedRequest: HttpRequest) => {
      if (hasErrorCode(failedRequest, '_EsE403IUAM_')) {
        this.setState({ error: t.upp.InvErrJoinedAlready });
      }
      else if (hasErrorCode(failedRequest, '_EsE403IAAC0_')) {
        this.setState({ error: t.upp.InvErrYouInvAlready });
      }
      else {
        return undefined;
      }
      this.setState({ maySubmit: false });
      return IgnoreThisError;
    });
  },

  render: function() {
    const props: any = _.assign({}, this.props);
    props.title = t.upp.SendAnInv;
    return (
      Modal({ show: this.state.isOpen, onHide: this.close, dialogClassName: 'esUsrDlg' },
        ModalBody({},
          r.p({}, t.upp.SendInvExpl),
          EmailInput({ label: t.EmailAddress, placeholder: t.upp.EnterEmail,
              ref: 'emailInput', error: this.state.error, onChangeValueOk: this.onEmailChanged })),
        ModalFooter({},
          PrimaryButton({ onClick: this.sendInvite, disabled: !this.state.maySubmit },
            t.upp.SendInv),
          Button({ onClick: this.close }, t.Cancel))));
  }
});

//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
