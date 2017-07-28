/*
 * Copyright (C) 2014 Kaj Magnus Lindberg (born 1979)
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

/// <reference path="../typedefs/jquery/jquery.d.ts" />
/// <reference path="model.ts" />
/// <reference path="ServerApi.ts" />

// Ought to include, but then `debiki2.createComponent` gets placed too late —> JS breaks:
//xx <reference path="ReactActions.ts" />
//xx <reference path="page-dialogs/server-error-dialog.ts" />
// Not important to fix right now — everything works fine anyway.

//------------------------------------------------------------------------------
   namespace debiki2.Server {
//------------------------------------------------------------------------------

const d: any = { i: debiki.internal, u: debiki.v0.util };

// In embedded comments <iframes>, we cannot use relative paths.
const origin = d.i.serverOrigin;

const BadNameOrPasswordErrorCode = 'EsE403BPWD';


interface OngoingRequest {
  abort(message?: string);
}

interface RequestData {
  data: any;
  success: (response: any) => void;
  error?: (xhr: XMLHttpRequest) => any;
  showLoadingOverlay?: boolean;
}


function postJson(urlPath: string, requestData: RequestData) {
  let url = appendE2eAndForbiddenPassword(origin + urlPath);
  if (requestData.showLoadingOverlay !== false) {
    showLoadingOverlay();
  }

  let timeoutHandle = setTimeout(function() {
    showServerJustStartedMessage();
    timeoutHandle = setTimeout(showErrorIfNotComplete, 23 * 1000);
  }, 7 * 1000);

  function removeTimeoutAndOverlay() {
    clearTimeout(timeoutHandle);
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
    if (requestData.error && errorObj.xhr) {
      const perhapsIgnoreError = requestData.error(errorObj.xhr);
      if (perhapsIgnoreError === IgnoreThisError)
        return;
    }
    console.error(`Error calling ${urlPath}: ${errorAsJson}, details: ${details}`);
    if (errorObj.xhr) {
      pagedialogs.getServerErrorDialog().open(errorObj.xhr);
    }
    else {
      pagedialogs.getServerErrorDialog().openForBrowserError(
          errorObj.stack || 'Unknown error [EdEUNK1]');
    }
  });
}


function showLoadingOverlay() {
  document.body.appendChild(
      $h.parseHtml('<div id="theLoadingOverlay"><div class="icon-loading"></div></div>')[0]);
}


function showServerJustStartedMessage() {
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


/** Return Server.IgnoreThisError from error(..) to suppress a log message and error dialog. */
function postJsonSuccess(urlPath, success: (response: any) => void, data: any, error?,
        options?: { showLoadingOverlay?: boolean }) {
  // Make postJsonSuccess(..., error, data) work:
  if (!data || _.isFunction(data)) {
    const tmp = data;
    data = error;
    error = tmp;
  }
  options = options || {};
  postJson(urlPath, {
    data: data,
    success: success,
    error: error,
    showLoadingOverlay: options.showLoadingOverlay,
  });
}


function get(uri: string, options, success?: (response, xhr?: JQueryXHR) => void,
      error?: () => void): OngoingRequest {
  let dataType;
  let headers = {};
  if (_.isFunction(options)) {
    error = <any> success;
    success = <any> options;
    options = {};
  }
  else {
    if (!options) options = {};
    dataType = options.dataType;
    headers = options.headers || {};
  }
  headers['X-Requested-With'] = 'XMLHttpRequest';

  const promiseWithXhr = <any> Bliss.fetch(origin + uri, {  // hack [7FKRPQ2T0]
    method: 'GET',
    headers: headers,
    timeout: options.timeout,
  });
  promiseWithXhr.then(xhr => {
    let response = xhr.response;
    if (dataType !== 'html') {
      // Then it's json, what else could it be? Remove any AngularJS safe json prefix. [5LKW02D4]
      response = xhr.response.replace(/^\)]}',\n/, '');
      response = JSON.parse(response);
    }
    success(response, xhr);
  }).catch(errorObj => {
    const errorAsJson = JSON.stringify(errorObj);
    const details = errorObj.xhr ? errorObj.xhr.responseText : errorObj.stack;
    if (options.suppressErrorDialog) {
      console.log(`As expected, error calling ${uri}: ${errorAsJson}, details: ${details}`);
    }
    else {
      console.error(`Error calling ${uri}: ${errorAsJson}, details: ${details}`);
      if (errorObj.xhr) {
        pagedialogs.getServerErrorDialog().open(errorObj.xhr);
      }
      else {
        pagedialogs.getServerErrorDialog().openForBrowserError(
          errorObj.stack || 'Unknown error [EdEUNK2]');
      }
    }
    error && error();
  });

  return {
    abort: function() {
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
let staffScriptsPromise: Promise<any>;


// Won't call callback() until a bit later — so if you call React's setState(..), the
// state will have changed.
//
export function loadEditorAndMoreBundles(callback?) {
  setTimeout(function() {
    loadEditorAndMoreBundlesGetDeferred().then(callback || _.noop)
  }, 0);
}


export function loadMoreScriptsBundle(callback) {
  if (moreScriptsPromise) {
    // Never call callback() immediately, because it's easier to write caller source code,
    // if one knows that callback() will never be invoked immediately.
    setTimeout(() => moreScriptsPromise.then(callback), 0);
    return;
  }
  moreScriptsPromise = new Promise(function(resolve) {
    window['yepnope']({
      both: [d.i.assetUrlPrefix + 'more-bundle.' + d.i.minMaxJs],
      complete: () => {
        resolve();
        setTimeout(callback, 0);
      }
    });
  });
  return moreScriptsPromise;
}


export function loadStaffScriptsBundle(callback) {
  if (staffScriptsPromise) {
    // Never call callback() immediately, because it's easier to write caller source code,
    // if one knows that callback() will never be invoked immediately.
    setTimeout(() => staffScriptsPromise.then(callback), 0);
    return;
  }
  staffScriptsPromise = new Promise(function(resolve) {
    // The staff scripts bundle requires both more-bundle.js and editor-bundle.js (to render
    // previews of CommonMark comments [7PKEW24]). This'll load them both.
    loadEditorAndMoreBundles(() => {
      window['yepnope']({
        both: [d.i.assetUrlPrefix + 'staff-bundle.' + d.i.minMaxJs],
        complete: () => {
          resolve();
          callback();  // setTimeout(..., 0) not needed — done by loadMoreScriptsBundle() already
        }
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
    debug: debiki.isDev,
  };

  editorScriptsPromise = new Promise(function(resolve) {
    // The editor scripts bundle requires more-bundle.js.
    loadMoreScriptsBundle(() => {
      window['yepnope']({
        both: [d.i.assetUrlPrefix + 'editor-bundle.' + d.i.minMaxJs],
        complete: () => {
          resolve();
        }
      });
    });
  });
  return editorScriptsPromise;
}


export function createSite(emailAddress: string, localHostname: string,
    anyEmbeddingSiteAddress: string, organizationName: string,
    pricePlan: PricePlan, doneCallback: (string) => void) {
  const isTestSite = window.location.search.indexOf('testSiteOkDelete=true') !== -1 ||
    window.location.pathname === '/-/create-test-site';
  postJson('/-/create-site', {
    data: {
      acceptTermsAndPrivacy: true,
      emailAddress: emailAddress,
      localHostname: localHostname,
      embeddingSiteAddress: anyEmbeddingSiteAddress,
      organizationName: organizationName,
      testSiteOkDelete: isTestSite,
      pricePlan: pricePlan,
    },
    success: (response) => {
      doneCallback(response.newSiteOrigin);
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
  get('/-/load-site-settings', {}, success);
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
  get('/-/load-review-tasks', success);
}


export function completeReviewTask(id: number, revisionNr: number, action: ReviewAction,
      success: () => void) {
  postJsonSuccess('/-/complete-review-task', success, {
    taskId: id,
    revisionNr: revisionNr,
    action: action,
  });
}


export function createOauthUser(data, success: (response) => void,
      error: (failedRequest: HttpRequest) => ErrorPolicy) {
  postJsonSuccess('/-/login-oauth-create-user', success, error, data);
}


export function createPasswordUser(data, success: (response) => void,
      error: (failedRequest: HttpRequest) => ErrorPolicy) {
  postJsonSuccess('/-/login-password-create-user', success, error, data);
}


export function loginWithPassword(emailOrUsername: string, password: string, success: () => void,
    denied: () => void) {
  function onError(xhr?: XMLHttpRequest) {
    if (xhr && xhr.responseText.indexOf(BadNameOrPasswordErrorCode) >= 0) {
      denied();
      return IgnoreThisError;
    }
  }
  postJsonSuccess('/-/login-password', success, onError, {
    email: emailOrUsername,
    password: password,
  });
}


export function loginAsGuest(name: string, email: string, success?: () => void) {
  postJsonSuccess('/-/login-guest', success, {
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


export function listCompleteUsers(whichUsers, success: (users: MemberInclDetails[]) => void) {
  get('/-/list-complete-users?whichUsers=' + whichUsers, response => {
    success(response.users);
  });
}


export function sendAddressVerifEmailAgain(success) {
  postJsonSuccess('/-/send-addr-verif-email-again', success, {});
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


export function setIsAdminOrModerator(userId: UserId, doWhat: string, success: () => void) {
  postJsonSuccess('/-/set-is-admin-or-moderator', success, { userId: userId, doWhat: doWhat });
}


export function approveRejectUser(user: MemberInclDetails, doWhat: string, success: () => void) {
  postJsonSuccess( '/-/approve-reject-user', success, {
    userId: user.id,
    doWhat: doWhat
  });
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
    const me: Myself = ReactStore.allData().me;
    me.rolePageSettings = { notfLevel: newNotfLevel };  // [redux] modifying state in place
    ReactActions.patchTheStore({ me: me });
  }, {
    pageId: d.i.pageId,
    pageNotfLevel: newNotfLevel
  });
}


export function loadMyself(callback: (user: any) => void) {
  get(`/-/load-my-page-data?pageId=${debiki2.ReactStore.getPageId()}`, callback);
}


export function loadNotifications(userId: UserId, upToWhenMs: number,
      success: (notfs: Notification[]) => void, error: () => void) {
  const query = '?userId=' + userId + '&upToWhenMs=' + upToWhenMs;
  get('/-/load-notifications' + query, success, error);
}


export function markNotificationAsSeen(notfId: number, success?: () => void, error?: () => void) {
  postJsonSuccess('/-/mark-notf-as-seen', success, error, { notfId: notfId });
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


export function saveUserPreferences(prefs, isGroup: boolean, success: () => void) {
  const what = isGroup ? 'group' : 'member';
  postJsonSuccess(`/-/save-${what}-preferences`, success, prefs);
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


export function createForum(title: string, folder: string, success: (urlPath: string) => void) {
  postJsonSuccess('/-/create-forum', success, {
    title: title,
    folder: folder,
  });
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
    ReactActions.patchTheStore({ usersBrief: response.users });
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


export function listUsernames(prefix: string, success: (usernames: BriefUser) => void) {
  let url = `/-/list-usernames?pageId=${d.i.pageId}&prefix=${prefix}`;
  get(url, success);
}


// Currently doesn't load any draft.
// Later: add reply-to-post-unique-id, to load the correct draft?
//
export function loadDraftAndGuidelines(writingWhat: WritingWhat, categoryId: number,
      pageRole: PageRole, success: (guidelinesSafeHtml: string) => void) {
  if (!categoryId && pageRole !== PageRole.FormalMessage) {
    // For now just cancel. There's no draft to load, and there're no guidelines, since
    // we got no category id.
    success(null);
    return;
  }
  const categoryParam = categoryId ? '&categoryId=' + categoryId : '';
  get('/-/load-draft-and-guidelines?writingWhat=' + writingWhat + categoryParam +
       '&pageRole=' + pageRole, (response) => {
    success(response.guidelinesSafeHtml);
  });
}


export function loadCurrentPostText(postNr: PostNr,
      doneCallback: (text: string, postUid: number, revisionNr: number) => void) {
  get('/-/edit?pageId='+ d.i.pageId + '&postNr='+ postNr, (response: any) => {
    // COULD also load info about whether the user may apply and approve the edits.
    doneCallback(response.currentText, response.postUid, response.currentRevisionNr);
  });
}


const cachedOneboxHtml = {};

export function loadOneboxSafeHtml(url: string, success: (safeHtml: string) => void) {
  const cachedHtml = cachedOneboxHtml[url];
  if (cachedHtml) {
    setTimeout(() => success(cachedHtml), 0);
    return;
  }
  const encodedUrl = encodeURIComponent(url);
  get('/-/onebox?url=' + encodedUrl, { dataType: 'html' }, (response: string) => {
    cachedOneboxHtml[url] = response;
    success(response);
  }, function() {
    // Pass null to tell the editor to show no onebox (it should show the link instead).
    success(null);
  });
}


export function saveVote(data, success: (updatedPost) => void) {
  postJsonSuccess('/-/vote', success, data);
}


export function loadVoters(postId: PostId,
      doneCallback: (numVoters: number, someVoters: BriefUser[]) => void) {
 get('/-/load-voters?postId='+ postId + '&voteType=' + PostVoteType.Like, (response: any) => {
   doneCallback(response.numVoters, response.someVoters);
 });
}


export function saveEdits(postNr: number, text: string, doneCallback: () => void) {
  postJson('/-/edit', {
    data: {
      pageId: d.i.pageId,
      postNr: postNr,
      text: text
    },
    success: (editedPost) => {
      doneCallback();
      ReactActions.handleEditResult(editedPost);
    }
  });
}


export function savePageTitleAndSettings(newTitle: string, settings, success: (response: any) => void,
        error: () => void) {
  const data = { ...settings, pageId: d.i.pageId, newTitle: newTitle };
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
    pageId: d.i.pageId,
    pinWhere: pinWhere,
    pinOrder: pinOrder,
  });
}


export function unpinPage(success: () => void) {
  postJsonSuccess('/-/unpin-page', success, { pageId: d.i.pageId });
}


export function saveReply(postNrs: PostNr[], text: string, anyPostType: number,
    success: () => void) {
  postJson('/-/reply', {
    data: {
      pageId: d.i.pageId,
      pageUrl: d.i.iframeBaseUrl || undefined,
      postNrs: postNrs,
      postType: anyPostType || PostType.Normal,
      text: text
    },
    success: (response) => {
      d.i.handleReplyResult(response);
      success();
    }
  });
}


export function insertChatMessage(text: string, success: () => void) {
  postJson('/-/chat', {
    data: {
      pageId: d.i.pageId,
      text: text
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
  }, { pageId: d.i.pageId, userIds: userIds });
}


export function removeUsersFromPage(userIds: UserId[], success) {
  postJsonSuccess('/-/remove-users-from-page', () => {
    // Send new store data in the reply? [5FKE0WY2]
    success();
  }, { pageId: d.i.pageId, userIds: userIds });
}


export function joinChatChannel() {
  postJsonSuccess('/-/join-page', (newWatchbar) => {
    if (newWatchbar) {
      ReactActions.setWatchbar(newWatchbar);
    }
    ReactActions.addMeAsPageMember();
  }, { pageId: d.i.pageId });
}


export function leaveChatChannel() {
  postJsonSuccess('/-/leave-page', (newWatchbar) => {
    if (newWatchbar) {
      ReactActions.setWatchbar(newWatchbar);
    }
    ReactActions.removeMeAsPageMember();
  }, { pageId: d.i.pageId });
}


export function startPrivateGroupTalk(title: string, text: string, pageRole: PageRole,
    userIds: number[], success: (pageId: PageId) => void) {
  postJsonSuccess('/-/start-private-group-talk', success,
      { title: title, text: text, pageRole: pageRole, userIds: userIds });
}


export function submitCustomFormAsJsonReply(formData: FormData, success?: () => void) {
  die('unimpl [EdE2WKUGAA]'); /*
  postJsonSuccess('/-/submit-custom-form-as-json-reply', success, {
    pageId: d.i.pageId,
    formInputs: formInputNameValues,
  }); */
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


export function loadPostByNr(pageId: PageId, postNr: PostNr, success: (patch: StorePatch) => void) {
  get(`/-/load-post?pageId=${pageId}&postNr=${postNr}`, success);
}


export function loadPostsByAuthor(authorId: UserId, success: (response) => void) {
  get(`/-/list-posts?authorId=${authorId}`, success);
}


export function flagPost(postNr: string, flagType: string, reason: string, success: () => void) {
  postJsonSuccess('/-/flag', (storePatch: StorePatch) => {
    ReactActions.patchTheStore(storePatch);
    if (success) success();
  }, {
    pageId: d.i.pageId,
    postNr: postNr,
    type: flagType,
    reason: reason
  });
}


export function hidePostInPage(postNr: number, hide: boolean, success: (postAfter: Post) => void) {
  postJsonSuccess('/-/hide-post', success, { pageId: d.i.pageId, postNr: postNr, hide: hide });
}


export function deletePostInPage(postNr: number, repliesToo: boolean,
      success: (deletedPost) => void) {
  postJsonSuccess('/-/delete-post', success, {
    pageId: d.i.pageId,
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
    pageId: d.i.pageId,
    postId: postId,
    tags: tags
  });
}


export function changePostType(postNr: number, newType: PostType, success: () => void) {
  postJsonSuccess('/-/change-post-type', success, {
    pageId: d.i.pageId,
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
    pageId: d.i.pageId,
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


export function loadCategory(id: number,
      success: (category: Category, permissions: PermsOnPage[], groups: Group[]) => void) {
  get('/-/load-category?id=' + id, response => {
    success(response.category, response.permissions, response.groups);
  });
}


export function createPage(data, success: (newPageId: string) => void) {
  postJson('/-/create-page', {
    data: data,
    success: (response) => {
      success(response.newPageId);
    }
  });
}


export function acceptAnswer(postId: number, success: (answeredAtMs: number) => void) {
  postJsonSuccess('/-/accept-answer', success, { pageId: d.i.pageId, postId: postId });
}


export function unacceptAnswer(success: () => void) {
  postJsonSuccess('/-/unaccept-answer', success, { pageId: d.i.pageId });
}


export function cyclePageDone(success: (newPlannedAndDoneAt: any) => void) {
  postJsonSuccess('/-/cycle-page-done', success, { pageId: d.i.pageId });
}

export function togglePageClosed(success: (closedAtMs: number) => void) {
  postJsonSuccess('/-/toggle-page-closed', success, { pageId: d.i.pageId });
}

export function deletePages(pageIds: PageId[], success: () => void) {
  postJsonSuccess('/-/delete-pages', success, { pageIds: pageIds });
}

export function undeletePages(pageIds: PageId[], success: () => void) {
  postJsonSuccess('/-/undelete-pages', success, { pageIds: pageIds });
}


export function markCurrentPageAsSeen() {
  // COULD avoid showing the is-POSTing-data overlay.
  postJsonSuccess('/-/mark-as-seen?pageId=' + d.i.pageId, () => {}, {});
}



export function search(rawQuery: string, success: (results: SearchResults) => void) {
  postJsonSuccess('/-/search', success, { rawQuery: rawQuery });
}


// COULD perhaps merge with sendLongPollingRequest() a bit below? So reading activity is
// reported whenever a new long-polling-request is started?
// Uses navigator.sendBeacon if the `success` isn't specified.
export function trackReadingProgress(lastViewedPostNr: PostNr, secondsReading: number,
      postNrsRead: PostNr[], success?: () => void) {
  let nowMsUtc = Date.now(); // now() returns UTC
  let data = {
    pageId: d.i.pageId,
    visitStartedAt: nowMsUtc,
    lastViewedPostNr: lastViewedPostNr,
    lastReadAt: secondsReading > 0 ? nowMsUtc : null,
    secondsReading: secondsReading,
    postNrsRead: postNrsRead,
  };
  let url = '/-/track-reading';
  if (!success) {
    // sendBeacon not supported in Safari and iOS as of Feb 2017.
    let sendBeacon = navigator['sendBeacon'];
    if (sendBeacon) {
      // 1. Don't call variable `sendBeacon`, that results in an invalid-invokation error.
      // 2. sendBeacon() apparently always posts text/plain;charset=UTF-8.
      // 3. There's no way to add a xsrf header — so include a xsrf token in the request body.
      let xsrfTokenLine = getSetCookie('XSRF-TOKEN') + '\n';  // [7GKW20TD]
      let json = JSON.stringify(data);
      (<any> navigator).sendBeacon(url + '-text', xsrfTokenLine + json);
    }
  }
  else {
    postJsonSuccess(url, success, data, null, { showLoadingOverlay: false });
  }
}


let longPollingState = {
  ongoingRequest: null,
  lastModified: null,
  lastEtag: null,
};


/**
 * Built for talking with Nginx and nchan, see: https://github.com/slact/nchan#long-polling
 */
export function sendLongPollingRequest(userId: UserId, success: (event: any) => void,
      error: () => void) {
  dieIf(longPollingState.ongoingRequest, "Already long-polling the server [EsE7KYUX2]");
  console.debug(`Sending long polling request, ${debiki.siteId}:${userId} [EdDPS_BRWSRPOLL]`);
  const options: any = {
    dataType: 'json',
    // Firefox always calls the error callback if a long polling request is ongoing when
    // navigating away / closing the tab. So the dialog would be visible for 0.1 confusing seconds.
    suppressErrorDialog: true,
  };
  if (longPollingState.lastEtag) {
    options.headers = {
      'If-Modified-Since': longPollingState.lastModified,
      'If-None-Match': longPollingState.lastEtag,
    };
  }
  // This is an easy-to-guess channel id, but in order to subscribe, the session cookie
  // must also be included in the request. So this should be safe.
  // The site id is included, because users at different sites can have the same id. [7YGK082]
  const channelId = debiki.siteId + '-' + userId;
  let abortedBecauseNoData = false;
  longPollingState.ongoingRequest =
      get('/-/pubsub/subscribe/' + channelId, options, (response, xhr) => {
        console.debug(`Got long polling response [EdDPS_BRWSRRESP]: ${ JSON.stringify(response) }`);
        longPollingState.ongoingRequest = null;
        longPollingState.lastModified = xhr.getResponseHeader('Last-Modified');
        longPollingState.lastEtag = xhr.getResponseHeader('Etag');
        success(response);
      }, () => {
        longPollingState.ongoingRequest = null;
        if (abortedBecauseNoData) {
          // Don't update last-modified and etag.
          success(null);
        }
        else {
          console.debug(`Got long polling error response [EdDPS_BRWSRERR]`);
          error();
        }
      });

  // Cancel and restart the request after half a minute.
  const currentRequest = longPollingState.ongoingRequest;
  setTimeout(function () {
    abortedBecauseNoData = true;
    currentRequest.abort();
  }, 30 * 1000);
}


export function isLongPollingServerNow(): boolean {
  return !!longPollingState.ongoingRequest;
}


export function cancelAnyLongPollingRequest() {
  if (longPollingState.ongoingRequest) {
    longPollingState.ongoingRequest.abort("Intentionally cancelled [EsM2UZKW4]");
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
