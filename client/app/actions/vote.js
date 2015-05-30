/* Toggles like/wrong/off-topic votes on a comment.
 * Copyright (C) 2010 - 2012 Kaj Magnus Lindberg (born 1979)
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

var d = { i: debiki.internal, u: debiki.v0.util };
var $ = d.i.$;


d.i.$toggleVote = function(voteType) {
  return function(event) {
    toggleVoteImpl($(this), voteType);
    return false;
  };
};


function toggleVoteImpl(voteBtn, voteType) {
  var thread = voteBtn.closest('.dw-t');
  var post = thread.children('.dw-p');
  var postId = post.dwPostId();

  var action;
  var postIdsRead = undefined;
  if (voteBtn.is('.dw-my-vote')) {
    action = 'DeleteVote';
  }
  else {
    action = 'CreateVote';
    postIdsRead = findPostIdsRead(post);
  }

  d.u.postJson({
      url: d.i.serverOrigin + '/-/vote',
      data: {
        pageId: d.i.pageId,
        postId: postId,
        vote: voteType,
        action: action,
        postIdsRead: postIdsRead
      },
      error: d.i.showServerResponseDialog,
      success: onVoteToggled
    });

  function onVoteToggled(updatedPost) {
    debiki2.ReactActions.vote(updatedPost, action, voteType);
  };
};


function findPostIdsRead(postVotedOn) {
  var postIdsRead = [];
  var parentThreads = postVotedOn.parents('.dw-t');
  parentThreads.each(function() {
    var parentThread = $(this);
    var prevSiblings;
    if (parentThread.is('li')) {
      // Vertical layout, each thread directly in its own <li>.
      prevSiblings = parentThread.prevAll('.dw-t');
    }
    else {
      // Horizontal layout. Each thread is wrapped in an <li>, for styling purposes.
      var prevListItems = parentThread.closest('li').prevAll();
      prevSiblings = prevListItems.children('.dw-t');
    }
    var parentAndSiblings = parentThread.add(prevSiblings);
    // `[id]` skips a dummy posts with no id, which represents the article
    // on embedded comment pages.
    var posts = parentAndSiblings.children('.dw-p[id]');
    posts.each(function() {
      postIdsRead.push($(this).dwPostId());
    });
  });
  return postIdsRead;
}


// vim: fdm=marker et ts=2 sw=2 tw=0 fo=tcqwn list
