/* Shows an inline actions menu, when one clicks text.
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

var $lastInlineMenu = $();


function $hideInlineActionMenu(event) {
  $lastInlineMenu.remove();
};


// Opens a menu with Inline Reply and Edit endries.
// Does currently not work (does nothing) in IE 7 and 8.
function $showInlineActionMenu(event) {

  // One may not edit old historic page versions.
  if (d.i.isViewingOldPageVersion())
    return;

  var $menu;
  var $target = $(event.target);
  if ($target.closest('.dw-fs').length) {
    // A form was clicked. Ignore click.
    return;
  }
  if (event.which === 2 || event.which === 3) {
    return; // ignore middle and right mouse buttons
    // (What is `which' for touch events? This works fine on Android anyhow.)
  }

  // {{{ Could use ierange-m2.js (http://code.google.com/p/ierange/)
  // for this to work in IE 7 and 8, if the user has actually selected
  // a text range — mouse clicks, however, generate no range in IE 8 (and 7?)
  // (with ierange-m2). But mouse clicks are what is interesting, so skip
  // ierange for now. How find the *clicked* node and offset in IE 7 and 8? }}}
  if (!window.getSelection) return;  // IE 7 and 8
  var sel = window.getSelection();
  if (!sel.anchorNode || !sel.anchorNode.data ||
      sel.anchorNode.data.substr(sel.anchorOffset, 1).length === 0) {
    // No text clicked. Ignore.
    return;
  }

  // Find out what piece of text was cliced or selected.
  // See: http://stackoverflow.com/questions/3968520/
  //      how-to-use-jquery-prevall-to-select-nearby-text-nodes/3968929#3968929

  // If the user clicked e.g. inside a short <b> tag, the range might be only a 
  // few characters long, and these few characters might occur somewhere else
  // in the same post. This could result in Google's diff-match-patch finding 
  // the wrong occurrance.
  // jQuery(window.getSelection().anchorNode).parent().parent().contents()

  // {{{ Old comment? Show a mark where the click was? See insertNodeAtCursor here:
  //  http://stackoverflow.com/questions/2213376/
  //    how-to-find-cursor-position-in-a-contenteditable-div/2213514#2213514
  // Use event.clientX, event.clientY.
  // }}}

  // Remember the clicked node and, if it's a text node, its parent
  // non-text node.
  // Later, when finding the closest .dw-p-bd-blk, we must start searching
  // from a non-text node, because jQuery(text-node) results in TypeError:
  //  Object #<a Text> has no method 'getAttribute'.
  var isTextNode = sel.focusNode.nodeType === 3;  // 3 is text
  var focusText = isTextNode ? sel.focusNode : undefined;
  var $focusNonText = $(isTextNode ? sel.focusNode.parentNode : sel.focusNode);
  var $post = $target.closest('.dw-p');
  var $postBody = $post.children('.dw-p-bd');

  if (!isTextNode) {
    // Finding the text clicked, when !isTextNode, is not implemented.
    // So right now, no inline menu will appear.
    // Seems to happen if you select a <li> or <p>,
    // by selecting a line end just before such an elem.
    // Or if you release the mouse button inside a .dw-i-m-start.
    return;
  }

  // When the user clicks a menu button, `sel' will refer to this new click,
  // so copy the old click forever:
  var sel = {
    focusOffset: sel.focusOffset,
    focusNode: sel.focusNode,
    anchorNode: sel.anchorNode,
    anchorOffset: sel.anchorOffset
  };

  // Finds the text just after the click. For example, if you click
  // somewhere on 'cows' in a post with this text:
  //    'All <strong>crazy cows</strong> eagerly eat running rabbits'
  // I think it finds ' eagerly eat running rabbits'.
  // (It does this without being so very confused by html tags,
  // because it converts tags to single characters and then uses
  // google-diff-match-patch to do a fussy search for the start
  // of the clicked text.)
  var placeWhereFunc = function() {
    // Find out where to place the relevant form.
    // This must be done when the -bd has been split into -bd-blks.
    var elem = $focusNonText.closest('.dw-p-bd-blk')
          .dwBu gIfEmpty('error DwE6u5962rf3')
          .next('.dw-i-ts')
          .dwBu gIfEmpty('error DwE17923xstq');

    if (isTextNode) {
      // Insert a magic token where the mouse was clicked.
      // Convert the whole post to text, and find the text just
      // after the magic token. That text (after the token) is
      // where the inline mark should be placed.
      // The *whole* post body is converted to text. If only
      // the clicked node was considered, the text just after
      // the click could be very short, e.g. only "You"
      // if the node is <h1>Hey You</h1> and "you" could have many
      // matches in the post (and when inline marks are placed
      // the whole post is considered).
      var origText = focusText.nodeValue;
      var textAfterFocus = origText.substr(sel.focusOffset);
      // "Move" the focus to the end of the clicked word, so the inline
      // mark won't split the word in two.
      var charsToEndOfWord = textAfterFocus.search(
          / |!|"|'|\)|\*|\+|\-|\/|<|>|\]|`|\||\}/i)
      if (charsToEndOfWord === -1) {
        // The user clicked the last word in the text node.
        // Place the mark after this last word.
        charsToEndOfWord = textAfterFocus.length;
      }
      var endOfWordOffs = sel.focusOffset + charsToEndOfWord;
      var textBefore = origText.substr(0, endOfWordOffs);
      var textAfter = origText.substr(endOfWordOffs);
      var token = '_magic_'+ Math.random() +'_'+ Math.random() +'_';
      var textWithToken = textBefore + token + textAfter;
      focusText.nodeValue = textWithToken; // this destroys `sel'
      sel = null;
      // Copy the post body, with the magic token, but skip inline threads.
      var $clean = $('<div></div>');
      $postBody.children('.dw-p-bd-blk').each(function() {
        $clean.append($(this).children().clone());  // .dw-i-ts skipped
      });
      // Undo the changes to the focused node.
      focusText.nodeValue = origText;
      // Remove all inline marks and threads from the copy.
      $clean.find('.dw-i-m-start').remove();
      var cleanHtmlWithMark = $clean.html();
      var sniff = TagDog.sniffHtml(cleanHtmlWithMark);
      // Find the text just after the mark.
      var tokenOffs = sniff.sniffedHtml.search(token);
      var justAfterMark = sniff.sniffedHtml.substr(
          tokenOffs + token.length, d.i.diffMatchPatch.maxMatchLength);
      return {
        textStart: justAfterMark,
        // Currently not possible to mark a range of chars:
        textEnd: justAfterMark,
        elem: elem
      };
    } else {
      die('[error DwE09k12rs52]'); // dead code
    }
  };

  // Open a menu, with Edit, Reply and Cancel buttons. CSS: '-i' means inline.
  $menu = $(  // COULD add i18n
      '<ul class="dw-as-inline">' +
        '<li><a class="dw-a-edit-i">Improve</a></li>' +
        // Disable inline replies for now, until I've made them work better,
        //'<li><a class="dw-a-reply-i">Reply inline</a></li>' +
        //'<li><a class="dw-a-mark-i">Mark</a></li>' + // COULD implement
      '</ul>');
  $menu.find('a').button();//"option", "disabled", true);

  // Place the center of the menu on the mouse click. Then the
  // user needs move the mouse only a tiny amount up/dow or
  // northeast/nw/se/sw, to click the relevant button (if there are
  // <= 4 menu buttons). — no, then a double click causes a button click,
  // instead of selecting a word.
  var $thread = $post.closest('.dw-t');
  var threadOfs = $thread.offset();
  $thread.append($menu);
  var menuHeight = $menu.outerHeight(true);  // after append

  $menu.css('left', event.pageX - threadOfs.left - 50)  // 50 px to the left
      .css('top', event.pageY - threadOfs.top - menuHeight - 10); // above click

  // Fill in the `where' form field with the text where the
  // click/selection was made. Google's diff-match-patch can match
  // only 32 chars so specify only 32 chars.
  // (All selected text:
  //    sel.getRangeAt(0).toString().substr(0,32);
  // but we're interested in the start and end of the selection/click.)
  // COULD consider using http://code.google.com/p/ierange/, so this stuff
  // works also with IE (6)/7/8.

  // Old comment? (2012-09-30 today)
  // BUG: Next line: Uncaught TypeError: Cannot read property 'data' of null

  // Bind actions.
  $menu.find('.dw-a-edit-i').click(function(event){
    d.i.$showEditForm.call($post, event);
    $menu.remove();
  });

  $menu.find('.dw-a-reply-i').click(function(event){
    // To have somewhere to place the reply form, split the block into
    // smaller .dw-p-bd-blk:s, and add .dw-i-ts, if not already
    // done (which is the case if this post has no inline replies).
    if (!$postBody.children('.dw-i-ts').length) {
      // This rearranging of elems destroys `sel', e.g. focusNode becomes null.
      $post.each(d.i.$splitBodyPlaceInlines);
    }
    // Find the text that was clicked. Cannot be done until now, because
    // this destroys the selection, `sel', and it wouldn't be possible
    // to select text at all, were this done directly when the $menu was
    // created. (Because your selection wound be destroyed when you made it.)
    var placeWhere = placeWhereFunc();

    d.i.$showReplyForm.call(this, event, placeWhere);
    $menu.remove();
  });

  // Remove the menu after any action has been taken, and on Cancel click.
  $menu.mouseleave(function(){
    $menu.remove();
  });

  // If the user doesn't use the menu, remove it…
  var removeMenuTimeout = setTimeout(function(){
    $menu.remove();
  }, 1500);

  //… but cancel the remove-unused-menu timeout on mouseenter.
  $menu.mouseenter(function(){
    clearTimeout(removeMenuTimeout);
  });

  $lastInlineMenu = $menu;
};


// On post text click, open the inline action menu.
// But hide it on mousedown, so the inline action menu disappears when you
// start the 2nd click of a double click, and appears first when the 2nd
// click is completed. Otherwise the inline menu gets in the
// way when you double click to select whole words. (Or triple click to
// select paragraphs.)
d.i.startInlineActionsMenu = function() {
  $(function() {
    $('.debiki')
        .delegate('.dw-p-bd-blk', 'mouseup', $showInlineActionMenu)
        .delegate('.dw-p-bd-blk', 'mousedown', $hideInlineActionMenu);
  });
};


// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
