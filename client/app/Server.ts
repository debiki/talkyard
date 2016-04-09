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
/// <reference path="users/user-info/UserInfo.ts" />
/// <reference path="model.ts" />
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
}


function postJson(urlPath: string, requestData: RequestData) {
  var url = appendE2eAndForbiddenPassword(origin + urlPath);
  d.u.postJson({
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
function postJsonSuccess(urlPath, success: (response: any) => void, data: any, error?) {
  // Make postJsonSuccess(..., error, data) work:
  if (!data || _.isFunction(data)) {
    var tmp = data;
    data = error;
    error = tmp;
  }
  postJson(urlPath, {
    data: data,
    success: success,
    error: error
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
  var assetsPrefix = d.i.assetsUrlPathStart;
  window['yepnope']({
    both: [assetsPrefix + 'editor-etcetera.' + d.i.minMaxJs],
    complete: () => {
      loadEditorScriptsStatus.resolve();
    }
  });
  return loadEditorScriptsStatus;
}


export function createSite(emailAddress: string, localHostname: string,
    anyEmbeddingSiteAddress: string, organizationName: string, doneCallback: (string) => void) {
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
    },
    success: (response) => {
      doneCallback(response.newSiteOrigin);
    }
  });
}


interface LoadSettingsResult {
  effectiveSettings: Settings
  defaultSettings: Settings;
}


export function loadSiteSettings(success: (s: LoadSettingsResult) => void) {
  get('/-/load-site-settings', {}, success);
}


export function saveSiteSettings(settings: Settings, success: (s: LoadSettingsResult) => void) {
  postJsonSuccess('/-/save-site-settings', success, settings);
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


export function loadCompleteUser(userId: number, doneCallback: (user: CompleteUser) => void,
        error?: () => void) {
  get('/-/load-complete-user?userId=' + userId, (response) => {
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
  postJsonSuccess('/-/save-page-notf-level', null, {
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


export function loadUserInfo(userId, callback: (info: debiki2.users.UserInfo) => void) {
  $.get(origin + '/-/load-user-info?userId=' + userId)
    .done((response: any) => {
      var userInfo = debiki2.users.UserInfo.fromJson(response.userInfo);
      callback(userInfo);
    })
    .fail((x, y, z) => {
      console.error('Error loading user info: ' + JSON.stringify([x, y, z]));
      callback(null);
    });
}


export function loadUserActions(userId,
      callback: (actions: debiki2.users.ActionListItem[]) => void) {
  $.get(origin + '/-/list-user-actions?userId=' + userId)
    .done((response: any) => {
      var actionItems: debiki2.users.ActionListItem[] = [];
      for (var i = 0; i < response.actions.length; ++i) {
        var json = response.actions[i];
        var c = debiki2.users.ActionListItem.fromJson(json);
        actionItems.push(c);
      }
      callback(actionItems);
    })
    .fail((x, y, z) => {
      console.error('Error loading user actions: ' + JSON.stringify([x, y, z]));
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


export function loadUserPreferences(userId,
      callback: (info: debiki2.users.UserPreferences) => void) {
  $.get(origin + '/-/load-user-preferences?userId=' + userId)
    .done((response: any) => {
      var userPrefs = debiki2.users.UserPreferences.fromJson(response.userPreferences);
      callback(userPrefs);
    })
    .fail((x, y, z) => {
      console.error('Error loading user preferences: ' + JSON.stringify([x, y, z]));
      callback(null);
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


export function loadForumCategories(forumPageId: string,
      success?: (categories: Category[]) => void) {
  // Perhaps should remove the forum id param? Since saves cats in the store cats list always.
  dieIf(forumPageId !== theStore.pageId, 'EsE7YPK24');
  get('/-/list-categories?forumId=' + forumPageId, (categories: Category[]) => {
    ReactActions.setCategories(categories);
    !success || success(categories);
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
    doneCallback(response.topics);
  });
}


export function listUsernames(prefix: string, doneCallback: (usernames: string[]) => void) {
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
  if (!categoryId && pageRole !== PageRole.Message) {
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


export function joinChatChannel() {
  postJsonSuccess('/-/join-page', (newWatchbar) => {
    ReactActions.setWatchbar(newWatchbar);
    ReactActions.addMeAsPageMember();
  }, { pageId: d.i.pageId });
}


export function sendMessage(title: string, text: string, userIds: number[],
    success: (pageId: string) => void) {
  postJsonSuccess('/-/send-private-message', success,
      { title: title, text: text, userIds: userIds });
}


export function flagPost(postId: string, flagType: string, reason: string, success: () => void) {
  postJsonSuccess('/-/flag', success, {
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
  postJsonSuccess('/-/mark-as-seen?pageId=' + d.i.pageId, () => {}, {});
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
  longPollingState.ongoingRequest =
      get('/-/pubsub/subscribe/' + userId, options, (response, xhr) => {
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


export function logBrowserError(errorMessage: string) {  // rename to logError
  postJsonSuccess('/-/log-browser-error', () => {}, errorMessage);
}


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 list
