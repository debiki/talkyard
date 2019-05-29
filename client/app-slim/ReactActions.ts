/*
 * Copyright (c) 2014-2018 Kaj Magnus Lindberg
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

// REFACTOR SMALLER_BUNDLE [4WG20ABG2] try to remove ReactActions? Move the fns to the store instead,
// call directly? This ReactActions obj is just a pointless indirection.
// Also, remove the EventEmitter. I can write my own in 10 lines. The EventEmitter
// has 99% things that aren't needed in Talkyard's case. It just makes the slim-bundle larger.

//------------------------------------------------------------------------------
   namespace debiki2.ReactActions {
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
  AcceptAnswer: 'AcceptAnswer',
  UnacceptAnswer: 'UnacceptAnswer',
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
  // !
  // Try to add no more action types. Instead, use PatchTheStore for everything. [4WG20ABG2]
};


export function loadMyself(afterwardsCallback?) {
  // (Don't delete temp login cookies here, because this fn gets called if login is
  // detected in another tab — and perhaps yet another login has been started in that other
  // tab, and we don't want to break it by deleting cookies. Instead login temp cookies are
  // deleted by the server.)

  Server.loadMyself((user) => {
    if (isInSomeEmbCommentsIframe()) {
      // Tell the embedded comments or embedded editor iframe that we just logged in.
      window.parent.postMessage(JSON.stringify([
        'justLoggedIn', { user }]),  // [JLGDIN]
        eds.embeddingOrigin);
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


export function togglePageClosed(onDone?: () => void) {
  Server.togglePageClosed((closedAtMs) => {
    ReactDispatcher.handleViewAction({
      actionType: actionTypes.TogglePageClosed,
      closedAtMs: closedAtMs
    });
    if (onDone) {
      onDone();
    }
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


export function editTitleAndSettings(settings: EditPageRequestData, onDone: () => void,
      error?: () => void) {
  Server.savePageTitleAndSettings(settings, (response: EditPageResponse) => {
    if (onDone) onDone();
    ReactDispatcher.handleViewAction({
      ... response,
      actionType: actionTypes.EditTitleAndSettings,
      newPageRole: settings.pageRole,
      newDoingStatus: settings.doingStatus,
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
 * and including X have been loaded. Then scrolls to X, and maybe opens the editor
 * to edit it or to reply (depending on other hash fragment parts).
 * [7WKBQ28]
 */
export function doUrlFragmentAction(newHashFragment?: string) {
  // How we'll interpret a hash fragment action, might depend on what type of page we're at.
  // Is this a HACK? To access the store here?
  const store: Store = ReactStore.allData();
  const currentPage: Page | undefined = store.currentPage;

  const fragAction: FragAction = findUrlFragmentAction(newHashFragment);
  if (!fragAction) {
    // The default action for chat pages, is to scroll to the end.
    if (currentPage && page_isChatChannel(currentPage.pageRole)) {
      // dupl code [5UKP20]
      utils.scrollIntoViewInPageColumn('#thePageBottom');
    }
    return;
  }

  // @ifdef DEBUG
  console.debug(`Doing url #action ${fragAction.type}...`);
  // @endif

  const postNr: PostNr | undefined = fragAction.postNr;
  if (!postNr) {
    switch (fragAction.type) {
      case FragActionType.ComposeDirectMessage:
        // For now, instead handled in  maybeOpenMessageEditor() in users-page.more.ts [4JABRF0].
        break;
      case FragActionType.ComposeTopic:
        editor.editNewForumPage(fragAction.categoryId, fragAction.topicType);
        // Don't re-open the editor, if going to another page, and then back.
        location.hash = '';
        break;
      case FragActionType.ScrollToElemId:
        // Add some margin-top, so the topbar won't occlude the #elem-id.
        // There're CSS solutions, like: (see https://stackoverflow.com/a/28824157/694469)
        //    :target::before {
        //      content: '';
        //      display: block;
        //      height: 90px;
        //      margin-top: -90px;
        //      pointer-events: none;
        //    }
        // However that in some cases resulted in 90 px empty space, above the ::target
        // (i.e. #elem-id). So let's use js instead of css, like this:
        // (And let's wait 1 ms, to avoid any forced reflow during rendering.)
        setTimeout(function() {
          // moreThanTopbarHeight (below) works also if the topbar has wrapped to 2 lines,
          // if lots of contents. Don't try to dynamically find topbar height — the topbar
          // might suddently change its height, when the user scrolls down and the topbar
          // changes from a position:static to a fixed bar, which can look slightly different.
          const moreThanTopbarHeight = 90;
          utils.scrollIntoViewInPageColumn(fragAction.elemId, {
            marginTop: moreThanTopbarHeight, marginBottom: 999,
            // This id is from the url; maybe it's weird, not a valid css selector.
            maybeBadId: true,
          })
        }, 1);
        break;
      default:
        // @ifdef DEBUG
        die('TyE5AKBR3');
        // @endif
        void(0); // otherwise macro transpilation error
    }
    return;
  }

  const postAnchor = `post-${postNr}`;

  const postElem = $byId(postAnchor);
  if (postElem) {
    // Do frag action directly — post already loaded.
    debiki.internal.showAndHighlightPost(postElem);
    doAfterLoadedAnyPost();
  }
  else {
    // Load post, then do the frag action. (loadAndShowPost() highlights it, right?)
    loadAndShowPost(postNr, undefined, doAfterLoadedAnyPost);
  }

  function doAfterLoadedAnyPost() {
    let resetHashFrag = true;
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
        // Need not update the hash fragment — it contains only #post-nnn.
        resetHashFrag = false;
        break;
      default:
        die('TyE2ABR67');
    }

    // If going to another page, and then back — just scroll to the post, this time, but
    // don't open the editor. (Doing that, feels unexpected and confusing, to me. If
    // navigating away, then, probably one is done editing? Or has maybe submitted
    // the post already.)
    if (resetHashFrag) {
      // Does this sometimes make the browser annoyingly scroll-jump so this post is at
      // the very top of the win, occluded by the topbar?
      location.hash = '#' + postAnchor;
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

  const draftNr = findIntInHashFrag(FragParamDraftNr, theHashFrag);
  const topicType = findIntInHashFrag(FragParamTopicType, theHashFrag);

  if (theHashFrag.indexOf(FragActionHashComposeTopic) >= 0) {
    const categoryId = findIntInHashFrag(FragParamCategoryId, theHashFrag);
    return {
      type: FragActionType.ComposeTopic,
      draftNr,
      categoryId,
      topicType,
    };
  }

  if (theHashFrag.indexOf(FragActionHashComposeMessage) >= 0) {
    return {
      type: FragActionType.ComposeDirectMessage,
      topicType: PageRole.FormalMessage,
      draftNr,
    };
  }

  // The rest of the actions are for a specific post.

  const postNr: PostNr | undefined = findIntInHashFrag(FragParamPostNr, theHashFrag);
  if (!postNr) {
    return !theHashFrag ? undefined : {
      type: FragActionType.ScrollToElemId,
      elemId: theHashFrag,
    };
  }

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

  return { type: actionType, postNr, draftNr };
}


function findIntInHashFrag(valuePrefix: string, theHash: string): PostNr | undefined {
  const index = theHash.indexOf(valuePrefix);
  const anyInt = index >= 0 ? parseInt(theHash.substr(index + valuePrefix.length, 999)) : undefined;
  return _.isNaN(anyInt) ? undefined : anyInt;
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
      // Code 404 Not Found  happens if page delted, or moved to a cat one may not access.
      switch (response.problemCode) {
        case 404:
          let closeDialogFn;
          function goBack() {
            closeDialogFn();
            history.goBack();
          }
          morebundle.openDefaultStupidDialog({ dialogClassName: 'e_NoPg',
              // Closing the dialog would leave the user stranded on an empty broken page.
              preventClose: true,
              getCloseFn: fn => closeDialogFn = fn,
              body: rFragment({},
                // I18N:
                r.p({}, "This page has been deleted, or it never existed, or you may not access it."),
                r.p({}, r.a({ onClick: goBack }, "Go back to last page"))) });
          break;
        default:
          die(`${response.problemMessage} [${response.problemCode}]`);
      }
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
