/// <reference path="../app/model.ts" />

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

console.log("Service worker v0.0.1 loading [TyMSWVLDNG]");  // [sw]

type ErrorStatusHandler = (errorStatusCode?: number) => void;

declare var oninstall: any;
declare var onactivate: any;
declare var onfetch: any;
declare var skipWaiting: any;
declare var clients;

let longPollingReqNr = 0;
let longPollingPromise = null;

let totalReqNr = 0;
let numActive = 0;


oninstall = function(event) {
  console.log("Service worker installed [TyMSWINSTLD]");
  skipWaiting();
};


onactivate = function(event) {
  console.log('Service worker activated [TyMSWACTIVD]');
  // On the very very first Talkyard page load, the browser page tab loads without any
  // service worker, and thus won't get any live notifications, because it'll have no
  // service worker (until after reload), since it was loaded outside any service worker
  // — unless we claim() it — then, subsequent fetches will be via this service worker,
  // and we can send messages to that tab.
  if (!clients.claim) return;
  event.waitUntil(clients.claim().then(() => {
    sendToAllBrowserTabs("HELOZZ"); // remove
  }));
};


onmessage = function(event) {
  console.log(`Service worker got message: '${JSON.stringify(event.data)}' [TyMSWGOTMSG]`);
  const untypedMessage: MessageToServiceWorker = event.data;
  switch (untypedMessage.doWhat) {
    case SwDo.SubscribeToEvents:
      const message = <SubscribeToEventsSwMessage> untypedMessage;
      // This is an easy-to-guess channel id, but in order to subscribe, the session cookie
      // must also be included in the request. So this should be safe.
      // The site id is included, because users at different sites can have the same id. [7YGK082]
      const channelId = message.siteId + '-' + message.myId;
      subscribeToServerEvents(channelId);
      break;
    // TODO: If logged out?
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

function getNowMs() {
  return Date.now();
}


/**
 * Deletes any old event subscription and creates a new for the current user.
 */
function subscribeToServerEvents(channelId: string) {
  abortAnyLongPollingRequest();

  // Remove the "No internet" message, in case the network works (again).
  // If disconnected, the "No internet" message [NOINETMSG] will reappear immediately when this
  // netw request fails (unless if not logged in — then, won't see live notifications anyway,
  // so no need for the message).
  sendToAllBrowserTabs({ type: 'connected' });

  sendLongPollingRequest(channelId, (response) => {
    console.debug("Long polling request done, sending another...");
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


// For end-to-end tests, so they can verify that new long polling requests seem to
// get sent.
function testGetLongPollingNr() {
  return longPollingState.nextReqNr - 1;
}



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
  const pollUrl = `/-/pubsub/subscribe/${channelId}?reqNr=${reqNr}`;

  longPollingState.ongoingRequest = fetch(pollUrl, options).then(function(response) {
    const json = response.json();
    console.debug(`Long polling request ${reqNr} response [TyMSWLPRRESP]: ${JSON.stringify(json)}`);
    longPollingState.ongoingRequest = null;
    if (response.status === 200) {
      longPollingState.lastModified = response.headers.get('Last-Modified');
      // (In case evil proxy servers remove the Etag header from the response, there's
      // a workaround, see the Nchan docs:  nchan_subscriber_message_id_custom_etag_header)
      longPollingState.lastEtag = response.headers.get('Etag');
      requestDone = true;
      successFn(json);
    }
    else if (response.status === 408) {
      // Fine.
      console.debug(`Long polling request ${reqNr} done, status 408 Timeout [TyESWLPRTMT]`);
      resendIfNeeded();
    }
    else {
      console.warn(`Long polling request  ${reqNr} error response [TyESWLPRERR]`);
      errorFn(response.status);
    }
  }).catch(function(error) {
    longPollingState.ongoingRequest = null;
    requestDone = true;
    console.warn(`Long polling request ${reqNr} failed, no response [TyESWLPFAIL]`);
    errorFn(0);
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

  //magicTimeout(LongPollingSeconds * 1000, function () {
  setTimeout(function () {
    if (requestDone)
      return;
    console.debug(`Aborting long polling request ${reqNr} after ${LongPollingSeconds}s [TyMLPRABRT1]`);
    if (currentRequest.anyAbortController) {
      currentRequest.anyAbortController.abort();
    }
    // Unless a new request has been started, reset the state.
    if (currentRequest === longPollingState.ongoingRequest) {
      longPollingState.ongoingRequest = null;
    }
    resendIfNeeded();
  }, LongPollingSeconds * 1000);
}


function isLongPollingNow(): boolean {
  return !!longPollingState.ongoingRequest;
}


function abortAnyLongPollingRequest() {
  const ongReq = longPollingState.ongoingRequest;
  if (ongReq) {
    console.debug(`Aborting long polling request ${ongReq.reqNr} [TyMLPRABRT2]`);
    if (ongReq.anyAbortController) {
      ongReq.anyAbortController.abort();
    }
    longPollingState.ongoingRequest = null;
  }
}

