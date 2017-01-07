/*
 * Copyright (c) 2016 Kaj Magnus Lindberg
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
/// <reference path="../plain-old-javascript.d.ts" />
/// <reference path="../slim-bundle.d.ts" />

//------------------------------------------------------------------------------
   module debiki2.util {
//------------------------------------------------------------------------------

var r = React.DOM;
var ReactBootstrap: any = window['ReactBootstrap'];
var Modal = reactCreateFactory(ReactBootstrap.Modal);
var ModalBody = reactCreateFactory(ReactBootstrap.ModalBody);


export interface StupidDialogStuff {
  dialogClassName?: string;
  //header?: any;
  body?: any;
  closeButtonTitle?: any;
  small?: boolean,
  onCloseOk?: () => void,
}


/**
 * Makes a function that returns a simple dialog that you can use for dialogs
 * like: "Wrong password [Okay]" i.e. only a simple message and a close button.
 */
export function makeStupidDialogGetter() {
  var stupidDialog;

  return function() {
    if (!stupidDialog) {
      stupidDialog = ReactDOM.render(StupidDialog(), utils.makeMountNode());
    }
    return stupidDialog;
  }
}


var getDefaultStupidDialog = makeStupidDialogGetter();

export function openDefaultStupidDialog(stuff: StupidDialogStuff) {
  getDefaultStupidDialog().open(stuff);
}


export var StupidDialog = createComponent({
  getInitialState: function () {
    return { isOpen: false };
  },

  open: function(stuff: StupidDialogStuff) {
    this.setState({ isOpen: true, stuff: stuff });
  },

  close: function() {
    this.setState({ isOpen: false });
    var stuff: StupidDialogStuff = this.state.stuff || {};
    if (stuff.onCloseOk) {
      stuff.onCloseOk();
    }
  },

  render: function () {
    var stuff: StupidDialogStuff = this.state.stuff || {};
    var body = stuff.body;
    //if (_.isString(body)) {  -- why this if?
      body = ModalBody({ className: 'clearfix' },
        r.div({ style: { marginBottom: '2em' }}, body),
        PrimaryButton({ onClick: this.close, className: 'e_SD_CloseB' },
          stuff.closeButtonTitle || "Okay"));
    /*}
    else if (body) {
      die("Non-string content not implemented [EsE7KYKW2]");
    }*/
    return (
      Modal({ show: this.state.isOpen, onHide: this.close,
          dialogClassName: 'esStupidDlg ' + (stuff.small ? ' esStupidDlg-Small' : '') +
              (stuff.dialogClassName || '') },
        //stuff.header,
        body));
        // stuff.footer || defaultFooter()));
  }
});


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
