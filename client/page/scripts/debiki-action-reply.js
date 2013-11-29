/* Shows a reply form, and some related tips.
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

(function() {

var d = { i: debiki.internal, u: debiki.v0.util };
var $ = d.i.$;


// Shows a reply form, either below the relevant post, or inside it,
// if the reply is an inline comment -- whichever is the case is determined
// by event.target [what? `event.target` isn't used anywhere! Old comment?]
d.i.$showReplyForm = function(event, opt_where) {
  event.preventDefault();
  // Warning: Some duplicated code, see .dw-r-tag click() above.
  var $thread = $(this).closest('.dw-t');
  var $replyAction = $thread.find('> .dw-p-as > .dw-a-reply');
  var $post = $thread.children('.dw-p');
  var postId = $post.dwPostIdStr();
  var horizLayout = $thread.is('.dw-hor');
  var replyCountBefore = $thread.find('> .dw-res > .dw-t').length;

  $replyAction.dwActionLinkDisable();

  function showSortOrderTipsLater($newPost, delay) {
    setTimeout(function() {
      var $tips = $('#dw-tps-sort-order');
      $tips.appendTo($newPost)
          .dwScrollIntoView()
          .click(function() {
        $tips.hide();
        showRateOwnCommentTipsLater($newPost, 400);
      });
    }, delay);
  }


  var $replyFormParent = d.i.newReplyFormHtml();
  var $replyForm = $replyFormParent.children('form');

  // Set XSRF token.
  $replyForm.find('input[name="dw-fi-xsrf"]').val($.cookie('XSRF-TOKEN'));

  d.u.makeIdsUniqueUpdateLabels($replyForm);

  $replyForm.resizable({
      alsoResize: $replyForm.find('textarea'),
      resize: function() {
        $post.each(d.i.SVG.$drawParents);
      },
      minHeight: 180,  // or lower parts of form might overflow
      minWidth: 210  // or Cancel button might float drop
    });

  var $anyHorizReplyBtn = $();
  var $submitBtn = $replyForm.find('.dw-fi-submit');
  var $cancelBtn = $replyForm.find('.dw-fi-cancel');

  $cancelBtn.click(function() {
    $replyAction.dwActionLinkEnable();
  });

  var setSubmitBtnTitle = function(event, userName) {
    var text = userName ?  'Post as '+ userName : 'Post as ...';  // i18n
    $submitBtn.val(text);
  }
  setSubmitBtnTitle(null, d.i.Me.getName());
  $submitBtn.each(d.i.$loginSubmitOnClick(setSubmitBtnTitle,
        { askAboutEmailNotfs: true, mode: 'SubmitComment' }));

  // Ajax-post reply on submit.
  $replyForm.submit(function() {
    $.post('?reply='+ postId +'&view='+ d.i.rootPostId,
        $replyForm.serialize(), 'json')
      .fail(d.i.showErrorEnableInputs($replyForm))
      .done(onCommentSaved);
    d.i.disableSubmittedForm($replyForm);
    return false;
  });

  function onCommentSaved(newDebateHtml) {
    // The server has replied. Merge in the data from the server
    // (i.e. the new post) in the debate.
    // Remove the reply form first — if you do it afterwards,
    // a .dw-t:last-child might fail (be false), because the form
    // would be the last child, resulting in a superfluous
    // dw-svg-fake-harrow.
    d.i.removeInstantly($replyFormParent);
    $replyAction.dwActionLinkEnable();
    var result = d.i.patchPage(newDebateHtml);
    var $myNewPost = result.patchedThreads[0].dwGetPost();
    d.u.bugIf($myNewPost.length !== 1, 'DwE3TW39');
    d.i.markMyPost($myNewPost.dwPostIdStr());
    // Any horizontal reply button has been hidden.
    $anyHorizReplyBtn.show();

    // Don't show sort order tips instantly, because if
    // the new comment and the tips appear at the same time,
    // the user will be confused? S/he won't know where to look?
    // So wait a few seconds.
    // Don't show sort order tips if there are few replies,
    // then nothing is really being sorted anyway.
    var showSortTips = horizLayout && replyCountBefore >= 2;
    if (showSortTips) showSortOrderTipsLater($myNewPost, 2050);

    d.i.showAndHighlightPost($myNewPost,
        { marginRight: 300, marginBottom: 300 });
    d.i.$showActions.apply($myNewPost);
  };

  // Fancy fancy
  $replyForm.find('.dw-submit-set input').button();
  $replyForm.find('label').addClass(
    // color and font matching <input> buttons
    'dw-ui-state-default-color dw-ui-widget-font');

  if (opt_where) {
    // The user replies to a specific piece of text inside the post.
    // Place the reply inline, and fill in the `where' form field with
    // the text where the click/selection was made.
    $replyFormParent.prependTo(opt_where.elem);
    $replyForm.find('input[id^="dw-fi-reply-where"]')
        .val(opt_where.textStart);
  } else if ($thread.is('.dw-hor')) {
    // Place the form in the child thread list, to the right
    // of the Reply button.
    var $actionsListItem = $thread.find('> ol.dw-res > li.dw-p-as');
    $actionsListItem.after($replyFormParent);
  }
  else {
    // Place the form below the post, in the .dw-res list
    var $res = $thread.children('.dw-res');
    if (!$res.length) {
      // This is the first reply; create the reply list.
      $res = $("<ol class='dw-res'/>").appendTo($thread);
    }
    $res.prepend($replyFormParent);
  }

  // For horizontal threads, hide the reply button, to give the impression
  // that the reply form replaces the reply button. Adjust the reply
  // form min-width so it starts with a width equal to the reply
  // button width — then the stuff to the right won't jump leftwards when
  // $anyHorizReplyBtn is hidden/shown and the $replyForm is shown/removed.
  if (horizLayout) {
    $anyHorizReplyBtn =
        $replyFormParent.prev().filter('.dw-p-as-hz').dwBugIfEmpty().hide();
    $replyForm.find('.dw-submit-set .dw-fi-cancel').click(function() {
      d.i.slideAwayRemove($replyFormParent, function() {
        $anyHorizReplyBtn.show();
      });
      // Cancel delegate, which also calls slideAwayRemove().
      return false;
    });
    $replyFormParent.css('min-width', $anyHorizReplyBtn.outerWidth(true));
  }

  // Slide in the reply form.
  $replyFormParent.each(d.i.$foldInLeft).queue(function(next) {
    $replyForm.dwScrollIntoView();
    next();
  });
};


})();

// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
