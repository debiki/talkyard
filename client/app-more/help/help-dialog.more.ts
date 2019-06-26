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

/// <reference path="../more-prelude.more.ts" />
//  <reference path="../react-bootstrap-old/Input.more.ts" />
//  <reference path="../widgets.more.ts" />

//------------------------------------------------------------------------------
  namespace debiki2.help {
//------------------------------------------------------------------------------

const r = ReactDOMFactories;
const Modal = rb.Modal;
const ModalBody = rb.ModalBody;


export function openHelpDialogUnlessHidden(message) {
  getHelpDialog().open(message);
}


let helpDialog;

function getHelpDialog() {
  if (!helpDialog) {
    helpDialog = ReactDOM.render(HelpDialog(), utils.makeMountNode());
  }
  return helpDialog;
}


const HelpDialog = createComponent({
  displayName: 'HelpDialog',

  getInitialState: function () {
    return { isOpen: false };
  },

  open: function(message: HelpMessage) {
    dieIf(!message.content, 'EsE6YK02W');
    // Bad practice to access the store like this? Oh well. Will rewrite anyway, in [redux] (?).
    const store: Store = ReactStore.allData();
    if (!isHelpMessageClosedAnyVersion(store, message.id)) {
      this.setState({
        isOpen: true,
        message: message,
        hideNextTime: message.defaultHide !== false,
      });
    }
    else if (message.doAfter) {
      message.doAfter();
    }
  },

  close: function() {
    if (this.state.hideNextTime) {
      ReactActions.hideHelpMessageWithId(this.state.message.id);
    }
    const doAfter = this.state.message.doAfter;
    this.setState({ isOpen: false, message: null });
    if (doAfter) {
      doAfter();
    }
  },

  render: function () {
    const message: HelpMessage = this.state.message;
    let content = message ? message.content : null;

    const hideThisHelpTipsCheckbox = !message || !message.id ? null :
      Input({ type: 'checkbox', checked: this.state.hideNextTime,
        onChange: (event) => this.setState({ hideNextTime: event.target.checked }),
        label: "Hide these tips" });

    content = !content ? null :
        ModalBody({},
          r.div({ className: 'esHelpDlg_body_wrap'},
            r.div({ className: 'esHelpDlg_body' }, content),
            r.div({ className: 'esHelpDlg_btns' },
              hideThisHelpTipsCheckbox,
              PrimaryButton({ onClick: this.close, className: 'e_HelpOk' }, "Okay"))));

    return (
      Modal({ show: this.state.isOpen, onHide: this.close, dialogClassName: 'esHelpDlg' },
       content));
  }
});


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 list
