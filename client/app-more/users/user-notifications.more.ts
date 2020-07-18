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

/// <reference path="../more-prelude.more.ts" />


//------------------------------------------------------------------------------
   namespace debiki2.users {
//------------------------------------------------------------------------------

const r = ReactDOMFactories;


export const UserNotifications = createFactory({
  displayName: 'UserNotifications',

  getInitialState: function() {
    return { notfs: null, error: false };
  },

  componentDidMount: function() {
    const user: UserInclDetails = this.props.user;
    this.loadNotifications(user.id);
  },

  componentWillUnmount: function() {
    this.isGone = true;
  },

  // SHOULD Switch to componentDidUpdate instead, see  users-page.more.ts  for how.
  UNSAFE_componentWillReceiveProps: function(nextProps: any) {
    // Dupl code, also in view drafts. [7WUBKZ0]
    const me: Myself = this.props.store.me;
    const user: UserInclDetails = this.props.user;
    const nextLoggedInUser: Myself = nextProps.store.me;
    const nextUser: UserInclDetails = nextProps.user;
    if (me.id !== nextLoggedInUser.id ||
        user.id !== nextUser.id) {
      this.loadNotifications(nextUser.id);
    }
  },

  loadNotifications: function(userId: UserId) {
    // Dupl code, also in view drafts. [7WUBKZ0]
    const me: Myself = this.props.store.me;
    if (me.id !== userId && !isStaff(me)) {
      this.setState({
        error: "May not list an other user's notifications. [EdE7WK2L_]",
        notfs: null,
      });
      return;
    }
    Server.loadNotifications(userId, Date.now(), (notfs: Notification[]) => {
      if (this.isGone) return;
      this.setState({ notfs: notfs });
    }, () => {
      // Clear state.notfs, in case we're no longer allowed to view the notfs.
      this.setState({ error: true, notfs: null });
    });
  },

  render: function() {
    // Dupl code, also in view notfs. [7WUBKZ0]
    if (this.state.error)
      return (
        r.p({ className: 'e_UP_Notfs_Err' },
          _.isString(this.state.error) ? this.state.error : "Error [EsE7YKW2]."));

    if (!this.state.notfs)
      return r.p({}, t.Loading);

    const notfPrefsShortcut =
        r.p({ className: 's_UP_Nfs_PfsL' },
          "Go to ",
          Link({ to: './preferences/notifications' }, "Preferences → Notifications"),
          " to edit settings, e.g. to subscribe to categories.");

    const user: UserInclDetails = this.props.user;
    const store: Store = this.props.store;
    const me: Myself = store.me;
    const isMe = user.id === me.id;

    const anyNoNotfsMessage = this.state.notfs.length ? null :
        r.p({ className: 'e_UP_Notfs_None' }, t.upp.NoNotfs);

    const notfsElems = this.state.notfs.map((notf: Notification) =>
        r.li({ key: notf.id },
          Link({ to: linkToNotificationSource(notf) },
            notification.Notification({ notification: notf, verbose: true }))));

    return (
      r.div({},
        notfPrefsShortcut,
        r.p({}, isMe ? t.upp.NotfsToYouC : t.upp.NotfsToOtherC(user.username || user.fullName)),
        anyNoNotfsMessage,
        r.ol({ className: 'esNotfs' },
          notfsElems)));
  }
});


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
