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


type StoreStateSetter = (store: Store) => void;
const useStoreStateSetters: StoreStateSetter[] = [];


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
  // SHOULD clone the store here? [8GKB3QA] but might introduce so many bugs, so wait a bit.
  // So becomes (more) immutable.
  switch (action.actionType) {

    case ReactActions.actionTypes.NewMyself:
      ReactStore.activateMyself(action.user);
      store.numOnlineStrangers = Math.max(0, store.numOnlineStrangers - 1);
      theStore_addOnlineUser(me_toBriefUser(action.user));
      break;

    case ReactActions.actionTypes.Logout:
      // Not really needed, because logoutClientSideOnly() does reload() [502098SK]
      // — but let's clear this anyway:
      delete typs.weakSessionId;

      // (Perhaps the server should instead include a 'reloadPage' param in the /-/logout response?)
      if (store.userMustBeAuthenticated !== false || store.userMustBeApproved !== false)
        location.reload();

      // (No longer needed — now we redirect in Server.ts instead [9UMD24]. Remove this 'if' then?)
      if (currentPage.pageRole === PageRole.FormalMessage) {
        // We may not see it any longer.
        location.assign('/');
      }

      $h.removeClasses(htmlElem, 'dw-is-admin dw-is-staff dw-is-authenticated');

      if (store.userIdsOnline) delete store.userIdsOnline[store.me.id];
      store.numOnlineStrangers += 1;
      store.me = makeStranger(store);
      store.user = store.me; // try to remove
      debiki2.pubsub.subscribeToServerEvents(store.me);
      break;

    case ReactActions.actionTypes.NewUserAccountCreated:
      store.newUserAccountCreated = true;
      break;

    case ReactActions.actionTypes.CreateEditForumCategory:
      patchTheStore({
        publicCategories: action.publicCategories,
        restrictedCategories: action.restrictedCategories,
      });
      // COULD sort perms somehow, how? And remove dupls? [4JKT2W1]
      store.me.permsOnPages = store.me.permsOnPages.concat(action.myNewPermissions);

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
          page.pageDeletedAtMs = 1; // for now
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
      // Could clean up: Currently using action.* fields — should instead use newMeta.*,
      // those fields are directly from the server. [7RGEF24]
      const newData: EditPageResponse = action;
      const newMeta: PageMeta = newData.newPageMeta;
      if (action.htmlTagCssClasses) {
        $h.removeClasses(htmlElem, currentPage.pageHtmlTagCssClasses);
        $h.addClasses(htmlElem, action.htmlTagCssClasses);
        currentPage.pageHtmlTagCssClasses = action.htmlTagCssClasses;
      }
      currentPage.pageHtmlHeadTitle = firstDefinedOf(action.htmlHeadTitle, currentPage.pageHtmlHeadTitle);
      currentPage.pageHtmlHeadDescription =
        firstDefinedOf(action.htmlHeadDescription, currentPage.pageHtmlHeadDescription);
      currentPage.ancestorsRootFirst = action.newAncestorsRootFirst;
      const parent: Ancestor = <Ancestor> _.last(action.newAncestorsRootFirst);
      currentPage.categoryId = parent ? parent.categoryId : null;
      const was2dTree = currentPage.horizontalLayout;
      currentPage.pageRole = newMeta.pageType;
      currentPage.doingStatus = newMeta.doingStatus;
      currentPage.pagePlannedAtMs = newMeta.plannedAt;
      currentPage.pageStartedAtMs = newMeta.startedAt;
      currentPage.pageDoneAtMs = newMeta.doneAt;
      currentPage.pageClosedAtMs = newMeta.closedAt;
      currentPage.horizontalLayout = action.newPageRole === PageRole.MindMap || currentPage.is2dTreeDefault;
      const is2dTree = currentPage.horizontalLayout;
      updatePost(action.newTitlePost, currentPage.pageId);
      if (was2dTree !== is2dTree) {
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
      }
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
      unsquashTrees(action.postId);
      break;

    case ReactActions.actionTypes.CollapseTree:
      collapseTree(action.post);
      break;

    case ReactActions.actionTypes.UncollapsePost:
      uncollapsePostAndChildren(action.post);
      break;

    case ReactActions.actionTypes.ShowPost:
      showPostNr(action.postNr, action.showChildrenToo);
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
      const messageId = action.message ? action.message.id : action.messageId;
      const version = action.message ? action.message.version : 1;
      store.me.closedHelpMessages[messageId] = version;
      putInLocalStorage('closedHelpMessages', store.me.closedHelpMessages);
      break;

    case ReactActions.actionTypes.ShowHelpAgain:
      if (action.messageId) {
        // Could mark as visible in local storage? Or not (simpler) — the user has
        // soon read it anyway.
        delete store.me.closedHelpMessages[action.messageId];
      }
      else {
        putInLocalStorage('closedHelpMessages', {});
        store.me.closedHelpMessages = {};
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
      break;

    case ReactActions.actionTypes.ShowNewPage:
      showNewPage(action.newPage, action.newPublicCategories, action.newUsers, action.me, action.history);
    break;

    case ReactActions.actionTypes.UpdateUserPresence:
      if (action.presence === Presence.Active) {
        theStore_addOnlineUser(action.user);
      }
      else {
        theStore_removeOnlineUser(action.user);
      }
      break;

    case ReactActions.actionTypes.UpdateOnlineUsersLists:
      theStore_setOnlineUsers(action.numOnlineStrangers, action.onlineUsers);
      break;

    default:
      console.warn('Unknown action: ' + JSON.stringify(action));
      return true;
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

  store.quickUpdate = false;
  store.postsToUpdate = {};

  // Tell the dispatcher that there were no errors:
  return true;
});


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

  store.currentCategories = _.clone(store.publicCategories);
};


let volatileDataActivated = false;

ReactStore.activateVolatileData = function() {
  dieIf(volatileDataActivated, 'EsE4PFY03');
  volatileDataActivated = true;
  const data: VolatileDataFromServer = eds.volatileDataFromServer;
  theStore_setOnlineUsers(data.numStrangersOnline, data.usersOnline);
  ReactStore.activateMyself(data.me);
  store.quickUpdate = false;
  this.emitChange();
};


ReactStore.activateMyself = function(anyNewMe: Myself) {
  // [redux] Modifying state in-place, shouldn't do? But works fine.

  store.userSpecificDataAdded = true;

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

  if (!anyNewMe) {
    // For now only. Later on, this data should be kept server side instead?
    addLocalStorageDataTo(store.me);
    debiki2.pubsub.subscribeToServerEvents(store.me);
    this.emitChange();
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

  // Add Everyone's permissions to newMe's permissions (Everyone's permissions aren't included
  // in the per-user data). [8JUYW4B]
  // COULD sort perms somehow, how? [4JKT2W1]
  const oldMe: Myself = store.me;
  const everyonesPerms =
      _.filter(oldMe.permsOnPages, (p: PermsOnPage) => p.forPeopleId === Groups.EveryoneId);
  newMe.permsOnPages = everyonesPerms.concat(newMe.permsOnPages);

  store.user = newMe; // try to remove the .user field, use .me instead
  store.me = newMe;
  addLocalStorageDataTo(store.me);
  theStore_addOnlineUser(me_toBriefUser(newMe));

  watchbar_markAsRead(store.me.watchbar, store.currentPageId);

  // Show the user's own unapproved posts, or all, for admins.
  _.each(myPageData.unapprovedPosts, (post: Post) => {
    updatePost(post, store.currentPageId);
    // COULD_FREE_MEM
  });

  _.each(myPageData.unapprovedPostAuthors, (author: BriefUser) => {
    store.usersByIdBrief[author.id] = author;
  });

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
    _.each(store.me.restrictedTopicsUsers, (user: BriefUser) => {
      store.usersByIdBrief[user.id] = user;
    });
  }

  // Absent on about-user pages. CLEAN_UP no it's always present? Need not test for that.
  if (store.currentCategories) {
    addRestrictedCategories(store.me.restrictedCategories, store.currentCategories);
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


function addRestrictedCategories(restrictedCategories: Category[], categories: Category[]) {
  _.each(restrictedCategories, (category:Category) => {
    // Avoid adding cats twice. Currently, me.restrictedCategories might incl publ cats. [4KQSEF08]
    const index = _.findIndex(categories, { id: category.id });
    if (index >= 0) {
      categories.splice(index, 1, category);
    }
    else {
      categories.push(category);
    }
  });
  categories.sort((c:Category, c2:Category) => c.position - c2.position);
}


ReactStore.allData = function() {
  return store;
};


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
  // In case any user has e.g. changed his/her name or avatar, use the newer version:
  store.usersByIdBrief[user.id] = user;
}


function theStore_removeOnlineUser(user: BriefUser) {
  // Updating state in-place, oh well.
  if (store.userIdsOnline) {
    delete store.userIdsOnline[user.id];
  }
  // In case any user has e.g. changed his/her name or avatar, use the newer version:
  store.usersByIdBrief[user.id] = user;
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


ReactStore.getCategoryId = function(): number {
  return store.currentPage.categoryId;
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
  componentWillMount: function() {
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
  else if (!oldVersion) {
    // Hmm, subtract instead, if oldVersion and isDeleted(post). Fix later...
    page.numPosts += 1;
    if (post.nr !== TitleNr) {
      page.numPostsExclTitle += 1;
    }
    if (post.postType === PostType.Flat) {
      page.numPostsChatSection += 1;
    }
    else if (post.nr !== TitleNr && post.nr !== BodyNr) {
      page.numPostsRepliesSection += 1;
    }
  }

  // Add or update the post itself.
  page.postsByNr[post.nr] = post;

  // In case this is a new post, update its parent's child id list.
  const parentPost = page.postsByNr[post.parentNr];
  if (parentPost) {
    const alreadyAChild = _.find(parentPost.childNrsSorted, nr => nr === post.nr);
    if (!alreadyAChild) {
      parentPost.childNrsSorted.unshift(post.nr);
      sortPostNrsInPlaceBestFirst(parentPost.childNrsSorted, page.postsByNr);
    }
  }

  // Insert into progress reply list, if needed.
  if (post.postType === PostType.BottomComment) {
    const alreadyIncl = _.find(page.progressPostNrsSorted, nr => nr === post.nr);
    if (!alreadyIncl) {
      page.progressPostNrsSorted.push(post.nr);
      sortPostNrsInPlaceBestFirst(page.progressPostNrsSorted, page.postsByNr);
    }
  }

  // Update list of top level comments, for embedded comment pages, and custom form pages.
  // (Top level embedded comments have no parent post — there's no Original Post.)
  if (!post.parentNr && post.nr != BodyNr && post.nr !== TitleNr) {
    page.parentlessReplyNrsSorted = findParentlessReplyIds(page.postsByNr);
    sortPostNrsInPlaceBestFirst(page. parentlessReplyNrsSorted, page.postsByNr);
  }

  rememberPostsToQuickUpdate(post.nr);
  stopGifsPlayOnClick();
  setTimeout(() => {
    debiki2.page.Hacks.processPosts();
    if (!oldVersion && post.authorId === store.me.id) {
      // Show the user his/her new post.   — Hmm, this just scrolls to it? it's loaded already, always?
      ReactActions.loadAndShowPost(post.nr);
    }
  }, 1);
}


function voteOnPost(action) {
  const post: Post = action.post;

  const me: Myself = store.me;
  const myPageData: MyPageData = me.myCurrentPageData;
  let votes = myPageData.votes[post.nr];
  if (!votes) {
    votes = [];
    myPageData.votes[post.nr] = votes;
  }

  if (action.doWhat === 'CreateVote') {
    votes.push(action.voteType);
  }
  else {
    _.remove(votes, (voteType) => voteType === action.voteType);
  }

  updatePost(post, store.currentPageId);
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
  const parent = page.postsByNr[post.parentNr];
  let numLeftToUnsquash = -1;
  for (let i = 0; i < parent.childNrsSorted.length; ++i) {
    const childNr = parent.childNrsSorted[i];
    const child: Post = page.postsByNr[childNr];
    if (!child)
      continue; // deleted
    if (child.nr == postNr) {
      numLeftToUnsquash = 5;
    }
    if (numLeftToUnsquash !== -1) {
      // Updating in-place, should perhaps not. But works right now anyway
      child.squash = false;
      numLeftToUnsquash -= 1;
    }
    if (numLeftToUnsquash === 0)
      break;
  }
  setTimeout(debiki2.page.Hacks.processPosts);
}


function collapseTree(post: Post) {
  post = clonePost(post.nr);
  post.isTreeCollapsed = 'Truncated';
  post.summarize = true;
  post.summary = makeSummaryFor(post, 70);
  updatePost(post, store.currentPageId, true);
}


function showPostNr(postNr: PostNr, showChildrenToo?: boolean) {
  const page: Page = store.currentPage;
  let post: Post = page.postsByNr[postNr];
  if (showChildrenToo) {
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
    uncollapseOne(post);
    post = page.postsByNr[post.parentNr];
  }
  setTimeout(() => {
    debiki.internal.showAndHighlightPost($byId('post-' + postNr));
    debiki2.page.Hacks.processPosts();
  }, 1);
}


function uncollapsePostAndChildren(post: Post) {
  const page: Page = store.currentPage;
  uncollapseOne(post);
  // Also uncollapse children and grandchildren so one won't have to Click-to-show... all the time.
  for (var i = 0; i < Math.min(post.childNrsSorted.length, 5); ++i) {
    var childNr = post.childNrsSorted[i];
    var child = page.postsByNr[childNr];
    if (!child)
      continue;
    uncollapseOne(child);
    for (var i2 = 0; i2 < Math.min(child.childNrsSorted.length, 3); ++i2) {
      var grandchildNr = child.childNrsSorted[i2];
      var grandchild = page.postsByNr[grandchildNr];
      if (!grandchild)
        continue;
      uncollapseOne(grandchild);
    }
  }
  setTimeout(debiki2.page.Hacks.processPosts);
}


function uncollapseOne(post: Post) {
  if (!post.isTreeCollapsed && !post.isPostCollapsed && !post.summarize && !post.squash)
    return;
  var p2 = clonePost(post.nr);
  p2.isTreeCollapsed = false;
  p2.isPostCollapsed = false;
  p2.summarize = false;
  p2.squash = false;
  updatePost(p2, store.currentPageId, true);
}


function findParentlessReplyIds(postsByNr): number[] {
  var ids: number[] = [];
  _.each(postsByNr, (post: Post) => {
    if (!post.parentNr && post.nr !== BodyNr && post.nr !== TitleNr) {
      ids.push(post.nr);
    }
  });
  return ids;
}


/**
 * NOTE: Keep in sync with sortPostsFn() in
 *   modules/debiki-core/src/main/scala/com/debiki/core/Post.scala
 */
function sortPostNrsInPlaceBestFirst(postNrs: PostNr[], postsByNr: { [nr: number]: Post }) {
  postNrs.sort((nrA: number, nrB: number) => {
    var postA: Post = postsByNr[nrA];
    var postB: Post = postsByNr[nrB];

    // Wip: Place previews first.


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

    // Place append-at-the-bottom posts at the bottom, sorted by time.
    const aLast = postA.postType === PostType.BottomComment || postA.postType === PostType.MetaMessage;
    const bLast = postB.postType === PostType.BottomComment || postB.postType === PostType.MetaMessage;
    if (!aLast && bLast)
      return -1;
    if (aLast && !bLast)
      return +1;
    if (aLast && bLast)
      return postApprovedOrCreatedBefore(postA, postB)

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
    var unwantedA = postA.numUnwantedVotes > 0;
    var unwantedB = postB.numUnwantedVotes > 0;
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
    var buryA = postA.numBuryVotes > 0 && !postA.numLikeVotes;
    var buryB = postB.numBuryVotes > 0 && !postB.numLikeVotes;
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
    return postApprovedOrCreatedBefore(postA, postB);
  });
}


function postApprovedOrCreatedBefore(postA: Post, postB: Post): number {
  // Sync w Scala [5BKZQF02]
  const postAApprAt = postA.approvedAtMs || Infinity;
  const postBApprAt = postB.approvedAtMs || Infinity;
  if (postAApprAt < postBApprAt) return -1;
  if (postAApprAt > postBApprAt) return +1;
  return postA.nr < postB.nr ? -1 : +1;
}


function handleNotifications(newNotfs: Notification[]) {
  var oldNotfs = store.me.notifications;
  for (var i = 0; i < newNotfs.length; ++i) {
    var newNotf = newNotfs[i];

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
  var notfs: Notification[] = store.me.notifications;
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
  var delta = add ? +1 : -1;
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


function patchTheStore(storePatch: StorePatch) {
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

  if (storePatch.me) {
    // [redux] modifying the store in place, again.
    store.me = <Myself> _.assign(store.me || {}, storePatch.me);
  }

  if (storePatch.updateEditPreview) {
    const replyPreviews = store.replyPreviewsByPostId ?? {};
    const p = storePatch.updateEditPreview;
    replyPreviews[p.postId] = p;
    // [redux] modifying the store in place, again.
    store.replyPreviewsByPostId = replyPreviews;

    // Quick-update this — otherwise, the UI might always freeze, if typing
    // fast on a low-end mobile?
    // Maybe cannot quick-update though, if there're more things in the patch.
    // @ifdef DEBUG
    dieIf(_.size(storePatch) > 1, 'TyED205MWUG6');
    // @endif
    store.quickUpdate = true;
    store.postsToUpdate[p.postId] = true;
  }

  if (storePatch.publicCategories) {
    dieIf(!storePatch.restrictedCategories, 'TyEK2WP49');
    // [redux] modifying the store in place, again.
    // Hmm what if the patch contains fever categories? Currently (2016-12), won't happen, though.
    store.publicCategories = storePatch.publicCategories;
    store.me.restrictedCategories = storePatch.restrictedCategories;
    store.currentCategories = _.clone(store.publicCategories);
    addRestrictedCategories(store.me.restrictedCategories, store.currentCategories);
  }

  if (storePatch.tagsStuff) {
    // [redux] modifying the store in place, again.
    store.tagsStuff = _.assign(store.tagsStuff || {}, storePatch.tagsStuff);
  }

  _.each(storePatch.usersBrief || [], (user: BriefUser) => {
    store.usersByIdBrief[user.id] = user;
  });

  _.each(storePatch.pageMetasBrief || [], (pageMeta: PageMetaBrief) => {
    store.pageMetaBriefById[pageMeta.pageId] = pageMeta;
  });

  const currentPage: Page = store.currentPage;

  // If we just posted the very first reply on an embedded discussion, a page for the discussion
  // will have been created now, lazily. Then need to update the store page id.
  if (storePatch.newlyCreatedPageId && currentPage) {
    dieIf(_.size(currentPage.postsByNr) > NumEmptyPageDummyPosts, 'EdE2PB604');
    dieIf(store.currentPageId !== EmptyPageId, 'EdEZ4BSSJ2');
    dieIf(store.currentPageId !== currentPage.pageId, 'EdE7GBW2');
    currentPage.pageId = storePatch.newlyCreatedPageId;
    store.currentPageId  = storePatch.newlyCreatedPageId;
    // Later: Add this new page to the watchbar? Currently not needed, because pages created
    // lazily only for embedded comments, and then there's no watchbar.
  }

  // New or moved posts?
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
          if (oldPost.uniqueId === patchedPost.uniqueId) {
            var movedToNewPage = oldPage.pageId !== patchedPageId;
            var movedOnThisPage = !movedToNewPage && oldPost.parentNr !== patchedPost.parentNr;
            if (movedToNewPage || movedOnThisPage) {
              var oldParent = oldPage.postsByNr[oldPost.parentNr];
              if (oldParent && oldParent.childNrsSorted) {
                var index = oldParent.childNrsSorted.indexOf(oldPost.nr);
                if (index !== -1) {
                  oldParent.childNrsSorted.splice(index, 1);
                }
              }
            }
          }
        });
      });
    });
  });

  // Update the current page.
  if (!storePatch.pageVersionsByPageId) {
    // No page. Currently storePatch.usersBrief is for the current page (but there is none)
    // so ignore it too.
    return;
  }

  _.each(store.pagesById, patchPage);

  function patchPage(page: Page) {
    const storePatchPageVersion = storePatch.pageVersionsByPageId[page.pageId];
    if (!storePatchPageVersion || storePatchPageVersion < page.pageVersion) {
      // These changes are old, might be out-of-date, ignore.
      // COULD rename .usersBrief to .authorsBrief so it's apparent that they're related
      // to the posts, and that it's ok to ignore them if the posts are too old.
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


function showNewPage(newPage: Page, newPublicCategories: Category[], newUsers: BriefUser[],
        newMe: Myself | null, history) {

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

  // Update categories — maybe this page is in a different sub community with different categories.
  store.publicCategories = newPublicCategories;  // hmm could rename to currentPublicCategories
  store.currentCategories = _.clone(newPublicCategories);

  // Forget any topics from the original page load. Maybe we're now in a different sub community,
  // or some new topics have been created. Better reload.
  store.topics = null;

  let myData: MyPageData;
  if (newMe) {
    store.me.watchbar = newMe.watchbar;
    myData = newMe.myDataByPageId[newPage.pageId];
    if (myData) {
      store.me.myDataByPageId[newPage.pageId] = myData;
    }
    addRestrictedCategories(newMe.restrictedCategories, store.currentCategories);
  }
  store.me.myCurrentPageData = myData || makeNoPageData();

  // Update <title> tag. Also done from the title editor [30MRVH2].
  const titlePost = newPage.postsByNr[TitleNr];
  if (titlePost && titlePost.unsafeSource) {
    // This gets interpreted as text, so ok to use the unsanitized source.
    // (Don't use the sanitized html — that'd result in e.g. '&amp;' instead of '&'.)
    document.title = titlePost.unsafeSource;
  }

  // Add users on the new page, to the global users-by-id map.
  _.each(newUsers, (user: BriefUser) => {
    store.usersByIdBrief[user.id] = user;
  });

  // Update <html> elem classes list, so pages with custom classes & CSS render properly.
  const oldClassesStr = (oldPage.pageHtmlTagCssClasses || '') + magicClassFor(oldPage);
  const newClassesStr = (newPage.pageHtmlTagCssClasses || '') + magicClassFor(newPage);
  function magicClassFor(page: Page): string {
    // Sync with Scala [4JXW5I2].
    let clazz = '';
    if (page_isChatChannel(page.pageRole)) clazz = ' dw-vt es-chat';
    if (page.pageRole === PageRole.Forum) clazz = ' es-forum';
    if (page.pageRole === PageRole.MindMap) clazz = ' dw-hz';
    if (page.pageRole) clazz = ' dw-vt';
    clazz += (!page.pageRole ? '' : ' s_PT-' + page.pageRole);     // [5J7KTW2]
    clazz += (!page.pageLayout ? '' : ' s_PL-' + page.pageLayout);
    return clazz;
  }
  if (oldClassesStr || newClassesStr) {
    const regex = /[ ,]/;
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
      history.replace(correctedUrl);  // [4DKWWY0]
    }
  }

  if (me_isStranger(store.me)) {
    addPageToStrangersWatchbar(store.currentPage, store.me.watchbar);
  }

  // Make Back button work properly.
  debiki2.rememberBackUrl(correctedUrl);

  // Restart the reading progress tracker, now when on a new page.
  page.PostsReadTracker.reset();

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
  var alreadyThere = false;
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
  if (notf.type === NotificationType.DirectReply || notf.type === NotificationType.Mention) {
    // Fix later. Like so?
    // If topic not in watchbar, add it to the appropriate section (chat, messages, or recent).
    // Then bump the notfsToMe or notfsToMany count, for the WatchbarTopic,
    // and mark it as unread.
    // Or do this elsewhere? [4YK2E5] Probably better to do here? because here we'll get notfs
    // also about pages not currently listed in the watchbar.
  }
  if (notf.type === NotificationType.PostTagged) {
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
  var parent: any = postsByNr[post.parentNr] || {};
  for (var i = 0; i < (parent.childNrsSorted || []).length; ++i) {
    var siblingNr = parent.childNrsSorted[i];
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
