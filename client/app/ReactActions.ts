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

/// <reference path="ReactDispatcher.ts" />
/// <reference path="Server.ts" />
/// <reference path="../shared/plain-old-javascript.d.ts" />

//------------------------------------------------------------------------------
   module debiki2.ReactActions {
//------------------------------------------------------------------------------


export var actionTypes = {
  Login: 'Login',
  Logout: 'Logout',
  NewUserAccountCreated: 'NewUserAccountCreated',
  CreateForumCategory: 'CreateForumCategory',
  PinPage: 'PinPage',
  UnpinPage: 'UnpinPage',
  SetPageNotfLevel: 'SetPageNotfLevel',
  EditTitleAndSettings: 'EditTitleAndSettings',
  UpdatePost: 'UpdatePost',
  VoteOnPost: 'VoteOnPost',
  MarkPostAsRead: 'MarkPostAsRead',
  CycleToNextMark: 'CycleToNextMark',
  SummarizeReplies: 'SummarizeReplies',
  CollapseTree: 'CollapseTree',
  UncollapsePost: 'UncollapsePost',
  SetHorizontalLayout: 'SetHorizontalLayout',
  ChangeSiteStatus: 'ChangeSiteStatus',
}


export function login() {
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

  Server.loadMyPageData((user) => {
    ReactDispatcher.handleViewAction({
      actionType: actionTypes.Login,
      user: user
    });
  });
}


export function newUserAccountCreated() {
  ReactDispatcher.handleViewAction({
    actionType: actionTypes.NewUserAccountCreated
  });
}


export function logout() {
  ReactDispatcher.handleViewAction({
    actionType: actionTypes.Logout
  });
}


export function createForumCategory(categoryData, success: () => void) {
  Server.createForumCategory(categoryData, (response) => {
    ReactDispatcher.handleViewAction({
      actionType: actionTypes.CreateForumCategory,
      allCategories: response.allCategories,
      newCategoryId: response.newCategoryId,
      newCategorySlug: response.newCategorySlug,
    });
    success();
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


export function setPageNoftLevel(newNotfLevel) {
  Server.savePageNoftLevel(newNotfLevel);
  ReactDispatcher.handleViewAction({
    actionType: actionTypes.SetPageNotfLevel,
    newLevel: newNotfLevel
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
    });
  }, error);
}


export function updatePost(post) {
  ReactDispatcher.handleViewAction({
    actionType: actionTypes.UpdatePost,
    post: post
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


export function setHorizontalLayout(enabled: boolean) {
  ReactDispatcher.handleViewAction({
    actionType: actionTypes.SetHorizontalLayout,
    enabled: enabled
  });
}


export function changeSiteStatus(newStatus: string) {
  ReactDispatcher.handleViewAction({
    actionType: actionTypes.ChangeSiteStatus,
    newStatus: newStatus
  });
}

//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 list
