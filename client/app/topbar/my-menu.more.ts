/*
 * Copyright (C) 2014-2016 Kaj Magnus Lindberg
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
/// <reference path="../notification/Notification.more.ts" />

//------------------------------------------------------------------------------
   namespace debiki2.topbar {
//------------------------------------------------------------------------------

var r = React.DOM;
var DropdownModal = utils.DropdownModal;


var myMenuDropdownModal;

export function openMyMenu(store: Store, where) {
  if (!myMenuDropdownModal) {
    myMenuDropdownModal = ReactDOM.render(MyMenuDropdownModal(), utils.makeMountNode());
  }
  myMenuDropdownModal.openAt(store, where);
}


var MyMenuDropdownModal = createComponent({
  displayName: 'MyMenuDropdownModal',

  getInitialState: function() {
    return {
      isOpen: false,
    };
  },

  openAt: function(store: Store, where) {
    this.setState({
      isOpen: true,
      store: store,
      windowWidth: window.innerWidth,
      buttonRect: cloneRect(where.getBoundingClientRect()),
    });
  },

  close: function() {
    this.setState({ isOpen: false });
  },

  onLogoutClick: function() {
    debiki2.ReactActions.logout();
  },

  viewOlderNotfs: function() {
    ReactActions.goToUsersNotifications(this.state.store.user.userId);
  },

  render: function() {
    var menuContent;

    if (this.state.isOpen) {
      var store: Store = this.state.store;
      var me: Myself = store.me;

      // ------- Staff link, notfs, help

      var urgentReviewTasks = makeNotfIcon('reviewUrgent', me.numUrgentReviewTasks);
      var otherReviewTasks = makeNotfIcon('reviewOther', me.numOtherReviewTasks);
      var adminMenuItem = !isStaff(me) ? null :
        MenuItemLink({ href: linkToAdminPage(), className: 'esMyMenu_admin' },
          r.span({ className: 'icon-settings' }, "Admin"));
      var reviewMenuItem = !urgentReviewTasks && !otherReviewTasks ? null :
        MenuItemLink({ href: linkToReviewPage(), id: 'e2eMM_Review' },
          "Needs review ", urgentReviewTasks, otherReviewTasks);

      var adminHelpLink = !isStaff(me) ? null :
        MenuItemLink({ href: externalLinkToAdminHelp(), target: '_blank',
            className: 'esMyMenu_adminHelp' },
          r.span({}, (me.isAdmin ? "Admin" : "Staff") + " help ",
            r.span({ className: 'icon-link-ext' })));

      // ------- Personal notf icons

      var notfsDivider = me.notifications.length ? MenuItemDivider() : null;
      var notfsElems = me.notifications.map((notf: Notification) =>
          MenuItemLink({ key: notf.id, href: linkToNotificationSource(notf),
              className: notf.seen ? '' : 'esNotf-unseen' },
            notification.Notification({ notification: notf })));
      if (me.thereAreMoreUnseenNotfs) {
        notfsElems.push(
            MenuItem({ key: 'More', onClick: this.viewOlderNotfs }, "View more notifications..."));
      }

      // ------- Stop impersonating

      var stopImpersonatingMenuItem = !store.isImpersonating ? null :
          MenuItem({ onClick: Server.stopImpersonatingReloadPage,
              id: 'e2eMM_StopImp' }, "Stop impersonating");

      // ------- The menu

      menuContent =
        r.ul({ className: 'dropdown-menu', onClick: this.close },
          adminMenuItem,
          adminHelpLink,
          reviewMenuItem,
          (adminMenuItem || reviewMenuItem) ? MenuItemDivider() : null,
          MenuItemLink({ href: linkToMyProfilePage(store), id: 'e2eMM_Profile' },
            "View/edit your profile"),
          MenuItem({ onClick: this.onLogoutClick, id: 'e2eMM_Logout' }, "Log out"),
          stopImpersonatingMenuItem,
          notfsDivider,
          notfsElems,
          MenuItemDivider(),
          MenuItem({ onClick: ReactActions.showHelpMessagesAgain },
            r.span({ className: 'icon-help' }, "Unhide help messages")));
    }


    return (
      DropdownModal({ show: this.state.isOpen, onHide: this.close, showCloseButton: true,
          atRect: this.state.buttonRect, windowWidth: this.state.windowWidth,
          className: 'esAvtrName esMyMenu' },
        menuContent));
  }
});


function makeNotfIcon(type: string, number: number) {
  if (!number) return null;
  var numMax99 = Math.min(99, number);
  var wideClass = number >= 10 ? ' esNotfIcon-wide' : '';
  return r.div({ className: 'esNotfIcon esNotfIcon-' + type + wideClass}, numMax99);
}


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=tcqwn list
