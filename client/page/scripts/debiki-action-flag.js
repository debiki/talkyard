/* Shows a flag-comment dialog.
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


// warning: dupl code, see initDeleteForm,
// and initLogout/initLoginSimple/initLoginOpenId etc.
// Solve like so: Merge this code into debiki-action-dialogs.ls.
function initFlagForm() {
  var $form = $('#dw-f-flg');
  var $parent = $form.parent();
  if ($parent.is('.ui-dialog-content'))
    return; // already inited

  $form.find('.dw-submit-set input').hide(); // use jQuery UI's buttons instead
  $form.find('.dw-f-flg-rsns').buttonset();
  $parent.dialog($.extend({}, d.i.jQueryDialogReset, {
    width: d.i.mobileWidthOr(430),
    buttons: {
      'Cancel': function() {
        $(this).dialog('close');
      },
      'Submit': function() {
        // COULD ensure details specified if "Others" reason selected.
        // COULD show a "Submitting..." message.
        if (!d.i.Me.isLoggedIn())
          $form.each(d.i.$loginThenSubmit)
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
        if (!d.i.Me.isLoggedIn())
          $form.each(d.i.$loginThenSubmit)
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
          d.i.showServerResponseDialog(responseHtml);
        })
        .fail(d.i.showServerResponseDialog);
    return false;
  });
};


// warning, dupl code, see $showDeleteCommentForm.
d.i.$showFlagForm = function(event) {
  event.preventDefault();
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
};


})();

// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
