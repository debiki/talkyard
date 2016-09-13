/**
 * Copyright (C) 2010-2013 Kaj Magnus Lindberg (born 1979)
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


d.u.postJson = function(options) {
  if (options.showLoadingOverlay !== false) {
    showLoadingOverlay();
  }
  var timeoutHandle = setTimeout(function() {
    showServerJustStartedMessage();
    timeoutHandle = setTimeout(showErrorIfNotComplete, 23 * 1000);
  }, 7 * 1000);

  // Interpret the response using the data type specified by the server. Don't
  // specify 'json' because then jQuery complains if the server sends back nothing
  // (an empty string isn't ok JSON).
  return $.ajax({
    url: options.url,
    type: 'POST',
    data: JSON.stringify(options.data),
    contentType: 'application/json; charset=utf-8',
    headers: { 'X-XSRF-TOKEN': $.cookie('XSRF-TOKEN') },
    error: options.error,
    success: options.success,
    complete: function() {
      clearTimeout(timeoutHandle);
      if (options.showLoadingOverlay !== false) {
        removeLoadingOverlay();
      }
    }
  });
};


function showLoadingOverlay() {
  $('body').append(
    $.parseHTML('<div id="theLoadingOverlay"><div class="icon-loading"></div></div>'));
}


function showServerJustStartedMessage() {
  var messageText = "Sorry that this takes long. Perhaps the server was " +
      "just started, and is slow right now.";
  var messageElem = $($.parseHTML('<div id="theServerJustStarted"></div>')).text(messageText);
  $('#theLoadingOverlay').addClass('esLoadingSlow').append(messageElem);
}


function removeLoadingOverlay() {
  $('#theLoadingOverlay').remove();
}


function showErrorIfNotComplete() {
  var complete = !$('#theLoadingOverlay').length;
  if (!complete) {
    // Remove the spinner before showing the dialog.
    $('#theLoadingOverlay .icon-loading').remove();
    alert("Error: Server too slow [EsE5YK0W24]");
    removeLoadingOverlay();
  }
}

// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
