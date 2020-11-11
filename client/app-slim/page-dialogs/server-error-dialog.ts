/*
 * Copyright (C) 2015-2017 Kaj Magnus Lindberg
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

/// <reference path="../prelude.ts" />
/// <reference path="../widgets.ts" />
/// <reference path="../utils/react-utils.ts" />

//------------------------------------------------------------------------------
   namespace debiki2.pagedialogs {
//------------------------------------------------------------------------------

const r = ReactDOMFactories;

let serverErrorDialog;

export function getServerErrorDialog() {
  if (!serverErrorDialog) {
    serverErrorDialog = ReactDOM.render(ServerErrorDialog(), utils.makeMountNode());
  }
  return serverErrorDialog;
}


export function showAndThrowClientSideError(errorMessage: string) {
  // Don't call immediately, in case we're in a React render() pass — then we're not allowed
  // to render even more stuff, which getServerErrorDialog() might do.
  setTimeout(function() {
    getServerErrorDialog().openForBrowserError(errorMessage);
  }, 1);
  // @ifdef DEBUG
  debugger;
  // @endif
  throw new Error(errorMessage);
}


const ServerErrorDialog = createComponent({
  getInitialState: function () {
    return {
      isOpen: false,
      error: null,  // COULD rename to serverError
      dialogMessagePrefix: '',
      clientErrorMessage: null,
    };
  },

  openForBrowserError: function(errorMessage: string, opts: { mayClose?: boolean } = {}) {
    this.setState({
      ...opts,
      isOpen: true,
      error: null,
      dialogMessagePrefix: '',
      clientErrorMessage: errorMessage,
    });
  },

  open: function(dialogMessagePrefix?: any, error?: any) {
    if (!error) {
      error = dialogMessagePrefix;
      dialogMessagePrefix = '';
    }
    this.setState({
      mayClose: true,
      isOpen: true,
      error: error,
      dialogMessagePrefix: dialogMessagePrefix,
      clientErrorMessage: null
    });
  },

  close: function() {
    this.setState({ isOpen: false });
  },

  render: function () {
    if (!this.state.isOpen)
      return null;

    let title: string;
    let message: string;

    if (this.state.clientErrorMessage) {
      title = "Error";
      message = this.state.clientErrorMessage;
      if (debiki2.utils.isMouseDetected) {
        message += "\n\n" +
            "See Dev Tools for details: usually Ctrl + Shift + C, here in the browser, " +
            "then click Console.";
      }
    }
    else {
      // The server says something went wrong.
      const error = this.state.error;

      // Is the status message included on the first line? If so, remove it, because we'll
      // shown it in the dialog title.
      message = error.responseText;
      const matches = message ? message.match(/\d\d\d [a-zA-Z ]+\n+((.|[\r\n])*)/) : null;
      if (matches && matches.length >= 2) {
        message = matches[1];
      }
      else if (/^\s*<!DOCTYPE html>/.test(message)) {
        // Play Framework sent back a HTML page
        try {
          const parser = new DOMParser(); // >= IE 10
          const doc = parser.parseFromString(message, "text/html");
          const detailsElem = doc.getElementById('detail');
          const detailsText = detailsElem ? detailsElem.innerText.trim() : "No error details";
          message = detailsText + '\n\nSee server logs for stack trace. [EdEGOTHTML]';
        }
        catch (unused) {
          message = "The server sent back an HTML error page [EdEGOTHTMLB]";
        }
      }

      title = 'Error ' + error.status + ' ' + error.statusText;

      if (!error.status) {
        // COULD check if we're unloading this page. That results in any ongoing requests being
        // aborted with status code 0. Then we should suppress this dialog.
        // See http://stackoverflow.com/a/12621912/694469.
        // Or we might be accessing the website via the wrong URL, e.g. site-NNN.domain.com rather
        // than the-real-name.domain.com, which would result in a cross origin request error.
        title = 'Error: Server not reachable';
        message = "Has the server stopped? Or did you just get disconnected " +
            "from the Internet? Or is the hostname or port number wrong, " +
            "cross-origin request blocked? [TyE0SRVR]\n" +
            "\n" +
            "Details: " + JSON.stringify(error);
      }
    }

    message = this.state.dialogMessagePrefix + message;

    return InstaDiag({
            diagClassName: 'dw-server-error',
            title,
            titleClassName: 's_SED_Ttl',
            body: r.div({ className: 's_SED_Msg' }, message),
            footer: this.state.mayClose === false ? null :
                  PrimaryButton({ onClick: this.close, className: 'e_SED_CloseB' },
                    t.Close) });
  }
});

//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
