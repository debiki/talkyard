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
  d.i.loginIfNeeded('LoginToLogin', anyReturnToUrl, function() {
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
  d.i.withEditorScope(function(editorScope) {
    var isSelected = editorScope.vm.toggleReplyToPost(postId);
  });
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
  debiki2.ReactActions.updatePost(newPost);

  var myNewPost = $('#post-' + newPost.postId);
  d.u.bugIf(myNewPost.length !== 1, 'DwE3TW379');

  var patchedThread = myNewPost.parent('.dw-t');
  var parentThread = patchedThread.parent().closest('.dw-t');
  var horizLayout = parentThread.is('.dw-hz');
  var replyCountBefore = parentThread.find('> .dw-single-and-multireplies > .dw-singlereplies > li > .dw-t').length;

  // Don't show sort order tips instantly, because if
  // the new comment and the tips appear at the same time,
  // the user will be confused? S/he won't know where to look?
  // So wait a few seconds.
  // Don't show sort order tips if there are few replies,
  // then nothing is really being sorted anyway.
  var showSortTips = horizLayout && replyCountBefore >= 2;
  if (showSortTips)
    showSortOrderTipsLater(myNewPost, 2050);

  d.i.showAndHighlightPost(myNewPost, { marginRight: 300, marginBottom: 300 });
  d.i.$showActions.apply(myNewPost);
};


function showSortOrderTipsLater($newPost, delay) {
  setTimeout(function() {
    var $tips = $('#dw-tps-sort-order');
    $tips.appendTo($newPost).dwScrollIntoView().click(function() {
      $tips.hide();
    });
  }, delay);
}


// vim: fdm=marker et ts=2 sw=2 fo=tcqwn list
