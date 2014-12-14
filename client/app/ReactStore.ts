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

/// <reference path="../typedefs/lodash/lodash.d.ts" />

//------------------------------------------------------------------------------
   module debiki2 {
//------------------------------------------------------------------------------

// DefinitelyTyped has defined EventEmitter2 in the wrong module? Unusable when
// not using AMD/CommonJS, see https://github.com/borisyankov/DefinitelyTyped/issues/3075.
var EventEmitter2: any = window['EventEmitter2'];

var ChangeEvent = 'ChangeEvent';

export var ReactStore = new EventEmitter2();

var store = debiki.store;


ReactDispatcher.register(function(payload) {
  var action = payload.action;
  switch (action.actionType) {

    case ReactActions.actionTypes.Login:
      store.user = action.user;
      break;

    case ReactActions.actionTypes.Logout:
      store.user = {
        permsOnPage: {},
        rolePageSettings: {},
        votes: {},
        unapprovedPosts: {},
      };
      break;

    case ReactActions.actionTypes.SetPageNotfLevel:
      store.user.rolePageSettings.notfLevel = action.newLevel;
      break;

    case ReactActions.actionTypes.UpdatePost:
      updatePost(action.post);
      break;

    default:
      console.warn('Unknown action: ' + JSON.stringify(action));
      return true;
  }

  ReactStore.emitChange();

  // Tell the dispatcher that there were no errors:
  return true;
});


ReactStore.activateUserSpecificData = function() {
  store.user = store.renderLaterInBrowserOnly.user;
  // Show the user's own unapproved posts, or all, for admins.
  _.each(store.renderLaterInBrowserOnly.user.unapprovedPosts, (post) => {
    updatePost(post);
  });
  this.emitChange();
};


ReactStore.allData = function() {
  return store;
};


ReactStore.getUser = function() {
  return store.user;
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

  // Add or update the post itself.
  store.allPosts[post.postId] = post;

  // In case this is a new post, update its parent's child id list.
  var parentPost = store.allPosts[post.parentId];
  if (parentPost) {
    // TODO sort by like-wrong votes.
    var alreadyAChild =
        _.find(parentPost.childIds, childId => childId === post.postId);
    if (!alreadyAChild) {
      parentPost.childIds.unshift(post.postId);
    }
  }
}


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 list
