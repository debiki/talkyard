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

/// <reference path="../prelude.ts" />
/// <reference path="../rules.ts" />
/// <reference path="../Server.ts" />
/// <reference path="../ReactStore.ts" />
/// <reference path="../page-dialogs/server-error-dialog.ts" />

//------------------------------------------------------------------------------
   module debiki2.pubsub {
//------------------------------------------------------------------------------

const RetryAfterMsDefault = 4000;
const GiveUpAfterTotalMs = 8 * 60 * 1000; // 8 minutes [5AR20ZJ]
let retryAfterMs = RetryAfterMsDefault;
let startedFailingAtMs;


/**
 * Deletes any old event subscription and creates a new for the current user.
 */
export function subscribeToServerEvents() {
  Server.abortAnyLongPollingRequest();

  // If not logged in, don't ask for any events — if everyone did that, that could put the server
  // under an a bit high load? and not much interesting to be notified about anyway, when not logged in.
  const me = ReactStore.getMe();
  if (!me || !me.id)
    return;

  Server.sendLongPollingRequest(me.id, (response) => {
    console.debug("Long polling request done, sending another...");
    subscribeToServerEvents();

    // Reset backoff, since all seems fine.
    retryAfterMs = RetryAfterMsDefault;
    startedFailingAtMs = undefined;

    dieIf(!response.type, 'TyE2WCX59');
    dieIf(!response.data, 'TyE4YKP02');

    switch (response.type) {
      case 'storePatch':
        ReactActions.patchTheStore(response.data);
        break;
      case 'notifications':
        ReactActions.addNotifications(response.data);
        break;
      case 'presence':
        ReactActions.updateUserPresence(response.data.user, response.data.presence);
        break;
      default:
        die("Unknown response type [TyE7YKF4]: " + response.type +
            "\n\nThe response body:\n\n" + JSON.stringify(response));
    }
  }, () => {
    // Error. Don't retry immediately — that could result in super many error log messages,
    // if the problem persists. Also, do a bit exponential backoff; eventually give up.
    retryAfterMs = retryAfterMs * 1.3;
    if (!startedFailingAtMs) {
      startedFailingAtMs = getNowMs();
    }
    const totalFailTimeMs = getNowMs() - startedFailingAtMs;

    if (totalFailTimeMs > GiveUpAfterTotalMs) {
      // TESTS_MISSING how make Nginx "break" so all requests fail? If a script temporarily  [5YVBAR2]
      // does 'docker-compose kill web' and then 'start web' — then, other e2e tests won't be
      // able to run in parallel with this, hmm.
      console.error("Long polling broken, maybe events lost, giving up.");
      // UX COULD show this in a non-modal message instead?
      pagedialogs.getServerErrorDialog().openForBrowserError(
          "Cannot talk with the server. Reload page to retry. [TyMLPRRLD]");
    }
    else {
      console.warn(`Long polling error, will retry after ${Math.floor(retryAfterMs / 1000)} seconds...`);
      setTimeout(() => {
        if (!Server.isLongPollingNow()) {
          subscribeToServerEvents();
        }
      }, retryAfterMs);
    }
  }, () => {
    console.debug("Long polling aborted, will send a new if needed [TyMLPRMBYE]");
    // No error has happened — we aborted the request intentionally. All fine then? Reset the backoff:
    retryAfterMs = RetryAfterMsDefault;
    if (!Server.isLongPollingNow()) {
      subscribeToServerEvents();
    }
  });
}


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=tcqwn list
