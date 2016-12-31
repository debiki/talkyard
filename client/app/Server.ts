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
/// <reference path="rules.ts" />
/// <reference path="ServerApi.ts" />

//------------------------------------------------------------------------------
   module debiki2.Server {
//------------------------------------------------------------------------------

var d: any = { i: debiki.internal, u: debiki.v0.util };
var $: JQueryStatic = d.i.$;

// In embedded comments <iframes>, we cannot use relative paths.
var origin = d.i.serverOrigin;

enum HttpStatusCode {
  Forbidden = 403,
}

var BadNameOrPasswordErrorCode = 'EsE403BPWD';
declare var theStore: Store; // for assertions only


interface OngoingRequest {
  abort(message?: string);
}

interface RequestData {
  data: any;
  success: (response: any) => void;
  error?: (jqXhr: any, textStatus?: string, errorThrown?: string) => any;
  showLoadingOverlay?: boolean;
}


function postJson(urlPath: string, requestData: RequestData) {
  var url = appendE2eAndForbiddenPassword(origin + urlPath);
  var options = options || {};
  d.u.postJson({
    showLoadingOverlay: options.showLoadingOverlay,
    url: url,
    data: requestData.data,
    success: requestData.success,
    error: (jqXhr: any, textStatus: string, errorThrown: string) => {
      if (requestData.error) {
        var perhapsIgnoreError = requestData.error(jqXhr, textStatus, errorThrown);
        if (perhapsIgnoreError === IgnoreThisError)
          return;
      }
      console.error('Error calling ' + urlPath + ': ' + JSON.stringify(jqXhr));
      pagedialogs.getServerErrorDialog().open(jqXhr);
    }
  });
}


/** Return Server.IgnoreThisError from error(..) to suppress a log message and error dialog. */
function postJsonSuccess(urlPath, success: (response: any) => void, data: any, error?,
        options?: { showLoadingOverlay?: boolean }) {
  // Make postJsonSuccess(..., error, data) work:
  if (!data || _.isFunction(data)) {
    var tmp = data;
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
  var dataType;
  var headers;
  if (_.isFunction(options)) {
    error = <any> success;
    success = <any> options;
    options = {};
  }
  else {
    if (!options) options = {};
    dataType = options.dataType;
    headers = options.headers;
  }

  var xhr = $.ajax({
    url: origin + uri,
    type: 'GET',
    dataType: dataType,
    headers: headers,
    success: function(response, dummy, xhr) {
      success(response, xhr);
    },
    error: function(jqXhr: any, textStatus: string, errorThrown: string) {
      if (options.suppressErrorDialog) {
        console.log('As expected, error when calling ' + uri + ': ' + JSON.stringify(jqXhr));
      }
      else {
        console.error('Error calling ' + uri + ': ' + JSON.stringify(jqXhr));
        pagedialogs.getServerErrorDialog().open(jqXhr);
      }
      !error || error();
    },
  });

  return {
    abort: function(message?: string) { xhr.abort(message); }
  }
}


function appendE2eAndForbiddenPassword(url: string) {
  var newUrl = url;
  var e2eTestPassword = anyE2eTestPassword();
  var forbiddenPassword = anyForbiddenPassword();
  if (e2eTestPassword || forbiddenPassword) {
    if (newUrl.indexOf('?') === -1) newUrl += '?';
    if (e2eTestPassword) newUrl += '&e2eTestPassword=' + e2eTestPassword;
    if (forbiddenPassword) newUrl += '&forbiddenPassword=' + forbiddenPassword;
  }
  return newUrl;
}


var loadEditorScriptsStatus;
var slowBundleStatus;
var staffBundleStatus;


// Won't call callback() until a bit later — so if you call React's setState(..), the
// state will have changed.
//
export function loadEditorEtcScriptsAndLater(callback?) {  // RENAME? to loadEditorAndMoreBundles
  setTimeout(function() {
    loadEditorEtceteraScripts().done(callback || _.noop)
  }, 0);
}


export function loadMoreScriptsBundle(callback) {
  if (slowBundleStatus) {
    // Never call callback() immediately, because it's easier to write caller source code,
    // if one knows that callback() will never be invoked immediately.
    setTimeout(() => slowBundleStatus.done(callback), 0);
    return;
  }
  slowBundleStatus = $.Deferred();
  window['yepnope']({
    both: [d.i.assetUrlPrefix + 'more-bundle.' + d.i.minMaxJs],
    complete: () => {
      slowBundleStatus.resolve();
      setTimeout(callback, 0);
    }
  });
  return slowBundleStatus;
}


export function loadStaffScriptsBundle(callback) {
  if (staffBundleStatus) {
    // Never call callback() immediately, because it's easier to write caller source code,
    // if one knows that callback() will never be invoked immediately.
    setTimeout(() => staffBundleStatus.done(callback), 0);
    return;
  }
  staffBundleStatus = $.Deferred();
  // The staff scripts bundle requires both more-bundle.js and editor-bundle.js (to render
  // previews of CommonMark comments [7PKEW24]). This'll load them both.
  loadEditorEtcScriptsAndLater(() => {
    window['yepnope']({
      both: [d.i.assetUrlPrefix + 'staff-bundle.' + d.i.minMaxJs],
      complete: () => {
        staffBundleStatus.resolve();
        callback();  // setTimeout(..., 0) not needed — done by loadMoreScriptsBundle() already
      }
    });
  });
  return staffBundleStatus;
}


export function loadEditorEtceteraScripts() {
  if (loadEditorScriptsStatus)
    return loadEditorScriptsStatus;

  // Now we'll load FileAPI, and according to the docs it needs to know where it
  // can find its implementation details files (Flash and Html5 stuff depending on
  // browser html5 support). However, works anyway, without any staticPath. Hmm.
  window['FileAPI'] = {
    staticPath: '/-/tfEF357cw/', // later: '/-/res/', — but first actually place the files here
    debug: debiki.isDev,
  };

  loadEditorScriptsStatus = $.Deferred();
  // The editor scripts bundle requires more-bundle.js.
  loadMoreScriptsBundle(() => {
    window['yepnope']({
      both: [d.i.assetUrlPrefix + 'editor-bundle.' + d.i.minMaxJs],
      complete: () => {
        loadEditorScriptsStatus.resolve();
      }
    });
  });
  return loadEditorScriptsStatus;
}


export function createSite(emailAddress: string, localHostname: string,
    anyEmbeddingSiteAddress: string, organizationName: string,
    pricePlan: PricePlan, doneCallback: (string) => void) {
  var url = '/-/create-site';
  var isTestSite = window.location.search.indexOf('testSiteOkDelete=true') !== -1 ||
    window.location.pathname === '/-/create-test-site';
  postJson(url, {
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
  var url = '/-/load-special-content?rootPageId=' + (rootPageId ? rootPageId : '') +
      '&contentId=' + contentId;
  $.get(origin + url)
    .done((content: any) => {
      doneCallback(content);
    })
    .fail((x, y, z) => {
      console.error('Error loading special content: ' + JSON.stringify([x, y, z]));
      doneCallback(null);
    });
}


export function saveSpecialContent(specialContent: SpecialContent, success: () => void) {
  var data: any = {
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

  /*
export function loadRecentPosts(doneCallback: (posts: PostToModerate[]) => void) {
  $.get(origin + '/-/list-recent-posts')
    .done(response => {
      doneCallback(response.actions);
    })
    .fail((x, y, z) => {
      console.error('Error loading recent posts: ' + JSON.stringify([x, y, z]));
      doneCallback(null);
    });
} */


// ---- Currently not in use, but perhaps soon again ----------------------

export function approvePost(post: PostToModerate, doneCallback: () => void) {
  doSomethingWithPost(post, '/-/approve', doneCallback);
}

export function hideNewPostSendPm(post: PostToModerate, doneCallback: () => void) {
  doSomethingWithPost(post, '/-/hide-new-send-pm', doneCallback);
}

export function hideFlaggedPostSendPm(post: PostToModerate, doneCallback: () => void) {
  doSomethingWithPost(post, '/-/hide-flagged-send-pm', doneCallback);
}

// This is for moderators. Could merge with /-/delete-post, open to anyone?
export function deletePost(post: PostToModerate, doneCallback: () => void) {
  doSomethingWithPost(post, '/-/delete', doneCallback);
}

export function deleteFlaggedPost(post: PostToModerate, doneCallback: () => void) {
  doSomethingWithPost(post, '/-/delete-flagged', doneCallback);
}

export function clearFlags(post: PostToModerate, doneCallback: () => void) {
  doSomethingWithPost(post, '/-/clear-flags', doneCallback);
}

export function rejectEdits(post: PostToModerate, doneCallback: () => void) {
  doSomethingWithPost(post, '/-/reject-edits', doneCallback);
}


function doSomethingWithPost(post: PostToModerate, actionUrl: string, success: () => void) {
  die('EdE7KWWU0');
  postJsonSuccess(actionUrl, success, {
    pageId: post.pageId,
    postId: post.id,
  });
}

// ---- /END currently not in use, but perhaps soon again ----------------------


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
  function onError(jqXhr: any, textStatus?: string, errorThrown?: string) {
    if (jqXhr.responseText.indexOf(BadNameOrPasswordErrorCode) !== -1) {
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
  postJsonSuccess('/-/logout', success, null);
}


export function makeImpersionateUserAtOtherSiteUrl(siteId: SiteId, userId: UserId,
      success: (url: string) => void) {
  var url = '/-/make-impersonate-other-site-url?siteId=' + siteId + '&userId=' + userId;
  postJsonSuccess(url, success, null);
}


export function impersonateGoToHomepage(userId: UserId) {
  postJsonSuccess('/-/impersonate?userId=' + userId, () => {
    location.assign('/');
  }, null);
}


export function stopImpersonatingReloadPage() {
  postJsonSuccess('/-/stop-impersonating', () => {
    location.reload();
  }, null);
}


export function loadCompleteUser(userIdOrUsername: UserId | string,
        doneCallback: (user: CompleteUser) => void, error?: () => void) {
  get('/-/load-user-incl-details?who=' + userIdOrUsername, (response) => {
    doneCallback(response.user);
  }, error);
}


export function listCompleteUsers(whichUsers,
        doneCallback: (users: CompleteUser[]) => void) {
  $.get(origin + '/-/list-complete-users?whichUsers=' + whichUsers)
    .done(response => {
      doneCallback(response.users);
    })
    .fail((x, y, z) => {
      console.error('Error loading users: ' + JSON.stringify([x, y, z]));
    });
}


export function sendAddressVerifEmailAgain(success) {
  postJsonSuccess('/-/send-addr-verif-email-again', success, {});
}


export function sendInvite(toEmailAddress: string, success: (invite: Invite) => void,
      error: (failedRequest: HttpRequest) => ErrorPolicy) {
  postJsonSuccess('/-/send-invite', success, error, { toEmailAddress: toEmailAddress });
}


export function loadInvitesSentBy(userId: number, success: (invites: Invite[]) => void,
        error: (message: string) => void) {
  $.get(origin + '/-/list-invites?sentById=' + userId)
    .done(response => {
      success(response);
    })
    .fail((x, y, z) => {
      console.error('Error loading invites: ' + JSON.stringify([x, y, z]));
      error(x.responseText);
    });
}


export function setIsAdminOrModerator(userId: number, doWhat: string, success: () => void) {
  postJsonSuccess('/-/set-is-admin-or-moderator', success, { userId: userId, doWhat: doWhat });
}


export function approveRejectUser(user: CompleteUser, doWhat: string, success: () => void) {
  postJsonSuccess( '/-/approve-reject-user', success, {
    userId: user.id,
    doWhat: doWhat
  });
}


export function suspendUser(userId: number, numDays: number, reason: string, success: () => void) {
  postJsonSuccess('/-/suspend-user', success, {
    userId: userId,
    numDays: numDays,
    reason: reason
  });
}


export function unsuspendUser(userId: number, success: () => void) {
  postJsonSuccess('/-/unsuspend-user', success, { userId: userId });
}


export function lockThreatLevel(userId: number, threatLevel: ThreatLevel, success: () => void) {
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
    var me: Myself = ReactStore.allData().me;
    me.rolePageSettings = { notfLevel: newNotfLevel };  // [redux] modifying state in place
    ReactActions.patchTheStore({ me: me });
  }, {
    pageId: d.i.pageId,
    pageNotfLevel: newNotfLevel
  });
}


export function loadMyself(callback: (user: any) => void) {
  $.get(origin + '/-/load-my-page-data?pageId=' + debiki2.ReactStore.getPageId())
    .done((user: any) => {
      callback(user);
    })
    .fail((x, y, z) => {
      console.error('Error loading my page data: ' + JSON.stringify([x, y, z]));
      callback(null);
    });
}


export function loadNotifications(userId: number, upToWhenMs: number,
      success: (notfs: Notification[]) => void, error: () => void) {
  var query = '?userId=' + userId + '&upToWhenMs=' + upToWhenMs;
  get('/-/load-notifications' + query, success, error);
}


export function markNotificationAsSeen(notfId: number, success?: () => void, error?: () => void) {
  postJsonSuccess('/-/mark-notf-as-seen', success, error, { notfId: notfId });
}


export function setTagNotfLevel(tagLabel: TagLabel, newNotfLevel: NotfLevel) {
  postJsonSuccess('/-/set-tag-notf-level', () => {
    var store: Store = ReactStore.allData();
    var newLevels = _.clone(store.tagsStuff.myTagNotfLevels);
    newLevels[tagLabel] = newNotfLevel;
    ReactActions.patchTheStore({
      tagsStuff: { myTagNotfLevels: newLevels }
    });
  }, {
    tagLabel: tagLabel,
    notfLevel: newNotfLevel
  });
}


export function saveUserPreferences(prefs, success: () => void) {
  postJsonSuccess('/-/save-user-preferences', success, prefs);
}


export function saveGuest(guest, success: () => void) {
  postJsonSuccess('/-/save-guest', success, guest);
}


export function blockGuest(postId: number, numDays: number, threatLevel: ThreatLevel,
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


export function loadAuthorBlockedInfo(postId: number, whenDone: (response: Blocks) => void) {
  $.get(origin + '/-/load-author-blocks?postId=' + postId)
    .done((response: any) => {
      whenDone(response);
    })
    .fail((x, y, z) => {
      console.error('Error loading is-blocked info: ' + JSON.stringify([x, y, z]));
    });
}


export function createForum(title: string, folder: string, success: (urlPath: string) => void) {
  postJsonSuccess('/-/create-forum', success, {
    title: title,
    folder: folder,
  });
}


export function loadForumCategoriesTopics(forumPageId: string, topicFilter: string,
      success: (categories: Category[]) => void) {
  var url = '/-/list-categories-topics?forumId=' + forumPageId;
  if (topicFilter) {
    url += '&filter=' + topicFilter;
  }
  get(url, success);
}


export function loadForumTopics(categoryId: string, orderOffset: OrderOffset,
      doneCallback: (topics: Topic[]) => void) {
  var url = '/-/list-topics?categoryId=' + categoryId + '&' +
      ServerApi.makeForumTopicsQueryParams(orderOffset);
  get(url, (response: any) => {
    ReactActions.patchTheStore({ usersBrief: response.users });
    doneCallback(response.topics);
  });
}


export function loadTopicsByUser(userId: UserId,
        doneCallback: (topics: Topic[]) => void) {
  var url = `/-/list-topics-by-user?userId=${userId}`;
  get(url, (response: any) => {
    ReactActions.patchTheStore({ usersBrief: response.users });
    doneCallback(response.topics);
  });
}


export function listAllUsernames(prefix: string, doneCallback: (usernames: BriefUser) => void) {
  var url = '/-/list-all-users?usernamePrefix='+ prefix;
  get(url, doneCallback);
}


export function listUsernames(prefix: string, doneCallback: (usernames: BriefUser) => void) {
  var url = origin + '/-/list-usernames?pageId='+ d.i.pageId + '&prefix='+ prefix;
  $.get(url)
    .done((response: any) => {
      doneCallback(response);
    })
    .fail((x, y, z) => {
      console.error('Error listing usernames: ' + JSON.stringify([x, y, z]));
      doneCallback(null);
    });
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
  var categoryParam = categoryId ? '&categoryId=' + categoryId : '';
  get('/-/load-draft-and-guidelines?writingWhat=' + writingWhat + categoryParam +
       '&pageRole=' + pageRole, (response) => {
    success(response.guidelinesSafeHtml);
  });
}


export function loadCurrentPostText(postId: number,
      doneCallback: (text: string, postUid: number, revisionNr: number) => void) {
  get('/-/edit?pageId='+ d.i.pageId + '&postId='+ postId, (response: any) => {
    // COULD also load info about whether the user may apply and approve the edits.
    doneCallback(response.currentText, response.postUid, response.currentRevisionNr);
  });
}


var cachedOneboxHtml = {};

export function loadOneboxSafeHtml(url: string, success: (safeHtml: string) => void) {
  var cachedHtml = cachedOneboxHtml[url];
  if (cachedHtml) {
    setTimeout(() => success(cachedHtml), 0);
    return;
  }
  var encodedUrl = encodeURIComponent(url);
  $.get(origin + '/-/onebox?url=' + encodedUrl, { dataType: 'html' })
    .done((response: string) => {
      cachedOneboxHtml[url] = response;
      success(response);
    })
    .fail((x, y, z) => {
      console.debug('Error loading onebox: ' + JSON.stringify([x, y, z]));
      // Pass null to tell the editor to show no onebox (it should show the link instead).
      success(null);
    });
}


export function saveVote(data, success: (updatedPost) => void) {
  postJsonSuccess('/-/vote', success, data);
}


export function saveEdits(postId: number, text: string, doneCallback: () => void) {
  postJson('/-/edit', {
    data: {
      pageId: d.i.pageId,
      postId: postId,
      text: text
    },
    success: (editedPost) => {
      doneCallback();
      ReactActions.handleEditResult(editedPost);
    }
  });
}


export function savePageTitleAndSettings(newTitle: string, settings: any, success: (response: any) => void,
        error: () => void) {
  var data = $.extend(settings, {
    pageId: d.i.pageId,
    newTitle: newTitle
  });
  postJson('/-/edit-title-save-settings', {
    data: data,
    success: (response) => {
      success(response);
      if (response.newUrlPath && window.history.replaceState) {
        var newPath = response.newUrlPath + location.search + location.hash;
        window.history.replaceState({}, null, newPath);
      }
    },
    error: error
  });
}


export function loadLatestPostRevisions(postId: number,
    success: (revisions: PostRevision[]) => void) {
  get('/-/load-post-revisions?postId=' + postId + '&revisionNr=LastRevision', success);
}


/** Loads revision revisionNr and some older revisions.
  */
export function loadMorePostRevisions(postId: number, revisionNr: number,
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


export function saveReply(postIds: number[], text: string, anyPostType: number,
    success: () => void) {
  postJson('/-/reply', {
    data: {
      pageId: d.i.pageId,
      pageUrl: d.i.iframeBaseUrl || undefined,
      postIds: postIds,
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


export function submitCustomFormAsJsonReply(formInputNameValues, success?: () => void) {
  postJsonSuccess('/-/submit-custom-form-as-json-reply', success, {
    pageId: d.i.pageId,
    formInputs: formInputNameValues,
  });
}


export function submitCustomFormAsNewTopic(formInputNameValues) {
  function getOrDie(inpName: string): string {
    let concatenatedValues = null;
    _.each(formInputNameValues, (nameValue: any) => {
      if (nameValue.name === inpName) {
        let value = nameValue.value.trim();
        value = value.replace(/\\n/g, '\n');
        concatenatedValues = (concatenatedValues || '') + value;
      }
    });
    dieIf(concatenatedValues === null, `Input missing: ${inpName} [EdE4WKFE02]`);
    return concatenatedValues.trim();
  }

  function goToNewPage(response) {
    location.assign(linkToPageId(response.newPageId));
  }

  postJsonSuccess('/-/submit-custom-form-as-new-topic', goToNewPage, {
    newTopicTitle: getOrDie('title'),
    newTopicBody: getOrDie('body'),
    pageTypeId: getOrDie('pageTypeId'),
    categorySlug: getOrDie('categorySlug'),
  });
}


export function loadPostByNr(pageId: PageId, postNr: PostNr, success: (patch: StorePatch) => void) {
  get(`/-/load-post?pageId=${pageId}&postNr=${postNr}`, success);
}


export function loadPostsByAuthor(authorId: UserId, success: (response) => void,
    error?: () => void) {
  get(`/-/list-posts?authorId=${authorId}`, success);
}


export function flagPost(postId: string, flagType: string, reason: string, success: () => void) {
  postJsonSuccess('/-/flag', (storePatch: StorePatch) => {
    ReactActions.patchTheStore(storePatch);
    if (success) success();
  }, {
    pageId: d.i.pageId,
    postId: postId,
    type: flagType,
    reason: reason
  });
}


export function hidePostInPage(postNr: number, hide: boolean, success: (postAfter: Post) => void) {
  postJsonSuccess('/-/hide-post', success, { pageId: d.i.pageId, postNr: postNr, hide: hide });
}


export function deletePostInPage(postId: number, repliesToo: boolean,
      success: (deletedPost) => void) {
  postJsonSuccess('/-/delete-post', success, {
    pageId: d.i.pageId,
    postNr: postId,
    repliesToo: repliesToo,
  });
}


export function editPostSettings(postId: PostId, settings: PostSettings, success: () => void) {
  var data = _.assign({ postId: postId }, settings);
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


export function changePostType(postId: number, newType: PostType, success: () => void) {
  postJsonSuccess('/-/change-post-type', success, {
    pageId: d.i.pageId,
    postNr: postId,
    newType: newType,
  });
}


export function movePost(postId: PostId, newHost: SiteId, newPageId: PageId,
      newParentNr: PostNr, success: (post: Post) => void) {
  postJsonSuccess('/-/move-post', (patch: StorePatch) => {
    ReactActions.patchTheStore(patch);
    var post = _.values(patch.postsByPageId)[0][0];
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


export function saveCategory(data, success: (response: any) => void, error?: () => void) {
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


export function loadCategory(id: number, success: (response: any) => void) {
  get('/-/load-category?id=' + id, success);
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


var longPollingState = {
  ongoingRequest: null,
  lastModified: null,
  lastEtag: null,
};


/**
 * Built for talking with Nginx and nchan, see: https://github.com/slact/nchan#long-polling
 */
export function sendLongPollingRequest(userId: number, success: (event: any) => void,
      error: () => void) {
  dieIf(longPollingState.ongoingRequest, "Already long-polling the server [EsE7KYUX2]");
  var options: any = {
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
  var channelId = debiki.siteId + '-' + userId;
  longPollingState.ongoingRequest =
      get('/-/pubsub/subscribe/' + channelId, options, (response, xhr) => {
        longPollingState.ongoingRequest = null;
        longPollingState.lastModified = xhr.getResponseHeader('Last-Modified');
        longPollingState.lastEtag = xhr.getResponseHeader('Etag');
        success(response);
      }, () => {
        longPollingState.ongoingRequest = null;
        error();
      });
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


var pendingErrors = [];

export function logError(errorMessage: string) {
  pendingErrors.push(errorMessage);
  postPendingErrorsThrottled();
}


var postPendingErrorsThrottled = _.throttle(function() {
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
