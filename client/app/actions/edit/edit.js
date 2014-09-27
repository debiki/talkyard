/* Shows inline article and comment edit dialogs.
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


d.i.$loadEditorDependencies = (function() {
  // COULD use 2 loadStatus, and load Code Mirror only iff `this`
  // is the root post.
  var loadStatus;
  return function() {
    if (loadStatus)
      return loadStatus;
    loadStatus = $.Deferred();
    var loadCodeMirror = !Modernizr.touch;
    var assetsPrefix = d.i.assetsUrlPathStart;
    Modernizr.load({
      test: loadCodeMirror,
      yep: [
        assetsPrefix + 'codemirror-3-13-custom.css',
        assetsPrefix + 'codemirror-3-13-custom.' + d.i.minMaxJs],
      both: [
        assetsPrefix + 'debiki-pagedown.' + d.i.minMaxJs],
      complete: function() {
        loadStatus.resolve();
      }
    })
    return loadStatus;
  }
})();


/**
 * Loads editor resources and opens the edit form.
 */
d.i.$showEditForm = function(event) {
  event.preventDefault();
  var _this = this;
  var postId = $(this).dwPostId();
  var anyReturnToUrl = d.i.makeReturnToPostUrlForVerifEmail(postId);
  d.i.loginIfNeeded('LoginToEdit', anyReturnToUrl, function() {
    if (d.i.isInEmbeddedCommentsIframe) {
      sendEditPostMessageToEmbeddedEditor(postId);
    }
    else {
      d.i.openEditorToEditPost(postId);
    }
  });
};


function sendEditPostMessageToEmbeddedEditor(postId) {
  window.parent.postMessage(
      JSON.stringify(['editorEditPost', postId]), '*');
};


d.i.openEditorToEditPost = function(postId) {
  // Comment out for now. Will I use commonMark and WMD instead of CodeMirror?
  // d.i.$loadEditorDependencies.call(_this).done(

  d.i.withEditorScope(function(editorScope) {
    editorScope.vm.startEditing(postId);
  });
};


d.i.handleEditResult = function(data) {
  if (d.i.isInEmbeddedEditor) {
    // Send a message to the embedding page, which will forward it to
    // the comments iframe, which will show the new edits.
    window.parent.postMessage(
        JSON.stringify(['handleEditResult', data]), '*');
  }
  else {
    doHandleEditResult(data);
  }
};


function doHandleEditResult(data) {
  d.i.patchPage(data);
  var postId = data.postsByPageId[d.i.pageId][0].postId;
  // In case the page was just created lazily when the edits were saved,
  // tell AngularJS to update the page as appropriately,
  // e.g. show certain buttons in the admin dashbar.
  // ((This won't update the data-page_exists attribute though,
  // so we'll trigger Angular's $digest whenever we edit the page,
  // if it is newly created (didn't exist when it was rendered).))
  d.i.angularApply(function(rootScope) {
    rootScope.pageExists = true;
  });
};



// Invoke this function on a textarea or an edit suggestion.
// It hides the closest post text and shows a diff of the-text-of-the-post
// and $(this).val() or .text(). $removeEditDiff shows the post again.
d.i.$showEditDiff = function() {
  // Find the closest post
  var $post = $(this).closest('.dw-t').children('.dw-p');
  var height = $post.height();
  // Remove any old diff
  var $oldDiff = $post.children('.dw-p-diff');
  $oldDiff.remove();
  // Extract the post's current text.
  var $postBody = $post.children('.dw-p-bd');
  var oldText =
      $postBody.map($extractMarkupSrcFromHtml)[0]; // SHOULD excl inline threads
  // Try both val() and text() -- `this' might be a textarea or
  // an elem with text inside.
  var newText = $(this).val();
  if (newText === '') newText = $(this).text();
  newText = newText.trim() +'\n';  // $htmlToMarkup trims in this way

  var htmlDiff = d.i.makeHtmlDiff(oldText, newText);

  // Hide the post body, show the diff instead.
  $postBody.hide();
  $postBody.after('<div class="dw-p-diff">'+ htmlDiff +'</div>\n');
  // Fix the height of the post, so it won't change when showing
  // another diff, causing everything below to jump up/down.

  // For now, make it somewhat higher than its current height,
  // so there's room for <ins> elems.
  //$post.css('height', '');
  //$post.css('height', $post.height() + 50 +'px');
  //$post.height(height + ($oldDiff.length ? 0 : 75));
  $post.height(height);
  $post.css('overflow-y', 'auto');

  // COULD make inline comments point to marks in the diff.
};


// Removes any diff of the closest post; shows the post text instead.
d.i.$removeEditDiff = function() {
  var $post = $(this).closest('.dw-t').children('.dw-p');
  $post.children('.dw-p-diff').remove();
  $post.children('.dw-p-bd').show();
  $post.css('overflow-y', 'hidden');
};


// vim: fdm=marker et ts=2 sw=2 fo=tcqwn list
