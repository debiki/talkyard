/**
 * Copyright (c) 2015, 2018 Kaj Magnus Lindberg
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
/// <reference path="../more-prelude.more.ts" />
/// <reference path="../util/EmailInput.more.ts" />
/// <reference path="../page-dialogs/about-user-dialog.more.ts" />
/// <reference path="../util/stupid-dialog.more.ts" />
/// <reference path="../widgets.more.ts" />

//------------------------------------------------------------------------------
   namespace debiki2.users {
//------------------------------------------------------------------------------

const r = ReactDOMFactories;
const Modal = rb.Modal;
const ModalBody = rb.ModalBody;
const ModalFooter = rb.ModalFooter;
const EmailInput = util.EmailInput;


// A bit dupl code — see [3GK0YU2] in the staff bundle.
//
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

  addInvites: function(invites: Invite[]) {
    this.setState({
      invites: [...invites, ...(this.state.invites || [])],
    });
  },

  render: function() {
    const store: Store = this.props.store;
    const me: Myself = store.me;
    const user: UserInclDetails = this.props.user;

    if (isGuest(me))
      return r.p({}, "You are logged in as a guest. They may not see invites.");

    if (!isMember(me))
      return r.p({}, "You are not logged in.");

    if (this.state.errorMessage)
      return r.p({}, this.state.errorMessage);

    if (!this.state.invites)
      return r.p({}, t.Loading);

    let inviteButton;
    const mayInvite = store_maySendInvites(store, user);
    let introText: any = r.p({}, t.upp.InvitesIntro + (
        this.state.invites.length
            ? t.upp.InvitesListedBelow
            : t.upp.NoInvites));
    if (user.id === me.id && mayInvite.yes) {
      inviteButton =
          Button({ className: 'e_SndInvB', onClick: () => openInviteDialog(this.addInvites) },
            t.upp.SendAnInv);
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
    let invitedUser;
    let acceptedAt = t.NotYet;
    let deletedClass = ' s_InvsL_It-Dd';
    if (invite.userId) {
      const user: BriefUser = store_getUserOrMissing(store, invite.userId);
      invitedUser = UserName({ user, store, makeLink: true });
    }
    if (invite.acceptedAtEpoch) {
      acceptedAt = moment(invite.acceptedAtEpoch).from(props.nowMs);
      deletedClass = '';
    }
    else if (invite.deletedAtEpoch) {
      acceptedAt = t.Deleted;
    }
    else if (invite.invalidatedAtEpoch) {
      acceptedAt = t.upp.JoinedAlready;
    }
    else {
      deletedClass = '';
    }

    let sentBy;
    if (props.showSender) {
      let sender: BriefUser = store_getUserOrMissing(store, invite.createdById);
      sentBy = r.td({ className: 'e_Inv_SentByU' }, UserName({ user: sender, store, makeLink: true }));
    }

    const key = invite.invitedEmailAddress + ' ' + invite.createdById + ' ' + invite.createdAtEpoch;

    return (
      r.tr({ key, className: 's_InvsL_It' + deletedClass },
        r.td({ className: 'e_Inv_Em' }, invite.invitedEmailAddress),
        r.td({ className: 'e_Inv_U' }, invitedUser),
        r.td({ className: 'e_Inv_AcptAt' }, acceptedAt),
        r.td({ className: 'e_Inv_CrtdAt' }, moment(invite.createdAtEpoch).from(props.nowMs)),
        sentBy));
}


let inviteDialog;

export function openInviteDialog(onDone: (invites: Invite[]) => void) {
  if (!inviteDialog) {
    inviteDialog = ReactDOM.render(InviteDialog(), utils.makeMountNode());
  }
  inviteDialog.open(onDone);
}


const InviteDialog = createComponent({  // COULD break out to debiki2.invite module [8HRAE3V]
  displayName: 'InviteDialog',

  getInitialState: function() {
    return { isOpen: false };
  },

  open: function(addInvites) {
    this.setState({
      isOpen: true,
      textareaValue: '',
      addInvites: addInvites,
      maySubmit: false,
      error: null,
      invitesSent: null,
      alreadyInvitedAddresses: null,
      alreadyJoinedAddresses: null,
      failedAddresses: null,
    });
  },

  close: function() {
    this.setState({ isOpen: false });
  },

  /*
  onEmailChanged: function(value, ok) {
    // `ok` is false if this.state.error, so ignore it.
    this.setState({ error: null, maySubmit: !this.refs.emailInput.findPatternError(value) });
  },*/

  onEmailChanged: function(event) {
    this.setState({ error: null, maySubmit: true, textareaValue: event.target.value });
  },

  sendInvite: function() {
    const addressesText = this.refs.emailInput.getValue().trim();
    const addresses: string[] = addressesText.split('\n');
    const maybeAddToGroup = (addresses[0] || '').trim();
    let addToGroups = [];
    const addToGroupsC = 'addToGroups:';

    if (maybeAddToGroup.startsWith(addToGroupsC)) {
      const atGroupnames = maybeAddToGroup.substr(addToGroupsC.length, 999).trim();
      addToGroups = atGroupnames.split(/[\s,]+/);
      addresses.splice(0, 1);
    }

    const isResend: boolean = !!this.state.alreadyInvitedAddresses;

    const requestBody: SendInvitesRequestBody = {
      toEmailAddresses: addresses,
      addToGroups: addToGroups,
      startAtUrl: undefined,  // not yet impl
      reinvite: isResend,
    };

    Server.sendInvites(requestBody, (sendInvitesResponse: SendInvitesResponse) => {
      dieIf(sendInvitesResponse.willSendLater, 'TyE2ABKR03', "Unimpl");
      const invitesSent: Invite[] = sendInvitesResponse.invitesSent;
      this.state.addInvites(invitesSent);

      let message;
      let messageE2eClass = 'e_Invd-' + invitesSent.length;

      if (invitesSent.length >= 1) {
        message = t.upp.InvDone;
      }
      else if (!sendInvitesResponse.willSendLater) {
        message = t.upp.NoOneToInv;
      }
      else {
        messageE2eClass += ' e_SndInvsLtr';
        // Text: "I'll notify you later, when have invited them".
        message = t.upp.InvNotfLater;
      }

      message = r.p({ className: messageE2eClass }, message);

      const alreadyInvitedAddresses = sendInvitesResponse.alreadyInvitedAddresses;
      const alreadyJoinedAddresses = sendInvitesResponse.alreadyJoinedAddresses;
      const failedAddresses = sendInvitesResponse.failedAddresses;

      const numFailed =
          alreadyInvitedAddresses.length +
          alreadyJoinedAddresses.length +
          failedAddresses.length;

      if (numFailed >= 1) {
        let textareaValue = '';
        if (addToGroups.length) {
          textareaValue += 'addToGroups: ' + addToGroups.join(', ') + '\n';
        }
        _.each(alreadyInvitedAddresses, addr => {
          textareaValue += addr + '\n';
        });
        this.setState({
          textareaValue,
          invitesSent,
          alreadyInvitedAddresses,
          alreadyJoinedAddresses,
          failedAddresses,
        });
        const makeAddrListItem = (addr: string) => r.li({ key: addr }, addr);
        message = rFragment({},
            message,
            !alreadyInvitedAddresses.length ? null : r.div({},
                t.upp.AlreadyInvSendAgainQ,
                r.ul({ className: 'e_InvRtr' },
                  alreadyInvitedAddresses.map(makeAddrListItem))),
            !failedAddresses.length ? null : r.div({},
                // Text: "These resulted in errors:"
                t.upp.InvErr_1, r.b({}, t.upp.InvErr_2), t.upp.InvErr_3,
                r.ul({ className: 'e_InvErr' },
                  failedAddresses.map(makeAddrListItem))),
            !alreadyJoinedAddresses.length ? null : r.div({},
                t.upp.TheseJoinedAlrdyC,
                r.ul({ className: 'e_InvJoind' },
                  alreadyJoinedAddresses.map(makeAddrListItem))));
      }

      // If nothing more to do, close.
      if (!alreadyInvitedAddresses.length) {
        this.close();
      }

      util.openDefaultStupidDialog({
        body: message,
        dialogClassName: 's_InvSentD',
        closeButtonTitle: alreadyInvitedAddresses.length === 0 ? t.Okay : t.Maybe + " ...",
        // Let's force the user to read and click ok, because this is a somewhat
        // important message, especially if there were any errors.
        closeOnClickOutside: false,
      });
    });
  },

  render: function() {
    const props: any = _.assign({}, this.props);
    props.title = t.upp.SendAnInv;

    let content;
    let buttonTitle = t.upp.SendInv;
    if (!this.state.isOpen) {
      // No content.
    }
    else {
      const isResend = this.state.alreadyInvitedAddresses;
      const info = isResend
          ? t.upp.ResendInvsQ
          : t.upp.SendInvExpl;
      buttonTitle = isResend
          ? r.span({ className: 'e_InvAgain' }, t.upp.InvAgain)
          : t.upp.SendInv;
      content = rFragment({},
        r.p({}, info),
        r.p({},
          // This text is for everyone, should be translated?
          // Or who may add to gropus? Only staff? No, also grop managers (not impl)
          // may add to groups. And maybe normal members too, just that joining-the-group
          // needs to be approved by the members who join, and the group managers /
          // staff, depending on the group settings.
          "To have the invited people auto join a group, insert a very first line " +  // I18N
          "with this text: ", r.code({}, 'addToGroups: @group_name'), " (including the @)."),
        // UX COULD reuse EmailInput —> PatternInput —> Input({ type: 'input' ... })
        // and add a multiline: true attr, and use type:textarea instead?
        Input({ type: 'textarea', label: t.EmailAddresses,
            placeholder: t.onePerLine,
            value: this.state.textareaValue,
            ref: 'emailInput', error: this.state.error, onChange: this.onEmailChanged }));
                                                    //  onChangeValueOk: this.onEmailChanged }));
    }

    return (
      Modal({ show: this.state.isOpen, onHide: this.close, dialogClassName: 's_InvD' },
        ModalBody({},
          content),
        ModalFooter({},
          PrimaryButton({ onClick: this.sendInvite, disabled: !this.state.maySubmit }, buttonTitle),
          Button({ onClick: this.close, className: 'e_Cncl' }, t.Cancel))));
  }
});

//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
