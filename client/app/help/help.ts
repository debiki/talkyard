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
/// <reference path="../prelude.ts" />
/// <reference path="../ReactStore.ts" />
/// <reference path="../utils/utils.ts" />
/// <reference path="../utils/react-utils.ts" />
/// <reference path="../model.ts" />
/// <reference path="../rules.ts" />
/// <reference path="../widgets.ts" />
/// <reference path="../more-bundle-not-yet-loaded.ts" />

//------------------------------------------------------------------------------
  namespace debiki2.help {
//------------------------------------------------------------------------------

var r = React.DOM;


export function isHelpMessageClosedAnyVersion(store: Store, messageId: string): boolean {
  return store.me && !!store.me.closedHelpMessages[messageId];
}

export function isHelpMessageClosed(store: Store, message: HelpMessage) {
  if (!store.me) return false;
  var closedVersion = store.me.closedHelpMessages[message.id];
  return closedVersion && closedVersion === message.version;
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
    if (this.props.showUnhideTips !== false) setTimeout(
          () => morebundle.openHelpDialogUnlessHidden({
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


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 list
