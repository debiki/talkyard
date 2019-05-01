/// <reference path="../app-slim/model.ts" />
/// <reference path="./constants.ts" />
/// <reference path="./magic-time.ts" />


// Docs: https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API
// Read?: https://www.kollegorna.se/en/2017/06/service-worker-gotchas/
// Caching, see:
// https://developers.google.com/web/ilt/pwa/caching-files-with-service-worker
// https://github.com/mdn/sw-test/blob/gh-pages/sw.js

// detect updates to previous service worker registrations, & tell users to refresh the page.

//  !! https://gist.github.com/Rich-Harris/fd6c3c73e6e707e312d7c5d7d0f3b2f9

// + what? many ways the browser might post the reply ??
// view-source:https://jakearchibald.github.io/isserviceworkerready/demos/postMessage/
// (found via:  https://jakearchibald.github.io/isserviceworkerready/#postmessage-to-&-from-worker )


// Service worker global scope, see:
// https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerGlobalScope
// https://developers.google.com/web/fundamentals/primers/service-workers/lifecycle
declare var oninstall: any;
declare var onactivate: any;
declare var onfetch: any;
declare var registration: any;
declare var skipWaiting: any;
declare var clients;


//------------------------------------------------------------------------------
   namespace debiki2 {
//------------------------------------------------------------------------------

console.log(`Service worker ${SwPageJsVersion} loading [TyMSWVLDNG]`);  // [sw]


type ErrorStatusHandler = (errorStatusCode?: number) => void;

let longPollingReqNr = 0;
let longPollingPromise = null;
let justAbortedLongPollingReqNr = -1;
let currentChannelId: string = undefined;


oninstall = function(event) {
  // Later: Here, can start populating an IndexedDB, and caching site assets — making
  // things available for offline use.
  console.log("Service worker installing... [TyMSWINSTLD]");
  // Make this the active service worker, for all clients, including any other
  // already "since long ago" open browser tabs. (Otherwise, would need to wait
  // for them to close (but just refreshing, apparently isn't enough — then they'll
  // continue using the old service worker: """refreshing the page isn't enough
  // to let the new version take over""", see:
  // https://developers.google.com/web/fundamentals/primers/service-workers/lifecycle).)
  event.waitUntil(skipWaiting());
};


onactivate = function(event) {
  // Here, can cleanup resources used by previous sw versions that are no longer needed,
  // and e.g. migrate any database. Which cannot be done in oninstall, since then an
  // old service worker might still be running. Note that an old database that's to
  // be migrated, might be many versions old, not always the previous version.
  console.log("Service worker activating... [TyMSWACTIVD]");
  // On the very very first Talkyard page load, the browser page tab loads without any
  // service worker, and thus won't get any live notifications, because it'll have no
  // service worker (until after tab reload), since it was loaded outside any service worker
  // — unless we claim() it — then, subsequent fetches (http requests) will be via this
  // service worker, and we can send messages to that tab.
  // Or, if there's an old service worker already installed, the page is currently
  // using that one, and we need to claim() the page so it'll start using this new
  // service worker instad. [SWCLMTBS]
  // Nice: https://serviceworke.rs/immediate-claim_service-worker_doc.html
  if (!clients.claim) return;
  event.waitUntil(clients.claim().then(() => {
    console.log("Service worker claimed the clients. [TyMSWCLDCLS]");
  }));
};


if (registration.onupdatefound) registration.onupdatefound = function(event) {
  console.log("This service worker about to be replaced by newer version. [TyMSWUPDFND]");
  abortAnyLongPollingRequest();
};


onmessage = function(event: any) {
  console.debug(`Service worker got message: '${JSON.stringify(event.data)}' [TyMSWGOTMSG]` +
    ` from: ${event.origin}`);
  const untypedMessage: MessageToServiceWorker = event.data;
  switch (untypedMessage.doWhat) {
    case SwDo.TellMeYourVersion:
      event.source.postMessage({ // <MyVersionIsMessageFromSw> {
        type: 'MyVersionIs',
        saysWhat: SwSays.MyVersionIs,
        swJsVersion: SwPageJsVersion,
      });
      break;
    case SwDo.SubscribeToEvents:
      const message = <SubscribeToEventsSwMessage> untypedMessage;
      if (!message.myId) {
        // We've logged out. Don't ask for any events — if everyone did that,
        // that could put the server under an a bit high load? And not much interesting
        // to be notified about anyway, when haven't joined the site yet / not logged in.
        console.debug(`Just logged out? Aborting any long polling. [TyMSWLOGOUT]`);
        abortAnyLongPollingRequest();
        return;
      }
      // This is an easy-to-guess channel id, but in order to subscribe, the session cookie
      // must also be included in the request. So this should be safe.
      // The site id is included, because users at different sites can have the same id. [7YGK082]
      const channelId = message.siteId + '-' + message.myId;
      if (currentChannelId === channelId) {
        // We're already long polling for events for this user (myId). Need do nothing.
        console.debug(`Already subscribed to channel ${channelId}, need do nothing. [TyMSWALRSUBS]`);
      }
      else {
        // This'll cancel any ongoing long polling request — it'd be for the wrong user.
        // And start a new one, for the new `myId`.
        console.debug(`Subscribing to channel ${channelId} [TyMSWNEWSUBS]`);
        subscribeToServerEvents(channelId);
        currentChannelId = channelId;
      }
      break;
    case SwDo.StartMagicTime:
      const message3 = <StartMagicTimeSwMessage> untypedMessage;
      startMagicTime(message3.startTimeMs);
      break;
    case SwDo.PlayTime:
      const message2 = <PlayTimeSwMessage> untypedMessage;
      addTestExtraMillis(message2.extraTimeMs);
      break;
  }
};

function sendToAllBrowserTabs(message) {
  clients.matchAll({ type: 'window' }).then(function (cs) {
    cs.forEach(function(c) {
      c.postMessage(message);
    });
  });
}

const RetryAfterMsDefault = 5000;
const GiveUpAfterTotalMs = 7 * 60 * 1000; // 7 minutes [5AR20ZJ]
let retryAfterMs = RetryAfterMsDefault;
let startedFailingAtMs;



/**
 * Deletes any old event subscription and creates a new for the current user.
 * If called from many tabs, aborts and restarts "the same" long polling
 * request many times — which should be fine.
 * COULD optimize: remember any current channel, and skip abort-resend.
 */
function subscribeToServerEvents(channelId: string) {
  abortAnyLongPollingRequest();

  // Remove the "No internet" message, in case the network works (again).
  // If disconnected, the "No internet" message [NOINETMSG] will reappear immediately when this
  // netw request fails (unless if not logged in — then, won't see live notifications anyway,
  // so no need for the message).
  sendToAllBrowserTabs({ type: 'connected', data: longPollingState.nextReqNr });

  sendLongPollingRequest(channelId, (response) => {
    console.debug("Long polling request done, sending another... [TyMSWLPDONE]");
    subscribeToServerEvents(channelId);

    // Reset backoff, since all seems fine.
    retryAfterMs = RetryAfterMsDefault;
    startedFailingAtMs = undefined;

    //dieIf(!response.type, 'TyE2WCX59');
    //dieIf(!response.data, 'TyE4YKP02');
    sendToAllBrowserTabs(response);
  }, (errorStatusCode?: number) => {
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
      console.error("Long polling broken, maybe events lost, giving up. [TySWDISCND");
      sendToAllBrowserTabs({ type: 'eventsBroken' });
    }
    else {
      // If the server couldn't reply with an error code, there's likely no internet connection?
      if (!errorStatusCode) {
        sendToAllBrowserTabs({ type: 'disconnected' });
      }
      console.warn(`Long polling error, will retry in ${Math.floor(retryAfterMs / 1000)} seconds...`);
      setTimeout(() => {
        if (!isLongPollingNow()) {
          subscribeToServerEvents(channelId);
        }
      }, retryAfterMs);
    }
  }, () => {
    console.debug("Long polling aborted, will send a new if needed [TyMLPRMBYE]");
    // No error has happened — we aborted the request intentionally. All fine then? Reset the backoff:
    retryAfterMs = RetryAfterMsDefault;
    if (!isLongPollingNow()) {
      subscribeToServerEvents(channelId);
    }
  });
}


interface OngoingRequestWithNr extends Promise<any> {
  reqNr?: number;
  anyAbortController?: AbortController;
}

interface LongPollingState {
  ongoingRequest?: OngoingRequestWithNr;
  lastModified?;
  lastEtag?;
  nextReqNr: number;
}

const longPollingState: LongPollingState = { nextReqNr: 1 };

// Should be less than the Nchan timeout [2ALJH9] but let's try the other way around for
// a short while, setting it to longer (60 vs 40) maybe working around an Nginx segfault [NGXSEGFBUG].
const LongPollingSeconds = 60;



function sendLongPollingRequest(channelId: string, successFn: (response) => void,  // dupl [7KVAWBY0]
      errorFn: ErrorStatusHandler, resendIfNeeded: () => void) {

  if (longPollingState.ongoingRequest)
    throw `Already long polling, request nr ${longPollingState.ongoingRequest.reqNr} [TyELPRDUPL]`;

  // For debugging.
  const reqNr = longPollingState.nextReqNr;
  longPollingState.nextReqNr = reqNr + 1;

  console.debug(
      `Sending long polling request ${reqNr}, channel ${channelId} [TyMLPRSEND]`);


  /*
  const options: GetOptions = {
    dataType: 'json',
    // Don't show any error dialog if there is a disconnection, maybe laptop goes to sleep?
    // or server restarts? or sth. The error dialog is so distracting — and the browser
    // resubscribes automatically in a while. Instead, we show a non-intrusive message [NOINETMSG]
    // about that, and an error dialog not until absolutely needed.
    //
    // (Old?: Firefox always calls the error callback if a long polling request is ongoing when
    // navigating away / closing the tab. So the dialog would be visible for 0.1 confusing seconds.
    // 2018-06-30: Or was this in fact jQuery that called error(), when FF called abort()? )
    suppressErrorDialog: true,
  }; */

  const anyAbortController = ('AbortController' in self) ? new AbortController() : undefined;

  let options: any = {
    credentials: 'same-origin',
    referrer: 'no-referrer',
    redirect: 'error',
    signal: anyAbortController ? anyAbortController.signal : undefined,
  };

  // The below headers make Nchan return the next message in the channel's message queue,
  // or, if queue empty, Nchan waits with replying, until a message arrives. Our very first
  // request, though, will lack headers — then Nchan returns the oldest message in the queue.
  if (longPollingState.lastEtag) {
    options.headers = {
      // Should *not* be quoted, see:
      // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/If-Modified-Since
      'If-Modified-Since': longPollingState.lastModified,
      // *Should* be quoted, see:
      // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/If-None-Match
      // """a string of ASCII characters placed between double quotes (Like "675af34563dc-tr34")"""
      // Not sure if Nchan always includes quotes in the response (it *should*), so remove & add-back '"'.
      'If-None-Match': `"${longPollingState.lastEtag.replace(/"/g, '')}"`,
      // 'Content-Type': 'application/json',  <— don't forget, if POSTing.
      // Nice: URLSearchParams
    };
  }

  let requestDone = false;

  // We incl the req nr in the URL, for debugging, so knows which lines in
  // chrome://net-internals/#events and in the Nginx logs are for which request in the browser.
  const pollUrl = `/-/pubsub/subscribe/${channelId}?reqNr=${reqNr}&swJsVersion=${SwPageJsVersion}`;

  longPollingState.ongoingRequest = fetch(pollUrl, options).then(function(response) {
    // This means the response http headers have arrived — we also need to wait
    // for the response body.

    if (response.status === 200) {
      console.trace(
          `Long polling request ${reqNr} response headers, status 200 OK [TyMSWLPRHDRS]`);
      response.json().then(function(json) {
        longPollingState.ongoingRequest = null;
        console.debug(`Long polling request ${reqNr} response json [TyMSWLPRRESP]: ` +
            JSON.stringify(json));

        // Don't bump these until now, when we have the whole response:
        longPollingState.lastModified = response.headers.get('Last-Modified');
        // (In case evil proxy servers remove the Etag header from the response, there's
        // a workaround, see the Nchan docs:  nchan_subscriber_message_id_custom_etag_header)
        longPollingState.lastEtag = response.headers.get('Etag');

        requestDone = true;
        successFn(json);
      }).catch(function(error) {
        longPollingState.ongoingRequest = null;
        requestDone = true;
        console.warn(`Long polling request ${reqNr} failed: got headers, status 200, ` +
            `but no json [TyESWLP0JSN]`);
        errorFn(200);
      });
    }
    else if (response.status === 408) {
      // Fine.
      console.debug(`Long polling request ${reqNr} done, status 408 Timeout [TyMSWLPRTMT]`);
      resendIfNeeded();
    }
    else {
      console.warn(
          `Long polling request  ${reqNr} error response, status ${response.status} [TyESWLPRERR]`);
      errorFn(response.status);
    }
  }).catch(function(error) {
    longPollingState.ongoingRequest = null;
    requestDone = true;
    if (justAbortedLongPollingReqNr === reqNr) {
      console.debug(`Long polling request ${reqNr} failed: aborted, fine [TyMSWLPRABRTD]`);
    }
    else {
      console.warn(`Long polling request ${reqNr} failed, no response [TyESWLP0RSP]`);
      errorFn(0);
    }
  });

  longPollingState.ongoingRequest.anyAbortController = anyAbortController;
  longPollingState.ongoingRequest.reqNr = reqNr;

  // Cancel and send a new request after half a minute.

  // Otherwise firewalls and other infrastructure might think the request is broken,
  // since no data gets sent. Then they might kill it, sometimes (I think) without
  // this browser or Talkyard server getting a chance to notice this — so we'd think
  // the request was alive, but in fact it had been silently terminated, and we
  // wouldn't get any more notifications.

  // And don't update last-modified and etag, since when cancelling, we don't get any
  // more recent data from the server.

  const currentRequest = longPollingState.ongoingRequest;

  magicTimeout(LongPollingSeconds * 1000, function () {
    if (requestDone)
      return;
    console.debug(`Aborting long polling request ${reqNr} after ${LongPollingSeconds}s [TyMLPRABRT1]`);
    if (currentRequest.anyAbortController) {
      justAbortedLongPollingReqNr = reqNr;
      currentRequest.anyAbortController.abort();
    }
    // Unless a new request has been started, reset the state.
    if (currentRequest === longPollingState.ongoingRequest) {
      longPollingState.ongoingRequest = null;
    }
    resendIfNeeded();
  });
}


function isLongPollingNow(): boolean {
  return !!longPollingState.ongoingRequest;
}


function abortAnyLongPollingRequest() {
  const ongReq = longPollingState.ongoingRequest;
  if (ongReq) {
    console.debug(`Aborting long polling request ${ongReq.reqNr} [TyMLPRABRT2]`);
    if (ongReq.anyAbortController) {
      justAbortedLongPollingReqNr = ongReq.reqNr;
      ongReq.anyAbortController.abort();
    }
    longPollingState.ongoingRequest = null;
  }
}


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list