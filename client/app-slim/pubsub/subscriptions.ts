/*
 * Copyright (c) 2015-2018 Kaj Magnus Lindberg
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
/// <reference path="../utils/detect-mouse.ts" />
/// <reference path="../Server.ts" />
/// <reference path="../ReactStore.ts" />
/// <reference path="../more-bundle-not-yet-loaded.ts" />

//------------------------------------------------------------------------------
   module debiki2.pubsub {
//------------------------------------------------------------------------------


if (eds.useServiceWorker) {
  navigator.serviceWorker.addEventListener('message', function (event) {
    const message = event.data;
    // @ifdef DEBUG
    console.debug(`SW says: ${JSON.stringify(event)}, message: ${JSON.stringify(message)} [TyMGOTSWMSG]`);
    // @endif

    // REFACTOR replace these messages with SwSays?
    switch (message.type) {  // dupl switch, will delete the other one (7QKBAG202)
      case 'MyVersionIs':
        console.debug(`SW says it's version ${message.talkyardVersion} [TyMOKSWVER]`);
        if (message.talkyardVersion === TalkyardVersion) {
          // The service worker either was the same version as this page's js
          // from the beginning, or a matching version was just installed, and
          // has now claimed this browser tab, and now replies to our version queries.
          debiki.nowServiceWorkerIsRightVersion();
        }
        break;
      case 'storePatch':
        ReactActions.patchTheStore(message.data);
        break;
      case 'notifications':
        ReactActions.addNotifications(message.data);
        break;
      case 'presence':
        ReactActions.updateUserPresence(message.data);
        break;
      case 'disconnected':
        $h.addClasses(document.documentElement, 's_NoInet');
        break;
      case 'connected':
        $h.removeClasses(document.documentElement, 's_NoInet');
        break;
      case 'eventsBroken':
        // Probably the laptop was disconnected for a short while, maybe suspended,
        // or the mobile was in Airplane mode, maybe a meeting? Likely, all is fine.
        // So don't pop up any dangerous looking error dialog; instead, just the below calm info.
        // BUG won't work, unless the more-scripts bundle already loaded.
        // Instead, find a tiny modal dialog lib, use instead of React Bootstrap? [tiny-dialog]
        // But ... will work in prod mode? Because then caches, no server roundtrip needed?
        //
        // Only show dialog, if has been disconnected for so long, so the server
        // stopped caching events for this client, stopped waiting for it to reappear.
        // See [WSMSGQ].
        // But *skip* dialog for now — reconnections didn't work previously anyway (with
        // long polling) and the dialog can be annoying.
        $h.addClasses(document.documentElement, 's_NoInet');
        logM(`WebSocket broken? Didn't popup any dialog about that, maybe later. [TyE502KDG3]`);
        /*
        morebundle.openDefaultStupidDialog({
            body: t.ni.PlzRefr,
            primaryButtonTitle: t.ni.RefrNow,
            secondaryButonTitle: t.Cancel,
            onCloseOk: function(whichButton) {
              if (whichButton === 1)
                window.location.reload()
            } });  */
        break;
      default:
        die("Unknown service worker message type [TyEUNKSWMSG]: " + message.type +
            "\n\nThe message body:\n\n" + JSON.stringify(message));
    }
  });
}


export function startKeepAliveMessages() {
  // For now.  [0EVTSIFRM]
  if (!eds.useServiceWorker || isInSomeEmbCommentsIframe())
   return;

  let intervalMs = 30*1000;  // [KEEPALVINTV]
  // @ifdef DEBUG
  intervalMs = 7000;  // less boring, if trying things out
  // @endif

  debiki.serviceWorkerPromise.then(function(sw: ServiceWorker) {
    function sendKeepAlive() {
      const humanActiveAtMs = utils.getHumanLastActiveAtMs();
      const store: Store = ReactStore.allData();
      const me = store.me;

      // Only keep-alive if we're logged in as a user (not guest, not group). [WSALIVE]
      if (me_isUser(me)) {
        // Later, include track-reading-activity messages here? [VIAWS]
        const message: WebSocketKeepAliveSwMessage = {
          doWhat: SwDo.KeepWebSocketAlive,
          myId: me.id,
          humanActiveAtMs,
          talkyardVersion: TalkyardVersion,
        };
        sw.postMessage(message);
      }

      magicTimeout(intervalMs, sendKeepAlive);
    }

    magicTimeout(intervalMs, sendKeepAlive);

  }).catch(ex => {
    logW("Error starting sendKeepAlive() in service worker promise [TyE7SBEV8S]", ex);
  });;
}



export function subscribeToServerEvents(me: Myself) {
  // If in embedded comments iframe, skip WebSocket for now — the likelihood
  // a comment gets posted whilst someone is actually reading the comments, is so low,
  // so it's not worth the additional server load?
  // Maybe could connect, though, if the user interacts with the page,
  // and the server knows other people also loaded the page just recently.
  if (isInSomeEmbCommentsIframe())  // [0EVTSIFRM]
    return;

  if (eds.useServiceWorker) {
    if (!me_isUser(me)) {
      logD(`I'm a Guest or Group, skipping WebSocket. [TyM0USR0WS]`);
      return;
    }

    debiki.serviceWorkerPromise.then(function(sw: ServiceWorker) {
      // @ifdef DEBUG
      dieIf(!navigator.serviceWorker.controller,
          "Service worker didn't claim this tab [TyESW0CLMTB]");
      // @endif

      const xsrfToken = getXsrfCookie();
      // Later, maybe:
      //   const mainWin = getMainWin();
      //   const typs: PageSession = mainWin.typs;
      //   const currentPageXsrfToken = typs.xsrfTokenIfNoCookies;
      //   const currentPageSid = typs.weakSessionId;
      // but for now, just skip WebSocket if cookies disabled?

      const message: SubscribeToEventsSwMessage = {
        doWhat: SwDo.SubscribeToEvents,
        xsrfToken,
        talkyardVersion: TalkyardVersion,
        // These aren't really needed — the server will know anyway,
        // because of the sesison id cookie. But nice to include, simpler to
        // troubleshoot?
        siteId: eds.siteId,
        myId: me.id,
      };
      sw.postMessage(message);
    }).catch(ex => {
      console.log("Error subscribing to events via service worker [TyE70AKD4]", ex);
    });
  }
  else {
    // Cannot use the service worker — maybe we're on an intranet with http: only
    // (but service workers require https).
    // Maybe reimplemelt later, breaking out reusable code from service-worker.ts:
    // subscribeToServerEventsDirectly(me);
  }
}



export function disconnectWebSocket() {
  if (!eds.useServiceWorker)
    return;

  debiki.serviceWorkerPromise.then(function(sw: ServiceWorker) {
    const message: MessageToServiceWorker = {
      doWhat: SwDo.Disconnect,
      talkyardVersion: TalkyardVersion,
      myId: undefined,
    };
    sw.postMessage(message);
  });
}


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=tcqwn list
