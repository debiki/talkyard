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

  var thread = $(this).closest('.dw-t');
  var replyAction = thread.find('> .dw-p-as > .dw-a-reply');
  if (!replyAction.length) {
    // This is an embedded comments page and the reply button clicked is in the
    // comments toolbar.
    d.u.bugIf(!thread.is('.dw-depth-0'));
    replyAction = $('.dw-cmts-tlbr .dw-a-reply');
  }

  var postId;
  if ($(this).closest('.dw-cmts-tlbr').length) {
    // Embedded comments page, Reply button in comments toolbar was clicked.
    postId = d.i.BodyId;
  }
  else {
    // Non-embedded page; there is no Reply button in the comments toolbar.
    postId = $(this).closest('.dw-t').dwPostId();
  }

  var anyReturnToUrl = d.i.makeReturnToPostUrlForVerifEmail(postId);
  d.i.loginIfNeeded('LoginToLogin', anyReturnToUrl, function() {
    var editorScope = angular.element($('#debiki-editor-controller')[0]).scope();

    editorScope.$apply(function() {
      editorScope.visible = true;
      var isSelected = editorScope.vm.toggleReplyToPost(postId);
      var actions = replyAction.closest('.dw-p-as');
      if (isSelected) {
        actions.addClass('dw-replying');
      }
      else {
        actions.removeClass('dw-replying');
      }
    });

  });
};


d.i.handleReplyResult = function(data) {
  var result = d.i.patchPage(data);
  var patchedThread = result.patchedThreads[0];
  var myNewPost = patchedThread.dwGetPost();
  d.u.bugIf(myNewPost.length !== 1, 'DwE3TW379');
  d.i.markMyPost(myNewPost.dwPostIdStr());

  var parentThread = patchedThread.parent().closest('.dw-t');
  var horizLayout = parentThread.is('.dw-hz');
  var replyCountBefore = parentThread.find('> .dw-res > li > .dw-t').length;

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
