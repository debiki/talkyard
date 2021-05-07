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
// call directly? This ReactActions obj is just a pointless indirection. [flux_mess]
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


export function loadMyself(afterwardsCallback?: () => Vo) {
  // (Don't delete temp login cookies here, because this fn gets called if login is
  // detected in another tab — and perhaps yet another login has been started in that other
  // tab, and we don't want to break it by deleting cookies. Instead login temp cookies are
  // deleted by the server.)

  Server.loadMyself((user) => {
    // @ifdef DEBUG
    // Might happen if there was no weakSessionId, and also, no cookie.
    dieIf(!user, 'TyE4032SMH57');
    // @endif
    if (isInSomeEmbCommentsIframe()) {
      // Tell the embedded comments or embedded editor iframe that we just logged in,
      // also include the session id, so Talkyard's script on the embedding page
      // can remember it — because cookies and localstorage in an iframe typically
      // get disabled by tracker blockers (they block 3rd party cookies).
      const mainWin = getMainWin();
      const typs: PageSession = mainWin.typs;
      const weakSessionId = typs.weakSessionId;
      const store: Store = ReactStore.allData();
      const settings: SettingsVisibleClientSide = store.settings;
      const rememberEmbSess =
              settings.rememberEmbSess !== false &&
              // If we got logged in automatically, then logout will be automatic too
              // — could be surprising if we had to click buttons to log out,
              // when we didn't need to do that, to log in.
              typs.sessType !== SessionType.AutoTokenSiteCustomSso;
      if (mainWin !== window) {
        mainWin.theStore.me = _.cloneDeep(user);
      }
      sendToOtherIframes([
        'justLoggedIn', { user, weakSessionId, pubSiteId: eds.pubSiteId,  // [JLGDIN]
              sessionType: null, rememberEmbSess }]);
    }
    setNewMe(user);
    if (afterwardsCallback) {
      afterwardsCallback();
    }
  });
}


export function setNewMe(user) {
  // @ifdef DEBUG
  dieIf(!user, `setNewMe(nothing) TyE60MRJ46RS`);
  // @endif
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


//------------------------------------------------------
// REFACTOR  Move these to an Authn module?  [ts_authn_modl]
// Together with Server.deleteTempSessId() and Server.rememberTempSession().


export function logout() {
  Server.logoutServerAndClientSide();
}


export function logoutClientSideOnly(ps: { goTo?: St, skipSend?: Bo } = {}) {
  Server.deleteTempSessId();

  ReactDispatcher.handleViewAction({
    actionType: actionTypes.Logout
  });

  if (eds.isInEmbeddedCommentsIframe && !ps.skipSend) {
    // Tell the editor iframe that we've logged out.
    // And maybe we'll redirect the embedd*ing* window.  [sso_redir_par_win]
    sendToOtherIframes(['logoutClientSideOnly', ps]);

    // Probaby not needed, since reload() below, but anyway:
    patchTheStore({ setEditorOpen: false });
    const sessWin: MainWin = getMainWin();
    delete sessWin.typs.weakSessionId;
    sessWin.theStore.me = 'TyMLOGDOUT' as any;
  }

  // Disconnect WebSocket so we won't receive data, for this user, after we've
  // logged out: (we reload() below — but the service-worker might stay connected)
  pubsub.disconnectWebSocket();

  if (ps.goTo) {
    if (eds.isInIframe) {
      // Then we'll redirect the parent window instead. [sso_redir_par_win]
    }
    else {
      location.assign(ps.goTo);
    }
    // If that for some reason won't do anything, then make sure we really forget
    // all logged in state anyway:
    setTimeout(function() {
      logW(`location.assign(${ps.goTo}) had no effect? Reloading anyway...`);
      location.reload();
    }, 2000);
  }
  else {
    // Quick fix that reloads the admin page (if one views it) so login dialog appears.
    // But don't do in the goTo if branch — apparently location.reload()
    // cancels location.assign(..) — even if done on the lines after (!).
    location.reload();
  }
}

//------------------------------------------------------


export function saveCategory(category: Category, permissions: PermsOnPage[],
      success: (response: SaveCategoryResponse) => void, error: () => void) {
  Server.saveCategory(category, permissions, (response: SaveCategoryResponse) => {
    ReactDispatcher.handleViewAction({
      actionType: actionTypes.CreateEditForumCategory,
      publicCategories: response.publicCategories,
      restrictedCategories: response.restrictedCategories,
      myNewPermissions: response.myNewPermissions,
      newCategorySlug: response.newCategorySlug,
    });
    success(response);
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
    // CLEAN_UP  REFACTOR  use patchTheStore( StorePatch.deletedPageIds )  instead
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


export function editPostWithNr(postNr: PostNr, inWhichWin?: MainWin) {
  login.loginIfNeededReturnToPost(LoginReason.LoginToEdit, postNr, () => {
    if (eds.isInEmbeddedCommentsIframe) {
      // [many_embcom_iframes]
      sendToEditorIframe(['editorEditPost', postNr]);
    }
    else {
      // Right now, we don't need to use the Store for this.
      editor.openToEditPostNr(postNr, undefined, inWhichWin);
    }
  });
}


export function handleEditResult(editedPost: Post, sendToWhichFrame?: MainWin) {
  if (eds.isInEmbeddedEditor) {
    sendToCommentsIframe(['handleEditResult', editedPost], sendToWhichFrame);
  }
  else {
    // Forget any pre-edits cached post — we no longer need to restore it
    // when the editor closes and we remove any preview, because we've saved the edits.
    if (origPostBeforeEdits) {
      // @ifdef DEBUG
      dieIf(editedPost.nr !== origPostBeforeEdits.nr,
            `Preview post, and the now edited and saved post, are different:
            nr ${editedPost.nr} and ${origPostBeforeEdits.nr} respectively,
            here's the cached post: ${JSON.stringify(origPostBeforeEdits)},
            and the edited post: ${JSON.stringify(editedPost)} [TyE3056MR35]`);
      // @endif
      origPostBeforeEdits = null;
    }
    updatePost(editedPost);
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
export function updatePost(post: Post) {
  ReactDispatcher.handleViewAction({
    actionType: actionTypes.UpdatePost,
    post: post
  });
}


export function changePostType(post: Post, newType: PostType, onDone: () => void) {
  Server.changePostType(post.nr, newType, () => {
    onDone();
    post = clonePost(post.nr);
    post.postType = newType;
    ReactDispatcher.handleViewAction({
      actionType: actionTypes.UpdatePost,
      post: post
    });
  });
}


export function vote(storePatch: StorePatch, doWhat: 'DeleteVote' | 'CreateVote',
        voteType: St, postNr: PostNr) {
  ReactDispatcher.handleViewAction({
    actionType: actionTypes.VoteOnPost,
    storePatch,
    doWhat,
    voteType,
    postNr,
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


export function unsquashTrees(postNr: number) {
  ReactDispatcher.handleViewAction({
    actionType: actionTypes.UnsquashTrees,
    postNr
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


// COULD RENAME to loadIfNeededThenShow(AndHighlight)Post
export function loadAndShowPost(postNr: PostNr, showPostOpts: ShowPostOpts = {},
       onDone?: (post?: Post) => void) {

  //  COULD  sendToCommentsIframe(['loadAndShowPost', nr]);   ???

  const store: Store = ReactStore.allData();
  const page: Page = store.currentPage;
  const anyPost = page.postsByNr[postNr];

  // If post missing, or text not loaded — then, we need to load it.
  // However draft posts have unsafeSource only, not any preview html. [DFTSRC]
  const needLoadPost = !anyPost ||
      (_.isEmpty(anyPost.sanitizedHtml) && !anyPost.isForDraftNr);

  if (needLoadPost) {
    Server.loadPostByNr(postNr, (storePatch: StorePatch) => {
      // (The server should have replied 404 Not Found if post not found; then,
      // this code wouldn't run.)
      patchTheStore(storePatch);
      const posts: Post[] = storePatch.postsByPageId && storePatch.postsByPageId[page.pageId];
      // @ifdef DEBUG
      dieIf(posts?.length !== 1, 'TyE06QKUSMF4');
      // @endif
      const post: Post = posts && posts[0];
      scrollAndShowPost(post, showPostOpts, onDone);
    });
  }
  else {
    scrollAndShowPost(anyPost, showPostOpts, onDone);
  }
}


export function scrollAndShowPost(postOrNr: Post | PostNr, anyShowPostOpts?: ShowPostOpts,
       onDone?: (post?: Post) => void) {

  if (eds.isInEmbeddedEditor) {
    const nr = _.isNumber(postOrNr) ? postOrNr : postOrNr.nr;
    sendToCommentsIframe(['scrollToPostNr', nr], anyShowPostOpts.inFrame);
    return;
  }

  const store: Store = ReactStore.allData();
  let post: Post;
  if (_.isNumber(postOrNr)) {
    const page: Page = store.currentPage;
    post = page.postsByNr[postOrNr];
    if (!post) {
      // @ifdef DEBUG
      die('TyE20962SKGPJ')
      // @endif
      return;
    }
  }
  else {
    post = postOrNr;
  }

  // Adjust scroll margins?
  const showPostOpts: ShowPostOpts = { ...anyShowPostOpts };
  let marginTop = showPostOpts.marginTop || 0;
  // We don't want the topbar to occlude the whatever we're scrolling to.
  // COULD do in utils.scrollIntoView() instead?  [306KDRGFG2]
  marginTop += topbar.getTopbarHeightInclShadow();
  if (store_isReplyingToOrEditing(store, post)) {
    // Add more margin so "Replying to:" above also will scroll into view. [305KTJ4]
    marginTop += 75;
  }
  showPostOpts.marginTop = marginTop;

  // Try to not scroll so much, that can be confusing; use fairly small margins by default.
  showPostOpts.marginBottom = showPostOpts.marginBottom ?? 50;

  // ----- Dupl code [0396AKTSSJ46]
  let editorHeight = 0;
  if (eds.isInEmbeddedCommentsIframe) {
    try {
      editorHeight = window.parent.frames['edEditor'].innerHeight || 0;
    }
    catch (ex) {
      console.warn("Error reading editor iframe height [TyE603KSNJ507]", ex);
    }
  }
  // ----- /Dupl code
  showPostOpts.marginBottom += editorHeight;

  ReactDispatcher.handleViewAction({
    actionType: actionTypes.ShowPost,
    postNr: post.nr,
    showPostOpts,
    onDone: function() {
      onDone?.(post);
    },
  });
}


export function highlightPost(postNr: PostNr, highlightOn: boolean) {  // RENAME to outlinePost ?
  const elem = $byId('post-' + postNr);
  highlightImpl(elem, highlightOn);
}


export function highlightPreview(highlightOn: boolean) {  // RENAME to outlinePreview ?
  const elem = findPreviewPost();
  highlightImpl(elem, highlightOn);
}


function findPreviewPost(): Element {
  // We don't know if the preview is for a reply, orig post or chat message
  // — try finding the preview at all those "places".   (206702364)
  return (
      $first('.s_T-Prvw-IsEd .dw-p') ||
      $first('.dw-ar-p') ||
      $first('.s_T_YourPrvw + .esC_M'));
}


function highlightImpl(elem, highlightOn: boolean) {

  //  COULD  sendToCommentsIframe(['highlightImpl', nr]);   ???

  if (highlightOn) {
    debiki2.$h.addClasses(elem, 'dw-highlighted-multireply-hover');
  }
   else {
    debiki2.$h.removeClasses(elem, 'dw-highlighted-multireply-hover');
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
    if (currentPage && page_isChat(currentPage.pageRole)) {
      // dupl code [5UKP20]
      utils.scrollIntoViewInPageColumn('#thePageBottom');
    }
    return;
  }

  // @ifdef DEBUG
  console.debug(`Doing url frag action ${toStr(fragAction)}...`);
  // @endif

  const postNr: PostNr | undefined = fragAction.postNr;
  if (!postNr) {
    switch (fragAction.type) {
      case FragActionType.ComposeDirectMessage:
        // For now, instead handled in  maybeOpenMessageEditor() in users-page.more.ts [4JABRF0].
        break;
      case FragActionType.ComposeTopic:
        editor.editNewForumPage(fragAction.category, fragAction.topicType);
        // Don't re-open the editor, if going to another page, and then back.
        history.replaceState({}, '', '#');
        break;
      case FragActionType.ScrollToSelector:
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
          utils.scrollIntoViewInPageColumn(fragAction.selector, {
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

  if (store.isEditorOpen) {
    // Then we cannot open any draft in the editor (since it's open already)
    // — ignore the frag action, and just scroll to the post or reply draft.
    // If this is a reply draft, we need to calculate its temporary dummy post nr.
    let nr2 = postNr;
    if (fragAction.type === FragActionType.ReplyToPost) {
      nr2 = post_makePreviewIdNr(postNr, fragAction.replyType);
    }
    loadAndShowPost(nr2);
    return;
  }

  // Load post if needed, highlight it, and do the frag action.
  loadAndShowPost(postNr, {}, function(post?: Post) {
    let resetHashFrag = true;
    markAnyNotificationAsSeen(postNr);
    switch (fragAction.type) {
      case FragActionType.ReplyToPost:
        if (post) {
          composeReplyTo(postNr, fragAction.replyType);
        }
        break;
      case FragActionType.EditPost:
        if (post) {
          editPostWithNr(postNr);
        }
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
    // the post already.) [RSTHASH]
    if (resetHashFrag) {
      // Don't link to the orig post, that's just annoying (if navigating back,
      // and the #post-1 hash makes the page jump to the top all the time).
      // (Need '#' because just '' apparently has no effect.)
      const newHash = postNr === BodyNr ? '#' : `#post-${postNr}`;
      // Does this sometimes make the browser annoyingly scroll-jump so this post is at
      // the very top of the win, occluded by the topbar? [4904754RSKP]
      history.replaceState({}, '', newHash);
    }
  });
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
  const replyType = findIntInHashFrag(FragParamReplyType, theHashFrag);
  const topicType = findIntInHashFrag(FragParamTopicType, theHashFrag);

  if (theHashFrag.indexOf(FragActionHashComposeTopic) >= 0) {
    // Example url:  http://site.localhost/#composeTopic&category=slug:ideas
    // (The editor then uses the default topic type, for that category. [05AKTD5J])
    const categoryId = findIntInHashFrag(FragParamCategoryId, theHashFrag);
    const categoryRef = !categoryId && findStrInHashFrag(FragParamCategory, theHashFrag);
    return {
      type: FragActionType.ComposeTopic,
      draftNr,
      category: categoryId || categoryRef,
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

  if (theHashFrag.indexOf(FragActionHashScrollToBottom) >= 0) {
    return {
      type: FragActionType.ScrollToSelector,
      selector: '.s_APAs',
    };
  }

  // The rest of the actions are for a specific post.

  const postNr: PostNr | undefined = findIntInHashFrag(FragParamPostNr, theHashFrag);
  if (!postNr) {
    return !theHashFrag ? undefined : {
      type: FragActionType.ScrollToSelector,
      selector: theHashFrag,
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

  return {
    type: actionType,
    postNr,
    draftNr,
    replyType,
  };
}


function findIntInHashFrag(valuePrefix: string, theHash: string): PostNr | undefined {
  const index = theHash.indexOf(valuePrefix);
  const anyInt = index >= 0 ? parseInt(theHash.substr(index + valuePrefix.length, 999)) : undefined;
  return _.isNaN(anyInt) || anyInt < -TooHighNumber || TooHighNumber < anyInt ?
      undefined : anyInt;
}


function findStrInHashFrag(valuePrefix: St, theHash: St): St | U {
  const start = theHash.indexOf(valuePrefix);
  if (start === -1) return undefined;
  const valueStart = start + valuePrefix.length;
  const end = indexOfAmpHash(theHash, valueStart);
  const value = theHash.substr(valueStart, end >= 0 ? end : undefined);
  return value;
}


// Returns -1 if none of [#&] found.
//
function indexOfAmpHash(text: St, start: Nr): Nr {
  // Sometimes Talkyard uses # as a hash frag param separator.
  const nextHash = text.indexOf('#', start);
  const nextAmp = text.indexOf('&', start);
  return nextHash === -1 ? nextAmp : (
                nextAmp === -1 ? nextHash : (
                  Math.min(nextAmp, nextHash)));
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


export function configWatchbar(ps: { removePageIdFromRecent }) {
  Server.configWatchbar(ps, setWatchbar);
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


export function hideTips(message: { id: St, version?: Nr }) {
  Server.toggleTips({ tipsId: message.id, hide: true });
  ReactDispatcher.handleViewAction({
    actionType: actionTypes.HideHelpMessage,
    message: message,
  });
}


export function showSingleTipsClientSide(messageId: string) {
  ReactDispatcher.handleViewAction({
    actionType: actionTypes.ShowHelpAgain,
    messageId: messageId,
  });
}


export function showTipsAgain(ps: { onlyAnnouncements?: Bo } = {}) {
  Server.toggleTips({ ...ps, hide: false });
  ReactDispatcher.handleViewAction({
    ...ps,
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


export function snoozeUntilMins(whenMins: WhenMins | false) {
  Server.snoozeNotfs(whenMins, () => {
    const myselfPatch: MyselfPatch = {
      snoozeUntilMins: whenMins,
    }
    patchTheStore({ me: myselfPatch });
  });
}


function markAnyNotificationAsSeen(postNr: number) {
  // The store will tell the server that any notf has been seen.
  ReactDispatcher.handleViewAction({
    actionType: actionTypes.MarkAnyNotificationAsSeen,
    postNr: postNr,
  });
}


export function onEditorOpen(ps: EditorStorePatch, onDone?: () => void) {
  if (eds.isInEmbeddedEditor) {
    sendToCommentsIframe(['onEditorOpen', ps]);
  }
  const patch: EditorStorePatch = { ...ps, setEditorOpen: true };
  patchTheStore(patch, onDone);
}



let origPostBeforeEdits: Post | undefined;
let lastFlashPostNr: PostNr | undefined;


export function showEditsPreviewInPage(ps: ShowEditsPreviewParams, inFrame?: DiscWin) {
  // @ifdef DEBUG
  dieIf(ps.replyToNr && ps.editingPostNr, 'TyE73KGTD02');
  dieIf(ps.replyToNr && !ps.anyPostType, 'TyE502KGSTJ46');
  // @endif

  if (eds.isInEmbeddedEditor) {
    const editorIframeHeightPx = window.innerHeight;
     // DO_AFTER 2020-09-01 send 'showEditsPreviewInPage' instead.
    sendToCommentsIframe(
            ['showEditsPreview', { ...ps, editorIframeHeightPx }], inFrame);
    return;
  }

  const store: Store = ReactStore.allData();
  const me: Myself = store.me;

  if (me_uiPrefs(me).inp === UiPrefsIninePreviews.Skip) {
    if (ps.replyToNr && ps.replyToNr !== lastFlashPostNr) {
      lastFlashPostNr = ps.replyToNr;
      flashPostNrIfThere(ps.replyToNr);
    }
    return;
  }

  // If' we've navigated to a different page, then, any preview is gone already.
  const isOtherPage = ps.editorsPageId && ps.editorsPageId !== store.currentPageId;
  if (isOtherPage)
    return;

  // Quick hack, dupl code: If in iframe, and page got lazy-created, its store.pagesById
  // is wrong — so just access it via store.currentPage instead. [UPDLZYPID]
  const page = eds.isInIframe ? store.currentPage : (
      ps.editorsPageId ? store.pagesById[ps.editorsPageId] : store.currentPage);
  // @ifdef DEBUG
  dieIf(!page, 'TyE3930KRG');
  // @endif

  if (!page)
    return;

  const isChat = page_isChat(page.pageRole);

  // A bit dupl debug checks (49307558).
  // @ifdef DEBUG
  // Chat messages don't reply to any particular post — has no parent nr. [CHATPRNT]
  dieIf(ps.replyToNr && isChat, 'TyE7WKJTGJ024');
  // If no page id included, then either 1) we're in the embedded comments editor
  // — doesn't include any page id when sending the showEditsPreviewInPage message to the
  // main iframe; it doesn't know which page we're looking at. Or 2) we're in
  // a chat — then, currently no page id included. Or 3) if we're in the api
  // section, then there's no page.
  dieIf(!ps.editorsPageId && !eds.isInEmbeddedCommentsIframe &&
      !isChat && location.pathname.indexOf(ApiUrlPathPrefix) === -1, 'TyE630KPR5');
  // @endif

  let patch: StorePatch;

  if (ps.editingPostNr) {
    // Replace the real post with a copy that includes the edited html. [EDPVWPST]
    const postToEdit = page.postsByNr[ps.editingPostNr];
    if (!origPostBeforeEdits) {
      origPostBeforeEdits = postToEdit;
    }
    patch = page_makeEditsPreviewPatch(page, origPostBeforeEdits, ps.safeHtml);
    patch.editingPostId = postToEdit.uniqueId;
  }
  else if (ps.replyToNr || isChat) {
    const postType = ps.anyPostType || PostType.ChatMessage;
    // Show an inline preview, where the reply will appear.
    patch = store_makeNewPostPreviewPatch(
        store, page, ps.replyToNr, ps.safeHtml, postType);
    patch.replyingToPostNr = ps.replyToNr;
  }

  // @ifdef DEBUG
  dieIf(!patch, 'TyE5WKDAW25');
  // @endif

  if (patch) {
    patch.editorsPageId = ps.editorsPageId;
    patchTheStore(patch, () => {
      // The preview won't appear until a bit later, after the preview post
      // store patch has been applied — currently the wait-a-bit code is
      // a tiny bit hacky: [SCROLLPRVW].
      if (ps.scrollToPreview) {
        scrollToPreview({
          isChat,
          isEditingBody: ps.editingPostNr === BodyNr,
          editorIframeHeightPx: ps.editorIframeHeightPx,
          highlightPreview: ps.highlightPreview,
        });
      }
    });
  }
}


export function scrollToPreview(ps: {
        // COULD remove  isChat and  isEditingBody, and instad find the
        // preview by using $first like in findPreviewPost().   (206702364)
        isChat?: boolean,
        isEditingBody?: boolean,
        editorIframeHeightPx?: number,
        highlightPreview?: boolean,
       } = {}) {

  if (eds.isInEmbeddedEditor) {
    const editorIframeHeightPx = window.innerHeight;   // maybe remove? [95BKAEPG240]
    sendToCommentsIframe(['scrollToPreview', { ...ps, editorIframeHeightPx }]);
    return;
  }

  // Break out function? Also see FragActionHashScrollToBottom, tiny bit dupl code.
  // Scroll to the preview we're currently editing (not to any inactive draft previews).
  // Hmm, this not really needed, instead, use findPreviewPost()  (206702364)  ?
  const selector = ps.isEditingBody ? '.dw-ar-t > .s_T_YourPrvw' : (
      ps.isChat ? '.s_T_YourPrvw + .esC_M' : '.s_T-Prvw-IsEd');

  // If editing body, use some more margin, so the page title and "By (author)"
  // stays visible — and, in a chat, so that the "Preview:" text is visible
  // (it's not included in `selector`).
  const isReplyingToOp = false; // todo
  const marginTop = ps.isEditingBody || isReplyingToOp || ps.isChat ? 110 : 50;

  // ----- Dupl code [0396AKTSSJ46]
  // If we're in an embedded comments iframe, then, there's another iframe for the
  // editor. Then scroll a bit more, so that other iframe won't occlude the preview.
  let editorHeight = ps.editorIframeHeightPx || 0;
  if (eds.isInEmbeddedCommentsIframe) {
    // This is better? Works also when starting scrolling from inside the comments
    // iframe — then, the editor iframe hasn't sent any message that included
    // its height, so `= ps.editorIframeHeightPx` (just above) won't work . But this
    // is not so tested (Jan 2020) so wrap in try-catch. [95BKAEPG240]
    try {
      editorHeight = window.parent.frames['edEditor'].innerHeight || 0;
    }
    catch (ex) {
      console.warn("Error reading editor iframe height [TyE3062RKP4]", ex);
    }
  }
  // ----- /Dupl code

  // Or, if we're in a chat, there's a chat text box at the bottom, on top of
  // the chat messages.
  if (ps.isChat) {
    // @ifdef DEBUG
    dieIf(editorHeight !== 0, 'TyE406KWSDJS23');
    // @endif
    const editorElem = $first('.esC_Edtr');
    editorHeight = editorElem?.clientHeight || 0;
  }

  utils.scrollIntoViewInPageColumn(selector, {
    marginTop,
    marginBottom: 30 + editorHeight,
    onDone: ps.highlightPreview === false ? null : function() {
      const elem = findPreviewPost();
      if (!elem) {
        // We might just have navigated to a different page, fine.
        return;
      }
      flashPostElem(elem);
    },
  });
}


export function hideEditor() {
  patchTheStore({ setEditorOpen: false });
}


export function hideEditorAndPreview(ps?: HideEditorAndPreviewParams, inFrame?) {
  // @ifdef DEBUG
  dieIf(ps.replyToNr && ps.editingPostNr, 'TyE4KTJW035M');
  dieIf(ps.replyToNr && !ps.anyPostType, 'TyE72SKJRW46');
  // @endif

  if (eds.isInEmbeddedEditor) {
    sendToCommentsIframe(['hideEditorAndPreview', ps], inFrame);
    sendToParent(['hideEditor']);
    patchTheStore({ setEditorOpen: false });
    return;
  }

  const store: Store = ReactStore.allData();

  // Quick hack, dupl code: If in iframe, and page got lazy-created, its store.pagesById
  // is wrong — so just access it via store.currentPage instead. [UPDLZYPID]
  const page = eds.isInIframe ? store.currentPage : (
      ps.editorsPageId ? store.pagesById[ps.editorsPageId] : store.currentPage);
  const isChat = page && page_isChat(page.pageRole);

  // If' we've navigated to a different page, then, any preview is gone already.
  const isOtherPage = ps.editorsPageId && ps.editorsPageId !== store.currentPageId;
  // editorsPageId  has been updated already, if was typing the first reply
  // on a new now lazy-created page [4HKW28] — then, !isOtherPage, so below,
  // we'll pick the remove-preview if branch [.rm_prv_if_br].

  // A bit dupl debug checks (49307558).
  // @ifdef DEBUG
  dieIf(!page, 'TyE407AKSHPW24');
  dieIf(ps.replyToNr && isChat, 'TyE62SKHSW604');
  dieIf(!ps.editorsPageId && !eds.isInEmbeddedCommentsIframe &&
      !isChat && location.pathname.indexOf(ApiUrlPathPrefix) === -1, 'TyE6QSADTH04');
  // @endif

  let patch: StorePatch = {};
  let highlightPostNrAfter: PostNr;

  if (isOtherPage) {
    // The preview is gone already, since we've navigated away.
  }
  else if (ps.keepPreview) {
    // This happens if we're editing a chat message in the advanced editor — we can
    // continue typing in the chat message text box, and keep the preview.
  }
  else if (ps.editingPostNr) {
    // Put back the post as it was before the edits. If we submitted the edits, then,
    // once the serve has replied, we'll insert the new updated post instead.  Or...?
    if (origPostBeforeEdits) {
      // @ifdef DEBUG
      dieIf(ps.editingPostNr !== origPostBeforeEdits.nr,
            `Preview post to hide, and cached post before edits, are different:
           nr ${ps.editingPostNr} and ${origPostBeforeEdits.nr} respectively, here's
           the cached post: ${JSON.stringify(origPostBeforeEdits)} [TyE3056MR35]`);
      // @endif
      highlightPostNrAfter = origPostBeforeEdits.nr;
      patch = page_makePostPatch(page, origPostBeforeEdits);
      origPostBeforeEdits = null;
    }
  }
  else if (ps.replyToNr || isChat) {   // [.rm_prv_if_br]
    const postType = ps.anyPostType || PostType.ChatMessage;
    patch = ps.anyDraft && ps.keepDraft
        ? store_makeDraftPostPatch(store, page, ps.anyDraft)
        : store_makeDeletePreviewPostPatch(store, ps.replyToNr, postType);
    highlightPostNrAfter = post_makePreviewIdNr(ps.replyToNr, postType);
  }

  patch = { ...patch, setEditorOpen: false };
  patchTheStore(patch);

  // And then, later:
  if (!isOtherPage) {
    setTimeout(() => {
      flashPostNrIfThere(highlightPostNrAfter);
    }, 200);
  }
}


/// Deletes both the draft, and the in-page draft post.
///
export function deleteDraftPost(pageId: PageId, draftPost: Post) {
  const store: Store = ReactStore.allData();

  // This is a post on an already existing page — no category id needed.
  const draftLocator: DraftLocator = {
    draftType: postType_toDraftType(draftPost.postType),
    pageId: pageId,
    postNr: draftPost.parentNr,
    postId: store_getPostId(store, pageId, draftPost.parentNr),
  };
  const draftNr = _.isNumber(draftPost.isForDraftNr) ? draftPost.isForDraftNr : undefined;
  const draftDeletor: DraftDeletor = {
    pageId,
    draftNr,
    forWhat: draftLocator,
  };
  deleteDraftImpl(draftPost, draftDeletor, undefined, undefined, window as DiscWin);
}


/// Deletes the draft, and optionally any draft post too.
///
export function deleteDraft(pageId: PageId, draft: Draft, deleteDraftPost: boolean,
      onDoneOrBeacon?: OnDoneOrBeacon, onError?: ErrorStatusHandler, inFrame?: DiscWin) {

  // What about category id, for new topics?  [DRAFTS_BUG]
  const draftDeletor: DraftDeletor = {
    pageId,
    draftNr: draft.draftNr,
    forWhat: draft.forWhat,
  }
  let draftPost: Post | U;
  if (deleteDraftPost) {
    // Maybe pass one's id in a param to this fn deleteDraft() instead?
    const store: SessWinStore = win_getSessWinStore();
    draftPost = store_makePostForDraft(store.me.id, draft);  // [60MNW53]
  }
  deleteDraftImpl(draftPost, draftDeletor, onDoneOrBeacon, onError, inFrame);
}


function deleteDraftImpl(draftPost: Post | U, draftDeletor: DraftDeletor,
      onDoneOrBeacon?: OnDoneOrBeacon, onError?: ErrorStatusHandler, inFrame?: DiscWin) {

  // ----- Delete from browser storage

  // Not so easy to do an exact key lookup — not sure what fields
  // were included in the storage key, when saving the draft. So look at all
  // browser storage drafts.
  BrowserStorage.forEachDraft(draftDeletor.pageId, (draft: Draft, keyStr: string) => {
    // If there're many iframes on the same embedding page, we should only
    // look at the draft in the correct iframe — i.e. same discussion id.
    const noOrSameDraftDiscId =  // [draft_diid]
        !draft.forWhat.discussionId ||
            draft.forWhat.discussionId === draftDeletor.forWhat.discussionId;
    if (draft.forWhat.postNr === draftDeletor.forWhat.postNr &&
        draft.forWhat.draftType === draftDeletor.forWhat.draftType &&
        noOrSameDraftDiscId) {
      BrowserStorage.remove(keyStr);
    }
  });

  // ----- A patch to delete from the store

  // Delete any draft preview post, for the draft.
  const storePatch: StorePatch =
      draftPost ? store_makeDeletePostPatch(draftPost) : {};

  // Delete the draft itself.
  storePatch.deleteDraft = draftDeletor;

  // ----- Delete from server

  const onDone: OnDone | U =
      onDoneOrBeacon === UseBeacon ? undefined : onDoneOrBeacon;

  // If this draft has been saved server side, it has a draft nr, assigned
  // by the server. Then we need to delete the draft server side too.
  const draftNr: DraftNr | U = draftDeletor.draftNr;
  if (!draftNr) {
    // This draft existed locally only, in the browse's storage.
    patchTheStoreManyFrames(storePatch, onDone,
          // Delete it from the correct iframe only. [draft_diid]
          inFrame);
  }
  else if (_.isNumber(draftNr)) {
    if (onDoneOrBeacon === UseBeacon) {
      Server.deleteDrafts([draftNr], UseBeacon);
      // Window closing; need not patch the store or call onDone.
    }
    else {
      Server.deleteDrafts([draftNr], function() {
        patchTheStoreManyFrames(storePatch, onDone, inFrame);
      }, onError);
    }
  }
  // @ifdef DEBUG
  else {
    die('TyE407WKU46');
  }
  // @endif
  void 0; // [macro-bug]
}


export function composeReplyTo(parentNr: PostNr, replyPostType: PostType) {
  const inclInReply = true; // legacy — was for multireplies: toggle incl-in-reply or not
  if (eds.isInEmbeddedCommentsIframe) {
    sendToEditorIframe(['editorToggleReply', [parentNr, inclInReply, replyPostType]]);
  }
  else {
    editor.toggleWriteReplyToPostNr(parentNr, inclInReply, replyPostType);
  }
}


export function saveReply(editorsPageId: PageId, postNrs: PostNr[], text: string,
      anyPostType: Nr, draftToDelete: Draft | U, onOk?: () => Vo,
      sendToWhichFrame?: MainWin) {
  Server.saveReply(editorsPageId, postNrs, text, anyPostType, draftToDelete?.draftNr,
      (storePatch) => {
    handleReplyResult(storePatch, draftToDelete, onOk, sendToWhichFrame);
  });
}


export function insertChatMessage(text: string, draftToDelete: Draft | undefined,
      onDone?: () => void) {
  Server.insertChatMessage(text, draftToDelete?.draftNr, (storePatch) => {
    handleReplyResult(storePatch, draftToDelete, onDone);
  });
}


export function handleReplyResult(patch: StorePatch, draftToDelete: Draft | undefined,
      onDone?: () => void, sendToWhichFrame?: MainWin) {
  if (eds.isInEmbeddedEditor) {
    if (patch.newlyCreatedPageId) {
      // Update this, so subsequent server requests, will use the correct page id. [4HKW28]
      // (Also done in patchTheStore().)
      eds.embeddedPageId = patch.newlyCreatedPageId;
    }
    // Send a message to the embedding page, which will forward it to
    // the comments iframe, which will show the new comment.
    sendToCommentsIframe(['handleReplyResult', [patch, draftToDelete]], sendToWhichFrame);
    onDone?.();
    return;
  }

  patchTheStore({ ...patch, deleteDraft: draftToDelete }, onDone);
}


function patchTheStoreManyFrames(storePatch: StorePatch, onOk: () => Vo,
          inFrame: DiscWin) {
  patchTheStore(storePatch, onOk);
  if (inFrame === window) {
    // Just patched above.
  }
  else {
    sendToCommentsIframe(['patchTheStore', storePatch], inFrame);
  }
}


export function patchTheStore(storePatch: StorePatch, onDone?: () => void) {
  ReactDispatcher.handleViewAction({
    actionType: actionTypes.PatchTheStore,
    storePatch,
    onDone,
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
      // Code 404 Not Found  happens if page delted, or moved to a category one may not access.
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
              withCloseFn: fn => closeDialogFn = fn,
              body: rFragment({},
                r.p({}, t.NoPageHere),
                r.p({}, r.a({ onClick: goBack }, t.GoBackToLastPage))) });
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
  sendToIframesImpl(message, true);
}


function sendToCommentsIframe(message, toWhichFrame?: DiscWin) {
  sendToIframesImpl(message, false, toWhichFrame);
}


function sendToParent(message) {
  sendToIframesImpl(message, false, parent);
}


function sendToIframesImpl(message, toEditor?: Bo, toWhichFrame?: Window) {
  // Send the message to any embedding page; it'll forward it to the appropriate iframe.
  // But only if we're in an iframe — otherwise, in Safari, there's an error. Not in
  // Chrome or FF; they do nothing instead.
  // @ifdef DEBUG
  if (!eds.isInIframe) {
    die(`Sending to iframe when not in iframe? toEditor: ${toEditor
          }, toWhichIframe.name: ${toWhichFrame?.name} [TyE40GWG2R]`);
  }
  // @endif
  if (eds.isInIframe) {
    try {
      const sendDirectly = toWhichFrame || toEditor; //  &&  feature flag
      const win = sendDirectly ? toWhichFrame || win_getEditorWin() : window.parent;
      // Which origin? 1) The parent win is the embedding page, e.g. a blog post page,
      // with origin eds.embeddingOrigin. 2) If not posting to the parent win,
      // we're posting to another Talkyard iframe on the same server (same origin).
      const targetOrigin = !sendDirectly || toWhichFrame === parent ?
              eds.embeddingOrigin : location.origin;
      win.postMessage(JSON.stringify(message), targetOrigin);  // [post_dir_2_ifr]
    }
    catch (ex) {
      // Don't propagate this. Probably better to let the current frame continue
      // as best it can with whatever it's doing.
      logW(`Error posting to other frame [TyEPSTPRNT]`, ex);
    }
  }
}

// An alias, for better readability.
const sendToOtherIframes = sendToIframesImpl;


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 list
