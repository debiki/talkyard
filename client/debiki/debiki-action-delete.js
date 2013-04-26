/* Copyright (c) 2010 - 2012 Kaj Magnus Lindberg. All rights reserved. */


(function() {

var d = { i: debiki.internal, u: debiki.v0.util };
var $ = d.i.$;


// warning: dupl code, see initFlagForm.
// Solve like so: Merge this code into debiki-action-dialogs.ls.
function initDeleteForm() {
  var $form = $('#dw-f-dl');
  var $parent = $form.parent();
  if ($parent.is('.ui-dialog-content'))
    return; // already inited

  $form.find('.dw-fi-submit').button().click(function() {
    if (!d.i.Me.isLoggedIn()) $form.each(d.i.$loginThenSubmit);
    else $form.submit();
    return false;
  });

  $form.find('.dw-fi-cancel').button().click(function() {
    $parent.dialog('close');
  });


  $parent.dialog($.extend({}, d.i.jQueryDialogReset, {
    width: d.i.mobileWidthOr(360)
  }));

  $form.submit(function() {
    $.post($form.attr("action"), $form.serialize(), 'html')
        .done(function(responseHtml) {
          $parent.dialog('close');
          // Don't show already submitted deletion reason,
          // if reopening form, and clear the delete-all-replies
          // checkbox.
          $form.find('textarea').val('').end()
              .find('input:checked')
                .prop('checked', false).button('refresh');
          d.i.showServerResponseDialog(responseHtml);
        })
        .fail(d.i.showServerResponseDialog);
    return false;
  });
};


// warning: dupl code, see $showFlagForm.
d.i.$showDeleteForm = function(event) {
  event.preventDefault();
  initDeleteForm();
  var $i = $(this);
  var $t = $i.closest('.dw-t');
  var $post = $t.children('.dw-p');
  var postId = $post.dwPostId();
  var $deleteForm = $('#dw-f-dl');
  $deleteForm
      .attr('action', '?delete='+ postId)
      .parent().dialog('open');  //.parent().position({
      //my: 'center top', at: 'center bottom', of: $post, offset: '0 40'});
};


})();

// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
