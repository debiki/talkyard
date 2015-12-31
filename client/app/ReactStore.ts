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
/// <reference path="../typedefs/lodash/lodash.d.ts" />


/* This Flux store is perhaps a bit weird, not sure. I'll switch to Redux or
 * Flummox or Fluxxor or whatever later, and rewrite everything in a better way?
 * Also perhaps there should be more than one store, so events won't be broadcasted
 * to everyone all the time.
 */

//------------------------------------------------------------------------------
   module debiki2 {
//------------------------------------------------------------------------------

// DefinitelyTyped has defined EventEmitter2 in the wrong module? Unusable when
// not using AMD/CommonJS, see https://github.com/borisyankov/DefinitelyTyped/issues/3075.
var EventEmitter2: any = window['EventEmitter2'];

var ChangeEvent = 'ChangeEvent';

export var ReactStore = new EventEmitter2();


// First, initialize the store with page specific data only, nothing user specific,
// because the server serves cached HTML with no user specific data. Later on,
// we'll insert user specific data into the store, and re-render. See
// ReactStore.activateUserSpecificData().
var store: Store = debiki.reactPageStore;

store.postsToUpdate = {};
if (!store.user) store.user = makeEmptyUser();


ReactDispatcher.register(function(payload) {
  var action = payload.action;
  switch (action.actionType) {

    case ReactActions.actionTypes.Login:
      ReactStore.activateUserSpecificData(action.user);
      break;

    case ReactActions.actionTypes.Logout:
      if (store.userMustBeAuthenticated !== false || store.userMustBeApproved !== false)
        location.reload();

      $('html').removeClass('dw-is-admin, dw-is-staff, dw-is-authenticated');

      store.user = makeEmptyUser();
      debiki2.pubsub.subscribeToServerEventsAsUser(store.user);
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

    case ReactActions.actionTypes.PinPage:
      store.pinOrder = action.pinOrder;
      store.pinWhere = action.pinWhere;
      break;

    case ReactActions.actionTypes.UnpinPage:
      store.pinOrder = undefined;
      store.pinWhere = undefined;
      break;

    case ReactActions.actionTypes.SetPageNotfLevel:
      store.user.rolePageSettings.notfLevel = action.newLevel;
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

    case ReactActions.actionTypes.EditTitleAndSettings:
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
          $('html').removeClass('dw-vt').addClass('dw-hz');
          debiki.internal.layoutThreads();
          debiki2.utils.onMouseDetected(debiki.internal.initUtterscrollAndTips);
        }
        else {
          $('html').removeClass('dw-hz').addClass('dw-vt');
          $('.dw-t.dw-depth-1').css('width', 'auto'); // 2d columns had a certain width
        }
        debiki2.removeSidebar();
        setTimeout(debiki2.createSidebar, 1);
      }
      break;

    case ReactActions.actionTypes.ShowForumIntro:
      store.hideForumIntro = !action.visible;
      localStorage.setItem('hideForumIntro', action.visible ? 'false' : 'true');
      if (store.hideForumIntro) $('html').addClass('dw-hide-forum-intro');
      else $('html').removeClass('dw-hide-forum-intro');
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
      showPost(action.postId, action.showChildrenToo);
      break;

    case ReactActions.actionTypes.SetHorizontalLayout:
      store.horizontalLayout = action.enabled;
      // Now all gifs will be recreated since the page is rerendered.
      stopGifsPlayOnClick();
      break;

    case ReactActions.actionTypes.ChangeSiteStatus:
      store.siteStatus = action.newStatus;
      break;

    case ReactActions.actionTypes.HideHelpMessage:
      dieIf(!store.user, 'EsE8UGM5');
      store.user.closedHelpMessages[action.message.id] = action.message.version;
      putInLocalStorage('closedHelpMessages', store.user.closedHelpMessages);
      break;

    case ReactActions.actionTypes.ShowHelpAgain:
      putInLocalStorage('closedHelpMessages',  {});
      store.user.closedHelpMessages = {};
      break;

    case ReactActions.actionTypes.AddNotifications:
      var oldNotfs = store.user.notifications;
      for (var i = 0; i < action.notifications.length; ++i) {
        var newNotf = action.notifications[i];
        if (_.every(oldNotfs, n => n.id !== newNotf.id)) {
          // Modifying state directly, oh well [redux]
          store.user.notifications.unshift(newNotf);
          if (isTalkToMeNotification(newNotf)) {
            store.user.numTalkToMeNotfs += 1;
          }
          else if (isTalkToOthersNotification(newNotf)) {
            store.user.numTalkToOthersNotfs += 1;
          }
          else {
            store.user.numOtherNotfs += 1;
          }
        }
      }
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
}


function findAnyAcceptedAnswerPostNr() {
  if (!store.pageAnswerPostUniqueId)
    return;

  _.each(store.allPosts, (post: Post) => {
    if (post.uniqueId === store.pageAnswerPostUniqueId) {
      store.pageAnswerPostNr = post.postId;
    }
  });
}


// COULD change this to an action instead
ReactStore.activateUserSpecificData = function(anyUser) {
  store.userSpecificDataAdded = true;
  store.now = new Date().getTime();

  var newUser = anyUser || debiki.reactUserStore;
  if (!newUser) {
    // For now only. Later on, this data should be kept server side instead?
    addLocalStorageData(store.user);
    this.emitChange();
    return;
  }

  if (newUser.isAdmin) {
    $('html').addClass('dw-is-admin, dw-is-staff');
  }
  if (newUser.isModerator) {
    $('html').addClass('dw-is-staff');
  }
  if (newUser.isAuthenticated) {
    $('html').addClass('dw-is-authenticated');
  }

  store.user = newUser;
  addLocalStorageData(store.user);

  // Show the user's own unapproved posts, or all, for admins.
  _.each(store.user.unapprovedPosts, (post: Post) => {
    updatePost(post);
  });

  debiki2.pubsub.subscribeToServerEventsAsUser(newUser);

  store.quickUpdate = false;
  this.emitChange();
};


ReactStore.allData = function() {
  return store;
};


ReactStore.isGuestLoginAllowed = function() {
  return store.guestLoginAllowed || false;
}

ReactStore.getPageId = function() {
  return store.pageId;
}


ReactStore.getPageRole = function(): PageRole {
  return store.pageRole;
}


ReactStore.getUser = function(): User {
  return store.user;
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


export function clonePost(postId: number): Post {
  return _.cloneDeep(store.allPosts[postId]);
}


function updatePost(post: Post, isCollapsing?: boolean) {
  // (Could here remove any old version of the post, if it's being moved to
  // elsewhere in the tree.)

  store.now = new Date().getTime();

  var oldVersion = store.allPosts[post.postId];
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
    if (post.postId !== TitleId) {
      store.numPostsExclTitle += 1;
    }
    if (post.postType === PostType.Flat) {
      store.numPostsChatSection += 1;
    }
    else if (post.postId !== TitleId && post.postId !== BodyPostId) {
      store.numPostsRepliesSection += 1;
    }
  }

  // Add or update the post itself.
  store.allPosts[post.postId] = post;

  // In case this is a new post, update its parent's child id list.
  var parentPost = store.allPosts[post.parentId];
  if (parentPost) {
    var alreadyAChild =
        _.find(parentPost.childIdsSorted, childId => childId === post.postId);
    if (!alreadyAChild) {
      parentPost.childIdsSorted.unshift(post.postId);
      sortPostIdsInPlace(parentPost.childIdsSorted, store.allPosts);
    }
  }

  // Update list of top level comments, for embedded comment pages.
  if (!post.parentId && post.postId != BodyPostId && post.postId !== TitleId) {
    store.topLevelCommentIdsSorted = topLevelCommentIdsSorted(store.allPosts);
  }

  rememberPostsToQuickUpdate(post.postId);
  stopGifsPlayOnClick();
  setTimeout(processTimeAgo);
}


function voteOnPost(action) {
  var post: Post = action.post;

  var votes = store.user.votes[post.postId];
  if (!votes) {
    votes = [];
    store.user.votes[post.postId] = votes;
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
  var currentMark = store.user.marksByPostId[postId];
  if (currentMark) {
    // All marks already mean that the post has been read. Do nothing.
  }
  else if (manually) {
    store.user.marksByPostId[postId] = ManualReadMark;
  }
  else {
    store.user.postIdsAutoReadNow.push(postId);
  }
  rememberPostsToQuickUpdate(postId);
}


var lastPostIdMarkCycled = null;

function cycleToNextMark(postId: number) {
  var currentMark = store.user.marksByPostId[postId];
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
  store.user.marksByPostId[postId] = nextMark;

  rememberPostsToQuickUpdate(postId);
}


function summarizeReplies() {
  // For now, just collapse all threads with depth >= 2, if they're too long
  // i.e. they have successors, or consist of a long (high) comment.
  _.each(store.allPosts, (post: Post) => {
    if (post.postId === BodyPostId || post.postId === TitleId || post.parentId === BodyPostId)
      return;

    var isTooHigh = () => $('#post-' + post.postId).height() > 150;
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


function unsquashTrees(postId: number) {
  // Mark postId and its nearest subsequent siblings as not squashed.
  var post = store.allPosts[postId];
  var parent = store.allPosts[post.parentId];
  var numLeftToUnsquash = -1;
  for (var i = 0; i < parent.childIdsSorted.length; ++i) {
    var childId = parent.childIdsSorted[i];
    var child = store.allPosts[childId];
    if (!child)
      continue; // deleted
    if (child.postId == postId) {
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
  setTimeout(processTimeAgo);
}


function collapseTree(post: Post) {
  post = clonePost(post.postId);
  post.isTreeCollapsed = 'Truncated';
  post.summarize = true;
  post.summary = makeSummaryFor(post, 70);
  updatePost(post, true);
}


function showPost(postId: number, showChildrenToo?: boolean) {
  var post = store.allPosts[postId];
  if (showChildrenToo) {
    uncollapsePostAndChildren(post);
  }
  // Uncollapse ancestors, to make postId visible.
  while (post) {
    uncollapseOne(post);
    post = store.allPosts[post.parentId];
  }
  setTimeout(() => {
    debiki.internal.showAndHighlightPost($('#post-' + postId));
    processTimeAgo();
  }, 1);
}


function uncollapsePostAndChildren(post: Post) {
  uncollapseOne(post)
  // Also uncollapse children and grandchildren so one won't have to Click-to-show... all the time.
  for (var i = 0; i < Math.min(post.childIdsSorted.length, 5); ++i) {
    var childId = post.childIdsSorted[i];
    var child = store.allPosts[childId];
    if (!child)
      continue;
    uncollapseOne(child)
    for (var i2 = 0; i2 < Math.min(child.childIdsSorted.length, 3); ++i2) {
      var grandchildId = child.childIdsSorted[i2];
      var grandchild = store.allPosts[grandchildId];
      if (!grandchild)
        continue;
      uncollapseOne(grandchild)
    }
  }
  setTimeout(processTimeAgo);
}


function uncollapseOne(post: Post) {
  var p2 = clonePost(post.postId);
  p2.isTreeCollapsed = false;
  p2.isPostCollapsed = false;
  p2.summarize = false;
  p2.squash = false;
  updatePost(p2, true);
}


function topLevelCommentIdsSorted(allPosts): number[] {
  var idsSorted: number[] = [];
  _.each(allPosts, (post: Post) => {
    if (!post.parentId && post.postId !== BodyPostId && post.postId !== TitleId) {
      idsSorted.push(post.postId);
    }
  });
  sortPostIdsInPlace(idsSorted, allPosts);
  return idsSorted;
}


/**
 * NOTE: Keep in sync with sortPostsFn() in
 *   modules/debiki-core/src/main/scala/com/debiki/core/Post.scala
 */
function sortPostIdsInPlace(postIds: number[], allPosts) {
  postIds.sort((idA: number, idB: number) => {
    var postA = allPosts[idA];
    var postB = allPosts[idB];

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
    if (postA.multireplyPostIds.length && postB.multireplyPostIds.length) {
      if (postA.createdAt < postB.createdAt)
        return -1;
      if (postA.createdAt > postB.createdAt)
        return +1;
    }
    else if (postA.multireplyPostIds.length) {
      return +1;
    }
    else if (postB.multireplyPostIds.length) {
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
      return +1

    // Newest posts first. No, last
    if (postA.createdAt < postB.createdAt)
      return -1;
    else
      return +1;
  });
}


function makeEmptyUser(): User {
  return {
    rolePageSettings: {},

    numUrgentReviewTasks: 0,
    numOtherReviewTasks: 0,

    numTalkToMeNotfs: 0,
    numTalkToOthersNotfs: 0,
    numOtherNotfs: 0,
    thereAreMoreUnseenNotfs: false,
    notifications: [],
    votes: {},
    unapprovedPosts: {},
    postIdsAutoReadLongAgo: [],
    postIdsAutoReadNow: [],
    marksByPostId: {},
  };
}


/**
 * This data should be stored server side, but right now I'm prototyping only and
 * storing it client side only.
 */
function addLocalStorageData(user: User) {
  user.postIdsAutoReadLongAgo = sidebar.UnreadCommentsTracker.getPostIdsAutoReadLongAgo();
  user.marksByPostId = {}; // not implemented: loadMarksFromLocalStorage();
  user.closedHelpMessages = getFromLocalStorage('closedHelpMessages') || {};
}


function loadMarksFromLocalStorage(): { [postId: number]: any } {
  return {};
}


function saveMarksInLocalStorage(marks: { [postId: number]: any }) {
  //...
}


function rememberPostsToQuickUpdate(startPostId: number) {
  store.quickUpdate = true;
  var post = store.allPosts[startPostId];
  if (!post) {
    console.warn('Cannot find post to quick update, nr: ' + startPostId + ' [DwE4KJG0]');
    return;
  }

  // In case `post` is a newly added reply, we'll update all earlier siblings, because they
  // draw an arrow to `post`. However if you've added an Unwanted vote, and post a new reply,
  // then a hereafter unwanted earlier sibling might be moved below startPostId. So we need
  // to update all subsequent siblings too.
  var parent: any = store.allPosts[post.parentId] || {};
  for (var i = 0; i < (parent.childIdsSorted || []).length; ++i) {
    var siblingId = parent.childIdsSorted[i];
    store.postsToUpdate[siblingId] = true;
  }

  // Need to update all ancestors, otherwise when rendering the React root we won't reach
  // `post` at all.
  while (post) {
    store.postsToUpdate[post.postId] = true;
    post = store.allPosts[post.parentId];
  }
}


function stopGifsPlayOnClick() {
  setTimeout(window['Gifffer'], 50);
}


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 list
