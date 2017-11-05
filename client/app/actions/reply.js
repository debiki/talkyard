/* Shows a reply form, and some related tips.
 * Copyright (c) 2010 - 2017 Kaj Magnus Lindberg
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

// CLEAN_UP, REFACTOR this so this file can be deleted.

var d = { i: debiki.internal };


d.i.clearIsReplyingMarks = function() {
  var replyBtns = debiki2.$$byClass('dw-replying');
  for (var i = 0; i < replyBtns.length; ++i) {
    var buttonElem = replyBtns[i];
    buttonElem.classList.remove('dw-replying');
  }
};


// Try to remove. Rename to handlePagePatch?
d.i.handleReplyResult = function(data) {
  if (d.i.isInEmbeddedEditor) {
    if (data.newlyCreatedPageId) {
      // COULD update the page id in the React store too. Currently only needed here though: [7UWKBA1]
      d.i.pageId = data.newlyCreatedPageId;
    }
    // Send a message to the embedding page, which will forward it to
    // the comments iframe, which will show the new comment.
    window.parent.postMessage(['handleReplyResult', data], '*');
  }
  else {
    doHandleReplyResult(data);
  }
};


function doHandleReplyResult(data) {
  if (_.isNumber(data.nr || data.postId)) {  // a Post with a .nr?
    // It's a post. Try to remove this.
    debiki2.ReactActions.updatePost(data);
  }
  else {
    // It's a StorePatch.
    debiki2.ReactActions.patchTheStore(data);
  }
}


// vim: fdm=marker et ts=2 sw=2 fo=tcqwn list
