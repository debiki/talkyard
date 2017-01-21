/**
 * Copyright (c) 2015 Kaj Magnus Lindberg
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


//------------------------------------------------------------------------------
   namespace debiki2.users {
//------------------------------------------------------------------------------

var r = React.DOM;


export var UserNotificationsComponent = React.createClass({
  getInitialState: function() {
    return { notfs: null, error: false };
  },

  componentDidMount: function() {
    var user: MemberInclDetails = this.props.user;
    this.loadNotifications(user.id);
  },

  componentWillReceiveProps: function(nextProps) {
    var me: Myself = this.props.me;
    var user: MemberInclDetails = this.props.user;
    var nextLoggedInUser: Myself = nextProps.me;
    var nextUser: MemberInclDetails = nextProps.user;
    if (me.id !== nextLoggedInUser.id ||
        user.id !== nextUser.id) {
      this.loadNotifications(nextUser.id);
    }
  },

  loadNotifications: function(userId: UserId) {
    var me: Myself = this.props.me;
    if (me.id !== userId && !isStaff(me)) {
      this.setState({
        error: "May not list an other user's notifications. [EdE7WK2L_]",
        notfs: null,
      });
      return;
    }
    Server.loadNotifications(userId, Date.now(), (notfs: Notification[]) => {
      this.setState({ notfs: notfs });
    }, () => {
      // Clear state.notfs, in case we're no longer allowed to view the notfs.
      this.setState({ error: true, notfs: null });
    });
  },

  render: function() {
    if (this.state.error)
      return (
        r.p({ className: 'e_UP_Notfs_Err' },
          _.isString(this.state.error) ? this.state.error : "Error [EsE7YKW2]."));

    if (!this.state.notfs)
      return r.p({}, "Loading...");

    let user: MemberInclDetails = this.props.user;
    let me: Myself = this.props.me;
    let isMe = user.id === me.id;
    let toWho = isMe ? "you" : user.username || user.fullName;

    let anyNoNotfsMessage = this.state.notfs.length ? null :
        r.p({ className: 'e_UP_Notfs_None' }, "No notifications");

    var notfsElems = this.state.notfs.map((notf: Notification) =>
        r.li({ key: notf.id },
          r.a({ href: linkToNotificationSource(notf) },
            notification.Notification({ notification: notf, verbose: true }))));

    return (
      r.div({},
        r.p({}, "Notifications to " + toWho + ":"),
        anyNoNotfsMessage,
        r.ol({ className: 'esNotfs' },
          notfsElems)));
  }
});


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
