/*
 * Copyright (c) 2015 Kaj Magnus Lindberg
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
/// <reference path="../model.ts" />

//------------------------------------------------------------------------------
   module debiki2.pubsub {
//------------------------------------------------------------------------------

/**
 * Deletes any old event subscription and creates a new for this page and user.
 */
export function subscribeToServerEventsAsUser(user?: User, doNothingIfAlreadyPolling?) {
  if (Server.isLongPollingServerNow() && doNothingIfAlreadyPolling)
    return;

  Server.cancelAnyLongPollingRequest();
  if (!user || !user.userId)
    return;

  Server.sendLongPollingRequest(user.userId, event => {
    console.debug("Server event: " + JSON.stringify(event));
    // Continue polling. Todo: specify params so won't get the very first event always only
    subscribeToServerEventsAsUser(user);

    switch (event.type) {
      case "notifications":
        ReactActions.addNotifications(event.data);
        break;
      default:
        die("Unknown event type [EsE7YKF4]: " + event.type +
            "\n\nThe response body:\n\n" + JSON.stringify(event));
    }
  }, () => {
    // Error. Subscribe again, after ... a few second? So won't start logging 9^99 error
    // messages in case the error happens forever.
    // BUG this might result in many parallel subscription attempts. Avoid that.
    // And use exponential backoff.
    setTimeout(() => {
      subscribeToServerEventsAsUser(user, true);
    }, 5*1000);
  });
}


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=tcqwn list
