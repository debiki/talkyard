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

/// <reference path="../typedefs/react/react.d.ts" />
/// <reference path="../shared/plain-old-javascript.d.ts" />
/// <reference path="ReactStore.ts" />
/// <reference path="Server.ts" />

//------------------------------------------------------------------------------
   module debiki2 {
//------------------------------------------------------------------------------

var d = { i: debiki.internal, u: debiki.v0.util };
var r = React.DOM;
var reactCreateFactory = React['createFactory'];
var ReactBootstrap: any = window['ReactBootstrap'];
var Button = reactCreateFactory(ReactBootstrap.Button);
var Input = reactCreateFactory(ReactBootstrap.Input);
var Modal = reactCreateFactory(ReactBootstrap.Modal);
var OverlayMixin = ReactBootstrap.OverlayMixin;


export var flagDialog;


export function createAnyFlagDialog() {
  var flagDialogElem = document.getElementById('dw-react-flag-dialog');
  if (flagDialogElem) {
    flagDialog = React.render(FlagDialog(), flagDialogElem);
  }
}


var FlagDialog = createComponent({
  mixins: [OverlayMixin],

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
      setTimeout(() => {
        alert("Thanks. You have reported it. Someone will review it and "+
          "perhaps delete it or remove parts of it.");
      }, 0);
    });
  },

  chooseFlag: function(flagType) {
    this.setState({ flagType: flagType });
  },

  editReason: function(event) {
    this.setState({ reason: event.target.value });
  },

  render: function () {
    return null;
  },

  renderOverlay: function () {
    if (!this.state.isOpen)
      return null;

    var flagType = this.state.flagType;

    var anyReasonInput;
    if (flagType === 'Other') {
      anyReasonInput =
        r.div({ style: { margin: '-15px 30px 0' } },
          Input({ type: 'textarea', onChange: this.editReason, value: this.state.reason,
              placeholder: "Please tell us what you are concerned about." }));
    }

    return (
      Modal({ title: 'Report Comment', onRequestHide: this.close },
        r.div({ className: 'modal-body' },
          r.form({},
            Input({ type: 'radio', label: 'Inappropriate', checked: flagType === 'Inapt',
                onChange: () => this.chooseFlag('Inapt'),
                help: "This post contains content that a reasonable person would consider " +
                  "offensive, abusive." }),

            Input({ type: 'radio', label: 'Spam', checked: flagType === 'Spam',
                onChange: () => this.chooseFlag('Spam'),
                help: "This post is an advertisement. It is not useful or relevant to " +
                  "the current topic, but promotional in nature." }),

            Input({ type: 'radio', label: 'Other', checked: flagType === 'Other',
                onChange: () => this.chooseFlag('Other'),
                help: "This post requires moderation attention for some reason not " +
                  "listed above." }))),

        anyReasonInput,

        r.div({ className: 'modal-footer' },
          Button({ onClick: this.submit }, 'Submit'),
          Button({ onClick: this.close }, 'Cancel'))));
  }
});

//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
