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
/// <reference path="../typedefs/lodash/lodash.d.ts" />

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


ReactDispatcher.register(function(payload) {
  var action = payload.action;
  switch (action.actionType) {

    case ReactActions.actionTypes.Login:
      ReactStore.activateUserSpecificData(action.user);
      break;

    case ReactActions.actionTypes.Logout:
      store.user = {
        userId: undefined,
        permsOnPage: {},
        rolePageSettings: {},
        votes: {},
        unapprovedPosts: {},
        postIdsAutoReadLongAgo: [],
        postIdsAutoReadNow: [],
        marksByPostId: {},
      };
      break;

    case ReactActions.actionTypes.SetPageNotfLevel:
      store.user.rolePageSettings.notfLevel = action.newLevel;
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

    case ReactActions.actionTypes.UncollapsePost:
      uncollapsePost(action.post);
      break;

    case ReactActions.actionTypes.SetHorizontalLayout:
      store.horizontalLayout = action.enabled;
      break;

    default:
      console.warn('Unknown action: ' + JSON.stringify(action));
      return true;
  }

  ReactStore.emitChange();

  // Tell the dispatcher that there were no errors:
  return true;
});


// COULD change this to an action instead
ReactStore.activateUserSpecificData = function(anyUser) {
  store.userSpecificDataAdded = true;

  var newUser = anyUser || debiki.reactUserStore;
  if (!newUser) {
    addLocalStorageData(store.user);
    return;
  }

  store.user = newUser;
  addLocalStorageData(store.user);

  // Show the user's own unapproved posts, or all, for admins.
  _.each(store.user.unapprovedPosts, (post) => {
    updatePost(post);
  });

  this.emitChange();
};


ReactStore.allData = function() {
  return store;
};


ReactStore.getPageId = function() {
  return store.pageId;
}


ReactStore.getPageRole = function() {
  return store.pageRole;
}


ReactStore.getUser = function() {
  return store.user;
};


ReactStore.getCategories = function() {
  return store.categories;
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


function updatePost(post) {
  // (Could here remove any old version of the post, if it's being moved to
  // elsewhere in the tree.)

  var oldVersion = store.allPosts[post.postId];

  if (oldVersion) {
    // Don't collapse the post if the user has opened it.
    post.isTreeCollapsed = oldVersion.isTreeCollapsed;
    post.isPostCollapsed = oldVersion.isPostCollapsed;
  }
  else {
    store.numPosts += 1;
    if (post.id !== TitleId) {
      store.numPostsExclTitle += 1;
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
}


function voteOnPost(action) {
  var post = action.post;

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
}


function cycleToNextMark(postId: number) {
  var currentMark = store.user.marksByPostId[postId];
  var nextMark;
  if (!currentMark) {
    nextMark = FirstMark;
  }
  else if (currentMark === LastMark) {
    nextMark = null;
  }
  else {
    nextMark = currentMark + 1;
  }
  store.user.marksByPostId[postId] = nextMark;
}


function uncollapsePost(post) {
  post.isTreeCollapsed = false;
  post.isPostCollapsed = false;
  updatePost(post);
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

    // Place multireplies after normal replies. And sort multireplies by time,
    // for now, so it never happens that a multireply ends up placed before another
    // multireply that it replies to.
    // COULD place interesting multireplies first, if they're not constrained by
    // one being a reply to another.
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


/**
 * This data should be stored server side, but right now I'm prototyping only and
 * storing it client side only.
 */
function addLocalStorageData(user: User) {
  user.postIdsAutoReadLongAgo = sidebar.UnreadCommentsTracker.getPostIdsAutoReadLongAgo();
  user.marksByPostId = loadMarksFromLocalStorage();
}


function loadMarksFromLocalStorage(): { [postId: number]: any } {
  return {};
}


function saveMarksInLocalStorage(marks: { [postId: number]: any }) {
  //...
}

//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 list
