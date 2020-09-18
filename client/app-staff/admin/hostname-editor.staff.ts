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

/// <reference path="../staff-prelude.staff.ts" />

//------------------------------------------------------------------------------
   namespace debiki2.admin {
//------------------------------------------------------------------------------

const r = ReactDOMFactories;
const Modal = rb.Modal;
const ModalBody = rb.ModalBody;
const ModalFooter = rb.ModalFooter;
const PatternInput = utils.PatternInput;


var hostnameEditorDialog;

export function openHostnameEditor() {
  if (!hostnameEditorDialog) {
    hostnameEditorDialog = ReactDOM.render(HostnameEditorDialog(), utils.makeMountNode());
  }
  hostnameEditorDialog.open();
}


const HostnameEditorDialog = createComponent({
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
    const hostname = this.refs.hostnameInput.getValue();
    Server.changeHostname(hostname, () => {
      util.openDefaultStupidDialog({
        small: true,
        body: r.span({}, "Address added. Now, go to ",
          r.a({ href: linkToAdminPageAdvancedSettings(hostname), className: 'e_NewSiteAddr' }, hostname),
          " and see if it works. If so, then, in the Admin Area, the Advanced section, click ",
          r.b({}, "Redirect old addresses"), "."),  // dupl button name [5KFU2R0]
      });
      // COULD show a message at the new hostname about redirecting old hostnames.
      this.close();
    });
  },

  render: function() {
    const content =
      r.div({},
        // see https://meta.discourse.org/t/change-the-domain-name-or-rename-my-discourse/16098
        r.p({}, "If you choose a domain that ends with something else than talkyard.net:"),
        r.ul({},
          r.li({},
            "You need to add a CNAME entry to your domain name server that points to ",
            // Make the talkyard.net domain & the @talkyard.io email addr below configurable? [CONFADDRS]
            r.b({}, r.samp({}, "c1.talkyard.net"))),
          r.li({},
            "Don't delete the old CNAME — leave it as is. Later, you can click a certain ",
            r.b({}, "Redirect old addresses"),  // dupl button name [5KFU2R0]
            " button to redirect visitors from the old address to the new."),
          r.li({},
            "But before you redirect to the new address, email ", r.b({}, "support@talkyard.io"),
            " and say that you need a Let'sEncrypt https cert for your new custom domain " +
            "(this hasn't been automated yet).")),
        r.p({}, "If you use ", r.b({}, "CloudFlare"),
          ", either 1) configure CloudFlare to send the traffic directly to " +
          "Talkyard, bypassing CloudFlare, or 2) use Full SSL or Full SSL (Strict). " +
          "But don't use Flexible SSL — that would result in a redirect loop (because Talkyard " +
          "upgrades from http to https)."),
        r.p({}, "You cannot change address too many times or too often."),
        PatternInput({ label: "New address: (hostname)", ref: 'hostnameInput',
          className: 's_A_NewAdrD_HostnI',
          placeholder: 'forum.example.com',
          trim: true,
          notRegex: /\s/, notMessage: "No spaces please",
          notRegexTwo: /^https?:/, notMessageTwo: "Don't include http://",
          notRegexThree: /[:!@\/\?\#_]/, notMessageThree: "No chars like: : @ / ! ? # _",
          notRegexFour: /[^.]+\.[^.]+\.talkyard.net$/,
          notMessageFour: r.div({},
              "No. Instead of: ",
              r.kbd({}, "some.thing.talkyard.net"), ", type: ",
              r.kbd({}, "something.talkyard.net"), ".", r.br(),
              r.br(),
              "(HTTPS works only for ", r.kbd({}, "*.talkyard.net"), ", not ",
              r.kbd({}, "*.*.talkyard.net"), ")"),
          // Later, could allow bare domains, if the user first reads a bit about
          // the problems with bare domains, + hen must type a 3 letter "password" included
          // in that info, to show that hen has really read it?
          // COULD BUG harmless: Need to tweak this regex, for just 'localhost' to work, in dev mode?
          regexFour: /^[^\.]+\.([^\.]+\.[^\.]+.*|localhost(\..*)?)?$/, messageFour: "Bare domains not allowed",
          lastRegex: /^(.+\.)*[^\.]+\.[^\.]{2,}$/, lastMessage: "Should look like: forum.example.com",
          error: this.state.error, onChangeValueOk: this.onHostnameChanged }));

    return (
      Modal({ show: this.state.isOpen, onHide: this.close, dialogClassName: 's_A_NewAdrD' },
        ModalBody({}, content),
        ModalFooter({},
          PrimaryButton({ onClick: this.submitHostname, disabled: !this.state.maySubmit },
            "Change address"),
          Button({ onClick: this.close }, "Cancel"))));
  }
});


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
