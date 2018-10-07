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

/// <reference path="../slim-bundle.d.ts" />

//------------------------------------------------------------------------------
   namespace debiki2.util {
//------------------------------------------------------------------------------

const r = ReactDOMFactories;
const Modal = rb.Modal;
const ModalBody = rb.ModalBody;


export interface StupidDialogStuff {
  dialogClassName?: string;
  body?: any;
  closeButtonTitle?: any;
  primaryButtonTitle?: any;
  secondaryButonTitle?: any;
  small?: boolean,
  tiny?: boolean,
  // number = 1 if primary / okay button clicked, 2 if secondary button clicked, and
  // 0 if no button clicked, that is, if dialog closed by clicking x or outside.
  onCloseOk?: (number) => void,
  preventClose?: boolean,
  closeOnClickOutside?: boolean, // default true
}


/**
 * Makes a function that returns a simple dialog that you can use for dialogs
 * like: "Wrong password [Okay]" i.e. only a simple message and a close button.
 *
 * But if you specify `primaryButtonTitle` and `secondaryButtonTitle` it'll show two
 * buttons, and pass 0, 1 or 2 to `onCloseOk` depending on if the primary (1)
 * or secondary (2) button, or no button (0, if click outside closes) was clicked.
 */
export function makeStupidDialogGetter() {
  let stupidDialog;

  return function() {
    if (!stupidDialog) {
      stupidDialog = ReactDOM.render(StupidDialog(), utils.makeMountNode());
    }
    return stupidDialog;
  }
}


const getDefaultStupidDialog = makeStupidDialogGetter();

export function openDefaultStupidDialog(stuff: StupidDialogStuff) {
  getDefaultStupidDialog().open(stuff);
}


export const StupidDialog = createComponent({
  displayName: 'StupidDialog',

  getInitialState: function () {
    return { isOpen: false };
  },

  open: function(stuff: StupidDialogStuff) {
    const winWidth = window.innerWidth;
    const atX = eds.isInEmbeddedCommentsIframe ? winWidth / 2 : undefined;
    this.setState({ isOpen: true, stuff, atX, winWidth });
  },

  close: function(whichButton: number) {
    this.setState({ isOpen: false });
    const stuff: StupidDialogStuff = this.state.stuff || {};
    if (stuff.onCloseOk) {
      stuff.onCloseOk(whichButton);
    }
  },

  render: function () {
    const stuff: StupidDialogStuff = this.state.stuff || {};
    const preventClose = stuff.preventClose;
    const makeCloseFn = (whichButton) => () => this.close(whichButton);
    const body = ModalBody({ className: 'clearfix' },
      r.div({ style: { marginBottom: '2em' }}, stuff.body),
      r.div({ style: { float: 'right' }},
        preventClose ? null : PrimaryButton({ onClick: makeCloseFn(1), className: 'e_SD_CloseB' },
          // About "Okay" button title: COULD use English, if in admin area / staff-only
          // functionality — that's supposed to be English only.
          stuff.closeButtonTitle || stuff.primaryButtonTitle || t.Okay),
        preventClose || !stuff.secondaryButonTitle ? null : Button({
            onClick: makeCloseFn(2), className: 'e_SD_SecB' },
          stuff.secondaryButonTitle)));

    const className = 'esStupidDlg ' +
            (stuff.small ? 'esStupidDlg-Small ' : '') +
            (stuff.tiny ? 'esStupidDlg-Tiny ' : '') +
            (stuff.dialogClassName || '');

    const maybeClose =
      preventClose || (stuff.closeOnClickOutside === false) ? null : makeCloseFn(0);

    // CLEAN_UP, SMALLER_BUNDLE: use the same type of dialog for both non-iframe and iframe.
    let result;
    if (!eds.isInEmbeddedCommentsIframe) {
      result = (
        Modal({
            show: this.state.isOpen,
            onHide: maybeClose,
            dialogClassName: className },
          body));
    }
    else {
      // Don't use Modal — it could display outside the browser's viewport.
      result = (
        utils.DropdownModal({
            show: this.state.isOpen,
            onHide: maybeClose,
            showCloseButton: !preventClose, className,
            // For now:
            windowWidth: this.state.winWidth,
            atX: this.state.atX - 150,
            atY: debiki2.iframeOffsetWinSize.top + 80,
          },
          body));
    }
    return result;
  }
});


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
