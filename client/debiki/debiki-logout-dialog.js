/* Copyright (c) 2010-2012 Kaj Magnus Lindberg. All rights reserved. */


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
