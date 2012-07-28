/* Copyright (c) 2010 - 2012 Kaj Magnus Lindberg. All rights reserved. */


(function() {

var d = { i: debiki.internal, u: debiki.v0.util };
var $ = d.i.$;


d.i.$showEditsDialog = function() {
  var $post = $(this).closest('.dw-t').children('.dw-p');
  d.i.$loadEditorDependencies.call($post).done(function() {
    showEditsDialogImpl($post);
  });
}


function showEditsDialogImpl($post) {
  var $thread = $post.closest('.dw-t');
  var $postBody = $post.children('.dw-p-bd');
  var postId = $post.dwPostId();

  $.get('?viewedits='+ postId +'&view='+ d.i.rootPostId, 'text')
      .fail(d.i.showServerResponseDialog)
      .done(function(editsHtml) {
    var $editDlg = $(editsHtml).filter('form#dw-e-sgs'); // filter out text node
    var buttons = {
      Cancel: function() {
        $(this).dialog('close');
      }
    };
    if ($editDlg.is('.dw-e-sgs-may-edit')) buttons.Save = function() {
      // COULD show "Saving..." dialog and close when done.
      // Otherwise the new html might arrive when the user has started
      // doing something else.
      $(this).submit().dialog('close');
    };
    $editDlg.dialog($.extend({}, d.i.jQueryDialogDefault, {
      width: 1000,
      height: 600,
      buttons: buttons,
      close: function() {
        // Need to remove() this, so ids won't clash should a new form
        // be loaded later.
        $(this).remove();
      }
    }));

    initSuggestions($editDlg); // later:? .find('#dw-e-tb-sgs'));
    // For now, open directly, discard on close and
    // load a new one, if "Edit" clicked again later.
    $editDlg.dialog('open');

    // Don't focus the first checkbox input — jQuery UI's focus color makes
    // it impossible to tell whether it has focus only, or if it's actually
    // selected. TODO change jQuery UI's focus colors — the Theme Roller,
    // change the Clickable: hover state.
    // (By default, jQuery UI focuses the :first:tabbable element in the
    // .ui-dialog-content, rather than the .ui-dialog-buttonpane.)
    $editDlg.parent().find('.ui-dialog-buttonpane :tabbable:first').focus();
  });

  var appdelSeqNo = 0;

  function initSuggestions($form) {
    // Update diff and preview, when hovering a suggestion.
    $form.find('li.dw-e-sg').mouseenter(function() {
      // Compute the text of the post as of when this edit
      // was *suggested*. This shows the *intentions* of the one
      // who suggested the changes.
      // COULD also show the results of applying the patch to
      // the current text (as of now).
      // - When hovering the edit <li>, show the intentions.
      // - But when hovering the Apply/Undo button, show the results
      //   of applying/undoing.
      // - Add tabs at the top of the edit, which one can click,
      //   to decide which diff to show.
      var suggestionDate = $(this).find('.dw-e-sg-dt').attr('title');
      var curSrc = textAsOf(suggestionDate);
      var patchText = $(this).find('.dw-e-text').text();

      // Make a nice html diff.
      // (I don't know how to convert patches to diffs, without
      // actually applying the patch first, and calling diff_main.)
      var patches = d.i.diffMatchPatch.patch_fromText(patchText);
      // COULD check [1, 2, 3, …] to find out if the patch applied
      // cleanaly. (The result is in [0].)
      var newSrc = d.i.diffMatchPatch.patch_apply(patches, curSrc)[0];
      var diff = d.i.diffMatchPatch.diff_main(curSrc, newSrc); // <- how avoid?
      d.i.diffMatchPatch.diff_cleanupSemantic(diff);
      var diffHtml = d.i.prettyHtmlFor(diff);

      // Remove any old diff and show the new one.
      var $diff = $form.find('#dw-e-sgs-diff-text');
      $diff.children('.dw-x-diff').remove();
      $diff.append('<div class="dw-x-diff">'+ diffHtml +'</div>\n');
      // Update the preview.
      // COULD make this work with other types of markdown than `dmd0'.
      // See $updateEditFormPreview(), which handles other markup types.
      var sanitizerOptions = d.i.sanitizerOptsForPost($post);
      var html = d.i.markdownToSafeHtml(newSrc, d.i.hostAndPort,
          sanitizerOptions);
      $form.find('#dw-e-sgs-prvw-html').html(html);
    });

    // Applies all edits up to, but not including, the specified date.
    // Returns the resulting text.
    // Keep in sync with textAsOf in debate.scala (renamed to page.scala?).
    // SHOULD find the markup type in use too. Would require that the
    // markup type be sent by the server.
    // TODO also consider edit suggestions marked for application.
    // TODO consider skipping edit-apps marked for undo.
    // TODO when showing the changes *intended*, take into account
    // edit appls that were not deleted at the point in time when the
    // suggestion was made (but perhaps were deleted later)
    // (Otherwise, if [some patch that was in effect when the suggestion
    // was made] has been reverted, it might not be possible to understand
    // the intention of the patch.)
    function textAsOf(dateIso8601) {
      // The edit apps should already be sorted: most recent first,
      // see html.scala.
      var eapps = $form.find('#dw-e-sgs-applied li').filter(function() {
        var eappDate = $(this).find('.dw-e-ap-dt').attr('title');
        return eappDate < dateIso8601;
      });
      var origText = $form.find('#dw-e-sgs-org-src').text();
      var curText = origText;
      eapps.each(function() {
        var patchText = $(this).find('.dw-e-text').text();
        var patches = d.i.diffMatchPatch.patch_fromText(patchText);
        // COULD check [1, 2, 3, …] to find out if the patch applied
        // cleanaly. (The result is in [0].)
        var newText = d.i.diffMatchPatch.patch_apply(patches, curText)[0];
        curText = newText;
      });
      return curText;
    }

    $form.find('input').button().click(function() {
      // Update a sequence number at the start of the input value,
      // e.g. change '10-delete-r0m84610qy' to '15-delete-r0m84610qy'.
      var v = $(this).val();
      appdelSeqNo += 1;
      var v2 = v.replace(/^\d*-/, appdelSeqNo +'-');
      $(this).val(v2);
      // TODO update save-diff and preview.
    });

    $form.submit(function() {
      var postData = $form.serialize();
      $.post($form.attr('action'), postData, 'html')
          .fail(d.i.showServerResponseDialog)
          .done(function(recentChangesHtml) {
        d.i.mergeChangesIntoPage(recentChangesHtml);
        $form.dialog('close');
      });
      return false;
    });
  }
}


// Show a change diff instead of the post text, when hovering an edit
// suggestion.
$('.debiki')
    .delegate('.dw-e-sg', 'mouseenter', function() {
      // COULD move find(...) to inside $showEditDiff?
      // (Don't want such logic placed down here.)
      $(this).find('.dw-e-text').each(d.i.$showEditDiff);
    })
    .delegate('.dw-e-sgs', 'mouseleave', d.i.$removeEditDiff);


})();

// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
