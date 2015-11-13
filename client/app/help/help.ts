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
/// <reference path="../plain-old-javascript.d.ts" />
/// <reference path="../prelude.ts" />
/// <reference path="../utils/utils.ts" />
/// <reference path="../utils/react-utils.ts" />
/// <reference path="../model.ts" />

//------------------------------------------------------------------------------
  module debiki2.help {
//------------------------------------------------------------------------------


var d = { i: debiki.internal, u: debiki.v0.util };
var r = React.DOM;
var reactCreateFactory = React['createFactory'];
var ReactBootstrap: any = window['ReactBootstrap'];
var Button = reactCreateFactory(ReactBootstrap.Button);
var Modal = reactCreateFactory(ReactBootstrap.Modal);
var ModalBody = reactCreateFactory(ReactBootstrap.ModalBody);
var ModalFooter = reactCreateFactory(ReactBootstrap.ModalFooter);
var ModalHeader = reactCreateFactory(ReactBootstrap.ModalHeader);
var ModalTitle = reactCreateFactory(ReactBootstrap.ModalTitle);

/* show an inline unhide-help help box instead?

var howToShowHelpAgainDialog;


export function getHowToShowHelpAgainDialog() {
  if (!howToShowHelpAgainDialog) {
    howToShowHelpAgainDialog = React.render(HowToShowHelpAgainDialog(), utils.makeMountNode());
  }
  return howToShowHelpAgainDialog;
} */


export var HelpMessageBox = createComponent({
  mixins: [StoreListenerMixin],

  getInitialState: function() {
    return this.computeState();
  },

  onChange: function() {
    this.setState(this.computeState());
  },

  computeState: function() {
    var message: HelpMessage = this.props.message;
    var user: User = ReactStore.allData().user;
    if (!user)
      return { hidden: false };

    var closedMessages: { [id: string]: number } = user.closedHelpMessages || {};
    var thisMessClosedVersion = closedMessages[message.id];
    return { hidden: thisMessClosedVersion === message.version };
  },

  hideThisHelp: function() {
    ReactActions.hideHelpMessages(this.props.message);
    /* This dialog feels annoying! I'd better just replace this help box with
       a show-help-again help box, in a different color? Rather than poppuing up a dialog.
    if (!localStorage.getItem('hasShownShowHelpAgainHelp')) {
      localStorage.setItem('hasShownShowHelpAgainHelp', 'true');
      getHowToShowHelpAgainDialog().open();
    } */
  },

  render: function() {
    if (this.state.hidden)
      return null;

    var largeClass = this.props.large ? ' dwHelp-large' : '';
    return (
      r.div({ className: 'dw-help' + largeClass },
        r.div({ className: 'dw-help-text' },
          this.props.message.content),
        r.a({ className: 'icon-cancel dw-hide', onClick: this.hideThisHelp }, "Hide")));
  }
});


/*
var HowToShowHelpAgainDialog = createClassAndFactory({
  getInitialState: function () {
    return { isOpen: false };
  },

  open: function() {
    this.setState({ isOpen: true });
  },

  close: function() {
    this.setState({ isOpen: false });
  },

  render: function () {
    var hamburgerMenuIcon =
      r.span({ className: 'dw-hamburger-menu' },
        r.span({ className: 'icon-menu' }),
        r.span({ className: 'caret' }));

    var body = r.div({},
      r.p({}, "You have hidden a help message! How do you get it back?"),
      r.p({},
        "Like so: 1) click the hamburger menu ", hamburgerMenuIcon,
        " in the upper right corner of the page, ",
        "and then 2) click ", r.b({}, "Show Help Messages"), "."));

    return (
      Modal({ show: this.state.isOpen, onHide: this.close,
          dialogClassName: 'dw-how-to-show-help-again' },
        ModalHeader({}, ModalTitle({}, "Help Hidden!")),
        ModalBody({}, body),
        ModalFooter({}, Button({ onClick: this.close }, "I will remember this"))));
  }
}); */


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 list
