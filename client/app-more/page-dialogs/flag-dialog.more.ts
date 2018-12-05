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

/// <reference path="../more-prelude.more.ts" />
/// <reference path="../react-bootstrap-old/Input.more.ts" />
/// <reference path="../util/stupid-dialog.more.ts" />

//------------------------------------------------------------------------------
   namespace debiki2.pagedialogs {
//------------------------------------------------------------------------------

const r = ReactDOMFactories;
const ModalHeader = rb.ModalHeader;
const ModalTitle = rb.ModalTitle;
const ModalBody = rb.ModalBody;
const ModalFooter = rb.ModalFooter;


let flagDialog;

export function openFlagDialog(postId: PostId, at: Rect) {
  if (!flagDialog) {
    flagDialog = ReactDOM.render(FlagDialog(), utils.makeMountNode());
  }
  flagDialog.open(postId, at);
}


const FlagDialog = createComponent({
  getInitialState: function () {
    return {
      isOpen: false,
      flagType: null,
      postId: null,
      reason: '',
    };
  },

  open: function(postId, at: Rect) {
    this.setState({
      isOpen: true,
      postId: postId,
      atRect: at,
      windowWidth: window.innerWidth,
    });
  },

  close: function() {
    this.setState({
      isOpen: false,
      flagType: null,
      reason: ''
    });
  },

  submit: function() {
    Server.flagPost(this.state.postId, this.state.flagType, this.state.reason, () => {
      this.close();
      util.openDefaultStupidDialog({
        body: t.fd.ThanksHaveReported,
        small: true,
      });
    });
  },

  chooseFlag: function(flagType) {
    this.setState({ flagType: flagType });
  },

  editReason: function(event) {
    this.setState({ reason: event.target.value });
  },

  render: function () {
    const flagType = this.state.flagType;
    let anyReasonInput;
    if (!this.state.isOpen) {
      // Nothing.
    }
    else if (flagType === 'Other') {
      anyReasonInput =
        r.div({ style: { margin: '-15px 30px 0' } },
          Input({ type: 'textarea', onChange: this.editReason, value: this.state.reason,
              placeholder: t.fd.PleaseTellConcerned }));
    }

    return (
      utils.DropdownModal({ show: this.state.isOpen, onHide: this.close, showCloseButton: true,
          atRect: this.state.atRect, windowWidth: this.state.windowWidth },
        ModalHeader({}, ModalTitle({}, t.fd.ReportComment)),
        ModalBody({},
          r.form({},
            Input({ type: 'radio', label: 'Inappropriate', checked: flagType === 'Inapt',
                onChange: () => this.chooseFlag('Inapt'), className: 'e_FD_InaptRB',
                help: t.fd.OptOffensive }),

            Input({ type: 'radio', label: 'Spam', checked: flagType === 'Spam',
                onChange: () => this.chooseFlag('Spam'), lassName: 'e_FD_SpamRB',
                help: t.fd.OptSpam }),

            Input({ type: 'radio', label: 'Other', checked: flagType === 'Other',
                onChange: () => this.chooseFlag('Other'), className: 'e_FD_OtherRB',
                help: t.fd.OptOther }))),

          anyReasonInput,

        ModalFooter({},
          Button({ onClick: this.submit, disabled: !flagType, bsStyle: 'primary',
              className: 'e_FD_SubmitB' }, t.Submit),
          Button({ onClick: this.close, className: 'e_FD_CancelB' }, t.Cancel))));
  }
});

//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
