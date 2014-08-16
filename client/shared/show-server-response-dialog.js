/* Dialos that show responses from server, e.g. error dialogs.
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


// Returns $(an-error-message-in-a-<div>), which you can .insertAfter
// something, to indicate e.g. the server refused to accept the
// suggested edits.
// COULD remove this function! And let the server reply via
// FormHtml._responseDialog, and use (a modified version of?)
// showServerResponseDialog() (below) to construct an error info box.
// Then this would work with javascript disabled, and i18n would be
// handled server side.
function notifErrorBox$(error, message, details) {
  var when = ''
  try { when = (new Date).toISOString(); } catch (e) {}
  var $box = $(
      '<div class="ui-widget dw-ntf">' +
        '<div class="ui-state-error ui-corner-all">' +
          '<a class="ui-dialog-titlebar-close ui-corner-all" role="button">' +
            '<span class="ui-icon ui-icon-closethick">close</span>' +
          '</a>' +
          '<span class="ui-icon ui-icon-alert" ' +
                'style="float: left; margin-right: .3em;"></span>' +
          '<div class="dw-ntf-bd">' +
            '<div class="dw-ntf-sts"></div> ' +
            '<div class="dw-ntf-msg"></div>' +
            '<div class="dw-ntf-at">'+ when +'</div>' +
            (details ?
               '<br><a class="dw-ntf-shw">Show details</a>' +
               '<pre class="dw-ntf-dtl"></pre>' : '') +
          '</div>' +
        '</div>' +
      '</div>');
  var $showDetails = $box.find('a.dw-ntf-shw');
  var $details = $box.find('.dw-ntf-dtl');
  error = error ? error +':' : ''
  // I don't use jQuery's .tmpl: .text(...) is xss safe, .tmpl(...) is not?
  $box.find('.dw-ntf-sts').text(error).end()
      .find('.dw-ntf-msg').text(message).end()
      .find('.dw-ntf-dtl').text(details || '').hide().end()
      .find('.dw-ntf-shw').click(function() {
        $details.toggle();
        $showDetails.text(
            $details.filter(':visible').length ?
               'Hide details' : 'Show details');
      }).end()
      .find('a.ui-dialog-titlebar-close').click(function() {
        $box.remove();
      });
  return $box;
};


d.i.disableSubmittedForm = function($form) {
  $form.children().css('opacity', '0.7').find('input').dwDisable();
  // Show a 'Submitting ...' tips. CSS places it in the middle of the form.
  var $info = $('#dw-hidden-templates .dw-inf-submitting-form').clone();
  $form.append($info);
};


// Builds a function that shows an error notification and enables
// inputs again (e.g. the submit-form button again, so the user can
// fix the error, after having considered the error message,
// and attempt to submit again).
d.i.showErrorEnableInputs = function($form) {
  return function(jqXHR, errorType, httpStatusText) {
    // If we're using JSONP, we might have gotten no arguments at all, because on failure
    // the server cannot reply, since we're communicating via <script> tags. So:
    jqXHR = jqXHR || {};

    var $submitBtns = $form.find('.dw-submit-set');
    var $thread = $form.closest('.dw-t');
    var err = jqXHR.status ? (jqXHR.status +' '+ httpStatusText) : 'Error'
    var msg = (jqXHR.responseText || errorType || 'Unknown error');
    notifErrorBox$(err, msg).insertAfter($submitBtns).dwScrollToHighlighted();
    $thread.each(d.i.SVG.$drawParentsAndTree); // because of the notification
    // For now, simply enable all inputs always.
    $form.children().css('opacity', '');
    $form.find('input, button').dwEnable();
    $form.children('.dw-inf-submitting-form').remove();
  };
};


// Constructs and shows a dialog, from either 1) a servers html response,
// which should contain certain html elems and classes, or 2)
// a jQuery jqXhr object.
d.i.showServerResponseDialog = function(jqXhrOrHtml, opt_errorType,
                                  opt_httpStatusText, opt_continue) {
  var $html, title, width;
  var html, plainText;

  // Find html or plain text.
  if (!jqXhrOrHtml.getResponseHeader) {
    html = jqXhrOrHtml;
  }
  else {
    var contentType = jqXhrOrHtml.getResponseHeader('Content-Type');
    if (!contentType) {
      plainText = '(no Content-Type header)';
      if (jqXhrOrHtml.state && jqXhrOrHtml.state() == 'rejected') {
        plainText = plainText + '\n($.Deferred was rejected)';
      }
    }
    else if (contentType.indexOf('text/html') !== -1) {
      html = jqXhrOrHtml.responseText;
    }
    else if (contentType.indexOf('text/plain') !== -1) {
      plainText = jqXhrOrHtml.responseText;
    }
    else {
      die2('DwE94ki3');
    }
  }

  // Format dialog contents.
  if (html) {
    var $allHtml = $(html);
    $html = $allHtml.filter('.dw-dlg-rsp');
    if (!$html.length) $html = $allHtml.find('.dw-dlg-rsp');
    if ($html.length) {
      title = $html.children('.dw-dlg-rsp-ttl').text();
      width = d.i.jQueryDialogDefault.width;
    } else {
      plainText = 'Internal server error.';
    }
  }

  if (plainText) {
    // Set title to something like "403 Forbidden", and show the
    // text message inside the dialog.
    title = jqXhrOrHtml.status ?
              (jqXhrOrHtml.status +' '+ opt_httpStatusText) : 'Error'
    $html = $('<pre class="dw-dlg-rsp"></pre>');
    width = 'auto'; // avoids scrollbars in case of any long <pre> line
    // Use text(), not plus (don't: `... + text + ...'), to prevent xss issues.
    $html.text(plainText || opt_errorType || 'Unknown error');
  }
  else if (!html) {
    die2('DwE05GR5');
  }

  // Show dialog.
  $html.children('.dw-dlg-rsp-ttl').remove();
  $html.dialog($.extend({}, d.i.jQueryDialogNoClose, {
    title: title,
    autoOpen: true,
    width: width,
    buttons: [{
      text: 'OK',
      id: 'dw-dlg-rsp-ok',
      click: function() {
        // Remove the dialog, so the OK button id can be reused
        // — then it's easier to write automatic tests.
        $(this).dialog('destroy').remove()
        if (opt_continue) opt_continue();
      }
    }]
  }));
};


})();

// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
