/*
 * Copyright (c) 2014-2017 Kaj Magnus Lindberg
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

const d: any = { i: debiki.internal };

const BadNameOrPasswordErrorCode = '_TyE403BPWD';
const NoPasswordErrorCode = '_TyMCHOOSEPWD';

function getPageId(): PageId {
  return eds.embeddedPageId || // [4HKW28]
      ReactStore.allData().currentPageId;
}

type ErrorStatusHandler = (errorStatusCode?: number) => void;

interface OngoingRequest {
  abort();
}

interface RequestData {
  data: any;
  success: (response: any) => void;
  error?: (xhr: XMLHttpRequest) => any;
  showLoadingOverlay?: boolean;
}


function postJson(urlPath: string, requestData: RequestData) {
  let url = appendE2eAndForbiddenPassword(origin() + urlPath);
  let timeoutHandle;
  if (requestData.showLoadingOverlay !== false) {
    showLoadingOverlay();
    timeoutHandle = setTimeout(function() {
      maybeShowServerJustStartedMessage();
      timeoutHandle = setTimeout(showErrorIfNotComplete, 21 * 1000);
    }, 9 * 1000);
  }

  function removeTimeoutAndOverlay() {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
    if (requestData.showLoadingOverlay !== false) {
      removeLoadingOverlay();
    }
  }

  Bliss.fetch(url, {
    method: 'POST',
    data: JSON.stringify(requestData.data),
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'X-Requested-With': 'XMLHttpRequest',
      'X-XSRF-TOKEN': getSetCookie('XSRF-TOKEN'),
    }
  }).then(xhr => {
    removeTimeoutAndOverlay();
    if (requestData.success) {
      // Remove any AngularJS safe json prefix. [5LKW02D4]
      let response = xhr.response.replace(/^\)]}',\n/, '');
      response = response ? JSON.parse(response) : null;
      requestData.success(response);
    }
  }).catch(errorObj => {
    removeTimeoutAndOverlay();
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
    console.error(`Error calling ${urlPath}: ${errorAsJson}, details: ${details}`);
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
  let xsrfTokenLine = getSetCookie('XSRF-TOKEN') + '\n';  // [7GKW20TD]
  let json = JSON.stringify(data);
  (<any> navigator).sendBeacon(url + '-text', xsrfTokenLine + json);
}


// If needed later:
// loadCss: use https://github.com/filamentgroup/loadCSS/blob/master/src/loadCSS.js

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
  // A bit hacky: e2e test site hostnames contain '-test-', and test sites people
  // create to try out the admin features, instead starts with 'test--' [5UKF03].
  // We don't want any global feedback widget scripts or whatever, to load for e2e tests
  // (because the tests would break, if they clicked those widgets) — so don't load any
  // script, for '-test-' hostnames (but do load, for 'test--' hostnames).
  if (location.hostname.search('-test-') >= 0) return;
  if (!globalStaffScriptLoaded && eds.loadGlobalStaffScript) {
    loadJs(eds.cdnOrServerOrigin + '/-/globalStaffScript.js');
    globalStaffScriptLoaded = true;
  }
}


let globalAdminTestScriptLoaded = false;

export function maybeLoadGlobalAdminTestScript() {
  if (location.hostname.search('-test-') >= 0) return;  // [5UKF03]
  if (!globalAdminTestScriptLoaded && eds.loadGlobalAdminTestScript) {
    loadJs(eds.cdnOrServerOrigin + '/-/globalAdminTestScript.js');
    globalAdminTestScriptLoaded = true;
  }
}


function showLoadingOverlay() {
  document.body.appendChild(
      $h.parseHtml('<div id="theLoadingOverlay"><div class="icon-loading"></div></div>')[0]);
}


function maybeShowServerJustStartedMessage() {
  const overlayElem = $byId('theLoadingOverlay');
  if (!overlayElem) return;
  const messageElem = $h.parseHtml('<div id="theServerJustStarted"></div>')[0];
  messageElem.textContent = "Sorry that this takes long. Perhaps the server was " +
      "just started, and is slow right now.";
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


/** Return Server.IgnoreThisError from error(..) to suppress a log message and error dialog.
  */
function postJsonSuccess(urlPath, onOk: ((response: any) => void) | UseBeacon, data: any,
        onError?, options?: { showLoadingOverlay?: boolean }) {
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
    error: onError,
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
}


function get(uri: string, successFn: GetSuccessFn, errorFn?: GetErrorFn, options?: GetOptions)
    : OngoingRequest {

  options = options || {};
  const headers = options.headers || {};

  headers['X-Requested-With'] = 'XMLHttpRequest';

  const promiseWithXhr = <any> Bliss.fetch(origin() + uri, {  // hack [7FKRPQ2T0]
    method: 'GET',
    headers: headers,
    timeout: options.timeout,
  });
  promiseWithXhr.then(xhr => {
    let response = xhr.response;
    if (options.dataType !== 'html') {
      // Then it's json, what else could it be? Remove any AngularJS safe json prefix. [5LKW02D4]
      response = xhr.response.replace(/^\)]}',\n/, '');
      response = JSON.parse(response);
    }
    successFn(response, xhr);
  }).catch(errorObj => {
    const errorAsJson = JSON.stringify(errorObj);
    const details: string = errorObj.xhr ? errorObj.xhr.responseText : errorObj.stack;
    console.error(`Error calling ${uri}: ${errorAsJson}, details: ${details}`);
    if (!options.suppressErrorDialog) {
      const errorDialog = pagedialogs.getServerErrorDialog();
      if (errorObj.xhr) {
        errorDialog.open(errorObj.xhr);
      }
      else {
        errorDialog.openForBrowserError(errorObj.stack || 'Unknown error [EdEUNK2]');
      }
    }
    if (errorFn) {
      errorFn(details, errorObj.status);
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


export function loadMoreScriptsBundle(callback?) {
  if (moreScriptsPromise) {
    // Never call callback() immediately, because it's easier to write caller source code,
    // if one knows that callback() will never be invoked immediately.
    !callback || setTimeout(() => moreScriptsPromise.then(callback), 0);
    return moreScriptsPromise;
  }
  moreScriptsPromise = new Promise(function(resolve, reject) {
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


export function load2dScriptsBundleStart2dStuff() {
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
}


export function loadStaffScriptsBundle(callback) {
  if (staffScriptsPromise) {
    // Never call callback() immediately, because it's easier to write caller source code,
    // if one knows that callback() will never be invoked immediately.
    setTimeout(() => staffScriptsPromise.then(callback), 0);
    return staffScriptsPromise;
  }
  staffScriptsPromise = new Promise(function(resolve, reject) {
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


export function loadEditorAndMoreBundlesGetDeferred(): Promise<void> {
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

  showLoadingOverlay();
  // But don't resolve the editorScriptsPromise until everything has been loaded.
  editorScriptsPromise = new Promise(function(resolve, reject) {
    moreScriptsLoaded.then(function() {
      editorLoaded.then(function() {
        removeLoadingOverlay();
        resolve();
      }).catch(reject);
    }).catch(reject);
  }).catch(function() {
    editorScriptsPromise = null;
  });
  return editorScriptsPromise;
}


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
}


export function createSite(localHostname: string,
    anyEmbeddingSiteAddress: string, organizationName: string,
    pricePlan: PricePlan, doneCallback: (string) => void) {
  const isTestSite = window.location.search.indexOf('testSiteOkDelete=true') !== -1 ||
    window.location.pathname === '/-/create-test-site';
  postJson('/-/create-site', {
    data: {
      acceptTermsAndPrivacy: true,
      localHostname: localHostname,
      embeddingSiteAddress: anyEmbeddingSiteAddress,
      organizationName: organizationName,
      testSiteOkDelete: isTestSite,
      pricePlan: pricePlan,
    },
    success: (response) => {
      doneCallback(response.nextUrl);
    }
  });
}


interface LoadSettingsResult {
  effectiveSettings: Settings;
  defaultSettings: Settings;
  baseDomain: string,
  cnameTargetHost: string,
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


export function loadReviewTasks(success: (tasks: ReviewTask[]) => void) {
  get('/-/load-review-tasks', response => handleReviewTasksResponse(response, success));
}


export function makeReviewDecision(taskId: number, revisionNr: number, decision: ReviewDecision,
      success: (tasks: ReviewTask[]) => void) {
  postJsonSuccess('/-/make-review-decision',
        response => handleReviewTasksResponse(response, success),
        { taskId, revisionNr, decision });
}


export function undoReviewDecision(taskId: number, success: (tasks: ReviewTask[]) => void) {
  postJsonSuccess('/-/undo-review-decision',
      response => handleReviewTasksResponse(response, success),
      { taskId });
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


export function createOauthUser(data, success: (response) => void,
      error: (failedRequest: HttpRequest) => ErrorPolicy) {
  postJsonSuccess('/-/login-oauth-create-user', success, error, data);
}


export function createPasswordUser(data, success: (response) => void,
      error: (failedRequest: HttpRequest) => ErrorPolicy) {
  postJsonSuccess('/-/login-password-create-user', success, error, data);
}


export function sendResetPasswordEmail(onOk: () => void) {
  postJsonSuccess('/-/send-reset-password-email', onOk, {});
}


export function loginWithPassword(emailOrUsername: string, password: string, success: () => void,
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
  postJsonSuccess('/-/login-password', success, onError, {
    email: emailOrUsername,
    password: password,
  });
}


export function loginAsGuest(name: string, email: string, onDone: () => void, onError: () => void) {
  postJsonSuccess('/-/login-guest', onDone, onError, {
    name: name,
    email: email
  });
}


export function logout(success: () => void) {
  const currentUrlPath = location.pathname.toString();
  postJsonSuccess(`/-/logout?currentUrlPath=${currentUrlPath}`, (response) => {
    if (response.goToUrl && response.goToUrl !== currentUrlPath) {
      location.assign(response.goToUrl);  // [9UMD24]
      // Stop here, otherwise success() below might do location.reload(), which apparently
      // cancels location.assign(..).
      return;
    }
    if (success) {
      success();
    }
  }, null);
}


export function makeImpersionateUserAtOtherSiteUrl(siteId: SiteId, userId: UserId,
      success: (url: string) => void) {
  const url = '/-/make-impersonate-other-site-url?siteId=' + siteId + '&userId=' + userId;
  postJsonSuccess(url, success, null);
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


export function loadGroups(success: (_: Group[]) => void) {
  get('/-/load-groups', response => {
    success(response);
  });
}


// BUG might get a Guest or Group, not always a MemberInclDetails. SHOULD find for usages & fix.
// (Some callers, but not all, can deal with Group or Guest.)
export function loadUserAnyDetails(userIdOrUsername: UserId | string,
      doneCallback: (user: MemberInclDetails, stats: UserStats) => void, error?: () => void) {
  get('/-/load-user-any-details?who=' + userIdOrUsername, (response) => {
    doneCallback(response.user, response.stats);
  }, error);
}


export function listCompleteUsers(whichUsers, success: (users: MemberInclDetailsWithStats[]) => void) {
  get(`/-/list-complete-users?whichUsers=${whichUsers}`, response => {
    success(response.users);
  });
}


type UserAcctRespHandler = (response: UserAccountResponse) => void;


export function loadEmailAddressesAndLoginMethods(userId: UserId, success: UserAcctRespHandler) {
  get(`/-/load-email-addrs-login-methods?userId=${userId}`, response => {
    success(response);
  });
}


export function resendOwnerEmailAddrVerifEmail(success) {
  postJsonSuccess('/-/resend-owner-email-addr-verif-email', success, {});
}


// Maybe initiated by staff, on behalf of another user — so could be any id and address.
//
export function resendEmailAddrVerifEmail(userId: UserId, emailAddress: string) {
  postJsonSuccess('/-/resend-email-addr-verif-email', (response: UserAccountResponse) => {
    util.openDefaultStupidDialog({ body: "Email sent" });  // why accessible here?
  }, { userId, emailAddress });
}

export function addEmailAddresses(userId: UserId, emailAddress: string, success: UserAcctRespHandler) {
  postJsonSuccess('/-/add-email-address', success, { userId, emailAddress });
}


export function removeEmailAddresses(userId: UserId, emailAddress: string,
      success: UserAcctRespHandler) {
 postJsonSuccess('/-/remove-email-address', success, { userId, emailAddress });
}


export function setPrimaryEmailAddresses(userId: UserId, emailAddress: string,
      success: UserAcctRespHandler) {
  postJsonSuccess('/-/set-primary-email-address', success, { userId, emailAddress });
}


export function sendInvite(toEmailAddress: string, success: (invite: Invite) => void,
      error: (failedRequest: HttpRequest) => ErrorPolicy) {
  postJsonSuccess('/-/send-invite', success, error, { toEmailAddress: toEmailAddress });
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


export function suspendUser(userId: UserId, numDays: number, reason: string, success: () => void) {
  postJsonSuccess('/-/suspend-user', success, {
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


export function savePageNoftLevel(newNotfLevel) {
  postJsonSuccess('/-/set-page-notf-level', () => {
    const store: Store = ReactStore.allData();
    const me: Myself = store.me;
    const myPageData: MyPageData = me.myCurrentPageData;
    myPageData.rolePageSettings = { notfLevel: newNotfLevel };  // [redux] modifying state in place
    ReactActions.patchTheStore({ me: me });
  }, {
    pageId: getPageId(),
    pageNotfLevel: newNotfLevel
  });
}


export function loadMyself(callback: (user: any) => void) {
  // SHOULD incl sort order & topic filter in the url params. [2KBLJ80]
  get(`/-/load-my-page-data?pageId=${getPageId()}`, callback);
}

export function listDrafts(userId: UserId,
      onOk: (response: ListDraftsResponse) => void, onError: () => void) {
  get(`/-/list-drafts?userId=${userId}`, onOk, onError);
}


export function loadNotifications(userId: UserId, upToWhenMs: number,
      success: (notfs: Notification[]) => void, error: () => void) {
  const query = '?userId=' + userId + '&upToWhenMs=' + upToWhenMs;
  get('/-/load-notifications' + query, success, error);
}


export function markNotfsRead() {
  postJsonSuccess('/-/mark-all-notfs-as-seen', (notfs) => {
    // Should be the same as [7KABR20], server side.
    const myselfPatch: MyselfPatch = {
      numTalkToMeNotfs: 0,
      numTalkToOthersNotfs: 0,
      numOtherNotfs: 0,
      thereAreMoreUnseenNotfs: false,
      notifications: notfs,
    };
    ReactActions.patchTheStore({ me: myselfPatch });
  }, null, {});
}


export function markNotificationAsSeen(notfId: number, onDone?: () => void, onError?: () => void) {
  postJsonSuccess('/-/mark-notf-as-seen', onDone, onError, { notfId });
}


export function setTagNotfLevel(tagLabel: TagLabel, newNotfLevel: NotfLevel) {
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
}


export function saveAboutUserPrefs(prefs, isGroup: boolean, success: () => void) {
  const what = isGroup ? 'group' : 'member';
  postJsonSuccess(`/-/save-about-${what}-prefs`, success, prefs);
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
      createIdeasCategory, createSampleTopics, topicListStyle }, success: (urlPath: string) => void) {
  postJsonSuccess('/-/create-forum', success, options);
}


export function listForums(success: (forums: Forum[]) => void) {
  get('/-/list-forums', success);
}


export function createEmbCmtsSiteGoToInstrs() {
  postJsonSuccess('/-/create-embedded-comments-site',
    () => location.assign('/-/admin/settings/embedded-comments'), {});
}


export function loadForumCategoriesTopics(forumPageId: string, topicFilter: string,
      success: (categories: Category[]) => void) {
  let url = '/-/list-categories-topics?forumId=' + forumPageId;
  if (topicFilter) {
    url += '&filter=' + topicFilter;
  }
  get(url, success);
}


export function loadForumTopics(categoryId: string, orderOffset: OrderOffset,
      doneCallback: (topics: Topic[]) => void) {
  const url = '/-/list-topics?categoryId=' + categoryId + '&' +
      ServerApi.makeForumTopicsQueryParams(orderOffset);
  get(url, (response: any) => {
    ReactActions.patchTheStore({ usersBrief: response.users });  // [2WKB04R]
    doneCallback(response.topics);
  });
}


export function loadTopicsByUser(userId: UserId,
        doneCallback: (topics: Topic[]) => void) {
  const url = `/-/list-topics-by-user?userId=${userId}`;
  get(url, (response: any) => {
    ReactActions.patchTheStore({ usersBrief: response.users });
    doneCallback(response.topics);
  });
}


export function listAllUsernames(prefix: string, doneCallback: (usernames: BriefUser) => void) {
  const url = '/-/list-all-users?usernamePrefix='+ prefix;
  get(url, doneCallback);
}


export function listUsernames(prefix: string, pageId: PageId, success: (usernames: BriefUser) => void) {
  let url = `/-/list-usernames?pageId=${pageId}&prefix=${prefix}`;
  get(url, success);
}


// Currently doesn't load any draft.
// Later: add reply-to-post-unique-id, to load the correct draft?  [idnotnr]
//
export function loadDraftAndGuidelines(draftLocator: DraftLocator, writingWhat: WritingWhat,
      categoryId: number, pageRole: PageRole,
      success: (guidelinesSafeHtml: string, draft?: Draft) => void) {

  const dloc = draftLocator;
  const draftTypeParam = '&draftType=' + dloc.draftType;
  const pageIdParam = dloc.pageId ? '&pageId=' + dloc.pageId : '';
  const postNrParam = dloc.postNr ? '&postNr=' + dloc.postNr : '';
  const toUserIdParam = dloc.toUserId ? '&toUserId=' + dloc.toUserId : '';
  const categoryParam = categoryId ? '&categoryId=' + categoryId : '';

  const url = `/-/load-draft-and-guidelines?writingWhat=${writingWhat}&pageRole=${pageRole}` +
    draftTypeParam + pageIdParam + postNrParam + toUserIdParam + categoryParam;

  get(url, (response) => {
    success(response.guidelinesSafeHtml, response.drafts[0]); // for now, just pick the first
  });
}


export function loadDraftAndText(postNr: PostNr, onDone: (response: LoadDraftAndTextResponse) => void) {
  get(`/-/load-draft-and-text?pageId=${getPageId()}&postNr=${postNr}`, onDone);
}


export function upsertDraft(draft: Draft, onOk: ((draftWithNr: Draft) => void) | UseBeacon,
      onError: ErrorStatusHandler | undefined) {
  postJsonSuccess('/-/upsert-draft', onOk, draft, function(xhr) {
    onError(xhr.status);
    return ShowNoErrorDialog;
  }, { showLoadingOverlay: false });
}


export function deleteDrafts(draftNrs: DraftNr[], onOk: (() => void) | UseBeacon,
        onError: ErrorStatusHandler | undefined) {
  postJsonSuccess('/-/delete-drafts', onOk, draftNrs, function(xhr) {
    onError(xhr.status);
    return ShowNoErrorDialog;
  }, { showLoadingOverlay: false });
}


const cachedOneboxHtml = {};

export function loadOneboxSafeHtml(url: string, success: (safeHtml: string) => void) {
  const cachedHtml = cachedOneboxHtml[url];
  if (cachedHtml) {
    setTimeout(() => success(cachedHtml), 0);
    return;
  }
  const encodedUrl = encodeURIComponent(url);
  get('/-/onebox?url=' + encodedUrl, (response: string) => {
    cachedOneboxHtml[url] = response;
    success(response);
  }, function() {
    // Pass null to tell the editor to show no onebox (it should show the link instead).
    success(null);
  }, {
    dataType: 'html',
    suppressErrorDialog: true,
  });
}


export function saveVote(data, success: (updatedPost) => void) {
  postJsonSuccess('/-/vote', success, data);
}


export function loadVoters(postId: PostId, voteType: PostVoteType,
      doneCallback: (numVoters: number, someVoters: BriefUser[]) => void) {
 get('/-/load-voters?postId='+ postId + '&voteType=' + voteType, (response: any) => {
   doneCallback(response.numVoters, response.someVoters);
 });
}


export function saveEdits(postNr: number, text: string, deleteDraftNr: DraftNr,
      doneCallback: () => void) {
  postJson('/-/edit', {
    data: {
      pageId: getPageId(),
      postNr: postNr,
      text: text,
      deleteDraftNr,
    },
    success: (editedPost) => {
      doneCallback();
      ReactActions.handleEditResult(editedPost);
    }
  });
}


export function savePageTitleAndSettings(newTitle: string, settings, success: (response: any) => void,
        error: () => void) {
  const data = {
    ...settings,
    pageId: getPageId(),
    newTitle: newTitle,
  };
  postJson('/-/edit-title-save-settings', {
    data: data,
    success: (response) => {
      success(response);
      if (response.newUrlPath && window.history.replaceState) {
        const newPath = response.newUrlPath + location.search + location.hash;
        window.history.replaceState({}, null, newPath);
      }
    },
    error: error
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


export function saveReply(postNrs: PostNr[], text: string, anyPostType: number,
      deleteDraftNr: DraftNr | undefined, success: () => void) {
  postJson('/-/reply', {
    data: {
      pageId: getPageId() || undefined,
      altPageId: eds.embeddedPageAltId || undefined,
      embeddingUrl: eds.embeddingUrl || undefined,
      postNrs: postNrs,
      postType: anyPostType || PostType.Normal,
      text: text,
      deleteDraftNr,
    },
    success: (response) => {
      d.i.handleReplyResult(response);
      success();
    }
  });
}


export function insertChatMessage(text: string, deleteDraftNr: DraftNr | undefined,
      success: () => void) {
  postJson('/-/chat', {
    data: {
      pageId: getPageId(),
      text: text,
      deleteDraftNr,
    },
    success: (response) => {
      d.i.handleReplyResult(response);
      success();
    }
  });
}


export function addUsersToPage(userIds: UserId[], success) {
  postJsonSuccess('/-/add-users-to-page', () => {
    // Send new store data in the reply? [5FKE0WY2]
    success();
  }, { pageId: getPageId(), userIds: userIds });
}


export function removeUsersFromPage(userIds: UserId[], success) {
  postJsonSuccess('/-/remove-users-from-page', () => {
    // Send new store data in the reply? [5FKE0WY2]
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


export function loadPostByNr(postNr: PostNr, success: (patch: StorePatch) => void) {
  get(`/-/load-post?pageId=${getPageId()}&postNr=${postNr}`, success);
}


export function loadPostsByAuthor(authorId: UserId, success: (response) => void) {
  get(`/-/list-posts?authorId=${authorId}`, success);
}


export function makeDownloadMyContentUrl(authorId: UserId) {
  return `/-/download-my-content?authorId=${authorId}`;
}

export function makeDownloadPersonalDataUrl(authorId: UserId) {
  return `/-/download-personal-data?userId=${authorId}`;
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


export function deletePostInPage(postNr: number, repliesToo: boolean,
      success: (deletedPost) => void) {
  postJsonSuccess('/-/delete-post', success, {
    pageId: getPageId(),
    postNr: postNr,
    repliesToo: repliesToo,
  });
}


export function editPostSettings(postId: PostId, settings: PostSettings) {
  const data = _.assign({ postId: postId }, settings);
  postJsonSuccess('/-/edit-post-settings', ReactActions.patchTheStore, data);
}


export function loadAllTags(success: (tags: string[]) => void) {
  get('/-/load-all-tags', success);
}


export function loadTagsAndStats() {
  get('/-/load-tags-and-stats', ReactActions.patchTheStore);
}


export function loadMyTagNotfLevels() {
  get('/-/load-my-tag-notf-levels', ReactActions.patchTheStore);
}


export function addRemovePostTags(postId: PostId, tags: string[], success: () => void) {
  postJsonSuccess('/-/add-remove-tags', (response) => {
    ReactActions.patchTheStore(response);
    success();
  }, {
    pageId: getPageId(),
    postId: postId,
    tags: tags
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


export function saveCategory(category: Category, permissions: PermsOnPage[],
      success: (response: any) => void, error?: () => void) {
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


export function listCategoriesAllSections(success: (response: Category[]) => void)  {
  get('/-/list-categories-all-sections', success);
}


export function createPage(data, success: (newPageId: string) => void) {
  postJson('/-/create-page', {
    data: data,
    success: (response) => {
      success(response.newPageId);
    }
  });
}


export function loadPageJson(path: string, success: (response) => void) {
  console.log(`Loading page: ${path} [TyMLDPG]`);
  get(path + '?json', response => {
    console.log(`Done loading ${path}, updating store...`);
    success(response);
    console.log(`Done updating store.`);
  });
}


export function acceptAnswer(postId: number, success: (answeredAtMs: number) => void) {
  postJsonSuccess('/-/accept-answer', success, { pageId: getPageId(), postId: postId });
}


export function unacceptAnswer(success: () => void) {
  postJsonSuccess('/-/unaccept-answer', success, { pageId: getPageId() });
}


export function cyclePageDone(success: (newPlannedAndDoneAt: any) => void) {
  postJsonSuccess('/-/cycle-page-done', success, { pageId: getPageId() });
}

export function togglePageClosed(success: (closedAtMs: number) => void) {
  postJsonSuccess('/-/toggle-page-closed', success, { pageId: getPageId() });
}

export function deletePages(pageIds: PageId[], success: () => void) {
  postJsonSuccess('/-/delete-pages', success, { pageIds: pageIds });
}

export function undeletePages(pageIds: PageId[], success: () => void) {
  postJsonSuccess('/-/undelete-pages', success, { pageIds: pageIds });
}


export function markCurrentPageAsSeen() {
  // COULD avoid showing the is-POSTing-data overlay.
  postJsonSuccess('/-/mark-as-seen?pageId=' + getPageId(), () => {}, {});
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


export function search(rawQuery: string, success: (results: SearchResults) => void) {
  postJsonSuccess('/-/search', success, { rawQuery: rawQuery });
}


// COULD perhaps merge with sendLongPollingRequest() a bit below? So reading activity is
// reported whenever a new long-polling-request is started?
// Uses navigator.sendBeacon if the `success` isn't specified.
export function trackReadingProgress(lastViewedPostNr: PostNr, secondsReading: number,
      postNrsRead: PostNr[], anyOnDone?: () => void) {
  if (getPageId() === EmptyPageId)
    return;

  let nowMsUtc = Date.now(); // now() returns UTC
  let data = {
    pageId: getPageId(),
    visitStartedAt: nowMsUtc,
    lastViewedPostNr: lastViewedPostNr,
    lastReadAt: secondsReading > 0 ? nowMsUtc : null,
    secondsReading: secondsReading,
    postNrsRead: postNrsRead,
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


interface OngoingRequestWithNr extends OngoingRequest {
  reqNr?: number;
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
export function testGetLongPollingNr() {
  return longPollingState.nextReqNr - 1;
}


/**
 * Built for talking with Nginx and nchan, see: https://github.com/slact/nchan#long-polling
 *
 * COULD use this instead?:  https://www.npmjs.com/package/nchan  it supports WebSocket.
 * this file:  https://github.com/slact/nchan.js/blob/master/NchanSubscriber.js
 *
 * COULD How avoid "nchan client prematurely closed connection" info message in the Nginx logs?
 * I asked: https://github.com/slact/nchan/issues/466
 */
export function sendLongPollingRequest(userId: UserId, successFn: (response) => void,
      errorFn: ErrorStatusHandler, resendIfNeeded: () => void) {

  if (longPollingState.ongoingRequest) {
    die(`Already long polling, request nr ${longPollingState.ongoingRequest.reqNr} [TyELPRDUPL]`);
  }

  // This is an easy-to-guess channel id, but in order to subscribe, the session cookie
  // must also be included in the request. So this should be safe.
  // The site id is included, because users at different sites can have the same id. [7YGK082]
  const channelId = eds.siteId + '-' + userId;

  // For debugging.
  const reqNr = longPollingState.nextReqNr;
  longPollingState.nextReqNr = reqNr + 1;

  console.debug(`Sending long polling request ${reqNr}, channel ${channelId} [TyMLPRSEND]`);

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
    };
  }

  let requestDone = false;

  // We incl the req nr in the URL, for debugging, so knows which lines in
  // chrome://net-internals/#events and in the Nginx logs are for which request in the browser.
  const pollUrl = `/-/pubsub/subscribe/${channelId}?reqNr=${reqNr}`;

  longPollingState.ongoingRequest =
      get(pollUrl, (response, xhr) => {
        console.debug(`Long polling request ${reqNr} response [TyMLPRRESP]: ${JSON.stringify(response)}`);
        longPollingState.ongoingRequest = null;
        longPollingState.lastModified = xhr.getResponseHeader('Last-Modified');
        // (In case evil proxy servers remove the Etag header from the response, there's
        // a workaround, see the Nchan docs:  nchan_subscriber_message_id_custom_etag_header)
        longPollingState.lastEtag = xhr.getResponseHeader('Etag');
        requestDone = true;
        successFn(response);
      }, (errorDetails, statusCode?: number) => {
        longPollingState.ongoingRequest = null;
        requestDone = true;
        if (statusCode === 408) {
          // Fine.
          console.debug(`Long polling request ${reqNr} done, status 408 Timeout [TyELPRTMT]`);
          resendIfNeeded();
        }
        else {
          console.warn(`Long polling request ${reqNr} error [TyELPRERR]`);
          errorFn(statusCode);
        }
      }, options);

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
    currentRequest.abort();
    // Unless a new request has been started, reset the state.
    if (currentRequest === longPollingState.ongoingRequest) {
      longPollingState.ongoingRequest = null;
    }
    resendIfNeeded();
  });
}


export function isLongPollingNow(): boolean {
  return !!longPollingState.ongoingRequest;
}


export function abortAnyLongPollingRequest() {
  if (longPollingState.ongoingRequest) {
    const reqNr = longPollingState.ongoingRequest.reqNr;
    console.debug(`Aborting long polling request ${reqNr} [TyMLPRABRT2]`);
    longPollingState.ongoingRequest.abort();
    longPollingState.ongoingRequest = null;
  }
}


export function loadOnlineUsers() {
  get('/-/load-online-users', (response) => {
    ReactActions.updateOnlineUsersLists(response.numOnlineStrangers, response.onlineUsers);
  });
}


export function listSites() {
  get('/-/list-sites', (patch) => {
    ReactActions.patchTheStore(patch);
  });
}


export function updateSites(sites: SASite[]) {
  postJsonSuccess('/-/update-sites', (patch) => {
    ReactActions.patchTheStore(patch);
  }, sites);
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


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 list
