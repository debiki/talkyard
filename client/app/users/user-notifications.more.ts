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
   module debiki2.users {
//------------------------------------------------------------------------------

var r = React.DOM;


export var UserNotificationsComponent = React.createClass({
  getInitialState: function() {
    return { notfs: null, error: false };
  },

  componentDidMount: function() {
    var user: CompleteUser = this.props.user;
    this.loadNotifications(user.id);
  },

  componentWillReceiveProps: function(nextProps) {
    var loggedInUser: Myself = this.props.loggedInUser;
    var user: CompleteUser = this.props.user;
    var nextLoggedInUser: Myself = nextProps.loggedInUser;
    var nextUser: CompleteUser = nextProps.user;
    if (loggedInUser.userId !== nextLoggedInUser.userId ||
        user.id !== nextUser.id) {
      this.loadNotifications(nextUser.id);
    }
  },

  loadNotifications: function(userId: number) {
    var me: Myself = this.props.loggedInUser;
    if (me.id !== userId && !isStaff(me)) {
      this.setState({
        error: "May not list an other user's notifications.",
        notfs: null,
      });
      return;
    }
    Server.loadNotifications(userId, Date.now(), (notfs: Notification[]) => {
      this.setState({ notfs: notfs });
    }, () => {
      // Tacke care to clear state.notfs, in case we're no longer allowed to view the notfs.
      this.setState({ error: true, notfs: null });
    });
  },

  render: function() {
    if (this.state.error)
      return r.p({}, _.isString(this.state.error) ? this.state.error : "Error [EsE7YKW2].");

    if (!this.state.notfs)
      return r.p({}, "Loading...");

    var user: CompleteUser = this.props.user;
    var isMe = user.id === this.props.loggedInUser.userId;
    var toWho = isMe ? "you" : user.username || user.fullName;

    var notfsElems = this.state.notfs.map((notf: Notification) =>
        r.li({ key: notf.id },
          r.a({ href: linkToNotificationSource(notf) },
            notification.Notification({ notification: notf, verbose: true }))));

    return (
      r.div({},
        r.p({}, "Notifications to " + toWho + ":"),
        r.ol({ className: 'esNotfs' },
          notfsElems)));
  }
});


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
