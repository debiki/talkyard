/*
 * Copyright (C) 2015-2016 Kaj Magnus Lindberg
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
//  <reference path="../react-bootstrap-old/Input.more.ts" />
//  <reference path="../widgets.more.ts" />

//------------------------------------------------------------------------------
  namespace debiki2.help {
//------------------------------------------------------------------------------

var r = React.DOM;
var Modal = rb.Modal;
var ModalBody = rb.ModalBody;


export function openHelpDialogUnlessHidden(message) {
  getHelpDialog().open(message);
}


var helpDialog;

function getHelpDialog() {
  if (!helpDialog) {
    helpDialog = ReactDOM.render(HelpDialog(), utils.makeMountNode());
  }
  return helpDialog;
}


var HelpDialog = createComponent({
  getInitialState: function () {
    return { isOpen: false };
  },

  open: function(message: HelpMessage) {
    dieIf(!message.content, 'EsE6YK02W');
    // Bad practice to access the store like this? Oh well. Will rewrite anyway, in [redux] (?).
    var store = ReactStore.allData();
    if (!isHelpMessageClosedAnyVersion(store, message.id)) {
      this.setState({ isOpen: true, message: message });
    }
  },

  close: function() {
    if (this.refs.hideMeCheckbox && this.refs.hideMeCheckbox.getChecked()) {
      ReactActions.hideHelpMessageWithId(this.state.message.id);
    }
    this.setState({ isOpen: false, message: null });
  },

  render: function () {
    var message: HelpMessage = this.state.message;
    var content = message ? message.content : null;

    var hideThisHelpTipsCheckbox = !message || !message.id ? null :
      Input({ type: 'checkbox', defaultChecked: true, ref: 'hideMeCheckbox',
        label: "Hide this tips" });

    content = !content ? null :
        ModalBody({},
          r.div({ className: 'esHelpDlg_body_wrap'},
            r.div({ className: 'esHelpDlg_body' }, content),
            r.div({ className: 'esHelpDlg_btns' },
              hideThisHelpTipsCheckbox,
              PrimaryButton({ onClick: this.close }, "Okay"))));

    return (
      Modal({ show: this.state.isOpen, onHide: this.close, dialogClassName: 'esHelpDlg' },
       content));
  }
});


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 list
