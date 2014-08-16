/* Shows a server HTTP response in a jQuery UI dialog.
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
    $html = $(
        '<div>' +
        //'<pre class="dw-dlg-rsp-status"></pre>' + — already in the title
        '<pre class="dw-dlg-rsp-message"></pre>' +
        '</div>');
    width = Math.min($(window).width() - 60, 800);
    // Use text(), not plus (don't: `... + text + ...'), to prevent xss issues.
    // The first line is the status code and status text,
    // the second line is any message.
    var statusAndMessage = plainText.split('\n');
    var status = statusAndMessage[0];
    var message = statusAndMessage[1];
    //$html.find('.dw-dlg-rsp-status').text(status || opt_errorType || 'Unknown error');
    $html.find('.dw-dlg-rsp-message').text(message  || '');
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


// vim: fdm=marker et ts=2 sw=2 fo=tcqwn list
