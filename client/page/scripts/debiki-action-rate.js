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
  }
};


function toggleVoteImpl(voteBtn, voteType) {
  var thread = voteBtn.closest('.dw-t');
  var post = thread.children('.dw-p');
  var postId = post.dwPostId();

  var voteType;
  if (voteBtn.is('.dw-a-like')) {
    voteType = 'VoteLike';
  }
  else if (voteBtn.is('.dw-a-wrong')) {
    voteType = 'VoteWrong';
  }
  else if (voteBtn.is('.dw-a-offtopic')) {
    voteType = 'VoteOffTopic';
  }
  else {
    d.u.die('DwE218F7');
  }

  var action;
  if (d.i.Me.getVotes(postId).indexOf(voteType) !== -1) {
    action = 'DeleteVote';
  }
  else {
    action = 'CreateVote';
  }

  d.u.postJson({
      url: d.i.serverOrigin + '/-/vote',
      data: {
        pageId: d.i.pageId,
        postId: postId,
        vote: voteType,
        action: action
      },
      error: d.i.showServerResponseDialog,
      success: onVoteToggled
    });

  function onVoteToggled(pagePatchJson) {
    d.i.patchPage(pagePatchJson, { replacePostHeadsOnly: true });
    if (action == 'CreateVote') {
      voteBtn.addClass('dw-my-vote');
    }
    else {
      voteBtn.removeClass('dw-my-vote');
    }
    //post.each(d.i.SVG.$drawParentsAndTree); -- why would this be needed?
  };
};



// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
