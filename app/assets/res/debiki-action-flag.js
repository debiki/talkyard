/* Copyright (c) 2010 - 2012 Kaj Magnus Lindberg. All rights reserved. */

(function() {

var d = { i: debiki.internal, u: debiki.v0.util };
var $ = d.i.$;


// warning: dupl code, see initDeleteForm,
// and initLogout/initLoginSimple/initLoginOpenId etc.
// COULD break out some common dialog init/show functions?
function initFlagForm() {
  var $form = $('#dw-f-flg');
  var $parent = $form.parent();
  if ($parent.is('.ui-dialog-content'))
    return; // already inited

  $form.find('.dw-submit-set input').hide(); // use jQuery UI's buttons instead
  $form.find('.dw-f-flg-rsns').buttonset();
  $parent.dialog($.extend({}, jQueryDialogReset, {
    width: mobileWidthOr(430),
    buttons: {
      'Cancel': function() {
        $(this).dialog('close');
      },
      'Submit': function() {
        // COULD ensure details specified if "Others" reason selected.
        // COULD show a "Submitting..." message.
        if (!Me.isLoggedIn())
          $form.each($loginThenSubmit)
        else
          $form.submit();
      }
    }
    /* buttons: [ // {{{ weird, this results in button titles '0' and '1'
      { text: 'Cancel', click: function() {
        $(this).dialog('close');
      }},
      { id: 'dw-fi-flg-submit', text: 'Submit', disabled: 'disabled',
          click: function() {
        // COULD ensure details specified if "Others" reason selected.
        // COULD show a "Submitting..." message.
        if (!Me.isLoggedIn())
          $form.each($loginThenSubmit)
        else
          $form.submit();
      }}],   }}} */
  }));

  // {{{ How to enable the submit button on radio button click?
  // Below button(option ...) stuff results in:
  //    Uncaught TypeError: Object function () {
  //       $('#dw-fi-flg-submit').button('option', 'disabled', false);
  //     } has no method 'split'
  //$('#dw-fi-flg-submit').button('option', 'disabled', true);
  //$form.find('.dw-f-flg-rsns label').one(function() {
  //  $('#dw-fi-flg-submit').button('option', 'disabled', false);
  //});
  // }}}

  $form.submit(function() {
    $.post($form.attr("action"), $form.serialize(), 'html')
        .done(function(responseHtml) {
          $parent.dialog('close');
          // Don't show already submitted text if reopening form,
          // and leave the reason radio buttons unchecked.
          $form.find('textarea').val('').end()
              .find('input:checked')
                .prop('checked', false).button('refresh');
          showServerResponseDialog(responseHtml);
        })
        .fail(showServerResponseDialog);
    return false;
  });
}


// warning, dupl code, see $showDeleteCommentForm.
function $showFlagForm() {
  initFlagForm();
  var $i = $(this);
  var $t = $i.closest('.dw-t');
  var $post = $t.children('.dw-p');
  var postId = $post.dwPostId();
  var $flagForm = $('#dw-f-flg');
  $flagForm
      .attr('action', '?flag='+ postId)
      .parent().dialog('open');  //parent().position({
      //my: 'center top', at: 'center bottom', of: $post, offset: '0 40'});
}


})();

// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
