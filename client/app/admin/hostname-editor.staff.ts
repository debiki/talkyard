/**
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
/// <reference path="../slim-bundle.d.ts" />
/// <reference path="../more-bundle-already-loaded.d.ts" />

//------------------------------------------------------------------------------
   namespace debiki2.admin {
//------------------------------------------------------------------------------

var r = React.DOM;
var Modal = rb.Modal;
var ModalBody = rb.ModalBody;
var ModalFooter = rb.ModalFooter;
var PatternInput = utils.PatternInput;


var hostnameEditorDialog;

export function openHostnameEditor() {
  if (!hostnameEditorDialog) {
    hostnameEditorDialog = ReactDOM.render(HostnameEditorDialog(), utils.makeMountNode());
  }
  hostnameEditorDialog.open();
}


var HostnameEditorDialog = createComponent({
  getInitialState: function() {
    return { isOpen: false, maySubmit: false };
  },

  open: function() {
    this.setState({ isOpen: true, maySubmit: false });
  },

  close: function() {
    this.setState({ isOpen: false });
  },

  onHostnameChanged: function(value, ok) {
    this.setState({ maySubmit: ok });
  },

  submitHostname: function() {
    var hostname = this.refs.hostnameInput.getValue();
    Server.changeHostname(hostname, () => {
      util.openDefaultStupidDialog({
        small: true,
        body: r.span({}, "Hostname added. Now, go to ",
          r.a({ href: linkToAdminPageAdvancedSettings(hostname) }, hostname),
          " and see if it works. If so, then, in the Admin Area, the Advanced section, click ",
          r.b({}, "Redirect old hostnames"), "."),  // dupl button name [5KFU2R0]
      });
      // COULD show a message at the new hostname about redirecting old hostnames.
      this.close();
    });
  },

  render: function() {
    var content =
      r.div({},
        // see https://meta.discourse.org/t/change-the-domain-name-or-rename-my-discourse/16098
        r.p({}, "If you choose a domain that ends with anything else than ed.community: " +
          "1) You need to add a CNAME entry to your domain name server that points to ",
          r.b({}, r.samp({}, "c1.ed.community")),
          ". 2) Don't delete the old CNAME — leave it as is. Later, you can click a certain ",
          r.b({}, "Redirect old hostnames"),  // dupl button name [5KFU2R0]
          " button to redirect visitors from the old address to the new."),
        r.p({}, "You can change hostname at most 5 times."), // dupl in Scala [7GK8W2Z]
        PatternInput({ label: "Hostname", ref: 'hostnameInput',
          placeholder: 'forum.example.com',
          notRegex: /\s/, notMessage: "No spaces please",
          notRegexTwo: /^https?:/, notMessageTwo: "Don't include http://",
          notRegexThree: /[@\/\?\#]/, notMessageThree: "No chars like: @ / ? #",
          notRegexFour: /^[^\.]+(\.[^\.]+)?$/, notMessageFour: "Bare domains not allowed",
          lastRegex: /^.+\.[^\.]+\.[^\.]+$/, lastMessage: "Should look like: forum.example.com",
          error: this.state.error, onChangeValueOk: this.onHostnameChanged }));

    return (
      Modal({ show: this.state.isOpen, onHide: this.close, dialogClassName: 'esUsrDlg' },
        ModalBody({}, content),
        ModalFooter({},
          PrimaryButton({ onClick: this.submitHostname, disabled: !this.state.maySubmit },
            "Change hostname"),
          Button({ onClick: this.close }, "Cancel"))));
  }
});


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
