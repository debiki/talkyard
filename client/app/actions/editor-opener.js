/* Opens the editor to write a reply or edit a post.
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

var d = { i: debiki.internal, u: debiki.v0.util };
var $ = d.i.$;


d.i.editorEditNewForumTopic = function(parentPageId) {
  withEditorScope(function(editorScope) {
    editorScope.vm.editNewForumTopic(parentPageId);
  });
};


/**
 * Opens the editor to write a reply to `postId`, or closes the editor
 * if it was already open in order to reply to `postId`.
 */
d.i.editorToggleReply = function(postId, replyAction) {
  if (d.i.isInIframe) {
    sendEditorToggleReplyMessageToEmbeddingPage(postId);
  }
  else {
    editorToggleReply(postId, replyAction);
  }
};


function sendEditorToggleReplyMessageToEmbeddingPage(postId) {
  window.parent.postMessage(
      JSON.stringify(['editorToggleReply', postId]), '*');
};


function editorToggleReply(postId, replyAction) {
  withEditorScope(function(editorScope) {
    var isSelected = editorScope.vm.toggleReplyToPost(postId);
    var actions = replyAction.closest('.dw-p-as');
    if (isSelected) {
      actions.addClass('dw-replying');
    }
    else {
      actions.removeClass('dw-replying');
    }
  });
};


function withEditorScope(fn) {
  var rootScope = angular.element($('html')).scope();
  var editorScope = angular.element($('#debiki-editor-controller')[0]).scope();
  if (rootScope.$$phase) {
    // Already inside Angular's digest cycle.
    fn(editorScope);
  }
  else {
    editorScope.$apply(function() {
      fn(editorScope);
    });
  }
}


// vim: fdm=marker et ts=2 sw=2 fo=tcqwn list
