/* Shows a reply form, and some related tips.
 * Copyright (C) 2010 - 2014 Kaj Magnus Lindberg (born 1979)
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

var d = { i: debiki.internal, u: debiki.v0.util };
var $ = d.i.$;

var NoPostId = -1; // also in constants.ts


d.i.$showReplyForm = function(event, anyPostType) {
  event.preventDefault();
  showReplyFormImpl($(this), anyPostType);
};


d.i.showReplyFormEmbeddedComments = function() {
  showReplyFormImpl();
};


d.i.showReplyFormForFlatChat = function() {
  showReplyFormImpl(null, PostType.Flat);
};


function showReplyFormImpl($this, anyPostType) {
  var replyAction;
  if ($this) {
    var thread = $this.closest('.dw-t');
    replyAction = thread.find('> .dw-p-as > .dw-a-reply');
  }
  else {
    // This is an embedded comments page and the reply button clicked is in the
    // comments toolbar. Or we're in the flat chat section on a non-embedded page.
    replyAction = $('.dw-cmts-tlbr .dw-a-reply, .dw-chat-as .dw-a-reply');
  }

  var postId;
  if (!$this) {
    // Embedded comments page, Reply button in comments toolbar was clicked.
    // Set postId to NoPostId to indicate that we're replying to the article on
    // the embedding page.
    postId = NoPostId;
  }
  else {
    // Non-embedded page; there is no Reply button in the comments toolbar.
    postId = $this.closest('.dw-t').dwPostId();
  }

  // Dupl code [69KFUW20]
  debiki2.morebundle.loginIfNeededReturnToPost('LoginToComment', postId, function() {
    // Toggle highlighting first, because it'll be cleared later if the
    // editor is closed, and then we don't want to toggle it afterwards.
    toggleReplyButtonHighlighting(replyAction);
    if (d.i.isInEmbeddedCommentsIframe) {
      console.warn("anyPostType ignored [DwE4KEPF0]");
      sendWriteReplyMessageToEmbeddedEditor(postId, anyPostType);
    }
    else {
      d.i.openEditorToWriteReply(postId, anyPostType);
    }
  });
};



function sendWriteReplyMessageToEmbeddedEditor(postId) {
  window.parent.postMessage(
      JSON.stringify(['editorToggleReply', postId]), '*');
};


d.i.openEditorToWriteReply = function(postId, anyPostType) {
  debiki2.editor.toggleWriteReplyToPost(postId, anyPostType || PostType.Normal);
};


function toggleReplyButtonHighlighting(replyAction) {
  var actions = replyAction.closest('.dw-p-as');
  actions.toggleClass('dw-replying');
}


d.i.clearIsReplyingMarks = function() {
  $('.dw-replying').removeClass('dw-replying');
};


// Try to remove. Rename to handlePagePatch?
d.i.handleReplyResult = function(data) {
  if (d.i.isInEmbeddedEditor) {
    // Send a message to the embedding page, which will forward it to
    // the comments iframe, which will show the new comment.
    window.parent.postMessage(
        JSON.stringify(['handleReplyResult', data]), '*');
  }
  else {
    doHandleReplyResult(data);
  }
};


function doHandleReplyResult(data) {
  if (_.isNumber(data.postId)) {
    // It's a post. Try to remove this.
    debiki2.ReactActions.updatePost(data);
  }
  else {
    // It's a StorePatch.
    debiki2.ReactActions.patchTheStore(data);
  }
}


// vim: fdm=marker et ts=2 sw=2 fo=tcqwn list
