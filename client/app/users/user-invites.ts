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
var RouterState = window['ReactRouter'].State;
var RouterNavigation = window['ReactRouter'].Navigation;
import UserPreferences = debiki2.users.UserPreferences;


export var UserInvites = createComponent({
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

  sendInvite: function() {
    Server.sendInvite("abc@ex.com", (invite: Invite) => {
      var invites = this.state.invites;
      invites.unshift(invite);
      this.setState({
        invites: invites
      })
    });
  },

  render: function() {
    if (!this.state.invites)
      return r.p({}, 'Loading...');

    var user: CompleteUser = this.props.user;
    var loggedInUser: User = this.props.loggedInUser;

    var inviteButton;
    var otherUserText;
    if (user.id === loggedInUser.userId) {
      inviteButton = Button({ onClick: this.sendInvite }, 'Send an Invite');
    }
    else {
      otherUserText = r.p({}, "Here you can see any invites sent by " + user.username + ".");
    }

    if (!this.state.invites.length)
      return (
        r.div({},
          r.p({}, 'Here you can invite people to join this site. You have not invited ' +
            'anyone thus far.'),
          inviteButton));

    var now = Date.now();
    var inviteRows = this.state.invites.map(function(invite) {
      return InviteRow({ invite: invite, now: now });
    });

    return (
      r.div({},
        otherUserText,
        inviteButton,
        r.table({},
          r.thead({},
            r.tr({}, 'Invited User'),
            r.tr({}, 'Redeemed'),
            r.tr({}, 'Sent at')),
            // Later on: Seen, Topics Viewed, Posts Read, Read Time, Days Visited, Trust Level, Threat Level
          r.tbody({},
            inviteRows))));
  }
});


var InviteRow = createComponent({
  render: function() {
    var invite = this.props.invite;
    return (
      r.tr({},
        r.td({},
          invite.invitedEmailAddress),

        r.td({},
          moment(invite.redeemedAtEpoch).from(this.props.now)),

        r.td({},
          moment(invite.createdAtEpoch).from(this.props.now))));
  }
});

//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list