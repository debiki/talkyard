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
/// <reference path="ReactActions.ts" />
/// <reference path="oop-methods.ts" />
/// <reference path="prelude.ts" />
/// <reference path="utils/utils.ts" />
/// <reference path="../typedefs/lodash/lodash.d.ts" />
/// <reference path="../typedefs/eventemitter2/eventemitter2.d.ts" />


/* This Flux store is perhaps a bit weird, not sure. I'll switch to Redux or
 * Flummox or Fluxxor or whatever later, and rewrite everything in a better way?
 * Also perhaps there should be more than one store, so events won't be broadcasted
 * to everyone all the time.
 */

//------------------------------------------------------------------------------
   namespace debiki2 {
//------------------------------------------------------------------------------

// DefinitelyTyped has defined EventEmitter2 in the wrong module? Unusable when
// not using AMD/CommonJS, see https://github.com/borisyankov/DefinitelyTyped/issues/3075.

var ChangeEvent = 'ChangeEvent';
var $html = $('html');

export var ReactStore: any = new EventEmitter2();

// Avoid a harmless "possible EventEmitter memory leak detected" warning.
ReactStore.setMaxListeners(20);


// First, initialize the store with page specific data only, nothing user specific,
// because the server serves cached HTML with no user specific data. Later on,
// we'll insert user specific data into the store, and re-render. See
// ReactStore.activateMyself().
var store: Store = debiki.pageDataFromServer;
window['theStore'] = store; // simplifies inspection in Dev Tools

store.postsToUpdate = {};

if (store.user && !store.me) store.me = store.user; // try to remove
if (!store.me) {
  store.me = makeStranger();
}
store.user = store.me; // try to remove


ReactDispatcher.register(function(payload) {
  var action = payload.action;
  switch (action.actionType) {

    case ReactActions.actionTypes.NewMyself:
      ReactStore.activateMyself(action.user);
      store.numOnlineStrangers = Math.max(0, store.numOnlineStrangers - 1);
      theStore_addOnlineUser(me_toBriefUser(action.user));
      break;

    case ReactActions.actionTypes.Logout:
      if (store.userMustBeAuthenticated !== false || store.userMustBeApproved !== false)
        location.reload();

      // SECURITY SHOULD go to / if in staff-only category, too.
      if (store.pageRole === PageRole.FormalMessage) {
        // We may not see it any longer.
        location.assign('/');
      }

      $html.removeClass('dw-is-admin, dw-is-staff, dw-is-authenticated');

      if (store.userIdsOnline) delete store.userIdsOnline[store.me.id];
      store.numOnlineStrangers += 1;
      store.me = makeStranger();
      store.user = store.me; // try to remove
      debiki2.pubsub.subscribeToServerEvents();
      break;

    case ReactActions.actionTypes.NewUserAccountCreated:
      store.newUserAccountCreated = true;
      break;

    case ReactActions.actionTypes.CreateEditForumCategory:
      store.categories = action.allCategories;
      // (If editing, only the slug might have been changed, not the id.)
      store.newCategoryId = action.newCategoryId;
      store.newCategorySlug = action.newCategorySlug;
      break;

    case ReactActions.actionTypes.SetCategories:
      store.categories = action.categories;
      break;

    case ReactActions.actionTypes.PinPage:
      store.pinOrder = action.pinOrder;
      store.pinWhere = action.pinWhere;
      break;

    case ReactActions.actionTypes.UnpinPage:
      store.pinOrder = undefined;
      store.pinWhere = undefined;
      break;

    case ReactActions.actionTypes.SetPageNotfLevel:
      store.me.rolePageSettings.notfLevel = action.newLevel;
      break;

    case ReactActions.actionTypes.AcceptAnswer:
      store.pageAnsweredAtMs = action.answeredAtMs;
      store.pageAnswerPostUniqueId = action.answerPostUniqueId;
      findAnyAcceptedAnswerPostNr();
      break;

    case ReactActions.actionTypes.UnacceptAnswer:
      store.pageAnsweredAtMs = null;
      store.pageAnswerPostUniqueId = null;
      store.pageAnswerPostNr = null;
      store.pageClosedAtMs = null;
      break;

    case ReactActions.actionTypes.CyclePageDone:
      store.pagePlannedAtMs = action.plannedAtMs;
      store.pageDoneAtMs = action.doneAtMs;
      store.pageClosedAtMs = action.closedAtMs;
      break;

    case ReactActions.actionTypes.TogglePageClosed:
      store.pageClosedAtMs = action.closedAtMs;
      break;

    case ReactActions.actionTypes.DeletePages:
      if (_.includes(action.pageIds, store.pageId)) {
        store.pageDeletedAtMs = 1; // for now
      }
      break;

    case ReactActions.actionTypes.UndeletePages:
      if (_.includes(action.pageIds, store.pageId)) {
        store.pageDeletedAtMs = undefined;
      }
      break;

    case ReactActions.actionTypes.EditTitleAndSettings:
      if (action.htmlTagCssClasses) {
        $html.removeClass(store.pageHtmlTagCssClasses);
        $html.addClass(action.htmlTagCssClasses);
        store.pageHtmlTagCssClasses = action.htmlTagCssClasses;
      }
      store.pageHtmlHeadTitle = firstDefinedOf(action.htmlHeadTitle, store.pageHtmlHeadTitle);
      store.pageHtmlHeadDescription =
        firstDefinedOf(action.htmlHeadDescription, store.pageHtmlHeadDescription);
      store.ancestorsRootFirst = action.newAncestorsRootFirst;
      var parent: Ancestor = <Ancestor> _.last(action.newAncestorsRootFirst);
      store.categoryId = parent ? parent.categoryId : null;
      var was2dTree = store.horizontalLayout;
      store.pageRole = action.newPageRole || store.pageRole;
      store.horizontalLayout = action.newPageRole === PageRole.MindMap || store.is2dTreeDefault;
      var is2dTree = store.horizontalLayout;
      updatePost(action.newTitlePost);
      if (was2dTree !== is2dTree) {
        // Rerender the page with the new layout.
        store.quickUpdate = false;
        if (is2dTree) {
          $html.removeClass('dw-vt').addClass('dw-hz');
          debiki.internal.layoutThreads();
          debiki2.utils.onMouseDetected(debiki.internal.initUtterscrollAndTips);
        }
        else {
          $html.removeClass('dw-hz').addClass('dw-vt');
          $('.dw-t.dw-depth-1').css('width', 'auto'); // 2d columns had a certain width
        }
        debiki2.removeSidebar();
        setTimeout(debiki2.createSidebar, 1);
      }
      break;

    case ReactActions.actionTypes.ShowForumIntro:
      store.hideForumIntro = !action.visible;
      putInLocalStorage('hideForumIntro', action.visible ? 'false' : 'true');
      if (store.hideForumIntro) $html.addClass('dw-hide-forum-intro');
      else $html.removeClass('dw-hide-forum-intro');
      break;

    case ReactActions.actionTypes.UpdatePost:
      updatePost(action.post);
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
      store.horizontalLayout = action.enabled;
      // Now all gifs will be recreated since the page is rerendered.
      stopGifsPlayOnClick();
      break;

    case ReactActions.actionTypes.HideHelpMessage:
      dieIf(!store.me, 'EsE8UGM5');
      var messageId = action.message ? action.message.id : action.messageId;
      var version = action.message ? action.message.version : 1;
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
      userIdList_add(store.pageMemberIds, store.me.id);
      break;

    case ReactActions.actionTypes.RemoveMeAsPageMember:
      userIdList_remove(store.pageMemberIds, store.me.id);
      break;

    case ReactActions.actionTypes.PatchTheStore:
      patchTheStore(action.storePatch);
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

  ReactStore.emitChange();
  store.quickUpdate = false;
  store.postsToUpdate = {};

  // Tell the dispatcher that there were no errors:
  return true;
});


ReactStore.initialize = function() {
  findAnyAcceptedAnswerPostNr();
  store.usersByIdBrief = store.usersByIdBrief || {};
  let impCookie = $['cookie'](ImpersonationCookieName);
  if (impCookie) {
    // This 'VAO' string constant, server side: [8AXFC0J2]
    store.isViewingAs = impCookie.indexOf('.VAO.') >= 0;
    store.isImpersonating = true;
  }

  // Init page overlay, shown if sidebars open.
  debiki.v0.util.addZoomOrResizeListener(updateShallSidebarsOverlayPage);
  $('#theSidebarPageOverlay').click(function() {
    setWatchbarOpen(false);
    setContextbarOpen(false);
    ReactStore.emitChange();
  });
};


function findAnyAcceptedAnswerPostNr() {
  if (!store.pageAnswerPostUniqueId)
    return;

  _.each(store.postsByNr, (post: Post) => {
    if (post.uniqueId === store.pageAnswerPostUniqueId) {
      store.pageAnswerPostNr = post.nr;
    }
  });
}


var volatileDataActivated = false;

ReactStore.activateVolatileData = function() {
  dieIf(volatileDataActivated, 'EsE4PFY03');
  volatileDataActivated = true;
  var data: VolatileDataFromServer = debiki.volatileDataFromServer;
  theStore_setOnlineUsers(data.numStrangersOnline, data.usersOnline);
  ReactStore.activateMyself(data.me);
  store.quickUpdate = false;
  this.emitChange();
};


ReactStore.activateMyself = function(anyNewMe: Myself) {
  store.userSpecificDataAdded = true;
  store.now = new Date().getTime();

  setTimeout(function() {
    $html.addClass('e2eMyDataAdded');
  }, 1);

  var newMe = anyNewMe;
  if (!newMe) {
    // For now only. Later on, this data should be kept server side instead?
    addLocalStorageDataTo(store.me);
    debiki2.pubsub.subscribeToServerEvents();
    this.emitChange();
    return;
  }

  if (newMe.isAdmin) {
    $html.addClass('dw-is-admin, dw-is-staff');
  }
  if (newMe.isModerator) {
    $html.addClass('dw-is-staff');
  }
  if (newMe.isAuthenticated) {
    $html.addClass('dw-is-authenticated');
  }

  store.user = newMe; // try to remove
  store.me = newMe;
  addLocalStorageDataTo(store.me);
  theStore_addOnlineUser(me_toBriefUser(newMe));

  watchbar_markAsRead(store.me.watchbar, store.pageId);

  // Show the user's own unapproved posts, or all, for admins.
  _.each(store.me.unapprovedPosts, (post: Post) => {
    updatePost(post);
  });

  _.each(store.me.unapprovedPostAuthors, (author: BriefUser) => {
    store.usersByIdBrief[author.id] = author;
  });

  if (_.isArray(store.topics)) {
    _.each(store.me.restrictedTopics, (topic: Topic) => {
      store.topics.push(topic);
    });
    store.topics.sort((t: Topic, t2: Topic) =>
      topic_sortByLatestActivity(t, t2, store.categoryId));
    // later: COULD try to avoid gaps, e.g. don't load restricted topics back to year 2000
    // but public topics back to 2010 only.
    // BUG we always sort by time, but in some rare cases, we want to sort by most-popular-first,
    // *and* at the same time call activateMyself() — then here we'll sort by the wrong thing.
  }

  // Absent on about-user pages.
  if (store.categories) {
    _.each(store.me.restrictedCategories, (category:Category) => {
      store.categories.push(category);
    });
    store.categories.sort((c:Category, c2:Category) => c.position - c2.position);
  }

  debiki2.pubsub.subscribeToServerEvents();
  store.quickUpdate = false;
};


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


ReactStore.isGuestLoginAllowed = function() {
  return store.settings.allowGuestLogin || false; // breaks in /-/login, need not fix now [5KUP02]
};

ReactStore.getPageId = function() {
  return store.pageId;
};


ReactStore.getPageRole = function(): PageRole {
  return store.pageRole;
};


ReactStore.getPageTitle = function(): string { // dupl code [5GYK2]
  var titlePost = store.postsByNr[TitleNr];
  return titlePost ? titlePost.sanitizedHtml : "(no title)";
};


ReactStore.getMe = function(): Myself {
  return store.me;
};


ReactStore.getCategories = function() {
  return store.categories;
};


ReactStore.getCategoryId = function() {
  return store.categoryId;
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
    ReactStore.removeChangeListener(this.onChange);
  }
};


export function clonePost(postNr: number): Post {
  return _.cloneDeep(store.postsByNr[postNr]);
}


function updatePost(post: Post, isCollapsing?: boolean) {
  store.now = new Date().getTime();

  var oldVersion = store.postsByNr[post.nr];
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
    store.numPosts += 1;
    if (post.nr !== TitleNr) {
      store.numPostsExclTitle += 1;
    }
    if (post.postType === PostType.Flat) {
      store.numPostsChatSection += 1;
    }
    else if (post.nr !== TitleNr && post.nr !== BodyNr) {
      store.numPostsRepliesSection += 1;
    }
  }

  // Add or update the post itself.
  store.postsByNr[post.nr] = post;

  // In case this is a new post, update its parent's child id list.
  var parentPost = store.postsByNr[post.parentNr];
  if (parentPost) {
    var alreadyAChild =
        _.find(parentPost.childIdsSorted, childId => childId === post.nr);
    if (!alreadyAChild) {
      parentPost.childIdsSorted.unshift(post.nr);
      sortPostIdsInPlaceBestFirst(parentPost.childIdsSorted, store.postsByNr);
    }
  }

  // Update list of top level comments, for embedded comment pages, and custom form pages.
  if (!post.parentNr && post.nr != BodyNr && post.nr !== TitleNr) {
    store.topLevelCommentIdsSorted = findTopLevelCommentIds(store.postsByNr);
    sortPostIdsInPlaceBestFirst(store.topLevelCommentIdsSorted, store.postsByNr);
  }

  rememberPostsToQuickUpdate(post.nr);
  stopGifsPlayOnClick();
  setTimeout(() => {
    page.Hacks.processPosts();
    if (!oldVersion && post.authorId === store.me.id) {
      // Show the user his/her new post.
      ReactActions.loadAndShowPost(post.nr);
    }
  }, 1);
}


function voteOnPost(action) {
  var post: Post = action.post;

  var votes = store.me.votes[post.nr];
  if (!votes) {
    votes = [];
    store.me.votes[post.nr] = votes;
  }

  if (action.doWhat === 'CreateVote') {
    votes.push(action.voteType);
  }
  else {
    _.remove(votes, (voteType) => voteType === action.voteType);
  }

  updatePost(post);
}


function markPostAsRead(postId: number, manually: boolean) {
  var currentMark = store.me.marksByPostId[postId];
  if (currentMark) {
    // All marks already mean that the post has been read. Do nothing.
  }
  else if (manually) {
    store.me.marksByPostId[postId] = ManualReadMark;
  }
  else {
    store.me.postIdsAutoReadNow.push(postId);
  }
  rememberPostsToQuickUpdate(postId);
}


var lastPostIdMarkCycled = null;

function cycleToNextMark(postId: number) {
  var currentMark = store.me.marksByPostId[postId];
  var nextMark;
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
  store.me.marksByPostId[postId] = nextMark;

  rememberPostsToQuickUpdate(postId);
}


function summarizeReplies() {
  // For now, just collapse all threads with depth >= 2, if they're too long
  // i.e. they have successors, or consist of a long (high) comment.
  _.each(store.postsByNr, (post: Post) => {
    if (post.nr === BodyNr || post.nr === TitleNr || post.parentNr === BodyNr)
      return;

    var isTooHigh = () => $('#post-' + post.nr).height() > 150;
    if (post.childIdsSorted.length || isTooHigh()) {
      post.isTreeCollapsed = 'Truncated';
      post.summarize = true;
      post.summary = makeSummaryFor(post);
    }
  });
}


function makeSummaryFor(post: Post, maxLength?: number): string {
  var text = $(post.sanitizedHtml).text();
  var firstParagraph = text.split('\n');
  var summary = firstParagraph[0] || '';
  if (summary.length > maxLength || 200) {
    summary = summary.substr(0, maxLength || 140);
  }
  return summary;
}


function unsquashTrees(postNr: number) {
  // Mark postNr and its nearest subsequent siblings as not squashed.
  var post: Post = store.postsByNr[postNr];
  var parent = store.postsByNr[post.parentNr];
  var numLeftToUnsquash = -1;
  for (var i = 0; i < parent.childIdsSorted.length; ++i) {
    var childId = parent.childIdsSorted[i];
    var child: Post = store.postsByNr[childId];
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
  setTimeout(page.Hacks.processPosts);
}


function collapseTree(post: Post) {
  post = clonePost(post.nr);
  post.isTreeCollapsed = 'Truncated';
  post.summarize = true;
  post.summary = makeSummaryFor(post, 70);
  updatePost(post, true);
}


function showPostNr(postNr: PostNr, showChildrenToo?: boolean) {
  var post: Post = store.postsByNr[postNr];
  if (showChildrenToo) {
    uncollapsePostAndChildren(post);
  }
  // Uncollapse ancestors, to make postId visible.
  while (post) {
    uncollapseOne(post);
    post = store.postsByNr[post.parentNr];
  }
  setTimeout(() => {
    debiki.internal.showAndHighlightPost($('#post-' + postNr));
    page.Hacks.processPosts();
  }, 1);
}


function uncollapsePostAndChildren(post: Post) {
  uncollapseOne(post);
  // Also uncollapse children and grandchildren so one won't have to Click-to-show... all the time.
  for (var i = 0; i < Math.min(post.childIdsSorted.length, 5); ++i) {
    var childId = post.childIdsSorted[i];
    var child = store.postsByNr[childId];
    if (!child)
      continue;
    uncollapseOne(child);
    for (var i2 = 0; i2 < Math.min(child.childIdsSorted.length, 3); ++i2) {
      var grandchildId = child.childIdsSorted[i2];
      var grandchild = store.postsByNr[grandchildId];
      if (!grandchild)
        continue;
      uncollapseOne(grandchild);
    }
  }
  setTimeout(page.Hacks.processPosts);
}


function uncollapseOne(post: Post) {
  if (!post.isTreeCollapsed && !post.isPostCollapsed && !post.summarize && !post.squash)
    return;
  var p2 = clonePost(post.nr);
  p2.isTreeCollapsed = false;
  p2.isPostCollapsed = false;
  p2.summarize = false;
  p2.squash = false;
  updatePost(p2, true);
}


function findTopLevelCommentIds(postsByNr): number[] {
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
function sortPostIdsInPlaceBestFirst(postNrs: PostNr[], postsByNr: { [nr: number]: Post }) {
  postNrs.sort((nrA: number, nrB: number) => {
    var postA: Post = postsByNr[nrA];
    var postB: Post = postsByNr[nrB];

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

    // Newest posts first. No, last
    // In Scala, a certain sortWith function is used, but it wants a Bool from the comparison
    // function, not a +-1 or 0 number. True means "should be sorted before".
    // But return 0 instead here to indicate that sort order doesn't matter.
    if (postA.createdAtMs < postB.createdAtMs)
      return -1;
    else if (postA.createdAtMs > postB.createdAtMs)
      return +1;
    else
      return 0;
  });
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
    if (notf.pageId === store.pageId && notf.postNr === postNr) {
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

  if (storePatch.categories) {
    // [redux] modifying the store in place, again.
    // Hmm what if the patch contains fever categories? Currently (2016-12), won't happen, though.
    store.categories = storePatch.categories;
  }

  if (storePatch.tagsStuff) {
    // [redux] modifying the store in place, again.
    store.tagsStuff = _.assign(store.tagsStuff || {}, storePatch.tagsStuff);
  }

  _.each(storePatch.usersBrief || [], (user: BriefUser) => {
    store.usersByIdBrief[user.id] = user;
  });

  // Highligt pages with new posts, in the watchbar.
  // And find out if some post was moved to elsewhere.
  _.each(storePatch.postsByPageId, (posts: Post[], pageId: PageId) => {
    if (pageId !== store.pageId) {
      // Could look at the new posts to find out if there are any direct replies to the current
      // user, or @mentions, and update the watchbar accordingly. But probably
      // better to do this elsewhere, namely when handling notifications [4YK2E5]?
      watchbar_markAsUnread(store.me.watchbar, pageId);
    }

    // Remove the post from its former parent, if we're moving it to elsewhere on this page,
    // or to another page.
    _.each(posts, (patchedPost: Post) => {
      _.each(store.postsByNr, (oldPost: Post) => {
        if (oldPost.uniqueId === patchedPost.uniqueId) {
          var movedToNewPage = store.pageId !== pageId;
          var movedOnThisPage = !movedToNewPage && oldPost.parentNr !== patchedPost.parentNr;
          if (movedToNewPage || movedOnThisPage) {
            var oldParent = store.postsByNr[oldPost.parentNr];
            if (oldParent && oldParent.childIdsSorted) {
              var index = oldParent.childIdsSorted.indexOf(oldPost.nr);
              if (index !== -1) {
                oldParent.childIdsSorted.splice(index, 1);
              }
            }
          }
        }
      });
    });
  });

  // Update the current page.
  if (!storePatch.pageVersionsByPageId) {
    // No page. Currently storePatch.usersBrief is for the current page (but there is none)
    // so ignore it too.
    return;
  }

  var storePatchPageVersion = storePatch.pageVersionsByPageId[store.pageId];
  if (!storePatchPageVersion || storePatchPageVersion < store.pageVersion) {
    // These changes are old, might be out-of-date, ignore.
    // COULD rename .usersBrief to .authorsBrief so it's apparent that they're related
    // to the posts, and that it's ok to ignore them if the posts are too old.
    return;
  }
  else if (storePatchPageVersion === store.pageVersion) {
    // We might be loading the text of a hidden/unapproved comment, in order to show it.
    // So although store & patch page versions are the same, proceed with updating
    // any posts below.
  }
  else {
    store.pageVersion = storePatchPageVersion;
  }

  var posts = storePatch.postsByPageId[store.pageId];
  _.each(posts || [], (post: Post) => {
    updatePost(post);
  });

  // The server should have marked this page as unread because of these new events.
  // But we're looking at the page right now — so tell the server that the user has seen it.
  // (The server doesn't know exactly which page we're looking at — perhaps we have many
  // browser tabs open, for example.)
  // COULD wait with marking it as seen until the user shows s/he is still here.
  if (store.me.isAuthenticated) {
    Server.markCurrentPageAsSeen();
  }
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
    // url?: string;
    unread: true,
    // We don't know about these two, info currently not included in the json: [4Y2KF8S]
    notfsToMe: 1,
    // notfsToMany: number;
  };
}


function watchbar_foreachTopic(watchbar: Watchbar, fn: (topic: WatchbarTopic) => void) {
  _.each(watchbar[WatchbarSection.RecentTopics], fn);
  _.each(watchbar[WatchbarSection.Notifications], fn);
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


function makeStranger(): Myself {
  return {
    rolePageSettings: {},

    trustLevel: TrustLevel.New,
    threatLevel: ThreatLevel.HopefullySafe,

    numUrgentReviewTasks: 0,
    numOtherReviewTasks: 0,

    numTalkToMeNotfs: 0,
    numTalkToOthersNotfs: 0,
    numOtherNotfs: 0,
    thereAreMoreUnseenNotfs: false,
    notifications: [],

    watchbar: loadWatchbarFromSessionStorage(),

    restrictedTopics: [],
    restrictedCategories: [],

    votes: {},
    unapprovedPosts: {},
    unapprovedPostAuthors: [],
    postIdsAutoReadLongAgo: [],
    postIdsAutoReadNow: [],
    marksByPostId: {},

    closedHelpMessages: {},
  };
}


/**
 * This data should be stored server side, but right now I'm prototyping only and
 * storing it client side only.
 */
function addLocalStorageDataTo(me: Myself) {
  me.postIdsAutoReadLongAgo = sidebar.UnreadCommentsTracker.getPostIdsAutoReadLongAgo();
  me.marksByPostId = {}; // not implemented: loadMarksFromLocalStorage();
  me.closedHelpMessages = getFromLocalStorage('closedHelpMessages') || {};

  // The watchbar: Recent topics.
  if (me_isStranger(me)) {
    me.watchbar = loadWatchbarFromSessionStorage();
    var recentTopics = me.watchbar[WatchbarSection.RecentTopics];
    if (shallAddCurrentPageToSessionStorageWatchbar(recentTopics)) {
      recentTopics.unshift({
        pageId: store.pageId,
        url: location.pathname,
        title: ReactStore.getPageTitle(),
      });
      putInSessionStorage('watchbar', me.watchbar);
    }
  }
}


function loadWatchbarFromSessionStorage(): Watchbar {
  // For privacy reasons, don't use localStorage?
  var watchbar = getFromSessionStorage('watchbar') || { 1: [], 2: [], 3: [], 4: [], };
  watchbar_markAsRead(watchbar, store.pageId);
  return watchbar;
}


function shallAddCurrentPageToSessionStorageWatchbar(recentTopics: WatchbarTopic[]): boolean {
  if (!store.pageId || store.pageId === EmptyPageId)
    return false;

  if (!pageRole_shallListInRecentTopics(store.pageRole))
    return false;

  return _.every(recentTopics, (topic: WatchbarTopic) => topic.pageId !== store.pageId);
}


function loadMarksFromLocalStorage(): { [postId: number]: any } {
  return {};
}


function saveMarksInLocalStorage(marks: { [postId: number]: any }) {
  //...
}


function rememberPostsToQuickUpdate(startPostId: number) {
  store.quickUpdate = true;
  var post = store.postsByNr[startPostId];
  if (!post) {
    console.warn('Cannot find post to quick update, nr: ' + startPostId + ' [DwE4KJG0]');
    return;
  }

  // In case `post` is a newly added reply, we'll update all earlier siblings, because they
  // draw an arrow to `post`. However if you've added an Unwanted vote, and post a new reply,
  // then a hereafter unwanted earlier sibling might be moved below startPostId. So we need
  // to update all subsequent siblings too.
  var parent: any = store.postsByNr[post.parentNr] || {};
  for (var i = 0; i < (parent.childIdsSorted || []).length; ++i) {
    var siblingId = parent.childIdsSorted[i];
    store.postsToUpdate[siblingId] = true;
  }

  // Need to update all ancestors, otherwise when rendering the React root we won't reach
  // `post` at all.
  while (post) {
    store.postsToUpdate[post.nr] = true;
    post = store.postsByNr[post.parentNr];
  }
}


function stopGifsPlayOnClick() {
  setTimeout(window['Gifffer'], 50);
}


function setWatchbarOpen(open: boolean) {
  if (open) $html.addClass('es-watchbar-open');
  else $html.removeClass('es-watchbar-open');
  putInLocalStorage('isWatchbarOpen', open);
  store.isWatchbarOpen = open;
}


function setContextbarOpen(open: boolean) {
  if (open) $html.addClass('es-pagebar-open');
  else $html.removeClass('es-pagebar-open');
  putInLocalStorage('isContextbarOpen', open);
  store.isContextbarOpen = open;
}


function updateShallSidebarsOverlayPage() {
  if (window.innerWidth < 780) { // dupl constant, see debikiScriptsHead.scala.html [5YKT42]
    if (store.shallSidebarsOverlayPage) return;
    $('html').addClass('esSidebarsOverlayPage');
    store.shallSidebarsOverlayPage = true;
  }
  else {
    if (!store.shallSidebarsOverlayPage) return;
    $('html').removeClass('esSidebarsOverlayPage');
    store.shallSidebarsOverlayPage = false;
  }
  ReactStore.emitChange();
}

//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 list
