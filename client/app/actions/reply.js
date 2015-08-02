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

var d = { i: debiki.internal, u: debiki.v0.util };
var $ = d.i.$;

var NO_ID = -1;


d.i.$showReplyForm = function(event, opt_where) {
  event.preventDefault();
  showReplyFormImpl($(this));
};


d.i.showReplyFormEmbeddedComments = function() {
  showReplyFormImpl();
};


function showReplyFormImpl($this) {
  var replyAction;
  if ($this) {
    var thread = $this.closest('.dw-t');
    replyAction = thread.find('> .dw-p-as > .dw-a-reply');
  }
  else {
    // This is an embedded comments page and the reply button clicked is in the
    // comments toolbar.
    replyAction = $('.dw-cmts-tlbr .dw-a-reply');
  }

  var postId;
  if (!$this) {
    // Embedded comments page, Reply button in comments toolbar was clicked.
    // Set postId to NO_ID to indicate that we're replying to the article on
    // the embedding page.
    postId = NO_ID;
  }
  else {
    // Non-embedded page; there is no Reply button in the comments toolbar.
    postId = $this.closest('.dw-t').dwPostId();
  }

  var anyReturnToUrl = d.i.makeReturnToPostUrlForVerifEmail(postId);
  d.i.loginIfNeeded('LoginToComment', anyReturnToUrl, function() {
    // Toggle highlighting first, because it'll be cleared later if the
    // editor is closed, and then we don't want to toggle it afterwards.
    toggleReplyButtonHighlighting(replyAction);
    if (d.i.isInEmbeddedCommentsIframe) {
      sendWriteReplyMessageToEmbeddedEditor(postId);
    }
    else {
      d.i.openEditorToWriteReply(postId);
    }
  });
};



function sendWriteReplyMessageToEmbeddedEditor(postId) {
  window.parent.postMessage(
      JSON.stringify(['editorToggleReply', postId]), '*');
};


d.i.openEditorToWriteReply = function(postId) {
  debiki2.editor.toggleWriteReplyToPost(postId);
};


function toggleReplyButtonHighlighting(replyAction) {
  var actions = replyAction.closest('.dw-p-as');
  actions.toggleClass('dw-replying');
}


d.i.clearIsReplyingMarks = function() {
  $('.dw-replying').removeClass('dw-replying');
};


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


function doHandleReplyResult(newPost) {
  // On iPhone 5, some unknown error happens inside ReactStore.emitChange, invoked
  // via `updatePost(newPost)` below. Therefore, schedule show-and-highlight directly here.
  // (No idea what happens — everything seems to work fine, except that no code below
  // `updatePost(newPost)` gets invoked here. iPhone logs no info about the error at all;
  // I know it happens in emitChange only because I added lots of console.error messages,
  // and the one after emitChange after `switch (action.actionType)` in ReactStore was
  // the first one that was never displayed.)
  setTimeout(function() {
    var myNewPost = $('#post-' + newPost.postId);
    d.i.showAndHighlightPost(myNewPost, { marginRight: 300, marginBottom: 300 });
    d.i.$showActions.apply(myNewPost);
  }, 1);

  debiki2.ReactActions.updatePost(newPost);
};


// vim: fdm=marker et ts=2 sw=2 fo=tcqwn list
