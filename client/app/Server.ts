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
/// <reference path="renderer/model.ts" />

//------------------------------------------------------------------------------
   module debiki2.Server {
//------------------------------------------------------------------------------

var d: any = { i: debiki.internal, u: debiki.v0.util };
var $: JQueryStatic = d.i.$;

// In embedded comments <iframes>, we cannot use relative paths.
var origin = d.i.serverOrigin;


interface RequestData {
  data: any;
  success: (response: any) => void;
  error?: (jqXhr: any, textStatus?: string, errorThrown?: string) => void;
}


function postJson(urlPath: string, requestData: RequestData) {
  d.u.postJson({
    url: origin + urlPath,
    data: requestData.data,
    success: requestData.success,
    error: (jqXhr: any, textStatus: string, errorThrown: string) => {
      console.error('Error calling ' + urlPath + ': ' + JSON.stringify(jqXhr));
      pagedialogs.serverErrorDialog.open(jqXhr);
      if (requestData.error) {
        requestData.error(jqXhr, textStatus, errorThrown);
      }
    }
  });
}


function postJsonSuccess(urlPath, success: (response: any) => void, data: any) {
  postJson(urlPath, {
    data: data,
    success: success,
    error: null
  });
}


export function createSite(emailAddress: string, localHostname: string,
    anyEmbeddingSiteAddress: string, pricePlan: string, doneCallback: (string) => void) {
  postJson('/-/create-site', {
    data: {
      acceptTermsAndPrivacy: true,
      emailAddress: emailAddress,
      localHostname: localHostname,
      embeddingSiteAddress: anyEmbeddingSiteAddress,
      pricePlan: pricePlan
    },
    success: (response) => {
      doneCallback(response.newSiteOrigin);
    }
  });
}


export function loadSettings(type: string, pageId: string, doneCallback: (any) => void) {
  var url;
  if (type === 'WholeSite') {
    url = '/-/load-site-settings';
  }
  else if (type === 'PageTree') {
    url = '/-/load-section-settings?rootPageId=' + pageId;
  }
  else {
    console.error('Unsupported settings target type: ' + type + ' [DwE5H245]');
    doneCallback(null);
  }
  $.get(origin + url)
    .done((settings: any) => {
      doneCallback(settings);
    })
    .fail((x, y, z) => {
      console.error('Error loading settings: ' + JSON.stringify([x, y, z]));
      doneCallback(null);
    });
}


export function saveSetting(setting: Setting, success: () => void) {
  postJsonSuccess('/-/save-setting', success, setting);
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


export function loadRecentPosts(doneCallback: (posts: PostToModerate[]) => void) {
  $.get(origin + '/-/list-recent-posts')
    .done(response => {
      doneCallback(response.actions);
    })
    .fail((x, y, z) => {
      console.error('Error loading recent posts: ' + JSON.stringify([x, y, z]));
      doneCallback(null);
    });
}


export function approvePost(post: PostToModerate, doneCallback: () => void) {
  doSomethingWithPost(post, '/-/approve', doneCallback);
}

export function hideNewPostSendPm(post: PostToModerate, doneCallback: () => void) {
  doSomethingWithPost(post, '/-/hide-new-send-pm', doneCallback);
}

export function hideFlaggedPostSendPm(post: PostToModerate, doneCallback: () => void) {
  doSomethingWithPost(post, '/-/hide-flagged-send-pm', doneCallback);
}

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


export function loadCompleteUser(userId: number,
        doneCallback: (user: CompleteUser) => void) {
  $.get(origin + '/-/load-complete-user?userId=' + userId)
    .done(response => {
      doneCallback(response.user);
    })
    .fail((x, y, z) => {
      console.error('Error loading user: ' + JSON.stringify([x, y, z]));
    });
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


export function sendInvite(toEmailAddress: string, success: (invite: Invite) => void) {
  postJsonSuccess('/-/send-invite', success, { toEmailAddress: toEmailAddress });
}


export function loadInvitesSentBy(userId: number, doneCallback: (invites: Invite[]) => void) {
  $.get(origin + '/-/list-invites?sentById=' + userId)
    .done(response => {
      doneCallback(response);
    })
    .fail((x, y, z) => {
      console.error('Error loading invites: ' + JSON.stringify([x, y, z]));
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


export function savePageNoftLevel(newNotfLevel) {
  postJsonSuccess('/-/save-page-notf-level', null, {
    pageId: d.i.pageId,
    pageNotfLevel: newNotfLevel
  });
}


export function loadMyPageData(callback: (user: any) => void) {
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


export function blockGuest(postId: number, numDays: number, success: () => void) {
  postJsonSuccess('/-/block-guest', success, { postId: postId, numDays: numDays });
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


export function loadForumCategories(forumPageId: string,
      doneCallback: (categories: Category[]) => void) {
  $.get(origin + '/-/list-categories?forumId=' + forumPageId)
    .done((response: any) => {
      doneCallback(response.categories);
    })
    .fail((x, y, z) => {
      console.error('Error loading categories: ' + JSON.stringify([x, y, z]));
      doneCallback(null);
    });
}


export function loadForumTopics(categoryId: string, orderOffset: OrderOffset,
      doneCallback: (topics: Topic[]) => void) {
  var url = origin + '/-/list-topics?categoryId=' + categoryId;
  if (orderOffset.sortOrder === TopicSortOrder.BumpTime) {
    url += '&sortOrder=ByBumpTime';
    if (orderOffset.time) {
      url += '&epoch=' + orderOffset.time;
    }
  }
  else if (orderOffset.sortOrder === TopicSortOrder.LikesAndBumpTime) {
    url += '&sortOrder=ByLikesAndBumpTime';
    if (_.isNumber(orderOffset.numLikes) && orderOffset.time) {
      url += '&num=' + orderOffset.numLikes;
      url += '&epoch=' + orderOffset.time;
    }
  }
  else {
    console.log('Bad orderOffset [DwE5FS0]');
    return;
  }
  $.get(url)
    .done((response: any) => {
      doneCallback(response.topics);
    })
    .fail((x, y, z) => {
      console.error('Error loading topics: ' + JSON.stringify([x, y, z]));
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


export function loadCurrentPostText(postId: number, doneCallback: (text: string) => void) {
  $.get(origin + '/-/edit?pageId='+ d.i.pageId + '&postId='+ postId)
    .done((response: any) => {
      // COULD also load info about whether the user may apply and approve the edits.
      doneCallback(response.currentText);
    })
    .fail((x, y, z) => {
      console.error('Error loading current post text: ' + JSON.stringify([x, y, z]));
      doneCallback(null);
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


export function saveEdits(postId: number, text: string, doneCallback: () => void) {
  postJson('/-/edit', {
    data: {
      pageId: d.i.pageId,
      postId: postId,
      text: text
    },
    success: (response) => {
      doneCallback();
      d.i.handleEditResult(response);
    }
  });
}


export function savePageTitleAndSettings(newTitle: string, settings: any, success: () => void,
        error: () => void) {
  var data = $.extend(settings, {
    pageId: d.i.pageId,
    newTitle: newTitle
  });
  postJson('/-/edit-title-save-settings', {
    data: data,
    success: (response) => {
      success();
      d.i.handleEditResult(response.newTitlePost);
      if (response.newUrlPath && window.history.replaceState) {
        var newPath = response.newUrlPath + location.search + location.hash;
        window.history.replaceState({}, null, newPath);
      }
    },
    error: error
  });
}


export function saveReply(postIds: number[], text: string, success: () => void) {
  postJson('/-/reply', {
    data: {
      pageId: d.i.pageId,
      pageUrl: d.i.iframeBaseUrl || undefined,
      postIds: postIds,
      text: text
    },
    success: (response) => {
      success();
      d.i.handleReplyResult(response);
    }
  });
}


export function flagPost(postId: string, flagType: string, reason: string, success: () => void) {
  postJsonSuccess('/-/flag', success, {
    pageId: d.i.pageId,
    postId: postId,
    type: flagType,
    reason: reason
  });
}


export function createPage(data, doneCallback: (newPageId: string) => void) {
  postJson('/-/create-page', {
    data: data,
    success: (response) => {
      doneCallback(response.newPageId);
    }
  });
}


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 list
