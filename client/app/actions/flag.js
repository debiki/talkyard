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

var d = { i: debiki.internal, u: debiki.v0.util };
var $ = d.i.$;


d.i.$showFlagForm = function(event) {
  event.preventDefault();

  var $i = $(this);
  var $t = $i.closest('.dw-t');
  var $post = $t.children('.dw-p');
  var postId = $post.dwPostId();
  var flagDialog = $('.dw-f-flg').parent().clone();

  initFlagDialog(flagDialog, postId);

  flagDialog.dialog('open');  //.position({
      //my: 'center top', at: 'center bottom', of: $post, offset: '0 40'});
};


function initFlagDialog(flagDialog, postId) {
  var $form = flagDialog.children('form');

  $form.find('.dw-submit-set input').hide(); // use jQuery UI's buttons instead
  $form.find('.dw-f-flg-rsns').buttonset();

  // In case there are many flag forms: (currently there're 2: the cloned template,
  // and $form).
  d.u.makeIdsUniqueUpdateLabels($form);

  //flagDialog.dialog d.i.newModalDialogSettings({ width: 350 })

  flagDialog.dialog($.extend({}, d.i.jQueryDialogDestroy, {
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
    var type = $form.find('input:radio:checked').val() || 'Other';
    var reason = $form.find('textarea').val();
    d.u.postJson({
        url: d.i.serverOrigin + '/-/flag',
        data: {
          pageId: d.i.pageId,
          postId: postId,
          type: type,
          reason: reason
        },
        error: d.i.showServerResponseDialog,
        success: onFlagSaved
      });

    function onFlagSaved(flagsPatchJson) {
      flagDialog.dialog('close');
      d.i.patchPage(flagsPatchJson);
      alert("Thanks. You have reported it. Someone will review it and "+
        "perhaps delete it or remove parts of it.");
    }

    return false;
  });
};


// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
