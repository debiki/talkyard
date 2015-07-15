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
/// <reference path="../../shared/plain-old-javascript.d.ts" />
/// <reference path="../ReactStore.ts" />
/// <reference path="../Server.ts" />

//------------------------------------------------------------------------------
   module debiki2.pagedialogs {
//------------------------------------------------------------------------------

var d = { i: debiki.internal, u: debiki.v0.util };
var r = React.DOM;
var reactCreateFactory = React['createFactory'];
var ReactBootstrap: any = window['ReactBootstrap'];
var Button = reactCreateFactory(ReactBootstrap.Button);
var Input = reactCreateFactory(ReactBootstrap.Input);
var Modal = reactCreateFactory(ReactBootstrap.Modal);
var OverlayMixin = ReactBootstrap.OverlayMixin;


export var serverErrorDialog;


export function createServerErrorDialog() {
  var dialogTag = $('<div>').appendTo(document.body);
  serverErrorDialog = React.render(ServerErrorDialog(), dialogTag[0]);
}


var ServerErrorDialog = createComponent({
  mixins: [OverlayMixin],

  getInitialState: function () {
    return {
      isOpen: false,
      error: null
    };
  },

  open: function(error: any) {
    this.setState({ isOpen: true, error: error });
  },

  close: function() {
    this.setState({ isOpen: false });
  },

  render: function () {
    return null;
  },

  renderOverlay: function () {
    if (!this.state.isOpen)
      return null;

    var error = this.state.error;

    // Is the status message included on the first line? If so, remove it, because we'll
    // shown it in the dialog title.
    var message = error.responseText;
    var matches = message.match(/\d\d\d [a-zA-Z ]+\n(.*)/);
    if (matches && matches.length === 2) {
      message = matches[1];
    }
    else if (/^\s*<!DOCTYPE html>/.test(message)) {
      // Play Framework sent back a HTML page
      message = $(message).filter('#detail').text().trim() +
          '\n\nSee server logs for stack trace. [DwE4KWE85]';
    }

    var title = 'Error ' + error.status + ' ' + error.statusText;

    if (!error.status) {
      // COULD check if we're unloading this page. That results in any ongoing requests being
      // aborted with status code 0. Then we should suppress this dialog.
      // See http://stackoverflow.com/a/12621912/694469.
      title = 'Error: Server not reachable';
      message = "Has the server stopped? Or did you just get disconnected " +
          "from the Internet? [DwE4KEF2]";
    }

    return (
      Modal({ title: title, onRequestHide: this.close, className: 'dw-server-error' },
        r.div({ className: 'modal-body',
            style: { whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}, message),
        r.div({ className: 'modal-footer' }, Button({ onClick: this.close }, 'Close'))));
  }
});

//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
