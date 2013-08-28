/* Shows a delete comment dialog.
 * Copyright (C) 2010-2012 Kaj Magnus Lindberg (born 1979)
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
        .done(function(json) {
          $parent.dialog('close');
          // Don't show already submitted deletion reason,
          // if reopening form, and clear the delete-all-replies
          // checkbox.
          $form.find('textarea').val('').end()
              .find('input:checked')
                .prop('checked', false).button('refresh');

          var result = d.i.patchPage(json, { overwriteTrees: true });
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
