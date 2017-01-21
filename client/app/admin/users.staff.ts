/*
 * Copyright (c) 2015-2016 Kaj Magnus Lindberg
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
/// <reference path="../more-bundle-already-loaded.d.ts" />
/// <reference path="review-posts.staff.ts" />

//------------------------------------------------------------------------------
   namespace debiki2.admin {
//------------------------------------------------------------------------------

var r = React.DOM;
var ReactBootstrap: any = window['ReactBootstrap'];
var Nav = reactCreateFactory(ReactBootstrap.Nav);
var NavItem = reactCreateFactory(ReactBootstrap.NavItem);


export var UsersTabComponent = React.createClass(<any> {
  getInitialState: function() {
    return {};
  },

  render: function() {
    return (
      r.div({},
        r.div({ className: 'dw-sub-nav' },
          Nav({ bsStyle: 'pills' },
            r.li({}, Link({ to: '/-/admin/users/enabled', activeClassName: 'active' }, "Enabled")),
            r.li({}, Link({ to: '/-/admin/users/new', activeClassName: 'active' }, "Waiting")),
            r.li({}, Link({ to: '/-/admin/users/invited', activeClassName: 'active' }, "Invite")))),
            // with react-router-bootstrap, sth like:
            //   NavItem({ eventKey: 'users-new' }, 'New Waiting'))),   ?
        r.div({ className: 'dw-admin-panel' },
          React.cloneElement(this.props.children, { store: this.props.store }))));
  }
});


export var ActiveUsersPanelComponent = React.createClass({
  render: function() {
    return UserList({ whichUsers: 'ActiveUsers', intro: r.p({},
      "Enabled user accounts:") }); /* (This just means that the ", r.i({}, "account "),
      "is active — it does not mean that the users has been here recently.)") });
      */
  }
});


export var NewUsersPanelComponent = React.createClass({
  render: function() {
    return UserList({ whichUsers: 'NewUsers', intro: r.p({},
        "Users who have signed up to join this site, and are waiting for you to approve them:") });
  }
});


export var InvitedUsersPanelComponent = React.createClass({
  getInitialState: function() {
    return {
      invites: null
    };
  },

  componentDidMount: function() {
    Server.loadAllInvites(invites => {
      this.setState({ invites: invites });
    });
  },

  componentDidUnmount: function() {
    this.isGOne = true;
  },

  sendInvites: function() {
    // Don't leave the Admin Area and go to the user's page, to send the invite
    // — usability testing shows that this makes people confused.
    // Instead open the dialog here, in the admin area.
    users.openInviteSomeoneDialog((invite) => {
      if (this.isGone) return;
      this.setState({ invites: this.state.invites.concat(invite) });
    });
  },

  render: function() {
    let store: Store = this.props.store;
    let invites: Invite[] = this.state.invites;
    let introText;
    let listOfInvites;
    if (!_.isArray(invites)) {
      introText = "Loading ...";
    }
    else if (_.isEmpty(invites)) {
      introText = "No invites sent.";
    }
    else {
      introText = "People who have been invited to this site:";
      listOfInvites = invites.map((invite: Invite) => users.InviteRow(
          { invite: invite, store: store, showSender: true,
            // Invited-email + inviter-id is unique. [5GPJ4A0]
            key: invite.invitedEmailAddress + ' ' + invite.createdById }));
    }

    // Could break out rendering code to separate module — also used in user profile. [8HRAE3V]
    return (
      r.div({},
        Button({ onClick: this.sendInvites, className: 's_AA_Us_Inv_SendB' }, "Send Invites"),
        r.div({ className: 'esAdminSectionIntro' },
          r.p({}, introText)),
        // Dupl table headers [3GK0YU2]
        r.table({ className: 'dw-invites-table' },
          r.thead({},
            r.tr({},
              r.th({}, "Invited email"),
              r.th({}, "Member who accepted"),
              r.th({}, "Invitation accepted"),
              r.th({}, "Invitation sent"),
              r.th({}, "Sent by"))),
          r.tbody({ className: 's_InvsL'},
            listOfInvites))));
  }
});


var UserList = createComponent({
  componentDidMount: function() {
    Server.listCompleteUsers(this.props.whichUsers, users => {
      this.setState({ users: users });
    });
  },

  render: function() {
    if (!this.state)
      return r.p({}, 'Loading...');

    var now = new Date().getTime();
    var userRows = this.state.users.map((user: MemberInclDetails) => {
      return UserRow({ user: user, now: now, key: user.id, whichUsers: this.props.whichUsers });
    });

    var actionHeader = this.props.whichUsers === 'NewUsers'
        ? r.th({}, 'Actions')
        : null;

    return (r.div({},
      r.div({ className: 'esAdminSectionIntro' }, this.props.intro),
      r.div({ className: 'dw-users-to-review' },
        r.table({ className: 'table' },
          r.thead({},
            r.tr({},
              r.th({}, 'Username (Full Name)'),
              r.th({}, 'Email'),
              actionHeader,
              r.th({}, 'Country'),
              r.th({}, 'URL'),
              r.th({}, 'Created At'))),
          r.tbody({},
            userRows)))));
  }
});


var UserRow = createComponent({
  getInitialState: function() {
    return {};
  },

  approveUser: function() {
    Server.approveRejectUser(this.props.user, 'Approve', () => {
      this.setState({ wasJustApproved: true });
    });
  },

  rejectUser: function() {
    Server.approveRejectUser(this.props.user, 'Reject', () => {
      this.setState({ wasJustRejected: true });
    });
  },

  undoApproveOrReject: function() {
    Server.approveRejectUser(this.props.user, 'Undo', () => {
      this.setState({ wasJustRejected: false, wasJustApproved: false });
    });
  },

  render: function() {
    var user: MemberInclDetails = this.props.user;

    var actions;
    if (this.props.whichUsers !== 'NewUsers') {
      // Don't show any actions.
    }
    else if (this.state.wasJustApproved) {
      actions = r.span({},
        'Approved.',
         Button({ onClick: this.undoApproveOrReject }, 'Undo'));
    }
    else if (this.state.wasJustRejected) {
      actions = r.span({},
        'Rejected.',
         Button({ onClick: this.undoApproveOrReject }, 'Undo'));
    }
    else {
      actions = r.span({},
          Button({ onClick: this.approveUser }, 'Approve'),
          Button({ onClick: this.rejectUser }, 'Reject'));
    }

    var actionsCell = actions
        ? r.td({}, actions)
        : null;

    var usernameElem = r.span({ className: 'dw-username' }, user.username);
    var fullNameElem;
    if (user.fullName) {
      fullNameElem = r.span({ className: 'dw-fullname' }, ' (' + user.fullName + ')');
    }

    return (
      r.tr({},
        r.td({},
          Link({ to: linkToUserInAdminArea(user.id) }, usernameElem, fullNameElem)),

        r.td({},
          user.email),

        actionsCell,

        r.td({},
          user.country),

        r.td({},
          user.url),

        r.td({},
          moment(user.createdAtEpoch).from(this.props.now))));
  }
});


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
