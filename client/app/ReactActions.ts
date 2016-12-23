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

/// <reference path="plain-old-javascript.d.ts" />
/// <reference path="ReactDispatcher.ts" />
/// <reference path="Server.ts" />

//------------------------------------------------------------------------------
   module debiki2.ReactActions {
//------------------------------------------------------------------------------

var d = { i: debiki.internal };


export var actionTypes = {
  NewMyself: 'NewMyself',
  Logout: 'Logout',
  NewUserAccountCreated: 'NewUserAccountCreated',
  CreateEditForumCategory: 'CreateEditForumCategory',
  SetCategories: 'SetCategories',
  PinPage: 'PinPage',
  UnpinPage: 'UnpinPage',
  DeletePages: 'DeletePages',
  UndeletePages: 'UndeletePages',
  SetPageNotfLevel: 'SetPageNotfLevel',
  AcceptAnswer: 'AcceptAnswer',
  UnacceptAnswer: 'UnacceptAnswer',
  CyclePageDone: 'CyclePageDone',
  TogglePageClosed: 'TogglePageClosed',
  EditTitleAndSettings: 'EditTitleAndSettings',
  ShowForumIntro: 'ShowForumIntro',
  UpdatePost: 'UpdatePost',
  VoteOnPost: 'VoteOnPost',
  MarkPostAsRead: 'MarkPostAsRead',
  CycleToNextMark: 'CycleToNextMark',
  SummarizeReplies: 'SummarizeReplies',
  UnsquashTrees: 'UnsquashTrees',
  CollapseTree: 'CollapseTree',
  UncollapsePost: 'UncollapsePost',
  ShowPost: 'ShowPost',
  SetWatchbar: 'SetWatchbar',
  SetWatchbarOpen: 'SetWatchbarOpen',
  SetContextbarOpen: 'SetContextbarOpen',
  SetHorizontalLayout: 'SetHorizontalLayout',
  HideHelpMessage: 'HideHelpMessage',
  ShowHelpAgain: 'ShowHelpAgain',
  ShowSingleHelpMessageAgain: 'ShowSingleHelpMessageAgain',
  AddNotifications: 'AddNotifications',
  MarkAnyNotificationAsSeen: 'MarkAnyNotificationAsSeen',
  AddMeAsPageMember: 'AddMeAsPageMember',
  RemoveMeAsPageMember: 'RemoveMeAsPageMember',
  UpdateOnlineUsersLists: 'UpdateOnlineUsersLists',
  UpdateUserPresence: 'UpdateUserPresence',
  PatchTheStore: 'PatchTheStore',
};


export function loadMyself(afterwardsCallback?) {
  // The server has set new XSRF (and SID) cookie, and we need to
  // ensure old legacy <form> XSRF <input>:s are synced with the new cookie. But 1) the
  // $.ajaxSetup complete() handler that does tnis (in debiki.js) won't
  // have been triggered, if we're loggin in with OpenID — since such
  // a login happens in another browser tab. And 2) some e2e tests
  // cheat-login via direct calls to the database
  // and to `fireLogin` (e.g. so the tests don't take long to run).
  // And those tests assume we refresh XSRF tokens here.
  // So sync hidden form XSRF <input>s:
  debiki.internal.refreshFormXsrfTokens();

  // (Don't delete temp login cookies here, because this fn gets called if login is
  // detected in another tab — and perhaps yet another login has been started in that other
  // tab, and we don't want to break it by deleting cookies. Instead login temp cookies are
  // deleted by the server.)

  Server.loadMyself((user) => {
    ReactDispatcher.handleViewAction({
      actionType: actionTypes.NewMyself,
      user: user
    });
    if (afterwardsCallback) {
      afterwardsCallback();
    }
  });
}


export function newUserAccountCreated() {
  ReactDispatcher.handleViewAction({
    actionType: actionTypes.NewUserAccountCreated
  });
}


export function logout() {
  Server.logout(logoutClientSideOnly);
}


export function logoutClientSideOnly() {
  ReactDispatcher.handleViewAction({
    actionType: actionTypes.Logout
  });
  // Quick fix that reloads the admin page (if one views it) so the login dialog appears:
  location.reload();
}


export function saveCategory(category, success: () => void, error: () => void) {
  Server.saveCategory(category, (response) => {
    ReactDispatcher.handleViewAction({
      actionType: actionTypes.CreateEditForumCategory,
      allCategories: response.allCategories,
      newCategoryId: response.newCategoryId,
      newCategorySlug: response.newCategorySlug,
    });
    success();
  }, error);
}


export function deleteCategory(categoryId: number, success: () => void, error: () => void) {
  Server.deleteCategory(categoryId, (storePatch: StorePatch) => {
    patchTheStore(storePatch);
    success();
  }, error);
}


export function undeleteCategory(categoryId: number, success: () => void, error: () => void) {
  Server.undeleteCategory(categoryId, (storePatch: StorePatch) => {
    patchTheStore(storePatch);
    success();
  }, error);
}


export function setCategories(categories: Category[]) {
  ReactDispatcher.handleViewAction({
    actionType: actionTypes.SetCategories,
    categories: categories,
  });
}


export function pinPage(pinOrder: number, pinWhere: PinPageWhere, success: () => void) {
  Server.pinPage(pinWhere, pinOrder, () => {
    success();
    ReactDispatcher.handleViewAction({
      actionType: actionTypes.PinPage,
      pinOrder: pinOrder,
      pinWhere: pinWhere,
    });
  });
}


export function unpinPage(success: () => void) {
  Server.unpinPage(() => {
    success();
    ReactDispatcher.handleViewAction({
      actionType: actionTypes.UnpinPage,
    });
  });
}


export function deletePages(pageIds: PageId[], success: () => void) {
  Server.deletePages(pageIds, () => {
    success();
    ReactDispatcher.handleViewAction({
      actionType: actionTypes.DeletePages,
      pageIds: pageIds,
    });
  });
}


export function undeletePages(pageIds: PageId[], success: () => void) {
  Server.undeletePages(pageIds, () => {
    success();
    ReactDispatcher.handleViewAction({
      actionType: actionTypes.UndeletePages,
      pageIds: pageIds,
    });
  });
}


export function setPageNoftLevel(newNotfLevel) {
  Server.savePageNoftLevel(newNotfLevel);
  ReactDispatcher.handleViewAction({
    actionType: actionTypes.SetPageNotfLevel,
    newLevel: newNotfLevel
  });
}


export function cyclePageDone() {
  Server.cyclePageDone((response) => {
    ReactDispatcher.handleViewAction({
      actionType: actionTypes.CyclePageDone,
      plannedAtMs: response.plannedAtMs,
      doneAtMs: response.doneAtMs,
      closedAtMs: response.closedAtMs,
    });
  });
}


export function togglePageClosed() {
  Server.togglePageClosed((closedAtMs) => {
    ReactDispatcher.handleViewAction({
      actionType: actionTypes.TogglePageClosed,
      closedAtMs: closedAtMs
    });
  });
}


export function acceptAnswer(postId: number) {
  Server.acceptAnswer(postId, (answeredAtMs) => {
    ReactDispatcher.handleViewAction({
      actionType: actionTypes.AcceptAnswer,
      answeredAtMs: answeredAtMs,
      answerPostUniqueId: postId,
    });
  });
}


export function unacceptAnswer() {
  Server.unacceptAnswer(() => {
    ReactDispatcher.handleViewAction({
      actionType: actionTypes.UnacceptAnswer,
    });
  });
}


export function editTitleAndSettings(newTitle: string, settings: any, success: () => void,
      error: () => void) {
  Server.savePageTitleAndSettings(newTitle, settings, (response: any) => {
    success();
    ReactDispatcher.handleViewAction({
      actionType: actionTypes.EditTitleAndSettings,
      newTitlePost: response.newTitlePost,
      newAncestorsRootFirst: response.newAncestorsRootFirst,
      newPageRole: settings.pageRole,
      htmlTagCssClasses: settings.htmlTagCssClasses,
      htmlHeadTitle: settings.htmlHeadTitle,
      htmlHeadDescription: settings.htmlHeadDescription,
    });
  }, error);
}


export function showForumIntro(visible: boolean) {
  ReactDispatcher.handleViewAction({
    actionType: actionTypes.ShowForumIntro,
    visible: visible,
  });
}


export function editPostWithNr(postNr: number) {
  morebundle.loginIfNeededReturnToPost('LoginToEdit', postNr, () => {
    if (d.i.isInEmbeddedCommentsIframe) {
      sendToEditorIframe(['editorEditPost', postNr]);
    }
    else {
      // Right now, we don't need to use the Store for this.
      debiki2.editor.openEditorToEditPost(postNr);
    }
  });
}


export function handleEditResult(editedPost) {
  if (d.i.isInEmbeddedEditor) {
    sendToCommentsIframe(['handleEditResult', editedPost]);
  }
  else {
    debiki2.ReactActions.updatePost(editedPost);
  }
}


export function setPostHidden(postNr: number, hide: boolean, success?: () => void) {
  Server.hidePostInPage(postNr, hide, (postAfter) => {
    if (success) success();
    ReactDispatcher.handleViewAction({
      actionType: actionTypes.UpdatePost,
      post: postAfter
    });
  });
}


export function deletePost(postNr: number, repliesToo: boolean, success: () => void) {
  Server.deletePostInPage(postNr, repliesToo, (deletedPost) => {
    success();
    ReactDispatcher.handleViewAction({
      actionType: actionTypes.UpdatePost,
      post: deletedPost
    });
  });
}


// try to remove, use patchTheStore() instead
export function updatePost(post) {
  ReactDispatcher.handleViewAction({
    actionType: actionTypes.UpdatePost,
    post: post
  });
}


export function changePostType(post: Post, newType: PostType, success: () => void) {
  Server.changePostType(post.postId, newType, () => {
    success();
    post = clonePost(post.postId);
    post.postType = newType;
    ReactDispatcher.handleViewAction({
      actionType: actionTypes.UpdatePost,
      post: post
    });
  });
}


export function vote(post, doWhat: string, voteType: string) {
  ReactDispatcher.handleViewAction({
    actionType: actionTypes.VoteOnPost,
    post: post,
    doWhat: doWhat,
    voteType: voteType
  });
}


export function markPostAsRead(postId: number, manually: boolean) {
  ReactDispatcher.handleViewAction({
    actionType: actionTypes.MarkPostAsRead,
    postId: postId,
    manually: manually
  });
}


export function cycleToNextMark(postId: number) {
  ReactDispatcher.handleViewAction({
    actionType: actionTypes.CycleToNextMark,
    postId: postId
  });
}


export function summarizeReplies() {
  ReactDispatcher.handleViewAction({
    actionType: actionTypes.SummarizeReplies
  });
}


export function unsquashTrees(postId: number) {
  ReactDispatcher.handleViewAction({
    actionType: actionTypes.UnsquashTrees,
    postId: postId
  });
}


export function collapseTree(post: Post) {
  ReactDispatcher.handleViewAction({
    actionType: actionTypes.CollapseTree,
    post: post
  });
}


export function uncollapsePost(post) {
  ReactDispatcher.handleViewAction({
    actionType: actionTypes.UncollapsePost,
    post: post
  });
}


export function loadAndShowPost(postNr: PostNr, showChildrenToo?: boolean, callback?) {
  let anyPost = debiki2.ReactStore.allData().allPosts[postNr];
  if (!anyPost || _.isEmpty(anyPost.sanitizedHtml)) {
    Server.loadPostByNr(debiki.internal.pageId, postNr, (storePatch: StorePatch) => {
      patchTheStore(storePatch);
      showAndCallCallback();
    });
  }
  else {
    showAndCallCallback();
  }
  function showAndCallCallback() {
    ReactDispatcher.handleViewAction({
      actionType: actionTypes.ShowPost,
      postNr: postNr,
      showChildrenToo: showChildrenToo,
    });
    if (callback) {
      // Wait until React has rendered everything. (When exactly does that happen?)
      setTimeout(callback, 1);
    }
  }
}


/**
 * If #post-X is specified in the URL, ensures all posts leading up to
 * and including X have been loaded. Then scrolls to X.
 */
export function loadAndScrollToAnyUrlAnchorPost() {
  var anchorPostNr = anyAnchorPostNr();
  if (!anchorPostNr) {
    // No #post-X in the URL.
    return;
  }
  var $post = debiki.internal.findPost$(anchorPostNr);
  if (!$post.length) {
    loadAndShowPost(anchorPostNr, undefined, () => markAnyNotificationAsSeen(anchorPostNr));
  }
  else {
    debiki.internal.showAndHighlightPost($post);
    markAnyNotificationAsSeen(anchorPostNr);
  }
}


function anyAnchorPostNr(): number {
  // AngularJS (I think it is) somehow inserts a '/' at the start of the hash. I'd
  // guess it's Angular's router that messes with the hash. I don't want the '/' but
  // don't know how to get rid of it, so simply ignore it.
  var hashIsPostId = /#post-\d+/.test(location.hash);
  var hashIsSlashPostId = /#\/post-\d+/.test(location.hash);
  if (hashIsPostId) return parseInt(location.hash.substr(6, 999));
  if (hashIsSlashPostId) return parseInt(location.hash.substr(7, 999));
  return undefined;
}


export function openPagebar() { setPagebarOpen(true); }
export function closePagebar() { setPagebarOpen(false); }

export function togglePagebarOpen() {
  setPagebarOpen(!$('html').is('.es-pagebar-open'));
}

export function setPagebarOpen(open: boolean) {
  ReactDispatcher.handleViewAction({
    actionType: actionTypes.SetContextbarOpen,
    open: open,
  });
}


export function openWatchbar() { setWatchbarOpen(true); }
export function closeWatchbar() { setWatchbarOpen(false); }

export function toggleWatchbarOpen() {
  setWatchbarOpen(!$('html').is('.es-watchbar-open'));
}

export function setWatchbarOpen(open: boolean) {
  ReactDispatcher.handleViewAction({
    actionType: actionTypes.SetWatchbarOpen,
    open: open,
  });
}


export function setWatchbar(watchbar: Watchbar) {
  ReactDispatcher.handleViewAction({
    actionType: actionTypes.SetWatchbar,
    watchbar: watchbar,
  });
}


export function setHorizontalLayout(enabled: boolean) {
  ReactDispatcher.handleViewAction({
    actionType: actionTypes.SetHorizontalLayout,
    enabled: enabled
  });
}


export function hideHelpMessageWithId(messageId: string) {
  ReactDispatcher.handleViewAction({
    actionType: actionTypes.HideHelpMessage,
    messageId: messageId,
  });
}


export function hideHelpMessages(message) {
  ReactDispatcher.handleViewAction({
    actionType: actionTypes.HideHelpMessage,
    message: message,
  });
}


export function showSingleHelpMessageAgain(messageId: string) {
  ReactDispatcher.handleViewAction({
    actionType: actionTypes.ShowHelpAgain,
    messageId: messageId,
  });
}


export function showHelpMessagesAgain() {
  ReactDispatcher.handleViewAction({
    actionType: actionTypes.ShowHelpAgain,
  });
}


export function addNotifications(notfs: Notification[]) {
  ReactDispatcher.handleViewAction({
    actionType: actionTypes.AddNotifications,
    notifications: notfs,
  });
}


export function addMeAsPageMember() {
  ReactDispatcher.handleViewAction({
    actionType: actionTypes.AddMeAsPageMember,
  });
}


export function removeMeAsPageMember() {
  ReactDispatcher.handleViewAction({
    actionType: actionTypes.RemoveMeAsPageMember,
  });
}


export function updateUserPresence(user: BriefUser, presence: Presence) {
  ReactDispatcher.handleViewAction({
    actionType: actionTypes.UpdateUserPresence,
    user: user,
    presence: presence,
  });
}

export function updateOnlineUsersLists(numOnlineStrangers: number, onlineUsers: BriefUser[]) {
  ReactDispatcher.handleViewAction({
    actionType: actionTypes.UpdateOnlineUsersLists,
    numOnlineStrangers: numOnlineStrangers,
    onlineUsers: onlineUsers,
  });
}


function markAnyNotificationAsSeen(postNr: number) {
  // The store will tell the server that any notf has been seen.
  ReactDispatcher.handleViewAction({
    actionType: actionTypes.MarkAnyNotificationAsSeen,
    postNr: postNr,
  });
}


export function patchTheStore(storePatch: StorePatch) {
  ReactDispatcher.handleViewAction({
    actionType: actionTypes.PatchTheStore,
    storePatch: storePatch,
  });
}


export function openNotificationSource(notf: Notification) {
  if (notf.pageId && notf.postNr) {
    ReactActions.openPagePostNr(notf.pageId, notf.postNr);
  }
  else {
    die("Unknown notification type [EsE5GUKW2]")
  }
}


export function openPage(pageId: string) {
  window.location.assign(linkToPageId(pageId));
}


export function openPagePostNr(pageId: string, postNr: number) {
  window.location.assign(linkToPageId(pageId) + '#post-' + postNr);
}


export function openUserProfile(userId: any) {
  window.location.assign(linkToUserProfilePage(userId));
}


export function goToUsersNotifications(userId: any) {
  window.location.assign(linkToUserProfilePage(userId) + '/notifications');
}


export function writeMessage(userId: any) {
  // For now, until I've enabled react-router everywhere and won't have to reload the page.
  location.assign(linkToUserProfilePage(userId) + '/activity#writeMessage');
}


function sendToEditorIframe(message) {
  // Send the message to the embedding page; it'll forward it to the appropriate iframe.
  window.parent.postMessage(JSON.stringify(message), '*');
}

// An alias, for better readability.
var sendToCommentsIframe = sendToEditorIframe;


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 list
