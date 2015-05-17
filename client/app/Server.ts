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


export function createSite(emailAddress: string, localHostname: string,
    anyEmbeddingSiteAddress: string, doneCallback: (string) => void) {
  d.u.postJson({
    url: origin + '/-/create-site',
    data: {
      acceptTermsAndPrivacy: true,
      emailAddress: emailAddress,
      localHostname: localHostname,
      embeddingSiteAddress: anyEmbeddingSiteAddress
    },
    success: (response) => {
      doneCallback(response.newSiteOrigin);
    },
    error: (x, y, z) => {
      console.error('Error creating site: ' + JSON.stringify([x, y, z]));
      alert(x.responseText);
    },
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


export function saveSetting(setting: Setting, doneCallback: () => void) {
  d.u.postJson({
    url: origin + '/-/save-setting',
    data: setting,
    success: (response) => {
      doneCallback();
    },
    error: (x, y, z) => {
      console.error('Error saving new reply: ' + JSON.stringify([x, y, z]));
    },
  });
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


export function saveSpecialContent(specialContent: SpecialContent, doneCallback: () => void) {
  var data: any = {
    rootPageId: specialContent.rootPageId,
    contentId: specialContent.contentId,
    useDefaultText: specialContent.anyCustomText === specialContent.defaultText
  };
  if (!data.useDefaultText) {
    data.anyCustomText = specialContent.anyCustomText;
  }
  d.u.postJson({
    url: origin + '/-/save-special-content',
    data: data,
    success: (response) => {
      doneCallback();
    },
    error: (x, y, z) => {
      console.error('Error saving special content: ' + JSON.stringify([x, y, z]));
    },
  });
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


function doSomethingWithPost(post: PostToModerate, actionUrl: string, doneCallback: () => void) {
  d.u.postJson({
    url: origin + actionUrl,
    data: {
      pageId: post.pageId,
      postId: post.id,
    },
    success: (response) => {
      doneCallback();
    },
    error: (x, y, z) => {
      console.error('Error invoking ' + actionUrl + ': ' + JSON.stringify([x, y, z]));
    },
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


export function sendInvite(toEmailAddress: string, whenDone: (invite: Invite) => void) {
  d.u.postJson({
    url: origin + '/-/send-invite',
    data: {
      toEmailAddress: toEmailAddress
    },
    success: (response) => {
      whenDone(response);
    },
    error: (x, y, z) => {
      console.error('Error inviting user: ' + JSON.stringify([x, y, z]));
      alert(x.responseText);
    },
  });
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


export function approveRejectUser(user: CompleteUser, doWhat: string, whenDone: () => void) {
  d.u.postJson({
    url: origin + '/-/approve-reject-user',
    data: {
      userId: user.id,
      doWhat: doWhat
    },
    success: (response) => {
      whenDone();
    },
    error: (x, y, z) => {
      console.error('Error approving/rejecting user: ' + JSON.stringify([x, y, z]));
    },
  });
}


export function suspendUser(userId: number, numDays: number, reason: string, whenDone: () => void) {
  d.u.postJson({
    url: origin + '/-/suspend-user',
    data: {
      userId: userId,
      numDays: numDays,
      reason: reason
    },
    success: (response) => {
      whenDone();
    },
    error: (x, y, z) => {
      console.error('Error suspending user: ' + JSON.stringify([x, y, z]));
    },
  });
}


export function unsuspendUser(userId: number, whenDone: () => void) {
  d.u.postJson({
    url: origin + '/-/unsuspend-user',
    data: {
      userId: userId
    },
    success: (response) => {
      whenDone();
    },
    error: (x, y, z) => {
      console.error('Error unsuspending user: ' + JSON.stringify([x, y, z]));
    },
  });
}


export function savePageNoftLevel(newNotfLevel) {
  d.u.postJson({
    url: origin + '/-/save-page-notf-level',
    data: {
      pageId: d.i.pageId,
      pageNotfLevel: newNotfLevel
    }
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


export function saveUserPreferences(prefs, doneCallback: () => void) {
  d.u.postJson({
    url: origin + '/-/save-user-preferences',
    data: prefs,
    success: doneCallback
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
      doneCallback(null);
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


export function saveEdits(postId: number, text: string, doneCallback: () => void) {
  d.u.postJson({
    url: origin + '/-/edit',
    data: {
      pageId: d.i.pageId,
      postId: postId,
      text: text
    },
    success: (response) => {
      doneCallback();
      d.i.handleEditResult(response);
    },
    error: (x, y, z) => {
      console.error('Error saving text: ' + JSON.stringify([x, y, z]));
    },
  });
}


export function saveReply(postIds: number[], text: string, doneCallback: () => void) {
  d.u.postJson({
    url: origin + '/-/reply',
    data: {
      pageId: d.i.pageId,
      pageUrl: d.i.iframeBaseUrl || undefined,
      postIds: postIds,
      text: text
    },
    success: (response) => {
      doneCallback();
      d.i.handleReplyResult(response);
    },
    error: (x, y, z) => {
      console.error('Error saving new reply: ' + JSON.stringify([x, y, z]));
    },
  });
}


export function flagPost(postId: string, flagType: string, reason: string,
      doneCallback: () => void) {
  d.u.postJson({
    url: origin + '/-/flag',
    data: {
      pageId: d.i.pageId,
      postId: postId,
      type: flagType,
      reason: reason
    },
    success: (response) => {
      doneCallback();
    },
    error: (x, y, z) => {
      console.error('Error flagging post: ' + JSON.stringify([x, y, z]));
    },
  });
}


export function createPage(data, doneCallback: (newPageId: string) => void) {
  d.u.postJson({
    url: origin + '/-/create-page',
    data: data,
    success: (response) => {
      doneCallback(response.newPageId);
    },
    error: (x, y, z) => {
      console.error('Error saving new reply: ' + JSON.stringify([x, y, z]));
    },
  });
}


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 list
