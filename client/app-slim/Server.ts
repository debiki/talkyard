/*
 * Copyright (c) 2014-2025 Kaj Magnus Lindberg
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

/// <reference path="model.ts" />
/// <reference path="links.ts" />
/// <reference path="ServerApi.ts" />

// Ought to include, but then `debiki2.createComponent` gets placed too late —> JS breaks:
//xx <reference path="ReactActions.ts" />
//xx <reference path="page-dialogs/server-error-dialog.ts" />
// Not important to fix right now — everything works fine anyway.

//------------------------------------------------------------------------------
   namespace debiki2.Server {
//------------------------------------------------------------------------------

const BadNameOrPasswordErrorCode = '_TyE403BPWD';
const NoPasswordErrorCode = '_TyMCHOOSEPWD';

const XsrfTokenHeaderName = 'X-XSRF-TOKEN'; // CLEAN_UP rename to X-Ty-Xsrf-Token
const SessionIdHeaderName = 'X-Ty-Sid';
const AvoidCookiesHeaderName = 'X-Ty-Avoid-Cookies';
//const PersonaCookieName = "TyCoPersona";
const PersonaHeaderName = 'X-Ty-Persona';


// Mayble later. [remember_persona_mode]
/*
export function setpersonacookie(asPersona: Oneself | LazyCreatedAnon | N) {
  // Or remember in local storage instead?
  getSetCookie(PersonaCookieName, asPersona ? JSON.stringify(asPersona) : null);
}

export function getPersonaCookie(): Oneself | LazyCreatedAnon | NU {
  const cookieVal: St | N = getCookie(PersonaCookieName);
  if (!cookieVal) return undefined;
  const persona = JSON.parse(cookieVal);
  // @ifdef DEBUG
  dieIf(!(persona as Oneself).self && !(persona as LazyCreatedAnon).anonStatus,
        `Bad persona cookie value: [[ ${cookieVal} ]] [TyE320JVMR4]`);
  // @endif
  return persona;
}
*/

export function getPageId(): PageId | U {   // move elsewhere?
  return !isNoPage(eds.embeddedPageId) ? eds.embeddedPageId : // [4HKW28]
      ReactStore.allData().currentPageId || (
        // old,  CLEAN_UP  REMOVE
        eds.embeddedPageId || ReactStore.allData().currentPageId);
}

interface OngoingRequest {
  abort();
}

interface RequestData {
  data?: JsonData;
  success?: (response: any) => void;
  error?: (xhr: XMLHttpRequest) => any;
  showLoadingOverlay?: boolean;
}


interface NewEmbCommentsPageIdCatUrl {
  discussionId?: string;
  embeddingUrl?: string;
  lazyCreatePageInCatId?: CategoryId;
}


function postJson(urlPath: string, requestData: RequestData) {
  let url = appendE2eAndForbiddenPassword(origin() + urlPath);
  const timeoutHandle = showWaitForRequestOverlay(requestData.showLoadingOverlay !== false);

  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'X-Requested-With': 'XMLHttpRequest',
  };

  headers[XsrfTokenHeaderName] = getXsrfCookie();

  addAnyNoCookieHeaders(headers);

  // DO_AFTER 2021-01-01: Use the native fetch() [FETCHEX] and remove Bliss.fetch.
  // IE11 needs a shim: https://github.com/github/fetch  — but IE11 doesn't work anyway.

  Bliss.fetch(url, {
    method: 'POST',
    data: JSON.stringify(requestData.data || null),
    headers,
  }).then(xhr => {
    removeWaitForRequestOverlay(timeoutHandle);
    if (requestData.success) {
      // Remove any AngularJS safe json prefix. [5LKW02D4]
      let response = xhr.response.replace(/^\)]}',\n/, '');
      checkE2eTestForbiddenWords(url, response);
      response = response ? JSON.parse(response) : null;
      try {
        requestData.success(response);
      }
      catch (ex) {
        const message = "Error handling POST response [TyEPOSTCLBK]";
        console.error(`${message} from: ${url}`, ex);
        pagedialogs.getServerErrorDialog().openForBrowserError(
            ex.toString?.() || message);
      }
    }
  }).catch(errorObj => {
    removeWaitForRequestOverlay(timeoutHandle);
    const errorAsJson = JSON.stringify(errorObj);
    const details = errorObj.xhr && errorObj.xhr.responseText ?
        errorObj.xhr.responseText : errorObj.stack;
    // error: (jqXhr: any, textStatus: string, errorThrown: string) => {
    // COULD ensure all callers survive xhr == null, and call them also if !xhr,
    // but currently an unknown caller dies on null, so:
    let perhapsIgnoreError;
    if (requestData.error && errorObj.xhr) {
      perhapsIgnoreError = requestData.error(errorObj.xhr);
      if (perhapsIgnoreError === IgnoreThisError)
        return;
    }
    console.error(`Error POSTing to ${urlPath}: ${errorAsJson}, details: ${details}`);
    if (perhapsIgnoreError === ShowNoErrorDialog) {
      // Noop.
    }
    else if (errorObj.xhr) {
      pagedialogs.getServerErrorDialog().open(errorObj.xhr);
    }
    else {
      pagedialogs.getServerErrorDialog().openForBrowserError(
          errorObj.stack || 'Unknown error [EdEUNK1]');
    }
  });
}


/* The real native fetch(), usage example:  [FETCHEX]

function sendFetchRequest(onOk: (response) => void, onError: ErrorStatusHandler) {

  const anyAbortController = ('AbortController' in self) ? new AbortController() : undefined;

  let options: any = {
    credentials: 'same-origin',
    // This fails requests to external origins.
    mode: 'same-origin',
    referrer: 'no-referrer',
    redirect: 'error',
    signal: anyAbortController ? anyAbortController.signal : undefined,
    headers: {
      'Content-Type': 'application/json',  // don't forget, if POSTing.
    },
  }

  const ongoingRequest = fetch('/something', options).then(function(response) {
    // This means the response http headers have arrived — we also need to wait
    // for the response body.
    if (response.status === 200) {
      console.trace(`Request response headers, status 200 OK`);
      response.json().then(function(json) {
        console.debug(`Response json [TyMSWLPRRESP]: ` + JSON.stringify(json));
        onOk(json);
      }).catch(function(error) {
        console.warn(`Request failed: got headers, status 200, ` +
            `but no json [TyESWLP0JSN]`);
        onError(200);
      });
    }
    else if (response.status === 408) {
      console.debug(`Request status 408 Timeout [TyMSWLPRTMT]`);
    }
    else {
      console.warn(`Request error response, status ${response.status} [TyESWLPRERR]`);
      onError(response.status);
    }
  }).catch(function(error) {
    console.warn(`Request failed, no response [TyESWLP0RSP]`);
    onError(0);
  });

  anyAbortController.abort();
}

*/

interface PendingFetch {
  request,
  abort: () => void;
}


// ---------------------------------------------------------------
// @ifdef DEBUG
// This fn not yet needed — nice to have though, when trying out CORS requests.
// And later, when using fetch() everywhere.  [FETCHEX]

// Fetches, via a POST requests, stuff from another server. [CORSPOST]
// Shows what went wrong (if anything).
// This will only work, if that other server has been configured to allow
// CORS requests from the current server (current origin).
//
// This could almost be a blog post (!) — so many things can go wrong,
// What about open sourcing this fn under MIT?
//
export function corsPost(ps: { url: string, xsrfToken: string, data: any,
        onDone: (responseJson) => void, onError?: ErrorDetailsStatusHandler })
        : PendingFetch {

  const onError: ErrorDetailsStatusHandler = function(statusCode, statusText, ex?) {
    try {
      ps.onError?.(statusCode, statusText, ex);
    }
    catch (ex2) {
      console.error(`Error in error handler, after corsPost():ing to ${ps.url} ` +
            `and handling respone status ${statusCode} ${statusText}: `, ex2);
    }
  }

  dieIf(_.isString(ps.data),
      "'data' should be a javascript object not a string [TyE503RSKDH]");

  // There are browsers with fetch() but no AbortController, e.g. UC Browser for Android
  // and Opera Mini (this as of 2020-06).
  const anyAbortController = ('AbortController' in self) ?
          new AbortController() : undefined;

  const method = 'POST';

  const options: RequestInit = {
    // Could specify 'same-origin', but then harder to troubleshoot, when such
    // requests look different.
    credentials: 'omit',
    method,
    keepalive: true,
    // This makes the response body readable for this in-browser Javascript code.
    mode: 'cors',
    referrer: 'no-referrer',
    // Don't follow redirects.
    redirect: 'error',
    signal: anyAbortController?.signal,
    headers: {
      'Content-Type': 'application/json',  // if POSTing.
    },
    body: JSON.stringify(ps.data),
  };

  // Do here, so won't add any `xsrf: undefined` field, if missing — that'd
  // get sent as "undefined" (a string).
  if (ps.xsrfToken) {
    options.headers['X-Xsrf-Token'] = ps.xsrfToken;
  }

  const ongoingRequest = fetch(ps.url, options).then(function(response) {
    // We got the response http headers. Get the body too, also if we got an error
    // status code — so we can show details from the response body about what
    // went wrong. Use text() not json() so we can print the response body if it's
    // a plain text error message, or corrupt json that caused a parse error.
    console.trace(`Got fetch() response headers: ${response.status
          } ${response.statusText} [TyMGOTHDRS]`);

    response.text().then(function(text) {
      console.trace(`Got fetch() response text [TyMGOTTXT]: ` + text);

      if (response.status !== 200) {
        console.error(`fetch() error response, status ${response.status
                } ${response.statusText} [TyEFETCHERR], response text:\n${text}`);
        onError(response.status, response.statusText, text);
        return;
      }

      checkE2eTestForbiddenWords(ps.url, text);

      let json;
      try { json = JSON.parse(text) }
      catch (ex) {
        console.error(`Error parsing JSON in fetch() 200 ${response.statusText
              } response [TyEFETCH0JSN]:\n${text}`, ex);
        onError(200, response.statusText, "Error parsing response json");
        return;
      }

      try { ps.onDone(json) }
      catch (ex) {
        console.error(`Error in fetch() 200  ${response.statusText
              } response handler [TyERSPHNDL]`, ex);
      }
    }).catch(function(error) {
      console.error(`Error getting fetch() response body [TyEFETCH0BDY]: `, error);
      onError(response.status, response.statusText, error);
    });
  }).catch(function(error) {
    console.error(`fetch() failed, no response [TyEFETCHFAIL]: `, error);
    onError(0, '', error);
  });

  return {
    request: ongoingRequest,
    abort: !anyAbortController ? null : () => anyAbortController.abort(),
  };
}

// In Javascript:
/*

ex:  corsPost({ url: 'http://site-3.localhost/-/v0/search', data: {},
        onDone: r => { console.log('RSLT: ' + JSON.stringify(r)); }  });

function corsPost(ps) {  

  const onError = function(statusCode, statusText, ex) {
    try {
      !ps.onError || ps.onError(statusCode, statusText, ex);
    }
    catch (ex2) {
      console.error(`Error in error handler, after corsPost():ing to ${ps.url} ` +
            `and handling respone status ${statusCode} ${statusText}: `, ex2);
    }
  }

  // There are browsers with fetch() but no AbortController, e.g. UC Browser for Android
  // and Opera Mini (this as of 2020-06).
  const anyAbortController = ('AbortController' in self) ?
          new AbortController() : undefined;

  const method = 'POST';

  const options = {
    // Could specify 'same-origin', but then harder to troubleshoot, when such
    // requests look different.
    credentials: 'omit',
    method,
    keepalive: true,
    // This makes the response body readable for this in-browser Javascript code.
    mode: 'cors',
    referrer: 'no-referrer',
    // Don't follow redirects.
    redirect: 'error',
    signal: anyAbortController?.signal,
    headers: {
      'Content-Type': 'application/json',  // if POSTing.
    },
    body: JSON.stringify(ps.data),
  };

  // Do here, so won't add any `xsrf: undefined` field, if missing — that'd
  // get sent as "undefined" (a string).
  if (ps.xsrfToken) {
    options.headers['X-Xsrf-Token'] = ps.xsrfToken;
  }

  const ongoingRequest = fetch(ps.url, options).then(function(response) {
    // We got the response http headers. Get the body too, also if we got an error
    // status code — so we can show details from the response body about what
    // went wrong. Use text() not json() so we can print the response body if it's
    // a plain text error message, or corrupt json that caused a parse error.
    console.trace(`Got fetch() response headers: ${response.status
          } ${response.statusText} [TyMGOTHDRS]`);

    response.text().then(function(text) {
      console.trace(`Got fetch() response text [TyMGOTTXT]: ` + text);

      if (response.status !== 200) {
        console.error(`fetch() error response, status ${response.status
                } ${response.statusText} [TyEFETCHERR], response text:\n${text}`);
        onError(response.status, response.statusText, text);
        return;
      }

      //checkE2eTestForbiddenWords(url, text); (doesn't exist in the brouwser console)

      let json;
      try { json = JSON.parse(text) }
      catch (ex) {
        console.error(`Error parsing JSON in fetch() 200 ${response.statusText
              } response [TyEFETCH0JSN]:\n${text}`, ex);
        onError(200, response.statusText, "Error parsing response json");
        return;
      }

      try { ps.onDone(json) }
      catch (ex) {
        console.error(`Error in fetch() 200  ${response.statusText
              } response handler [TyERSPHNDL]`, ex);
      }
    }).catch(function(error) {
      console.error(`Error getting fetch() response body [TyEFETCH0BDY]: `, error);
      onError(response.status, response.statusText, error);
    });
  }).catch(function(error) {
    console.error(`fetch() failed, no response [TyEFETCHFAIL]: `, error);
    onError(0, '', error);
  });

  return {
    request: ongoingRequest,
    abort: !anyAbortController ? null : () => anyAbortController.abort(),
  };
}

*/
// @endif
// ---------------------------------------------------------------


export function uploadFiles(endpoint: string, files: any[], onDone, onError) {  // [FETCHEX]
  dieIf(files.length !== 1,  `${files.length} files [TyE06WKTDN23]`);
  const headers = {};
  headers[XsrfTokenHeaderName] = getXsrfCookie();
  fetch(endpoint, {
    method: 'POST',
    body: files[0],
    headers,
  })
  .then((response: Response) => {
    logM("Uploaded file. [TyM306KWRDF2]");
    // Clone the respones, otherwie `.text()` fails with a
    // "TypeError: Failed to execute 'text' on 'Response': body stream is locked" error,
    // if one has Dev Tools open and inspects the response in Dev Tools.
    return response.clone().text().then(
      responseText => cloneReponseToObj(response, responseText));
  })
  .then((respObj: ResponseObj) => {
    if (respObj.status !== 200) {
      const errCode = 'TyEBADFETCHRESP';
      const message = `Status ${respObj.status} error when uploading file ` +
          `to ${endpoint} [${errCode}]:\n\n${respObj.responseText}`;
      console.error(message);
      pagedialogs.getServerErrorDialog().open(respObj);
      onError(message);
      return errCode;
    }
    else {
      // Remove any AngularJS safe json prefix. [5LKW02D4]
      const jsonStr = respObj.responseText.replace(/^\)]}',\n/, '');
      checkE2eTestForbiddenWords(endpoint, jsonStr);
      const json = JSON.parse(jsonStr);
      onDone(json);
      return json;
    }
  })
  .catch(error => {
    console.error(`Error uploading file to ${endpoint} [TyE7FKSH260]`, error);
    pagedialogs.getServerErrorDialog().open(error);
    onError(error);
    return error;
  });
}


function cloneReponseToObj(response: Response, responseText: string): ResponseObj {
  return {
    headers: response.headers,
    ok: response.ok,
    redirected: response.redirected,
    status: response.status,
    statusText: response.statusText,
    type: response.type,
    url: response.url,
    responseText,
  };
}


function trySendBeacon(url, data) {
  // sendBeacon is not supported in Safari and iOS as of Feb 2017 ... and Aug 2018.
  let sendBeacon = navigator['sendBeacon'];
  if (!sendBeacon) {
    // Bad luck, likely Apple's iOS.
    return;
  }

  // 1. Don't call variable `sendBeacon`, that results in an invalid-invokation error.
  // 2. sendBeacon() apparently always posts text/plain;charset=UTF-8.
  // 3. There's no way to add a xsrf header — so include a xsrf token in the request body.
  let xsrfTokenLine = getXsrfCookie() + '\n';  // [7GKW20TD]
  let json = JSON.stringify(data);
  (<any> navigator).sendBeacon(url + '-text', xsrfTokenLine + json);
}


// If needed later:
// loadCss: use https://github.com/filamentgroup/loadCSS/blob/master/src/loadCSS.js
// SMALLER_BUNDLE use Bliss.load() instead? Works for both js and css.
//
export function loadJs(src: string, onOk?: () => void, onError?: () => void): any {  // : Promise, but compilation error
  const promise = new Promise(function (resolve, reject) {
    const scriptElem = document.createElement('script');
    scriptElem.src = src;
    scriptElem.onload = resolve;
    scriptElem.onerror = reject;
    document.head.appendChild(scriptElem);
  });
  promise.catch(function(error) {
    const message =`Error loading script ${src}: ${error.toString()} [EdELDJSERR]`;
    console.error(message);
    console.error(error);
    pagedialogs.getServerErrorDialog().open(message);
  });
  if (onOk) promise.then(onOk);
  if (onError) promise.catch(onError);
  return promise;
}


let globalStaffScriptLoaded = false;

export function maybeLoadGlobalStaffScript() {
  // We don't want any global feedback widget scripts or whatever, to load for e2e tests
  // (because the tests would break, if they clicked those widgets).
  // (But do load, for test sites created by real people to try out Talkyard.)
  if (isAutoTestSite()) return;  // [load_global_js]
  if (!globalStaffScriptLoaded && eds.loadGlobalStaffScript) {
    loadJs(eds.cdnOrServerOrigin + '/-/globalStaffScript.js');
    globalStaffScriptLoaded = true;
  }
}


let globalAdminScriptLoaded = false;

export function maybeLoadGlobalAdminScript() {
  if (isAutoTestSite()) return;  // [load_global_js]
  if (!globalAdminScriptLoaded && eds.loadGlobalAdminScript) {
    loadJs(eds.cdnOrServerOrigin + '/-/globalAdminScript.js');
    globalAdminScriptLoaded = true;
  }
}


type RequestTimeoutHandle = number[];

function showWaitForRequestOverlay(shallShow: boolean): RequestTimeoutHandle | undefined {
  if (!shallShow)
    return;

  const timeoutHandle = [];
  showLoadingOverlay();
  timeoutHandle[0] = setTimeout(function() {
    maybeShowServerJustStartedMessage();
    // 2nd timeout:
    timeoutHandle[0] = setTimeout(showErrorIfNotComplete, 21 * 1000);
  }, 9 * 1000);

  return timeoutHandle;
}


function removeWaitForRequestOverlay(timeoutHandle: RequestTimeoutHandle) {
  if (timeoutHandle) {
    const actualHandle = timeoutHandle[0]
    if (actualHandle) {
      clearTimeout(actualHandle);
    }
    removeLoadingOverlay();
  }
}


function showLoadingOverlay() {
  document.body.appendChild(
      $h.parseHtml('<div id="theLoadingOverlay"><div class="icon-loading"></div></div>')[0]);
}


function maybeShowServerJustStartedMessage() {
  const overlayElem = $byId('theLoadingOverlay');
  if (!overlayElem) return;
  const messageElem =
      $h.parseHtml('<div id="theServerJustStarted">' +
      "<p>This takes long ...</p>" +
      "<p>If many browser tabs are open to this site,<br>close a few.</p>" +
      "<p>Or maybe the server was just started, and is slow.</p>" +
      '</div>')[0];
  $h.addClasses(overlayElem, 'esLoadingSlow');
  overlayElem.appendChild(messageElem);
}


function removeLoadingOverlay() {
  const overlay = $byId('theLoadingOverlay');
  if (overlay) overlay.remove();
}


function showErrorIfNotComplete() {
  const stillLoading = !!$byId('theLoadingOverlay');
  if (stillLoading) {
    // Remove the spinner before showing the dialog.
    Bliss('#theLoadingOverlay .icon-loading').remove();
    alert("Error: Server too slow [EsE5YK0W24]");
    removeLoadingOverlay();
  }
}


export const testPost = postJsonSuccess;

type JsonData = object | any[];
type OnErrorFn = (xhr: XMLHttpRequest) => any;


/// Posts JSON to the server, and uses the response to patch the store. Thereafter,
/// passes the response to onOk — for example, to scroll to or highlight something
/// that the user just created or edited.
///
/// Always place StorePatch fields in a  { storePatch: {...} }  obj?  [storepatch_field]
///
function postAndPatchStore(
        urlPath: St,
        onOk: (resp: HasStorePatch | StorePatch) => V,
        data: JsonData | OnErrorFn,
        onErr?: JsonData | OnErrorFn,
        opts?: { showLoadingOverlay?: Bo },  // default true
        ) {
  postJsonSuccess(urlPath, resp => {
    ReactActions.patchTheStore(resp.storePatch || resp);
    onOk(resp);
  }, data, onErr, opts);
}


/** Return Server.IgnoreThisError from error(..) to suppress a log message and error dialog.
  */
function postJsonSuccess(
  urlPath: string,
  onOk: ((response: any) => void) | UseBeacon,  // RENAME all onDone and success to onOk
  data: JsonData | OnErrorFn,
  onError?: JsonData | OnErrorFn,
  options?: { showLoadingOverlay?: boolean },  // default true, for POST requests
  ) {

  // Make postJsonSuccess(..., onError, data) work:
  if (!data || _.isFunction(data)) {
    const tmp = data;
    data = onError;
    onError = tmp;
  }

  if (onOk === UseBeacon) {
    trySendBeacon(urlPath, data);
    return;
  }

  options = options || {};
  postJson(urlPath, {
    data: data,
    success: onOk,
    error: onError as OnErrorFn,
    showLoadingOverlay: options.showLoadingOverlay,
  });
}


export const testGet = get;

type GetSuccessFn = (response, xhr?: XMLHttpRequest) => void;
type GetErrorFn = (errorDetails: string, status?: number) => void;

interface GetOptions {
  dataType?: string;
  headers?: { [headerName: string]: string }
  timeout?: number;
  suppressErrorDialog?: boolean;
  showLoadingOverlay?: true;  // default false, for GET requests
  notFoundAs404?: true
  canCache?: true | ((resp: any) => any);
}


interface CachedResp<T> {
  cachedAt: WhenMs
  response: T
}

let _queryCache: { [url: St]: CachedResp<LoadPostsResponse> } = {};


/// Call if creating / editing bookmarks, or bookmarked posts. Better call it too often
/// than too rarely. — Not really needed, we do reload() after logout anyway: [reload_on_logout]
export function clearQueryCache() {
  _queryCache = {};
}


function getAndPatchStore(uri: string, onOk?: GetSuccessFn,
      onErr?: GetErrorFn, opts?: GetOptions): OngoingRequest {
  let reqrIdBef: PatId | U;

  if (opts?.canCache) {
    reqrIdBef = ReactStore.getMe().id;
    const anyCachedResp = _queryCache[uri];
    if (anyCachedResp) {
      // Make this configurable? [cache_how_long]  & feature switch in case of bugs.
      // And, if disconnected, do use the cached response anyway?
      const tooOld = anyCachedResp.cachedAt > Date.now() - 10 * Time.OneMinuteInMillis;
      if (!tooOld) {
        onOk(anyCachedResp.response);
        return;
      }
    }
  }

  return get(uri, function(respRaw) {
    // `response` is optionally preprocessed, before caching (so need do just once),
    // while `respRaw` is the json directly from the server.
    let response = respRaw;
    if (opts?.canCache) {
      if (_.isFunction(opts.canCache)) {
        response = opts.canCache(response);
      }
      const reqrIdAft = ReactStore.getMe().id;
      if (reqrIdBef === reqrIdAft) {
        _queryCache[uri] = { cachedAt: Date.now(), response };
      }
      else {
        // While the request was in-flight, the human at the computer has logged in, or is
        // logging out. Then, don't cache — it'd be for the wrong person, or might include
        // too little data (if sent when logged out, response arrived when logged in).
      }
    }

    ReactActions.patchTheStore(response);

    if (onOk) {
      onOk(response);
    }
  }, onErr, opts);
}


function get(uri: string, successFn: GetSuccessFn, errorFn?: GetErrorFn, options?: GetOptions)
    : OngoingRequest {

  options = options || {};
  const headers = options.headers || {};

  headers['X-Requested-With'] = 'XMLHttpRequest';

  addAnyNoCookieHeaders(headers);

  const timeoutHandle = showWaitForRequestOverlay(options?.showLoadingOverlay === true);
  const url = origin() + uri;

  const promiseWithXhr = <any> Bliss.fetch(url, {  // hack, search for "Hack" in fetch()
    method: 'GET',                                            // in client/third-party/bliss.shy.js
    headers: headers,
    timeout: options.timeout,
  });
  promiseWithXhr.then(xhr => {
    removeWaitForRequestOverlay(timeoutHandle);
    let response: St = xhr.response;

    // @ifdef DEBUG
    dieIf(!_.isString(response), 'TyE603SRKHNg');
    // @endif
    checkE2eTestForbiddenWords(url, response);

    if (options.dataType !== 'html') {
      // Then it's json, what else could it be? Remove any AngularJS safe json prefix. [5LKW02D4]
      response = xhr.response.replace(/^\)]}',\n/, '');
      response = JSON.parse(response);
    }
    try {
      successFn(response, xhr);
    }
    catch (ex) {
      const message = "Error handling GET response [TyEGETCLBK]"
      console.error(`${message} from: ${uri}`, ex);
      pagedialogs.getServerErrorDialog().openForBrowserError(
          ex.toString?.() || message);
    }
  }).catch(errorObj => {
    removeWaitForRequestOverlay(timeoutHandle);
    const errorAsJson = JSON.stringify(errorObj);
    const details: string = errorObj.xhr ? errorObj.xhr.responseText : errorObj.stack;
    checkE2eTestForbiddenWords(url, details);

    // If not found is normal, don't show any error, just run callback. (It's simpler to
    // return 404 server side, than to decide on some 200 OK json that in fact
    // means "not found". And then we get to here.)
    if (options.notFoundAs404 && errorObj.status === 404) {
      successFn(404);
      return;
    }

    console.error(`Error GETting from ${uri}: ${errorAsJson}, details: ${details}`);
    let maybeIgnoreError: ErrorPolicy;
    if (errorFn) {
      maybeIgnoreError = errorFn(details, errorObj.status);
    }
    if (!options.suppressErrorDialog && maybeIgnoreError !== IgnoreThisError) {
      const errorDialog = pagedialogs.getServerErrorDialog();
      if (errorObj.xhr) {
        errorDialog.open(errorObj.xhr);
      }
      else {
        errorDialog.openForBrowserError(errorObj.stack || 'Unknown error [EdEUNK2]');
      }
    }
  });

  return {
    abort: function() {
      // Unlike with jQuery, this abort() won't trigger the promise's error handler above,
      // i.e. won't call `catch(...)` above.
      promiseWithXhr.xhr.abort();
    }
  }
}


/**
 * Sends xsrf token and sid in headers, instead of cookies, because sometimes
 * the browsers refuse to use cookies, e.g. Privacy Badger blocks cookies or iOS
 * incorrectly thinks we're doing some kind of cross site tracking.
 */
export function addAnyNoCookieHeaders(headers: { [headerName: string]: St }) {  // [NOCOOKIES]
  const mainWin = getMainWin();

  // @ifdef DEBUG
  logD(`This window name: ${window.name} [TyM306WKTH2]`);
  logD(`This is the main window: ${window === mainWin}`);
  try {
    logD("Window.opener.typs: " +
        (window.opener && JSON.stringify((window.opener as DiscWin).typs)));
  }
  catch (ignored) {
    logD("Window.opener.typs: Threw exception. Opened from cross-origin window?");
  }
  logD(`Main win name: ${mainWin.name}`);
  logD(`Main win typs: ${JSON.stringify(mainWin.typs)}`);
  // @endif

  const typs: PageSession = mainWin.typs;
  const currentPageXsrfToken: St | U = typs.xsrfTokenIfNoCookies;
  const currentPageSid: St | U = typs.weakSessionId;
  const asPersona: WhichPersona | NU = mainWin.theStore && mainWin.theStore.me.usePersona;
  const curPersonaOptions: PersonaOptions | U =
          mainWin.theStore && mainWin.theStore.curPersonaOptions;
  const indicatedPersona: PersonaMode | U =
          mainWin.theStore && mainWin.theStore.indicatedPersona;

  if (!win_canUseCookies(mainWin)) {
    headers[AvoidCookiesHeaderName] = 'Avoid';
    // Not sure if can have been set to xsrf cookie value already? So skip if set.
    if (!headers[XsrfTokenHeaderName] && currentPageXsrfToken) {
      headers[XsrfTokenHeaderName] = currentPageXsrfToken;
    }
  }

  if (currentPageSid) {
    headers[SessionIdHeaderName] = currentPageSid;
  }

  // ----- Persona mode?

  // Any Persona Mode is included in each request, so a cookie would have been a good idea
  // — but cookies are often blocked, nowadays, if in an iframe (embedded comments).  So,
  // let's use a header instead.
  const personaHeaderVal: St | U =
        // If the user has choosen to use a persona, e.g. a pseudonym.
        asPersona ? persModeToHeaderVal('choosen', asPersona) : (
        // If the user is automatically anonymous, e.g. because of category settings,
        // or because they replied anonymously before on the same page.
        // For a server side safety check, so won't accidentally do sth as oneself.
        // [persona_indicator_chk]
        indicatedPersona ? persModeToHeaderVal(
              'indicated', indicatedPersona, curPersonaOptions.isAmbiguous) :
        // No alias in use.
        // Pat has not entered Anonymous or Self mode, and isn't anonymous by default.
        undefined);

  if (personaHeaderVal) {
    headers[PersonaHeaderName] = personaHeaderVal;
  }
}


/// Won't stringify any not-needed fields in `mode`.
/// Parsed by the server here: [parse_pers_mode_hdr].
///
/// Json in a header value is ok — all visible ascii chars are ok, see:
///   https://www.rfc-editor.org/rfc/rfc7230#section-3.2
///
function persModeToHeaderVal(field: 'choosen' | 'indicated', mode: WhichPersona | PersonaMode,
        ambiguous?: Bo): St {
  //D_DIE_IF(isVal(mode.anonStatus) && !_.isNumber(mode.anonStatus), 'TyEANONSTATUSNAN');
  const modeValue: WhichPersona =
          mode.self ? { self : true } : (
          mode.anonStatus ? { anonStatus: mode.anonStatus, lazyCreate: true } : (
          // [pseudonyms_later]
          'TyEUNKINDPERS' as any));
  const obj = {} as any;
  obj[field] = modeValue;
  if (ambiguous) obj.ambiguous = true;
  return JSON.stringify(obj as PersonaHeaderVal);
}


type PersonaHeaderVal =
      { choosen: PersonaHeaderValVal } |
      { indicated: PersonaHeaderValVal; ambiguous?: true };

type PersonaHeaderValVal =
      { self: true } |
      { anonStatus: AnonStatus, lazyCreate: true };


function appendE2eAndForbiddenPassword(url: string) {
  let newUrl = url;
  const e2eTestPassword = anyE2eTestPassword();
  const forbiddenPassword = anyForbiddenPassword();
  if (e2eTestPassword || forbiddenPassword) {
    if (newUrl.indexOf('?') === -1) newUrl += '?';
    if (e2eTestPassword) newUrl += '&e2eTestPassword=' + e2eTestPassword;
    if (forbiddenPassword) newUrl += '&forbiddenPassword=' + forbiddenPassword;
  }
  return newUrl;
}


let editorScriptsPromise: Promise<any>;
let moreScriptsPromise: Promise<any>;
let hasStartedLoading2dScripts = false;
let staffScriptsPromise: Promise<any>;
let jQueryPromise: Promise<any>;


// Won't call callback() until a bit later — so if you call React's setState(..), the
// state will have changed.
//
export function loadEditorAndMoreBundles(callback?) {
  setTimeout(function() {
    loadEditorAndMoreBundlesGetDeferred().then(callback || _.noop)
  }, 0);
}


export function loadMoreScriptsBundle(callback?: () => Vo): Promise<Vo> {
  if (debiki.internal._showCreateUserDialog && !moreScriptsPromise) {
    // This means more-bundle was included in a <script> tag,
    // because _showCreateUserDialog() is in more-bundle.
    // Don't load more-bundle again — seems that'd clear e.g. `let loginDialog`
    // in namespace debiki2.login,  so the handle to any already
    // open login dialog would disappear — we couldn't close it.
    moreScriptsPromise = Promise.resolve();
  }
  if (moreScriptsPromise) {
    // Never call callback() immediately, because it's easier to write caller source code,
    // if one knows that callback() will never be invoked immediately.
    if (callback) setTimeout(() => moreScriptsPromise.then(callback), 0);
    return moreScriptsPromise;
  }
  moreScriptsPromise = new Promise<Vo>(function(resolve, reject) {
    // Also: [7PLBF20]
    loadJs(eds.assetUrlPrefix + 'more-bundle.' + eds.minMaxJs, function() {
      resolve();
      !callback || setTimeout(callback, 0);
    }, function() {
      moreScriptsPromise = null;
      reject();
    });
  });
  return moreScriptsPromise;
}


/*
export function load2dScriptsBundleStart2dStuff() {  // [2D_LAYOUT]
  die("2D layout disabled [TyE2DDISABLED]");
  if (hasStartedLoading2dScripts) {
    return;
  }
  hasStartedLoading2dScripts = true;
  loadJQuery(() => {
    loadJs(eds.assetUrlPrefix + '2d-bundle.' + eds.minMaxJs, function() {
      debiki.internal.layoutThreads();
      debiki2.utils.onMouseDetected(d.i.makeColumnsResizable);
      // Wrap in function, because not available until funtion evaluated (because then script loaded).
      debiki.internal.initUtterscrollAndTips();
    }, function() {
      hasStartedLoading2dScripts = false;
    });
  });
} */


export function loadStaffScriptsBundle(callback): Promise<Vo> {
  if (debiki2.admin && !staffScriptsPromise) {
    // This means staff-bundle was included in a <script> tag.
    staffScriptsPromise = Promise.resolve();
  }
  if (staffScriptsPromise) {
    // Never call callback() immediately, because it's easier to write caller source code,
    // if one knows that callback() will never be invoked immediately.
    setTimeout(() => staffScriptsPromise.then(callback), 0);
    return staffScriptsPromise;
  }
  staffScriptsPromise = new Promise<Vo>(function(resolve, reject) {
    // The staff scripts bundle requires both more-bundle.js and editor-bundle.js (to render
    // previews of CommonMark comments [7PKEW24]). This'll load them both.
    loadEditorAndMoreBundles(() => {
      loadJs(eds.assetUrlPrefix + 'staff-bundle.' + eds.minMaxJs, function() {
        resolve();
        callback();  // setTimeout(..., 0) not needed — done by loadMoreScriptsBundle() already
      }, function() {
        staffScriptsPromise = null;
        reject();
      });
    });
  });
  return staffScriptsPromise;
}


export function loadEditorAndMoreBundlesGetDeferred(): Promise<Vo> {
  if (editorScriptsPromise)
    return editorScriptsPromise;

  // Now we'll load FileAPI, and according to the docs it needs to know where it
  // can find its implementation details files (Flash and Html5 stuff depending on
  // browser html5 support). However, works anyway, without any staticPath. Hmm.
  window['FileAPI'] = {
    staticPath: '/-/tfEF357cw/', // later: '/-/res/', — but first actually place the files here
    debug: eds.isDev,
  };

  // The editor scripts bundle requires more-bundle.js, and jquery-bundle (At.js,
  // for @mention dropdowns). Load everything in parallel. This stuff is also prefetched,
  // if supported by the browser, see: [7PLBF20].
  const editorLoaded = loadJs(eds.assetUrlPrefix + 'editor-bundle.' + eds.minMaxJs);
  const moreScriptsLoaded = loadMoreScriptsBundle();

  const timeoutHandle = showWaitForRequestOverlay(true);
  // But don't resolve the editorScriptsPromise until everything has been loaded.
  editorScriptsPromise = new Promise<Vo>(function(resolve, reject) {
    moreScriptsLoaded.then(function() {
      editorLoaded.then(function() {
        removeWaitForRequestOverlay(timeoutHandle);
        resolve();
      }).catch(reject);
    }).catch(reject);
  }).catch(function() {
    editorScriptsPromise = null;
  });
  return editorScriptsPromise;
}


/* jQuery was needed in the past, for horizontal scrolling in 2D layout, [2D_LAYOUT]
   now disabled though.
function loadJQuery(callback?) {
  if (jQueryPromise) {
    // Never call callback() immediately, because it's easier to write caller source code,
    // if one knows that callback() will never be invoked immediately.
    !callback || setTimeout(() => jQueryPromise.then(callback), 0);
    return jQueryPromise;
  }
  jQueryPromise = new Promise(function(resolve) {
    // Also: [7PLBF20]
    loadJs(eds.assetUrlPrefix + 'jquery-bundle.' + eds.minMaxJs, function() {
      resolve();
      !callback || setTimeout(callback, 0);
    });
  });
  return jQueryPromise;
} */


export function createSite(ps: { localHostname: St,
    anyEmbeddingSiteAddress: St, organizationName: St, makePublic: Bo,
    onOk: (nextUrl: St) => V }) {
  const params = new URLSearchParams(window.location.search);
  // The server will [remove_not_allowed_feature_flags].
  const featureFlags = params.get('featureFlags');
  const testSiteOkDelete = params.get('testSiteOkDelete') === 'true' ||
                            window.location.pathname === '/-/create-test-site';
  postJson('/-/create-site', {
    data: {
      acceptTermsAndPrivacy: true,
      localHostname: ps.localHostname,
      embeddingSiteAddress: ps.anyEmbeddingSiteAddress,
      organizationName: ps.organizationName,
      makePublic: ps.makePublic,
      featureFlags,
      testSiteOkDelete,
    },
    success: (response) => {
      ps.onOk(response.nextUrl);
    }
  });
}


export function loadAdminDashboard(onDone: (_: AdminDashboard) => void) {
  get('/-/load-dashboard', onDone);
}



interface LoadSettingsResult {
  effectiveSettings: Settings;
  defaultSettings: Settings;
  baseDomain: string,
  dnsCnameTargetHost: string,
  hosts: Host[];
}


export function loadSiteSettings(success: (s: LoadSettingsResult) => void) {
  get('/-/load-site-settings', success);
}


export function saveSiteSettings(settings: Settings, success: (s: LoadSettingsResult) => void) {
  postJsonSuccess('/-/save-site-settings', success, settings);
}


export function changeHostname(newHostname: string, success: () => void) {
  postJsonSuccess('/-/change-hostname', success, { newHostname: newHostname });
}


export function redirectExtraHostnames(success: () => void) {
  postJsonSuccess('/-/update-extra-hostnames', success, { redirect: true });
}


export function stopRedirectingExtraHostnames(success: () => void) {
  postJsonSuccess('/-/update-extra-hostnames', success, { redirect: false });
}



export function loadIdentityProviders(onOk: (
        idps: IdentityProviderSecretConf[]) => Vo) {
  get('/-/load-oidc-config', onOk);
}


export function upsertIdentityProvider(idps: IdentityProviderSecretConf[],
        onOk: () => Vo, onError: (message: St) => Vo) {
  postJsonSuccess('/-/upsert-oidc-config', onOk, idps);
}


export function genPasetoV2LocSecr(onOk: (secret: St) => Vo, onErr: (err: St) => Vo) {
  get('/-/gen-paseto-v2-loc-secr', function(resp: GenPasetoV2LocSecrResp) {
    onOk(resp.pasetoV2LocalSecret);
  }, onErr);
}


export function loadSpecialContent(rootPageId: string, contentId: string,
      doneCallback: (any) => void) {
  let url = '/-/load-special-content?rootPageId=' + (rootPageId ? rootPageId : '') +
      '&contentId=' + contentId;
  get(url, doneCallback);
}


export function saveSpecialContent(specialContent: SpecialContent, success: () => void) {
  const data: any = {
    rootPageId: specialContent.rootPageId,
    contentId: specialContent.contentId,
    useDefaultText: specialContent.anyCustomText === specialContent.defaultText
  };
  if (!data.useDefaultText) {
    data.anyCustomText = specialContent.anyCustomText;
  }
  postJsonSuccess('/-/save-special-content', success, data);
}


export function moderatePostOnPagePatchStore(pageId: PageId, post: Post,
          decision: ReviewDecision, onOk: (_: StorePatch) => V) {
  const data = {
    pageId,
    postId: post.uniqueId,
    postRevNr: post.currRevNr,
    decision,
  };
  postAndPatchStore('/-/moderate-from-page', onOk, data);
}


export function loadReviewTasks(filter: ReviewTaskFilter, onOk: (tasks: ReviewTask[]) => V) {
  const query = (!filter.patId ? '' : 'patId=' + filter.patId) +
                (!filter.onlyPending ? '' : '&onlyPending=true');
  get('/-/load-review-tasks?' + query, response => handleReviewTasksResponse(response, onOk));
}


export function makeReviewDecision(ps: { taskId: Nr, revisionNr: Nr, decision: ReviewDecision,
          filter: ReviewTaskFilter }, onOk: (tasks: ReviewTask[]) => V) {
  postJsonSuccess('/-/make-review-decision',
        response => handleReviewTasksResponse(response, onOk), ps);
}


export function undoReviewDecision(ps: { taskId: Nr, filter: ReviewTaskFilter },
        onOk: (tasks: ReviewTask[]) => V) {
  postJsonSuccess('/-/undo-review-decision',
        response => handleReviewTasksResponse(response, onOk), ps);
}


export function acceptAllUnreviewed(filter: ReviewTaskFilter, onOk: (tasks: ReviewTask[]) => V) {
  postJsonSuccess('/-/accept-all-unreviewed',
        resp => handleReviewTasksResponse(resp, onOk), { filter });
}


function handleReviewTasksResponse(response, success) {
  const counts = response.reviewTaskCounts;
  const myselfPatch: MyselfPatch = {
    numUrgentReviewTasks: counts.numUrgent,
    numOtherReviewTasks: counts.numOther,
  };
  ReactActions.patchTheStore({
    usersBrief: response.users,
    pageMetasBrief: response.pageMetasBrief,
    me: myselfPatch,
  });
  success(response.reviewTasks);
}


export function createOauthUser(data, onDone: (response) => void,
      error: (failedRequest: HttpRequest) => ErrorPolicy) {
  // ([5028KTDN306]: This immediately remembers any weakSessionId, no need to do again.)
  postJsonSuccess(
      '/-/login-oauth-create-user', makeUpdNoCookiesTempSessionIdFn(onDone), error, data);
}


export function createPasswordUser(data, onDone: (response) => void,
      error: (failedRequest: HttpRequest) => ErrorPolicy) {
  postJsonSuccess(
      '/-/login-password-create-user', makeUpdNoCookiesTempSessionIdFn(onDone), error, data);
}


export function sendResetPasswordEmail(user: UserInclDetails, onOk: () => void) {
  postJsonSuccess('/-/send-reset-password-email', onOk, { toUserId: user.id });
}


export function loginWithPassword(emailOrUsername: string, password: string, onDone: () => void,
      onDenied: () => void, onPasswordMissing: () => void) {
  function onError(xhr?: XMLHttpRequest) {
    if (xhr) {
      if (xhr.responseText.indexOf(BadNameOrPasswordErrorCode) >= 0) {
        onDenied();
        return IgnoreThisError;
      }
      if (xhr.responseText.indexOf(NoPasswordErrorCode) >= 0) {
        onPasswordMissing();
        return IgnoreThisError;
      }
    }
  }
  postJsonSuccess('/-/login-password', makeUpdNoCookiesTempSessionIdFn(onDone), onError, {
    email: emailOrUsername,
    password: password,
  });
}


export function loginAsGuest(name: string, email: string,
      onDone: (response: AuthnResponse) => void, onError: () => void) {
  postJsonSuccess('/-/login-guest', makeUpdNoCookiesTempSessionIdFn(onDone), onError, {
    name: name,
    email: email
  });
}


export function loginWithAuthnToken(authnToken: St | Ay,
        sessType: SessionType.AutoTokenSiteCustomSso, onOk: () => Vo) {
  const isToken = _.isString(authnToken);
  const updSessionVars = makeUpdNoCookiesTempSessionIdFn(onOk, sessType);
  postJsonSuccess('/-/v0/upsert-user-and-login', updSessionVars, {
    userAuthnToken: isToken ? authnToken : undefined,
    userDevTest: isToken ? undefined : authnToken,  // just for now, in dev/test
  }, function (xhr: XMLHttpRequest) {
    if (eds.isInIframe) {
      window.parent.postMessage(
            JSON.stringify(['authnErr', { prettyMethod: 'authn token' }]),
            eds.embeddingOrigin);
    }
  });
}


export function loginWithOneTimeSecret(oneTimeLoginSecret: string,
    onDone: (resp: { weakSessionId: St, xsrfTokenIfNoCookies: St }) => V) {
  get(`/-/v0/login-with-secret?oneTimeSecret=${oneTimeLoginSecret}`,
      makeUpdNoCookiesTempSessionIdFn(onDone));
}


/// Returns parts 1 and 2 of any current session id, maybe 3. (Parts 4 and 5 are HttpOnly
/// cookies, not accessible here.)
///
export function getCurSid12Maybe3(): St | N {  // [ts_authn_modl]
  const store: Store = debiki2.ReactStore.allData();
  const cookieName =
          !debiki2.store_isFeatFlagOn(store, 'ffUseOldSid') ? 'TyCoSid123' : 'dwCoSid';
  let sid = getSetCookie(cookieName);
  if (!sid) {
    // Cannot use store.me.mySidPart1 — we might not yet have loaded
    // the current user from the server; store.me might be stale.
    const typs: PageSession = getMainWin().typs;
    // This might not include part 3 (won't, if we're in an embedded comments
    // iframe, and didn't login or resume via a popup win directly against the
    // server so we could access cookie TyCoSid123, which includes part 3).
    sid = typs.weakSessionId;
  }
  return sid || null;
}


export function rememberTempSession(ps: { weakSessionId: St, xsrfTokenIfNoCookies: St }) {  // [ts_authn_modl]
  const onOk = function() {};
  makeUpdNoCookiesTempSessionIdFn(onOk)(ps);
}


function makeUpdNoCookiesTempSessionIdFn<R>(  // [ts_authn_modl]
          onDone: (response: R) => void, sessType?: SessionType.AutoTokenSiteCustomSso) {
  return function(response) {
    // Update the current page session id, so we'll remember the current session  [NOCOOKIES]
    // until the page closes / reloads — so we stay logged in (until page closes) also if
    // we avoid cookies. Update also if the new value is `undefined` — should forget
    // any old session.
    // If we're in a login popup window opened from an embedded comments iframe, then we
    // should set the session id in the main embedded window, that is, the one with all comments.
    const mainWin = getMainWin();
    const typs: PageSession = mainWin.typs;

    typs.weakSessionId = response.weakSessionId;

    if (response.xsrfTokenIfNoCookies)
      typs.xsrfTokenIfNoCookies = response.xsrfTokenIfNoCookies;

    typs.sessType = sessType;
    // We'll tell any other iframes that we logged in, via a 'justLoggedIn' message. [JLGDIN]
    if (onDone) {
      onDone(response);
    }
  };
}


export function deleteTempSessId() {  // [ts_authn_modl]
  // Need not delete store.me.mySidPart1 — we'll reload the page anyway. [is_logging_out]
  const mainWin = getMainWin();
  const typs: PageSession = mainWin.typs;
  delete typs.weakSessionId;
  delete typs.sessType;
  // (Need not delete:  typs.xsrfTokenIfNoCookies)
  try {
    // Can this throw?
    getSetCookie('dwCoSid', null);
    getSetCookie('TyCoSid123', null);
    // Later: getSetCookie('TyCoSid4', null) — when SameSite None, and 6 cookies in total.
  }
  catch (ex) {
    // Just in case.
    logW(`TyE603MSEL47`);
  }
}


export function logoutServerAndClientSide() {
  Server.clearQueryCache(); // [clear_q_cache]
  const currentUrlPath = location.pathname.toString();
  postJsonSuccess(`/-/logout?currentUrlPath=${currentUrlPath}`, (response) => {
    const goTo = response.goToUrl !== currentUrlPath ? response.goToUrl : '';
    ReactActions.logoutClientSideOnly({ goTo });
  }, null,
      /* onErr = */ ReactActions.logoutClientSideOnly);
}


export function makeImpersonateAtOtherSiteUrl(siteId: SiteId, userId: UserId): string {
  return '/-/impersonate-at-other-site?siteId=' + siteId + '&userId=' + userId;
}


export function impersonateGoToHomepage(userId: UserId) {
  postJsonSuccess('/-/impersonate?userId=' + userId, () => {
    location.assign('/');
    // Don't: location.reload() — apparently that cancels assign(/) above.
  }, null);
}


export function viewAsOther(userId: UserId, success: () => void) {
  postJsonSuccess(`/-/view-as-other?userId=${userId}`, success, null);
}


export function stopImpersonatingReloadPage() {
  postJsonSuccess('/-/stop-impersonating', () => {
    location.reload();
  }, null);
}


export function loadGroups(onDone: (_: Group[]) => void) {
  get('/-/load-groups', onDone);
}


export function inspectForum(onOk: (_: InspectForumResp) => V) {
  get('/-/inspect-forum', onOk);
}


export function createGroup(newGroup: Group, onDone: (newGroup: Group) => void) {
  postJsonSuccess('/-/create-group', onDone, newGroup);
}


export function deleteGroup(groupIdToDelete: UserId, onDone: (deletedGroup: Group) => void) {
  postJsonSuccess('/-/delete-group', onDone, { groupIdToDelete });
}


export function listGroupMembers(groupId: UserId, onDone: (_: Participant[]) => void) {
  get(`/-/list-group-members?groupId=${groupId}`, onDone);
}


export function addGroupMembers(groupId: UserId, memberIds: UserId[], onDone: () => void) {
  postJsonSuccess('/-/add-group-members', r => onDone(), { groupId, memberIds });
}


export function removeGroupMembers(groupId: UserId, memberIds: UserId[], onDone: () => void) {
  postJsonSuccess('/-/remove-group-members', r => onDone(), { groupId, memberIds });
}


// SMALLER_BUNDLE, a tiny bit smaller: Use getAndPatchStore() instead.  [.get_n_patch]
// BUG might get a Guest or Group, not always a UserInclDetails. SHOULD find for usages & fix.
// (Some callers, but not all, can deal with Group or Guest.)
export function loadPatVvbPatchStore(userIdOrUsername: UserId | St,
      onOk: (resp: LoadPatVvbResponse) => V) {
  get('/-/load-user-any-details?who=' + userIdOrUsername, function(resp: LoadPatVvbResponse) {
    ReactActions.patchTheStore({ tagTypes: resp.tagTypes });
    if (onOk) onOk(resp);
  }, undefined, { notFoundAs404: true });
}


export function listCompleteUsers(whichUsers, success: (users: UserInclDetailsWithStats[]) => void) {
  get(`/-/list-complete-users?whichUsers=${whichUsers}`, response => {
    success(response.users);
  });
}


type UserAcctRespHandler = (response: UserAccountResponse) => void;


export function loadEmailAddressesAndLoginMethods(userId: UserId, onOk: UserAcctRespHandler,
          onErr?: (resp: A) => V) {
  get(`/-/load-email-addrs-login-methods?userId=${userId}`, onOk, onErr);
}


export function resendOwnerEmailAddrVerifEmail(success) {
  postJsonSuccess('/-/resend-owner-email-addr-verif-email', success, {});
}


// Maybe initiated by staff, on behalf of another user — so could be any id and address.
//
export function resendEmailAddrVerifEmail(userId: UserId, emailAddress: string) {
  postJsonSuccess('/-/resend-email-addr-verif-email', (response: UserAccountResponse) => {
    morebundle.openDefaultStupidDialog({ body: "Email sent" });
  }, { userId, emailAddress });
}

export function addEmailAddresses(userId: UserId, emailAddress: St, onOk: UserAcctRespHandler,
        onErr: (resp: A) => V) {
  postJsonSuccess('/-/add-email-address', onOk, onErr, { userId, emailAddress });
}


export function removeEmailAddresses(userId: UserId, emailAddress: string,
      success: UserAcctRespHandler) {
 postJsonSuccess('/-/remove-email-address', success, { userId, emailAddress });
}


export function setPrimaryEmailAddresses(userId: UserId, emailAddress: string,
      success: UserAcctRespHandler) {
  postJsonSuccess('/-/set-primary-email-address', success, { userId, emailAddress });
}


export function sendInvites(
      requestBody: SendInvitesRequestBody,
      onDone: (response: SendInvitesResponse) => void,
      onError: (failedRequest: HttpRequest) => ErrorPolicy) {
  postJsonSuccess('/-/send-invites', onDone, onError, requestBody);
}


export function loadInvitesSentBy(userId: UserId, success: (invites: Invite[]) => void,
        error: (message: string) => void) {
  get('/-/load-invites?sentById=' + userId, response => {
    ReactActions.patchTheStore({ usersBrief: response.users });
    success(response.invites);
  }, error);
}


export function loadAllInvites(success: (invites: Invite[]) => void) {
  get('/-/load-all-invites', response => {
    ReactActions.patchTheStore({ usersBrief: response.users });
    success(response.invites);
  });
}


export function editMember(userId: UserId, doWhat: EditMemberAction, success: () => void) {
  postJsonSuccess('/-/edit-member', success, { userId: userId, doWhat: doWhat });
}


export function suspendUser(userId: UserId, numDays: Nr, reason: St, onOk: () => V,
        onErr: (resp: A) => V) {
  postJsonSuccess('/-/suspend-user', onOk, onErr, {
    userId: userId,
    numDays: numDays,
    reason: reason
  });
}


export function unsuspendUser(userId: UserId, success: () => void) {
  postJsonSuccess('/-/unsuspend-user', success, { userId: userId });
}


export function lockTrustLevel(userId: UserId, trustLevel: TrustLevel, success: () => void) {
  if (trustLevel) {
    postJsonSuccess('/-/lock-trust-level', () => {
      // ReactActions.patchTheStore();
      success();
    }, {
      userId: userId,
      trustLevel: trustLevel,
    });
  }
  else {
    postJsonSuccess('/-/unlock-trust-level', success, { userId: userId, });
  }
}


export function lockThreatLevel(userId: UserId, threatLevel: ThreatLevel, success: () => void) {
  if (threatLevel) {
    postJsonSuccess('/-/lock-threat-level', () => {
      // ReactActions.patchTheStore();
      success();
    }, {
      userId: userId,
      threatLevel: threatLevel,
    });
  }
  else {
    postJsonSuccess('/-/unlock-threat-level', success, { userId: userId, });
  }
}


export function savePageNotfPrefUpdStoreIfSelf(memberId: UserId, target: PageNotfPrefTarget,
      notfLevel: PageNotfLevel, onDone?: () => void) {
  const notfPref: PageNotfPref = { ...target, memberId, notfLevel };
  const postData: PageNotfPref & NewEmbCommentsPageIdCatUrl = notfPref;

  // If this is for an embedded comments page that hasn't yet been created, we should
  // also include any alt page id, and the embedding url. [4AMJX7]
  if (notfPref.pageId === EmptyPageId) {
    // COULD instead:
    // const serverVars = getMainWin().eds;   NO remove  MainWin.eds
    postData.discussionId = eds.embeddedPageAltId || undefined;  // undef not ''
    postData.embeddingUrl = eds.embeddingUrl || undefined;
    postData.lazyCreatePageInCatId = eds.lazyCreatePageInCatId;
  }

  postJsonSuccess('/-/save-content-notf-pref', (response: { newlyCreatedPageId }) => {
    let storePatch: StorePatch = {};

    if (response.newlyCreatedPageId) {
      // Update this, so subsequent server requests, will use the correct page id. [4HKW28]
      eds.embeddedPageId = response.newlyCreatedPageId;
      storePatch.newlyCreatedPageId = response.newlyCreatedPageId;
    }

    // If one saved one's own prefs (rather than if one is staff, and changed someone
    // else's prefs), then, update store.me to reflect the changes.
    const store: Store = ReactStore.allData();
    const me: Myself = store.me;
    if (memberId === me.id) {
      let pageData: MyPageData = me.myDataByPageId[target.pageId];
      if (!pageData && response.newlyCreatedPageId) {
        // Add page data for the new page, so it's there if we need to e.g. render a
        // notf pref button title (then, need to know our page notf level) [TyT305MHRTDP23].
        pageData = makeNoPageData();
        pageData.pageId = response.newlyCreatedPageId;
      }

      let newMe: Myself;
      if (pageData) {
        newMe = me_copyWithNewPageData(me, { ...pageData, myPageNotfPref: notfPref });
      }
      else {
        const updPrefs = pageNotfPrefs_copyWithUpdatedPref(me.myCatsTagsSiteNotfPrefs, notfPref);
        newMe = { ...me, myCatsTagsSiteNotfPrefs: updPrefs };
      }
      storePatch.me = newMe;
    }

    if (!_.isEmpty(storePatch)) {
      ReactActions.patchTheStore(storePatch);
    }

    if (onDone) {
      onDone();
    }
  }, postData);
}


/// If not logged in, e.g. the session just expired or got deleted, then, in the response,
/// `me` and `stuffForMe` in LoadMeResponse would be null.
///
export function loadMyself(onOkMaybe: (resp: FetchMeResponse) => Vo) {
  // @ifdef DEBUG
  const mainWin = getMainWin();
  const typs: PageSession = mainWin.typs;
  if (!typs.canUseCookies && !typs.weakSessionId) {
    console.error(`Cannot load myself: No cookies, no mainWin.typs.weakSessionId. ` +
        `This frame name: ${window.name}, ` +
        `main frame name: ${mainWin.name}, ` +
        `this is main frame: ${window === mainWin}, ` +
        `mainWin.typs: ${JSON.stringify(typs)} [TyE603FKNFD5]`);
    debugger;
  }
  else if (!typs.canUseCookies && !typs.xsrfTokenIfNoCookies) {
    console.error(`Cannot POST anything: No mainWin.typs.xsrfTokenIfNoCookies. ` +
        `(But there's a weakSessionId.)` +
        `This frame name: ${window.name}, ` +
        `main frame name: ${mainWin.name}, ` +
        `this is main frame: ${window === mainWin}, ` +
        `mainWin.typs: ${JSON.stringify(typs)} [TyE603FKNFD6]`);
    debugger;
  }
  // @endif

  // Need to load data for the discussions in all iframes, not only the iframe
  // we're in now. But not implemented server side.  [many_ifr_my_page_data]
  // Therefore, BUG: If many comments iframes, will *look* as if changing notf
  // level, has no effect. But in fact it works.
  let pageIds = getPageId();
  if (eds.isInEmbeddedCommentsIframe || eds.isInEmbForum) {
    try {
      const mainWin = getMainWin();
      if (mainWin.tydyn) {
        pageIds = mainWin.tydyn.allIframePageIds.join(',');
        // (Could ifdef-debug check that cur page id is included)
      }
    }
    catch (ex) {
      logW(`Error getting loadMyself() page id(s)`, ex);
    }
  }
  // SHOULD incl sort order & topic filter in the url params. [2KBLJ80]
  get(`/-/load-my-page-data?pageIds=${pageIds}`, onOkMaybe);
    // onErr(() => send 'failedToLogin' to parent frame)  [forget_sid12]
}


export function listSessions(patId: PatId, onOk: (resp: ListSessionsResponse) => V,
        onErr: () => V) {
  get(`/-/list-sessions?patId=${patId}`, onOk, onErr);
}


export function terminateSessions(
        ps: { forPatId: PatId, sessionsStartedAt?: WhenMs[], all?: true },
        onOk: (response: TerminateSessionsResponse) => V, onErr: () => V) {
  postJsonSuccess(`/-/terminate-sessions`, onOk, ps, onErr);
}


export function listDrafts(userId: UserId,
      onOk: (response: ListDraftsResponse) => void, onError: () => void) {
  get(`/-/list-drafts?userId=${userId}`, onOk, onError);
}


// [to_paginate]  upToWhen —> offset: { atMs, id }  ?
export function loadNotifications(userId: UserId, upToWhenMs: number,
      onOk: (notfs: Notification[]) => void, error: () => void) {
  const query = '?userId=' + userId + '&upToWhenMs=' + upToWhenMs;
  get('/-/load-notifications' + query, (resp: NotfSListResponse) => onOk(resp.notfs), error);
}


export function markNotfsRead() {
  postJsonSuccess('/-/mark-all-notfs-as-seen', (resp: NotfSListResponse) => {
    // Should be the same as [7KABR20], server side.
    const myselfPatch: MyselfPatch = {
      numTalkToMeNotfs: 0,
      numTalkToOthersNotfs: 0,
      numOtherNotfs: 0,
      thereAreMoreUnseenNotfs: false,
      notifications: resp.notfs,
    };
    ReactActions.patchTheStore({ me: myselfPatch });
  }, null, {});
}


export function markNotificationAsSeen(notfId: number, onDone?: () => void, onError?: () => void) {
  postJsonSuccess('/-/mark-notf-as-seen', onDone, onError, { notfId });
}


export function snoozeNotfs(untilMins: number | false, onDone?: () => void) {
  postJsonSuccess('/-/snooze-notfs', onDone, { untilMins });
}


/*  [missing_tags_feats]
export function setTagNotfLevel(tagLabel: TagLabel, newNotfLevel: PageNotfLevel) {
  postJsonSuccess('/-/set-tag-notf-level', () => {
    const store: Store = ReactStore.allData();
    const newLevels = _.clone(store.tagsStuff.myTagNotfLevels);
    newLevels[tagLabel] = newNotfLevel;
    ReactActions.patchTheStore({
      tagsStuff: { myTagNotfLevels: newLevels }
    });
  }, {
    tagLabel: tagLabel,
    notfLevel: newNotfLevel
  });
} */


export function saveAboutPatPrefs(prefs, isGroup: Bo, onOk: (_: PatVb) => Vo) {
  // CLEAN_UP merge into the same endpoint:  save-about-prefs
  const url = isGroup ? '/-/save-about-group-prefs' : '/-/save-about-member-prefs';
  postJsonSuccess(url, onOk, prefs);
}


export function savePatPerms(patId: PatId, perms: GroupPerms, onOk: () => Vo) {
  postJsonSuccess('/-/save-pat-perms', onOk, { patId, ...perms });
}


export function saveUiPrefs(memberId: UserId, prefs, onDone: () => void) {
  postJsonSuccess('/-/save-ui-prefs', onDone, { memberId, prefs });
}


export function loadCatsTagsSiteNotfPrefs(memberId: UserId,
      onDone: (response: PageNotfPrefsResponse) => void) {
  get(`/-/load-cats-tags-site-notf-prefs?memberId=${memberId}`, onDone);
}


export function saveMemberPrivacyPrefs(prefs, success: () => void) {
 postJsonSuccess(`/-/save-privacy-prefs`, success, prefs);
}


export function deleteUser(userId, success: (anonUsername: string) => void) {
  postJsonSuccess(`/-/delete-user`, success, { userId });
}


export function saveGuest(guest, success: () => void) {
  postJsonSuccess('/-/save-guest', success, guest);
}


export function blockGuest(postId: PostId, numDays: number, threatLevel: ThreatLevel,
      success: () => void) {
  postJsonSuccess('/-/block-guest', success, {
    postId: postId,
    numDays: numDays,
    threatLevel: threatLevel,
  });
}


export function unblockGuest(postId: number, success: () => void) {
  postJsonSuccess('/-/unblock-guest', success, { postId: postId });
}


export function loadAuthorBlockedInfo(postId: number, success: (response: Blocks) => void) {
  get('/-/load-author-blocks?postId=' + postId, success);
}


export function createForum(options: { title, folder, useCategories, createSupportCategory,
      createIdeasCategory, createSampleTopics, topicListStyle }, success: () => void) {
  postJsonSuccess('/-/create-forum', success, options);
}


export function listForums(onOk: (forums: Forum[]) => Vo) {
  get('/-/list-forums', resp => onOk(resp.forums));
}


export function createEmbCmtsSiteGoToInstrs() {
  postJsonSuccess('/-/create-embedded-comments-site',
    () => location.assign('/-/admin/settings/embedded-comments'), {});
}


export function loadForumCategoriesTopics(forumPageId: St, topicFilter: St,
      onOk: (categories: Cat[]) => Vo) {
  let url = '/-/list-categories-topics?forumId=' + forumPageId;
  // Would be nice to be able to change topic sort order too. [cats_topics_order]
  if (topicFilter) {
    url += '&filter=' + topicFilter;
  }
  get(url, r => onOk(r.catsWithTopics));
}


// Change the reply
// 'users' field to 'usersBrief', no, 'patsBr'? 'Tn = Tiny, Br = Brief, Vb = Verbose?  [.get_n_patch]
export function loadForumTopics(categoryId: CatId, orderOffset: OrderOffset,
      onOk: (resp: LoadTopicsResponse) => V) {
  const url = '/-/list-topics?categoryId=' + categoryId + '&' +
      ServerApi.makeForumTopicsQueryParams(orderOffset);
  return get(url, function(resp: LoadTopicsResponse) {
    // (Alternatively, the server could incl `listingCatId` in its response.)
    const patch: StorePatch = { ...resp.storePatch, listingCatId: categoryId };
    ReactActions.patchTheStore(patch);  // [2WKB04R]
    onOk(resp);
  });
}


export function loadTopicsByUser(userId: UserId, onOk: (topics: Topic[]) => void) {
  const url = `/-/list-topics-by-user?userId=${userId}`;
  getAndPatchStore(url, r => onOk(r.topics));
}


export function listAllUsernames(prefix: St, onOk: (usernames: BriefUser[]) => Vo) {
  const url = '/-/list-all-users?usernamePrefix='+ prefix;
  get(url, onOk);
}


export function listUsernames(prefix: St, pageId: PageId,
      onOk: (usernames: BriefUser[]) => Vo) {
  const url = `/-/list-usernames?pageId=${pageId}&prefix=${prefix}`;
  get(url, onOk);
}


// Currently doesn't load any draft.
// Later: add reply-to-post-unique-id, to load the correct draft?  [idnotnr]
//
export function loadDraftAndGuidelines(draftLocator: DraftLocator, writingWhat: WritingWhat,
      categoryId: number, pageRole: PageRole,
      success: (guidelinesSafeHtml: string | U, draft?: Draft) => void) {

  // For now, we don't save drafts for not-yet-lazy-created pages.
  // (Instead, such drafts currently stored in the browser only.)
  // And such pages tend to have no guidelines.
  if (pageRole === PageRole.EmbeddedComments && !draftLocator?.pageId) {
    success(undefined);
    return;
  }

  const loc = draftLocator;
  const draftTypeParam = '&draftType=' + loc.draftType;
  const pageIdParam = loc.pageId ? '&pageId=' + loc.pageId : '';
  const postNrParam = loc.postNr ? '&postNr=' + loc.postNr : '';
  const postIdParam = loc.postId ? '&postId=' + loc.postId : '';
  const toUserIdParam = loc.toUserId ? '&toUserId=' + loc.toUserId : '';
  const categoryParam = categoryId ? '&categoryId=' + categoryId : '';

  // We don't include any embedding url or discussion id — saving drafts
  // for pages that don't yet exist (lazy created embedded discussions)
  // hasn't been implemented.  [BLGCMNT1]

  const url = `/-/load-draft-and-guidelines?writingWhat=${writingWhat}&pageRole=${pageRole}` +
    draftTypeParam + pageIdParam + postNrParam + postIdParam + toUserIdParam + categoryParam;

  get(url, (response) => {
    success(response.guidelinesSafeHtml, response.drafts[0]); // for now, just pick the first
  });
}


// CLEAN_UP pass page id (instead of using getPageId() below), so simpler to understand
// if in emb emb editor and there're many discussions in different Ty iframes,
// different Ty page ids. [manyiframes_pageid]
export function loadDraftAndText(postNr: PostNr,
      onDone: (response: LoadDraftAndTextResponse) => void) {
  get(`/-/load-draft-and-text?pageId=${getPageId()}&postNr=${postNr}`, onDone, undefined, {
    // If takes a second to load the post text (because of high latency),
    // it's nice to see that one's Edit button click did cause something to happen
    // — and also, good to instantly disable everything (by adding this click
    // catching overlay), so the user won't continue clicking other buttons, e.g. Reply,
    // whilst this request is in flight.
    showLoadingOverlay: true,
  });
}


export function upsertDraft(draft: Draft, onOk: ((draftWithNr: Draft) => void) | UseBeacon,
      onError: ErrorStatusHandler | undefined) {
  postJsonSuccess('/-/upsert-draft', onOk, draft, function(xhr) {
    onError(xhr.status);
    return ShowNoErrorDialog;
  }, { showLoadingOverlay: false });
}


export function deleteDrafts(draftNrs: DraftNr[], onOk: (() => void) | UseBeacon,
        onError?: ErrorStatusHandler) {
  postJsonSuccess('/-/delete-drafts', onOk, draftNrs, function(xhr) {
    if (onError) onError(xhr.status);
    return ShowNoErrorDialog;
  }, { showLoadingOverlay: false });
}


const cachedLinkPreviewHtml: { [url: string]: LinkPreviewResp } = {};


export function fetchLinkPreview(url: St, inline: Bo, /* later: curPageId: PageId, */
        onOk: (resp: LinkPreviewResp | Nl) => Vo) {
  const curPageId = '123'; // whatever, for now
  // People often accidentally append spaces, so trim spaces.
  // But where's a good palce to trim spaces? The caller or here? Here, for now.
  url = url.trim();

  const cachedHtml = cachedLinkPreviewHtml[url];
  if (isDefined2(cachedHtml)) {
    setTimeout(() => onOk(cachedHtml), 0);
    return;
  }
  const encodedUrl = encodeURIComponent(url);
  get(`/-/fetch-link-preview?url=${encodedUrl}&curPageId=${curPageId}&inline=${inline}`,
        (resp: LinkPreviewResp) => {
    // Later: Return '' instead if no preview available? So won't be lots of
    // annoying 40X "failed" requests in the dev tools console.
    cachedLinkPreviewHtml[url] = resp;
    onOk(resp);
  }, function() {
    cachedLinkPreviewHtml[url] = null;
    // Pass null to tell the editor to show no link preview (and just show a plain link).
    onOk(null);
    // It'd be annoying if error dialogs popped up, whilst typing.
    return IgnoreThisError;
  });
}


export function saveVote(data: SaveVotePs, onDone: (storePatch: StorePatch) => V) {
  // Specify altPageId and embeddingUrl, so any embedded page can be created lazily. [4AMJX7]
  // @ifdef DEBUG
  dieIf(data.pageId && data.pageId !== EmptyPageId && data.pageId !== getPageId(), 'TyE2ABKSY7');
  // @endif
  const dataWithEmbeddingUrl = {
    ...data,
    pageId: getPageId() || undefined,
    discussionId: eds.embeddedPageAltId || undefined,  // undef not ''
    embeddingUrl: eds.embeddingUrl || undefined,
    lazyCreatePageInCatId: eds.lazyCreatePageInCatId,
  }
  postJsonSuccess('/-/vote', (storePatch: StorePatch) => {
    if (storePatch.newlyCreatedPageId) {
      // Update this, so subsequent server requests, will use the correct page id. [4HKW28]
      eds.embeddedPageId = storePatch.newlyCreatedPageId;
    }
    onDone(storePatch);
  }, dataWithEmbeddingUrl);
}


export function loadVoters(postId: PostId, voteType: PostVoteType,
      doneCallback: (numVoters: number, someVoters: BriefUser[]) => void) {
 get('/-/load-voters?postId='+ postId + '&voteType=' + voteType, (response: any) => {
   doneCallback(response.numVoters, response.someVoters);
 });
}


export function saveEdits(editorsPageId: PageId, postNr: PostNr, text: St,
      deleteDraftNr: DraftNr, doAsAnon: MaybeAnon, onOK: () => Vo,
      sendToWhichFrame?: MainWin) {
  postJson('/-/edit', {  // 4greping:  edit-post
    data: {
      pageId: editorsPageId ||
          // Old (as of Jan 2020), keep for a while?:
          getPageId(),
      postNr: postNr,
      text: text,
      deleteDraftNr,
      doAsAnon,
    },
    success: (editedPost) => {
      // This hides the editor and places back the orig post [6027TKWAPJ5]
      // — there'll be a short flash-of-original-version:
      onOK();
      // ... until here we upsert the edited version instead:
      ReactActions.handleEditResult(editedPost, sendToWhichFrame);
    }
  });
}


// RENAME to [alterPage].
// Alter = change in character or composition, typically in a small but significant way.
// Modify = make partial or minor changes.
// But "change" can mean replace. So "alter" is more clear.
// Also, SQL uses "alter tale ... alter column ... new datatype",
// so using "alter page" to change its type from e.q. Question to Idea,
// makes sense. (Note that in that example, page is altered, and the page type is changed.)
export function savePageTitleAndSettings(settings: EditPageRequestData,
      success: (response: EditPageResponse) => void, onError: () => void) {
  const data = {
    ...settings,
    pageId: getPageId(),
  };
  postJson('/-/edit-title-save-settings', {
    data: data,
    success: (response: EditPageResponse) => {
      success(response);
      if (response.newUrlPath && window.history.replaceState) {
        const newPath = response.newUrlPath + location.search + location.hash;
        window.history.replaceState({}, null, newPath);
      }
    },
    error: onError
  });
}


export function loadLatestPostRevisions(postId: PostId,
    success: (revisions: PostRevision[]) => void) {
  get('/-/load-post-revisions?postId=' + postId + '&revisionNr=LastRevision', success);
}


/** Loads revision revisionNr and some older revisions.
  */
export function loadMorePostRevisions(postId: PostId, revisionNr: number,
    success: (revisions: PostRevision[]) => void) {
  get('/-/load-post-revisions?postId=' + postId + '&revisionNr=' + revisionNr, success);
}


export function pinPage(pinWhere: PinPageWhere, pinOrder: number, success: () => void) {
  postJsonSuccess('/-/pin-page', success, {
    pageId: getPageId(),
    pinWhere: pinWhere,
    pinOrder: pinOrder,
  });
}


export function unpinPage(success: () => void) {
  postJsonSuccess('/-/unpin-page', success, { pageId: getPageId() });
}


export function saveReply(editorsPageId: PageId, postNrs: PostNr[], text: string,
      anyPostType: number, deleteDraftNr: DraftNr | undefined, doAsAnon: MaybeAnon,
      success: (storePatch: StorePatch) => void) {
  postJson('/-/reply', {  // 4greping:  insert-post  save-post  create-post
    data: {
      pageId: editorsPageId ||
          // Old (as of Jan 2020), keep for a while?:
          getPageId() || undefined,
      // Incl altPageId and embeddingUrl, so any embedded page can be created lazily. [4AMJX7]
      // Changed, in emb editor, if many comments iframes  [many_embcom_iframes]
      discussionId: eds.embeddedPageAltId || undefined,  // undef not ''
      embeddingUrl: eds.embeddingUrl || undefined,
      lazyCreatePageInCatId: eds.lazyCreatePageInCatId,
      postNrs: postNrs,
      postType: anyPostType || PostType.Normal,
      text: text,
      deleteDraftNr,
      doAsAnon,
    },
    success
  });
}


export function insertChatMessage(text: string, deleteDraftNr: DraftNr | undefined,
      success: (storePatch: StorePatch) => void) {
  postJson('/-/chat', {
    data: {
      pageId: getPageId(),
      text: text,
      deleteDraftNr,
    },
    success
  });
}


export function addUsersToPage(userIds: UserId[], success) {
  postAndPatchStore('/-/add-users-to-page', () => {
    success();
  }, { pageId: getPageId(), userIds: userIds });
}


export function removeUsersFromPage(userIds: UserId[], success) {
  postAndPatchStore('/-/remove-users-from-page', () => {
    success();
  }, { pageId: getPageId(), userIds: userIds });
}


export function joinPage(pageId?: PageId, onDone?) {
  if (_.isFunction(pageId)) {
    onDone = pageId;
  }
  postJsonSuccess('/-/join-page', (newWatchbar) => {
    if (newWatchbar) {
      ReactActions.setWatchbar(newWatchbar);
    }
    if (!pageId) {
      ReactActions.addMeAsPageMember();
    }
    // else: Will load users, when loading page.
    if (onDone) {
      onDone();
    }
  }, { pageId: pageId || getPageId() });
}


export function leavePage() {
  postJsonSuccess('/-/leave-page', (newWatchbar) => {
    if (newWatchbar) {
      ReactActions.setWatchbar(newWatchbar);
    }
    ReactActions.removeMeAsPageMember();
  }, { pageId: getPageId() });
}


export function configWatchbar(ps: { removePageIdFromRecent: PageId },
      onDone: (wb: Watchbar) => void) {
  postJsonSuccess('/-/config-watchbar', onDone, ps);
}


export function startPrivateGroupTalk(title: string, text: string, pageRole: PageRole,
    userIds: number[], deleteDraftNr: DraftNr, success: (pageId: PageId) => void) {
  postJsonSuccess('/-/start-private-group-talk', success,
      { title: title, text: text, pageRole: pageRole, userIds: userIds, deleteDraftNr });
}


export function submitCustomFormAsJsonReply(entries: object[], success?: () => void) {
  postJsonSuccess('/-/submit-custom-form-as-json-reply', success, {
    pageId: getPageId(),
    formInputs: entries,
  });
}


function getInputValueOrDie(inpName: string, formData: FormData): string {
  let concatenatedValues = null;
  const values: FormDataEntryValue[] = formData.getAll(inpName);
  for (let i = 0; i < values.length; ++i) {
    const valueUntrimmed = values[i];
    let value = valueUntrimmed.toString().trim();
    value = value.replace(/\\n/g, '\n');
    concatenatedValues = (concatenatedValues || '') + value;
  }
  dieIf(concatenatedValues === null, `Input missing: ${inpName} [EdE4WKFE02]`);
  return concatenatedValues.trim();
}


export function submitCustomFormAsNewTopic(formData: FormData) {
  die('untested [EdE2WKP05YU10]');
  function goToNewPage(response) {
    location.assign(linkToPageId(response.newPageId));
  }
  postJsonSuccess('/-/submit-custom-form-as-new-topic', goToNewPage, {
    newTopicTitle: getInputValueOrDie('title', formData),
    newTopicBody: getInputValueOrDie('body', formData),
    pageTypeId: getInputValueOrDie('pageTypeId', formData),
    categorySlug: getInputValueOrDie('categorySlug', formData),
  });
}


export function submitUsabilityTestingRequest(formData: FormData) {  // [plugin]
  const nextUrl = getInputValueOrDie('nextUrl', formData);
  function goToNewPage(response) {
    location.assign(nextUrl);
  }
  postJsonSuccess('/-/submit-usability-testing-form', goToNewPage, {
    websiteAddress: getInputValueOrDie('websiteAddress', formData),
    instructionsToTester: getInputValueOrDie('instructionsToTester', formData),
    pageTypeId: getInputValueOrDie('pageTypeId', formData),
    categorySlug: getInputValueOrDie('categorySlug', formData),
  });
}


// A bit similar to loading a range of posts? [load_page_and_parts]
export function loadPostByNr(postNr: PostNr, success: (patch: StorePatch) => void) {
  get(`/-/load-post?pageId=${getPageId()}&postNr=${postNr}`, success,
      (errorDetails: string, satus: number) => {
    let e2eTestClass: string;
    let message: string;
    if (errorDetails.indexOf('_TyEPOSTGONE_') >= 0) {
      // Post deleted, and it's ok to tell the requester about this.
      e2eTestClass = 'e_PDd';
      message = t.PostDeleted(postNr);
    }
    else if (errorDetails.indexOf('_TyEBADPOSTNR') >= 0) {
      // No post with that nr, and it's ok to tell the requester about this.
      e2eTestClass = 'e_BadPNr';
      message = t.NoSuchPost(postNr) + ' [TyEPOSTNR]';
    }
    else {
      // Show error dialog — don't return IgnoreThisError below.
      return;
    }

    // UX COULD remove any notf from theStore, so any blue MyMenu notf dot, disappears
    // directly. Because we can get to here, by clicking a MyMenu notf about a post
    // that was just deleted. — Doesn't matter much; such a notf will be gone anyway,
    // after page reload (filtered out here [SKIPDDNTFS]).

    morebundle.openDefaultStupidDialog({ body: message, dialogClassName: e2eTestClass });
    return IgnoreThisError;
  });
}


/// Can't `showWhat` be 'Posts' too?  That works fine currently anyway.  [or_load_bokms]
export function loadPostsByAuthor(authorId: UserId, showWhat: 'Tasks' | 'Bookmarks' | U,
          onlyOpen: Bo, onOk: (posts: PostWithPage[], bookmarks: Post[]) => V) {
  const showWhatParam =
          showWhat === 'Bookmarks' ? '&postType=' + PostType.Bookmark : (
            showWhat === 'Tasks' ? `&relType=${PatPostRelType.AssignedTo}` :
            '');
  const onlyOpenParam = onlyOpen ? '&which=678321' : '';  // for now.
  // RENAME 'authorId' to 'relToPatId'?
  const url = `/-/list-posts?authorId=${authorId}${showWhatParam}${onlyOpenParam}`
  // But don't want to cache recent activity for too long?! [cache_how_long]
  getAndPatchStore(url, (r: LoadPostsResponse) => onOk(r.posts, r.bookmarks),
        undefined, { canCache: true });
}


export function loadPostsWithTag(ps: { typeIdOrSlug: TagTypeId | St, orderBy?: St },
        onOk: (typeId: TagTypeId, posts: PostWithPage[]) => V) {
  const anyOrderBy = !ps.orderBy ? '' : `&orderBy=${ps.orderBy}`;
  const url = `/-/list-posts-with-tag?typeIdOrSlug=${ps.typeIdOrSlug}${anyOrderBy}`;
  getAndPatchStore(url, (r: LoadPostsWithTagResponse) => onOk(r.typeId, r.posts));
}


export function makeDownloadMyContentUrl(authorId: UserId): St {
  return `/-/download-my-content?authorId=${authorId}`;
}

export function makeDownloadPersonalDataUrl(authorId: UserId): St {
  return `/-/download-personal-data?userId=${authorId}`;
}


// SMALLER_BUNDLE, a tiny bit smaller: Use postAndPatchStore() instead.  [.get_n_patch]
export function changeAssignees(ps: { addPatIds?: PatId[], removePatIds?: PatId[],
          postId: PostId }, onOk?: () => Vo) {
  postJsonSuccess('/-/change-pat-node-rels', (storePatch: StorePatch) => {
    ReactActions.patchTheStore(storePatch);
    onOk && onOk();
  }, { ...ps, relType: PatPostRelType.AssignedTo });

}


export function flagPost(postNr: string, flagType: string, reason: string, success: () => void) {
  postJsonSuccess('/-/flag', (storePatch: StorePatch) => {
    ReactActions.patchTheStore(storePatch);
    if (success) success();
  }, {
    pageId: getPageId(),
    postNr: postNr,
    type: flagType,
    reason: reason
  });
}


export function hidePostInPage(postNr: number, hide: boolean, success: (postAfter: Post) => void) {
  postJsonSuccess('/-/hide-post', success, { pageId: getPageId(), postNr: postNr, hide: hide });
}


export function deletePostInPage(postNr: PostNr, repliesToo: Bo, doAsAnon: MaybeAnon | U,
      onOk: (deletedPost) => V) {
  postJsonSuccess('/-/delete-post', onOk, {
    pageId: getPageId(),
    postNr: postNr,
    repliesToo: repliesToo,
    doAsAnon,
  });
}


export function editPostSettings(postId: PostId, settings: PostSettings) {
  const data = _.assign({ postId: postId }, settings);
  postJsonSuccess('/-/edit-post-settings', ReactActions.patchTheStore, data);
}


export function upsertType(type: TagType, onOk: (type: TagType) => V, onErr?: () => V) {
  postAndPatchStore(`/-/upsert-type`, (r: StorePatch) => onOk(r.tagTypes[0]), type, onErr);
}


/// Lists tags, for auto complete, when tagging sth.
///
export function listTagTypes(forWhat: ThingType, prefix: St,
        onOk: (resp: { allTagTypes: TagType[] }) => Vo) {
  const forWhatParam = !forWhat ? '' : `forWhat=${forWhat}&`;
  const namePrefixParam = !prefix ? '' : `tagNamePrefix=${prefix}`;
  getAndPatchStore(`/-/list-tag-types?${forWhatParam + namePrefixParam}`, onOk);
}


/// For the tags app — so can show e.g. tag usage stats, per tag.
///
export function loadTagsAndStats(onOk?: () => Vo) {
  getAndPatchStore('/-/load-tags-and-stats', onOk);
}


/// For loading both tags and cats — so can selecet both tags and cats, on the
/// search page, to restrict where to search.
///
export function loadCatsAndTagsPatchStore(onOk?: () => Vo) {
  get('/-/load-cats-and-tags', r => ReactActions.patchTheStore(r, onOk));
}


/* Broken, after tags got reimplemented.
export function loadMyTagNotfLevels() {
  getAndPatchStore('/-/load-my-tag-notf-levels');
} */


export function updateTags(ps: { add?: Tag[], remove?: Tag[], edit?: Tag[] },
          onOk?: () => V) {
  postJsonSuccess('/-/update-tags', (response) => {
    ReactActions.patchTheStore(response);
    onOk && onOk();
  }, {
    tagsToAdd: ps.add || [],
    tagsToRemove: ps.remove || [],
    tagsToEdit: ps.edit || [],
  });
}


export function changePostType(postNr: number, newType: PostType, success: () => void) {
  postJsonSuccess('/-/change-post-type', success, {
    pageId: getPageId(),
    postNr: postNr,
    newType: newType,
  });
}


export function movePost(postId: PostId, newHost: SiteId, newPageId: PageId,
      newParentNr: PostNr, success: (post: Post) => void) {
  postJsonSuccess('/-/move-post', (patch: StorePatch) => {
    ReactActions.patchTheStore(patch);
    const post = _.values(patch.postsByPageId)[0][0];
    dieIf(!post, 'EsE7YKGW2');
    success(post);
  }, {
    pageId: getPageId(),
    postId: postId,
    newHost: newHost,
    newPageId: newPageId,
    newParentNr: newParentNr,
  });
}


export function saveCategory(category: CategoryPatch, permissions: PermsOnPage[],
      success: (response: SaveCategoryResponse) => void, error?: () => void) {
  const data = {
    category: category,
    permissions: permissions,
  };
  postJsonSuccess('/-/save-category', success, data, error);
}


export function deleteCategory(categoryId: number, success: (StorePatch: any) => void,
      error?: () => void) {
  postJsonSuccess('/-/delete-category', success, error, { categoryId: categoryId });
}


export function undeleteCategory(categoryId: number, success: (StorePatch: any) => void,
      error?: () => void) {
  postJsonSuccess('/-/undelete-category', success, error, { categoryId: categoryId });
}


export function loadCategory(id: number, success: (response: LoadCategoryResponse) => void) {
  get('/-/load-category?id=' + id, success);
}


export function listCategoriesAllSections(onOk: (cats: Cat[]) => Vo)  {
  get('/-/list-categories-all-sections', resp => onOk(resp.catsAllSects));
}


export interface CreatePageData {
  categoryId?: CatId
  pageRole: PageType
  pageStatus: 'Draft' | 'Published' | 'Deleted'
  folder?: St
  pageSlug?: St
  pageTitle: St
  pageBody: St
  showId?: Bo
  deleteDraftNr?: DraftNr,
  doAsAnon?: { sameAnonId?: PatId, newAnonStatus?: AnonStatus }
}

export function createPage(data: CreatePageData, onOk: (newPageId: St) => V) {
  // [DRAFTS_BUG] This doesn't delete the draft? (if any)
  postJsonSuccess('/-/create-page', (resp) => onOk(resp.newPageId), data);
}


export function loadPageIdsUrls(pageId: PageId | null,
      onDone: (response: LoadPageIdsUrlsResponse) => void) {
  const queryParams = pageId ? 'pageId=' + pageId : '';
  get(`/-/list-page-ids-urls?${queryParams}`, onDone);
}


export function savePageIdsUrls(data: PageIdsUrls, onDone: () => void) {
  postJsonSuccess('/-/save-page-ids-urls', onDone, data);
}


// [load_page_and_parts]
export function loadPageJson(path: string, success: (response) => void) {
  logM(`Loading page: ${path} [TyMLDPG]`);
  // The server renders pages differently, if they're for blog comments, or for an
  // embedded forum. Embedded forum links should be deep links into the forum
  // but relative the embedd*ing* website, e.g.  https://www.ex.co/forum#/-123/talkyard-page.
  // Also need to know how to generate links — that's  embPathParam  namely '#/'
  // in the example above.  [maybe_need_only_embPathParam]
  const embgUrl = !eds.embeddingUrl ? '' : '&embgUrl=' + encodeURIComponent(eds.embeddingUrl);
  const embHow = !eds.embHow ? '' : '&embHow=' + encodeURIComponent(eds.embHow);
  const embPathParam = !eds.embPathParam ? '' :
          '&embPathParam=' + encodeURIComponent(eds.embPathParam);
  get(path + '?json' + embgUrl + embHow + embPathParam, response => {
    logM(`Done loading ${path}, updating store...`);
    success(response);
    logM(`Done updating store.`);
  });
}


// [load_page_and_parts]
export function loadPagePartsJson(ps: {
    pageId: PageId,
    comtOrder: PostSortOrder, // not yet in use
    offset: PostNr,
    scrollDir: RangeDir,
    // So can remember scroll offset, before updating page.
    onOkBeforePatch: () => V,
    // So can update scroll offset after having added the new comments, so the same
    // comments stay in the same place after. And to update other state e.g. comment count.
    onOkAfterPatch: (s: Store) => V,
  }) {
  const params = `pageId=${ps.pageId}&comtOrder=${ps.comtOrder
                    }&offset=${ps.offset}&rangeDir=${ps.scrollDir}`;
  get('/-/load-many-posts?' + params, (patch: MorePostsStorePatch) => {
    ps.onOkBeforePatch();
    ReactActions.patchTheStore(patch);
    logM(`Done updating store.`);
    ps.onOkAfterPatch(debiki2.__patchedStore as Store);
  });
}


export function acceptAnswer(ps: { pageId: PageId, postId: PostId, doAsAnon: MaybeAnon },
        onOk: (answeredAtMs: Nr) => V) {
  postJsonSuccess('/-/accept-answer', onOk, ps);
}


export function unacceptAnswer(ps: { pageId: PageId, doAsAnon: MaybeAnon }, onOk: () => V) {
  postJsonSuccess('/-/unaccept-answer', onOk, ps);
}


export function togglePageClosed(ps: { pageId: PageId, doAsAnon: MaybeAnon },
        onOk: (closedAtMs: Nr) => V) {
  postJsonSuccess('/-/toggle-page-closed', onOk, ps);
}


export function deletePages(ps: { pageIds: PageId[], doAsAnon: MaybeAnon }, onOk: () => V) {
  postJsonSuccess('/-/delete-pages', onOk, ps);
}


export function undeletePages(ps: { pageIds: PageId[], doAsAnon: MaybeAnon }, onOk: () => V) {
  postJsonSuccess('/-/undelete-pages', onOk, ps);
}



const inFlightPageIds = new Set<PageId>();
let lastPageIdMarkedSeen: PageId;

// This updates the most recently visited pages in the watchbar (stored server side).
// And maybe more things, later, e.g. update user presence in a chat channel.
//
export function markCurrentPageAsSeen() {
  const pageId = getPageId();

  // You can show the annoying loading indicator by commenting in this:
  // (This was a bug, now e2e tested here:  TyT40PKDRT4)
  //postJsonSuccess(`/-/mark-as-seen?pageId=${pageId}`, () => {}, {});

  if (lastPageIdMarkedSeen === pageId || inFlightPageIds.has(pageId))
    return;

  inFlightPageIds.add(pageId);
  postJsonSuccess(`/-/mark-as-seen?pageId=${pageId}`, onComplete, onComplete, {},
      { showLoadingOverlay: false });

  function onComplete() {
    lastPageIdMarkedSeen = pageId;
    inFlightPageIds.delete(pageId);
  }
}


export function listWebhooks(onOk: (webhooks: Webhook[]) => Vo) {
  get('/-/list-webhooks', resp => onOk(resp.webhooks));
}


export function upsertWebhooks(webhooks: Webhook[], onOk: (webhooks: Webhook[]) => Vo) {
  postJsonSuccess('/-/upsert-webhooks', resp => onOk(resp.webhooks), { webhooks });
}


export function deleteWebhooks(webhooks: Webhook[], onOk: () => Vo) {
  postJsonSuccess('/-/delete-webhooks', onOk, { webhooks });
}


export function retryWebhook(webhookId: WebhookId, onOk: () => Vo) {
  postJsonSuccess('/-/retry-webhook', onOk, { webhookId });
}


export function listWebhookReqsOut(webhookId: WebhookId,
        onOk: (reqsOut: WebhookReqOut[]) => Vo) {
  get(`/-/list-webhook-reqs-out?webhookId=${webhookId}`, resp => onOk(resp.webhookReqsOut));
}


export function listApiSecrets(onOk: (secrets: ApiSecret[]) => void) {
  get('/-/list-api-secrets', onOk);
}


export function createApiSecret(onOk: (secret: ApiSecret) => void) {
  postJsonSuccess('/-/create-api-secret', onOk, {
    forAnyUser: true,
  });
}


export function deleteApiSecrets(secretNrs: ApiSecretNr[], onOk: () => void) {
  postJsonSuccess('/-/delete-api-secrets', onOk, { secretNrs });
}


export function search(ps: { rawQuery: St, offset?: Nr }, onOk: (results: SearchResults) => V,
        onErr?: () => V, opts?: { showLoadingOverlay?: false }) {
  postAndPatchStore('/-/search', onOk, ps, onErr, opts);
}


// COULD send via WebSocket instead [VIAWS].
// Uses navigator.sendBeacon if the `success` isn't specified.
export function trackReadingProgress(lastViewedPostNr: PostNr, secondsReading: number,
      postsRead: Post[], anyOnDone?: () => void) {
  if (anyMaintWork())
    return;

  const pageId = getPageId();
  if (pageId === EmptyPageId)
    return;

  const pagePostNrIdsRead: PagePostNrId[] = postsRead.map(post => {
    return { pageId, postNr: post.nr, postId: post.uniqueId }
  });

  let nowMsUtc = Date.now(); // now() returns UTC
  let data = {
    pageId,
    visitStartedAt: nowMsUtc,
    lastViewedPostNr: lastViewedPostNr,
    lastReadAt: secondsReading > 0 ? nowMsUtc : null,
    secondsReading: secondsReading,
    pagePostNrIdsRead,
  };
  const onDone = !anyOnDone? UseBeacon : function(me?: MyselfPatch) {
    // See [7KABR20] server side.
    if (me) {
      ReactActions.patchTheStore({ me });
    }
    anyOnDone();
  };
  postJsonSuccess('/-/track-reading', onDone, data,
        // Don't popup any error dialog from here. If there's a network error, we'll show a
        // "No internet" non-intrusive message instead [NOINETMSG].
        () => ShowNoErrorDialog, { showLoadingOverlay: false });
}


export function toggleTips(tips: { tipsId?: St, hide: Bo }) {
  postJsonSuccess('/-/toggle-tips', function() {}, tips,
        () => ShowNoErrorDialog, { showLoadingOverlay: false }); // [NOINETMSG]
}


/* Not in use, for now.  [0_load_onl_users]
export function loadOnlineUsers() {
   TESTS_MIS SING:  Verify server won't reply, if presence disabled.
  get('/-/load-online-users', (response) => {
    ReactActions.updateOnlineUsersLists(response.numOnlineStrangers, response.onlineUsers);
  });
} */


export function listSites() {
  get('/-/sa/list-sites', (patch) => {
    ReactActions.patchTheStore(patch);
  });
}


export function updateSites(sites: SASite[]) {
  postJsonSuccess('/-/sa/update-sites', (patch) => {
    ReactActions.patchTheStore(patch);
  }, sites);
}


export function reindexSites(siteIds: SiteId[]) {
  postJsonSuccess('/-/sa/reindex-sites', () => {
  }, { siteIdsToReIx: siteIds });
}


export function schedulePurge(ps: { purgeAfterDays: Nr, siteId: SiteId }) {
  postJsonSuccess('/-/sa/schedule-purge-sites', (patch) => {
    ReactActions.patchTheStore(patch);
  }, [ps]);
}


let pendingErrors = [];

export function logError(errorMessage: string) {
  pendingErrors.push(errorMessage);
  postPendingErrorsThrottled();
}


const postPendingErrorsThrottled = _.throttle(function() {
  if (!pendingErrors.length)
    return;
  postJsonSuccess('/-/log-browser-errors', () => {}, pendingErrors, null, { showLoadingOverlay: false });
  pendingErrors = [];
}, 5000);

// Will this work? Doesn't seem to work. Why not? Oh well.
window.addEventListener('unload', postPendingErrorsThrottled.flush);


export function anyMaintWork(): MaintWork | U {
  const volD: VolatileDataFromServer | U = eds.volatileDataFromServer;
  const maintWork: MaintWork | U = volD && volD.maintWork;
  return maintWork;
}


//------------------------------------------------------------------------------
// E2e test utils
//------------------------------------------------------------------------------

// For e2e tests: If a response or WebSocket message includes any of the strings
// in the `forbiddenWords` list, we'll pop up a server error dialog, which tends to break
// the current e2e test. And we'll remember the forbidden words across page reloads.
//
// (Included in prod builds, too. Makes the slim-bundle a tiny bit bigger, but doesn't
// otherwise affect performance.)
//
// Helpful when checking that names and user ids of anonymous comment authors
// aren't leaked. [deanon_risk]
//
let forbiddenWords: St[] | U;
let forbiddenWordsOkInPresence: Bo | U;
let shouldFindWords: St[] | U;
let shouldWordCounts: { [word: St]: Nr } = {};

// For each response with forbidden words, remembers the request url and the matching words.
// E.g.:  [["http://test--forum/-/get-sth", ["somename", "another matching name"]]].
// (If any found, there's a bug)
const forbiddenWordsFound: [St, St[]][] = [];

// Init from url params or session storage, so can look for forbidden words on page load
// in the page html and in json in <script> tags.
{
  // Check url:
  const params = new URLSearchParams(window.location.search);
  const wordsStr = params.get('e2eTestForbiddenWords');
  let words = wordsStr ? wordsStr.split(',') : [];
  // Are the words however ok in any user-online / -offline messages?
  let okInPresence = !!params.get('e2eTestForbiddenWordsOkInPresence');
  // We'll count all should-find-words, as one more way to know that the e2e tests
  // actually works — that we aren't just seeing empty blank pages, say.
  let shouldWordsStr = params.get('e2eTestShouldFindWords');
  let shouldFind = shouldWordsStr ? shouldWordsStr.split(',') : [];

  // Check session storage:
  if (!wordsStr) {
    const wordsArr = getFromSessionStorage('e2eTestSpecialWords');
    if (wordsArr) {
      words = wordsArr[0];
      okInPresence = wordsArr[1];
      shouldFind = wordsArr[2];
    }
  }

  if (words.length) {
    // Update worlds variables, before checkE2eTestForbiddenWords(). And session storage
    // too — let's keep checking for forbidden words, also if an e2e test reloads the page,
    // or loads a new page.
    setE2eTestForbiddenWords(words, okInPresence, shouldFind);

    const headHtmlInclOnline = document.head.innerHTML; // `outer...` doesn't work
    const headHtmlToCheck = !okInPresence ? headHtmlInclOnline :
            // Ignore usernames in the `usersOnline` list, if forbidden words are
            // in fact allowed in online presence info.  (There's presence info in
            // `theVolatileJson` and in 'presence' websocket messages.)
            // '*?' is non-greedy. There's no ']' in the users list, so '}]' marks
            // the end of the users online list. (If there *is* a ']', that can break
            // the tests — but not silently make them succeed.)
            // (Also in the e2e test utils. [remove_usersOnline])
            headHtmlInclOnline.replace(/"usersOnline":\[\{.*?\}\]/, ' usersOnl_ine_redacted ');
    const bodyHtml = document.body.outerHTML;
    const pageUrl = window.location.toString();
    const error = checkE2eTestForbiddenWords(pageUrl + ' <head>', headHtmlToCheck, true);
    if (!error) checkE2eTestForbiddenWords(pageUrl + ' <body>', bodyHtml, true);
  }
}

export function setE2eTestForbiddenWords(words: St[], okInPresence: Bo, count: St[]) {
  forbiddenWords = words;
  forbiddenWordsOkInPresence = okInPresence;
  shouldFindWords = count;
  shouldWordCounts = {};

  // Could move the rest to ty-e2e-test-browser.ts, barely matters. SMALLER_BUNDLE
  putInSessionStorage('e2eTestSpecialWords', [
        forbiddenWords, forbiddenWordsOkInPresence, shouldFindWords]);
  // Remove any old special words from the query params — they might be different
  // from the new words.
  var newUrl = location.pathname +
        location.search.replace(
            /(e2eTestForbiddenWords|e2eTestForbiddenWordsOkInPresence|e2eTestShouldFindWords)=[^&;]+[&;]?/g, '') +
        location.hash;
  history.pushState(null /* state */, '' /* unused */, newUrl);
}

export function getE2eTestForbiddenWords(): [St[], Bo | U, St[]] {
  return [forbiddenWords, forbiddenWordsOkInPresence, shouldFindWords];
}

export function getE2eTestWordCounts(): { forbidden: [St, St[]][], should: { [word: St]: Nr }} {
  // (Not important to clone this.)
  return { forbidden: forbiddenWordsFound, should: shouldWordCounts };
}

// Returns true if error.
export function checkE2eTestForbiddenWords(reqUrl: St, resp: St | any, loadingPage?: Bo): Bo | V {
  if (!resp || !forbiddenWords)
    return;

  if (reqUrl === 'WebSocket' && forbiddenWordsOkInPresence && resp.type === 'presence')
    return;

  const respTxt = _.isString(resp) ? resp : JSON.stringify(resp);

  for (let word of shouldFindWords) {
    const regex = new RegExp(`\\b${word}\\b`, 'g')
    const matches = respTxt.match(regex); // not lowercase
    const num = matches ? matches.length : 0;
    if (num) {
      shouldWordCounts[word] = (shouldWordCounts[word] || 0) + num;
    }
  }

  const respLower = respTxt.toLowerCase();
  const forbiddenMatches: St[] = [];

  for (let word of forbiddenWords) {
    // Caseless comparison — better match too much than too little, if any casing bug.
    if (respLower.indexOf(word.toLowerCase()) !== -1) {
      forbiddenMatches.push(word);
    }
  }

  if (forbiddenMatches.length) {
    const urlAndMatches: [St, St[]] = [reqUrl, forbiddenMatches];
    forbiddenWordsFound.push(urlAndMatches);

    const msg = `Unexpected words in response,  [TyEFORBWDS_]\n` +
                `   req url:  ${reqUrl}\n` +
                `     words:  ${JSON.stringify(forbiddenMatches)}\n`;
                `  start of response:\n` +
                `--------------------\n` +
                respTxt.substring(0, 300) +
                `\n--------------------`;

    if (loadingPage) {
      // Scripts not fully loaded — getServerErrorDialog() might not yet exist.
      setTimeout(showError);
      logE(msg);
      return true;
    }
    else {
      showError();
      throw Error(msg);
    }

    function showError() {
      pagedialogs.getServerErrorDialog().openForBrowserError(
            msg, { badBug: true, title: "Test error" });
    }
  }
}


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 list
