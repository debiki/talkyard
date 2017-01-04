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


d.i.toggleVote = function(postNr, voteType, toggleOn) {
  var post = $('#post-' + postNr);
  var action;
  var postNrsRead = undefined;
  if (!toggleOn) {
    action = 'DeleteVote';
  }
  else {
    action = 'CreateVote';
    postNrsRead = findPostNrsRead(post);
  }

  var data = {
    pageId: d.i.pageId,
    postNr: postNr,
    vote: voteType,
    action: action,
    postNrsRead: postNrsRead
  };

  debiki2.Server.saveVote(data, function(updatedPost) {
    debiki2.ReactActions.vote(updatedPost, action, voteType);
  });
};


// Try to remove, use the js objs in the React store instead.
function findPostNrsRead(postVotedOn) {
  var postNrsRead = [];
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
      postNrsRead.push($(this).dwPostId());
    });
  });
  return postNrsRead;
}


// vim: fdm=marker et ts=2 sw=2 tw=0 fo=tcqwn list
