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
/// <reference path="../Server.ts" />

//------------------------------------------------------------------------------
   module debiki2.users {
//------------------------------------------------------------------------------

var d = { i: debiki.internal, u: debiki.v0.util };
var $: JQueryStatic = d.i.$;
var r = React.DOM;
var reactCreateFactory = React['createFactory'];
var ReactBootstrap: any = window['ReactBootstrap'];
var Button = reactCreateFactory(ReactBootstrap.Button);
var Input = reactCreateFactory(ReactBootstrap.Input);
var Modal = reactCreateFactory(ReactBootstrap.Modal);
var ModalTrigger = reactCreateFactory(ReactBootstrap.ModalTrigger);
var RouterState = window['ReactRouter'].State;
var RouterNavigation = window['ReactRouter'].Navigation;
import UserPreferences = debiki2.users.UserPreferences;


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
    Server.loadInvitesSentBy(userId, (invites) => {
      this.setState({
        invites: invites
      });
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
    if (!this.state.invites)
      return r.p({}, 'Loading...');

    var user: CompleteUser = this.props.user;
    var loggedInUser: User = this.props.loggedInUser;

    var inviteButton;
    var introText = r.p({}, 'Here you can invite people to join this site. ' + (
        this.state.invites.length
            ? 'Invites that you have already sent are listed below.'
            : 'You have not invited anyone yet.'));
    if (user.id === loggedInUser.userId) {
      inviteButton =
        ModalTrigger({ modal: InviteDialog({ addInvite: this.addInvite }) },
          Button({}, 'Send an Invite'));
    }
    else {
      introText = "Here you can see any invites sent by " + user.username + ".";
      if (!this.state.invites.length) {
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
              r.th({}, 'Invitation Created At'))),
            // Later on: Seen, Topics Viewed, Posts Read, Read Time, Days Visited, Trust Level, Threat Level
          r.tbody({},
            inviteRows))));
  }
});


var InviteRow = createComponent({
  render: function() {
    var invite: Invite = this.props.invite;
    var userEmailOrLink;
    var acceptedAt = '';
    if (invite.userId) {
      userEmailOrLink = r.a({ href: '/-/users/#/id/' + invite.userId }, invite.invitedEmailAddress);
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


var InviteDialog = createComponent({
  sendInvite: function() {
    var emailAddress = this.refs.emailInput.getValue();
    Server.sendInvite(emailAddress, (invite: Invite) => {
      this.props.addInvite(invite);
      this.props.onRequestHide();
    });
  },

  render: function() {
    var props = $.extend({}, this.props);
    props.title = 'Send an Invite';
    return (
      Modal(props,
        r.div({ className: 'modal-body' },
          r.p({}, "We'll send your friend a brief email, and he or she then clicks a link " +
                "to join immediately, no login required."),
          Input({ type: 'email', label: 'Email Address', placeholder: 'Enter email',
              ref: 'emailInput' })),

        r.div({ className: 'modal-footer' },
          Button({ onClick: this.sendInvite },
              'Send Invite'),
          Button({ onClick: this.props.onRequestHide },
              'Cancel'))));
  }
});

//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
