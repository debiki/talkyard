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
/// <reference path="../react-bootstrap-old/Input.more.ts" />
/// <reference path="../util/stupid-dialog.more.ts" />

//------------------------------------------------------------------------------
   module debiki2.pagedialogs {
//------------------------------------------------------------------------------

var r = React.DOM;
var ReactBootstrap: any = window['ReactBootstrap'];
var Modal = reactCreateFactory(ReactBootstrap.Modal);
var ModalHeader = reactCreateFactory(ReactBootstrap.ModalHeader);
var ModalTitle = reactCreateFactory(ReactBootstrap.ModalTitle);
var ModalBody = reactCreateFactory(ReactBootstrap.ModalBody);
var ModalFooter = reactCreateFactory(ReactBootstrap.ModalFooter);


var flagDialog;

export function openFlagDialog(postId: PostId) {
  if (!flagDialog) {
    flagDialog = ReactDOM.render(FlagDialog(), utils.makeMountNode());
  }
  flagDialog.open(postId);
}


var FlagDialog = createComponent({
  getInitialState: function () {
    return {
      isOpen: false,
      flagType: null,
      postId: null,
      reason: '',
    };
  },

  open: function(postId) {
    this.setState({
      isOpen: true,
      postId: postId,
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
        body: "Thanks. You have reported it. The forum staff will take a look.",
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
    var flagType = this.state.flagType;
    var anyReasonInput;
    if (!this.state.isOpen) {
      // Nothing.
    }
    else if (flagType === 'Other') {
      anyReasonInput =
        r.div({ style: { margin: '-15px 30px 0' } },
          Input({ type: 'textarea', onChange: this.editReason, value: this.state.reason,
              placeholder: "Please tell us what you are concerned about." }));
    }

    return (
      Modal({ show: this.state.isOpen, onHide: this.close },
        ModalHeader({}, ModalTitle({}, "Report Comment")),
        ModalBody({},
          r.form({},
            Input({ type: 'radio', label: 'Inappropriate', checked: flagType === 'Inapt',
                onChange: () => this.chooseFlag('Inapt'), className: 'e_FD_InaptRB',
                help: "This post contains offensive or abusive content." }),

            Input({ type: 'radio', label: 'Spam', checked: flagType === 'Spam',
                onChange: () => this.chooseFlag('Spam'), lassName: 'e_FD_SpamRB',
                help: "This post is an unwanted advertisement." }),

            Input({ type: 'radio', label: 'Other', checked: flagType === 'Other',
                onChange: () => this.chooseFlag('Other'), className: 'e_FD_OtherRB',
                help: "Notify staff about this post for some other reason." }))),

          anyReasonInput,

        ModalFooter({},
          Button({ onClick: this.submit, disabled: !flagType, bsStyle: 'primary',
              className: 'e_FD_SubmitB' }, "Submit"),
          Button({ onClick: this.close, className: 'e_FD_CancelB' }, "Cancel"))));
  }
});

//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
