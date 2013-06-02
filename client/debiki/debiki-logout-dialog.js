/* Shows a logout dialog.
 * Copyright (C) 2012-2012 Kaj Magnus Lindberg (born 1979)
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


function showLogout() {
  initLogout();
  $('#dw-fs-lgo').dialog('open');
};


function initLogout() {
  var $logout = $('#dw-fs-lgo');
  if ($logout.is('.ui-dialog-content'))
    return; // already inited

  var $logoutForm = $logout.find('form');
  // Use jQuery UI's dialog buttons instead; remove so ids won't clash:
  $logout.find('input').remove();

  $logout.dialog($.extend({}, d.i.jQueryDialogDefault, {
    height: 180,
    width: 280,
    buttons: [{
      text: 'Cancel',
      id: 'dw-f-lgo-cancel',
      click: function() {
        $(this).dialog('close');
      }
    }, {
      text: 'Log out',
      id: 'dw-f-lgo-submit',
      click: function() {
        $(this).dialog('close');
        $logoutForm.submit();
      }
    }]
  }));
  $logoutForm.submit(function() {
    // Don't clear the user name and email cookies until the server has
    // indeed logged out the user.
    var postData = $logoutForm.serialize();
    $.post($logoutForm.attr("action"), postData, function() {
      // The server has now logged out the user.
      d.i.Me.fireLogout();
    }, 'html');
    return false;
  });
};



$(function() {
  $('#dw-a-logout').click(showLogout);
});


// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
