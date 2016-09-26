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
/// <reference path="../slim-bundle.d.ts" />

//------------------------------------------------------------------------------
   namespace debiki2.pagedialogs {
//------------------------------------------------------------------------------

var r = React.DOM;
var ReactBootstrap: any = window['ReactBootstrap'];
var Modal = reactCreateFactory(ReactBootstrap.Modal);
var ModalHeader = reactCreateFactory(ReactBootstrap.ModalHeader);
var ModalTitle = reactCreateFactory(ReactBootstrap.ModalTitle);
var ModalBody = reactCreateFactory(ReactBootstrap.ModalBody);
var ModalFooter = reactCreateFactory(ReactBootstrap.ModalFooter);
var ProgressBar = reactCreateFactory(ReactBootstrap.ProgressBar);


var progressBarDialog;

export function getProgressBarDialog() {
  if (!progressBarDialog) {
    progressBarDialog = ReactDOM.render(ProgressBarDialog(), utils.makeMountNode());
  }
  return progressBarDialog;
}


var ProgressBarDialog = createComponent({
  getInitialState: function () {
    return {
      isOpen: false,
      title: '',
      percentDone: 0,
      onCancel: null,
    };
  },

  open: function(title: string, onCancel) {
    this.setState({
      isOpen: true,
      title: title,
      percentDone: 0,
      onCancel: onCancel
    });
  },

  close: function() {
    this.setState({ isOpen: false });
  },

  setDonePercent: function(percent: number) {
    this.setState({ percentDone: percent });
  },

  render: function () {
    var content;
    var footer;
    if (this.state.isOpen) {
      content =
          r.div({},
            ProgressBar({ now: this.state.percentDone, label: this.state.percentDone + "%", srOnly: true }));
      if (this.state.onCancel) {
        footer =
            ModalFooter({},
              Button({ onClick: () => { this.close(); this.state.onCancel() } }, 'Cancel'));
      }
    }
    return (
      Modal({ show: this.state.isOpen, onHide: this.close, dialogClassName: 'dw-progress-bar-dialog',
          // Don't close via Esc key or click outside dialog — only when done, or Cancel button:
          keyboard: false, backdrop: 'static' },
        ModalHeader({}, ModalTitle({}, this.state.title)),
        ModalBody({}, content),
        footer));
  }
});


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
