/*
 * Copyright (C) 2014-2017 Kaj Magnus Lindberg
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
/// <reference path="ReactActions.ts" />
/// <reference path="oop-methods.ts" />
/// <reference path="prelude.ts" />
/// <reference path="utils/utils.ts" />


// CLEAN_UP try to remove this dependency from here.
/// <reference path="utils/scroll-into-view.ts" />


// Old comment! Do *not* start using Redux or any such, in Ty's case, over complicated
// things. Instead, remove the Flux pattern and call Store fns directly, [flux_mess].
//
/* This Flux store is perhaps a bit weird, not sure. I'll switch to Redux or
 * Flummox or Fluxxor or whatever later, and rewrite everything in a better way?
 * Also perhaps there should be more than one store, so events won't be broadcasted
 * to everyone all the time.
 */

//------------------------------------------------------------------------------
   namespace debiki2 {
//------------------------------------------------------------------------------

const ChangeEvent = 'ChangeEvent';
const htmlElem = document.getElementsByTagName('html')[0];

declare const EventEmitter3; // don't know why, but the TypeScript defs doesn't work.
export const ReactStore = new EventEmitter3();

export function win_getSessWinStore(): SessWinStore {
  const mainWin = getMainWin();
  return mainWin.theStore;
}

type StoreStateSetter = (store: Store) => void;
const useStoreStateSetters: StoreStateSetter[] = [];

type StoreEventListener = (patch: StorePatch) => V;
const storeEventListeners: StoreEventListener[] = [];

// Read-only hooks based store state. WOULD REFACTOR make it read-write and delete ReactActions,
// and remove EventEmitter too? [4WG20ABG2]  Have all React code use `useStoreState`
// instead of that old "flux" stuff.
export function useStoreState(): [Store, () => void] {
  const [state, setState] = React.useState<Store>(store);

  // Remember the setter, so we can call it whenever the store changes.
  // Also, forget it, when unmounting.
  React.useEffect(function() {
    // @ifdef DEBUG
    const index = useStoreStateSetters.indexOf(setState);
    dieIf(index !== -1, 'TyE506MRS24');
    // @endif
    useStoreStateSetters.push(setState);

    return function() {
      const index = useStoreStateSetters.indexOf(setState);
      // @ifdef DEBUG
      dieIf(index === -1, 'TyE03HMAD24');
      // @endif
      if (index >= 0) {
        useStoreStateSetters.splice(index, 1);
      }
    };
  }, []);

  return [state,
      // For now, update via ReactActions instead.
      function() { die('TyESETSTORESTATE'); }];
}


/// Some components don't care about the store state — they instead keep their own
/// useState() list of stuff, e.g. [a list of posts with a certain tag].
/// However, they care about *changes* to the stuff in their state, e.g.
/// if [a tag of one of the posts in their state is edited].  And by listening to
/// store events, they can find out.  (They need to inspect the patch to find out if
/// anything of relevance, changed. See usePostList(), which looks at
/// `patch.postsByPageId`.)
///
/// This is similar to useReducer()? See:
///      https://react.dev/learn/extracting-state-logic-into-a-reducer
/// or Redux' dispatcher?  But in Ty's case, simpler: there's no need to pass
/// around any dispatcher functions, instead, the useStoreEvent() listeners
/// run after the store gets patched via any of the already-existing ways
/// to patch it  (primarily via ReactActions.patchTheStore()).
///
export function useStoreEvent(listener: StoreEventListener, dependencies: any[]) {
  // See useStoreState() above — this fn functions in the same way.
  React.useEffect(function() {
    // @ifdef DEBUG
    const index = storeEventListeners.indexOf(listener);
    dieIf(index !== -1, 'TyE506MRS25');
    // @endif
    storeEventListeners.push(listener);

    return function() {
      const index = storeEventListeners.indexOf(listener);
      // @ifdef DEBUG
      dieIf(index === -1, 'TyE03HMAD25');
      // @endif
      if (index >= 0) {
        storeEventListeners.splice(index, 1);
      }
    };
  }, dependencies);
}


/// Returns [posts, setPosts] — a list of posts, and a setter. Initially, the list is
/// null, and once you've loaded the posts, you can set the list to an array, or
/// to false if access was denied.  Listens to StorePatch events, and automatically
/// updates any posts in the list — e.g. if one of the posts has a tag whose value
/// got edited.
///
export function usePostList(): [PostWithPage[] | N | false, (posts: PostWithPage[]) => V] {
  const [postsNullOrFalse, setPosts] = React.useState<PostWithPage[] | N | false>(null);
  useStoreEvent((patch: StorePatch) => {
    // @ifdef DEBUG
    console.debug(`Patch: ${JSON.stringify(patch, undefined, 3)},
          and postsNullOrFalse: ${JSON.stringify(postsNullOrFalse, undefined, 3)}`);
    // @endif
    // If the patch is about any post in `postsNullOrFalse`, then, update it and
    // then setPosts().
    if (!patch.postsByPageId || !postsNullOrFalse || !postsNullOrFalse.length)
      return;
    const updatedPosts: Post[] = _.flatten(_.values(patch.postsByPageId));
    const postsAfter: PostWithPage[] = [...postsNullOrFalse];
    const ixAndOldById: { [id: PostId]: [Ix, PostWithPage] } =
            arr_toMapKeepOne(postsNullOrFalse, (oldP, ix) => [oldP.uniqueId, [ix, oldP]]);
    let anyChanges = false;
    for (const updatedPost of updatedPosts) {
      const ixAndOld: [Ix, PostWithPage] | U = ixAndOldById[updatedPost.uniqueId];
      if (ixAndOld) {
        const [ix, oldPost] = ixAndOld;
        postsAfter[ix] = { ...oldPost, ...updatedPost }; // keeps .pageTitle etc
        anyChanges = true;
      }
    }
    if (anyChanges) {
      setPosts(postsAfter);
    }
  }, [postsNullOrFalse]);
  return [postsNullOrFalse, setPosts];
}


// First, initialize the store with page specific data only, nothing user specific,
// because the server serves cached HTML with no user specific data. Later on,
// we'll insert user specific data into the store, and re-render. See
// ReactStore.activateMyself().
const store: Store = eds.pageDataFromServer;
window['theStore'] = store; // simplifies inspection in Dev Tools — and hacky hack :-P  [ONESTORE]

store.postsToUpdate = {};

if (store.user && !store.me) store.me = store.user; // try to remove
if (!store.me) {
  store.me = makeStranger(store);
}
store.user = store.me; // try to remove


// Auto pages are e.g. admin or user profile pages, html generated automatically when needed.
// No page id or user created data server side. Auto pages need this default empty stuff,
// to avoid null errors.
export function makeAutoPage(): Page {
  return <Page> <any> <AutoPage> {
    dbgSrc: 'AP',
    ancestorsRootFirst: [],
    pageMemberIds: [],
    postsByNr: [],
    pagePath: {},
  };
}


// This is for avoiding null errors, 1) when the current user visits an auto page, or 2) when
// the user is new at the site and doesn't have any custom data/settings for the current page.
// Dupl code [4FBR20].
export function makeNoPageData(): MyPageData {
  return {
    dbgSrc: 'MyNP',
    pageId: EmptyPageId,
    myDrafts: <Draft[]> [],
    myPageNotfPref: <PageNotfPref> undefined,
    groupsPageNotfPrefs: <PageNotfPref[]> [],
    votes: {},
    unapprovedPosts: {},
    unapprovedPostAuthors: [],
    postNrsAutoReadLongAgo: [],
    postNrsAutoReadNow: [],
    marksByPostId: {},
  };
}


ReactDispatcher.register(function(payload) {
  const action = payload.action;
  const currentPage: Page = store.currentPage;
  let patchedTheStore: true | U;
  // SHOULD clone the store here? [8GKB3QA] but might introduce so many bugs, so wait a bit.
  // So becomes (more) immutable.
  switch (action.actionType) {

    case ReactActions.actionTypes.NewMyself:
      ReactStore.activateMyself(action.user, action.stuffForMe);
      store.numOnlineStrangers = Math.max(0, store.numOnlineStrangers - 1);
      theStore_addOnlineUser(me_toBriefUser(action.user));
      break;

    case ReactActions.actionTypes.Logout:
      // This isn't really needed, since we reload the page anyway,
      // see logoutClientSideOnly(). But let's keep this, in case we some day
      // in the future don't want to reload the page.
      // ---------
      $h.removeClasses(htmlElem, 'c_IsSupAdm dw-is-admin dw-is-staff dw-is-authenticated');
      if (store.userIdsOnline) delete store.userIdsOnline[store.me.id];
      store.numOnlineStrangers += 1;
      store.me = makeStranger(store);
      store.user = store.me; // try to remove
      debiki2.pubsub.subscribeToServerEvents(store.me);
      // ---------
      break;

    case ReactActions.actionTypes.NewUserAccountCreated:
      store.newUserAccountCreated = true;
      break;

    case ReactActions.actionTypes.CreateEditForumCategory:
      patchTheStore({
        publicCategories: action.publicCategories,
        restrictedCategories: action.restrictedCategories,
      });
      patchedTheStore = true;  // but no  storePatch obj :-/

      store.me.permsOnPages =
            perms_addNew(store.me.permsOnPages, action.myNewPermissions);

      // If creating a new cat, remember it, so can highlight it in the category list:
      store.newCategorySlug = action.newCategorySlug;
      // The newCategorySlug field scrolls to and highlights the new category. Only do that
      // during the first ten seconds after the category got created; then it's enough.
      // This will result in >= 1 highlightings. [7KFWIQ2]
      setTimeout(function() {
        store.newCategorySlug = null;
        // No need to trigger any event. The forum component will notice, later, lazily.
      }, 10*1000);

      // Currently, if we changed the slug of an existing category, we update
      // the url path here: [7AFDW01] instead.
      break;

    case ReactActions.actionTypes.PinPage:
      currentPage.pinOrder = action.pinOrder;
      currentPage.pinWhere = action.pinWhere;
      break;

    case ReactActions.actionTypes.UnpinPage:
      currentPage.pinOrder = undefined;
      currentPage.pinWhere = undefined;
      break;

    case ReactActions.actionTypes.AcceptAnswer:
      currentPage.pageAnsweredAtMs = action.answeredAtMs;
      currentPage.pageAnswerPostUniqueId = action.answerPostUniqueId;
      const post = page_findPostById(currentPage, action.answerPostUniqueId);
      dieIf(!post, 'EdE2WKB49');
      currentPage.pageAnswerPostNr = post.nr;
      break;

    case ReactActions.actionTypes.UnacceptAnswer:
      currentPage.pageAnsweredAtMs = null;
      currentPage.pageAnswerPostUniqueId = null;
      currentPage.pageAnswerPostNr = null;
      currentPage.pageClosedAtMs = null;
      break;

    case ReactActions.actionTypes.TogglePageClosed:
      currentPage.pageClosedAtMs = action.closedAtMs;
      break;

    case ReactActions.actionTypes.DeletePages:
      _.each(action.pageIds, id => {
        const page: Page = store.pagesById[id];
        if (page) {
          page.pageDeletedAtMs = 1; // for now,  also at: [206KDH35R]
        }
      });
      break;

    case ReactActions.actionTypes.UndeletePages:
      _.each(action.pageIds, id => {
        const page: Page = store.pagesById[id];
        if (page) {
          page.pageDeletedAtMs = undefined;
        }
      });
      break;

    case ReactActions.actionTypes.EditTitleAndSettings:
      // Good to use: newMeta.* — those fields are directly from the server. [7RGEF24]
      const newData: EditPageResponse = action.response;
      const newMeta: PageMeta = newData.newPageMeta;

      const layoutBefore = page_deriveLayout(
              currentPage, store, LayoutFor.PageNoTweaks);

      if (currentPage.pageHtmlTagCssClasses !== newMeta.htmlTagCssClasses) {
        $h.removeClasses(htmlElem, currentPage.pageHtmlTagCssClasses);
        $h.addClasses(htmlElem, newMeta.htmlTagCssClasses);
        currentPage.pageHtmlTagCssClasses = newMeta.htmlTagCssClasses;
      }

      currentPage.pageHtmlHeadTitle = firstDefinedOf(
            newMeta.htmlHeadTitle, currentPage.pageHtmlHeadTitle);

      currentPage.pageHtmlHeadDescription = firstDefinedOf(
            newMeta.htmlHeadDescription, currentPage.pageHtmlHeadDescription);

      currentPage.ancestorsRootFirst = newData.newAncestorsRootFirst;
      const parent: Ancestor = <Ancestor> _.last(newData.newAncestorsRootFirst);
      currentPage.categoryId = parent ? parent.categoryId : null;
      const was2dTree = currentPage.horizontalLayout;

      currentPage.pageRole = newMeta.pageType;
      currentPage.doingStatus = newMeta.doingStatus;
      currentPage.pagePlannedAtMs = newMeta.plannedAt;
      currentPage.pageStartedAtMs = newMeta.startedAt;
      currentPage.pageDoneAtMs = newMeta.doneAt;
      currentPage.pageClosedAtMs = newMeta.closedAt;

      currentPage.comtOrder = newMeta.comtOrder;
      currentPage.comtNesting = newMeta.comtNesting;

      currentPage.comtsStartHidden = newMeta.comtsStartHidden;
      currentPage.comtsStartAnon = newMeta.comtsStartAnon;
      currentPage.opStartsAnon = newMeta.opStartsAnon;
      currentPage.newAnonStatus = newMeta.newAnonStatus;

      // Clear any page tweaks, e.g. if pat has temporarily canged the comment sort order.
      // Otherwise it can look as if the changes pat saved, have no effect.
      if (store.curPageTweaks) {
        const changes: EditPageRequestData = action.changes;
        _.each(changes, (value, key: St) => {
          delete store.curPageTweaks[key];
        });
      }

      const layoutAfter = page_deriveLayout(
              currentPage, store, LayoutFor.PageNoTweaks);

      if (layoutAfter.comtOrder !== layoutBefore.comtOrder) {  // or [max_nesting]
        store_relayoutPageInPlace(store, currentPage, layoutAfter);
      }

      // [2D_LAYOUT]
      //currentPage.horizontalLayout = newMeta.page type === PageRole.MindMap || currentPage.is2dTreeDefault;
      //const is2dTree = currentPage.horizontalLayout;

      updatePost(newData.newTitlePost, currentPage.pageId);

      /*
      if (was2dTree !== is2dTree) {   // [2D_LAYOUT]
        // Rerender the page with the new layout.
        store.quickUpdate = false;
        if (is2dTree) {
          $h.removeClasses(htmlElem, 'dw-vt');
          $h.addClasses(htmlElem, 'dw-hz');
          debiki2.utils.onMouseDetected(Server.load2dScriptsBundleStart2dStuff);
        }
        else {
          $h.removeClasses(htmlElem, 'dw-hz');
          $h.addClasses(htmlElem, 'dw-vt');
          $$('.dw-t.dw-depth-1').forEach((elem: Element) => {
            Bliss.style(elem, { width: 'auto' }); // 2d columns had a certain width
          });
        }
        debiki2.removeSidebar();
        setTimeout(debiki2.createSidebar, 1);
      } */

      break;

    case ReactActions.actionTypes.ShowForumIntro:
      store.hideForumIntro = !action.visible;
      putInLocalStorage('hideForumIntro', !action.visible);
      if (store.hideForumIntro) $h.addClasses(htmlElem, 'dw-hide-forum-intro');
      else $h.removeClasses(htmlElem, 'dw-hide-forum-intro');
      break;

    case ReactActions.actionTypes.UpdatePost:
      updatePost(action.post, currentPage.pageId);
      break;

    case ReactActions.actionTypes.VoteOnPost:
      voteOnPost(action);
      patchedTheStore = true; // voteOPost() does
      break;

    case ReactActions.actionTypes.MarkPostAsRead:
      markPostAsRead(action.postId, action.manually);
      break;

    case ReactActions.actionTypes.CycleToNextMark:
      cycleToNextMark(action.postId);
      break;

    case ReactActions.actionTypes.SummarizeReplies:
      summarizeReplies();
      break;

    case ReactActions.actionTypes.UnsquashTrees:
      unsquashTrees(action.postNr);
      break;

    case ReactActions.actionTypes.CollapseTree:
      collapseTree(action.post);
      break;

    case ReactActions.actionTypes.UncollapsePost:
      uncollapsePostAndChildren(action.post);
      break;

    case ReactActions.actionTypes.ShowPost:
      showPostNr(action.postNr, action.showPostOpts);
      break;

    case ReactActions.actionTypes.SetWatchbar:
      watchbar_copyUnreadStatusFromTo(store.me.watchbar, action.watchbar);
      store.me.watchbar = action.watchbar;
      break;

    case ReactActions.actionTypes.SetWatchbarOpen:
      setWatchbarOpen(action.open);
      break;

    case ReactActions.actionTypes.SetContextbarOpen:
      setContextbarOpen(action.open);
      break;

    case ReactActions.actionTypes.SetHorizontalLayout:
      currentPage.horizontalLayout = action.enabled;
      // Now all gifs will be recreated since the page is rerendered.
      stopGifsPlayOnClick();
      break;

    case ReactActions.actionTypes.HideHelpMessage:
      dieIf(!store.me, 'EsE8UGM5');
      const messageId = action.message.id;
      const version = action.message.version || 1;
      // Legacy:  (use  me.tourTipsSeen  instead,  rename to just  tipsSeen,
      // and save  tipsSeen  in localStorage, iff not logged in?)
      store.me.closedHelpMessages[messageId] = version;
      putInLocalStorage('closedHelpMessages', store.me.closedHelpMessages);
      break;

    case ReactActions.actionTypes.ShowHelpAgain:
      const me: Myself = store.me;
      if (action.messageId) {
        me.tourTipsSeen = arr_delInCopy(me.tourTipsSeen, action.messageId);
        // Legacy:
        // Could mark as visible in local storage? Or not (simpler) — the user has
        // soon read it anyway.
        delete me.closedHelpMessages[action.messageId];
      }
      else {
        // If action.onlyAnnouncements, remove all 'SAn_..' (Server Announcement)
        // from the to-hide list — that is, keep those that don't start with 'SAn_'.
        me.tourTipsSeen = me.tourTipsSeen.filter(t => {
          const isAnnouncement = t.startsWith('SAn_');
          const shallShow = isAnnouncement === !!action.onlyAnnouncements;
          const keepInHiddenList = !shallShow;
          return keepInHiddenList;
        });
        // Legacy:  CLEAN_UP
        me.closedHelpMessages = _.pickBy(me.closedHelpMessages, (version, key) =>
              key.startsWith('SAn_') !== !!action.onlyAnnouncements);
        putInLocalStorage('closedHelpMessages', me.closedHelpMessages);
      }
      break;

    case ReactActions.actionTypes.AddNotifications:
      handleNotifications(action.notifications);
      break;

    case ReactActions.actionTypes.MarkAnyNotificationAsSeen:
      markAnyNotificationssAsSeen(action.postNr);
      break;

    case ReactActions.actionTypes.AddMeAsPageMember:
      dieIf(!store.usersByIdBrief[store.me.id], 'EsE5PU81');
      userIdList_add(currentPage.pageMemberIds, store.me.id);
      break;

    case ReactActions.actionTypes.RemoveMeAsPageMember:
      userIdList_remove(currentPage.pageMemberIds, store.me.id);
      break;

    case ReactActions.actionTypes.PatchTheStore:
      patchTheStore(action.storePatch);
      patchedTheStore = true;
      break;

    case ReactActions.actionTypes.ShowNewPage:
      showNewPage(action.params);
    break;

    case ReactActions.actionTypes.UpdateUserPresence:
      const data: UserPresenceWsMsg = action.data;
      maybePatchTheStore(data);
      patchedTheStore = true; // always patches, see UserPresenceWsMsg server side.
      if (data.presence === Presence.Active) {
        theStore_addOnlineUser(data.user);
      }
      else {
        theStore_removeOnlineUser(data.user);
      }
      break;

    case ReactActions.actionTypes.UpdateOnlineUsersLists:
      theStore_setOnlineUsers(action.numOnlineStrangers, action.onlineUsers);
      break;

    default:
      console.warn('Unknown action: ' + JSON.stringify(action));
      return true;
  }

  if (store.cannotQuickUpdate) {
    resetQuickUpdateInPlace(store);
  }

  ReactStore.emitChange();   // old, for non-hooks based code ...

  // Ensure new hooks based code cannot 'cheat' by updating things in-place:
  // (COULD clone more nested objs (not only `me`), to ensure no hooks code relies
  // on in-place updates.)
  // Also, apparently React.useEffect:s sometimes won't run, unless setStore()
  // below gets a new object. If reusing the same obj, the useEffect fn:s aren't called.
  const meCopy: Myself = { ...store.me };
  const storeCopy: Store = { ...store, me: meCopy };

  useStoreStateSetters.forEach(setStore => {  // ... new, hooks based code
    setStore(storeCopy);
  });

  // (CreateEditForumCategory patches the store, but has no storePatch obj,
  // doesn't matter for the moment, oh well.)
  if (patchedTheStore && action.storePatch) {
    // LoadPostsResponse and LoadTopicsResponse have the storePatch in a sub field.
    const thePatch = action.storePatch.storePatch || action.storePatch;
    storeEventListeners.forEach(listener => {
      listener(thePatch);
    });
  }

  resetQuickUpdateInPlace(store);

  // How can one know when React is done with all updates scheduled above?
  // (Would need to look into how emitChange() and the hook fns work?)
  // Some code wants to run afterwards: [SCROLLPRVW]. For now though:
  if (action.onDone) {
    setTimeout(action.onDone, 1);
  }

  // Tell the dispatcher that there were no errors:
  return true;
});


function resetQuickUpdateInPlace(st: Store) {
  st.quickUpdate = false;
  st.postsToUpdate = {};
  delete st.cannotQuickUpdate;
}


ReactStore.initialize = function() {
  if (store.currentPageId) {
    // This is done in an <html> inline script. [4GKRW02]
    dieIf(!store.currentPage, 'EdE6KSQ84');
    dieIf(store.currentPage.pageId !== store.currentPageId, 'EdE6LKT20');
    dieIf(store.currentPage !== store.pagesById[store.currentPageId], 'EdE5AZXB4');
  }
  else {
    store.currentPage = makeAutoPage();
  }

  // Any current user not yet activated. Add data for strangers, so the initial rendering will work.
  store.me.myCurrentPageData = makeNoPageData();

  store.usersByIdBrief = store.usersByIdBrief || {};
  let impCookie = getSetCookie(ImpersonationCookieName);
  if (impCookie) {
    // This 'VAO' string constant, server side: [8AXFC0J2]
    store.isViewingAs = impCookie.indexOf('.VAO.') >= 0;
    store.isImpersonating = true;
  }

  // Init page overlay, shown if sidebars open.
  debiki.v0.util.addZoomOrResizeListener(updateShallSidebarsOverlayPage);
  const overlay = $byId('theSidebarPageOverlay');
  if (overlay) overlay.addEventListener('click', function() {
    setWatchbarOpen(false);
    setContextbarOpen(false);
    ReactStore.emitChange();
  });

  store_initCurCatsFromPubCats(store);
};


let volatileDataActivated = false;

ReactStore.activateVolatileData = function() {
  dieIf(volatileDataActivated, 'EsE4PFY03');
  volatileDataActivated = true;
  const volData: VolatileDataFromServer = eds.volatileDataFromServer;

  // Update this win's/frame's user
  // ------------------------------
  // Copy any session frame user to this frame's user:  [mny_ifr_pat_dta]
  // If we're in a comments iframe, and we're logged in — there's a session
  // and a user in the session-iframe.html — then, use that session and user.
  // This makes it possible to dynamically add new blog comments iframes,
  // and they'll be already-logged-in — works also if session cookies blocked.
  let sessFrameStore: SessWinStore;
  if (eds.isInIframe) {
    try {
      const sessFrame = getMainWin();
      sessFrameStore = sessFrame.theStore;
      if (_.isObject(sessFrameStore.me)) {
        if (!volData.me || volData.me.isStranger) {
          volData.me = _.cloneDeep(sessFrameStore.me);  // [emb_ifr_shortcuts]
        }
        else {
          // @ifdef DEBUG
          if (volData.me.id !== sessFrameStore.me.id) {
            logW(`sessStore.me and volData.me race? Ids: ${sessFrameStore.me.id
                } and ${volData.me.id}  [TyM0J2MW67]`);
            debugger;
          }
          // @endif
          volData.me = me_merge(sessFrameStore.me, volData.me);  // [emb_ifr_shortcuts]
          sessFrameStore.me = _.cloneDeep(volData.me);
          // Tags and badges?  [tags_and_badges_missing]
          // sessFrameStore.stuffForMe = _.cloneDeep(volData.stuffForMe);
        }
      }
    }
    catch (ex) {
      logW(`Multi iframe error? [TyEMANYIFR02]`, ex)
    }
  }

  // Do the interesting thing
  // ------------------------------

  theStore_setOnlineUsers(volData.numStrangersOnline, volData.usersOnline);

  ReactStore.activateMyself(volData.me, volData.stuffForMe);

  // Update any session frame's user
  // ------------------------------
  // Copy this frame's user to the session frame, if missing there:  [mny_ifr_pat_dta]
  // This is safe and cannot fail, still, try-catch for now, new code.
  // DO_AFTER 2022-01-01 remove try-catch, keep just the contents.
  if (sessFrameStore) {
    try {
      if (!_.isObject(sessFrameStore.me) && store.me) {  // [emb_ifr_shortcuts]
        sessFrameStore.me = _.cloneDeep(store.me);
      }
    }
    catch (ex) {
      logW(`Multi iframe error? [TyEMANYIFR03]`, ex)
    }
  }

  store.quickUpdate = false;
  this.emitChange();
};


ReactStore.activateMyself = function(anyNewMe: Myself | NU, stuffForMe?: StuffForMe) {
  // [redux] Modifying state in-place, shouldn't do? But works fine.

  store.userSpecificDataAdded = true;

  if (stuffForMe) {
    store_patchTagTypesInPl(store, stuffForMe.tagTypes);
  }

  setTimeout(function() {
    $h.addClasses(htmlElem, 'e2eMyDataAdded');
  }, 1);

  let myPageData: MyPageData;
  {
    const me = anyNewMe || store.me;
    // Avoid null errors by setting to no-page-data, if we're currently not showing any page.
    myPageData = me.myDataByPageId[store.currentPageId] || makeNoPageData();
    me.myCurrentPageData = myPageData;
    // Remember marks per global post ids. COULD_FREE_MEM
    me.marksByPostId = _.clone(myPageData.marksByPostId);
  }

  addLocalStorageDataTo(anyNewMe || store.me);

  addMyDraftPosts(store, myPageData);

  if (!anyNewMe) {
    debiki2.pubsub.subscribeToServerEvents(store.me);
    return;
  }

  const newMe = anyNewMe;

  // When changing user, only data for the current page gets loaded. So we don't need to
  // update any other pages in the store, than the current page.
  // @ifdef DEBUG
  dieIf(_.size(newMe.myDataByPageId) > 1, 'EdE2WKB5U0');
  // @endif

  if (newMe.isAdmin) {
    $h.addClasses(htmlElem, 'dw-is-admin dw-is-staff');
  }
  if (newMe.id === SystemUserId) {
    $h.addClasses(htmlElem, 'c_IsSupAdm');
  }
  if (newMe.isModerator) {
    $h.addClasses(htmlElem, 'dw-is-staff');
  }
  if (newMe.id >= LowestAuthenticatedUserId) {
    if (newMe.isAdmin) {
      Server.maybeLoadGlobalAdminScript();
    }
    if (newMe.isAdmin || newMe.isModerator) {
      Server.maybeLoadGlobalStaffScript();
    }
    //Server.maybeLoadGlobalAllScript();
  }
  if (newMe.isAuthenticated) {
    $h.addClasses(htmlElem, 'dw-is-authenticated');
  }

  // Add Everyone's permissions to newMe's permissions (Everyone's permissions aren't
  // included in the per-user data). [8JUYW4B]
  const oldMe: Myself = store.me;
  const everyonesPerms = _.filter(oldMe.permsOnPages,
          (p: PermsOnPage) => p.forPeopleId === Groups.EveryoneId);
  newMe.permsOnPages = perms_addNew(everyonesPerms, newMe.permsOnPages);

  store.user = newMe; // try to remove the .user field, use .me instead
  store.me = newMe;

  theStore_addOnlineUser(me_toBriefUser(newMe));

  watchbar_markAsRead(store.me.watchbar, store.currentPageId);

  // Show the user's own unapproved posts, or all, for admins.
  store_addAnonsAndUnapprovedPosts(store, myPageData);  // TyTE2E603SKD

  if (_.isArray(store.topics)) {
    const currentPage: Page = store.currentPage;
    store.topics = store.topics.concat(store.me.restrictedTopics);
    store.topics.sort((t: Topic, t2: Topic) =>
        topic_sortByLatestActivity(t, t2, currentPage.categoryId));
    // later: BUG COULD try to avoid gaps, e.g. don't load restricted topics back to year 2000
    // but public topics back to 2010 only.
    // BUG we always sort by time, but sometimes, we want to sort by most-popular-first, or created-at,
    // *and* at the same time call activateMyself() — then here we'll sort by the wrong thing.

    // restrictedTopics might include publicly visible topics, which were already in store.topics.
    // So now there might be duplicates, instore.topics.
    store.topics = _.uniqBy(store.topics, 'pageId');

    // Add users for these topics, so avatars can be shown in topic list.
    store_patchPatsInPl(store, store.me.restrictedTopicsUsers);
  }

  // Absent on about-user pages. CLEAN_UP no it's always present? Need not test for that.
  if (store.currentCategories) {
    store_addRestrictedCurCatsInPl(store, store.me.restrictedCategories);
    // Clone, so other code knows it's changed. [new_cur_cat_arr]
    store.currentCategories = [...store.currentCategories];
  }

  // Scroll to last reading position?
  const readingProgress = myPageData.readingProgress;
  if (readingProgress && readingProgress.lastViewedPostNr &&
      readingProgress.lastViewedPostNr >= FirstReplyNr) {
    if (eds.isInEmbeddedCommentsIframe) {
      // Don't scroll — usually people come back to look at the blog post, not the comments.
    }
    else if (ReactActions.findUrlFragmentAction()) {
      // Then other code [7WKBQ28] scrolls to the anchored post instead.
    }
    else setTimeout(function() {
      // Don't do this directly, because this (sometimes?/always?) forces a reflow during
      // the initial rendering, making pages render 14ms slower on my laptop.
      utils.scrollIntoViewInPageColumn(
        `#post-${readingProgress.lastViewedPostNr}`, {
          marginTop: 150,
          // For now, scroll so it appears at the top, because it was the topmost one
          // in the viewport [8GKF204].
          marginBottom: 999,
        });
    }, 0);
  }

  debiki2.pubsub.subscribeToServerEvents(store.me);
  store.quickUpdate = false;
};


function store_addAnonsAndUnapprovedPosts(store: Store, myPageData: MyPageData) {
  // Test:  modn-from-disc-page-approve-before  TyTE2E603RTJ
  _.each(myPageData.unapprovedPosts, (post: Post) => {
    updatePost(post, store.currentPageId);
    // COULD_FREE_MEM if other user was logged in before?
  });

  store_patchPatsInPl(store, myPageData.unapprovedPostAuthors);
  store_patchPatsInPl(store, myPageData.knownAnons);
};


function store_initCurCatsFromPubCats(store: Store) {
  store.currentCategories = _.clone(store.publicCategories);  // [new_cur_cat_arr]
  store.curCatsById = groupByKeepOne(store.currentCategories, c => c.id);
}


function store_addRestrictedCurCatsInPl(store: Store, restrictedCategories: Cat[]) {
  const curCats: Cat[] = store.currentCategories;
  _.each(restrictedCategories, (restrCat: Cat) => {
    // Avoid adding cats twice. Currently, me.restrictedCategories might incl
    // publ cats [4KQSEF08] — or maybe access permissions just got edited by an admin,
    // somehow resulting in a cat being included in both the publ and restricted cat lists.
    const index = _.findIndex(curCats, { id: restrCat.id });
    if (index >= 0) {
      // Use the restricted version — it might include interesting data pat may see, but
      // that's missing in the publ version.
      // Hmm maybe good to double-include publ cats? (that's how it works currently [4KQSEF08])
      curCats.splice(index, 1, restrCat);
    }
    else {
      curCats.push(restrCat);
    }
    // Use the restricted version here too.
    store.curCatsById[restrCat.id] = restrCat;
  });
  curCats.sort((c: Cat, c2: Cat) => c.position - c2.position);
}


/// Remembers recent topics also if cats get updated:
/// If we get an updated cat from the server, but which doesn't include any
/// recent topics list, *and* we have an old version of the same cat *with*
/// recent topics — then this fn copies the recent topics to the updated cat.
///
function addBackRecentTopicsInPl(oldCurCats: Cat[], curCatsById: { [catId: CatId]: Cat }) {
  for (let oldCat of oldCurCats) {
    if (!oldCat.recentTopics)
      continue;

    const curCat = curCatsById[oldCat.id];

    // Is cat now access restricted, or gone?
    if (!curCat)
      continue;

    // Don't overwrite a more recent topic list, with an older list.
    if (curCat.recentTopics)
      continue;

    curCat.recentTopics = oldCat.recentTopics;
  }
}


ReactStore.allData = function(): Store {
  return store;
};


ReactStore.me = function(): Me {
  return store.me;
};


// Shows one's drafts: Create a preview post, for each new post draft (but not
// for edit drafts — then, we instead show a text "Unfinished edits" next to the
// edit button. [UFINEDT])
// (Do this also if not logged in — because there might still be drafts in one's
// browser local sessionStorage.)
// Skip chats though — any chat message draft is shown directly in the chat
// message text input box. [CHATPRVW]
//
function addMyDraftPosts(store: Store, myPageData: MyPageData) {
  // Some drafts are saved server side, others just in the browser — the latter ones
  // get loaded here: addLocalStorageDataTo().
  if (!eds.isInEmbeddedEditor && !page_isChat(store.currentPage?.pageRole)) {
    _.each(myPageData.myDrafts, (draft: Draft) => {
      const draftType = draft.forWhat.draftType;
      if (draftType === DraftType.Reply || draftType === DraftType.ProgressPost) {
        const post: Post | null = store_makePostForDraft(store.me.id, draft);
        if (post) {
          updatePost(post, store.currentPageId);
        }
      }
    });
  }
}


function theStore_setOnlineUsers(numStrangersOnline: number, usersOnline: BriefUser[]) {
  store.numOnlineStrangers = numStrangersOnline;
  store.userIdsOnline = {};
  _.each(usersOnline, theStore_addOnlineUser);
}


function theStore_addOnlineUser(user: BriefUser) {
  // Updating state in-place, oh well.
  if (store.userIdsOnline) {
    store.userIdsOnline[user.id] = true;
  }
  // In case any user has e.g. changed his/her name or avatar, use the newer version.
  store_patchPatsInPl(store, [user]);
}


function theStore_removeOnlineUser(user: BriefUser) {
  // Updating state in-place, oh well.
  if (store.userIdsOnline) {
    delete store.userIdsOnline[user.id];
  }
  // In case any user has e.g. changed his/her name or avatar, use the newer version:
  store_patchPatsInPl(store, [user]);
}


function userIdList_add(userIds: UserId[], newUserId: UserId) {
  dieIf(!userIds, 'EsE7YKWF53');
  dieIf(!newUserId, 'EsE2WKG0');
  if (!_.includes(userIds, newUserId)) {
    userIds.push(newUserId);
  }
}


function userIdList_remove(userIds: UserId[], userId: UserId) {
  dieIf(!userIds, 'EsE5PKW0');
  dieIf(!userId, 'EsE2GK50');
  _.remove(userIds, id => id === userId);
}


ReactStore.mayComposeBeforeSignup = function() {
 return store.settings.mayComposeBeforeSignup;
};

ReactStore.getPageId = function() {
  return store.currentPageId;
};


ReactStore.getPageRole = function(): PageRole {
  return store.currentPage.pageRole;
};


ReactStore.getPageTitle = function(): string { // dupl code [5GYK2]
  var titlePost = store.currentPage.postsByNr[TitleNr];
  return titlePost ? titlePost.sanitizedHtml : "(no title)";
};


ReactStore.getMe = function(): Myself {
  return store.me;
};


ReactStore.getCategories = function() {
  return store.currentCategories;
};


ReactStore.emitChange = function() {
  this.emit(ChangeEvent);
};


ReactStore.addChangeListener = function(callback) {
  this.on(ChangeEvent, callback);
};


ReactStore.removeChangeListener = function(callback) {
  this.removeListener(ChangeEvent, callback);
};


export var StoreListenerMixin = {
  UNSAFE_componentWillMount: function() {
    ReactStore.addChangeListener(this.onChange);
  },

  componentWillUnmount: function() {
    // BUG, harmless: [MIXINBUG] onChange might get invoked, just after the component
    // got unmounted, but before we remove the listener here.
    ReactStore.removeChangeListener(this.onChange);
  }
};


export function clonePost(postNr: number): Post {
  return _.cloneDeep(store.currentPage.postsByNr[postNr]);
}


function updatePost(post: Post, pageId: PageId, isCollapsing?: boolean) {
  const page: Page = store.currentPage;

  if (page.pageId !== pageId) {
    // Need to lookup the correct page then, just above, instead of using the current page?
    // But for now, just ignore this. We currently reload, when navigating back to a page
    // in the store anyway [8YDVP2A].
    return;
  }

  const oldVersion = page.postsByNr[post.nr];
  if (oldVersion && !isCollapsing) {
    // If we've modified-saved-reloaded-from-the-server this post, then ignore the
    // collapse settings from the server, in case the user has toggled it client side.
    // If `isCollapsing`, however, then we're toggling that state client side only.
    post.isTreeCollapsed = oldVersion.isTreeCollapsed;
    post.isPostCollapsed = oldVersion.isPostCollapsed;
    post.squash = oldVersion.squash;
    post.summarize = oldVersion.summarize;
  }

  if (post.isPreview) {
    // Don't update num replies etc fields.
  }
  else if (oldVersion) {
    if (post_isReply(post)) {
      const wasVis = post_isPubVisible(oldVersion);
      const isVis = post_isPubVisible(post);
      const change = wasVis === isVis ? 0 : (isVis ? 1 : -1);
      page.numPostsRepliesSection += change;  // CLEAN_UP; REMOVE  [prgr_chat_sect]
      page.numRepliesVisible += change;
    }
  }
  else {
    page.numPosts += 1;
    if (post.nr !== TitleNr) {
      page.numPostsExclTitle += 1;
    }
    if (post.postType === PostType.Flat) {  // CLEAN_UP; REMOVE  [prgr_chat_sect]
      page.numPostsChatSection += 1;
    }
    if (post_isReply(post)) {
      page.numPostsRepliesSection += 1;  // CLEAN_UP; REMOVE  [prgr_chat_sect]
      if (post_isPubVisible(post)) {
        page.numRepliesVisible += 1;
      }
    }
  }

  // Add or update the post itself.
  page.postsByNr[post.nr] = post;

  const layout: DiscPropsDerived = page_deriveLayout(page, store, LayoutFor.PageWithTweaks);

  // In case this is a new post, update its parent's child id list.
  const parentPost = page.postsByNr[post.parentNr];
  if (parentPost) {
    const childNrsSorted = parentPost.childNrsSorted;
    const alreadyAChild = _.find(childNrsSorted, nr => nr === post.nr);
    if (!alreadyAChild) {
      const sortOrder = layout_sortOrderForChildsOf(layout, parentPost);
      if (sortOrder === PostSortOrder.NewestFirst) {
        // (Could avoid unshift(), it allocates new memory!)
        childNrsSorted.unshift(post.nr);
      }
      else {
        // This works for Oldest-First, and probably works ok also for Best-First,
        // since new comments haven't yet gotten any upvotes and would end up last?
        childNrsSorted.push(post.nr);
      }
      sortPostNrsInPlace(
            childNrsSorted, page.postsByNr, sortOrder);
    }
  }

  // Insert into progress reply list, if needed.  BREAK OUT [comt_isForTimeline]  FN
  if (post.postType === PostType.BottomComment || post.postType === PostType.MetaMessage) {
    const alreadyIncl = _.find(page.progressPostNrsSorted, nr => nr === post.nr);
    if (!alreadyIncl) {
      page.progressPostNrsSorted.push(post.nr);
      sortPostNrsInPlace(
          // Progress posts are always sorted by time. [PROGRTIME]
          page.progressPostNrsSorted, page.postsByNr, PostSortOrder.OldestFirst);
    }
  }

  // Update list of top level comments, for embedded comment pages, and custom form pages.
  // (Top level embedded comments have no parent post — there's no Original Post
  //  ... What? There is. But it's still not in use here, for embedded comments.)
  if (!post.parentNr && post.nr != BodyNr && post.nr !== TitleNr) {
    page.parentlessReplyNrsSorted = findParentlessReplyIds(page.postsByNr);
    const sortOrder = layout_sortOrderForChildsOf(layout, { nr: BodyNr });
    sortPostNrsInPlace(
        page.parentlessReplyNrsSorted, page.postsByNr, sortOrder);
  }

  rememberPostsToQuickUpdate(post.nr);

  stopGifsPlayOnClick();
  setTimeout(() => {
    debiki2.page.Hacks.processPosts();
    if (!oldVersion && post.authorId === store.me.id && !post.isPreview &&
        // Need not flash these — if one does sth that results in a meta comment,
        // then one is aware about that already (since one did it oneself).
        // And if sbd else did — then I think that's typically not that interesting,
        // would be distracting to scroll-and-flash-&-show?
        post.postType !== PostType.MetaMessage) {
      // Scroll to and highligt this new / edited post.
      // BUG (harmless) skip if we just loaded it because we're staff or the author,
      // and it's deleted so only we can see it
      // — because that doesn't mean we want to scroll to it and flash it.
      ReactActions.loadAndShowPost(post.nr);
    }
  }, 1);
}


function voteOnPost(action) {
  const postNr: PostNr = action.postNr;

  const me: Myself = store.me;
  const myPageData: MyPageData = me.myCurrentPageData;
  let votes = myPageData.votes[postNr];
  if (!votes) {
    votes = [];
    myPageData.votes[postNr] = votes;
  }

  if (action.doWhat === 'CreateVote') {
    votes.push(action.voteType);
  }
  else {
    _.remove(votes, (voteType) => voteType === action.voteType);
  }

  patchTheStore(action.storePatch);
}


function markPostAsRead(postId: number, manually: boolean) {
  const me: Myself = store.me;
  const myPageData: MyPageData = me.myCurrentPageData;
  const currentMark = myPageData.marksByPostId[postId];
  if (currentMark) {
    // All marks already mean that the post has been read. Do nothing.
  }
  else if (manually) {
    myPageData.marksByPostId[postId] = ManualReadMark;
  }
  else {
    myPageData.postNrsAutoReadNow.push(postId);
  }
  rememberPostsToQuickUpdate(postId);
}


let lastPostIdMarkCycled = null;

function cycleToNextMark(postId: number) {
  const me: Myself = store.me;
  const myPageData: MyPageData = me.myCurrentPageData;
  const currentMark = myPageData.marksByPostId[postId];
  let nextMark;
  // The first time when clicking the star icon, try to star the post,
  // rather than marking it as read or unread. However, when the user
  // continues clicking the same star icon, do cycle through the
  // read and unread states too. Logic: People probably expect the comment
  // to be starred on the very first click. The other states that happen
  // if you click the star even more, are for advanced users — don't need
  // to show them directly.
  if (lastPostIdMarkCycled !== postId) {
    if (!currentMark || currentMark === ManualReadMark) {
      nextMark = FirstStarMark;
    }
    else if (currentMark < LastStarMark) {
      nextMark = currentMark + 1;
    }
    else {
      nextMark = ManualReadMark;
    }
  }
  else {
    if (currentMark === ManualReadMark) {
      nextMark = null;
    }
    else if (!currentMark) {
      nextMark = FirstStarMark;
    }
    else if (currentMark < LastStarMark) {
      nextMark = currentMark + 1;
    }
    else {
      nextMark = ManualReadMark;
    }
  }
  lastPostIdMarkCycled = postId;
  myPageData.marksByPostId[postId] = nextMark;

  rememberPostsToQuickUpdate(postId);
}


function summarizeReplies() {
  // For now, just collapse all threads with depth >= 2, if they're too long
  // i.e. they have successors, or consist of a long (high) comment.
  _.each(store.currentPage.postsByNr, (post: Post) => {
    if (post.nr === BodyNr || post.nr === TitleNr || post.parentNr === BodyNr)
      return;

    function isTooHigh() {
      const postElem = $byId('post-' + post.nr);
      return postElem && postElem.offsetHeight > 150; // offsetHeight = outer height, no margin
    }
    if (post.childNrsSorted.length || isTooHigh()) {
      post.isTreeCollapsed = 'Truncated';
      post.summarize = true;
      post.summary = makeSummaryFor(post);
    }
  });
}


function makeSummaryFor(post: Post, maxLength?: number): string {
  const text = $h.wrapParseHtml(post.sanitizedHtml).textContent;
  const firstParagraph = text.split('\n');
  let summary = firstParagraph[0] || '';
  if (summary.length > maxLength || 200) {
    summary = summary.substr(0, maxLength || 140);
  }
  return summary;
}


function unsquashTrees(postNr: number) {
  // Mark postNr and its nearest subsequent siblings as not squashed.
  const page: Page = store.currentPage;
  const post: Post = page.postsByNr[postNr];

  // parentNr might be undefined.
  const parent: Post | undefined =  page.postsByNr[post.parentNr];
  const siblingNrs: PostNr[] =
      parent ? parent.childNrsSorted : page.parentlessReplyNrsSorted;

  let numLeftToUnsquash = -1;
  const postsUnsquashed = [];

  for (let i = 0; i < siblingNrs.length; ++i) {
    const siblingNr = siblingNrs[i];
    const postOrSibling: Post = page.postsByNr[siblingNr];
    if (!postOrSibling)
      continue; // deleted
    if (postOrSibling.nr == postNr) {
      // Start unsquashing, from here.
      numLeftToUnsquash = 5;
    }
    if (numLeftToUnsquash !== -1) {
      // Updating in-place, should perhaps not. But works right now anyway
      postOrSibling.squash = false;
      postsUnsquashed.push(postOrSibling);
      numLeftToUnsquash -= 1;
    }
    if (numLeftToUnsquash === 0)
      break;
  }

  setTimeout(function() {
    debiki2.page.Hacks.processPosts();
    scrollAndFlashPosts(page, postsUnsquashed);
  });
}


function collapseTree(post: Post) {
  post = clonePost(post.nr);
  post.isTreeCollapsed = 'Truncated';
  post.summarize = true;
  post.summary = makeSummaryFor(post, 70);
  updatePost(post, store.currentPageId, true);
  // It's nice to see where the post is, after having collapsed it
  // — because collapsing a post tree often makes the page jump a bit.
  // UX COULD animate-collapse height of tree to 0? By shrinking each
  // post individually probably, since there's no wrapping <div> to shrink.
  flashPostNrIfThere(post.nr);
}


function showPostNr(postNr: PostNr, showPostOpts: ShowPostOpts = {}) {
  const page: Page = store.currentPage;
  const postToShow: Post = page.postsByNr[postNr];
  let post: Post = postToShow;
  if (showPostOpts.showChildrenToo) {
    uncollapsePostAndChildren(post);
  }
  // Uncollapse ancestors, to make postId visible. Don't loop forever if there's any weird
  // cycle — that crashes Chrome (as of May 3 2017).
  const postNrsSeen = {};
  while (post) {
    if (postNrsSeen[post.nr]) {  // title & OP sometimes has parent = OP -> cycle, why? [OPCYCLE]
      // @ifdef DEBUG
      console.warn(`Post cycle, inludes nr ${post.nr} [EdE2WKVY0]`);
      // @endif
      break;
    }
    postNrsSeen[post.nr] = true;
    // But minor BUG: Usually we want to leave isPostCollapsed = false? (305RKTU).
    uncollapseOne(post);
    post = page.postsByNr[post.parentNr];
  }
  setTimeout(() => {
    const opts: ShowPostOpts = { ...showPostOpts };
    if (postNr <= MaxVirtPostNr) {
      // It's a draft. Add a bit more margin, because there's a "Your draft"
      // text above. [03RKTG42]
      opts.marginTop = 120;  // move this to inside  scrollAndFlashPostNr()  instead
    }

    if (showPostOpts.showChildrenToo) {
      // uncollapsePostAndChildren() will scroll-flash, don't do here too.
    }
    else {
      // Maybe could use instead?: scrollAndFlashPosts(page, [post]);
      scrollAndFlashPostNr(postNr, opts);
    }

    debiki2.page.Hacks.processPosts();
  }, 1);
}


function uncollapsePostAndChildren(post: Post) {
  const page: Page = store.currentPage;
  uncollapseOne(post);
  // Also uncollapse children and grandchildren so one won't have to Click-to-show... all the time.
  for (let i = 0; i < Math.min(post.childNrsSorted.length, 5); ++i) {
    const childNr = post.childNrsSorted[i];
    const child = page.postsByNr[childNr];
    if (!child)
      continue;
    uncollapseOne(child);
    for (let i2 = 0; i2 < Math.min(child.childNrsSorted.length, 3); ++i2) {
      const grandchildNr = child.childNrsSorted[i2];
      const grandchild = page.postsByNr[grandchildNr];
      if (!grandchild)
        continue;
      uncollapseOne(grandchild);
    }
  }
  setTimeout(function() {
    debiki2.page.Hacks.processPosts();
    scrollAndFlashPosts(page, [post]);
  });
}


function uncollapseOne(post: Post) {
  if (!post.isTreeCollapsed && !post.isPostCollapsed && !post.summarize && !post.squash)
    return;
  const p2 = clonePost(post.nr);
  p2.isTreeCollapsed = false;
  p2.isPostCollapsed = false;  // sometimes we don't want this though  (305RKTU)
  p2.summarize = false;
  p2.squash = false;
  updatePost(p2, store.currentPageId, true);
}


function findParentlessReplyIds(postsByNr): number[] {
  const ids: number[] = [];
  _.each(postsByNr, (post: Post) => {
    if (!post.parentNr && post.nr !== BodyNr && post.nr !== TitleNr) {
      ids.push(post.nr);
    }
  });
  return ids;
}



function store_relayoutPageInPlace(store, page, layout: DiscPropsDerived) {
  _.each(page.postsByNr, (post: Post) => {
    const sortOrder = layout_sortOrderForChildsOf(layout, post);
    sortPostNrsInPlace(
          post.childNrsSorted, page.postsByNr, sortOrder);
  });
}


/**
 * NOTE: Keep in sync with  sortPosts(posts, sortOrder)   [SAMESORT]
 * in modules/debiki-core/src/main/scala/com/debiki/core/Post.scala
 */
function sortPostNrsInPlace(postNrs: PostNr[], postsByNr: { [nr: number]: Post },
      postSortOrder: PostSortOrder | U) {
  switch (postSortOrder || PostSortOrder.Inherit) {
    // @ifdef DEBUG
    case PostSortOrder.NewestThenBest:
    case PostSortOrder.NewestThenOldest:
      die(`Got a composite sort order: ${postSortOrder}. First call ` +
          `layout_sortOrderForChildsOf(..) to get the exact sort order ` +
          `for the current depth. [TyE70KJRN4]`);
    // @endif
    case PostSortOrder.BestFirst:
      sortPostNrsInPlaceBestFirst(postNrs, postsByNr);
      break;
    default:
      // By time, oldest first, is the built-in default order. [POSTSORDR] [why_sort_by_time]
      const oldestFirst = postSortOrder !== PostSortOrder.NewestFirst;
      sortPostNrsInPlaceByTime(postNrs, postsByNr, oldestFirst);
  }
}


function sortPostNrsInPlaceByTime(postNrs: PostNr[], postsByNr: { [nr: number]: Post },
      oldestFirst: boolean) {
  postNrs.sort((nrA: number, nrB: number) => {
    const postAOrB: Post = postsByNr[oldestFirst ? nrA : nrB];
    const postBOrA: Post = postsByNr[oldestFirst ? nrB : nrA];
    // If a post got deleted / not included for some reason — treat this as if it
    // is unapproved: place it last.
    if (!postAOrB && !postBOrA)
      return 0;
    if (!postBOrA)
      return -1;
    if (!postAOrB)
      return +1;
    return postAppearedBefore(postAOrB, postBOrA);
  });
}


function sortPostNrsInPlaceBestFirst(postNrs: PostNr[], postsByNr: { [nr: number]: Post }) {
  postNrs.sort((nrA: number, nrB: number) => {
    const postA: Post = postsByNr[nrA];
    const postB: Post = postsByNr[nrB];

    // Perhaps the server shouldn't include deleted comments in the children list?
    // Is that why they're null sometimes? COULD try to find out
    if (!postA && !postB)
      return 0;
    if (!postB)
      return -1;
    if (!postA)
      return +1;

    /* From app/debiki/HtmlSerializer.scala:
    if (a.pinnedPosition.isDefined || b.pinnedPosition.isDefined) {
      // 1 means place first, 2 means place first but one, and so on.
      // -1 means place last, -2 means last but one, and so on.
      val aPos = a.pinnedPosition.getOrElse(0)
      val bPos = b.pinnedPosition.getOrElse(0)
      assert(aPos != 0 || bPos != 0)
      if (aPos == 0) return bPos < 0
      if (bPos == 0) return aPos > 0
      if (aPos * bPos < 0) return aPos > 0
      return aPos < bPos
    } */

    //const onlyOneIsPreview = postA.isPreview !== postB.isPreview;

    // Place append-at-the-bottom posts at the bottom, sorted by time.
    // And preview posts too for now.
    function shouldBeLast(p: Post): Bo {
      return p.postType === PostType.BottomComment ||
            p.postType === PostType.MetaMessage || p.isPreview;
    }

    const aLast = shouldBeLast(postA);
    const bLast = shouldBeLast(postB);
    if (!aLast && bLast)
      return -1;
    if (aLast && !bLast)
      return +1;
    if (aLast && bLast) {
      /* Show any preview at the very bottom, that's where the post will later appear.
      if (onlyOneIsPreview)
        return postA.isPreview ? +1 : -1;
      else */
      return postAppearedBefore(postA, postB)
    }

    /* Show any preview post first, directly below the post it replies to — then,
    // it's simpler to see what post one is replying to. Even though the reply maybe
    // won't appear at that exact location (maybe there're other replies with more
    // like votes to show first).
    if (onlyOneIsPreview)
      return postA.isPreview ? -1 : +1;
    */

    // Place deleted posts last; they're rather uninteresting?
    if (!isDeleted(postA) && isDeleted(postB))
      return -1;
    if (isDeleted(postA) && !isDeleted(postB))
      return +1;

    // Place multireplies after normal replies. See Post.scala.
    if (postA.multireplyPostNrs.length && postB.multireplyPostNrs.length) {
      if (postA.createdAtMs < postB.createdAtMs)
        return -1;
      if (postA.createdAtMs > postB.createdAtMs)
        return +1;
    }
    else if (postA.multireplyPostNrs.length) {
      return +1;
    }
    else if (postB.multireplyPostNrs.length) {
      return -1;
    }

    // Show unwanted posts last. See debiki-core/src/main/scala/com/debiki/core/Post.scala.
    const unwantedA = postA.numUnwantedVotes > 0;
    const unwantedB = postB.numUnwantedVotes > 0;
    if (unwantedA && unwantedB) {
      if (postA.numUnwantedVotes < postB.numUnwantedVotes)
        return -1;
      if (postA.numUnwantedVotes > postB.numUnwantedVotes)
        return +1;
    }
    else if (unwantedA) {
      return +1;
    }
    else if (unwantedB) {
      return -1;
    }

    // Bury bury-voted posts. See debiki-core/src/main/scala/com/debiki/core/Post.scala.
    const buryA = postA.numBuryVotes > 0 && !postA.numLikeVotes;
    const buryB = postB.numBuryVotes > 0 && !postB.numLikeVotes;
    if (buryA && buryB) {
      if (postA.numBuryVotes < postB.numBuryVotes)
        return -1;
      if (postA.numBuryVotes > postB.numBuryVotes)
        return +1;
    }
    else if (buryA) {
      return +1;
    }
    else if (buryB) {
      return -1;
    }

    // Place interesting posts first.
    if (postA.likeScore > postB.likeScore)
      return -1;

    if (postA.likeScore < postB.likeScore)
      return +1;

    // Newest posts last.
    // In Scala, a certain sortWith function is used, but it wants a Bool from the comparison
    // function, not a +-1 or 0 number. True means "should be sorted before".
    // But return 0 instead here to indicate that sort order doesn't matter.
    /*
    if (postA.nr < postB.nr)
      return -1;
    else if (postA.nr > postB.nr)
      return +1;
    else
      return 0; // cannot happen though  */
    // Better to use approvedAt:
    return postAppearedBefore(postA, postB);
  });
}


function postAppearedBefore(postA: Post, postB: Post): number {
  // Sync w Scala [5BKZQF02]
  // BUG  [first_last_apr_at]  use 'nr' only, to sort by date, for now.
  /*
  const postAApprAt = postA.approvedAtMs || Infinity;
  const postBApprAt = postB.approvedAtMs || Infinity;
  if (postAApprAt < postBApprAt) return -1;
  if (postAApprAt > postBApprAt) return +1;
  */

  // Place previews last, since they don't even exist, yet.
  // (There should be just one preview post visible at a time.)
  if (postA.isPreview != postB.isPreview)
    return postA.isPreview ? +1 : -1;

  return postA.nr < postB.nr ? -1 : +1;
}


function handleNotifications(newNotfs: Notification[]) {
  const oldNotfs = store.me.notifications;
  for (let i = 0; i < newNotfs.length; ++i) {
    const newNotf = newNotfs[i];

    // Update notification list in the username menu.
    if (_.every(oldNotfs, n => n.id !== newNotf.id)) {
      // Modifying state directly, oh well [redux]
      store.me.notifications.unshift(newNotf);
      updateNotificationCounts(newNotf, true);
    }

    watchbar_handleNotification(store.me.watchbar, newNotf);
  }
}


function markAnyNotificationssAsSeen(postNr) {
  const notfs: Notification[] = store.me.notifications;
  _.each(notfs, (notf: Notification) => {
    if (notf.pageId === store.currentPageId && notf.postNr === postNr) {
      // Modifying state directly, oh well [redux]
      if (!notf.seen) {
        notf.seen = true;
        updateNotificationCounts(notf, false);
        // Simpler to call the server from here:
        Server.markNotificationAsSeen(notf.id);
      }
    }
  });
}


function updateNotificationCounts(notf: Notification, add: boolean) {
  // Modifying state directly, oh well [redux]
  const delta = add ? +1 : -1;
  if (isTalkToMeNotification(notf)) {
    store.me.numTalkToMeNotfs += delta;
  }
  else if (isTalkToOthersNotification(notf)) {
    store.me.numTalkToOthersNotfs += delta;
  }
  else {
    store.me.numOtherNotfs += delta;
  }
}


function maybePatchTheStore(ps: { storePatch?: StorePatch }) {
  if (ps.storePatch) {
    patchTheStore(ps.storePatch);
  }
}


function patchTheStore(respWithStorePatch: any) {  // REFACTOR just call directly, instead of via [flux_mess].
  // Later, won't need the `|| ...`. [storepatch_field]
  const storePatch: StorePatch = respWithStorePatch.storePatch || respWithStorePatch;
  if (isDefined2(storePatch.setEditorOpen) && storePatch.setEditorOpen !== store.isEditorOpen) {
    store.isEditorOpen = storePatch.setEditorOpen;
    store.editorsPageId = storePatch.setEditorOpen && storePatch.editorsPageId;
    store.replyingToPostNr = storePatch.setEditorOpen && storePatch.replyingToPostNr;
    store.editingPostId = storePatch.setEditorOpen && storePatch.editingPostId;
    // Need to update all posts when the editor opens, to hide all Reply buttons
    // — so cannot quick-update just one post.
    store.cannotQuickUpdate = true;
  }

  if (storePatch.appVersion && storePatch.appVersion !== store.appVersion) {
    // COULD show dialog, like Discourse does: (just once)
    //   The server has been updated. Reload the page please?
    //   [Reload this page now]  [No, not now]
    // For now though:
    return;
  }

  if (storePatch.superadmin) {
    store.superadmin = storePatch.superadmin;
  }

  // ----- Oneself

  if (storePatch.me) {
    // [redux] modifying the store in place, again.
    let patchedMe: Myself | U;
    if (eds.isInIframe) {
      // Don't forget [data about pat] loaded by other frames.  [mny_ifr_pat_dta]
      try {
        const sessWin = getMainWin();
        const sessStore: SessWinStore = sessWin.theStore;
        if (_.isObject(sessStore.me)) {
          patchedMe = me_merge(sessStore.me, store.me, storePatch.me);  // [emb_ifr_shortcuts]
          sessStore.me = _.cloneDeep(patchedMe);
        }
      }
      catch (ex) {
        logW(`Multi iframe error? [TyEMANYIFR04]`, ex)
      }
    }
    if (!patchedMe) {
      patchedMe = _.assign(store.me || {} as Myself, storePatch.me);
    }
    store.me = patchedMe;
  }

  // ----- Drafts

  if (storePatch.deleteDraft) {
    const deletor: DraftDeletor = storePatch.deleteDraft;
    _.each(store.me.myDataByPageId, (myData: MyPageData) => {
      myData.myDrafts = _.filter(myData.myDrafts, (draft: Draft) => {
        // 1) Compare by locator (i.e. forWhat), because:
        // Sometimes, the draftNr is 0 (or maybe in the future, different random negative
        // numbers), although it's the same draft — namely when one hasn't logged in
        // yet and the server hasn't assigned any draft nr to the draft.
        // 2) Compare by draftNr too, because:
        // Maybe in some cases, the locators are slightly different somehow,
        // although it's the same draft — e.g. if an embedding page's url got changed?
        const toDelete: DraftLocator | U = deletor.forWhat;

        const sameLocator = !toDelete ? false :
            draft.forWhat.draftType === toDelete.draftType && (
              ( // Same page and post nr?
                (draft.forWhat.pageId === toDelete.pageId
                    || draft.forWhat.embeddingUrl === toDelete.embeddingUrl)
                && (
                  draft.forWhat.postNr === toDelete.postNr))
              || (
                // A message to the same person? New topic, same category? Etc.
                // Then this should work:
                _.isEqual(draft.forWhat, toDelete)));

        const sameDraftNr =
            !!draft.draftNr && draft.draftNr === deletor.draftNr;

        const shallDelete = sameLocator || sameDraftNr;
        return shallDelete;
      });
    });
  }

  // ----- Categories

  // CLEAN_UP do also if only restrictedCategories non-empty?
  // Or maybe an allCats field?
  if (storePatch.publicCategories) {   // [upd_store_cats_hack]
    dieIf(!storePatch.restrictedCategories, 'TyEK2WP49');
    // [redux] modifying the store in place, again.
    store.me.restrictedCategories = storePatch.restrictedCategories;
    store.publicCategories = storePatch.publicCategories;
    const oldCurCats = store.currentCategories;
    store_initCurCatsFromPubCats(store);
    store_addRestrictedCurCatsInPl(store, store.me.restrictedCategories);
    addBackRecentTopicsInPl(oldCurCats, store.curCatsById);
  }

  // ----- Tag types

  // @ifdef DEBUG
  dieIf(storePatch.allTagTypes && storePatch.tagTypes, 'TyE40JMW3XP5');
  // @endif

  store_patchTagTypesInPl(store, storePatch.tagTypes);

  if (storePatch.allTagTypes) {
    store.tagTypesById = groupByKeepOne(storePatch.allTagTypes, tt => tt.id);
  }
  if (storePatch.allTagTypeStatsById) {
    store.tagTypeStatsById = storePatch.allTagTypeStatsById;
  }

  // ----- Users

  store_patchPatsInPl(store, storePatch.usersBrief || storePatch.patsBrief);

  // ----- Pages

  _.each(storePatch.pageMetasBrief || [], (pageMeta: PageMetaBrief) => {
    store.pageMetaBriefById[pageMeta.pageId] = pageMeta;
  });

  _.each(storePatch.deletePageIds || [], (id: PageId) => {
    const page: Page = store.pagesById[id];
    if (page) {
      page.pageDeletedAtMs = 1; // for now,  also at: [206KDH35R]
    }
  });

  const currentPage: Page | U = store.currentPage;

  let changesComtSortOrder: U | Bo;

  if (!currentPage) {
    delete store.curPageTweaks;
  }
  else if (storePatch.curPageTweaks) {
    // (Or  isDefButNot(storePatch.curPageTweaks.comtOrder, store.curPageTweaks.comtOrder)?
    // But might not matter — we wouldn't get a store patch, if wasn't changed?)
    changesComtSortOrder = isDef(storePatch.curPageTweaks.comtOrder);
    store.curPageTweaks = {
      ...store.curPageTweaks,
      ...storePatch.curPageTweaks,
    };
    if (store.curPageTweaks.comtOrder === PostSortOrder.Inherit) {
      // No need to remember Inherit — that value just means that we should delete
      // any comtOrder value, so a value from the page or its parent categories
      // gets used instead.
      delete store.curPageTweaks.comtOrder;
    }
    if (store.curPageTweaks.comtNesting === InheritNesting) {
      // (See comment above about comtOrder.)
      delete store.curPageTweaks.comtNesting;
    }
  }

  // If we just posted the very first reply on an embedded discussion, a page for the discussion
  // will have been created now, lazily. Then need to update the store page id.
  if (storePatch.newlyCreatedPageId && currentPage) {
    dieIf(_.size(currentPage.postsByNr) > NumEmptyPageDummyPosts, 'EdE2PB604');
    dieIf(store.currentPageId !== EmptyPageId, 'EdEZ4BSSJ2');
    dieIf(store.currentPageId !== currentPage.pageId, 'EdE7GBW2');
    currentPage.pageId = storePatch.newlyCreatedPageId;
    store.currentPageId  = storePatch.newlyCreatedPageId;

    // This'll make the page indexed by both EmptyPageId and newlyCreatedPageId:
    // (Could remove the NoPageId key? But might cause some bug?)
    store.pagesById[currentPage.pageId] = currentPage;

    // If posting (an additional) reply to the orig post, we hereafter
    // need its id. [NEEDEMBOP]  Hmm wouldn't it make more sense if the
    // server sent back the whole new page? Instead of just patching the orig
    // post id here, but keeping other out-of-date fields. Anyway, this works
    // fine as of now:
    const origPost = currentPage.postsByNr[BodyNr];
    origPost.uniqueId = storePatch.newlyCreatedOrigPostId;

    // Update this, so subsequent server requests, will use the correct page id. [4HKW28]
    eds.embeddedPageId = storePatch.newlyCreatedPageId;
    // Later: Add this new page to the watchbar? Currently not needed, because pages created
    // lazily only for embedded comments, and then there's no watchbar.
  }

  // ----- Posts — new or re/moved?

  _.each(storePatch.postsByPageId, (patchedPosts: Post[], patchedPageId: PageId) => {
    // Highligt pages with new posts, in the watchbar.
    if (patchedPageId !== store.currentPageId) {
      // Could look at the new posts to find out if there are any direct replies to the current
      // user, or @mentions, and update the watchbar accordingly. But probably
      // better to do this elsewhere, namely when handling notifications [4YK2E5]?
      watchbar_markAsUnread(store.me.watchbar, patchedPageId);
    }

    // Find out if some post was moved to elsewhere.
    // Remove the post from its former parent, if we're moving it to elsewhere on the page,
    // or to another page.
    // (Don't lookup pagesById[patchedPageId] because won't work, if moved to new page.
    // We need to search everything in pagesById, because we don't know which page might
    // have been the old one, if any.)
    _.each(store.pagesById, (oldPage: Page) => {
      _.each(patchedPosts, (patchedPost: Post) => {
        _.each(oldPage.postsByNr, (oldPost: Post) => {
          // Oops, drafts and previews have ids like = -1000101, -1000102
          // — but they are the *newest*, so, "old" in oldPost is then misleading.
          if (oldPost.uniqueId === patchedPost.uniqueId) {
            const movedToNewPage = oldPage.pageId !== patchedPageId;
            const movedOnThisPage = !movedToNewPage && oldPost.parentNr !== patchedPost.parentNr;
            if (movedOnThisPage) {
              // It'll get reinserted into its new location, by updatePost() below.
              page_removeFromParentInPlace(oldPage, oldPost);
            }
            if (movedToNewPage) {
              // It'll get inserted into the new page by updatePost() below.
              page_deletePostInPlace(oldPage, oldPost);
            }
            // If the current page gets changed, then, need redraw arrows,
            // indentation, etc — cannot quick update.
            if (movedOnThisPage || movedToNewPage) {
              if (oldPage.pageId === store.currentPageId ||
                  patchedPageId === store.currentPageId) {
                store.cannotQuickUpdate = true;
              }
            }
          }
        });
      });
    });
  });

  if (changesComtSortOrder) {
    const layoutAfter = page_deriveLayout(
            currentPage, store, LayoutFor.PageWithTweaks);
    store_relayoutPageInPlace(store, currentPage, layoutAfter);
  }

  // Update the current page.
  if (!storePatch.pageVersionsByPageId) {
    // No page. Currently storePatch.usersBrief is for the current page (but there is none)
    // so ignore it too.
    return;
  }

  // ----- Posts, new or edited?

  _.each(store.pagesById, patchPage);

  function patchPage(page: Page) {
    const storePatchPageVersion = storePatch.pageVersionsByPageId[page.pageId];
    if (!storePatchPageVersion || storePatchPageVersion < page.pageVersion) {
      // These changes are old, might be out-of-date, ignore.
      return;
    }
    else if (storePatchPageVersion === page.pageVersion) {
      // We might be loading the text of a hidden/unapproved/deleted comment, in order to show it.
      // So although store & patch page versions are the same, proceed with updating
      // any posts below.
    }
    else {
      // (Hmm this assumes we get all patches in between these two versions, or that
      // the current patch contains all changes, since the current page version.)
      page.pageVersion = storePatchPageVersion;
    }

    const patchedPosts = storePatch.postsByPageId[page.pageId];
    _.each(patchedPosts || [], (patchedPost: Post) => {
      // RENAME to  upsertPost?
      updatePost(patchedPost, page.pageId);
    });

    // The server should have marked this page as unread because of these new events.
    // But we're looking at the page right now — so tell the server that the user has seen it.
    // (The server doesn't know exactly which page we're looking at — perhaps we have many
    // browser tabs open, for example.)
    // COULD wait with marking it as seen until the user shows s/he is still here.
    if (page.pageId === currentPage.pageId && store.me.isAuthenticated) {
      Server.markCurrentPageAsSeen();
    }
  }
}


/// Adds/updates pats, in-place. Avoids overwriting a pat obj with "lots of" info,
/// e.g. tags, with an obj with less info.
///
function store_patchPatsInPl(store: Store, pats: Pat[]) {
  for (const pat of pats || []) {
    // Don't overwrite any existing user entry, with a new entry with only the name
    // and avatar — if the old entry includes more data (e.g. pubTags).
    // Later: Also don't overwrite with out-of-date user. [user_version]
    const oldPat: Pat | U = store.usersByIdBrief[pat.id];
    // That at least the pubTags fields is not lost, is tested here:
    // Tests:  tags-badges-not-missing.2br  TyTETAGS0MISNG.TyTUNAPRPATBADGE
    const mergedPat = oldPat ? { ...oldPat, ...pat } : pat;   // [merge_pub_restr]
    store.usersByIdBrief[pat.id] = mergedPat;
  }
}


function store_patchTagTypesInPl(store: Store, tagTypes: TagType[] | NU) {
  if (!tagTypes || !tagTypes.length) return;
  store.tagTypesById = { ...store.tagTypesById };
  for (const tt of tagTypes) {
    // Ok to overwrite any old with new — there're currently no restricted fields
    // that can get lost. But later, maybe merge?  [merge_pub_restr]  [tag_versions]
    store.tagTypesById[tt.id] = tt;
  }
}


function showNewPage(ps: ShowNewPageParams) {
  const newPage = ps.newPage;
  const history = ps.history;

  // Upload any current reading progress, before changing page id.
  page.PostsReadTracker.sendAnyRemainingData(() => {}); // not as beacon

  // Change page.
  const oldPage: Page = store.currentPage;
  store.currentPage = newPage;
  store.currentPageId = newPage.pageId;
  if (newPage.pageId) {
    store.pagesById[newPage.pageId] = newPage;
  }
  // @ifdef DEBUG
  else {
    // Is an auto page (see makeAutoPage()), e.g. a user profile page, and has no id.
    dieIf(newPage.dbgSrc !== 'AP', 'TyE25KT70R1');
  }
  // @endif

  delete store.curPageTweaks;

  // Forget any topics from the original page load. Maybe we're now in a different sub community,
  // or some new topics have been created. Better reload.
  store.topics = null;

  let myData: MyPageData;
  if (ps.me) {
    const updatedMe: Me = ps.me;
    // We only use .watchbar and .myDataByPageId[_], but server side, we load more stuff.
    // [load_less_me_data]
    store.me.watchbar = updatedMe.watchbar;
    myData = updatedMe.myDataByPageId[newPage.pageId];
    if (myData) {
      store.me.myDataByPageId[newPage.pageId] = myData;
    }
  }

  store.me.myCurrentPageData = myData || makeNoPageData();

  // Update <title> tag. Also done from the title editor [30MRVH2].
  const titlePost = newPage.postsByNr[TitleNr];
  if (titlePost && titlePost.unsafeSource) {
    // This gets interpreted as text, so ok to use the unsanitized source.
    // (Don't use the sanitized html — that'd result in e.g. '&amp;' instead of '&'.)
    document.title = titlePost.unsafeSource;
  }

  // ----- Update categories

  // Better do this early (here), in case any subsequent code looks at the
  // categoreis, to determine settings or access permissions?

  // Maybe this page is in a different sub community with different categories,
  // or the new page is a PageType.Forum and then the categories also
  // include recent topics?  [per_cat_topics]
  store.publicCategories = ps.pubCats;
  const oldCurCats = store.currentCategories;
  store_initCurCatsFromPubCats(store);

  if (ps.me) {
    store_addRestrictedCurCatsInPl(store, ps.me.restrictedCategories);
    // Not needed? But anyway, less confusing if is updated too:
    store.me.restrictedCategories = ps.me.restrictedCategories;
  }

  addBackRecentTopicsInPl(oldCurCats, store.curCatsById);

  // ----- Add public things

  // Add users on the new page, to the global users-by-id map.
  store_patchPatsInPl(store, ps.pats);

  // Add page tags and user badges needed to render the page.
  store.tagTypesById = { ...store.tagTypesById, ...ps.tagTypesById };

  // ----- Add access restricted things

  // Add things only this user, `me`, may see, after the public things.
  // The access restricted things can include details, e.g. access restricted
  // obj fields, so we add these last, so they'll replace any public stuff. Rather
  // than the other way around — then, the restricted fields might get lost.
  // However, no longer an issue, since now we { ... ... } merge the pub and
  // restr things? [merge_pub_restr]

  if (myData) {
    store_addAnonsAndUnapprovedPosts(store, myData);  // TyTE2E603SKD
  }

  // And more things needed for rendering things the current user can see,
  // but not everyone, so not incl in e.g. ps.tagTypesById.
  if (ps.stuffForMe) {
    const stuff = ps.stuffForMe;
    store_patchTagTypesInPl(store, stuff.tagTypes);
  }

  // ----- HTML classes

  // Update <html> elem classes list, so pages with custom classes & CSS render properly.
  const oldClassesStr = (oldPage.pageHtmlTagCssClasses || '') + magicClassFor(oldPage);
  const newClassesStr = (newPage.pageHtmlTagCssClasses || '') + magicClassFor(newPage);
  function magicClassFor(page: Page): string {
    // Sync with Scala [4JXW5I2].
    let clazz = '';
    if (page_isChat(page.pageRole)) clazz = ' es-chat';
    if (page.pageRole === PageRole.Forum) clazz = ' es-forum';
    if (page.pageRole === PageRole.MindMap) clazz += ' dw-hz';
    else clazz += ' dw-vt';
    clazz += (!page.pageRole ? '' : ' s_PT-' + page.pageRole);     // [5J7KTW2]
    clazz += (!page.pageLayout ? '' : ' s_PL-' + page.pageLayout);
    return clazz;
  }
  if (oldClassesStr || newClassesStr) {
    const regex = /[ ,]+/;
    const oldClasses = oldClassesStr.split(regex);
    const newClasses = newClassesStr.split(regex);
    function addOrRemoveClasses(as, bs, fn) {
      for (let i = 0; i < as.length; ++i) {
        const a = as[i].trim();
        if (a && bs.indexOf(a) === -1) {
          fn(document.documentElement, a);
        }
      }
    }
    addOrRemoveClasses(oldClasses, newClasses, $h.removeClasses);
    addOrRemoveClasses(newClasses, oldClasses, $h.addClasses);
  }

  // ----- URL path

  // Maybe a /-pageid path to the page was specified. But that won't work for forum pages,
  // whose routes have been mounted only on path like /forum/. So, if the path is
  // incorrect, then correct it: update the address bar to the correct page path.
  // This is best done here? Before emitting the change event, so won't trigger changes twice?
  // COULD_OPTIMIZE AVOID_RERENDER But history.replace triggers a re-render immediately :-(
  // no way to avoid that? And instead merge with the emit(ChangeEvent) above?
  const pagePath = newPage.pagePath.value;
  let correctedUrl;
  if (pagePath && pagePath !== location.pathname) {
    if (newPage.pageRole === PageRole.Forum && urlPath_isToForum(location.pathname, pagePath)) {
      // Fine, is to somewhere inside the forum, not supposed to be an exact match.
    }
    else {
      correctedUrl = pagePath + location.search + location.hash;
      history.replace(correctedUrl);  // [4DKWWY0]  TyTE2EPGID2SLUG
    }
  }

  // ----- Watchbar

  if (me_isStranger(store.me)) {
    addPageToStrangersWatchbar(store.currentPage, store.me.watchbar);
  }

  // ----- Drafts (coudl move upwards to other `me` things)

  // COULD also load draft from the browser storage for this new page. [LDDFTS]
  // Like:  addLocalStorageDataTo(me, isNewPage = true);
  addMyDraftPosts(store, store.me.myCurrentPageData);

  // ----- Misc & "hacks"

  // Make Back button work properly.
  debiki2.rememberBackUrl(correctedUrl);

  // Restart the reading progress tracker, now when on a new page.
  page.PostsReadTracker.reset();

  page.clearScrollHistory();

  // Not impossible that pat is currently typing a keyboard shortcut? Better
  // cancel any such ongoing shortcut, in case it won't work on the new page.
  KeyboardShortcuts.resetAndCloseDialog();

  // Update any top header links so the hereaafter active one (if any) gets highlighted/underlined.
  debiki2.utils.highlightActiveLinkInHeader();

  // REFACTOR Maybe combine start-page.ts, and this showNewPage(), and doUrlFragmentAction(),
  // into one single file/module? because it's all do-when-showing-new-page stuff.
  // (Don't call directly — would trigger render() from inside render().
  setTimeout(ReactActions.doUrlFragmentAction);

  // When done rendering, replace date ISO strings with pretty dates.
  setTimeout(debiki2.page.Hacks.processPosts);
}


function watchbar_markAsUnread(watchbar: Watchbar, pageId: PageId) {
  watchbar_markReadUnread(watchbar, pageId, false);
}


function watchbar_markAsRead(watchbar: Watchbar, pageId: PageId) {
  watchbar_markReadUnread(watchbar, pageId, true);
}


function watchbar_markReadUnread(watchbar: Watchbar, pageId: PageId, read: boolean) {
  watchbar_foreachTopic(watchbar, watchbarTopic => {
    if (watchbarTopic.pageId === pageId) {
      watchbarTopic.unread = !read;
    }
  })
}


function watchbar_handleNotification(watchbar: Watchbar, notf: Notification) {
  let alreadyThere = false;
  if (notf.type === NotificationType.Message) {
    _.each(watchbar[WatchbarSection.DirectMessages], (watchbarTopic: WatchbarTopic) => {
      if (watchbarTopic.pageId === notf.pageId) {
        watchbarTopic.unread = true; // modifying store in place, oh well [redux]
        alreadyThere = true;
      }
    });
    if (!alreadyThere) {
      // Modifying store in place, oh well [redux]
      watchbar[WatchbarSection.DirectMessages].unshift(notf_toWatchbarTopic(notf));
    }
  }
  if (notf.type === NotificationType.DirectReply
        || notf.type === NotificationType.IndirectReply
        || notf.type === NotificationType.Mention
        || notf.type === NotificationType.Assigned
        || notf.type === NotificationType.Unassigned
        // But skip OneLikeVote, not that interesting, right.
        ) {
    // Fix later. Like so?
    // If topic not in watchbar, add it to the appropriate section (chat, messages, or recent).
    // Then bump the notfsToMe or notfsToMany count, for the WatchbarTopic,
    // and mark it as unread.
    // Or do this elsewhere? [4YK2E5] Probably better to do here? because here we'll get notfs
    // also about pages not currently listed in the watchbar.
  }
  if (notf.type === NotificationType.PostTagged
        || notf.type === NotificationType.AssigneesChanged) {
    // Skip? A notification should be enough, needn't appear in the watcbar _too_?
    // *Or* add it to a new Events or Watching section?
  }
}


function notf_toWatchbarTopic(notf: Notification): WatchbarTopic {
  return {
    pageId: notf.pageId,
    title: notf.pageTitle,
    type: null, // COULD specify notf.pageType, but currently not used
    unread: true,
    // We don't know about these two, info currently not included in the json: [4Y2KF8S]
    notfsToMe: 1,
    // notfsToMany: number;
  };
}


function watchbar_foreachTopic(watchbar: Watchbar, fn: (topic: WatchbarTopic) => void) {
  _.each(watchbar[WatchbarSection.SubCommunities], fn);
  _.each(watchbar[WatchbarSection.RecentTopics], fn);
  _.each(watchbar[WatchbarSection.ChatChannels], fn);
  _.each(watchbar[WatchbarSection.DirectMessages], fn);
}


function watchbar_copyUnreadStatusFromTo(old: Watchbar, newWatchbar: Watchbar) {
  watchbar_foreachTopic(newWatchbar, (newTopic: WatchbarTopic) => {
    watchbar_foreachTopic(old, (oldTopic: WatchbarTopic) => {
      if (oldTopic.pageId === newTopic.pageId) {
        newTopic.unread = oldTopic.unread;
      }
    });
  });
}


function makeStranger(store: Store): Myself {
  const stranger = {
    dbgSrc: '5BRCW27',
    isStranger: true,
    trustLevel: TrustLevel.Stranger,
    threatLevel: ThreatLevel.HopefullySafe,
    permsOnPages: [],

    numUrgentReviewTasks: 0,
    numOtherReviewTasks: 0,

    numTalkToMeNotfs: 0,
    numTalkToOthersNotfs: 0,
    numOtherNotfs: 0,
    thereAreMoreUnseenNotfs: false,
    notifications: <Notification[]> [],

    watchbar: loadWatchbarFromSessionStorage(),

    restrictedTopics: <Topic[]> [],
    restrictedTopicsUsers: <BriefUser[]> [],
    restrictedCategories: <Category[]> [],

    closedHelpMessages: <any> {},
    tourTipsSeen: <TourTipsSeen> [],
    uiPrefsOwnFirst: <UiPrefs[]> [],

    myGroupIds: [Groups.EveryoneId],
    myCatsTagsSiteNotfPrefs: <PageNotfPref[]> [],
    groupsCatsTagsSiteNotfPrefs: <PageNotfPref[]> [],
    myDataByPageId: <any> {},
    myCurrentPageData: makeNoPageData(),

    marksByPostId: {},

    // Currently guests may not upload files. [may_unau_upl]
    effMaxUplBytes: 0,
    effAlwUplExts: [],
  };
  // There might be some globally pinned chats, which we also want to show in the watchbar.
  if (store.strangersWatchbar) {
    stranger.watchbar[3] = store.strangersWatchbar[3];
  }
  return stranger;
}


/**
 * This data should be stored server side, but right now I'm prototyping only and
 * storing it client side only.
 */
function addLocalStorageDataTo(me: Myself) {
  me.closedHelpMessages = getFromLocalStorage('closedHelpMessages') || {};

  if (me_isStranger(me)) {
    const sessionWatchbar = loadWatchbarFromSessionStorage();
    me.watchbar[WatchbarSection.SubCommunities] = sessionWatchbar[WatchbarSection.SubCommunities];
    me.watchbar[WatchbarSection.RecentTopics] = sessionWatchbar[WatchbarSection.RecentTopics];
  }

  // COULD do this not only for embeded comments, but also for a forum
  // — if compose-before-login enabled. [LDDFTS]
  //
  // Any drafts in the browser's storage?
  if (!eds.isInEmbeddedEditor) {
    // BUG minor: COULD also load embedded comments drafts whose pageId is NoPageId,
    // if their url or discussion id match. They might have been saved in the browser,
    // before an embedded discussion page had been created.

    //   [find_br_drafts] Should do like this in the editor too?
    BrowserStorage.forEachDraft(store.currentPageId, (draft: Draft) => {
      // BUG, harmless: Skip drafts that got loaded from the server already,
      // so browser storage drafts won't overwrite them (until the editor gets opened
      // and the real draft text gets loaded from the server).
      const draftDiscId = draft.forWhat.discussionId;
      const embUrl = draft.forWhat.embeddingUrl;
      if (draftDiscId && draftDiscId !== eds.embeddedPageAltId) {
        // This is for an embedded discussion, not the same as the discussion
        // we're in now. [draft_diid]
      }
      else if (embUrl && embUrl !== eds.embeddingUrl) { // dupl code  [find_br_drafts]
        // Also the wrong embedded discussion — at least the editor won't load it,
        // so better not show it here, currently. [emb_draft_url]
      }
      else {
        me.myCurrentPageData.myDrafts.push(draft);
      }
    });
  }

  if (!store.currentPageId)
    return;

  const myPageData: MyPageData = me.myCurrentPageData;
  myPageData.postNrsAutoReadLongAgo = page.PostsReadTracker.getPostNrsAutoReadLongAgo();
  myPageData.marksByPostId = {}; // not implemented: loadMarksFromLocalStorage();

  if (me_isStranger(me)) {
    addPageToStrangersWatchbar(store.currentPage, me.watchbar);
  }
}


function addPageToStrangersWatchbar(page: Page, watchbar: Watchbar) {
  if (!page || !shallAddCurrentPageToSessionStorageWatchbar())
    return;

  // Add page to the sub-communities watchbar section, or the recent-topics section?
  const watchbarIndex = page.pageRole === PageRole.Forum ?
      WatchbarSection.SubCommunities : WatchbarSection.RecentTopics;
  const topics = watchbar[watchbarIndex];

  // Remove the current page.
  const thisPageIndex = _.findIndex(topics, (topic: WatchbarTopic) => topic.pageId === page.pageId);
  if (thisPageIndex >= 0) {
    topics.splice(thisPageIndex, 1);
  }

  // Add it back, first.
  topics.unshift({
    pageId: page.pageId,
    type: page.pageRole,
    title: ReactStore.getPageTitle(),
  });
  // Not more than ... 7? in the recent list.
  topics.splice(7, 999);

  // Save, so remembered accross page reloads.
  putInSessionStorage('strangersWatchbar', watchbar);
}


function loadWatchbarFromSessionStorage(): Watchbar {
  // For privacy reasons, don't use localStorage?
  const watchbar = <Watchbar> getFromSessionStorage('strangersWatchbar') || {1:[],2:[],3:[],4:[]};
  unmarkCurrentTopic(watchbar[WatchbarSection.SubCommunities]);
  unmarkCurrentTopic(watchbar[WatchbarSection.RecentTopics]);
  function unmarkCurrentTopic(topics) {
    _.each(topics, topic => {
      if (topic.pageId === store.currentPageId) {
        topic.unread = false;
      }
    });
  }
  return watchbar;
}


function shallAddCurrentPageToSessionStorageWatchbar(): boolean {
  if (!store.currentPageId || store.currentPageId === EmptyPageId)
    return false;

  const currentPage: Page = store.currentPage;
  return pageRole_shallInclInWatchbar(currentPage.pageRole)
}


function loadMarksFromLocalStorage(): { [postId: number]: any } {
  return {};
}


function saveMarksInLocalStorage(marks: { [postId: number]: any }) {
  //...
}


function rememberPostsToQuickUpdate(startPostId: number) {
  store.quickUpdate = true;
  const currentPage: Page = store.currentPage;
  const postsByNr = currentPage.postsByNr;
  let post = postsByNr[startPostId];
  if (!post) {
    console.warn('Cannot find post to quick update, nr: ' + startPostId + ' [DwE4KJG0]');
    return;
  }

  // In case `post` is a newly added reply, we'll update all earlier siblings, because they
  // draw an arrow to `post`. However if you've added an Unwanted vote, and post a new reply,
  // then a hereafter unwanted earlier sibling might be moved below startPostId. So we need
  // to update all subsequent siblings too.
  const parent: any = postsByNr[post.parentNr] || {};
  for (let i = 0; i < (parent.childNrsSorted || []).length; ++i) {
    const siblingNr = parent.childNrsSorted[i];
    store.postsToUpdate[siblingNr] = true;
  }

  // Need to update all ancestors, otherwise when rendering the React root we won't reach
  // `post` at all.
  let visitedNrs = {};
  while (post) {
    store.postsToUpdate[post.nr] = true;
    visitedNrs[post.nr] = true;
    post = postsByNr[post.parentNr];
    // The title & OP sometimes has parent = OP -> cycle, why? [OPCYCLE]
    if (post && visitedNrs[post.nr])
      break;
  }
}


function stopGifsPlayOnClick() {
  setTimeout(window['Gifffer'], 50);
}


function setWatchbarOpen(open: boolean) {
  if (open) $h.addClasses(htmlElem, 'es-watchbar-open');
  else $h.removeClasses(htmlElem, 'es-watchbar-open');
  putInLocalStorage('isWatchbarOpen', open);
  store.isWatchbarOpen = open;
}


function setContextbarOpen(open: boolean) {
  if (open) $h.addClasses(htmlElem, 'es-pagebar-open');
  else $h.removeClasses(htmlElem, 'es-pagebar-open');
  putInLocalStorage('isContextbarOpen', open);
  store.isContextbarOpen = open;
}


function updateShallSidebarsOverlayPage() {
  if (window.innerWidth < 780) { // dupl constant, see debikiScriptsHead.scala.html [5YKT42]
    if (store.shallSidebarsOverlayPage) return;
    $h.addClasses(htmlElem, 'esSidebarsOverlayPage');
    store.shallSidebarsOverlayPage = true;
  }
  else {
    if (!store.shallSidebarsOverlayPage) return;
    $h.removeClasses(htmlElem, 'esSidebarsOverlayPage');
    store.shallSidebarsOverlayPage = false;
  }
  ReactStore.emitChange();
}

//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 list
