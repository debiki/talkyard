/* Copyright (c) 2010 - 2012 Kaj Magnus Lindberg. All rights reserved. */


(function() {

var d = { i: debiki.internal, u: debiki.v0.util };
var $ = d.i.$;


function $makePostHeadTooltips() {  // i18n
  if (!$.fn.tooltip) return; // tooltips not loaded
  var $postHead = $(this);
  if ($postHead.find('[data-original-title]').length)
    return; // tooltips already added

  // Tooltips explaining '?' and '??' login type indicators.
  $postHead.find('.dw-lg-t-spl').each(function() {
    var tip;
    var $i = $(this);
    if ($i.text() == '??') {
      tip = '<b>??</b> means that the user has not logged in,'+
          ' so <i>anyone</i> can pretend to be this user&nbsp;(!),'+
          ' and not specified any email address.'
      // better?: does not receive email notifications.'
    }
    else if ($i.text() == '?') {
      tip = '<b>?</b> means that the user has not logged in,'+
          ' so <i>anyone</i> can pretend to be this user&nbsp;(!),'+
          ' but has specified an email address.'
        // and receives email notifications.'
    }
    else d.u.die();

    $i.tooltip({
      title: tip,
      placement: 'right' // or '?' cursor hides tooltip arrow
    });
  });
};


// Create tooltips lazily.
$('.debiki').delegate('.dw-p-hd', 'mouseenter', $makePostHeadTooltips);


})();

// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
