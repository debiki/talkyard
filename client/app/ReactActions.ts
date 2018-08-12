/*
 * Copyright (c) 2014 Kaj Magnus Lindberg
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
/// <reference path="login/login-if-needed.ts" />

//------------------------------------------------------------------------------
   module debiki2.ReactActions {
//------------------------------------------------------------------------------


export const actionTypes = {
  NewMyself: 'NewMyself',
  Logout: 'Logout',
  NewUserAccountCreated: 'NewUserAccountCreated',
  CreateEditForumCategory: 'CreateEditForumCategory',
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
  ShowNewPage: 'ShowNewPage',
};


export function loadMyself(afterwardsCallback?) {
  // (Don't delete temp login cookies here, because this fn gets called if login is
  // detected in another tab — and perhaps yet another login has been started in that other
  // tab, and we don't want to break it by deleting cookies. Instead login temp cookies are
  // deleted by the server.)

  Server.loadMyself((user) => {
    if (eds.isInIframe) {
      // Tell the embedded comments or embedded editor iframe that we just logged in.
      window.parent.postMessage(JSON.stringify(['justLoggedIn', user]), eds.embeddingOrigin);
    }
    setNewMe(user);
    if (afterwardsCallback) {
      afterwardsCallback();
    }
  });
}


export function setNewMe(user) {
  ReactDispatcher.handleViewAction({
    actionType: actionTypes.NewMyself,
    user: user
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
  if (eds.isInEmbeddedCommentsIframe) {
    // Tell the editor iframe that we've logged out.
    window.parent.postMessage(JSON.stringify(['logoutClientSideOnly', null]), eds.embeddingOrigin);
  }
  // Abort any long polling request, so we won't receive data, for this user, after we've
  // logged out: (not really needed, because we reload() below)
  Server.abortAnyLongPollingRequest();
  // Quick fix that reloads the admin page (if one views it) so the login dialog appears:
  location.reload();
}


export function saveCategory(category: Category, permissions: PermsOnPage[],
      success: () => void, error: () => void) {
  Server.saveCategory(category, permissions, (response) => {
    ReactDispatcher.handleViewAction({
      actionType: actionTypes.CreateEditForumCategory,
      publicCategories: response.publicCategories,
      restrictedCategories: response.restrictedCategories,
      myNewPermissions: response.myNewPermissions,
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
      startedAtMs: response.startedAtMs,
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
    unacceptAnswerClientSideOnly();
  });
}


export function unacceptAnswerClientSideOnly() {
  ReactDispatcher.handleViewAction({
    actionType: actionTypes.UnacceptAnswer,
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
  login.loginIfNeededReturnToPost('LoginToEdit', postNr, () => {
    if (eds.isInEmbeddedCommentsIframe) {
      sendToEditorIframe(['editorEditPost', postNr]);
    }
    else {
      // Right now, we don't need to use the Store for this.
      debiki2.editor.openEditorToEditPost(postNr);
    }
  });
}


export function handleEditResult(editedPost) {
  if (eds.isInEmbeddedEditor) {
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
  Server.deletePostInPage(postNr, repliesToo, (response: { deletedPost, answerGotDeleted }) => {
    success();
    ReactDispatcher.handleViewAction({
      actionType: actionTypes.UpdatePost,
      post: response.deletedPost
    });
    if (response.answerGotDeleted) {
      // Already done server side. [2JPKBW0]
      unacceptAnswerClientSideOnly();
    }
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
  Server.changePostType(post.nr, newType, () => {
    success();
    post = clonePost(post.nr);
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
  const store: Store = debiki2.ReactStore.allData();
  const page: Page = store.currentPage;
  const anyPost = page.postsByNr[postNr];
  if (!anyPost || _.isEmpty(anyPost.sanitizedHtml)) {
    Server.loadPostByNr(postNr, (storePatch: StorePatch) => {
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
export function doUrlFragmentAction(newHashFragment?: string) {
  const fragAction = findUrlFragmentAction(newHashFragment);
  if (!fragAction)
    return;

  console.debug(`Doing url #action ${fragAction.type}...`);

  const postNr: PostNr | undefined = fragAction.postNr;
  if (!postNr) {
    switch (fragAction.type) {
      case FragActionType.ComposeDirectMessage:
        // For now, instead, see [4JABRF0].
        break;
      case FragActionType.ComposeForumTopic:
        Server.loadEditorAndMoreBundles(function() {
          const categoryId = 2; // for now
          const pageRole = PageRole.Discussion; // for now
          debiki2.editor.editNewForumPage(categoryId, pageRole);
        });
        break;
      default:
        die('TyE5AKBR3');
    }
    // Don't re-do the action, if going to another page, and then back.
    location.hash = '';
    return;
  }

  const postElem = $byId(`post-${postNr}`);
  if (postElem) {
    debiki.internal.showAndHighlightPost(postElem);
    doAfterLoadedAnyPost();
  }
  else {
    // (Will highlight it, right?)
    loadAndShowPost(postNr, undefined, doAfterLoadedAnyPost);
  }

  function doAfterLoadedAnyPost() {
    // If going to another page, and then back — just scroll to the post, this time, but
    // don't open the editor. (Doing that, feels unexpected and confusing, to me. If
    // navigating away, then, probably one is done editing? Or has maybe submitted
    // the post already.)
    location.hash = '#post-' + postNr;

    markAnyNotificationAsSeen(postNr);
    switch (fragAction.type) {
      case FragActionType.ReplyToPost:
        // CLEAN_UP Dupl code [5AKBR30W02]
        // Break out debiki2.ReactActions.editReplyTo(postNr)  action?
        if (eds.isInEmbeddedCommentsIframe) {
          window.parent.postMessage(
              JSON.stringify(['editorToggleReply', [postNr, true]]), eds.embeddingOrigin);
        }
        else {
          // Normal = incl in draft + url?
          Server.loadEditorAndMoreBundles(function() {
            debiki2.editor.toggleWriteReplyToPost(postNr, true, PostType.Normal);
          });
        }
        break;
      case FragActionType.EditPost:
        debiki2.ReactActions.editPostWithNr(postNr);
        break;
      case FragActionType.ScrollToLatestPost:
      case FragActionType.ScrollToPost:
        // Already scrolled to it.
        break;
      default:
        die('TyE2ABR67');
    }
  }
}


export function findUrlFragmentAction(hashFragment?: string): FragAction | undefined {
  const theHashFrag = firstDefinedOf(hashFragment, location.hash);

  if (theHashFrag.indexOf(FragActionHashScrollLatest) >= 0) {
    // Lookup most recent post nr. Is this a HACK? To access the store here?
    const store: Store = ReactStore.allData();
    const result = !store.currentPage ? undefined : {
      type: FragActionType.ScrollToLatestPost,
      postNr: page_mostRecentPostNr(store.currentPage),
    };
    return result;
  }

  if (theHashFrag.indexOf(FragActionHashComposeTopic) >= 0)
    return { type: FragActionType.ComposeForumTopic };

  if (theHashFrag.indexOf(FragActionHashComposeMessage) >= 0)
    return { type: FragActionType.ComposeDirectMessage };

  // The rest of the actions are for a specific post.

  const postNr: PostNr | undefined = findPostNrInHashFragment(theHashFrag);
  if (!postNr)
    return undefined;

  let actionType;
  if (theHashFrag.indexOf(FragActionAndEditPost) >= 0) {
    actionType = FragActionType.EditPost;
  }
  else if (theHashFrag.indexOf(FragActionAndReplyToPost) >= 0) {
    actionType = FragActionType.ReplyToPost;
  }
  else {
    actionType = FragActionType.ScrollToPost;
  }

  const draftNr: DraftNr | undefined = findDraftNrInHashFragment(theHashFrag);

  return { type: actionType, postNr, draftNr };
}


function findPostNrInHashFragment(theHash: string): PostNr | undefined {
  // AngularJS (I think it is) somehow inserts a '/' at the start of the hash. I'd
  // guess it's Angular's router that messes with the hash. I don't want the '/' but
  // don't know how to get rid of it, so simply ignore it.
  const hashIsPostId = /#post-\d+/.test(theHash);
  const hashIsSlashPostId = /#\/post-\d+/.test(theHash);
  if (hashIsPostId) return parseInt(theHash.substr(6, 999));
  if (hashIsSlashPostId) return parseInt(theHash.substr(7, 999));
}


function findDraftNrInHashFragment(hashFragment: string): DraftNr | undefined {
  const matches = /&draftNr=(\d+)/.exec(hashFragment);
  if (matches) {
    const draftNrStr = matches[1];
    return parseInt(draftNrStr);
  }
}


export function openPagebar() { setPagebarOpen(true); }
export function closePagebar() { setPagebarOpen(false); }

export function togglePagebarOpen() {
  const isOpen = Bliss('html').matches('.es-pagebar-open');
  setPagebarOpen(!isOpen);
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
  const isOpen = Bliss('html').matches('.es-watchbar-open');
  setWatchbarOpen(!isOpen);
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


export function maybeLoadAndShowNewPage(store: Store,
        history, location: Location, newLocation?: Location) {

  // No router, so no history or location, if in embedded comments discussion.
  if (!history || !location) {
    // @ifdef DEBUG
    dieIf(!store.isEmbedded, 'TyE5HKW2RK');
    dieIf(window.location.pathname !== '/-/embedded-comments', 'TyE2KREP0'); // [1FBZQ4]
    // @endif
    return;
  }

  let newUrlPath = newLocation ? newLocation.pathname : undefined;

  // If navigating within a mounted component. Maybe new query string?
  if (location.pathname === newUrlPath)
    return;

  // If the component just got mounted.
  if (!newUrlPath)
    newUrlPath = location.pathname;

  // The page can be in the store already, either 1) because it's included in html from the
  // server, or 2) because we were on the page, navigated away, and went back.
  // Or 3) because we just loaded it via '/-pageid', and now we're updating the url to
  // the correct page path, say '/forum/'. (4WKBT80)

  let hasPageAlready = false;
  let isThisPage = false;
  let gotNewHash = false;

  _.each(store.pagesById, (page: Page) => {
    if (isThisPage) return; // break loop

    const storePagePath = page.pagePath.value;

    // Is this page in the store the one we're navigating to?
    isThisPage = storePagePath === newUrlPath;

    // Maybe the url path is wrong? Case 3 above (4WKBT80): test '/-pageid' urls.
    if (!isThisPage) {
      isThisPage = urlPath_isToPageId(newUrlPath, page.pageId);
    }

    // In a forum, there's sth like '/latest/ideas' after the forum page path. So,
    // special check for forum pages; just a prefix match is enough.
    const storePageIsForum = page.pageRole === PageRole.Forum;
    const newPathIsToThatForum = storePageIsForum && urlPath_isToForum(newUrlPath, storePagePath);
    if (!isThisPage && storePageIsForum) {
      isThisPage = newPathIsToThatForum;
    }

    if (isThisPage) {
      hasPageAlready = true;
      if (page.pageId === store.currentPageId) {
        // We just loaded the whole html page from the server, and are already trying to
        // render 'page'. Or we clicked a '/-pageid#post-nr' link, to '/the-current-page'.
        // Need not do anything more here, except for maybe change from '/-pageid#post-nr'
        // back to '/the-current-page' + '#post-nr':
        const search = (newLocation ? newLocation.search : null) || location.search;
        const hash = (newLocation ? newLocation.hash : null) || location.hash;
        const gotNewSearch = search !== location.search;
        gotNewHash = hash !== location.hash;
        const somethingChanged = newUrlPath !== page.pagePath.value || gotNewSearch || gotNewHash;
        if (somethingChanged && !newPathIsToThatForum) {
          history.replace(page.pagePath.value + search + hash);
        }
      }
      else {
        // FOR NOW: since pushing of updates to [pages in the store other than the one
        // currently shown], is so very untested, for now, reload the json data always,
        // to be sure they're up-to-date. They are kept up-to-date automatically, if they're
        // in the watchbar's recent-pages list. But I haven't tested this properly, also,
        // the recent-pages-list might suffer from race conditions? and become out-of-date?
        hasPageAlready = false; // [8YDVP2A]
        /* Later:
        // If navigating back to EmptyPageId, maybe there'll be no myData; then create empty data.
        const myData = store.me.myDataByPageId[page.pageId] || makeNoPageData();
        showNewPage(page, [], myData);
        */
      }
    }
  });

  if (!hasPageAlready) {
    loadAndShowNewPage(newUrlPath, history);
  }
  else if (isThisPage && gotNewHash) {
    ReactActions.doUrlFragmentAction(newLocation.hash);
  }
}


export function loadAndShowNewPage(newUrlPath, history) {
  // UX maybe dim & overlay-cover the current page, to prevent interactions, until request completes?
  // So the user e.g. won't click Reply and start typing, but then the page suddenly changes.
  Server.loadPageJson(newUrlPath, response => {
    if (response.problemCode) {
      // COULD look at the code and do sth "smart" instead. But not urgent — only pages one
      // may access, should be shown & SPA-linked to anyway.
      die(`${response.problemMessage} [${response.problemCode}]`);
      return;
    }

    // This is the React store for showing the page at the new url path.
    const newStore: Store = JSON.parse(response.reactStoreJsonString);
    const pageId = newStore.currentPageId;
    const page = newStore.pagesById[pageId];
    const newUsers = _.values(newStore.usersByIdBrief);
    const newPublicCategories = newStore.publicCategories;

    // This'll trigger ReactStore onChange() event, and everything will redraw to show the new page.
    showNewPage(page, newPublicCategories, newUsers, response.me, history);
  });
}


export function showNewPage(newPage: Page | AutoPage, newPublicCategories, newUsers: BriefUser[],
        me: Myself, history: History) {
  ReactDispatcher.handleViewAction({
    actionType: actionTypes.ShowNewPage,
    newPage,
    newPublicCategories,
    newUsers,
    me,
    history,
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


export function openPage(pageId: string) {   // CLEAN_UP use LinkButton and href= instead
  window.location.assign(linkToPageId(pageId));
}


export function openPagePostNr(pageId: string, postNr: number) { // CLEAN_UP use LinkButton and href
  window.location.assign(linkToPageId(pageId) + '#post-' + postNr);
}


function sendToEditorIframe(message) {
  // Send the message to the embedding page; it'll forward it to the appropriate iframe.
  window.parent.postMessage(JSON.stringify(message), eds.embeddingOrigin);
}

// An alias, for better readability.
var sendToCommentsIframe = sendToEditorIframe;


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 list
