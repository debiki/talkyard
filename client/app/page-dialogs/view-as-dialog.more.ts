/*
 * Copyright (C) 2017 Kaj Magnus Lindberg
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
/// <reference path="../util/stupid-dialog.more.ts" />


//------------------------------------------------------------------------------
   namespace debiki2.pagedialogs {
//------------------------------------------------------------------------------

let r = React.DOM;
let Modal = rb.Modal;
let ModalHeader = rb.ModalHeader;
let ModalTitle = rb.ModalTitle;
let ModalBody = rb.ModalBody;
let ModalFooter = rb.ModalFooter;


let viewAsDialog;


// Opens a dialog where the current user, which should be a staff user,
// can choose to view the site as another user. To verify that that other user
// has the correct access permissions.
//
export function openViewAsDialog() {
  if (!viewAsDialog) {
    viewAsDialog = ReactDOM.render(ViewAsDialog(), utils.makeMountNode());
  }
  viewAsDialog.open();
}


let ViewAsDialog = createComponent({
  displayName: 'ViewAsDialog',

  getInitialState: function () {
    return { isOpen: false };
  },

  componentWillUnmount: function() {
    this.isGone = true;
  },

  open: function() {
    this.setState({ isOpen: true });
  },

  close: function() {
    this.setState({ isOpen: false });
  },

  viewAsStranger: function() {
    Server.viewAsOther(NoUserId, () => {
      // Continue even if this.isGone, because now we're viewing as another user, regardless.
      this.close();
      util.openDefaultStupidDialog({
        body: r.div({},
          r.p({}, "You're now viewing this site as a stranger."),
          r.p({ className: 's_StillLoggedInWarning' }, "You are still logged in. ",
            r.b({}, "Be sure to log out"), ", before leaving.")),
        closeButtonTitle: "Continue ...",
        onCloseOk: function() {
          util.openDefaultStupidDialog({
            body: "Now I'll reload the page.",
            onCloseOk: function() {
              // No idea why, but passing `location.reload` directly to the dialog, results
              // in an "Illegal invocation" error (in Opera 42 at least).
              location.reload();
            }
          });
        }
      });
    });
  },

  render: function () {
    let content;

    if (!this.state.isOpen) {
      // Nothing.
    }
    else {
      content =
        r.div({},
          r.p({ className: 's_VAD_Intro' },
            "Here you can view this forum as someone else. So you can verify that " +
            "strangers don't have access categories and topics supposed to be private. " +
            "Or that the right people ", r.i({}, "do"), " have access. " +
            "— More view-as alternatives will be added below, later."),
          r.div({ className: 's_VAD_Sbd' },
            Button({ onClick: this.viewAsStranger }, "View as stranger"),
            r.div({ className: 'help-block' },
              "Strangers are unknown people who have not logged in.")));
    }

    return (
      Modal({ show: this.state.isOpen, onHide: this.close, className: 's_VAD' },
        ModalHeader({}, ModalTitle({}, "View as ...")),
        ModalBody({}, content),
        ModalFooter({},
          Button({ onClick: this.close }, "Cancel"))));
  }
});


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
