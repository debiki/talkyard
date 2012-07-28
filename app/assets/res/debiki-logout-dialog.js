/* Copyright (c) 2010 - 2012 Kaj Magnus Lindberg. All rights reserved. */


(function() {

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
  $logout.find('input').hide(); // Use jQuery UI's dialog buttons instead
  $logout.dialog($.extend({}, d.i.jQueryDialogDefault, {
    height: 180,
    width: 280,
    buttons: {
      Cancel: function() {
        $(this).dialog('close');
      },
      'Log out': function() {
        $(this).dialog('close');
        $logoutForm.submit();
      }
    }
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


$('#dw-a-logout').click(showLogout);

})();

// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
