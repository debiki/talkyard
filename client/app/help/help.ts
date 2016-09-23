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

/// <reference path="../../typedefs/react/react.d.ts" />
//  <r xx  nce path="../react-bootstrap-old/Input.more.ts" />
/// <reference path="../plain-old-javascript.d.ts" />
/// <reference path="../prelude.ts" />
/// <reference path="../ReactStore.ts" />
/// <reference path="../utils/utils.ts" />
/// <reference path="../utils/react-utils.ts" />
/// <reference path="../model.ts" />
/// <reference path="../rules.ts" />
/// <reference path="../widgets.ts" />

//------------------------------------------------------------------------------
  module debiki2.help {
//------------------------------------------------------------------------------

var r = React.DOM;
  /*
var ReactBootstrap: any = window['ReactBootstrap'];
var Modal = reactCreateFactory(ReactBootstrap.Modal);
var ModalBody = reactCreateFactory(ReactBootstrap.ModalBody);
var ModalFooter = reactCreateFactory(ReactBootstrap.ModalFooter);
var ModalHeader = reactCreateFactory(ReactBootstrap.ModalHeader);
var ModalTitle = reactCreateFactory(ReactBootstrap.ModalTitle);
*/


export function isHelpMessageClosedAnyVersion(store, messageId: string): boolean {
  return store.user && !!store.user.closedHelpMessages[messageId];
}

export function isHelpMessageClosed(store, message) {
  if (!store.user) return false;
  var closedVersion = store.user.closedHelpMessages[message.id];
  return closedVersion && closedVersion === message.version;
}

export function openHelpDialogUnlessHidden(message) {
  getHelpDialog().open(message);
}


var helpDialog;

function getHelpDialog() {
  if (!helpDialog) {
    die('EsE_MORE_UNIMPL');
    // helpDialog = ReactDOM.render(HelpDialog(), utils.makeMountNode());
  }
  return helpDialog;
}


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
    var me: Myself = ReactStore.allData().me;
    if (!ReactStore.allData().userSpecificDataAdded) {
      // Don't want search engines to index help text.
      return { hidden: true };
    }
    var closedMessages: { [id: string]: number } = me.closedHelpMessages || {};
    var thisMessClosedVersion = closedMessages[message.id];
    return { hidden: thisMessClosedVersion === message.version };
  },

  hideThisHelp: function() {
    ReactActions.hideHelpMessages(this.props.message);
    // Wait a short while with opening this, so one first sees the effect of clicking Close.
    if (this.props.showUnhideTips !== false) setTimeout(() => openHelpDialogUnlessHidden({
      content: r.span({}, "You can show help messages again, if you are logged in, by " +
        "clicking your name and then ", r.b({}, "Unhide help messages"), "."),
      id: '5YK7EW3',
    }), 550);
  },

  render: function() {
    if (this.state.hidden && !(this.props.alwaysShow || this.props.message.alwaysShow))
      return null;

    // If there are more help dialogs afterwards, show a comment icon instead to give
    // the impression that we're talking with the computer. Only when no more help awaits,
    // show the close (well "cancel") icon.
    var okayIcon = this.props.message.moreHelpAwaits ? 'icon-comment' : 'icon-cancel';
    var okayButton = this.props.message.alwaysShow
        ? null
        : r.a({ className: okayIcon + ' dw-hide', onClick: this.hideThisHelp },
            this.props.message.okayText || "Hide");

    var className = this.props.className || this.props.message.className || '';
    var largeClass = this.props.large ? ' dwHelp-large' : '';
    var warningClass = this.props.message.isWarning ? ' esHelp-warning' : '';
    var classes = className + ' dw-help' + largeClass + warningClass;
    return (
      r.div({ className: classes },
        r.div({ className: 'dw-help-text' },
          this.props.message.content),
        okayButton));
  }
});


 /*  EsE_MORE_UNIMPL
var HelpDialog = createComponent({
  getInitialState: function () {
    return { isOpen: false };
  },

  open: function(message: HelpMessage) {
    dieIf(!message.content, 'EsE6YK02W');
    // Bad practice to access the store like this? Oh well. Will rewrite anyway, in [redux] (?).
    var store = ReactStore.allData();
    if (!isHelpMessageClosedAnyVersion(store, message.id)) {
      this.setState({ isOpen: true, message: message });
    }
  },

  close: function() {
    if (this.refs.hideMeCheckbox && this.refs.hideMeCheckbox.getChecked()) {
      ReactActions.hideHelpMessageWithId(this.state.message.id);
    }
    this.setState({ isOpen: false, message: null });
  },

  render: function () {
    var message: HelpMessage = this.state.message;
    var content = message ? message.content : null;

    var hideThisHelpTipsCheckbox = !message || !message.id ? null :
      Input({ type: 'checkbox', inline: true, defaultChecked: true, ref: 'hideMeCheckbox',
        label: "Do not show this tips again" });

    content = !content ? null :
        ModalBody({},
          r.div({ className: 'esHelpDlg_body_wrap'},
            r.div({ className: 'esHelpDlg_body' }, content),
            r.div({ className: 'esHelpDlg_btns' },
              hideThisHelpTipsCheckbox,
              PrimaryButton({ onClick: this.close }, "Okay"))));

    return (
      Modal({ show: this.state.isOpen, onHide: this.close, dialogClassName: 'esHelpDlg' },
       content));
  }
});
       */

//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 list
