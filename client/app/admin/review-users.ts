/*
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
/// <reference path="../../shared/plain-old-javascript.d.ts" />
/// <reference path="../ReactStore.ts" />
/// <reference path="../Server.ts" />

//------------------------------------------------------------------------------
   module debiki2.admin {
//------------------------------------------------------------------------------

var d = { i: debiki.internal, u: debiki.v0.util };
var r = React.DOM;
var reactCreateFactory = React['createFactory'];
var ReactBootstrap: any = window['ReactBootstrap'];
var Button = reactCreateFactory(ReactBootstrap.Button);


export var ReviewUsersPanel = createComponent({
  mixins: [SaveSettingMixin],

  componentDidMount: function() {
    Server.loadUsersPendingApproval(users => {
      this.setState({ users: users });
    });
  },

  render: function() {
    if (!this.state)
      return r.p({}, 'Loading...');

    var now = new Date().getTime();
    var userElems = this.state.users.map(user => {
      return UserPendingApproval({ user: user, now: now });
    });

    return (
      r.div({ className: 'dw-users-to-review' },
        r.table({ className: 'table' },
          r.thead({},
            r.tr({},
              r.th({}, 'Username (Full Name)'),
              r.th({}, 'Email'),
              r.th({}, 'Actions'),
              r.th({}, 'Country'),
              r.th({}, 'URL'),
              r.th({}, 'Created At'))),
          r.tbody({},
            userElems))));
  }
});


var UserPendingApproval = createComponent({
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
    var user = this.props.user;

    var actions;
    if (this.state.wasJustApproved) {
      actions = [
        'Approved.',
         Button({ className: 'approve-user', onClick: this.undoApproveOrReject }, 'Undo')];
    }
    else if (this.state.wasJustRejected) {
      actions = [
        'Rejected.',
         Button({ className: 'approve-user', onClick: this.undoApproveOrReject }, 'Undo')];
    }
    else {
      actions = [
          Button({ className: 'approve-user', onClick: this.approveUser }, 'Approve'),
          Button({ className: 'reject-user', onClick: this.rejectUser }, 'Reject')];
    }

    var usernameAndFullName = [
        r.span({ className: 'dw-username' }, user.username),
        r.span({ className: 'dw-fullname' }, ' (' + user.fullName + ')')];

    return (
      r.tr({},
        r.td({},
          usernameAndFullName),

        r.td({},
          user.email),

        r.td({},
          actions),

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
